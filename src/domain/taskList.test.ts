import { describe, expect, it } from 'vitest'

import { MAX_TASKS, MAX_TITLE_LENGTH } from './limits'
import {
  addTask,
  clearCompleted,
  isAtTaskLimit,
  moveTask,
  removeTask,
  restoreTask,
  toggleTask,
  updateTask,
} from './taskList'
import { makeTask, makeTasks } from '../test/factories'
import type { Task } from './task'

const NOW = new Date('2026-10-20T12:30:00.000Z')

/** Снимок списка, чтобы доказать, что исходный массив не мутировали. */
function snapshot(tasks: Task[]): string {
  return JSON.stringify(tasks)
}

describe('addTask', () => {
  it('добавляет задачу в конец, не трогая исходный массив', () => {
    const tasks = makeTasks(2)
    const before = snapshot(tasks)

    const next = addTask(tasks, { title: 'Третья' }, NOW)

    expect(next).toHaveLength(3)
    expect(next[2]?.title).toBe('Третья')
    expect(next[0]).toBe(tasks[0])
    expect(snapshot(tasks)).toBe(before)
  })

  it('возвращает прежний список на невалидном черновике', () => {
    const tasks = makeTasks(1)

    expect(addTask(tasks, { title: '   ' }, NOW)).toBe(tasks)
    expect(addTask(tasks, { title: 'a'.repeat(MAX_TITLE_LENGTH + 1) }, NOW)).toBe(tasks)
  })

  it('не добавляет задачу сверх MAX_TASKS', () => {
    const tasks = makeTasks(MAX_TASKS)

    expect(isAtTaskLimit(tasks)).toBe(true)
    expect(addTask(tasks, { title: 'Лишняя' }, NOW)).toBe(tasks)
  })

  it('на одну задачу меньше лимита ещё добавляет', () => {
    const tasks = makeTasks(MAX_TASKS - 1)

    expect(isAtTaskLimit(tasks)).toBe(false)
    expect(addTask(tasks, { title: 'Последняя' }, NOW)).toHaveLength(MAX_TASKS)
  })
})

describe('toggleTask', () => {
  it('ставит метку выполнения из переданного времени', () => {
    const tasks = makeTasks(2)

    const next = toggleTask(tasks, 'task-2', NOW)

    expect(next[1]?.completedAt).toBe('2026-10-20T12:30:00.000Z')
    expect(tasks[1]?.completedAt).toBeNull()
  })

  it('снимает метку обратно в null', () => {
    const tasks = [makeTask({ completedAt: '2026-10-19T08:00:00.000Z' })]

    expect(toggleTask(tasks, 'task-1', NOW)[0]?.completedAt).toBeNull()
  })

  it('не меняет позицию задачи в массиве', () => {
    const tasks = makeTasks(3)

    const next = toggleTask(tasks, 'task-2', NOW)

    expect(next.map((task) => task.id)).toEqual(['task-1', 'task-2', 'task-3'])
  })

  it('снятие галочки возвращает задачу на прежнее место (критерий приёмки 7)', () => {
    const tasks = makeTasks(3)
    const order = tasks.map((task) => task.id)

    const back = toggleTask(toggleTask(tasks, 'task-2', NOW), 'task-2', NOW)

    expect(back.map((task) => task.id)).toEqual(order)
    expect(back[1]?.completedAt).toBeNull()
  })

  it('возвращает прежний список для неизвестного id', () => {
    const tasks = makeTasks(1)

    expect(toggleTask(tasks, 'нет такой', NOW)).toBe(tasks)
  })
})

describe('updateTask', () => {
  const tasks = (): Task[] => [
    makeTask({ id: 'task-1', title: 'Первая' }),
    makeTask({ id: 'task-2', title: 'Вторая', priority: 'low', dueDate: '2026-10-21' }),
  ]

  it('меняет только текст', () => {
    const list = tasks()

    const next = updateTask(list, 'task-2', { title: '  Переписанная  ' })

    expect(next[1]?.title).toBe('Переписанная')
    expect(next[1]?.priority).toBe('low')
    expect(next[1]?.dueDate).toBe('2026-10-21')
  })

  it('меняет только приоритет', () => {
    const next = updateTask(tasks(), 'task-2', { priority: 'high' })

    expect(next[1]?.priority).toBe('high')
    expect(next[1]?.title).toBe('Вторая')
    expect(next[1]?.dueDate).toBe('2026-10-21')
  })

  it('меняет только срок, включая снятие срока через null', () => {
    const set = updateTask(tasks(), 'task-1', { dueDate: '2026-12-31' })
    expect(set[0]?.dueDate).toBe('2026-12-31')

    const cleared = updateTask(tasks(), 'task-2', { dueDate: null })
    expect(cleared[1]?.dueDate).toBeNull()
    expect(cleared[1]?.priority).toBe('low')
  })

  it('меняет два поля одним патчем', () => {
    const next = updateTask(tasks(), 'task-2', { title: 'Обе сразу', priority: 'medium' })

    expect(next[1]?.title).toBe('Обе сразу')
    expect(next[1]?.priority).toBe('medium')
    expect(next[1]?.dueDate).toBe('2026-10-21')
  })

  it('не трогает служебные поля и позицию в массиве', () => {
    const list = tasks()

    const next = updateTask(list, 'task-1', { title: 'Новая', priority: 'high', dueDate: '2026-11-01' })

    expect(next.map((task) => task.id)).toEqual(['task-1', 'task-2'])
    expect(next[0]?.createdAt).toBe(list[0]?.createdAt)
    expect(next[0]?.completedAt).toBeNull()
  })

  it('не мутирует исходный массив и его задачи', () => {
    const list = tasks()
    const before = snapshot(list)

    updateTask(list, 'task-1', { title: 'Другая' })

    expect(snapshot(list)).toBe(before)
  })

  it('пустой текст в патче ничего не меняет — это отмена правки, а не удаление', () => {
    const list = tasks()

    expect(updateTask(list, 'task-1', { title: '' })).toBe(list)
    expect(updateTask(list, 'task-1', { title: '    ' })).toBe(list)
  })

  it('текст длиннее лимита отклоняется целиком, остальные поля патча тоже', () => {
    const list = tasks()

    const next = updateTask(list, 'task-2', {
      title: 'a'.repeat(MAX_TITLE_LENGTH + 1),
      priority: 'high',
    })

    expect(next).toBe(list)
  })

  it('пустой патч и неизвестный id возвращают прежний список', () => {
    const list = tasks()

    expect(updateTask(list, 'task-1', {})).toBe(list)
    expect(updateTask(list, 'нет такой', { priority: 'high' })).toBe(list)
  })

  it('патч с теми же значениями возвращает прежний список', () => {
    const list = tasks()

    expect(updateTask(list, 'task-2', { priority: 'low', dueDate: '2026-10-21' })).toBe(list)
  })
})

