import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CORRUPTED_BACKUP_KEY, TASKS_STORAGE_KEY } from '../storage/taskStorage'
import { PERSIST_DEBOUNCE_MS } from '../storage/useDebouncedPersist'
import { TaskStoreProvider } from '../state/TaskStoreProvider'
import { ToastProvider } from '../state/ToastProvider'
import { blockedError, quotaError, storedItems, storedPayload, stubLocalStorage } from '../test/storage'
import type { StorageStub } from '../test/storage'
import { QuarantineNotice } from './QuarantineNotice'

function renderNotice() {
  return render(
    <TaskStoreProvider>
      <ToastProvider>
        <QuarantineNotice />
      </ToastProvider>
    </TaskStoreProvider>,
  )
}

const silenceWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined)

/** A valid main envelope plus a leftover quarantine key, as if a previous
 * session hit `corrupted` and the tab was then reloaded (design-quarantine-surface
 * §4B/§10 criterion 2). */
function healthyMainWithLeftoverQuarantine(quarantined = '{"version":1,"tasks":['): Record<string, string> {
  return { [TASKS_STORAGE_KEY]: storedPayload([]), [CORRUPTED_BACKUP_KEY]: quarantined }
}

describe('QuarantineNotice', () => {
  let stub: StorageStub | null = null
  let warn: ReturnType<typeof silenceWarnings>
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let anchorClick: ReturnType<typeof vi.spyOn>

  afterEach(() => {
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
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  }

  it('renders nothing when storage is healthy and the quarantine is empty', () => {
    setup()
    stub = stubLocalStorage({ items: storedItems(storedPayload([])) })
    renderNotice()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the §4B copy when the read is healthy but a quarantined copy is left over', () => {
    setup()
    stub = stubLocalStorage({ items: healthyMainWithLeftoverQuarantine() })
    renderNotice()

    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('Осталась повреждённая копия задач')
    expect(notice).toHaveTextContent('Эту копию сохранили, когда список не удалось прочитать.')
    expect(screen.getByRole('button', { name: 'Выгрузить в файл' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Удалить копию' })).toBeInTheDocument()
  })

  /** §4D/§10 criterion 8: one message above the list at a time. */
  it('stays suppressed while storage is quota-exhausted, even with quarantine bytes present', () => {
    setup()
    vi.useFakeTimers()
    stub = stubLocalStorage({ items: healthyMainWithLeftoverQuarantine(), writeError: quotaError() })
    renderNotice()

    act(() => {
      vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('stays suppressed while storage is blocked, even with quarantine bytes present', () => {
    setup()
    stub = stubLocalStorage({ accessError: blockedError() })
    renderNotice()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('exports the quarantined bytes and stays on screen', async () => {
    setup()
    const user = userEvent.setup()
    const quarantined = '{"version":1,"tasks":['
    stub = stubLocalStorage({ items: healthyMainWithLeftoverQuarantine(quarantined) })
    renderNotice()

    await user.click(screen.getByRole('button', { name: 'Выгрузить в файл' }))

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(await blob.text()).toBe(quarantined)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  /** §10 criterion 4: the close control never touches the stored bytes. */
  it('hiding via the close button leaves the quarantine key untouched', () => {
    setup()
    const quarantined = '{"version":1,"tasks":['
    stub = stubLocalStorage({ items: healthyMainWithLeftoverQuarantine(quarantined) })
    renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'Скрыть до следующего запуска' }))

    expect(stub.items.get(CORRUPTED_BACKUP_KEY)).toBe(quarantined)
  })

  it('removes the close animation element from the DOM once the exit timeout elapses', () => {
    setup()
    vi.useFakeTimers()
    stub = stubLocalStorage({ items: healthyMainWithLeftoverQuarantine() })
    renderNotice()

    fireEvent.click(screen.getByRole('button', { name: 'Скрыть до следующего запуска' }))
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  /** §10 criteria 5-6: delete flow through `ConfirmDialog`. */
  it('deletes the quarantined copy through the confirm dialog and disappears for good', async () => {
    setup()
    const user = userEvent.setup()
    stub = stubLocalStorage({ items: healthyMainWithLeftoverQuarantine() })
    renderNotice()

    await user.click(screen.getByRole('button', { name: 'Удалить копию' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Удалить повреждённую копию?')
    await user.click(within(dialog).getByRole('button', { name: 'Удалить копию' }))

    expect(stub.items.has(CORRUPTED_BACKUP_KEY)).toBe(false)
    // The success toast is itself role="status", so the notice block is
    // checked by its own text rather than by role.
    expect(screen.queryByText('Осталась повреждённая копия задач')).not.toBeInTheDocument()
    expect(screen.getByText('Повреждённая копия удалена.')).toBeInTheDocument()
  })

  it('cancelling the confirm dialog deletes nothing and keeps the block visible', async () => {
    setup()
    const user = userEvent.setup()
    const quarantined = '{"version":1,"tasks":['
    stub = stubLocalStorage({ items: healthyMainWithLeftoverQuarantine(quarantined) })
    renderNotice()

    await user.click(screen.getByRole('button', { name: 'Удалить копию' }))
    await user.click(screen.getByRole('button', { name: 'Отмена' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(stub.items.get(CORRUPTED_BACKUP_KEY)).toBe(quarantined)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  /** design-quarantine-surface §8 — «Выгрузить в файл» → «Удалить копию» → крестик. */
  it('tabs through export, delete, then the close button, in that order', async () => {
    setup()
    const user = userEvent.setup()
    stub = stubLocalStorage({ items: healthyMainWithLeftoverQuarantine() })
    renderNotice()

    const exportButton = screen.getByRole('button', { name: 'Выгрузить в файл' })
    const deleteButton = screen.getByRole('button', { name: 'Удалить копию' })
    const closeButton = screen.getByRole('button', { name: 'Скрыть до следующего запуска' })

    exportButton.focus()
    expect(exportButton).toHaveFocus()

    await user.tab()
    expect(deleteButton).toHaveFocus()

    await user.tab()
    expect(closeButton).toHaveFocus()
  })
})
