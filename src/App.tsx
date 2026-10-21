import { useId } from 'react'
import { ErrorBanner } from './components/ErrorBanner'
import { segmentTabId } from './components/segmentTabId'
import { isDone } from './domain/task'
import { Composer } from './features/composer/Composer'
import { TaskList } from './features/task-list/TaskList'
import { Toolbar } from './features/toolbar/Toolbar'
import { useToolbarState } from './features/toolbar/useToolbarState'
import { AppShell } from './layout/AppShell'
import { Hero } from './layout/Hero'
import { TaskStoreProvider } from './state/TaskStoreProvider'
import { useTaskStore } from './state/useTaskStore'

/**
 * Wires `Composer` (FELA-14), `Toolbar` (FELA-16/FELA-66) and `TaskList`
 * (FELA-15) together — nothing else did this yet, and a screen that doesn't
 * render is a screen that can't be opened in a browser to check against the
 * spec. `useToolbarState` is the single source of `filter`/`query`/`view`;
 * both `Toolbar` and `TaskList` are controlled from it.
 */
function AppBody() {
  const { tasks } = useTaskStore()
  const toolbar = useToolbarState(tasks)
  const panelId = useId()
  const tabIdPrefix = useId()

  const completedCount = tasks.filter(isDone).length
  const activeCount = tasks.length - completedCount
  const summary =
    tasks.length === 0
      ? 'Добавьте первую задачу — список появится здесь.'
      : `Активных: ${String(activeCount)} · Выполнено: ${String(completedCount)}`

  return (
    <AppShell>
      <div className="flex flex-col gap-(--space-8)">
        <Hero summary={summary} />
        <ErrorBanner />
        <Composer />
        <Toolbar
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
        />
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
