/**
 * routes/wallet.ts
 *
 * GET  /wallet/balance — live USDC balance with 30s cache
 * POST /wallet/send   — manual dashboard transfer (JWT-only, with optional PIN)
 */

import { type Router } from 'express'
import { Router as ExpressRouter } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireJwt, requireJwtOrApiKey } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { getUsdcBalance, isStellarAddress, validateMemo } from '../services/stellar.js'
import { checkPolicy, incrementTotalSpent } from '../services/policy.js'
import { submitPayment, computeTotalDebited } from '../services/payment.js'
import { decryptSecretKey } from '../lib/crypto.js'
import { validate } from '../middleware/validate.js'
import { authLimiter, checkPinAttempt, resetPinAttempts } from '../middleware/ratelimit.js'
import { sendBlockedEmail, sendPendingApprovalEmail } from '../services/email.js'
import { generateSecureToken } from '../lib/crypto.js'
import { logger } from '../lib/logger.js'

export const walletRouter: Router = ExpressRouter()

const CACHE_TTL_MS = 30_000 // 30 seconds

// ─── Schemas ──────────────────────────────────────────────────────────────────

const AmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,7})?$/, 'Amount must be a string with up to 7 decimal places')
  .refine((v) => parseFloat(v) > 0, 'Amount must be greater than 0')

const SendSchema = z.object({
  recipient: z.string().min(1, 'Recipient is required'),
  amount: AmountSchema,
  memo: z.string().max(28).optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
})

// ─── GET /wallet/balance ──────────────────────────────────────────────────────

