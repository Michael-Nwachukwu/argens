/**
 * services/marketplace.ts
 *
 * MPP Router marketplace orchestration:
 * service enablement -> policy check -> Stellar MPP Router call -> Argens markup -> transaction log.
 */

import { Decimal } from '@prisma/client/runtime/library'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'
import { decryptSecretKey, generateSecureToken } from '../lib/crypto.js'
import { logger } from '../lib/logger.js'
import { checkPolicy, incrementTotalSpent, type PolicyResult } from './policy.js'
import { submitPayment } from './payment.js'
import { performMppRequest, type MppChallengeSnapshot, type MppRequestResult } from './mpp-client.js'
import {
  buildMppRouterUrl,
  findMppRouterService,
  listMppRouterServices,
  operationLabel,
  providerDisplayName,
  providerKey,
  type MppRouterService,
} from './mpp-router.js'
import { sendBlockedEmail, sendPendingApprovalEmail, sendMarketplaceRefundAlertEmail } from './email.js'
import { consumeCredits, getActiveCreditsBalance, refundCredits } from './credits.js'
import { examplePayloadFor } from './marketplace-examples.js'

const MARKUP_RATE = new Decimal('0.20')
const MPP_USDC_BASE_UNITS = new Decimal('10000000')
const NETWORK = process.env['STELLAR_NETWORK'] === 'mainnet' ? 'mainnet' : 'testnet'
const ROUTER_NETWORK = 'stellar:pubnet'

export class MarketplaceBlockedError extends AppError {
  constructor(public readonly transactionId: string, public readonly policyResult: PolicyResult) {
    super('Marketplace call blocked by policy', 'POLICY_BLOCKED', 402, {
      transaction_id: transactionId,
      reason: policyResult.reason,
      policy: policyResult.policy,
    })
  }
}

export class MarketplacePendingApprovalError extends AppError {
  constructor(public readonly transactionId: string) {
    super('Marketplace call awaiting developer approval', 'PENDING_APPROVAL', 202, {
      transaction_id: transactionId,
      poll_url: `/v1/transactions/${transactionId}`,
    })
  }
}

export interface MarketplaceCallInput {
  serviceId: string
  payload?: Record<string, unknown>
  query?: Record<string, string | number | boolean>
}

export interface MarketplaceCallResult {
  status: 'success'
  transaction_id: string
  stellar_tx_hash: string | null
  service_id: string
  service_name: string
  cost_paid: string
  currency: 'USDC'
  result: unknown
}

interface ApprovedMarketplaceTransaction {
  id: string
  costPaid: Decimal | null
  metadata: unknown
}

/**
 * Returns the marketplace catalog grouped into PROVIDERS (one card per provider, e.g.
 * "AgentMail", "OpenAI"), each with its child endpoints. Enablement is per-provider —
 * a `MarketplaceServiceSetting` row is keyed by the provider key, not the operation id.
 */
