import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_TITLE_LENGTH } from '../../domain/limits'
import { makeTask } from '../../test/factories'
import { stubMatchMedia } from '../../test/matchMedia'
import { TaskEditorSheet } from './TaskEditorSheet'

// FELA-133 repro: (а + newline) 249 times + а = 499 chars, same shape the
// audit used to blow the sheet past the viewport (panel height 5809px,
// top -4965px).
const LONG_TITLE = 'а\n'.repeat(249) + 'а'

function renderSheet(title: string) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  render(<TaskEditorSheet task={makeTask({ title })} onSave={onSave} onCancel={onCancel} />)
  return { onSave, onCancel }
}

describe('TaskEditorSheet', () => {
  beforeEach(() => {
    stubMatchMedia(false)
  })

  it('bounds the panel to the viewport and lets it scroll (FELA-133)', () => {
    renderSheet(LONG_TITLE)

    const panel = screen.getByRole('dialog', { name: 'Изменить задачу' })
    expect(panel.className).toMatch(/max-h-\[90dvh\]/)
    expect(panel.className).toMatch(/overflow-y-auto/)
  })

  it('caps the textarea growth and scrolls internally instead of growing unbounded (FELA-133)', () => {
    renderSheet(LONG_TITLE)

    const textarea = screen.getByRole('textbox', { name: 'Текст задачи' })
    expect(textarea.className).toMatch(/max-h-\[40dvh\]/)
    expect(textarea.className).toMatch(/overflow-y-auto/)
    expect(textarea.className).toMatch(/break-words/)
    expect(textarea).toHaveValue(LONG_TITLE)
  })

  it('keeps the full title intact for a single unbroken line at the limit', () => {
    const unbroken = 'а'.repeat(MAX_TITLE_LENGTH)
    renderSheet(unbroken)

    const textarea = screen.getByRole('textbox', { name: 'Текст задачи' })
    expect(textarea).toHaveValue(unbroken)
  })

  it('keeps Save and Cancel reachable and working with a near-limit title', async () => {
    const user = userEvent.setup()
    const { onCancel } = renderSheet(LONG_TITLE)

    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Отмена' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
