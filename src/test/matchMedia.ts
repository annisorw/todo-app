import { vi } from 'vitest'

/**
 * Every component gated on a theme or on `prefers-reduced-motion` needs
 * `window.matchMedia` stubbed in jsdom, which doesn't implement it.
 */
export function stubMatchMedia(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}
