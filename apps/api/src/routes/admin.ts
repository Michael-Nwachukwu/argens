/**
 * routes/admin.ts
 *
 * Admin endpoints — gated by ADMIN_SECRET env var checked against the
 * `x-admin-secret` header. No RBAC, no admin users: V1 model is a single
 * shared secret held by the operator.
 *
 * Routes:
 *   POST /admin/access-codes              — generate N codes (admin distributes manually)
 *   GET  /admin/access-codes              — list codes (with redemption status)
 *   POST /admin/users/:userId/credits     — grant credits to a user (Track 2)
 *
 * Signup is open (2026-11-05): access codes are no longer required, and the
 * Tally waitlist was removed. The access-code endpoints remain for history.
 */

import { type Router, type Request, type Response, type NextFunction } from 'express'
import { Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { timingSafeEqual, createHash } from 'crypto'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { generateSecureToken } from '../lib/crypto.js'
import { sendSuccess, sendError, sendPaginated } from '../lib/response.js'
import { validate } from '../middleware/validate.js'
import { CREDIT_DEFAULT_EXPIRY_DAYS } from '../services/credits.js'
import { getWalletBalancesReport } from '../services/admin-balances.js'
import { sendCreditsGrantedEmail } from '../services/email.js'
import { setGlobalServiceEnabled } from '../services/marketplace.js'
import {
  listMppRouterServices,
  providerKey,
  providerKeyFromServiceId,
  providerDisplayName,
} from '../services/mpp-router.js'
import { AppError } from '../lib/errors.js'
import { emailMatches, byEmailOldestFirst } from '../services/user.js'
import { DecimalAmountSchema } from '../lib/money.js'
import { getUsdcBalance } from '../services/stellar.js'

export const adminRouter: Router = ExpressRouter()

// ─── Admin auth middleware ─────────────────────────────────────────────────────

export function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env['ADMIN_SECRET']
  if (!expected) {
    logger.error('ADMIN_SECRET not configured — admin endpoints disabled')
    sendError(res, 'Admin endpoints are not enabled.', 'ADMIN_DISABLED', 503)
    return
  }
  const provided = req.header('x-admin-secret')
  if (!provided || !secretsMatch(provided, expected)) {
    sendError(res, 'Unauthorized.', 'UNAUTHORIZED', 401)
    return
  }
  next()
}

adminRouter.use(requireAdmin)

// ─── Access codes ──────────────────────────────────────────────────────────────

const ACCESS_CODE_PREFIX = 'argns_beta_'

function generateAccessCode(): string {
  // ~8 char suffix taken from a hex token; collisions are astronomically unlikely
  // but the @unique on `code` would reject a duplicate anyway.
  return ACCESS_CODE_PREFIX + generateSecureToken().slice(0, 8)
}

const createCodesSchema = z.object({
  count: z.number().int().min(1).max(50),
  note: z.string().max(200).optional(),
  expiresAt: z.string().datetime().optional(),
})

adminRouter.post('/access-codes', validate(createCodesSchema), async (req, res) => {
  const { count, note, expiresAt } = req.body as z.infer<typeof createCodesSchema>

  try {
    const expiry = expiresAt ? new Date(expiresAt) : null
    const codes: { code: string; note: string | null }[] = []

    // Each is its own row — small N, no need to batch.
    for (let i = 0; i < count; i++) {
      const row = await prisma.accessCode.create({
        data: { code: generateAccessCode(), note: note ?? null, expiresAt: expiry },
      })
      codes.push({ code: row.code, note: row.note })
    }

    logger.info('Admin generated access codes', { count, note: note ?? null })
    sendSuccess(res, { codes, count: codes.length }, 201)
  } catch (e) {
    logger.error('Admin access-code creation failed', { error: (e as Error).message })
    sendError(res, 'Could not create access codes.', 'INTERNAL_ERROR', 500)
  }
})

