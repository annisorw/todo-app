import { motion } from 'framer-motion'
import { useId, useRef } from 'react'
import type { RefObject } from 'react'
import { cn } from '../../lib/cn'
import { useDismissable } from '../../lib/useDismissable'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { useOutsideClick } from '../../lib/useOutsideClick'
import { ComposerChips } from './ComposerChips'
import { ComposerFieldMeta } from './ComposerFieldMeta'
import { ComposerSubmit } from './ComposerSubmit'
import { ComposerTextarea } from './ComposerTextarea'
import type { ComposerFormController } from './useComposerForm'

export interface ComposerSheetProps {
  form: ComposerFormController
  /** The `Fab` that opened the sheet — where Esc puts focus back. */
  triggerRef: RefObject<HTMLElement | null>
  onClose: () => void
}

/**
 * design-spec 3.7 / 3.24 — the mobile stand-in for the desktop panel,
 * opened by `Fab`. Same fields, autofocus in the text field, `sheet-in`
 * motion (`translateY` 100%→0, 320ms `--ease-out-soft`, opacity only under
 * reduced motion). The motion table (section 5) names no `sheet-out`, so
 * closing is an instant unmount rather than a reverse animation — no
 * `AnimatePresence` needed here. Esc and a backdrop click both close it.
 *
 * The sheet is a layer in the app-wide Esc stack, and the chip popovers inside
 * it are layers on top of it: Esc closes the open popover first and the sheet
 * only on the next press. Esc returns focus to the `Fab` that opened the
 * sheet: focus was inside the panel being unmounted, so without the handoff it
 * would land on `<body>` and the next Tab would restart the page. A backdrop
 * click leaves focus alone — that is the pointer path, and the stack's focus
 * discipline only covers the keyboard one.
 *
 * Layout is two rows (direction B, FELA-65): the field gets its own row, full
 * width, in a bordered container that takes the focus treatment itself —
 * same pattern as `SearchField` (spec 3.8) — because on this narrow a panel a
 * field sharing its row with the chips and the submit button was too narrow
 * to use. Chips and the submit button move to a second row below.
 */
export function ComposerSheet({ form, triggerRef, onClose }: ComposerSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const errorId = useId()

  useDismissable({ onDismiss: onClose, returnFocusTo: triggerRef })
  useOutsideClick({ onOutsideClick: onClose, inside: [panelRef] })

  return (
    <div className="fixed inset-0 z-(--z-modal) flex flex-col justify-end">
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        className="absolute inset-0 bg-modal-backdrop"
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Добавить задачу"
        initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
        animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-t-(--radius-xl) border-t border-surface-border bg-surface-2-solid p-(--space-5) pb-[calc(var(--space-5)+env(safe-area-inset-bottom))] shadow-lg"
      >
        <div className="flex flex-col gap-(--space-2)">
          <div
            className={cn(
              'rounded-(--radius-md) border bg-surface-1 px-(--space-3) py-(--space-3) transition-colors duration-(--duration-fast) ease-standard',
              form.error ? 'border-danger' : form.isFocused ? 'border-accent-text' : 'border-surface-border',
              form.isFocused && 'shadow-glow-accent',
            )}
          >
            <ComposerTextarea form={form} errorId={errorId} autoFocus className="w-full" />
          </div>

          <ComposerFieldMeta form={form} errorId={errorId} />

          <div className="flex items-center justify-between gap-(--space-3)">
            <ComposerChips form={form} />
            <ComposerSubmit form={form} />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
