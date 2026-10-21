import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Toast } from '../components/Toast'
import type { ToastVariant } from '../components/Toast'
import { cn } from '../lib/cn'
import { ToastContext } from './useToast'
import type { ToastContextValue } from './useToast'

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
  /** Independent pause reasons — resuming requires both to clear (FELA-128). */
  hovered: boolean
  focused: boolean
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
      const previous = timers.current.get(id)
      timers.current.set(id, {
        timeoutId,
        remainingMs,
        startedAt: Date.now(),
        hovered: previous?.hovered ?? false,
        focused: previous?.focused ?? false,
      })
    },
    [startClosing],
  )

  /**
   * Hover and focus are independent pause reasons: setting one true always
   * pauses, and resuming fires only once both are false again (FELA-128 —
   * mouseleave used to resume unconditionally even while focus held the
   * timer paused).
   */
  const setPauseReason = useCallback(
    (id: string, reason: 'hovered' | 'focused', active: boolean) => {
      const entry = timers.current.get(id)
      if (entry === undefined) return
      const updated: TimerEntry = { ...entry, [reason]: active }
      const shouldPause = updated.hovered || updated.focused

      if (shouldPause) {
        if (updated.timeoutId !== null) {
          window.clearTimeout(updated.timeoutId)
          const elapsed = Date.now() - updated.startedAt
          updated.remainingMs = Math.max(0, updated.remainingMs - elapsed)
          updated.timeoutId = null
        }
        timers.current.set(id, updated)
        return
      }

      timers.current.set(id, updated)
      if (updated.timeoutId === null) {
        armTimer(id, updated.remainingMs)
      }
    },
    [armTimer],
  )

  const pushToast = useCallback(
    (options: ToastOptions) => {
      const id = `toast-${String(nextId.current)}`
      nextId.current += 1

      // Eviction is reported out of the updater on purpose: React may invoke
      // a state updater more than once per commit (StrictMode), and the
      // timer map is a side effect that must run exactly once.
      let evictedId: string | undefined
      setToasts((current) => {
        const next = [...current, { ...options, id, closing: false }]
        if (next.length <= MAX_VISIBLE_TOASTS) return next
        // Oldest evicted, not animated out: eviction isn't a dismissal.
        const [evicted, ...rest] = next
        evictedId = evicted?.id
        return rest
      })
      if (evictedId !== undefined) {
        const entry = timers.current.get(evictedId)
        if (entry?.timeoutId !== null && entry?.timeoutId !== undefined) {
          window.clearTimeout(entry.timeoutId)
        }
        timers.current.delete(evictedId)
      }

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
            onMouseEnter={() => setPauseReason(toast.id, 'hovered', true)}
            onMouseLeave={() => setPauseReason(toast.id, 'hovered', false)}
            onFocus={() => setPauseReason(toast.id, 'focused', true)}
            onBlur={(event) => {
              // Focus moving to another element inside the same toast is not
              // a focus-out: don't let it release the "focused" pause reason.
              if (event.currentTarget.contains(event.relatedTarget)) return
              setPauseReason(toast.id, 'focused', false)
            }}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