adminRouter.get('/access-codes', async (req, res) => {
  const page  = Math.max(1, parseInt(String(req.query['page']  ?? '1'),  10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50))
  const skip  = (page - 1) * limit

  try {
    const [items, total] = await Promise.all([
      prisma.accessCode.findMany({
        orderBy: [{ createdAt: 'desc' }],
        skip, take: limit,
      }),
      prisma.accessCode.count(),
    ])
    sendPaginated(res, items, { page, total, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (e) {
    logger.error('Admin access-code list failed', { error: (e as Error).message })
    sendError(res, 'Could not list access codes.', 'INTERNAL_ERROR', 500)
  }
})

// ─── Credit grants (Track 2) ───────────────────────────────────────────────────

const grantCreditsSchema = z.object({
  amount: DecimalAmountSchema,
  reason: z.string().max(200).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  expiresAt: z.string().datetime().optional(), // overrides expiresInDays if both set
})

adminRouter.post('/users/:userId/credits', validate(grantCreditsSchema), async (req, res) => {
  const { userId } = req.params as { userId: string }
  const { amount, reason, expiresInDays, expiresAt } = req.body as z.infer<typeof grantCreditsSchema>

  try {
    const amountDec = new Decimal(amount)
    if (amountDec.lessThanOrEqualTo(0)) {
      sendError(res, 'Amount must be greater than 0.', 'INVALID_AMOUNT', 400)
      return
    }

    const expiry = expiresAt
      ? new Date(expiresAt)
      : new Date(Date.now() + (expiresInDays ?? CREDIT_DEFAULT_EXPIRY_DAYS) * 24 * 60 * 60 * 1000)

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { wallet: true } })
    if (!user) {
      sendError(res, 'User not found.', 'NOT_FOUND', 404)
      return
    }
    if (!user.wallet) {
      sendError(res, 'User has no wallet (email not verified yet).', 'WALLET_NOT_READY', 400)
      return
    }

    const result = await prisma.$transaction(async (tx) => {
      const grant = await tx.creditGrant.create({
        data: {
          userId,
          amount: amountDec,
          amountRemaining: amountDec,
          reason: reason ?? null,
          expiresAt: expiry,
        },
      })
      await tx.wallet.update({
        where: { id: user.wallet!.id },
        data: { creditsGranted: { increment: amountDec } },
      })
      await tx.auditLog.create({
        data: {
          userId,
          eventType: 'CREDITS_GRANTED',
          eventData: {
            grantId: grant.id,
            amount: amountDec.toFixed(7),
            reason: reason ?? null,
            expiresAt: expiry.toISOString(),
          },
        },
      })
      return grant
    })

    const notification = await sendCreditGrantNotification(userId, amountDec.toFixed(7), expiry, reason ?? null)

    logger.info('Admin granted credits', { userId, grantId: result.id, amount: amountDec.toFixed(7), expiresAt: expiry.toISOString() })
    sendSuccess(res, {
      grant_id: result.id,
      user_id: userId,
      amount: amountDec.toFixed(7),
      expires_at: expiry.toISOString(),
      notification,
    }, 201)
  } catch (e) {
    logger.error('Admin credit grant failed', { userId, error: (e as Error).message })
    sendError(res, 'Could not grant credits.', 'INTERNAL_ERROR', 500)
  }
})

// Convenience: grant credits by email instead of user ID, so admin doesn't need to look up the ID first.
const grantByEmailSchema = grantCreditsSchema.extend({
  email: z.string().email(),
})

adminRouter.post('/credits/grant-by-email', validate(grantByEmailSchema), async (req, res) => {
  const { email, amount, reason, expiresInDays, expiresAt } = req.body as z.infer<typeof grantByEmailSchema>
  try {
    const amountDec = new Decimal(amount)
    if (amountDec.lessThanOrEqualTo(0)) {
      sendError(res, 'Amount must be greater than 0.', 'INVALID_AMOUNT', 400)
      return
    }
    const user = await prisma.user.findFirst({
      where: emailMatches(email),
      orderBy: byEmailOldestFirst,
      include: { wallet: true },
    })
    if (!user) {
      sendError(res, 'No user with that email.', 'NOT_FOUND', 404)
      return
    }
    if (!user.wallet) {
      sendError(res, 'User has no wallet (email not verified yet).', 'WALLET_NOT_READY', 400)
      return
    }
    const expiry = expiresAt
      ? new Date(expiresAt)
      : new Date(Date.now() + (expiresInDays ?? CREDIT_DEFAULT_EXPIRY_DAYS) * 24 * 60 * 60 * 1000)

    const result = await prisma.$transaction(async (tx) => {
      const grant = await tx.creditGrant.create({
        data: { userId: user.id, amount: amountDec, amountRemaining: amountDec, reason: reason ?? null, expiresAt: expiry },
      })
      await tx.wallet.update({
        where: { id: user.wallet!.id },
        data: { creditsGranted: { increment: amountDec } },
      })
      await tx.auditLog.create({
        data: {
          userId: user.id,
          eventType: 'CREDITS_GRANTED',
          eventData: { grantId: grant.id, amount: amountDec.toFixed(7), reason: reason ?? null, expiresAt: expiry.toISOString(), via: 'email' },
        },
      })
      return grant
    })

    const notification = await sendCreditGrantNotification(user.id, amountDec.toFixed(7), expiry, reason ?? null)

    logger.info('Admin granted credits by email', { email, userId: user.id, grantId: result.id, amount: amountDec.toFixed(7) })
    sendSuccess(res, {
      grant_id: result.id,
      user_id: user.id,
      email,
      amount: amountDec.toFixed(7),
      expires_at: expiry.toISOString(),
      notification,
    }, 201)
  } catch (e) {
    logger.error('Admin credit grant-by-email failed', { email, error: (e as Error).message })
    sendError(res, 'Could not grant credits.', 'INTERNAL_ERROR', 500)
  }
})

// ─── Dashboard read endpoints ──────────────────────────────────────────────────

// GET /admin/stats — top-level counts for the dashboard summary cards.
adminRouter.get('/stats', async (_req, res) => {
  try {
    const [
      usersTotal,
      usersVerified,
      codesTotal,
      codesRedeemed,
      grantsActive,
      grantsActiveSum,
      txTotal,
      txFailed,
      txPendingApproval,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.accessCode.count(),
      prisma.accessCode.count({ where: { redeemedBy: { not: null } } }),
      prisma.creditGrant.count({
        where: {
          amountRemaining: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
      prisma.creditGrant.aggregate({
        where: {
          amountRemaining: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        _sum: { amountRemaining: true },
      }),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: 'FAILED' } }),
      prisma.transaction.count({ where: { status: 'PENDING_APPROVAL' } }),
    ])
    sendSuccess(res, {
      users: { total: usersTotal, verified: usersVerified },
      access_codes: { total: codesTotal, redeemed: codesRedeemed, unredeemed: codesTotal - codesRedeemed },
      credits: {
        active_grants: grantsActive,
        outstanding_total: (grantsActiveSum._sum.amountRemaining ?? new Decimal(0)).toFixed(7),
      },
      transactions: { total: txTotal, failed: txFailed, pending_approval: txPendingApproval },
    })
  } catch (e) {
    logger.error('Admin stats failed', { error: (e as Error).message })
    sendError(res, 'Could not load stats.', 'INTERNAL_ERROR', 500)
  }
})

// GET /admin/wallets — live balances for ops/fee/pool Stellar wallets + Base relayer ETH.
adminRouter.get('/wallets', async (_req, res) => {
  try {
    const report = await getWalletBalancesReport()
    sendSuccess(res, report)
  } catch (e) {
    logger.error('Admin wallet balances failed', { error: (e as Error).message })
    sendError(res, 'Could not load wallet balances.', 'INTERNAL_ERROR', 500)
  }
})

// GET /admin/users — paginated list with optional ?email= filter (partial match).
adminRouter.get('/users', async (req, res) => {
  const page  = Math.max(1, parseInt(String(req.query['page']  ?? '1'),  10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50))
  const skip  = (page - 1) * limit
  const emailFilter = typeof req.query['email'] === 'string' ? req.query['email'].trim() : ''
  const where = emailFilter ? { email: { contains: emailFilter, mode: 'insensitive' as const } } : {}

  try {
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip, take: limit,
        select: {
          id: true,
          email: true,
          emailVerified: true,
          accessCodeId: true,
          createdAt: true,
          wallet: { select: { stellarPublicKey: true, status: true, balanceCache: true, creditsGranted: true } },
          _count: { select: { transactions: true } },
        },
      }),
      prisma.user.count({ where }),
    ])
    sendPaginated(res, items, { page, total, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (e) {
    logger.error('Admin users list failed', { error: (e as Error).message })
    sendError(res, 'Could not list users.', 'INTERNAL_ERROR', 500)
  }
})

