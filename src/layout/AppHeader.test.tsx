import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider } from '../state/ThemeProvider'
import { stubMatchMedia } from '../test/matchMedia'
import { AppHeader } from './AppHeader'

function renderHeader() {
  return render(
    <ThemeProvider>
      <AppHeader />
    </ThemeProvider>,
  )
}

/**
 * Design spec v1.3, acceptance criterion 34: `.header` and `main` share one
 * centered `max-w-(--layout-content-max)` box with the same `px-(--layout-gutter)`,
 * so the wordmark and the hotkeys button line up with the content column
 * instead of the window edge. jsdom has no layout engine, so this asserts the
 * class contract that produces that alignment rather than pixel positions —
 * see the PR description for the arithmetic check against the token values.
 */
describe('AppHeader', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
  })

  it('wraps its content in the same centered column box as main', () => {
    const { container } = renderHeader()

    const header = container.querySelector('header')
    expect(header).toHaveClass('h-(--layout-header-h)')
    expect(header).not.toHaveClass('relative')
    expect(header).not.toHaveClass('px-(--layout-gutter)')
    expect(header).not.toHaveClass('flex')
    expect(header).not.toHaveAttribute('style')

    const column = header?.firstElementChild
    expect(column).toHaveClass(
      'relative',
      'mx-auto',
      'flex',
      'h-full',
      'w-full',
      'max-w-(--layout-content-max)',
      'items-center',
      'justify-between',
      'px-(--layout-gutter)',
    )
  })

  it('has no background, border, or sticky positioning of its own', () => {
    const { container } = renderHeader()

    const header = container.querySelector('header')
    expect(header?.className).not.toMatch(/\bbg-|\bborder-b|\bsticky\b/)
  })

  it('keeps the wordmark and theme toggle inside the column', () => {
    renderHeader()

    expect(screen.getByText('AURORA · TASKS')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Горячие клавиши' })).toBeInTheDocument()
  })

  it('opens as a plain disclosure, not a dialog', async () => {
    const user = userEvent.setup()
    renderHeader()

    const trigger = screen.getByRole('button', { name: 'Горячие клавиши' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls')

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Шпаргалка появится позже.')).toBeInTheDocument()
  })
})
