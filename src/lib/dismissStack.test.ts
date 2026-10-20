import { afterEach, describe, expect, it, vi } from 'vitest'
import { isDismissableOpen, registerDismissable } from './dismissStack'

/** Снятия, которые тест обязан выполнить, даже если упал на середине. */
const pending: (() => void)[] = []

function open(onDismiss: () => void): () => void {
  const unregister = registerDismissable({ onDismiss })
  pending.push(unregister)
  return unregister
}

function pressEscape(): void {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
}

afterEach(() => {
  while (pending.length > 0) pending.pop()?.()
})

describe('dismissStack', () => {
  it('is closed and silent with no layers — Escape reaches document listeners', () => {
    const outer = vi.fn()
    document.addEventListener('keydown', outer)

    expect(isDismissableOpen()).toBe(false)
    pressEscape()
    expect(outer).toHaveBeenCalledTimes(1)

    document.removeEventListener('keydown', outer)
  })

  it('dismisses only the top layer, one layer per Escape', () => {
    const editor = vi.fn()
    const popover = vi.fn()

    open(editor)
    const closePopover = open(popover)

    pressEscape()
    expect(popover).toHaveBeenCalledTimes(1)
    expect(editor).not.toHaveBeenCalled()

    // Снятие по идентичности: слой уже ушёл со стека, повтор ничего не ломает.
    closePopover()

    pressEscape()
    expect(editor).toHaveBeenCalledTimes(1)
    expect(popover).toHaveBeenCalledTimes(1)
  })

  it('unregistering out of order removes that exact layer, not the top one', () => {
    const editor = vi.fn()
    const popover = vi.fn()

    const closeEditor = open(editor)
    open(popover)

    closeEditor()

    pressEscape()
    expect(popover).toHaveBeenCalledTimes(1)
    expect(editor).not.toHaveBeenCalled()
  })

  it('reports an open layer and goes back to closed once the stack drains', () => {
    const close = open(vi.fn())
    expect(isDismissableOpen()).toBe(true)

    close()
    expect(isDismissableOpen()).toBe(false)
  })

  it('keeps other keys alone', () => {
    const layer = vi.fn()
    open(layer)

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

    expect(layer).not.toHaveBeenCalled()
  })
})
