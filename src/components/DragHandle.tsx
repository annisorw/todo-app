import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../lib/cn'

export interface DragHandleProps extends ComponentPropsWithoutRef<'button'> {
  /** The task's own text — builds the required `aria-label="Переместить задачу: {title}"` (design-spec 3.14). */
  taskTitle: string
  /** The row is held in keyboard grab mode (design-spec 6.4): `aria-grabbed`, and the cursor stays `grabbing`. */
  isGrabbed?: boolean
  /** The row can actually be dragged — adds `touch-action: none` so a touch-drag off the handle isn't taken for a scroll. */
  isDraggable?: boolean
}

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-5" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="3" r="1.25" />
      <circle cx="11" cy="3" r="1.25" />
      <circle cx="5" cy="8" r="1.25" />
      <circle cx="11" cy="8" r="1.25" />
      <circle cx="5" cy="13" r="1.25" />
      <circle cx="11" cy="13" r="1.25" />
    </svg>
  )
}

/**
 * design-spec 3.14 — 20px glyph, 32×32 desktop / 44×44 mobile hit area,
 * `cursor: grab` → `grabbing`. Both ways of moving a row start here: the
 * pointer drag (`TaskRow` starts Framer Motion's drag controls from this
 * button's `onPointerDown`) and the keyboard grab mode of design-spec 6.4,
 * whose handlers arrive through the standard button prop spread.
 *
 * `aria-grabbed` is deprecated in ARIA 1.1 with no replacement that works
 * on a plain list, and the spec names it explicitly (6.4). It is the
 * belt-and-braces half here anyway: the announcement in `LiveRegion` is
 * what actually carries every step of the move.
 */
export const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(function DragHandle(
  { taskTitle, isGrabbed = false, isDraggable = false, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Переместить задачу: ${taskTitle}`}
      aria-grabbed={isDraggable ? isGrabbed : undefined}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-md transition-colors duration-(--duration-fast) ease-standard sm:size-8',
        isGrabbed ? 'cursor-grabbing text-accent-text' : 'cursor-grab text-tertiary hover:text-secondary active:cursor-grabbing',
        isDraggable && 'touch-none',
        className,
      )}
      {...rest}
    >
      <GripIcon />
    </button>
  )
})
