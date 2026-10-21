import type { ReactNode } from 'react'
import { Button } from './Button'

export type EmptyStateProps =
  | { variant: 'first-run'; onAddTask: () => void }
  | { variant: 'no-active' }
  | { variant: 'no-completed' }
  | {
      variant: 'no-search-results'
      query: string
      /** Resolved label of the active filter segment — omitted for "Все", where there's no filter to reset. */
      activeFilterLabel?: string
      onClearSearch: () => void
      onSearchAll?: () => void
    }

const HINTS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'N', label: 'новая задача' },
  { key: '/', label: 'поиск' },
  { key: '?', label: 'горячие клавиши' },
]

function ArtBadge({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundImage: 'var(--gradient-accent-soft)' }}
      className="flex size-[88px] shrink-0 items-center justify-center rounded-full text-accent-text"
    >
      {children}
    </span>
  )
}

function FirstRunIcon() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true">
      <rect x="8" y="5" width="16" height="22" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 12h8M12 16h8M12 20h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CelebrateIcon() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true">
      <path
        d="M8 17l6 6L25 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrayIcon() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true">
      <path
        d="M6 20h6l2 3h4l2-3h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 20 11 8h10l2.5 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function NoResultsIcon() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 24l-4.2-4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.5 14h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

interface Copy {
  icon: ReactNode
  title: string
  body: string
}

function getCopy(props: EmptyStateProps): Copy {
  switch (props.variant) {
    case 'first-run':
      return {
        icon: <FirstRunIcon />,
        title: 'Пока пусто',
        body: 'Запишите первую задачу — остальное подхватится по ходу дела.',
      }
    case 'no-active':
      return {
        icon: <CelebrateIcon />,
        title: 'Все активные задачи выполнены',
        body: 'Ни одной задачи в работе — можно перевести дыхание. Старое найдётся в «Готовые».',
      }
    case 'no-completed':
      return {
        icon: <TrayIcon />,
        title: 'Пока нет выполненных задач',
        body: 'Отметьте что-то сделанным — оно появится здесь.',
      }
    case 'no-search-results':
      return {
        icon: <NoResultsIcon />,
        title: `По запросу «${props.query}» нет задач`,
        body:
          props.activeFilterLabel === undefined
            ? 'Проверьте раскладку.'
            : `Проверьте раскладку или сбросьте фильтр «${props.activeFilterLabel}».`,
      }
  }
}

/**
 * design-spec 3.18 / S2 / S4 / S5. Four variants, each a static 88px art
 * circle + `text-h2` title + `text-body` text (capped at 30 characters per
 * line) + 0–2 actions. `first-run` additionally gets the `N` / `/` / `?`
 * hint row (spec 3.18).
 *
 * Purely presentational — no store access, no feature-level decisions.
 * `features/task-list/TaskList.tsx` and `App.tsx` decide *which* variant and
 * hand down the already-resolved strings and callbacks.
 */
export function EmptyState(props: EmptyStateProps) {
  const copy = getCopy(props)

  return (
    <div className="flex flex-col items-center gap-(--space-4) py-(--space-12) text-center">
      <ArtBadge>{copy.icon}</ArtBadge>

      <div className="flex flex-col gap-(--space-2)">
        <h2 className="text-h2 text-primary">{copy.title}</h2>
        <p className="mx-auto max-w-[30ch] text-body text-secondary">{copy.body}</p>
      </div>

      {props.variant === 'first-run' && (
        <>
          <Button variant="primary" onClick={props.onAddTask}>
            Добавить первую задачу
          </Button>
          <ul className="flex flex-wrap items-center justify-center gap-(--space-4) text-caption text-tertiary">
            {HINTS.map((hint) => (
              <li key={hint.key} className="flex items-center gap-(--space-1)">
                <kbd className="rounded-(--radius-xs) border border-surface-border-strong px-(--space-1) text-mono-num">
                  {hint.key}
                </kbd>
                <span>{hint.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {props.variant === 'no-search-results' && (
        <div className="flex gap-(--space-2)">
          <Button variant="secondary" size="sm" onClick={props.onClearSearch}>
            Очистить поиск
          </Button>
          {props.onSearchAll !== undefined && (
            <Button variant="ghost" size="sm" onClick={props.onSearchAll}>
              Искать во всех
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
