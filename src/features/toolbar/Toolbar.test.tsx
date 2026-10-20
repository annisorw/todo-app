import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveRegion } from '../../components/LiveRegion'
import type { Task } from '../../domain/task'
import { makeTask } from '../../test/factories'
import { stubMatchMedia } from '../../test/matchMedia'
import { TaskStoreContext } from '../../state/useTaskStore'
import type { TaskStoreValue } from '../../state/useTaskStore'
import { Toolbar } from './Toolbar'
import type { ToolbarState } from './Toolbar'

function makeStoreValue(tasks: Task[]): TaskStoreValue {
  return {
    tasks,
    lastRemoved: null,
    storageError: null,
    isAtLimit: false,
    addTask: vi.fn(),
    toggleTask: vi.fn(),
    editTask: vi.fn(),
    removeTask: vi.fn(),
    restoreRemoved: vi.fn(),
    moveTask: vi.fn(),
    clearCompleted: vi.fn(),
    dismissStorageError: vi.fn(),
  }
}

function Providers({ tasks, children }: { tasks: Task[]; children: ReactNode }) {
  return <TaskStoreContext.Provider value={makeStoreValue(tasks)}>{children}</TaskStoreContext.Provider>
}

function renderToolbar(tasks: Task[], onStateChange?: (state: ToolbarState) => void) {
  return render(
    <Providers tasks={tasks}>
      <LiveRegion />
      <Toolbar onStateChange={onStateChange} />
    </Providers>,
  )
}

/** jsdom has no `IntersectionObserver`; `useStickyBand` only needs `observe`/`disconnect` to exist. */
class StubIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}

describe('Toolbar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stubMatchMedia(false)
    vi.stubGlobal('IntersectionObserver', StubIntersectionObserver)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows segment counts that match the task list', () => {
    const tasks = [
      makeTask({ id: 't1' }),
      makeTask({ id: 't2' }),
      makeTask({ id: 't3', completedAt: '2026-10-20T10:00:00.000Z' }),
    ]
    renderToolbar(tasks)

    expect(screen.getByRole('tab', { name: 'Все 3' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Активные 2' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Готовые 1' })).toBeInTheDocument()
  })

  it('does not announce anything on initial mount', () => {
    renderToolbar([makeTask({ id: 't1' })])
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('does not filter before the 180ms debounce has elapsed', () => {
    const tasks = [makeTask({ id: 't1', title: 'Купить молоко' }), makeTask({ id: 't2', title: 'Помыть окна' })]
    const onStateChange = vi.fn()
    renderToolbar(tasks, onStateChange)
    onStateChange.mockClear()

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'молоко' } })
    act(() => {
      vi.advanceTimersByTime(179)
    })

    // The debounced query hasn't moved yet, so the derived view hasn't
    // changed either — no new notification, and both tasks still show.
    expect(onStateChange).not.toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: 'Все 2' })).toBeInTheDocument()
  })

  it('filters within the current selection 180ms after the query settles', () => {
    const tasks = [makeTask({ id: 't1', title: 'Купить молоко' }), makeTask({ id: 't2', title: 'Помыть окна' })]
    const onStateChange = vi.fn()
    renderToolbar(tasks, onStateChange)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'молоко' } })
    act(() => {
      vi.advanceTimersByTime(180)
    })

    const lastCall = onStateChange.mock.calls.at(-1)?.[0] as ToolbarState
    expect(lastCall.query).toBe('молоко')
    expect(lastCall.view.active).toHaveLength(1)
    expect(lastCall.view.active[0]?.id).toBe('t1')

    expect(screen.getByRole('status')).toHaveTextContent('Найдено 1 задача')
  })

  it('a literal "(" in the query does not throw and matches a title containing it', () => {
    const tasks = [makeTask({ id: 't1', title: 'a(b' }), makeTask({ id: 't2', title: 'other' })]
    const onStateChange = vi.fn()

    expect(() => {
      renderToolbar(tasks, onStateChange)
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: '(' } })
      act(() => {
        vi.advanceTimersByTime(180)
      })
    }).not.toThrow()

    const lastCall = onStateChange.mock.calls.at(-1)?.[0] as ToolbarState
    expect(lastCall.view.active.map((task) => task.id)).toEqual(['t1'])
  })

  it('switching filters updates the live region and the visible tab', () => {
    const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2', completedAt: '2026-10-20T10:00:00.000Z' })]
    renderToolbar(tasks)

    fireEvent.click(screen.getByRole('tab', { name: 'Готовые 1' }))

    expect(screen.getByRole('tab', { name: 'Готовые 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Готовые: 1 задача')
  })

  it('does not announce when the task list changes without user interaction', () => {
    const tasks = [makeTask({ id: 't1' })]
    const { rerender } = renderToolbar(tasks)

    const tasksWithUnrelatedAdd = [...tasks, makeTask({ id: 't2' })]
    rerender(
      <Providers tasks={tasksWithUnrelatedAdd}>
        <LiveRegion />
        <Toolbar />
      </Providers>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('')

    fireEvent.click(screen.getByRole('tab', { name: 'Активные 2' }))
    expect(screen.getByRole('status')).toHaveTextContent('Активные: 2 задачи')
  })

  it('keeps an empty segment clickable and focusable with no disabled/aria-disabled', () => {
    const tasks = [makeTask({ id: 't1' })]
    renderToolbar(tasks)

    const completedTab = screen.getByRole('tab', { name: 'Готовые 0' })
    expect(completedTab).not.toHaveAttribute('disabled')
    expect(completedTab).not.toHaveAttribute('aria-disabled')
    completedTab.focus()
    expect(completedTab).toHaveFocus()
  })
})
