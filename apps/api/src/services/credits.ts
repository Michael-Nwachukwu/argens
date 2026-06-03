/**
 * services/credits.ts
 *
 * Argens-granted credits — prepaid, non-withdrawable, expirable marketplace budget.
 *
 * Active balance is computed live from CreditGrant rows where
 *   amountRemaining > 0 AND (expiresAt IS NULL OR expiresAt > now()).
 *
 * Consumption is FIFO ordered by expiresAt ASC (soonest to expire first), then by
 * createdAt ASC. Each grant is decremented in turn until the requested amount is
 * satisfied. The whole operation runs in a single transaction so concurrent
 * consumption can't double-spend a grant.
 *
 * Credits only apply to marketplace calls (POST /marketplace/call). They never
 * apply to direct payments (POST /pay, POST /wallet/send) — those move real
 * on-chain USDC to third-party recipients, which credits cannot back.
 */

import { Decimal } from '@prisma/client/runtime/library'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'

export interface CreditConsumption {
  grants: Array<{ grantId: string; deducted: string }>
  total: string
}

/**
 * Returns the user's currently-spendable credits balance (non-expired, non-zero grants).
 */
export async function getActiveCreditsBalance(userId: string): Promise<Decimal> {
  const result = await prisma.creditGrant.aggregate({
    where: {
      userId,
      amountRemaining: { gt: 0 },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    _sum: { amountRemaining: true },
  })
  return result._sum.amountRemaining ?? new Decimal(0)
}

/**
 * Consume `amount` USDC from the user's active credit grants, FIFO by expiry.
 * Throws AppError('INSUFFICIENT_CREDITS', 402) if active credits cover less than `amount`.
 *
 * If `tx` is provided, runs inside that transaction (caller controls the unit of work).
 * Otherwise wraps in a fresh prisma.$transaction.
 */
export async function consumeCredits(
  userId: string,
  amount: string | Decimal,
  tx?: Prisma.TransactionClient,
): Promise<CreditConsumption> {
  const amt = amount instanceof Decimal ? amount : new Decimal(amount)
  if (amt.lessThanOrEqualTo(0)) {
    throw new AppError('Credit consumption amount must be greater than 0.', 'INVALID_AMOUNT', 400)
  }

  const exec = async (client: Prisma.TransactionClient): Promise<CreditConsumption> => {
    const grants = await client.creditGrant.findMany({
      where: {
        userId,
        amountRemaining: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    })

    const available = grants.reduce(
      (sum, g) => sum.plus(g.amountRemaining),
      new Decimal(0),
    )
    if (available.lessThan(amt)) {
      throw new AppError(
        'Insufficient credits.',
        'INSUFFICIENT_CREDITS',
        402,
        { requested: amt.toFixed(7), available: available.toFixed(7) },
      )
    }

    let remaining = amt
    const deductions: Array<{ grantId: string; deducted: string }> = []
    for (const grant of grants) {
      if (remaining.lessThanOrEqualTo(0)) break
      const take = Decimal.min(remaining, grant.amountRemaining)
      await client.creditGrant.update({
        where: { id: grant.id },
        data: { amountRemaining: { decrement: take } },
      })
      deductions.push({ grantId: grant.id, deducted: take.toFixed(7) })
      remaining = remaining.minus(take)
    }

    return { grants: deductions, total: amt.toFixed(7) }
  }

  return tx ? exec(tx) : prisma.$transaction(exec)
}

/** Default expiry window for new credit grants when admin doesn't override. */
export const CREDIT_DEFAULT_EXPIRY_DAYS = 60
