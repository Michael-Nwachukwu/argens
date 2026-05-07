/**
 * routes/approve.ts
 *
 * POST /approve/:token — approve a pending transaction (dashboard form submits this)
 * POST /reject/:token  — reject a pending transaction (dashboard form submits this)
 *
 * Security: tokens are single-use, expire after 24h.
 * NEVER expose GET endpoints that perform state changes — email scanners auto-fetch GET URLs.
 * The email links to a dashboard confirmation page; the dashboard submits POST here.
 * (CLAUDE.md Security Rules)
 */

import { type Router } from 'express'
import { Router as ExpressRouter } from 'express'
import { requireJwt } from '../middleware/auth.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { decryptSecretKey } from '../lib/crypto.js'
import { submitPayment } from '../services/payment.js'
import { checkPolicy, incrementTotalSpent } from '../services/policy.js'
import { sendApprovalActedEmail } from '../services/email.js'

export const approveRouter: Router = ExpressRouter()

// ─── POST /approve/:token ─────────────────────────────────────────────────────

approveRouter.post('/approve/:token', requireJwt, async (req, res, next) => {
  const tokenParam = req.params.token
  if (!tokenParam || Array.isArray(tokenParam)) {
    sendError(res, 'Invalid token parameter', 'INVALID_REQUEST', 400)
    return
  }
  const userId = req.userId!

  try {
    const entry = await findAndValidateToken(tokenParam, userId)
    if (!entry) {
      sendError(
        res,
        'Approval token is invalid, expired, or already used.',
        'INVALID_TOKEN',
        400,
      )
      return
    }

    const { queue, transaction } = entry

    // Mark token consumed immediately (single-use)
    await prisma.approvalQueue.update({
      where: { id: queue.id },
      data: { status: 'APPROVED', actedAt: new Date() },
    })

    // Re-run policy check (amount could now violate a freshly changed policy)
    const amount = transaction.amount.toFixed(7)
    const policyResult = await checkPolicy(userId, amount)

    if (policyResult.status === 'BLOCKED') {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'BLOCKED', blockedReason: policyResult.reason || null },
      })

      sendError(
        res,
        'Transaction blocked by current policy at time of approval.',
        'POLICY_BLOCKED',
        402,
        { reason: policyResult.reason },
      )
      return
    }

    // Load wallet
    const wallet = await prisma.wallet.findUnique({
      where: { id: transaction.walletId },
    })

    if (!wallet || wallet.status !== 'READY') {
      sendError(res, 'Wallet not ready.', 'WALLET_NOT_READY', 503)
      return
    }

    // Execute Stellar payment
    try {
      const secretKey = decryptSecretKey(wallet.stellarSecretKeyEnc)
      const stellarResult = await submitPayment({
        senderSecretKey: secretKey,
        recipientPublicKey: transaction.recipientAddress,
        amount,
        memo: transaction.memo ?? null,
      })

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'SUCCESS', stellarTxHash: stellarResult.hash },
      })

      await incrementTotalSpent(userId, amount)

      void sendApprovalActedEmail(userId, transaction.id, 'approved', amount).catch(
        (e: unknown) =>
          logger.error('Failed to send approval acted email', {
            userId,
            error: (e as Error).message,
          }),
      )

      sendSuccess(res, {
        status: 'approved',
        transaction_id: transaction.id,
        stellar_tx_hash: stellarResult.hash,
        amount,
      })
    } catch (stellarErr) {
      logger.error('Stellar payment failed on approval', {
        userId,
        transactionId: transaction.id,
        error: (stellarErr as Error).message,
      })

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          blockedReason: (stellarErr as Error).message,
        },
      })

      sendError(res, 'Payment failed after approval due to Stellar error.', 'STELLAR_PAYMENT_FAILED', 502, {
        transaction_id: transaction.id,
      })
    }
  } catch (err) {
    next(err)
  }
})

// ─── POST /reject/:token ──────────────────────────────────────────────────────

approveRouter.post('/reject/:token', requireJwt, async (req, res, next) => {
  const tokenParam = req.params.token
  if (!tokenParam || Array.isArray(tokenParam)) {
    sendError(res, 'Invalid token parameter', 'INVALID_REQUEST', 400)
    return
  }
  const userId = req.userId!

  try {
    const entry = await findAndValidateToken(tokenParam, userId)
    if (!entry) {
      sendError(
        res,
        'Approval token is invalid, expired, or already used.',
        'INVALID_TOKEN',
        400,
      )
      return
    }

    const { queue, transaction } = entry

    // Mark rejected (single-use, consumed)
    await prisma.approvalQueue.update({
      where: { id: queue.id },
      data: { status: 'REJECTED', actedAt: new Date() },
    })

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'REJECTED' },
    })

    void sendApprovalActedEmail(
      userId,
      transaction.id,
      'rejected',
      transaction.amount.toFixed(7),
    ).catch((e: unknown) =>
      logger.error('Failed to send rejection email', {
        userId,
        error: (e as Error).message,
      }),
    )

    sendSuccess(res, {
      status: 'rejected',
      transaction_id: transaction.id,
      message: 'Transaction rejected. No payment was made.',
    })
  } catch (err) {
    next(err)
  }
})

// ─── Helper ───────────────────────────────────────────────────────────────────

async function findAndValidateToken(token: string, userId: string) {
  const queue = await prisma.approvalQueue.findUnique({
    where: { token },
    include: { transaction: true },
  })

  // Token must exist, belong to this user, be PENDING, and not expired
  if (!queue) return null
  if (queue.userId !== userId) return null
  if (queue.status !== 'PENDING') return null
  if (queue.expiresAt < new Date()) {
    // Mark expired
    await prisma.approvalQueue.update({
      where: { id: queue.id },
      data: { status: 'EXPIRED' },
    })
    return null
  }

  return { queue, transaction: queue.transaction }
}
