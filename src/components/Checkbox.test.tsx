import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '../test/matchMedia'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('takes its accessible name from the label prop, not visible text', () => {
    stubMatchMedia(false)
    render(<Checkbox checked={false} label="Buy milk" onChange={() => {}} />)

    const checkbox = screen.getByRole('checkbox', { name: 'Buy milk' })
    expect(checkbox).toBeInTheDocument()
    expect(screen.queryByText('Buy milk')).not.toBeInTheDocument()
  })

  it('reflects the checked state', () => {
    stubMatchMedia(false)
    render(<Checkbox checked label="Buy milk" onChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'Buy milk' })).toBeChecked()
  })

  it('focuses from the keyboard and toggles with Space', async () => {
    stubMatchMedia(false)
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Checkbox checked={false} label="Buy milk" onChange={onChange} />)

    await user.tab()
    const checkbox = screen.getByRole('checkbox', { name: 'Buy milk' })
    expect(checkbox).toHaveFocus()

    await user.keyboard(' ')

    expect(onChange).toHaveBeenCalledOnce()
  })

  it('is disabled and not interactive when disabled', async () => {
    stubMatchMedia(false)
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Checkbox checked={false} label="Buy milk" onChange={onChange} disabled />)

    const checkbox = screen.getByRole('checkbox', { name: 'Buy milk' })
    expect(checkbox).toBeDisabled()

    await user.click(checkbox)
    expect(onChange).not.toHaveBeenCalled()
  })

  describe('task-check (motion table, section 5)', () => {
    function fillAndStroke(container: HTMLElement) {
      const [fill, stroke] = container.querySelectorAll<HTMLElement>('[style*="transition"]')
      return { fill: fill!, stroke: stroke! }
    }

    it('runs the fill scale and checkmark draw at 240ms / --ease-spring when checked', () => {
      stubMatchMedia(false)
      const { container } = render(<Checkbox checked label="Buy milk" onChange={() => {}} />)

      const { fill, stroke } = fillAndStroke(container)
      expect(fill.style.transition).toContain('240ms var(--ease-spring)')
      expect(fill.style.opacity).toBe('1')
      expect(fill.style.transform).toBe('scale(1)')
      expect(stroke.style.transition).toContain('240ms var(--ease-spring)')
      expect(stroke.style.strokeDashoffset).toBe('0')
    })

    it('rests with the fill hidden and the checkmark undrawn when unchecked', () => {
      stubMatchMedia(false)
      const { container } = render(<Checkbox checked={false} label="Buy milk" onChange={() => {}} />)

      const { fill, stroke } = fillAndStroke(container)
      expect(fill.style.opacity).toBe('0')
      expect(fill.style.transform).toBe('scale(0.8)')
      expect(stroke.style.strokeDashoffset).not.toBe('0')
    })

    it('swaps state instantly under prefers-reduced-motion, with no transition', () => {
      stubMatchMedia(true)
      const { container } = render(<Checkbox checked label="Buy milk" onChange={() => {}} />)

      const { fill, stroke } = fillAndStroke(container)
      expect(fill.style.transition).toBe('none')
      expect(stroke.style.transition).toBe('none')
      expect(fill.style.opacity).toBe('1')
      expect(stroke.style.strokeDashoffset).toBe('0')
    })
  })

  it('puts the keyboard focus ring on the visible circle, not the invisible hit area (FELA-119)', () => {
    // The native input is `opacity-0` (it's only the large hit area), so the global
    // `:focus-visible` ring from base.css lands on it but is painted fully transparent —
    // a real `:focus-visible` match with zero visible effect. The decorative circle has to
    // carry its own `peer-focus-visible` ring instead (Chromium-verified, see PR description);
    // this test just guards that the classes implementing it aren't quietly dropped again.
    stubMatchMedia(false)
    render(<Checkbox checked={false} label="Buy milk" onChange={() => {}} />)

    const checkbox = screen.getByRole('checkbox', { name: 'Buy milk' })
    const circle = checkbox.nextElementSibling as HTMLElement
    expect(circle).toHaveAttribute('aria-hidden', 'true')

    expect(circle.className).toMatch(/peer-focus-visible:\[outline:2px_solid_var\(--color-focus-ring\)\]/)
    expect(circle.className).toMatch(/peer-focus-visible:\[outline-offset:2px\]/)

    // Spec 7: the ring must not animate in. `transition-colors` would also tween
    // `outline-color`, so the circle must use a narrower `transition-[border-color]`.
    expect(circle.className).not.toMatch(/\btransition-colors\b/)
    expect(circle.className).toMatch(/transition-\[border-color\]/)
  })
})
