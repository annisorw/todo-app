/**
 * Чтение и запись списка задач под ключом `aurora.tasks.v1`.
 *
 * **Прочитанное из `localStorage` — недоверенный ввод, а не наши данные.**
 * Origin демо общий для всех Pages-проектов аккаунта, то есть любой другой
 * проект на этом домене читает и перезаписывает наш ключ, а сам пользователь
 * меняет storage через DevTools за пять секунд. Префикс ключа — гигиена имён,
 * не изоляция (`docs/CODE-RULES.md`, раздел 3).
 *
 * Поэтому `JSON.parse(raw) as Task[]` здесь запрещён: `as` не проверяет ничего.
 * Разборщик **пересобирает** каждую задачу по известным полям, и лишние ключи
 * из хранилища до состояния приложения не доходят.
 *
 * Правило отбора одно: задача остаётся, если `id`, `title` и `createdAt` на
 * месте и годны, а каждое присутствующее необязательное поле проходит проверку.
 * Отсутствующее необязательное поле берёт значение по умолчанию, присутствующее
 * с мусором — отбрасывает задачу целиком (архитектура, раздел 5: «задачи с
 * битыми полями пропускаем»). Единственное исключение — слишком длинный
 * `title`: его обрезают, а не теряют вместе с задачей.
 */

import { isValidDateKey } from '../domain/dueDate'
import { MAX_TASKS, MAX_TITLE_LENGTH } from '../domain/limits'
import { isPriority } from '../domain/task'
import type { Priority, Task } from '../domain/task'
import { readRaw, writeRaw } from './localStorageDriver'
import type { StorageError, StorageResult } from './localStorageDriver'

export const TASKS_STORAGE_KEY = 'aurora.tasks.v1'

/**
 * Карантин нечитаемого значения.
 *
 * Разобрать не удалось — значит, байты основного ключа через 250 мс заменит
 * пустой конверт персиста, и человеку будет нечего выгружать кнопкой «Выгрузить
 * в файл» из `ErrorBanner` ([FELA-18](/FELA/issues/FELA-18), спека, строка 387).
 * Обрезанный JSON часто правится руками, поэтому копия снимается до любой
 * записи, а не вместо неё: очищающая запись в основной ключ остаётся как была.
 *
 * Класс данных тот же, что и в основном ключе, — текст задач; политика
 * содержимого хранилища (`docs/CODE-RULES.md`, раздел 3) не меняется.
 */
export const CORRUPTED_BACKUP_KEY = 'aurora.tasks.v1.corrupted'

/**
 * Версия схемы хранения. Миграций сегодня нет; это место, куда их добавят, не
 * ломая чужие данные (архитектура, раздел 5).
 */
export const TASKS_SCHEMA_VERSION = 1

export interface StoredTasks {
  version: typeof TASKS_SCHEMA_VERSION
  tasks: Task[]
}

export interface TasksReadResult {
  tasks: Task[]
  /** `null` — прочитать удалось; пустой ключ при первом запуске тоже `null`. */
  error: StorageError | null
  /**
   * Сколько записей отбросил валидатор.
   *
   * Отдельные битые задачи **не** поднимают `storageError`: один мусорный
   * элемент из пятидесяти не повод показывать человеку баннер ошибки. Счётчик
   * нужен dev-предупреждению и тестам, чтобы молчаливый отброс оставался
   * наблюдаемым.
   */
  droppedCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseId(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  return value
}

/**
 * Текст длиннее лимита **обрезается**, в отличие от `normalizeTitle` в домене,
 * который его отклоняет. Разница в том, кого можно переспросить: человеку за
 * клавиатурой отказ понятен и он поправит текст сам, а у записи из хранилища
 * спросить некого — там обрезка сохраняет данные, а отказ их теряет.
 */
function parseTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  return trimmed.slice(0, MAX_TITLE_LENGTH)
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null
  return value
}

/** Пересобирает задачу по известным полям или отказывается её принимать. */
function parseTask(input: unknown): Task | null {
  if (!isRecord(input)) return null

  const id = parseId(input.id)
  if (id === null) return null

  const title = parseTitle(input.title)
  if (title === null) return null

  const createdAt = parseTimestamp(input.createdAt)
  if (createdAt === null) return null

  let priority: Priority = 'none'
  if (input.priority !== undefined) {
    if (!isPriority(input.priority)) return null
    priority = input.priority
  }

  let dueDate: string | null = null
  if (input.dueDate !== undefined && input.dueDate !== null) {
    if (typeof input.dueDate !== 'string' || !isValidDateKey(input.dueDate)) return null
    dueDate = input.dueDate
  }

  let completedAt: string | null = null
  if (input.completedAt !== undefined && input.completedAt !== null) {
    completedAt = parseTimestamp(input.completedAt)
    if (completedAt === null) return null
  }

  // Объект собран здесь и только из проверенных значений: прочитанный в
  // состояние не прокидывается, поэтому лишние ключи из storage не расползаются.
  return { id, title, priority, dueDate, completedAt, createdAt }
}

