import { render, screen, within } from '@testing-library/react'
import { act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { LiveRegion } from '../../components/LiveRegion'
import { MAX_TITLE_LENGTH, TITLE_COUNTER_THRESHOLD } from '../../domain/limits'
import { TaskStoreProvider } from '../../state/TaskStoreProvider'
import { useTaskStore } from '../../state/useTaskStore'
import { stubMatchMedia } from '../../test/matchMedia'
import { Composer } from './Composer'
import type { ComposerHandle } from './Composer'

function TaskTitles() {
  const { tasks } = useTaskStore()
  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  )
}

function renderComposer() {
  return render(
    <TaskStoreProvider>
      <Composer />
      <LiveRegion />
      <TaskTitles />
    </TaskStoreProvider>,
  )
}

describe('Composer', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
  })

  it('adds a task on Enter, keeps focus in the field, and resets the priority/due-date chips', async () => {
    const user = userEvent.setup()
    renderComposer()

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)
    await user.type(field, 'Высокий приоритет')

    await user.click(screen.getByRole('button', { name: 'Приоритет' }))
    await user.click(screen.getByRole('menuitem', { name: /Высокий/ }))
    await user.click(screen.getByRole('button', { name: 'Срок' }))
    await user.click(screen.getByRole('button', { name: 'Сегодня' }))

    await user.type(field, '{Enter}')

    expect(screen.getByText('Высокий приоритет')).toBeInTheDocument()
    expect(field).toHaveFocus()
    expect(field).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Приоритет' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Срок' })).toBeInTheDocument()
  })

  it('Shift+Enter inserts a newline instead of submitting', async () => {
    const user = userEvent.setup()
    renderComposer()

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)
    await user.keyboard('первая строка{Shift>}{Enter}{/Shift}вторая строка')

    expect(field).toHaveValue('первая строка\nвторая строка')
    expect(screen.queryByText('первая строка')).not.toBeInTheDocument()
  })

  it('Esc clears the field without submitting', async () => {
    const user = userEvent.setup()
    renderComposer()

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)
    await user.keyboard('черновик{Escape}')

    expect(field).toHaveValue('')
  })

  it('does not create a task from a whitespace-only string', async () => {
    const user = userEvent.setup()
    renderComposer()

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)
    await user.keyboard('   {Enter}')

    expect(screen.getByRole('alert')).toHaveTextContent('Введите текст задачи.')
    expect(field).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows the counter only from the 450th character, not before', () => {
    renderComposer()
    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })

    fireEvent.change(field, { target: { value: 'a'.repeat(TITLE_COUNTER_THRESHOLD - 1) } })
    expect(screen.queryByText(new RegExp(`/${String(MAX_TITLE_LENGTH)}$`))).not.toBeInTheDocument()

    fireEvent.change(field, { target: { value: 'a'.repeat(TITLE_COUNTER_THRESHOLD) } })
    expect(screen.getByText(`${String(TITLE_COUNTER_THRESHOLD)}/${String(MAX_TITLE_LENGTH)}`)).toBeInTheDocument()
  })

  it('rejects a title over the limit, shows an error, and does not add the task', () => {
    renderComposer()
    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })

    fireEvent.change(field, { target: { value: 'a'.repeat(MAX_TITLE_LENGTH + 1) } })
    fireEvent.keyDown(field, { key: 'Enter' })

    expect(screen.getByRole('alert')).toHaveTextContent(String(MAX_TITLE_LENGTH))
    expect(field).toHaveAttribute('maxlength', String(MAX_TITLE_LENGTH))
  })

  it('keeps `<`, `>`, `&` as literal text — never markup — in an added task', async () => {
    const user = userEvent.setup()
    renderComposer()

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)
    await user.type(field, '<b>жирный</b>{Enter}')

    const item = screen.getByText('<b>жирный</b>')
    expect(item.tagName).toBe('LI')
    expect(item.querySelector('b')).toBeNull()
  })

  it('tab order inside the panel is field -> priority -> due date -> "+"', async () => {
    const user = userEvent.setup()
    renderComposer()

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    field.focus()
    expect(field).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Приоритет' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Срок' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Добавить задачу в список' })).toHaveFocus()
  })

  it('still shows a focus indicator on desktop when the field is focused and in error (acceptance criterion 24)', async () => {
    const user = userEvent.setup()
    const { container } = renderComposer()

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)
    await user.keyboard('{Enter}')

    expect(screen.getByRole('alert')).toHaveTextContent('Введите текст задачи.')
    expect(field).toHaveFocus()

    const panel = container.querySelector('[class*="radius-xl"]')
    expect(panel).not.toBeNull()
    // The border is busy showing validity (`border-danger`); the glow is the
    // only thing left to show focus, so it must not be suppressed by the error.
    expect(panel).toHaveClass('border-danger', 'shadow-glow-accent')
  })

  it('on mobile, the Fab opens a bottom sheet with the same form, autofocused', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.click(screen.getByRole('button', { name: 'Добавить задачу' }))

    const dialog = screen.getByRole('dialog', { name: 'Добавить задачу' })
    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })
    expect(field).toHaveFocus()

    await user.type(field, 'Из шторки{Enter}')
    expect(screen.getByText('Из шторки')).toBeInTheDocument()
  })

  it('still shows a focus indicator in the sheet when the field is focused and in error (acceptance criterion 24)', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.click(screen.getByRole('button', { name: 'Добавить задачу' }))
    const dialog = screen.getByRole('dialog', { name: 'Добавить задачу' })
    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })
    expect(field).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Введите текст задачи.')
    expect(field).toHaveFocus()

    const fieldBox = field.closest('[class*="radius-md"]')
    expect(fieldBox).not.toBeNull()
    expect(fieldBox).toHaveClass('border-danger', 'shadow-glow-accent')
  })
})

