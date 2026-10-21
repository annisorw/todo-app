/**
 * The row's own surface (design-spec 3.11, colour tables 2.1/2.2, fallback
 * block 2.7) and the stacking consequence of its `backdrop-filter` (2.9).
 *
 * jsdom resolves neither `@media (hover: hover)` nor `backdrop-filter`, so the
 * real colours were measured with `getComputedStyle` in headless Chromium
 * against the built `dist` (FELA-178). What these tests hold is the intent that
 * produced those colours: the row declares a `surface-1` surface in `default`,
 * `hover`/`focus-within` lift it to `surface-2`, and the row is raised one step
 * while *any* of its three popups is open — the row `Menu`, the
 * `PrioritySelect` menu (3.12) and the `DueDatePicker` panel (3.13) — so none
 * of them is trapped under the next row by the stacking context
 * `backdrop-filter` creates.
 */
import type { ComponentProps } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTask } from '../../test/factories'
import { stubMatchMedia } from '../../test/matchMedia'
import { TaskRow } from './TaskRow'

function renderRow(overrides: Partial<ComponentProps<typeof TaskRow>> = {}) {
  return render(
    <ul>
      <TaskRow
        task={makeTask({ id: 't1', title: 'Купить молоко' })}
        query=""
        todayKey="2026-10-21"
        tabIndex={0}
        isEditing={false}
        registerRef={() => {}}
        onFocus={() => {}}
        onKeyDown={() => {}}
        onRowKeyDown={() => {}}
        onToggle={() => {}}
        onOpenEditor={() => {}}
        onCloseEditor={() => {}}
        onSave={() => {}}
        onRemove={() => {}}
        onQuickChange={() => {}}
        {...overrides}
      />
    </ul>,
  )
}

const rowOf = (container: HTMLElement) => container.querySelector('.task-row') as HTMLElement

describe('TaskRow surface (design-spec 3.11)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('carries a surface-1 background, a visible border and --shadow-xs in default', () => {
    stubMatchMedia(false)
    const row = rowOf(renderRow().container)
    expect(row.className).toContain('bg-surface-1')
    expect(row.className).toContain('border-surface-border')
    expect(row.className).toContain('shadow-xs')
    expect(row.className).not.toContain('bg-transparent')
    expect(row.className).not.toContain('border-transparent')
  })

  it('blurs what is behind it, so the 2.7 fallback hook on .task-row is not dead', () => {
    stubMatchMedia(false)
    const row = rowOf(renderRow().container)
    expect(row.className).toContain('backdrop-blur-(--blur-surface)')
  })

  it('keeps hover and focus-within on surface-2, i.e. a lift and not an appearance', () => {
    stubMatchMedia(true)
    const row = rowOf(renderRow().container)
    expect(row.className).toContain('hover:bg-surface-2')
    expect(row.className).toContain('focus-within:bg-surface-2')
  })
})

describe('TaskRow stacking while a popup inside it is open (design-spec 2.9, criterion 30)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const LIFT = 'z-(--z-content)'

  it('raises the row only while the row menu is open', () => {
    stubMatchMedia(false)
    const { container, getByLabelText } = renderRow()
    const item = container.querySelector('li') as HTMLElement
    expect(item.className).not.toContain(LIFT)

    fireEvent.click(getByLabelText('Действия с задачей: Купить молоко'))
    expect(item.className).toContain(LIFT)
  })

  // The two chips below render their panels inside `.task-row` too, with the
  // same `--z-dropdown`, and the row knows nothing about their open state on
  // its own — this is the regression the `menuOpen`-only lift left open.
  it('raises the row while the PrioritySelect menu is open, and lowers it again', () => {
    stubMatchMedia(true)
    const { container, getByRole } = renderRow({ task: makeTask({ id: 't1', priority: 'none', dueDate: null }) })
    const item = container.querySelector('li') as HTMLElement
    const chip = getByRole('button', { name: 'Приоритет' })
    expect(item.className).not.toContain(LIFT)

    fireEvent.click(chip)
    expect(getByRole('menu')).toBeTruthy()
    expect(item.className).toContain(LIFT)

    fireEvent.click(chip)
    expect(item.className).not.toContain(LIFT)
  })

  it('raises the row while the DueDatePicker panel is open, and lowers it again', () => {
    stubMatchMedia(true)
    const { container, getByRole } = renderRow({ task: makeTask({ id: 't1', priority: 'none', dueDate: null }) })
    const item = container.querySelector('li') as HTMLElement
    const chip = getByRole('button', { name: 'Срок' })
    expect(item.className).not.toContain(LIFT)

    fireEvent.click(chip)
    expect(getByRole('dialog', { name: 'Выбор срока' })).toBeTruthy()
    expect(item.className).toContain(LIFT)

    fireEvent.click(chip)
    expect(item.className).not.toContain(LIFT)
  })

  // `useOutsideClick` listens on `pointerdown`, which `fireEvent.click` does
  // not emit, so here both chips can be open at once — in a browser the second
  // chip's pointerdown closes the first. That makes this a test of the row's
  // own bookkeeping rather than of a reachable sequence: closing one popup
  // must not drop the row out from under another that is still open.
  it('stays raised while any one popup is still open', () => {
    stubMatchMedia(true)
    const { container, getByRole } = renderRow({ task: makeTask({ id: 't1', priority: 'none', dueDate: null }) })
    const item = container.querySelector('li') as HTMLElement

    fireEvent.click(getByRole('button', { name: 'Приоритет' }))
    fireEvent.click(getByRole('button', { name: 'Срок' }))
    fireEvent.click(getByRole('button', { name: 'Приоритет' }))
    expect(item.className).toContain(LIFT)
  })
})
