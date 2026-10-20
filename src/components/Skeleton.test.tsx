import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('is hidden from assistive tech — it is a placeholder, not content', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('reuses the real row height token instead of a one-off number', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstChild).toHaveClass('h-(--layout-row-h)')
  })
})

describe('the skeleton-row shimmer (styles/base.css)', () => {
  const css = readFileSync(join(process.cwd(), 'src/styles/base.css'), 'utf8')

  it('animates with the 1400ms linear shimmer from the motion spec', () => {
    expect(css).toContain('animation: skeleton-shimmer 1400ms linear infinite')
  })

  it('drops the gradient to a flat static backing under prefers-reduced-motion', () => {
    const reducedMotionBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .skeleton-row'))
    expect(reducedMotionBlock).toContain('background-image: none')
    expect(reducedMotionBlock).toContain('animation: none')
  })
})
