import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useRovingFocus } from './useRovingFocus'

function Harness({ ids }: { ids: string[] }) {
  const [list] = useState(ids)
  const roving = useRovingFocus(list)

  return (
    <ul>
      {list.map((id) => (
        <li key={id}>
          <button
            type="button"
            ref={(node) => roving.registerRef(id, node)}
            tabIndex={roving.getTabIndex(id)}
            onFocus={() => roving.handleFocus(id)}
            onKeyDown={(event) => roving.handleKeyDown(event, id)}
          >
            {id}
          </button>
          <button type="button" tabIndex={roving.getTabIndex(id)}>
            {id}-edit
          </button>
        </li>
      ))}
    </ul>
  )
}

describe('useRovingFocus', () => {
  it('only the first row (and its actions) joins the tab sequence at first', () => {
    render(<Harness ids={['a', 'b', 'c']} />)

    expect(screen.getByRole('button', { name: 'a' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: 'a-edit' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: 'b' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('button', { name: 'c' })).toHaveAttribute('tabindex', '-1')
  })

  it('ArrowDown moves real focus to the next row and its tabindex becomes 0', async () => {
    const user = userEvent.setup()
    render(<Harness ids={['a', 'b', 'c']} />)

    screen.getByRole('button', { name: 'a' }).focus()
    await user.keyboard('{ArrowDown}')

    expect(screen.getByRole('button', { name: 'b' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'b' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: 'a' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('button', { name: 'a-edit' })).toHaveAttribute('tabindex', '-1')
  })

  it('ArrowUp from the first row wraps to the last', async () => {
    const user = userEvent.setup()
    render(<Harness ids={['a', 'b', 'c']} />)

    screen.getByRole('button', { name: 'a' }).focus()
    await user.keyboard('{ArrowUp}')

    expect(screen.getByRole('button', { name: 'c' })).toHaveFocus()
  })

  it('clicking a row (real focus) syncs the active id without arrow keys', async () => {
    const user = userEvent.setup()
    render(<Harness ids={['a', 'b', 'c']} />)

    await user.click(screen.getByRole('button', { name: 'c' }))

    expect(screen.getByRole('button', { name: 'c' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: 'a' })).toHaveAttribute('tabindex', '-1')
  })
})
