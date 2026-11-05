import { describe, it, expect, vi, beforeEach } from 'vitest'

const tx = {
  apiKey: { updateMany: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
}

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}))
vi.mock('./email.js', () => ({ sendApiKeyRegeneratedEmail: vi.fn(() => Promise.resolve()) }))

import { prisma } from '../lib/prisma.js'
import { sendApiKeyRegeneratedEmail } from './email.js'
import { createApiKey } from './apikey.js'

const mockFindUser = vi.mocked(prisma.user.findUnique)
const mockEmail = vi.mocked(sendApiKeyRegeneratedEmail)

beforeEach(() => {
  vi.clearAllMocks()
  mockFindUser.mockResolvedValue({ id: 'user_1', email: 'dev@example.com', emailVerified: true } as never)
  tx.apiKey.create.mockResolvedValue({ createdAt: new Date('2026-10-31T00:00:00Z') })
})

describe('createApiKey', () => {
  it('deactivates every active key for the user before creating the new one', async () => {
    tx.apiKey.updateMany.mockResolvedValue({ count: 1 })

    const { key, prefix } = await createApiKey('user_1')

    expect(key).toMatch(/^argns_live_[0-9a-f]{64}$/)
    expect(prefix).toBe(key.substring(0, 20))
    expect(tx.apiKey.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', isActive: true },
      data: { isActive: false },
    })
    expect(tx.apiKey.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.apiKey.create.mock.invocationCallOrder[0]!)
  })

  it('audits and emails the user when a previous key was revoked', async () => {
    tx.apiKey.updateMany.mockResolvedValue({ count: 2 })

    await createApiKey('user_1')

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user_1', eventType: 'API_KEY_REGENERATED' }),
    })
    expect(mockEmail).toHaveBeenCalledWith('dev@example.com')
  })

  it('does not audit or email on a first key', async () => {
    tx.apiKey.updateMany.mockResolvedValue({ count: 0 })

    await createApiKey('user_1')

    expect(tx.auditLog.create).not.toHaveBeenCalled()
    expect(mockEmail).not.toHaveBeenCalled()
  })

  it('refuses unverified users without touching keys', async () => {
    mockFindUser.mockResolvedValue({ id: 'user_1', email: 'dev@example.com', emailVerified: false } as never)

    await expect(createApiKey('user_1')).rejects.toMatchObject({ statusCode: 403 })
    expect(tx.apiKey.updateMany).not.toHaveBeenCalled()
  })
})
