import { useCallback, useEffect, useRef } from 'react'
import type { Task } from '../domain/task'
import type { StorageError } from './localStorageDriver'
import { writeTasks } from './taskStorage'

/** Пауза перед записью (архитектура, раздел 5). */
export const PERSIST_DEBOUNCE_MS = 250

/**
 * Запись текущего списка прямо сейчас, в обход задержки.
 *
 * @returns `null`, если записалось, иначе код отказа.
 */
export type PersistNow = () => StorageError | null

/**
 * Пишет список в хранилище с задержкой: быстрая череда правок — одна запись.
 *
 * На размонтировании незаписанное сбрасывается в хранилище сразу, без ожидания
 * таймера, иначе последняя правка перед закрытием вкладки терялась бы.
 *
 * Первый проход тоже пишет — через 250 мс после загрузки список уезжает в
 * хранилище уже проверенным. Это сделано нарочно: так подделанный кем-то
 * payload заменяется разобранным и очищенным, а не остаётся лежать. Нечитаемое
 * значение эта запись не уничтожает: `readTasks` копирует его в
 * `CORRUPTED_BACKUP_KEY` раньше, при гидратации.
 *
 * `onError` вызывается **только при отказе записи**. Успех молчит нарочно: иначе
 * удачная запись через 250 мс после загрузки погасила бы баннер `'corrupted'`,
 * который человек ещё не успел прочитать.
 *
 * @returns `persistNow` — принудительная запись в обход задержки.
 */
export function useDebouncedPersist(
  tasks: Task[],
  onError: (error: StorageError) => void,
): PersistNow {
  /** Список, который ещё не доехал до хранилища. `null` — писать нечего. */
  const pending = useRef<Task[] | null>(null)
  /**
   * Последний известный список.
   *
   * Отдельно от `pending`, потому что тот обнуляется после записи, а
   * `persistNow` обязана писать и тогда, когда debounce уже отработал.
   */
  const latest = useRef(tasks)
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

  /**
   * Пишет список немедленно и **отдаёт результат вызывающему**, не трогая
   * `onError`.
   *
   * Так сделано ради кнопки «Повторить» ([FELA-64](/FELA/issues/FELA-64)): ей
   * нужен и успех тоже, чтобы погасить баннер, а `onError` по контракту выше
   * про успех молчит. Запись снимает `pending`, поэтому уже заведённый таймер
   * debounce тех же байт второй раз не пишет.
   */
  const persistNow = useCallback<PersistNow>(() => {
    pending.current = null
    return writeTasks(latest.current)
  }, [])

  useEffect(() => {
    pending.current = tasks
    latest.current = tasks
    const timerId = window.setTimeout(flush, PERSIST_DEBOUNCE_MS)
    // Следующее изменение списка снимает прошлый таймер — это и есть debounce.
    return () => {
      window.clearTimeout(timerId)
    }
  }, [tasks, flush])

  // Отдельный эффект без зависимостей: его очистка срабатывает только на
  // размонтировании, и к этому моменту таймер выше уже снят.
  useEffect(() => flush, [flush])

  return persistNow
}
