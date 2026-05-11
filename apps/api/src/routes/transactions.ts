/**
 * routes/transactions.ts
 *
 * POST /pay    — execute a USDC payment (agent API key)
 * POST /quote  — dry run, no DB write, no Stellar tx
 * POST /refund — send funds back to original recipient (new outgoing payment)
 * GET  /transactions          — paginated transaction list
 * GET  /transactions/:id      — single transaction detail
 *
 * No Argens fee on direct payments. Revenue comes from marketplace markup only.
 */

import { type Router } from 'express'
import { Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { requireApiKey, requireJwtOrApiKey } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { sendSuccess, sendError, sendPaginated } from '../lib/response.js'
import { NotFoundError } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { decryptSecretKey, generateSecureToken } from '../lib/crypto.js'
import { checkPolicy, incrementTotalSpent } from '../services/policy.js'
import { submitPayment } from '../services/payment.js'
import { isStellarAddress, validateMemo, getUsdcBalance } from '../services/stellar.js'
import {
  sendBlockedEmail,
  sendPendingApprovalEmail,
  sendLowBalanceEmail,
} from '../services/email.js'

// ─── Validation schemas ──────────────────────────────────────────────────────

const AmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,7})?$/, 'Amount must be a string with up to 7 decimal places')
  .refine((v) => parseFloat(v) > 0, 'Amount must be greater than 0')

const PaySchema = z.object({
  recipient: z.string().min(1, 'Recipient is required'),
  amount: AmountSchema,
  currency: z.literal('USDC').default('USDC'),
  memo: z.string().max(28).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const RefundSchema = z.object({
  transaction_id: z.string().min(1),
  reason: z.string().max(200).optional(),
})

const TransactionListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['SUCCESS', 'BLOCKED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FAILED'])
    .optional()
    .transform((v) => (Array.isArray(v) ? v[0] : v)),
  type: z.enum(['payment', 'marketplace']).optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
})

// ─── Router ─────────────────────────────────────────────────────────────────

export const transactionsRouter: Router = ExpressRouter()

// ─── POST /pay ───────────────────────────────────────────────────────────────

transactionsRouter.post('/pay', requireApiKey, validate(PaySchema), async (req, res, next) => {
  const userId = req.userId!
  const { recipient, amount, memo, metadata } = req.body as z.infer<typeof PaySchema>

  try {
    if (!isStellarAddress(recipient)) {
      sendError(
        res,
        'Invalid recipient address. Only Stellar addresses (G... 56 chars) are supported in V1.',
        'INVALID_RECIPIENT',
        400,
      )
      return
    }

    if (memo) {
      try { validateMemo(memo) } catch (e) {
        sendError(res, (e as Error).message, 'INVALID_MEMO', 400)
        return
      }
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } })
    if (!wallet) {
      sendError(res, 'Wallet not found.', 'WALLET_NOT_FOUND', 404)
      return
    }
    if (wallet.status !== 'READY') {
      sendError(res, 'Wallet is not ready. Bootstrap may still be in progress.', 'WALLET_NOT_READY', 503)
      return
    }

    const policyResult = await checkPolicy(userId, amount)

    // ── BLOCKED ─────────────────────────────────────────────────────────────
    if (policyResult.status === 'BLOCKED') {
      const tx = await prisma.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          recipientAddress: recipient,
          amount,
          currency: 'USDC',
          status: 'BLOCKED',
          type: 'payment',
          memo,
          metadata: metadata as object | undefined,
          policyResult: policyResult as unknown as object,
          blockedReason: policyResult.reason,
        },
      })

      void sendBlockedEmail(userId, tx.id, amount, recipient, policyResult.reason ?? 'policy_violation').catch(
        (e: unknown) => logger.error('Failed to send blocked email', { userId, error: (e as Error).message }),
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
          currency: 'USDC',
          status: 'PENDING_APPROVAL',
          type: 'payment',
          memo,
          metadata: metadata as object | undefined,
          policyResult: policyResult as unknown as object,
          approvalQueue: { create: { userId, token, expiresAt } },
        },
        include: { approvalQueue: true },
      })

      void sendPendingApprovalEmail(userId, tx.id, token, amount, recipient).catch(
        (e: unknown) => logger.error('Failed to send pending approval email', { userId, error: (e as Error).message }),
      )

      sendSuccess(res, {
        status: 'pending_approval',
        transaction_id: tx.id,
        message: 'Awaiting developer approval.',
        poll_url: `/v1/transactions/${tx.id}`,
      }, 202)
      return
    }

    // ── APPROVED — submit Stellar tx ─────────────────────────────────────────
    const tx = await prisma.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        recipientAddress: recipient,
        amount,
        currency: 'USDC',
        status: 'APPROVED',
        type: 'payment',
        memo,
        metadata: metadata as object | undefined,
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

      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'SUCCESS', stellarTxHash: stellarResult.hash },
      })

      await incrementTotalSpent(userId, amount)

      void refreshBalanceCache(wallet.id, wallet.stellarPublicKey).catch(() => undefined)
      void checkAndNotifyLowBalance(userId, wallet.id).catch(() => undefined)

      sendSuccess(res, {
        status: 'success',
        transaction_id: tx.id,
        stellar_tx_hash: stellarResult.hash,
        amount,
        recipient,
        timestamp: new Date().toISOString(),
        policy_check: buildPolicyCheckResponse(policyResult.detail),
      })
    } catch (stellarErr) {
      logger.error('Stellar payment failed', { userId, transactionId: tx.id, error: (stellarErr as Error).message })

      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'FAILED', blockedReason: (stellarErr as Error).message },
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

