import { motion } from 'framer-motion'
import { useId, useRef, useState } from 'react'
import type { ChangeEvent, RefObject } from 'react'
import { describeDueDate, toDateKey } from '../domain/dueDate'
import { announce } from '../lib/announce'
import { cn } from '../lib/cn'
import { useMediaQuery } from '../lib/useMediaQuery'
import { usePopoverDismiss } from '../lib/usePopoverDismiss'
import { DueDateChip } from './DueDateChip'

export interface DueDatePickerProps {
  value: string | null
  onChange: (value: string | null) => void
  className?: string
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
}

/**
 * Only mounted while the popover is open, so `usePopoverDismiss` runs for
 * exactly its open lifetime (same contract as `Menu`) instead of needing an
 * `open` flag threaded through the hook itself.
 */
function DatePanel({ id, value, today, anchorRef, onCommit, onClose, prefersReducedMotion }: DatePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  usePopoverDismiss({ onClose, anchorRef, panelRef })

  function handleNativeChange(event: ChangeEvent<HTMLInputElement>) {
    onCommit(event.target.value === '' ? null : event.target.value)
  }

  function handlePreset(preset: Preset) {
    onCommit(preset.resolve(today))
    onClose()
  }

  return (
    <motion.div
      ref={panelRef}
      id={id}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
      className="absolute top-full left-0 z-(--z-dropdown) mt-(--space-2) flex w-56 origin-top-left flex-col gap-(--space-3) rounded-(--radius-md) border border-surface-border bg-surface-2 p-(--space-3) shadow-md"
    >
      <input
        type="date"
        value={value ?? ''}
        onChange={handleNativeChange}
        className="h-10 rounded-(--radius-sm) border border-surface-border-strong bg-surface-1 px-(--space-2) text-body text-primary"
      />
      <div className="flex flex-col gap-(--space-1)">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => handlePreset(preset)}
            className={cn(
              'rounded-(--radius-sm) px-(--space-3) py-(--space-2) text-left text-label transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-hover',
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
export function DueDatePicker({ value, onChange, className }: DueDatePickerProps) {
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
        />
      )}
    </div>
  )
}
