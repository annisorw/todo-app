import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { announce } from '../../lib/announce'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { selectTaskView } from '../../domain/filters'
import type { Filter, TaskView } from '../../domain/filters'
import type { Task } from '../../domain/task'
import { FILTER_LABELS } from './filterLabels'

const SEARCH_DEBOUNCE_MS = 180

export interface ToolbarState {
  filter: Filter
  /** The raw input value, so typing never waits on the debounce. */
  query: string
  /** Derived from the *debounced* query — the single instance of the filtered view. */
  view: TaskView
  setFilter: (filter: Filter) => void
  setQuery: (query: string) => void
  /** `Esc` on an empty dismiss stack (FELA-20, keys table 6.3). */
  clearQuery: () => void
}

/** Russian plural form of "задача" for 1 / 2-4 / 5+ (and the 11-14 exception). */
function pluralizeTasks(count: number): string {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return 'задач'
  if (mod10 === 1) return 'задача'
  if (mod10 >= 2 && mod10 <= 4) return 'задачи'
  return 'задач'
}

/**
 * Owns the toolbar's filter + search state and derives the filtered view from
 * it (design-spec 3.8/3.9/S1). The state used to live inside `Toolbar`, which
 * made it unreachable from outside: FELA-20 needs `1` `2` `3` to switch the
 * filter and `Esc` to clear the search, and FELA-15's list needs the very same
 * `view` the toolbar counts come from. Both are writers/readers *above* the
 * component, so the state sits one level up — still inside `features/toolbar/`,
 * with no provider and no store (architecture section 4).
 *
 * `view` is computed here exactly once and handed down; nothing copies it into
 * a second piece of state.
 *
 * @param tasks the store's task list — this hook stays free of context so the
 *   composition root keeps the single `useTaskStore()` read
 */
export function useToolbarState(tasks: Task[]): ToolbarState {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)

  const view = useMemo(
    () => selectTaskView(tasks, { filter, query: debouncedQuery }),
    [tasks, filter, debouncedQuery],
  )

  const clearQuery = useCallback(() => setQuery(''), [])

  const lastAnnouncedRef = useRef<{ filter: Filter; query: string } | null>(null)
  useEffect(() => {
    const previous = lastAnnouncedRef.current
    lastAnnouncedRef.current = { filter, query: debouncedQuery }
    if (previous === null) return
    // `view` is a dependency because the announcement quotes its counts, so
    // this effect also runs when the task list changes on its own. Only a
    // filter/query move is a user action worth speaking (PR #38).
    if (previous.filter === filter && previous.query === debouncedQuery) return

    const visibleCount = view.counts[filter]
    const word = pluralizeTasks(visibleCount)
    announce(
      debouncedQuery !== ''
        ? `Найдено ${visibleCount} ${word}`
        : `${FILTER_LABELS[filter]}: ${visibleCount} ${word}`,
    )
  }, [filter, debouncedQuery, view])

  return { filter, query, view, setFilter, setQuery, clearQuery }
}
