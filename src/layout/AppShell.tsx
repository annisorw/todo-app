import type { ReactNode } from 'react'
import { LiveRegion } from '../components/LiveRegion'
import { AppHeader } from './AppHeader'
import { AuroraBackground } from './AuroraBackground'

interface AppShellProps {
  children: ReactNode
}

/**
 * Design spec 3.1: `AuroraBackground` -> `AppHeader` -> `main` -> the
 * `ToastViewport` slot (left as a comment — nothing to mount yet, the
 * toast system is a later task). The inner wrapper needs its own stacking
 * context (`relative z-(--z-content)`): without it, the `fixed` background
 * would paint over the static header/main content per CSS stacking order.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-dvh">
      <AuroraBackground />

      <div className="relative z-(--z-content) flex min-h-dvh flex-col">
        <AppHeader />

        {/* 120px mobile-only bottom padding (design-spec 6.2) keeps the fixed
         * `Fab` + toast from covering the last row — not on the spacing
         * scale, same one-off exception as the due-today font weight in
         * `DueDateChip`. */}
        <main className="mx-auto w-full max-w-(--layout-content-max) flex-1 px-(--layout-gutter) max-sm:pb-[120px]">
          {children}
        </main>

        {/* ToastViewport mounts here once the toast system exists. */}

        <LiveRegion />
      </div>
    </div>
  )
}