export async function getMarketplaceServicesForResponse(userId: string) {
  const [services, settings, globallyDisabled] = await Promise.all([
    listMppRouterServices(),
    prisma.marketplaceServiceSetting.findMany({ where: { userId } }),
    getGloballyDisabledProviderIds(),
  ])
  const enabledByProvider = new Map(settings.map((s) => [s.serviceId, s.enabled]))

  const groups = new Map<string, MppRouterService[]>()
  for (const svc of services) {
    const key = providerKey(svc)
    if (globallyDisabled.has(key)) continue // hidden platform-wide
    const arr = groups.get(key)
    if (arr) arr.push(svc)
    else groups.set(key, [svc])
  }

  const providers = [...groups.entries()].map(([id, ops]) => {
    const name = providerDisplayName(ops[0]!)
    const descs = ops.map((o) => o.description).filter(Boolean).sort((a, b) => a.length - b.length)
    const description = descs[0] ?? `${ops.length} ${name} endpoints`

    const categories = new Set<string>()
    ops.forEach((o) => normalizeCategories(o).forEach((c) => categories.add(c)))

    const limited = ops.some((o) => o.status === 'limited')
    const docsUrl =
      ops.find((o) => o.docs?.homepage)?.docs?.homepage ?? ops.find((o) => o.docs_url)?.docs_url ?? null

    return {
      id,
      name,
      description,
      categories: [...categories],
      display_price: priceRangeLabel(ops.map((o) => o.price)),
      is_enabled: enabledByProvider.get(id) ?? false,
      status: limited ? ('limited' as const) : ('active' as const),
      availability_note: limited ? 'Some endpoints have limited metadata.' : null,
      payment_rail: 'stellar-mainnet',
      docs_url: docsUrl,
      skill_url: `${publicWebBaseUrl()}/SKILL/${id}.md`,
      api_skill_url: `/v1/marketplace/services/${id}/skill.md`,
      endpoint_count: ops.length,
      endpoints: ops
        .map((o) => ({
          id: o.id,
          label: operationLabel(o),
          method: o.method,
          path: o.public_path,
          description: o.description,
          price: o.price,
          example_payload: examplePayloadFor(o.id, id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    }
  })

  return providers.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getMarketplaceProviderSkillMarkdown(providerId: string): Promise<string | null> {
  const services = await listMppRouterServices()
  const ops = services
    .filter((service) => providerKey(service) === providerId)
    .sort((a, b) => operationLabel(a).localeCompare(operationLabel(b)))

  if (ops.length === 0) return null

  const name = providerDisplayName(ops[0]!)
  const description = `${ops.length} ${name} endpoints available through the Argens marketplace.`
  const categories = [...new Set(ops.flatMap(normalizeCategories))].sort()
  const docs = collectProviderDocs(ops)
  const first = ops[0]!

  return [
    `# Argens Marketplace Skill — ${name}`,
    '',
    `Provider id: \`${providerId}\``,
    `Payment rail: Stellar mainnet USDC through Argens marketplace`,
    `Status: ${ops.some((o) => o.status === 'limited') ? 'limited metadata' : 'active'}`,
    categories.length ? `Categories: ${categories.map((c) => `\`${c}\``).join(', ')}` : null,
    '',
    description,
    '',
    '## How agents should use this provider',
    '',
    '1. Ask the user for their Argens API key and set `Authorization: Bearer <ARGENS_KEY>`.',
    '2. Check `GET /v1/agent/status` for wallet balance and policy limits.',
    `3. Confirm this provider is enabled with \`GET /v1/marketplace/services/${providerId}\`.`,
    '4. Pick an endpoint from this file and pass its endpoint id as `service_id` to `POST /v1/marketplace/call`.',
    '5. Explain the service, expected cost, and purpose to the user before making the call.',
    '',
    'If the provider is disabled, `POST /v1/marketplace/call` returns `403 SERVICE_DISABLED`. Do not retry; tell the user to enable the provider in the Argens dashboard.',
    '',
    '## Call shape',
    '',
    '```http',
    'POST https://api.argens.xyz/v1/marketplace/call',
    'Authorization: Bearer <ARGENS_KEY>',
    'Content-Type: application/json',
    '```',
    '',
    '```json',
    JSON.stringify(
      {
        service_id: first.id,
        payload: examplePayloadFor(first.id, providerId) ?? {},
        query: {},
      },
      null,
      2,
    ),
    '```',
    '',
    'Use `payload` for the upstream JSON body and `query` for URL query parameters. Omit either field when the endpoint does not need it. Where an endpoint below shows an example payload, copy it and adjust the values.',
    '',
    '## Endpoints',
    '',
    ...ops.flatMap((op) => {
      const example = examplePayloadFor(op.id, providerId)
      return [
        `### ${operationLabel(op)}`,
        '',
        `- Endpoint id: \`${op.id}\``,
        `- Method: \`${op.method}\``,
        `- Upstream path: \`${op.public_path}\``,
        `- Price shown by provider: ${op.price}`,
        op.description ? `- Description: ${op.description}` : null,
        op.docs_url ? `- Docs: ${op.docs_url}` : null,
        example ? '' : null,
        example ? 'Example payload:' : null,
        example ? '```json' : null,
        example ? JSON.stringify(example, null, 2) : null,
        example ? '```' : null,
        '',
      ]
    }),
    docs.length ? '## Upstream Docs' : null,
    '',
    ...docs.map((url) => `- ${url}`),
    '',
    '## Response handling',
    '',
    '- `200` with `data.status: "success"` means the marketplace call completed. Read `data.result` for the upstream response.',
    '- `202` means the transaction needs human approval. Poll `data.poll_url` until the transaction resolves.',
    '- `402 POLICY_BLOCKED` means policy blocked the spend. Do not retry automatically.',
    '- `403 SERVICE_DISABLED` means the user must enable this provider in the dashboard.',
    '- `502 MARKETPLACE_NOT_MPP` means the upstream service rejected the request before payment. No USDC was charged; fix the request payload or query.',
    '',
    '## More Argens context',
    '',
    `- Argens skill: ${publicWebBaseUrl()}/SKILL.md`,
    `- Argens docs: ${publicWebBaseUrl()}/docs`,
    `- Provider skill URL: ${publicWebBaseUrl()}/SKILL/${providerId}.md`,
    '',
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}

// ─── Global (platform-wide) kill-switch ─────────────────────────────────────
//
// A provider with no GlobalServiceSetting row is enabled. Admin writes a row
// only to pause a provider. We cache the small set of paused ids briefly so the
// per-request lookup doesn't hit the DB on every catalog read / marketplace call.

let disabledCache: { ids: Set<string>; expiresAt: number } | null = null
const DISABLED_CACHE_TTL_MS = 30_000

/** Provider ids that are globally paused (enabled = false). Cached ~30s. */
export async function getGloballyDisabledProviderIds(): Promise<Set<string>> {
  if (disabledCache && Date.now() < disabledCache.expiresAt) return disabledCache.ids
  const rows = await prisma.globalServiceSetting.findMany({
    where: { enabled: false },
    select: { providerId: true },
  })
  const ids = new Set(rows.map((r) => r.providerId))
  disabledCache = { ids, expiresAt: Date.now() + DISABLED_CACHE_TTL_MS }
  return ids
}

/** Pause or resume a provider platform-wide. Invalidates the disabled cache. */
export async function setGlobalServiceEnabled(
  providerId: string,
  enabled: boolean,
  note?: string,
) {
  const services = await listMppRouterServices()
  const exists = services.some((s) => providerKey(s) === providerId)
  if (!exists) throw new AppError('Marketplace provider not found', 'SERVICE_NOT_FOUND', 404)

  const setting = await prisma.globalServiceSetting.upsert({
    where: { providerId },
    update: { enabled, note: note ?? null },
    create: { providerId, enabled, note: note ?? null },
  })
  disabledCache = null
  return { provider_id: setting.providerId, enabled: setting.enabled, note: setting.note }
}

/** Enable or disable a whole provider (all of its endpoints) for a user. */
export async function setMarketplaceServiceEnabled(
  userId: string,
  providerId: string,
  enabled: boolean,
) {
  const services = await listMppRouterServices()
  const exists = services.some((s) => providerKey(s) === providerId)
  if (!exists) throw new AppError('Marketplace provider not found', 'SERVICE_NOT_FOUND', 404)

  const setting = await prisma.marketplaceServiceSetting.upsert({
    where: { userId_serviceId: { userId, serviceId: providerId } },
    update: { enabled },
    create: { userId, serviceId: providerId, enabled },
  })

  return {
    provider_id: setting.serviceId,
    enabled: setting.enabled,
  }
}

function parsePrice(p: string): number | null {
  if (/free/i.test(p)) return 0
  const m = String(p).match(/\$\s*([0-9]*\.?[0-9]+)/)
  return m ? parseFloat(m[1]!) : null
}

function priceRangeLabel(priceStrings: string[]): string {
  const nums = priceStrings.map(parsePrice).filter((n): n is number => n != null)
  if (nums.length === 0) return priceStrings[0] ?? 'see endpoints'
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const fmt = (n: number) => (n === 0 ? 'free' : `$${n}`)
  if (min === max) return `${fmt(min)}/request`
  if (min === 0) return `free – ${fmt(max)}/request`
  return `${fmt(min)} – ${fmt(max)}/request`
}

export async function executeMarketplaceCall(
  userId: string,
  input: MarketplaceCallInput,
): Promise<MarketplaceCallResult> {
  return executeMarketplaceCallInternal(userId, input)
}

export async function executeApprovedMarketplaceTransaction(
  userId: string,
  transactionId: string,
): Promise<MarketplaceCallResult> {
  const tx = await prisma.transaction.findFirst({
    where: { id: transactionId, userId, type: 'marketplace' },
    select: { id: true, costPaid: true, metadata: true },
  })

  if (!tx) throw new AppError('Marketplace transaction not found', 'NOT_FOUND', 404)

  const stored = getStoredMarketplaceRequest(tx.metadata)
  if (!stored) {
    throw new AppError(
      'Marketplace transaction is missing replay metadata.',
      'MARKETPLACE_REPLAY_UNAVAILABLE',
      500,
      { transaction_id: transactionId },
    )
  }

  return executeMarketplaceCallInternal(userId, stored, { approvedTransaction: tx })
}

async function executeMarketplaceCallInternal(
  userId: string,
  input: MarketplaceCallInput,
  options: { approvedTransaction?: ApprovedMarketplaceTransaction } = {},
): Promise<MarketplaceCallResult> {
  if (NETWORK !== 'mainnet') {
    throw new AppError(
      'Marketplace calls require Stellar mainnet because MPP Router accepts stellar:pubnet payments.',
      'MARKETPLACE_MAINNET_REQUIRED',
      409,
    )
  }

  const service = await findMppRouterService(input.serviceId)
  if (!service) throw new AppError('Marketplace service not found', 'SERVICE_NOT_FOUND', 404)

  // Global kill-switch wins over per-user enablement. A paused provider is fully
  // off for everyone — reject before any wallet/credit/policy work happens.
  const globallyDisabled = await getGloballyDisabledProviderIds()
  if (globallyDisabled.has(providerKey(service))) {
    throw new AppError(
      'This marketplace service is temporarily paused by Argens.',
      'MARKETPLACE_SERVICE_PAUSED',
      503,
      { service_id: service.id, provider: providerKey(service) },
    )
  }

  await assertServiceEnabled(userId, service)

  const wallet = await prisma.wallet.findUnique({ where: { userId } })
  if (!wallet) throw new AppError('Wallet not found.', 'WALLET_NOT_FOUND', 404)
  if (wallet.status !== 'READY') {
    throw new AppError('Wallet is not ready. Bootstrap may still be in progress.', 'WALLET_NOT_READY', 503)
  }

  const feeWallet = process.env['ARGENS_FEE_WALLET']
  if (!feeWallet) {
    throw new AppError('ARGENS_FEE_WALLET is not configured.', 'FEE_WALLET_NOT_CONFIGURED', 500)
  }

  const secretKey = decryptSecretKey(wallet.stellarSecretKeyEnc)
  const url = buildMppRouterUrl(service, input.query)
  const payload = input.payload ?? {}

  // Credit path: if the user has any active credits AND the credit-pool wallet is configured,
  // route the on-chain MPP Router payment through the pool wallet and decrement credits in DB.
  // Falls back transparently to the USDC path if either condition fails.
  //
  // Applies to both immediately-approved calls and approval-execution. For approval-execution
  // we know the exact cost (stored on the transaction at PENDING_APPROVAL time) and can
  // pre-check that credits actually cover it before committing to the pool wallet as funder.
  // If credits were used elsewhere between approval and execution, we transparently fall
  // back to the user's USDC wallet.
  const activeCredits = await getActiveCreditsBalance(userId)
  const creditPoolSecret = process.env['ARGENS_CREDIT_POOL_SECRET']
  let creditPathEligible = activeCredits.greaterThan(0) && Boolean(creditPoolSecret)
  if (creditPathEligible && options.approvedTransaction) {
    const approvedCost = options.approvedTransaction.costPaid
    if (!approvedCost || activeCredits.lessThan(approvedCost)) {
      creditPathEligible = false
      logger.info('Approval execution: credits insufficient for approved cost — falling back to USDC', {
        userId,
        transactionId: options.approvedTransaction.id,
        activeCredits: activeCredits.toFixed(7),
        approvedCost: approvedCost?.toFixed(7) ?? null,
      })
    }
  }
  if (activeCredits.greaterThan(0) && !creditPoolSecret) {
    logger.warn('User has active credits but ARGENS_CREDIT_POOL_SECRET is not configured — falling back to USDC', { userId })
  }
  const fundingSecret = creditPathEligible ? creditPoolSecret! : secretKey

  const state: {
    txId: string | null
    cost?: CostBreakdown
    challengeSnapshot?: MppChallengeSnapshot
    policyResultForTx?: PolicyResult
    paidWithCredits: boolean
    creditDeductions?: Array<{ grantId: string; deducted: string }>
  } = { txId: options.approvedTransaction?.id ?? null, paidWithCredits: false }

  let mppResult: MppRequestResult
  try {
    mppResult = await performMppRequest({
      secretKey: fundingSecret,
      url,
      method: service.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      onChallenge: async (challenge) => {
        state.challengeSnapshot = challenge
        state.cost = calculateCostsFromChallenge(challenge, service)
        const challengeCost = state.cost

        if (options.approvedTransaction) {
          const approvedCost = options.approvedTransaction.costPaid
          if (!approvedCost || challengeCost.total.greaterThan(approvedCost)) {
            throw new AppError(
              'Marketplace price changed after approval. No payment was made.',
              'MARKETPLACE_PRICE_CHANGED',
              409,
              {
                approved_cost: approvedCost?.toFixed(7) ?? null,
                attempted_cost: challengeCost.totalString,
              },
            )
          }

          // Approval execution: if we elected the credit path before performMppRequest,
          // deduct credits now (before MPP commits payment from the pool wallet).
          // The pre-check above confirmed sufficient credits, but a concurrent call
          // could have depleted them — consumeCredits will throw if so.
          if (creditPathEligible) {
            const consumption = await consumeCredits(userId, challengeCost.totalString)
            state.paidWithCredits = true
            state.creditDeductions = consumption.grants
          }

          await prisma.transaction.update({
            where: { id: options.approvedTransaction.id },
            data: { status: 'APPROVED' },
          })
          state.txId = options.approvedTransaction.id
          return
        }

        const policyResult = await checkPolicy(userId, challengeCost.totalString)
        state.policyResultForTx = policyResult

        if (policyResult.status === 'BLOCKED') {
          const tx = await createMarketplaceTransaction({
            userId,
            walletId: wallet.id,
            service,
            payload,
            query: input.query,
            cost: challengeCost,
            status: 'BLOCKED',
            policyResult,
            blockedReason: policyResult.reason,
            challenge,
          })

          void sendBlockedEmail(
            userId,
            tx.id,
            challengeCost.totalString,
            service.name,
            policyResult.reason ?? 'policy_violation',
          ).catch((e: unknown) =>
            logger.error('Failed to send marketplace blocked email', { userId, error: (e as Error).message }),
          )

          throw new MarketplaceBlockedError(tx.id, policyResult)
        }

        if (policyResult.status === 'PENDING_APPROVAL') {
          const token = generateSecureToken()
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
          const tx = await createMarketplaceTransaction({
            userId,
            walletId: wallet.id,
            service,
            payload,
            query: input.query,
            cost: challengeCost,
            status: 'PENDING_APPROVAL',
            policyResult,
            challenge,
            approval: { token, expiresAt },
          })

          void sendPendingApprovalEmail(userId, tx.id, token, challengeCost.totalString, service.name).catch((e: unknown) =>
            logger.error('Failed to send marketplace approval email', { userId, error: (e as Error).message }),
          )

          throw new MarketplacePendingApprovalError(tx.id)
        }

        // If eligible, deduct credits BEFORE mpp commits the payment from the pool wallet.
        // If credits no longer cover the cost (race) consumeCredits throws → mpp never pays.
        if (creditPathEligible) {
          if (activeCredits.lessThan(challengeCost.total)) {
            throw new AppError(
              'Insufficient credits for this marketplace call.',
              'INSUFFICIENT_CREDITS',
              402,
              { requested: challengeCost.totalString, available: activeCredits.toFixed(7) },
            )
          }
          const consumption = await consumeCredits(userId, challengeCost.totalString)
          state.paidWithCredits = true
          state.creditDeductions = consumption.grants
        }

        const tx = await createMarketplaceTransaction({
          userId,
          walletId: wallet.id,
          service,
          payload,
          query: input.query,
          cost: challengeCost,
          status: 'APPROVED',
          policyResult,
          challenge,
        })
        state.txId = tx.id
      },
    })
  } catch (e) {
    // If credits were deducted before MPP Router commit, refund them — the on-chain
    // payment didn't complete so the user should be made whole. AppError throws inside
    // onChallenge (BLOCKED, PENDING_APPROVAL, INSUFFICIENT_CREDITS) happen before the
    // deduction, so state.creditDeductions is undefined and refundCredits is a no-op.
    if (state.paidWithCredits && state.creditDeductions?.length) {
      await refundCredits(state.creditDeductions).catch((refundErr) =>
        logger.error('Credit refund failed after MPP Router failure — manual reconciliation needed', {
          userId,
          serviceId: service.id,
          deductions: state.creditDeductions,
          error: (refundErr as Error).message,
        }),
      )
      state.paidWithCredits = false
      state.creditDeductions = undefined
    }
    if (e instanceof AppError) throw e
    logger.error('Marketplace MPP Router request failed', {
      userId,
      serviceId: service.id,
      error: (e as Error).message,
    })
    throw new AppError('Marketplace payment or service call failed.', 'MARKETPLACE_PAYMENT_FAILED', 502, {
      service_id: service.id,
      reason: (e as Error).message,
    })
  }

  if (!state.challengeSnapshot || !state.cost || !state.txId) {
    // The upstream service rejected the request before any MPP payment challenge
    // was issued. No USDC was charged. Surface the upstream body so the caller
    // can fix their request.
    throw new AppError(
      'Marketplace service rejected the request before any payment was made. No USDC was charged. See upstream_body for details.',
      'MARKETPLACE_NOT_MPP',
      502,
      {
        service_id: service.id,
        upstream_status: mppResult.status,
        upstream_body: mppResult.body,
        no_payment_made: true,
      },
    )
  }

  const finalCost = state.cost
  const finalTxId = state.txId
  const finalChallenge = state.challengeSnapshot

  if (!mppResult.ok) {
    // Credits were deducted before MPP Router was called, and the on-chain Stellar
    // payment may or may not have committed. If the receipt indicates success but the
    // upstream service returned non-2xx, the user paid but didn't get value — that's
    // an upstream-service issue (handled by markMarketplaceFailed). If no receipt
    // exists, the payment likely never went through — refund credits.
    const paymentCommitted = Boolean(mppResult.receipt)

    // The silent-loss case: the user's OWN USDC was pulled on-chain (receipt present)
    // but the service failed. Credits auto-refund below, so only flag the USDC path.
    const refundRequired = paymentCommitted && !state.paidWithCredits

    if (state.paidWithCredits && state.creditDeductions?.length && !paymentCommitted) {
      await refundCredits(state.creditDeductions).catch((refundErr) =>
        logger.error('Credit refund failed after MPP upstream failure — manual reconciliation needed', {
          userId,
          transactionId: finalTxId,
          deductions: state.creditDeductions,
          error: (refundErr as Error).message,
        }),
      )
    }

    const failureReason = `MPP Router returned HTTP ${mppResult.status}`
    await markMarketplaceFailed(
      finalTxId,
      failureReason,
      mppResult,
      refundRequired ? { refundRequired: true, refundAmount: finalCost.totalString } : undefined,
    )

    if (refundRequired) {
      // Operator-facing: write an audit trail and alert so the manual refund happens.
      // Both are best-effort — never block or swallow.
      await prisma.auditLog
        .create({
          data: {
            userId,
            eventType: 'MARKETPLACE_REFUND_REQUIRED',
            eventData: {
              transactionId: finalTxId,
              serviceId: service.id,
              amount: finalCost.totalString,
              upstreamStatus: mppResult.status,
              reason: failureReason,
            },
          },
        })
        .catch((e: unknown) =>
          logger.error('Audit write failed for MARKETPLACE_REFUND_REQUIRED', {
            userId,
            transactionId: finalTxId,
            error: (e as Error).message,
          }),
        )

      void (async () => {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
        await sendMarketplaceRefundAlertEmail({
          transactionId: finalTxId,
          userEmail: u?.email ?? userId,
          serviceId: service.id,
          amount: finalCost.totalString,
          upstreamStatus: mppResult.status,
          reason: failureReason,
        })
      })().catch((e: unknown) =>
        logger.error('Marketplace refund alert email failed', {
          userId,
          transactionId: finalTxId,
          error: (e as Error).message,
        }),
      )
    }

    // Detect "channel not installed" — this is an Argens-side infrastructure gap, not a
    // caller error. Give a clear message so the agent isn't confused about its own request.
    const upstreamErr = typeof mppResult.body === 'object' && mppResult.body !== null ? mppResult.body as Record<string, unknown> : null
    const isChannelError = mppResult.status === 503 && (
      String(upstreamErr?.['error'] ?? '').toLowerCase().includes('channel') ||
      String(upstreamErr?.['detail'] ?? '').toLowerCase().includes('channel')
    )
    if (isChannelError) {
      logger.error('MPP Router channel not configured for service — operator action required', {
        userId,
        serviceId: service.id,
        transactionId: finalTxId,
        upstream_body: mppResult.body,
      })
      throw new AppError(
        'This marketplace service is temporarily unavailable due to a provider configuration issue on Argens\'s side. Your request was valid — contact support@argens.xyz with the transaction_id for a full refund.',
        'MARKETPLACE_SERVICE_UNAVAILABLE',
        503,
        { transaction_id: finalTxId, service_id: service.id },
      )
    }

    throw new AppError('Marketplace service call failed after payment attempt.', 'MARKETPLACE_UPSTREAM_FAILED', 502, {
      transaction_id: finalTxId,
      upstream_status: mppResult.status,
      upstream_body: mppResult.body,
    })
  }

  // On credit path Argens funded the MPP Router payment from the pool wallet — no markup.
  // On USDC path the user paid MPP Router; Argens now collects markup into the fee wallet.
  let markupHash: string | null = null
  if (!state.paidWithCredits) {
    const markupResult = await submitPayment({
      senderSecretKey: secretKey,
      recipientPublicKey: feeWallet,
      amount: finalCost.markupString,
      memo: `Argens ${finalTxId.slice(0, 12)}`,
    })
    markupHash = markupResult.hash
  }

  const mppHash = mppResult.receipt?.reference ?? getProgressHash(mppResult)

  await prisma.transaction.update({
    where: { id: finalTxId },
    data: {
      status: 'SUCCESS',
      stellarTxHash: mppHash,
      policyResult: state.policyResultForTx as unknown as object | undefined,
      metadata: {
        marketplace: buildStoredMarketplaceRequest(service.id, payload, input.query),
        mpp_router: {
          public_path: service.public_path,
          challenge: sanitizeChallenge(finalChallenge),
          receipt: mppResult.receipt,
          progress: mppResult.progress,
        },
        ...(state.paidWithCredits
          ? {
              credits: {
                total: finalCost.totalString,
                grants: state.creditDeductions ?? [],
              },
            }
          : {
              markup: {
                rate: MARKUP_RATE.toString(),
                amount: finalCost.markupString,
                stellar_tx_hash: markupHash,
              },
            }),
      } as unknown as Prisma.InputJsonValue,
    },
  })

  await incrementTotalSpent(userId, finalCost.totalString)

  return {
    status: 'success',
    transaction_id: finalTxId,
    stellar_tx_hash: mppHash,
    service_id: service.id,
    service_name: service.name,
    cost_paid: finalCost.totalString,
    currency: 'USDC',
    result: mppResult.body,
  }
}

async function assertServiceEnabled(userId: string, service: MppRouterService): Promise<void> {
  const provider = providerKey(service)
  const setting = await prisma.marketplaceServiceSetting.findUnique({
    where: { userId_serviceId: { userId, serviceId: provider } },
  })

  if (!setting?.enabled) {
    throw new AppError(
      'Marketplace service is disabled for this API key.',
      'SERVICE_DISABLED',
      403,
      {
        service_id: service.id,
        provider,
        message: `Enable "${providerDisplayName(service)}" from the dashboard before agents can call it.`,
      },
    )
  }
}

interface CostBreakdown {
  base: Decimal
  markup: Decimal
  total: Decimal
  baseString: string
  markupString: string
  totalString: string
}

function calculateCostsFromChallenge(challenge: MppChallengeSnapshot, service: MppRouterService): CostBreakdown {
  if (challenge.method !== 'stellar' || challenge.intent !== 'charge') {
    throw new AppError('Marketplace service did not offer Stellar charge payment.', 'UNSUPPORTED_PAYMENT_METHOD', 402, {
      method: challenge.method,
      intent: challenge.intent,
    })
  }

  if (!challenge.amount || !challenge.currency || !challenge.recipient) {
    throw new AppError('Marketplace challenge is missing Stellar payment details.', 'INVALID_MPP_CHALLENGE', 502)
  }

  if (service.payment_hints?.network && service.payment_hints.network !== ROUTER_NETWORK) {
    throw new AppError('Marketplace service is not on Stellar mainnet.', 'UNSUPPORTED_NETWORK', 409, {
      service_network: service.payment_hints.network,
    })
  }

  const expectedCurrency = service.payment_hints?.asset_sac
  if (expectedCurrency && challenge.currency !== expectedCurrency) {
    throw new AppError('Marketplace service did not request the expected USDC asset.', 'UNSUPPORTED_CURRENCY', 402, {
      expected_currency: expectedCurrency,
      challenge_currency: challenge.currency,
    })
  }

  if (!/^\d+$/.test(challenge.amount)) {
    throw new AppError('Marketplace challenge amount must be integer base units.', 'INVALID_MPP_AMOUNT', 502, {
      challenge_amount: challenge.amount,
    })
  }

  const base = new Decimal(challenge.amount).div(MPP_USDC_BASE_UNITS)
  if (!base.isPositive()) {
    throw new AppError('Marketplace challenge amount must be greater than zero.', 'INVALID_MPP_AMOUNT', 502)
  }

  const markup = base.mul(MARKUP_RATE)
  const total = base.plus(markup)

  return {
    base,
    markup,
    total,
    baseString: formatAmount(base),
    markupString: formatAmount(markup),
    totalString: formatAmount(total),
  }
}

async function createMarketplaceTransaction(params: {
  userId: string
  walletId: string
  service: MppRouterService
  payload: Record<string, unknown>
  query?: Record<string, string | number | boolean>
  cost: CostBreakdown
  status: 'APPROVED' | 'BLOCKED' | 'PENDING_APPROVAL'
  policyResult: PolicyResult
  blockedReason?: string
  challenge: MppChallengeSnapshot
  approval?: { token: string; expiresAt: Date }
}) {
  return prisma.transaction.create({
    data: {
      userId: params.userId,
      walletId: params.walletId,
      recipientAddress: params.challenge.recipient ?? params.service.payment_hints?.pay_to ?? 'MPP_ROUTER',
      amount: params.cost.baseString,
      currency: 'USDC',
      status: params.status,
      type: 'marketplace',
      serviceId: params.service.id,
      serviceEndpoint: buildMppRouterUrl(params.service, params.query),
      costPaid: params.cost.totalString,
      memo: `MPP ${params.service.id}`.slice(0, 28),
      metadata: {
        marketplace: buildStoredMarketplaceRequest(params.service.id, params.payload, params.query),
        mpp_router: {
          public_path: params.service.public_path,
          challenge: sanitizeChallenge(params.challenge),
        },
        markup: { rate: MARKUP_RATE.toString(), amount: params.cost.markupString },
      } as unknown as Prisma.InputJsonValue,
      policyResult: params.policyResult as unknown as object,
      blockedReason: params.blockedReason,
      ...(params.approval && {
        approvalQueue: {
          create: {
            userId: params.userId,
            token: params.approval.token,
            expiresAt: params.approval.expiresAt,
          },
        },
      }),
    },
  })
}

async function markMarketplaceFailed(
  transactionId: string,
  reason: string,
  mppResult?: MppRequestResult,
  refund?: { refundRequired: boolean; refundAmount?: string },
): Promise<void> {
  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: 'FAILED',
      blockedReason: reason,
      metadata: {
        mpp_router: {
          receipt: mppResult?.receipt ?? null,
          progress: mppResult?.progress ?? [],
          upstream_status: mppResult?.status ?? null,
          upstream_body: mppResult?.body ?? null,
        },
        // Marks the paid-but-undelivered case for the operator's manual-refund queue.
        // Surfaced in the Ops Console (GET /admin/transactions/failed) and aggregated
        // per provider in GET /admin/marketplace/services.
        ...(refund?.refundRequired
          ? {
              refund: {
                required: true,
                amount: refund.refundAmount ?? null,
                reason,
                receipt_reference: mppResult?.receipt?.reference ?? null,
                upstream_status: mppResult?.status ?? null,
              },
            }
          : {}),
      } as unknown as Prisma.InputJsonValue,
    },
  })
}

function normalizeCategories(service: MppRouterService): string[] {
  return (service.categories?.length ? service.categories : [service.category ?? 'marketplace'])
    .filter(Boolean)
    .map((category) => category.toLowerCase())
}

function publicWebBaseUrl(): string {
  return (process.env['ARGENS_WEB_URL'] ?? process.env['WEB_URL'] ?? 'https://argens.xyz').replace(/\/$/, '')
}

function collectProviderDocs(services: MppRouterService[]): string[] {
  const docs = new Set<string>()
  for (const service of services) {
    if (service.docs_url) docs.add(service.docs_url)
    if (service.docs?.homepage) docs.add(service.docs.homepage)
    if (service.docs?.llms_txt) docs.add(service.docs.llms_txt)
    if (service.docs?.api_reference) docs.add(service.docs.api_reference)
  }
  return [...docs].sort()
}

function formatAmount(amount: Decimal): string {
  return amount.toDecimalPlaces(7).toFixed(7)
}

function getProgressHash(result: MppRequestResult): string | null {
  for (const event of [...result.progress].reverse()) {
    if (typeof event['hash'] === 'string') return event['hash']
  }
  return null
}

function sanitizeChallenge(challenge: MppChallengeSnapshot) {
  return {
    id: challenge.id,
    method: challenge.method,
    intent: challenge.intent,
    description: challenge.description,
    amount: challenge.amount,
    currency: challenge.currency,
    recipient: challenge.recipient,
  }
}

function buildStoredMarketplaceRequest(
  serviceId: string,
  payload: Record<string, unknown>,
  query?: Record<string, string | number | boolean>,
): MarketplaceCallInput {
  return { serviceId, payload, ...(query ? { query } : {}) }
}

function getStoredMarketplaceRequest(metadata: unknown): MarketplaceCallInput | null {
  if (!metadata || typeof metadata !== 'object') return null
  const marketplace = (metadata as Record<string, unknown>)['marketplace']
  if (!marketplace || typeof marketplace !== 'object') return null

  const record = marketplace as Record<string, unknown>
  if (typeof record['serviceId'] !== 'string') return null

  return {
    serviceId: record['serviceId'],
    payload: record['payload'] && typeof record['payload'] === 'object'
      ? record['payload'] as Record<string, unknown>
      : {},
    query: record['query'] && typeof record['query'] === 'object'
      ? record['query'] as Record<string, string | number | boolean>
      : undefined,
  }
}
