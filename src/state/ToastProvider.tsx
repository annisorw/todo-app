import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Toast } from '../components/Toast'
import type { ToastVariant } from '../components/Toast'
import { cn } from '../lib/cn'

export interface ToastOptions {
  variant: ToastVariant
  message: string
  /** Both or neither — a toast with an action always needs a label for it. */
  actionLabel?: string
  onAction?: () => void
}

interface ToastEntry extends ToastOptions {
  id: string
  closing: boolean
}

export interface ToastContextValue {
  pushToast: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** design-spec 3.17: lives 6s. Not on the --duration-* scale — that scale is
 * capped at 480ms for feedback to input, this is a dismissal timeout. */
const TOAST_LIFETIME_MS = 6000
/**
 * Must match `animate-toast-out`'s 160ms in `styles/base.css` (motion table
 * row "toast-out"). Unmounting is driven by this timeout, not by
 * `onAnimationEnd`: jsdom has no `AnimationEvent` implementation, so that
 * event never reaches a real browser's listener in tests, and a timeout
 * mirroring the CSS duration is also simpler than animation-event bookkeeping
 * in a real browser (no risk of a cancelled/overlapping animation leaving a
 * toast stuck in the DOM).
 */
const TOAST_EXIT_MS = 160
/** Max stacked toasts; the oldest is evicted past this (spec 3.17). */
const MAX_VISIBLE_TOASTS = 3

interface TimerEntry {
  /** `null` while paused (hovered or focused). */
  timeoutId: number | null
  remainingMs: number
  startedAt: number
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (value === null) {
    throw new Error('useToast must be used inside <ToastProvider>.')
  }
  return value
}

/**
 * design-spec 3.17. Owns the toast queue and its timers; `components/Toast.tsx`
 * stays presentational. Renders the fixed viewport itself (desktop:
 * bottom-right: mobile: full width, above where `Fab` will sit) as a sibling
 * of `children`, so any descendant can call `useToast().pushToast(...)`.
 *
 * Deletion's undo toast is composed by whoever calls `removeTask` (the future
 * task-list feature): it pushes `{ variant: 'danger', actionLabel: 'Вернуть',
 * onAction: restoreRemoved }`. This provider never keeps its own copy of the
 * removed task — `lastRemoved` in the store stays the single source of truth
 * (architecture doc section 4).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const timers = useRef(new Map<string, TimerEntry>())
  const nextId = useRef(0)

  const removeToast = useCallback((id: string) => {
    timers.current.delete(id)
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const startClosing = useCallback(
    (id: string) => {
      timers.current.delete(id)
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast)),
      )
      window.setTimeout(() => removeToast(id), TOAST_EXIT_MS)
    },
    [removeToast],
  )

  const armTimer = useCallback(
    (id: string, remainingMs: number) => {
      const timeoutId = window.setTimeout(() => startClosing(id), remainingMs)
      timers.current.set(id, { timeoutId, remainingMs, startedAt: Date.now() })
    },
    [startClosing],
  )

  const pauseTimer = useCallback((id: string) => {
    const entry = timers.current.get(id)
    if (entry === undefined || entry.timeoutId === null) return
    window.clearTimeout(entry.timeoutId)
    const elapsed = Date.now() - entry.startedAt
    timers.current.set(id, {
      timeoutId: null,
      remainingMs: Math.max(0, entry.remainingMs - elapsed),
      startedAt: entry.startedAt,
    })
  }, [])

  const resumeTimer = useCallback(
    (id: string) => {
      const entry = timers.current.get(id)
      if (entry === undefined || entry.timeoutId !== null) return
      armTimer(id, entry.remainingMs)
    },
    [armTimer],
  )

  const pushToast = useCallback(
    (options: ToastOptions) => {
      const id = `toast-${String(nextId.current)}`
      nextId.current += 1

      setToasts((current) => {
        const next = [...current, { ...options, id, closing: false }]
        if (next.length <= MAX_VISIBLE_TOASTS) return next
        // Oldest evicted, not animated out: eviction isn't a dismissal.
        const [evicted, ...rest] = next
        if (evicted !== undefined) timers.current.delete(evicted.id)
        return rest
      })

      armTimer(id, TOAST_LIFETIME_MS)
    },
    [armTimer],
  )

  const value = useMemo<ToastContextValue>(() => ({ pushToast }), [pushToast])

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className={cn(
          'fixed z-(--z-toast) flex flex-col gap-(--space-2)',
          'inset-x-(--space-4) bottom-[calc(var(--space-5)+var(--size-fab)+var(--space-3)+env(safe-area-inset-bottom))]',
          'sm:inset-x-auto sm:right-(--space-6) sm:bottom-(--space-6) sm:w-96',
        )}
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            variant={toast.variant}
            message={toast.message}
            actionLabel={toast.actionLabel}
            onAction={toast.onAction}
            closing={toast.closing}
            onMouseEnter={() => pauseTimer(toast.id)}
            onMouseLeave={() => resumeTimer(toast.id)}
            onFocus={() => pauseTimer(toast.id)}
            onBlur={() => resumeTimer(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
