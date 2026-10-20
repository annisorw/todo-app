import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'

/** `static` renders an inert `<span>`; `interactive` renders a focusable `<button>` (design-spec v1.1, section 7). */
export type ChipVariant = 'static' | 'interactive'

export const CHIP_BASE_CLASSES =
  'inline-flex h-6 items-center gap-1 rounded-full px-2 text-caption transition-colors duration-(--duration-fast) ease-standard'

export const CHIP_OPEN_BORDER_CLASS = 'border border-accent-text'
export const CHIP_CLOSED_BORDER_CLASS = 'border border-transparent'
export const CHIP_OPEN_BACKGROUND_STYLE: CSSProperties = { backgroundImage: 'var(--gradient-accent-soft)' }

export interface ChipTagProps extends Omit<ComponentPropsWithoutRef<'button'>, 'className' | 'style' | 'children'> {
  isInteractive: boolean
  expanded: boolean
  className: string
  style?: CSSProperties
  children: ReactNode
}

/** Swaps element type by variant: a real `<button>` when interactive, an inert `<span>` otherwise. */
export const ChipTag = forwardRef<HTMLButtonElement, ChipTagProps>(function ChipTag(
  { isInteractive, expanded, className, style, children, ...rest },
  ref,
) {
  if (isInteractive) {
    return (
      <button type="button" ref={ref} aria-expanded={expanded} style={style} className={className} {...rest}>
        {children}
      </button>
    )
  }

  return (
    <span style={style} className={className}>
      {children}
    </span>
  )
})
