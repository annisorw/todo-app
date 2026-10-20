import { useState } from 'react'
import type { ReactNode } from 'react'

interface HeroProps {
  /** Defaults to now; a prop mainly so tests can pin it. */
  date?: Date
  summary: string
  /** Where `ProgressRing` (FELA-19) will render once task data exists. */
  progressSlot?: ReactNode
}

const eyebrowFormatter = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function formatEyebrow(date: Date): string {
  const formatted = eyebrowFormatter.format(date)
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

/**
 * Design spec S1 (top) / S11 (mobile). Desktop: eyebrow + title + summary
 * on the left, the progress slot on the right. Mobile (<=640px, the single
 * breakpoint): everything stacks in a column, progress slot last.
 */
export function Hero({ date, summary, progressSlot }: HeroProps) {
  const [today] = useState(() => new Date())
  const effectiveDate = date ?? today

  return (
    <section className="flex flex-col gap-(--space-4) py-(--space-6) sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-(--space-2)">
        <p className="text-micro uppercase text-tertiary">{formatEyebrow(effectiveDate)}</p>
        <h1 className="text-display text-primary">Сегодня</h1>
        <p className="text-body-lg text-secondary">{summary}</p>
      </div>

      {progressSlot && (
        <div className="flex size-11 shrink-0 items-center justify-center">{progressSlot}</div>
      )}
    </section>
  )
}
