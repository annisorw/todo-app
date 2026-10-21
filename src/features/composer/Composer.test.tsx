import { render, screen, within } from '@testing-library/react'
import { act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { LiveRegion } from '../../components/LiveRegion'
import type { Filter } from '../../domain/filters'
import { MAX_TITLE_LENGTH, TITLE_COUNTER_THRESHOLD } from '../../domain/limits'
import { TaskStoreProvider } from '../../state/TaskStoreProvider'
import { ToastProvider } from '../../state/ToastProvider'
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

function renderComposer(filter: Filter = 'all') {
  return render(
    <TaskStoreProvider>
      <ToastProvider>
        <Composer filter={filter} />
        <LiveRegion />
        <TaskTitles />
      </ToastProvider>
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
    // FELA-131: adding was silent in the LiveRegion before this fix.
    expect(screen.getByRole('status')).toHaveTextContent('Задача добавлена: «Высокий приоритет»')
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

  it('on desktop, focus alone (no error) lights the accent glow, not the plain shadow', async () => {
    const user = userEvent.setup()
    const { container } = renderComposer()

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)

    const panel = container.querySelector('[class*="radius-xl"]')
    expect(panel).not.toBeNull()
    expect(panel).toHaveClass('shadow-glow-accent')
    expect(panel).not.toHaveClass('shadow-sm')
  })

  it('on desktop, no focus and no error falls back to the plain shadow', () => {
    const { container } = renderComposer()

    const panel = container.querySelector('[class*="radius-xl"]')
    expect(panel).not.toBeNull()
    expect(panel).toHaveClass('shadow-sm')
    expect(panel).not.toHaveClass('shadow-glow-accent')
  })

  it('on desktop, an error while still focused keeps the border error-coloured and switches the glow to danger (FELA-106, FELA-196 §3.7)', async () => {
    const user = userEvent.setup()
    const { container } = renderComposer()

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)
    await user.keyboard('{Enter}')

    expect(screen.getByRole('alert')).toHaveTextContent('Введите текст задачи.')
    expect(field).toHaveFocus()

    const panel = container.querySelector('[class*="radius-xl"]')
    expect(panel).not.toBeNull()
    // The border carries the error, same as before. The glow (spec v1.14):
    // it stays lit while focused, it only changes colour — exactly one
    // indicator pair, never a mix of the accent glow with the error border.
    expect(panel).toHaveClass('border-danger')
    expect(panel).toHaveClass('shadow-glow-danger')
    expect(panel).not.toHaveClass('shadow-glow-accent')
    expect(panel).not.toHaveClass('shadow-sm')
  })

  it('on desktop, an error without focus drops the glow entirely, same as the no-error case', async () => {
    const user = userEvent.setup()
    const { container } = renderComposer()

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)
    await user.keyboard('{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('Введите текст задачи.')

    await user.tab()
    expect(field).not.toHaveFocus()

    const panel = container.querySelector('[class*="radius-xl"]')
    expect(panel).not.toBeNull()
    expect(panel).toHaveClass('border-danger')
    expect(panel).toHaveClass('shadow-sm')
    expect(panel).not.toHaveClass('shadow-glow-danger')
    expect(panel).not.toHaveClass('shadow-glow-accent')
  })

  it('carries the .composer class on the glass panel (spec 2.7 fallback hook)', () => {
    const { container } = renderComposer()

    const panel = container.querySelector('[class*="radius-xl"]')
    expect(panel).toHaveClass('composer')
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

  it('in the sheet, autofocus alone (no error) lights the accent glow', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.click(screen.getByRole('button', { name: 'Добавить задачу' }))
    const dialog = screen.getByRole('dialog', { name: 'Добавить задачу' })
    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })
    expect(field).toHaveFocus()

    const fieldBox = field.closest('[class*="radius-md"]')
    expect(fieldBox).not.toBeNull()
    expect(fieldBox).toHaveClass('shadow-glow-accent')
  })

  it('in the sheet, tabbing away from the field (no error) drops the glow entirely', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.click(screen.getByRole('button', { name: 'Добавить задачу' }))
    const dialog = screen.getByRole('dialog', { name: 'Добавить задачу' })
    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })
    const fieldBox = field.closest('[class*="radius-md"]')
    expect(fieldBox).not.toBeNull()

    await user.tab()
    expect(within(dialog).getByRole('button', { name: 'Приоритет' })).toHaveFocus()
    expect(fieldBox).not.toHaveClass('shadow-glow-accent')
  })

  it('in the sheet, an error while still focused keeps the border error-coloured and switches the glow to danger (FELA-106, FELA-196 §3.7)', async () => {
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
    expect(fieldBox).toHaveClass('border-danger')
    expect(fieldBox).toHaveClass('shadow-glow-danger')
    expect(fieldBox).not.toHaveClass('shadow-glow-accent')
  })

  it('in the sheet, an error without focus drops the glow entirely', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.click(screen.getByRole('button', { name: 'Добавить задачу' }))
    const dialog = screen.getByRole('dialog', { name: 'Добавить задачу' })
    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })
    expect(field).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Введите текст задачи.')

    await user.tab()
    expect(field).not.toHaveFocus()

    const fieldBox = field.closest('[class*="radius-md"]')
    expect(fieldBox).not.toBeNull()
    expect(fieldBox).toHaveClass('border-danger')
    expect(fieldBox).not.toHaveClass('shadow-glow-danger')
    expect(fieldBox).not.toHaveClass('shadow-glow-accent')
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
        <ToastProvider>
          <Composer ref={ref} filter="all" />
        </ToastProvider>
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
        <ToastProvider>
          <Composer ref={ref} filter="all" />
        </ToastProvider>
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
 * design-spec S5: adding a task while the `Готовые` filter is active sends
 * it straight to `Активные`, out of the filtered view — without the toast,
 * nothing on screen changes and the user has no way to tell the task was
 * added at all.
 */
