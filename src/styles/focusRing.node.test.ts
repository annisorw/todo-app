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
 * - `outline-0`: compiles to `outline-width: 0`, leaving the ring with no
 *   width. Gone just as completely, only the spelling differs.
 * - `outline-transparent`: the ring is still drawn, in nothing.
 *
 * Specificity decides none of this, and it is worth saying once: the default
 * ring lives in `@layer base` and these utilities in `@layer utilities`, which
 * comes later, so every spelling below wins over the ring no matter how
 * specific either selector is. That is also why this guard matters more after
 * FELA-65 than before it — until the ring moved into a layer, an unlayered
 * `base.css` beat every suppression here and they were all inert.
 *
 * Leading variants (`focus:`, `focus-visible:`, `md:focus:`) are captured so a
 * site is identified by the utility as written, not by a bare stem.
 * `outline-offset` and `outline: 2px solid ...` deliberately do not match.
 */
const SUPPRESSION_PATTERNS: readonly RegExp[] = [
  /(?:[\w-]+:)*outline-(?:none|hidden|0|transparent)\b!?/g,
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
  /** Files carrying the replacement treatment — often parent components. */
  ringProvidedBy: readonly string[]
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
    ringProvidedBy: ['features/toolbar/SearchField.tsx'],
    marker: 'border-accent-text shadow-glow-accent',
  },
  {
    file: 'features/composer/ComposerTextarea.tsx',
    utility: 'focus-visible:outline-none',
    occurrences: 1,
    reason:
      'Spec 3.7/3.8: the shared textarea glows via its wrapper on both call sites, so a second ring on the textarea itself would double the treatment — the desktop card glows directly, the sheet wraps the field in its own bordered box (same pattern as SearchField).',
    ringProvidedBy: ['features/composer/Composer.tsx', 'features/composer/ComposerSheet.tsx'],
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

/** `@`-rules enclosing `index`, outermost first, as `@name arg` (e.g.
 *  `@layer base`) so a bare `@layer` match can't pass for the right one.
 *  Comments are blanked (not removed) so a `@` in prose cannot fake a layer
 *  and indices stay aligned. */
function enclosingAtRules(css: string, index: number): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (match) => ' '.repeat(match.length))
  const stack: (string | null)[] = []
  let since = 0
  for (let i = 0; i < index; i += 1) {
    const char = text[i]
    if (char === '{') {
      const prelude = text.slice(since, i).match(/@([\w-]+)([^{};]*)$/)
      stack.push(prelude ? `@${prelude[1]} ${(prelude[2] ?? '').trim()}`.trim() : null)
      since = i + 1
    } else if (char === '}' || char === ';') {
      if (char === '}') stack.pop()
      since = i + 1
    }
  }
  return stack.filter((entry): entry is string => entry !== null)
}

describe('focus ring', () => {
  it('is defined once in base.css for every interactive element', () => {
    const baseCss = readFileSync(join(SRC, 'styles/base.css'), 'utf8')

    expect(baseCss).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-focus-ring\)/)
    expect(baseCss).toMatch(/:focus-visible\s*\{[^}]*outline-offset:\s*2px/)
  })

  it('keeps the default ring in a cascade layer, so suppressing it works at all', () => {
    const baseCss = readFileSync(join(SRC, 'styles/base.css'), 'utf8')
    const ring = baseCss.indexOf(':focus-visible')

    expect(ring, 'no `:focus-visible` rule in base.css').toBeGreaterThan(-1)
    expect(
      enclosingAtRules(baseCss, ring),
      'An unlayered rule beats every layered utility regardless of specificity, so moving the ring out of `@layer base` (into `@layer utilities`, or out of any layer) makes every ALLOWED_SUPPRESSIONS entry inert and brings the double focus indicator back — silently, because the allowlist would still look consistent.',
    ).toContain('@layer base')
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

    for (const path of entry.ringProvidedBy) {
      const provider = readFileSync(join(SRC, path), 'utf8')
      expect(
        provider,
        `${entry.file} drops the focus ring because ${path} replaces it (${entry.reason}) — that replacement is gone, so the field now has no focus indicator.`,
      ).toContain(entry.marker)
    }
  })
})
