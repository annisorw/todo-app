import { useId } from 'react'

export interface ProgressRingProps {
  completed: number
  total: number
}

const SIZE = 44
const STROKE = 4
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * design-spec 3.20 — 44px ring, 4px stroke, `--gradient-accent` fill, the
 * count duplicated as text (accessibility section 7: the ring is never the
 * only carrier of the number).
 *
 * The fill is an HTML layer masked by an SVG `<mask>` circle, not a gradient
 * baked straight into the SVG stroke: SVG `stroke` only accepts a
 * `url(#id)` paint reference, never a CSS `linear-gradient()` value, so
 * painting the arc directly would mean re-declaring `--gradient-accent`'s
 * stops as literal hex a second time (tokens.css forbids that — the comment
 * on `--gradient-accent` lists this exact component as one of the few
 * allowed consumers, via `background-image`, same as `Checkbox` and `Fab`).
 * Masking with a dashed circle keeps the token as the only source of colour
 * and still drives `stroke-dashoffset`, the property the motion table
 * (`progress-fill`, 480ms, `--ease-out-soft`) names — reduced-motion makes it
 * instant for free, via `base.css`'s blanket
 * `transition-property: opacity, background-color, color` override, which
 * simply drops `stroke-dashoffset` from the transitioned set.
 */
export function ProgressRing({ completed, total }: ProgressRingProps) {
  const maskId = useId()
  const ratio = total === 0 ? 0 : completed / total
  const dashOffset = CIRCUMFERENCE * (1 - ratio)

  return (
    <div className="flex items-center gap-(--space-3)">
      <div
        role="img"
        aria-label={`Выполнено ${String(completed)} из ${String(total)} задач`}
        className="relative size-[44px] shrink-0"
      >
        <svg aria-hidden="true" width={SIZE} height={SIZE} viewBox={`0 0 ${String(SIZE)} ${String(SIZE)}`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-surface-border-strong)"
            strokeWidth={STROKE}
          />
          <mask id={maskId}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="#fff"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${String(SIZE / 2)} ${String(SIZE / 2)})`}
              style={{
                transitionProperty: 'stroke-dashoffset',
                transitionDuration: 'var(--duration-slower)',
                transitionTimingFunction: 'var(--ease-out-soft)',
              }}
            />
          </mask>
        </svg>
        <div
          aria-hidden="true"
          style={{
            backgroundImage: 'var(--gradient-accent)',
            maskImage: `url(#${maskId})`,
            WebkitMaskImage: `url(#${maskId})`,
          }}
          className="absolute inset-0 rounded-full"
        />
      </div>

      <div className="flex flex-col leading-none">
        <span className="text-body-strong text-mono-num text-primary">
          {completed}/{total}
        </span>
        <span className="text-micro text-tertiary">готово</span>
      </div>
    </div>
  )
}
