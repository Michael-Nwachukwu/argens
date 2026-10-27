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
 *   - Ops wallet (ARGENS_OPS_WALLET_PUBLIC)     — SPENDABLE XLM (balance minus its minimum
 *     balance). Its raw balance includes the reserves it has sponsored for every user wallet,
 *     which it can never spend, so judging it on total balance would never fire.
 *   - Credit pool (ARGENS_CREDIT_POOL_PUBLIC)   — USDC balance
 *   - Fee wallet (ARGENS_FEE_WALLET)            — USDC balance
 *   - Base relayer (ARGENS_BASE_RELAYER_SECRET) — ETH on Base
 *
 * Thresholds (configurable via env, sensible defaults):
 *   - XLM_ALERT_THRESHOLD_OPS      default "50"    (spendable; ≈ 33 sponsored signups at 1.5 XLM
 *                                                  locked each, plus every user tx fee)
 *   - USDC_ALERT_THRESHOLD_POOL    default "10"    (10 USDC)
 *   - USDC_ALERT_THRESHOLD_FEE     default "0"     (alert only when empty / no trustline)
 *   - ETH_ALERT_THRESHOLD_RELAYER  default "0.001" (see comment on the constant)
 *
 * Required env:
 *   ADMIN_ALERT_EMAIL  — recipient of alert emails (typically the operator)
 *
 * Call startBalanceAlerting() once at server boot, after DB connects.
 */

import { Decimal } from '@prisma/client/runtime/library'
import { getUsdcBalance } from './stellar.js'
import { getSpendableXlm } from './sponsorship.js'
import { readBaseRelayer } from './admin-balances.js'
import { sendOpsAlertEmail } from './email.js'
import { logger } from '../lib/logger.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const ALERT_INTERVAL_MS  = 6 * 60 * 60 * 1000   // 6 hours
const RATE_LIMIT_MS      = 24 * 60 * 60 * 1000  // 24 hours between alerts per wallet

const XLM_THRESHOLD_OPS        = process.env['XLM_ALERT_THRESHOLD_OPS']      ?? '50'
const USDC_THRESHOLD_POOL      = process.env['USDC_ALERT_THRESHOLD_POOL']    ?? '10'
const USDC_THRESHOLD_FEE       = process.env['USDC_ALERT_THRESHOLD_FEE']     ?? '0'
// Observed mainnet CCTP mint 0xb086f56e… used 154,553 gas ≈ 0.00000093 ETH.
// 0.001 ETH covers ~1,000 mints at that rate, or a handful if L1 data fees spike.
const ETH_THRESHOLD_RELAYER    = process.env['ETH_ALERT_THRESHOLD_RELAYER']  ?? '0.001'

type AlertAsset = 'XLM' | 'USDC' | 'ETH'

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
    asset: AlertAsset
    balance: string
    threshold: string
    note?: string
  }> = []

  // ── Ops wallet — XLM ──
  const opsPublic = process.env['ARGENS_OPS_WALLET_PUBLIC']
  if (opsPublic) {
    try {
      const xlm = await getSpendableXlm(opsPublic)
      if (xlm !== null) {
        const bal = new Decimal(xlm)
        const thr = new Decimal(XLM_THRESHOLD_OPS)
        if (bal.lessThan(thr) && shouldAlert('ARGENS_OPS_WALLET_PUBLIC')) {
          alerts.push({
            wallet: 'Ops wallet (spendable)',
            asset: 'XLM',
            balance: bal.toFixed(7),
            threshold: thr.toFixed(7),
            note: 'Sponsors reserves for new user wallets and pays the network fee on every user transaction. Running low stops signups AND all user payments.',
          })
          markAlerted('ARGENS_OPS_WALLET_PUBLIC')
        }
      }
    } catch (e) {
      logger.warn('alerting: failed to read ops wallet spendable XLM', { error: (e as Error).message })
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

  // ── Fee wallet — USDC ──
  // Inclusive comparison: default floor "0" must fire on a genuinely empty
  // wallet (or a missing USDC trustline, which getUsdcBalance reports as 0).
  const feePublic = process.env['ARGENS_FEE_WALLET']
  if (feePublic) {
    try {
      const usdc = await getUsdcBalance(feePublic)
      if (usdc !== null) {
        const bal = new Decimal(usdc)
        const thr = new Decimal(USDC_THRESHOLD_FEE)
        if (bal.lessThanOrEqualTo(thr) && shouldAlert('ARGENS_FEE_WALLET')) {
          alerts.push({
            wallet: 'Fee wallet',
            asset: 'USDC',
            balance: bal.toFixed(7),
            threshold: thr.toFixed(7),
            note: 'Receives marketplace markup and CCTP fees. A zero balance means the wallet is empty or the USDC trustline is missing — revenue transfers will fail.',
          })
          markAlerted('ARGENS_FEE_WALLET')
        }
      }
    } catch (e) {
      logger.warn('alerting: failed to read fee wallet USDC balance', { error: (e as Error).message })
    }
  }

  // ── Base relayer — ETH ──
  // Reuses readBaseRelayer() so the admin dashboard and alerting cannot drift.
  // Unconfigured (no ARGENS_BASE_RELAYER_SECRET) is skipped silently.
  try {
    const relayer = await readBaseRelayer()
    if (relayer.configured) {
      if (relayer.eth === null) {
        logger.warn('alerting: failed to read Base relayer ETH balance', { error: relayer.error })
      } else {
        const bal = new Decimal(relayer.eth)
        const thr = new Decimal(ETH_THRESHOLD_RELAYER)
        if (bal.lessThan(thr) && shouldAlert('ARGENS_BASE_RELAYER_SECRET')) {
          alerts.push({
            wallet: 'Base relayer',
            asset: 'ETH',
            balance: bal.toFixed(7),
            threshold: thr.toFixed(7),
            note: 'Pays gas to mint USDC on Base after a CCTP burn. Running low strands burned USDC mid-flight until the relayer is refunded.',
          })
          markAlerted('ARGENS_BASE_RELAYER_SECRET')
        }
      }
    }
  } catch (e) {
    logger.warn('alerting: failed to read Base relayer ETH balance', { error: (e as Error).message })
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
    logger.warn('ADMIN_ALERT_EMAIL not set — platform wallet alerting disabled')
    return
  }
  // Run once immediately on boot, then on interval
  void checkBalances()
  setInterval(() => void checkBalances(), ALERT_INTERVAL_MS)
  logger.info('Balance alerting started', {
    intervalHours: ALERT_INTERVAL_MS / 3600000,
    xlmThreshold: XLM_THRESHOLD_OPS,
    usdcPoolThreshold: USDC_THRESHOLD_POOL,
    usdcFeeThreshold: USDC_THRESHOLD_FEE,
    ethRelayerThreshold: ETH_THRESHOLD_RELAYER,
  })
}
