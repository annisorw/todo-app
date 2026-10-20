import { isValidDueDate } from './dueDate'
import { MAX_TASKS } from './limits'
import { createTask, isDone, normalizeTitle } from './task'
import type { Task, TaskDraft, TaskPatch } from './task'

/**
 * Чистые операции над списком задач.
 *
 * Общий контракт: исходный массив никогда не мутируется. Операция, которая
 * ничего не изменила (задача не найдена, патч пустой, список на лимите),
 * возвращает **тот же** массив по ссылке — это дешёвая и честная проверка
 * «ничего не произошло» и для теста, и для мемоизации в React.
 *
 * Порядок задач — это позиция в массиве. Поля `order` нет, автосортировок нет,
 * единственный мутатор порядка — `moveTask`.
 */

/** Список упёрся в лимит: новую задачу добавить нельзя. */
export function isAtTaskLimit(tasks: Task[]): boolean {
  return tasks.length >= MAX_TASKS
}

/**
 * Добавляет задачу в конец списка.
 *
 * Возвращает прежний список, если черновик невалиден или список на лимите.
 * Сообщение об этом показывает интерфейс, спросив `isAtTaskLimit` — чтобы
 * число 1000 нигде не сравнивалось вручную.
 */
export function addTask(tasks: Task[], draft: TaskDraft, now: Date): Task[] {
  if (isAtTaskLimit(tasks)) return tasks

  const task = createTask(draft, now)
  if (task === null) return tasks

  return [...tasks, task]
}

/**
 * Переключает выполненность задачи, **не меняя её позицию в массиве**.
 *
 * Отсюда и критерий приёмки 7 спеки: снятие галочки возвращает задачу на
 * прежнее место среди активных само собой — порядок один, а разбиение на
 * «активные / выполненные» считает селектор в `filters.ts`.
 */
export function toggleTask(tasks: Task[], id: string, now: Date): Task[] {
  const index = tasks.findIndex((task) => task.id === id)
  const task = tasks[index]
  if (task === undefined) return tasks

  const next = [...tasks]
  next[index] = { ...task, completedAt: isDone(task) ? null : now.toISOString() }
  return next
}

/**
 * Применяет патч к задаче: любое подмножество полей `title`, `priority`, `dueDate`.
 * Остальные поля и позиция в массиве не трогаются.
 *
 * Текст валидируется, только если `title` есть в патче. Пустой текст — не ошибка
 * данных и не удаление: решение «пустой текст = отмена правки» принимает
 * интерфейс (спека, критерий приёмки 5), а домен просто ничего не меняет.
 *
 * Срок — так же: негодная дата оставляет список прежним, тем же `isValidDueDate`,
 * что и в `createTask`. `null` при этом остаётся осмысленным «срок убран».
 */
export function updateTask(tasks: Task[], id: string, patch: TaskPatch): Task[] {
  const index = tasks.findIndex((task) => task.id === id)
  const task = tasks[index]
  if (task === undefined) return tasks

  const next: Task = { ...task }

  if (patch.title !== undefined) {
    const title = normalizeTitle(patch.title)
    if (title === null) return tasks
    next.title = title
  }
  if (patch.priority !== undefined) next.priority = patch.priority
  // `null` — осмысленное значение «срок убран», поэтому сравнение именно с undefined.
  if (patch.dueDate !== undefined) {
    if (!isValidDueDate(patch.dueDate)) return tasks
    next.dueDate = patch.dueDate
  }

  const changed =
    next.title !== task.title ||
    next.priority !== task.priority ||
    next.dueDate !== task.dueDate
  if (!changed) return tasks

  const result = [...tasks]
  result[index] = next
  return result
}

export function removeTask(tasks: Task[], id: string): Task[] {
  const index = tasks.findIndex((task) => task.id === id)
  if (index === -1) return tasks

  return [...tasks.slice(0, index), ...tasks.slice(index + 1)]
}

/**
 * Возвращает удалённую задачу на прежнее место (спека, критерий приёмки 6).
 *
 * Индекс зажимается в границы: список мог стать короче, пока висел тост.
 * Лимит `MAX_TASKS` здесь не проверяется намеренно — возврат возможен только
 * после удаления, то есть список уже был на единицу короче лимита.
 */
export function restoreTask(tasks: Task[], task: Task, index: number): Task[] {
  if (tasks.some((existing) => existing.id === task.id)) return tasks

  const at = Math.min(Math.max(index, 0), tasks.length)
  return [...tasks.slice(0, at), task, ...tasks.slice(at)]
}

/**
 * Переносит задачу с позиции `from` на позицию `to`.
 *
 * Индекс за границами списка — не ошибка, а «дальше некуда»: так `Ctrl+↑` на
 * первой строке просто ничего не делает, вместо того чтобы тихо переставить
 * её куда-то ещё.
 */
export function moveTask(tasks: Task[], from: number, to: number): Task[] {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return tasks
  if (from < 0 || from >= tasks.length) return tasks
  if (to < 0 || to >= tasks.length) return tasks
  if (from === to) return tasks

  const next = [...tasks]
  const [moved] = next.splice(from, 1)
  if (moved === undefined) return tasks
  next.splice(to, 0, moved)
  return next
}

export function clearCompleted(tasks: Task[]): Task[] {
  const next = tasks.filter((task) => !isDone(task))
  return next.length === tasks.length ? tasks : next
}
