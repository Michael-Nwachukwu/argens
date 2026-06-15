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
 * Note: there is no waitlist admin endpoint here. Waitlist collection lives in
 * Tally (form id xX9AxG embedded on the landing page). Admin reviews waitlist
 * responses in Tally's UI and distributes generated access codes manually.
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
  amount: z.string().regex(/^\d+(\.\d{1,7})?$/, 'amount must be a decimal string with up to 7 places'),
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
    const user = await prisma.user.findUnique({ where: { email }, include: { wallet: true } })
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

// GET /admin/users/:userId — detail view: wallet, active credits, recent grants, transaction summary.
adminRouter.get('/users/:userId', async (req, res) => {
  const { userId } = req.params as { userId: string }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
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
        policies: true,
        creditGrants: { orderBy: [{ createdAt: 'desc' }], take: 20 },
        _count: { select: { transactions: true } },
      },
    })
    if (!user) {
      sendError(res, 'User not found.', 'NOT_FOUND', 404)
      return
    }
    const activeCredits = await prisma.creditGrant.aggregate({
      where: {
        userId,
        amountRemaining: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      _sum: { amountRemaining: true },
    })
    const txByStatus = await prisma.transaction.groupBy({
      by: ['status'],
      where: { userId },
      _count: { _all: true },
    })
    sendSuccess(res, {
      ...user,
      passwordHash: undefined,
      emailVerificationToken: undefined,
      transferPinHash: undefined,
      active_credits_balance: (activeCredits._sum.amountRemaining ?? new Decimal(0)).toFixed(7),
      tx_by_status: txByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    })
  } catch (e) {
    logger.error('Admin user detail failed', { userId, error: (e as Error).message })
    sendError(res, 'Could not load user.', 'INTERNAL_ERROR', 500)
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
