import { useId, useImperativeHandle, useRef, useState } from 'react'
import type { Ref } from 'react'
import type { Filter } from '../../domain/filters'
import { Fab } from '../../layout/Fab'
import { useToast } from '../../state/useToast'
import { useTaskStore } from '../../state/useTaskStore'
import { cn } from '../../lib/cn'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { ComposerChips } from './ComposerChips'
import { ComposerFieldMeta } from './ComposerFieldMeta'
import { ComposerSheet } from './ComposerSheet'
import { ComposerSubmit } from './ComposerSubmit'
import { ComposerTextarea } from './ComposerTextarea'
import { useComposerForm } from './useComposerForm'

export interface ComposerHandle {
  /**
   * Put the user in the new-task field. Two callers: the `N` shortcut
   * (design-spec 6.3, FELA-20) and the `first-run` `EmptyState`'s "Добавить
   * задачу" action (design-spec S2, FELA-19).
   *
   * Where that field *is* depends on the viewport, which only this component
   * knows: the desktop panel is always mounted but `display: none` below
   * 640px, so focusing it on mobile would be a silent no-op instead of
   * opening the sheet — and the sheet autofocuses its own textarea already.
   */
  requestNewTask: () => void
}

export interface ComposerProps {
  ref?: Ref<ComposerHandle>
  /** The toolbar's active filter — a task added while on `completed` lands in `Активные`, out of sight, so it needs a toast explaining where it went (design-spec S5). */
  filter: Filter
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
 *
 * The `ref` exposes one *command*, not state: `sheetOpen` and the field stay
 * owned here, and `requestNewTask` is a second trigger for them, the way the
 * `Fab` is. That is the difference from `Toolbar`, whose `filter`/`query` were
 * lifted outright (FELA-66) — those are values other components read, so a
 * hidden writer would have meant two copies of one truth. Here nothing outside
 * reads anything.
 */
export function Composer({ ref, filter }: ComposerProps) {
  const { addTask, isAtLimit } = useTaskStore()
  const { pushToast } = useToast()
  const form = useComposerForm({
    addTask,
    isAtLimit,
    onTaskAdded: () => {
      if (filter === 'completed') {
        pushToast({ variant: 'info', message: 'Задача добавлена в «Активные»' })
      }
    },
  })
  const [sheetOpen, setSheetOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const fabRef = useRef<HTMLButtonElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const errorId = useId()

  useImperativeHandle(
    ref,
    () => ({
      requestNewTask: () => {
        if (isDesktop) textareaRef.current?.focus()
        else setSheetOpen(true)
      },
    }),
    [isDesktop],
  )

  return (
    <>
      <div
        className={cn(
          'composer hidden rounded-(--radius-xl) border bg-surface-1 p-(--space-5) transition-shadow duration-(--duration-fast) ease-standard sm:block',
          form.error ? 'border-danger' : 'border-transparent',
          form.isFocused ? 'shadow-glow-accent' : 'shadow-sm',
        )}
      >
        <div className="flex flex-col gap-(--space-2)">
          <div className="flex items-center gap-(--space-3)">
            <ComposerTextarea form={form} errorId={errorId} fieldRef={textareaRef} className="min-w-0 flex-1" />
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
