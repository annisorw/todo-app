import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'

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

  const ignoredKeys = Object.keys(rest)
  if (ignoredKeys.length > 0 && import.meta.env.DEV) {
    console.warn(
      `ChipTag: a static chip ignores button-only prop(s) ${ignoredKeys.map((key) => `"${key}"`).join(', ')} — they are not rendered on the <span>.`,
    )
  }

  return (
    <span style={style} className={className}>
      {children}
    </span>
  )
})
