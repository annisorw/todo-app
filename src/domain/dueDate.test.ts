import { describe, expect, it } from 'vitest'

import {
  daysBetween,
  describeDueDate,
  isDueToday,
  isOverdue,
  isValidDateKey,
  isValidDueDate,
  toDateKey,
} from './dueDate'

/** Вторник, 20 октября 2026. Все тесты считают «сегодня» от него. */
const TODAY = '2026-10-20'

describe('toDateKey', () => {
  it('берёт локальную дату, а не UTC', () => {
    // Полночь по местному времени: в UTC это может быть ещё вчера, но ключ
    // обязан остаться тем днём, который человек видит в календаре.
    expect(toDateKey(new Date(2026, 9, 20, 0, 0, 0))).toBe('2026-10-20')
    expect(toDateKey(new Date(2026, 9, 20, 23, 59, 59))).toBe('2026-10-20')
  })

  it('дополняет месяц и день нулями', () => {
    expect(toDateKey(new Date(2027, 0, 5))).toBe('2027-01-05')
  })
})

describe('isValidDateKey', () => {
  it('принимает настоящую дату', () => {
    expect(isValidDateKey('2026-10-20')).toBe(true)
    expect(isValidDateKey('2028-02-29')).toBe(true)
  })

  it('отклоняет несуществующие дни и мусор', () => {
    expect(isValidDateKey('2026-02-30')).toBe(false)
    expect(isValidDateKey('2026-13-01')).toBe(false)
    expect(isValidDateKey('2026-00-10')).toBe(false)
    expect(isValidDateKey('2027-02-29')).toBe(false)
    expect(isValidDateKey('20.10.2026')).toBe(false)
    expect(isValidDateKey('')).toBe(false)
  })
})

describe('isValidDueDate', () => {
  it('считает годным отсутствие срока', () => {
    expect(isValidDueDate(null)).toBe(true)
    expect(isValidDueDate(undefined)).toBe(true)
  })

  it('пропускает настоящую дату и отклоняет несуществующую', () => {
    expect(isValidDueDate('2026-10-20')).toBe(true)
    expect(isValidDueDate('2026-02-30')).toBe(false)
    expect(isValidDueDate('not-a-date')).toBe(false)
  })
})

describe('daysBetween', () => {
  it('считает разницу в днях через конец месяца и года', () => {
    expect(daysBetween(TODAY, '2026-10-21')).toBe(1)
    expect(daysBetween(TODAY, '2026-11-01')).toBe(12)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('отрицательна, когда дата в прошлом', () => {
    expect(daysBetween(TODAY, '2026-10-18')).toBe(-2)
  })

  it('не сдвигается на переводе часов', () => {
    // Весенний переход в Европе: 29 марта 2026. Сутки в этом интервале короче,
    // но счёт идёт в UTC, поэтому разница ровно два дня.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('возвращает null на неразобранной дате', () => {
    expect(daysBetween(TODAY, 'вчера')).toBeNull()
    expect(daysBetween('никогда', TODAY)).toBeNull()
  })
})

describe('isDueToday', () => {
  it('верна только для сегодняшнего дня', () => {
    expect(isDueToday(TODAY, TODAY)).toBe(true)
    expect(isDueToday('2026-10-21', TODAY)).toBe(false)
    expect(isDueToday('2026-10-19', TODAY)).toBe(false)
  })

  it('без срока и на мусоре — false', () => {
    expect(isDueToday(null, TODAY)).toBe(false)
    expect(isDueToday('не дата', TODAY)).toBe(false)
  })
})

describe('isOverdue', () => {
  it('верна строго для прошедших дат', () => {
    expect(isOverdue('2026-10-19', TODAY)).toBe(true)
    expect(isOverdue(TODAY, TODAY)).toBe(false)
    expect(isOverdue('2026-10-21', TODAY)).toBe(false)
  })

  it('без срока и на мусоре — false', () => {
    expect(isOverdue(null, TODAY)).toBe(false)
    expect(isOverdue('не дата', TODAY)).toBe(false)
  })
})

describe('describeDueDate', () => {
  it('сегодня', () => {
    expect(describeDueDate(TODAY, TODAY)).toEqual({
      status: 'today',
      label: 'Сегодня',
      overdueDays: 0,
    })
  })

  it('завтра', () => {
    expect(describeDueDate('2026-10-21', TODAY)).toEqual({
      status: 'upcoming',
      label: 'Завтра',
      overdueDays: 0,
    })
  })

  it('эта неделя — день недели, число и месяц', () => {
    // Формат «Пт, 24 окт» из спеки (3.13); в 2026 году 24 октября — суббота.
    expect(describeDueDate('2026-10-23', TODAY).label).toBe('Пт, 23 окт')
    expect(describeDueDate('2026-10-24', TODAY).label).toBe('Сб, 24 окт')
  })

  it('дальняя дата того же года — тоже с днём недели', () => {
    // 7 декабря 2026 — понедельник.
    expect(describeDueDate('2026-12-07', TODAY).label).toBe('Пн, 7 дек')
  })

  it('другой год — число, месяц и год, без дня недели', () => {
    expect(describeDueDate('2027-01-12', TODAY)).toEqual({
      status: 'upcoming',
      label: '12 янв 2027',
      overdueDays: 0,
    })
  })

  it('просрочка на один день', () => {
    expect(describeDueDate('2026-10-19', TODAY)).toEqual({
      status: 'overdue',
      label: 'Просрочено на 1 день',
      overdueDays: 1,
    })
  })

  it('просрочка на два дня', () => {
    expect(describeDueDate('2026-10-18', TODAY)).toEqual({
      status: 'overdue',
      label: 'Просрочено на 2 дня',
      overdueDays: 2,
    })
  })

  it('склоняет «дней» на пяти, одиннадцати и двадцати одном', () => {
    expect(describeDueDate('2026-10-15', TODAY).label).toBe('Просрочено на 5 дней')
    expect(describeDueDate('2026-10-09', TODAY).label).toBe('Просрочено на 11 дней')
    expect(describeDueDate('2026-09-29', TODAY).label).toBe('Просрочено на 21 день')
  })

  it('без срока — состояние none и пустая подпись', () => {
    expect(describeDueDate(null, TODAY)).toEqual({ status: 'none', label: '', overdueDays: 0 })
  })

  it('неразобранная дата — состояние invalid, а не выдуманная подпись', () => {
    expect(describeDueDate('2026-02-30', TODAY).status).toBe('invalid')
    expect(describeDueDate('позавчера', TODAY).status).toBe('invalid')
  })

  it('совпадает с предикатами на тех же данных', () => {
    for (const dueDate of ['2026-10-18', TODAY, '2026-10-21', '2027-01-12']) {
      const info = describeDueDate(dueDate, TODAY)

      expect(info.status === 'overdue').toBe(isOverdue(dueDate, TODAY))
      expect(info.status === 'today').toBe(isDueToday(dueDate, TODAY))
    }
  })
})
