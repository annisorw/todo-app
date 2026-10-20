import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { announce } from '../../lib/announce'
import { cn } from '../../lib/cn'
import { useDebouncedValue } from '../../lib/useDebouncedValue'
import { selectTaskView } from '../../domain/filters'
import type { Filter, TaskView } from '../../domain/filters'
import { useTaskStore } from '../../state/useTaskStore'
import { FILTER_LABELS } from './filterLabels'
import { FilterTabs } from './FilterTabs'
import { SearchField } from './SearchField'
import { useStickyBand } from './useStickyBand'

const SEARCH_DEBOUNCE_MS = 180

export interface ToolbarState {
  filter: Filter
  /** The debounced query actually used for matching — not the raw input value. */
  query: string
  view: TaskView
}

export interface ToolbarProps {
  /**
   * Fires whenever the filtered view changes. `features/task-list` doesn't
   * exist yet (FELA-15), so this is the seam a future parent uses to render
   * the same `active`/`completed` arrays this toolbar computed, and to
   * read `filter`/`query` for the S5 "completed" toast and S4 highlighting
   * — without `Toolbar` needing to know anything about `TaskList`.
   */
  onStateChange?: (state: ToolbarState) => void
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
 * Design-spec 3.8/3.9/S1. Owns the local filter + search state (architecture
 * section 4 — this is UI state, never persisted) and derives the filtered
 * view through `domain/filters.selectTaskView`. The sticky band
 * (`useStickyBand`) stays transparent until the list scrolls under it.
 *
 * Forwards its ref to the search input, matching the FELA-20 contract: a
 * future global `/` shortcut focuses this component directly.
 */
export const Toolbar = forwardRef<HTMLInputElement, ToolbarProps>(function Toolbar({ onStateChange }, ref) {
  const { tasks } = useTaskStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const { sentinelRef, isStuck } = useStickyBand()

  const view = useMemo(
    () => selectTaskView(tasks, { filter, query: debouncedQuery }),
    [tasks, filter, debouncedQuery],
  )

  const lastAnnouncedRef = useRef<{ filter: Filter; query: string } | null>(null)
  useEffect(() => {
    const previous = lastAnnouncedRef.current
    lastAnnouncedRef.current = { filter, query: debouncedQuery }
    if (previous === null) return
    if (previous.filter === filter && previous.query === debouncedQuery) return

    const visibleCount = view.counts[filter]
    const word = pluralizeTasks(visibleCount)
    announce(
      debouncedQuery !== ''
        ? `Найдено ${visibleCount} ${word}`
        : `${FILTER_LABELS[filter]}: ${visibleCount} ${word}`,
    )
  }, [filter, debouncedQuery, view])

  const onStateChangeRef = useRef(onStateChange)
  useEffect(() => {
    onStateChangeRef.current = onStateChange
  })

  useEffect(() => {
    onStateChangeRef.current?.({ filter, query: debouncedQuery, view })
  }, [filter, debouncedQuery, view])

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-0" />
      <div
        className={cn(
          'toolbar-sticky sticky top-0 z-(--z-sticky) flex flex-col gap-(--space-3) py-(--space-3) sm:flex-row sm:items-center sm:justify-between sm:gap-(--space-4)',
          isStuck && 'is-stuck',
        )}
      >
        <SearchField ref={ref} value={query} onChange={setQuery} />
        <FilterTabs filter={filter} counts={view.counts} onFilterChange={setFilter} />
      </div>
    </>
  )
})
