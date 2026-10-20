import { useId, useState } from 'react'
import { IconButton } from '../components/IconButton'
import { ThemeToggle } from './ThemeToggle'

function KeyboardIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 9h.01M8 9h.01M11 9h.01M14 9h.01M5 12.5h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Design spec 3.3. Wordmark left, hotkeys button + `ThemeToggle` right.
 * The hotkeys button opens a stub panel for now — its real content
 * (the shortcuts table) is FELA-19's job.
 */
export function AppHeader() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const panelId = useId()

  return (
    <header className="relative flex h-(--layout-header-h) items-center justify-between px-(--layout-gutter)">
      <span className="text-micro uppercase text-primary">AURORA · TASKS</span>

      <div className="flex items-center gap-(--space-2)">
        <IconButton
          aria-label="Горячие клавиши"
          aria-expanded={shortcutsOpen}
          aria-controls={panelId}
          onClick={() => setShortcutsOpen((open) => !open)}
        >
          <KeyboardIcon />
        </IconButton>
        <ThemeToggle />
      </div>

      {shortcutsOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Горячие клавиши"
          className="absolute top-full right-(--layout-gutter) z-(--z-dropdown) mt-(--space-2) rounded-(--radius-md) border border-surface-border bg-surface-2 p-(--space-4) text-body text-secondary shadow-md"
        >
          <p>Шпаргалка появится позже.</p>
          <button
            type="button"
            onClick={() => setShortcutsOpen(false)}
            className="mt-(--space-2) text-label text-accent-text"
          >
            Закрыть
          </button>
        </div>
      )}
    </header>
  )
}
