import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Priority } from '../domain/task'
import { LiveRegion } from './LiveRegion'
import { PrioritySelect } from './PrioritySelect'
import { stubMatchMedia } from '../test/matchMedia'

function Harness() {
  const [value, setValue] = useState<Priority>('none')
  return (
    <>
      <PrioritySelect value={value} onChange={setValue} />
      <LiveRegion />
    </>
  )
}

describe('PrioritySelect', () => {
  beforeEach(() => {
    stubMatchMedia(false)
  })

  it('opens the menu from the chip, picks a value, announces it, and updates the chip', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Приоритет' }))
    await user.click(screen.getByRole('menuitem', { name: /Высокий/ }))

    expect(screen.getByRole('status')).toHaveTextContent('Приоритет: высокий')
    const chip = screen.getByRole('button', { name: /Высокий/ })
    expect(chip).toHaveAttribute('aria-expanded', 'false')

    await user.click(chip)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('closes and returns focus to the chip on Esc', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const chip = screen.getByRole('button', { name: 'Приоритет' })
    await user.click(chip)
    expect(screen.getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(chip).toHaveFocus()
  })

  it('supports arrow-key navigation inside the popup', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Приоритет' }))
    expect(screen.getByRole('menuitem', { name: /Высокий/ })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: /Средний/ })).toHaveFocus()
  })
})
