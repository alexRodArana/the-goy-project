import { describe, expect, it } from 'vitest'
import { createLocalCache } from './localCache'
import { isPublishableKey } from './security'

describe('account isolation', () => {
  it('keeps accounts, guest mode and apps in separate cache entries', async () => {
    const cache = createLocalCache('training-test', (value) => value)
    const meals = createLocalCache('nutrition-test', (value) => value)
    await cache.write('alice', { state: { private: 'alice' } })
    await cache.write('bob', { state: { private: 'bob' } })
    expect((await cache.read('alice'))?.state).toEqual({ private: 'alice' })
    expect((await cache.read('bob'))?.state).toEqual({ private: 'bob' })
    expect(await cache.read(null)).toBeUndefined()
    expect(await meals.read('alice')).toBeUndefined()
  })

  it('rejects server secrets and service-role keys in browser configuration', () => {
    const key = (role: string) => `header.${btoa(JSON.stringify({ role }))}.signature`
    expect(isPublishableKey('sb_secret_not_for_browsers')).toBe(false)
    expect(isPublishableKey(key('service_role'))).toBe(false)
    expect(isPublishableKey('bad.config')).toBe(false)
    expect(isPublishableKey(key('anon'))).toBe(true)
    expect(isPublishableKey('sb_publishable_browser_example')).toBe(true)
  })
})
