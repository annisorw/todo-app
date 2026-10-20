import { IconButton } from '../components/IconButton'
import { announce } from '../lib/announce'
import { useTheme } from '../state/ThemeContext'

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M17 11.5A7 7 0 0 1 8.5 3a7 7 0 1 0 8.5 8.5Z"
        fill="currentColor"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M10 2v2.2M10 15.8V18M18 10h-2.2M4.2 10H2M15.5 4.5l-1.6 1.6M6.1 13.9l-1.6 1.6M15.5 15.5l-1.6-1.6M6.1 6.1 4.5 4.5" />
      </g>
    </svg>
  )
}

/**
 * Design spec 3.4. `aria-pressed` does not fit two equally-valid themes, so
 * the accessible name describes the *current* theme instead, and the
 * switch is announced through `LiveRegion` rather than relying on the name
 * change alone to be noticed.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'

  const handleClick = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    toggleTheme()
    announce(next === 'dark' ? 'Тема: тёмная' : 'Тема: светлая')
  }

  return <IconButton icon={theme === 'dark' ? <MoonIcon /> : <SunIcon />} aria-label={label} onClick={handleClick} />

}
