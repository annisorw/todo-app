import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider } from '../state/ThemeProvider'
import { stubMatchMedia } from '../test/matchMedia'
import { AppHeader } from './AppHeader'
import type { ShortcutsPanelHandle } from './AppHeader'

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

  it('opens ShortcutsSheet as a real modal, not a disclosure', async () => {
    const user = userEvent.setup()
    renderHeader()

    const trigger = screen.getByRole('button', { name: 'Горячие клавиши' })
    expect(trigger).not.toHaveAttribute('aria-expanded')
    expect(trigger).not.toHaveAttribute('aria-controls')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(trigger)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('Горячие клавиши')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('exposes openShortcuts on the ref, the `?` shortcut (FELA-20) second trigger for the same panel', () => {
    const ref = createRef<ShortcutsPanelHandle>()
    render(
      <ThemeProvider>
        <AppHeader ref={ref} />
      </ThemeProvider>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    act(() => {
      ref.current?.openShortcuts()
    })

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Горячие клавиши')
  })
})

/**
 * Design spec v1.3, section 3.3: the wordmark is a decorative 22x22 dot
 * (accent gradient + glow, `aria-hidden`) plus a `text-label` caption with its
 * own weight/tracking override. The dot must not add an accessible node of its
 * own — the header's accessible name comes entirely from the caption text.
 */
describe('AppHeader wordmark', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
  })

  it('reads as "AURORA · TASKS" — the dot carries no accessible content', () => {
    renderHeader()

    const label = screen.getByText('AURORA · TASKS')
    const wordmark = label.parentElement as HTMLElement
    const dot = wordmark.firstElementChild as HTMLElement

    expect(dot).toHaveAttribute('aria-hidden', 'true')
    expect(dot).toBeEmptyDOMElement()
    expect(wordmark).toHaveTextContent('AURORA · TASKS')
  })

  it('gives the dot the spec geometry: 22x22, full radius, accent gradient fill and glow', () => {
    renderHeader()

    const label = screen.getByText('AURORA · TASKS')
    const dot = (label.parentElement as HTMLElement).firstElementChild as HTMLElement

    expect(dot).toHaveClass('size-[22px]', 'rounded-(--radius-full)', 'bg-gradient-accent', 'shadow-glow-accent')
  })

  it('sets the label to text-label with the 3.3 weight/tracking/colour overrides', () => {
    renderHeader()

    const label = screen.getByText('AURORA · TASKS')

    expect(label).toHaveClass('text-label', 'font-[650]', 'tracking-[0.02em]', 'text-primary')
  })
})
