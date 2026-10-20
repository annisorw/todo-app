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
  /** Человек закрыл `ErrorBanner` (спека, S9). */
  dismissStorageError: () => void
}

export const TaskStoreContext = createContext<TaskStoreValue | null>(null)

export function useTaskStore(): TaskStoreValue {
  const value = useContext(TaskStoreContext)
  if (value === null) {
    throw new Error('useTaskStore must be used inside <TaskStoreProvider>.')
  }
  return value
}
