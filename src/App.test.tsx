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

    expect(screen.getByRole('tabpanel')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Текст новой задачи' }), 'Купить молоко')
    await user.click(screen.getByRole('button', { name: 'Добавить задачу в список' }))

    expect(screen.getByText('Купить молоко')).toBeInTheDocument()
  })
})
