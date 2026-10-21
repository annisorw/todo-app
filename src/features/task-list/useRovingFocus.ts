import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

export interface RovingFocus {
  /** The row currently acting as the list's one Tab stop. */
  activeId: string | null
  /** `0` for the active row's focusable nodes (checkbox, handle, edit, more, interactive chips), `-1` otherwise. */
  getTabIndex: (id: string) => 0 | -1
  /** Registers the DOM node ↑/↓ should focus when a row becomes active — the row's checkbox. */
  registerRef: (id: string, node: HTMLElement | null) => void
  /** A row's checkbox received real focus (click, or landed here after a move) — syncs the active id. */
  handleFocus: (id: string) => void
  /** ↑/↓ on a row's checkbox moves both the active id and the real DOM focus to the neighbour. */
  handleKeyDown: (event: KeyboardEvent, id: string) => void
}

/**
 * Roving tabindex for the task list (architecture section 7, design-spec
 * section 7): the list is a single Tab stop, ↑/↓ move focus between rows.
 *
 * The accessible-name contract (acceptance criterion 25 — a screen reader
 * must read "флажок, …") means the roving anchor has to be an actual
 * `role="checkbox"` node, not a generic row wrapper: AT only announces
 * "checkbox" for a real checkbox. So `TaskRow` registers its `Checkbox`'s
 * native input here, and the row's `edit`/`more`/`handle` buttons and
 * interactive priority/due-date chips ask `getTabIndex` for the same id —
 * all of them join the tab sequence only while their row is active,
 * otherwise 20 tasks is 80+ Tab stops (architecture section 7).
 */
export function useRovingFocus(ids: string[]): RovingFocus {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null)
  const nodes = useRef(new Map<string, HTMLElement>())

  const registerRef = useCallback((id: string, node: HTMLElement | null) => {
    if (node === null) nodes.current.delete(id)
    else nodes.current.set(id, node)
  }, [])

  // `activeId` can point at a row that just left `ids` (filtered out,
  // deleted) — fall back to the first row rather than losing the one Tab
  // stop the list is supposed to have.
  const effectiveActiveId = activeId !== null && ids.includes(activeId) ? activeId : ids[0] ?? null

  const getTabIndex = useCallback(
    (id: string): 0 | -1 => (id === effectiveActiveId ? 0 : -1),
    [effectiveActiveId],
  )

  const handleFocus = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent, id: string) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      // `Ctrl/Cmd+↑`/`↓` *moves* the row (design-spec 6.4) — a different
      // gesture, owned by `useRowShortcuts`. Without this guard navigation
      // would fire first and the row would move away from the focused line.
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return

      const index = ids.indexOf(id)
      if (index === -1) return

      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = (((index + delta) % ids.length) + ids.length) % ids.length
      const nextId = ids[nextIndex]
      if (nextId === undefined) return

      setActiveId(nextId)
      nodes.current.get(nextId)?.focus()
    },
    [ids],
  )

  return { activeId: effectiveActiveId, getTabIndex, registerRef, handleFocus, handleKeyDown }
}
