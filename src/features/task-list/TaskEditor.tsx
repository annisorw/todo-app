import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Button } from '../../components/Button'
import { DueDatePicker } from '../../components/DueDatePicker'
import { PrioritySelect } from '../../components/PrioritySelect'
import { MAX_TITLE_LENGTH } from '../../domain/limits'
import type { Task, TaskPatch } from '../../domain/task'
import { cn } from '../../lib/cn'
import { useDismissable } from '../../lib/useDismissable'
import { useTaskEditorForm } from './useTaskEditorForm'

export interface TaskEditorProps {
  task: Task
  onSave: (patch: TaskPatch) => void
  onCancel: () => void
}

/**
 * design-spec 3.11a / S6 — the row's `editing` state, inline on desktop.
 * Reuses `PrioritySelect` / `DueDatePicker` unchanged (FELA-14): a second
 * copy of either picker is not an option (architecture section 2).
 *
 * Keyboard contract (acceptance criterion 32, FELA-20's note on this issue):
 * this component sets up no `document` listener of its own for Esc.
 * `useDismissable` puts it on the shared dismiss stack (`lib/dismissStack.ts`)
 * — Esc here means **cancel**. A click outside instead *saves* (Postel's
 * Law, design-spec 3.11a), which is a plain local `pointerdown` check
 * rather than `usePopoverDismiss` — that hook always cancels/closes on an
 * outside click, the wrong verb here.
 *
 * Focus return to the row's checkbox is **not** done here via
 * `useDismissable`'s `returnFocusTo`: the checkbox unmounts the moment this
 * editor opens (it replaces the row's whole body), so by the time Esc fires
 * the ref is already `null` — calling `.focus()` on it is a silent no-op.
 * Worse, that path only covers Esc, not the other three ways this editor
 * closes (Enter, outside click, "Отмена"). `TaskRow` instead focuses its
 * checkbox from an effect keyed on the `isEditing` prop flipping to
 * `false`, which fires after the checkbox has remounted and covers all four
 * close paths uniformly.
 */
export function TaskEditor({ task, onSave, onCancel }: TaskEditorProps) {
  const form = useTaskEditorForm({ task, onSave, onCancel })
  const rootRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useDismissable({ onDismiss: form.handleCancel })

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const node = textareaRef.current
    if (node === null) return
    node.style.height = 'auto'
    node.style.height = `${String(node.scrollHeight)}px`
  }, [form.title])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      form.handleSave()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [form])

  // Soft Tab trap (design-spec section 7): the sequence is textarea ->
  // priority chip -> due-date chip -> Сохранить -> Отмена, and it never
  // drops the user back into the list while the editor holds unsaved work.
  function handleTrapKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return
    if (!event.shiftKey && document.activeElement === cancelRef.current) {
      event.preventDefault()
      textareaRef.current?.focus()
    } else if (event.shiftKey && document.activeElement === textareaRef.current) {
      event.preventDefault()
      cancelRef.current?.focus()
    }
  }

  return (
    <div
      ref={rootRef}
      onKeyDown={handleTrapKeyDown}
      className="task-row flex flex-col gap-(--space-3) rounded-(--radius-lg) border border-transparent bg-surface-2 p-(--space-4) shadow-glow-accent"
    >
      <textarea
        ref={textareaRef}
        value={form.title}
        maxLength={MAX_TITLE_LENGTH}
        rows={1}
        aria-label="Текст задачи"
        aria-invalid={form.isTooLong || undefined}
        onChange={(event) => form.setTitle(event.target.value)}
        onKeyDown={form.handleTextareaKeyDown}
        className="min-w-0 resize-none bg-transparent text-body text-primary focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-(--space-3)">
        <PrioritySelect value={form.priority} onChange={form.setPriority} />
        <DueDatePicker value={form.dueDate} onChange={form.setDueDate} />
        {form.showCounter && (
          <span className={cn('ml-auto text-caption', form.isTooLong ? 'text-danger' : 'text-tertiary')}>
            {form.title.length}/{MAX_TITLE_LENGTH}
          </span>
        )}
      </div>

      {form.errorMessage && (
        <p role="alert" className="text-caption text-danger">
          {form.errorMessage}
        </p>
      )}

      <div className="flex items-center gap-(--space-3) border-t border-surface-border pt-(--space-3)">
        <Button variant="primary" size="sm" disabled={form.isTooLong} onClick={form.handleSave}>
          Сохранить
        </Button>
        <Button ref={cancelRef} variant="ghost" size="sm" onClick={form.handleCancel}>
          Отмена
        </Button>
        <span className="text-caption text-tertiary">Enter сохранить · Esc отмена</span>
      </div>
    </div>
  )
}
