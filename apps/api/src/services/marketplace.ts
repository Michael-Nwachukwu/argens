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
import { sendBlockedEmail, sendPendingApprovalEmail } from './email.js'

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
  const [services, settings] = await Promise.all([
    listMppRouterServices(),
    prisma.marketplaceServiceSetting.findMany({ where: { userId } }),
  ])
  const enabledByProvider = new Map(settings.map((s) => [s.serviceId, s.enabled]))

  const groups = new Map<string, MppRouterService[]>()
  for (const svc of services) {
    const key = providerKey(svc)
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
      endpoint_count: ops.length,
      endpoints: ops
        .map((o) => ({
          id: o.id,
          label: operationLabel(o),
          method: o.method,
          path: o.public_path,
          description: o.description,
          price: o.price,
          example_payload: null as Record<string, unknown> | null,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    }
  })

  return providers.sort((a, b) => a.name.localeCompare(b.name))
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

  const state: {
    txId: string | null
    cost?: CostBreakdown
    challengeSnapshot?: MppChallengeSnapshot
    policyResultForTx?: PolicyResult
  } = { txId: options.approvedTransaction?.id ?? null }

  let mppResult: MppRequestResult
  try {
    mppResult = await performMppRequest({
      secretKey,
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

        const tx = await createMarketplaceTransaction({
          userId,
          walletId: wallet.id,
          service,
          payload,
          cost: challengeCost,
          status: 'APPROVED',
          policyResult,
          challenge,
        })
        state.txId = tx.id
      },
    })
  } catch (e) {
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
    await markMarketplaceFailed(finalTxId, `MPP Router returned HTTP ${mppResult.status}`, mppResult)
    throw new AppError('Marketplace service call failed after payment attempt.', 'MARKETPLACE_UPSTREAM_FAILED', 502, {
      transaction_id: finalTxId,
      upstream_status: mppResult.status,
      upstream_body: mppResult.body,
    })
  }

  const markupResult = await submitPayment({
    senderSecretKey: secretKey,
    recipientPublicKey: feeWallet,
    amount: finalCost.markupString,
    memo: `Argens ${finalTxId.slice(0, 12)}`,
  })

  const mppHash = mppResult.receipt?.reference ?? getProgressHash(mppResult)

  await prisma.transaction.update({
    where: { id: finalTxId },
    data: {
      status: 'SUCCESS',
      stellarTxHash: mppHash,
      policyResult: state.policyResultForTx as unknown as object | undefined,
      metadata: {
        marketplace: buildStoredMarketplaceRequest(service.id, payload),
        mpp_router: {
          public_path: service.public_path,
          challenge: sanitizeChallenge(finalChallenge),
          receipt: mppResult.receipt,
          progress: mppResult.progress,
        },
        markup: {
          rate: MARKUP_RATE.toString(),
          amount: finalCost.markupString,
          stellar_tx_hash: markupResult.hash,
        },
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
      serviceEndpoint: buildMppRouterUrl(params.service),
      costPaid: params.cost.totalString,
      memo: `MPP ${params.service.id}`.slice(0, 28),
      metadata: {
        marketplace: buildStoredMarketplaceRequest(params.service.id, params.payload),
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
      } as unknown as Prisma.InputJsonValue,
    },
  })
}

function normalizeCategories(service: MppRouterService): string[] {
  return (service.categories?.length ? service.categories : [service.category ?? 'marketplace'])
    .filter(Boolean)
    .map((category) => category.toLowerCase())
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
): MarketplaceCallInput {
  return { serviceId, payload }
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
  }
}
