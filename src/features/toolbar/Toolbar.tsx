import { forwardRef, useId } from 'react'
import { cn } from '../../lib/cn'
import type { Filter, TaskCounts } from '../../domain/filters'
import { FilterTabs } from './FilterTabs'
import { SearchField } from './SearchField'
import { useStickyBand } from './useStickyBand'

export interface ToolbarProps {
  filter: Filter
  /** The raw search input value, not the debounced one. */
  query: string
  counts: TaskCounts
  onFilterChange: (filter: Filter) => void
  onQueryChange: (query: string) => void
  /** `aria-controls` target for the filter tabs — the list's `role="tabpanel"` id (TechLead note on FELA-16/FELA-15). */
  listPanelId?: string
  /**
   * Stable prefix for each tab's DOM id, so the caller (the composition
   * root) can predict the selected tab's id for the list's
   * `aria-labelledby` via `segmentTabId(idPrefix, filter)`. Falls back to
   * an internal `useId()` when omitted.
   */
  idPrefix?: string
}

/**
 * Design-spec 3.8/3.9/S1. A controlled component: `filter`, `query` and the
 * derived counts come from `useToolbarState`, which the screen owns, because
 * FELA-20's `1` `2` `3` / `Esc` write into that state from outside the toolbar
 * and FELA-15's list reads the same view. What stays here is the sticky band
 * (`useStickyBand`, transparent until the list scrolls under it) and markup.
 *
 * Forwards its ref to the search input, matching the FELA-20 contract: a
 * future global `/` shortcut focuses this component directly.
 */
export const Toolbar = forwardRef<HTMLInputElement, ToolbarProps>(function Toolbar(
  { filter, query, counts, onFilterChange, onQueryChange, listPanelId, idPrefix },
  ref,
) {
  const { sentinelRef, isStuck } = useStickyBand()
  const internalIdPrefix = useId()
  const tabIdPrefix = idPrefix ?? internalIdPrefix

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-0" />
      <div
        className={cn(
          'toolbar-sticky sticky top-0 z-(--z-sticky) flex flex-col gap-(--space-3) py-(--space-3) sm:flex-row sm:items-center sm:justify-between sm:gap-(--space-4)',
          isStuck && 'is-stuck',
        )}
      >
        <SearchField ref={ref} value={query} onChange={onQueryChange} />
        <FilterTabs
          filter={filter}
          counts={counts}
          onFilterChange={onFilterChange}
          panelId={listPanelId}
          idPrefix={tabIdPrefix}
        />
      </div>
    </>
  )
})
