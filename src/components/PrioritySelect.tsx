import { motion } from 'framer-motion'
import { useId, useRef, useState } from 'react'
import type { Priority } from '../domain/task'
import { announce } from '../lib/announce'
import { cn } from '../lib/cn'
import { useMediaQuery } from '../lib/useMediaQuery'
import { Menu } from './Menu'
import type { MenuItemConfig } from './Menu'
import { PriorityChip } from './PriorityChip'

export interface PrioritySelectProps {
  value: Priority
  onChange: (value: Priority) => void
  className?: string
  /** Forwarded to the trigger chip — the desktop row quick-path uses this for roving tabindex. */
  tabIndex?: number
  /**
   * Which edge the menu hangs from. `'start'` (default) covers every caller
   * where the chip sits away from the viewport's right edge (`Composer`,
   * the desktop `TaskRow` quick-path). `'end'` is for `TaskEditorSheet`,
   * where the chip is the lone right-aligned child of a `justify-between`
   * row (design-spec 3.11a) — a left-anchored menu there can run off a
   * 390px screen (FELA-124).
   */
  align?: 'start' | 'end'
}

const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low', 'none']

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
  none: 'Без приоритета',
}

const PRIORITY_GLYPH: Partial<Record<Priority, string>> = {
  high: '▲',
  medium: '■',
  low: '▼',
}

/**
 * design-spec 3.12 — `Menu` of four items (the three levels + "без
 * приоритета"), current value checked. Pure `value`/`onChange`, no store
 * access (architecture, section 2): `Composer`, `TaskEditor` and the
 * desktop row quick-path all drive the same component.
 */
export function PrioritySelect({ value, onChange, className, tabIndex, align = 'start' }: PrioritySelectProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const menuId = useId()

  function handleSelect(next: Priority) {
    onChange(next)
    announce(next === 'none' ? 'Приоритет убран' : `Приоритет: ${PRIORITY_LABEL[next].toLowerCase()}`)
  }

  const items: MenuItemConfig[] = PRIORITY_ORDER.map((priority) => ({
    key: priority,
    checked: priority === value,
    label: (
      <>
        {PRIORITY_GLYPH[priority] && <span aria-hidden="true">{PRIORITY_GLYPH[priority]}</span>}
        {PRIORITY_LABEL[priority]}
      </>
    ),
    onSelect: () => handleSelect(priority),
  }))

  return (
    <div className="relative inline-flex">
      <PriorityChip
        ref={anchorRef}
        priority={value}
        variant="interactive"
        expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className={className}
        tabIndex={tabIndex}
      />
      {open && (
        // design-spec motion table (section 5) only names `popover-in` — no
        // `-out` counterpart — so closing is an instant unmount, not an
        // exit animation; no `AnimatePresence` needed for that reason.
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'absolute top-full z-(--z-dropdown) mt-(--space-2)',
            align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
          )}
        >
          <Menu id={menuId} items={items} anchorRef={anchorRef} onClose={() => setOpen(false)} />
        </motion.div>
      )}
    </div>
  )
}
