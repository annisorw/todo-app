import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'
import { CHIP_INTERACTIVE_TOUCH_TARGET_CLASSES } from './chip'
import { cn } from '../lib/cn'

export interface ChipTagProps extends Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'style' | 'children'> {
  isInteractive: boolean
  expanded: boolean
  className: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * Swaps element type by variant: a real `<button>` when interactive, an
 * inert `<span>` otherwise. `id` is let through on both branches — unlike
 * button-only props (`onClick`, `aria-expanded`, …), an id is meaningful on
 * an inert `<span>` too: `TaskRow` (FELA-15) points the row checkbox's
 * `aria-labelledby` at a static mobile chip's id to compose its accessible
 * name (acceptance criterion 25). This is the live requirement the FELA-55
 * warning's own docstring left for whoever hit it first.
 *
 * The interactive branch is also the one place that knows a chip is a tap
 * target, so the mobile 44 px hit area lives here rather than in each caller —
 * `PriorityChip` and `DueDateChip` get it by being interactive, and the static
 * chips `TaskRow` renders on mobile stay untouched (design-spec 3.12).
 */
export const ChipTag = forwardRef<HTMLButtonElement, ChipTagProps>(function ChipTag(
  { isInteractive, expanded, className, style, children, id, ...rest },
  ref,
) {
  if (isInteractive) {
    return (
      <button
        type="button"
        ref={ref}
        id={id}
        aria-expanded={expanded}
        style={style}
        className={cn(className, CHIP_INTERACTIVE_TOUCH_TARGET_CLASSES)}
        {...rest}
      >
        {children}
      </button>
    )
  }

  const ignoredKeys = Object.keys(rest)
  if (ignoredKeys.length > 0 && import.meta.env.DEV) {
    console.warn(
      `ChipTag: a static chip ignores button-only prop(s) ${ignoredKeys.map((key) => `"${key}"`).join(', ')} — they are not rendered on the <span>.`,
    )
  }

  return (
    <span id={id} style={style} className={className}>
      {children}
    </span>
  )
})
