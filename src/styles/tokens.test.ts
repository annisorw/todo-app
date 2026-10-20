import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrast guard for the token layer (design-spec, acceptance criterion 3).
 *
 * The colour values are read out of `tokens.css`, never repeated here: the test
 * has to fail when someone weakens a token, which it cannot do if it carries its
 * own copy of the table. What this file does own is the *roles* — which token is
 * foreground, which surface it sits on, and which tokens are decorative. Those
 * come from the prose around spec tables 2.1-2.2 and are not values.
 */

const TEXT_MIN_RATIO = 4.5
const CONTROL_MIN_RATIO = 3
/**
 * The skeleton is decor and carries no text, so the WCAG minimums do not apply.
 * This floor exists for a different failure: a translucent skeleton token that
 * is merely inherited from the other theme composites to *exactly* its own
 * surface (ratio 1.00) and vanishes. 1.1 sits below the weakest real value
 * (dark base, 1.14:1) so it does not pin the design, and far enough above 1.00
 * to catch the inheritance bug.
 */
const SKELETON_MIN_RATIO = 1.1

const SURFACE = '--color-surface-1-solid'

/** Text and icon colours, measured against the surface they sit on. */
const FOREGROUND_ON_SURFACE = [
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-tertiary',
  '--color-accent-text',
  '--color-focus-ring',
  '--color-priority-high',
  '--color-priority-med',
  '--color-priority-low',
  '--color-overdue',
  '--color-success',
  '--color-danger',
] as const

/** Control outlines need 3:1, not 4.5:1 — they are shapes, not text. */
const CONTROL_ON_SURFACE = ['--color-control-border'] as const

/** Accent fills carry `--color-accent-contrast` as their label colour. */
const ACCENT_FILLS = ['--color-accent', '--color-accent-hover', '--color-accent-active'] as const

/**
 * Everything the spec marks as decorative or as a backdrop. Listed explicitly so
 * that a newly added colour token cannot slip in unchecked: the exhaustiveness
 * test below fails until it is classified one way or the other.
 */
const NOT_A_FOREGROUND = [
  '--color-bg-canvas',
  '--color-aurora-1',
  '--color-aurora-2',
  '--color-aurora-3',
  '--color-surface-1',
  '--color-surface-1-solid',
  '--color-surface-2',
  '--color-surface-2-solid',
  '--color-surface-hover',
  '--color-surface-border',
  '--color-surface-border-strong',
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-active',
] as const

/**
 * Translucent, so they are measured after compositing rather than as-is. Order
 * matters and is asserted below: base is the trough, shine is the moving
 * highlight (spec 2.2, `skeleton-shimmer` in 2.9).
 */
const SKELETON_BASE = '--skeleton-base'
const SKELETON_SHINE = '--skeleton-shine'

interface Pair {
  foreground: string
  background: string
  minRatio: number
}

const PAIRS: Pair[] = [
  ...FOREGROUND_ON_SURFACE.map((foreground) => ({
    foreground,
    background: SURFACE,
    minRatio: TEXT_MIN_RATIO,
  })),
  ...CONTROL_ON_SURFACE.map((foreground) => ({
    foreground,
    background: SURFACE,
    minRatio: CONTROL_MIN_RATIO,
  })),
  ...ACCENT_FILLS.map((background) => ({
    foreground: '--color-accent-contrast',
    background,
    minRatio: TEXT_MIN_RATIO,
  })),
]

// --- tokens.css as the single source of values --------------------------------

/**
 * Read from disk, not imported: `@tailwindcss/vite` intercepts every `.css`
 * load in this project, `?raw` query or not, and hands back empty content.
 * Vitest stubs plain CSS imports too, so disk is the only way to see what
 * `tokens.css` actually says. This file therefore has its own tsconfig project
 * with Node types (see tsconfig.tokens-test.json) instead of pulling `node`
 * into the whole app project. Paths are relative to the project root, which is
 * Vitest's working directory.
 */
const TOKENS_CSS = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')

