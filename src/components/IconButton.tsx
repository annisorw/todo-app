import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  /** Design spec 3.6: an icon button is meaningless to a screen reader without one. */
  'aria-label': string
  title?: string
  children: ReactNode
}

/**
 * Design spec 3.6: 40x40 on desktop, 44x44 on mobile (below the 640px
 * breakpoint). Shares the hover/active/focus-visible states with `Button`
 * (3.5) through the same tokens; `Button` itself is out of scope here.
 */
export function IconButton({
  children,
  className,
  title,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      title={title ?? props['aria-label']}
      className={cn(
        'inline-flex size-10 max-sm:size-11 shrink-0 items-center justify-center rounded-(--radius-sm) text-secondary transition-colors duration-(--duration-fast) ease-(--ease-standard) hover:bg-surface-hover hover:text-primary active:bg-surface-2 disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
