import { describe, expect, it } from 'vitest'
import { MAX_TASKS } from '../domain/limits'
import type { Task } from '../domain/task'
import { makeTask, makeTasks } from '../test/factories'
import { EMPTY_TASK_STATE, taskReducer } from './taskReducer'
import type { TaskAction, TaskState } from './taskReducer'

const NOW = new Date('2026-10-20T12:00:00.000Z')

function stateWith(tasks: Task[], overrides: Partial<TaskState> = {}): TaskState {
  return { ...EMPTY_TASK_STATE, tasks, ...overrides }
}

/** Прогоняет цепочку действий — так короче читаются сценарии отмены. */
function run(state: TaskState, ...actions: TaskAction[]): TaskState {
  return actions.reduce(taskReducer, state)
}

describe('taskReducer', () => {
  it('hydrates the list', () => {
    const tasks = makeTasks(2)

    expect(taskReducer(EMPTY_TASK_STATE, { type: 'tasks/hydrate', tasks }).tasks).toBe(tasks)
  })

  it('adds a task to the end of the list', () => {
    const next = taskReducer(stateWith(makeTasks(1)), {
      type: 'task/add',
      draft: { title: 'Новая', priority: 'high' },
      now: NOW,
    })

    expect(next.tasks).toHaveLength(2)
    expect(next.tasks[1]?.title).toBe('Новая')
    expect(next.tasks[1]?.priority).toBe('high')
    expect(next.tasks[1]?.createdAt).toBe(NOW.toISOString())
  })

  it('ignores an unusable draft and a list at the limit', () => {
    const state = stateWith(makeTasks(1))
    expect(taskReducer(state, { type: 'task/add', draft: { title: '   ' }, now: NOW })).toBe(state)

    const full = stateWith(makeTasks(MAX_TASKS))
    expect(taskReducer(full, { type: 'task/add', draft: { title: 'Новая' }, now: NOW })).toBe(full)
  })

  it('toggles a task without moving it', () => {
    const done = taskReducer(stateWith(makeTasks(3)), { type: 'task/toggle', id: 'task-2', now: NOW })

    expect(done.tasks[1]?.completedAt).toBe(NOW.toISOString())
    expect(done.tasks.map((task) => task.id)).toEqual(['task-1', 'task-2', 'task-3'])

    const active = taskReducer(done, { type: 'task/toggle', id: 'task-2', now: NOW })
    expect(active.tasks[1]?.completedAt).toBeNull()
    expect(active.tasks.map((task) => task.id)).toEqual(['task-1', 'task-2', 'task-3'])
  })

  // Спека v1.1: правка принимает патч, а не заголовок.
  it('applies a single-field patch without clearing the other two', () => {
    const state = stateWith([makeTask({ title: 'Текст', priority: 'high', dueDate: '2026-10-25' })])

    const edited = taskReducer(state, { type: 'task/edit', id: 'task-1', patch: { title: 'Другой' } })

    expect(edited.tasks[0]).toMatchObject({
      title: 'Другой',
      priority: 'high',
      dueDate: '2026-10-25',
    })
  })

  it('edits priority and due date through the same patch path', () => {
    const state = stateWith([makeTask({ priority: 'none', dueDate: '2026-10-25' })])

    const edited = taskReducer(state, {
      type: 'task/edit',
      id: 'task-1',
      patch: { priority: 'low', dueDate: null },
    })

    expect(edited.tasks[0]).toMatchObject({ title: 'Задача', priority: 'low', dueDate: null })
  })

  it('removes a task and remembers it with its index', () => {
    const next = taskReducer(stateWith(makeTasks(3)), { type: 'task/remove', id: 'task-2' })

    expect(next.tasks.map((task) => task.id)).toEqual(['task-1', 'task-3'])
    expect(next.lastRemoved).toEqual({ task: makeTask({ id: 'task-2', title: 'Задача 2' }), index: 1 })
  })

  it('ignores removal of a task that is not there', () => {
    const state = stateWith(makeTasks(2))

    expect(taskReducer(state, { type: 'task/remove', id: 'task-9' })).toBe(state)
  })

  it('moves a task between positions', () => {
    const next = taskReducer(stateWith(makeTasks(3)), { type: 'task/move', from: 0, to: 2 })

    expect(next.tasks.map((task) => task.id)).toEqual(['task-2', 'task-3', 'task-1'])
  })

  it('clears completed tasks only', () => {
    const state = run(stateWith(makeTasks(3)), { type: 'task/toggle', id: 'task-2', now: NOW })

    const next = taskReducer(state, { type: 'tasks/clearCompleted' })

    expect(next.tasks.map((task) => task.id)).toEqual(['task-1', 'task-3'])
  })

  describe('undo of a removal', () => {
    it('puts the task back at its former index', () => {
      const next = run(
        stateWith(makeTasks(3)),
        { type: 'task/remove', id: 'task-2' },
        { type: 'task/restoreRemoved' },
      )

      expect(next.tasks.map((task) => task.id)).toEqual(['task-1', 'task-2', 'task-3'])
      expect(next.lastRemoved).toBeNull()
    })

    it('puts the last task of the list back at the tail', () => {
      const next = run(
        stateWith(makeTasks(3)),
        { type: 'task/remove', id: 'task-3' },
        { type: 'task/restoreRemoved' },
      )

      expect(next.tasks.map((task) => task.id)).toEqual(['task-1', 'task-2', 'task-3'])
    })

    it('does nothing when there is nothing to restore', () => {
      const state = stateWith(makeTasks(2))

      expect(taskReducer(state, { type: 'task/restoreRemoved' })).toBe(state)
    })

    /**
     * Список из трёх задач, где `task-1` выполнена, `task-2` удалена и ждёт
     * отмены. Выполненная задача нужна, чтобы `clearCompleted` на этом
     * состоянии действительно что-то менял, а не уходил в холостой ход.
     */
    function stateAwaitingUndo(): TaskState {
      return run(
        stateWith(makeTasks(3)),
        { type: 'task/toggle', id: 'task-1', now: NOW },
        { type: 'task/remove', id: 'task-2' },
      )
    }

    const listChanges: [string, TaskAction][] = [
      ['task/add', { type: 'task/add', draft: { title: 'Новая' }, now: NOW }],
      ['task/toggle', { type: 'task/toggle', id: 'task-1', now: NOW }],
      ['task/edit', { type: 'task/edit', id: 'task-1', patch: { title: 'Другой' } }],
      ['task/move', { type: 'task/move', from: 0, to: 1 }],
      ['tasks/clearCompleted', { type: 'tasks/clearCompleted' }],
      ['tasks/hydrate', { type: 'tasks/hydrate', tasks: makeTasks(1) }],
    ]

    it.each(listChanges)('is dropped by the next change of the list (%s)', (_name, action) => {
      const state = stateAwaitingUndo()
      expect(state.lastRemoved).not.toBeNull()

      expect(taskReducer(state, action).lastRemoved).toBeNull()
    })

    it('is replaced, not kept, by the next removal', () => {
      const state = stateAwaitingUndo()

      const next = taskReducer(state, { type: 'task/remove', id: 'task-3' })

      expect(next.lastRemoved?.task.id).toBe('task-3')
    })

    it('is kept by an action that changed nothing', () => {
      const removed = run(stateWith(makeTasks(3)), { type: 'task/remove', id: 'task-2' })

      const noop = run(
        removed,
        { type: 'task/edit', id: 'task-9', patch: { title: 'Другой' } },
        { type: 'task/move', from: 0, to: 99 },
        { type: 'task/toggle', id: 'task-9', now: NOW },
        { type: 'tasks/clearCompleted' },
        { type: 'storage/error', error: 'quota' },
      )

      expect(noop.lastRemoved).toEqual(removed.lastRemoved)
    })
  })

  describe('storage error', () => {
    it('is stored and cleared without touching the list', () => {
      const state = stateWith(makeTasks(2))

      const failed = taskReducer(state, { type: 'storage/error', error: 'quota' })
      expect(failed.storageError).toBe('quota')
      expect(failed.tasks).toBe(state.tasks)

      expect(taskReducer(failed, { type: 'storage/error', error: null }).storageError).toBeNull()
    })

    it('does not rebuild the state when the error repeats', () => {
      const failed = taskReducer(EMPTY_TASK_STATE, { type: 'storage/error', error: 'blocked' })

      expect(taskReducer(failed, { type: 'storage/error', error: 'blocked' })).toBe(failed)
    })
  })
})
