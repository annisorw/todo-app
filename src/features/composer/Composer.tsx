import { useId, useRef, useState } from 'react'
import { Fab } from '../../layout/Fab'
import { useTaskStore } from '../../state/useTaskStore'
import { cn } from '../../lib/cn'
import { ComposerChips } from './ComposerChips'
import { ComposerFieldMeta } from './ComposerFieldMeta'
import { ComposerSheet } from './ComposerSheet'
import { ComposerSubmit } from './ComposerSubmit'
import { ComposerTextarea } from './ComposerTextarea'
import { useComposerForm } from './useComposerForm'

/**
 * design-spec 3.7 + S2 — the glass panel on desktop, replaced by `Fab` +
 * `ComposerSheet` on mobile (the single 640px breakpoint, architecture
 * section 2). Adding a task goes through the store's `task/add` action
 * only; this component has no `localStorage` code of its own.
 *
 * Field, chips and submit button sit in one row here. Spec 3.7 puts the "+"
 * on the left, so it carries `order-first` to move visually without moving
 * in the DOM — tab order stays field -> priority -> due date -> "+" (section
 * 7). `ComposerSheet` lays the same pieces out in two rows instead, which is
 * why they are separate composable parts rather than one component
 * switching on a layout flag.
 */
export function Composer() {
  const { addTask, isAtLimit } = useTaskStore()
  const form = useComposerForm({ addTask, isAtLimit })
  const [sheetOpen, setSheetOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const errorId = useId()

  return (
    <>
      <div
        className={cn(
          'hidden rounded-(--radius-xl) border bg-surface-1 p-(--space-5) transition-shadow duration-(--duration-fast) ease-standard sm:block',
          form.error ? 'border-danger' : 'border-transparent',
          form.isFocused ? 'shadow-glow-accent' : 'shadow-sm',
        )}
      >
        <div className="flex flex-col gap-(--space-2)">
          <div className="flex items-center gap-(--space-3)">
            <ComposerTextarea form={form} errorId={errorId} className="min-w-0 flex-1" />
            <ComposerChips form={form} />
            <ComposerSubmit form={form} className="order-first" />
          </div>

          <ComposerFieldMeta form={form} errorId={errorId} />
        </div>
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
