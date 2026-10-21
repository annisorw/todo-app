import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MAX_QUERY_LENGTH } from '../../domain/limits'
import { SearchField } from './SearchField'

describe('SearchField', () => {
  it('shows the "/" hint while empty and unfocused', () => {
    render(<SearchField value="" onChange={vi.fn()} />)
    expect(screen.getByText('/')).toBeInTheDocument()
  })

  it('renders the "/" hint in the mono-numeral class (design-spec 2.5, kbd always text-mono-num)', () => {
    render(<SearchField value="" onChange={vi.fn()} />)
    expect(screen.getByText('/')).toHaveClass('text-mono-num')
  })

  it('hides the hint and shows a clear button once there is a value', () => {
    render(<SearchField value="task" onChange={vi.fn()} />)
    expect(screen.queryByText('/')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Очистить поле' })).toBeInTheDocument()
  })

  it('calls onChange on every keystroke (debounce is the caller\'s job)', () => {
    const onChange = vi.fn()
    render(<SearchField value="" onChange={onChange} />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } })

    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('clears the value when the clear button is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchField value="task" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Очистить поле' }))

    expect(onChange).toHaveBeenCalledWith('')
  })

  it('caps input length at MAX_QUERY_LENGTH', () => {
    render(<SearchField value="" onChange={vi.fn()} />)
    expect(screen.getByRole('searchbox')).toHaveAttribute('maxlength', String(MAX_QUERY_LENGTH))
  })

  it('forwards the ref to the native input so a global shortcut can focus it', () => {
    const ref = createRef<HTMLInputElement>()
    render(<SearchField ref={ref} value="" onChange={vi.fn()} />)

    ref.current?.focus()
    expect(screen.getByRole('searchbox')).toHaveFocus()
  })
})