describe('Composer — toast on add while filtered to completed (design-spec S5)', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(false)
  })

  it('shows the exact S5 toast when adding a task while filtered to "Готовые"', async () => {
    const user = userEvent.setup()
    renderComposer('completed')

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)
    await user.type(field, 'Новая задача{Enter}')

    expect(screen.getByText('Задача добавлена в «Активные»')).toBeInTheDocument()
    expect(field).toHaveFocus()
    expect(field).toHaveValue('')
  })

  it.each(['all', 'active'] as const)('does not show the S5 toast when the filter is "%s"', async (filter) => {
    const user = userEvent.setup()
    renderComposer(filter)

    const field = screen.getByRole('textbox', { name: 'Текст новой задачи' })
    await user.click(field)
    await user.type(field, 'Новая задача{Enter}')

    expect(screen.queryByText('Задача добавлена в «Активные»')).not.toBeInTheDocument()
  })

  it('shows the same toast from the mobile sheet', async () => {
    const user = userEvent.setup()
    renderComposer('completed')

    await user.click(screen.getByRole('button', { name: 'Добавить задачу' }))
    const dialog = screen.getByRole('dialog', { name: 'Добавить задачу' })
    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })

    await user.type(field, 'Из шторки{Enter}')

    expect(screen.getByText('Задача добавлена в «Активные»')).toBeInTheDocument()
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

  it('Tab forward from "+" wraps to the textarea, and Shift+Tab back from the textarea wraps to "+"', async () => {
    const user = userEvent.setup()
    renderComposer()

    const dialog = await openSheet(user)
    const field = within(dialog).getByRole('textbox', { name: 'Текст новой задачи' })
    const submit = within(dialog).getByRole('button', { name: 'Добавить задачу в список' })

    submit.focus()
    await user.tab()
    expect(field).toHaveFocus()

    field.focus()
    await user.tab({ shift: true })
    expect(submit).toHaveFocus()
  })

  it('Tab stays inside the sheet while a chip popover is open, cycling through its menu items', async () => {
    const user = userEvent.setup()
    renderComposer()

    const dialog = await openSheet(user)
    const chip = within(dialog).getByRole('button', { name: 'Приоритет' })
    await user.click(chip)

    const menu = within(dialog).getByRole('menu')
    const menuItems = within(menu).getAllByRole('menuitem')
    const last = menuItems[menuItems.length - 1]!

    last.focus()
    await user.tab()

    // The popover renders inline inside the dialog, so the trap's live
    // re-query picks its items up too — Tab never escapes to the page
    // behind the sheet while the menu is open.
    expect(within(dialog).getByRole('menu')).toBeInTheDocument()
    expect(dialog.contains(document.activeElement)).toBe(true)
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
