import type { ComponentPropsWithoutRef } from 'react'
import { BUTTON_VARIANT_CLASSES, type ButtonVariant } from './button-variant'
import { cn } from '../lib/cn'

export type { ButtonVariant }
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Spinner replaces nothing — the label stays and the button's width never jumps. */
  loading?: boolean
}

/** design-spec 3.5 — sm 32 / md 40 / lg 48. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3',
  md: 'h-10 px-4',
  lg: 'h-12 px-5',
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

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type="button"
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-sm text-label transition-colors duration-(--duration-fast) ease-standard disabled:cursor-not-allowed disabled:opacity-45',
        SIZE_CLASSES[size],
        BUTTON_VARIANT_CLASSES[variant],
        className,
      )}
    >
      {/* Fixed-size slot: loading never changes the button's width. */}
      <span className="inline-flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
        {loading && <Spinner />}
      </span>
      <span>{children}</span>
    </button>
  )
}
