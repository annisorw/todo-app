import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('first-run: shows the spec copy, the hint row, and focuses the composer on click', async () => {
    const user = userEvent.setup()
    const onAddTask = vi.fn()
    render(<EmptyState variant="first-run" onAddTask={onAddTask} />)

    expect(screen.getByRole('heading', { name: 'Пока пусто' })).toBeInTheDocument()
    expect(
      screen.getByText('Запишите первую задачу — остальное подхватится по ходу дела.'),
    ).toBeInTheDocument()

    expect(screen.getByText('N')).toBeInTheDocument()
    expect(screen.getByText('/')).toBeInTheDocument()
    expect(screen.getByText('?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Добавить первую задачу' }))
    expect(onAddTask).toHaveBeenCalledOnce()
  })

  it('no-active: shows a congratulatory message with no action', () => {
    render(<EmptyState variant="no-active" />)

    expect(screen.getByRole('heading', { name: 'Все активные задачи выполнены' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('no-completed: shows its own message with no action', () => {
    render(<EmptyState variant="no-completed" />)

    expect(screen.getByRole('heading', { name: 'Пока нет выполненных задач' })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('no-active-matches: names the query, points at Completed, and offers only "Очистить поиск"', async () => {
    const user = userEvent.setup()
    const onClearSearch = vi.fn()
    render(<EmptyState variant="no-active-matches" query="молоко" onClearSearch={onClearSearch} />)

    expect(screen.getByRole('heading', { name: 'По запросу «молоко» нет активных задач' })).toBeInTheDocument()
    expect(screen.getByText('Совпадения есть только в «Готовые» — они ниже.')).toBeInTheDocument()

    const button = screen.getByRole('button', { name: 'Очистить поиск' })
    expect(screen.getAllByRole('button')).toHaveLength(1)

    await user.click(button)
    expect(onClearSearch).toHaveBeenCalledOnce()
  })

  it('no-search-results: names the query, offers "Очистить поиск" always and "Искать во всех" only with a named filter', async () => {
    const user = userEvent.setup()
    const onClearSearch = vi.fn()
    const onSearchAll = vi.fn()
    render(
      <EmptyState
        variant="no-search-results"
        query="контракт"
        activeFilterLabel="Активные"
        onClearSearch={onClearSearch}
        onSearchAll={onSearchAll}
      />,
    )

    expect(screen.getByRole('heading', { name: 'По запросу «контракт» нет задач' })).toBeInTheDocument()
    expect(screen.getByText('Проверьте раскладку или сбросьте фильтр «Активные».')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Очистить поиск' }))
    expect(onClearSearch).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Искать во всех' }))
    expect(onSearchAll).toHaveBeenCalledOnce()
  })

  it('no-search-results: drops "Искать во всех" and the filter clause when the filter is already "Все"', () => {
    render(
      <EmptyState variant="no-search-results" query="контракт" onClearSearch={vi.fn()} />,
    )

    expect(screen.getByText('Проверьте раскладку.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Искать во всех' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Очистить поиск' })).toBeInTheDocument()
  })
})
