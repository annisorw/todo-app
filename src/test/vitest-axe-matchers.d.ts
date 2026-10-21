/**
 * Augments Vitest's own `Assertion` with `toHaveNoViolations` (registered at
 * runtime in `setupTests.ts` via `expect.extend(toHaveNoViolations)`).
 *
 * This one has to be a module (the `import 'vitest'` below is required) —
 * unlike `jest-axe.d.ts` next to it, `vitest` already ships real types, and
 * augmenting an *existing* module declaration needs the augmenting file to be
 * a module, the mirror-image rule from the one documented there. Keeping the
 * two in separate files is what lets each follow its own rule.
 */
import 'vitest'

declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveNoViolations: () => T
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations: () => void
  }
}
