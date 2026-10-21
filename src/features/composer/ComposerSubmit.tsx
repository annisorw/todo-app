import { cn } from '../../lib/cn'
import type { ComposerFormController } from './useComposerForm'

export interface ComposerSubmitProps {
  form: ComposerFormController
  className?: string
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/** The gradient "+" submit button, shared by the desktop panel and the mobile sheet. */
export function ComposerSubmit({ form, className }: ComposerSubmitProps) {
  const canSubmit = form.error !== 'tooLong' && form.error !== 'atLimit'

  return (
    <button
      type="button"
      onClick={form.handleSubmit}
      disabled={!canSubmit}
      aria-label="Добавить задачу в список"
      style={{ backgroundImage: 'var(--gradient-accent)' }}
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-full text-accent-contrast transition-opacity duration-(--duration-fast) ease-standard disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
    >
      <PlusIcon />
    </button>
  )
}
