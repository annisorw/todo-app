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

/** Сосед-слушатель: тип приходит переменной, чтобы снятие не забылось. */
function listen(target: EventTarget, type: string, capture = false): ReturnType<typeof vi.fn> {
  const spy = vi.fn()
  target.addEventListener(type, spy, capture)
  pending.push(() => {
    target.removeEventListener(type, spy, capture)
  })
  return spy
}

afterEach(() => {
  while (pending.length > 0) pending.pop()?.()
})

describe('dismissStack', () => {
  it('is closed and silent with no layers — Escape reaches document listeners', () => {
    const outer = listen(document, 'keydown')

    expect(isDismissableOpen()).toBe(false)
    pressEscape()
    expect(outer).toHaveBeenCalledTimes(1)
  })

  // Что именно «не видит» нажатие — это измеримо, а не на словах: до React-дерева
  // и до обработчиков на элементах Esc не доходит, но сосед на самом `document` в
  // фазе перехвата его получит, потому что `stopPropagation` не трогает
  // слушателей на том же узле. Сосед регистрируется **после** стека — порядок на
  // одном узле решает только `stopImmediatePropagation`, которого здесь нет.
  it('hides Escape from the bubble phase and from elements, but not from a capture-phase neighbour on document', () => {
    const layer = vi.fn()
    open(layer)

    const documentCapture = listen(document, 'keydown', true)
    const documentBubble = listen(document, 'keydown')
    const bodyBubble = listen(document.body, 'keydown')

    pressEscape()

    expect(layer).toHaveBeenCalledTimes(1)
    expect(documentCapture).toHaveBeenCalledTimes(1)
    expect(documentBubble).not.toHaveBeenCalled()
    expect(bodyBubble).not.toHaveBeenCalled()
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
