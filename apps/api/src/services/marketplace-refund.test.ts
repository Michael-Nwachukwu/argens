import { describe, it, expect } from 'vitest'
import { classifyMarketplaceRefund } from './marketplace-refund.js'
import type { MppRefundSignal } from './mpp-client.js'

const RECEIPT = { method: 'stellar', reference: 'abc', status: 'success', timestamp: '2026-10-27T00:00:00Z' }

function signal(status: string, id: string | null = null): MppRefundSignal {
  return { status, id, status_url: id ? `https://apiserver.mpprouter.dev/v1/refunds/${id}` : null, mode: null }
}

describe('classifyMarketplaceRefund', () => {
  it('pending → MPP auto-refund, no manual flag', () => {
    expect(classifyMarketplaceRefund(RECEIPT, signal('pending', 'r1'))).toEqual({
      outcome: 'mpp_auto',
      paymentCommitted: true,
      manualRefundRequired: false,
    })
  })

  it('pending counts as committed even when the receipt header was missed', () => {
    const c = classifyMarketplaceRefund(null, signal('pending', 'r1'))
    expect(c.paymentCommitted).toBe(true)
    expect(c.manualRefundRequired).toBe(false)
  })

  it('header value is case-insensitive', () => {
    expect(classifyMarketplaceRefund(RECEIPT, signal('Pending')).outcome).toBe('mpp_auto')
  })

  it('manual-review → manual flag', () => {
    expect(classifyMarketplaceRefund(RECEIPT, signal('manual-review'))).toEqual({
      outcome: 'mpp_manual_review',
      paymentCommitted: true,
      manualRefundRequired: true,
    })
  })

  it('direct settlement → manual flag (MPP never refunds third-party routes)', () => {
    expect(classifyMarketplaceRefund(RECEIPT, signal('not-applicable-direct-settlement'))).toEqual({
      outcome: 'direct_settlement',
      paymentCommitted: true,
      manualRefundRequired: true,
    })
  })

  it('voucher-not-consumed → nothing settled', () => {
    expect(classifyMarketplaceRefund(RECEIPT, signal('voucher-not-consumed'))).toEqual({
      outcome: 'none',
      paymentCommitted: false,
      manualRefundRequired: false,
    })
  })

  it('no header and no receipt → nothing settled', () => {
    expect(classifyMarketplaceRefund(null, null)).toEqual({
      outcome: 'none',
      paymentCommitted: false,
      manualRefundRequired: false,
    })
  })

  it('no header but a receipt → manual flag (legacy behaviour)', () => {
    expect(classifyMarketplaceRefund(RECEIPT, null)).toEqual({
      outcome: 'unknown',
      paymentCommitted: true,
      manualRefundRequired: true,
    })
  })

  it('unrecognised header value fails safe toward a manual flag', () => {
    expect(classifyMarketplaceRefund(null, signal('something-new'))).toEqual({
      outcome: 'unknown',
      paymentCommitted: true,
      manualRefundRequired: true,
    })
  })
})
