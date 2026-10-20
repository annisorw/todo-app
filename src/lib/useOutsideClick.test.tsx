import { useRef, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useOutsideClick } from './useOutsideClick'

interface PanelProps {
  onClose: () => void
}

function Panel({ onClose }: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLButtonElement>(null)

  useOutsideClick({ onOutsideClick: onClose, inside: [panelRef, anchorRef] })

  return (
    <>
      <button type="button" ref={anchorRef}>
        anchor
      </button>
      <div ref={panelRef}>
        <button type="button">inside panel</button>
      </div>
    </>
  )
}

function Harness({ onClose }: PanelProps) {
  const [open, setOpen] = useState(true)

  return (
    <>
      <button type="button" onClick={() => setOpen(false)}>
        unmount panel
      </button>
      <button type="button">outside</button>
      {open ? <Panel onClose={onClose} /> : null}
    </>
  )
}

describe('useOutsideClick', () => {
  it('fires on a click outside every region', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'outside' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('stays silent for a click inside the panel or on the anchor', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'inside panel' }))
    await user.click(screen.getByRole('button', { name: 'anchor' }))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('leaves focus where the click landed', async () => {
    const user = userEvent.setup()
    render(<Harness onClose={vi.fn()} />)

    const outside = screen.getByRole('button', { name: 'outside' })
    await user.click(outside)

    expect(outside).toHaveFocus()
  })

  it('stops listening once the layer unmounts', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'unmount panel' }))
    onClose.mockClear()

    await user.click(screen.getByRole('button', { name: 'outside' }))

    expect(onClose).not.toHaveBeenCalled()
  })
})
