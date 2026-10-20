import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { cn } from '../lib/cn'

/**
 * Mirrors `domain/task.ts`'s `Priority` (not imported: that module is being
 * built in a parallel task and isn't on `main` yet). Swap this for a
 * type-only import once it lands — the acceptance criteria allow that, they
 * just forbid importing anything else from `domain/`.
 */
export type Priority = 'none' | 'low' | 'medium' | 'high'

export type ChipVariant = 'static' | 'interactive'

export interface PriorityChipProps {
  priority: Priority
  /** `static` renders an inert `<span>`; `interactive` renders a focusable `<button>` (design-spec v1.1, section 7). */
  variant?: ChipVariant
  /** Only meaningful when `variant="interactive"`: is the attached picker open? */
  expanded?: boolean
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  className?: string
}

/** Glyph + colour + label — all three always together, never colour alone (design-spec 3.12). */
const LEVEL: Record<Exclude<Priority, 'none'>, { glyph: string; label: string; colorClass: string }> = {
  high: { glyph: '▲', label: 'Высокий', colorClass: 'text-priority-high' },
  medium: { glyph: '■', label: 'Средний', colorClass: 'text-priority-med' },
  low: { glyph: '▼', label: 'Низкий', colorClass: 'text-priority-low' },
}

const BASE_CLASSES =
  'inline-flex h-6 items-center gap-1 rounded-full px-2 text-caption transition-colors duration-(--duration-fast) ease-standard'

/** design-spec 3.12 + v1.1 — three levels (glyph + colour + label), `none` renders the dashed "Приоритет" placeholder. */
export function PriorityChip({
  priority,
  variant = 'static',
  expanded = false,
  onClick,
  className,
}: PriorityChipProps) {
  const isInteractive = variant === 'interactive'
  const isOpen = isInteractive && expanded

  if (priority === 'none') {
    return (
      <Tag
        isInteractive={isInteractive}
        expanded={expanded}
        onClick={onClick}
        className={cn(BASE_CLASSES, 'border border-dashed border-surface-border-strong text-tertiary', className)}
      >
        Приоритет
      </Tag>
    )
  }

  const { glyph, label, colorClass } = LEVEL[priority]

  return (
    <Tag
      isInteractive={isInteractive}
      expanded={expanded}
      onClick={onClick}
      style={isOpen ? { backgroundImage: 'var(--gradient-accent-soft)' } : undefined}
      className={cn(
        BASE_CLASSES,
        colorClass,
        isOpen ? 'border border-accent-text' : 'border border-transparent',
        className,
      )}
    >
      <span aria-hidden="true">{glyph}</span>
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
