import { MAX_TITLE_LENGTH } from '../../domain/limits'
import { cn } from '../../lib/cn'
import type { ComposerFormController } from './useComposerForm'

export interface ComposerFieldMetaProps {
  form: ComposerFormController
  errorId: string
}

/**
 * Error message / character counter row below the field, shared by the
 * desktop panel and the mobile sheet. `errorId` must match the id passed to
 * the sibling `ComposerTextarea`'s `aria-describedby` in the same tree.
 */
export function ComposerFieldMeta({ form, errorId }: ComposerFieldMetaProps) {
  return (
    <div className="flex items-center justify-between gap-(--space-3)">
      {form.errorMessage ? (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {form.errorMessage}
        </p>
      ) : (
        <span />
      )}

      {form.showCounter && (
        <span
          className={cn(
            'text-caption text-mono-num',
            form.title.length > MAX_TITLE_LENGTH ? 'text-danger' : 'text-tertiary',
          )}
        >
          {form.title.length}/{MAX_TITLE_LENGTH}
        </span>
      )}
    </div>
  )
}
