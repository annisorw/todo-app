import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import type { DueDateStatus } from '../domain/dueDate'
import { cn } from '../lib/cn'

export type ChipVariant = 'static' | 'interactive'

export interface DueDateChipProps {
  status: DueDateStatus
  /**
   * The chip's visible label. Formatting lives in `domain/dueDate.ts`
   * (`describeDueDate`) — this component only renders what it's given. For
   * `none` and `invalid`, that module intentionally returns an empty label
   * because the spec gives no copy for those two; this component supplies its
   * own fixed text for them instead.
   */
  label: string
  /** `static` renders an inert `<span>`; `interactive` renders a focusable `<button>` (design-spec v1.1, section 7). */
  variant?: ChipVariant
  /** Only meaningful when `variant="interactive"`: is the attached picker open? */
  expanded?: boolean
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  className?: string
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const BASE_CLASSES =
  'inline-flex h-6 items-center gap-1 rounded-full px-2 text-caption transition-colors duration-(--duration-fast) ease-standard'

/** design-spec 3.13 + v1.1 — `set`/`due-today`/`overdue` map to the domain's `upcoming`/`today`/`overdue`; `none` is the dashed "Срок" placeholder. */
export function DueDateChip({ status, label, variant = 'static', expanded = false, onClick, className }: DueDateChipProps) {
  const isInteractive = variant === 'interactive'
  const isOpen = isInteractive && expanded

  if (status === 'none') {
    return (
      <Tag
        isInteractive={isInteractive}
        expanded={expanded}
        onClick={onClick}
        className={cn(BASE_CLASSES, 'border border-dashed border-surface-border-strong text-tertiary', className)}
      >
        Срок
      </Tag>
    )
  }

  if (status === 'invalid') {
    return (
      <Tag
        isInteractive={isInteractive}
        expanded={expanded}
        onClick={onClick}
        className={cn(BASE_CLASSES, 'border border-transparent text-danger', className)}
      >
        Неверная дата
      </Tag>
    )
  }

  if (status === 'overdue') {
    return (
      <Tag
        isInteractive={isInteractive}
        expanded={expanded}
        onClick={onClick}
        style={isOpen ? { backgroundImage: 'var(--gradient-accent-soft)' } : undefined}
        className={cn(BASE_CLASSES, 'text-overdue', isOpen ? 'border border-accent-text' : 'border border-transparent', className)}
      >
        <ClockIcon />
        {label}
      </Tag>
    )
  }

  if (status === 'today') {
    return (
      <Tag
        isInteractive={isInteractive}
        expanded={expanded}
        onClick={onClick}
        style={{
          // design-spec 3.13: weight 550 for `due-today`. No standalone weight-550
          // Tailwind utility exists (it only ships bundled inside the type-scale
          // composites), so this one value stays local to the component.
          fontWeight: 550,
          ...(isOpen ? { backgroundImage: 'var(--gradient-accent-soft)' } : {}),
        }}
        className={cn(BASE_CLASSES, 'text-primary', isOpen ? 'border border-accent-text' : 'border border-transparent', className)}
      >
        {label}
      </Tag>
    )
  }

  // status === 'upcoming' ('set' in design-spec prose)
  return (
    <Tag
      isInteractive={isInteractive}
      expanded={expanded}
      onClick={onClick}
      style={isOpen ? { backgroundImage: 'var(--gradient-accent-soft)' } : undefined}
      className={cn(BASE_CLASSES, 'text-secondary', isOpen ? 'border border-accent-text' : 'border border-transparent', className)}
    >
      {label}
    </Tag>
  )
}

interface TagProps {
  isInteractive: boolean
  expanded: boolean
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  className: string
  style?: CSSProperties
  children: ReactNode
}

/** Swaps element type by variant: a real `<button>` when interactive, an inert `<span>` otherwise. */
function Tag({ isInteractive, expanded, onClick, className, style, children }: TagProps) {
  if (isInteractive) {
    return (
      <button type="button" aria-expanded={expanded} onClick={onClick} style={style} className={className}>
        {children}
      </button>
    )
  }

  return (
    <span style={style} className={className}>
      {children}
    </span>
  )
}
