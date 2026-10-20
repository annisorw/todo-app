/**
 * Единственное место в приложении, где трогают `window.localStorage`.
 *
 * Драйвер **не бросает исключений**: он возвращает результат, а решение «что
 * показать человеку» принимает слой выше (архитектура, раздел 5). Пустого
 * `catch {}` здесь нет ни в одной ветке — каждая ошибка классифицируется и в
 * dev-сборке попадает в консоль (*fail loud in development, fail safe in
 * production*).
 *
 * Обращение к самому `window.localStorage` тоже внутри `try`: в приватном
 * режиме и на заблокированном origin бросает уже чтение свойства, а не только
 * `setItem`.
 */

/**
 * `'blocked'` — к хранилищу нет доступа, `'quota'` — место кончилось,
 * `'corrupted'` — прочитанное не разбирается. Последнюю ставит разборщик в
 * `taskStorage.ts`: драйвер работает со строками и про их смысл не знает.
 */
export type StorageError = 'blocked' | 'quota' | 'corrupted'

export type StorageResult<T> = { ok: true; value: T } | { ok: false; error: StorageError }

/**
 * Имя у переполнения квоты разное в разных браузерах, а Firefox прошлых лет
 * бросает `NS_ERROR_DOM_QUOTA_REACHED`. Код 22 — то же самое из времён, когда
 * у `DOMException` не было имён.
 */
const QUOTA_ERROR_NAMES: readonly string[] = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']
const QUOTA_ERROR_CODE = 22

function isQuotaError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return QUOTA_ERROR_NAMES.includes(error.name) || error.code === QUOTA_ERROR_CODE
  }
  return error instanceof Error && QUOTA_ERROR_NAMES.includes(error.name)
}

/** Всё, что не переполнение квоты, — отказ в доступе. */
function classify(error: unknown): StorageError {
  return isQuotaError(error) ? 'quota' : 'blocked'
}

function report(operation: string, key: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.warn(`localStorage: ${operation} failed for key "${key}".`, error)
  }
}

/** `{ ok: true, value: null }` — ключа нет; это норма первого запуска, не ошибка. */
export function readRaw(key: string): StorageResult<string | null> {
  try {
    return { ok: true, value: window.localStorage.getItem(key) }
  } catch (error) {
    report('read', key, error)
    return { ok: false, error: classify(error) }
  }
}

/**
 * Запись возвращает только ошибку: отдавать в случае успеха нечего.
 *
 * @returns `null`, если записалось
 */
export function writeRaw(key: string, value: string): StorageError | null {
  try {
    window.localStorage.setItem(key, value)
    return null
  } catch (error) {
    report('write', key, error)
    return classify(error)
  }
}

export function removeRaw(key: string): StorageError | null {
  try {
    window.localStorage.removeItem(key)
    return null
  } catch (error) {
    report('remove', key, error)
    return classify(error)
  }
}