describe('removeTask', () => {
  it('убирает задачу, сохраняя порядок остальных', () => {
    const tasks = makeTasks(3)
    const before = snapshot(tasks)

    const next = removeTask(tasks, 'task-2')

    expect(next.map((task) => task.id)).toEqual(['task-1', 'task-3'])
    expect(snapshot(tasks)).toBe(before)
  })

  it('возвращает прежний список для неизвестного id', () => {
    const tasks = makeTasks(2)

    expect(removeTask(tasks, 'нет такой')).toBe(tasks)
  })
})

describe('restoreTask', () => {
  it('ставит задачу обратно на прежнюю позицию (критерий приёмки 6)', () => {
    const tasks = makeTasks(3)
    const removed = tasks[1]
    if (removed === undefined) throw new Error('фикстура сломана')

    const after = removeTask(tasks, 'task-2')
    const back = restoreTask(after, removed, 1)

    expect(back.map((task) => task.id)).toEqual(['task-1', 'task-2', 'task-3'])
  })

  it('зажимает индекс, если список успел стать короче', () => {
    const tasks = makeTasks(1)

    expect(restoreTask(tasks, makeTask({ id: 'вернули' }), 99).map((task) => task.id))
      .toEqual(['task-1', 'вернули'])
    expect(restoreTask(tasks, makeTask({ id: 'вернули' }), -5).map((task) => task.id))
      .toEqual(['вернули', 'task-1'])
  })

  it('не создаёт дубль, если задача уже в списке', () => {
    const tasks = makeTasks(2)
    const existing = tasks[0]
    if (existing === undefined) throw new Error('фикстура сломана')

    expect(restoreTask(tasks, existing, 0)).toBe(tasks)
  })
})

describe('moveTask', () => {
  it('переносит задачу в начало', () => {
    const tasks = makeTasks(3)
    const before = snapshot(tasks)

    const next = moveTask(tasks, 2, 0)

    expect(next.map((task) => task.id)).toEqual(['task-3', 'task-1', 'task-2'])
    expect(snapshot(tasks)).toBe(before)
  })

  it('переносит задачу в конец', () => {
    expect(moveTask(makeTasks(3), 0, 2).map((task) => task.id))
      .toEqual(['task-2', 'task-3', 'task-1'])
  })

  it('переносит на шаг вниз', () => {
    expect(moveTask(makeTasks(3), 0, 1).map((task) => task.id))
      .toEqual(['task-2', 'task-1', 'task-3'])
  })

  it('за границами списка ничего не делает — «дальше некуда»', () => {
    const tasks = makeTasks(3)

    expect(moveTask(tasks, 0, -1)).toBe(tasks)
    expect(moveTask(tasks, 2, 3)).toBe(tasks)
    expect(moveTask(tasks, -1, 0)).toBe(tasks)
    expect(moveTask(tasks, 3, 0)).toBe(tasks)
  })

  it('перенос на то же место и дробный индекс ничего не делают', () => {
    const tasks = makeTasks(3)

    expect(moveTask(tasks, 1, 1)).toBe(tasks)
    expect(moveTask(tasks, 0.5, 2)).toBe(tasks)
  })

  it('на пустом списке ничего не делает', () => {
    const tasks: Task[] = []

    expect(moveTask(tasks, 0, 0)).toBe(tasks)
  })
})

describe('clearCompleted', () => {
  it('оставляет только активные задачи в прежнем порядке', () => {
    const tasks = [
      makeTask({ id: 'task-1' }),
      makeTask({ id: 'task-2', completedAt: '2026-10-20T10:00:00.000Z' }),
      makeTask({ id: 'task-3' }),
    ]
    const before = snapshot(tasks)

    const next = clearCompleted(tasks)

    expect(next.map((task) => task.id)).toEqual(['task-1', 'task-3'])
    expect(snapshot(tasks)).toBe(before)
  })

  it('возвращает прежний список, когда выполненных нет', () => {
    const tasks = makeTasks(2)

    expect(clearCompleted(tasks)).toBe(tasks)
  })
})
