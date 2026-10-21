import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTasks } from '../test/factories'
import { blockedError, quotaError, storedItems, storedPayload, stubLocalStorage } from '../test/storage'
import type { StorageStub } from '../test/storage'
import { CORRUPTED_BACKUP_KEY, TASKS_STORAGE_KEY } from '../storage/taskStorage'
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

  it('shows the design-quarantine-surface §4A copy, with "Выгрузить в файл" and "Удалить копию"', () => {
    setup()
    stub = stubLocalStorage({ items: storedItems('{{{') })
    renderBanner()

    const banner = screen.getByRole('alert')
    expect(banner).toHaveTextContent('Не удалось прочитать сохранённые задачи')
    expect(banner).toHaveTextContent('Сохранённые задачи не читаются, поэтому список начат заново.')
    expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Выгрузить в файл' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Удалить копию' })).toBeInTheDocument()
  })

  /**
   * Критерий 7 спеки: пустой карантин оставляет в A только текст — ни
   * «Выгрузить в файл», ни «Удалить копию» рисовать нечего.
   */
  it('shows no action buttons when the corrupted read left no quarantine backup', () => {
    setup()
    // The read fails, but the quarantine write itself also fails, so there
    // are no bytes behind either button.
    stub = stubLocalStorage({ items: storedItems('{{{'), writeError: quotaError() })
    renderBanner()

    const banner = screen.getByRole('alert')
    expect(banner).toHaveTextContent('Не удалось прочитать сохранённые задачи')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
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

  /**
   * [FELA-70](/FELA/issues/FELA-70): при `'corrupted'` повторять нечего —
   * ломалось чтение. Кнопка бы сработала (запись-то идёт), погасила баннер и
   * унесла с ним «Выгрузить в файл» — единственный путь к карантинным байтам.
   */
  it('offers no "Повторить" when the failure was a read, keeping the export up', () => {
    setup()
    stub = stubLocalStorage({ items: storedItems('{{{') })
    renderBanner()

    expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Выгрузить в файл' })).toBeInTheDocument()
  })

  /**
   * Тот же инвариант, но без оглядки на имя кнопки: **ни одно** действие
   * баннера `corrupted`, кроме самой выгрузки, не делает карантинные байты
   * недостижимыми. Сегодня перебор пуст; верни «Повторить» для `'corrupted'` —
   * и тест покраснеет на выгрузке после нажатия.
   */
  it('keeps the quarantined bytes reachable after pressing every other control', async () => {
    setup()
    const user = userEvent.setup()
    vi.useFakeTimers()
    const truncated = '{"version":1,"tasks":[{"id":"a","title":"Первая"},'
    stub = stubLocalStorage({ items: storedItems(truncated) })
    renderBanner()

    // Персист уже заменил основной ключ пустым конвертом: байты остались
    // только в карантине, и терять путь к ним теперь необратимо.
    act(() => {
      vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
    })
    vi.useRealTimers()

    const exportName = 'Выгрузить в файл'
    const others = screen
      .getAllByRole('button')
      .filter((button) => button.textContent !== exportName)
    for (const button of others) {
      await user.click(button)
    }

    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: exportName }))

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(await blob.text()).toBe(truncated)
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

  /**
   * design-quarantine-surface §4C/§10 criteria 5-6-7, wired through
   * `ConfirmDialog` ([FELA-78](/FELA/issues/FELA-78)). The key is gone, the
   * success toast fires, and A falls back to criterion 7's text-only state
   * because `useQuarantineBackup` now reports an empty backup — not because
   * `storageError` changed.
   */
  it('deletes the quarantined copy through the confirm dialog and leaves only text behind', async () => {
    setup()
    const user = userEvent.setup()
    const truncated = '{"version":1,"tasks":[{"id":"a","title":"Первая"},'
    stub = stubLocalStorage({ items: storedItems(truncated) })
    renderBanner()

    await user.click(screen.getByRole('button', { name: 'Удалить копию' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Удалить повреждённую копию?')
    await user.click(within(dialog).getByRole('button', { name: 'Удалить копию' }))

    expect(stub.items.has(CORRUPTED_BACKUP_KEY)).toBe(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось прочитать сохранённые задачи')
    expect(screen.getByText('Повреждённая копия удалена.')).toBeInTheDocument()
  })

  it('cancelling the confirm dialog deletes nothing', async () => {
    setup()
    const user = userEvent.setup()
    const truncated = '{"version":1,"tasks":[{"id":"a","title":"Первая"},'
    stub = stubLocalStorage({ items: storedItems(truncated) })
    renderBanner()

    await user.click(screen.getByRole('button', { name: 'Удалить копию' }))
    await user.click(screen.getByRole('button', { name: 'Отмена' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(stub.items.get(CORRUPTED_BACKUP_KEY)).toBe(truncated)
    expect(screen.getByRole('button', { name: 'Удалить копию' })).toBeInTheDocument()
  })
})
