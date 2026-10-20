import { describe, expect, it } from 'vitest'

import { MAX_TITLE_LENGTH } from './limits'
import { createTask, isDone, normalizeTitle } from './task'
import { makeTask } from '../test/factories'

const NOW = new Date('2026-10-20T12:30:00.000Z')

describe('isDone', () => {
  it('читает выполненность из completedAt, а не из отдельного поля', () => {
    expect(isDone(makeTask({ completedAt: null }))).toBe(false)
    expect(isDone(makeTask({ completedAt: '2026-10-20T10:00:00.000Z' }))).toBe(true)
  })
})

describe('normalizeTitle', () => {
  it('обрезает пробелы по краям и оставляет внутренние', () => {
    expect(normalizeTitle('  купить  молоко  ')).toBe('купить  молоко')
  })

  it('отклоняет пустую строку и строку из одних пробелов', () => {
    expect(normalizeTitle('')).toBeNull()
    expect(normalizeTitle('   \t\n  ')).toBeNull()
  })

  it('принимает ровно MAX_TITLE_LENGTH символов и отклоняет на один больше', () => {
    expect(normalizeTitle('a'.repeat(MAX_TITLE_LENGTH))).toHaveLength(MAX_TITLE_LENGTH)
    expect(normalizeTitle('a'.repeat(MAX_TITLE_LENGTH + 1))).toBeNull()
  })

  it('считает длину после обрезки краёв', () => {
    expect(normalizeTitle(`  ${'a'.repeat(MAX_TITLE_LENGTH)}  `)).toHaveLength(MAX_TITLE_LENGTH)
  })
})

describe('createTask', () => {
  it('заполняет служебные поля и берёт время из аргумента', () => {
    const task = createTask({ title: 'Написать тест' }, NOW)

    expect(task).not.toBeNull()
    expect(task?.title).toBe('Написать тест')
    expect(task?.createdAt).toBe('2026-10-20T12:30:00.000Z')
    expect(task?.completedAt).toBeNull()
    expect(task?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('по умолчанию приоритет none и срока нет', () => {
    const task = createTask({ title: 'Без деталей' }, NOW)

    expect(task?.priority).toBe('none')
    expect(task?.dueDate).toBeNull()
  })

  it('переносит приоритет и срок из черновика', () => {
    const task = createTask({ title: 'С деталями', priority: 'high', dueDate: '2026-10-24' }, NOW)

    expect(task?.priority).toBe('high')
    expect(task?.dueDate).toBe('2026-10-24')
  })

  it('выдаёт разные id на одинаковых черновиках', () => {
    const first = createTask({ title: 'Дубль' }, NOW)
    const second = createTask({ title: 'Дубль' }, NOW)

    expect(first?.id).not.toBe(second?.id)
  })

  it('отклоняет пустой черновик и черновик длиннее лимита', () => {
    expect(createTask({ title: '   ' }, NOW)).toBeNull()
    expect(createTask({ title: 'a'.repeat(MAX_TITLE_LENGTH + 1) }, NOW)).toBeNull()
  })

  it('отклоняет черновик с несуществующей датой и с мусором вместо даты', () => {
    // Негодный срок — негодный черновик, а не задача без срока: разборщик
    // хранилища такой `dueDate` не принимает и выбросил бы задачу целиком.
    expect(createTask({ title: 'Купить молоко', dueDate: '2026-02-30' }, NOW)).toBeNull()
    expect(createTask({ title: 'Купить молоко', dueDate: 'not-a-date' }, NOW)).toBeNull()
    expect(createTask({ title: 'Купить молоко', dueDate: '20.10.2026' }, NOW)).toBeNull()
  })

  it('принимает черновик без срока и с корректной датой', () => {
    expect(createTask({ title: 'Без срока', dueDate: null }, NOW)?.dueDate).toBeNull()
    expect(createTask({ title: 'Со сроком', dueDate: '2028-02-29' }, NOW)?.dueDate).toBe(
      '2028-02-29',
    )
  })

  it('сохраняет разметку в тексте посимвольно и ничего не вырезает', () => {
    // Экранирует React на выводе. Санитизация на входе сломала бы легальные
    // `<`, `>` и `&` в названиях задач (docs/CODE-RULES.md, раздел 1).
    const payload = '<img src=x onerror=alert(1)>'
    const task = createTask({ title: payload }, NOW)

    expect(task?.title).toBe(payload)
  })

  it('сохраняет амперсанд и кавычки как есть', () => {
    const task = createTask({ title: 'Милн & Ко — "смета"' }, NOW)

    expect(task?.title).toBe('Милн & Ко — "смета"')
  })
})
