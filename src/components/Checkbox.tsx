import type { InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  checked: boolean
  /**
   * Accessible name — the task's own text (design-spec 3.10). Nothing here
   * renders it visibly; the caller shows the task text next to the circle.
   */
  label: string
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        style={{ stroke: 'var(--color-accent-contrast)' }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * design-spec 3.10 — a 22 px circle (26 px mobile via `--size-checkbox`) with
 * a 1.5 px border. 22/26 px is the *painted* size; on its own it would sit
 * under the accessibility section's 24×24 WCAG 2.2 floor and well under the
 * 32/44 px target guidance, so the native input's hit area is the larger
 * 32×32 desktop / 44×44 mobile box (matching `IconButton`), with the small
 * circle centered inside it. The input uses `opacity-0` (not `display: none`)
 * so it stays focusable, and the global `:focus-visible` ring in `base.css`
 * lands on that real hit area.
 */
export function Checkbox({ checked, label, disabled, className, ...rest }: CheckboxProps) {
  return (
    <span className={cn('relative inline-flex size-11 shrink-0 items-center justify-center sm:size-8', className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{
          borderWidth: '1.5px',
          ...(checked ? { backgroundImage: 'var(--gradient-accent)' } : {}),
        }}
        className={cn(
          'pointer-events-none inline-flex size-(--size-checkbox) items-center justify-center rounded-full border-control-border transition-colors duration-(--duration-fast) ease-standard',
          checked ? 'border-transparent shadow-glow-accent' : 'peer-hover:border-text-tertiary',
          disabled && 'opacity-45',
        )}
      >
        {checked && <CheckIcon />}
      </span>
    </span>
  )
}
