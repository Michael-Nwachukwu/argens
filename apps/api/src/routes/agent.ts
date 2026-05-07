/**
 * routes/agent.ts
 *
 * GET /agent/status   — agent health check: key, balance, policies, today's spend
 * GET /spend/summary  — spend aggregation by period (daily | weekly | monthly)
 */

import { type Router } from 'express'
import { Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { requireJwtOrApiKey } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { getUsdcBalance } from '../services/stellar.js'
import { logger } from '../lib/logger.js'

export const agentRouter: Router = ExpressRouter()

// ─── GET /agent/status ────────────────────────────────────────────────────────

agentRouter.get('/agent/status', requireJwtOrApiKey, async (req, res, next) => {
  const userId = req.userId!

  try {
    const [wallet, policy, apiKey] = await Promise.all([
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.policy.findUnique({ where: { userId } }),
      // Find the most recently used active key for this user
      prisma.apiKey.findFirst({
        where: { userId, isActive: true },
        orderBy: { lastUsedAt: 'desc' },
      }),
    ])

    // Wallet balance — use cache if fresh, otherwise refresh
    let walletBalance = '0.0000000'
    if (wallet?.status === 'READY') {
      const CACHE_TTL_MS = 30_000
      const cacheAge = wallet.balanceCachedAt
        ? Date.now() - wallet.balanceCachedAt.getTime()
        : Infinity

      if (cacheAge < CACHE_TTL_MS) {
        walletBalance = wallet.balanceCache.toFixed(7)
      } else {
        try {
          const live = await getUsdcBalance(wallet.stellarPublicKey)
          if (live !== null) {
            walletBalance = live
            void prisma.wallet.update({
              where: { id: wallet.id },
              data: { balanceCache: live, balanceCachedAt: new Date() },
            })
          }
        } catch (e) {
          logger.warn('Balance fetch failed in /agent/status — using cache', {
            userId,
            error: (e as Error).message,
          })
          walletBalance = wallet.balanceCache.toFixed(7)
        }
      }
    }

    // Today's spend
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayTxs = await prisma.transaction.findMany({
      where: {
        userId,
        status: 'SUCCESS',
        createdAt: { gte: todayStart },
      },
      select: { amount: true },
    })

    const todaySpend = todayTxs
      .reduce((sum, tx) => sum + parseFloat(tx.amount.toFixed(7)), 0)
      .toFixed(7)

    const todayCount = todayTxs.length

    // Policy snapshot
    const policyData = policy
      ? {
          allowance_limit: policy.allowanceLimit?.toFixed(7) ?? null,
          allowance_remaining: policy.allowanceLimit
            ? policy.allowanceLimit.minus(policy.totalSpent).toFixed(7)
            : null,
          max_transaction_limit: policy.maxTransactionLimit?.toFixed(7) ?? null,
          approval_threshold: policy.approvalThreshold?.toFixed(7) ?? null,
        }
      : null

    sendSuccess(res, {
      api_key_status: apiKey?.isActive ? 'active' : 'inactive',
      wallet_status: wallet?.status ?? 'not_found',
      wallet_balance: walletBalance,
      policies: policyData,
      today_spend: todaySpend,
      today_transactions: todayCount,
    })
  } catch (err) {
    next(err)
  }
})

// ─── GET /spend/summary ───────────────────────────────────────────────────────

const SpendSummarySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
})

agentRouter.get('/spend/summary', requireJwtOrApiKey, async (req, res, next) => {
  const userId = req.userId!

  try {
    const parsed = SpendSummarySchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, 'Invalid query parameters', 'VALIDATION_ERROR', 400)
      return
    }
    const { period } = parsed.data

    const now = new Date()
    let periodStart: Date

    switch (period) {
      case 'daily':
        periodStart = new Date(now)
        periodStart.setHours(0, 0, 0, 0)
        break
      case 'weekly':
        periodStart = new Date(now)
        periodStart.setDate(now.getDate() - now.getDay()) // Sunday
        periodStart.setHours(0, 0, 0, 0)
        break
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
        break
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        status: 'SUCCESS',
        createdAt: { gte: periodStart },
      },
      select: {
        id: true,
        amount: true,
        recipientAddress: true,
        createdAt: true,
        memo: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const totalSpend = transactions
      .reduce((sum, tx) => sum + parseFloat(tx.amount.toFixed(7)), 0)
      .toFixed(7)

    sendSuccess(res, {
      period,
      period_start: periodStart.toISOString(),
      period_end: now.toISOString(),
      total_spend: totalSpend,
      transaction_count: transactions.length,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        amount: tx.amount.toFixed(7),
        recipient: tx.recipientAddress,
        memo: tx.memo,
        timestamp: tx.createdAt,
      })),
    })
  } catch (err) {
    next(err)
  }
})