/**
 * design-spec S2 — the `first-run` `EmptyState`'s "Добавить первую задачу"
 * action calls this handle, same as the `N` shortcut (FELA-20). Desktop has
 * a visible field to focus directly; mobile doesn't (it's `Fab` + a sheet),
 * so there `requestNewTask()` opens the sheet instead, which autofocuses
 * its own field already (no further wiring needed there).
 */
describe('Composer imperative handle', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('desktop: focuses the panel field directly', () => {
    stubMatchMedia(true)
    const ref = createRef<ComposerHandle>()
    render(
      <TaskStoreProvider>
        <Composer ref={ref} />
      </TaskStoreProvider>,
    )

    act(() => {
      ref.current?.requestNewTask()
    })

    expect(screen.getByRole('textbox', { name: 'Текст новой задачи' })).toHaveFocus()
  })

  it('mobile: opens the sheet instead of focusing the (hidden) panel field', () => {
    stubMatchMedia(false)
    const ref = createRef<ComposerHandle>()
    render(
      <TaskStoreProvider>
        <Composer ref={ref} />
      </TaskStoreProvider>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    act(() => {
      ref.current?.requestNewTask()
    })

    expect(screen.getByRole('dialog', { name: 'Добавить задачу' })).toBeInTheDocument()
  })
})

/**
 * Acceptance criterion 32 on real components, not on a harness: the sheet is a
 * `role="dialog"` layer and the priority popover opens inside it, so this is
 * the first genuine pair of stacked layers in the app. `useDismissable.test.tsx`
 * proves the stack; this proves the components are actually wired to it.
 */
describe('Composer sheet + chip popover — two stacked Esc layers', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
  })

  async function openSheet(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Добавить задачу' }))
    return screen.getByRole('dialog', { name: 'Добавить задачу' })
  }

  it('the first Esc closes the popover and returns focus to its chip, the second closes the sheet', async () => {
    const user = userEvent.setup()
    renderComposer()

    const dialog = await openSheet(user)
    const chip = within(dialog).getByRole('button', { name: 'Приоритет' })
    await user.click(chip)
    expect(within(dialog).getByRole('menu')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(within(dialog).queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Добавить задачу' })).toBeInTheDocument()
    expect(chip).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Добавить задачу' })).not.toBeInTheDocument()
  })

  it('returns focus to the Fab when Esc closes the sheet', async () => {
    const user = userEvent.setup()
    renderComposer()

    const fab = screen.getByRole('button', { name: 'Добавить задачу' })
    await user.click(fab)
    expect(screen.getByRole('dialog', { name: 'Добавить задачу' })).toBeInTheDocument()

    await user.keyboard('{Escape}')

    // Focus was inside the unmounted panel. Without the handoff it lands on
    // `<body>` and the next Tab restarts the page from the top.
    expect(fab).toHaveFocus()
  })

  it('does not close the sheet underneath while a popover is open', async () => {
    const user = userEvent.setup()
    renderComposer()

    const dialog = await openSheet(user)
    await user.click(within(dialog).getByRole('button', { name: 'Срок' }))

    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'Добавить задачу' })).toBeInTheDocument()
  })

  it('gives Esc to the sheet, not to the textarea that clears the draft', async () => {
    const user = userEvent.setup()
    renderComposer()

    const dialog = await openSheet(user)
    await user.type(within(dialog).getByRole('textbox', { name: 'Текст новой задачи' }), 'черновик')

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog', { name: 'Добавить задачу' })).not.toBeInTheDocument()
    // Esc belongs to the top layer alone, so the field's own Esc (clear the
    // draft) never runs — reopening the sheet still shows the text.
    await openSheet(user)
    expect(screen.getByRole('dialog', { name: 'Добавить задачу' })).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Текст новой задачи' })).toHaveValue('черновик')
  })

  it('an outside click closes the popover without moving focus', async () => {
    const user = userEvent.setup()
    renderComposer()

    const dialog = await openSheet(user)
    const chip = within(dialog).getByRole('button', { name: 'Приоритет' })
    await user.click(chip)
    expect(within(dialog).getByRole('menu')).toBeInTheDocument()

    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)

    expect(within(dialog).queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Добавить задачу' })).toBeInTheDocument()
    expect(field).toHaveFocus()
  })
})

