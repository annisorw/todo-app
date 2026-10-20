import { useEffect, useId, useRef } from 'react'
import type { RefObject } from 'react'
import { MAX_TITLE_LENGTH } from '../../domain/limits'
import { cn } from '../../lib/cn'
import { DueDatePicker } from '../../components/DueDatePicker'
import { PrioritySelect } from '../../components/PrioritySelect'
import type { ComposerFormController } from './useComposerForm'

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export interface ComposerFieldsProps {
  form: ComposerFormController
  autoFocus?: boolean
  textareaRef?: RefObject<HTMLTextAreaElement | null>
}

/**
 * The input row shared by the desktop panel (`Composer`) and the mobile
 * sheet (`ComposerSheet`): textarea + priority chip + due-date chip + the
 * gradient "+" submit button. DOM/tab order is field → priority → due date
 * → "+" (design-spec section 7); the "+" renders visually first via
 * `order-first` without moving in the tab sequence, which CSS `order`
 * never touches.
 *
 * `errorId` is generated locally rather than taken from the shared form
 * controller: the desktop panel and the mobile sheet both render this
 * component from the *same* `useComposerForm()` instance at once (one of
 * them just CSS-hidden), so an id living on the controller would duplicate
 * across both DOM trees.
 */
export function ComposerFields({ form, autoFocus, textareaRef }: ComposerFieldsProps) {
  const ownTextareaRef = useRef<HTMLTextAreaElement>(null)
  const resolvedRef = textareaRef ?? ownTextareaRef
  const errorId = useId()

  useEffect(() => {
    const node = resolvedRef.current
    if (node === null) return
    node.style.height = 'auto'
    node.style.height = `${String(node.scrollHeight)}px`
  }, [form.title, resolvedRef])

  const canSubmit = form.error !== 'tooLong' && form.error !== 'atLimit'

  return (
    <div className="flex flex-col gap-(--space-2)">
      <div className="flex items-center gap-(--space-3)">
        {/* DOM/tab order is field -> priority -> due date -> "+" (design-spec
         * section 7); `order-first` moves the button to the visual left
         * (spec 3.7) without touching that tab sequence. */}
        <textarea
          ref={resolvedRef}
          autoFocus={autoFocus}
          rows={1}
          value={form.title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Что нужно сделать?"
          aria-label="Текст новой задачи"
          onChange={(event) => form.setTitle(event.target.value)}
          onFocus={form.handleFocus}
          onBlur={form.handleBlur}
          onKeyDown={form.handleKeyDown}
          aria-describedby={form.error ? errorId : undefined}
          aria-invalid={form.error !== null || undefined}
          className="order-2 min-w-0 flex-1 resize-none bg-transparent text-body-lg text-primary placeholder:text-tertiary focus:outline-none"
        />

        <div className="order-3 flex shrink-0 items-center gap-(--space-2)">
          <PrioritySelect value={form.priority} onChange={form.setPriority} />
          <DueDatePicker value={form.dueDate} onChange={form.setDueDate} />
        </div>

        <button
          type="button"
          onClick={form.handleSubmit}
          disabled={!canSubmit}
          aria-label="Добавить задачу в список"
          style={{ backgroundImage: 'var(--gradient-accent)' }}
          className="order-1 flex size-10 shrink-0 items-center justify-center rounded-full text-accent-contrast transition-opacity duration-(--duration-fast) ease-standard disabled:cursor-not-allowed disabled:opacity-45"
        >
          <PlusIcon />
        </button>
      </div>

      <div className="flex items-center justify-between gap-(--space-3)">
        {form.errorMessage ? (
          <p id={errorId} role="alert" className="text-caption text-danger">
            {form.errorMessage}
          </p>
        ) : (
          <span />
        )}

        {form.showCounter && (
          // design-spec v1.4 wants `.text-mono-num` here (font-mono +
          // weight 400 + tabular-nums, FELA-54), not `font-mono` by hand —
          // TechLead's note on FELA-14 says not to invent a stand-in while
          // FELA-54 is still out, so this stays plain `text-caption` until
          // that class lands.
          <span className={cn('text-caption', form.title.length > MAX_TITLE_LENGTH ? 'text-danger' : 'text-tertiary')}>
            {form.title.length}/{MAX_TITLE_LENGTH}
          </span>
        )}
      </div>
    </div>
  )
}
