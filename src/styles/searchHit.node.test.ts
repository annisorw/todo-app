import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Search-highlight guard (design-spec 3.11, state `search-hit`; FELA-170).
 *
 * `highlight()` renders `<mark>`, and for a while `src/styles/` had no rule for
 * it at all — so the browser painted its own `Mark`/`MarkText` system colours
 * (pure yellow on black in Chromium) straight across a task row. Nothing in
 * `lint`, `typecheck` or a render test sees that: jsdom reports no UA colour,
 * and the token contrast suite only measures tokens the CSS actually asks for.
 *
 * So the regression is "the rule is gone again", and only reading the sheet
 * catches it. The contrast of the pair this file pins is measured in
 * `tokens.node.test.ts`; what this file owns is the shape of the rule:
 *
 * 1. a `mark` rule exists, inside `@layer base` — it is a document default, so
 *    a later class-targeted rule or Tailwind utility must win without
 *    `!important`;
 * 2. both colours come from tokens, never a literal (criterion 1);
 * 3. the rule re-inherits `text-decoration-line`, because pinning `color` would
 *    otherwise hide a completed row's strikethrough under the backing
 *    (FELA-184);
 * 4. the rule changes no metric that reflows the title. The highlight is
 *    recomputed on every keystroke, so a `font-weight` second channel or
 *    block-direction padding would make the heading jump under the cursor
 *    while the user is still typing.
 */

const BASE_CSS = readFileSync(join(process.cwd(), 'src/styles/base.css'), 'utf8')

/** Comments quote selectors and property names; drop them before matching. */
const CSS_WITHOUT_COMMENTS = BASE_CSS.replace(/\/\*[\s\S]*?\*\//g, '')

/** Body of the first block opened by `selector`, brace-matched. */
function blockBody(css: string, selector: string | RegExp): string {
  const at =
    typeof selector === 'string' ? css.indexOf(selector) : (css.match(selector)?.index ?? -1)
  if (at === -1) throw new Error(`base.css has no "${String(selector)}" block.`)

  const open = css.indexOf('{', at)
  if (open === -1) throw new Error(`The "${String(selector)}" block is not opened.`)

  let depth = 0
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1
    if (css[index] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, index)
    }
  }
  throw new Error(`The "${String(selector)}" block is not closed.`)
}

const LAYER_BASE = blockBody(CSS_WITHOUT_COMMENTS, '@layer base')

/**
 * Anchored on a line start so `[data-theme] mark` or `.foo mark` would not
 * match. Lazy, not a module constant: if the rule moves out of `@layer base`
 * this throws, and at module scope that aborts the import — vitest then reports
 * "no tests" plus the brace-matcher's message, and the one test that is about
 * the layer never gets to say so.
 */
const markRule = () => blockBody(LAYER_BASE, /^\s*mark\s*\{/m)

describe('the <mark> rule', () => {
  it('lives in @layer base, so a class-targeted rule can still override it', () => {
    // Guards the alternative that looks equivalent: an unlayered `mark {}` wins
    // over every Tailwind utility, which would make the override need
    // `!important` instead of just a later class.
    expect(/^\s*mark\s*\{/m.test(LAYER_BASE)).toBe(true)
    expect(/^\s*mark\s*\{/m.test(CSS_WITHOUT_COMMENTS.replace(LAYER_BASE, ''))).toBe(false)
  })

  it('takes its backing and its glyph colour from tokens', () => {
    expect(markRule()).toMatch(/background-color\s*:\s*var\(--color-search-hit-bg\)/)
    expect(markRule()).toMatch(/color\s*:\s*var\(--color-text-primary\)/)
  })

  it('re-inherits the strikethrough that pinning `color` took away', () => {
    // FELA-184. `text-decoration` is painted by the element that declares it,
    // so the <p>'s line-through lands under the <mark> backing and vanishes
    // over the matched fragment — on a completed task the highlighted word
    // loses two of the three §7 channels. `inherit` makes <mark> paint the line
    // itself, above its own background. Measured in Chromium on built `dist`:
    // without this declaration getComputedStyle(mark).textDecorationLine is
    // 'none' on a completed row, with it 'line-through', and the geometry of
    // both <mark> and the title is unchanged.
    expect(markRule()).toMatch(/text-decoration-line\s*:\s*inherit/)
  })

  it('leaves no hardcoded colour in the rule', () => {
    expect(markRule()).not.toMatch(/#[\da-f]{3,8}\b/i)
    expect(markRule()).not.toMatch(/\brgba?\(/)
  })

  it('does not change the weight of the matched text', () => {
    // Deliberate (FELA-170): §7 wants a second, non-colour channel, but the
    // list is already filtered and the LiveRegion announces the match count,
    // so the independence is covered without reflowing the title mid-typing.
    expect(markRule()).not.toMatch(/font-weight/)
  })

  it('adds no block-direction padding, so the row keeps its line box', () => {
    expect(markRule()).not.toMatch(/padding-block|padding-top|padding-bottom/)
    // `padding: 1px 2px` would set the block side too; only the inline
    // shorthand is allowed here.
    expect(markRule()).not.toMatch(/^\s*padding\s*:/m)
  })
})
