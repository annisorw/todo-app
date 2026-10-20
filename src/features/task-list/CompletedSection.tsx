import { AnimatePresence } from 'framer-motion'
import { Button } from '../../components/Button'
import type { Task, TaskPatch } from '../../domain/task'
import { TaskRow } from './TaskRow'
import { useRovingFocus } from './useRovingFocus'

export interface CompletedSectionProps {
  completed: Task[]
  query: string
  todayKey: string
  editingId: string | null
  onToggle: (id: string) => void
  onOpenEditor: (id: string) => void
  onCloseEditor: () => void
  onSave: (id: string, patch: TaskPatch) => void
  onRemove: (id: string) => void
  onQuickChange: (id: string, patch: TaskPatch) => void
  onClearCompleted: () => void
}

/**
 * design-spec section 6 (point 6 of this issue) — a separate section below
 * the active list, newest-completed first (`domain/filters.partitionTasks`
 * already sorts it that way; no second sort here). It is its own roving-
 * tabindex group and its own Tab stop (design-spec section 7: "список ->
 * секция «Выполнено»" are two separate stops), via its own
 * `useRovingFocus` instance — not a continuation of the active list's.
 *
 * "Удалить все выполненные" is the call only — the confirmation dialog is
 * [FELA-18](/FELA/issues/FELA-18), not yet merged, so there is nothing to
 * render here but the action itself (this issue's own text: "сам диалог
 * делает FELA-18, здесь — вызов").
 */
export function CompletedSection({
  completed,
  query,
  todayKey,
  editingId,
  onToggle,
  onOpenEditor,
  onCloseEditor,
  onSave,
  onRemove,
  onQuickChange,
  onClearCompleted,
}: CompletedSectionProps) {
  const ids = completed.map((task) => task.id)
  const roving = useRovingFocus(ids)

  if (completed.length === 0) return null

  return (
    <section aria-label="Выполнено" className="mt-(--space-8) flex flex-col gap-(--space-3)">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 text-primary">Выполнено</h2>
        <Button variant="ghost" size="sm" onClick={onClearCompleted}>
          Удалить все выполненные
        </Button>
      </div>

      <ul className="flex flex-col gap-(--space-1)">
        <AnimatePresence initial={false}>
          {completed.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              query={query}
              todayKey={todayKey}
              tabIndex={roving.getTabIndex(task.id)}
              isEditing={editingId === task.id}
              registerRef={(node) => roving.registerRef(task.id, node)}
              onFocus={() => roving.handleFocus(task.id)}
              onKeyDown={(event) => roving.handleKeyDown(event, task.id)}
              onToggle={() => onToggle(task.id)}
              onOpenEditor={() => onOpenEditor(task.id)}
              onCloseEditor={onCloseEditor}
              onSave={(patch) => onSave(task.id, patch)}
              onRemove={() => onRemove(task.id)}
              onQuickChange={(patch) => onQuickChange(task.id, patch)}
            />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  )
}
