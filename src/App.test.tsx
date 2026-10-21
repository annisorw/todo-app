import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ThemeProvider } from './state/ThemeProvider'
import { stubMatchMedia } from './test/matchMedia'

/** jsdom has no `IntersectionObserver`; `Toolbar`'s `useStickyBand` only needs `observe`/`disconnect` to exist. */
class StubIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
    vi.stubGlobal('IntersectionObserver', StubIntersectionObserver)
  })

  it('renders the shell: header, theme toggle and the hero heading', () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Сегодня' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Тёмная тема' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Горячие клавиши' })).toBeInTheDocument()
  })

  it('wires Composer, Toolbar and TaskList together — adding a task shows it in the list', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()

    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    )

    // First run (design-spec S2): the toolbar/list are replaced by
    // `EmptyState first-run` until the very first task exists.
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Текст новой задачи' }), 'Купить молоко')
    await user.click(screen.getByRole('button', { name: 'Добавить задачу в список' }))

    expect(screen.getByRole('tabpanel')).toBeInTheDocument()
    expect(screen.getByText('Купить молоко')).toBeInTheDocument()
  })

  it('first run (design-spec S2): EmptyState replaces the list and hides the toolbar/counts', () => {
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Пока пусто' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument()
    // The composer itself stays active, per spec.
    expect(screen.getByRole('textbox', { name: 'Текст новой задачи' })).toBeInTheDocument()
  })

  it('first run: "Добавить первую задачу" puts focus in the composer field (desktop)', async () => {
    stubMatchMedia(true)
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()

    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Добавить первую задачу' }))

    expect(screen.getByRole('textbox', { name: 'Текст новой задачи' })).toHaveFocus()
  })
})
