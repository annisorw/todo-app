import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveRegion } from '../../components/LiveRegion'
import type { Filter } from '../../domain/filters'
import { selectTaskView } from '../../domain/filters'
import type { Task } from '../../domain/task'
import { TaskStoreProvider } from '../../state/TaskStoreProvider'
import { ToastProvider } from '../../state/ToastProvider'
import { useTaskStore } from '../../state/useTaskStore'
import { TASKS_SCHEMA_VERSION, TASKS_STORAGE_KEY, readTasks } from '../../storage/taskStorage'
import { PERSIST_DEBOUNCE_MS } from '../../storage/useDebouncedPersist'
import { makeTask } from '../../test/factories'
import { stubMatchMedia } from '../../test/matchMedia'
import { TaskList } from './TaskList'

function seed(tasks: Task[]) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify({ version: TASKS_SCHEMA_VERSION, tasks }))
}

function Harness({ filter = 'all', query = '' }: { filter?: Filter; query?: string }) {
  const { tasks } = useTaskStore()
  const view = selectTaskView(tasks, { filter, query })
  // Reordering always needs rows on screen, so the `EmptyState` actions these
  // two props feed are unreachable here — stubs keep the types honest.
  return (
    <TaskList
      view={view}
      query={query}
      filter={filter}
      panelId="panel"
      activeTabId="tab-all"
      onClearSearch={vi.fn()}
      onSearchAll={vi.fn()}
    />
  )
}

/** Mounts the list the way the app does — the whole provider stack, reading the seeded storage. */
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

function makeThree(): Task[] {
  return [
    makeTask({ id: 't1', title: 'Первая' }),
    makeTask({ id: 't2', title: 'Вторая' }),
    makeTask({ id: 't3', title: 'Третья' }),
  ]
}

/** The visible order of the active list, read off the rendered rows. */
function renderedOrder(): string[] {
  return Array.from(document.querySelectorAll('ul[aria-label="Задачи"] > li')).map(
    (row) => row.querySelector('p')?.textContent ?? '',
  )
}

function handleFor(title: string): HTMLElement {
  return screen.getByRole('button', { name: `Переместить задачу: ${title}` })
}

function announcement(): string {
  return screen.getByRole('status').textContent ?? ''
}

/**
 * design-spec 6.4 / S8, acceptance criteria 9 and 22–23: the keyboard half
 * of [FELA-17](/FELA/issues/FELA-17), which is the half that has to work.
 *
 * `fireEvent` rather than `userEvent` throughout: these tests run on fake
 * timers (the persist debounce), and `userEvent`'s internal delay never
 * resolves under them.
 */
