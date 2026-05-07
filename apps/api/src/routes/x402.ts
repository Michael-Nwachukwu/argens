/**
 * routes/x402.ts
 *
 * POST /pay/x402 — resolve an HTTP 402 Payment Required response.
 *
 * An AI agent hits a paywall, gets a 402 back with payment requirements,
 * and calls this endpoint to pay and get a receipt. Argens handles routing,
 * policy enforcement, and execution — the agent just forwards the 402 body.
 *
 * Supported networks in V1:
 *   - stellar / stellar-testnet / stellar-mainnet  → native Stellar USDC payment (live)
 *   - base / base-sepolia / base-mainnet            → CCTP V2 burn-and-mint (Phase 4)
 *
 * x402 amount formats:
 *   - EVM USDC: 6 decimal integer string ("1000000" = 1 USDC)
 *   - Stellar USDC: 7 decimal string ("1.0000000") or 6-decimal integer
 *   - Human-readable: "1.50" (treated as USDC units)
 *
 * Payment proof format returned in `payment_header`:
 *   Base64-encoded JSON for the agent to include as `X-Payment` in the retry request.
 */

import { type Router } from 'express'
import { Router as ExpressRouter } from 'express'
import { z } from 'zod'
import { Decimal } from '@prisma/client/runtime/library'
import { requireApiKey } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { sendSuccess, sendError } from '../lib/response.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { decryptSecretKey, generateSecureToken } from '../lib/crypto.js'
import { checkPolicy, incrementTotalSpent } from '../services/policy.js'
import { submitPayment } from '../services/payment.js'
import { isStellarAddress, isEvmAddress } from '../services/stellar.js'
import {
  sendBlockedEmail,
  sendPendingApprovalEmail,
  sendLowBalanceEmail,
} from '../services/email.js'
import { getUsdcBalance } from '../services/stellar.js'

export const x402Router: Router = ExpressRouter()

// ─── Supported networks ───────────────────────────────────────────────────────

const STELLAR_NETWORKS = new Set([
  'stellar', 'stellar-testnet', 'stellar-mainnet',
  'stellar-testnet-pubnet', 'stellar-pubnet',
])

const BASE_NETWORKS = new Set([
  'base', 'base-sepolia', 'base-mainnet', 'eip155:8453', 'eip155:84532',
])

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Accept multiple x402 payload shapes — the spec is still evolving.
 * We normalise everything into { payTo, amount (USDC string 7dp), network }.
 */
const X402PaymentRequirementsSchema = z.object({
  // Standard x402 fields
  scheme: z.string().optional(),
  network: z.string().optional(),
  maxAmountRequired: z.string().optional(),   // EVM: "1000000" (6dp integer)
  payTo: z.string().optional(),
  asset: z.string().optional(),
  resource: z.string().optional(),
  description: z.string().optional(),
  maxTimeoutSeconds: z.number().optional(),
  // Alternative flat format used by some services
  amount: z.string().optional(),
  recipient: z.string().optional(),
  currency: z.string().optional(),
  // Extra fields tolerated
}).passthrough()

const X402Schema = z.object({
  /**
   * The raw body of the 402 response from the paywall server.
   * Accepts both { accepts: [...] } array format and flat format.
   */
  payment_requirements: z.union([
    X402PaymentRequirementsSchema,
    z.object({
      accepts: z.array(X402PaymentRequirementsSchema).min(1),
      error: z.string().optional(),
    }).passthrough(),
  ]),
  memo: z.string().max(28).optional(),
  metadata: z.record(z.unknown()).optional(),
})

// ─── POST /pay/x402 ───────────────────────────────────────────────────────────

