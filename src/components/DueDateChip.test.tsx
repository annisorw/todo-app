import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DueDateChip } from './DueDateChip'

describe('DueDateChip', () => {
  it('renders the dashed empty placeholder for "none"', () => {
    render(<DueDateChip status="none" label="" />)
    expect(screen.getByText('Срок')).toBeInTheDocument()
  })

  it('renders the invalid-date placeholder', () => {
    render(<DueDateChip status="invalid" label="" />)
    expect(screen.getByText('Неверная дата')).toBeInTheDocument()
  })

  it('renders the upcoming label supplied by the caller, unchanged', () => {
    render(<DueDateChip status="upcoming" label="Завтра" />)
    expect(screen.getByText('Завтра')).toBeInTheDocument()
  })

  it('renders the today label supplied by the caller, unchanged', () => {
    render(<DueDateChip status="today" label="Сегодня" />)
    expect(screen.getByText('Сегодня')).toBeInTheDocument()
  })

  it('renders the overdue label alongside the clock icon, not colour alone', () => {
    render(<DueDateChip status="overdue" label="Просрочено на 2 дня" />)
    expect(screen.getByText('Просрочено на 2 дня')).toBeInTheDocument()
  })

  it('renders a static chip as an inert, unfocusable element', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <>
        <DueDateChip status="overdue" label="Просрочено на 2 дня" variant="static" onClick={onClick} />
        <button type="button">after</button>
      </>,
    )

    expect(screen.queryByRole('button', { name: /Просрочено/ })).not.toBeInTheDocument()

    await user.click(screen.getByText('Просрочено на 2 дня'))
    expect(onClick).not.toHaveBeenCalled()

    await user.tab()
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus()
  })

  it('renders an interactive chip as a focusable button with aria-expanded', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<DueDateChip status="upcoming" label="Завтра" variant="interactive" expanded={false} onClick={onClick} />)

    const button = screen.getByRole('button', { name: /Завтра/ })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('reflects the open picker state via aria-expanded', () => {
    render(<DueDateChip status="upcoming" label="Завтра" variant="interactive" expanded />)
    expect(screen.getByRole('button', { name: /Завтра/ })).toHaveAttribute('aria-expanded', 'true')
  })
})