// GET /admin/users/:userId — everything the ops console's user sheet shows: account, wallet
// with a live USDC balance, credits, policy, API keys, spend totals and recent activity.
// Selects fields explicitly: password/PIN hashes and verification/reset tokens never leave.
adminRouter.get('/users/:userId', async (req, res) => {
  const { userId } = req.params as { userId: string }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        accessCodeId: true,
        createdAt: true,
        updatedAt: true,
        transferPinHash: true, // read only to report pin_set; stripped below
        wallet: {
          select: {
            id: true,
            stellarPublicKey: true,
            status: true,
            balanceCache: true,
            balanceCachedAt: true,
            creditsGranted: true,
            createdAt: true,
          },
        },
        policies: {
          select: { allowanceLimit: true, maxTransactionLimit: true, approvalThreshold: true, totalSpent: true, updatedAt: true },
        },
        apiKeys: {
          orderBy: [{ createdAt: 'desc' }],
          select: { id: true, keyPrefix: true, isActive: true, lastUsedAt: true, createdAt: true },
        },
        creditGrants: { orderBy: [{ createdAt: 'desc' }], take: 20 },
        _count: { select: { transactions: true } },
      },
    })
    if (!user) {
      sendError(res, 'User not found.', 'NOT_FOUND', 404)
      return
    }

    const [activeCredits, txByStatus, spendByType, activity, liveUsdc] = await Promise.all([
      prisma.creditGrant.aggregate({
        where: {
          userId,
          amountRemaining: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        _sum: { amountRemaining: true },
      }),
      prisma.transaction.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
      prisma.transaction.groupBy({
        by: ['type'],
        where: { userId, status: 'SUCCESS' },
        _count: { _all: true },
        _sum: { amount: true, costPaid: true },
      }),
      prisma.auditLog.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }],
        take: 30,
        select: { id: true, eventType: true, eventData: true, createdAt: true },
      }),
      // Live read so ops sees the real balance, not a cache that only refreshes on activity.
      user.wallet
        ? getUsdcBalance(user.wallet.stellarPublicKey).catch((e: unknown) => {
            logger.warn('Admin user detail: live USDC read failed, using cache', { userId, error: (e as Error).message })
            return null
          })
        : Promise.resolve(null),
    ])

    // Marketplace rows charge costPaid (cost + markup); direct payments charge amount.
    const spend = spendByType.map((r) => ({
      type: r.type,
      count: r._count._all,
      total: ((r.type === 'marketplace' ? r._sum.costPaid : null) ?? r._sum.amount ?? new Decimal(0)).toFixed(7),
    }))

    const { transferPinHash, ...safeUser } = user
    sendSuccess(res, {
      ...safeUser,
      transfer_pin_set: transferPinHash !== null,
      usdc_live: liveUsdc,
      active_credits_balance: (activeCredits._sum.amountRemaining ?? new Decimal(0)).toFixed(7),
      tx_by_status: txByStatus.map((r) => ({ status: r.status, count: r._count._all })),
      spend_by_type: spend,
      activity,
    })
  } catch (e) {
    logger.error('Admin user detail failed', { userId, error: (e as Error).message })
    sendError(res, 'Could not load user.', 'INTERNAL_ERROR', 500)
  }
})

