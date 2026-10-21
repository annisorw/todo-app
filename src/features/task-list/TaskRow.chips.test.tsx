import type { ComponentProps } from 'react'
import { render, screen, within } from '@testing-library/react'
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

describe('TaskRow empty-chip visibility (design-spec 3.12-3.13)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function quickPathScope(container: HTMLElement) {
    return within(container.querySelector('.flex-wrap') as HTMLElement)
  }

  it('mobile: draws no static chip at all for priority=none/dueDate=null', () => {
    stubMatchMedia(false)
    const { container } = renderRow({ task: makeTask({ priority: 'none', dueDate: null }) })
    const quickPath = quickPathScope(container)
    expect(quickPath.queryByText('Приоритет')).toBeNull()
    expect(quickPath.queryByText('Срок')).toBeNull()
  })

  it('mobile: still draws the real-value chips, unaffected by the none fix', () => {
    stubMatchMedia(false)
    const { container } = renderRow({ task: makeTask({ priority: 'high', dueDate: '2026-10-22' }) })
    const quickPath = quickPathScope(container)
    expect(quickPath.getByText('Высокий')).toBeTruthy()
    expect(quickPath.getByText('Завтра')).toBeTruthy()
  })

  it('desktop: the priority quick path keeps its empty placeholder always visible (no hover gating per 3.12)', () => {
    stubMatchMedia(true)
    const { container } = renderRow({ task: makeTask({ priority: 'none', dueDate: null }) })
    const trigger = quickPathScope(container).getByText('Приоритет')
    expect(trigger.closest('button')?.parentElement?.className).not.toContain('opacity-0')
  })

  it('desktop: the due-date quick path hides its empty placeholder until hover/focus-within (3.13)', () => {
    stubMatchMedia(true)
    const { container } = renderRow({ task: makeTask({ priority: 'none', dueDate: null }) })
    const trigger = quickPathScope(container).getByText('Срок')
    const wrapper = trigger.closest('button')?.parentElement?.parentElement
    expect(wrapper?.className).toContain('opacity-0')
    expect(wrapper?.className).toContain('group-hover:opacity-100')
    expect(wrapper?.className).toContain('group-focus-within:opacity-100')
  })

  it('desktop: a real due date never gets hover-gated', () => {
    stubMatchMedia(true)
    const { container } = renderRow({ task: makeTask({ priority: 'none', dueDate: '2026-10-22' }) })
    const trigger = quickPathScope(container).getByText('Завтра')
    const wrapper = trigger.closest('button')?.parentElement?.parentElement
    expect(wrapper?.className ?? '').not.toContain('opacity-0')
  })
})

/**
 * Acceptance criterion 31: on mobile the row's priority/due-date chips are
 * display only — not clickable, not focusable, checked in the DOM rather than
 * by eye. `PriorityChip.test.tsx`/`DueDateChip.test.tsx` already prove the
 * `static` variant itself is inert; what is missing without this test is the
 * link to `TaskRow` — that its mobile (`!isDesktop`) branch actually renders
 * the real-value chip through that inert variant, not the interactive one.
 */
describe('TaskRow mobile chips are display-only (acceptance criterion 31)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders neither chip as a button or tab stop — only as inert text', () => {
    stubMatchMedia(false)

    const { container } = render(
      <ul>
        <TaskRow
          task={makeTask({ id: 't1', title: 'Купить молоко', priority: 'high', dueDate: '2026-10-22' })}
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
        />
      </ul>,
    )

    expect(screen.queryByRole('button', { name: /Высокий/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Завтра/ })).not.toBeInTheDocument()

    // Scoped to the visible quick-path row: the title text also lives in a
    // hidden `sr-only` duplicate chip that composes the checkbox's accessible
    // name (criterion 25), and `getByText` is ambiguous between the two.
    const quickPath = within(container.querySelector('.flex-wrap') as HTMLElement)
    const priorityChip = quickPath.getByText('Высокий')
    const dueDateChip = quickPath.getByText('Завтра')
    expect(priorityChip.tagName).toBe('SPAN')
    expect(dueDateChip.tagName).toBe('SPAN')
    expect(priorityChip).not.toHaveAttribute('tabindex')
    expect(dueDateChip).not.toHaveAttribute('tabindex')
  })
})
