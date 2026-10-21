import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Filter } from '../../domain/filters'
import { registerDismissable } from '../../lib/dismissStack'
import { taskRowMarker } from './taskRowMarker'
import { useGlobalShortcuts } from './useGlobalShortcuts'
import type { GlobalShortcutActions } from './useGlobalShortcuts'

function makeActions() {
  return {
    newTask: vi.fn<() => void>(),
    focusSearch: vi.fn<() => void>(),
    setFilter: vi.fn<(filter: Filter) => void>(),
    openShortcuts: vi.fn<() => void>(),
    clearSearch: vi.fn<() => void>(),
    restoreRemoved: vi.fn<() => void>(),
  } satisfies GlobalShortcutActions
}

type Actions = ReturnType<typeof makeActions>

/**
 * Stands in for the real screen: a search field, a `textarea`, a row carrying
 * `taskRowMarker` whose focus anchor is a native checkbox and which also holds
 * a focusable control (the shape `TaskRow` produces — a drag handle and chips
 * sit inside the row), and a button whose own React handler claims `Escape`
 * the way `Composer`'s textarea does.
 */
function Harness({ actions }: { actions: GlobalShortcutActions }) {
  useGlobalShortcuts(actions)

  return (
    <div>
      <input type="search" aria-label="Поиск задач" />
      <textarea aria-label="Текст новой задачи" />
      <ul>
        <li {...taskRowMarker}>
          <input type="checkbox" aria-label="Задача" />
          <button type="button" aria-label="Внутри строки" />
        </li>
      </ul>
      <button
        type="button"
        aria-label="Свой обработчик"
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.preventDefault()
        }}
      />
    </div>
  )
}

function setup(): Actions {
  const actions = makeActions()
  render(<Harness actions={actions} />)
  return actions
}

const openLayers: (() => void)[] = []

function openLayer(): void {
  openLayers.push(registerDismissable({ onDismiss: () => undefined }))
}

afterEach(() => {
  for (const close of openLayers.splice(0)) close()
})

describe('useGlobalShortcuts — the keys from design-spec 6.3', () => {
  it('N opens a new task', () => {
    const actions = setup()

    fireEvent.keyDown(document.body, { key: 'n', code: 'KeyN' })

    expect(actions.newTask).toHaveBeenCalledTimes(1)
  })

  it('/ focuses the search field', () => {
    const actions = setup()

    fireEvent.keyDown(document.body, { key: '/', code: 'Slash' })

    expect(actions.focusSearch).toHaveBeenCalledTimes(1)
  })

  it('1 2 3 select Все / Активные / Готовые', () => {
    const actions = setup()

    fireEvent.keyDown(document.body, { key: '1', code: 'Digit1' })
    fireEvent.keyDown(document.body, { key: '2', code: 'Digit2' })
    fireEvent.keyDown(document.body, { key: '3', code: 'Digit3' })

    expect(actions.setFilter.mock.calls).toEqual([['all'], ['active'], ['completed']])
  })

  it('the numeric keypad does not switch filters', () => {
    const actions = setup()

    fireEvent.keyDown(document.body, { key: '1', code: 'Numpad1' })

    expect(actions.setFilter).not.toHaveBeenCalled()
  })

  it('? opens the shortcuts cheat sheet', () => {
    const actions = setup()

    fireEvent.keyDown(document.body, { key: '?', code: 'Slash', shiftKey: true })

    expect(actions.openShortcuts).toHaveBeenCalledTimes(1)
    expect(actions.focusSearch).not.toHaveBeenCalled()
  })

  it('Ctrl+Z and Cmd+Z both restore the last removed task', () => {
    const actions = setup()

    fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', metaKey: true })

    expect(actions.restoreRemoved).toHaveBeenCalledTimes(2)
  })

  it('Ctrl+Shift+Z is redo, not undo — it is left alone', () => {
    const actions = setup()

    fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true })

    expect(actions.restoreRemoved).not.toHaveBeenCalled()
  })

  it('Esc with nothing open clears the search', () => {
    const actions = setup()

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })

    expect(actions.clearSearch).toHaveBeenCalledTimes(1)
  })

  /**
   * Table 6.3 gives `Esc` one action, not two. Dropping the row's focus *is*
   * the action when a row is focused, so the search query — which the user
   * never asked to lose — has to survive it.
   */
  it('Esc on a focused row drops its focus and leaves the search query alone', () => {
    const actions = setup()
    const checkbox = screen.getByRole('checkbox', { name: 'Задача' })
    checkbox.focus()
    expect(checkbox).toHaveFocus()

    fireEvent.keyDown(checkbox, { key: 'Escape', code: 'Escape' })

    expect(checkbox).not.toHaveFocus()
    expect(actions.clearSearch).not.toHaveBeenCalled()
  })

  it('Esc from a button inside a row counts as the row, not as "nothing open"', () => {
    const actions = setup()
    const inRow = screen.getByRole('button', { name: 'Внутри строки' })

    fireEvent.keyDown(inRow, { key: 'Escape', code: 'Escape' })

    expect(actions.clearSearch).not.toHaveBeenCalled()
  })

  it('matches letters by physical key, so a Cyrillic layout still works', () => {
    const actions = setup()

    // The same physical key as `N`, typed on a Russian layout.
    fireEvent.keyDown(document.body, { key: 'т', code: 'KeyN' })

    expect(actions.newTask).toHaveBeenCalledTimes(1)
  })
})

