import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { IconButton } from './IconButton'
import { Tooltip } from './Tooltip'

export interface NoticeBlockProps {
  role: 'alert' | 'status'
  tone: 'danger' | 'neutral'
  icon: ReactNode
  title: string
  body: string
  /** Action row — the buttons `ErrorBanner`/`QuarantineNotice` render. */
  children: ReactNode
  /** Omitted → no dismiss control (state A never gets one). */
  onHide?: () => void
  className?: string
}

const HIDE_LABEL = 'Скрыть до следующего запуска'

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * design-quarantine-surface §5/§7.1 — shared column layout for `ErrorBanner`
 * (`corrupted`, state A) and `QuarantineNotice` (state B): [icon + text] над
 * рядом действий, а не `sm:flex-row sm:justify-between`, которое отжимало
 * `body` в колонку кнопок. Ряд действий выровнен под текстом
 * (`20px` иконки + `--space-3`), а не под иконкой.
 *
 * `onHide` рисует крестик поверх блока в правом верхнем углу (`absolute`),
 * а не как часть ряда действий, — так его можно разместить последним в DOM
 * (после экспортa/удаления из `children`) и всё равно получить верный
 * порядок фокуса (§8: «Выгрузить в файл» → «Удалить копию» → крестик) без
 * влияния на визуальную позицию.
 */
export function NoticeBlock({ role, tone, icon, title, body, children, onHide, className }: NoticeBlockProps) {
  return (
    <div
      role={role}
      className={cn(
        'relative flex flex-col gap-(--space-4) rounded-(--radius-lg) border bg-surface-2 p-(--space-4)',
        tone === 'danger' ? 'border-danger/30' : 'border-surface-border-strong',
        className,
      )}
    >
      <div className={cn('flex gap-(--space-3)', onHide !== undefined && 'pr-12')}>
        <span className="shrink-0">{icon}</span>
        <div>
          <p className="text-body-strong text-primary">{title}</p>
          <p className="text-body text-secondary">{body}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-(--space-2) pl-[calc(20px+var(--space-3))]">{children}</div>

      {onHide !== undefined && (
        // The positioning lives on this wrapper, not on the IconButton's own
        // className: `Tooltip` wraps its child in a `position: relative` span
        // of its own, which would otherwise become the nearest positioned
        // ancestor and pull `absolute` off the card entirely.
        <div className="absolute right-(--space-4) top-(--space-4)">
          <Tooltip content={HIDE_LABEL}>
            <IconButton variant="ghost" icon={<CloseIcon />} aria-label={HIDE_LABEL} onClick={onHide} />
          </Tooltip>
        </div>
      )}
    </div>
  )
}
