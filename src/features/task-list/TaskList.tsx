import { AnimatePresence, Reorder, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '../../components/EmptyState'
import { toDateKey } from '../../domain/dueDate'
import type { Filter, TaskView } from '../../domain/filters'
import { isDone } from '../../domain/task'
import type { Task, TaskPatch } from '../../domain/task'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { useRowShortcuts } from '../shortcuts/useRowShortcuts'
import { useToast } from '../../state/useToast'
import { useTaskStore } from '../../state/useTaskStore'
import { FILTER_LABELS } from '../toolbar/filterLabels'
import { CompletedSection } from './CompletedSection'
import { TaskRow } from './TaskRow'
import { useRovingFocus } from './useRovingFocus'
import { useTaskReorder } from './useTaskReorder'

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
  /** `EmptyState no-search-results`'s "Очистить поиск" action (design-spec S4). */
  onClearSearch: () => void
  /** `EmptyState no-search-results`'s "Искать во всех" action — only reachable when `filter !== 'all'`. */
  onSearchAll: () => void
}

/** A toggled-done task mid-`task-settle`, pinned to its pre-toggle slot. */
interface SettlingEntry {
  task: Task
  /** Index in `view.active` the instant it toggled done — where the row stays until settle. */
  index: number
  /** `filter`/`query` at toggle time. A later change invalidates the snapshot (see `displayActive` below). */
  filter: Filter
  query: string
}

/**
 * design-spec 3.11/3.11a/S1/S5/S10, architecture section 7 — owns
 * `editingId` (one task editing at a time, local UI state per architecture
 * section 4) and the roving-tabindex group for the active list. The
 * `completed`/`active` split itself is `domain/filters.selectTaskView`'s
 * job, already done by `Toolbar` — this component doesn't re-filter.
 *
 * `task-settle` (motion table, section 5): a task just marked done stays
 * rendered in its *original* active slot for 600ms (its `completedAt` is
 * already set, so `TaskRow` shows the checked/struck-through state
 * immediately) before actually moving into `CompletedSection` — the
 * underlying order back in `domain/taskList.ts` is untouched, only this
 * transient display list reorders, and only for ≤600ms. A settling
 * snapshot only renders while the `filter`/`query` it was taken under and
 * the task itself still match the current ones — otherwise a filter/search
 * change or a delete during the delay would show someone else's slot, or a
 * since-removed task (FELA-126).
 */
