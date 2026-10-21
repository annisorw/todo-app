import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveRegion } from '../../components/LiveRegion'
import type { Filter } from '../../domain/filters'
import { selectTaskView } from '../../domain/filters'
import type { Task } from '../../domain/task'
import { TaskStoreProvider } from '../../state/TaskStoreProvider'
import { ToastProvider } from '../../state/ToastProvider'
import { useTaskStore } from '../../state/useTaskStore'
import { TASKS_SCHEMA_VERSION, TASKS_STORAGE_KEY } from '../../storage/taskStorage'
import { makeTask } from '../../test/factories'
import { stubMatchMedia } from '../../test/matchMedia'
import { TaskList } from './TaskList'

function seed(tasks: Task[]) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify({ version: TASKS_SCHEMA_VERSION, tasks }))
}

function Harness({ filter = 'all', query = '' }: { filter?: Filter; query?: string }) {
  const { tasks } = useTaskStore()
  const view = selectTaskView(tasks, { filter, query })
  return <TaskList view={view} query={query} filter={filter} panelId="panel" activeTabId="tab-all" />
}

function renderTaskList(tasks: Task[], options?: { filter?: Filter; query?: string }) {
  seed(tasks)
  return render(
    <TaskStoreProvider>
      <ToastProvider>
        <LiveRegion />
        <Harness filter={options?.filter} query={options?.query} />
      </ToastProvider>
    </TaskStoreProvider>,
  )
}

