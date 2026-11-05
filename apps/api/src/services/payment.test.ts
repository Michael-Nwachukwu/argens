import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma.js', () => ({ prisma: { transaction: { update: vi.fn() } } }))
vi.mock('./policy.js', () => ({ incrementTotalSpent: vi.fn() }))
vi.mock('./sponsorship.js', () => ({ submitClassic: vi.fn() }))

import { prisma } from '../lib/prisma.js'
import { incrementTotalSpent } from './policy.js'
import { recordLandedPayment } from './payment.js'

const mockUpdate = vi.mocked(prisma.transaction.update)
const mockIncrement = vi.mocked(incrementTotalSpent)

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdate.mockResolvedValue({} as never)
  mockIncrement.mockResolvedValue(undefined as never)
})

describe('recordLandedPayment', () => {
  it('marks the row SUCCESS with the hash and increments spend when asked', async () => {
    await recordLandedPayment({ transactionId: 'tx_1', stellarTxHash: 'abc', userId: 'u1', incrementSpend: '5.0000000' })

    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: 'tx_1' }, data: { status: 'SUCCESS', stellarTxHash: 'abc' } })
    expect(mockIncrement).toHaveBeenCalledWith('u1', '5.0000000')
  })

  it('does not touch totalSpent when the spend was already reserved', async () => {
    await recordLandedPayment({ transactionId: 'tx_1', stellarTxHash: 'abc', userId: 'u1' })

    expect(mockIncrement).not.toHaveBeenCalled()
  })

  it('never throws once the payment has landed, even if both writes fail', async () => {
    mockUpdate.mockRejectedValue(new Error('db down'))
    mockIncrement.mockRejectedValue(new Error('db down'))

    await expect(
      recordLandedPayment({ transactionId: 'tx_1', stellarTxHash: 'abc', userId: 'u1', incrementSpend: '5.0000000' }),
    ).resolves.toBeUndefined()
    expect(mockIncrement).toHaveBeenCalled()
  })
})
