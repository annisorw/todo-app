import { useEffect, useState } from 'react'
import { subscribeToAnnouncements } from '../lib/announce'

/**
 * Design spec 3.25: invisible `aria-live="polite"` channel. Every screen
 * reader announcement in the app (search counts, filter switches, theme
 * changes, drag steps, …) is pushed here through `lib/announce.ts` instead
 * of being spoken ad hoc by whichever component triggered it.
 */
export function LiveRegion() {
  const [message, setMessage] = useState('')

  useEffect(() => subscribeToAnnouncements(setMessage), [])

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}
