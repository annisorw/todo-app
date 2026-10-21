import type { ReactNode } from 'react'

/**
 * Splits `title` on every case-insensitive occurrence of `query` into plain
 * strings and `<mark>` elements — never a string with tags.
 *
 * `docs/CODE-RULES.md` section 2: highlighting matched text is this
 * product's most likely stored-XSS surface (a task titled
 * `<img src=x onerror=...>` must never reach `dangerouslySetInnerHTML`), so
 * this always returns React elements.
 *
 * No `RegExp` is built from `query`: a user-supplied pattern is its own
 * problem (ReDoS, broken metacharacters), so matching is plain `indexOf`.
 */
export function highlight(title: string, query: string): ReactNode {
  const q = query.trim().toLowerCase()
  if (!q) return title

  const parts: ReactNode[] = []
  let rest = title
  let key = 0

  for (;;) {
    const at = rest.toLowerCase().indexOf(q)
    if (at === -1) break
    if (at > 0) parts.push(rest.slice(0, at))
    parts.push(<mark key={key++}>{rest.slice(at, at + q.length)}</mark>)
    rest = rest.slice(at + q.length)
  }
  parts.push(rest)
  return parts
}
