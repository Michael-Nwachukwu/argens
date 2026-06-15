/**
 * services/policy.ts
 *
 * TypeScript policy stand-in for Phase 2.
 * Reads policy rules from Postgres and enforces them in-process.
 *
 * Phase 4 replaces checkPolicy() with a Soroban contract call.
 * Every downstream consumer (routes/transactions.ts, routes/approve.ts)
 * uses the PolicyResult type — the swap-out is transparent to callers.
 *
 * Policy check order (CLAUDE.md):
 *   1. Max Transaction  → BLOCKED if amount > maxTransactionLimit
 *   2. Allowance        → BLOCKED if amount > (allowanceLimit - totalSpent)
 *   3. Approval         → PENDING_APPROVAL if amount >= approvalThreshold
 *   4. All pass         → APPROVED
 */

import { Decimal } from '@prisma/client/runtime/library'
import type { Policy } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'

// ─── Types ─────────────────────────────────────────────────────────────────

export type PolicyStatus = 'APPROVED' | 'BLOCKED' | 'PENDING_APPROVAL'

export interface PolicyCheckDetail {
  allowance: 'passed' | 'blocked' | 'not_set'
  max_transaction: 'passed' | 'blocked' | 'not_set'
  approval_threshold: 'passed' | 'pending' | 'not_set'
}

export interface PolicyResult {
  status: PolicyStatus
  reason?: string        // populated when BLOCKED
  detail: PolicyCheckDetail
  policy: {
    allowance_limit: string | null
    max_transaction_limit: string | null
    approval_threshold: string | null
    total_spent: string
    allowance_remaining: string | null
  }
}

// ─── evaluatePolicy (pure, synchronous) ─────────────────────────────────────

/**
 * Pure synchronous evaluation of all three policy checks against a policy row.
 * Shared by checkPolicy and checkPolicyAndReserve — do not add side effects here.
 */
export function evaluatePolicy(policy: Policy, amount: string): PolicyResult {
  const amt = new Decimal(amount)
  const totalSpent = policy.totalSpent

  const detail: PolicyCheckDetail = {
    allowance: 'not_set',
    max_transaction: 'not_set',
    approval_threshold: 'not_set',
  }

  const policySnapshot = {
    allowance_limit: policy.allowanceLimit?.toFixed(7) ?? null,
    max_transaction_limit: policy.maxTransactionLimit?.toFixed(7) ?? null,
    approval_threshold: policy.approvalThreshold?.toFixed(7) ?? null,
    total_spent: totalSpent.toFixed(7),
    allowance_remaining: policy.allowanceLimit
      ? policy.allowanceLimit.minus(totalSpent).toFixed(7)
      : null,
  }

  // ── 1. Max Transaction ──────────────────────────────────────────────────
  if (policy.maxTransactionLimit !== null) {
    if (amt.greaterThan(policy.maxTransactionLimit)) {
      detail.max_transaction = 'blocked'
      return { status: 'BLOCKED', reason: 'max_transaction_exceeded', detail, policy: policySnapshot }
    }
    detail.max_transaction = 'passed'
  }

  // ── 2. Allowance ────────────────────────────────────────────────────────
  if (policy.allowanceLimit !== null) {
    const remaining = policy.allowanceLimit.minus(totalSpent)
    if (amt.greaterThan(remaining)) {
      detail.allowance = 'blocked'
      return { status: 'BLOCKED', reason: 'allowance_exceeded', detail, policy: policySnapshot }
    }
    detail.allowance = 'passed'
  }

  // ── 3. Approval Threshold ───────────────────────────────────────────────
  if (policy.approvalThreshold !== null) {
    if (amt.greaterThanOrEqualTo(policy.approvalThreshold)) {
      detail.approval_threshold = 'pending'
      return { status: 'PENDING_APPROVAL', detail, policy: policySnapshot }
    }
    detail.approval_threshold = 'passed'
  }

  // ── 4. All checks passed ────────────────────────────────────────────────
  return { status: 'APPROVED', detail, policy: policySnapshot }
}

// ─── checkPolicy ────────────────────────────────────────────────────────────

/**
 * Run all three policy checks against the stored policy for this user.
 * Returns a PolicyResult — never throws on a policy violation; callers
 * inspect the result and respond accordingly.
 *
 * Throws AppError only for infrastructure failures (policy not found).
 */
