import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUTTON_VARIANT_CLASSES } from '../../components/button-variant'
import { LiveRegion } from '../../components/LiveRegion'
import { selectTaskView } from '../../domain/filters'
import type { Task } from '../../domain/task'
import { TaskStoreProvider } from '../../state/TaskStoreProvider'
import { ToastProvider } from '../../state/ToastProvider'
import { useTaskStore } from '../../state/useTaskStore'
import { TASKS_SCHEMA_VERSION, TASKS_STORAGE_KEY, readTasks } from '../../storage/taskStorage'
import { PERSIST_DEBOUNCE_MS } from '../../storage/useDebouncedPersist'
import { makeTask } from '../../test/factories'
import { TaskList } from './TaskList'

/**
 * `stubMatchMedia` answers every query the same way, so it cannot say
 * "mobile" and "motion as usual" at once — which is exactly what this file
 * needs. `(min-width: 640px)` is the one query `TaskRow` reads for the
 * viewport; everything else (reduced motion, theme) keeps the default.
 */
function stubViewport(desktop: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('min-width: 640px') ? desktop : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

function seed(tasks: Task[]) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify({ version: TASKS_SCHEMA_VERSION, tasks }))
}

function Harness() {
  const { tasks } = useTaskStore()
  return (
    <TaskList
      view={selectTaskView(tasks, { filter: 'all', query: '' })}
      query=""
      filter="all"
      panelId="panel"
      activeTabId="tab-all"
      onClearSearch={vi.fn()}
      onSearchAll={vi.fn()}
    />
  )
}

