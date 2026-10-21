import { AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { Task, TaskPatch } from '../../domain/task'
import { TaskRow } from './TaskRow'
import { useRovingFocus } from './useRovingFocus'

export interface CompletedSectionProps {
  completed: Task[]
  /**
   * Count of *all* completed tasks in the store, regardless of the active
   * search query. `onClearCompleted` always clears every completed task,
   * not just the ones `completed` (filtered by `query`) happens to show —
   * the dialog must quote the number it's actually about to delete
   * (TechLead review on PR #47: showing the filtered count while deleting
   * everything was a silent-data-loss bug).
   */
  totalCompletedCount: number
  query: string
  todayKey: string
  editingId: string | null
  onToggle: (id: string) => void
  onOpenEditor: (id: string) => void
  onCloseEditor: () => void
  onSave: (id: string, patch: TaskPatch) => void
  onRemove: (task: Task) => void
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
 * "Удалить все выполненные" opens `ConfirmDialog` (design-spec 3.16): the
 * issue's own text only asked for the call because [FELA-18](/FELA/issues/FELA-18)
 * wasn't merged yet when this was written, but the dialog exists now, and a
 * bare irreversible bulk delete isn't the right call once it does.
 */
export function CompletedSection({
  completed,
  totalCompletedCount,
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
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (completed.length === 0) return null

  function handleConfirm() {
    onClearCompleted()
    setConfirmOpen(false)
  }

  return (
    <section aria-label="Выполнено" className="mt-(--space-8) flex flex-col gap-(--space-3)">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 text-primary">Выполнено</h2>
        <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
          Удалить все выполненные
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        completedCount={totalCompletedCount}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

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
              onRemove={() => onRemove(task)}
              onQuickChange={(patch) => onQuickChange(task.id, patch)}
            />
          ))}
        </AnimatePresence>
      </ul>
    </section>
  )
}