/**
 * FELA-103 (decision on FELA-94): the one-slot clear/undo button in
 * `ComposerSheet`. Geometry (44x44, 50px row, 280px textarea) is measured in
 * a real browser against built `dist`, not here — jsdom has no layout.
 */
describe('Composer sheet — clear/undo field button', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
  })

  async function openSheet(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Добавить задачу' }))
    return screen.getByRole('dialog', { name: 'Добавить задачу' })
  }

  it('reserves the slot invisibly, out of the tab order and the accessibility tree, while there is nothing to clear or restore', async () => {
    const user = userEvent.setup()
    renderComposer()
    const dialog = await openSheet(user)

    expect(within(dialog).queryByRole('button', { name: 'Очистить поле' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Вернуть текст' })).not.toBeInTheDocument()
  })

  it('keeps focus and the mobile keyboard in the field when clearing (acceptance criterion 5)', async () => {
    const user = userEvent.setup()
    renderComposer()
    const dialog = await openSheet(user)

    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })
    await user.type(field, 'черновик')
    await user.click(within(dialog).getByRole('button', { name: 'Очистить поле' }))

    expect(field).toHaveValue('')
    // `document.activeElement` is the same textarea — proof the click never blurred it.
    expect(field).toHaveFocus()
  })

  it('clearing removes only the text and leaves priority/due date untouched', async () => {
    const user = userEvent.setup()
    renderComposer()
    const dialog = await openSheet(user)

    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })
    await user.type(field, 'черновик')
    await user.click(within(dialog).getByRole('button', { name: 'Приоритет' }))
    await user.click(within(dialog).getByRole('menuitem', { name: /Высокий/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Срок' }))
    await user.click(within(dialog).getByRole('button', { name: 'Сегодня' }))

    await user.click(within(dialog).getByRole('button', { name: 'Очистить поле' }))

    expect(field).toHaveValue('')
    expect(within(dialog).getByRole('button', { name: /Высокий/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Сегодня/ })).toBeInTheDocument()
  })

  it('offers undo right after clearing and restores the text with the caret at the end', async () => {
    const user = userEvent.setup()
    renderComposer()
    const dialog = await openSheet(user)
    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' }) as HTMLTextAreaElement

    await user.type(field, 'черновик')
    await user.click(within(dialog).getByRole('button', { name: 'Очистить поле' }))
    expect(within(dialog).queryByRole('button', { name: 'Очистить поле' })).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Вернуть текст' }))

    expect(field).toHaveValue('черновик')
    expect(field.selectionStart).toBe('черновик'.length)
    expect(field.selectionEnd).toBe('черновик'.length)
    // Text is back, so the slot is already showing "clear" again, not "undo".
    expect(within(dialog).getByRole('button', { name: 'Очистить поле' })).toBeInTheDocument()
  })

  it('drops the ability to undo once any character is typed after clearing (acceptance criterion 8)', async () => {
    const user = userEvent.setup()
    renderComposer()
    const dialog = await openSheet(user)
    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })

    await user.type(field, 'original')
    await user.click(within(dialog).getByRole('button', { name: 'Очистить поле' }))
    await user.type(field, 'x')
    expect(within(dialog).queryByRole('button', { name: 'Вернуть текст' })).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Очистить поле' }))
    await user.click(within(dialog).getByRole('button', { name: 'Вернуть текст' }))

    // Restores "x" (the latest clear), not the original pre-clear draft.
    expect(field).toHaveValue('x')
  })

  it('announces clearing and restoring through the live region', async () => {
    const user = userEvent.setup()
    renderComposer()
    const dialog = await openSheet(user)
    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })

    await user.type(field, 'черновик')
    await user.click(within(dialog).getByRole('button', { name: 'Очистить поле' }))
    expect(screen.getByRole('status')).toHaveTextContent('Поле очищено')

    await user.click(within(dialog).getByRole('button', { name: 'Вернуть текст' }))
    expect(screen.getByRole('status')).toHaveTextContent('Текст возвращён')
  })

  it('does not add the button to the desktop panel', () => {
    renderComposer()
    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    fireEvent.change(field, { target: { value: 'черновик' } })

    expect(screen.queryByRole('button', { name: 'Очистить поле' })).not.toBeInTheDocument()
  })
})
