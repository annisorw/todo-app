import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { ThemeProvider } from './state/ThemeProvider'
import { stubMatchMedia } from './test/matchMedia'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
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
})
