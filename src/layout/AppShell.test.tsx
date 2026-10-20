import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ThemeProvider } from '../state/ThemeProvider'
import { stubMatchMedia } from '../test/matchMedia'
import { AppShell } from './AppShell'

/**
 * Design spec v1.3, section 3.1: `main` owns its own vertical padding —
 * `--space-8` top / `--space-20` bottom on desktop, `--space-5` top / 120px
 * bottom (under `Fab` and the toast) on mobile. jsdom has no layout engine,
 * so this asserts the class contract rather than pixel positions.
 */
describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
  })

  it('gives main the spec 3.1 vertical padding, mobile-first with a desktop override', () => {
    render(
      <ThemeProvider>
        <AppShell>
          <p>content</p>
        </AppShell>
      </ThemeProvider>,
    )

    const main = screen.getByRole('main')

    expect(main).toHaveClass('pt-(--space-5)', 'pb-[120px]', 'sm:pt-(--space-8)', 'sm:pb-(--space-20)')
  })
})
