import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TASKS_STORAGE_KEY, readCorruptedBackup } from '../storage/taskStorage'
import { PERSIST_DEBOUNCE_MS } from '../storage/useDebouncedPersist'
import { makeTask } from '../test/factories'
import { blockedError, quotaError, storedItems, storedPayload, stubLocalStorage } from '../test/storage'
import type { StorageStub, StorageStubOptions } from '../test/storage'
import { TaskStoreProvider } from './TaskStoreProvider'
import { useTaskStore } from './useTaskStore'

const silenceWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined)

/**
 * Пульт к стору: кнопки вместо интерфейса, которого на этой задаче ещё нет.
 * Так проверяется связка «гидратация — действие — персист», а не разметка.
 */
function Probe() {
  const {
    tasks,
    storageError,
    isAtLimit,
    addTask,
    removeTask,
    restoreRemoved,
    retryPersist,
  } = useTaskStore()

  return (
    <div>
      <p data-testid="error">{storageError ?? 'none'}</p>
      <p data-testid="limit">{isAtLimit ? 'full' : 'free'}</p>
      <ul data-testid="tasks">
        {tasks.map((task) => (
          <li key={task.id}>{task.title}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          addTask({ title: 'Новая', priority: 'high', dueDate: '2026-10-25' })
        }}
      >
        add
      </button>
      <button
        type="button"
        onClick={() => {
          removeTask(tasks[0]?.id ?? '')
        }}
      >
        remove first
      </button>
      <button type="button" onClick={restoreRemoved}>
        undo
      </button>
      <button type="button" onClick={retryPersist}>
        retry
      </button>
    </div>
  )
}

function renderStore() {
  return render(
    <TaskStoreProvider>
      <Probe />
    </TaskStoreProvider>,
  )
}

const titles = () =>
  [...screen.getByTestId('tasks').querySelectorAll('li')].map((item) => item.textContent)

const click = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }))
}

/**
 * Прогоняет паузу debounce.
 *
 * Тесты про запись идут на фейковом таймере и кликают через `fireEvent`:
 * `userEvent` со своим внутренним ожиданием на подменённых таймерах зависает.
 * Саму задержку 250 мс проверяет `useDebouncedPersist.test.ts`, здесь нужен
 * только факт записи.
 */
const letPersistRun = () => {
  act(() => {
    vi.advanceTimersByTime(PERSIST_DEBOUNCE_MS)
  })
}

