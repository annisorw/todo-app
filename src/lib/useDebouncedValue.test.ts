import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function renderDebounced(initial: string, delayMs = 180) {
    return renderHook(({ value }: { value: string }) => useDebouncedValue(value, delayMs), {
      initialProps: { value: initial },
    })
  }

  it('keeps the initial value synchronously', () => {
    const { result } = renderDebounced('a')
    expect(result.current).toBe('a')
  })

  it('does not update before the delay has passed', () => {
    const { result, rerender } = renderDebounced('a')

    act(() => {
      rerender({ value: 'ab' })
    })
    act(() => {
      vi.advanceTimersByTime(179)
    })

    expect(result.current).toBe('a')
  })

  it('updates once the delay has fully passed', () => {
    const { result, rerender } = renderDebounced('a')

    act(() => {
      rerender({ value: 'ab' })
    })
    act(() => {
      vi.advanceTimersByTime(180)
    })

    expect(result.current).toBe('ab')
  })

  it('collapses a burst of changes into the last value only', () => {
    const { result, rerender } = renderDebounced('a')

    for (const next of ['ab', 'abc', 'abcd']) {
      act(() => {
        rerender({ value: next })
      })
      act(() => {
        vi.advanceTimersByTime(100)
      })
    }

    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(180)
    })

    expect(result.current).toBe('abcd')
  })
})
