import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PriorityChip } from './PriorityChip'

describe('PriorityChip', () => {
  it.each([
    ['high', '▲', 'Высокий'],
    ['medium', '■', 'Средний'],
    ['low', '▼', 'Низкий'],
  ] as const)('renders %s with both a glyph and a label, not colour alone', (priority, glyph, label) => {
    render(<PriorityChip priority={priority} />)

    expect(screen.getByText(glyph)).toBeInTheDocument()
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('renders the dashed empty placeholder for "none"', () => {
    render(<PriorityChip priority="none" />)
    expect(screen.getByText('Приоритет')).toBeInTheDocument()
  })

  it('renders a static chip as an inert, unfocusable element', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <>
        <PriorityChip priority="high" variant="static" onClick={onClick} />
        <button type="button">after</button>
      </>,
    )

    expect(screen.queryByRole('button', { name: /Высокий/ })).not.toBeInTheDocument()

    await user.click(screen.getByText('Высокий'))
    expect(onClick).not.toHaveBeenCalled()

    await user.tab()
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus()
  })

  it('renders an interactive chip as a focusable button with aria-expanded', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<PriorityChip priority="high" variant="interactive" expanded={false} onClick={onClick} />)

    const button = screen.getByRole('button', { name: /Высокий/ })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('reflects the open picker state via aria-expanded', () => {
    render(<PriorityChip priority="medium" variant="interactive" expanded />)
    expect(screen.getByRole('button', { name: /Средний/ })).toHaveAttribute('aria-expanded', 'true')
  })
})
