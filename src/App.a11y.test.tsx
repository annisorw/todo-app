import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ThemeProvider } from './state/ThemeProvider'
import { TASKS_STORAGE_KEY } from './storage/taskStorage'
import { makeTask } from './test/factories'
import { stubMatchMedia } from './test/matchMedia'
import { storedPayload } from './test/storage'

/** jsdom has no `IntersectionObserver`; `Toolbar`'s `useStickyBand` only needs `observe`/`disconnect` to exist. */
class StubIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}

/**
 * Acceptance criterion 28: axe-core on the main screen, zero `critical`/`serious`
 * violations. Seeded with a mix of priority/due-date/completed tasks so the
 * check runs against the full screen — Toolbar, FilterTabs, TaskRow chips and
 * CompletedSection — not just the first-run EmptyState.
 *
 * `color-contrast` is turned off: jsdom paints nothing, so the rule can only
 * guess at computed colours, and criterion 3 already owns contrast for real
 * (token-level, in `src/styles/tokens.node.test.ts`). Everything else — names,
 * roles, landmarks, redundant alt text, form labelling — still runs.
 */
describe('main screen accessibility (axe-core, acceptance criterion 28)', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
    vi.stubGlobal('IntersectionObserver', StubIntersectionObserver)
  })

  it('has zero critical/serious violations with a populated, mixed-state list', async () => {
    localStorage.setItem(
      TASKS_STORAGE_KEY,
      storedPayload([
        makeTask({ id: 't1', title: 'Купить молоко', priority: 'high', dueDate: '2026-10-22' }),
        makeTask({ id: 't2', title: 'Позвонить в банк', priority: 'medium', dueDate: null }),
        makeTask({ id: 't3', title: 'Сделано', completedAt: '2026-10-20T10:00:00.000Z' }),
      ]),
    )

    const { container } = render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    )

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })

    expect(results).toHaveNoViolations()
  })

  it('fails this exact check when a real violation is introduced (proves the gate is live)', async () => {
    const { container } = render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    )

    // A button with no accessible name at all — axe's `button-name` rule,
    // `serious` impact. Planted directly, not through app code: this test
    // exists to prove the matcher fails on a real violation, not to assert
    // anything about `App` itself.
    const brokenButton = document.createElement('button')
    container.appendChild(brokenButton)

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    })

    expect(results).not.toHaveNoViolations()
  })
})
