import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChipTag } from './ChipTag'

describe('ChipTag', () => {
  it('warns in dev when a static chip is given button-only props it cannot render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <ChipTag isInteractive={false} expanded={false} className="chip" title="bar">
        label
      </ChipTag>,
    )

    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain('"title"')

    warn.mockRestore()
  })

  it('renders id on a static chip without warning — a span can still be addressed by id (FELA-15)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { container } = render(
      <ChipTag isInteractive={false} expanded={false} className="chip" id="foo">
        label
      </ChipTag>,
    )

    expect(container.querySelector('#foo')).not.toBeNull()
    expect(warn).not.toHaveBeenCalled()

    warn.mockRestore()
  })

  it('does not warn for a static chip with no extra props', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <ChipTag isInteractive={false} expanded={false} className="chip">
        label
      </ChipTag>,
    )

    expect(warn).not.toHaveBeenCalled()

    warn.mockRestore()
  })

  it('does not warn for an interactive chip, which forwards props to the button', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <ChipTag isInteractive expanded={false} className="chip" id="foo">
        label
      </ChipTag>,
    )

    expect(warn).not.toHaveBeenCalled()

    warn.mockRestore()
  })
})
