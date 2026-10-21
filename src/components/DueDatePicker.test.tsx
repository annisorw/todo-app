import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DueDatePicker } from './DueDatePicker'
import { LiveRegion } from './LiveRegion'
import { stubMatchMedia } from '../test/matchMedia'

function Harness() {
  const [value, setValue] = useState<string | null>(null)
  return (
    <>
      <DueDatePicker value={value} onChange={setValue} />
      {/* Stands in for whatever follows the trigger chip in the host's own
          tab order (e.g. TaskEditor's "Сохранить") — FELA-122. */}
      <button type="button">after</button>
      <LiveRegion />
    </>
  )
}

describe('DueDatePicker', () => {
  beforeEach(() => {
    stubMatchMedia(false)
  })

  it('opens from the chip and applies a preset immediately, announcing it', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Срок' }))
    await user.click(screen.getByRole('button', { name: 'Завтра' }))

    expect(screen.getByRole('status')).toHaveTextContent(/завтра/i)
    expect(screen.getByRole('button', { name: /Завтра/ })).toBeInTheDocument()
  })

  it('"Убрать срок" clears the value and announces it', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Срок' }))
    await user.click(screen.getByRole('button', { name: 'Сегодня' }))

    await user.click(screen.getByRole('button', { name: /Сегодня/ }))
    await user.click(screen.getByRole('button', { name: 'Убрать срок' }))

    expect(screen.getByRole('status')).toHaveTextContent('Срок убран')
    expect(screen.getByRole('button', { name: 'Срок' })).toBeInTheDocument()
  })

  it('focuses the date input on open (FELA-122)', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Срок' }))

    expect(screen.getByDisplayValue('')).toHaveFocus()
  })

  it('traps Tab/Shift+Tab within the panel instead of escaping to the host (FELA-122)', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Срок' }))
    const input = screen.getByDisplayValue('')
    const lastPreset = screen.getByRole('button', { name: 'Убрать срок' })

    await user.tab({ shift: true })
    expect(lastPreset).toHaveFocus()

    await user.tab()
    expect(input).toHaveFocus()

    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    expect(lastPreset).toHaveFocus()
    expect(screen.getByRole('button', { name: 'after' })).not.toHaveFocus()
  })

  it('closes and returns focus to the chip on Esc', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const chip = screen.getByRole('button', { name: 'Срок' })
    await user.click(chip)
    expect(screen.getByRole('button', { name: 'Убрать срок' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('button', { name: 'Убрать срок' })).not.toBeInTheDocument()
    expect(chip).toHaveFocus()
  })

  it('closes on an outside click', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Harness />
        <button type="button">outside</button>
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Срок' }))
    await user.click(screen.getByRole('button', { name: 'outside' }))

    expect(screen.queryByRole('button', { name: 'Убрать срок' })).not.toBeInTheDocument()
  })
})
