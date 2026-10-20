import { isValidDueDate } from './dueDate'
import { MAX_TITLE_LENGTH } from './limits'

/** Приоритет задачи. `none` — приоритет не выбран, это не «низкий». */
export type Priority = 'none' | 'low' | 'medium' | 'high'

export interface Task {
  /** crypto.randomUUID() */
  id: string
  /** 1..MAX_TITLE_LENGTH символов, уже обрезанный по краям */
  title: string
  priority: Priority
  /** 'YYYY-MM-DD' — дата без времени; null = срока нет */
  dueDate: string | null
  /** ISO-метка выполнения; null = задача активная */
  completedAt: string | null
  /** ISO, не меняется */
  createdAt: string
}

/** То, что приходит из интерфейса при создании: всё, кроме служебных полей. */
export interface TaskDraft {
  title: string
  priority?: Priority
  dueDate?: string | null
}

/**
 * Правка — это патч, а не присваивание заголовка: редактор меняет текст,
 * приоритет и срок разом, а быстрый путь из строки — одно поле.
 */
export type TaskPatch = Partial<Pick<Task, 'title' | 'priority' | 'dueDate'>>

/**
 * Признак выполнения — производное от `completedAt`, отдельного поля `done` нет:
 * два источника правды рядом друг с другом разъезжаются.
 */
export function isDone(task: Task): boolean {
  return task.completedAt !== null
}

/**
 * Приводит введённый текст к виду, пригодному для хранения, или сообщает, что он негоден.
 *
 * Пробелы по краям обрезаются. Символы `<`, `>`, `&` сохраняются как есть:
 * экранирование — задача вывода, React делает его сам, а санитизация на входе
 * молча ломает легальные названия задач (`docs/CODE-RULES.md`, раздел 1).
 *
 * Текст длиннее лимита **отклоняется, а не обрезается**: молча потерять хвост
 * чужого текста хуже, чем отказать и дать человеку решить самому.
 *
 * @returns обрезанный текст либо `null`, если он пуст или длиннее лимита
 */
export function normalizeTitle(title: string): string | null {
  const trimmed = title.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_TITLE_LENGTH) return null
  return trimmed
}

/**
 * Собирает задачу из черновика.
 *
 * Время передаётся аргументом, а не берётся из системных часов: так тест задаёт
 * `createdAt` явно, а домен остаётся без скрытого ввода.
 *
 * Негодный `dueDate` отклоняет весь черновик, а не обнуляется в `null`: человек
 * выбрал срок, и тихо его потерять хуже, чем отказать. Это же держит границу
 * записи согласованной с разборщиком хранилища, который битый срок не принимает
 * и выбрасывает задачу целиком — иначе созданная задача пропадала после
 * перезагрузки.
 *
 * @returns задачу либо `null`, если черновик невалиден. Исключений не бросает:
 * решение «что показать человеку» принимает интерфейс, а не домен.
 */
export function createTask(draft: TaskDraft, now: Date): Task | null {
  const title = normalizeTitle(draft.title)
  if (title === null) return null
  if (!isValidDueDate(draft.dueDate)) return null

  return {
    id: crypto.randomUUID(),
    title,
    priority: draft.priority ?? 'none',
    dueDate: draft.dueDate ?? null,
    completedAt: null,
    createdAt: now.toISOString(),
  }
}
