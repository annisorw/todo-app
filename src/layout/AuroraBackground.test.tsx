import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuroraBackground } from './AuroraBackground'

function stubMatchMedia(matches: boolean) {
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

describe('AuroraBackground', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('drifts by default', () => {
    stubMatchMedia(false)
    const { container } = render(<AuroraBackground />)

    expect(container.querySelectorAll('.animate-aurora-drift')).toHaveLength(3)
  })

  it('stops drifting under prefers-reduced-motion: reduce', () => {
    stubMatchMedia(true)
    const { container } = render(<AuroraBackground />)

    expect(container.querySelectorAll('.animate-aurora-drift')).toHaveLength(0)
  })

  it('stays out of layout and out of the way of clicks', () => {
    stubMatchMedia(false)
    const { container } = render(<AuroraBackground />)

    const root = container.firstElementChild
    expect(root).toHaveClass('fixed', 'pointer-events-none')
    expect(root).toHaveAttribute('aria-hidden', 'true')
  })
})
