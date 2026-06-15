/**
 * services/watcher.ts
 *
 * Horizon payment stream watcher.
 *
 * For each READY wallet, maintains a Horizon SSE subscription to
 * /accounts/{publicKey}/payments?cursor=now.
 *
 * On an incoming USDC credit:
 *   1. Invalidate + refresh the balance cache
 *   2. Send "wallet funded" email (rate-limited: 1 per user per 5 min)
 *   3. Write an AuditLog entry
 *
 * If the SSE stream drops, a 60-second fallback poller reads
 * /accounts/{publicKey}/payments?cursor={lastSeen} to catch missed events.
 *
 * Never relies on polling alone — SSE is the primary mechanism.
 *
 * Start at server boot: call startWatcher() after the DB connection opens.
 * It self-manages reconnections and new wallets (polls the wallet table every
 * SCAN_INTERVAL_MS for new READY wallets that aren't yet being watched).
 */

import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { server, USDC_ASSET } from './stellar.js'
import { sendWalletFundedEmail } from './email.js'

// ─── Config ─────────────────────────────────────────────────────────────────

const SCAN_INTERVAL_MS = 60_000   // re-scan wallet table for new wallets
const FALLBACK_POLL_MS = 60_000   // fallback poller interval when SSE drops
const EMAIL_RATE_LIMIT_MS = 5 * 60_000 // 5 min between wallet-funded emails per user

// ─── State ───────────────────────────────────────────────────────────────────

interface WatchState {
  publicKey: string
  userId: string
  walletId: string
  lastSeenCursor: string
  closeStream?: (() => void) | null
  lastEmailSentAt?: number
  fallbackTimer?: ReturnType<typeof setTimeout>
}

const watched = new Map<string, WatchState>() // keyed by walletId

// ─── Public API ──────────────────────────────────────────────────────────────

export function startWatcher(): void {
  logger.info('Horizon payment watcher starting')
  void scanAndSubscribe()
  setInterval(() => void scanAndSubscribe(), SCAN_INTERVAL_MS)
}

// ─── Core ────────────────────────────────────────────────────────────────────

async function scanAndSubscribe(): Promise<void> {
  try {
    const wallets = await prisma.wallet.findMany({
      where: { status: 'READY' },
      select: { id: true, userId: true, stellarPublicKey: true },
    })

    for (const w of wallets) {
      if (!watched.has(w.id)) {
        const state: WatchState = {
          publicKey: w.stellarPublicKey,
          userId: w.userId,
          walletId: w.id,
          lastSeenCursor: 'now',
        }
        watched.set(w.id, state)
        subscribeToPayments(state)
      }
    }
  } catch (e) {
    logger.error('Watcher scan failed', { error: (e as Error).message })
  }
}

function subscribeToPayments(state: WatchState): void {

  let closeStream: (() => void) | undefined

  try {
    // Horizon SDK streaming: returns a close() function
    closeStream = server
      .payments()
      .forAccount(state.publicKey)
      .cursor(state.lastSeenCursor)
      .stream({
        onmessage: (payment) => {
          // Update cursor to avoid reprocessing on reconnect
          const pagingToken = (payment as unknown as Record<string, unknown>)['paging_token']
          if (pagingToken && typeof pagingToken === 'string') {
            state.lastSeenCursor = pagingToken
          }
          // Reset fallback timer — we're alive
          resetFallbackTimer(state)
          void handlePayment(state, payment as unknown as Record<string, unknown>)
        },
        onerror: (err: unknown) => {
          logger.warn('SSE payment stream error — will reconnect via fallback', {
            walletId: state.walletId,
            error: String(err),
          })
          // Fallback timer will trigger a reconnect
        },
      }) as unknown as (() => void)
  } catch (e) {
    logger.error('Failed to open SSE stream', {
      walletId: state.walletId,
      error: (e as Error).message,
    })
  }

  state.closeStream = closeStream
  resetFallbackTimer(state)
}

function resetFallbackTimer(state: WatchState): void {
  // Clear any existing fallback timer
  if (state.fallbackTimer) clearTimeout(state.fallbackTimer)

  state.fallbackTimer = setTimeout(() => {
    logger.warn('SSE fallback poller triggered — SSE may have dropped', {
      walletId: state.walletId,
    })
    // Close old stream if still open
    if (state.closeStream) {
      try { state.closeStream() } catch (_) { /* ignore */ }
    }
    // Reconnect
    subscribeToPayments(state)
  }, FALLBACK_POLL_MS)
}

// ─── Payment handler ─────────────────────────────────────────────────────────

async function handlePayment(
  state: WatchState,
  payment: Record<string, unknown>,
): Promise<void> {
  // Only care about incoming USDC payments (type = 'payment', direction = incoming)
  if (payment['type'] !== 'payment') return
  if (payment['to'] !== state.publicKey) return

  const asset = payment['asset_code']
  const issuer = payment['asset_issuer']
  if (asset !== USDC_ASSET.getCode() || issuer !== USDC_ASSET.getIssuer()) return

  const amount = String(payment['amount'] ?? '0')
  logger.info('Incoming USDC payment detected', {
    walletId: state.walletId,
    amount,
    from: payment['from'],
  })

  try {
    // 1. Refresh balance cache
    const { getUsdcBalance } = await import('./stellar.js')
    const balance = await getUsdcBalance(state.publicKey)
    if (balance !== null) {
      await prisma.wallet.update({
        where: { id: state.walletId },
        data: { balanceCache: balance, balanceCachedAt: new Date() },
      })
    }

    // 2. Audit log
    await prisma.auditLog.create({
      data: {
        userId: state.userId,
        eventType: 'WALLET_FUNDED',
        eventData: {
          amount,
          from: String(payment['from'] ?? ''),
          paging_token: String(payment['paging_token'] ?? ''),
          balance_after: balance,
        },
      },
    })

    // 3. Send email (rate-limited: 1 per 5 min per user)
    const now = Date.now()
    if (!state.lastEmailSentAt || now - state.lastEmailSentAt > EMAIL_RATE_LIMIT_MS) {
      state.lastEmailSentAt = now
      await sendWalletFundedEmail(state.userId, amount, balance ?? '0.0000000')
    } else {
      logger.info('Wallet funded email suppressed by rate limit', { userId: state.userId })
    }
  } catch (e) {
    logger.error('Error handling incoming payment', {
      walletId: state.walletId,
      error: (e as Error).message,
    })
  }
}
