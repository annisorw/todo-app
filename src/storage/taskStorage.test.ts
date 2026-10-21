import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addTask, toggleTask } from '../domain/taskList'
import { makeTask, makeTasks } from '../test/factories'
import { blockedError, quotaError, storedItems, storedPayload, stubLocalStorage } from '../test/storage'
import type { StorageStub } from '../test/storage'
import {
  CORRUPTED_BACKUP_KEY,
  TASKS_STORAGE_KEY,
  parseStoredTasks,
  readCorruptedBackup,
  readTasks,
  removeCorruptedBackup,
  writeTasks,
} from './taskStorage'

const silenceWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined)

describe('taskStorage', () => {
  let stub: StorageStub | null = null
  let warn: ReturnType<typeof silenceWarnings>

  beforeEach(() => {
    warn = silenceWarnings()
  })

  afterEach(() => {
    stub?.restore()
    stub = null
    warn.mockRestore()
  })

  // Критерии приёмки 9 и 29 спеки: порядок, приоритеты и сроки переживают перезагрузку.
  it('survives a round trip with order, priorities and dates intact', () => {
    stub = stubLocalStorage()
    const tasks = [
      makeTask({ id: 'a', title: 'Первая', priority: 'high', dueDate: '2026-10-25' }),
      makeTask({ id: 'b', title: 'Вторая', priority: 'low', dueDate: null }),
      makeTask({
        id: 'c',
        title: 'Третья',
        priority: 'medium',
        dueDate: '2026-11-01',
        completedAt: '2026-10-20T12:00:00.000Z',
      }),
    ]

    expect(writeTasks(tasks)).toBeNull()
    expect(readTasks()).toEqual({ tasks, error: null, droppedCount: 0 })
  })

  it('writes under the versioned key in the agreed envelope', () => {
    stub = stubLocalStorage()

    writeTasks([makeTask()])

    const raw = stub.items.get(TASKS_STORAGE_KEY)
    expect(raw).toBeDefined()
    expect(JSON.parse(raw ?? '')).toEqual({ version: 1, tasks: [makeTask()] })
  })

  it('treats a missing key as an empty list, not as a failure', () => {
    stub = stubLocalStorage()

    expect(readTasks()).toEqual({ tasks: [], error: null, droppedCount: 0 })
  })

  it('reports a blocked storage and keeps the list empty', () => {
    stub = stubLocalStorage({ accessError: blockedError() })

    expect(readTasks()).toEqual({ tasks: [], error: 'blocked', droppedCount: 0 })
  })

  it('reports an exhausted quota on write', () => {
    stub = stubLocalStorage({ writeError: quotaError() })

    expect(writeTasks([makeTask()])).toBe('quota')
  })

  it('rejects an envelope of another schema version', () => {
    stub = stubLocalStorage({
      items: storedItems(JSON.stringify({ version: 2, tasks: [makeTask()] })),
    })

    expect(readTasks()).toEqual({ tasks: [], error: 'corrupted', droppedCount: 0 })
  })

  it('rejects a bare array: the envelope is part of the format', () => {
    expect(parseStoredTasks(JSON.stringify([makeTask()]))).toEqual({
      tasks: [],
      error: 'corrupted',
      droppedCount: 0,
    })
  })

  /**
   * Нечитаемое значение — единственное, что у человека осталось от его списка.
   * Персист заменит его пустым конвертом через 250 мс, поэтому копия снимается
   * при гидратации: из неё кнопка «Выгрузить в файл» ([FELA-18](/FELA/issues/FELA-18))
   * отдаёт исходные байты.
   */
  describe('quarantine of an unreadable value', () => {
    const TRUNCATED = '{"version":1,"tasks":[{"id":"a","title":"Первая"},'

    it('keeps the original bytes when the JSON does not parse', () => {
      stub = stubLocalStorage({ items: storedItems(TRUNCATED) })

      expect(readTasks().error).toBe('corrupted')

      expect(stub.items.get(CORRUPTED_BACKUP_KEY)).toBe(TRUNCATED)
      expect(readCorruptedBackup()).toEqual({ ok: true, value: TRUNCATED })
    })

    it('keeps the bytes of an envelope of another schema version', () => {
      const foreign = JSON.stringify({ version: 2, tasks: [makeTask()] })
      stub = stubLocalStorage({ items: storedItems(foreign) })

      readTasks()

      expect(stub.items.get(CORRUPTED_BACKUP_KEY)).toBe(foreign)
    })

    it('does not touch the quarantine when the value reads fine', () => {
      stub = stubLocalStorage({ items: storedItems(storedPayload([makeTask()])) })

      expect(readTasks().error).toBeNull()

      expect(stub.items.has(CORRUPTED_BACKUP_KEY)).toBe(false)
      expect(readCorruptedBackup()).toEqual({ ok: true, value: null })
    })

    // Конверт прочитан, отброшены отдельные задачи — выгружать из сырой строки
    // нечего, и чистый список в карантине только путал бы.
    it('does not quarantine when only single entries were dropped', () => {
      stub = stubLocalStorage({
        items: storedItems(JSON.stringify({ version: 1, tasks: [makeTask(), null] })),
      })

      expect(readTasks().droppedCount).toBe(1)

      expect(stub.items.has(CORRUPTED_BACKUP_KEY)).toBe(false)
    })

    it('does not rewrite the quarantine with bytes it already holds', () => {
      stub = stubLocalStorage({
        items: { ...storedItems(TRUNCATED), [CORRUPTED_BACKUP_KEY]: TRUNCATED },
      })

      readTasks()

      expect(stub.setItem).not.toHaveBeenCalled()
    })

    // Подстраховка не важнее основного ответа: баннер 'corrupted' человек
    // увидит и при отказе записи.
    it('still reports corrupted when the backup write fails', () => {
      stub = stubLocalStorage({ items: storedItems(TRUNCATED), writeError: quotaError() })

      expect(readTasks()).toEqual({ tasks: [], error: 'corrupted', droppedCount: 0 })
    })

    // [FELA-79](/FELA/issues/FELA-79): the quarantine surface deletes the
    // backup directly, independently of the main tasks key's own lifecycle.
    it('removeCorruptedBackup lifts the key without touching the main tasks key', () => {
      const mainPayload = storedPayload([makeTask()])
      stub = stubLocalStorage({
        items: { [TASKS_STORAGE_KEY]: mainPayload, [CORRUPTED_BACKUP_KEY]: TRUNCATED },
      })

      expect(removeCorruptedBackup()).toBeNull()

      expect(stub.items.has(CORRUPTED_BACKUP_KEY)).toBe(false)
      expect(readCorruptedBackup()).toEqual({ ok: true, value: null })
      expect(stub.items.get(TASKS_STORAGE_KEY)).toBe(mainPayload)
    })
  })

  describe('field validation', () => {
    const parseOne = (task: Record<string, unknown>) =>
      parseStoredTasks(JSON.stringify({ version: 1, tasks: [task] }))

    it('fills in absent optional fields with their documented defaults', () => {
      const result = parseOne({ id: 'a', title: 'Задача', createdAt: '2026-10-20T09:00:00.000Z' })

      expect(result.tasks).toEqual([
        {
          id: 'a',
          title: 'Задача',
          priority: 'none',
          dueDate: null,
          completedAt: null,
          createdAt: '2026-10-20T09:00:00.000Z',
        },
      ])
    })

    it('drops a task whose present field is broken', () => {
      const base = { id: 'a', title: 'Задача', createdAt: '2026-10-20T09:00:00.000Z' }

      expect(parseOne({ ...base, priority: 'urgent' }).tasks).toEqual([])
      expect(parseOne({ ...base, dueDate: '2026-13-45' }).tasks).toEqual([])
      expect(parseOne({ ...base, dueDate: 20261025 }).tasks).toEqual([])
      expect(parseOne({ ...base, completedAt: 'вчера' }).tasks).toEqual([])
    })

    it('requires an id, a title and a creation time', () => {
      expect(parseOne({ title: 'Задача', createdAt: '2026-10-20T09:00:00.000Z' }).tasks).toEqual([])
      expect(parseOne({ id: '', title: 'Задача', createdAt: '2026-10-20T09:00:00.000Z' }).tasks).toEqual([])
      expect(parseOne({ id: 'a', title: '   ', createdAt: '2026-10-20T09:00:00.000Z' }).tasks).toEqual([])
      expect(parseOne({ id: 'a', title: 'Задача' }).tasks).toEqual([])
      expect(parseOne({ id: 'a', title: 'Задача', createdAt: 'не дата' }).tasks).toEqual([])
    })

    it('trims the title the way the domain does', () => {
      expect(parseOne({ id: 'a', title: '  Задача  ', createdAt: '2026-10-20T09:00:00.000Z' }).tasks[0]?.title).toBe(
        'Задача',
      )
    })

    it('drops a repeated id: it would break React keys and addressing by id', () => {
      const result = parseStoredTasks(
        JSON.stringify({ version: 1, tasks: [makeTask({ id: 'a' }), makeTask({ id: 'a', title: 'Копия' })] }),
      )

      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0]?.title).toBe('Задача')
      expect(result.droppedCount).toBe(1)
    })

    // Отдельные битые задачи не поднимают storageError: баннер из-за одного
    // мусорного элемента из пятидесяти человеку не помогает.
    it('drops single broken entries silently, without raising a storage error', () => {
      const result = parseStoredTasks(
        JSON.stringify({ version: 1, tasks: [...makeTasks(2), null, { id: 'x' }] }),
      )

      expect(result.tasks).toHaveLength(2)
      expect(result.droppedCount).toBe(2)
      expect(result.error).toBeNull()
    })
  })

  /**
   * Полный круг: граница записи и граница чтения обязаны соглашаться друг с другом.
   *
   * `parseTask` **пересобирает** задачу по известным полям, поэтому поле,
   * добавленное в `Task` и `createTask`, но забытое в разборщике, молча теряется
   * при перезагрузке. Сегодня таких полей нет; тест стоит здесь, чтобы
   * завтрашнее не проехало незамеченным.
   *
   * Сравнение идёт целиком, а не по отдельным полям: проверка вида
   * `expect(read.dueDate).toBe(...)` забытое поле как раз и не увидит.
   */
  describe('full circle: addTask -> envelope -> parseStoredTasks', () => {
    const CREATED_AT = new Date('2026-10-20T09:00:00.000Z')
    const COMPLETED_AT = new Date('2026-10-20T12:30:00.000Z')

    it('keeps every field of a task the write boundary produced', () => {
      const added = addTask([], { title: 'Собрать отчёт', priority: 'high', dueDate: '2026-10-25' }, CREATED_AT)
      const written = toggleTask(added, added[0]?.id ?? '', COMPLETED_AT)

      // Круг не должен сойтись на пустом списке или на полях со значениями по
      // умолчанию: там он сравнил бы «ничего» с «ничем» и всё равно позеленел.
      expect(written).toHaveLength(1)
      expect(written[0]?.priority).not.toBe('none')
      expect(written[0]?.dueDate).not.toBeNull()
      expect(written[0]?.completedAt).not.toBeNull()

      expect(parseStoredTasks(storedPayload(written))).toEqual({
        tasks: written,
        error: null,
        droppedCount: 0,
      })
    })
  })
})