export async function checkPolicy(
  userId: string,
  amount: string,       // "25.0000000" — string, 7 decimals
): Promise<PolicyResult> {
  const policy = await prisma.policy.findUnique({ where: { userId } })
  if (!policy) {
    throw new AppError('Policy record not found for user', 'POLICY_NOT_FOUND', 500)
  }
  return evaluatePolicy(policy, amount)
}

// ─── checkPolicyAndReserve ───────────────────────────────────────────────────

const MAX_RETRIES = 3

/**
 * Atomically re-check the allowance and reserve `amount` against it.
 * Runs evaluatePolicy's logic and the totalSpent increment inside one
 * SERIALIZABLE transaction, so concurrent payments cannot jointly exceed the
 * allowance. Call releaseSpend() if the payment later fails.
 *
 * Returns the PolicyResult; increments totalSpent ONLY when status is APPROVED.
 *
 * Reservation semantics (since plan 002): increments totalSpent atomically at
 * approval time, before Stellar submission, and releaseSpend decrements it if
 * the submission fails. The settled invariant is unchanged — a transaction that
 * ends BLOCKED/FAILED/PENDING contributes nothing to totalSpent — but in-flight
 * payments briefly hold a reservation so concurrent requests cannot jointly
 * exceed the allowance.
 */
export async function checkPolicyAndReserve(
  userId: string,
  amount: string,
): Promise<PolicyResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const policy = await tx.policy.findUnique({ where: { userId } })
          if (!policy) {
            throw new AppError('Policy record not found for user', 'POLICY_NOT_FOUND', 500)
          }
          const result = evaluatePolicy(policy, amount)
          if (result.status === 'APPROVED') {
            await tx.policy.update({
              where: { userId },
              data: { totalSpent: { increment: new Decimal(amount) } },
            })
          }
          return result
        },
        { isolationLevel: 'Serializable' },
      )
    } catch (e) {
      // P2034: serialization conflict — safe to retry
      if ((e as { code?: string }).code === 'P2034' && attempt < MAX_RETRIES) continue
      throw e
    }
  }
}

/** Compensating action: release a reservation after a failed payment. */
export async function releaseSpend(userId: string, amount: string): Promise<void> {
  await prisma.policy.update({
    where: { userId },
    data: { totalSpent: { decrement: new Decimal(amount) } },
  })
}

// ─── incrementTotalSpent ────────────────────────────────────────────────────

/**
 * Increment policy.totalSpent by `amount` (requested amount only — not fee).
 * Called ONLY after a transaction reaches SUCCESS status.
 * Never called for PENDING_APPROVAL, BLOCKED, or FAILED.
 */
export async function incrementTotalSpent(
  userId: string,
  amount: string,
): Promise<void> {
  await prisma.policy.update({
    where: { userId },
    data: {
      totalSpent: {
        increment: new Decimal(amount),
      },
    },
  })
}

// ─── getPolicy ─────────────────────────────────────────────────────────────

export async function getPolicy(userId: string) {
  return prisma.policy.findUnique({ where: { userId } })
}

// ─── savePolicy ────────────────────────────────────────────────────────────

/**
 * Upsert policy limits. totalSpent is never reset here — it is only ever
 * incremented by incrementTotalSpent().
 */
export async function savePolicy(
  userId: string,
  data: {
    allowanceLimit?: string | null
    maxTransactionLimit?: string | null
    approvalThreshold?: string | null
  },
) {
  const toDecimal = (v: string | null | undefined) =>
    v === undefined ? undefined : v !== null ? new Decimal(v) : null

  return prisma.policy.upsert({
    where: { userId },
    create: {
      userId,
      allowanceLimit: toDecimal(data.allowanceLimit) ?? null,
      maxTransactionLimit: toDecimal(data.maxTransactionLimit) ?? null,
      approvalThreshold: toDecimal(data.approvalThreshold) ?? null,
    },
    update: {
      // Only update fields that were explicitly passed — undefined means "leave as-is"
      ...(data.allowanceLimit !== undefined && { allowanceLimit: toDecimal(data.allowanceLimit) }),
      ...(data.maxTransactionLimit !== undefined && { maxTransactionLimit: toDecimal(data.maxTransactionLimit) }),
      ...(data.approvalThreshold !== undefined && { approvalThreshold: toDecimal(data.approvalThreshold) }),
    },
  })
}
