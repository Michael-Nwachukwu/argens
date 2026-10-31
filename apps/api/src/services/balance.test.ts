import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    wallet: { update: vi.fn() },
    policy: { findUnique: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
  },
}))
vi.mock('./stellar.js', () => ({ getUsdcBalance: vi.fn() }))
vi.mock('./email.js', () => ({ sendLowBalanceEmail: vi.fn(() => Promise.resolve()) }))

import { prisma } from '../lib/prisma.js'
import { getUsdcBalance } from './stellar.js'
import { sendLowBalanceEmail } from './email.js'
import { lowBalanceThreshold, refreshBalanceAndWarn } from './balance.js'

const mockBalance = vi.mocked(getUsdcBalance)
const mockPolicy = vi.mocked(prisma.policy.findUnique)
const mockRecent = vi.mocked(prisma.auditLog.findFirst)
const mockEmail = vi.mocked(sendLowBalanceEmail)

const policy = (allowance: string | null, spent: string) =>
  ({ allowanceLimit: allowance === null ? null : new Decimal(allowance), totalSpent: new Decimal(spent) }) as never

beforeEach(() => {
  vi.clearAllMocks()
  mockPolicy.mockResolvedValue(policy(null, '0'))
  mockRecent.mockResolvedValue(null)
})

describe('lowBalanceThreshold', () => {
  it('is 10 USDC with no allowance', () => {
    expect(lowBalanceThreshold(null).toFixed(7)).toBe('10.0000000')
    expect(lowBalanceThreshold(policy(null, '5')).toFixed(7)).toBe('10.0000000')
  })

  it('is 10% of the remaining allowance when that is higher, in exact decimal', () => {
    expect(lowBalanceThreshold(policy('500', '376.6666667')).toFixed(7)).toBe('12.3333333')
  })

  it('never drops below 10 USDC, even when the allowance is overspent', () => {
    expect(lowBalanceThreshold(policy('50', '60')).toFixed(7)).toBe('10.0000000')
  })
})

describe('refreshBalanceAndWarn', () => {
  it('refreshes the cache before comparing, and emails on the fresh balance', async () => {
    mockBalance.mockResolvedValue('4.0000000')

    await refreshBalanceAndWarn('user_1', 'wallet_1', 'GPUB')

    expect(prisma.wallet.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'wallet_1' }, data: expect.objectContaining({ balanceCache: '4.0000000' }) }),
    )
    expect(mockEmail).toHaveBeenCalledWith('user_1', '4.0000000', '10.0000000')
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user_1', eventType: 'LOW_BALANCE_EMAIL_SENT' }),
    })
  })

  it('does not email above the threshold', async () => {
    mockBalance.mockResolvedValue('25.0000000')

    await refreshBalanceAndWarn('user_1', 'wallet_1', 'GPUB')

    expect(mockEmail).not.toHaveBeenCalled()
  })

  it('emails at most once per 24h', async () => {
    mockBalance.mockResolvedValue('4.0000000')
    mockRecent.mockResolvedValue({ id: 'audit_1' } as never)

    await refreshBalanceAndWarn('user_1', 'wallet_1', 'GPUB')

    expect(mockEmail).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })

  it('does nothing when the live balance cannot be read', async () => {
    mockBalance.mockResolvedValue(null)

    await refreshBalanceAndWarn('user_1', 'wallet_1', 'GPUB')

    expect(prisma.wallet.update).not.toHaveBeenCalled()
    expect(mockEmail).not.toHaveBeenCalled()
  })
})
