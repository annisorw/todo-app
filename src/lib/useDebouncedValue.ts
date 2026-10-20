import { useEffect, useState } from 'react'

/**
 * Holds the previous `value` until the new one has stayed stable for
 * `delayMs`. Used for the search field's 180 ms debounce (design-spec 3.8)
 * so the filter/search selector doesn't re-run on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
