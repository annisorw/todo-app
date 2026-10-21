import { useId, useRef } from 'react'
import { EmptyState } from './components/EmptyState'
import { ErrorBanner } from './components/ErrorBanner'
import { ProgressRing } from './components/ProgressRing'
import { segmentTabId } from './components/segmentTabId'
import { isDone } from './domain/task'
import { Composer } from './features/composer/Composer'
import type { ComposerHandle } from './features/composer/Composer'
import { useGlobalShortcuts } from './features/shortcuts/useGlobalShortcuts'
import { TaskList } from './features/task-list/TaskList'
import { Toolbar } from './features/toolbar/Toolbar'
import { useToolbarState } from './features/toolbar/useToolbarState'
import { announce } from './lib/announce'
import { AppShell } from './layout/AppShell'
import type { ShortcutsPanelHandle } from './layout/AppHeader'
import { Hero } from './layout/Hero'
import { TaskStoreProvider } from './state/TaskStoreProvider'
import { useTaskStore } from './state/useTaskStore'

/**
 * Wires `Composer` (FELA-14), `Toolbar` (FELA-16/FELA-66) and `TaskList`
 * (FELA-15) together — nothing else did this yet, and a screen that doesn't
 * render is a screen that can't be opened in a browser to check against the
 * spec. `useToolbarState` is the single source of `filter`/`query`/`view`;
 * both `Toolbar` and `TaskList` are controlled from it.
 *
 * design-spec S2 (FELA-19): on a true first run — zero tasks, not just a
 * filtered-to-zero view — the toolbar and `CompletedSection` are hidden
 * entirely rather than shown empty, and `EmptyState first-run` takes the
 * list's place. That decision lives here, one level above `TaskList`,
 * because it also has to hide `Toolbar`, a sibling.
 */
function AppBody() {
  const { tasks, lastRemoved, restoreRemoved } = useTaskStore()
  const toolbar = useToolbarState(tasks)
  const panelId = useId()
  const tabIdPrefix = useId()

  const composerRef = useRef<ComposerHandle>(null)
  const headerRef = useRef<ShortcutsPanelHandle>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // The focus-independent half of design-spec 6.3. The row-scoped keys are
  // `useRowShortcuts`, declared inside `TaskList` where the row is known.
  useGlobalShortcuts({
    newTask: () => composerRef.current?.requestNewTask(),
    focusSearch: () => searchRef.current?.focus(),
    setFilter: toolbar.setFilter,
    openShortcuts: () => headerRef.current?.openShortcuts(),
    clearSearch: toolbar.clearQuery,
    // The one undo path: the toast's «Вернуть» dispatches the same
    // `task/restoreRemoved` (issue point 5). Reading `lastRemoved` first
    // keeps the key quiet when the slot is empty, so it announces nothing
    // and restores nothing instead of claiming to have undone something.
    restoreRemoved: () => {
      const removed = lastRemoved
      if (removed === null) return
      restoreRemoved()
      announce(`Задача возвращена: «${removed.task.title}»`)
    },
  })

  const completedCount = tasks.filter(isDone).length
  const activeCount = tasks.length - completedCount
  const isFirstRun = tasks.length === 0
  const summary = isFirstRun
    ? 'Добавьте первую задачу — список появится здесь.'
    : `Активных: ${String(activeCount)} · Выполнено: ${String(completedCount)}`

  return (
    <AppShell headerRef={headerRef}>
      <div className="flex flex-col gap-(--space-8)">
        <Hero
          summary={summary}
          progressSlot={isFirstRun ? undefined : <ProgressRing completed={completedCount} total={tasks.length} />}
        />
        <ErrorBanner />
        <Composer ref={composerRef} />
        {isFirstRun ? (
          <EmptyState variant="first-run" onAddTask={() => composerRef.current?.requestNewTask()} />
        ) : (
          <>
            <Toolbar
              ref={searchRef}
              filter={toolbar.filter}
              query={toolbar.query}
              counts={toolbar.view.counts}
              onFilterChange={toolbar.setFilter}
              onQueryChange={toolbar.setQuery}
              listPanelId={panelId}
              idPrefix={tabIdPrefix}
            />
            <TaskList
              view={toolbar.view}
              query={toolbar.query}
              filter={toolbar.filter}
              panelId={panelId}
              activeTabId={segmentTabId(tabIdPrefix, toolbar.filter)}
              onClearSearch={toolbar.clearQuery}
              onSearchAll={() => toolbar.setFilter('all')}
            />
          </>
        )}
      </div>
    </AppShell>
  )
}

function App() {
  return (
    <TaskStoreProvider>
      <AppBody />
    </TaskStoreProvider>
  )
}

export default App
