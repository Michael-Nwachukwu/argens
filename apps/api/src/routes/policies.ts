/**
 * routes/policies.ts
 *
 * GET  /policies — retrieve current policy settings
 * POST /policies — update policy limits
 *
 * Policy writes go to Postgres only (plus an AuditLog entry) — there is no on-chain write.
 */

import { type Router } from 'express'
import { Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { requireJwt } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { sendSuccess } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { savePolicy } from '../services/policy.js'
import { sendPolicyChangedEmail } from '../services/email.js'
import { logger } from '../lib/logger.js'
import { DecimalAmountSchema } from '../lib/money.js'

export const policiesRouter: Router = ExpressRouter()

// ─── Validation ──────────────────────────────────────────────────────────────

// null = remove limit; string with 7 decimal places = set limit
const LimitField = z
  .union([
    DecimalAmountSchema,
    z.null(),
  ])
  .optional()

const PolicyUpdateSchema = z.object({
  allowance_limit: LimitField,
  max_transaction_limit: LimitField,
  approval_threshold: LimitField,
})

// ─── GET /policies ────────────────────────────────────────────────────────────

policiesRouter.get('/policies', requireJwt, async (req, res, next) => {
  const userId = req.userId!

  try {
    const policy = await prisma.policy.findUnique({ where: { userId } })

    if (!policy) {
      // New user — no policy set yet, return all nulls
      sendSuccess(res, {
        allowance_limit: null,
        max_transaction_limit: null,
        approval_threshold: null,
        total_spent: '0.0000000',
        soroban_contract_id: null,
      })
      return
    }

    sendSuccess(res, {
      allowance_limit: policy.allowanceLimit?.toFixed(7) ?? null,
      max_transaction_limit: policy.maxTransactionLimit?.toFixed(7) ?? null,
      approval_threshold: policy.approvalThreshold?.toFixed(7) ?? null,
      total_spent: policy.totalSpent.toFixed(7),
      soroban_contract_id: policy.sorobanContractId,
    })
  } catch (err) {
    next(err)
  }
})

// ─── POST /policies ───────────────────────────────────────────────────────────

policiesRouter.post('/policies', requireJwt, validate(PolicyUpdateSchema), async (req, res, next) => {
  const userId = req.userId!
  const body = req.body as z.infer<typeof PolicyUpdateSchema>

  try {
    // Postgres is the source of truth for policy; there is no on-chain write.
    const updated = await savePolicy(userId, {
      allowanceLimit: body.allowance_limit,
      maxTransactionLimit: body.max_transaction_limit,
      approvalThreshold: body.approval_threshold,
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId,
        eventType: 'POLICY_UPDATED',
        eventData: {
          allowance_limit: body.allowance_limit,
          max_transaction_limit: body.max_transaction_limit,
          approval_threshold: body.approval_threshold,
        },
      },
    })

    // Notify user (fire-and-forget)
    void sendPolicyChangedEmail(userId, {
      allowanceLimit: updated.allowanceLimit?.toFixed(7) ?? null,
      maxTransactionLimit: updated.maxTransactionLimit?.toFixed(7) ?? null,
      approvalThreshold: updated.approvalThreshold?.toFixed(7) ?? null,
    }).catch((e: unknown) =>
      logger.error('Failed to send policy changed email', {
        userId,
        error: (e as Error).message,
      }),
    )

    sendSuccess(res, {
      allowance_limit: updated.allowanceLimit?.toFixed(7) ?? null,
      max_transaction_limit: updated.maxTransactionLimit?.toFixed(7) ?? null,
      approval_threshold: updated.approvalThreshold?.toFixed(7) ?? null,
      total_spent: updated.totalSpent.toFixed(7),
      soroban_contract_id: updated.sorobanContractId,
    })
  } catch (err) {
    next(err)
  }
})
