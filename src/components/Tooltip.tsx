import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'

const SHOW_DELAY_MS = 400

export interface TooltipProps {
  content: ReactNode
  /**
   * The trigger. Its own accessible name must already carry the same
   * information as `content` — the tooltip is a supplementary description
   * (`aria-describedby`), never the only place the information lives
   * (design-spec 3.22).
   */
  children: ReactElement
}

/** design-spec 3.22 — 400 ms show delay, instant hide. */
export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const tooltipId = useId()

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const show = () => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
  }

  const hide = () => {
    clearTimeout(timeoutRef.current)
    setVisible(false)
  }

  if (!isValidElement<Record<string, unknown>>(children)) return children

  // False positive below: cloneElement merges event-handler props onto the
  // trigger element, it does not read timeoutRef.current.
  // oxlint-disable-next-line react/refs
  const trigger = cloneElement(children, {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
    'aria-describedby': visible ? tooltipId : undefined,
  })

  return (
    <span className="relative inline-flex" onKeyDown={(event) => event.key === 'Escape' && hide()}>
      {trigger}
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute top-full left-1/2 z-(--z-dropdown) mt-2 -translate-x-1/2 rounded-xs bg-surface-2-solid px-2 py-1 text-caption text-primary shadow-sm whitespace-nowrap"
        >
          {content}
        </span>
      )}
    </span>
  )
}
