import { useRef, useState } from 'react'
import { Fab } from '../../layout/Fab'
import { useTaskStore } from '../../state/useTaskStore'
import { cn } from '../../lib/cn'
import { ComposerFields } from './ComposerFields'
import { ComposerSheet } from './ComposerSheet'
import { useComposerForm } from './useComposerForm'

/**
 * design-spec 3.7 + S2 — the glass panel on desktop, replaced by `Fab` +
 * `ComposerSheet` on mobile (the single 640px breakpoint, architecture
 * section 2). Adding a task goes through the store's `task/add` action
 * only; this component has no `localStorage` code of its own.
 */
export function Composer() {
  const { addTask, isAtLimit } = useTaskStore()
  const form = useComposerForm({ addTask, isAtLimit })
  const [sheetOpen, setSheetOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <div
        className={cn(
          'hidden rounded-(--radius-xl) border bg-surface-1 p-(--space-5) shadow-sm transition-shadow duration-(--duration-fast) ease-standard sm:block',
          form.error ? 'border-danger' : 'border-transparent',
          form.isFocused && form.error === null && 'shadow-glow-accent',
        )}
      >
        <ComposerFields form={form} />
      </div>

      <div className="sm:hidden">
        <Fab ref={fabRef} onClick={() => setSheetOpen(true)} />
      </div>

      {sheetOpen && (
        <ComposerSheet form={form} triggerRef={fabRef} onClose={() => setSheetOpen(false)} />
      )}
    </>
  )
}
