import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tooltip } from './Tooltip'

describe('Tooltip', () => {
  it('does not show immediately on hover — it waits out the 400ms delay', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Delete this task">
        <button aria-label="Delete task">x</button>
      </Tooltip>,
    )

    await user.hover(screen.getByRole('button', { name: 'Delete task' }))

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows after the delay, describing the trigger via aria-describedby', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Delete this task">
        <button aria-label="Delete task">x</button>
      </Tooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'Delete task' })
    await user.hover(trigger)

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent('Delete this task')
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id)
  })

  it('hides instantly on mouse leave, with no delay', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Delete this task">
        <button aria-label="Delete task">x</button>
      </Tooltip>,
    )

    const trigger = screen.getByRole('button', { name: 'Delete task' })
    await user.hover(trigger)
    await screen.findByRole('tooltip')

    await user.unhover(trigger)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows on keyboard focus, so it is reachable without a mouse', async () => {
    const user = userEvent.setup()
    render(
      <Tooltip content="Delete this task">
        <button aria-label="Delete task">x</button>
      </Tooltip>,
    )

    await user.tab()

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Delete this task')
  })

  it('hides instantly on blur', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Tooltip content="Delete this task">
          <button aria-label="Delete task">x</button>
        </Tooltip>
        <button>after</button>
      </>,
    )

    await user.tab()
    await screen.findByRole('tooltip')

    await user.tab()

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
