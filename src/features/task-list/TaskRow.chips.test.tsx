import type { ComponentProps } from 'react'
import { render, within } from '@testing-library/react'
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
