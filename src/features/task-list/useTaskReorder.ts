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
 * reordered array, which `diffMove` reads back as one from→to pair — told
 * which row the pointer is holding, because the array alone cannot say. The
 * keyboard path is the grab mode on the `DragHandle`: `Space` grabs, `↑`/`↓`
 * step, `Space` drops, `Esc` puts the row back. Every keyboard step goes
 * through `LiveRegion` (acceptance criteria 22–23).
 *
 * The third gesture, `Ctrl/Cmd+↑/↓` without the mode, is *not* bound here:
 * every key in design-spec 6.3 is declared once, in
 * `features/shortcuts/useRowShortcuts`, which delivers it on the row element
 * so it works from the handle, the chips and the row's buttons alike. This
 * hook only owns the writer it calls — `moveRow` — so that gesture still
 * reaches `task/move` through this one path and nothing else.
 */

const ARROW_DELTA: Record<string, -1 | 1 | undefined> = { ArrowUp: -1, ArrowDown: 1 }

/** One shared empty set, so an omitted `pinnedIds` does not change identity every render. */
const NOTHING_PINNED: ReadonlySet<string> = new Set()

export interface UseTaskReorderOptions {
  /**
   * The whole store order. `task/move` indexes into *this* array, never into
   * the display list — what the list renders is filtered and searched, so a
   * display index is not a store index.
   */
  tasks: Task[]
  /** Ids of the rows the active list renders, in display order. */
  ids: string[]
  /**
   * Rows the list renders that take no part in the order: a task checked off
   * holds its old slot for the 600ms `task-settle` window (FELA-126), but
   * from the moment it was checked its place is `completedAt`, and the slot
   * on screen is a freeze-frame rather than a position.
   *
   * They have to stay in `ids` — `useRovingFocus` must still walk them and
   * `Reorder.Group`'s `values` must match the children it renders — so the
   * order logic is told about them separately instead: a step moves *past* a
   * pinned row to the real neighbour beyond it, and the announced position
   * counts only the rows that are really in the order, which is the number
   * that is still true once the window closes.
   */
  pinnedIds?: ReadonlySet<string>
  /** The one order mutator (`task/move`), straight off `useTaskStore`. */
  moveTask: (from: number, to: number) => void
}

export interface TaskReorder {
  /** The row currently held in keyboard grab mode, or `null`. */
  grabbedId: string | null
  /** `Reorder.Group`'s `onReorder` — the pointer path. */
  handleReorder: (nextIds: string[]) => void
  /**
   * `Reorder.Item`'s `onDragStart` — names the row the pointer picked up.
   *
   * Which row moved is not a question the reordered array can answer (see
   * `diffMove`), and the drag already knows. Without this the pointer and
   * the keyboard write *different* store orders for the same visible gesture.
   */
  handleDragStart: (id: string) => void
  /** `Reorder.Item`'s `onDragEnd` — forgets the row, so no later reorder claims it. */
  handleDragEnd: () => void
  /**
   * `DragHandle`'s `onKeyDown` — design-spec 6.4's key bindings, and nothing
   * else: it decodes `Space`/`↑`/`↓`/`Esc` into the four intents below. A key
   * it does not recognise is left un-prevented so it bubbles to the row's
   * `useRowShortcuts`.
   */
  handleHandleKeyDown: (event: KeyboardEvent, id: string) => void
  /** `DragHandle`'s `onBlur` — `release`, bound to the element that loses focus. */
  handleHandleBlur: (id: string) => void
  /**
   * Design-spec 6.4 as four intents plus `release`, so a mode driven by
   * something other than keys — the mobile ↑/↓/«Готово» strip of FELA-177 —
   * runs the *same* transitions and announces the same words instead of
   * restating them. `handleHandleKeyDown` is one caller, not the owner.
   *
   * Each is scoped to the row it names: `grab` is refused while another row
   * is held, and `step`/`drop`/`cancel` do nothing unless `id` is the held
   * row. A caller cannot step a row that was never lifted, or cancel one the
   * list has since dropped.
   */
  grab: (id: string) => void
  /** One *visible* slot, announced as «Позиция N из M». Silent at the ends — no wrap-around. */
  step: (id: string, delta: -1 | 1) => void
  /** Commits the row where it stands and announces it. The steps were already written as they happened. */
  drop: (id: string) => void
  /** Puts the row back where it was lifted from (design-spec 6.4's `Esc`) and announces it. */
  cancel: (id: string) => void
  /**
   * Gives up the mode without announcing and without reverting — what focus
   * leaving the handle means. There is no key left to drop or cancel with,
   * and every step is already committed, so this only drops the lifted look.
   */
  release: (id: string) => void
  /**
   * Steps a row one *visible* slot and announces its new position — the
   * writer behind `useRowShortcuts`'s `Ctrl/Cmd+↑/↓`. Silent at the ends of
   * the list and for a row the list doesn't show: no wrap-around, because a
   * move that teleported the first row to the bottom is a different gesture
   * from "one step".
   */
  moveRow: (id: string, delta: -1 | 1) => void
}