// ─── POST /quote ─────────────────────────────────────────────────────────────

transactionsRouter.post('/quote', requireApiKey, validate(PaySchema), async (req, res, next) => {
  const userId = req.userId!
  const { recipient, amount } = req.body as z.infer<typeof PaySchema>

  try {
    if (!isStellarAddress(recipient)) {
      sendError(res, 'Invalid recipient address.', 'INVALID_RECIPIENT', 400)
      return
    }

    const policyResult = await checkPolicy(userId, amount)

    if (policyResult.status === 'BLOCKED') {
      sendSuccess(res, {
        status: 'would_be_blocked',
        amount,
        policy_check: buildQuotePolicyCheck(policyResult),
        reason: policyResult.reason,
      })
      return
    }

    if (policyResult.status === 'PENDING_APPROVAL') {
      sendSuccess(res, {
        status: 'would_require_approval',
        amount,
        policy_check: buildQuotePolicyCheck(policyResult),
      })
      return
    }

    sendSuccess(res, {
      status: 'would_succeed',
      amount,
      policy_check: buildQuotePolicyCheck(policyResult),
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /refund ────────────────────────────────────────────────────────────

transactionsRouter.post('/refund', requireApiKey, validate(RefundSchema), async (req, res, next) => {
  const userId = req.userId!
  const { transaction_id, reason } = req.body as z.infer<typeof RefundSchema>

  try {
    const original = await prisma.transaction.findFirst({
      where: { id: transaction_id, userId },
    })

    if (!original) throw new NotFoundError('Transaction not found')

    if (original.status !== 'SUCCESS') {
      sendError(res, 'Only transactions with SUCCESS status can be refunded.', 'REFUND_NOT_ELIGIBLE', 400, {
        status: original.status,
      })
      return
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } })
    if (!wallet || wallet.status !== 'READY') {
      sendError(res, 'Wallet not ready.', 'WALLET_NOT_READY', 503)
      return
    }

    const refundAmount = original.amount.toFixed(7)
    const policyResult = await checkPolicy(userId, refundAmount)

    if (policyResult.status === 'BLOCKED') {
      sendError(res, 'Refund blocked by policy.', 'POLICY_BLOCKED', 402, { reason: policyResult.reason })
      return
    }

    const refundTx = await prisma.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        recipientAddress: original.recipientAddress,
        amount: refundAmount,
        currency: 'USDC',
        status: 'APPROVED',
        type: 'payment',
        memo: `Refund for ${original.id}`,
        metadata: { original_transaction_id: original.id, reason },
        policyResult: policyResult as unknown as object,
      },
    })

    try {
      const secretKey = decryptSecretKey(wallet.stellarSecretKeyEnc)
      const stellarResult = await submitPayment({
        senderSecretKey: secretKey,
        recipientPublicKey: original.recipientAddress,
        amount: refundAmount,
        memo: `Refund ${original.id.slice(0, 12)}`,
      })

      await prisma.transaction.update({
        where: { id: refundTx.id },
        data: { status: 'SUCCESS', stellarTxHash: stellarResult.hash },
      })

      await incrementTotalSpent(userId, refundAmount)
      void refreshBalanceCache(wallet.id, wallet.stellarPublicKey).catch(() => undefined)

      sendSuccess(res, {
        status: 'success',
        refund_transaction_id: refundTx.id,
        original_transaction_id: original.id,
        stellar_tx_hash: stellarResult.hash,
        amount: refundAmount,
        recipient: original.recipientAddress,
        timestamp: new Date().toISOString(),
      })
    } catch (stellarErr) {
      logger.error('Refund Stellar payment failed', {
        userId,
        refundTxId: refundTx.id,
        error: (stellarErr as Error).message,
      })
      await prisma.transaction.update({
        where: { id: refundTx.id },
        data: { status: 'FAILED', blockedReason: (stellarErr as Error).message },
      })
      sendError(res, 'Refund failed due to Stellar error.', 'STELLAR_PAYMENT_FAILED', 502, {
        transaction_id: refundTx.id,
      })
    }
  } catch (err) {
    next(err)
  }
})

