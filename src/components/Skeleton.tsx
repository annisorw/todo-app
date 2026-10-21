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
 *
 * No call site on purpose (FELA-132): `TaskStoreProvider` hydrates
 * `localStorage` synchronously in its `useReducer` initializer, before the
 * first render, per `docs/ARCHITECTURE.md` §4–5. That leaves no commit for
 * this to appear in, no matter how slow the read is — so the "hydration
 * takes >120ms" state this component was built for is unreachable until
 * hydration becomes async, which TechLead decided not to do.
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('skeleton-row h-(--layout-row-h) w-full rounded-lg', className)} />
}