/** `ids` after the same splice-move `task/move` makes — for reading a result off before it is dispatched. */
function withMove(ids: readonly string[], from: number, to: number): string[] {
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  if (moved !== undefined) next.splice(to, 0, moved)
  return next
}

/** Everything strictly between `first` and `last` shifted one slot up. */
function shiftsUp(
  before: readonly string[],
  after: readonly string[],
  first: number,
  last: number,
): boolean {
  for (let i = first; i < last; i += 1) if (after[i] !== before[i + 1]) return false
  return true
}

/** Everything strictly between `first` and `last` shifted one slot down. */
function shiftsDown(
  before: readonly string[],
  after: readonly string[],
  first: number,
  last: number,
): boolean {
  for (let i = first + 1; i <= last; i += 1) if (after[i] !== before[i - 1]) return false
  return true
}

/**
 * The one move a reordered array represents, as a pair of display indices.
 *
 * `Reorder.Group` reports the new order, but `task/move` is a single
 * from→to. Reading the move back out keeps the pointer path on the same
 * action as the keyboard path (point 5 of [FELA-17](/FELA/issues/FELA-17))
 * instead of giving the list a second way to write its order.
 *
 * Two neighbours swapping is *two* moves with one array: `[a,c] → [c,a]` is
 * both "a moved down" and "c moved up". Same rows on screen, different
 * `task/move` — as soon as a row the list doesn't render sits between them,
 * the two writes put the hidden row on opposite sides. So the move cannot be
 * read out of the arrays alone: `movedId` is the row the pointer actually
 * held (`handleDragStart`), and the branch that moves *it* is the answer.
 * Without it the tie goes to "moved down", which is only safe when nothing
 * is hidden.
 *
 * Anything that is not exactly one element moved — equal arrays, different
 * lengths, two unrelated swaps, or a single move of some row other than
 * `movedId` — returns `null` and is ignored: guessing at a multi-element
 * diff would silently reorder rows nobody touched.
 */
export function diffMove(
  before: readonly string[],
  after: readonly string[],
  movedId?: string,
): { from: number; to: number } | null {
  if (before.length !== after.length) return null

  let first = 0
  while (first < before.length && before[first] === after[first]) first += 1
  // Identical arrays: nothing moved.
  if (first === before.length) return null

  let last = before.length - 1
  while (last > first && before[last] === after[last]) last -= 1

  const readings: { from: number; to: number }[] = []
  // Moved down: the element at `first` now sits at `last`, and everything
  // that was between them shifted one slot up.
  if (after[last] === before[first] && shiftsUp(before, after, first, last)) {
    readings.push({ from: first, to: last })
  }
  // Moved up: the element at `last` now sits at `first`, and everything
  // that was between them shifted one slot down.
  if (after[first] === before[last] && shiftsDown(before, after, first, last)) {
    readings.push({ from: last, to: first })
  }

  if (movedId !== undefined) return readings.find((move) => before[move.from] === movedId) ?? null
  return readings[0] ?? null
}

/**
 * Where `Esc` puts a held row back (design-spec 6.4), as an index into the
 * same array `originPrevId` was read from — which is the **store** order,
 * `tasks`, not the display list. Restoring the visible order is not enough:
 * every step of the grab jumps whatever the list doesn't render, so a row put
 * back one visible slot can still have crossed a hidden one for good.
 *
 * The origin is remembered as *the row it sat behind*, not as the index it
 * sat at: the list can be re-filtered or re-searched while the row is held,
 * and an index from the old list points at an arbitrary slot in the new one.
 * An id survives that. `from` is where the row is now, so the result already
 * accounts for the row leaving its current slot — the same splice semantics
 * `task/move` uses.
 *
 * `null` means the row started at the head. An origin row that is itself
 * gone leaves nothing to measure from, so the row stays where it is rather
 * than guessing.
 */
export function resolveOrigin(
  ids: readonly string[],
  from: number,
  originPrevId: string | null,
): number {
  if (originPrevId === null) return 0
  const prev = ids.indexOf(originPrevId)
  if (prev === -1) return from
  return prev < from ? prev + 1 : prev
}

/**
 * The next slot in `direction` that really takes part in the order.
 *
 * A pinned row (see `pinnedIds`) is stepped *over*, not onto: its slot is a
 * freeze-frame of where it used to be, so landing on it writes the moved row
 * behind a task the active list does not even show — the list stands still
 * while the announcement claims a new position. `-1` at the end of the list:
 * no wrap-around.
 */
