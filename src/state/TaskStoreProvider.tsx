import { useCallback, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { announce } from '../lib/announce'
import type { TaskDraft, TaskPatch } from '../domain/task'
import { isAtTaskLimit } from '../domain/taskList'
import type { StorageError } from '../storage/localStorageDriver'
import { isUnreadableError, readTasks } from '../storage/taskStorage'
import { useDebouncedPersist } from '../storage/useDebouncedPersist'
import { EMPTY_TASK_STATE, taskReducer } from './taskReducer'
import type { TaskState } from './taskReducer'
import { TaskStoreContext } from './useTaskStore'
import type { TaskStoreValue } from './useTaskStore'

/**
 * Гидратация читает хранилище синхронно, до первого рендера списка
 * (архитектура, раздел 5): иначе список успеет мигнуть пустым.
 *
 * Отказ хранилища сразу попадает в `storageError` — приложение продолжает
 * работать в памяти, а человек видит `ErrorBanner` и знает, что его правки не
 * сохранятся.
 */
function hydrate(): TaskState {
  const { tasks, error } = readTasks()
  return { ...EMPTY_TASK_STATE, tasks, storageError: error }
}

export function TaskStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, null, hydrate)

  const handlePersistError = useCallback((error: StorageError) => {
    dispatch({ type: 'storage/error', error })
  }, [])

  const persistNow = useDebouncedPersist(state.tasks, handlePersistError)

  // Системные часы читаются здесь, на границе: reducer и домен остаются чистыми.
  const addTask = useCallback((draft: TaskDraft) => {
    dispatch({ type: 'task/add', draft, now: new Date() })
  }, [])

  const toggleTask = useCallback((id: string) => {
    dispatch({ type: 'task/toggle', id, now: new Date() })
  }, [])

  const editTask = useCallback((id: string, patch: TaskPatch) => {
    dispatch({ type: 'task/edit', id, patch })
  }, [])

  const removeTask = useCallback((id: string) => {
    dispatch({ type: 'task/remove', id })
  }, [])

  // Centralized here, not at each caller (the undo toast's "Вернуть" today,
  // a future `Ctrl/Cmd+Z` shortcut per design-spec 6.3 tomorrow) — one
  // dispatch, one announcement, no risk of the two call sites doubling up.
  const restoreRemoved = useCallback(() => {
    if (state.lastRemoved !== null) {
      announce(`Задача восстановлена: «${state.lastRemoved.task.title}»`)
    }
    dispatch({ type: 'task/restoreRemoved' })
  }, [state.lastRemoved])

  const moveTask = useCallback((from: number, to: number) => {
    dispatch({ type: 'task/move', from, to })
  }, [])

  const clearCompleted = useCallback(() => {
    dispatch({ type: 'tasks/clearCompleted' })
  }, [])

  /**
   * Кнопка «Повторить» в `ErrorBanner` (спека, S9).
   *
   * Одно действие на оба исхода: результат записи и есть новое значение
   * `storageError`. Удалось — там `null`, и баннер гаснет существующим путём.
   * Не удалось — тот же или новый код отказа, и баннер остаётся. Прятать его
   * без попытки записи нельзя: человек прочитал «Повторить» и после исчезнувшего
   * баннера считает, что сохранилось ([FELA-64](/FELA/issues/FELA-64)).
   *
   * Исключение — отказ **чтения**: запись его не снимает и не заменяет
   * ([FELA-70](/FELA/issues/FELA-70), [FELA-92](/FELA/issues/FELA-92)). Про
   * читаемость основного ключа она ничего не говорит — ни удавшаяся, ни
   * провалившаяся. Сняв отказ, она убрала бы вместе с баннером единственную
   * кнопку к карантинным байтам; подменив его кодом записи, увела бы ту же
   * кнопку в ветку не-карантина. Поэтому решает **существующий** отказ, а не
   * исход записи. `ErrorBanner` при таком отказе «Повторить» и не рисует;
   * проверка здесь — чтобы инвариант не зависел от того, какая кнопка вызовет
   * `retryPersist` завтра.
   */
  const retryPersist = useCallback(() => {
    const error = persistNow()
    if (state.storageError !== null && isUnreadableError(state.storageError)) {
      return
    }
    dispatch({ type: 'storage/error', error })
  }, [persistNow, state.storageError])

  const value = useMemo<TaskStoreValue>(
    () => ({
      tasks: state.tasks,
      lastRemoved: state.lastRemoved,
      storageError: state.storageError,
      isAtLimit: isAtTaskLimit(state.tasks),
      addTask,
      toggleTask,
      editTask,
      removeTask,
      restoreRemoved,
      moveTask,
      clearCompleted,
      retryPersist,
    }),
    [
      state,
      addTask,
      toggleTask,
      editTask,
      removeTask,
      restoreRemoved,
      moveTask,
      clearCompleted,
      retryPersist,
    ],
  )

  return <TaskStoreContext.Provider value={value}>{children}</TaskStoreContext.Provider>
}