describe('TaskStoreProvider', () => {
  let stub: StorageStub | null = null
  let warn: ReturnType<typeof silenceWarnings>

  beforeEach(() => {
    warn = silenceWarnings()
  })

  afterEach(() => {
    // Страховка: незакрытый фейковый таймер иначе вешает следующие тесты.
    vi.useRealTimers()
    stub?.restore()
    stub = null
    warn.mockRestore()
  })

  it('hydrates the stored list before the first render', () => {
    stub = stubLocalStorage({
      items: storedItems(
        storedPayload([
          makeTask({ id: 'a', title: 'Первая', priority: 'high' }),
          makeTask({ id: 'b', title: 'Вторая' }),
        ]),
      ),
    })

    renderStore()

    expect(titles()).toEqual(['Первая', 'Вторая'])
    expect(screen.getByTestId('error')).toHaveTextContent('none')
  })

  it('starts empty and without an error when nothing is stored yet', () => {
    stub = stubLocalStorage()

    renderStore()

    expect(titles()).toEqual([])
    expect(screen.getByTestId('error')).toHaveTextContent('none')
    expect(screen.getByTestId('limit')).toHaveTextContent('free')
  })

  it('reports corrupted data and keeps the app usable', async () => {
    stub = stubLocalStorage({ items: storedItems('{{{') })
    const user = userEvent.setup()

    renderStore()
    expect(screen.getByTestId('error')).toHaveTextContent('corrupted')

    await user.click(screen.getByRole('button', { name: 'add' }))

    expect(titles()).toEqual(['Новая'])
  })

  // Критерий приёмки задачи: недоступный localStorage не ломает работу в памяти.
  it('keeps working in memory when localStorage is unavailable', async () => {
    stub = stubLocalStorage({ accessError: blockedError() })
    const user = userEvent.setup()

    renderStore()
    expect(screen.getByTestId('error')).toHaveTextContent('blocked')

    await user.click(screen.getByRole('button', { name: 'add' }))
    await user.click(screen.getByRole('button', { name: 'add' }))

    expect(titles()).toEqual(['Новая', 'Новая'])
  })

  it('raises a quota error from a failed write', () => {
    vi.useFakeTimers()
    stub = stubLocalStorage({ writeError: quotaError() })

    renderStore()
    click('add')
    letPersistRun()

    expect(screen.getByTestId('error')).toHaveTextContent('quota')
    // Запись не удалась, но список в памяти жив.
    expect(titles()).toEqual(['Новая'])
  })

  /**
   * Персист через 250 мс заменяет нечитаемое значение пустым конвертом. К тому
   * моменту человек ещё читает баннер, а кнопка «Выгрузить в файл»
   * ([FELA-18](/FELA/issues/FELA-18), спека, строка 387) должна отдать ему его
   * байты, а не пустоту.
   */
  it('keeps a corrupted payload reachable after the debounce window', () => {
    const truncated = '{"version":1,"tasks":[{"id":"a","title":"Первая"},'
    vi.useFakeTimers()
    stub = stubLocalStorage({ items: storedItems(truncated) })

    renderStore()
    expect(screen.getByTestId('error')).toHaveTextContent('corrupted')
    letPersistRun()

    // Основной ключ очищен нарочно — а исходные байты лежат в карантине.
    expect(stub.items.get(TASKS_STORAGE_KEY)).toBe('{"version":1,"tasks":[]}')
    expect(readCorruptedBackup()).toEqual({ ok: true, value: truncated })
  })

  /**
   * Критерий приёмки [FELA-64](/FELA/issues/FELA-64): место освободилось —
   * «Повторить» действительно пишет, и в хранилище лежит актуальный конверт, а
   * не только погасший баннер.
   */
  it('writes the current list on retry once the quota frees up', () => {
    vi.useFakeTimers()
    stub = stubLocalStorage()
    // Первая запись (проход персиста после загрузки) падает по квоте, дальше
    // хранилище снова работает.
    stub.setItem.mockImplementationOnce(() => {
      throw quotaError()
    })

    renderStore()
    click('add')
    letPersistRun()
    expect(screen.getByTestId('error')).toHaveTextContent('quota')

    click('retry')

    expect(screen.getByTestId('error')).toHaveTextContent('none')
    const stored: unknown = JSON.parse(stub.items.get(TASKS_STORAGE_KEY) ?? '')
    expect(stored).toMatchObject({ version: 1, tasks: [{ title: 'Новая' }] })
  })

  /**
   * [FELA-70](/FELA/issues/FELA-70): при `'corrupted'` ломалось чтение, а
   * запись работает — значит повтор **удаётся**. Снять отказ по удавшейся
   * записи означало бы погасить баннер, а вместе с ним убрать единственный
   * путь к карантинным байтам, которые при этом целы.
   */
  it('keeps a corrupted read failure after a retry write succeeds', () => {
    const truncated = '{"version":1,"tasks":[{"id":"a","title":"Первая"},'
    vi.useFakeTimers()
    stub = stubLocalStorage({ items: storedItems(truncated) })

    renderStore()
    letPersistRun()
    expect(screen.getByTestId('error')).toHaveTextContent('corrupted')

    click('retry')

    // Запись прошла — и всё равно отказ чтения на месте.
    expect(stub.items.get(TASKS_STORAGE_KEY)).toBe('{"version":1,"tasks":[]}')
    expect(screen.getByTestId('error')).toHaveTextContent('corrupted')
    expect(readCorruptedBackup()).toEqual({ ok: true, value: truncated })
  })

  /**
   * [FELA-92](/FELA/issues/FELA-92): тот же инвариант, но запись при повторе
   * **падает**. Код записи не должен вытеснить отказ чтения: иначе
   * `ErrorBanner` уйдёт в ветку не-карантина и выгрузит пустой список из
   * памяти, а целые карантинные байты снова станут недостижимы.
   */
  it('keeps a corrupted read failure after a retry write fails', () => {
    const truncated = '{"version":1,"tasks":[{"id":"a","title":"Первая"},'
    vi.useFakeTimers()
    // Объект опций мутируемый: стаб читает `writeError` в момент записи, так
    // что запись ломается уже после гидратации и прохода персиста.
    const options: StorageStubOptions = { items: storedItems(truncated) }
    stub = stubLocalStorage(options)

    renderStore()
    letPersistRun()
    expect(screen.getByTestId('error')).toHaveTextContent('corrupted')

    options.writeError = quotaError()
    click('retry')

    expect(screen.getByTestId('error')).toHaveTextContent('corrupted')
    expect(readCorruptedBackup()).toEqual({ ok: true, value: truncated })
  })

  it('keeps the banner up when the retry write fails again', () => {
    vi.useFakeTimers()
    stub = stubLocalStorage({ writeError: quotaError() })

    renderStore()
    click('add')
    letPersistRun()
    expect(screen.getByTestId('error')).toHaveTextContent('quota')

    click('retry')

    // Тихо прятать баннер без удавшейся записи и было дефектом задачи.
    expect(screen.getByTestId('error')).toHaveTextContent('quota')
    expect(titles()).toEqual(['Новая'])
  })

  // Критерии приёмки 9 и 29 спеки, через настоящий цикл «поработали — перезагрузили».
  it('survives a reload with order, priority and due date intact', () => {
    vi.useFakeTimers()
    stub = stubLocalStorage({
      items: storedItems(storedPayload([makeTask({ id: 'a', title: 'Первая' })])),
    })

    const first = renderStore()
    click('add')
    letPersistRun()
    first.unmount()

    renderStore()

    expect(titles()).toEqual(['Первая', 'Новая'])
    const stored: unknown = JSON.parse(stub.items.get(TASKS_STORAGE_KEY) ?? '')
    expect(stored).toMatchObject({
      version: 1,
      tasks: [{ title: 'Первая' }, { title: 'Новая', priority: 'high', dueDate: '2026-10-25' }],
    })
  })

  it('restores a removed task at its former position', async () => {
    stub = stubLocalStorage({
      items: storedItems(
        storedPayload([
          makeTask({ id: 'a', title: 'Первая' }),
          makeTask({ id: 'b', title: 'Вторая' }),
        ]),
      ),
    })
    const user = userEvent.setup()

    renderStore()
    await user.click(screen.getByRole('button', { name: 'remove first' }))
    expect(titles()).toEqual(['Вторая'])

    await user.click(screen.getByRole('button', { name: 'undo' }))

    expect(titles()).toEqual(['Первая', 'Вторая'])
  })

  it('refuses to work outside the provider instead of failing quietly', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => render(<Probe />)).toThrow(/TaskStoreProvider/)

    error.mockRestore()
  })
})
