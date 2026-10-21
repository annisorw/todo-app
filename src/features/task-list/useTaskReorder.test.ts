import { act, renderHook } from '@testing-library/react'
import type { KeyboardEvent } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Task } from '../../domain/task'
import { subscribeToAnnouncements } from '../../lib/announce'
import { makeTask } from '../../test/factories'
import { diffMove, resolveOrigin, useTaskReorder } from './useTaskReorder'
import type { TaskReorder } from './useTaskReorder'

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

  it('lets the row that was dragged settle an adjacent swap', () => {
    // The two readings of `['a','c'] → ['c','a']` are "a moved down" and "c
    // moved up". They are the same display order and *different* store
    // writes as soon as a hidden task sits between the two, so the answer
    // has to come from the drag itself, not from the array.
    expect(diffMove(['a', 'c'], ['c', 'a'], 'c')).toEqual({ from: 1, to: 0 })
    expect(diffMove(['a', 'c'], ['c', 'a'], 'a')).toEqual({ from: 0, to: 1 })
  })

  it('refuses a diff that does not move the row that was dragged', () => {
    expect(diffMove(['a', 'b', 'c'], ['b', 'c', 'a'], 'b')).toBeNull()
    expect(diffMove(['a', 'b', 'c'], ['b', 'a', 'c'], 'c')).toBeNull()
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

  // One per `setup` — a test that compares two paths builds two lists.
  const unsubscribes: (() => void)[] = []

  afterEach(() => {
    for (const unsubscribe of unsubscribes) unsubscribe()
    unsubscribes.length = 0
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
    unsubscribes.push(
      subscribeToAnnouncements((message) => {
        announced = message
      }),
    )

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
      /**
       * The mode without a keyboard — what FELA-177's mobile ↑/↓/«Готово»
       * strip calls. Same transitions, same words, no `KeyboardEvent`.
       */
      intent(run: (api: TaskReorder) => void) {
        act(() => {
          run(result.current)
        })
        sync()
      },
      /** The pointer path end to end: pick `id` up, drop the list in `nextIds`. */
      drag(id: string, nextIds: string[]) {
        act(() => {
          result.current.handleDragStart(id)
          result.current.handleReorder(nextIds)
          result.current.handleDragEnd()
        })
        sync()
      },
      /** The `Ctrl/Cmd+↑/↓` path: one step, by id. */
      step(id: string, delta: -1 | 1) {
        act(() => {
          result.current.moveRow(id, delta)
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

  // The active list never renders a completed task, so "a hidden row between
  // two visible ones" is the ordinary state of any list with something ticked
  // off — not a filter edge case. These two fixtures are the ones where a
  // display index and a store index part ways.
  it('writes the same store order for the same one-step gesture, by pointer and by key', () => {
    const byPointer = setup(['a', 'h', 'c'])
    byPointer.hide('h')
    byPointer.drag('c', ['c', 'a'])

    const byKey = setup(['a', 'h', 'c'])
    byKey.hide('h')
    byKey.step('c', -1)

    // `c` jumped the row it passed *and* the hidden one between them, which
    // is where it visibly landed; `h` keeps its place behind `a`.
    expect(byPointer.order()).toEqual(['c', 'a', 'h'])
    expect(byKey.order()).toEqual(byPointer.order())
  })

  it('Esc restores the whole store order, not just the visible one', () => {
    const list = setup(['a', 'h', 'c'])
    list.hide('h')

    list.press(' ', 'a')
    list.press('ArrowDown', 'a')
    expect(list.order()).toEqual(['h', 'c', 'a'])

    list.press('Escape', 'a')

    expect(list.order()).toEqual(['a', 'h', 'c'])
    expect(list.displayIds()).toEqual(['a', 'c'])
    expect(list.announced()).toBe('Перемещение отменено, позиция 1')
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

describe('useTaskReorder intents without a keyboard', () => {
  const unsubscribes: (() => void)[] = []

  afterEach(() => {
    for (const unsubscribe of unsubscribes) unsubscribe()
    unsubscribes.length = 0
  })

  function setup(initial: string[]) {
    let tasks: Task[] = initial.map((id) => makeTask({ id, title: id.toUpperCase() }))

    const moveTask = (from: number, to: number) => {
      const next = [...tasks]
      const [row] = next.splice(from, 1)
      if (row !== undefined) next.splice(to, 0, row)
      tasks = next
    }

    const messages: string[] = []
    unsubscribes.push(
      subscribeToAnnouncements((message) => {
        messages.push(message)
      }),
    )

    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) => useTaskReorder({ tasks, ids, moveTask }),
      { initialProps: { ids: tasks.map((task) => task.id) } },
    )

    return {
      result,
      run(fn: (api: TaskReorder) => void) {
        act(() => {
          fn(result.current)
        })
        rerender({ ids: tasks.map((task) => task.id) })
      },
      order: () => tasks.map((task) => task.id),
      messages,
    }
  }

  it('runs lift → step → drop with the words design-spec 6.4 asks for', () => {
    const list = setup(['a', 'b', 'c'])

    list.run((api) => api.grab('a'))
    expect(list.result.current.grabbedId).toBe('a')

    list.run((api) => api.step('a', 1))
    expect(list.order()).toEqual(['b', 'a', 'c'])

    list.run((api) => api.drop('a'))
    expect(list.result.current.grabbedId).toBeNull()

    // Criterion 46: the mobile mode must announce in exactly these words, so
    // they are asserted here and not merely behind a `KeyboardEvent`.
    expect(list.messages).toEqual([
      'Задача «A» поднята, позиция 1 из 3',
      'Позиция 2 из 3',
      'Задача «A» опущена на позицию 2',
    ])
  })

  it('cancel puts the row back and says so', () => {
    const list = setup(['a', 'b', 'c'])

    list.run((api) => api.grab('c'))
    list.run((api) => api.step('c', -1))
    expect(list.order()).toEqual(['a', 'c', 'b'])

    list.run((api) => api.cancel('c'))

    expect(list.order()).toEqual(['a', 'b', 'c'])
    expect(list.result.current.grabbedId).toBeNull()
    expect(list.messages.at(-1)).toBe('Перемещение отменено, позиция 3')
  })

  it('ignores a step, a drop and a cancel aimed at a row that is not held', () => {
    const list = setup(['a', 'b', 'c'])

    list.run((api) => api.grab('a'))
    list.messages.length = 0

    // A second row cannot be lifted, and the first one cannot be stepped,
    // dropped or cancelled through someone else's id — otherwise a caller
    // with a stale id reorders the list behind the held row's back.
    list.run((api) => api.grab('b'))
    list.run((api) => api.step('b', 1))
    list.run((api) => api.drop('b'))
    list.run((api) => api.cancel('b'))

    expect(list.result.current.grabbedId).toBe('a')
    expect(list.order()).toEqual(['a', 'b', 'c'])
    expect(list.messages).toEqual([])
  })

  it('release gives up the mode without announcing or reverting', () => {
    const list = setup(['a', 'b', 'c'])

    list.run((api) => api.grab('a'))
    list.run((api) => api.step('a', 1))
    const after = list.messages.length

    list.run((api) => api.release('a'))

    expect(list.result.current.grabbedId).toBeNull()
    // The step stays: it was committed through `task/move` as it happened.
    expect(list.order()).toEqual(['b', 'a', 'c'])
    expect(list.messages).toHaveLength(after)
  })

  it('does not step past the ends of the list', () => {
    const list = setup(['a', 'b'])

    list.run((api) => api.grab('a'))
    list.messages.length = 0
    list.run((api) => api.step('a', -1))

    expect(list.order()).toEqual(['a', 'b'])
    expect(list.messages).toEqual([])
  })
})
