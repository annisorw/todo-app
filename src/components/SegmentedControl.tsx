import { useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { useMediaQuery } from '../lib/useMediaQuery'

export interface SegmentedControlOption {
  id: string
  label: string
  count: number
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[]
  selectedId: string
  onSelect: (id: string) => void
  'aria-label': string
  className?: string
}

/**
 * Design-spec 3.9 — `role="tablist"` / `role="tab"` with roving tabindex:
 * only the selected tab is a Tab stop, ←/→ move focus and selection
 * together (ARIA "automatic activation" tabs pattern), Home/End jump to the
 * ends. The shared `layoutId` on the selected indicator is what makes it
 * slide between segments (`filter-switch`, 200ms) instead of teleporting.
 *
 * A segment with `count === 0` is the `empty` visual state: its counter is
 * muted, but it is never `disabled` nor `aria-disabled` (acceptance
 * criterion 33) — it stays clickable and focusable so an empty filter can
 * still lead to a real `EmptyState`.
 */
export function SegmentedControl({
  options,
  selectedId,
  onSelect,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const baseId = useId()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  function focusAndSelect(id: string) {
    onSelect(id)
    tabRefs.current[id]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = options.findIndex((option) => option.id === selectedId)
    if (index === -1) return

    let target: SegmentedControlOption | undefined
    switch (event.key) {
      case 'ArrowRight':
        target = options[(index + 1) % options.length]
        break
      case 'ArrowLeft':
        target = options[(index - 1 + options.length) % options.length]
        break
      case 'Home':
        target = options[0]
        break
      case 'End':
        target = options[options.length - 1]
        break
      default:
        return
    }

    event.preventDefault()
    if (target) focusAndSelect(target.id)
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        'segmented-control flex w-full items-center gap-(--space-1) overflow-x-auto rounded-(--radius-md) border border-surface-border bg-surface-1 p-(--space-1) sm:w-auto sm:overflow-visible',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.id === selectedId
        const empty = option.count === 0

        return (
          <button
            key={option.id}
            id={`${baseId}-tab-${option.id}`}
            ref={(node) => {
              tabRefs.current[option.id] = node
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(option.id)}
            className={cn(
              'relative flex h-8 min-w-max flex-1 items-center justify-center gap-(--space-1) rounded-(--radius-sm) px-(--space-3) text-label transition-colors duration-(--duration-fast) ease-standard sm:flex-initial',
              selected ? 'text-primary' : 'text-secondary hover:text-primary',
            )}
          >
            {selected && (
              <motion.span
                layoutId="segmented-indicator"
                className="absolute inset-0 -z-10 rounded-(--radius-sm) bg-surface-2"
                transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
              />
            )}
            <span>{option.label}</span>{' '}
            <span className={cn('font-mono text-caption', empty ? 'text-tertiary' : selected ? 'text-primary' : 'text-tertiary')}>
              {option.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
