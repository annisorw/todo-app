import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { highlight } from './highlight'

function Title({ title, query }: { title: string; query: string }) {
  return <span>{highlight(title, query)}</span>
}

describe('highlight', () => {
  it('never renders an <img> for a title containing an onerror payload — only visible, escaped text', () => {
    const title = '<img src=x onerror=alert(1)>'
    const { container } = render(<Title title={title} query="img" />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe(title)
  })

  it('wraps the matched substring in <mark> for a search query', () => {
    const { container } = render(<Title title="Купить молоко" query="молок" />)

    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveTextContent('молок')
    expect(container.textContent).toBe('Купить молоко')
  })

  it('highlights every occurrence of the query, not just the first', () => {
    const { container } = render(<Title title="банан банан банан" query="бан" />)

    expect(container.querySelectorAll('mark')).toHaveLength(3)
    expect(container.textContent).toBe('банан банан банан')
  })

  it('matches case-insensitively', () => {
    const { container } = render(<Title title="СРОЧНО купить" query="срочно" />)

    expect(container.querySelectorAll('mark')).toHaveLength(1)
    expect(container.querySelector('mark')).toHaveTextContent('СРОЧНО')
  })

  it('renders one plain text node with no <mark> for an empty query', () => {
    const { container } = render(<Title title="Купить молоко" query="" />)

    expect(container.querySelectorAll('mark')).toHaveLength(0)
    expect(container.textContent).toBe('Купить молоко')
  })

  it('renders nothing extra when the query does not match', () => {
    const { container } = render(<Title title="Купить молоко" query="хлеб" />)

    expect(container.querySelectorAll('mark')).toHaveLength(0)
    expect(container.textContent).toBe('Купить молоко')
  })
})
