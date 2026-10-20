import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTasks } from '../test/factories'
import { blockedError, quotaError, storedItems, storedPayload, stubLocalStorage } from '../test/storage'
import type { StorageStub } from '../test/storage'
import { TASKS_STORAGE_KEY } from '../storage/taskStorage'
import { PERSIST_DEBOUNCE_MS } from '../storage/useDebouncedPersist'
import { TaskStoreProvider } from '../state/TaskStoreProvider'
import { ToastProvider } from '../state/ToastProvider'
import { ErrorBanner } from './ErrorBanner'

function renderBanner() {
  return render(
    <TaskStoreProvider>
      <ToastProvider>
        <ErrorBanner />
      </ToastProvider>
    </TaskStoreProvider>,
  )
}

const silenceWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined)

describe('ErrorBanner', () => {
  let stub: StorageStub | null = null
  let warn: ReturnType<typeof silenceWarnings>
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let anchorClick: ReturnType<typeof vi.spyOn>

  afterEach(() => {
    // Insurance against a stray fake timer hanging the next test's userEvent
    // calls (same gotcha as TaskStoreProvider.test.tsx).
    vi.useRealTimers()
    stub?.restore()
    stub = null
    warn.mockRestore()
    anchorClick.mockRestore()
    vi.unstubAllGlobals()
  })

  function setup() {
    warn = silenceWarnings()
    createObjectURL = vi.fn(() => 'blob:mock')
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    // jsdom logs "not implemented: navigation" when an <a> with href actually
    // navigates; the component never needs the click to do anything real.
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  }

  it('renders nothing while storage is healthy', () => {
    setup()
    stub = stubLocalStorage()
    renderBanner()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the S9 copy for a blocked (private-mode) storage', () => {
    setup()
    stub = stubLocalStorage({ accessError: blockedError() })
    renderBanner()

    const banner = screen.getByRole('alert')
    expect(banner).toHaveTextContent('Не удаётся сохранить изменения')
    expect(banner).toHaveTextContent('Браузер заблокировал локальное хранилище')
  })

  it('shows quota-exhausted copy', () => {
    setup()
    vi.useFakeTimers()
    stub = stubLocalStorage({ writeError: quotaError() })
    renderBanner()

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Место в хранилище браузера закончилось')
  })

  it('shows corrupted-data copy', () => {
    setup()
    stub = stubLocalStorage({ items: storedItems('{{{') })
    renderBanner()

    expect(screen.getByRole('alert')).toHaveTextContent('Сохранённые данные повреждены')
  })

  /**
   * [FELA-64](/FELA/issues/FELA-64): the button writes. Quota frees up between
   * the failed debounced write and the click, so the retry lands and the banner
   * goes away because storage is healthy again — not because it was dismissed.
   */
  it('writes the list on "Повторить" and closes once the write lands', () => {
    setup()
    vi.useFakeTimers()
    stub = stubLocalStorage({ items: storedItems(storedPayload(makeTasks(2))) })
    stub.setItem.mockImplementationOnce(() => {
      throw quotaError()
    })
    renderBanner()

    act(() => {
      vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Место в хранилище браузера закончилось')

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // Два обращения: упавший проход персиста и удавшаяся запись по нажатию.
    expect(stub.setItem).toHaveBeenCalledTimes(2)
    expect(stub.setItem).toHaveBeenLastCalledWith(TASKS_STORAGE_KEY, expect.any(String))
    const raw = stub.items.get(TASKS_STORAGE_KEY) ?? ''
    expect(JSON.parse(raw)).toEqual({ version: 1, tasks: makeTasks(2) })
  })

  /**
   * The defect this ticket fixes: the old handler was `dismissStorageError`, so
   * the banner vanished with nothing written. Put that back and this test reds.
   */
  it('keeps the banner up when the retry write fails too', () => {
    setup()
    vi.useFakeTimers()
    stub = stubLocalStorage({ accessError: blockedError() })
    renderBanner()

    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Браузер заблокировал локальное хранилище')
  })

  it('exports the current in-memory tasks as JSON when a write is blocked', async () => {
    setup()
    const user = userEvent.setup()
    vi.useFakeTimers()
    // A write failure, not an access failure: the initial read has to
    // succeed so there's something in memory to export.
    stub = stubLocalStorage({
      items: storedItems(storedPayload(makeTasks(2))),
      writeError: blockedError(),
    })
    renderBanner()

    act(() => {
      vi.advanceTimersByTime(300)
    })
    vi.useRealTimers()

    await user.click(screen.getByRole('button', { name: 'Выгрузить в файл' }))

    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    const content = JSON.parse(await blob.text())
    expect(content).toEqual({ version: 1, tasks: makeTasks(2) })
  })

  it('exports the quarantined raw bytes, not an empty list, when storage is corrupted', async () => {
    setup()
    const user = userEvent.setup()
    const truncated = '{"version":1,"tasks":[{"id":"a","title":"Первая"},'
    stub = stubLocalStorage({ items: storedItems(truncated) })
    renderBanner()

    await user.click(screen.getByRole('button', { name: 'Выгрузить в файл' }))

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(await blob.text()).toBe(truncated)
  })

  it('refuses to export an empty envelope when the quarantine copy never landed', async () => {
    setup()
    const user = userEvent.setup()
    const truncated = '{"version":1,"tasks":[{"id":"a","title":"Первая"},'
    // The quarantine write itself fails (e.g. quota exhausted), so there is
    // no backup to hand back — the export must not claim otherwise.
    stub = stubLocalStorage({ items: storedItems(truncated), writeError: quotaError() })
    renderBanner()

    await user.click(screen.getByRole('button', { name: 'Выгрузить в файл' }))

    expect(createObjectURL).not.toHaveBeenCalled()
    expect(screen.getByText(/Выгружать нечего/)).toBeInTheDocument()
  })
})
