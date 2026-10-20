import { motion } from 'framer-motion'
import { useRef } from 'react'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { usePopoverDismiss } from '../../lib/usePopoverDismiss'
import { ComposerFields } from './ComposerFields'
import type { ComposerFormController } from './useComposerForm'

export interface ComposerSheetProps {
  form: ComposerFormController
  onClose: () => void
}

/**
 * design-spec 3.7 / 3.24 — the mobile stand-in for the desktop panel,
 * opened by `Fab`. Same fields, autofocus in the text field, `sheet-in`
 * motion (`translateY` 100%→0, 320ms `--ease-out-soft`, opacity only under
 * reduced motion). The motion table (section 5) names no `sheet-out`, so
 * closing is an instant unmount rather than a reverse animation — no
 * `AnimatePresence` needed here. Esc and a backdrop click both close it;
 * there is no trigger button to return focus to (the `Fab` stays where it
 * is), so this passes a no-op anchor ref to the shared dismiss hook.
 */
export function ComposerSheet({ form, onClose }: ComposerSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const noAnchor = useRef<HTMLElement | null>(null)
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  usePopoverDismiss({ onClose, anchorRef: noAnchor, panelRef })

  return (
    <div className="fixed inset-0 z-(--z-modal) flex flex-col justify-end">
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(3,3,10,0.55)]"
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
        <ComposerFields form={form} autoFocus />
      </motion.div>
    </div>
  )
}
