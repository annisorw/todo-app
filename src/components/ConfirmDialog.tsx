import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Button } from './Button'

export interface ConfirmDialogProps {
  open: boolean
  /** N in "Delete all completed (N)?" (spec 3.16 — the one scenario). */
  completedCount: number
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Accusative, as object of "удалить": 1 задачу · 2 задачи · 5 задач · 11
 * задач · 21 задачу. Same shape as domain/dueDate.ts's day pluralizer, but
 * the singular form differs because that one is genitive ("на N дней"),
 * not accusative.
 */
function pluralizeTasks(count: number): string {
  const lastTwo = count % 100
  if (lastTwo >= 11 && lastTwo <= 14) return 'задач'

  const last = count % 10
  if (last === 1) return 'задачу'
  if (last >= 2 && last <= 4) return 'задачи'
  return 'задач'
}

/**
 * design-spec 3.16. 480px (`--size-modal-md`), focus trap, `Esc` closes,
 * focus returns to whatever opened it. The `Escape` handler calls
 * `stopPropagation` so a future global shortcut handler (FELA-20) doesn't
 * also react to the same keypress — this dialog owns Escape while it's open,
 * it just doesn't listen on `document` to get there.
 */
export function ConfirmDialog({ open, completedCount, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return

    triggerRef.current = document.activeElement
    cancelRef.current?.focus()

    return () => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus()
    }
  }, [open])

  if (!open) return null

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCancel()
      return
    }

    if (event.key !== 'Tab') return

    const first = cancelRef.current
    const last = confirmRef.current
    if (first === null || last === null) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-modal-backdrop p-(--space-4) animate-modal-backdrop-in"
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-(--size-modal-md) rounded-(--radius-xl) bg-surface-2 p-(--space-6) shadow-lg animate-modal-panel-in"
      >
        <h2 id={titleId} className="text-h1 text-primary">
          Удалить все выполненные ({completedCount})?
        </h2>

        <div className="mt-(--space-6) flex justify-end gap-(--space-3)">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
          <Button ref={confirmRef} variant="danger" onClick={onConfirm}>
            Удалить {completedCount} {pluralizeTasks(completedCount)}
          </Button>
        </div>
      </div>
    </div>
  )
}
