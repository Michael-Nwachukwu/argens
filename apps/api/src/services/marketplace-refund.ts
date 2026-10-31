/**
 * Decides who makes a user whole when a paid marketplace call is not delivered.
 *
 * MPP Router records payment proof BEFORE calling upstream. On non-delivery (timeout,
 * 5xx, post-payment 4xx, empty body) it queues a refund of the full settled amount to
 * the payer and says so in `Refund-Status` (rozo-mpprouter `src/mpp-proxy.ts`,
 * `docs/receipts-and-refunds.md`). Argens must not flag those for a manual refund too,
 * or ops refunds the same call twice.
 *
 *   pending                            → MPP refunds automatically
 *   manual-review                      → MPP could not queue it / over its auto ceiling
 *   not-applicable-direct-settlement   → third-party route paid the provider; MPP never refunds
 *   voucher-not-consumed               → channel voucher rolled back; nothing settled
 *   absent / unknown value             → fall back to the receipt (pre-2026-08 behaviour)
 *
 * Anything we don't recognise fails safe toward a manual refund flag.
 */

import type { MppRefundSignal } from './mpp-client.js'

export type RefundOutcome =
  | 'none' // nothing settled — no money moved
  | 'mpp_auto' // MPP is refunding the payer automatically
  | 'mpp_manual_review' // MPP parked it for its own operator
  | 'direct_settlement' // paid a third-party provider directly; MPP will not refund
  | 'unknown' // settled, MPP gave no refund signal

export interface RefundClassification {
  outcome: RefundOutcome
  /** USDC left the payer's (or the credit pool's) wallet. */
  paymentCommitted: boolean
  /** Argens ops must act: write the refund flag, audit row, and alert email. */
  manualRefundRequired: boolean
}

export function classifyMarketplaceRefund(
  receipt: unknown,
  refund: MppRefundSignal | null,
): RefundClassification {
  const status = refund?.status.toLowerCase() ?? null

  if (status === 'pending') {
    return { outcome: 'mpp_auto', paymentCommitted: true, manualRefundRequired: false }
  }
  if (status === 'voucher-not-consumed') {
    return { outcome: 'none', paymentCommitted: false, manualRefundRequired: false }
  }
  if (status === 'not-applicable-direct-settlement') {
    return { outcome: 'direct_settlement', paymentCommitted: true, manualRefundRequired: true }
  }
  if (status === 'manual-review') {
    return { outcome: 'mpp_manual_review', paymentCommitted: true, manualRefundRequired: true }
  }

  // No (or unrecognised) refund header: the settlement receipt is the only evidence.
  if (!receipt && !status) {
    return { outcome: 'none', paymentCommitted: false, manualRefundRequired: false }
  }
  return { outcome: 'unknown', paymentCommitted: true, manualRefundRequired: true }
}
