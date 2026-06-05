/**
 * services/alerting.ts
 *
 * Periodic balance monitor for Argens-operated wallets.
 *
 * Checks every ALERT_INTERVAL_MS (default 6h) and sends a single ops alert
 * email if any wallet drops below its configured threshold. Rate-limited to
 * one alert email per wallet per 24h — avoids spam while remaining actionable.
 *
 * Wallets monitored:
 *   - Ops wallet (ARGENS_OPS_WALLET_PUBLIC)   — XLM balance
 *   - Credit pool (ARGENS_CREDIT_POOL_PUBLIC) — USDC balance
 *
 * Thresholds (configurable via env, sensible defaults):
 *   - XLM_ALERT_THRESHOLD_OPS   default "50"   (50 XLM  ≈ 33 new signups at 1.5 XLM each)
 *   - USDC_ALERT_THRESHOLD_POOL default "10"   (10 USDC)
 *
 * Required env:
 *   ADMIN_ALERT_EMAIL  — recipient of alert emails (typically the operator)
 *
 * Call startBalanceAlerting() once at server boot, after DB connects.
 */

import { Decimal } from '@prisma/client/runtime/library'
import { getXlmBalance, getUsdcBalance } from './stellar.js'
import { sendOpsAlertEmail } from './email.js'
import { logger } from '../lib/logger.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const ALERT_INTERVAL_MS  = 6 * 60 * 60 * 1000   // 6 hours
const RATE_LIMIT_MS      = 24 * 60 * 60 * 1000  // 24 hours between alerts per wallet

const XLM_THRESHOLD_OPS   = process.env['XLM_ALERT_THRESHOLD_OPS']   ?? '50'
const USDC_THRESHOLD_POOL  = process.env['USDC_ALERT_THRESHOLD_POOL']  ?? '10'

// ─── Per-wallet alert rate limiting ──────────────────────────────────────────

const lastAlertedAt = new Map<string, number>()  // key: env var name → timestamp

function shouldAlert(key: string): boolean {
  const last = lastAlertedAt.get(key)
  return !last || Date.now() - last > RATE_LIMIT_MS
}

function markAlerted(key: string): void {
  lastAlertedAt.set(key, Date.now())
}

// ─── Check loop ───────────────────────────────────────────────────────────────

async function checkBalances(): Promise<void> {
  const alerts: Array<{
    wallet: string
    asset: 'XLM' | 'USDC'
    balance: string
    threshold: string
    note?: string
  }> = []

  // ── Ops wallet — XLM ──
  const opsPublic = process.env['ARGENS_OPS_WALLET_PUBLIC']
  if (opsPublic) {
    try {
      const xlm = await getXlmBalance(opsPublic)
      if (xlm !== null) {
        const bal = new Decimal(xlm)
        const thr = new Decimal(XLM_THRESHOLD_OPS)
        if (bal.lessThan(thr) && shouldAlert('ARGENS_OPS_WALLET_PUBLIC')) {
          alerts.push({
            wallet: 'Ops wallet',
            asset: 'XLM',
            balance: bal.toFixed(7),
            threshold: thr.toFixed(7),
            note: 'Funds new user accounts. Running low will break signups.',
          })
          markAlerted('ARGENS_OPS_WALLET_PUBLIC')
        }
      }
    } catch (e) {
      logger.warn('alerting: failed to read ops wallet XLM balance', { error: (e as Error).message })
    }
  }

  // ── Credit pool — USDC ──
  const poolPublic = process.env['ARGENS_CREDIT_POOL_PUBLIC']
  if (poolPublic) {
    try {
      const usdc = await getUsdcBalance(poolPublic)
      // null means account doesn't exist yet — skip silently
      if (usdc !== null) {
        const bal = new Decimal(usdc)
        const thr = new Decimal(USDC_THRESHOLD_POOL)
        if (bal.lessThan(thr) && shouldAlert('ARGENS_CREDIT_POOL_PUBLIC')) {
          alerts.push({
            wallet: 'Credit pool',
            asset: 'USDC',
            balance: bal.toFixed(7),
            threshold: thr.toFixed(7),
            note: 'Funds credit-backed marketplace calls. Running low will fail credit payments.',
          })
          markAlerted('ARGENS_CREDIT_POOL_PUBLIC')
        }
      }
    } catch (e) {
      logger.warn('alerting: failed to read credit pool USDC balance', { error: (e as Error).message })
    }
  }

  if (alerts.length === 0) return

  logger.warn('alerting: wallet balance alert firing', {
    count: alerts.length,
    wallets: alerts.map(a => `${a.wallet}:${a.asset}=${a.balance}`),
  })

  await sendOpsAlertEmail(alerts).catch((e: unknown) => {
    logger.error('alerting: failed to send ops alert email', { error: (e as Error).message })
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function startBalanceAlerting(): void {
  if (!process.env['ADMIN_ALERT_EMAIL']) {
    logger.warn('ADMIN_ALERT_EMAIL not set — ops wallet alerting disabled')
    return
  }
  // Run once immediately on boot, then on interval
  void checkBalances()
  setInterval(() => void checkBalances(), ALERT_INTERVAL_MS)
  logger.info('Balance alerting started', {
    intervalHours: ALERT_INTERVAL_MS / 3600000,
    xlmThreshold: XLM_THRESHOLD_OPS,
    usdcPoolThreshold: USDC_THRESHOLD_POOL,
  })
}
