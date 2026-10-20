/**
 * Работа со сроком задачи.
 *
 * Срок — строка `YYYY-MM-DD` без времени, и сравнивается он тоже строкой.
 * `Date` в данных нет: при сериализации он всё равно станет строкой, а часовой
 * пояс на этом сдвинет дату на сутки (архитектура, раздел 3, решение 4).
 *
 * «Сегодня» всегда приходит аргументом `todayKey`. Системных часов этот модуль
 * не знает — единственное место, где они читаются, это `toDateKey(new Date())`
 * на границе приложения.
 */

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const MILLISECONDS_PER_DAY = 86_400_000

/**
 * Подписи набраны руками, а не через `Intl.DateTimeFormat('ru-RU')`.
 *
 * Причина практическая: `Intl` даёт «пт, 24 окт.» — со строчной буквы и с
 * точкой, то есть не тот формат, что в спеке (3.13), и вдобавок результат
 * меняется от версии ICU, что делает тест хрупким на чужой машине и в CI.
 */
const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const
const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
] as const

export type DueDateStatus = 'none' | 'invalid' | 'overdue' | 'today' | 'upcoming'

export interface DueDateInfo {
  status: DueDateStatus
  /**
   * Готовая подпись чипа. Пустая для `none` и `invalid`: спека не задаёт для
   * них текста, эти два состояния оформляет сам `DueDateChip`.
   */
  label: string
  /** Дней просрочки. Больше нуля только при `status === 'overdue'`. */
  overdueDays: number
}

/** Локальная дата в виде `YYYY-MM-DD`. Единственная точка чтения часов. */
export function toDateKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Строка не просто подходит под шаблон, но и обозначает существующий день. */
export function isValidDateKey(value: string): boolean {
  return parseDateKey(value) !== null
}

/**
 * Разница в днях: положительная, если `key` позже `fromKey`.
 *
 * Считается в UTC, поэтому перевод часов внутри интервала не сдвигает результат.
 *
 * @returns `null`, если хотя бы одна из дат не разобралась
 */
export function daysBetween(fromKey: string, key: string): number | null {
  const from = toUtcDate(fromKey)
  const to = toUtcDate(key)
  if (from === null || to === null) return null
  return Math.round((to - from) / MILLISECONDS_PER_DAY)
}

export function isDueToday(dueDate: string | null, todayKey: string): boolean {
  return dueDate !== null && isValidDateKey(dueDate) && dueDate === todayKey
}

export function isOverdue(dueDate: string | null, todayKey: string): boolean {
  const days = dueDate === null ? null : daysBetween(todayKey, dueDate)
  return days !== null && days < 0
}

/**
 * Состояние и подпись чипа срока одним вызовом: `DueDateChip` нужны оба, и
 * расходиться они не должны.
 *
 * Форматы — из спеки, 3.13: `Сегодня` · `Завтра` · `Пт, 24 окт` ·
 * `12 янв 2027` (другой год) · `Просрочено на 2 дня`.
 */
export function describeDueDate(dueDate: string | null, todayKey: string): DueDateInfo {
  if (dueDate === null) return { status: 'none', label: '', overdueDays: 0 }

  const parts = parseDateKey(dueDate)
  const offset = daysBetween(todayKey, dueDate)
  if (parts === null || offset === null) return { status: 'invalid', label: '', overdueDays: 0 }

  if (offset < 0) {
    const overdueDays = -offset
    return {
      status: 'overdue',
      label: `Просрочено на ${String(overdueDays)} ${pluralizeDays(overdueDays)}`,
      overdueDays,
    }
  }
  if (offset === 0) return { status: 'today', label: 'Сегодня', overdueDays: 0 }
  if (offset === 1) return { status: 'upcoming', label: 'Завтра', overdueDays: 0 }

  return { status: 'upcoming', label: formatCalendarDate(parts, todayKey), overdueDays: 0 }
}

interface DateParts {
  year: number
  month: number
  day: number
}

function parseDateKey(value: string): DateParts | null {
  if (!DATE_KEY_PATTERN.test(value)) return null

  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  // 31 апреля и 29 февраля невисокосного года проходят проверку выше, но не существуют.
  const utc = Date.UTC(year, month - 1, day)
  const roundTrip = new Date(utc)
  if (roundTrip.getUTCFullYear() !== year) return null
  if (roundTrip.getUTCMonth() !== month - 1) return null
  if (roundTrip.getUTCDate() !== day) return null

  return { year, month, day }
}

function toUtcDate(value: string): number | null {
  const parts = parseDateKey(value)
  if (parts === null) return null
  return Date.UTC(parts.year, parts.month - 1, parts.day)
}

/** `Пт, 24 окт` в текущем году, `12 янв 2027` — в любом другом. */
function formatCalendarDate(parts: DateParts, todayKey: string): string {
  const month = MONTHS_SHORT[parts.month - 1] ?? ''
  const sameYear = todayKey.slice(0, 4) === String(parts.year).padStart(4, '0')

  if (!sameYear) return `${String(parts.day)} ${month} ${String(parts.year)}`

  const weekdayIndex = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  const weekday = WEEKDAYS_SHORT[weekdayIndex] ?? ''
  return `${weekday}, ${String(parts.day)} ${month}`
}

/** 1 день · 2 дня · 5 дней · 11 дней · 21 день. */
function pluralizeDays(count: number): string {
  const lastTwo = count % 100
  if (lastTwo >= 11 && lastTwo <= 14) return 'дней'

  const last = count % 10
  if (last === 1) return 'день'
  if (last >= 2 && last <= 4) return 'дня'
  return 'дней'
}
