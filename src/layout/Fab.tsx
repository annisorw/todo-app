function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export interface FabProps {
  onClick: () => void
}

/**
 * design-spec 3.24 — mobile-only entry point for `Composer` (3.7): on
 * desktop the composer panel renders directly, on mobile it hides and this
 * button opens the same form in a bottom sheet (`ComposerSheet`).
 * `--gradient-accent` is allowed here because the `+` is an icon, not text
 * (spec 2.3).
 */
export function Fab({ onClick }: FabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Добавить задачу"
      style={{ backgroundImage: 'var(--gradient-accent)' }}
      className="fixed right-(--space-5) bottom-[calc(var(--space-5)+env(safe-area-inset-bottom))] z-(--z-sticky) flex size-(--size-fab) items-center justify-center rounded-full text-accent-contrast shadow-lg transition-transform duration-(--duration-fast) ease-standard active:scale-95"
    >
      <PlusIcon />
    </button>
  )
}
