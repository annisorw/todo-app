import { useEffect } from 'react'
import type { RefObject } from 'react'

export interface UsePopoverDismissOptions {
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  panelRef: RefObject<HTMLElement | null>
}

/**
 * Shared Esc/outside-click dismissal for chip popovers (`PrioritySelect`,
 * `DueDatePicker`) and `Menu`. Mount it only while the popover is actually
 * open — the caller unmounts the popover to close it, which tears this
 * listener down with it, so there is no separate `open` flag to thread
 * through.
 *
 * Esc always returns focus to the anchor (design-spec 3.15, and the v1.1
 * addition to 3.12/3.13); an outside click just closes without stealing
 * focus from wherever the click landed.
 */
export function usePopoverDismiss({ onClose, anchorRef, panelRef }: UsePopoverDismissOptions): void {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      onClose()
      anchorRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, anchorRef, panelRef])
}
