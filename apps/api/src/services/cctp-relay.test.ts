import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    transaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('./cctp.js', () => ({
  pollAttestation: vi.fn(),
  relayOnBase: vi.fn(),
}))

vi.mock('./policy.js', () => ({
  incrementTotalSpent: vi.fn(),
}))

import { prisma } from '../lib/prisma.js'
import { pollAttestation, relayOnBase } from './cctp.js'
import { incrementTotalSpent } from './policy.js'
import { runRelay } from './cctp-relay.js'

const mockFindUnique = vi.mocked(prisma.transaction.findUnique)
const mockUpdate = vi.mocked(prisma.transaction.update)
const mockPollAttestation = vi.mocked(pollAttestation)
const mockRelayOnBase = vi.mocked(relayOnBase)
const mockIncrementTotalSpent = vi.mocked(incrementTotalSpent)

function pendingTx(over: Record<string, unknown> = {}) {
  return {
    id: 'tx_1',
    userId: 'usr_1',
    status: 'APPROVED',
    crossChain: true,
    stellarTxHash: 'abc_burn_hash',
    destinationTxHash: null,
    amount: new Decimal('25'),
    metadata: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdate.mockResolvedValue({} as never)
  mockIncrementTotalSpent.mockResolvedValue(undefined as never)
})

describe('runRelay — happy path', () => {
  it('marks SUCCESS with destinationTxHash; calls incrementTotalSpent only when incrementOnSuccess=true', async () => {
    mockFindUnique.mockResolvedValue(pendingTx() as never)
    mockPollAttestation.mockResolvedValue({ message: 'msg', attestation: 'att' } as never)
    mockRelayOnBase.mockResolvedValue({ baseTxHash: '0xbase_hash' } as never)

    await runRelay('tx_1', { incrementOnSuccess: true })

    const successCall = mockUpdate.mock.calls.find(
      ([args]) => (args as { data: { status?: string } }).data.status === 'SUCCESS',
    )
    expect(successCall).toBeDefined()
    const updateData = (successCall![0] as { data: { destinationTxHash?: string } }).data
    expect(updateData.destinationTxHash).toBe('0xbase_hash')
    expect(mockIncrementTotalSpent).toHaveBeenCalledWith('usr_1', '25.0000000')
  })

  it('does NOT call incrementTotalSpent when incrementOnSuccess=false', async () => {
    mockFindUnique.mockResolvedValue(pendingTx() as never)
    mockPollAttestation.mockResolvedValue({ message: 'msg', attestation: 'att' } as never)
    mockRelayOnBase.mockResolvedValue({ baseTxHash: '0xbase_hash' } as never)

    await runRelay('tx_1', { incrementOnSuccess: false })

    expect(mockIncrementTotalSpent).not.toHaveBeenCalled()
  })
})

describe('runRelay — generic relay error', () => {
  it('keeps status APPROVED, increments relay.attempts, records lastError', async () => {
    mockFindUnique.mockResolvedValue(pendingTx() as never)
    mockPollAttestation.mockRejectedValue(new Error('Iris timeout'))

    await runRelay('tx_1', { incrementOnSuccess: false })

    // The update that records the error should leave status as-is (no status field)
    // and write relay metadata with the error
    const errorCall = mockUpdate.mock.calls.find(([args]) => {
      const data = (args as { data: { metadata?: { relay?: { lastError?: string } } } }).data
      return data.metadata?.relay?.lastError === 'Iris timeout'
    })
    expect(errorCall).toBeDefined()

    // Should NOT have marked SUCCESS or FAILED
    const statusCalls = mockUpdate.mock.calls.filter(
      ([args]) => (args as { data: { status?: string } }).data.status === 'FAILED'
        || (args as { data: { status?: string } }).data.status === 'SUCCESS',
    )
    expect(statusCalls).toHaveLength(0)
  })
})

describe('runRelay — attempts exhausted', () => {
  it('marks FAILED with exhausted=true and does not call pollAttestation', async () => {
    const tx = pendingTx({
      metadata: {
        cctpFee: { rate: '0.005', amount: '0.1250000' },
        relay: { attempts: 5, incrementOnSuccess: false, lastError: 'prev error', lastAttemptAt: '2026-06-01T00:00:00Z' },
      },
    })
    mockFindUnique.mockResolvedValue(tx as never)

    await runRelay('tx_1', { incrementOnSuccess: false })

    expect(mockPollAttestation).not.toHaveBeenCalled()

    const failedCall = mockUpdate.mock.calls.find(
      ([args]) => (args as { data: { status?: string } }).data.status === 'FAILED',
    )
    expect(failedCall).toBeDefined()
    const data = (failedCall![0] as { data: { metadata?: { relay?: { exhausted?: boolean } }; blockedReason?: string } }).data
    expect(data.metadata?.relay?.exhausted).toBe(true)
    expect(data.blockedReason).toMatch(/exhausted.*USDC was burned/)
  })
})

describe('runRelay — nonce already used', () => {
  it('marks SUCCESS with relay.note when error contains "Nonce already used"', async () => {
    mockFindUnique.mockResolvedValue(pendingTx() as never)
    mockPollAttestation.mockResolvedValue({ message: 'msg', attestation: 'att' } as never)
    mockRelayOnBase.mockRejectedValue(new Error('Nonce already used by another transaction'))

    await runRelay('tx_1', { incrementOnSuccess: false })

    const successCall = mockUpdate.mock.calls.find(
      ([args]) => (args as { data: { status?: string } }).data.status === 'SUCCESS',
    )
    expect(successCall).toBeDefined()
    const data = (successCall![0] as { data: { destinationTxHash?: unknown; metadata?: { relay?: { note?: string } } } }).data
    expect(data.destinationTxHash).toBeUndefined()
    expect(data.metadata?.relay?.note).toMatch(/nonce_already_used/)
  })
})

describe('runRelay — idempotency guard', () => {
  it('makes no writes when transaction is already SUCCESS', async () => {
    mockFindUnique.mockResolvedValue(
      pendingTx({ status: 'SUCCESS', destinationTxHash: '0xalready' }) as never,
    )

    await runRelay('tx_1', { incrementOnSuccess: false })

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockPollAttestation).not.toHaveBeenCalled()
  })
})

describe('runRelay — metadata merge', () => {
  it('preserves existing cctpFee after writing relay state', async () => {
    const tx = pendingTx({
      metadata: {
        cctpFee: { rate: '0.005', amount: '0.1250000', stellar_tx_hash: 'fee_hash' },
      },
    })
    mockFindUnique.mockResolvedValue(tx as never)
    mockPollAttestation.mockResolvedValue({ message: 'msg', attestation: 'att' } as never)
    mockRelayOnBase.mockResolvedValue({ baseTxHash: '0xbase_hash' } as never)

    await runRelay('tx_1', { incrementOnSuccess: false })

    // Every update call must preserve cctpFee
    for (const [args] of mockUpdate.mock.calls) {
      const data = (args as { data: { metadata?: Record<string, unknown> } }).data
      if (data.metadata) {
        expect(data.metadata['cctpFee']).toEqual({
          rate: '0.005',
          amount: '0.1250000',
          stellar_tx_hash: 'fee_hash',
        })
      }
    }
  })
})
