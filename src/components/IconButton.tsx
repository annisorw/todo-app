import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { BUTTON_VARIANT_CLASSES, type ButtonVariant } from './button-variant'
import { cn } from '../lib/cn'

export interface IconButtonProps extends ComponentPropsWithoutRef<'button'> {
  icon: ReactNode
  variant?: ButtonVariant
  loading?: boolean
  /**
   * Required on purpose (design-spec 3.6): an icon-only button with no
   * `aria-label` has no accessible name, so the prop is non-optional and a
   * missing one fails typechecking instead of shipping a silent a11y bug.
   */
  'aria-label': string
}

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6V2z"
      />
    </svg>
  )
}

/** design-spec 3.6 — 44 px on mobile (default), 40 px from the 640 px breakpoint up. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, variant = 'ghost', loading = false, disabled, className, ...rest },
  ref,
) {
  const isDisabled = disabled || loading

  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-(--duration-fast) ease-standard disabled:cursor-not-allowed disabled:opacity-45 sm:size-10',
        BUTTON_VARIANT_CLASSES[variant],
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex size-4 items-center justify-center">
        {loading ? <Spinner /> : icon}
      </span>
    </button>
  )
})
