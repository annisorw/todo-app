import { cn } from '../lib/cn'

export interface SkeletonProps {
  className?: string
}

/**
 * design-spec 3.19 — a placeholder row the height of a real task row
 * (`--layout-row-h`, 56/64 px by viewport). `aria-hidden` because it isn't
 * content; the list that renders these owns `aria-busy="true"`.
 *
 * The shimmer itself (`skeleton-row`, 1400ms gradient, disabled under
 * `prefers-reduced-motion`) lives in `styles/base.css` — see the comment
 * there for why it isn't a Tailwind utility.
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('skeleton-row h-(--layout-row-h) w-full rounded-lg', className)} />
}