// GET /admin/users/:userId/transactions — paginated, newest first, optional ?status= filter.
const TX_STATUSES = ['SUCCESS', 'BLOCKED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FAILED'] as const

adminRouter.get('/users/:userId/transactions', async (req, res) => {
  const { userId } = req.params as { userId: string }
  const page  = Math.max(1, parseInt(String(req.query['page']  ?? '1'),  10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '25'), 10) || 25))
  const statusParam = typeof req.query['status'] === 'string' ? req.query['status'] : ''
  const status = (TX_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as (typeof TX_STATUSES)[number])
    : undefined
  const where = { userId, ...(status ? { status } : {}) }

  try {
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          amount: true,
          costPaid: true,
          currency: true,
          recipientAddress: true,
          serviceId: true,
          memo: true,
          stellarTxHash: true,
          crossChain: true,
          destinationChain: true,
          destinationTxHash: true,
          blockedReason: true,
          createdAt: true,
        },
      }),
      prisma.transaction.count({ where }),
    ])
    sendPaginated(res, items, { page, total, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (e) {
    logger.error('Admin user transactions failed', { userId, error: (e as Error).message })
    sendError(res, 'Could not list transactions.', 'INTERNAL_ERROR', 500)
  }
})

// GET /admin/credit-grants — paginated list of all grants across users.
adminRouter.get('/credit-grants', async (req, res) => {
  const page  = Math.max(1, parseInt(String(req.query['page']  ?? '1'),  10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50))
  const skip  = (page - 1) * limit
  try {
    const [items, total] = await Promise.all([
      prisma.creditGrant.findMany({
        orderBy: [{ createdAt: 'desc' }],
        skip, take: limit,
        include: { user: { select: { email: true } } },
      }),
      prisma.creditGrant.count(),
    ])
    sendPaginated(res, items, { page, total, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (e) {
    logger.error('Admin credit-grants list failed', { error: (e as Error).message })
    sendError(res, 'Could not list credit grants.', 'INTERNAL_ERROR', 500)
  }
})

// GET /admin/transactions/failed — paginated list of FAILED transactions (manual reconciliation queue).
adminRouter.get('/transactions/failed', async (req, res) => {
  const page  = Math.max(1, parseInt(String(req.query['page']  ?? '1'),  10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '50'), 10) || 50))
  const skip  = (page - 1) * limit
  try {
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { status: 'FAILED' },
        orderBy: [{ createdAt: 'desc' }],
        skip, take: limit,
        include: { user: { select: { email: true } } },
      }),
      prisma.transaction.count({ where: { status: 'FAILED' } }),
    ])
    sendPaginated(res, items, { page, total, pages: Math.max(1, Math.ceil(total / limit)) })
  } catch (e) {
    logger.error('Admin failed-tx list failed', { error: (e as Error).message })
    sendError(res, 'Could not list failed transactions.', 'INTERNAL_ERROR', 500)
  }
})

