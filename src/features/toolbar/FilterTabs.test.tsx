import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '../../test/matchMedia'
import { FilterTabs } from './FilterTabs'

describe('FilterTabs', () => {
  beforeEach(() => {
    stubMatchMedia(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the three fixed filters with their counts', () => {
    render(
      <FilterTabs filter="all" counts={{ all: 8, active: 5, completed: 3 }} onFilterChange={vi.fn()} />,
    )

    expect(screen.getByRole('tab', { name: 'Все 8' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Активные 5' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Готовые 3' })).toBeInTheDocument()
  })

  it('calls onFilterChange when a segment is clicked', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()
    render(<FilterTabs filter="all" counts={{ all: 8, active: 5, completed: 3 }} onFilterChange={onFilterChange} />)

    await user.click(screen.getByRole('tab', { name: 'Активные 5' }))

    expect(onFilterChange).toHaveBeenCalledWith('active')
  })

  it('keeps a zero-count segment clickable and focusable, without disabled/aria-disabled', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()
    render(<FilterTabs filter="all" counts={{ all: 8, active: 8, completed: 0 }} onFilterChange={onFilterChange} />)

    const completedTab = screen.getByRole('tab', { name: 'Готовые 0' })
    expect(completedTab).not.toHaveAttribute('disabled')
    expect(completedTab).not.toHaveAttribute('aria-disabled')

    completedTab.focus()
    expect(completedTab).toHaveFocus()

    await user.click(completedTab)
    expect(onFilterChange).toHaveBeenCalledWith('completed')
  })
})