export function stepSlot(
  ids: readonly string[],
  pinnedIds: ReadonlySet<string>,
  from: number,
  direction: -1 | 1,
): number {
  for (let i = from + direction; i >= 0 && i < ids.length; i += direction) {
    const id = ids[i]
    if (id !== undefined && !pinnedIds.has(id)) return i
  }
  return -1
}

/**
 * Where a pointer drop lands once pinned rows are taken out.
 *
 * The drop slot comes from the gesture, so it can be a pinned row's
 * freeze-frame. Walking back from it *towards* the row's own slot puts the
 * row next to the last real neighbour it visibly passed, which is the move
 * the person saw. `-1` when there is nothing but pinned rows in between —
 * then the gesture moved the row past nothing, and no `task/move` is right.
 *
 * With nothing pinned this is `to` itself, so the ordinary drag is untouched.
 */
export function dropSlot(
  ids: readonly string[],
  pinnedIds: ReadonlySet<string>,
  from: number,
  to: number,
): number {
  const back = to > from ? -1 : 1
  for (let i = to; i !== from; i += back) {
    const id = ids[i]
    if (id !== undefined && !pinnedIds.has(id)) return i
  }
  return -1
}

export function useTaskReorder({ tasks, ids, pinnedIds, moveTask }: UseTaskReorderOptions): TaskReorder {
  const [grabbedId, setGrabbedId] = useState<string | null>(null)
  // The row the held one sat behind in the **store** when it was lifted —
  // see `resolveOrigin`.
  const originPrevId = useRef<string | null>(null)
  // The row the pointer is dragging right now — see `handleDragStart`.
  const pointerDragId = useRef<string | null>(null)

  // A held row can leave the list under us: filtered out, searched away,
  // deleted. Focus never left the handle, so no `blur` arrives to clear the
  // grab, and the stale id would block every other row from being lifted
  // with nothing on screen to say why. Dropped during render rather than in
  // an effect, so the whole hook reads one value for "what is held" in the
  // same pass — and so a row that comes back into view does not come back
  // lifted.
  const held = grabbedId !== null && ids.includes(grabbedId) ? grabbedId : null
  if (grabbedId !== held) setGrabbedId(held)

  const pinned = pinnedIds ?? NOTHING_PINNED

  /**
   * The list as the order sees it: the rendered rows minus the pinned ones.
   * Positions are announced against *this*, so «позиция 2 из 4» stays true
   * after the `task-settle` window closes and the row leaves the list.
   */
  const inOrder = useCallback((list: readonly string[]) => list.filter((id) => !pinned.has(id)), [pinned])

  /** The position a row would be announced at, 1-based, once `list` is the display order. */
  const rankIn = useCallback((list: readonly string[], id: string) => inOrder(list).indexOf(id) + 1, [inOrder])

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
      // Backstop for both callers: a pinned row has no place in the order to
      // move it to or from, and translating its freeze-frame slot into a
      // store index is meaningless (see `pinnedIds`). Silent rather than
      // wrong — the slot resolvers above are supposed to have ruled it out.
      if (pinned.has(fromId) || pinned.has(toId)) return false

      const storeFrom = tasks.findIndex((task) => task.id === fromId)
      const storeTo = tasks.findIndex((task) => task.id === toId)
      if (storeFrom === -1 || storeTo === -1) return false

      moveTask(storeFrom, storeTo)
      return true
    },
    [ids, tasks, pinned, moveTask],
  )

  const handleDragStart = useCallback((id: string) => {
    pointerDragId.current = id
  }, [])

  const handleDragEnd = useCallback(() => {
    pointerDragId.current = null
  }, [])

  const handleReorder = useCallback(
    (nextIds: string[]) => {
      // `Reorder.Group` only reports while a drag is in flight, so the id is
      // there; `undefined` would fall back to reading the move out of the
      // arrays, which is ambiguous for two neighbours (see `diffMove`).
      const move = diffMove(ids, nextIds, pointerDragId.current ?? undefined)
      if (move === null) return

      // The drop slot is wherever the gesture ended, which can be a pinned
      // row's freeze-frame — `dropSlot` pulls it back to the last real
      // neighbour the row passed.
      const to = dropSlot(ids, pinned, move.from, move.to)
      if (to === -1) return
      applyMove(move.from, to)
    },
    [ids, pinned, applyMove],
  )

  const moveRow = useCallback(
    (id: string, delta: -1 | 1) => {
      const index = ids.indexOf(id)
      if (index === -1) return

      const to = stepSlot(ids, pinned, index, delta)
      if (to === -1) return

      if (applyMove(index, to)) {
        const next = withMove(ids, index, to)
        announce(
          `Задача «${titleOf(id)}» перемещена на позицию ${rankIn(next, id)} из ${inOrder(next).length}`,
        )
      }
    },
    [ids, pinned, applyMove, titleOf, rankIn, inOrder],
  )

  const grab = useCallback(
    (id: string) => {
      const index = ids.indexOf(id)
      if (index === -1) return
      // A pinned row is on its way out of the list and has no position to
      // move from (see `pinnedIds`); it shows no handle either.
      if (pinned.has(id)) return
      // Another row is still held — one grab at a time.
      if (held !== null) return

      const storeIndex = tasks.findIndex((task) => task.id === id)
      // A rendered row is always in the store; nothing to put back if it
      // somehow is not, so it does not get lifted either.
      if (storeIndex === -1) return

      originPrevId.current = storeIndex > 0 ? (tasks[storeIndex - 1]?.id ?? null) : null
      setGrabbedId(id)
      announce(`Задача «${titleOf(id)}» поднята, позиция ${rankIn(ids, id)} из ${inOrder(ids).length}`)
    },
    [ids, tasks, held, pinned, titleOf, rankIn, inOrder],
  )

  const step = useCallback(
    (id: string, delta: -1 | 1) => {
      if (held !== id) return
      const index = ids.indexOf(id)
      if (index === -1) return

      const to = stepSlot(ids, pinned, index, delta)
      if (to === -1) return
      if (applyMove(index, to)) {
        const next = withMove(ids, index, to)
        announce(`Позиция ${rankIn(next, id)} из ${inOrder(next).length}`)
      }
    },
    [ids, held, pinned, applyMove, rankIn, inOrder],
  )

  const drop = useCallback(
    (id: string) => {
      if (held !== id) return
      const index = ids.indexOf(id)
      if (index === -1) return

      setGrabbedId(null)
      announce(`Задача «${titleOf(id)}» опущена на позицию ${rankIn(ids, id)}`)
    },
    [ids, held, titleOf, rankIn],
  )

  const cancel = useCallback(
    (id: string) => {
      if (held !== id) return
      setGrabbedId(null)

      // Cancelling is the one move measured in store indices. Every step of
      // the grab was a *visible* step that jumped whatever sits hidden
      // between the rows, so undoing the visible steps would leave the row
      // on the far side of those hidden tasks for good.
      const storeIds = tasks.map((task) => task.id)
      const storeFrom = storeIds.indexOf(id)
      if (storeFrom === -1) return
      const storeTo = resolveOrigin(storeIds, storeFrom, originPrevId.current)
      if (storeTo !== storeFrom) moveTask(storeFrom, storeTo)

      // Announced in the visible terms the person is reading the list in:
      // the restored store order, minus the rows this list doesn't render.
      const restored = inOrder(
        withMove(storeIds, storeFrom, storeTo).filter((candidate) => ids.includes(candidate)),
      )
      announce(`Перемещение отменено, позиция ${restored.indexOf(id) + 1}`)
    },
    [ids, tasks, held, moveTask, inOrder],
  )

  const release = useCallback((id: string) => {
    setGrabbedId((current) => (current === id ? null : current))
  }, [])

  const handleHandleKeyDown = useCallback(
    (event: KeyboardEvent, id: string) => {
      if (!ids.includes(id)) return

      if (event.key === ' ') {
        // The handle is a `<button>`: without this, Space would also fire
        // its click on keyup.
        event.preventDefault()
        if (held === id) drop(id)
        else grab(id)
        return
      }

      // Not the held row: every other key on the handle belongs to the row's
      // own handler (`useRowShortcuts` — `E`, `Delete`, `Ctrl/Cmd+↑/↓`).
      // Nothing is prevented here, so the event bubbles on to it.
      if (held !== id) return

      if (event.key === 'Escape') {
        event.preventDefault()
        cancel(id)
        return
      }

      const delta = ARROW_DELTA[event.key]
      if (delta === undefined) return

      // Prevented even at the ends of the list, where `step` does nothing:
      // otherwise the arrow falls through to the roving `↑`/`↓` and the
      // *focus* leaves the row the person is still holding.
      event.preventDefault()
      step(id, delta)
    },
    [ids, held, grab, step, drop, cancel],
  )

  const handleHandleBlur = useCallback((id: string) => release(id), [release])

  return {
    grabbedId: held,
    handleReorder,
    handleDragStart,
    handleDragEnd,
    handleHandleKeyDown,
    handleHandleBlur,
    grab,
    step,
    drop,
    cancel,
    release,
    moveRow,
  }
}
