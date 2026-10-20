import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveRegion } from '../components/LiveRegion'
import { ThemeProvider } from '../state/ThemeProvider'
import { ThemeToggle } from './ThemeToggle'

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
      <LiveRegion />
    </ThemeProvider>,
  )
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
  })

  it('names the current theme (not aria-pressed) and announces the switch', async () => {
    const user = userEvent.setup()
    renderToggle()

    const dark = screen.getByRole('button', { name: 'Тёмная тема' })
    expect(dark).not.toHaveAttribute('aria-pressed')

    await user.click(dark)

    expect(screen.getByRole('button', { name: 'Светлая тема' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Тема: светлая')

    await user.click(screen.getByRole('button', { name: 'Светлая тема' }))

    expect(screen.getByRole('button', { name: 'Тёмная тема' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Тема: тёмная')
  })

  it('is reachable and operable by keyboard', async () => {
    const user = userEvent.setup()
    renderToggle()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Тёмная тема' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Светлая тема' })).toHaveFocus()
  })
})
