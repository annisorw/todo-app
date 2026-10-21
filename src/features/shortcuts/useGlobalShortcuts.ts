import { useEffect, useRef } from 'react'
import type { Filter } from '../../domain/filters'
import { isDismissableOpen } from '../../lib/dismissStack'
import { isTextEntry } from './isTextEntry'

export interface GlobalShortcutActions {
  /** `N` — put the caret in the new-task field (desktop) or open the sheet (mobile). */
  newTask: () => void
  /** `/` — focus the search input. */
  focusSearch: () => void
  /** `1` `2` `3` — «Все» · «Активные» · «Готовые». */
  setFilter: (filter: Filter) => void
  /** `?` — the shortcuts cheat sheet (design-spec 3.23 / S12). */
  openShortcuts: () => void
  /** `Esc` on an empty dismiss stack — clears the search query. */
  clearSearch: () => void
  /** `Ctrl/Cmd+Z` — the same `task/restoreRemoved` action the undo toast calls. */
  restoreRemoved: () => void
}

/**
 * `1` `2` `3` keyed by `KeyboardEvent.code`, not by `key`: `code` is the
 * physical top-row digit, so the numeric keypad (`Numpad1`) does not switch
 * filters and a non-Latin layout still works. See the module doc for why
 * letters are matched the same way.
 */
const FILTER_BY_CODE: Record<string, Filter | undefined> = {
  Digit1: 'all',
  Digit2: 'active',
  Digit3: 'completed',
}

/**
 * The one `document`-level hot-key handler (design-spec 6.3, issue point 2).
 *
 * **Which keys live here and which do not.** This hook owns the keys that have
 * to work without anything in particular being focused: `N`, `/`, `1` `2` `3`,
 * `?`, `Esc` and `Ctrl/Cmd+Z`. The row-scoped half of table 6.3 — `E`,
 * `Delete`/`Backspace`, `Ctrl/Cmd+↑`/`↓` — is `useRowShortcuts`, declared once
 * in `TaskList` and delivered to the focused row by React's own delegation.
 * Splitting on "does this key need a focused row" is what keeps every key to a
 * single owner; the two keys the spec lists that appear in neither hook are
 * deliberate:
 *
 * - `↑` `↓` belong to the list's roving tabindex (`useRovingFocus`,
 *   design-spec section 7: «список — одна остановка, внутри ↑/↓»). A
 *   `document` handler would have to steal them from page scrolling whenever
 *   no row is focused.
 * - `Space` on a focused row is the native checkbox's own activation. Handling
 *   it here too would toggle the task twice and leave it where it started.
 *
 * **Three conditions gate everything** (plan section 3):
 *
 * 1. `event.defaultPrevented` — a component already claimed the key. This is
 *    what keeps `Esc` in the composer (clear the draft) from also clearing the
 *    search: React dispatches at the root container, so its handlers have
 *    already run by the time this bubble-phase listener sees the event.
 * 2. `isDismissableOpen()` — a popup, the editor or a modal is open, so single
 *    letters must not fire underneath it. `Esc` never even reaches here in
 *    that case: `lib/dismissStack.ts` swallows it in the capture phase.
 * 3. the text-entry guard — only `Esc` survives it, which is what makes `Esc`
 *    clear the search while the caret is still in the search field.
 *
 * Letters are matched on `event.code` (`KeyN`, `KeyE`) rather than
 * `event.key`: the product is Russian, and on a Cyrillic layout the `N` key
 * reports `event.key === 'т'`. `?` is matched on the produced character
 * instead, because its physical key differs per layout.
 */
export function useGlobalShortcuts(actions: GlobalShortcutActions): void {
  const latest = useRef(actions)

  useEffect(() => {
    latest.current = actions
  })

  // Empty deps on purpose: one listener for the lifetime of the app, reading
  // the current callbacks through the ref. Re-subscribing on every render
  // would churn a `document` listener for no behavioural gain.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.defaultPrevented) return
      if (isDismissableOpen()) return

      if (event.key === 'Escape') {
        handleEscape(event)
        return
      }

      if (isTextEntry(event.target)) return

      if (event.ctrlKey || event.metaKey) {
        // `Ctrl/Cmd+Shift+Z` is redo, not ours; `Ctrl/Cmd+↑`/`↓` is a row key
        // and belongs to `useRowShortcuts`.
        if (event.shiftKey || event.altKey) return
        if (event.code === 'KeyZ') {
          event.preventDefault()
          latest.current.restoreRemoved()
        }
        return
      }
      if (event.altKey) return

      if (event.key === '?') {
        event.preventDefault()
        latest.current.openShortcuts()
        return
      }

      if (event.key === '/' || (event.code === 'Slash' && !event.shiftKey)) {
        event.preventDefault()
        latest.current.focusSearch()
        return
      }

      if (event.shiftKey) return

      const filter = FILTER_BY_CODE[event.code]
      if (filter !== undefined) {
        event.preventDefault()
        latest.current.setFilter(filter)
        return
      }

      if (event.code === 'KeyN') {
        event.preventDefault()
        latest.current.newTask()
      }
    }

    /**
     * `Esc` with an empty dismiss stack: «закрыть/отменить/очистить» has
     * nothing left to close, so it clears the search and drops the row's
     * focus. Never calls `preventDefault` — with nothing open there is no
     * browser default worth suppressing, and claiming the key would hide it
     * from anything mounted later.
     */
    function handleEscape(event: KeyboardEvent): void {
      latest.current.clearSearch()

      const target = event.target
      if (target instanceof HTMLElement && target.closest('[data-task-row]') !== null) {
        target.blur()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
