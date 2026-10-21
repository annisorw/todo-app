import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { announce } from '../../lib/announce'
import { MAX_TITLE_LENGTH, TITLE_COUNTER_THRESHOLD } from '../../domain/limits'
import type { Priority, Task, TaskPatch } from '../../domain/task'

export interface TaskEditorFormController {
  title: string
  priority: Priority
  dueDate: string | null
  isTooLong: boolean
  errorMessage: string | null
  /** Drives the `dirty` visual (design-spec 3.11a) — save stays a safe no-op either way. */
  isDirty: boolean
  showCounter: boolean
  setTitle: (value: string) => void
  setPriority: (value: Priority) => void
  setDueDate: (value: string | null) => void
  handleTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  handleSave: () => void
  handleCancel: () => void
}

export interface UseTaskEditorFormOptions {
  task: Task
  onSave: (patch: TaskPatch) => void
  onCancel: () => void
}

/**
 * design-spec 3.11a — editing patches all three fields (text, priority, due
 * date) at once, through one `task/edit` action (architecture section 3,
 * decision 2). The draft lives only in this hook's local state until a real
 * save, so "Отмена" rolling all three back is just never having dispatched
 * anything — no separate undo bookkeeping needed.
 *
 * Empty text on save is a cancel, not a delete or a blocking error
 * (design-spec 3.11a / S6): the only save-blocking error is >500 chars.
 */
export function useTaskEditorForm({ task, onSave, onCancel }: UseTaskEditorFormOptions): TaskEditorFormController {
  const [title, setTitle] = useState(task.title)
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.dueDate)

  const isTooLong = title.length > MAX_TITLE_LENGTH
  const isDirty = title !== task.title || priority !== task.priority || dueDate !== task.dueDate

  function handleSave() {
    if (isTooLong) return

    const trimmed = title.trim()
    if (trimmed.length === 0) {
      // Empty text is a cancel, not a delete (design-spec 3.11a) — routed
      // through `handleCancel` so the two paths share one announcement.
      handleCancel()
      return
    }

    onSave({ title: trimmed, priority, dueDate })
    announce(`Изменения сохранены: «${trimmed}»`)
  }

  function handleCancel() {
    onCancel()
    announce('Правка отменена')
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSave()
    }
    // Shift+Enter falls through as a plain newline. Esc is the dismiss
    // stack's job (`useDismissable` on the editor root, acceptance
    // criterion 32) — not handled here, so a popup open at the same time
    // gets the keystroke first.
  }

  return {
    title,
    priority,
    dueDate,
    isTooLong,
    errorMessage: isTooLong ? `Слишком длинный текст — не больше ${String(MAX_TITLE_LENGTH)} символов.` : null,
    isDirty,
    showCounter: title.length >= TITLE_COUNTER_THRESHOLD,
    setTitle,
    setPriority,
    setDueDate,
    handleTextareaKeyDown,
    handleSave,
    handleCancel,
  }
}