/** Comments mention selectors such as `[data-theme='light']`; drop them first. */
const CSS_WITHOUT_COMMENTS = TOKENS_CSS.replace(/\/\*[\s\S]*?\*\//g, '')

function blockBody(selector: string): string {
  const selectorAt = CSS_WITHOUT_COMMENTS.indexOf(selector)
  if (selectorAt === -1) {
    throw new Error(`tokens.css has no "${selector}" block.`)
  }

  const open = CSS_WITHOUT_COMMENTS.indexOf('{', selectorAt + selector.length)
  if (open === -1) {
    throw new Error(`The "${selector}" block in tokens.css is not opened.`)
  }

  let depth = 0
  for (let index = open; index < CSS_WITHOUT_COMMENTS.length; index += 1) {
    const character = CSS_WITHOUT_COMMENTS[index]
    if (character === '{') depth += 1
    if (character === '}') {
      depth -= 1
      if (depth === 0) return CSS_WITHOUT_COMMENTS.slice(open + 1, index)
    }
  }

  throw new Error(`The "${selector}" block in tokens.css is not closed.`)
}

function declarations(body: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match
    if (name === undefined || value === undefined) continue
    result[name] = value.trim()
  }
  return result
}

/** Dark is the base theme; light only overrides what differs (spec 2.2). */
const DARK_TOKENS = declarations(blockBody('@theme static'))
const LIGHT_TOKENS = { ...DARK_TOKENS, ...declarations(blockBody("[data-theme='light']")) }

const THEMES = { dark: DARK_TOKENS, light: LIGHT_TOKENS }

// --- WCAG 2.1 relative luminance and contrast ratio ---------------------------

type Rgb = readonly [number, number, number]

function parseHexColor(value: string): Rgb {
  const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value)
  if (short) {
    const [, r, g, b] = short
    return [
      Number.parseInt(`${r}${r}`, 16),
      Number.parseInt(`${g}${g}`, 16),
      Number.parseInt(`${b}${b}`, 16),
    ]
  }

  const long = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value)
  if (long) {
    const [, r, g, b] = long
    return [Number.parseInt(r!, 16), Number.parseInt(g!, 16), Number.parseInt(b!, 16)]
  }

  // Deliberately loud: a token in a checked pair has to be an opaque colour,
  // otherwise its contrast depends on whatever happens to sit behind it.
  throw new Error(`Expected an opaque hex colour, got "${value}".`)
}

/** https://www.w3.org/TR/WCAG21/#dfn-relative-luminance */
function relativeLuminance([red, green, blue]: Rgb): number {
  const linear = (value: number) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
}

/** https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const a = relativeLuminance(foreground)
  const b = relativeLuminance(background)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

function tokenColor(tokens: Record<string, string>, name: string): Rgb {
  const value = tokens[name]
  if (value === undefined) {
    throw new Error(`tokens.css does not define ${name}.`)
  }
  return parseHexColor(value)
}

// --- translucent tokens, measured after compositing ---------------------------

/** `rgba(r,g,b,a)` with the alpha written either as `.12` or `0.12`. */
function parseRgbaColor(value: string): { color: Rgb; alpha: number } {
  const match = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d*\.?\d+)\s*\)$/i.exec(value)
  if (!match) {
    throw new Error(`Expected an rgba() colour, got "${value}".`)
  }
  const [, red, green, blue, alpha] = match
  return {
    color: [Number(red), Number(green), Number(blue)],
    alpha: Number(alpha),
  }
}

/** Source-over compositing: what the eye actually sees on an opaque backdrop. */
function compositeOver(foreground: Rgb, alpha: number, background: Rgb): Rgb {
  return [0, 1, 2].map((channel) =>
    Math.round(foreground[channel]! * alpha + background[channel]! * (1 - alpha)),
  ) as unknown as Rgb
}

function compositedToken(tokens: Record<string, string>, name: string, onto: Rgb): Rgb {
  const value = tokens[name]
  if (value === undefined) {
    throw new Error(`tokens.css does not define ${name}.`)
  }
  const { color, alpha } = parseRgbaColor(value)
  return compositeOver(color, alpha, onto)
}

// --- the checks ---------------------------------------------------------------