export function TaskList({
  view,
  query,
  filter,
  panelId,
  activeTabId,
  onClearSearch,
  onSearchAll,
}: TaskListProps) {
  const {
    tasks,
    toggleTask,
    editTask,
    saveTaskEdit,
    removeTask,
    restoreRemoved,
    moveTask,
    clearCompleted,
    lastRemoved,
  } = useTaskStore()
  const { pushToast } = useToast()
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [settling, setSettling] = useState<Record<string, SettlingEntry>>({})
  const settleTimers = useRef<Record<string, number>>({})
  const [todayKey] = useState(() => toDateKey(new Date()))
  const panelRef = useRef<HTMLDivElement>(null)

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

  // `filter-switch` remounts the panel below (`key={filter}` on the
  // `motion.div`), which drops focus to `<body>` out from under a row that
  // stays visible across the switch (FELA-195, PR #79 review). Reading
  // `document.activeElement` here — during render, before the remount
  // commits — captures whether the soon-to-be-unmounted subtree still held
  // focus; the effect below restores it to the roving group's active row
  // once the new subtree (and its refs) has landed.
  const prevFilterRef = useRef(filter)
  const restoreFocusRef = useRef(false)
  if (prevFilterRef.current !== filter) {
    restoreFocusRef.current = panelRef.current?.contains(document.activeElement) ?? false
    prevFilterRef.current = filter
  }

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
      // `view.active` here is still the pre-toggle list (this closure's
      // `view` prop, not yet re-rendered) — exactly the slot the row has to
      // hold until settle.
      const index = view.active.findIndex((candidate) => candidate.id === task.id)
      setSettling((previous) => ({ ...previous, [task.id]: { task: settledTask, index, filter, query } }))
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

  // A snapshot only counts while its `filter`/`query` still match the
  // current ones and its task hasn't been deleted since — otherwise it's a
  // foreign or stale slot and must not render (FELA-126 acceptance criteria
  // 2). Sorted ascending so each splice below lands at its recorded index
  // without later insertions shifting earlier ones out of place.
  const validSettling = Object.values(settling)
    .filter(
      (entry) => entry.filter === filter && entry.query === query && tasks.some((candidate) => candidate.id === entry.task.id),
    )
    .sort((a, b) => a.index - b.index)

  const displayActive = [...view.active]
  for (const entry of validSettling) {
    displayActive.splice(Math.min(entry.index, displayActive.length), 0, entry.task)
  }
  const settlingIds = new Set(validSettling.map((entry) => entry.task.id))
  const displayCompleted = view.completed.filter((task) => !settlingIds.has(task.id))

  const activeIds = displayActive.map((task) => task.id)
  const roving = useRovingFocus(activeIds)
  // The settling rows go in as `pinnedIds`, not left out of `ids`: roving
  // focus still has to walk them and `Reorder.Group`'s `values` must match
  // the children rendered here, but their slot is a 600ms freeze-frame and
  // not a position in the order (see `useTaskReorder`'s `pinnedIds`).
  const reorder = useTaskReorder({ tasks, ids: activeIds, pinnedIds: settlingIds, moveTask })

  useEffect(() => {
    if (!restoreFocusRef.current) return
    restoreFocusRef.current = false
    roving.focusActive()
  }, [filter, roving])

  // design-spec 3.11a `saving`: a failed write leaves the editor open with
  // its draft intact — the error is already visible through `ErrorBanner`
  // (FELA-127). Only a confirmed write closes it.
  function handleSave(id: string, patch: TaskPatch) {
    const error = saveTaskEdit(id, patch)
    if (error === null) setEditingId(null)
  }

  function handleRemove(task: Task) {
    if (editingId === task.id) setEditingId(null)

    // A delete landing mid-settle (FELA-126 acceptance criteria 2) must drop
    // the snapshot right away rather than wait for the timer — `tasks` no
    // longer having this id would also hide it at render time, but clearing
    // here avoids an orphaned timeout outliving the task.
    const existingTimer = settleTimers.current[task.id]
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer)
      delete settleTimers.current[task.id]
    }
    setSettling((previous) => {
      if (!(task.id in previous)) return previous
      const next = { ...previous }
      delete next[task.id]
      return next
    })

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

  // One declaration for both row groups (design-spec 6.3, row-scoped half).
  // The key belongs to this hook — FELA-20 owns all of 6.3 — while the order
  // it writes belongs to `useTaskReorder.moveRow`: the one writer the pointer
  // drag and both keyboard paths go through, so «на какую позицию» has a
  // single answer (review R1).
  const handleRowKeyDown = useRowShortcuts({
    openEditor: setEditingId,
    removeTask: (taskId) => {
      const task = tasks.find((candidate) => candidate.id === taskId)
      if (task !== undefined) handleRemove(task)
    },
    moveTask: reorder.moveRow,
  })

  return (
    <div id={panelId} role="tabpanel" aria-labelledby={activeTabId} ref={panelRef}>
      {/*
       * `filter-switch` (motion table, section 5 / FELA-134): remounting on
       * `filter` alone — not `query` — crossfades the whole panel 140ms on a
       * segment change instead of letting the per-row `AnimatePresence`
       * below mistake a filter switch for a batch of task-add/task-delete.
       * The old subtree just disappears (no `exit`, so no stacked double
       * list) while the new one fades in from 0; nested `AnimatePresence`
       * instances remount with it and their own `initial={false}` keeps
       * real adds/deletes on their own durations untouched. The remount
       * drops DOM focus to `<body>` even when a row stays visible across the
       * switch — the effect above restores it to the roving group's active
       * row (FELA-195).
       */}
      <motion.div
        key={filter}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.14, ease: [0.2, 0, 0, 1] }}
      >
        {displayActive.length === 0 && displayCompleted.length === 0 ? (
          query !== '' ? (
            <EmptyState
              variant="no-search-results"
              query={query}
              activeFilterLabel={filter === 'all' ? undefined : FILTER_LABELS[filter]}
              onClearSearch={onClearSearch}
              onSearchAll={filter === 'all' ? undefined : onSearchAll}
            />
          ) : filter === 'completed' ? (
            <EmptyState variant="no-completed" />
          ) : (
            <EmptyState variant="no-active" />
          )
        ) : (
          <Reorder.Group
            as="ul"
            axis="y"
            values={activeIds}
            onReorder={reorder.handleReorder}
            aria-label="Задачи"
            className="flex flex-col gap-(--space-1)"
          >
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
                  onRowKeyDown={(event) =>
                    handleRowKeyDown(event, task.id, () => roving.focusNeighbourOf(task.id))
                  }
                  onToggle={() => handleToggle(task)}
                  onOpenEditor={() => setEditingId(task.id)}
                  onCloseEditor={() => setEditingId(null)}
                  onSave={(patch) => handleSave(task.id, patch)}
                  onRemove={() => handleRemove(task)}
                  onQuickChange={(patch) => editTask(task.id, patch)}
                  reorder={{
                    value: task.id,
                    isMovable: !isDone(task),
                    isGrabbed: reorder.grabbedId === task.id,
                    // Grab mode gets the key first and `preventDefault`s what it
                    // uses; whatever it leaves alone bubbles on to the row's
                    // `useRowShortcuts`, which skips an already handled event.
                    // So `Ctrl/Cmd+↑`/`↓` works from the handle too, and a held
                    // row's plain `↑`/`↓` never reaches the roving focus move.
                    onHandleKeyDown: (event) => reorder.handleHandleKeyDown(event, task.id),
                    onHandleBlur: () => reorder.handleHandleBlur(task.id),
                    onDragStart: () => reorder.handleDragStart(task.id),
                    onDragEnd: reorder.handleDragEnd,
                    // design-spec 6.4's intents, for the mobile move mode
                    // ([FELA-177](/FELA/issues/FELA-177)). The same four the
                    // handle's key decoder calls, so both modes write the order
                    // and announce the step through one implementation.
                    onGrab: () => reorder.grab(task.id),
                    onStep: (delta) => reorder.step(task.id, delta),
                    onDrop: () => reorder.drop(task.id),
                    onCancel: () => reorder.cancel(task.id),
                  }}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}

        <CompletedSection
          completed={displayCompleted}
          totalCompletedCount={tasks.filter(isDone).length}
          query={query}
          todayKey={todayKey}
          editingId={editingId}
          onRowKeyDown={handleRowKeyDown}
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
      </motion.div>
    </div>
  )
}
