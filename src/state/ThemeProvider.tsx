import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  DEFAULT_THEME,
  LIGHT_SCHEME_QUERY,
  THEME_STORAGE_KEY,
  ThemeContext,
  type Theme,
  type ThemeContextValue,
} from './ThemeContext'

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

/**
 * `localStorage` throws instead of returning null in private mode and when the
 * origin is blocked, so both directions are guarded. The theme is a preference,
 * not data: losing it degrades to the OS preference and the app keeps working.
 */
function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : null
  } catch {
    return null
  }
}

function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Could not persist the theme under "${THEME_STORAGE_KEY}".`, error)
    }
  }
}

function systemTheme(): Theme {
  return window.matchMedia(LIGHT_SCHEME_QUERY).matches ? 'light' : DEFAULT_THEME
}

/**
 * Resolves the theme exactly the way the inline script in `index.html` does: a
 * stored choice wins, otherwise `prefers-color-scheme`. Reading it during the
 * first render keeps React in step with the attribute already on `<html>`, so
 * there is no flash and no first-paint correction.
 */
function initialTheme(): { theme: Theme; isExplicit: boolean } {
  const stored = readStoredTheme()
  return stored === null
    ? { theme: systemTheme(), isExplicit: false }
    : { theme: stored, isExplicit: true }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [{ theme, isExplicit }, setState] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Until the user picks a theme, the OS preference stays live.
  useEffect(() => {
    if (isExplicit) return

    const query = window.matchMedia(LIGHT_SCHEME_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      setState({ theme: event.matches ? 'light' : DEFAULT_THEME, isExplicit: false })
    }

    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [isExplicit])

  const setTheme = useCallback((next: Theme) => {
    writeStoredTheme(next)
    setState({ theme: next, isExplicit: true })
  }, [])

  const toggleTheme = useCallback(() => {
    setState((current) => {
      const next: Theme = current.theme === 'dark' ? 'light' : 'dark'
      writeStoredTheme(next)
      return { theme: next, isExplicit: true }
    })
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, isExplicit, setTheme, toggleTheme }),
    [theme, isExplicit, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
