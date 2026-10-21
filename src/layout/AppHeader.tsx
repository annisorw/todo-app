import { useState } from 'react'
import { IconButton } from '../components/IconButton'
import { ShortcutsSheet } from '../components/ShortcutsSheet'
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
 * The hotkeys button opens `ShortcutsSheet` (FELA-19) — a real modal
 * (`role="dialog"` + `aria-modal="true"`), not a disclosure, so the trigger
 * carries no `aria-expanded`/`aria-controls` (those belong to a disclosure,
 * not a dialog — review note on PR #14's stub).
 */
export function AppHeader() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  return (
    <header className="h-(--layout-header-h)">
      <div className="relative mx-auto flex h-full w-full max-w-(--layout-content-max) items-center justify-between px-(--layout-gutter)">
        <span className="flex items-center gap-(--space-3)">
          <span
            aria-hidden="true"
            className="size-[22px] shrink-0 rounded-(--radius-full) bg-gradient-accent shadow-glow-accent"
          />
          <span className="text-label font-[650] tracking-[0.02em] text-primary">
            AURORA · TASKS
          </span>
        </span>

        <div className="flex items-center gap-(--space-2)">
          <IconButton
            icon={<KeyboardIcon />}
            aria-label="Горячие клавиши"
            onClick={() => setShortcutsOpen(true)}
          />
          <ThemeToggle />
        </div>
      </div>

      <ShortcutsSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </header>
  )
}
