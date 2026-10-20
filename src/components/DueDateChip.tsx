import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'
import type { DueDateStatus } from '../domain/dueDate'
import {
  CHIP_BASE_CLASSES,
  CHIP_CLOSED_BORDER_CLASS,
  CHIP_OPEN_BACKGROUND_STYLE,
  CHIP_OPEN_BORDER_CLASS,
  ChipTag,
  type ChipVariant,
} from './chip'
import { cn } from '../lib/cn'

export type { ChipVariant }

export interface DueDateChipProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'style' | 'aria-expanded'> {
  status: DueDateStatus
  /**
   * The chip's visible label. Formatting lives in `domain/dueDate.ts`
   * (`describeDueDate`) — this component only renders what it's given. For
   * `none` and `invalid`, that module intentionally returns an empty label
   * because the spec gives no copy for those two; this component supplies its
   * own fixed text for them instead.
   */
  label: string
  variant?: ChipVariant
  /** Only meaningful when `variant="interactive"`: is the attached picker open? */
  expanded?: boolean
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface StatusPresentation {
  content: (label: string) => ReactNode
  colorClass: string
  borderClass: string
  fontWeight?: number
  /** Whether the open-picker gradient/border applies to this status (`none`/`invalid` never open a picker). */
  respondsToOpen?: boolean
}

/** design-spec 3.13 + v1.1 — maps the domain's `DueDateStatus` to colour, icon and border per state. */
const STATUS_PRESENTATION: Record<DueDateStatus, StatusPresentation> = {
  none: {
    content: () => 'Срок',
    colorClass: 'text-tertiary',
    borderClass: 'border border-dashed border-surface-border-strong',
  },
  invalid: {
    content: () => 'Неверная дата',
    colorClass: 'text-danger',
    borderClass: CHIP_CLOSED_BORDER_CLASS,
  },
  overdue: {
    content: (label) => (
      <>
        <ClockIcon />
        {label}
      </>
    ),
    colorClass: 'text-overdue',
    borderClass: CHIP_CLOSED_BORDER_CLASS,
    respondsToOpen: true,
  },
  today: {
    content: (label) => label,
    colorClass: 'text-primary',
    borderClass: CHIP_CLOSED_BORDER_CLASS,
    // design-spec 3.13: weight 550 for `due-today`. No standalone weight-550
    // Tailwind utility exists (it only ships bundled inside the type-scale
    // composites), so this one value stays local to the component.
    fontWeight: 550,
    respondsToOpen: true,
  },
  upcoming: {
    content: (label) => label,
    colorClass: 'text-secondary',
    borderClass: CHIP_CLOSED_BORDER_CLASS,
    respondsToOpen: true,
  },
}

/** design-spec 3.13 + v1.1 — `set`/`due-today`/`overdue` map to the domain's `upcoming`/`today`/`overdue`; `none` is the dashed "Срок" placeholder. */
export const DueDateChip = forwardRef<HTMLButtonElement, DueDateChipProps>(function DueDateChip(
  { status, label, variant = 'static', expanded = false, className, ...rest },
  ref,
) {
  const isInteractive = variant === 'interactive'
  const presentation = STATUS_PRESENTATION[status]
  const isOpen = isInteractive && expanded && (presentation.respondsToOpen ?? false)

  const style: CSSProperties | undefined =
    presentation.fontWeight !== undefined || isOpen
      ? {
          ...(presentation.fontWeight !== undefined ? { fontWeight: presentation.fontWeight } : {}),
          ...(isOpen ? CHIP_OPEN_BACKGROUND_STYLE : {}),
        }
      : undefined

  return (
    <ChipTag
      ref={ref}
      isInteractive={isInteractive}
      expanded={expanded}
      style={style}
      className={cn(
        CHIP_BASE_CLASSES,
        presentation.colorClass,
        isOpen ? CHIP_OPEN_BORDER_CLASS : presentation.borderClass,
        className,
      )}
      {...rest}
    >
      {presentation.content(label)}
    </ChipTag>
  )
})
