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

  // FELA-192: with a non-empty query and zero matches, `EmptyState
  // no-search-results` renders its own visible "Очистить поиск" button
  // next to `SearchField`'s own clear icon (design-spec §7 "Доступные
  // имена" — no two simultaneously visible controls may share a name).
  it('design-spec §7: SearchField\'s clear icon and EmptyState\'s "Очистить поиск" never share an accessible name', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()

    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>,
    )

    await user.type(screen.getByRole('textbox', { name: 'Текст новой задачи' }), 'Купить молоко')
    await user.click(screen.getByRole('button', { name: 'Добавить задачу в список' }))

    await user.type(screen.getByRole('searchbox'), 'контракт')

    // `query` debounces 180ms (useToolbarState) before the view updates.
    expect(await screen.findByText('По запросу «контракт» нет задач')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Очистить поиск' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Очистить поле' })).toBeInTheDocument()
  })
})
