import { SegmentedControl } from '../../components/SegmentedControl'
import type { Filter, TaskCounts } from '../../domain/filters'
import { FILTER_LABELS, FILTER_ORDER } from './filterLabels'

export interface FilterTabsProps {
  filter: Filter
  counts: TaskCounts
  onFilterChange: (filter: Filter) => void
}

/** Design-spec 3.9 — binds the three fixed filters to `SegmentedControl`. */
export function FilterTabs({ filter, counts, onFilterChange }: FilterTabsProps) {
  const options = FILTER_ORDER.map((id) => ({
    id,
    label: FILTER_LABELS[id],
    count: counts[id],
  }))

  return (
    <SegmentedControl
      aria-label="Фильтр задач"
      options={options}
      selectedId={filter}
      onSelect={(id) => onFilterChange(id as Filter)}
    />
  )
}
