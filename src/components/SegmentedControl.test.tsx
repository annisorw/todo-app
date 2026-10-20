import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubMatchMedia } from '../test/matchMedia'
import { SegmentedControl } from './SegmentedControl'

const OPTIONS = [
  { id: 'all', label: 'Все', count: 5 },
  { id: 'active', label: 'Активные', count: 3 },
  { id: 'completed', label: 'Готовые', count: 0 },
]

function renderControl(selectedId = 'all', onSelect = vi.fn()) {
  render(
    <SegmentedControl aria-label="Фильтр задач" options={OPTIONS} selectedId={selectedId} onSelect={onSelect} />,
  )
  return { onSelect }
}

/** Controlled wrapper: lets a keyboard test chain several arrow presses against real selection state. */
function ControlledControl({ initialId }: { initialId: string }) {
  const [selectedId, setSelectedId] = useState(initialId)
  return (
    <SegmentedControl aria-label="Фильтр задач" options={OPTIONS} selectedId={selectedId} onSelect={setSelectedId} />
  )
}

describe('SegmentedControl', () => {
  beforeEach(() => {
    stubMatchMedia(false)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a tablist with one tab per option, selection marked by aria-selected', () => {
    renderControl('active')

    expect(screen.getByRole('tablist', { name: 'Фильтр задач' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Все/ })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: /Активные/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Готовые/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('is a single Tab stop: only the selected tab has tabIndex 0', () => {
    renderControl('active')

    expect(screen.getByRole('tab', { name: /Все/ })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tab', { name: /Активные/ })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: /Готовые/ })).toHaveAttribute('tabindex', '-1')
  })

  it('calls onSelect with the next segment on ArrowRight', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderControl('all')

    screen.getByRole('tab', { name: /Все/ }).focus()
    await user.keyboard('{ArrowRight}')

    expect(onSelect).toHaveBeenCalledWith('active')
  })

  it('wraps around at the ends', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderControl('all')

    screen.getByRole('tab', { name: /Все/ }).focus()
    await user.keyboard('{ArrowLeft}')

    expect(onSelect).toHaveBeenCalledWith('completed')
  })

  it('moves focus and selection together across a sequence of ArrowRight / ArrowLeft', async () => {
    const user = userEvent.setup()
    render(<ControlledControl initialId="all" />)

    screen.getByRole('tab', { name: /Все/ }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /Активные/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Активные/ })).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: /Все/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Все/ })).toHaveFocus()
  })

  it('jumps to the first/last segment with Home/End', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderControl('active')

    screen.getByRole('tab', { name: /Активные/ }).focus()
    await user.keyboard('{End}')
    expect(onSelect).toHaveBeenCalledWith('completed')

    onSelect.mockClear()
    await user.keyboard('{Home}')
    expect(onSelect).toHaveBeenCalledWith('all')
  })

  it('leaves a count-0 segment clickable and focusable, with no disabled/aria-disabled', async () => {
    const user = userEvent.setup()
    const { onSelect } = renderControl('all')

    const completedTab = screen.getByRole('tab', { name: /Готовые/ })
    expect(completedTab).not.toHaveAttribute('disabled')
    expect(completedTab).not.toHaveAttribute('aria-disabled')

    await user.click(completedTab)
    expect(onSelect).toHaveBeenCalledWith('completed')
  })
})
