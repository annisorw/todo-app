import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '../lib/cn'

export interface DragHandleProps extends ComponentPropsWithoutRef<'button'> {
  /** The task's own text — builds the required `aria-label="Переместить задачу: {title}"` (design-spec 3.14). */
  taskTitle: string
}

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
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
 * `cursor: grab` → `grabbing`. This is the presentational slot only: the
 * pointer drag and the keyboard "grab → ↑/↓ → drop" mode (design-spec 6.4)
 * are [FELA-17](/FELA/issues/FELA-17)'s. `TaskRow` wires this in with no
 * drag-specific props yet; FELA-17 attaches its handlers through the
 * standard `ComponentPropsWithoutRef<'button'>` spread without touching this
 * component.
 */
export const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(function DragHandle(
  { taskTitle, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Переместить задачу: ${taskTitle}`}
      className={cn(
        'inline-flex size-11 shrink-0 cursor-grab items-center justify-center rounded-md text-tertiary transition-colors duration-(--duration-fast) ease-standard hover:text-secondary active:cursor-grabbing sm:size-8',
        className,
      )}
      {...rest}
    >
      <GripIcon />
    </button>
  )
})
