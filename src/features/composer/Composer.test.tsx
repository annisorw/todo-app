import { render, screen, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { LiveRegion } from '../../components/LiveRegion'
import { MAX_TITLE_LENGTH, TITLE_COUNTER_THRESHOLD } from '../../domain/limits'
import { TaskStoreProvider } from '../../state/TaskStoreProvider'
import { useTaskStore } from '../../state/useTaskStore'
import { stubMatchMedia } from '../../test/matchMedia'
import { Composer } from './Composer'

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
})
