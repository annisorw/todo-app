import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export interface UseOutsideClickOptions {
  /** Called once when a pointer goes down outside every `inside` region. */
  onOutsideClick: () => void
  /**
   * What counts as "inside": the panel itself, plus the trigger whenever the
   * trigger toggles the layer — otherwise the same click would close the layer
   * and the trigger would reopen it.
   */
  inside: readonly RefObject<HTMLElement | null>[]
}

/**
 * Closes a layer when the pointer goes down outside of it. Mount it only while
 * the layer is open: the caller unmounts the layer to close it, which tears
 * this listener down with it, so there is no `open` flag to thread through.
 *
 * Deliberately **not** folded into `useDismissable`. Esc has exactly one owner
 * and a stack (`lib/dismissStack.ts`) because only the top layer may react to
 * it; an outside click has neither — every open layer judges a click by its own
 * geometry, and nothing has to be arbitrated. Bundling the two is what the old
 * `usePopoverDismiss` did, and that bundle is how a second Esc discipline got
 * into the app.
 *
 * Unlike Esc, an outside click never moves focus: the click already put focus
 * where the user aimed, so stealing it back to the trigger would fight them.
 */
export function useOutsideClick({ onOutsideClick, inside }: UseOutsideClickOptions): void {
  const latest = useRef({ onOutsideClick, inside })

  useEffect(() => {
    latest.current = { onOutsideClick, inside }
  })

  // Empty deps on purpose: `inside` is a fresh array literal on every render,
  // so depending on it would rebind the listener for nothing. The handler
  // reads the current callback and regions through the ref instead.
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const { onOutsideClick: notify, inside: regions } = latest.current
      const target = event.target as Node
      if (regions.some((region) => region.current?.contains(target) === true)) return
      notify()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])
}
