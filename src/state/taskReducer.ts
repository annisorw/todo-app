/**
 * Чистый reducer списка задач (архитектура, раздел 4).
 *
 * Своей копии логики списка здесь нет: каждое действие — вызов операции из
 * `domain/taskList.ts`. Reducer отвечает ровно за три вещи, которых домен не
 * знает: когда сбросить `lastRemoved`, что считать «ничего не изменилось» и
 * какую ошибку хранилища показывать.
 *
 * Отступления от списка действий в разделе 4 архитектуры, оба обсуждаются в
 * [FELA-11](/FELA/issues/FELA-11):
 *
 * 1. `task/add` и `task/toggle` несут `now: Date`. Операции домена принимают
 *    время аргументом, а reducer обязан остаться чистым, значит часы читаются
 *    на границе — в `TaskStoreProvider`. Наружу это не торчит: `useTaskStore`
 *    отдаёт `addTask(draft)` без времени.
 * 2. Добавлено действие `storage/error`. `storageError` лежит в состоянии по
 *    разделу 4, но ставить его было нечем: чтение и запись сообщают об отказе
 *    уже после гидратации.
 */

import type { Task, TaskDraft, TaskPatch } from '../domain/task'
import {
  addTask,
  clearCompleted,
  moveTask,
  removeTask,
  restoreTask,
  toggleTask,
  updateTask,
} from '../domain/taskList'
import type { StorageError } from '../storage/localStorageDriver'

export interface RemovedTask {
  task: Task
  index: number
}

export interface TaskState {
  tasks: Task[]
  /** Последняя удалённая задача и её прежний индекс; живёт до следующего изменения списка. */
  lastRemoved: RemovedTask | null
  storageError: StorageError | null
}

export type TaskAction =
  /**
   * Подставляет список, пришедший извне стора.
   *
   * Сегодня его никто не отправляет, и это нарочно: старт читает хранилище
   * аргументом `useReducer`, синхронно, до первого рендера. Отправленная
   * `tasks/hydrate` считается обычным изменением списка — `useDebouncedPersist`
   * её запишет, — поэтому для старта она не годится: прочитанное тут же
   * поехало бы обратно в хранилище.
   *
   * Остаётся в наборе: она в разделе 4 архитектуры, и загрузка списка со
   * стороны (разбор файла из «Выгрузить в файл», [FELA-18](/FELA/issues/FELA-18))
   * обязана идти через reducer, иначе отмена удаления не погаснет.
   */
  | { type: 'tasks/hydrate'; tasks: Task[] }
  | { type: 'task/add'; draft: TaskDraft; now: Date }
  | { type: 'task/toggle'; id: string; now: Date }
  | { type: 'task/edit'; id: string; patch: TaskPatch }
  | { type: 'task/remove'; id: string }
  | { type: 'task/restoreRemoved' }
  | { type: 'task/move'; from: number; to: number }
  | { type: 'tasks/clearCompleted' }
  | { type: 'storage/error'; error: StorageError | null }

export const EMPTY_TASK_STATE: TaskState = {
  tasks: [],
  lastRemoved: null,
  storageError: null,
}

/**
 * Подставляет новый список и гасит `lastRemoved` — отмена удаления живёт до
 * первого следующего изменения списка (спека, раздел S7).
 *
 * Операция домена, которая ничего не изменила, возвращает **тот же** массив по
 * ссылке. Значит, холостое действие (задача не найдена, патч ничего не меняет,
 * список на лимите) не считается изменением и отмену не отбирает.
 */
function withTasks(state: TaskState, tasks: Task[]): TaskState {
  if (tasks === state.tasks) return state
  return { ...state, tasks, lastRemoved: null }
}

export function taskReducer(state: TaskState, action: TaskAction): TaskState {
  switch (action.type) {
    case 'tasks/hydrate':
      return withTasks(state, action.tasks)

    case 'task/add':
      return withTasks(state, addTask(state.tasks, action.draft, action.now))

    case 'task/toggle':
      return withTasks(state, toggleTask(state.tasks, action.id, action.now))

    case 'task/edit':
      return withTasks(state, updateTask(state.tasks, action.id, action.patch))

    case 'task/remove': {
      const index = state.tasks.findIndex((task) => task.id === action.id)
      const task = state.tasks[index]
      if (task === undefined) return state

      return {
        ...state,
        tasks: removeTask(state.tasks, action.id),
        lastRemoved: { task, index },
      }
    }

    case 'task/restoreRemoved': {
      const removed = state.lastRemoved
      if (removed === null) return state

      return {
        ...state,
        tasks: restoreTask(state.tasks, removed.task, removed.index),
        lastRemoved: null,
      }
    }

    case 'task/move':
      return withTasks(state, moveTask(state.tasks, action.from, action.to))

    case 'tasks/clearCompleted':
      return withTasks(state, clearCompleted(state.tasks))

    // Ошибка хранилища списка не меняет, поэтому отмену удаления не трогает.
    case 'storage/error':
      return state.storageError === action.error ? state : { ...state, storageError: action.error }
  }
}
