/**
 * Регрессионные тесты уязвимости «прочитанное из localStorage — недоверенный ввод».
 *
 * Источник требований: модель угроз [FELA-4](/FELA/issues/FELA-4), раздел 4,
 * сведено в [FELA-8](/FELA/issues/FELA-8), правила — `docs/CODE-RULES.md`,
 * раздел 3. Каждый тест здесь падает на коде без валидатора, то есть на
 * `JSON.parse(raw) as Task[]` — как было в `src/useTodos.ts` в каркасе.
 *
 * Данные синтетические: ни настоящих имён, ни адресов, ни личных задач.
 */

import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_TASKS, MAX_TITLE_LENGTH } from '../domain/limits'
import { TaskStoreProvider } from '../state/TaskStoreProvider'
import { useTaskStore } from '../state/useTaskStore'
import { makeTask, makeTasks } from '../test/factories'
import { storedItems, storedPayload, stubLocalStorage } from '../test/storage'
import type { StorageStub } from '../test/storage'
import { parseStoredTasks } from './taskStorage'

const silenceWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined)

/** Минимальный потребитель стора: список задач и признак ошибки хранилища. */
function Probe() {
  const { tasks, storageError } = useTaskStore()
  return (
    <div>
      <p data-testid="error">{storageError ?? 'none'}</p>
      <p data-testid="count">{tasks.length}</p>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
    </div>
  )
}

function parsePayload(tasks: unknown[]) {
  return parseStoredTasks(JSON.stringify({ version: 1, tasks }))
}

describe('storage hardening', () => {
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

  it('survives broken JSON: empty list, app alive, storageError is corrupted', () => {
    stub = stubLocalStorage({ items: storedItems('{{{') })

    render(
      <TaskStoreProvider>
        <Probe />
      </TaskStoreProvider>,
    )

    expect(screen.getByTestId('count')).toHaveTextContent('0')
    expect(screen.getByTestId('error')).toHaveTextContent('corrupted')
  })

  it('returns an empty list when the payload is not an array of tasks', () => {
    expect(parseStoredTasks('{"a":1}').tasks).toEqual([])
    expect(parseStoredTasks('[null]').tasks).toEqual([])
    expect(parseStoredTasks('"строка"').tasks).toEqual([])
    expect(parseStoredTasks('42').tasks).toEqual([])
  })

  it('drops null and non-object entries', () => {
    const result = parsePayload([null, {}, 'строка', 42, []])

    expect(result.tasks).toEqual([])
    expect(result.droppedCount).toBe(5)
  })

  it('drops an entry whose title is not a string', () => {
    expect(parseStoredTasks('[{"id":"1","title":{},"completedAt":null}]').tasks).toEqual([])
    expect(parsePayload([{ id: '1', title: {}, completedAt: null }]).tasks).toEqual([])
    expect(parsePayload([{ id: '1', title: 42, createdAt: '2026-10-20T09:00:00.000Z' }]).tasks).toEqual([])
  })

  it('clamps a title longer than the limit instead of keeping it whole', () => {
    const result = parsePayload([makeTask({ title: 'я'.repeat(MAX_TITLE_LENGTH + 100) })])

    expect(result.tasks[0]?.title).toHaveLength(MAX_TITLE_LENGTH)
  })

  it('clamps a list longer than the limit', () => {
    const result = parsePayload(makeTasks(MAX_TASKS + 5))

    expect(result.tasks).toHaveLength(MAX_TASKS)
    expect(result.droppedCount).toBe(5)
  })

  it('never lets an unknown key from storage reach the state', () => {
    // Сырая строка, а не объект: `__proto__` в литерале задаёт прототип, и до
    // JSON он бы не доехал. `JSON.parse` же кладёт его обычным своим ключом.
    const result = parseStoredTasks(
      '{"version":1,"tasks":[{"id":"task-1","title":"Задача","priority":"none","dueDate":null,' +
        '"completedAt":null,"createdAt":"2026-10-20T09:00:00.000Z","evil":"x",' +
        '"__proto__":{"polluted":true},"done":true,"order":7}]}',
    )

    expect(result.tasks).toEqual([makeTask()])
    expect('polluted' in {}).toBe(false)
    expect(Object.keys(result.tasks[0] ?? {}).toSorted()).toEqual([
      'completedAt',
      'createdAt',
      'dueDate',
      'id',
      'priority',
      'title',
    ])
  })

  it('renders a task titled like an injection as text, with no element built from it', () => {
    const title = '<img src=x onerror=alert(1)>'
    stub = stubLocalStorage({ items: storedItems(storedPayload([makeTask({ title })])) })

    const { container } = render(
      <TaskStoreProvider>
        <Probe />
      </TaskStoreProvider>,
    )

    expect(screen.getByText(title)).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
})
