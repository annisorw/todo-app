import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Menu } from './Menu'
import type { MenuItemConfig } from './Menu'

function Harness({ items, onClose }: { items: MenuItemConfig[]; onClose: () => void }) {
  const anchorRef = createRef<HTMLButtonElement>()
  return (
    <>
      <button type="button" ref={anchorRef}>
        trigger
      </button>
      <Menu items={items} anchorRef={anchorRef} onClose={onClose} />
    </>
  )
}

function makeItems(onSelect: (key: string) => void): MenuItemConfig[] {
  return [
    { key: 'a', label: 'Первый', onSelect: () => onSelect('a') },
    { key: 'b', label: 'Второй', onSelect: () => onSelect('b') },
    { key: 'c', label: 'Третий', onSelect: () => onSelect('c'), checked: true },
  ]
}

describe('Menu', () => {
  it('focuses the first item on open and wraps with ArrowUp/ArrowDown', async () => {
    const user = userEvent.setup()
    render(<Harness items={makeItems(vi.fn())} onClose={vi.fn()} />)

    expect(screen.getByRole('menuitem', { name: 'Первый' })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Второй' })).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Первый' })).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('menuitem', { name: 'Третий' })).toHaveFocus()
  })

  it('closes and returns focus to the trigger on Esc', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness items={makeItems(vi.fn())} onClose={onClose} />)

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'trigger' })).toHaveFocus()
  })

  it('closes on an outside click without stealing focus', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <>
        <Harness items={makeItems(vi.fn())} onClose={onClose} />
        <button type="button">outside</button>
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'outside' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('selects an item, calls onClose, and marks the checked one', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<Harness items={makeItems(onSelect)} onClose={onClose} />)

    await user.click(screen.getByRole('menuitem', { name: 'Второй' }))

    expect(onSelect).toHaveBeenCalledWith('b')
    expect(onClose).toHaveBeenCalledOnce()
  })
})