walletRouter.get('/wallet/balance', requireJwtOrApiKey, async (req, res, next) => {
  const userId = req.userId!

  try {
    const wallet = await prisma.wallet.findUnique({ where: { userId } })

    if (!wallet) {
      sendError(res, 'Wallet not found.', 'WALLET_NOT_FOUND', 404)
      return
    }

    if (wallet.status !== 'READY') {
      sendError(
        res,
        'Wallet is not ready. Bootstrap may still be in progress.',
        'WALLET_NOT_READY',
        503,
      )
      return
    }

    const now = new Date()
    const cacheAge = wallet.balanceCachedAt
      ? now.getTime() - wallet.balanceCachedAt.getTime()
      : Infinity

    let balance: string
    let cachedAt: string

    if (cacheAge < CACHE_TTL_MS) {
      // Serve from cache
      balance = wallet.balanceCache.toFixed(7)
      cachedAt = wallet.balanceCachedAt!.toISOString()
    } else {
      // Fetch live from Horizon and refresh cache
      try {
        const live = await getUsdcBalance(wallet.stellarPublicKey)
        if (live !== null) {
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balanceCache: live, balanceCachedAt: now },
          })
          balance = live
          cachedAt = now.toISOString()
        } else {
          // USDC trustline not found — return 0
          balance = '0.0000000'
          cachedAt = now.toISOString()
        }
      } catch (horizonErr) {
        // Horizon unavailable — fall back to stale cache rather than erroring
        logger.warn('Horizon balance fetch failed — serving stale cache', {
          userId,
          error: (horizonErr as Error).message,
        })
        balance = wallet.balanceCache.toFixed(7)
        cachedAt = wallet.balanceCachedAt?.toISOString() ?? now.toISOString()
      }
    }

    sendSuccess(res, {
      balance,
      currency: 'USDC',
      wallet_address: wallet.stellarPublicKey,
      cached_at: cachedAt,
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /wallet/send ────────────────────────────────────────────────────────
// Manual dashboard transfer with optional PIN protection

walletRouter.post('/wallet/send', requireJwt, authLimiter, validate(SendSchema), async (req, res, next) => {
  const userId = req.userId!
  const { recipient, amount, memo, pin } = req.body as z.infer<typeof SendSchema>

  try {
    // 1. Load user and verify PIN if set
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      sendError(res, 'User not found.', 'NOT_FOUND', 404)
      return
    }

    if (user.transferPinHash) {
      if (!pin) {
        sendError(res, 'Transfer PIN required.', 'PIN_REQUIRED', 422, {
          hint: 'Include your 4-digit PIN in the request body.',
        })
        return
      }

      const { allowed } = checkPinAttempt(userId)
      if (!allowed) {
        sendError(
          res,
          'Too many incorrect PIN attempts. Try again in 10 minutes.',
          'PIN_RATE_LIMITED',
          429,
        )
        return
      }

      const pinValid = await bcrypt.compare(pin, user.transferPinHash)
      if (!pinValid) {
        sendError(res, 'Incorrect transfer PIN.', 'PIN_INVALID', 401)
        return
      }

      resetPinAttempts(userId)
    }

    // 2. Validate recipient (Stellar only in V1)
    if (!isStellarAddress(recipient)) {
      sendError(
        res,
        'Invalid recipient address. Only Stellar addresses (G... 56 chars) are supported.',
        'INVALID_RECIPIENT',
        400,
      )
      return
    }

    // 3. Validate memo
    if (memo) {
      try {
        validateMemo(memo)
      } catch (e) {
        sendError(res, (e as Error).message, 'INVALID_MEMO', 400)
        return
      }
    }

    // 4. Load wallet
    const wallet = await prisma.wallet.findUnique({ where: { userId } })
    if (!wallet) {
      sendError(res, 'Wallet not found.', 'WALLET_NOT_FOUND', 404)
      return
    }
    if (wallet.status !== 'READY') {
      sendError(res, 'Wallet is not ready. Bootstrap may still be in progress.', 'WALLET_NOT_READY', 503)
      return
    }

    // 5. Run policy check
    const policyResult = await checkPolicy(userId, amount)

    // ── BLOCKED ─────────────────────────────────────────────────────────────
    if (policyResult.status === 'BLOCKED') {
      const tx = await prisma.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          recipientAddress: recipient,
          amount,
          fee: '0.0000000',
          currency: 'USDC',
          status: 'BLOCKED',
          memo,
          metadata: { source: 'dashboard' },
          policyResult: policyResult as unknown as object,
          blockedReason: policyResult.reason,
        },
      })

      void sendBlockedEmail(userId, tx.id, amount, recipient, policyResult.reason ?? 'policy_violation').catch(
        () => undefined,
      )

      sendError(res, 'Transaction blocked by policy', 'POLICY_BLOCKED', 402, {
        reason: policyResult.reason,
        policy: policyResult.policy,
      })
      return
    }

    // ── PENDING_APPROVAL ─────────────────────────────────────────────────────
    if (policyResult.status === 'PENDING_APPROVAL') {
      const token = generateSecureToken()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const tx = await prisma.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          recipientAddress: recipient,
          amount,
          fee: '0.0000000',
          currency: 'USDC',
          status: 'PENDING_APPROVAL',
          memo,
          metadata: { source: 'dashboard' },
          policyResult: policyResult as unknown as object,
          approvalQueue: {
            create: {
              userId,
              token,
              expiresAt,
            },
          },
        },
        include: { approvalQueue: true },
      })

      void sendPendingApprovalEmail(userId, tx.id, token, amount, recipient).catch(() => undefined)

      sendSuccess(
        res,
        {
          status: 'pending_approval',
          transaction_id: tx.id,
          message: 'Awaiting developer approval.',
          poll_url: `/v1/transactions/${tx.id}`,
        },
        202,
      )
      return
    }

    // ── APPROVED — submit Stellar tx ─────────────────────────────────────────
    const { fee, totalDebited } = computeTotalDebited(amount)

    const tx = await prisma.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        recipientAddress: recipient,
        amount,
        fee,
        currency: 'USDC',
        status: 'APPROVED',
        memo,
        metadata: { source: 'dashboard' },
        policyResult: policyResult as unknown as object,
      },
    })

    try {
      const secretKey = decryptSecretKey(wallet.stellarSecretKeyEnc)
      const stellarResult = await submitPayment({
        senderSecretKey: secretKey,
        recipientPublicKey: recipient,
        amount,
        memo: memo ?? null,
      })

      // Mark SUCCESS + record hash
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: 'SUCCESS',
          stellarTxHash: stellarResult.hash,
          fee: stellarResult.fee,
        },
      })

      // Increment totalSpent
      await incrementTotalSpent(userId, amount)

      // Refresh balance cache (fire-and-forget)
      void getUsdcBalance(wallet.stellarPublicKey)
        .then(async (live) => {
          if (live !== null) {
            await prisma.wallet.update({
              where: { id: wallet.id },
              data: { balanceCache: live, balanceCachedAt: new Date() },
            })
          }
        })
        .catch(() => undefined)

      sendSuccess(res, {
        status: 'success',
        transaction_id: tx.id,
        stellar_tx_hash: stellarResult.hash,
        amount,
        fee: stellarResult.fee,
        total_debited: stellarResult.totalDebited,
        recipient,
        timestamp: new Date().toISOString(),
        policy_check: {
          allowance:
            policyResult.detail.allowance === 'not_set' ? 'not_configured' : policyResult.detail.allowance,
          max_transaction:
            policyResult.detail.max_transaction === 'not_set'
              ? 'not_configured'
              : policyResult.detail.max_transaction,
          approval_threshold:
            policyResult.detail.approval_threshold === 'not_set'
              ? 'not_configured'
              : policyResult.detail.approval_threshold,
        },
      })
    } catch (stellarErr) {
      logger.error('Stellar payment failed (dashboard send)', {
        userId,
        transactionId: tx.id,
        error: (stellarErr as Error).message,
      })

      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: 'FAILED',
          blockedReason: (stellarErr as Error).message,
        },
      })

      sendError(res, 'Payment failed due to a Stellar network error.', 'STELLAR_PAYMENT_FAILED', 502, {
        error: (stellarErr as Error).message,
        transaction_id: tx.id,
      })
    }
  } catch (err) {
    next(err)
  }
})