describe.each(Object.entries(THEMES))('contrast — %s theme', (_themeName, tokens) => {
  it.each(PAIRS)('$foreground on $background is at least $minRatio:1', (pair) => {
    const ratio = contrastRatio(tokenColor(tokens, pair.foreground), tokenColor(tokens, pair.background))

    expect(Number(ratio.toFixed(2))).toBeGreaterThanOrEqual(pair.minRatio)
  })
})

/**
 * Guards the bug that shipped once already: the light theme inherited the dark
 * skeleton (white at 5%/11%), which composites to pure white on a white
 * surface. Nothing errors, nothing looks broken in dark, and the loading state
 * is simply blank until someone screenshots light mode.
 */
describe.each(Object.entries(THEMES))('skeleton — %s theme', (_themeName, tokens) => {
  const surface = tokenColor(tokens, SURFACE)
  const base = compositedToken(tokens, SKELETON_BASE, surface)
  const shine = compositedToken(tokens, SKELETON_SHINE, surface)

  it('keeps the base visible against the surface it sits on', () => {
    expect(contrastRatio(base, surface)).toBeGreaterThanOrEqual(SKELETON_MIN_RATIO)
  })

  it('keeps the shimmer visible against the base', () => {
    expect(contrastRatio(shine, base)).toBeGreaterThanOrEqual(SKELETON_MIN_RATIO)
  })

  it('puts the shine lighter than the base, whichever way the alphas run', () => {
    // The one rule that holds in both themes: dark reaches it with a *stronger*
    // white, light with a *weaker* ink. Comparing alphas instead of the
    // composited result is what makes people "fix" the light theme backwards.
    expect(relativeLuminance(shine)).toBeGreaterThan(relativeLuminance(base))
  })
})

describe('coverage', () => {
  it('classifies every colour token as checked or decorative', () => {
    const classified = new Set<string>([
      ...FOREGROUND_ON_SURFACE,
      ...CONTROL_ON_SURFACE,
      ...NOT_A_FOREGROUND,
      SKELETON_BASE,
      SKELETON_SHINE,
      '--color-accent-contrast',
    ])

    for (const [themeName, tokens] of Object.entries(THEMES)) {
      const colorTokens = Object.keys(tokens).filter(
        (name) => name.startsWith('--color-') || name.startsWith('--skeleton-'),
      )
      const unclassified = colorTokens.filter((name) => !classified.has(name))

      expect(unclassified, `unclassified colour tokens in the ${themeName} theme`).toEqual([])
    }
  })

  it('checks both themes and every table row', () => {
    expect(Object.keys(THEMES)).toEqual(['dark', 'light'])
    expect(PAIRS).toHaveLength(FOREGROUND_ON_SURFACE.length + CONTROL_ON_SURFACE.length + ACCENT_FILLS.length)
  })
})

describe('the contrast check itself', () => {
  it('rejects a colour that is too weak against the dark surface', () => {
    // #6A6A85 is the dark control border: fine as a 3:1 outline, far too weak
    // as text. If this ever clears 4.5:1, the formula above is wrong.
    const ratio = contrastRatio(parseHexColor('#6A6A85'), tokenColor(DARK_TOKENS, SURFACE))

    expect(ratio).toBeLessThan(TEXT_MIN_RATIO)
  })

  it('matches the ratio the spec quotes for white on the accent fill', () => {
    const ratio = contrastRatio(parseHexColor('#FFFFFF'), tokenColor(DARK_TOKENS, '--color-accent'))

    expect(ratio).toBeCloseTo(5.58, 1)
  })

  it('refuses to measure a translucent token', () => {
    expect(() => tokenColor(DARK_TOKENS, '--color-surface-1')).toThrow(/opaque hex colour/)
  })

  it('fails the skeleton check when the light theme inherits the dark values', () => {
    // The exact bug this guards. Dark's white .05 on light's white surface is
    // white: ratio 1.00. If this ever clears the floor, the check is asleep.
    const lightSurface = tokenColor(LIGHT_TOKENS, SURFACE)
    const inherited = compositeOver(parseRgbaColor('rgba(255,255,255,.05)').color, 0.05, lightSurface)

    expect(contrastRatio(inherited, lightSurface)).toBeLessThan(SKELETON_MIN_RATIO)
  })
})
