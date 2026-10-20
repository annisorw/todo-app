import type { ReactNode } from 'react'
import { LiveRegion } from '../components/LiveRegion'
import { ToastProvider } from '../state/ToastProvider'
import { AppHeader } from './AppHeader'
import { AuroraBackground } from './AuroraBackground'

interface AppShellProps {
  children: ReactNode
}

/**
 * Design spec 3.1: `AuroraBackground` -> `AppHeader` -> `main` -> the
 * `ToastViewport`. `ToastProvider` (FELA-18) both supplies `useToast()` to
 * every descendant and renders that fixed viewport itself, as a sibling of
 * `AppHeader`/`main` — its own `position: fixed` escapes the flow, so where
 * it sits in this tree only matters for which descendants can push toasts.
 * The inner wrapper needs its own stacking context (`relative z-(--z-content)`):
 * without it, the `fixed` background would paint over the static
 * header/main content per CSS stacking order.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-dvh">
      <AuroraBackground />

      <div className="relative z-(--z-content) flex min-h-dvh flex-col">
        <ToastProvider>
          <AppHeader />

          <main className="mx-auto w-full max-w-(--layout-content-max) flex-1 px-(--layout-gutter)">
            {children}
          </main>
        </ToastProvider>

        <LiveRegion />
      </div>
    </div>
  )
}