// ─── GET /transactions ────────────────────────────────────────────────────────

transactionsRouter.get('/transactions', requireJwtOrApiKey, async (req, res, next) => {
  const userId = req.userId!
  try {
    const parsed = TransactionListSchema.safeParse(req.query)
    if (!parsed.success) {
      sendError(res, 'Invalid query parameters', 'VALIDATION_ERROR', 400, parsed.error.flatten())
      return
    }
    const { page, limit, status, type, from_date, to_date } = parsed.data

    const where = {
      userId,
      ...(status && { status }),
      ...(type && { type }),
      ...(from_date || to_date
        ? {
            createdAt: {
              ...(from_date && { gte: new Date(from_date) }),
              ...(to_date && { lte: new Date(to_date) }),
            },
          }
        : {}),
    }

    const [total, rows] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          stellarTxHash: true,
          recipientAddress: true,
          amount: true,
          currency: true,
          status: true,
          type: true,
          serviceId: true,
          costPaid: true,
          memo: true,
          blockedReason: true,
          createdAt: true,
          approvalQueue: { select: { token: true, status: true } },
        },
      }),
    ])

    // Expose the approval token only while a transaction is still awaiting action — it is
    // the owner's own data and lets the dashboard link straight to the confirmation page.
    const transactions = rows.map(({ approvalQueue, ...t }) => ({
      ...t,
      approvalToken: approvalQueue?.status === 'PENDING' ? approvalQueue.token : null,
    }))

    const pages = Math.ceil(total / limit)
    sendPaginated(res, transactions, { page, total, pages })
  } catch (err) {
    next(err)
  }
})

// ─── GET /transactions/:id ────────────────────────────────────────────────────

