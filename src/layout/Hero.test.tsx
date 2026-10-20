import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Hero } from './Hero'

/**
 * Design spec v1.3, section 3.1: `main`'s vertical padding is `AppShell`'s
 * job, not `Hero`'s — otherwise every block mounted in `main` starts
 * guessing its own top gap. Guards against the padding creeping back here.
 */
describe('Hero', () => {
  it('carries no vertical padding of its own', () => {
    render(<Hero summary="Сводка" />)

    const section = screen.getByText('Сводка').closest('section') as HTMLElement

    expect(section.className).not.toMatch(/\bpy-/)
  })
})