x402Router.post('/pay/x402', requireApiKey, validate(X402Schema), async (req, res, next) => {
  const userId = req.userId!
  const { payment_requirements, memo, metadata } = req.body as z.infer<typeof X402Schema>

  try {
    // ── 1. Normalise the 402 payload ──────────────────────────────────────────
    const normalized = normalizeRequirements(payment_requirements)

    if (!normalized) {
      sendError(
        res,
        'Could not parse payment requirements from the 402 response. Supported formats: x402 standard (accepts[]), flat {payTo, amount}, flat {recipient, amount}.',
        'INVALID_X402_PAYLOAD',
        400,
      )
      return
    }

    const { payTo, amountUsdc, network, description } = normalized

    // ── 2. Route by network ───────────────────────────────────────────────────
    if (BASE_NETWORKS.has(network.toLowerCase()) || isEvmAddress(payTo)) {
      // CCTP V2 — Base USDC settlement — Phase 4
      sendError(
        res,
        'Base USDC settlement via CCTP V2 is coming in Phase 4. Currently only Stellar USDC payments are supported.',
        'CCTP_NOT_YET_IMPLEMENTED',
        501,
        {
          detected_network: network,
          recipient: payTo,
          phase: 'Phase 4 — Soroban + CCTP V2',
          workaround: 'Use a Stellar USDC address (G... 56 chars) as recipient for immediate payment.',
        },
      )
      return
    }

    if (!STELLAR_NETWORKS.has(network.toLowerCase()) && !isStellarAddress(payTo)) {
      sendError(
        res,
        `Unsupported network: "${network}". Supported in V1: stellar, stellar-testnet.`,
        'UNSUPPORTED_NETWORK',
        400,
      )
      return
    }

    if (!isStellarAddress(payTo)) {
      sendError(res, `Invalid Stellar recipient address: "${payTo}"`, 'INVALID_RECIPIENT', 400)
      return
    }

    // ── 3. Load wallet ────────────────────────────────────────────────────────
    const wallet = await prisma.wallet.findUnique({ where: { userId } })
    if (!wallet) {
      sendError(res, 'Wallet not found.', 'WALLET_NOT_FOUND', 404)
      return
    }
    if (wallet.status !== 'READY') {
      sendError(res, 'Wallet is not ready.', 'WALLET_NOT_READY', 503)
      return
    }

    // ── 4. Policy check ───────────────────────────────────────────────────────
    const policyResult = await checkPolicy(userId, amountUsdc)
    const effectiveMemo = memo ?? (description ? description.slice(0, 28) : undefined) ?? null

    if (policyResult.status === 'BLOCKED') {
      const tx = await prisma.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          recipientAddress: payTo,
          amount: amountUsdc,
              currency: 'USDC',
          status: 'BLOCKED',
          memo: effectiveMemo,
          metadata: { ...(metadata ?? {}), x402: true, resource: normalized.resource } as object,
          policyResult: policyResult as unknown as object,
          blockedReason: policyResult.reason,
        },
      })

      void sendBlockedEmail(
        userId, tx.id, amountUsdc, payTo, policyResult.reason ?? 'policy_violation',
      ).catch((e: unknown) =>
        logger.error('Failed to send blocked email', { userId, error: (e as Error).message }),
      )

      sendError(res, 'Transaction blocked by policy', 'POLICY_BLOCKED', 402, {
        reason: policyResult.reason,
        policy: policyResult.policy,
      })
      return
    }

    if (policyResult.status === 'PENDING_APPROVAL') {
      const token = generateSecureToken()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

      const tx = await prisma.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          recipientAddress: payTo,
          amount: amountUsdc,
          currency: 'USDC',
          status: 'PENDING_APPROVAL',
          memo: effectiveMemo,
          metadata: { ...(metadata ?? {}), x402: true, resource: normalized.resource } as object,
          policyResult: policyResult as unknown as object,
          approvalQueue: { create: { userId, token, expiresAt } },
        },
      })

      void sendPendingApprovalEmail(userId, tx.id, token, amountUsdc, payTo).catch(
        (e: unknown) =>
          logger.error('Failed to send approval email', { userId, error: (e as Error).message }),
      )

      sendSuccess(res, {
        status: 'pending_approval',
        transaction_id: tx.id,
        message: 'Awaiting developer approval before the x402 payment executes.',
        poll_url: `/v1/transactions/${tx.id}`,
      }, 202)
      return
    }

    // ── 5. Execute Stellar payment ────────────────────────────────────────────
    const tx = await prisma.transaction.create({
      data: {
        userId,
        walletId: wallet.id,
        recipientAddress: payTo,
        amount: amountUsdc,
        currency: 'USDC',
        status: 'APPROVED',
        memo: effectiveMemo,
        metadata: { ...(metadata ?? {}), x402: true, resource: normalized.resource } as object,
        policyResult: policyResult as unknown as object,
      },
    })

    try {
      const secretKey = decryptSecretKey(wallet.stellarSecretKeyEnc)
      const stellarResult = await submitPayment({
        senderSecretKey: secretKey,
        recipientPublicKey: payTo,
        amount: amountUsdc,
        memo: effectiveMemo,
      })

      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'SUCCESS', stellarTxHash: stellarResult.hash },
      })

      await incrementTotalSpent(userId, amountUsdc)

      // Refresh balance + low-balance check
      void refreshAndCheckBalance(userId, wallet.id, wallet.stellarPublicKey).catch(() => undefined)

      // Build the X-Payment proof header for the agent to use in its retry request
      const paymentProof = buildX402PaymentProof({
        network: normalizeNetworkName(network),
        txHash: stellarResult.hash,
        amount: amountUsdc,
        payTo,
      })

      logger.info('x402 payment executed', {
        userId,
        transactionId: tx.id,
        txHash: stellarResult.hash,
        resource: normalized.resource,
      })

      sendSuccess(res, {
        status: 'success',
        transaction_id: tx.id,
        stellar_tx_hash: stellarResult.hash,
        amount: amountUsdc,
        recipient: payTo,
        network: normalizeNetworkName(network),
        resource: normalized.resource,
        timestamp: new Date().toISOString(),
        /**
         * Include this header value in your retry request to the paywall:
         *   X-Payment: <payment_header>
         */
        payment_header: paymentProof,
        policy_check: buildPolicyCheck(policyResult.detail),
      })
    } catch (stellarErr) {
      logger.error('x402 Stellar payment failed', {
        userId,
        transactionId: tx.id,
        error: (stellarErr as Error).message,
      })
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

// ─── Normalisation ────────────────────────────────────────────────────────────

interface NormalizedRequirements {
  payTo: string
  amountUsdc: string    // "1.0000000" — 7dp Stellar format
  network: string
  resource?: string
  description?: string
}

function normalizeRequirements(
  raw: z.infer<typeof X402Schema>['payment_requirements'],
): NormalizedRequirements | null {
  // Format 1: { accepts: [{ payTo, maxAmountRequired, network, ... }] }
  if ('accepts' in raw && Array.isArray(raw.accepts) && raw.accepts.length > 0) {
    // Prefer Stellar entry if multiple networks offered; fall back to first
    const stellarEntry = raw.accepts.find(
      (a) => a.network && STELLAR_NETWORKS.has(String(a.network).toLowerCase()),
    ) ?? raw.accepts[0]

    return parseEntry(stellarEntry)
  }

  // Format 2: flat object { payTo, maxAmountRequired, network } or { recipient, amount }
  return parseEntry(raw as z.infer<typeof X402PaymentRequirementsSchema>)
}

function parseEntry(
  entry: z.infer<typeof X402PaymentRequirementsSchema>,
): NormalizedRequirements | null {
  const payTo = entry.payTo ?? entry.recipient ?? null
  const rawAmount = entry.maxAmountRequired ?? entry.amount ?? null
  const network = entry.network ?? inferNetworkFromAddress(payTo ?? '') ?? 'unknown'

  if (!payTo || !rawAmount) return null

  const amountUsdc = normalizeAmount(rawAmount, network)
  if (!amountUsdc) return null

  return {
    payTo,
    amountUsdc,
    network,
    resource: entry.resource,
    description: entry.description,
  }
}

/**
 * Convert various amount formats to Stellar 7dp string.
 * EVM USDC: 6 decimal integer ("1000000" → "1.0000000")
 * Stellar:  7 decimal string  ("1.0000000" → "1.0000000")
 * Human:    decimal string    ("1.50" → "1.5000000")
 */
function normalizeAmount(raw: string, network: string): string | null {
  try {
    const isEvmNetwork = BASE_NETWORKS.has(network.toLowerCase())

    if (isEvmNetwork && /^\d+$/.test(raw)) {
      // EVM integer format with 6 decimals
      return new Decimal(raw).div('1000000').toDecimalPlaces(7).toFixed(7)
    }

    // Stellar or human-readable decimal
    const d = new Decimal(raw)
    if (d.lessThanOrEqualTo(0)) return null
    return d.toDecimalPlaces(7).toFixed(7)
  } catch {
    return null
  }
}

function inferNetworkFromAddress(address: string): string | null {
  if (isStellarAddress(address)) return 'stellar'
  if (isEvmAddress(address)) return 'base'
  return null
}

function normalizeNetworkName(network: string): string {
  const n = network.toLowerCase()
  if (STELLAR_NETWORKS.has(n)) {
    return process.env['STELLAR_NETWORK'] === 'mainnet' ? 'stellar-mainnet' : 'stellar-testnet'
  }
  if (BASE_NETWORKS.has(n)) {
    return 'base-sepolia'  // testnet; mainnet when STELLAR_NETWORK=mainnet
  }
  return network
}

// ─── x402 payment proof builder ──────────────────────────────────────────────

/**
 * Builds the base64-encoded proof string for the agent to attach as X-Payment header.
 * Format loosely follows the x402 spec draft.
 */
function buildX402PaymentProof(params: {
  network: string
  txHash: string
  amount: string
  payTo: string
}): string {
  const proof = {
    x402Version: 1,
    scheme: 'exact',
    network: params.network,
    payload: {
      transactionHash: params.txHash,
      amount: params.amount,
      currency: 'USDC',
      paidTo: params.payTo,
      timestamp: new Date().toISOString(),
    },
  }
  return Buffer.from(JSON.stringify(proof)).toString('base64')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPolicyCheck(detail: {
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

async function refreshAndCheckBalance(
  userId: string,
  walletId: string,
  publicKey: string,
): Promise<void> {
  const balance = await getUsdcBalance(publicKey)
  if (balance !== null) {
    await prisma.wallet.update({
      where: { id: walletId },
      data: { balanceCache: balance, balanceCachedAt: new Date() },
    })

    const policy = await prisma.policy.findUnique({ where: { userId } })
    const LOW_FLOOR = 10
    let threshold = LOW_FLOOR
    if (policy?.allowanceLimit) {
      const remaining = policy.allowanceLimit.minus(policy.totalSpent).toNumber()
      threshold = Math.max(LOW_FLOOR, remaining * 0.1)
    }

    if (new Decimal(balance).lessThan(threshold)) {
      void sendLowBalanceEmail(userId, balance, String(threshold)).catch(() => undefined)
    }
  }
}
