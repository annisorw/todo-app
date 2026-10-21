import { motion } from 'framer-motion'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { IconButton } from '../../components/IconButton'
import { announce } from '../../lib/announce'
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

/** Straight-line glyphs in `Fab`'s `PlusIcon` style — no new icon component. */
function ClearIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M4 10h12M4 10l5-5M4 10l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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

  // FELA-103: the one-slot clear/undo button lives only here, not in
  // `useComposerForm` — it never needs to survive a sheet close (the state
  // resets for free on unmount) and the desktop panel doesn't have it.
  const [savedText, setSavedText] = useState<string | null>(null)
  const restoreCaretRef = useRef(false)

  useDismissable({ onDismiss: onClose, returnFocusTo: triggerRef })
  useOutsideClick({ onOutsideClick: onClose, inside: [panelRef] })

  // Moves the caret to the end after "undo" restores the saved text. Can't
  // grab a ref from `ComposerTextarea` (it isn't forwarded, and spec 4.1
  // keeps that component untouched), so this reaches into the panel's DOM
  // instead — safe because focus never left the textarea (see
  // `onPointerDown` below), so it's always the active element here.
  useLayoutEffect(() => {
    if (!restoreCaretRef.current) return
    restoreCaretRef.current = false
    const textarea = panelRef.current?.querySelector('textarea')
    if (textarea) {
      const end = textarea.value.length
      textarea.setSelectionRange(end, end)
    }
  }, [form.title])

  const slot: 'clear' | 'undo' | 'hidden' = form.title !== '' ? 'clear' : savedText !== null ? 'undo' : 'hidden'

  function handleClear() {
    setSavedText(form.title)
    form.setTitle('')
    announce('Поле очищено')
  }

  function handleUndo() {
    if (savedText === null) return
    form.setTitle(savedText)
    setSavedText(null)
    restoreCaretRef.current = true
    announce('Текст возвращён')
  }

  // Only the textarea needs to drop the saved text on real typing — chips and
  // the submit button never call `setTitle`. Clear/undo call `form.setTitle`
  // directly (bypassing this wrapper) so they don't erase the value they just set.
  const textareaForm: ComposerFormController = {
    ...form,
    setTitle(value) {
      setSavedText(null)
      form.setTitle(value)
    },
  }

  // Trap Tab inside the sheet: the page behind it stays mounted under this
  // `aria-modal` dialog, so without this the native tab order would walk
  // right through to it — same pattern as `TaskEditorSheet`. The chip
  // popovers render inline inside `panelRef` (not portaled), and the
  // focusable set changes while one is open, so this re-queries live on
  // every Tab instead of caching first/last once.
  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )
    if (!focusable || focusable.length === 0) return

    const first = focusable.item(0)
    const last = focusable.item(focusable.length - 1)
    if (first === null || last === null) return

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

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
        onKeyDown={handlePanelKeyDown}
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
              'flex items-start gap-(--space-2) rounded-(--radius-md) border bg-surface-1 px-(--space-3) py-(--space-3) transition-colors duration-(--duration-fast) ease-standard',
              form.error ? 'border-danger' : form.isFocused ? 'border-accent-text' : 'border-surface-border',
              form.isFocused && 'shadow-glow-accent',
            )}
          >
            <ComposerTextarea form={textareaForm} errorId={errorId} autoFocus className="min-w-0 flex-1" />

            {/* Opacity only — framer-motion's own transition, not a CSS one,
                so the global reduced-motion floor (base.css) that pins real
                CSS transitions to 120ms can't fight the instant appearance
                acceptance criterion 14 asks for. */}
            <motion.span
              className="-my-3 -mr-2 inline-flex"
              animate={{ opacity: slot === 'hidden' ? 0 : 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.14 }}
            >
              <IconButton
                icon={slot === 'undo' ? <UndoIcon /> : <ClearIcon />}
                aria-label={slot === 'undo' ? 'Вернуть текст' : 'Очистить поле'}
                variant="ghost"
                onPointerDown={(event) => event.preventDefault()}
                onClick={slot === 'undo' ? handleUndo : handleClear}
                aria-hidden={slot === 'hidden' ? true : undefined}
                tabIndex={slot === 'hidden' ? -1 : undefined}
                className={slot === 'hidden' ? 'pointer-events-none' : undefined}
              />
            </motion.span>
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
