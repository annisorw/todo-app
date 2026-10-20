import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blockedError, quotaError, stubLocalStorage } from '../test/storage'
import type { StorageStub } from '../test/storage'
import { readRaw, removeRaw, writeRaw } from './localStorageDriver'

/** Предупреждения драйвера ожидаемы: глушим, но оставляем наблюдаемыми. */
const silenceWarnings = () => vi.spyOn(console, 'warn').mockImplementation(() => undefined)

describe('localStorageDriver', () => {
  let stub: StorageStub | null = null
  let warn: ReturnType<typeof silenceWarnings>

  beforeEach(() => {
    warn = silenceWarnings()
  })

  afterEach(() => {
    stub?.restore()
    stub = null
    warn.mockRestore()
  })

  it('reads a stored value and reports a missing key as null, not as an error', () => {
    stub = stubLocalStorage({ items: { 'aurora.probe': 'value' } })

    expect(readRaw('aurora.probe')).toEqual({ ok: true, value: 'value' })
    expect(readRaw('aurora.absent')).toEqual({ ok: true, value: null })
  })

  it('writes and removes a value', () => {
    stub = stubLocalStorage()

    expect(writeRaw('aurora.probe', 'value')).toBeNull()
    expect(stub.items.get('aurora.probe')).toBe('value')

    expect(removeRaw('aurora.probe')).toBeNull()
    expect(stub.items.has('aurora.probe')).toBe(false)
  })

  it('does not throw when the storage object itself is unreachable', () => {
    stub = stubLocalStorage({ accessError: blockedError() })

    expect(readRaw('aurora.probe')).toEqual({ ok: false, error: 'blocked' })
    expect(writeRaw('aurora.probe', 'value')).toBe('blocked')
    expect(removeRaw('aurora.probe')).toBe('blocked')
  })

  it('reports a denied read as blocked', () => {
    stub = stubLocalStorage({ readError: blockedError() })

    expect(readRaw('aurora.probe')).toEqual({ ok: false, error: 'blocked' })
  })

  it('tells an exhausted quota apart from a denied write', () => {
    stub = stubLocalStorage({ writeError: quotaError() })
    expect(writeRaw('aurora.probe', 'value')).toBe('quota')
    stub.restore()

    stub = stubLocalStorage({ writeError: blockedError() })
    expect(writeRaw('aurora.probe', 'value')).toBe('blocked')
  })

  it('recognises the legacy Firefox quota error', () => {
    const legacy = new Error('quota reached')
    legacy.name = 'NS_ERROR_DOM_QUOTA_REACHED'
    stub = stubLocalStorage({ writeError: legacy })

    expect(writeRaw('aurora.probe', 'value')).toBe('quota')
  })

  // Проверяет требование «не глушить молча»: пустой catch этот тест не пройдёт.
  it('logs every failure in a dev build instead of swallowing it', () => {
    stub = stubLocalStorage({ writeError: quotaError() })

    writeRaw('aurora.probe', 'value')

    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0]?.[0]).toContain('aurora.probe')
  })
})
