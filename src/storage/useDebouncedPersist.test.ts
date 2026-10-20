import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../domain/task'
import { makeTasks } from '../test/factories'
import { quotaError, stubLocalStorage } from '../test/storage'
import type { StorageStub } from '../test/storage'
import { TASKS_STORAGE_KEY } from './taskStorage'
import { PERSIST_DEBOUNCE_MS, useDebouncedPersist } from './useDebouncedPersist'

const silenceWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined)

describe('useDebouncedPersist', () => {
  let stub: StorageStub | null = null
  let warn: ReturnType<typeof silenceWarnings>

  beforeEach(() => {
    vi.useFakeTimers()
    warn = silenceWarnings()
  })

  afterEach(() => {
    vi.useRealTimers()
    stub?.restore()
    stub = null
    warn.mockRestore()
  })

  function renderPersist(tasks: Task[], onError = vi.fn()) {
    const view = renderHook(({ value }: { value: Task[] }) => useDebouncedPersist(value, onError), {
      initialProps: { value: tasks },
    })
    return { ...view, onError }
  }

  it('collapses a burst of changes into a single write', () => {
    stub = stubLocalStorage()
    const { rerender } = renderPersist(makeTasks(1))

    for (let count = 2; count <= 5; count += 1) {
      act(() => {
        rerender({ value: makeTasks(count) })
      })
      act(() => {
        vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS - 50)
      })
    }

    expect(stub.setItem).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
    })

    expect(stub.setItem).toHaveBeenCalledOnce()
    const raw = stub.items.get(TASKS_STORAGE_KEY) ?? ''
    expect(JSON.parse(raw)).toEqual({ version: 1, tasks: makeTasks(5) })
  })

  it('waits the agreed 250 ms before writing', () => {
    stub = stubLocalStorage()
    renderPersist(makeTasks(1))

    act(() => {
      vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS - 1)
    })
    expect(stub.setItem).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(stub.setItem).toHaveBeenCalledOnce()
  })

  it('flushes what is pending on unmount instead of losing it', () => {
    stub = stubLocalStorage()
    const { rerender, unmount } = renderPersist(makeTasks(1))

    act(() => {
      rerender({ value: makeTasks(3) })
    })
    unmount()

    expect(stub.setItem).toHaveBeenCalledOnce()
    const raw = stub.items.get(TASKS_STORAGE_KEY) ?? ''
    expect(JSON.parse(raw)).toEqual({ version: 1, tasks: makeTasks(3) })
  })

  it('does not write twice when the timer already fired', () => {
    stub = stubLocalStorage()
    const { unmount } = renderPersist(makeTasks(1))

    act(() => {
      vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
    })
    unmount()

    expect(stub.setItem).toHaveBeenCalledOnce()
  })

  it('reports a failed write to the caller', () => {
    stub = stubLocalStorage({ writeError: quotaError() })
    const { onError } = renderPersist(makeTasks(1))

    act(() => {
      vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
    })

    expect(onError).toHaveBeenCalledWith('quota')
  })

  it('stays silent when the write succeeds', () => {
    stub = stubLocalStorage()
    const { onError } = renderPersist(makeTasks(1))

    act(() => {
      vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
    })

    expect(onError).not.toHaveBeenCalled()
  })
})
