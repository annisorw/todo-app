import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)('renders the %s variant with its label', (variant) => {
    render(<Button variant={variant}>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('activates from the keyboard', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disables the button and reports aria-busy while loading, without losing the label', () => {
    render(<Button loading>Save</Button>)

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  // jsdom does not apply the stylesheet, so this guards the class pair only.
  // The rendered heights (44 at 390px, 32 at 1440px) are checked against built dist in a browser.
  it('gives the sm size a 44px mobile target that shrinks to 32px from the sm breakpoint up', () => {
    render(<Button size="sm">Save</Button>)

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveClass('h-11')
    expect(button).toHaveClass('sm:h-8')
  })

  // Same guard for md: ConfirmDialog's two bulk-delete buttons are the only md
  // call site, so this is the mobile target that must not be missed (spec 3.5).
  it('gives the md size a 44px mobile target that shrinks to 40px from the sm breakpoint up', () => {
    render(<Button size="md">Save</Button>)

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveClass('h-11')
    expect(button).toHaveClass('sm:h-10')
  })

  it('keeps the same icon-slot markup whether or not it is loading, so the button width never changes', () => {
    const { rerender } = render(<Button>Save</Button>)
    const idleSlotCount = screen.getByRole('button').children.length

    rerender(<Button loading>Save</Button>)
    const loadingSlotCount = screen.getByRole('button').children.length

    expect(loadingSlotCount).toBe(idleSlotCount)
  })
})
