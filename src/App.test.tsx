import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('adds a todo and stores it in localStorage', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByPlaceholderText(/what needs to be done/i), 'Buy milk')
    await user.click(screen.getByRole('button', { name: /add/i }))

    expect(screen.getByText('Buy milk')).toBeInTheDocument()
    expect(localStorage.getItem('todo-app:todos')).toContain('Buy milk')
  })

  it('toggles a todo as done', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getByPlaceholderText(/what needs to be done/i), 'Buy milk')
    await user.click(screen.getByRole('button', { name: /add/i }))

    const checkbox = screen.getByRole('checkbox')
    await user.click(checkbox)

    expect(checkbox).toBeChecked()
  })
})
