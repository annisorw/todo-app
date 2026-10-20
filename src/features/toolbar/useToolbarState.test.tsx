import type { ReactNode } from 'react'
import { act, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveRegion } from '../../components/LiveRegion'
import type { Task } from '../../domain/task'
import { makeTask } from '../../test/factories'
import { useToolbarState } from './useToolbarState'

/**
 * The announcements are asserted through the real `LiveRegion` rather than a
 * spy on `announce`, so these tests keep checking what a screen reader would
 * actually read out — the same assertions these cases made while they lived in
 * `Toolbar.test.tsx`.
 */
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <LiveRegion />
      {children}
    </>
  )
}

function renderToolbarState(tasks: Task[]) {
  return renderHook(({ tasks: current }: { tasks: Task[] }) => useToolbarState(current), {
    initialProps: { tasks },
    wrapper: Wrapper,
  })
}

const liveRegion = () => screen.getByRole('status')

describe('useToolbarState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts on "all" with an empty query and the full view', () => {
    const { result } = renderToolbarState([
      makeTask({ id: 't1' }),
      makeTask({ id: 't2', completedAt: '2026-10-20T10:00:00.000Z' }),
    ])

    expect(result.current.filter).toBe('all')
    expect(result.current.query).toBe('')
    expect(result.current.view.counts).toEqual({ all: 2, active: 1, completed: 1 })
  })

  it('does not announce anything on initial mount', () => {
    renderToolbarState([makeTask({ id: 't1' })])
    expect(liveRegion()).toBeEmptyDOMElement()
  })

  it('announces a programmatic filter change — what keys 1/2/3 need', () => {
    const { result } = renderToolbarState([
      makeTask({ id: 't1' }),
      makeTask({ id: 't2', completedAt: '2026-10-20T10:00:00.000Z' }),
    ])

    act(() => {
      result.current.setFilter('completed')
    })

    expect(result.current.filter).toBe('completed')
    expect(result.current.view.active).toEqual([])
    expect(result.current.view.completed.map((task) => task.id)).toEqual(['t2'])
    expect(liveRegion()).toHaveTextContent('Готовые: 1 задача')
  })

  it('keeps the raw query immediately and does not filter before the 180ms debounce', () => {
    const tasks = [makeTask({ id: 't1', title: 'Купить молоко' }), makeTask({ id: 't2', title: 'Помыть окна' })]
    const { result } = renderToolbarState(tasks)

    act(() => {
      result.current.setQuery('молоко')
    })

    // Typing is never delayed; only the derived view waits.
    expect(result.current.query).toBe('молоко')

    act(() => {
      vi.advanceTimersByTime(179)
    })

    expect(result.current.view.counts.all).toBe(2)
    expect(liveRegion()).toBeEmptyDOMElement()
  })

  it('filters and announces 180ms after the query settles', () => {
    const tasks = [makeTask({ id: 't1', title: 'Купить молоко' }), makeTask({ id: 't2', title: 'Помыть окна' })]
    const { result } = renderToolbarState(tasks)

    act(() => {
      result.current.setQuery('молоко')
    })
    act(() => {
      vi.advanceTimersByTime(180)
    })

    expect(result.current.view.active.map((task) => task.id)).toEqual(['t1'])
    expect(liveRegion()).toHaveTextContent('Найдено 1 задача')
  })

  it('clearQuery restores the full view and announces it — what Esc needs on an empty stack', () => {
    const tasks = [makeTask({ id: 't1', title: 'Купить молоко' }), makeTask({ id: 't2', title: 'Помыть окна' })]
    const { result } = renderToolbarState(tasks)

    act(() => {
      result.current.setQuery('молоко')
    })
    act(() => {
      vi.advanceTimersByTime(180)
    })

    act(() => {
      result.current.clearQuery()
    })
    act(() => {
      vi.advanceTimersByTime(180)
    })

    expect(result.current.query).toBe('')
    expect(result.current.view.counts.all).toBe(2)
    expect(liveRegion()).toHaveTextContent('Все: 2 задачи')
  })

  it('a literal "(" in the query does not throw and matches a title containing it', () => {
    const tasks = [makeTask({ id: 't1', title: 'a(b' }), makeTask({ id: 't2', title: 'other' })]
    const { result } = renderToolbarState(tasks)

    expect(() => {
      act(() => {
        result.current.setQuery('(')
      })
      act(() => {
        vi.advanceTimersByTime(180)
      })
    }).not.toThrow()

    expect(result.current.view.active.map((task) => task.id)).toEqual(['t1'])
  })

  it('does not announce when the task list changes without user interaction', () => {
    const tasks = [makeTask({ id: 't1' })]
    const { result, rerender } = renderToolbarState(tasks)

    rerender({ tasks: [...tasks, makeTask({ id: 't2' })] })

    // The counts moved from 1 to 2, so the derived view changed and the
    // announce effect re-ran — but nobody touched the filter or the search,
    // so there is nothing to say (the defect caught in PR #38).
    expect(result.current.view.counts.all).toBe(2)
    expect(liveRegion()).toBeEmptyDOMElement()

    act(() => {
      result.current.setFilter('active')
    })
    expect(liveRegion()).toHaveTextContent('Активные: 2 задачи')
  })
})