function renderTaskList(tasks: Task[]) {
  seed(tasks)
  return render(
    <TaskStoreProvider>
      <ToastProvider>
        <LiveRegion />
        <Harness />
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

function moreFor(title: string): HTMLElement {
  return screen.getByRole('button', { name: `Действия с задачей: ${title}` })
}

/** The row's own `.task-row` container, located by its title rather than index — that index shifts as rows reorder. */
function rowFor(title: string): HTMLElement {
  return Array.from(document.querySelectorAll('ul[aria-label="Задачи"] .task-row')).find((row) =>
    row.textContent?.includes(title),
  ) as HTMLElement
}

function announcement(): string {
  return screen.getByRole('status').textContent ?? ''
}

/** Opens the row's `Menu` the way a person does on a phone — one tap on `more`, no gesture. */
function openMenu(title: string): HTMLElement {
  const more = moreFor(title)
  fireEvent.click(more)
  return more
}

/** `Menu` → «Переместить», i.e. design-spec 6.4's mobile entry point. */
function enterMoveMode(title: string) {
  openMenu(title)
  fireEvent.click(screen.getByRole('menuitem', { name: 'Переместить' }))
}

/**
 * design-spec 3.14 / 3.15 / 6.4 as rewritten in v1.10, acceptance criteria
 * 44–46 ([FELA-177](/FELA/issues/FELA-177)): the mobile row drops its
 * permanent `DragHandle`, and moving a task without dragging goes through the
 * `Menu` and the on-screen ↑ / ↓ / «Готово» / «Отмена» strip.
 *
 * `fireEvent` rather than `userEvent`: the persist assertions run on fake
 * timers, under which `userEvent`'s internal delay never resolves.
 */
describe('mobile move mode (design-spec 6.4, v1.10)', () => {
  beforeEach(() => {
    localStorage.clear()
    stubViewport(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('the normal row (criterion 44)', () => {
    it('carries `more` as its only service button and no drag handle', () => {
      renderTaskList(makeThree())

      expect(moreFor('Вторая')).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Переместить задачу: Вторая' }),
      ).not.toBeInTheDocument()
    })

    it('keeps the handle on desktop, where hover reveals it', () => {
      stubViewport(true)
      renderTaskList(makeThree())

      expect(screen.getByRole('button', { name: 'Переместить задачу: Вторая' })).toBeInTheDocument()
    })
  })

  describe('the Menu item (criterion 45, design-spec 3.15)', () => {
    it('offers «Переместить» between «Изменить» and «Удалить»', () => {
      renderTaskList(makeThree())

      openMenu('Вторая')

      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        'Изменить',
        'Переместить',
        'Удалить',
      ])
    })

    it('leaves the item off on desktop, which already has the handle and Ctrl/Cmd+↑/↓', () => {
      stubViewport(true)
      renderTaskList(makeThree())

      fireEvent.click(moreFor('Вторая'))

      expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
        'Изменить',
        'Удалить',
      ])
    })

    it('offers no «Переместить» for a completed row, whose order is `completedAt`', () => {
      renderTaskList([makeTask({ id: 't1', title: 'Первая', completedAt: '2026-10-20T10:00:00.000Z' })])

      fireEvent.click(moreFor('Первая'))

      expect(screen.queryByRole('menuitem', { name: 'Переместить' })).not.toBeInTheDocument()
    })
  })

  describe('entering the mode', () => {
    it('lifts the row and announces it in the keyboard mode’s own words', () => {
      renderTaskList(makeThree())

      enterMoveMode('Вторая')

      expect(announcement()).toBe('Задача «Вторая» поднята, позиция 2 из 3')
      expect(screen.getByRole('button', { name: 'Переместить задачу: Вторая' })).toHaveAttribute(
        'aria-grabbed',
        'true',
      )
    })

    it('puts focus on ↑ and swaps the meta chips for the control strip', () => {
      renderTaskList([makeTask({ id: 't1', title: 'Первая', priority: 'high' })])

      enterMoveMode('Первая')

      const up = screen.getByRole('button', { name: 'Переместить вверх: Первая' })
      expect(document.activeElement).toBe(up)
      expect(screen.getByRole('button', { name: 'Переместить вниз: Первая' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Готово' })).toBeInTheDocument()
      // The visible chip is what the strip replaces. The row's `sr-only`
      // copy — the one `aria-labelledby` points at — stays, so the task keeps
      // its accessible name while it is held; that is the one left.
      expect(screen.getAllByText('Высокий')).toHaveLength(1)
    })

    it('shows the strip on one row at a time', () => {
      renderTaskList(makeThree())

      enterMoveMode('Вторая')
      enterMoveMode('Третья')

      expect(screen.getAllByRole('button', { name: /^Готово$/ })).toHaveLength(1)
      expect(
        screen.getByRole('button', { name: 'Переместить вверх: Вторая' }),
      ).toBeInTheDocument()
    })
  })

  /**
   * [FELA-218](/FELA/issues/FELA-218) — PR #99's review flagged the strip's
   * own layout as held only by a `dist` measurement, which proves today's
   * head but nothing past it. `moveMode` is the one place `TaskRow` flips
   * `flex-wrap`, and that condition leaking onto a neighboring row was a
   * named risk before the row shipped. className assertions only: jsdom
   * never lays anything out.
   */
  describe('the strip’s own layout (FELA-218)', () => {
    it('adds `flex-wrap` to the row only once it is lifted, never on a normal row', () => {
      renderTaskList(makeThree())

      expect(rowFor('Вторая').className).not.toContain('flex-wrap')

      enterMoveMode('Вторая')

      expect(rowFor('Вторая').className).toContain('flex-wrap')
    })

    it('does not leak `flex-wrap` onto a neighboring row at the same moment', () => {
      renderTaskList(makeThree())

      enterMoveMode('Вторая')

      expect(rowFor('Первая').className).not.toContain('flex-wrap')
      expect(rowFor('Третья').className).not.toContain('flex-wrap')
    })

    it('gives the strip `basis-full`, so it takes its own line rather than the title column', () => {
      renderTaskList(makeThree())

      enterMoveMode('Вторая')

      const strip = screen.getByRole('button', { name: 'Переместить вверх: Вторая' })
        .parentElement as HTMLElement
      expect(strip.className).toContain('basis-full')
    })

    it('gives «Готово» the primary variant and «Отмена» the ghost variant', () => {
      renderTaskList(makeThree())

      enterMoveMode('Вторая')

      const done = screen.getByRole('button', { name: 'Готово' })
      const cancel = screen.getByRole('button', { name: 'Отмена' })
      for (const token of BUTTON_VARIANT_CLASSES.primary.split(' ')) {
        expect(done.className).toContain(token)
      }
      for (const token of BUTTON_VARIANT_CLASSES.ghost.split(' ')) {
        expect(cancel.className).toContain(token)
      }
    })
  })

  describe('moving and committing (criterion 46)', () => {
    it('reorders on ↑ and announces the new position', () => {
      renderTaskList(makeThree())

      enterMoveMode('Вторая')
      fireEvent.click(screen.getByRole('button', { name: 'Переместить вверх: Вторая' }))

      expect(renderedOrder()).toEqual(['Вторая', 'Первая', 'Третья'])
      expect(announcement()).toBe('Позиция 1 из 3')
    })

    it('reorders on ↓ too, and stays silent at the end of the list', () => {
      renderTaskList(makeThree())

      enterMoveMode('Вторая')
      fireEvent.click(screen.getByRole('button', { name: 'Переместить вниз: Вторая' }))
      expect(renderedOrder()).toEqual(['Первая', 'Третья', 'Вторая'])
      expect(announcement()).toBe('Позиция 3 из 3')

      fireEvent.click(screen.getByRole('button', { name: 'Переместить вниз: Вторая' }))
      expect(renderedOrder()).toEqual(['Первая', 'Третья', 'Вторая'])
      expect(announcement()).toBe('Позиция 3 из 3')
    })

    it('«Готово» commits the position, closes the mode and returns focus to `more`', () => {
      renderTaskList(makeThree())

      enterMoveMode('Вторая')
      fireEvent.click(screen.getByRole('button', { name: 'Переместить вверх: Вторая' }))
      fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

      expect(renderedOrder()).toEqual(['Вторая', 'Первая', 'Третья'])
      expect(announcement()).toBe('Задача «Вторая» опущена на позицию 1')
      expect(document.activeElement).toBe(moreFor('Вторая'))
      // The mode is over: strip gone, and so is the handle (criterion 44).
      expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'Переместить задачу: Вторая' }),
      ).not.toBeInTheDocument()
    })

    it('writes the committed order to localStorage', () => {
      vi.useFakeTimers()
      renderTaskList(makeThree())

      enterMoveMode('Третья')
      fireEvent.click(screen.getByRole('button', { name: 'Переместить вверх: Третья' }))
      fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

      act(() => {
        vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
      })

      expect(readTasks().tasks.map((task) => task.title)).toEqual(['Первая', 'Третья', 'Вторая'])
    })
  })

  /**
   * criterion 46 as rewritten in v1.10: both outcomes have to be reachable
   * from the screen. `Esc` is the second path to the cancel, not the only
   * one — a phone has no `Esc` key at all.
   */
  describe('cancelling from the screen (criterion 46)', () => {
    it('offers exactly four controls, with 6.4’s names and in its order', () => {
      renderTaskList(makeThree())

      enterMoveMode('Вторая')

      const strip = screen.getByRole('button', { name: 'Переместить вверх: Вторая' })
        .parentElement as HTMLElement
      expect(
        Array.from(strip.querySelectorAll('button')).map(
          (button) => button.getAttribute('aria-label') ?? button.textContent,
        ),
      ).toEqual(['Переместить вверх: Вторая', 'Переместить вниз: Вторая', 'Готово', 'Отмена'])
    })

    it('«Отмена» restores the order, announces it and returns focus to `more`', () => {
      renderTaskList(makeThree())

      enterMoveMode('Первая')
      fireEvent.click(screen.getByRole('button', { name: 'Переместить вниз: Первая' }))
      expect(renderedOrder()).toEqual(['Вторая', 'Первая', 'Третья'])

      fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))

      expect(renderedOrder()).toEqual(['Первая', 'Вторая', 'Третья'])
      expect(announcement()).toBe('Перемещение отменено, позиция 1')
      expect(document.activeElement).toBe(moreFor('Первая'))
      expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument()
    })

    it('leaves the stored order as it was before the mode was entered', () => {
      vi.useFakeTimers()
      renderTaskList(makeThree())

      enterMoveMode('Первая')
      fireEvent.click(screen.getByRole('button', { name: 'Переместить вниз: Первая' }))
      fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))

      act(() => {
        vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
      })

      expect(readTasks().tasks.map((task) => task.title)).toEqual([
        'Первая',
        'Вторая',
        'Третья',
      ])
    })
  })

  describe('cancelling with Esc (criterion 46)', () => {
    it('restores the original order, announces it and returns focus to `more`', () => {
      renderTaskList(makeThree())

      enterMoveMode('Первая')
      fireEvent.click(screen.getByRole('button', { name: 'Переместить вниз: Первая' }))
      expect(renderedOrder()).toEqual(['Вторая', 'Первая', 'Третья'])

      fireEvent.keyDown(screen.getByRole('button', { name: 'Переместить вниз: Первая' }), {
        key: 'Escape',
      })

      expect(renderedOrder()).toEqual(['Первая', 'Вторая', 'Третья'])
      expect(announcement()).toBe('Перемещение отменено, позиция 1')
      expect(document.activeElement).toBe(moreFor('Первая'))
      expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument()
    })

    it('leaves the store order as it was before the mode was entered', () => {
      vi.useFakeTimers()
      renderTaskList(makeThree())

      enterMoveMode('Первая')
      fireEvent.click(screen.getByRole('button', { name: 'Переместить вниз: Первая' }))
      fireEvent.keyDown(screen.getByRole('button', { name: 'Переместить вниз: Первая' }), {
        key: 'Escape',
      })

      act(() => {
        vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
      })

      expect(readTasks().tasks.map((task) => task.title)).toEqual(['Первая', 'Вторая', 'Третья'])
    })
  })

  /**
   * v1.10 puts the handle back in the row for the duration of the mode, so
   * 6.4's keyboard path reaches it on a phone too — with a physical keyboard
   * or switch access, Shift+Tab off the strip lands there. `Space` and `Esc`
   * pressed on the handle end the mode without going through the strip, and
   * the mode has to survive both.
   */
  describe('the handle inside the mode (design-spec 6.4)', () => {
    function handleFor(title: string): HTMLElement {
      return screen.getByRole('button', { name: `Переместить задачу: ${title}` })
    }

    it('cancels once on Esc instead of reverting its own revert', () => {
      renderTaskList(makeThree())

      enterMoveMode('Первая')
      fireEvent.click(screen.getByRole('button', { name: 'Переместить вниз: Первая' }))
      expect(renderedOrder()).toEqual(['Вторая', 'Первая', 'Третья'])

      fireEvent.keyDown(handleFor('Первая'), { key: 'Escape' })

      expect(renderedOrder()).toEqual(['Первая', 'Вторая', 'Третья'])
      expect(announcement()).toBe('Перемещение отменено, позиция 1')
      expect(document.activeElement).toBe(moreFor('Первая'))
    })

    it('commits on Space and returns focus to `more` rather than dropping it on <body>', () => {
      renderTaskList(makeThree())

      enterMoveMode('Первая')
      fireEvent.click(screen.getByRole('button', { name: 'Переместить вниз: Первая' }))

      fireEvent.keyDown(handleFor('Первая'), { key: ' ' })

      expect(renderedOrder()).toEqual(['Вторая', 'Первая', 'Третья'])
      expect(screen.queryByRole('button', { name: 'Готово' })).not.toBeInTheDocument()
      expect(document.activeElement).toBe(moreFor('Первая'))
    })
  })

  /**
   * The list is one Tab stop: exactly one row carries `tabIndex={0}` and every
   * control in the others is `-1`. The strip is part of its row and has to
   * obey that, or Tab out of the strip would skip the `more` button the mode
   * returns focus to.
   */
  describe('roving focus (architecture invariant)', () => {
    it('gives the strip the row’s tabIndex and makes the lifted row the roving row', () => {
      renderTaskList(makeThree())

      enterMoveMode('Вторая')

      for (const name of [
        'Переместить вверх: Вторая',
        'Переместить вниз: Вторая',
        'Готово',
        'Отмена',
      ]) {
        expect(screen.getByRole('button', { name }).getAttribute('tabindex')).toBe('0')
      }
      expect(moreFor('Вторая').getAttribute('tabindex')).toBe('0')
      expect(moreFor('Третья').getAttribute('tabindex')).toBe('-1')
    })
  })
})
