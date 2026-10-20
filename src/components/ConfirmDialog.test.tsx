import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

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
})
