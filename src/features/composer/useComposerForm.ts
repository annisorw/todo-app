import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { MAX_TASKS, MAX_TITLE_LENGTH, TITLE_COUNTER_THRESHOLD } from '../../domain/limits'
import { normalizeTitle } from '../../domain/task'
import type { Priority, TaskDraft } from '../../domain/task'

export type ComposerErrorKind = 'empty' | 'tooLong' | 'atLimit'

const ERROR_MESSAGE: Record<ComposerErrorKind, string> = {
  empty: 'Введите текст задачи.',
  tooLong: `Слишком длинный текст — не больше ${String(MAX_TITLE_LENGTH)} символов.`,
  atLimit: `Список заполнен (${String(MAX_TASKS)} задач) — удалите что-то, чтобы добавить новую.`,
}

export interface UseComposerFormOptions {
  addTask: (draft: TaskDraft) => void
  isAtLimit: boolean
}

export interface ComposerFormController {
  title: string
  priority: Priority
  dueDate: string | null
  error: ComposerErrorKind | null
  errorMessage: string | null
  isFocused: boolean
  showCounter: boolean
  setTitle: (value: string) => void
  setPriority: (value: Priority) => void
  setDueDate: (value: string | null) => void
  handleFocus: () => void
  handleBlur: () => void
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  handleSubmit: () => void
}

/**
 * Composer's state and behaviour (design-spec 3.7 + v1.1), shared by the
 * desktop panel and the mobile sheet so the two only differ in markup.
 *
 * The title's `maxLength` attribute blocks typing past the limit in a real
 * browser, but `title.length > MAX_TITLE_LENGTH` is still checked here —
 * same "don't trust the attribute alone" rule the storage layer follows
 * (`docs/CODE-RULES.md`, section 3) — so a value that reaches the field some
 * other way (programmatic change, an older browser) still surfaces the
 * error instead of silently failing to add the task.
 */
export function useComposerForm({ addTask, isAtLimit }: UseComposerFormOptions): ComposerFormController {
  const [title, setTitleState] = useState('')
  const [priority, setPriority] = useState<Priority>('none')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [submitAttemptedEmpty, setSubmitAttemptedEmpty] = useState(false)

  const isTooLong = title.length > MAX_TITLE_LENGTH
  // Derived, not reset via an effect: the moment the title holds real text,
  // this is simply false on its own, with nothing to synchronize back.
  const isEmpty = title.trim().length === 0
  const error: ComposerErrorKind | null = isTooLong
    ? 'tooLong'
    : isAtLimit
      ? 'atLimit'
      : submitAttemptedEmpty && isEmpty
        ? 'empty'
        : null

  function setTitle(value: string) {
    setTitleState(value)
  }

  function handleSubmit() {
    if (isTooLong || isAtLimit) return

    const normalized = normalizeTitle(title)
    if (normalized === null) {
      setSubmitAttemptedEmpty(true)
      return
    }

    addTask({ title: normalized, priority, dueDate })
    setTitleState('')
    setPriority('none')
    setDueDate(null)
    setSubmitAttemptedEmpty(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setTitleState('')
      setSubmitAttemptedEmpty(false)
    }
  }

  return {
    title,
    priority,
    dueDate,
    error,
    errorMessage: error ? ERROR_MESSAGE[error] : null,
    isFocused,
    showCounter: title.length >= TITLE_COUNTER_THRESHOLD,
    setTitle,
    setPriority,
    setDueDate,
    handleFocus: () => setIsFocused(true),
    handleBlur: () => setIsFocused(false),
    handleKeyDown,
    handleSubmit,
  }
}
