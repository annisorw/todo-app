import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { ThemeProvider } from '../../state/ThemeProvider'
import { TASKS_SCHEMA_VERSION, TASKS_STORAGE_KEY } from '../../storage/taskStorage'
import type { Task } from '../../domain/task'
import { makeTasks } from '../../test/factories'
import { stubMatchMedia } from '../../test/matchMedia'

/** jsdom has no `IntersectionObserver`; `useStickyBand` only needs these three. */
class StubIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}

function renderApp(tasks: Task[] = []) {
  if (tasks.length > 0) {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify({ version: TASKS_SCHEMA_VERSION, tasks }))
  }
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  )
}

/** What a Tab stop is called, for comparing a whole sequence at once. */
function stopName(element: Element): string {
  const label = element.getAttribute('aria-label')
  if (label !== null) return label
  if (element instanceof HTMLInputElement) {
    const labelled = element.labels?.[0]?.textContent
    if (labelled != null && labelled !== '') return labelled
  }
  return element.textContent ?? ''
}

async function tabSequence(user: ReturnType<typeof userEvent.setup>, steps: number): Promise<string[]> {
  const seen: string[] = []
  for (let i = 0; i < steps; i += 1) {
    await user.tab()
    const active = document.activeElement
    if (active === null || active === document.body) break
    seen.push(stopName(active))
  }
  return seen
}

/**
 * The spec's keyboard contract end to end, on the real screen: the global
 * keys of 6.3 wired to real components, the Tab order of section 7, and
 * acceptance criterion 32's two-level `Esc`.
 *
 * Desktop throughout (`stubMatchMedia(true)`): the inline `TaskEditor` and
 * the row's quick-path chips are the desktop layout, and the keyboard is a
 * desktop concern to begin with.
 */
