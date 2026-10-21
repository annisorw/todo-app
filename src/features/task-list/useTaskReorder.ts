import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Task } from '../../domain/task'
import { announce } from '../../lib/announce'

/**
 * Pointer **and** keyboard reordering of the active list (design-spec 6.4,
 * S8; architecture section 7) — both through the single `task/move` action,
 * so the list has exactly one way to write its order.
 *
 * The mouse path is Framer Motion's `Reorder.Group`: it hands over a whole
 * reordered array, which `diffMove` reads back as one from→to pair. The
 * keyboard path is this hook's own: `Space` grabs, `↑`/`↓` step, `Space`
 * drops, `Esc` puts the row back, and `Ctrl/Cmd+↑/↓` steps a row without
 * entering the mode at all. Every keyboard step goes through `LiveRegion`
 * (acceptance criteria 22–23).
 */

const ARROW_DELTA: Record<string, number | undefined> = { ArrowUp: -1, ArrowDown: 1 }

export interface UseTaskReorderOptions {
  /**
   * The whole store order. `task/move` indexes into *this* array, never into
   * the display list — what the list renders is filtered and searched, so a
   * display index is not a store index.
   */
  tasks: Task[]
  /** Ids of the rows the active list renders, in display order. */
  ids: string[]
  /** The one order mutator (`task/move`), straight off `useTaskStore`. */
  moveTask: (from: number, to: number) => void
}

export interface TaskReorder {
  /** The row currently held in keyboard grab mode, or `null`. */
  grabbedId: string | null
  /** `Reorder.Group`'s `onReorder` — the pointer path. */
  handleReorder: (nextIds: string[]) => void
  /** `DragHandle`'s `onKeyDown`: the grab mode, plus the `Ctrl/Cmd` step. */
  handleHandleKeyDown: (event: KeyboardEvent, id: string) => void
  /** `DragHandle`'s `onBlur` — drops the lifted look when focus leaves. */
  handleHandleBlur: (id: string) => void
  /** `Ctrl/Cmd+↑/↓` on a focused row. Returns `true` when it consumed the event. */
  handleRowKeyDown: (event: KeyboardEvent, id: string) => boolean
}

/**
 * The one move a reordered array represents, as a pair of display indices.
 *
 * `Reorder.Group` reports the new order, but `task/move` is a single
 * from→to. Reading the move back out keeps the pointer path on the same
 * action as the keyboard path (point 5 of [FELA-17](/FELA/issues/FELA-17))
 * instead of giving the list a second way to write its order.
 *
 * Anything that is not exactly one element moved — equal arrays, different
 * lengths, two unrelated swaps — returns `null` and is ignored: guessing at
 * a multi-element diff would silently reorder rows nobody touched.
 */
export function diffMove(
  before: readonly string[],
  after: readonly string[],
): { from: number; to: number } | null {
  if (before.length !== after.length) return null

  let first = 0
  while (first < before.length && before[first] === after[first]) first += 1
  // Identical arrays: nothing moved.
  if (first === before.length) return null

  let last = before.length - 1
  while (last > first && before[last] === after[last]) last -= 1

  // Moved down: the element at `first` now sits at `last`, and everything
  // that was between them shifted one slot up.
  if (after[last] === before[first]) {
    for (let i = first; i < last; i += 1) if (after[i] !== before[i + 1]) return null
    return { from: first, to: last }
  }

  // Moved up: the element at `last` now sits at `first`, and everything
  // that was between them shifted one slot down.
  if (after[first] === before[last]) {
    for (let i = first + 1; i <= last; i += 1) if (after[i] !== before[i - 1]) return null
    return { from: last, to: first }
  }

  return null
}

