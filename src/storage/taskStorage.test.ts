import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTask, makeTasks } from '../test/factories'
import { blockedError, quotaError, storedItems, stubLocalStorage } from '../test/storage'
import type { StorageStub } from '../test/storage'
import { TASKS_STORAGE_KEY, parseStoredTasks, readTasks, writeTasks } from './taskStorage'

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
})
