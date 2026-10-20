import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Focus-ring guard (design-spec section 7, acceptance criterion 24; FELA-20
 * point 4).
 *
 * `base.css` gives every interactive element a `:focus-visible` ring. A single
 * `outline-none` in a component silently takes it away again, and nothing in
 * `lint`, `typecheck` or a render test notices — the element simply stops
 * showing where the keyboard is.
 *
 * Suppressing the ring is legitimate when the component moves it somewhere
 * better: the search field and the composer both drop the outline on the inner
 * field and light up the surrounding card instead (spec 3.7/3.8). So the rule
 * this file enforces is not "never suppress" but "never suppress without a
 * replacement, and name the replacement":
 *
 * 1. every suppression site in `src` is listed in `ALLOWED_SUPPRESSIONS`;
 * 2. every listed site still suppresses something, so entries cannot go stale;
 * 3. the replacement treatment named by each entry still exists;
 * 4. `base.css` still defines the default ring the rest of the app relies on.
 *
 * Point 3 is what makes this more than a grep: deleting the composer's focus
 * glow fails the test from the file that no longer has it, instead of leaving a
 * textarea with no focus indicator at all.
 */

const SRC = join(process.cwd(), 'src')

/**
 * Tailwind v4 renamed `outline-none` to `outline-hidden`; both still parse, so
 * both count. `outline: 0` is the hand-written CSS spelling of the same thing.
 * `outline-offset` and `outline: 2px solid ...` deliberately do not match.
 */
const SUPPRESSION = /\boutline-(?:none|hidden)\b|\boutline\s*:\s*(?:none|0)\s*(?:;|$)/

interface AllowedSuppression {
  /** Path relative to `src`, as the failure message prints it. */
  file: string
  /** Why the ring may go away here. */
  reason: string
  /** File carrying the replacement treatment — often a parent component. */
  ringProvidedBy: string
  /** Class or declaration that *is* the replacement, asserted to still exist. */
  marker: string
}

const ALLOWED_SUPPRESSIONS: readonly AllowedSuppression[] = [
  {
    file: 'features/toolbar/SearchField.tsx',
    reason:
      'Spec 3.8: the focused state belongs to the whole field, so the ring moves from the bare input to the wrapper, which takes an accent border plus glow.',
    ringProvidedBy: 'features/toolbar/SearchField.tsx',
    marker: 'border-accent-text shadow-glow-accent',
  },
  {
    file: 'features/composer/ComposerFields.tsx',
    reason:
      'Spec 3.7: the composer card glows while its textarea has focus, so a second ring on the textarea itself would double the treatment.',
    ringProvidedBy: 'features/composer/Composer.tsx',
    marker: 'shadow-glow-accent',
  },
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    if (!/\.(?:tsx?|css)$/.test(entry.name)) return []
    // Tests name the classes they assert on; only shipped code can hide a ring.
    if (/\.test\.tsx?$/.test(entry.name)) return []
    return [path]
  })
}

interface Suppression {
  file: string
  line: number
  text: string
}

const SUPPRESSIONS: readonly Suppression[] = sourceFiles(SRC).flatMap((path) => {
  const file = relative(SRC, path).replaceAll('\\', '/')
  return readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((text, index) =>
      SUPPRESSION.test(text) ? [{ file, line: index + 1, text: text.trim() }] : [],
    )
})

describe('focus ring', () => {
  it('is defined once in base.css for every interactive element', () => {
    const baseCss = readFileSync(join(SRC, 'styles/base.css'), 'utf8')

    expect(baseCss).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-focus-ring\)/)
    expect(baseCss).toMatch(/:focus-visible\s*\{[^}]*outline-offset:\s*2px/)
  })

  it('is never suppressed outside the allowlist', () => {
    const allowed = new Set(ALLOWED_SUPPRESSIONS.map((entry) => entry.file))
    const offenders = SUPPRESSIONS.filter((found) => !allowed.has(found.file)).map(
      (found) => `${found.file}:${found.line} — ${found.text}`,
    )

    expect(
      offenders,
      'Removing the focus ring hides the keyboard position (acceptance criterion 24). Either keep the ring, or move it to a wrapper and add an ALLOWED_SUPPRESSIONS entry naming that wrapper.',
    ).toEqual([])
  })

  it.each(ALLOWED_SUPPRESSIONS)('has a live replacement for $file', (entry) => {
    const stillSuppresses = SUPPRESSIONS.some((found) => found.file === entry.file)
    expect(
      stillSuppresses,
      `${entry.file} no longer suppresses the outline — drop its ALLOWED_SUPPRESSIONS entry instead of leaving it to cover a future one.`,
    ).toBe(true)

    const provider = readFileSync(join(SRC, entry.ringProvidedBy), 'utf8')
    expect(
      provider,
      `${entry.file} drops the focus ring because ${entry.ringProvidedBy} replaces it (${entry.reason}) — that replacement is gone, so the field now has no focus indicator.`,
    ).toContain(entry.marker)
  })
})
