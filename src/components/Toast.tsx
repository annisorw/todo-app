import type { FocusEvent, MouseEvent } from 'react'
import { Button } from './Button'
import { cn } from '../lib/cn'

export type ToastVariant = 'info' | 'success' | 'danger'

export interface ToastProps {
  variant: ToastVariant
  message: string
  actionLabel?: string
  onAction?: () => void
  /** `true` while playing `animate-toast-out`, right before removal. */
  closing: boolean
  onMouseEnter: (event: MouseEvent<HTMLDivElement>) => void
  onMouseLeave: (event: MouseEvent<HTMLDivElement>) => void
  onFocus: (event: FocusEvent<HTMLDivElement>) => void
  onBlur: (event: FocusEvent<HTMLDivElement>) => void
}

/** Colour is never the only channel (spec 7) — each variant also gets its own glyph. */
const VARIANT_ICON: Record<ToastVariant, string> = {
  info: 'ℹ',
  success: '✓',
  danger: '!',
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  info: 'border-surface-border-strong text-primary',
  success: 'border-success text-success',
  danger: 'border-danger text-danger',
}

/**
 * design-spec 3.17. Presentational only: the queue, the 6s timer and the
 * pause-on-hover/focus logic live in `state/ToastProvider.tsx`, which also
 * owns `lastRemoved` wiring — this component never stores its own copy of
 * anything undo-able.
 */
export function Toast({
  variant,
  message,
  actionLabel,
  onAction,
  closing,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
}: ToastProps) {
  return (
    <div
      role={variant === 'danger' ? 'alert' : 'status'}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      className={cn(
        'flex items-center gap-(--space-3) rounded-full border bg-surface-2 py-(--space-3) pl-(--space-4) pr-(--space-3) shadow-lg backdrop-blur-(--blur-surface)',
        VARIANT_CLASSES[variant],
        closing ? 'animate-toast-out' : 'animate-toast-in',
      )}
    >
      <span aria-hidden="true" className="shrink-0 text-label">
        {VARIANT_ICON[variant]}
      </span>
      <p className="flex-1 text-body text-primary">{message}</p>
      {actionLabel !== undefined && onAction !== undefined && (
        <Button variant="primary" size="sm" onClick={onAction} className="shrink-0">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
