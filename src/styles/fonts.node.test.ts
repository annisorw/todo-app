import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards the contract between `fonts.css` and `tokens.css` (FELA-32).
 *
 * `--font-sans` / `--font-mono` in `tokens.css` name a font family by string. CSS
 * does not fail if that family has no matching `@font-face` — the browser just
 * falls through to the next family in the stack (`system-ui`, `ui-monospace`, ...)
 * and nobody notices until someone compares a screenshot to the spec. This test
 * reads both files from disk, the way `tokens.node.test.ts` does, so it has to fail if
 * either file's family name drifts from the other.
 */

const FONTS_CSS = readFileSync(join(process.cwd(), 'src/styles/fonts.css'), 'utf8')
const TOKENS_CSS = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8')

function firstFamily(fontShorthand: string): string {
  const quoted = /^'([^']+)'|^"([^"]+)"/.exec(fontShorthand.trim())
  if (!quoted) {
    throw new Error(`Expected a quoted font family, got "${fontShorthand}".`)
  }
  return (quoted[1] ?? quoted[2])!
}

function tokenValue(name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(TOKENS_CSS)
  if (!match) {
    throw new Error(`tokens.css does not define ${name}.`)
  }
  return match[1]!.trim()
}

function declaredFamilies(css: string): Set<string> {
  const families = new Set<string>()
  for (const match of css.matchAll(/@font-face\s*{[^}]*}/g)) {
    const block = match[0]
    const familyMatch = /font-family:\s*'([^']+)'|font-family:\s*"([^"]+)"/.exec(block)
    if (familyMatch) {
      families.add((familyMatch[1] ?? familyMatch[2])!)
    }
  }
  return families
}

describe('fonts.css declares the families tokens.css points at', () => {
  const declared = declaredFamilies(FONTS_CSS)

  it.each([
    ['--font-sans', tokenValue('--font-sans')],
    ['--font-mono', tokenValue('--font-mono')],
  ])('%s resolves to a family declared in fonts.css', (_token, shorthand) => {
    const family = firstFamily(shorthand)
    expect(declared.has(family), `"${family}" has no @font-face in fonts.css`).toBe(true)
  })
})

describe('fonts.css loads nothing from a third-party host', () => {
  it('has no @import, http(s) url(), or external <link>-style reference', () => {
    expect(FONTS_CSS).not.toMatch(/@import/)
    expect(FONTS_CSS).not.toMatch(/url\(\s*['"]?https?:/)
  })

  it('declares font-display: swap on every @font-face', () => {
    const blocks = FONTS_CSS.match(/@font-face\s*{[^}]*}/g) ?? []
    expect(blocks.length).toBeGreaterThan(0)
    for (const block of blocks) {
      expect(block).toMatch(/font-display:\s*swap/)
    }
  })
})
