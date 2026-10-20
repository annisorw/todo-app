import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { announce } from '../lib/announce'
import { LiveRegion } from './LiveRegion'

describe('LiveRegion', () => {
  it('re-announces the same message sent twice in a row', async () => {
    render(<LiveRegion />)

    act(() => announce('Задача выполнена'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Задача выполнена'))

    act(() => announce('Задача выполнена'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(''))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Задача выполнена'))
  })

  it('announces distinct messages immediately, one after another', () => {
    render(<LiveRegion />)

    act(() => announce('Тема: светлая'))
    expect(screen.getByRole('status')).toHaveTextContent('Тема: светлая')

    act(() => announce('Тема: тёмная'))
    expect(screen.getByRole('status')).toHaveTextContent('Тема: тёмная')
  })
})
