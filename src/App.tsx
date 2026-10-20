import { ErrorBanner } from './components/ErrorBanner'
import { AppShell } from './layout/AppShell'
import { Hero } from './layout/Hero'
import { TaskStoreProvider } from './state/TaskStoreProvider'

function App() {
  return (
    <TaskStoreProvider>
      <AppShell>
        <Hero summary="Добавьте первую задачу — список появится здесь." />
        <ErrorBanner className="mb-(--space-6)" />
      </AppShell>
    </TaskStoreProvider>
  )
}

export default App
