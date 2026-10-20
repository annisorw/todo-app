import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStickyBand } from './useStickyBand'

type ObserverCallback = (entries: Pick<IntersectionObserverEntry, 'isIntersecting'>[]) => void

let observeSpy: ReturnType<typeof vi.fn>
let disconnectSpy: ReturnType<typeof vi.fn>
let lastCallback: ObserverCallback | null = null

class FakeIntersectionObserver {
  constructor(callback: ObserverCallback) {
    lastCallback = callback
  }
  observe = observeSpy
  disconnect = disconnectSpy
  unobserve = vi.fn()
}

function Probe() {
  const { sentinelRef, isStuck } = useStickyBand()
  return (
    <div>
      <div ref={sentinelRef} data-testid="sentinel" />
      <span data-testid="state">{isStuck ? 'stuck' : 'free'}</span>
    </div>
  )
}

describe('useStickyBand', () => {
  beforeEach(() => {
    observeSpy = vi.fn()
    disconnectSpy = vi.fn()
    lastCallback = null
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts free and observes the sentinel', () => {
    render(<Probe />)

    expect(screen.getByTestId('state')).toHaveTextContent('free')
    expect(observeSpy).toHaveBeenCalledWith(screen.getByTestId('sentinel'))
  })

  it('flips to stuck once the sentinel stops intersecting', () => {
    render(<Probe />)

    act(() => lastCallback?.([{ isIntersecting: false }]))

    expect(screen.getByTestId('state')).toHaveTextContent('stuck')
  })

  it('flips back to free once the sentinel intersects again', () => {
    render(<Probe />)

    act(() => lastCallback?.([{ isIntersecting: false }]))
    act(() => lastCallback?.([{ isIntersecting: true }]))

    expect(screen.getByTestId('state')).toHaveTextContent('free')
  })

  it('disconnects the observer on unmount', () => {
    const { unmount } = render(<Probe />)
    unmount()

    expect(disconnectSpy).toHaveBeenCalledOnce()
  })
})
