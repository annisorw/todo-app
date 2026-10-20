import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('takes its accessible name from the required aria-label', () => {
    render(<IconButton icon={<svg />} aria-label="Edit task" />)
    expect(screen.getByRole('button', { name: 'Edit task' })).toBeInTheDocument()
  })

  it('calls onClick when activated from the keyboard', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<IconButton icon={<svg />} aria-label="Edit task" onClick={onClick} />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Edit task' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('disables the button and reports aria-busy while loading', () => {
    render(<IconButton icon={<svg />} aria-label="Edit task" loading />)

    const button = screen.getByRole('button', { name: 'Edit task' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<IconButton icon={<svg />} aria-label="Edit task" onClick={onClick} disabled />)

    await user.click(screen.getByRole('button', { name: 'Edit task' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  // Compile-time guard for the acceptance criterion: an IconButton without
  // aria-label must fail typechecking, not just an eslint rule.
  it('requires aria-label at the type level', () => {
    // @ts-expect-error aria-label is required and intentionally omitted here
    const element = <IconButton icon={<svg />} />
    expect(element).toBeTruthy()
  })
})
