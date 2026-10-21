import { forwardRef, useId, useState } from 'react'
import type { ChangeEvent } from 'react'
import { MAX_QUERY_LENGTH } from '../../domain/limits'
import { cn } from '../../lib/cn'

export interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M17 17l-3.8-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Design-spec 3.8. Debounce is the caller's job (`useDebouncedValue` in
 * `Toolbar`) — this component only owns the raw input value so typing never
 * waits on the debounce. `maxLength` comes from `MAX_QUERY_LENGTH`
 * (`domain/limits.ts`) rather than a literal, per the security requirements
 * in this ticket (FELA-8/FELA-4).
 *
 * Forwards its ref to the native input so a future global `/` shortcut
 * (FELA-20) can call `.focus()` on it directly.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange },
  ref,
) {
  const [focused, setFocused] = useState(false)
  const inputId = useId()
  const isEmpty = value === ''

  return (
    <div
      className={cn(
        'search-field relative flex h-11 w-full items-center gap-(--space-2) rounded-(--radius-md) border bg-surface-1 px-(--space-3) transition-colors duration-(--duration-fast) ease-standard sm:h-10',
        focused ? 'border-accent-text shadow-glow-accent' : 'border-surface-border',
      )}
    >
      <span className="text-tertiary" aria-hidden="true">
        <SearchIcon />
      </span>

      <label htmlFor={inputId} className="sr-only">
        Поиск задач
      </label>
      <input
        ref={ref}
        id={inputId}
        type="search"
        value={value}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Поиск"
        autoComplete="off"
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="min-w-0 flex-1 bg-transparent text-body text-primary outline-none placeholder:text-tertiary"
      />

      {isEmpty && !focused && (
        <kbd
          aria-hidden="true"
          className="rounded-(--radius-xs) border border-surface-border-strong px-(--space-1) text-caption text-tertiary"
        >
          /
        </kbd>
      )}

      {!isEmpty && (
        <button
          type="button"
          aria-label="Очистить поиск"
          onClick={() => onChange('')}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-xs) text-tertiary transition-colors duration-(--duration-fast) ease-standard hover:text-secondary sm:size-6"
        >
          <ClearIcon />
        </button>
      )}
    </div>
  )
})
