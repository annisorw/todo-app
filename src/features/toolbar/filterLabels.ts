import type { Filter } from '../../domain/filters'

export const FILTER_LABELS: Record<Filter, string> = {
  all: 'Все',
  active: 'Активные',
  completed: 'Готовые',
}

export const FILTER_ORDER: Filter[] = ['all', 'active', 'completed']
