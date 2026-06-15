/**
 * services/cctp-relay.ts
 *
 * Durable CCTP relay executor and reconciler.
 *
 * Problem: the previous fire-and-forget IIFE in POST /pay and POST /approve/:token
 * died silently on process restart, leaving burned USDC stranded with no destination mint.
 *
 * Solution:
 *   1. `enqueueRelay` persists relay state to transaction.metadata BEFORE first attempt,
 *      so a crash is always recoverable by the reconciler.
 *   2. `runRelay` is the single executor: idempotent, retries up to MAX_RELAY_ATTEMPTS,
 *      handles the "nonce already used" case (mint landed but we crashed before recording).
 *   3. `startCctpRelayReconciler` scans for stuck relays every 2 minutes and retries them.
 *
 * "Relay pending" encoding (no schema migration):
 *   status = 'APPROVED', crossChain = true, stellarTxHash != null, destinationTxHash = null
 *
 * NOTE: the in-process inFlightRelays Set prevents the reconciler from racing the
 * in-request relay within a single process instance. For multi-instance deployments,
 * replace with a DB-level claim (compare-and-swap on metadata.relay.claimedBy or a
 * proper job table) — the reconciler's findMany is the right place to add it.
 */

import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { pollAttestation, relayOnBase } from './cctp.js'
import { incrementTotalSpent } from './policy.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RELAY_ATTEMPTS = 5
const RECONCILE_INTERVAL_MS = 120_000 // 2 minutes

// In-process lock: prevents the reconciler from re-queuing a relay already
// in flight from an HTTP request in the same process.
const inFlightRelays = new Set<string>()

// ─── Types ────────────────────────────────────────────────────────────────────

