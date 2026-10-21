import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { useDismissable } from '../lib/useDismissable'
import { IconButton } from './IconButton'

export interface ShortcutsSheetProps {
  open: boolean
  onClose: () => void
}

interface ShortcutRow {
  /** Each inner array is one chord, keys joined with "+"; multiple chords in a row are alternatives. */
  chords: string[][]
  description: string
}

/** design-spec 6.3, verbatim — including `E`, which edits text, priority and due date together (spec v1.1). */
const SHORTCUTS: ShortcutRow[] = [
  { chords: [['N']], description: 'новая задача' },
  { chords: [['/']], description: 'фокус в поиск' },
  { chords: [['1'], ['2'], ['3']], description: 'фильтры' },
  { chords: [['?']], description: 'шпаргалка' },
  { chords: [['Esc']], description: 'закрыть / отменить / очистить' },
  { chords: [['↑'], ['↓']], description: 'переход между строками' },
  { chords: [['Space']], description: 'отметить выполненной' },
  { chords: [['E']], description: 'править (текст, приоритет и срок)' },
  { chords: [['Delete'], ['Backspace']], description: 'удалить' },
  { chords: [['Ctrl/Cmd', 'Z']], description: 'вернуть удалённую' },
  { chords: [['Ctrl/Cmd', '↑'], ['Ctrl/Cmd', '↓']], description: 'переместить строку на шаг' },
]

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * design-spec 3.23 / S12 — modal opened by the header button (and, per FELA-20,
 * the `?` key), a two-column table of every shortcut in 6.3.
 *
 * `role="dialog"` + `aria-modal="true"`, no `aria-expanded`/`aria-controls` on
 * the trigger (those belong to a disclosure, not a modal — review note on
 * PR #14's stub). Tab has nowhere to go but the close button, so the trap is
 * just "Tab always lands back on it"; `useDismissable` gives Esc and the
 * mount/unmount effect below returns focus to whatever opened the sheet,
 * the same split-component pattern as `ConfirmDialog`.
 */
export function ShortcutsSheet({ open, onClose }: ShortcutsSheetProps) {
  if (!open) return null

  return <ShortcutsSheetPanel onClose={onClose} />
}

function ShortcutsSheetPanel({ onClose }: { onClose: () => void }) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<Element | null>(null)

  useDismissable({ onDismiss: onClose })

  useEffect(() => {
    triggerRef.current = document.activeElement
    closeRef.current?.focus()

    return () => {
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus()
    }
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') return
    event.preventDefault()
    closeRef.current?.focus()
  }

  return (
    <div
      className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-modal-backdrop p-(--space-4) animate-modal-backdrop-in"
      onKeyDown={handleKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[85vh] w-full max-w-(--size-modal-md) flex-col gap-(--space-4) rounded-(--radius-xl) bg-surface-2 p-(--space-6) shadow-lg animate-modal-panel-in"
      >
        <div className="flex items-center justify-between gap-(--space-4)">
          <h2 id={titleId} className="text-h1 text-primary">
            Горячие клавиши
          </h2>
          <IconButton ref={closeRef} icon={<CloseIcon />} aria-label="Закрыть" onClick={onClose} />
        </div>

        <div className="overflow-y-auto">
          <table className="w-full border-collapse text-body text-secondary">
            <tbody>
              {SHORTCUTS.map((row) => (
                <tr key={row.description} className="border-t border-surface-border first:border-t-0">
                  <td className="py-(--space-2) pr-(--space-4) align-top">
                    <span className="flex flex-wrap items-center gap-(--space-2)">
                      {row.chords.map((chord) => (
                        <span key={chord.join('+')} className="flex items-center gap-(--space-1)">
                          {chord.map((key, keyIndex) => (
                            <span key={key} className="flex items-center gap-(--space-1)">
                              {keyIndex > 0 && (
                                <span aria-hidden="true" className="text-tertiary">
                                  +
                                </span>
                              )}
                              <kbd className="rounded-(--radius-xs) border border-surface-border-strong px-(--space-1.5) py-(--space-0.5) text-caption text-mono-num text-primary">
                                {key}
                              </kbd>
                            </span>
                          ))}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-(--space-2) align-top text-primary">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
