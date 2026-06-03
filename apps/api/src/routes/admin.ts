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
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { generateSecureToken } from '../lib/crypto.js'
import { sendSuccess, sendError, sendPaginated } from '../lib/response.js'
import { validate } from '../middleware/validate.js'
import { CREDIT_DEFAULT_EXPIRY_DAYS } from '../services/credits.js'

export const adminRouter: Router = ExpressRouter()

// ─── Admin auth middleware ─────────────────────────────────────────────────────

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env['ADMIN_SECRET']
  if (!expected) {
    logger.error('ADMIN_SECRET not configured — admin endpoints disabled')
    sendError(res, 'Admin endpoints are not enabled.', 'ADMIN_DISABLED', 503)
    return
  }
  const provided = req.header('x-admin-secret')
  if (!provided || provided !== expected) {
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

    logger.info('Admin granted credits', { userId, grantId: result.id, amount: amountDec.toFixed(7), expiresAt: expiry.toISOString() })
    sendSuccess(res, {
      grant_id: result.id,
      user_id: userId,
      amount: amountDec.toFixed(7),
      expires_at: expiry.toISOString(),
    }, 201)
  } catch (e) {
    logger.error('Admin credit grant failed', { userId, error: (e as Error).message })
    sendError(res, 'Could not grant credits.', 'INTERNAL_ERROR', 500)
  }
})
