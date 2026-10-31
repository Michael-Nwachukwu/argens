import { describe, it, expect } from 'vitest'
import type { Request } from 'express'
import { rateLimitKey } from './ratelimit.js'

const req = (authorization: string | undefined, ip = '203.0.113.7') =>
  ({ headers: { authorization }, ip }) as unknown as Request

describe('rateLimitKey', () => {
  it('keys agent requests by a hash of the API key, not the IP', () => {
    const a = rateLimitKey(req('Bearer argns_live_aaa', '203.0.113.7'))
    const b = rateLimitKey(req('Bearer argns_live_aaa', '198.51.100.1'))
    expect(a).toBe(b)
    expect(a).toMatch(/^key:[0-9a-f]{64}$/)
    expect(a).not.toContain('argns_live_')
  })

  it('gives different API keys behind the same IP separate buckets', () => {
    expect(rateLimitKey(req('Bearer argns_live_aaa'))).not.toBe(rateLimitKey(req('Bearer argns_live_bbb')))
  })

  it('keys JWT and unauthenticated requests by IP', () => {
    expect(rateLimitKey(req('Bearer eyJhbGciOi...'))).toBe('ip:203.0.113.7')
    expect(rateLimitKey(req(undefined))).toBe('ip:203.0.113.7')
  })
})
