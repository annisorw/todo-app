import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { isDismissableOpen } from '../lib/dismissStack'
import { ConfirmDialog } from './ConfirmDialog'
import { Menu } from './Menu'

/** The dialog needs something outside itself to return focus to. */
function Harness({ completedCount = 3 }: { completedCount?: number }) {
  const [open, setOpen] = useState(false)
  const onConfirm = vi.fn()
  const onCancel = vi.fn(() => setOpen(false))

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Удалить выполненные
      </button>
      <ConfirmDialog open={open} completedCount={completedCount} onConfirm={onConfirm} onCancel={onCancel} />
    </div>
  )
}

describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    render(<ConfirmDialog open={false} completedCount={3} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the one scenario with the count, and focuses Cancel first', () => {
    render(<ConfirmDialog open completedCount={3} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Удалить все выполненные (3)?')
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Удалить 3 задачи' })).toBeInTheDocument()
  })

  it.each([
    [1, 'Удалить 1 задачу'],
    [2, 'Удалить 2 задачи'],
    [5, 'Удалить 5 задач'],
    [11, 'Удалить 11 задач'],
    [21, 'Удалить 21 задачу'],
  ])('pluralises the confirm label for %i as "%s"', (count, label) => {
    render(<ConfirmDialog open completedCount={count} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
  })

  it('traps Tab between Cancel and the danger button, both directions', async () => {
    const user = userEvent.setup()
    render(<ConfirmDialog open completedCount={3} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    const cancel = screen.getByRole('button', { name: 'Отмена' })
    const confirm = screen.getByRole('button', { name: 'Удалить 3 задачи' })
    expect(cancel).toHaveFocus()

    await user.tab()
    expect(confirm).toHaveFocus()

    await user.tab()
    expect(cancel).toHaveFocus() // wrapped forward

    await user.tab({ shift: true })
    expect(confirm).toHaveFocus() // wrapped backward
  })

  it('closes on Escape and calls onCancel', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<ConfirmDialog open completedCount={3} onConfirm={vi.fn()} onCancel={onCancel} />)

    await user.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when the danger button is activated', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<ConfirmDialog open completedCount={3} onConfirm={onConfirm} onCancel={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Удалить 3 задачи' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('returns focus to the element that opened it once it closes', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Удалить выполненные' })
    trigger.focus()
    await user.click(trigger)

    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the trigger exactly once, not twice', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Удалить выполненные' })
    trigger.focus()
    await user.click(trigger)

    // Counted after opening: the click itself focuses the trigger.
    const focusSpy = vi.spyOn(trigger, 'focus')
    await user.keyboard('{Escape}')

    // The unmount effect is the only one returning focus. Passing the same
    // element to `useDismissable`'s `returnFocusTo` would make this 2.
    expect(focusSpy).toHaveBeenCalledOnce()
    expect(trigger).toHaveFocus()
  })

  it('occupies a stack layer only while it is open', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(isDismissableOpen()).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Удалить выполненные' }))
    expect(isDismissableOpen()).toBe(true)

    await user.keyboard('{Escape}')
    expect(isDismissableOpen()).toBe(false)
  })
})

/** Opens a real `Menu` next to a real dialog — no stand-in layers. */
function DialogWithMenu() {
  const [dialogOpen, setDialogOpen] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  return (
    <div>
      <ConfirmDialog
        open={dialogOpen}
        completedCount={3}
        onConfirm={vi.fn()}
        onCancel={() => setDialogOpen(false)}
      />
      {dialogOpen && (
        <>
          <button type="button" ref={anchorRef} onClick={() => setMenuOpen(true)}>
            Ещё
          </button>
          {menuOpen && (
            <Menu
              items={[{ key: 'only', label: 'Пункт', onSelect: () => setMenuOpen(false) }]}
              anchorRef={anchorRef}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </>
      )}
    </div>
  )
}

/**
 * Acceptance criterion 32 for the dialog itself: before the migration the
 * dialog read Esc from its own `onKeyDown`, so it closed only while focus sat
 * inside its subtree and never while a popover held the keypress. Both presses
 * below now come from the one stack owner.
 */
describe('ConfirmDialog + Menu — two stacked Esc layers', () => {
  it('gives the first Esc to the menu and the second to the dialog', async () => {
    const user = userEvent.setup()
    render(<DialogWithMenu />)

    const anchor = screen.getByRole('button', { name: 'Ещё' })
    await user.click(anchor)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(anchor).toHaveFocus()

    // Focus is on the anchor, outside the dialog's own subtree — the dialog
    // closes anyway, because Esc reaches it through the stack.
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not close the dialog underneath while the menu is open', async () => {
    const user = userEvent.setup()
    render(<DialogWithMenu />)

    await user.click(screen.getByRole('button', { name: 'Ещё' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'Пункт' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
