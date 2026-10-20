import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import type { Priority } from '../domain/task'
import {
  CHIP_BASE_CLASSES,
  CHIP_CLOSED_BORDER_CLASS,
  CHIP_OPEN_BACKGROUND_STYLE,
  CHIP_OPEN_BORDER_CLASS,
  type ChipVariant,
} from './chip'
import { ChipTag } from './ChipTag'
import { cn } from '../lib/cn'

export type { ChipVariant }

export interface PriorityChipProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'style' | 'aria-expanded'> {
  priority: Priority
  variant?: ChipVariant
  /** Only meaningful when `variant="interactive"`: is the attached picker open? */
  expanded?: boolean
}

/** Glyph + colour + label — all three always together, never colour alone (design-spec 3.12). */
const LEVEL: Record<Exclude<Priority, 'none'>, { glyph: string; label: string; colorClass: string }> = {
  high: { glyph: '▲', label: 'Высокий', colorClass: 'text-priority-high' },
  medium: { glyph: '■', label: 'Средний', colorClass: 'text-priority-med' },
  low: { glyph: '▼', label: 'Низкий', colorClass: 'text-priority-low' },
}

/** design-spec 3.12 + v1.1 — three levels (glyph + colour + label), `none` renders the dashed "Приоритет" placeholder. */
export const PriorityChip = forwardRef<HTMLButtonElement, PriorityChipProps>(function PriorityChip(
  { priority, variant = 'static', expanded = false, className, ...rest },
  ref,
) {
  const isInteractive = variant === 'interactive'
  const isOpen = isInteractive && expanded

  if (priority === 'none') {
    return (
      <ChipTag
        ref={ref}
        isInteractive={isInteractive}
        expanded={expanded}
        className={cn(CHIP_BASE_CLASSES, 'border border-dashed border-surface-border-strong text-tertiary', className)}
        {...rest}
      >
        Приоритет
      </ChipTag>
    )
  }

  const { glyph, label, colorClass } = LEVEL[priority]

  return (
    <ChipTag
      ref={ref}
      isInteractive={isInteractive}
      expanded={expanded}
      style={isOpen ? CHIP_OPEN_BACKGROUND_STYLE : undefined}
      className={cn(CHIP_BASE_CLASSES, colorClass, isOpen ? CHIP_OPEN_BORDER_CLASS : CHIP_CLOSED_BORDER_CLASS, className)}
      {...rest}
    >
      <span aria-hidden="true">{glyph}</span>
      {label}
    </ChipTag>
  )
})
