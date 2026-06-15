/**
 * routes/approve.ts
 *
 * GET  /approve/:token — read the pending transaction behind an approval token
 *                        (public — the 256-bit single-use token IS the bearer auth;
 *                         the email confirmation page calls this without a session)
 * POST /approve/:token — approve a pending transaction (confirmation page submits this)
 * POST /reject/:token  — reject a pending transaction (confirmation page submits this)
 *
 * Security: tokens are crypto.randomBytes(32) hex, single-use, expire after 24h, and are
 * only ever delivered to the account owner's email — that is sufficient authorisation.
 * NEVER expose GET endpoints that perform STATE CHANGES — email scanners auto-fetch GET URLs.
 * GET /approve/:token is read-only/idempotent (it only lazily flips an already-expired token
 * to EXPIRED), so it is safe for scanners to hit.
 * (CLAUDE.md Security Rules)
 */

import { type Router } from 'express'
import { Router as ExpressRouter } from 'express'
import type { ApprovalQueue, Transaction } from '@prisma/client'
import { sendSuccess, sendError } from '../lib/response.js'
import { AppError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { decryptSecretKey } from '../lib/crypto.js'
import { submitPayment } from '../services/payment.js'
import { checkPolicy, incrementTotalSpent } from '../services/policy.js'
import { sendApprovalActedEmail } from '../services/email.js'
import { executeApprovedMarketplaceTransaction } from '../services/marketplace.js'
import { isEvmAddress } from '../services/stellar.js'
import {
  burnUsdcOnStellar,
  encodeEvmRecipient,
  computeCctpFee,
  verifyCctpPreflightBalance,
  CCTP_FEE_RATE,
  BASE_DOMAIN,
} from '../services/cctp.js'
import { enqueueRelay } from '../services/cctp-relay.js'

export const approveRouter: Router = ExpressRouter()

// ─── GET /approve/:token ──────────────────────────────────────────────────────
// Read-only summary of the transaction behind a token, so the confirmation page can
// render it before the user approves/rejects. No session required — the token is the bearer.

approveRouter.get('/approve/:token', async (req, res, next) => {
  const tokenParam = req.params.token
  if (!tokenParam || Array.isArray(tokenParam)) {
    sendError(res, 'Invalid token parameter', 'INVALID_REQUEST', 400)
    return
  }

  try {
    const queue = await prisma.approvalQueue.findUnique({
      where: { token: tokenParam },
      include: { transaction: true },
    })

    if (!queue) {
      sendError(res, 'Approval link is invalid.', 'INVALID_TOKEN', 404)
      return
    }

    // Lazily mark an already-expired pending token so the page shows the right state.
    let status = queue.status
    if (status === 'PENDING' && queue.expiresAt < new Date()) {
      await prisma.approvalQueue.update({ where: { id: queue.id }, data: { status: 'EXPIRED' } })
      status = 'EXPIRED'
    }

    const tx = queue.transaction
    sendSuccess(res, {
      transaction: {
        id: tx.id,
        status: tx.status,
        type: tx.type,
        recipient: tx.recipientAddress,
        amount: tx.amount.toFixed(7),
        currency: tx.currency,
        memo: tx.memo,
        service_id: tx.serviceId,
        cost_paid: tx.costPaid?.toFixed(7) ?? null,
        destination_chain: tx.destinationChain,
        destination_tx_hash: tx.destinationTxHash,
        cross_chain: tx.crossChain,
        created_at: tx.createdAt,
      },
      approval: {
        status,
        expires_at: queue.expiresAt,
        acted_at: queue.actedAt,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /approve/:token ─────────────────────────────────────────────────────

approveRouter.post('/approve/:token', async (req, res, next) => {
  const tokenParam = req.params.token
  if (!tokenParam || Array.isArray(tokenParam)) {
    sendError(res, 'Invalid token parameter', 'INVALID_REQUEST', 400)
    return
  }

  try {
    const entry = await consumeToken(tokenParam, 'APPROVED')
    if (!entry) {
      sendError(res, 'Approval token is invalid, expired, or already used.', 'INVALID_TOKEN', 400)
      return
    }

    const { transaction } = entry
    const userId = transaction.userId

    // Re-run policy check (amount could now violate a freshly changed policy)
    const amount = transaction.type === 'marketplace' && transaction.costPaid
      ? transaction.costPaid.toFixed(7)
      : transaction.amount.toFixed(7)
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

    if (transaction.type === 'marketplace') {
      try {
        const result = await executeApprovedMarketplaceTransaction(userId, transaction.id)

        void sendApprovalActedEmail(userId, transaction.id, 'approved', result.cost_paid).catch(
          (e: unknown) =>
            logger.error('Failed to send marketplace approval acted email', {
              userId,
              error: (e as Error).message,
            }),
        )

        sendSuccess(res, {
          status: 'approved',
          transaction_id: transaction.id,
          stellar_tx_hash: result.stellar_tx_hash,
          amount: result.cost_paid,
          service_id: result.service_id,
        })
      } catch (marketplaceErr) {
        logger.error('Marketplace call failed on approval', {
          userId,
          transactionId: transaction.id,
          error: (marketplaceErr as Error).message,
        })

        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'FAILED',
            blockedReason: (marketplaceErr as Error).message,
          },
        })

        sendError(res, 'Marketplace call failed after approval.', 'MARKETPLACE_APPROVAL_FAILED', 502, {
          transaction_id: transaction.id,
          error: (marketplaceErr as Error).message,
        })
      }
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

    const secretKey = decryptSecretKey(wallet.stellarSecretKeyEnc)

    if (isEvmAddress(transaction.recipientAddress)) {
      // ── CCTP cross-chain (approved path): fee → burn → fire-and-forget relay ─
      const mintRecipient32 = encodeEvmRecipient(transaction.recipientAddress)
      const feeAmount = computeCctpFee(amount)
      const feeWallet = process.env['ARGENS_FEE_WALLET']

      if (!feeWallet) {
        logger.error('ARGENS_FEE_WALLET not configured for CCTP fee (approved path)', { userId, transactionId: transaction.id })
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED', blockedReason: 'Fee wallet not configured' },
        })
        sendError(res, 'Service misconfiguration. Try again later.', 'FEE_WALLET_NOT_CONFIGURED', 500)
        return
      }

      try {
        await verifyCctpPreflightBalance(wallet.stellarPublicKey, amount, feeAmount)
      } catch (preflightErr) {
        const err = preflightErr as AppError
        logger.warn('CCTP preflight blocked approved transfer before fee payment', {
          userId,
          transactionId: transaction.id,
          code: err.code,
          error: err.message,
        })
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'FAILED',
            blockedReason: err.message,
          },
        })
        if (preflightErr instanceof AppError) {
          sendError(res, preflightErr.message, preflightErr.code, preflightErr.statusCode, {
            ...(preflightErr.details as Record<string, unknown> | undefined),
            transaction_id: transaction.id,
          })
          return
        }
        throw preflightErr
      }

      let feeTxHash: string
      try {
        const feeResult = await submitPayment({
          senderSecretKey: secretKey,
          recipientPublicKey: feeWallet,
          amount: feeAmount,
          memo: `CCTP fee ${transaction.id.slice(0, 12)}`,
        })
        feeTxHash = feeResult.hash
      } catch (feeErr) {
        const errMsg = feeErr instanceof Error ? feeErr.message : String(feeErr)
        logger.error('CCTP fee payment failed (approved path)', { userId, transactionId: transaction.id, error: errMsg })
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED', blockedReason: `Fee payment failed: ${errMsg}` },
        })
        sendError(res, 'Cross-chain payment failed during fee step. No funds taken.', 'CCTP_FEE_FAILED', 502, {
          error: errMsg,
          transaction_id: transaction.id,
        })
        return
      }

      try {
        const { stellarTxHash } = await burnUsdcOnStellar(
          secretKey,
          amount,
          BASE_DOMAIN,
          mintRecipient32,
        )

        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            stellarTxHash,
            crossChain: true,
            destinationChain: 'base',
            metadata: {
              cctpFee: {
                rate: CCTP_FEE_RATE.toString(),
                amount: feeAmount,
                stellar_tx_hash: feeTxHash,
              },
            },
          },
        })

        void sendApprovalActedEmail(userId, transaction.id, 'approved', amount).catch(
          (e: unknown) =>
            logger.error('Failed to send approval acted email', { userId, error: (e as Error).message }),
        )

        sendSuccess(res, {
          status: 'cross_chain_pending',
          transaction_id: transaction.id,
          stellar_tx_hash: stellarTxHash,
          destination_chain: 'base',
          argens_fee: feeAmount,
          fee_tx_hash: feeTxHash,
          message: 'USDC burned on Stellar. Relay to Base is in progress.',
          poll_url: `/v1/transactions/${transaction.id}`,
        })

        // Approve path: incrementTotalSpent is handled inside runRelay on success.
        void enqueueRelay(transaction.id, { incrementOnSuccess: true })
      } catch (burnErr) {
        const errMsg = burnErr instanceof Error ? burnErr.message : JSON.stringify(burnErr)
        const errStr = String(burnErr)
        const errJson = (() => { try { return JSON.stringify(burnErr) } catch { return null } })()
        logger.error('CCTP burn failed after fee was taken (approved path)', {
          userId, transactionId: transaction.id, error: errMsg, raw: errStr, json: errJson, feeTxHash, feeAmount,
        })
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: 'FAILED',
            blockedReason: errMsg || errStr,
            metadata: {
              cctpFee: {
                rate: CCTP_FEE_RATE.toString(),
                amount: feeAmount,
                stellar_tx_hash: feeTxHash,
              },
              failureReason: 'cctp_burn_failed_after_fee',
            },
          },
        })
        sendError(res, 'Cross-chain payment failed during burn on Stellar. Fee will be reconciled manually.', 'CCTP_BURN_FAILED', 502, {
          transaction_id: transaction.id,
          error: errMsg,
          raw: errStr,
          json: errJson,
          fee_tx_hash: feeTxHash,
        })
      }
    } else {
      // ── Stellar direct payment ───────────────────────────────────────────────
      try {
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
    }
  } catch (err) {
    next(err)
  }
})

