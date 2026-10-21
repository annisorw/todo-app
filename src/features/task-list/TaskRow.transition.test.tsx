import type { ComponentProps } from 'react'
import { createElement } from 'react'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTask } from '../../test/factories'
import { stubMatchMedia } from '../../test/matchMedia'
import { TaskRow } from './TaskRow'

const capturedLiProps: Array<Record<string, unknown>> = []

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>()
  return {
    ...actual,
    motion: {
      ...actual.motion,
      li: (props: Record<string, unknown>) => {
        capturedLiProps.push(props)
        const {
          children,
          exit: _exit,
          initial: _initial,
          animate: _animate,
          transition: _transition,
          layout: _layout,
          ...rest
        } = props
        return createElement(actual.motion.li, rest as never, children as never)
      },
    },
  }
})

function renderRow(overrides: Partial<ComponentProps<typeof TaskRow>> = {}) {
  capturedLiProps.length = 0
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

describe('TaskRow motion table (section 5): task-add vs task-delete timing', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('gives the exit its own 200ms/--ease-in-fast transition, distinct from the 320ms/--ease-out-soft enter', () => {
    stubMatchMedia(false)
    renderRow()

    const props = capturedLiProps[0]
    expect(props).toBeDefined()
    // task-add (enter): 320ms / --ease-out-soft (motion table, section 5).
    expect(props!.transition).toEqual({ duration: 0.32, ease: [0.16, 1, 0.3, 1] })
    // task-delete (exit): 200ms / --ease-in-fast — must live on `exit` itself,
    // because framer-motion falls back to the component `transition` prop
    // above when `exit` carries none.
    expect((props!.exit as Record<string, unknown>).transition).toEqual({
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    })
  })

  it('leaves prefers-reduced-motion exit as opacity-only with no per-exit transition override', () => {
    stubMatchMedia(true)
    renderRow()

    const props = capturedLiProps[0]
    expect(props).toBeDefined()
    expect(props!.exit).toEqual({ opacity: 0 })
    expect(props!.transition).toEqual({ duration: 0.12 })
  })
})
