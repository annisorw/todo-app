import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Fab } from './Fab'

describe('Fab', () => {
  it('is an accessible, clickable button', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Fab onClick={onClick} />)

    const button = screen.getByRole('button', { name: 'Добавить задачу' })
    await user.click(button)

    expect(onClick).toHaveBeenCalledOnce()
  })
})
