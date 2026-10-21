import { useId, useImperativeHandle, useRef, useState } from 'react'
import type { Ref } from 'react'
import { Fab } from '../../layout/Fab'
import { useTaskStore } from '../../state/useTaskStore'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { cn } from '../../lib/cn'
import { ComposerChips } from './ComposerChips'
import { ComposerFieldMeta } from './ComposerFieldMeta'
import { ComposerSheet } from './ComposerSheet'
import { ComposerSubmit } from './ComposerSubmit'
import { ComposerTextarea } from './ComposerTextarea'
import { useComposerForm } from './useComposerForm'

export interface ComposerHandle {
  /**
   * design-spec S2 — the `first-run` `EmptyState`'s "Добавить задачу" action
   * puts focus in the field, same command as the `N` shortcut (FELA-20).
   * Desktop focuses the panel's own textarea; mobile has no visible field
   * to focus (it's `Fab` + a sheet instead), so it opens the sheet, which
   * autofocuses its own textarea already.
   */
  requestNewTask: () => void
}

export interface ComposerProps {
  ref?: Ref<ComposerHandle>
}

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
export function Composer({ ref }: ComposerProps = {}) {
  const { addTask, isAtLimit } = useTaskStore()
  const form = useComposerForm({ addTask, isAtLimit })
  const [sheetOpen, setSheetOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const errorId = useId()

  useImperativeHandle(
    ref,
    () => ({
      requestNewTask: () => {
        if (isDesktop) panelRef.current?.querySelector('textarea')?.focus()
        else setSheetOpen(true)
      },
    }),
    [isDesktop],
  )

  return (
    <>
      <div
        ref={panelRef}
        className={cn(
          'composer hidden rounded-(--radius-xl) border bg-surface-1 p-(--space-5) transition-shadow duration-(--duration-fast) ease-standard sm:block',
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
