import { act, fireEvent, render, screen } from '@testing-library/react'
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
  })

  describe('empty states', () => {
    it('shows a message when there are no tasks at all', () => {
      renderTaskList([])
      expect(screen.getByText('Пока нет активных задач.')).toBeInTheDocument()
    })
  })
})