// ─── POST /reject/:token ──────────────────────────────────────────────────────

approveRouter.post('/reject/:token', async (req, res, next) => {
  const tokenParam = req.params.token
  if (!tokenParam || Array.isArray(tokenParam)) {
    sendError(res, 'Invalid token parameter', 'INVALID_REQUEST', 400)
    return
  }

  try {
    const entry = await consumeToken(tokenParam, 'REJECTED')
    if (!entry) {
      sendError(res, 'Approval token is invalid, expired, or already used.', 'INVALID_TOKEN', 400)
      return
    }

    const { transaction } = entry
    const userId = transaction.userId

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

/**
 * Atomically consume a PENDING, unexpired token by flipping it to `nextStatus`.
 * Returns the queue row (with transaction) if THIS call won the consume,
 * or null if the token was missing, expired, or already consumed.
 * updateMany's `count` is the atomic compare-and-swap result — exactly one
 * concurrent caller wins; all others get null.
 */
async function consumeToken(
  token: string,
  nextStatus: 'APPROVED' | 'REJECTED',
): Promise<{ queue: ApprovalQueue & { transaction: Transaction }; transaction: Transaction } | null> {
  const consumed = await prisma.approvalQueue.updateMany({
    where: { token, status: 'PENDING', expiresAt: { gt: new Date() } },
    data: { status: nextStatus, actedAt: new Date() },
  })
  if (consumed.count !== 1) {
    // Lazily mark expired-but-still-PENDING tokens so the GET endpoint shows the right state.
    await prisma.approvalQueue.updateMany({
      where: { token, status: 'PENDING', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    })
    return null
  }
  const queue = await prisma.approvalQueue.findUnique({
    where: { token },
    include: { transaction: true },
  })
  if (!queue) return null // deleted between update and read — treat as lost
  return { queue, transaction: queue.transaction }
}
