import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveRegion } from '../../components/LiveRegion'
import { selectTaskView } from '../../domain/filters'
import type { Task } from '../../domain/task'
import { TaskStoreProvider } from '../../state/TaskStoreProvider'
import { ToastProvider } from '../../state/ToastProvider'
import { useTaskStore } from '../../state/useTaskStore'
import { TASKS_SCHEMA_VERSION, TASKS_STORAGE_KEY } from '../../storage/taskStorage'
import { makeTasks } from '../../test/factories'
import { stubMatchMedia } from '../../test/matchMedia'
import { TaskList } from '../task-list/TaskList'

function Harness() {
  const { tasks } = useTaskStore()
  const view = selectTaskView(tasks, { filter: 'all' })
  return (
    <TaskList
      view={view}
      query=""
      filter="all"
      panelId="panel"
      activeTabId="tab-all"
      onClearSearch={() => undefined}
      onSearchAll={() => undefined}
    />
  )
}

function renderList(tasks: Task[]) {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify({ version: TASKS_SCHEMA_VERSION, tasks }))
  return render(
    <TaskStoreProvider>
      <ToastProvider>
        <LiveRegion />
        <Harness />
      </ToastProvider>
    </TaskStoreProvider>,
  )
}

/** The row's roving-focus anchor — the native checkbox `useRowShortcuts` keys land on. */
function anchor(title: string): HTMLElement {
  return screen.getByRole('checkbox', { name: new RegExp(title) })
}

function visibleTitles(): string[] {
  return screen
    .getAllByRole('listitem')
    .map((row) => row.querySelector('p')?.textContent ?? '')
    .filter((title) => title !== '')
}

/**
 * The row-scoped half of design-spec 6.3, exercised through the real
 * `TaskList` — the hook's whole job is to reach the right task, so a harness
 * with fake rows would prove nothing about that.
 */
describe('useRowShortcuts', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(true)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('E — open the editor', () => {
    it('opens TaskEditor on the focused row', () => {
      renderList(makeTasks(2))
      const row = anchor('Задача 2')
      row.focus()

      fireEvent.keyDown(row, { key: 'e', code: 'KeyE' })

      expect(screen.getByRole('textbox', { name: 'Текст задачи' })).toHaveValue('Задача 2')
    })

    it('works from the row actions too, not only from the checkbox', () => {
      renderList(makeTasks(1))
      const editButton = screen.getByRole('button', { name: 'Изменить задачу: Задача 1' })

      fireEvent.keyDown(editButton, { key: 'e', code: 'KeyE' })

      expect(screen.getByRole('textbox', { name: 'Текст задачи' })).toBeInTheDocument()
    })

    it('does not reopen from inside the editor textarea', () => {
      renderList(makeTasks(1))
      fireEvent.keyDown(anchor('Задача 1'), { key: 'e', code: 'KeyE' })
      const textarea = screen.getByRole('textbox', { name: 'Текст задачи' })

      fireEvent.keyDown(textarea, { key: 'e', code: 'KeyE' })

      // Still exactly one editor, and the key typed into the text instead.
      expect(screen.getAllByRole('textbox', { name: 'Текст задачи' })).toHaveLength(1)
    })
  })

  describe('Delete / Backspace — remove, with undo', () => {
    // The removed row keeps rendering through its `task-delete` exit
    // animation, which jsdom never finishes — so these assert the removal by
    // its toast, the way `TaskList.test.tsx` does, not by the row's absence.
    it('removes the focused task and offers «Вернуть»', () => {
      renderList(makeTasks(2))

      fireEvent.keyDown(anchor('Задача 1'), { key: 'Delete', code: 'Delete' })

      expect(screen.getByRole('alert')).toHaveTextContent('Задача удалена: «Задача 1»')
      expect(screen.getByRole('button', { name: 'Вернуть' })).toBeInTheDocument()
    })

    it('Backspace does the same', () => {
      renderList(makeTasks(2))

      fireEvent.keyDown(anchor('Задача 2'), { key: 'Backspace', code: 'Backspace' })

      expect(screen.getByRole('alert')).toHaveTextContent('Задача удалена: «Задача 2»')
    })

    it('does not delete while the caret is in the editor — Backspace has to edit text', () => {
      renderList(makeTasks(1))
      fireEvent.keyDown(anchor('Задача 1'), { key: 'e', code: 'KeyE' })

      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Текст задачи' }), {
        key: 'Backspace',
        code: 'Backspace',
      })

      expect(screen.getByRole('textbox', { name: 'Текст задачи' })).toBeInTheDocument()
    })

    it('does not delete the task behind an open popup', () => {
      renderList(makeTasks(1))
      fireEvent.click(screen.getByRole('button', { name: /Приоритет/ }))

      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Delete', code: 'Delete' })

      expect(screen.getByText('Задача 1')).toBeInTheDocument()
    })
  })

  describe('Ctrl/Cmd+↑ ↓ — move one step (design-spec 6.4)', () => {
    it('moves the row down past its visible neighbour and announces the new position', () => {
      renderList(makeTasks(3))

      fireEvent.keyDown(anchor('Задача 1'), { key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true })

      expect(visibleTitles()).toEqual(['Задача 2', 'Задача 1', 'Задача 3'])
      expect(screen.getByRole('status')).toHaveTextContent(
        'Задача «Задача 1» перемещена на позицию 2 из 3',
      )
    })

    it('Cmd+↑ moves it back up', () => {
      renderList(makeTasks(3))
      fireEvent.keyDown(anchor('Задача 1'), { key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true })

      fireEvent.keyDown(anchor('Задача 1'), { key: 'ArrowUp', code: 'ArrowUp', metaKey: true })

      expect(visibleTitles()).toEqual(['Задача 1', 'Задача 2', 'Задача 3'])
    })

    it('does nothing at the ends of the list — one step never wraps', () => {
      renderList(makeTasks(3))

      fireEvent.keyDown(anchor('Задача 1'), { key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true })
      fireEvent.keyDown(anchor('Задача 3'), { key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true })

      expect(visibleTitles()).toEqual(['Задача 1', 'Задача 2', 'Задача 3'])
    })

    it('moves instead of navigating: the roving focus does not also jump a row', () => {
      renderList(makeTasks(3))
      const row = anchor('Задача 1')
      row.focus()

      fireEvent.keyDown(row, { key: 'ArrowDown', code: 'ArrowDown', ctrlKey: true })

      expect(anchor('Задача 1')).toHaveFocus()
    })
  })
})
