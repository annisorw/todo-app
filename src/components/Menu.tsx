import { useEffect, useRef } from 'react'
import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import { cn } from '../lib/cn'
import { useDismissable } from '../lib/useDismissable'
import { useOutsideClick } from '../lib/useOutsideClick'

export interface MenuItemConfig {
  key: string
  label: ReactNode
  onSelect: () => void
  /** Draws a checkmark in the glyph slot — the picker's currently selected value. */
  checked?: boolean
  variant?: 'default' | 'danger'
}

export interface MenuProps {
  id?: string
  items: MenuItemConfig[]
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  className?: string
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
      <path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * design-spec 3.15 — generic `role="menu"` popover: focus goes to the first
 * item on open, ↑/↓ wrap between items, Esc closes and returns focus to the
 * trigger, a click outside closes. Tab/Shift+Tab wrap within the menuitems
 * too (§7: nested popups keep their own trap) instead of escaping into
 * whatever follows the trigger chip in the host's tab order. `PrioritySelect`
 * is the first caller; `TaskRow`'s `more` menu (Изменить/Удалить) reuses it
 * unchanged later.
 *
 * Esc comes from the one app-wide owner (`lib/dismissStack.ts` via
 * `useDismissable`), so a menu opened inside a dialog or the row editor takes
 * only the first Esc and leaves the layer underneath alone. Mounted only while
 * open, which is what registers and unregisters the layer.
 */
export function Menu({ id, items, anchorRef, onClose, className }: MenuProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  useDismissable({ onDismiss: onClose, returnFocusTo: anchorRef })
  useOutsideClick({ onOutsideClick: onClose, inside: [panelRef, anchorRef] })

  useEffect(() => {
    itemRefs.current[0]?.focus()
  }, [])

  function focusItem(index: number) {
    const count = items.length
    const next = ((index % count) + count) % count
    itemRefs.current[next]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusItem(current + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusItem(current - 1)
    } else if (event.key === 'Tab') {
      // design-spec §7 — nested popups keep their own Tab trap: Tab/Shift+Tab
      // cycle the menuitems instead of escaping into the row editor.
      event.preventDefault()
      focusItem(event.shiftKey ? current - 1 : current + 1)
    }
  }

  return (
    <div
      ref={panelRef}
      id={id}
      role="menu"
      onKeyDown={handleKeyDown}
      className={cn(
        'flex min-w-40 flex-col gap-(--space-1) rounded-(--radius-md) border border-surface-border bg-surface-2 p-(--space-2) shadow-md',
        className,
      )}
    >
      {items.map((item, index) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          ref={(el) => {
            itemRefs.current[index] = el
          }}
          onClick={() => {
            item.onSelect()
            onClose()
          }}
          className={cn(
            'flex items-center gap-(--space-2) rounded-(--radius-sm) px-(--space-3) py-(--space-2) text-left text-label transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-hover',
            item.variant === 'danger' ? 'text-danger' : 'text-primary',
          )}
        >
          <span className="inline-flex size-3 shrink-0 items-center justify-center text-accent-text" aria-hidden="true">
            {item.checked && <CheckGlyph />}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  )
}
