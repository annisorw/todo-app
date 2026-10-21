import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressRing } from './ProgressRing'

describe('ProgressRing', () => {
  it('reads as "Выполнено N из M задач" (design-spec 3.20)', () => {
    render(<ProgressRing completed={3} total={7} />)

    expect(screen.getByRole('img', { name: 'Выполнено 3 из 7 задач' })).toBeInTheDocument()
  })

  it('duplicates the count as visible text — the ring is never the only carrier', () => {
    render(<ProgressRing completed={3} total={7} />)

    expect(screen.getByText('3/7')).toBeInTheDocument()
    expect(screen.getByText('готово')).toBeInTheDocument()
  })

  it('handles zero tasks without dividing by zero', () => {
    render(<ProgressRing completed={0} total={0} />)

    expect(screen.getByRole('img', { name: 'Выполнено 0 из 0 задач' })).toBeInTheDocument()
    expect(screen.getByText('0/0')).toBeInTheDocument()
  })
})
