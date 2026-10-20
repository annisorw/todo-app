import { useEffect, useState } from 'react'

/**
 * Reads a media query and keeps subscribing to changes. Used for the
 * `prefers-reduced-motion` check that JS-side code (not just CSS) must
 * honour, e.g. disabling `AuroraBackground`'s drift animation outright.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)

    mediaQueryList.addEventListener('change', onChange)
    return () => mediaQueryList.removeEventListener('change', onChange)
  }, [query])

  return matches
}