describe('useGlobalShortcuts — the three gates (issue point 2)', () => {
  it('stays silent while the caret is in a text field', () => {
    const actions = setup()
    const search = screen.getByRole('searchbox', { name: 'Поиск задач' })
    search.focus()

    fireEvent.keyDown(search, { key: 'n', code: 'KeyN' })
    fireEvent.keyDown(search, { key: '/', code: 'Slash' })
    fireEvent.keyDown(search, { key: '1', code: 'Digit1' })
    fireEvent.keyDown(search, { key: '?', code: 'Slash', shiftKey: true })
    fireEvent.keyDown(search, { key: 'z', code: 'KeyZ', ctrlKey: true })

    expect(actions.newTask).not.toHaveBeenCalled()
    expect(actions.focusSearch).not.toHaveBeenCalled()
    expect(actions.setFilter).not.toHaveBeenCalled()
    expect(actions.openShortcuts).not.toHaveBeenCalled()
    expect(actions.restoreRemoved).not.toHaveBeenCalled()
  })

  it('stays silent while the caret is in a textarea', () => {
    const actions = setup()
    const textarea = screen.getByRole('textbox', { name: 'Текст новой задачи' })

    fireEvent.keyDown(textarea, { key: 'n', code: 'KeyN' })
    fireEvent.keyDown(textarea, { key: '1', code: 'Digit1' })

    expect(actions.newTask).not.toHaveBeenCalled()
    expect(actions.setFilter).not.toHaveBeenCalled()
  })

  it('Esc survives the text-entry gate — that is how it clears the search from inside it', () => {
    const actions = setup()
    const search = screen.getByRole('searchbox', { name: 'Поиск задач' })

    fireEvent.keyDown(search, { key: 'Escape', code: 'Escape' })

    expect(actions.clearSearch).toHaveBeenCalledTimes(1)
  })

  it('a row checkbox is not a text field: shortcuts keep working on a focused row', () => {
    const actions = setup()
    const checkbox = screen.getByRole('checkbox', { name: 'Задача' })

    fireEvent.keyDown(checkbox, { key: 'n', code: 'KeyN' })

    expect(actions.newTask).toHaveBeenCalledTimes(1)
  })

  it('stays silent while any dismissable layer is open', () => {
    const actions = setup()
    openLayer()

    fireEvent.keyDown(document.body, { key: 'n', code: 'KeyN' })
    fireEvent.keyDown(document.body, { key: '/', code: 'Slash' })
    fireEvent.keyDown(document.body, { key: '?', code: 'Slash', shiftKey: true })
    fireEvent.keyDown(document.body, { key: '1', code: 'Digit1' })

    expect(actions.newTask).not.toHaveBeenCalled()
    expect(actions.focusSearch).not.toHaveBeenCalled()
    expect(actions.openShortcuts).not.toHaveBeenCalled()
    expect(actions.setFilter).not.toHaveBeenCalled()
  })

  it('leaves a key a component already claimed alone', () => {
    const actions = setup()
    const owner = screen.getByRole('button', { name: 'Свой обработчик' })

    fireEvent.keyDown(owner, { key: 'Escape', code: 'Escape' })

    expect(actions.clearSearch).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount', () => {
    const actions = makeActions()
    const { unmount } = render(<Harness actions={actions} />)

    unmount()
    fireEvent.keyDown(document.body, { key: 'n', code: 'KeyN' })

    expect(actions.newTask).not.toHaveBeenCalled()
  })
})
