import { act, renderHook } from '@testing-library/react'
import type { KeyboardEvent } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Task } from '../../domain/task'
import { subscribeToAnnouncements } from '../../lib/announce'
import { makeTask } from '../../test/factories'
import { diffMove, resolveOrigin, useTaskReorder } from './useTaskReorder'

/**
 * `Reorder.Group` reports a whole reordered array; `task/move` is one
 * from→to. This is the step between the two, and it is where the pointer
 * path stays honest about being the same single action as the keyboard one.
 */
describe('diffMove', () => {
  // An adjacent swap has two equally true readings — "a moved down" and "b
  // moved up" — and they produce the same array, so either is a correct
  // answer. These pin the one the implementation picks.
  it('reads a one-step swap at the head of the list', () => {
    expect(diffMove(['a', 'b', 'c'], ['b', 'a', 'c'])).toEqual({ from: 0, to: 1 })
  })

  it('reads a one-step swap at the tail of the list', () => {
    expect(diffMove(['a', 'b', 'c'], ['a', 'c', 'b'])).toEqual({ from: 1, to: 2 })
  })

  it('reads a move across several slots, in both directions', () => {
    expect(diffMove(['a', 'b', 'c', 'd'], ['b', 'c', 'd', 'a'])).toEqual({ from: 0, to: 3 })
    expect(diffMove(['a', 'b', 'c', 'd'], ['d', 'a', 'b', 'c'])).toEqual({ from: 3, to: 0 })
  })

  it('reads a move that leaves both ends of the list untouched', () => {
    expect(diffMove(['a', 'b', 'c', 'd', 'e'], ['a', 'c', 'd', 'b', 'e'])).toEqual({ from: 1, to: 3 })
  })

  it('reports nothing for an unchanged order', () => {
    expect(diffMove(['a', 'b', 'c'], ['a', 'b', 'c'])).toBeNull()
    expect(diffMove([], [])).toBeNull()
  })

  it('refuses a diff that is not one element moved', () => {
    // Two independent swaps: guessing which one was dragged would silently
    // reorder a row nobody touched.
    expect(diffMove(['a', 'b', 'c', 'd'], ['b', 'a', 'd', 'c'])).toBeNull()
    // A row appeared or vanished between the two arrays.
    expect(diffMove(['a', 'b'], ['a', 'b', 'c'])).toBeNull()
    expect(diffMove(['a', 'b', 'c'], ['a', 'b'])).toBeNull()
    // Same length, different members.
    expect(diffMove(['a', 'b'], ['a', 'z'])).toBeNull()
  })

  it('survives a single-row list', () => {
    expect(diffMove(['a'], ['a'])).toBeNull()
  })
})

describe('resolveOrigin', () => {
  it('puts a row back where it was when nothing else changed', () => {
    expect(resolveOrigin(['c', 'a', 'b'], 0, 'b')).toBe(2)
    expect(resolveOrigin(['b', 'a', 'c'], 0, null)).toBe(0)
    expect(resolveOrigin(['a', 'c', 'b'], 2, 'a')).toBe(1)
  })

  it('still finds the slot after the rows above it were filtered away', () => {
    // Held row `c` started behind `b`, then moved to the end; `a` has since
    // left the display list. Its old index (2) now points past its own slot.
    expect(resolveOrigin(['b', 'd', 'c'], 2, 'b')).toBe(1)
  })

  it('leaves the row alone when the row it started behind is gone', () => {
    expect(resolveOrigin(['a', 'c'], 1, 'b')).toBe(1)
  })
})

/**
 * The grab mode's own state, driven straight through the hook: the display
 * list can change under a held row (a filter, a search, a deletion) while
 * focus never leaves the handle, and `blur` never comes to clean up.
 */
describe('useTaskReorder grab mode', () => {
  const keyEvent = (key: string) =>
    ({ key, preventDefault: () => undefined }) as unknown as KeyboardEvent

  let unsubscribe: (() => void) | null = null

  afterEach(() => {
    unsubscribe?.()
    unsubscribe = null
  })

  function setup(initial: string[]) {
    let tasks: Task[] = initial.map((id) => makeTask({ id, title: id.toUpperCase() }))
    const hidden = new Set<string>()
    const displayIds = () => tasks.filter((task) => !hidden.has(task.id)).map((task) => task.id)

    const moveTask = (from: number, to: number) => {
      const next = [...tasks]
      const [row] = next.splice(from, 1)
      if (row !== undefined) next.splice(to, 0, row)
      tasks = next
    }

    let announced = ''
    unsubscribe = subscribeToAnnouncements((message) => {
      announced = message
    })

    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useTaskReorder({ tasks, ids, moveTask }),
      { initialProps: { ids: displayIds() } },
    )

    /** Re-renders with the list as it stands now — the store moved, or a filter did. */
    const sync = () => {
      rerender({ ids: displayIds() })
    }

    return {
      result,
      sync,
      press(key: string, id: string) {
        act(() => {
          result.current.handleHandleKeyDown(keyEvent(key), id)
        })
        sync()
      },
      hide(id: string) {
        hidden.add(id)
        sync()
      },
      show(id: string) {
        hidden.delete(id)
        sync()
      },
      order: () => tasks.map((task) => task.id),
      displayIds,
      announced: () => announced,
    }
  }

  it('lets another row be lifted after the held one leaves the list', () => {
    const list = setup(['a', 'b', 'c'])

    list.press(' ', 'a')
    expect(list.result.current.grabbedId).toBe('a')

    list.hide('a')
    expect(list.result.current.grabbedId).toBeNull()

    list.press(' ', 'b')

    expect(list.result.current.grabbedId).toBe('b')
    expect(list.announced()).toBe('Задача «B» поднята, позиция 1 из 2')
  })

  it('does not re-lift a row that comes back into the list', () => {
    const list = setup(['a', 'b'])

    list.press(' ', 'a')
    list.hide('a')
    expect(list.result.current.grabbedId).toBeNull()

    // The filter is cleared again: `a` is back on screen, and plainly not held.
    list.show('a')
    expect(list.displayIds()).toEqual(['a', 'b'])
    expect(list.result.current.grabbedId).toBeNull()
  })

  it('Esc returns the row to its neighbour, not to a stale index', () => {
    const list = setup(['a', 'b', 'c', 'd'])

    list.press(' ', 'c')
    list.press('ArrowDown', 'c')
    expect(list.order()).toEqual(['a', 'b', 'd', 'c'])

    // `a` leaves the display list while `c` is still held: `c`'s start index
    // (2) now points at its own slot, so an index-based Esc would stand still.
    list.hide('a')
    list.press('Escape', 'c')

    expect(list.displayIds()).toEqual(['b', 'c', 'd'])
    expect(list.announced()).toBe('Перемещение отменено, позиция 2')
  })
})
