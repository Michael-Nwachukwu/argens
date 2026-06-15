/**
 * routes/agent.ts
 *
 * GET /agent/status   — agent health check: key, balance, policies, today's spend
 * GET /spend/summary  — spend aggregation by period (daily | weekly | monthly)
 */

import { type Router } from 'express'
import { Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { requireJwtOrApiKey } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { getUsdcBalance } from '../services/stellar.js'
import { getActiveCreditsBalance } from '../services/credits.js'
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

    // Today's spend — aggregate in DB to avoid float arithmetic
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const todayAgg = await prisma.transaction.aggregate({
      where: { userId, status: 'SUCCESS', createdAt: { gte: todayStart } },
      _sum: { amount: true },
      _count: { _all: true },
    })
    const todaySpend = (todayAgg._sum.amount ?? new Decimal(0)).toFixed(7)
    const todayCount = todayAgg._count._all

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
      credits_balance: wallet ? (await getActiveCreditsBalance(userId).catch(() => null))?.toFixed(7) ?? '0.0000000' : '0.0000000',
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

    const [agg, successTxs, blockedCount] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, status: 'SUCCESS', createdAt: { gte: periodStart } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.transaction.findMany({
        where: { userId, status: 'SUCCESS', createdAt: { gte: periodStart } },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 10000, // safety valve — prevents unbounded memory at high volume
      }),
      prisma.transaction.count({
        where: { userId, status: 'BLOCKED', createdAt: { gte: periodStart } },
      }),
    ])

    const totalSpent = (agg._sum.amount ?? new Decimal(0)).toFixed(7)

    // Group by date bucket (YYYY-MM-DD) using Decimal arithmetic — no float errors
    const buckets = new Map<string, { amount: Decimal; count: number }>()
    for (const tx of successTxs) {
      const key = tx.createdAt.toISOString().slice(0, 10)
      const cur = buckets.get(key) ?? { amount: new Decimal(0), count: 0 }
      buckets.set(key, { amount: cur.amount.plus(tx.amount), count: cur.count + 1 })
    }
    const breakdown = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({ date, amount: b.amount.toFixed(7), count: b.count }))

    sendSuccess(res, {
      period,
      total_spent: totalSpent,
      transaction_count: agg._count._all,
      blocked_count: blockedCount,
      breakdown,
    })
  } catch (err) {
    next(err)
  }
})