/**
 * Разбирает содержимое ключа.
 *
 * Нечитаемый JSON и конверт не той формы — это «прочитать не удалось вообще»,
 * отсюда `'corrupted'` и пустой список в памяти. Чужая версия схемы тоже:
 * понять её мы не можем, а молча толковать как свою — потерять данные.
 */
export function parseStoredTasks(raw: string): TasksReadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`localStorage: value of "${TASKS_STORAGE_KEY}" is not valid JSON.`, error)
    }
    return { tasks: [], error: 'corrupted', droppedCount: 0 }
  }

  if (!isRecord(parsed) || parsed.version !== TASKS_SCHEMA_VERSION || !Array.isArray(parsed.tasks)) {
    if (import.meta.env.DEV) {
      console.warn(`localStorage: value of "${TASKS_STORAGE_KEY}" is not a version ${String(TASKS_SCHEMA_VERSION)} envelope.`)
    }
    return { tasks: [], error: 'corrupted', droppedCount: 0 }
  }

  const entries: unknown[] = parsed.tasks
  const tasks: Task[] = []
  const seenIds = new Set<string>()
  let droppedCount = 0

  for (const entry of entries) {
    const task = tasks.length < MAX_TASKS ? parseTask(entry) : null
    // Повтор `id` сломал бы и ключи React, и адресацию задачи по id.
    if (task === null || seenIds.has(task.id)) {
      droppedCount += 1
      continue
    }
    seenIds.add(task.id)
    tasks.push(task)
  }

  if (droppedCount > 0 && import.meta.env.DEV) {
    console.warn(
      `localStorage: dropped ${String(droppedCount)} invalid or surplus task(s) from "${TASKS_STORAGE_KEY}".`,
    )
  }

  return { tasks, error: null, droppedCount }
}

/**
 * Снимает копию нечитаемого значения в карантин.
 *
 * Отказ копии не меняет ответ `readTasks`: человеку важнее баннер
 * `'corrupted'`, чем сообщение о неудавшейся подстраховке. В dev отказ виден в
 * консоли, молча он не проходит. Повторная копия тех же байт не делается — при
 * заблокированной записи основной ключ не очищается, и каждая загрузка иначе
 * писала бы в карантин одно и то же.
 */
function quarantineRaw(raw: string): void {
  const existing = readRaw(CORRUPTED_BACKUP_KEY)
  if (existing.ok && existing.value === raw) return

  const error = writeRaw(CORRUPTED_BACKUP_KEY, raw)
  if (error !== null && import.meta.env.DEV) {
    console.warn(`localStorage: could not back up the unreadable value to "${CORRUPTED_BACKUP_KEY}" (${error}).`)
  }
}

/**
 * Отдаёт сохранённое в карантине нечитаемое значение — источник для кнопки
 * «Выгрузить в файл» ([FELA-18](/FELA/issues/FELA-18)). `{ ok: true, value: null }`
 * — карантин пуст, то есть выгружать нечего.
 */
export function readCorruptedBackup(): StorageResult<string | null> {
  return readRaw(CORRUPTED_BACKUP_KEY)
}

/**
 * Отказ, при котором сохранённое **не прочиталось**, а исходные байты уехали в
 * карантин.
 *
 * Единственный источник правды для двух разных решений, которые раньше оба
 * сравнивали код с `'corrupted'` руками: откуда брать байты для «Выгрузить в
 * файл» и имеет ли смысл «Повторить». Повторять нечего — ломалась не запись, и
 * удавшаяся запись ничего о читаемости не говорит
 * ([FELA-70](/FELA/issues/FELA-70)).
 *
 * `'blocked'` тоже приходит из чтения, но там недоступно само хранилище:
 * карантина нет, выгружать можно только список из памяти, а запись честно
 * отказывает тем же кодом.
 */
export function isUnreadableError(error: StorageError): boolean {
  return error === 'corrupted'
}

export function readTasks(): TasksReadResult {
  const result = readRaw(TASKS_STORAGE_KEY)
  if (!result.ok) return { tasks: [], error: result.error, droppedCount: 0 }
  // Ключа нет — первый запуск, это норма, а не поломка.
  if (result.value === null) return { tasks: [], error: null, droppedCount: 0 }

  const parsed = parseStoredTasks(result.value)
  // Разбор провалился целиком — сохранить байты до того, как персист заменит
  // их пустым конвертом. Отброшенные отдельные задачи сюда не попадают: там
  // конверт прочитан и выгружать из сырой строки нечего.
  if (parsed.error === 'corrupted') quarantineRaw(result.value)
  return parsed
}

/** @returns `null`, если записалось */
export function writeTasks(tasks: Task[]): StorageError | null {
  const payload: StoredTasks = { version: TASKS_SCHEMA_VERSION, tasks }
  return writeRaw(TASKS_STORAGE_KEY, JSON.stringify(payload))
}
