import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('takes its accessible name from the label prop, not visible text', () => {
    render(<Checkbox checked={false} label="Buy milk" onChange={() => {}} />)

    const checkbox = screen.getByRole('checkbox', { name: 'Buy milk' })
    expect(checkbox).toBeInTheDocument()
    expect(screen.queryByText('Buy milk')).not.toBeInTheDocument()
  })

  it('reflects the checked state', () => {
    render(<Checkbox checked label="Buy milk" onChange={() => {}} />)
    expect(screen.getByRole('checkbox', { name: 'Buy milk' })).toBeChecked()
  })

  it('focuses from the keyboard and toggles with Space', async () => {
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
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Checkbox checked={false} label="Buy milk" onChange={onChange} disabled />)

    const checkbox = screen.getByRole('checkbox', { name: 'Buy milk' })
    expect(checkbox).toBeDisabled()

    await user.click(checkbox)
    expect(onChange).not.toHaveBeenCalled()
  })
})
