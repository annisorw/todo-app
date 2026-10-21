import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { useDismissable } from '../lib/useDismissable'
import { Button } from './Button'
import type { ButtonVariant } from './Button'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  body?: string
  confirmLabel: string
  /** @default 'danger' */
  confirmVariant?: ButtonVariant
  onConfirm: () => void
  onCancel: () => void
}

/**
 * design-spec 3.16. 480px (`--size-modal-md`), focus trap, `Esc` closes,
 * focus returns to whatever opened it.
 *
 * `open` is a prop rather than a mount decision for the caller, but the panel
 * underneath is mounted only while open: `useDismissable` registers a layer
 * for exactly as long as it is mounted, so a closed dialog must not be on the
 * stack at all. Splitting the component is what makes that unrepresentable.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <ConfirmDialogPanel
      title={title}
      body={body}
      confirmLabel={confirmLabel}
      confirmVariant={confirmVariant}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

type ConfirmDialogPanelProps = Omit<ConfirmDialogProps, 'open' | 'confirmVariant'> & {
  confirmVariant: ButtonVariant
}

function ConfirmDialogPanel({
  title,
  body,
  confirmLabel,
  confirmVariant,
  onConfirm,
  onCancel,
}: ConfirmDialogPanelProps) {
  const titleId = useId()
  const bodyId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<Element | null>(null)

  // Esc приходит от единственного владельца (`lib/dismissStack.ts`), поэтому
  // попап, открытый внутри диалога, забирает первое нажатие, а диалог под ним
  // закрывается только следующим. Без `returnFocusTo`: фокус возвращает эффект
  // ниже при размонтировании, а ссылка хуку вернула бы его второй раз.
  useDismissable({ onDismiss: onCancel })

  useEffect(() => {
    triggerRef.current = document.activeElement
    cancelRef.current?.focus()

    return () => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus()
    }
  }, [])

  // Только ловушка Tab. Esc сюда не доходит: стек гасит нажатие на `document`
  // в фазе перехвата, то есть раньше, чем React доберётся до этого дерева.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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
        aria-describedby={body === undefined ? undefined : bodyId}
        className="w-full max-w-(--size-modal-md) rounded-(--radius-xl) bg-surface-2 p-(--space-6) shadow-lg animate-modal-panel-in"
      >
        <h2 id={titleId} className="text-h1 text-primary">
          {title}
        </h2>

        {body !== undefined && (
          <p id={bodyId} className="text-body text-secondary mt-(--space-3)">
            {body}
          </p>
        )}

        <div className="mt-(--space-6) flex justify-end gap-(--space-3)">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
          <Button ref={confirmRef} variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