describe('TaskList', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('checking a task off (acceptance criterion 7)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      stubMatchMedia(true)
    })

    it('keeps a just-checked task in the active list, then moves it to Completed 600ms later', () => {
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      // Still rendered among the active rows immediately after the check.
      expect(screen.queryByRole('heading', { name: 'Выполнено' })).not.toBeInTheDocument()
      expect(screen.getByText('Купить молоко')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(599)
      })
      expect(screen.queryByRole('heading', { name: 'Выполнено' })).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByRole('heading', { name: 'Выполнено' })).toBeInTheDocument()
      // `getByText` would be ambiguous here: the row exiting the active
      // `AnimatePresence` can still be mid-exit-animation in jsdom (no real
      // rAF under fake timers), so assert against the Completed section
      // specifically rather than the whole document.
      const completedSection = document.querySelector('section[aria-label="Выполнено"]')
      expect(completedSection?.textContent).toContain('Купить молоко')
    })

    it('shows the row as checked immediately, not just after the 600ms settle delay elapses', () => {
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      const checkbox: HTMLInputElement = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(checkbox.checked).toBe(true)

      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(checkbox.checked).toBe(true)
    })

    it('unchecking before the settle delay elapses keeps it active with no further delay', () => {
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)
      act(() => {
        vi.advanceTimersByTime(200)
      })
      fireEvent.click(checkbox)

      act(() => {
        vi.advanceTimersByTime(600)
      })

      expect(screen.queryByRole('heading', { name: 'Выполнено' })).not.toBeInTheDocument()
      expect(screen.getByRole('checkbox')).not.toBeChecked()
    })
  })

  describe('task-settle keeps the original slot (FELA-126 audit)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      stubMatchMedia(true)
    })

    // Scoped to the active `<ul>` — `getAllByRole('listitem')` unscoped
    // would also pick up `CompletedSection`'s own `<li>`s, and a row mid
    // `task-delete`/`task-settle` exit animation can still linger in jsdom
    // (no real rAF under fake timers), so a plain document-wide query can't
    // tell "moved to Completed" apart from "still active".
    function activeTitles() {
      const activeList = document.querySelector<HTMLElement>('ul[aria-label="Задачи"]')
      if (activeList === null) return []
      return within(activeList)
        .getAllByRole('listitem')
        .map((row) => row.textContent ?? '')
    }

    it('checking the first of four active tasks keeps it at index 0 until settle, then moves it to Completed', () => {
      renderTaskList([
        makeTask({ id: 't1', title: 'Первая' }),
        makeTask({ id: 't2', title: 'Вторая' }),
        makeTask({ id: 't3', title: 'Третья' }),
        makeTask({ id: 't4', title: 'Четвёртая' }),
      ])

      fireEvent.click(screen.getAllByRole('checkbox')[0]!)

      // Immediately after the check: still slot 0, DOM is A,B,C,D — not
      // B,C,D,A (the audited regression).
      let titles = activeTitles()
      expect(titles[0]).toContain('Первая')
      expect(titles[1]).toContain('Вторая')

      act(() => {
        vi.advanceTimersByTime(599)
      })
      titles = activeTitles()
      expect(titles[0]).toContain('Первая')
      expect(screen.queryByRole('heading', { name: 'Выполнено' })).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1)
      })
      // Assert via the Completed section specifically, not the whole
      // document: the exiting active-list copy can still linger in jsdom
      // mid animation (no real rAF under fake timers), same as the
      // existing "checking a task off" test above.
      const completedSection = document.querySelector('section[aria-label="Выполнено"]')
      expect(completedSection?.textContent).toContain('Первая')
    })

    it('checking a middle row of four leaves its neighbours in place until settle', () => {
      renderTaskList([
        makeTask({ id: 't1', title: 'Первая' }),
        makeTask({ id: 't2', title: 'Вторая' }),
        makeTask({ id: 't3', title: 'Третья' }),
        makeTask({ id: 't4', title: 'Четвёртая' }),
      ])

      fireEvent.click(screen.getAllByRole('checkbox')[1]!) // "Вторая"

      const titles = activeTitles()
      expect(titles[0]).toContain('Первая')
      expect(titles[1]).toContain('Вторая')
      expect(titles[2]).toContain('Третья')
      expect(titles[3]).toContain('Четвёртая')
    })

    it('switching the filter during the delay drops the stale snapshot instead of hiding the task', () => {
      seed([
        makeTask({ id: 't1', title: 'Первая' }),
        makeTask({ id: 't2', title: 'Вторая', completedAt: '2026-10-20T10:00:00.000Z' }),
      ])

      const { rerender } = render(
        <TaskStoreProvider>
          <ToastProvider>
            <LiveRegion />
            <Harness filter="active" />
          </ToastProvider>
        </TaskStoreProvider>,
      )

      fireEvent.click(screen.getByRole('checkbox', { name: 'Первая' }))
      expect(screen.getByText('Первая')).toBeInTheDocument()

      // The board switches to "Готовые" before the 600ms settle fires. The
      // settling snapshot was taken under `filter: 'active'`, so it must
      // not leak into this new view in either direction: not shown as a
      // stray active row, and not hidden from Completed (the audited bug —
      // the old code excluded it from Completed purely because it was
      // still "in settling", regardless of which filter that settling
      // snapshot belonged to).
      rerender(
        <TaskStoreProvider>
          <ToastProvider>
            <LiveRegion />
            <Harness filter="completed" />
          </ToastProvider>
        </TaskStoreProvider>,
      )

      // The real point of this test: Completed must show it, not that the
      // active `<ul>` is literally absent — framer-motion's exit animation
      // can leave a dying node mounted under fake timers (no real rAF in
      // jsdom), independent of this component's own display logic.
      const completedSection = document.querySelector('section[aria-label="Выполнено"]')
      expect(completedSection?.textContent).toContain('Первая')
      expect(completedSection?.textContent).toContain('Вторая')

      act(() => {
        vi.advanceTimersByTime(600)
      })
      expect(document.querySelector('section[aria-label="Выполнено"]')?.textContent).toContain('Первая')
    })

    it('deleting a task during the delay removes it from the store immediately, with no trace in Completed', () => {
      // Store-level check rather than a DOM-text query: a row mid exit
      // animation can still linger in jsdom under fake timers (see
      // `activeTitles`' comment above), which would make a plain
      // `queryByText` assertion flaky independent of this logic.
      function Probe() {
        const { tasks } = useTaskStore()
        return <span data-testid="store-task-ids">{tasks.map((task) => task.id).join(',')}</span>
      }

      seed([makeTask({ id: 't1', title: 'Первая' }), makeTask({ id: 't2', title: 'Вторая' })])
      render(
        <TaskStoreProvider>
          <ToastProvider>
            <LiveRegion />
            <Harness />
            <Probe />
          </ToastProvider>
        </TaskStoreProvider>,
      )

      fireEvent.click(screen.getByRole('checkbox', { name: 'Первая' }))

      const row = screen.getByText('Первая').closest('li')!
      fireEvent.click(within(row).getByRole('button', { name: /Действия с задачей/ }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }))

      expect(screen.getByTestId('store-task-ids')).toHaveTextContent('t2')

      act(() => {
        vi.advanceTimersByTime(600)
      })
      expect(document.querySelector('section[aria-label="Выполнено"]')?.textContent ?? '').not.toContain('Первая')
    })
  })

  describe('editing all three fields (acceptance criteria 5, 29, 32)', () => {
    beforeEach(() => {
      stubMatchMedia(true)
    })

    it('opens on double-click, saves text/priority/due-date together, and clears on Enter in the textarea', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко', priority: 'none', dueDate: null })])

      await user.dblClick(screen.getByText('Купить молоко'))

      const textarea = screen.getByRole('textbox', { name: 'Текст задачи' })
      await user.clear(textarea)
      await user.type(textarea, 'Купить хлеб')

      await user.click(screen.getByRole('button', { name: 'Приоритет' }))
      await user.click(screen.getByRole('menuitem', { name: /Высокий/ }))
      await user.click(screen.getByRole('button', { name: 'Срок' }))
      await user.click(screen.getByRole('button', { name: 'Завтра' }))

      await user.type(textarea, '{Enter}')

      expect(screen.queryByRole('textbox', { name: 'Текст задачи' })).not.toBeInTheDocument()
      expect(screen.getByText('Купить хлеб')).toBeInTheDocument()
      // `getByText` is ambiguous for chip values — the same text also lives
      // in the hidden sr-only duplicate chip that composes the checkbox's
      // accessible name (criterion 25), so assert via the visible,
      // interactive chip's role instead.
      expect(screen.getByRole('button', { name: /Высокий/ })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Завтра/ })).toBeInTheDocument()
    })

    it('rolls back all three fields on Отмена, leaving the task untouched', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко', priority: 'low', dueDate: null })])

      await user.dblClick(screen.getByText('Купить молоко'))
      const textarea = screen.getByRole('textbox', { name: 'Текст задачи' })
      await user.clear(textarea)
      await user.type(textarea, 'другой текст')
      await user.click(screen.getByRole('button', { name: /Низкий/ }))
      await user.click(screen.getByRole('menuitem', { name: /Высокий/ }))

      await user.click(screen.getByRole('button', { name: 'Отмена' }))

      expect(screen.queryByText('другой текст')).not.toBeInTheDocument()
      expect(screen.getByText('Купить молоко')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Низкий/ })).toBeInTheDocument()
    })

    it('a click outside the editor saves instead of cancelling (Postel’s Law)', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      await user.dblClick(screen.getByText('Купить молоко'))
      const textarea = screen.getByRole('textbox', { name: 'Текст задачи' })
      await user.clear(textarea)
      await user.type(textarea, 'Через клик снаружи')

      await user.click(document.body)

      expect(screen.queryByRole('textbox', { name: 'Текст задачи' })).not.toBeInTheDocument()
      expect(screen.getByText('Через клик снаружи')).toBeInTheDocument()
    })

    it('an empty title on save cancels instead of deleting the task', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      await user.dblClick(screen.getByText('Купить молоко'))
      const textarea = screen.getByRole('textbox', { name: 'Текст задачи' })
      await user.clear(textarea)
      await user.type(textarea, '{Enter}')

      expect(screen.getByText('Купить молоко')).toBeInTheDocument()
    })

    it('two-level Esc: the first closes the priority popover, the second closes the editor and returns focus to the row', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      await user.dblClick(screen.getByText('Купить молоко'))
      await user.click(screen.getByRole('button', { name: 'Приоритет' }))
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Текст задачи' })).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('textbox', { name: 'Текст задачи' })).not.toBeInTheDocument()
      // Re-query rather than reuse an earlier reference: the checkbox
      // unmounts while editing and remounts as a new node once the editor
      // closes (it replaces the whole row body), so a `checkbox` captured
      // before `dblClick` points at a detached element by this point.
      expect(screen.getByRole('checkbox')).toHaveFocus()
    })

    it('Tab from Отмена wraps back to the textarea (soft trap)', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      await user.dblClick(screen.getByText('Купить молоко'))
      screen.getByRole('button', { name: 'Отмена' }).focus()

      await user.tab()

      expect(screen.getByRole('textbox', { name: 'Текст задачи' })).toHaveFocus()
    })
  })

  describe('desktop quick-path on the row chips (acceptance criterion 30)', () => {
    beforeEach(() => {
      stubMatchMedia(true)
    })

    it('clicking the priority chip in the row applies the value immediately, with no Save step, and announces it', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко', priority: 'none' })])

      await user.click(screen.getByRole('button', { name: 'Приоритет' }))
      await user.click(screen.getByRole('menuitem', { name: /Высокий/ }))

      expect(screen.queryByRole('button', { name: 'Сохранить' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Высокий/ })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(/Приоритет: высокий/i)
    })
  })

  describe('mobile row chips are not interactive (acceptance criterion 31)', () => {
    beforeEach(() => {
      stubMatchMedia(false)
    })

    it('the priority and due-date chips in the row are static spans, not buttons', () => {
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко', priority: 'high', dueDate: '2026-10-25' })])

      expect(screen.queryByRole('button', { name: /Высокий/ })).not.toBeInTheDocument()
      // Both the visible static chip and the hidden sr-only duplicate that
      // composes the checkbox's accessible name render this text — only
      // uniqueness-via-role was ever the point, so assert presence, not count.
      expect(screen.getAllByText('Высокий').length).toBeGreaterThan(0)
    })
  })

  describe('mobile editor sheet (acceptance criteria 29, 31, 32)', () => {
    beforeEach(() => {
      stubMatchMedia(false)
    })

    it('tapping the priority glyph inside the chip opens the picker without the row re-toggling it shut', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко', priority: 'high' })])

      await user.dblClick(screen.getByText('Купить молоко'))
      const chip = screen.getByRole('button', { name: /Высокий/ })
      const glyph = chip.querySelector('[aria-hidden="true"]')

      await user.click(glyph!)

      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('clicking the due-date input does not close the panel before it can be used', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      await user.dblClick(screen.getByText('Купить молоко'))
      await user.click(screen.getByRole('button', { name: 'Срок' }))

      const dateInput = document.querySelector('input[type="date"]')
      expect(dateInput).toBeInTheDocument()

      await user.click(dateInput!)

      expect(document.querySelector('input[type="date"]')).toBeInTheDocument()
    })

    it('Tab forward from Save wraps to the textarea, and Shift+Tab back from the textarea wraps to Save', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      await user.dblClick(screen.getByText('Купить молоко'))

      const textarea = screen.getByRole('textbox', { name: 'Текст задачи' })
      const save = screen.getByRole('button', { name: 'Сохранить' })

      save.focus()
      await user.tab()
      expect(textarea).toHaveFocus()

      textarea.focus()
      await user.tab({ shift: true })
      expect(save).toHaveFocus()
    })
  })

  describe('keyboard traversal of the list', () => {
    beforeEach(() => {
      stubMatchMedia(true)
    })

    it('is a single Tab stop into the list; ArrowDown/ArrowUp move focus between rows', async () => {
      const user = userEvent.setup()
      renderTaskList([
        makeTask({ id: 't1', title: 'Первая' }),
        makeTask({ id: 't2', title: 'Вторая' }),
        makeTask({ id: 't3', title: 'Третья' }),
      ])

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).toHaveAttribute('tabindex', '0')
      expect(checkboxes[1]).toHaveAttribute('tabindex', '-1')
      expect(checkboxes[2]).toHaveAttribute('tabindex', '-1')

      checkboxes[0]?.focus()
      await user.keyboard('{ArrowDown}')
      expect(checkboxes[1]).toHaveFocus()

      await user.keyboard('{ArrowDown}')
      expect(checkboxes[2]).toHaveFocus()
    })

    it('keeps the desktop priority/due-date chips out of inactive rows\' tab order', () => {
      renderTaskList([
        makeTask({ id: 't1', title: 'Первая', priority: 'high', dueDate: '2026-10-25' }),
        makeTask({ id: 't2', title: 'Вторая', priority: 'medium', dueDate: '2026-10-26' }),
      ])

      const rows = screen.getAllByRole('listitem')
      const priorityChip = (row: HTMLElement) => within(row).getByRole('button', { name: /Высокий|Средний/ })
      const dueDateChip = (row: HTMLElement) => row.querySelector('button[aria-haspopup="dialog"]')

      // Row 0 is the roving-focus group's active stop; row 1 is not.
      expect(priorityChip(rows[0]!)).toHaveAttribute('tabindex', '0')
      expect(dueDateChip(rows[0]!)).toHaveAttribute('tabindex', '0')
      expect(priorityChip(rows[1]!)).toHaveAttribute('tabindex', '-1')
      expect(dueDateChip(rows[1]!)).toHaveAttribute('tabindex', '-1')
    })
  })

  describe('long text (acceptance criterion 14)', () => {
    beforeEach(() => {
      stubMatchMedia(true)
    })

    it('a 500-character title shows a "Показать целиком" chip that reveals the full text', async () => {
      // jsdom never lays out text, so `scrollHeight`/`clientHeight` (the
      // real overflow signal `ExpandableTitle` reads) are both 0 — stub
      // them so the clamp-overflow branch is reachable in a unit test at
      // all. Verified against a real layout engine separately (manual
      // Chromium screenshot during this task's review).
      const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100)
      const clientHeight = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(40)

      const user = userEvent.setup()
      const longTitle = 'А'.repeat(500)
      renderTaskList([makeTask({ id: 't1', title: longTitle })])

      const toggle = screen.getByRole('button', { name: 'Показать целиком' })
      await user.click(toggle)

      expect(screen.getByRole('button', { name: 'Свернуть' })).toBeInTheDocument()

      scrollHeight.mockRestore()
      clientHeight.mockRestore()
    })

    it('a short title gets no "Показать целиком" chip', () => {
      renderTaskList([makeTask({ id: 't1', title: 'Короткая задача' })])

      expect(screen.queryByRole('button', { name: 'Показать целиком' })).not.toBeInTheDocument()
    })
  })

  describe('CompletedSection', () => {
    beforeEach(() => {
      stubMatchMedia(true)
    })

    it('"Удалить все выполненные" asks for confirmation, naming the count, before clearing', async () => {
      const user = userEvent.setup()
      renderTaskList([
        makeTask({ id: 't1', title: 'Активная' }),
        makeTask({ id: 't2', title: 'Готовая', completedAt: '2026-10-20T10:00:00.000Z' }),
      ])

      await user.click(screen.getByRole('button', { name: 'Удалить все выполненные' }))

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveTextContent('Удалить все выполненные (1)?')
      // Still there until confirmed.
      expect(screen.getByText('Готовая')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /Удалить 1 задачу/ }))

      expect(screen.queryByText('Готовая')).not.toBeInTheDocument()
      expect(screen.getByText('Активная')).toBeInTheDocument()
    })

    it('"Отмена" in the confirmation dialog leaves completed tasks untouched', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Готовая', completedAt: '2026-10-20T10:00:00.000Z' })])

      await user.click(screen.getByRole('button', { name: 'Удалить все выполненные' }))
      await user.click(screen.getByRole('button', { name: 'Отмена' }))

      expect(screen.getByText('Готовая')).toBeInTheDocument()
    })

    it('under an active search filter, names and clears every completed task, not just the visible ones', async () => {
      // TechLead review on PR #47: with a query active, the dialog quoted
      // the filtered count (1) and the button said "Удалить 1 задачу", but
      // confirming dispatched the store's unfiltered `clearCompleted` and
      // silently wiped all 4 completed tasks. The dialog must name — and
      // the confirm button must clear — the real total. Persistence is
      // debounced (`useDebouncedPersist`), so this reads the live store via
      // a sibling probe rather than racing `localStorage`.
      function Probe() {
        const { tasks } = useTaskStore()
        return <span data-testid="store-task-ids">{tasks.map((task) => task.id).join(',')}</span>
      }

      const user = userEvent.setup()
      seed([
        makeTask({ id: 't1', title: 'Активная' }),
        makeTask({ id: 't2', title: 'Купить молоко', completedAt: '2026-10-20T10:00:00.000Z' }),
        makeTask({ id: 't3', title: 'Купить хлеб', completedAt: '2026-10-20T10:01:00.000Z' }),
        makeTask({ id: 't4', title: 'Сдать отчёт', completedAt: '2026-10-20T10:02:00.000Z' }),
        makeTask({ id: 't5', title: 'Помыть окна', completedAt: '2026-10-20T10:03:00.000Z' }),
      ])
      render(
        <TaskStoreProvider>
          <ToastProvider>
            <LiveRegion />
            <Harness query="молоко" />
            <Probe />
          </ToastProvider>
        </TaskStoreProvider>,
      )

      // Only one completed row matches the query (its title is split by
      // the <mark> highlight, so match on the row's checkbox label instead).
      expect(screen.getByRole('checkbox', { name: 'Купить молоко' })).toBeInTheDocument()
      expect(screen.queryByText('Купить хлеб')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Удалить все выполненные' }))

      // ...but the dialog must quote the real total, not the filtered one.
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveTextContent('Удалить все выполненные (4)?')

      await user.click(screen.getByRole('button', { name: /Удалить 4 задачи/ }))

      expect(screen.queryByRole('heading', { name: 'Выполнено' })).not.toBeInTheDocument()
      // Every completed task is gone — including the three the search
      // query was hiding, not just the one visible row — and the one
      // active task is untouched.
      expect(screen.getByTestId('store-task-ids')).toHaveTextContent('t1')
    })
  })

  describe('search highlighting', () => {
    beforeEach(() => {
      stubMatchMedia(true)
    })

    it('renders an XSS payload title as inert highlighted text, never as a live <img>', () => {
      const title = '<img src=x onerror=alert(1)>'
      renderTaskList([makeTask({ id: 't1', title })], { query: 'img' })

      expect(document.querySelector('img')).toBeNull()
      // The match splits the text across a <mark>, so `getByText` (which
      // doesn't match text split across elements) isn't the right tool —
      // check the paragraph's full text content instead.
      const titleNode = document.querySelector('p')
      expect(titleNode?.textContent).toBe(title)
      expect(titleNode?.querySelectorAll('mark').length).toBeGreaterThan(0)
    })
  })

  describe('accessible name (acceptance criterion 25)', () => {
    beforeEach(() => {
      stubMatchMedia(true)
    })

    it('composes the checkbox\'s accessible name from the task text, priority and overdue status, in that order', () => {
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко', priority: 'high', dueDate: '2020-01-01' })])

      expect(screen.getByRole('checkbox', { name: /Купить молоко.*Высокий.*Просрочено/su })).toBeInTheDocument()
    })

    it('omits priority/due-date from the name when the task has neither set', () => {
      renderTaskList([makeTask({ id: 't1', title: 'Без деталей', priority: 'none', dueDate: null })])

      expect(screen.getByRole('checkbox', { name: 'Без деталей' })).toBeInTheDocument()
    })
  })

  describe('deleting a task (design-spec S7)', () => {
    beforeEach(() => {
      stubMatchMedia(true)
    })

    it('removing a task via the row menu shows an undo toast naming it, and "Вернуть" restores it', async () => {
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      await user.click(screen.getByRole('button', { name: /Действия с задачей/ }))
      await user.click(screen.getByRole('menuitem', { name: 'Удалить' }))

      expect(screen.queryByText('Купить молоко')).not.toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('Задача удалена: «Купить молоко»')

      await user.click(screen.getByRole('button', { name: 'Вернуть' }))

      expect(screen.getByText('Купить молоко')).toBeInTheDocument()
    })

    it('a stale undo toast does not restore the wrong task when a second delete happened first', async () => {
      const user = userEvent.setup()
      renderTaskList([
        makeTask({ id: 't1', title: 'Первая' }),
        makeTask({ id: 't2', title: 'Вторая' }),
      ])

      // Scope each delete to its own row by text, not by index: the
      // deleted row's exit animation (`transition` 320ms) keeps it mounted
      // in jsdom for a tick, so a second `getAllByRole(...)[0]` right after
      // the first delete can still hit the exiting row instead of the next
      // live one.
      async function deleteRowNamed(title: string) {
        const row = screen.getByText(title).closest('li')
        if (row === null) throw new Error(`row for "${title}" not found`)
        await user.click(within(row).getByRole('button', { name: /Действия с задачей/ }))
        await user.click(screen.getByRole('menuitem', { name: 'Удалить' }))
      }

      await deleteRowNamed('Первая')
      await deleteRowNamed('Вторая')

      const alerts = screen.getAllByRole('alert')
      expect(alerts[0]).toHaveTextContent('Задача удалена: «Первая»')
      expect(alerts[1]).toHaveTextContent('Задача удалена: «Вторая»')

      // The store's single undo slot now holds "Вторая" — the older toast
      // (naming "Первая") must no-op rather than restore the wrong task.
      await user.click(within(alerts[0]!).getByRole('button', { name: 'Вернуть' }))
      expect(screen.queryByText('Первая')).not.toBeInTheDocument()
      expect(screen.queryByText('Вторая')).not.toBeInTheDocument()

      await user.click(within(alerts[1]!).getByRole('button', { name: 'Вернуть' }))
      expect(screen.getByText('Вторая')).toBeInTheDocument()
    })
  })

  describe('prefers-reduced-motion (motion table, section 5 / acceptance criterion 17)', () => {
    // `stubMatchMedia` from `test/matchMedia.ts` answers every query the
    // same way, so it can't set "desktop" and "reduced motion" separately —
    // these two tests need both at once (desktop, to get the row actions
    // that trigger task-add/task-delete; reduced motion, to check the
    // branch under test). Stub each query independently instead.
    function stubReducedMotion(reduced: boolean) {
      vi.stubGlobal(
        'matchMedia',
        vi.fn((query: string) => ({
          matches: query.includes('reduced-motion') ? reduced : true,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      )
    }

    it('task-add drops the y-translate motion value, keeping only opacity', () => {
      stubReducedMotion(true)
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      const row = screen.getByText('Купить молоко').closest('li')
      // Framer Motion only ever writes a `transform` style when a
      // transform-affecting value (here, `y`) is part of `initial`/
      // `animate` — under reduced motion `TaskRow` passes `{ opacity }`
      // alone, so the property never appears at all, not even as `none`.
      expect(row?.getAttribute('style')).not.toContain('transform')
    })

    it('task-add keeps the y-translate motion value when motion is not reduced', () => {
      stubReducedMotion(false)
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      const row = screen.getByText('Купить молоко').closest('li')
      expect(row?.getAttribute('style')).toContain('transform')
    })

    it('task-delete drops the x-translate/height motion values under reduced motion', async () => {
      stubReducedMotion(true)
      const user = userEvent.setup()
      renderTaskList([makeTask({ id: 't1', title: 'Купить молоко' })])

      const row = screen.getByText('Купить молоко').closest('li')
      await user.click(screen.getByRole('button', { name: /Действия с задачей/ }))
      await user.click(screen.getByRole('menuitem', { name: 'Удалить' }))

      expect(row?.getAttribute('style')).not.toContain('transform')
      expect(row?.getAttribute('style')).not.toContain('height')
    })
  })

  describe('empty states', () => {
    it('shows a message when there are no tasks at all', () => {
      renderTaskList([])
      expect(screen.getByText('Пока нет активных задач.')).toBeInTheDocument()
    })
  })
})