// ─── Marketplace global kill-switch (Track A) ──────────────────────────────────

// GET /admin/marketplace/services — every provider with its global enabled state,
// note, endpoint count, and FAILED / refund-required transaction counts for triage.
adminRouter.get('/marketplace/services', async (_req, res) => {
  try {
    const [services, settings, failedByService, refundByService] = await Promise.all([
      listMppRouterServices(),
      prisma.globalServiceSetting.findMany(),
      prisma.transaction.groupBy({
        by: ['serviceId'],
        where: { type: 'marketplace', status: 'FAILED', serviceId: { not: null } },
        _count: { _all: true },
      }),
      prisma.transaction.groupBy({
        by: ['serviceId'],
        where: {
          type: 'marketplace',
          status: 'FAILED',
          serviceId: { not: null },
          metadata: { path: ['refund', 'required'], equals: true },
        },
        _count: { _all: true },
      }),
    ])

    const settingByProvider = new Map(settings.map((s) => [s.providerId, s]))

    // Endpoint serviceId → provider key, then aggregate counts to the provider.
    const failedByProvider = new Map<string, number>()
    for (const row of failedByService) {
      if (!row.serviceId) continue
      const key = providerKeyFromServiceId(row.serviceId)
      failedByProvider.set(key, (failedByProvider.get(key) ?? 0) + row._count._all)
    }
    const refundByProvider = new Map<string, number>()
    for (const row of refundByService) {
      if (!row.serviceId) continue
      const key = providerKeyFromServiceId(row.serviceId)
      refundByProvider.set(key, (refundByProvider.get(key) ?? 0) + row._count._all)
    }

    const groups = new Map<string, { name: string; count: number }>()
    for (const svc of services) {
      const key = providerKey(svc)
      const g = groups.get(key)
      if (g) g.count += 1
      else groups.set(key, { name: providerDisplayName(svc), count: 1 })
    }

    const providers = [...groups.entries()]
      .map(([id, g]) => {
        const setting = settingByProvider.get(id)
        return {
          provider_id: id,
          name: g.name,
          endpoint_count: g.count,
          enabled: setting ? setting.enabled : true, // absence = enabled
          note: setting?.note ?? null,
          failed_count: failedByProvider.get(id) ?? 0,
          refund_required_count: refundByProvider.get(id) ?? 0,
          updated_at: setting?.updatedAt ?? null,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    sendSuccess(res, { providers, total: providers.length })
  } catch (e) {
    logger.error('Admin marketplace services list failed', { error: (e as Error).message })
    sendError(res, 'Could not list marketplace services.', 'INTERNAL_ERROR', 500)
  }
})

const toggleServiceSchema = z.object({
  enabled: z.boolean(),
  note: z.string().max(280).optional(),
})

// POST /admin/marketplace/services/:providerId — pause/resume a provider platform-wide.
adminRouter.post('/marketplace/services/:providerId', validate(toggleServiceSchema), async (req, res) => {
  const { providerId } = req.params as { providerId: string }
  const { enabled, note } = req.body as z.infer<typeof toggleServiceSchema>
  try {
    const result = await setGlobalServiceEnabled(providerId, enabled, note)
    // No AuditLog row: AuditLog.userId is a required FK to User and a global
    // toggle has no associated user. The structured log below is the audit trail.
    logger.info('Admin toggled global marketplace service', { providerId, enabled, note: note ?? null })
    sendSuccess(res, result)
  } catch (e) {
    if (e instanceof AppError) {
      sendError(res, e.message, e.code, e.statusCode, e.details)
      return
    }
    logger.error('Admin marketplace toggle failed', { providerId, error: (e as Error).message })
    sendError(res, 'Could not update marketplace service.', 'INTERNAL_ERROR', 500)
  }
})

async function sendCreditGrantNotification(
  userId: string,
  amount: string,
  expiresAt: Date,
  reason: string | null,
): Promise<{ sent: boolean; error?: string }> {
  try {
    await sendCreditsGrantedEmail(userId, amount, expiresAt, reason)
    return { sent: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    logger.error('Failed to send credit grant email', { userId, error })
    return { sent: false, error }
  }
}
