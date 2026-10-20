import { vi } from 'vitest'
import type { Task } from '../domain/task'
import { TASKS_SCHEMA_VERSION, TASKS_STORAGE_KEY } from '../storage/taskStorage'

/**
 * Подмена `localStorage` на время теста.
 *
 * `accessError` имитирует приватный режим и заблокированный origin: там бросает
 * уже обращение к свойству `window.localStorage`, а не только `setItem`.
 * Поэтому свойство подменяется через `defineProperty`, а не присваиванием.
 *
 * Данные во всех тестах синтетические (`docs/CODE-RULES.md`, раздел 4).
 */
export interface StorageStubOptions {
  /** Что уже лежит в хранилище до запуска кода. */
  items?: Record<string, string>
  /** Бросать это при чтении ключа. */
  readError?: unknown
  /** Бросать это при записи. */
  writeError?: unknown
  /** Бросать это при самом обращении к `localStorage`. */
  accessError?: unknown
}

export interface StorageStub {
  /** Содержимое хранилища: тест читает и правит напрямую. */
  items: Map<string, string>
  getItem: ReturnType<typeof vi.fn>
  setItem: ReturnType<typeof vi.fn>
  removeItem: ReturnType<typeof vi.fn>
  restore: () => void
}

export function quotaError(): DOMException {
  return new DOMException('The quota has been exceeded.', 'QuotaExceededError')
}

export function blockedError(): DOMException {
  return new DOMException('Access to storage is denied.', 'SecurityError')
}

export function stubLocalStorage(options: StorageStubOptions = {}): StorageStub {
  const items = new Map(Object.entries(options.items ?? {}))

  const getItem = vi.fn((key: string): string | null => {
    if (options.readError !== undefined) throw options.readError
    return items.get(key) ?? null
  })

  const setItem = vi.fn((key: string, value: string): void => {
    if (options.writeError !== undefined) throw options.writeError
    items.set(key, value)
  })

  const removeItem = vi.fn((key: string): void => {
    items.delete(key)
  })

  const storage = {
    getItem,
    setItem,
    removeItem,
    clear: () => {
      items.clear()
    },
    key: (index: number): string | null => [...items.keys()][index] ?? null,
    get length(): number {
      return items.size
    },
  }

  const original = Object.getOwnPropertyDescriptor(window, 'localStorage')

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get:
      options.accessError === undefined
        ? () => storage
        : () => {
            throw options.accessError
          },
  })

  return {
    items,
    getItem,
    setItem,
    removeItem,
    restore: () => {
      if (original === undefined) {
        Reflect.deleteProperty(window, 'localStorage')
        return
      }
      Object.defineProperty(window, 'localStorage', original)
    },
  }
}

/** Готовый конверт нашего формата — чтобы тесты не собирали JSON руками. */
export function storedPayload(tasks: Task[]): string {
  return JSON.stringify({ version: TASKS_SCHEMA_VERSION, tasks })
}

/** Сырое содержимое ключа задач: так тест подкладывает любую строку, даже битую. */
export function storedItems(raw: string): Record<string, string> {
  return { [TASKS_STORAGE_KEY]: raw }
}
