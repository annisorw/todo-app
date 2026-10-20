import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export interface StickyBandResult {
  /** Zero-height marker placed immediately above the sticky band in the DOM. */
  sentinelRef: RefObject<HTMLDivElement | null>
  /** True once the band has scrolled under `top: 0` and should paint `.is-stuck`. */
  isStuck: boolean
}

/**
 * Design-spec S1: the toolbar band is transparent until the list scrolls
 * under it. `IntersectionObserver` on a zero-height sentinel placed right
 * above the band (not a `scroll` listener — architecture section 7 keeps
 * scroll-driven work off the main thread's scroll handler) reports whether
 * that sentinel is still visible. Once the band pins to `top: 0` and the
 * sentinel scrolls above the viewport, the observer reports it as no longer
 * intersecting, which is exactly the moment the band should turn opaque.
 */
export function useStickyBand(): StickyBandResult {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setIsStuck(!entry.isIntersecting)
      },
      { threshold: 0 },
    )
    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [])

  return { sentinelRef, isStuck }
}
