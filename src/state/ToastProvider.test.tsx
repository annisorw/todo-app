import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTasks } from '../test/factories'
import { storedItems, storedPayload, stubLocalStorage } from '../test/storage'
import type { StorageStub } from '../test/storage'
import { TaskStoreProvider } from './TaskStoreProvider'
import { useTaskStore } from './useTaskStore'
import { ToastProvider } from './ToastProvider'
import type { ToastOptions } from './ToastProvider'
import { useToast } from './useToast'

/** Pushes a fixed toast on click, so tests don't need a real trigger UI. */
function PushButton({ options, label }: { options: ToastOptions; label: string }) {
  const { pushToast } = useToast()
  return (
    <button type="button" onClick={() => pushToast(options)}>
      {label}
    </button>
  )
}

const TOAST_LIFETIME_MS = 6000
/** Must match `TOAST_EXIT_MS` in `ToastProvider.tsx`. */
const TOAST_EXIT_MS = 160

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

/** 6s lifetime, then the exit timeout that actually unmounts the toast. */
function advancePastLifetime() {
  advance(TOAST_LIFETIME_MS + TOAST_EXIT_MS)
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders info/success toasts as role="status" and danger as role="alert"', () => {
    render(
      <ToastProvider>
        <PushButton options={{ variant: 'info', message: 'Инфо' }} label="info" />
        <PushButton options={{ variant: 'danger', message: 'Опасность' }} label="danger" />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'info' }))
    fireEvent.click(screen.getByRole('button', { name: 'danger' }))

    expect(screen.getByRole('status')).toHaveTextContent('Инфо')
    expect(screen.getByRole('alert')).toHaveTextContent('Опасность')
  })

  it('carries the .toast class on the root element (spec 2.7 fallback hook)', () => {
    render(
      <ToastProvider>
        <PushButton options={{ variant: 'info', message: 'Инфо' }} label="info" />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'info' }))

    expect(screen.getByRole('status')).toHaveClass('toast')
  })

  it('dismisses a toast after 6s', () => {
    render(
      <ToastProvider>
        <PushButton options={{ variant: 'info', message: 'Привет' }} label="push" />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'push' }))
    expect(screen.getByRole('status')).toBeInTheDocument()

    advance(TOAST_LIFETIME_MS)
    expect(screen.getByRole('status')).toHaveClass('animate-toast-out') // closing, not yet removed

    advance(TOAST_EXIT_MS)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('pauses the timer on hover and resumes on mouse leave', () => {
    render(
      <ToastProvider>
        <PushButton options={{ variant: 'info', message: 'Привет' }} label="push" />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'push' }))
    const toast = screen.getByRole('status')

    fireEvent.mouseEnter(toast)
    advancePastLifetime()
    expect(screen.getByRole('status')).toBeInTheDocument() // paused, never started closing

    fireEvent.mouseLeave(toast)
    advancePastLifetime()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('pauses the timer while focus is inside the toast', () => {
    render(
      <ToastProvider>
        <PushButton
          options={{ variant: 'danger', message: 'Удалено', actionLabel: 'Вернуть', onAction: () => {} }}
          label="push"
        />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'push' }))
    const toast = screen.getByRole('alert')

    fireEvent.focus(toast)
    advancePastLifetime()
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.blur(toast)
    advancePastLifetime()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('stays paused on mouse leave while focus is still inside (FELA-128)', () => {
    render(
      <ToastProvider>
        <PushButton
          options={{ variant: 'danger', message: 'Удалено', actionLabel: 'Вернуть', onAction: () => {} }}
          label="push"
        />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'push' }))
    const toast = screen.getByRole('alert')

    // Reproduces the audit repro: focus "Вернуть", then hover, then leave
    // with the mouse while focus is still held.
    fireEvent.focus(toast)
    fireEvent.mouseEnter(toast)
    fireEvent.mouseLeave(toast)
    advancePastLifetime()
    expect(screen.getByRole('alert')).toBeInTheDocument() // focus still holds the pause

    fireEvent.blur(toast)
    advancePastLifetime()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('resumes the remaining time, not a fresh 6s, once the last pause reason clears', () => {
    render(
      <ToastProvider>
        <PushButton
          options={{ variant: 'danger', message: 'Удалено', actionLabel: 'Вернуть', onAction: () => {} }}
          label="push"
        />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'push' }))
    const toast = screen.getByRole('alert')

    advance(2000) // 2s of the 6s lifetime elapses unpaused, 4s left

    fireEvent.focus(toast)
    fireEvent.mouseEnter(toast)
    advance(5000) // well past the 4s that remained; paused, so nothing happens

    fireEvent.mouseLeave(toast) // one reason clears, still focused: stays paused
    advance(1000)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    fireEvent.blur(toast) // last reason clears: ~4s should remain, not a fresh 6s
    advance(3999)
    expect(screen.getByRole('alert')).toBeInTheDocument() // not yet — would be gone if it reset to a fresh 6s+ was already consumed

    advance(1) // completes the remaining ~4s
    expect(screen.getByRole('alert')).toHaveClass('animate-toast-out')

    advance(TOAST_EXIT_MS)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not resume the timer when focus moves between elements inside the toast', () => {
    render(
      <ToastProvider>
        <PushButton
          options={{ variant: 'danger', message: 'Удалено', actionLabel: 'Вернуть', onAction: () => {} }}
          label="push"
        />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'push' }))
    const toast = screen.getByRole('alert')
    const actionButton = screen.getByRole('button', { name: 'Вернуть' })

    fireEvent.focus(toast)
    // Focus moves from the toast root to its own action button — the
    // blur's relatedTarget stays inside the toast, so this must not resume.
    fireEvent.blur(toast, { relatedTarget: actionButton })
    advancePastLifetime()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('keeps at most 3 toasts, evicting the oldest', () => {
    render(
      <ToastProvider>
        <PushButton options={{ variant: 'info', message: 'Первый' }} label="push" />
      </ToastProvider>,
    )

    const push = () => fireEvent.click(screen.getByRole('button', { name: 'push' }))
    push()
    push()
    push()
    push()

    const toasts = screen.getAllByRole('status')
    expect(toasts).toHaveLength(3)
  })

  it('wires the undo toast straight to the store, without keeping its own copy of the removed task', () => {
    /** Mirrors what the future task-list feature will do on delete. */
    function DeleteButton() {
      const { tasks, removeTask, restoreRemoved } = useTaskStore()
      const { pushToast } = useToast()
      return (
        <>
          <ul data-testid="tasks">
            {tasks.map((task) => (
              <li key={task.id}>{task.title}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              const task = tasks[0]
              if (task === undefined) return
              removeTask(task.id)
              pushToast({
                variant: 'danger',
                message: `Задача удалена: «${task.title}»`,
                actionLabel: 'Вернуть',
                onAction: restoreRemoved,
              })
            }}
          >
            delete first
          </button>
        </>
      )
    }

    const titles = () => [...screen.getByTestId('tasks').querySelectorAll('li')].map((el) => el.textContent)

    const stub: StorageStub = stubLocalStorage({
      items: storedItems(storedPayload(makeTasks(2))),
    })

    render(
      <TaskStoreProvider>
        <ToastProvider>
          <DeleteButton />
        </ToastProvider>
      </TaskStoreProvider>,
    )

    expect(titles()).toEqual(['Задача 1', 'Задача 2'])

    fireEvent.click(screen.getByRole('button', { name: 'delete first' }))
    expect(titles()).toEqual(['Задача 2'])
    expect(screen.getByRole('alert')).toHaveTextContent('Задача удалена: «Задача 1»')

    fireEvent.click(screen.getByRole('button', { name: 'Вернуть' }))
    expect(titles()).toEqual(['Задача 1', 'Задача 2']) // restored at its former position

    stub.restore()
  })
})
