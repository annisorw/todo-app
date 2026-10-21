import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { toDateKey } from '../../domain/dueDate'
import type { Filter, TaskView } from '../../domain/filters'
import { isDone } from '../../domain/task'
import type { Task, TaskPatch } from '../../domain/task'
import { useToast } from '../../state/useToast'
import { useTaskStore } from '../../state/useTaskStore'
import { CompletedSection } from './CompletedSection'
import { TaskRow } from './TaskRow'
import { useRovingFocus } from './useRovingFocus'

const SETTLE_DELAY_MS = 600

function nowIso(): string {
  return new Date().toISOString()
}

export interface TaskListProps {
  view: TaskView
  query: string
  filter: Filter
  /** `role="tabpanel"` id — `Toolbar`'s `SegmentedControl` tabs point `aria-controls` at this. */
  panelId: string
  /** The selected filter tab's id — this panel's `aria-labelledby` (TechLead note on FELA-16/FELA-15). */
  activeTabId: string
}

/**
 * design-spec 3.11/3.11a/S1/S5/S10, architecture section 7 — owns
 * `editingId` (one task editing at a time, local UI state per architecture
 * section 4) and the roving-tabindex group for the active list. The
 * `completed`/`active` split itself is `domain/filters.selectTaskView`'s
 * job, already done by `Toolbar` — this component doesn't re-filter.
 *
 * `task-settle` (motion table, section 5): a task just marked done stays
 * rendered in its active slot for 600ms (its `completedAt` is already set,
 * so `TaskRow` shows the checked/struck-through state immediately) before
 * actually moving into `CompletedSection`. The move itself re-inserts it at
 * the *end* of the active list rather than its exact prior index for that
 * window — the underlying order back in `domain/taskList.ts` is untouched,
 * only this transient display list reorders, and only for ≤600ms.
 */
export function TaskList({ view, query, filter, panelId, activeTabId }: TaskListProps) {
  const { tasks, toggleTask, editTask, removeTask, restoreRemoved, clearCompleted, lastRemoved } = useTaskStore()
  const { pushToast } = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [settling, setSettling] = useState<Record<string, Task>>({})
  const settleTimers = useRef<Record<string, number>>({})
  const [todayKey] = useState(() => toDateKey(new Date()))

  // The store keeps one `lastRemoved` slot (architecture section 4), so an
  // undo toast must check it's still the removal it names before acting —
  // otherwise an older toast, left on screen by a second delete before the
  // first one expires, would restore whichever task is *now* in that slot
  // instead of the one its own message quotes. Read via a ref so each
  // toast's `onAction` (bound once, at push time) sees the slot's state at
  // click time, not at push time.
  const lastRemovedRef = useRef(lastRemoved)
  useEffect(() => {
    lastRemovedRef.current = lastRemoved
  }, [lastRemoved])

  useEffect(
    () => () => {
      for (const timer of Object.values(settleTimers.current)) window.clearTimeout(timer)
    },
    [],
  )

  function handleToggle(task: Task) {
    const willBeDone = !isDone(task)
    toggleTask(task.id)

    const existingTimer = settleTimers.current[task.id]
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer)
      delete settleTimers.current[task.id]
    }

    if (willBeDone) {
      // `task` is the pre-dispatch object — `completedAt` still null. The
      // store's own update won't reach this render until the next one, so
      // the settling snapshot has to apply the same transition itself,
      // or the row would render unchecked for the whole 600ms delay.
      const settledTask: Task = { ...task, completedAt: nowIso() }
      setSettling((previous) => ({ ...previous, [task.id]: settledTask }))
      settleTimers.current[task.id] = window.setTimeout(() => {
        delete settleTimers.current[task.id]
        setSettling((previous) => {
          if (!(task.id in previous)) return previous
          const next = { ...previous }
          delete next[task.id]
          return next
        })
      }, SETTLE_DELAY_MS)
    } else {
      setSettling((previous) => {
        if (!(task.id in previous)) return previous
        const next = { ...previous }
        delete next[task.id]
        return next
      })
    }
  }

  const settlingTasks = Object.values(settling)
  const displayActive = [...view.active, ...settlingTasks.filter((task) => !view.active.some((a) => a.id === task.id))]
  const displayCompleted = view.completed.filter((task) => !(task.id in settling))

  const activeIds = displayActive.map((task) => task.id)
  const roving = useRovingFocus(activeIds)

  function handleSave(id: string, patch: TaskPatch) {
    editTask(id, patch)
    setEditingId(null)
  }

  function handleRemove(task: Task) {
    if (editingId === task.id) setEditingId(null)
    removeTask(task.id)
    pushToast({
      variant: 'danger',
      message: `Задача удалена: «${task.title}»`,
      actionLabel: 'Вернуть',
      // Guard against a second delete landing while this toast is still up:
      // only restore if the store's single `lastRemoved` slot still holds
      // *this* task, not whichever one got removed after it.
      onAction: () => {
        if (lastRemovedRef.current?.task.id === task.id) restoreRemoved()
      },
    })
  }

  return (
    <div id={panelId} role="tabpanel" aria-labelledby={activeTabId}>
      {displayActive.length === 0 && displayCompleted.length === 0 ? (
        <p className="py-(--space-8) text-center text-body text-secondary">
          {query !== ''
            ? 'По этому запросу задач не найдено.'
            : filter === 'completed'
              ? 'Пока нет выполненных задач.'
              : 'Пока нет активных задач.'}
        </p>
      ) : (
        <ul aria-label="Задачи" className="flex flex-col gap-(--space-1)">
          <AnimatePresence initial={false}>
            {displayActive.map((task) => (
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
                onToggle={() => handleToggle(task)}
                onOpenEditor={() => setEditingId(task.id)}
                onCloseEditor={() => setEditingId(null)}
                onSave={(patch) => handleSave(task.id, patch)}
                onRemove={() => handleRemove(task)}
                onQuickChange={(patch) => editTask(task.id, patch)}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <CompletedSection
        completed={displayCompleted}
        totalCompletedCount={tasks.filter(isDone).length}
        query={query}
        todayKey={todayKey}
        editingId={editingId}
        onToggle={(id) => {
          const task = displayCompleted.find((candidate) => candidate.id === id)
          if (task) handleToggle(task)
        }}
        onOpenEditor={(id) => setEditingId(id)}
        onCloseEditor={() => setEditingId(null)}
        onSave={handleSave}
        onRemove={handleRemove}
        onQuickChange={(id, patch) => editTask(id, patch)}
        onClearCompleted={clearCompleted}
      />
    </div>
  )
}
