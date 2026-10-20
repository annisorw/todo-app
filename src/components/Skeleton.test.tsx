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