transactionsRouter.get('/transactions/:id', requireJwtOrApiKey, async (req, res, next) => {
  const userId = req.userId!
  const idParam = req.params.id
  const id = Array.isArray(idParam) ? idParam[0] : idParam

  try {
    const tx = await prisma.transaction.findFirst({
      where: { id, userId },
      include: { approvalQueue: true },
    }) as Awaited<ReturnType<typeof prisma.transaction.findFirst>> & {
      approvalQueue: { status: string; token: string; expiresAt: Date; actedAt: Date | null } | null
    } | null

    if (!tx) throw new NotFoundError('Transaction not found')

    const horizonBase =
      process.env['STELLAR_NETWORK'] === 'mainnet'
        ? 'https://stellar.expert/explorer/public/tx'
        : 'https://stellar.expert/explorer/testnet/tx'

    sendSuccess(res, {
      id: tx.id,
      status: tx.status,
      type: tx.type,
      stellar_tx_hash: tx.stellarTxHash,
      stellar_explorer_url: tx.stellarTxHash ? `${horizonBase}/${tx.stellarTxHash}` : null,
      recipient: tx.recipientAddress,
      amount: tx.amount.toFixed(7),
      currency: tx.currency,
      service_id: tx.serviceId,
      service_endpoint: tx.serviceEndpoint,
      cost_paid: tx.costPaid?.toFixed(7) ?? null,
      memo: tx.memo,
      metadata: tx.metadata,
      policy_result: tx.policyResult,
      blocked_reason: tx.blockedReason,
      approval: tx.approvalQueue
        ? {
            status: tx.approvalQueue.status,
            token: tx.approvalQueue.status === 'PENDING' ? tx.approvalQueue.token : null,
            expires_at: tx.approvalQueue.expiresAt,
            acted_at: tx.approvalQueue.actedAt,
          }
        : null,
      created_at: tx.createdAt,
    })
  } catch (err) {
    next(err)
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPolicyCheckResponse(detail: {
  allowance: string
  max_transaction: string
  approval_threshold: string
}) {
  return {
    allowance: detail.allowance === 'not_set' ? 'not_configured' : detail.allowance,
    max_transaction: detail.max_transaction === 'not_set' ? 'not_configured' : detail.max_transaction,
    approval_threshold: detail.approval_threshold === 'not_set' ? 'not_configured' : detail.approval_threshold,
  }
}

function buildQuotePolicyCheck(policyResult: {
  status: string
  detail: { allowance: string; max_transaction: string; approval_threshold: string }
}) {
  return {
    allowance:
      policyResult.status === 'BLOCKED' && policyResult.detail.allowance === 'blocked'
        ? 'would_block'
        : policyResult.detail.allowance === 'not_set' ? 'not_configured' : 'would_pass',
    max_transaction:
      policyResult.status === 'BLOCKED' && policyResult.detail.max_transaction === 'blocked'
        ? 'would_block'
        : policyResult.detail.max_transaction === 'not_set' ? 'not_configured' : 'would_pass',
    approval_threshold:
      policyResult.status === 'PENDING_APPROVAL'
        ? 'would_require_approval'
        : policyResult.detail.approval_threshold === 'not_set' ? 'not_configured' : 'would_pass',
  }
}

async function refreshBalanceCache(walletId: string, publicKey: string): Promise<void> {
  const balance = await getUsdcBalance(publicKey)
  if (balance !== null) {
    await prisma.wallet.update({
      where: { id: walletId },
      data: { balanceCache: balance, balanceCachedAt: new Date() },
    })
  }
}

async function checkAndNotifyLowBalance(userId: string, walletId: string): Promise<void> {
  const LOW_BALANCE_USDC = 10

  const [wallet, policy] = await Promise.all([
    prisma.wallet.findUnique({ where: { id: walletId } }),
    prisma.policy.findUnique({ where: { userId } }),
  ])

  if (!wallet || !policy) return

  let threshold = LOW_BALANCE_USDC
  if (policy.allowanceLimit) {
    const remaining = policy.allowanceLimit.minus(policy.totalSpent)
    threshold = Math.max(LOW_BALANCE_USDC, remaining.mul('0.10').toNumber())
  }

  if (wallet.balanceCache.lessThan(threshold)) {
    void sendLowBalanceEmail(userId, wallet.balanceCache.toFixed(7), String(threshold)).catch((e: unknown) =>
      logger.error('Failed to send low-balance email', { userId, error: (e as Error).message }),
    )
  }
}
