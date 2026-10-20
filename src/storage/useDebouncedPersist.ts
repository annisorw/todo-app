import { useCallback, useEffect, useRef } from 'react'
import type { Task } from '../domain/task'
import type { StorageError } from './localStorageDriver'
import { writeTasks } from './taskStorage'

/** Пауза перед записью (архитектура, раздел 5). */
export const PERSIST_DEBOUNCE_MS = 250

/**
 * Пишет список в хранилище с задержкой: быстрая череда правок — одна запись.
 *
 * На размонтировании незаписанное сбрасывается в хранилище сразу, без ожидания
 * таймера, иначе последняя правка перед закрытием вкладки терялась бы.
 *
 * Первый проход тоже пишет — через 250 мс после загрузки список уезжает в
 * хранилище уже проверенным. Это сделано нарочно: так подделанный кем-то
 * payload заменяется разобранным и очищенным, а не остаётся лежать.
 *
 * `onError` вызывается **только при отказе записи**. Успех молчит нарочно: иначе
 * удачная запись через 250 мс после загрузки погасила бы баннер `'corrupted'`,
 * который человек ещё не успел прочитать.
 */
export function useDebouncedPersist(tasks: Task[], onError: (error: StorageError) => void): void {
  /** Список, который ещё не доехал до хранилища. `null` — писать нечего. */
  const pending = useRef<Task[] | null>(null)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const flush = useCallback(() => {
    const tasksToWrite = pending.current
    if (tasksToWrite === null) return

    pending.current = null
    const error = writeTasks(tasksToWrite)
    if (error !== null) onErrorRef.current(error)
  }, [])

  useEffect(() => {
    pending.current = tasks
    const timerId = window.setTimeout(flush, PERSIST_DEBOUNCE_MS)
    // Следующее изменение списка снимает прошлый таймер — это и есть debounce.
    return () => {
      window.clearTimeout(timerId)
    }
  }, [tasks, flush])

  // Отдельный эффект без зависимостей: его очистка срабатывает только на
  // размонтировании, и к этому моменту таймер выше уже снят.
  useEffect(() => flush, [flush])
}