export function useTaskReorder({ tasks, ids, moveTask }: UseTaskReorderOptions): TaskReorder {
  const [grabbedId, setGrabbedId] = useState<string | null>(null)
  // Where the grab started, so `Esc` can put the row back (design-spec 6.4).
  const originIndex = useRef(0)

  const titleOf = useCallback(
    (id: string) => tasks.find((task) => task.id === id)?.title ?? '',
    [tasks],
  )

  /**
   * Translates a display move into the store move and dispatches it.
   *
   * The target store index is the index of whichever task currently sits at
   * the target *display* slot. Under a filter or a search that means the row
   * lands immediately next to the neighbour it visibly passed, jumping the
   * hidden tasks in between — the only reading that matches what the person
   * sees happen.
   */
  const applyMove = useCallback(
    (from: number, to: number): boolean => {
      if (from === to) return false
      const fromId = ids[from]
      const toId = ids[to]
      if (fromId === undefined || toId === undefined) return false

      const storeFrom = tasks.findIndex((task) => task.id === fromId)
      const storeTo = tasks.findIndex((task) => task.id === toId)
      if (storeFrom === -1 || storeTo === -1) return false

      moveTask(storeFrom, storeTo)
      return true
    },
    [ids, tasks, moveTask],
  )

  const handleReorder = useCallback(
    (nextIds: string[]) => {
      const move = diffMove(ids, nextIds)
      if (move === null) return
      applyMove(move.from, move.to)
    },
    [ids, applyMove],
  )

  const handleRowKeyDown = useCallback(
    (event: KeyboardEvent, id: string): boolean => {
      if (!event.ctrlKey && !event.metaKey) return false
      const delta = ARROW_DELTA[event.key]
      if (delta === undefined) return false

      const index = ids.indexOf(id)
      if (index === -1) return false

      // Consumed even at the ends of the list: letting `Ctrl+↑` on the first
      // row fall through to the roving `↑` would wrap the *focus* around
      // instead of doing nothing, which reads as the row having moved.
      event.preventDefault()
      const to = index + delta
      if (to < 0 || to >= ids.length) return true

      if (applyMove(index, to)) {
        announce(`Задача «${titleOf(id)}» перемещена на позицию ${to + 1} из ${ids.length}`)
      }
      return true
    },
    [ids, applyMove, titleOf],
  )

  const handleHandleKeyDown = useCallback(
    (event: KeyboardEvent, id: string) => {
      const index = ids.indexOf(id)
      if (index === -1) return

      if (event.key === ' ') {
        // The handle is a `<button>`: without this, Space would also fire
        // its click on keyup.
        event.preventDefault()

        if (grabbedId === id) {
          setGrabbedId(null)
          announce(`Задача «${titleOf(id)}» опущена на позицию ${index + 1}`)
          return
        }
        // Another row is still held — one grab at a time.
        if (grabbedId !== null) return

        originIndex.current = index
        setGrabbedId(id)
        announce(`Задача «${titleOf(id)}» поднята, позиция ${index + 1} из ${ids.length}`)
        return
      }

      if (grabbedId !== id) {
        handleRowKeyDown(event, id)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        // The list can have got shorter while the row was held.
        const origin = Math.min(originIndex.current, ids.length - 1)
        applyMove(index, origin)
        setGrabbedId(null)
        announce(`Перемещение отменено, позиция ${origin + 1}`)
        return
      }

      const delta = ARROW_DELTA[event.key]
      if (delta === undefined) return

      event.preventDefault()
      const to = index + delta
      if (to < 0 || to >= ids.length) return
      if (applyMove(index, to)) announce(`Позиция ${to + 1} из ${ids.length}`)
    },
    [ids, grabbedId, applyMove, titleOf, handleRowKeyDown],
  )

  const handleHandleBlur = useCallback((id: string) => {
    // Focus left the handle, so there is no key left to drop or cancel with.
    // Every step was already committed through `task/move` as it happened,
    // so this only drops the lifted look — it reverts nothing.
    setGrabbedId((current) => (current === id ? null : current))
  }, [])

  return {
    // A held row can leave the list under us (filtered out, deleted); don't
    // keep claiming it is lifted.
    grabbedId: grabbedId !== null && ids.includes(grabbedId) ? grabbedId : null,
    handleReorder,
    handleHandleKeyDown,
    handleHandleBlur,
    handleRowKeyDown,
  }
}
