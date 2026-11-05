/**
 * User-wallet balance cache + the low-balance warning email.
 *
 * Shared by every outgoing-payment path (/pay, /refund, /wallet/send, /pay/x402) so the
 * cache refresh, the threshold maths and the 24h email rate limit live in one place.
 */

import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '../lib/prisma.js'
import { getUsdcBalance } from './stellar.js'
import { sendLowBalanceEmail } from './email.js'

const LOW_BALANCE_FLOOR = new Decimal(10)
const LOW_BALANCE_EMAIL_INTERVAL_MS = 24 * 60 * 60 * 1000
const LOW_BALANCE_EVENT = 'LOW_BALANCE_EMAIL_SENT'

/** Warn below max(10 USDC, 10% of the remaining allowance). */
export function lowBalanceThreshold(
  policy: { allowanceLimit: Decimal | null; totalSpent: Decimal } | null,
): Decimal {
  if (!policy?.allowanceLimit) return LOW_BALANCE_FLOOR
  return Decimal.max(LOW_BALANCE_FLOOR, policy.allowanceLimit.minus(policy.totalSpent).mul('0.1'))
}

/** Reads the live USDC balance and stores it as the cache. Returns it, or null if unreadable. */
export async function refreshBalanceCache(walletId: string, publicKey: string): Promise<string | null> {
  const balance = await getUsdcBalance(publicKey)
  if (balance !== null) {
    await prisma.wallet.update({
      where: { id: walletId },
      data: { balanceCache: balance, balanceCachedAt: new Date() },
    })
  }
  return balance
}

/**
 * Refreshes the cache, THEN compares the fresh balance to the threshold — checking before
 * the refresh lands reads the pre-payment balance. Emails at most once per user per 24h;
 * the AuditLog row is the rate-limit record, so it survives restarts and multiple instances.
 */
export async function refreshBalanceAndWarn(userId: string, walletId: string, publicKey: string): Promise<void> {
  const balance = await refreshBalanceCache(walletId, publicKey)
  if (balance === null) return

  const policy = await prisma.policy.findUnique({ where: { userId } })
  const threshold = lowBalanceThreshold(policy)
  if (!new Decimal(balance).lessThan(threshold)) return

  const recent = await prisma.auditLog.findFirst({
    where: {
      userId,
      eventType: LOW_BALANCE_EVENT,
      createdAt: { gte: new Date(Date.now() - LOW_BALANCE_EMAIL_INTERVAL_MS) },
    },
    select: { id: true },
  })
  if (recent) return

  await prisma.auditLog.create({
    data: { userId, eventType: LOW_BALANCE_EVENT, eventData: { balance, threshold: threshold.toFixed(7) } },
  })
  await sendLowBalanceEmail(userId, balance, threshold.toFixed(7))
}
