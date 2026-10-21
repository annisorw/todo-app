import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ShortcutsSheet } from './ShortcutsSheet'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Горячие клавиши
      </button>
      <ShortcutsSheet open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

describe('ShortcutsSheet', () => {
  it('renders nothing while closed', () => {
    render(<ShortcutsSheet open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens as a real modal and focuses the close button', () => {
    render(<ShortcutsSheet open onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Горячие клавиши')
    expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus()
  })

  it('lists every shortcut from design-spec 6.3, including the full E description', () => {
    render(<ShortcutsSheet open onClose={vi.fn()} />)

    expect(screen.getByText('новая задача')).toBeInTheDocument()
    expect(screen.getByText('фокус в поиск')).toBeInTheDocument()
    expect(screen.getByText('фильтры')).toBeInTheDocument()
    expect(screen.getByText('шпаргалка')).toBeInTheDocument()
    expect(screen.getByText('закрыть / отменить / очистить')).toBeInTheDocument()
    expect(screen.getByText('переход между строками')).toBeInTheDocument()
    expect(screen.getByText('отметить выполненной')).toBeInTheDocument()
    expect(screen.getByText('править (текст, приоритет и срок)')).toBeInTheDocument()
    expect(screen.getByText('удалить')).toBeInTheDocument()
    expect(screen.getByText('вернуть удалённую')).toBeInTheDocument()
    expect(screen.getByText('переместить строку на шаг')).toBeInTheDocument()
  })

  it('traps Tab on the only focusable control, the close button', async () => {
    const user = userEvent.setup()
    render(<ShortcutsSheet open onClose={vi.fn()} />)

    const close = screen.getByRole('button', { name: 'Закрыть' })
    expect(close).toHaveFocus()

    await user.tab()
    expect(close).toHaveFocus()

    await user.tab({ shift: true })
    expect(close).toHaveFocus()
  })

  it('closes on Escape and calls onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ShortcutsSheet open onClose={onClose} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<ShortcutsSheet open onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Закрыть' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('returns focus to the element that opened it once it closes', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'Горячие клавиши' })
    trigger.focus()
    await user.click(trigger)

    expect(screen.getByRole('button', { name: 'Закрыть' })).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
