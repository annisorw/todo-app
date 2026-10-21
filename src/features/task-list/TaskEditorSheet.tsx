import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Button } from '../../components/Button'
import { DueDatePicker } from '../../components/DueDatePicker'
import { PrioritySelect } from '../../components/PrioritySelect'
import { MAX_TITLE_LENGTH } from '../../domain/limits'
import type { Task, TaskPatch } from '../../domain/task'
import { cn } from '../../lib/cn'
import { useDismissable } from '../../lib/useDismissable'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { useTaskEditorForm } from './useTaskEditorForm'

export interface TaskEditorSheetProps {
  task: Task
  onSave: (patch: TaskPatch) => void
  onCancel: () => void
}

/**
 * A 48px row whose *whole width* is the tap target (acceptance criterion
 * 31: every target in this sheet is ≥44×44), not just the 24px chip inside
 * it — `PriorityChip`/`DueDateChip` stay fixed at 24px by design (spec
 * 3.12: "высоту нельзя уменьшать", and nothing here raises it either).
 * Tapping the label or the row's empty space forwards a real click to the
 * chip's own button so `PrioritySelect`/`DueDatePicker` open exactly as if
 * their chip had been tapped directly — no prop, ref or behaviour added to
 * either picker. A click that lands inside `children` (the chip itself, an
 * icon glyph nested in its button, or the open popover's own controls) is
 * left alone: those elements already handle their own clicks, and
 * re-forwarding to the trigger button there would re-toggle it shut the
 * instant it opened.
 */
function EditorFieldRow({ label, children }: { label: string; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)

  function handleRowClick(event: MouseEvent<HTMLDivElement>) {
    if (contentRef.current?.contains(event.target as Node)) return
    contentRef.current?.querySelector('button')?.click()
  }

  return (
    <div
      onClick={handleRowClick}
      className="flex h-12 items-center justify-between gap-(--space-3) border-b border-surface-border last:border-b-0"
    >
      <span className="text-body text-secondary">{label}</span>
      <div ref={contentRef} className="contents">
        {children}
      </div>
    </div>
  )
}

/**
 * design-spec 3.11a / S6, mobile branch — a bottom sheet instead of the
 * inline editor: at 390px wide with the on-screen keyboard open, expanding
 * the row in place would push fields under the keyboard. Same fields and
 * the same `useTaskEditorForm` as `TaskEditor`; only the chrome differs
 * (`sheet-in`, 320ms, same transition as `ComposerSheet`). The backdrop
 * click saves — same "outside click saves" rule as the desktop editor
 * (design-spec 3.11a, Postel's Law) — there's no "outside the editor but
 * inside the row" distinction once the sheet covers the screen.
 *
 * Focus return to the row's checkbox is `TaskRow`'s job, not this
 * component's `returnFocusTo` — see the comment on `TaskEditor` for why.
 */
export function TaskEditorSheet({ task, onSave, onCancel }: TaskEditorSheetProps) {
  const form = useTaskEditorForm({ task, onSave, onCancel })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  useDismissable({ onDismiss: form.handleCancel })

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Grows with content up to the textarea's own `max-h` (CSS clamps the
  // inline `height` we set here); past that it scrolls internally instead
  // of pushing the panel past the viewport (FELA-133 — a near-limit title
  // was rendering the sheet taller than the screen, with the panel's top
  // and the textarea's own start scrolled off above the viewport).
  useEffect(() => {
    const node = textareaRef.current
    if (node === null) return
    node.style.height = 'auto'
    node.style.height = `${String(node.scrollHeight)}px`
  }, [form.title])

  // Trap Tab inside the sheet: `RowBody` and the rest of the page stay
  // mounted behind this `aria-modal` dialog, so without this the native
  // tab order would walk right through to them. The focusable set changes
  // while a popover is open, so this re-queries live on every Tab instead
  // of caching first/last once.
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
        onClick={form.handleSave}
        className="absolute inset-0 bg-modal-backdrop"
      />

      <motion.div
        ref={panelRef}
        onKeyDown={handlePanelKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Изменить задачу"
        initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
        animate={prefersReducedMotion ? { opacity: 1 } : { y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex max-h-[90dvh] flex-col gap-(--space-3) overflow-y-auto rounded-t-(--radius-xl) border-t border-surface-border bg-surface-2-solid p-(--space-5) pb-[calc(var(--space-5)+env(safe-area-inset-bottom))] shadow-lg"
      >
        <h2 className="text-h2 text-primary">Изменить задачу</h2>

        <textarea
          ref={textareaRef}
          value={form.title}
          maxLength={MAX_TITLE_LENGTH}
          rows={2}
          aria-label="Текст задачи"
          aria-invalid={form.isTooLong || undefined}
          onChange={(event) => form.setTitle(event.target.value)}
          onKeyDown={form.handleTextareaKeyDown}
          className="min-w-0 max-h-[40dvh] resize-none overflow-y-auto break-words rounded-(--radius-md) border border-surface-border bg-surface-1 p-(--space-3) text-body text-primary"
        />

        <div className="flex items-center justify-between gap-(--space-3)">
          {form.errorMessage ? (
            <p role="alert" className="text-caption text-danger">
              {form.errorMessage}
            </p>
          ) : (
            <span />
          )}
          {form.showCounter && (
            <span className={cn('text-caption text-mono-num', form.isTooLong ? 'text-danger' : 'text-tertiary')}>
              {form.title.length}/{MAX_TITLE_LENGTH}
            </span>
          )}
        </div>

        <div className="flex flex-col">
          <EditorFieldRow label="Приоритет">
            <PrioritySelect value={form.priority} onChange={form.setPriority} align="end" />
          </EditorFieldRow>
          <EditorFieldRow label="Срок">
            <DueDatePicker value={form.dueDate} onChange={form.setDueDate} align="end" />
          </EditorFieldRow>
        </div>

        <div className="flex items-center gap-(--space-3) pt-(--space-2)">
          <Button variant="ghost" size="lg" className="flex-1" onClick={form.handleCancel}>
            Отмена
          </Button>
          <Button variant="primary" size="lg" className="flex-1" disabled={form.isTooLong} onClick={form.handleSave}>
            Сохранить
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
