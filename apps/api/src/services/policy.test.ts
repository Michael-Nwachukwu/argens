import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    policy: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '../lib/prisma.js'
import { checkPolicy, evaluatePolicy } from './policy.js'

const mockFindUnique = vi.mocked(prisma.policy.findUnique)

function policyRow(over: Partial<{
  allowanceLimit: Decimal | null
  maxTransactionLimit: Decimal | null
  approvalThreshold: Decimal | null
  totalSpent: Decimal
}> = {}) {
  return {
    id: 'pol_1',
    userId: 'usr_1',
    allowanceLimit: null,
    maxTransactionLimit: null,
    approvalThreshold: null,
    totalSpent: new Decimal(0),
    sorobanContractId: null,
    updatedAt: new Date(),
    ...over,
  }
}

describe('evaluatePolicy', () => {
  it('returns APPROVED when no limits are set', () => {
    const result = evaluatePolicy(policyRow(), '10.0000000')
    expect(result.status).toBe('APPROVED')
    expect(result.detail.allowance).toBe('not_set')
    expect(result.detail.max_transaction).toBe('not_set')
    expect(result.detail.approval_threshold).toBe('not_set')
  })

  it('returns APPROVED when amount is under all limits', () => {
    const result = evaluatePolicy(policyRow({
      maxTransactionLimit: new Decimal(100),
      allowanceLimit: new Decimal(500),
      totalSpent: new Decimal(0),
      approvalThreshold: new Decimal(200),
    }), '50.0000000')
    expect(result.status).toBe('APPROVED')
    expect(result.detail.max_transaction).toBe('passed')
    expect(result.detail.allowance).toBe('passed')
    expect(result.detail.approval_threshold).toBe('passed')
  })

  it('returns BLOCKED (max_transaction_exceeded) when amount > maxTransactionLimit', () => {
    const result = evaluatePolicy(policyRow({
      maxTransactionLimit: new Decimal(50),
      allowanceLimit: new Decimal(10), // also would fail — but max-tx check runs first
    }), '75.0000000')
    expect(result.status).toBe('BLOCKED')
    expect(result.reason).toBe('max_transaction_exceeded')
    expect(result.detail.max_transaction).toBe('blocked')
  })

  it('does NOT block when amount exactly equals maxTransactionLimit (strict >)', () => {
    const result = evaluatePolicy(policyRow({
      maxTransactionLimit: new Decimal(50),
    }), '50.0000000')
    expect(result.status).toBe('APPROVED')
    expect(result.detail.max_transaction).toBe('passed')
  })

  it('returns BLOCKED (allowance_exceeded) when amount > remaining allowance', () => {
    const result = evaluatePolicy(policyRow({
      allowanceLimit: new Decimal(100),
      totalSpent: new Decimal(80),
    }), '30.0000000')
    expect(result.status).toBe('BLOCKED')
    expect(result.reason).toBe('allowance_exceeded')
    expect(result.detail.allowance).toBe('blocked')
  })

  it('does NOT block when amount exactly equals remaining allowance (strict >)', () => {
    const result = evaluatePolicy(policyRow({
      allowanceLimit: new Decimal(100),
      totalSpent: new Decimal(80),
    }), '20.0000000')
    expect(result.status).toBe('APPROVED')
    expect(result.detail.allowance).toBe('passed')
  })

  it('returns PENDING_APPROVAL when amount >= approvalThreshold (equal)', () => {
    const result = evaluatePolicy(policyRow({
      approvalThreshold: new Decimal(100),
    }), '100.0000000')
    expect(result.status).toBe('PENDING_APPROVAL')
    expect(result.detail.approval_threshold).toBe('pending')
  })

  it('returns PENDING_APPROVAL when amount > approvalThreshold', () => {
    const result = evaluatePolicy(policyRow({
      approvalThreshold: new Decimal(100),
    }), '150.0000000')
    expect(result.status).toBe('PENDING_APPROVAL')
  })

  it('does NOT trigger approval when amount is just below approvalThreshold', () => {
    const result = evaluatePolicy(policyRow({
      approvalThreshold: new Decimal(100),
    }), '99.9999999')
    expect(result.status).toBe('APPROVED')
    expect(result.detail.approval_threshold).toBe('passed')
  })

  it('returns correct allowance_remaining string with 7 decimal places', () => {
    const result = evaluatePolicy(policyRow({
      allowanceLimit: new Decimal('500'),
      totalSpent: new Decimal('7.5'),
    }), '1.0000000')
    expect(result.policy.allowance_remaining).toBe('492.5000000')
  })
})

describe('checkPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws POLICY_NOT_FOUND when no policy row exists', async () => {
    mockFindUnique.mockResolvedValueOnce(null as never)
    await expect(checkPolicy('usr_1', '10.0000000')).rejects.toMatchObject({
      code: 'POLICY_NOT_FOUND',
    })
  })

  it('delegates to evaluatePolicy and returns its result', async () => {
    mockFindUnique.mockResolvedValueOnce(policyRow({
      maxTransactionLimit: new Decimal(50),
    }) as never)
    const result = await checkPolicy('usr_1', '75.0000000')
    expect(result.status).toBe('BLOCKED')
    expect(result.reason).toBe('max_transaction_exceeded')
  })
})
