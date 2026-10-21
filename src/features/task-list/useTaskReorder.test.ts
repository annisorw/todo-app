import { describe, expect, it } from 'vitest'
import { diffMove } from './useTaskReorder'

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
