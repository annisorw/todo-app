import { motion } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, RefObject } from 'react'
import { describeDueDate, toDateKey } from '../domain/dueDate'
import { announce } from '../lib/announce'
import { cn } from '../lib/cn'
import { useDismissable } from '../lib/useDismissable'
import { useMediaQuery } from '../lib/useMediaQuery'
import { useOutsideClick } from '../lib/useOutsideClick'
import { DueDateChip } from './DueDateChip'

export interface DueDatePickerProps {
  value: string | null
  onChange: (value: string | null) => void
  className?: string
  /** Forwarded to the trigger chip — the desktop row quick-path uses this for roving tabindex. */
  tabIndex?: number
  /**
   * Which edge the panel hangs from. `'start'` (default) covers every
   * caller where the chip sits away from the viewport's right edge
   * (`Composer`, the desktop `TaskRow` quick-path). `'end'` is for
   * `TaskEditorSheet`, where the chip is the lone right-aligned child of a
   * `justify-between` row (design-spec 3.11a) — a left-anchored 224px panel
   * there runs off a 390px screen (FELA-124).
   */
  align?: 'start' | 'end'
}

interface Preset {
  key: string
  label: string
  resolve: (today: Date) => string | null
}

/** Adds whole calendar days in local time — ms arithmetic would drift across a DST change. */
function addLocalDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

const PRESETS: Preset[] = [
  { key: 'today', label: 'Сегодня', resolve: (today) => toDateKey(today) },
  { key: 'tomorrow', label: 'Завтра', resolve: (today) => toDateKey(addLocalDays(today, 1)) },
  { key: 'nextWeek', label: 'Через неделю', resolve: (today) => toDateKey(addLocalDays(today, 7)) },
  { key: 'clear', label: 'Убрать срок', resolve: () => null },
]

function announceDueDate(nextValue: string | null, today: Date): void {
  if (nextValue === null) {
    announce('Срок убран')
    return
  }
  const { label } = describeDueDate(nextValue, toDateKey(today))
  announce(`Срок: ${label.toLowerCase()}`)
}

interface DatePanelProps {
  id: string
  value: string | null
  today: Date
  anchorRef: RefObject<HTMLButtonElement | null>
  onCommit: (value: string | null) => void
  onClose: () => void
  prefersReducedMotion: boolean
  align: 'start' | 'end'
}

/**
 * Only mounted while the popover is open, so both dismiss hooks run for exactly
 * its open lifetime (same contract as `Menu`) instead of needing an `open` flag
 * threaded through them. Esc arrives from the app-wide stack
 * (`lib/dismissStack.ts`), so the panel takes one Esc and the layer underneath
 * — a dialog, the row editor — keeps the next one.
 *
 * design-spec §7 — nested popups carry their own Tab trap and initial focus,
 * same contract as `Menu`: focus goes to the date input on open, and Tab from
 * the last preset (or Shift+Tab from the input) wraps within the panel
 * instead of escaping to whatever follows the trigger chip in the host's tab
 * order (e.g. the priority chip, when this opens inside `TaskEditor`).
 */
function DatePanel({ id, value, today, anchorRef, onCommit, onClose, prefersReducedMotion, align }: DatePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const presetRefs = useRef<Array<HTMLButtonElement | null>>([])

  useDismissable({ onDismiss: onClose, returnFocusTo: anchorRef })
  useOutsideClick({ onOutsideClick: onClose, inside: [panelRef, anchorRef] })

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleNativeChange(event: ChangeEvent<HTMLInputElement>) {
    onCommit(event.target.value === '' ? null : event.target.value)
  }

  function handlePreset(preset: Preset) {
    onCommit(preset.resolve(today))
    onClose()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return
    const lastPreset = presetRefs.current[presetRefs.current.length - 1]
    if (event.shiftKey && document.activeElement === inputRef.current) {
      event.preventDefault()
      lastPreset?.focus()
    } else if (!event.shiftKey && document.activeElement === lastPreset) {
      event.preventDefault()
      inputRef.current?.focus()
    }
  }

  return (
    <motion.div
      ref={panelRef}
      id={id}
      onKeyDown={handleKeyDown}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'absolute top-full z-(--z-dropdown) mt-(--space-2) flex w-56 flex-col gap-(--space-3) rounded-(--radius-md) border border-surface-border bg-surface-2 p-(--space-3) shadow-md',
        align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
      )}
    >
      <input
        ref={inputRef}
        type="date"
        value={value ?? ''}
        onChange={handleNativeChange}
        className="h-11 rounded-(--radius-sm) border border-surface-border-strong bg-surface-1 px-(--space-2) text-body text-primary sm:h-10"
      />
      <div className="flex flex-col gap-(--space-1)">
        {PRESETS.map((preset, index) => (
          <button
            key={preset.key}
            type="button"
            ref={(el) => {
              presetRefs.current[index] = el
            }}
            onClick={() => handlePreset(preset)}
            className={cn(
              'flex min-h-11 items-center rounded-(--radius-sm) px-(--space-3) py-(--space-2) text-left text-label transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-hover sm:min-h-0',
              preset.key === 'clear' ? 'text-danger' : 'text-primary',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

/**
 * design-spec 3.13 — native `input[type=date]` plus the four presets.
 * Same `value`/`onChange` contract as `PrioritySelect`: `Composer`,
 * `TaskEditor` and the desktop row quick-path share one implementation.
 */
export function DueDatePicker({ value, onChange, className, tabIndex, align = 'start' }: DueDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [today] = useState(() => new Date())
  const anchorRef = useRef<HTMLButtonElement>(null)
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const panelId = useId()

  const { status, label } = describeDueDate(value, toDateKey(today))

  function handleCommit(nextValue: string | null) {
    onChange(nextValue)
    announceDueDate(nextValue, today)
  }

  return (
    <div className="relative inline-flex">
      <DueDateChip
        ref={anchorRef}
        status={status}
        label={label}
        variant="interactive"
        expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={className}
        tabIndex={tabIndex}
      />
      {open && (
        <DatePanel
          id={panelId}
          value={value}
          today={today}
          anchorRef={anchorRef}
          onCommit={handleCommit}
          onClose={() => setOpen(false)}
          prefersReducedMotion={prefersReducedMotion}
          align={align}
        />
      )}
    </div>
  )
}
