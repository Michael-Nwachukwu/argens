import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    wallet: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    policy: { upsert: vi.fn() },
  },
}))
vi.mock('../lib/crypto.js', () => ({ encryptSecretKey: vi.fn(() => 'enc') }))
vi.mock('./sponsorship.js', () => ({ activateAccount: vi.fn(), inspectAccount: vi.fn() }))

import { prisma } from '../lib/prisma.js'
import { activateAccount, inspectAccount } from './sponsorship.js'
import { bootstrapWallet } from './wallet.js'

const mockCreate = vi.mocked(prisma.wallet.create)
const mockUpdate = vi.mocked(prisma.wallet.update)
const mockDelete = vi.mocked(prisma.wallet.delete)
const mockPolicyUpsert = vi.mocked(prisma.policy.upsert)
const mockActivate = vi.mocked(activateAccount)
const mockInspect = vi.mocked(inspectAccount)

const statusWrites = () => mockUpdate.mock.calls.map(([args]) => (args as { data: { status: string } }).data.status)

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue({ id: 'wallet_1' } as never)
  mockUpdate.mockResolvedValue({} as never)
  mockPolicyUpsert.mockResolvedValue({} as never)
})

describe('bootstrapWallet', () => {
  it('marks the wallet READY when activation succeeds', async () => {
    mockActivate.mockResolvedValue(undefined)

    const { publicKey } = await bootstrapWallet('user_1')

    expect(publicKey).toMatch(/^G[A-Z2-7]{55}$/)
    expect(statusWrites()).toEqual(['READY'])
    expect(mockInspect).not.toHaveBeenCalled()
  })

  it('seeds the Policy row before touching the chain', async () => {
    mockActivate.mockRejectedValue(new Error('horizon down'))
    mockInspect.mockResolvedValue('missing')

    await expect(bootstrapWallet('user_1')).rejects.toThrow()

    expect(mockPolicyUpsert).toHaveBeenCalledTimes(1)
    expect(mockPolicyUpsert.mock.invocationCallOrder[0]!).toBeLessThan(mockActivate.mock.invocationCallOrder[0]!)
  })

  it('trusts the chain over the error: a timed-out submit that landed is READY', async () => {
    mockActivate.mockRejectedValue(new Error('504 timeout'))
    mockInspect.mockResolvedValue('ready')

    await expect(bootstrapWallet('user_1')).resolves.toHaveProperty('publicKey')
    expect(statusWrites()).toEqual(['READY'])
  })

  it('marks TRUSTLINE_PENDING when the account exists without a trustline', async () => {
    mockActivate.mockRejectedValue(new Error('op_low_reserve'))
    mockInspect.mockResolvedValue('no_trustline')

    await expect(bootstrapWallet('user_1')).resolves.toHaveProperty('publicKey')
    expect(statusWrites()).toEqual(['TRUSTLINE_PENDING'])
  })

  it('keeps the row INITIALISING (never deletes it) when the account does not exist', async () => {
    mockActivate.mockRejectedValue(new Error('ops wallet empty'))
    mockInspect.mockResolvedValue('missing')

    await expect(bootstrapWallet('user_1')).rejects.toThrow(/retry wallet setup/)
    expect(mockDelete).not.toHaveBeenCalled()
    expect(statusWrites()).toEqual([])
  })

  it('keeps the row and throws when the chain cannot be read', async () => {
    mockActivate.mockRejectedValue(new Error('horizon down'))
    mockInspect.mockRejectedValue(new Error('horizon still down'))

    await expect(bootstrapWallet('user_1')).rejects.toThrow()
    expect(mockDelete).not.toHaveBeenCalled()
    expect(statusWrites()).toEqual([])
  })
})