describe('TaskList reordering', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('keyboard grab mode (design-spec 6.4)', () => {
    it('announces the lift with the position and the list length', () => {
      renderTaskList(makeThree())

      fireEvent.keyDown(handleFor('Вторая'), { key: ' ' })

      expect(announcement()).toBe('Задача «Вторая» поднята, позиция 2 из 3')
      expect(handleFor('Вторая')).toHaveAttribute('aria-grabbed', 'true')
    })

    it('runs the whole lift → move → drop scenario from the keyboard alone', () => {
      renderTaskList(makeThree())

      const handle = handleFor('Третья')
      fireEvent.keyDown(handle, { key: ' ' })
      expect(announcement()).toBe('Задача «Третья» поднята, позиция 3 из 3')

      fireEvent.keyDown(handleFor('Третья'), { key: 'ArrowUp' })
      expect(renderedOrder()).toEqual(['Первая', 'Третья', 'Вторая'])
      expect(announcement()).toBe('Позиция 2 из 3')

      fireEvent.keyDown(handleFor('Третья'), { key: 'ArrowUp' })
      expect(renderedOrder()).toEqual(['Третья', 'Первая', 'Вторая'])
      expect(announcement()).toBe('Позиция 1 из 3')

      fireEvent.keyDown(handleFor('Третья'), { key: ' ' })
      expect(announcement()).toBe('Задача «Третья» опущена на позицию 1')
      expect(handleFor('Третья')).toHaveAttribute('aria-grabbed', 'false')
      expect(renderedOrder()).toEqual(['Третья', 'Первая', 'Вторая'])
    })

    it('puts the row back on Esc and says so', () => {
      renderTaskList(makeThree())

      fireEvent.keyDown(handleFor('Первая'), { key: ' ' })
      fireEvent.keyDown(handleFor('Первая'), { key: 'ArrowDown' })
      fireEvent.keyDown(handleFor('Первая'), { key: 'ArrowDown' })
      expect(renderedOrder()).toEqual(['Вторая', 'Третья', 'Первая'])

      fireEvent.keyDown(handleFor('Первая'), { key: 'Escape' })

      expect(renderedOrder()).toEqual(['Первая', 'Вторая', 'Третья'])
      expect(announcement()).toBe('Перемещение отменено, позиция 1')
      expect(handleFor('Первая')).toHaveAttribute('aria-grabbed', 'false')
    })

    it('stays put at the ends of the list instead of wrapping around', () => {
      renderTaskList(makeThree())

      fireEvent.keyDown(handleFor('Первая'), { key: ' ' })
      fireEvent.keyDown(handleFor('Первая'), { key: 'ArrowUp' })

      expect(renderedOrder()).toEqual(['Первая', 'Вторая', 'Третья'])
      // The lift announcement is the last thing said: nothing moved.
      expect(announcement()).toBe('Задача «Первая» поднята, позиция 1 из 3')
    })

    it('drops the lift when focus leaves the handle, keeping the moves already made', () => {
      renderTaskList(makeThree())

      fireEvent.keyDown(handleFor('Первая'), { key: ' ' })
      fireEvent.keyDown(handleFor('Первая'), { key: 'ArrowDown' })
      fireEvent.blur(handleFor('Первая'))

      expect(handleFor('Первая')).toHaveAttribute('aria-grabbed', 'false')
      expect(renderedOrder()).toEqual(['Вторая', 'Первая', 'Третья'])
    })

    it('keeps a held row grabbed with real focus on its handle across a filter switch (FELA-134 review, PR #79)', () => {
      const { rerender } = renderTaskList(makeThree(), { filter: 'all' })

      fireEvent.keyDown(handleFor('Первая'), { key: ' ' })
      expect(handleFor('Первая')).toHaveAttribute('aria-grabbed', 'true')

      // None of the three tasks are done, so 'Первая' stays visible under
      // 'active' too — but the filter-switch crossfade (FELA-134) still
      // remounts the whole panel on `key={filter}`, tearing the handle's
      // DOM node down and rebuilding it without ever firing the `blur` that
      // normally releases a grab (see the test above).
      rerender(
        <TaskStoreProvider>
          <ToastProvider>
            <LiveRegion />
            <Harness filter="active" />
          </ToastProvider>
        </TaskStoreProvider>,
      )

      // The grab must survive the remount as one of its two honest
      // outcomes — still held, with real keyboard focus on the (new)
      // handle — not a third state of "grabbed but focus dropped to
      // `<body>`", which `aria-grabbed="true"` alone would not catch.
      expect(handleFor('Первая')).toHaveAttribute('aria-grabbed', 'true')
      expect(handleFor('Первая')).toHaveFocus()
    })
  })

  describe('Ctrl/Cmd+↑/↓ without the grab mode (design-spec 6.4)', () => {
    it('moves the focused row one step down and announces the new position', () => {
      renderTaskList(makeThree())

      fireEvent.keyDown(screen.getAllByRole('checkbox')[0]!, { key: 'ArrowDown', ctrlKey: true })

      expect(renderedOrder()).toEqual(['Вторая', 'Первая', 'Третья'])
      expect(announcement()).toBe('Задача «Первая» перемещена на позицию 2 из 3')
    })

    it('accepts the Cmd variant too', () => {
      renderTaskList(makeThree())

      fireEvent.keyDown(screen.getAllByRole('checkbox')[2]!, { key: 'ArrowUp', metaKey: true })

      expect(renderedOrder()).toEqual(['Первая', 'Третья', 'Вторая'])
    })

    it('works with focus on the drag handle, not only on the checkbox', () => {
      renderTaskList(makeThree())

      // The gesture has to reach the row from anywhere inside it. Here the
      // grab mode sees the key first and leaves it alone — nothing is held.
      fireEvent.keyDown(handleFor('Первая'), { key: 'ArrowDown', ctrlKey: true })

      expect(renderedOrder()).toEqual(['Вторая', 'Первая', 'Третья'])
      expect(announcement()).toBe('Задача «Первая» перемещена на позицию 2 из 3')
    })

    it('is the grab mode step, not a second move, while a row is held', () => {
      renderTaskList(makeThree())

      fireEvent.keyDown(handleFor('Первая'), { key: ' ' })
      fireEvent.keyDown(handleFor('Первая'), { key: 'ArrowDown', ctrlKey: true })

      // One step, announced in the grab mode's own wording — the held row
      // must not be moved twice by one key press.
      expect(renderedOrder()).toEqual(['Вторая', 'Первая', 'Третья'])
      expect(announcement()).toBe('Позиция 2 из 3')
    })

    it('leaves a plain ↑/↓ to the roving focus instead of moving the row', () => {
      renderTaskList(makeThree())

      fireEvent.keyDown(screen.getAllByRole('checkbox')[0]!, { key: 'ArrowDown' })

      expect(renderedOrder()).toEqual(['Первая', 'Вторая', 'Третья'])
    })
  })

  /**
   * The active list never renders a completed task, so a store order with a
   * done task *between* two active ones is the ordinary state of any list
   * with something ticked off. Display index and store index part ways there,
   * and only the store order says which of the two a move actually wrote —
   * hence `readTasks()` rather than `renderedOrder()` in both tests.
   */
  describe('a completed task between the visible rows', () => {
    function makeWithCompletedBetween(): Task[] {
      return [
        makeTask({ id: 't1', title: 'Первая' }),
        makeTask({ id: 't2', title: 'Готовая', completedAt: '2026-10-20T10:00:00.000Z' }),
        makeTask({ id: 't3', title: 'Третья' }),
      ]
    }

    /** The whole store order as it reached `localStorage`. */
    function storedOrder(): string[] {
      act(() => {
        vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
      })
      return readTasks().tasks.map((task) => task.title)
    }

    it('moves the row past the hidden task it visibly jumped, and no further', () => {
      vi.useFakeTimers()
      renderTaskList(makeWithCompletedBetween())
      expect(renderedOrder()).toEqual(['Первая', 'Третья'])

      fireEvent.keyDown(handleFor('Третья'), { key: 'ArrowUp', ctrlKey: true })

      expect(renderedOrder()).toEqual(['Третья', 'Первая'])
      expect(storedOrder()).toEqual(['Третья', 'Первая', 'Готовая'])
    })

    it('puts the whole store order back on Esc, not only the visible one', () => {
      vi.useFakeTimers()
      renderTaskList(makeWithCompletedBetween())

      fireEvent.keyDown(handleFor('Первая'), { key: ' ' })
      fireEvent.keyDown(handleFor('Первая'), { key: 'ArrowDown' })
      expect(renderedOrder()).toEqual(['Третья', 'Первая'])

      fireEvent.keyDown(handleFor('Первая'), { key: 'Escape' })

      expect(renderedOrder()).toEqual(['Первая', 'Третья'])
      expect(announcement()).toBe('Перемещение отменено, позиция 1')
      expect(storedOrder()).toEqual(['Первая', 'Готовая', 'Третья'])
    })
  })

  /**
   * A row inside its 600ms `task-settle` window (FELA-126) is rendered in the
   * active list but is already done: its slot is a freeze-frame of where it
   * used to be, not a place in the order. A move that counts it writes an
   * order the person never sees happen — so these read the *store*, and they
   * read the announcement, which is the thing that must not lie.
   */
  describe('a row mid task-settle (FELA-126 overlap)', () => {
    function makeFour(): Task[] {
      return [
        makeTask({ id: 't1', title: 'Первая' }),
        makeTask({ id: 't2', title: 'Вторая' }),
        makeTask({ id: 't3', title: 'Третья' }),
        makeTask({ id: 't4', title: 'Четвёртая' }),
      ]
    }

    function storedOrder(): string[] {
      act(() => {
        vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
      })
      return readTasks().tasks.map((task) => task.title)
    }

    it('steps past a settling row instead of behind it, and announces the position that survives the settle', () => {
      vi.useFakeTimers()
      renderTaskList(makeFour())

      // «Вторая» is checked off and holds slot 2 for 600ms.
      fireEvent.click(screen.getAllByRole('checkbox')[1]!)
      expect(renderedOrder()).toEqual(['Первая', 'Вторая', 'Третья', 'Четвёртая'])

      fireEvent.keyDown(handleFor('Первая'), { key: 'ArrowDown', ctrlKey: true })

      // Counting the settling row would have written `Первая` behind a task
      // the active list does not render: the screen would not move at all,
      // and «позиция 2 из 4» would be a lie the moment the window closed.
      expect(announcement()).toBe('Задача «Первая» перемещена на позицию 2 из 3')
      expect(storedOrder()).toEqual(['Вторая', 'Третья', 'Первая', 'Четвёртая'])

      act(() => {
        vi.advanceTimersByTime(600)
      })
      // The settled row is filtered out rather than expected to be gone: its
      // `AnimatePresence` exit copy lingers in jsdom (no real rAF under fake
      // timers), so its absence proves nothing. What this asserts is the
      // order of the rows that stayed.
      expect(renderedOrder().filter((title) => title !== 'Вторая')).toEqual([
        'Третья',
        'Первая',
        'Четвёртая',
      ])
    })

    it('counts the grab-mode steps in rows that are really in the order', () => {
      vi.useFakeTimers()
      renderTaskList(makeFour())

      fireEvent.click(screen.getAllByRole('checkbox')[1]!)

      fireEvent.keyDown(handleFor('Третья'), { key: ' ' })
      expect(announcement()).toBe('Задача «Третья» поднята, позиция 2 из 3')

      fireEvent.keyDown(handleFor('Третья'), { key: 'ArrowUp' })
      expect(announcement()).toBe('Позиция 1 из 3')
      expect(storedOrder()).toEqual(['Третья', 'Первая', 'Вторая', 'Четвёртая'])
    })

    it('gives a settling row no handle to be moved by', () => {
      vi.useFakeTimers()
      renderTaskList(makeFour())

      fireEvent.click(screen.getAllByRole('checkbox')[1]!)

      expect(screen.queryByRole('button', { name: 'Переместить задачу: Вторая' })).not.toBeInTheDocument()
    })
  })

  describe('persistence (acceptance criterion 9)', () => {
    it('keeps the new order through a reload', () => {
      vi.useFakeTimers()
      const { unmount } = renderTaskList(makeThree())

      fireEvent.keyDown(handleFor('Третья'), { key: ' ' })
      fireEvent.keyDown(handleFor('Третья'), { key: 'ArrowUp' })
      fireEvent.keyDown(handleFor('Третья'), { key: 'ArrowUp' })
      fireEvent.keyDown(handleFor('Третья'), { key: ' ' })

      act(() => {
        vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
      })

      // What actually landed in `localStorage`, not what the store holds.
      expect(readTasks().tasks.map((task) => task.title)).toEqual(['Третья', 'Первая', 'Вторая'])

      // Reload: a fresh provider hydrating from that same storage.
      unmount()
      render(
        <TaskStoreProvider>
          <ToastProvider>
            <Harness />
          </ToastProvider>
        </TaskStoreProvider>,
      )
      expect(renderedOrder()).toEqual(['Третья', 'Первая', 'Вторая'])
    })
  })

  describe('the lifted row and the drop indicator (S8)', () => {
    it('swaps the row onto the opaque lifted surface while it is held, and back after', () => {
      renderTaskList(makeThree())
      const row = () => document.querySelectorAll('ul[aria-label="Задачи"] .task-row')[1]!

      expect(row().className).toContain('bg-transparent')

      fireEvent.keyDown(handleFor('Вторая'), { key: ' ' })

      // A translucent card in flight reads dirty, so the fill goes opaque
      // and the hover tint that would otherwise outrank it is dropped.
      expect(row().className).toContain('bg-surface-2-solid')
      expect(row().className).toContain('border-accent')
      expect(row().className).toContain('shadow-drag')
      expect(row().className).not.toContain('hover:bg-surface-2')

      fireEvent.keyDown(handleFor('Вторая'), { key: ' ' })
      expect(row().className).toContain('bg-transparent')
      expect(row().className).not.toContain('shadow-drag')
    })

    it('shows the insertion marker only while a row is held', () => {
      renderTaskList(makeThree())
      // `span`, not just `.border-dashed`: an empty priority chip is a
      // dashed-outline button and would match too.
      const marker = () => document.querySelector('span.border-dashed')

      expect(marker()).toBeNull()

      fireEvent.keyDown(handleFor('Вторая'), { key: ' ' })

      const indicator = marker()
      expect(indicator).not.toBeNull()
      expect(indicator).toHaveAttribute('aria-hidden', 'true')
      expect(indicator?.className).toContain('border-accent-text')
      expect(indicator?.className).toContain('bg-[image:var(--gradient-accent-soft)]')

      fireEvent.keyDown(handleFor('Вторая'), { key: ' ' })
      expect(marker()).toBeNull()
    })
  })

  describe('completed rows (point 6: their order is completedAt)', () => {
    it('gives the Completed section no handle at all', () => {
      renderTaskList([
        makeTask({ id: 't1', title: 'Активная' }),
        makeTask({ id: 't2', title: 'Готовая', completedAt: '2026-10-21T09:00:00.000Z' }),
      ])

      expect(screen.getByRole('heading', { name: 'Выполнено' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Переместить задачу: Активная' })).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Переместить задачу: Готовая' }),
      ).not.toBeInTheDocument()
    })
  })
})
