import { useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { isDismissableOpen } from '../../lib/dismissStack'
import { isTextEntry } from './isTextEntry'

export interface RowShortcutActions {
  /** `E` — open `TaskEditor` on this row (text, priority and due date). */
  openEditor: (taskId: string) => void
  /** `Delete` / `Backspace` — remove, with the undo toast. */
  removeTask: (taskId: string) => void
  /** `Ctrl/Cmd+↑` / `↓` — move the row one step (design-spec 6.4, the no-mode alternative). */
  moveTask: (taskId: string, delta: -1 | 1) => void
}

/**
 * `focusNeighbour` moves focus onto a surviving row of the *same* roving
 * group before `Delete` unmounts the focused one. It is a required argument
 * rather than part of `RowShortcutActions` because the two row groups — the
 * active list and «Выполнено» — are separate roving groups with separate
 * `useRovingFocus` instances, and only the group rendering the row knows
 * where its focus should land next. Making it required means a new row group
 * cannot quietly forget it and drop the user back on `<body>`.
 */
export type RowKeyDownHandler = (
  event: KeyboardEvent<Element>,
  taskId: string,
  focusNeighbour: () => void,
) => void

/**
 * The row-scoped half of design-spec 6.3 — the keys that are meaningless
 * without a focused row, so they are delivered to it by React's delegation
 * instead of by a `document` listener (see `useGlobalShortcuts` for the full
 * split and for the keys that live in neither hook).
 *
 * Declared **once**, in `TaskList`, and handed to both row groups — the
 * active list and «Выполнено» — so the two cannot drift. The returned handler
 * goes on the row element rather than on its checkbox: after Tab the focus
 * inside a row can sit on the drag handle, the `edit`/`more` buttons or an
 * interactive chip, and `E` has to work from all of them.
 *
 * Mirrors `useGlobalShortcuts`'s three gates, for the same reasons: an already
 * handled key, an open layer (the row's own priority/due-date popup counts —
 * `Delete` there must not delete the task behind the popup) and text entry
 * (the editor's `textarea` lives inside the row).
 */
export function useRowShortcuts(actions: RowShortcutActions): RowKeyDownHandler {
  const latest = useRef(actions)

  useEffect(() => {
    latest.current = actions
  })

  // A stable handler: `TaskRow` takes it as a prop, and a new identity on
  // every keystroke would re-render every row in the list.
  return useCallback((event: KeyboardEvent<Element>, taskId: string, focusNeighbour: () => void) => {
    if (event.defaultPrevented) return
    if (isDismissableOpen()) return
    if (isTextEntry(event.target)) return

    if (event.ctrlKey || event.metaKey) {
      if (event.shiftKey || event.altKey) return
      const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : null
      if (delta === null) return

      event.preventDefault()
      latest.current.moveTask(taskId, delta)
      return
    }
    if (event.altKey || event.shiftKey) return

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      // Order matters: hand focus to the neighbour *first*, while this row is
      // still mounted. Removal unmounts the focused node (after its exit
      // animation), and focus would otherwise fall back to `<body>`, making
      // the keyboard user restart the Tab sequence from the header — the list
      // is one Tab stop, so there is no way back to the row they were at.
      focusNeighbour()
      latest.current.removeTask(taskId)
      return
    }

    // `code`, not `key`: on a Cyrillic layout this physical key reports «у».
    if (event.code === 'KeyE') {
      event.preventDefault()
      latest.current.openEditor(taskId)
    }
  }, [])
}