describe('keyboard flow (design-spec 6.3 / section 7)', () => {
  beforeEach(() => {
    localStorage.clear()
    stubMatchMedia(true)
    vi.stubGlobal('IntersectionObserver', StubIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Tab order (section 7, issue point 3)', () => {
    it('runs header -> Composer -> поиск -> сегменты -> список', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(3))

      // `Fab` is mobile-only through `sm:hidden`; jsdom applies no CSS, so it
      // is still focusable here while a real browser has it `display: none`.
      const order = (await tabSequence(user, 16)).filter((name) => name !== 'Добавить задачу')

      expect(order).toEqual([
        'Горячие клавиши',
        'Светлая тема',
        'Текст новой задачи',
        'Приоритет',
        'Срок',
        'Добавить задачу в список',
        'Поиск задач',
        'Все 3',
        'Переместить задачу: Задача 1',
        'Задача 1',
        'Приоритет',
        'Срок',
        'Изменить задачу: Задача 1',
        'Действия с задачей: Задача 1',
      ])
    })

    it('the filter segments are one stop, and a zero count does not drop out of it (criterion 33)', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(2))

      const order = await tabSequence(user, 9)

      // «Активные 2» and «Готовые 0» are reachable with ←/→ inside the group,
      // never by Tab — including the empty one.
      expect(order.filter((name) => name.startsWith('Активные'))).toEqual([])
      expect(order.filter((name) => name.startsWith('Готовые'))).toEqual([])
      expect(screen.getByRole('tab', { name: 'Готовые 0' })).not.toBeDisabled()
      expect(screen.getByRole('tab', { name: 'Готовые 0' })).not.toHaveAttribute('aria-disabled')
    })

    it('stays one stop on 20 tasks', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(20))

      const activeAnchors = screen
        .getAllByRole('checkbox')
        .filter((checkbox) => checkbox.getAttribute('tabindex') === '0')
      expect(activeAnchors).toHaveLength(1)

      // Eight stops is header (2) + composer (4) + search + segments; the
      // list starts right after and ends after one row's controls, whatever
      // the row count.
      const order = await tabSequence(user, 40)
      const rowStops = order.filter((name) => /Задача \d+$|задачу: Задача|задачей: Задача/.test(name))
      expect(rowStops).toEqual([
        'Переместить задачу: Задача 1',
        'Задача 1',
        'Изменить задачу: Задача 1',
        'Действия с задачей: Задача 1',
      ])
    })
  })

  describe('the global keys, wired to the real screen', () => {
    it('/ puts the caret in the search field', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(1))

      await user.keyboard('/')

      expect(screen.getByRole('searchbox', { name: 'Поиск задач' })).toHaveFocus()
    })

    it('N puts the caret in the new-task field', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(1))

      await user.keyboard('n')

      expect(screen.getByRole('textbox', { name: 'Текст новой задачи' })).toHaveFocus()
    })

    it('1 2 3 switch the filter', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(2))

      await user.keyboard('2')
      expect(screen.getByRole('tab', { name: /Активные/ })).toHaveAttribute('aria-selected', 'true')

      await user.keyboard('3')
      expect(screen.getByRole('tab', { name: /Готовые/ })).toHaveAttribute('aria-selected', 'true')

      await user.keyboard('1')
      expect(screen.getByRole('tab', { name: /Все/ })).toHaveAttribute('aria-selected', 'true')
    })

    /**
     * Asserted on the dialog itself, not on `aria-expanded` on the trigger:
     * `ShortcutsSheet` (FELA-19) is a real modal, and a dialog's trigger
     * carries no `aria-expanded` — that attribute belongs to a disclosure.
     */
    it('? opens the shortcuts dialog', async () => {
      const user = userEvent.setup()
      renderApp()

      await user.keyboard('?')

      expect(screen.getByRole('dialog', { name: 'Горячие клавиши' })).toBeInTheDocument()
    })

    it('Esc clears the search without leaving the field', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(2))

      await user.keyboard('/')
      await user.keyboard('Задача 2')
      const search = screen.getByRole('searchbox', { name: 'Поиск задач' })
      expect(search).toHaveValue('Задача 2')

      await user.keyboard('{Escape}')

      expect(search).toHaveValue('')
    })

    it('typing into the search field does not fire letter shortcuts', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(2))

      await user.keyboard('/')
      await user.keyboard('n1')

      expect(screen.getByRole('searchbox', { name: 'Поиск задач' })).toHaveValue('n1')
      expect(screen.getByRole('tab', { name: /Все/ })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('textbox', { name: 'Текст новой задачи' })).not.toHaveFocus()
    })

    it('Ctrl+Z restores the last removed task through the same action as the toast', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(3))

      const row = screen.getByRole('checkbox', { name: /Задача 2/ })
      row.focus()
      await user.keyboard('{Delete}')
      expect(screen.getByRole('alert')).toHaveTextContent('Задача удалена: «Задача 2»')

      await user.keyboard('{Control>}z{/Control}')

      // Back in its old slot, not appended at the end (design-spec S7).
      const titles = screen
        .getAllByRole('listitem')
        .map((item) => item.querySelector('p')?.textContent)
        .filter((title): title is string => title != null)
      expect(titles).toEqual(['Задача 1', 'Задача 2', 'Задача 3'])
      expect(screen.getByRole('status')).toHaveTextContent('Задача возвращена: «Задача 2»')
    })

    it('Ctrl+Z stops working after the next change to the list', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(2))

      const row = screen.getByRole('checkbox', { name: /Задача 1/ })
      row.focus()
      await user.keyboard('{Delete}')

      // Any other list change clears the undo slot (architecture section 4).
      await user.click(screen.getByRole('checkbox', { name: /Задача 2/ }))
      await user.keyboard('{Control>}z{/Control}')

      // Asserted through the live region, not the row's absence: the removed
      // row keeps rendering through a `task-delete` exit animation jsdom
      // never finishes, so «не вернулась» has to be read off the
      // announcement the restore would have made.
      expect(screen.getByRole('status')).not.toHaveTextContent('Задача возвращена')
    })
  })

  describe('editing from the keyboard (acceptance criterion 32)', () => {
    it('E opens the editor with the caret in the text', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(2))

      screen.getByRole('checkbox', { name: /Задача 2/ }).focus()
      await user.keyboard('e')

      const textarea = screen.getByRole('textbox', { name: 'Текст задачи' })
      expect(textarea).toHaveFocus()
      expect(textarea).toHaveValue('Задача 2')
    })

    it('Tab never leaves the open editor', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(2))

      screen.getByRole('checkbox', { name: /Задача 1/ }).focus()
      await user.keyboard('e')

      const order = await tabSequence(user, 5)

      expect(order).toEqual(['Приоритет', 'Срок', 'Сохранить', 'Отмена', 'Текст задачи'])
    })

    it('first Esc closes the popup, second closes the editor, focus lands back on the row', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(2))

      const row = screen.getByRole('checkbox', { name: /Задача 1/ })
      row.focus()
      await user.keyboard('e')

      const editor = screen.getByRole('textbox', { name: 'Текст задачи' }).closest('div')
      await user.click(within(editor as HTMLElement).getByRole('button', { name: /Приоритет/ }))
      expect(screen.getByRole('menu')).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Текст задачи' })).toBeInTheDocument()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('textbox', { name: 'Текст задачи' })).not.toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: /Задача 1/ })).toHaveFocus()
    })

    it('Enter in the textarea saves; the global keys stay quiet while typing there', async () => {
      const user = userEvent.setup()
      renderApp(makeTasks(1))

      screen.getByRole('checkbox', { name: /Задача 1/ }).focus()
      await user.keyboard('e')
      await user.type(screen.getByRole('textbox', { name: 'Текст задачи' }), ' n1')

      // `n` and `1` landed in the text instead of opening the composer and
      // switching the filter.
      expect(screen.getByRole('textbox', { name: 'Текст задачи' })).toHaveValue('Задача 1 n1')
      expect(screen.getByRole('tab', { name: /Все/ })).toHaveAttribute('aria-selected', 'true')

      await user.keyboard('{Enter}')

      expect(screen.queryByRole('textbox', { name: 'Текст задачи' })).not.toBeInTheDocument()
      expect(screen.getByText('Задача 1 n1')).toBeInTheDocument()
    })
  })
})
