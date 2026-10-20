import { describe, expect, it } from 'vitest'

import { MAX_QUERY_LENGTH } from './limits'
import { matchesQuery, normalizeQuery, partitionTasks, selectTaskView } from './filters'
import { makeTask } from '../test/factories'
import type { Task } from './task'

/** Два активных, два выполненных; выполненные лежат вперемешку с активными. */
function mixedList(): Task[] {
  return [
    makeTask({ id: 'a', title: 'Купить молоко' }),
    makeTask({ id: 'b', title: 'Сдать отчёт', completedAt: '2026-10-20T08:00:00.000Z' }),
    makeTask({ id: 'c', title: 'Купить хлеб' }),
    makeTask({ id: 'd', title: 'Позвонить в банк', completedAt: '2026-10-20T11:00:00.000Z' }),
  ]
}

describe('normalizeQuery', () => {
  it('обрезает края и приводит к нижнему регистру', () => {
    expect(normalizeQuery('  МоЛоКо  ')).toBe('молоко')
  })

  it('режет запрос по MAX_QUERY_LENGTH', () => {
    expect(normalizeQuery('я'.repeat(MAX_QUERY_LENGTH + 50))).toHaveLength(MAX_QUERY_LENGTH)
  })

  it('пустой запрос и запрос из пробелов дают пустую строку', () => {
    expect(normalizeQuery('')).toBe('')
    expect(normalizeQuery('   ')).toBe('')
  })
})

describe('matchesQuery', () => {
  it('ищет подстроку без учёта регистра', () => {
    const task = makeTask({ title: 'Купить Молоко' })

    expect(matchesQuery(task, normalizeQuery('молок'))).toBe(true)
    expect(matchesQuery(task, normalizeQuery('МОЛОК'))).toBe(true)
    expect(matchesQuery(task, normalizeQuery('кефир'))).toBe(false)
  })

  it('пустой запрос совпадает со всем', () => {
    expect(matchesQuery(makeTask(), '')).toBe(true)
  })

  it('метасимволы regex ищутся как обычные символы', () => {
    // Если бы запрос попал в RegExp, `+b(` был бы сломанным паттерном.
    const task = makeTask({ title: 'формула a+b(c' })

    expect(matchesQuery(task, normalizeQuery('+b('))).toBe(true)
    expect(matchesQuery(task, normalizeQuery('.*'))).toBe(false)
    expect(matchesQuery(makeTask({ title: 'цена 10$' }), normalizeQuery('10$'))).toBe(true)
  })

  it('не падает и не зависает на патологическом запросе', () => {
    const task = makeTask({ title: 'a'.repeat(200) })

    expect(matchesQuery(task, normalizeQuery('(a+)+$'))).toBe(false)
  })
})

describe('partitionTasks', () => {
  it('активные сохраняют ручной порядок', () => {
    expect(partitionTasks(mixedList()).active.map((task) => task.id)).toEqual(['a', 'c'])
  })

  it('выполненные идут по completedAt, новые сверху', () => {
    expect(partitionTasks(mixedList()).completed.map((task) => task.id)).toEqual(['d', 'b'])
  })

  it('при равных метках выполнения порядок в массиве сохраняется', () => {
    const sameTime = '2026-10-20T08:00:00.000Z'
    const tasks = [
      makeTask({ id: 'first', completedAt: sameTime }),
      makeTask({ id: 'second', completedAt: sameTime }),
    ]

    expect(partitionTasks(tasks).completed.map((task) => task.id)).toEqual(['first', 'second'])
  })

  it('не мутирует исходный массив', () => {
    const tasks = mixedList()
    const before = tasks.map((task) => task.id)

    partitionTasks(tasks)

    expect(tasks.map((task) => task.id)).toEqual(before)
  })
})

describe('selectTaskView', () => {
  it('фильтр all показывает обе секции', () => {
    const view = selectTaskView(mixedList(), { filter: 'all' })

    expect(view.active.map((task) => task.id)).toEqual(['a', 'c'])
    expect(view.completed.map((task) => task.id)).toEqual(['d', 'b'])
  })

  it('фильтр active прячет выполненные', () => {
    const view = selectTaskView(mixedList(), { filter: 'active' })

    expect(view.active.map((task) => task.id)).toEqual(['a', 'c'])
    expect(view.completed).toEqual([])
  })

  it('фильтр completed прячет активные', () => {
    const view = selectTaskView(mixedList(), { filter: 'completed' })

    expect(view.active).toEqual([])
    expect(view.completed.map((task) => task.id)).toEqual(['d', 'b'])
  })

  it('счётчики без поиска считают весь список', () => {
    expect(selectTaskView(mixedList(), { filter: 'active' }).counts)
      .toEqual({ all: 4, active: 2, completed: 2 })
  })

  it('поиск работает внутри текущего фильтра', () => {
    const view = selectTaskView(mixedList(), { filter: 'active', query: 'купить' })

    expect(view.active.map((task) => task.id)).toEqual(['a', 'c'])
    expect(view.completed).toEqual([])
  })

  it('счётчики совпадают с фактическим числом найденного (критерий приёмки 8)', () => {
    const tasks = mixedList()

    // «о» есть в «молоко», «отчёт» и «Позвонить», но не в «Купить хлеб».
    const view = selectTaskView(tasks, { filter: 'active', query: 'о' })
    const everywhere = selectTaskView(tasks, { filter: 'all', query: 'о' })

    expect(view.counts).toEqual({ all: 3, active: 1, completed: 2 })
    expect(view.counts.all).toBe(everywhere.active.length + everywhere.completed.length)
  })

  it('счётчик сегмента равен длине его списка при том же запросе', () => {
    const tasks = mixedList()
    const query = 'банк'

    const view = selectTaskView(tasks, { filter: 'all', query })

    expect(view.counts.active).toBe(view.active.length)
    expect(view.counts.completed).toBe(view.completed.length)
    expect(view.counts.all).toBe(view.active.length + view.completed.length)
  })

  it('пустой результат поиска обнуляет счётчики, а не прячет их', () => {
    const view = selectTaskView(mixedList(), { filter: 'all', query: 'ничего подобного' })

    expect(view.active).toEqual([])
    expect(view.completed).toEqual([])
    expect(view.counts).toEqual({ all: 0, active: 0, completed: 0 })
  })

  it('счётчик all больше нуля при пустом сегменте — это и есть повод для «Искать во всех»', () => {
    const view = selectTaskView(mixedList(), { filter: 'active', query: 'банк' })

    expect(view.active).toEqual([])
    expect(view.counts.all).toBe(1)
  })

  it('пустой список даёт нулевые счётчики', () => {
    expect(selectTaskView([], { filter: 'all' }).counts)
      .toEqual({ all: 0, active: 0, completed: 0 })
  })

  it('не мутирует исходный массив', () => {
    const tasks = mixedList()
    const before = tasks.map((task) => task.id)

    selectTaskView(tasks, { filter: 'all', query: 'купить' })

    expect(tasks.map((task) => task.id)).toEqual(before)
  })
})
