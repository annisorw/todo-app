import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'
import { useMediaQuery } from '../lib/useMediaQuery'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  checked: boolean
  /**
   * Accessible name — the task's own text (design-spec 3.10). Nothing here
   * renders it visibly; the caller shows the task text next to the circle.
   */
  label: string
}

// Path length of the checkmark below (two segments, ~4.24 + ~9.22), rounded
// up slightly. `task-check` (motion table, section 5) draws it in via
// `stroke-dashoffset`, which needs a dasharray at least this long to fully
// hide the stroke at the "unchecked" end of the transition.
const CHECK_PATH_LENGTH = 13.5

function CheckIcon({ checked, animated }: { checked: boolean; animated: boolean }) {
  return (
    // `relative` (no offset) puts this flex item in the same positioned
    // painting step as the fill layer below, so DOM order — fill, then
    // icon — decides stacking and the checkmark actually ends up on top.
    // Without it, flex items paint as inline-blocks (CSS Flexbox §"Flex
    // Item Z-Ordering"), a step that runs *before* positioned descendants
    // regardless of DOM order, so the `position: absolute` fill painted
    // over the checkmark no matter which one came first in the JSX.
    <svg viewBox="0 0 16 16" className="relative size-3" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5L6.5 11.5L12.5 4.5"
        style={{
          stroke: 'var(--color-accent-contrast)',
          strokeDasharray: CHECK_PATH_LENGTH,
          strokeDashoffset: checked ? 0 : CHECK_PATH_LENGTH,
          transition: animated ? `stroke-dashoffset 240ms var(--ease-spring)` : 'none',
        }}
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
 * 32×32 desktop / 44×44 mobile box, still above the 24×24 WCAG 2.2 floor
 * though smaller than `IconButton`'s 40/44, with the small circle centered
 * inside it. The input uses `opacity-0` (not `display: none`)
 * so it stays focusable, and the global `:focus-visible` ring in `base.css`
 * lands on that real hit area.
 *
 * `task-check` (motion table, section 5) — checking/unchecking runs all
 * three parts at 240ms / `--ease-spring`: the gradient fill pops in with
 * `scale(.8→1)`, the checkmark draws in via `stroke-dashoffset`, and
 * `TaskRow`'s title strikethrough grows `width` 0→100% alongside it. Under
 * `prefers-reduced-motion` all three jump straight to their end state
 * (`useMediaQuery`, matching `AuroraBackground`'s pattern) — the blanket
 * reduced-motion rule in base.css only shortens transitions, which would
 * still leave a (very fast) scale/draw instead of the instant swap the
 * audit calls for.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { checked, label, disabled, className, ...rest },
  ref,
) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const animated = !prefersReducedMotion

  return (
    <span className={cn('relative inline-flex size-11 shrink-0 items-center justify-center sm:size-8', className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...rest}
      />
      <span
        aria-hidden="true"
        style={{ borderWidth: '1.5px' }}
        className={cn(
          'pointer-events-none relative inline-flex size-(--size-checkbox) items-center justify-center rounded-full border-control-border transition-colors duration-(--duration-fast) ease-standard',
          checked ? 'border-transparent shadow-glow-accent' : 'peer-hover:border-text-tertiary',
          disabled && 'opacity-45',
        )}
      >
        <span
          aria-hidden="true"
          style={{
            // Flush with the border's outer edge (border-box), not the inner
            // padding box an absolute `inset-0` child would otherwise sit in
            // — the fill has to show through the transparent checked border
            // the same way a plain background on this element used to. No
            // `overflow-hidden` on the parent to crop this: that clips at
            // the *padding* box, eating this negative inset and leaving a
            // ring of page background where the transparent border is. The
            // fill is its own `rounded-full` circle that never grows past
            // this box, so nothing needs clipping anyway.
            inset: '-1.5px',
            backgroundImage: 'var(--gradient-accent)',
            opacity: checked ? 1 : 0,
            transform: checked ? 'scale(1)' : 'scale(0.8)',
            transition: animated ? 'opacity 240ms var(--ease-spring), transform 240ms var(--ease-spring)' : 'none',
          }}
          className="absolute rounded-full"
        />
        <CheckIcon checked={checked} animated={animated} />
      </span>
    </span>
  )
})
