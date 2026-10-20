import { createRef } from 'react'
import type { RefObject } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Filter, TaskCounts } from '../../domain/filters'
import { stubMatchMedia } from '../../test/matchMedia'
import { Toolbar } from './Toolbar'
import type { ToolbarProps } from './Toolbar'

const COUNTS: TaskCounts = { all: 3, active: 2, completed: 1 }

function renderToolbar(props: Partial<ToolbarProps> & { ref?: RefObject<HTMLInputElement | null> } = {}) {
  const onFilterChange = vi.fn<(filter: Filter) => void>()
  const onQueryChange = vi.fn<(query: string) => void>()
  const view = render(
    <Toolbar
      filter="all"
      query=""
      counts={COUNTS}
      onFilterChange={onFilterChange}
      onQueryChange={onQueryChange}
      {...props}
    />,
  )
  return { ...view, onFilterChange, onQueryChange }
}

/** jsdom has no `IntersectionObserver`; `useStickyBand` only needs `observe`/`disconnect` to exist. */
class StubIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}

describe('Toolbar', () => {
  beforeEach(() => {
    stubMatchMedia(false)
    vi.stubGlobal('IntersectionObserver', StubIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the segment counts it was given', () => {
    renderToolbar()

    expect(screen.getByRole('tab', { name: 'Все 3' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Активные 2' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Готовые 1' })).toBeInTheDocument()
  })

  it('marks the segment from the filter prop as selected', () => {
    renderToolbar({ filter: 'completed' })

    expect(screen.getByRole('tab', { name: 'Готовые 1' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Все 3' })).toHaveAttribute('aria-selected', 'false')
  })

  it('reports a segment click instead of switching on its own', () => {
    const { onFilterChange } = renderToolbar()

    fireEvent.click(screen.getByRole('tab', { name: 'Готовые 1' }))

    expect(onFilterChange).toHaveBeenCalledWith('completed')
    // Controlled: the tab only moves once the owner sends a new `filter`.
    expect(screen.getByRole('tab', { name: 'Все 3' })).toHaveAttribute('aria-selected', 'true')
  })

  it('shows the query prop and reports every keystroke raw', () => {
    const { onQueryChange } = renderToolbar({ query: 'молоко' })

    const searchbox = screen.getByRole('searchbox')
    expect(searchbox).toHaveValue('молоко')

    fireEvent.change(searchbox, { target: { value: 'молок' } })
    expect(onQueryChange).toHaveBeenCalledWith('молок')
  })

  it('forwards its ref to the search input for the global "/" shortcut', () => {
    const ref = createRef<HTMLInputElement>()
    renderToolbar({ ref })

    expect(ref.current).toBe(screen.getByRole('searchbox'))
  })

  it('keeps an empty segment clickable and focusable with no disabled/aria-disabled', () => {
    renderToolbar({ counts: { all: 1, active: 1, completed: 0 } })

    const completedTab = screen.getByRole('tab', { name: 'Готовые 0' })
    expect(completedTab).not.toHaveAttribute('disabled')
    expect(completedTab).not.toHaveAttribute('aria-disabled')
    completedTab.focus()
    expect(completedTab).toHaveFocus()
  })
})
