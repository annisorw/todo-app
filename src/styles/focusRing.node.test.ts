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
 * 1. every suppression in `src` is covered by an `ALLOWED_SUPPRESSIONS` entry —
 *    matched by file *and* by the exact utility, not by file alone;
 * 2. each entry matches exactly as many sites as it claims, so an entry can
 *    neither go stale nor quietly cover a second, unreviewed element;
 * 3. the replacement treatment named by each entry still exists;
 * 4. `base.css` still defines the default ring the rest of the app relies on.
 *
 * Point 3 is what makes this more than a grep: deleting the composer's focus
 * glow fails the test from the file that no longer has it, instead of leaving a
 * textarea with no focus indicator at all.
 */

const SRC = join(process.cwd(), 'src')

/**
 * Every spelling that takes the ring away. All of them are one `git grep` apart
 * from each other, so missing one would make the guard worse than absent — it
 * would promise cover it does not give.
 *
 * - `outline-none` / `outline-hidden`: the same Tailwind utility before and
 *   after the v4 rename; both still parse.
 * - `outline-0`: compiles to `outline-width: 0` at specificity `0,2,0`, which
 *   beats `:focus-visible { outline: 2px solid ... }` from `base.css` (`0,1,0`).
 *   The ring is gone just as completely, only the spelling differs.
 * - `outline-transparent`: the ring is still drawn, in nothing.
 *
 * Leading variants (`focus:`, `focus-visible:`, `md:focus:`) are captured so a
 * site is identified by the utility as written, not by a bare stem.
 * `outline-offset` and `outline: 2px solid ...` deliberately do not match.
 */
const SUPPRESSION_PATTERNS: readonly RegExp[] = [
  /(?:[\w-]+:)*outline-(?:none|hidden|0|transparent)\b/g,
  /outline\s*:\s*(?:none|0)\s*(?=;|$)/gm,
  /outline-(?:width\s*:\s*0|color\s*:\s*transparent)\s*(?=;|$)/gm,
]

interface AllowedSuppression {
  /** Path relative to `src`, as the failure message prints it. */
  file: string
  /** The suppressing utility or declaration exactly as written in that file. */
  utility: string
  /** How many elements in the file may carry it. Guards against a silent second site. */
  occurrences: number
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
    utility: 'outline-none',
    occurrences: 1,
    reason:
      'Spec 3.8: the focused state belongs to the whole field, so the ring moves from the bare input to the wrapper, which takes an accent border plus glow.',
    ringProvidedBy: 'features/toolbar/SearchField.tsx',
    marker: 'border-accent-text shadow-glow-accent',
  },
  {
    file: 'features/composer/ComposerFields.tsx',
    utility: 'focus:outline-none',
    occurrences: 1,
    reason:
      'Spec 3.7: the composer card glows while its textarea has focus, so a second ring on the textarea itself would double the treatment. Covers the desktop path only: ComposerSheet renders the same fields with no focus treatment of its own, so on mobile this suppression currently has no replacement — FELA-65 decides what the sheet shows, and this entry has to be revisited then.',
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
  /** The matched utility or declaration — what an allowlist entry has to name. */
  utility: string
}

function suppressionsIn(text: string): string[] {
  return SUPPRESSION_PATTERNS.flatMap((pattern) => text.match(pattern) ?? [])
}

const SUPPRESSIONS: readonly Suppression[] = sourceFiles(SRC).flatMap((path) => {
  const file = relative(SRC, path).replaceAll('\\', '/')
  return readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((text, index) =>
      suppressionsIn(text).map((utility) => ({ file, line: index + 1, utility })),
    )
})

describe('focus ring', () => {
  it('is defined once in base.css for every interactive element', () => {
    const baseCss = readFileSync(join(SRC, 'styles/base.css'), 'utf8')

    expect(baseCss).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-focus-ring\)/)
    expect(baseCss).toMatch(/:focus-visible\s*\{[^}]*outline-offset:\s*2px/)
  })

  it('is never suppressed outside the allowlist', () => {
    const allowed = new Set(ALLOWED_SUPPRESSIONS.map((entry) => `${entry.file} ${entry.utility}`))
    const offenders = SUPPRESSIONS.filter(
      (found) => !allowed.has(`${found.file} ${found.utility}`),
    ).map((found) => `${found.file}:${found.line} — ${found.utility}`)

    expect(
      offenders,
      'Removing the focus ring hides the keyboard position (acceptance criterion 24). Either keep the ring, or move it to a wrapper and add an ALLOWED_SUPPRESSIONS entry naming that wrapper.',
    ).toEqual([])
  })

  it.each(ALLOWED_SUPPRESSIONS)('has a live replacement for $file ($utility)', (entry) => {
    const sites = SUPPRESSIONS.filter(
      (found) => found.file === entry.file && found.utility === entry.utility,
    )
    expect(
      sites.length,
      `${entry.file} has ${sites.length} \`${entry.utility}\` site(s), the allowlist expects ${entry.occurrences}. More means a second element lost its ring under cover of this entry; fewer means the entry is stale and should be dropped rather than left to cover a future one.`,
    ).toBe(entry.occurrences)

    const provider = readFileSync(join(SRC, entry.ringProvidedBy), 'utf8')
    expect(
      provider,
      `${entry.file} drops the focus ring because ${entry.ringProvidedBy} replaces it (${entry.reason}) — that replacement is gone, so the field now has no focus indicator.`,
    ).toContain(entry.marker)
  })
})
