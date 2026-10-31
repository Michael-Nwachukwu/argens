import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'

vi.mock('../services/apikey.js', () => ({ validateApiKey: vi.fn() }))

import { validateApiKey } from '../services/apikey.js'
import { requireJwt, requireApiKey, requireJwtOrApiKey, signJwt } from './auth.js'

const SECRET = 'x'.repeat(32)
process.env['JWT_SECRET'] = SECRET

const mockValidate = vi.mocked(validateApiKey)

function call(mw: typeof requireJwt, authorization?: string) {
  const req = { headers: { authorization } } as unknown as Request
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
  return new Promise<{ req: Request; res: Response; nextCalled: boolean }>((resolve) => {
    const next = () => resolve({ req, res, nextCalled: true })
    vi.mocked(res.json).mockImplementation(((_body: unknown) => {
      resolve({ req, res, nextCalled: false })
      return res
    }) as never)
    mw(req, res, next)
  })
}

const statusOf = (res: Response) => vi.mocked(res.status).mock.calls[0]?.[0]
const codeOf = (res: Response) => (vi.mocked(res.json).mock.calls[0]?.[0] as { code: string }).code

beforeEach(() => vi.clearAllMocks())

describe('requireJwt', () => {
  it('accepts a token from signJwt', async () => {
    const { req, nextCalled } = await call(requireJwt, `Bearer ${signJwt({ userId: 'u1', email: 'a@b.co' })}`)
    expect(nextCalled).toBe(true)
    expect(req.userId).toBe('u1')
    expect(req.authType).toBe('jwt')
  })

  it('rejects a missing header and a bad token with 401', async () => {
    expect(statusOf((await call(requireJwt)).res)).toBe(401)
    expect(statusOf((await call(requireJwt, 'Bearer not-a-jwt')).res)).toBe(401)
  })
})

describe('requireApiKey', () => {
  it('accepts a key validateApiKey resolves', async () => {
    mockValidate.mockResolvedValue('u2')
    const { req, nextCalled } = await call(requireApiKey, 'Bearer argns_live_abc')
    expect(nextCalled).toBe(true)
    expect(req.userId).toBe('u2')
    expect(req.authType).toBe('apiKey')
  })

  it('rejects a key validateApiKey refuses with 401', async () => {
    const { ForbiddenError } = await import('../lib/errors.js')
    mockValidate.mockRejectedValue(new ForbiddenError('Invalid or revoked API key'))
    const { res, nextCalled } = await call(requireApiKey, 'Bearer argns_live_abc')
    expect(nextCalled).toBe(false)
    expect(statusOf(res)).toBe(401)
    expect(codeOf(res)).toBe('UNAUTHORIZED')
  })
})

describe('requireJwtOrApiKey', () => {
  it('routes argns_ tokens to API key validation and others to JWT', async () => {
    mockValidate.mockResolvedValue('u3')
    expect((await call(requireJwtOrApiKey, 'Bearer argns_live_abc')).req.authType).toBe('apiKey')
    const token = jwt.sign({ userId: 'u4', email: 'c@d.co' }, SECRET)
    expect((await call(requireJwtOrApiKey, `Bearer ${token}`)).req.authType).toBe('jwt')
  })
})
