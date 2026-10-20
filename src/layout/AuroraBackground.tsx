import { cn } from '../lib/cn'
import { useMediaQuery } from '../lib/useMediaQuery'

const BLOBS = [
  { colorClassName: 'bg-aurora-1', positionClassName: '-top-20 -left-16 size-96' },
  { colorClassName: 'bg-aurora-2', positionClassName: '-top-10 -right-20 size-80' },
  { colorClassName: 'bg-aurora-3', positionClassName: '-bottom-24 left-1/3 size-80' },
]

/**
 * Design spec 3.2. Three blurred colour blobs behind everything, plus a
 * static grain overlay. `position: fixed` + `pointer-events: none` keep it
 * out of layout and out of the way of clicks; `useMediaQuery` (not CSS
 * alone) gates the drift animation so reduced-motion users get a fully
 * static composition, matching acceptance criterion 17.
 */
export function AuroraBackground() {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-(--z-base) overflow-hidden">
      {BLOBS.map((blob, index) => (
        <div
          key={index}
          className={cn(
            'absolute rounded-full blur-(--blur-aurora)',
            blob.colorClassName,
            blob.positionClassName,
            !prefersReducedMotion && 'animate-aurora-drift',
          )}
        />
      ))}
      <svg className="absolute inset-0 size-full opacity-50 mix-blend-overlay">
        <filter id="aurora-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="noise" />
          {/* Keep only the noise's alpha channel (0 RGB everywhere), so the
           * next step tints it with a single token colour instead of
           * painting random greys. */}
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="noiseAlpha"
          />
          <feFlood floodColor="var(--color-surface-border)" result="tint" />
          <feComposite in="tint" in2="noiseAlpha" operator="in" />
        </filter>
        <rect width="100%" height="100%" filter="url(#aurora-grain)" />
      </svg>
    </div>
  )
}
