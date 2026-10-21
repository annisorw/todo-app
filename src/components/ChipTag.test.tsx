import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CHIP_INTERACTIVE_TOUCH_TARGET_CLASSES } from './chip'
import { ChipTag } from './ChipTag'

const TOUCH_TARGET_CLASSES = CHIP_INTERACTIVE_TOUCH_TARGET_CLASSES.split(' ')

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

  /**
   * The size of the hit area is a browser question and is measured against the
   * built CSS by hit-testing (FELA-113, acceptance criterion 1) — jsdom
   * computes no pseudo-element box. What these two cases pin is the thing jsdom
   * can see and a refactor can silently break: *which* chips get the utilities
   * at all. Mobile `TaskRow` chips are static and must keep an invisible band
   * off the row title (design-spec 3.12).
   */
  it('gives an interactive chip the mobile 44 px hit area on top of its own classes', () => {
    const { container } = render(
      <ChipTag isInteractive expanded={false} className="chip">
        label
      </ChipTag>,
    )

    const button = container.querySelector('button')
    expect(button?.classList.contains('chip')).toBe(true)
    for (const className of TOUCH_TARGET_CLASSES) {
      expect(button?.classList.contains(className)).toBe(true)
    }
  })

  it('leaves a static chip without the hit area', () => {
    const { container } = render(
      <ChipTag isInteractive={false} expanded={false} className="chip">
        label
      </ChipTag>,
    )

    const span = container.querySelector('span')
    expect(span?.className).toBe('chip')
  })
})
