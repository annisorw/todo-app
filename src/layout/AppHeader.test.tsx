import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider } from '../state/ThemeProvider'
import { stubMatchMedia } from '../test/matchMedia'
import { AppHeader } from './AppHeader'

describe('AppHeader hotkeys stub panel', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
  })

  it('opens as a plain disclosure, not a dialog', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <AppHeader />
      </ThemeProvider>,
    )

    const trigger = screen.getByRole('button', { name: 'Горячие клавиши' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls')

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Шпаргалка появится позже.')).toBeInTheDocument()
  })
})
