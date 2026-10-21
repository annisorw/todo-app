import { createContext, useContext } from 'react'
import type { Task, TaskDraft, TaskPatch } from '../domain/task'
import type { StorageError } from '../storage/localStorageDriver'
import type { RemovedTask } from './taskReducer'

/**
 * Единственный способ добраться до списка задач из интерфейса.
 *
 * `localStorage` здесь не упоминается и из компонентов не вызывается — вся
 * работа с хранилищем остаётся в слое `storage/` (архитектура, раздел 5).
 */
export interface TaskStoreValue {
  tasks: Task[]
  /** Последняя удалённая задача — для тоста отмены (спека, S7). */
  lastRemoved: RemovedTask | null
  storageError: StorageError | null
  /**
   * Список упёрся в `MAX_TASKS`, добавление ничего не сделает.
   *
   * Готовый признак, а не число: так лимит нигде не сравнивается руками.
   */
  isAtLimit: boolean
  addTask: (draft: TaskDraft) => void
  toggleTask: (id: string) => void
  editTask: (id: string, patch: TaskPatch) => void
  removeTask: (id: string) => void
  restoreRemoved: () => void
  moveTask: (from: number, to: number) => void
  clearCompleted: () => void
  /**
   * Человек нажал «Повторить» в `ErrorBanner` (спека, S9): записать текущий
   * список прямо сейчас, не дожидаясь debounce.
   *
   * Исход виден по `storageError`: успех его снимает, отказ оставляет. Своего
   * «просто закрыть баннер» в сторе нет нарочно — спека такой кнопки не даёт, а
   * тихое закрытие и было дефектом [FELA-64](/FELA/issues/FELA-64).
   *
   * Отказ **чтения** (`'corrupted'`) удавшаяся запись не снимает: про
   * читаемость хранилища она ничего не говорит, а снятый отказ убрал бы из
   * интерфейса единственный путь к карантинным байтам
   * ([FELA-70](/FELA/issues/FELA-70)). При таком отказе `ErrorBanner`
   * «Повторить» и не показывает.
   */
  retryPersist: () => void
}

export const TaskStoreContext = createContext<TaskStoreValue | null>(null)

export function useTaskStore(): TaskStoreValue {
  const value = useContext(TaskStoreContext)
  if (value === null) {
    throw new Error('useTaskStore must be used inside <TaskStoreProvider>.')
  }
  return value
}