interface RelayMetadata {
  attempts: number
  incrementOnSuccess: boolean
  lastError: string | null
  lastAttemptAt: string | null
  exhausted?: true
  note?: string
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Persist relay metadata then fire runRelay in the background.
 * Called fire-and-forget (`void enqueueRelay(...)`) from HTTP handlers after
 * the burn transaction lands and the HTTP response has been sent.
 *
 * The metadata persist is best-effort: if it fails we log and continue because
 * the "relay pending" DB encoding (APPROVED + crossChain + stellarTxHash) is
 * enough for the reconciler to find and retry the transaction.
 */
export async function enqueueRelay(txId: string, opts: { incrementOnSuccess: boolean }): Promise<void> {
  try {
    const tx = await prisma.transaction.findUnique({ where: { id: txId } })
    if (!tx) {
      logger.warn('enqueueRelay: transaction not found', { txId })
      void runRelay(txId, opts) // attempt anyway — runRelay will handle the not-found case
      return
    }
    const existingMeta = (tx.metadata as Record<string, unknown>) ?? {}
    await prisma.transaction.update({
      where: { id: txId },
      data: {
        metadata: {
          ...existingMeta,
          relay: {
            attempts: 0,
            incrementOnSuccess: opts.incrementOnSuccess,
            lastError: null,
            lastAttemptAt: null,
          },
        } as object,
      },
    })
  } catch (e) {
    logger.error('enqueueRelay: failed to persist initial relay metadata', {
      txId,
      error: (e as Error).message,
    })
  }
  void runRelay(txId, opts)
}

/**
 * Execute or resume the relay for a transaction.
 * Idempotent: safe to call multiple times — exits early if the transaction is
 * not in "relay pending" state. Also guarded against concurrent calls via
 * `inFlightRelays`.
 */
export async function runRelay(txId: string, opts: { incrementOnSuccess: boolean }): Promise<void> {
  if (inFlightRelays.has(txId)) return
  inFlightRelays.add(txId)
  try {
    await _executeRelay(txId, opts)
  } finally {
    inFlightRelays.delete(txId)
  }
}

/**
 * Start the reconciler. Call once at server start, next to `startWatcher()`.
 * Scans for stuck relay-pending transactions and retries them.
 *
 * NOTE: pollAttestation can block up to 5 minutes per call. Processing 20 stuck
 * transactions sequentially could take up to 100 minutes. Acceptable for v1
 * (low CCTP volume; sequential processing avoids hammering Iris). Parallelise if
 * CCTP volume grows significantly.
 */
export function startCctpRelayReconciler(): void {
  void reconcileOnce()
  setInterval(() => void reconcileOnce(), RECONCILE_INTERVAL_MS)
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function _executeRelay(txId: string, opts: { incrementOnSuccess: boolean }): Promise<void> {
  const tx = await prisma.transaction.findUnique({ where: { id: txId } })
  if (!tx) {
    logger.warn('CCTP runRelay: transaction not found', { txId })
    return
  }

  // Idempotency guard — only process "relay pending" transactions
  if (!(tx.crossChain && tx.status === 'APPROVED' && tx.stellarTxHash && !tx.destinationTxHash)) {
    logger.info('CCTP runRelay: not in relay-pending state, skipping', {
      txId,
      status: tx.status,
      crossChain: tx.crossChain,
      hasStellarHash: !!tx.stellarTxHash,
      hasDestHash: !!tx.destinationTxHash,
    })
    return
  }

  const existingMeta = (tx.metadata as Record<string, unknown>) ?? {}
  const relayMeta = (existingMeta['relay'] as RelayMetadata | undefined) ?? {
    attempts: 0,
    incrementOnSuccess: opts.incrementOnSuccess,
    lastError: null,
    lastAttemptAt: null,
  }
  const attempts = relayMeta.attempts ?? 0

  if (attempts >= MAX_RELAY_ATTEMPTS) {
    await prisma.transaction.update({
      where: { id: txId },
      data: {
        status: 'FAILED',
        blockedReason:
          `CCTP relay exhausted after ${attempts} attempts — USDC was burned on Stellar ` +
          `(tx ${tx.stellarTxHash}); manual relay required.`,
        metadata: {
          ...existingMeta,
          relay: { ...relayMeta, exhausted: true },
        } as object,
      },
    })
    logger.error('CCTP relay exhausted — manual intervention required', {
      txId,
      stellarTxHash: tx.stellarTxHash,
      attempts,
    })
    return
  }

  // Write attempt increment BEFORE trying — a crash mid-attempt still counts it,
  // preventing infinite retries on a pathological input.
  const newAttempts = attempts + 1
  const updatedRelayMeta: RelayMetadata = {
    ...relayMeta,
    attempts: newAttempts,
    lastAttemptAt: new Date().toISOString(),
  }
  await prisma.transaction.update({
    where: { id: txId },
    data: { metadata: { ...existingMeta, relay: updatedRelayMeta } as object },
  })

  try {
    const { message, attestation } = await pollAttestation(tx.stellarTxHash)
    const { baseTxHash } = await relayOnBase(message, attestation)

    await prisma.transaction.update({
      where: { id: txId },
      data: {
        status: 'SUCCESS',
        destinationTxHash: baseTxHash,
        metadata: {
          ...existingMeta,
          relay: { ...updatedRelayMeta, lastError: null },
        } as object,
      },
    })

    if (opts.incrementOnSuccess) {
      await incrementTotalSpent(tx.userId, tx.amount.toFixed(7))
    }

    logger.info('CCTP relay complete', { txId, baseTxHash, attempts: newAttempts })
  } catch (relayErr) {
    const errMsg = (relayErr instanceof Error ? relayErr.message : String(relayErr))

    // "Nonce already used" means the message was relayed in a prior attempt that landed
    // but crashed before we recorded the result. Mark SUCCESS with a note.
    if (/nonce.*used|used.*nonce/i.test(errMsg)) {
      await prisma.transaction.update({
        where: { id: txId },
        data: {
          status: 'SUCCESS',
          metadata: {
            ...existingMeta,
            relay: {
              ...updatedRelayMeta,
              note: 'nonce_already_used — mint landed in a prior attempt; destination hash unknown',
            },
          } as object,
        },
      })
      logger.warn('CCTP relay: nonce already used — treating as already relayed', {
        txId,
        stellarTxHash: tx.stellarTxHash,
      })
      return
    }

    await prisma.transaction.update({
      where: { id: txId },
      data: {
        metadata: {
          ...existingMeta,
          relay: { ...updatedRelayMeta, lastError: errMsg },
        } as object,
      },
    })
    logger.error('CCTP relay attempt failed', {
      txId,
      attempt: newAttempts,
      error: errMsg,
    })
  }
}

async function runRelayFromMetadata(tx: { id: string; metadata: unknown }): Promise<void> {
  const relayMeta = ((tx.metadata as Record<string, unknown> | null)?.['relay']) as RelayMetadata | undefined
  const incrementOnSuccess = relayMeta?.incrementOnSuccess ?? false
  await runRelay(tx.id, { incrementOnSuccess })
}

async function reconcileOnce(): Promise<void> {
  try {
    const stuck = await prisma.transaction.findMany({
      where: {
        crossChain: true,
        status: 'APPROVED',
        stellarTxHash: { not: null },
        destinationTxHash: null,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      take: 20,
      orderBy: { createdAt: 'asc' },
    })
    for (const tx of stuck) {
      await runRelayFromMetadata(tx)
    }
  } catch (e) {
    logger.error('CCTP relay reconciler scan failed', { error: (e as Error).message })
  }
}
