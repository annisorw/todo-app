import type { CSSProperties } from 'react'

/** `static` renders an inert `<span>`; `interactive` renders a focusable `<button>` (design-spec v1.1, section 7). */
export type ChipVariant = 'static' | 'interactive'

export const CHIP_BASE_CLASSES =
  'inline-flex h-6 items-center gap-1 rounded-full px-2 text-caption transition-colors duration-(--duration-fast) ease-standard'

/**
 * Transparent 44 px tap target on an interactive chip, below the `sm`
 * breakpoint only (design-spec 1.7, section 7, acceptance criteria 38-39). The
 * chip stays 24 px tall and nothing it paints moves — only the target grows.
 *
 * Three decisions here are measured, not guessed:
 *
 * - The height is a number plus a centring translate rather than
 *   `inset-block: -10px`. The chip carries a 1 px transparent border
 *   (`CHIP_CLOSED_BORDER_CLASS`), an absolutely positioned child resolves
 *   against the padding box, and "-10 px above and below" therefore lands on
 *   42 px, not 44.
 * - It grows vertically only. The composer's chips sit 8 px apart, so widening
 *   the target would make neighbours steal each other's taps.
 * - `max-sm:` scopes the whole thing — `position` included — to mobile. On
 *   desktop 24 px is a deliberate exception (section 7), and an invisible band
 *   reaching over `TaskRow`'s title would get in the way of selecting it.
 */
export const CHIP_INTERACTIVE_TOUCH_TARGET_CLASSES =
  "max-sm:relative max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:top-1/2 max-sm:after:h-11 max-sm:after:-translate-y-1/2 max-sm:after:content-['']"

export const CHIP_OPEN_BORDER_CLASS = 'border border-accent-text'
export const CHIP_CLOSED_BORDER_CLASS = 'border border-transparent'
export const CHIP_OPEN_BACKGROUND_STYLE: CSSProperties = { backgroundImage: 'var(--gradient-accent-soft)' }
