import { MAX_QUERY_LENGTH } from './limits'
import { isDone } from './task'
import type { Task } from './task'

/** Сегменты `SegmentedControl` (спека, 3.9). */
export type Filter = 'all' | 'active' | 'completed'

/** Числа на сегментах. Считаются по тем же задачам, что и показываются. */
export interface TaskCounts {
  all: number
  active: number
  completed: number
}

export interface TaskView {
  /** Активные задачи в ручном порядке. Пусто, если выбран фильтр `completed`. */
  active: Task[]
  /** Выполненные, новые сверху. Пусто, если выбран фильтр `active`. */
  completed: Task[]
  /** Счётчики сегментов — по всем трём сегментам, независимо от выбранного. */
  counts: TaskCounts
}

export interface TaskViewOptions {
  filter: Filter
  query?: string
}

/**
 * Приводит поисковый запрос к виду, пригодному для сравнения.
 *
 * Запрос режется по `MAX_QUERY_LENGTH` здесь, в домене, а не только в поле
 * ввода: домен не верит вызывающему. Пустая строка означает «поиска нет».
 */
export function normalizeQuery(query: string): string {
  return query.trim().slice(0, MAX_QUERY_LENGTH).toLowerCase()
}

/**
 * Совпадение по подстроке, без учёта регистра.
 *
 * `RegExp` из пользовательского запроса не строится намеренно: это ReDoS и
 * сломанный паттерн на метасимволах (`docs/CODE-RULES.md`, раздел 2). Поэтому
 * запрос `+b(` ищется как три обычных символа.
 *
 * @param normalizedQuery результат `normalizeQuery`, а не сырой ввод
 */
export function matchesQuery(task: Task, normalizedQuery: string): boolean {
  if (normalizedQuery === '') return true
  return task.title.toLowerCase().indexOf(normalizedQuery) !== -1
}

/**
 * Делит список на активные и выполненные.
 *
 * Активные сохраняют ручной порядок. Выполненные сортируются по `completedAt`
 * вниз от новых; при равных метках порядок в массиве сохраняется, потому что
 * `Array.prototype.sort` стабильна.
 */
export function partitionTasks(tasks: Task[]): { active: Task[]; completed: Task[] } {
  const active: Task[] = []
  const completed: Task[] = []

  for (const task of tasks) {
    if (isDone(task)) completed.push(task)
    else active.push(task)
  }

  completed.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))

  return { active, completed }
}

/**
 * Единственный селектор, который нужен списку: что показать и что написать на
 * сегментах.
 *
 * Поиск применяется **до** фильтра, поэтому он работает внутри текущего
 * фильтра, а счётчики показывают, сколько задач найдено в каждом сегменте —
 * ровно то число, которое человек увидит, переключившись туда (спека,
 * критерий приёмки 8). Отсюда же берётся кнопка «Искать во всех»: она нужна,
 * когда `counts.all` больше нуля, а текущий сегмент пуст.
 */
export function selectTaskView(tasks: Task[], options: TaskViewOptions): TaskView {
  const normalizedQuery = normalizeQuery(options.query ?? '')
  const found = normalizedQuery === '' ? tasks : tasks.filter((task) => matchesQuery(task, normalizedQuery))

  const { active, completed } = partitionTasks(found)
  const counts: TaskCounts = {
    all: found.length,
    active: active.length,
    completed: completed.length,
  }

  return {
    active: options.filter === 'completed' ? [] : active,
    completed: options.filter === 'active' ? [] : completed,
    counts,
  }
}
