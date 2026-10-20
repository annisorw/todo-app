import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isDismissableOpen } from './dismissStack'
import { useDismissable } from './useDismissable'

/**
 * Харнес повторяет расстановку из критерия приёмки 32: строка -> редактор ->
 * попап у чипа. Редактор монтируется **раньше** попапа — ровно тот порядок, на
 * котором ломались обе прежние дисциплины Esc.
 */

interface PopoverProps {
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
}

function Popover({ onClose, anchorRef }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useDismissable({ onDismiss: onClose, returnFocusTo: anchorRef })

  // Клик снаружи закрывает попап и не трогает фокус — как в usePopoverDismiss.
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [onClose, anchorRef])

  return (
    <div ref={panelRef} role="dialog" aria-label="Приоритет">
      <button onClick={onClose}>Высокий</button>
    </div>
  )
}

interface EditorProps {
  onClose: () => void
  rowRef: RefObject<HTMLElement | null>
}

function Editor({ onClose, rowRef }: EditorProps) {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)

  useDismissable({ onDismiss: onClose, returnFocusTo: rowRef })

  return (
    <div aria-label="Редактор">
      <button ref={anchorRef} onClick={() => setPopoverOpen(true)}>
        Приоритет
      </button>
      {popoverOpen ? <Popover onClose={() => setPopoverOpen(false)} anchorRef={anchorRef} /> : null}
    </div>
  )
}

function TaskRow() {
  const rowRef = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)

  return (
    <>
      <button ref={rowRef} onClick={() => setEditing(true)}>
        Купить молоко
      </button>
      {editing ? <Editor onClose={() => setEditing(false)} rowRef={rowRef} /> : null}
    </>
  )
}

async function openEditorAndPopover(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Купить молоко' }))
  await user.click(screen.getByRole('button', { name: 'Приоритет' }))
  expect(screen.getByRole('dialog', { name: 'Приоритет' })).toBeInTheDocument()
}

const listeners: [string, EventListener][] = []

function spyOnDocument(type: string): ReturnType<typeof vi.fn> {
  const spy = vi.fn()
  document.addEventListener(type, spy)
  listeners.push([type, spy])
  return spy
}

afterEach(() => {
  while (listeners.length > 0) {
    const entry = listeners.pop()
    if (entry !== undefined) document.removeEventListener(entry[0], entry[1])
  }
})

describe('useDismissable', () => {
  it('gives Escape to the popover only — the editor underneath and outside document listeners stay silent', async () => {
    const user = userEvent.setup()
    const outerHandler = spyOnDocument('keydown')
    render(<TaskRow />)

    await openEditorAndPopover(user)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Приоритет' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Приоритет' })).toBeInTheDocument()
    expect(outerHandler).not.toHaveBeenCalled()
  })

  it('closes the editor on the second Escape and returns focus to the row', async () => {
    const user = userEvent.setup()
    render(<TaskRow />)

    await openEditorAndPopover(user)
    await user.keyboard('{Escape}')
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('button', { name: 'Приоритет' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Купить молоко' })).toHaveFocus()
  })

  it('returns focus to the chip that opened the popover', async () => {
    const user = userEvent.setup()
    render(<TaskRow />)

    await openEditorAndPopover(user)
    await user.keyboard('{Escape}')

    expect(screen.getByRole('button', { name: 'Приоритет' })).toHaveFocus()
  })

  it('drops the popover off the stack when an item is picked, so the next Escape hits the editor', async () => {
    const user = userEvent.setup()
    render(<TaskRow />)

    await openEditorAndPopover(user)
    await user.click(screen.getByRole('button', { name: 'Высокий' }))
    expect(screen.queryByRole('dialog', { name: 'Приоритет' })).not.toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('button', { name: 'Приоритет' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Купить молоко' })).toBeInTheDocument()
  })

  it('drops the popover off the stack on an outside click too', async () => {
    const user = userEvent.setup()
    render(<TaskRow />)

    await openEditorAndPopover(user)
    await user.click(screen.getByRole('button', { name: 'Купить молоко' }))
    expect(screen.queryByRole('dialog', { name: 'Приоритет' })).not.toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('button', { name: 'Приоритет' })).not.toBeInTheDocument()
  })

  it('leaves Escape to the rest of the document once nothing is open', async () => {
    const user = userEvent.setup()
    const outerHandler = spyOnDocument('keydown')
    render(<TaskRow />)

    await openEditorAndPopover(user)
    await user.keyboard('{Escape}')
    await user.keyboard('{Escape}')
    expect(isDismissableOpen()).toBe(false)

    await user.keyboard('{Escape}')

    expect(outerHandler).toHaveBeenCalledTimes(1)
  })

  it('lets a global shortcut ask whether anything is open', async () => {
    const user = userEvent.setup()
    const seen: boolean[] = []
    spyOnDocument('keydown').mockImplementation(() => seen.push(isDismissableOpen()))
    render(<TaskRow />)

    await user.keyboard('n')
    await openEditorAndPopover(user)
    await user.keyboard('n')

    expect(seen).toEqual([false, true])
  })
})

/** Повторяет дисциплину фокуса ConfirmDialog: запомнить открывшего, вернуть ему фокус. */
function ConfirmLayer({ onCancel }: { onCancel: () => void }) {
  const triggerRef = useRef<Element | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useDismissable({ onDismiss: onCancel })

  useEffect(() => {
    triggerRef.current = document.activeElement
    cancelRef.current?.focus()

    return () => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus()
    }
  }, [])

  return (
    <div role="dialog" aria-label="Удалить все выполненные?">
      <button ref={cancelRef} onClick={onCancel}>
        Отмена
      </button>
    </div>
  )
}

function ConfirmHost() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)}>Очистить выполненные</button>
      {open ? <ConfirmLayer onCancel={() => setOpen(false)} /> : null}
    </>
  )
}

describe('useDismissable in a modal that owns its own focus return', () => {
  it('closes on Escape and hands focus back to whatever opened it', async () => {
    const user = userEvent.setup()
    const outerHandler = spyOnDocument('keydown')
    render(<ConfirmHost />)

    const trigger = screen.getByRole('button', { name: 'Очистить выполненные' })
    await user.click(trigger)
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(outerHandler).not.toHaveBeenCalled()
  })
})
