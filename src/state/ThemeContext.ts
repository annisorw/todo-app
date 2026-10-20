import { createContext, useContext } from 'react'

export type Theme = 'light' | 'dark'

/**
 * Also hardcoded in the inline bootstrap script in `index.html`, which runs
 * before React and therefore cannot import this module. `ThemeProvider.test.tsx`
 * asserts the two stay in sync.
 */
export const THEME_STORAGE_KEY = 'aurora.theme'

/** Dark is the default theme (`:root` in tokens.css). */
export const DEFAULT_THEME: Theme = 'dark'

export const LIGHT_SCHEME_QUERY = '(prefers-color-scheme: light)'

export interface ThemeContextValue {
  theme: Theme
  /** `true` when the user picked a theme, so the OS preference no longer applies. */
  isExplicit: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (value === null) {
    throw new Error('useTheme must be used inside <ThemeProvider>.')
  }
  return value
}
