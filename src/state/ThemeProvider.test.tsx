import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../../index.html?raw'
import { THEME_STORAGE_KEY, useTheme } from './ThemeContext'
import { ThemeProvider } from './ThemeProvider'

/** jsdom has no real `matchMedia`; drive `prefers-color-scheme` by hand. */
function mockColorScheme(preference: 'light' | 'dark') {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-color-scheme: light') && preference === 'light',
      media: query,
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener)
      },
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener)
      },
    })),
  )

  return {
    change(matches: boolean) {
      act(() => {
        for (const listener of listeners) {
          listener({ matches } as MediaQueryListEvent)
        }
      })
    },
  }
}

function Probe() {
  const { theme, isExplicit, toggleTheme } = useTheme()
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
      {isExplicit ? ' (chosen)' : ' (system)'}
    </button>
  )
}

function renderProbe() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
}

const htmlTheme = () => document.documentElement.dataset.theme

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to prefers-color-scheme when nothing is stored', () => {
    mockColorScheme('light')
    renderProbe()

    expect(screen.getByRole('button')).toHaveTextContent('light (system)')
    expect(htmlTheme()).toBe('light')
  })

  it('defaults to dark when the OS has no light preference', () => {
    mockColorScheme('dark')
    renderProbe()

    expect(htmlTheme()).toBe('dark')
  })

  it('prefers a stored choice over the OS preference', () => {
    mockColorScheme('dark')
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    renderProbe()

    expect(screen.getByRole('button')).toHaveTextContent('light (chosen)')
    expect(htmlTheme()).toBe('light')
  })

  it('ignores a stored value that is not a theme', () => {
    mockColorScheme('light')
    localStorage.setItem(THEME_STORAGE_KEY, 'aubergine')
    renderProbe()

    expect(htmlTheme()).toBe('light')
  })

  it('switches data-theme and persists the choice without a reload', async () => {
    mockColorScheme('dark')
    const user = userEvent.setup()
    renderProbe()

    await user.click(screen.getByRole('button'))

    expect(htmlTheme()).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')

    await user.click(screen.getByRole('button'))

    expect(htmlTheme()).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('follows the OS while the user has made no choice', () => {
    const media = mockColorScheme('dark')
    renderProbe()

    media.change(true)

    expect(htmlTheme()).toBe('light')
  })

  it('stops following the OS once the user has chosen', async () => {
    const media = mockColorScheme('dark')
    const user = userEvent.setup()
    renderProbe()

    await user.click(screen.getByRole('button'))
    media.change(false)

    expect(htmlTheme()).toBe('light')
  })

  it('keeps working when localStorage is blocked', async () => {
    mockColorScheme('dark')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    const user = userEvent.setup()
    renderProbe()

    expect(htmlTheme()).toBe('dark')

    await user.click(screen.getByRole('button'))

    expect(htmlTheme()).toBe('light')
    vi.restoreAllMocks()
  })

  it('throws when used outside the provider', () => {
    expect(() => render(<Probe />)).toThrow(/inside <ThemeProvider>/)
  })
})

describe('the inline bootstrap script', () => {
  /**
   * The script in index.html runs before the bundle, so it cannot import
   * THEME_STORAGE_KEY. This is the guard against the two drifting apart.
   */
  const html = indexHtml

  it('reads the same storage key as the provider', () => {
    expect(html).toContain(`localStorage.getItem('${THEME_STORAGE_KEY}')`)
  })

  it('sets data-theme before the module script loads', () => {
    const bootstrapAt = html.indexOf('document.documentElement.dataset.theme')
    const moduleAt = html.indexOf('src="/src/main.tsx"')

    expect(bootstrapAt).toBeGreaterThan(-1)
    expect(bootstrapAt).toBeLessThan(moduleAt)
  })

  it('resolves the theme the same way the provider does', () => {
    expect(html).toContain("stored === 'light' || stored === 'dark'")
    expect(html).toContain("window.matchMedia('(prefers-color-scheme: light)')")
  })
})
