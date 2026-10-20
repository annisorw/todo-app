type Listener = (message: string) => void

const listeners = new Set<Listener>()

/**
 * The single channel every feature uses to push a message into `LiveRegion`
 * (search results, filter changes, theme switches, etc. — architecture
 * doc section 7). Decoupled via a tiny pub/sub instead of context so
 * call sites never need to be inside a specific provider tree.
 */
export function announce(message: string): void {
  for (const listener of listeners) listener(message)
}

export function subscribeToAnnouncements(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
