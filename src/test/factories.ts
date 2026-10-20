import type { Task } from '../domain/task'

/**
 * Фабрика тестовых задач.
 *
 * Все поля предсказуемы и задаются явно — тест, которому нужен конкретный `id`
 * или `completedAt`, пишет его сам, а не подстраивается под случайное значение.
 * Данные синтетические: ни настоящих имён, ни адресов (`docs/CODE-RULES.md`, 4).
 */
export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Задача',
    priority: 'none',
    dueDate: null,
    completedAt: null,
    createdAt: '2026-10-20T09:00:00.000Z',
    ...overrides,
  }
}

/** Несколько активных задач с предсказуемыми `id`: `task-1`, `task-2`, … */
export function makeTasks(count: number): Task[] {
  return Array.from({ length: count }, (_, index) =>
    makeTask({ id: `task-${String(index + 1)}`, title: `Задача ${String(index + 1)}` }),
  )
}
