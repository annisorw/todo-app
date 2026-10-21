/**
 * `jest-axe` ships no `.d.ts` of its own (only `@types/jest-axe`, which pulls
 * in `/// <reference types="jest" />` — a package this repo does not install,
 * since it runs on Vitest). This is the minimal surface the test file below
 * actually uses.
 *
 * Kept as a global script — no top-level `import`/`export` anywhere in this
 * file — on purpose. TypeScript only treats a `declare module 'x' { ... }`
 * block as *declaring a brand-new module* when the file is a global script;
 * the moment the file gains any top-level `import`, the same block becomes
 * *augmentation* of an existing module declaration, and since `jest-axe` has
 * none, the augmentation silently merges onto nothing and the real `tsc -b`
 * run still reports "implicitly has an 'any' type" at every call site.
 * Confirmed empirically against this repo's `tsconfig.app.json` before
 * settling on this shape — do not "clean up" by importing `axe-core`'s types
 * here, that reintroduces exactly this failure.
 */
declare module 'jest-axe' {
  interface JestAxeRunOptions {
    rules?: Record<string, { enabled?: boolean }>
  }

  interface JestAxeResults {
    violations: unknown[]
  }

  function axe(html: Element | Document | string, options?: JestAxeRunOptions): Promise<JestAxeResults>
  const toHaveNoViolations: {
    toHaveNoViolations: (results: JestAxeResults) => { pass: boolean; message: () => string }
  }

  export { axe, toHaveNoViolations }
}
