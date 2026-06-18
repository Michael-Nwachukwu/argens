/**
 * scripts/marketplace-catalog-test.ts
 *
 * One-endpoint-per-provider health test for the whole MPP marketplace catalog,
 * driven through Argens' real `POST /v1/marketplace/call` endpoint.
 *
 * WHY THIS EXISTS
 *   The catalog (493 endpoints / 86 providers) ships no request schemas, and some
 *   providers' upstream relays are broken (e.g. "memo is not bound to this
 *   challenge"). This script tells us which providers actually work end-to-end so
 *   we can (a) globally pause the broken ones and (b) author example payloads for
 *   the working ones.
 *
 * SPEND SAFETY (this moves REAL mainnet USDC):
 *   - Cheapest endpoint per provider only.
 *   - Any endpoint priced >= $0.50 is SKIPPED and recorded (never called).
 *   - Providers needing mandatory paid setup are SKIPPED (SETUP_REQUIRED).
 *   - Hard cumulative cap: MARKETPLACE_TEST_MAX_SPEND (default 5.00 USDC). The run
 *     stops calling once projected/actual spend would exceed it.
 *   - --dry-run does ZERO spend: it only resolves selection + skip logic.
 *
 * RUN MODE (per the plan): a local API process pointed at the PROD database +
 *   mainnet. The call goes over HTTP to the local API with a real API key, so rows
 *   land in the prod DB / dashboard. This script also talks to the DB directly
 *   (Prisma) to snapshot + enable + RESTORE the test user's per-provider
 *   enablement (that toggle is JWT-only over HTTP).
 *
 * ENV:
 *   ARGENS_TEST_API_KEY      (required for a live run) argns_live_... for the test user
 *   ARGENS_TEST_USER_EMAIL   (required for a live run) the email that owns that key
 *   ARGENS_TEST_BASE_URL     default http://localhost:3001/v1
 *   MARKETPLACE_TEST_MAX_SPEND  default "5.00"
 *   DATABASE_URL / STELLAR_NETWORK  point at prod + mainnet for a real run
 *
 * USAGE:
 *   pnpm tsx scripts/marketplace-catalog-test.ts --dry-run
 *   pnpm tsx scripts/marketplace-catalog-test.ts            # live (spends USDC)
 */

import 'dotenv/config'
import { writeFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '../src/lib/prisma.js'
import {
  listMppRouterServices,
  providerKey,
  providerDisplayName,
  operationLabel,
  type MppRouterService,
} from '../src/services/mpp-router.js'
import { examplePayloadFor } from '../src/services/marketplace-examples.js'

// ─── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run')
// Enabled-only mode: call the deployed API with just an API key, no DB access.
// Providers the user hasn't enabled return 403 → recorded SKIPPED_DISABLED. Used
// when the prod DB is not reachable from where this runs (Dokploy-internal host).
const ENABLED_ONLY = process.argv.includes('--enabled-only')
const BASE_URL = (process.env['ARGENS_TEST_BASE_URL'] ?? 'http://localhost:3001/v1').replace(/\/$/, '')
const API_KEY = process.env['ARGENS_TEST_API_KEY'] ?? ''
const USER_EMAIL = process.env['ARGENS_TEST_USER_EMAIL'] ?? ''
const MAX_SPEND = new Decimal(process.env['MARKETPLACE_TEST_MAX_SPEND'] ?? '5.00')
const PRICE_CEILING = new Decimal('0.50') // skip any endpoint at or above this
const CALL_DELAY_MS = 600
// Repo-root/tasks regardless of cwd: scripts/ -> apps/api -> apps -> repo root.
const REPORT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../tasks/marketplace-catalog-report.md')

// Providers known to require a mandatory paid setup step before useful calls
// (e.g. create an inbox/account first). Extend as discovered.
const SETUP_REQUIRED = new Set<string>(['agentmail'])

type Status =
  | 'SUCCESS'
  | 'UPSTREAM_FAILED'
  | 'NOT_MPP'
  | 'PAUSED'
  | 'SKIPPED_PRICE'
  | 'SKIPPED_SETUP'
  | 'SKIPPED_BUDGET'
  | 'SKIPPED_DISABLED'
  | 'ERROR'

interface ResultRow {
  provider: string
  providerName: string
  endpointId: string
  endpointLabel: string
  price: string
  status: Status
  refundFlagged: boolean
  costPaid: string | null
  http: number | null
  code: string | null
  upstream: string
  txId: string | null
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function parsePrice(p: string): number | null {
  if (/free/i.test(p)) return 0
  const m = String(p).match(/\$\s*([0-9]*\.?[0-9]+)/)
  return m ? parseFloat(m[1]!) : null
}

/** Cheapest endpoint for a provider (lowest parseable price; unknown sorts last). */
function cheapestEndpoint(ops: MppRouterService[]): MppRouterService {
  return [...ops].sort((a, b) => {
    const pa = parsePrice(a.price), pb = parsePrice(b.price)
    if (pa == null && pb == null) return 0
    if (pa == null) return 1
    if (pb == null) return -1
    return pa - pb
  })[0]!
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function snippet(body: unknown, max = 160): string {
  const s = typeof body === 'string' ? body : JSON.stringify(body)
  if (!s) return ''
  return s.replace(/\s+/g, ' ').slice(0, max)
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nMarketplace catalog test — ${DRY_RUN ? 'DRY RUN (no spend)' : 'LIVE (real USDC)'}${ENABLED_ONLY ? ' · ENABLED-ONLY (deployed API, no DB)' : ''}`)
  console.log(`Base URL: ${BASE_URL}`)

  if (!DRY_RUN) {
    if (!API_KEY) {
      console.error('\nLive run requires ARGENS_TEST_API_KEY. Aborting.')
      process.exit(1)
    }
    // Enabled-only mode talks only to the deployed API; the local STELLAR_NETWORK
    // and DB are irrelevant there. Full mode needs local mainnet + DB access.
    if (!ENABLED_ONLY) {
      if (!USER_EMAIL) {
        console.error('\nFull live run requires ARGENS_TEST_USER_EMAIL (for enablement). Aborting.')
        process.exit(1)
      }
      if (process.env['STELLAR_NETWORK'] !== 'mainnet') {
        console.error('\nMarketplace requires STELLAR_NETWORK=mainnet. Aborting.')
        process.exit(1)
      }
    }
  }

  // Resolve the test user (for per-user enablement snapshot/restore). Skipped in
  // enabled-only mode — that mode never touches the DB.
  let userId: string | null = null
  if (USER_EMAIL && !ENABLED_ONLY) {
    const user = await prisma.user.findUnique({
      where: { email: USER_EMAIL },
      include: { wallet: { select: { stellarPublicKey: true, balanceCache: true } } },
    })
    if (!user) {
      console.error(`\nNo user with email ${USER_EMAIL}. Aborting.`)
      process.exit(1)
    }
    userId = user.id
    console.log(`Test user: ${USER_EMAIL} (${userId})`)
    console.log(`Wallet: ${user.wallet?.stellarPublicKey ?? 'none'} · cached USDC: ${user.wallet?.balanceCache ?? '0'}`)
    console.log('Confirm ARGENS_TEST_API_KEY belongs to this account.\n')
  }

  const services = await listMppRouterServices()

  // Group by provider.
  const groups = new Map<string, MppRouterService[]>()
  for (const svc of services) {
    const key = providerKey(svc)
    const arr = groups.get(key)
    if (arr) arr.push(svc)
    else groups.set(key, [svc])
  }
  console.log(`Catalog: ${services.length} endpoints across ${groups.size} providers.\n`)

  // Snapshot per-user enablement so we can restore it afterward (full mode only).
  const enablementSnapshot = userId
    ? await prisma.marketplaceServiceSetting.findMany({ where: { userId } })
    : []
  const wasEnabled = new Map(enablementSnapshot.map((s) => [s.serviceId, s.enabled]))
  const touchedProviders = new Set<string>()

  // Providers paused platform-wide are reported as PAUSED, never called. In
  // enabled-only mode we don't query the DB — the deployed API returns 503
  // MARKETPLACE_SERVICE_PAUSED for paused providers and we map that below.
  const paused = ENABLED_ONLY
    ? new Set<string>()
    : new Set((await prisma.globalServiceSetting.findMany({ where: { enabled: false }, select: { providerId: true } })).map((r) => r.providerId))

  const rows: ResultRow[] = []
  let cumulative = new Decimal(0)
  let budgetHit = false

  const providerIds = [...groups.keys()].sort()

  try {
    for (const provider of providerIds) {
      const ops = groups.get(provider)!
      const ep = cheapestEndpoint(ops)
      const price = ep.price
      const priceNum = parsePrice(price)
      const base: Omit<ResultRow, 'status' | 'costPaid' | 'http' | 'code' | 'upstream' | 'txId' | 'refundFlagged'> = {
        provider,
        providerName: providerDisplayName(ep),
        endpointId: ep.id,
        endpointLabel: operationLabel(ep),
        price,
      }
      const push = (s: Status, extra: Partial<ResultRow> = {}) =>
        rows.push({ ...base, status: s, refundFlagged: false, costPaid: null, http: null, code: null, upstream: '', txId: null, ...extra })

      if (paused.has(provider)) { push('PAUSED'); continue }
      if (SETUP_REQUIRED.has(provider)) { push('SKIPPED_SETUP', { upstream: 'requires mandatory paid setup' }); continue }
      if (priceNum == null || priceNum >= PRICE_CEILING.toNumber()) {
        push('SKIPPED_PRICE', { upstream: `cheapest endpoint priced ${price}` }); continue
      }
      if (budgetHit) { push('SKIPPED_BUDGET'); continue }

      if (DRY_RUN) {
        // Selection only — show what WOULD be called.
        console.log(`[plan] ${provider} → ${ep.id} (${price})`)
        push('SUCCESS', { upstream: 'dry-run: would call', costPaid: null })
        continue
      }

      // Full mode: ensure this provider is enabled for the test user (direct DB;
      // the toggle is JWT-only over HTTP). Enabled-only mode skips this and lets
      // the API report disabled providers via 403.
      if (!ENABLED_ONLY) {
        touchedProviders.add(provider)
        await prisma.marketplaceServiceSetting.upsert({
          where: { userId_serviceId: { userId: userId!, serviceId: provider } },
          update: { enabled: true },
          create: { userId: userId!, serviceId: provider, enabled: true },
        })
      }

      const payload = examplePayloadFor(ep.id, provider) ?? {}
      let http: number | null = null
      let code: string | null = null
      let txId: string | null = null
      let costPaid: string | null = null
      let upstream = ''
      let status: Status = 'ERROR'
      let refundFlagged = false

      try {
        const res = await fetch(`${BASE_URL}/marketplace/call`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
          body: JSON.stringify({ service_id: ep.id, payload }),
        })
        http = res.status
        const json = (await res.json().catch(() => ({}))) as Record<string, any>

        if (res.ok && json.data?.status === 'success') {
          status = 'SUCCESS'
          costPaid = json.data.cost_paid ?? null
          txId = json.data.transaction_id ?? null
          upstream = snippet(json.data.result)
          if (costPaid) cumulative = cumulative.plus(costPaid)
        } else {
          code = json.code ?? null
          txId = json.details?.transaction_id ?? null
          upstream = snippet(json.details?.upstream_body ?? json.error ?? json)
          refundFlagged = code === 'MARKETPLACE_UPSTREAM_FAILED' || code === 'MARKETPLACE_SERVICE_UNAVAILABLE'
          status =
            code === 'MARKETPLACE_NOT_MPP' ? 'NOT_MPP'
            : code === 'SERVICE_DISABLED' ? 'SKIPPED_DISABLED'
            : code === 'MARKETPLACE_SERVICE_PAUSED' ? 'PAUSED'
            : refundFlagged ? 'UPSTREAM_FAILED'
            : 'ERROR'
        }
      } catch (e) {
        upstream = (e as Error).message
        status = 'ERROR'
      }

      const tag = status === 'SUCCESS' ? '✓' : refundFlagged ? '⚠refund' : '✗'
      console.log(`[${tag}] ${provider} → ${ep.id} (${price}) ${status}${code ? ` ${code}` : ''}${costPaid ? ` $${costPaid}` : ''}`)
      push(status, { costPaid, http, code, upstream, txId, refundFlagged })

      if (cumulative.greaterThanOrEqualTo(MAX_SPEND)) {
        budgetHit = true
        console.log(`\n*** Spend cap reached: $${cumulative.toFixed(7)} >= $${MAX_SPEND.toFixed(2)}. Remaining providers skipped. ***\n`)
      }
      await sleep(CALL_DELAY_MS)
    }
  } finally {
    // Restore the test user's enablement exactly as it was.
    if (userId && touchedProviders.size > 0) {
      for (const provider of touchedProviders) {
        const prev = wasEnabled.get(provider)
        if (prev === undefined) {
          await prisma.marketplaceServiceSetting.deleteMany({ where: { userId, serviceId: provider } })
        } else if (prev !== true) {
          await prisma.marketplaceServiceSetting.update({
            where: { userId_serviceId: { userId, serviceId: provider } },
            data: { enabled: prev },
          }).catch(() => {})
        }
      }
      console.log(`Restored per-user enablement for ${touchedProviders.size} provider(s).`)
    }
  }

  await writeReport(rows, cumulative)
  await prisma.$disconnect()
  console.log(`\nReport written to ${REPORT_PATH}`)
  console.log(`Total spent: $${cumulative.toFixed(7)} USDC\n`)
}

async function writeReport(rows: ResultRow[], cumulative: Decimal) {
  const byStatus = (s: Status) => rows.filter((r) => r.status === s)
  const counts: Record<Status, number> = {
    SUCCESS: byStatus('SUCCESS').length,
    UPSTREAM_FAILED: byStatus('UPSTREAM_FAILED').length,
    NOT_MPP: byStatus('NOT_MPP').length,
    PAUSED: byStatus('PAUSED').length,
    SKIPPED_PRICE: byStatus('SKIPPED_PRICE').length,
    SKIPPED_SETUP: byStatus('SKIPPED_SETUP').length,
    SKIPPED_BUDGET: byStatus('SKIPPED_BUDGET').length,
    SKIPPED_DISABLED: byStatus('SKIPPED_DISABLED').length,
    ERROR: byStatus('ERROR').length,
  }

  const toDisable = rows.filter((r) => r.status === 'UPSTREAM_FAILED').map((r) => r.provider)
  const needExamples = rows.filter((r) => r.status === 'NOT_MPP').map((r) => r.provider)
  const working = rows.filter((r) => r.status === 'SUCCESS').map((r) => r.provider)

  const esc = (s: string) => s.replace(/\|/g, '\\|')
  const table = rows
    .map((r) =>
      `| ${esc(r.provider)} | ${esc(r.endpointId)} | ${esc(r.price)} | ${r.status}${r.refundFlagged ? ' ⚠refund' : ''} | ${r.costPaid ?? ''} | ${r.http ?? ''} | ${r.code ?? ''} | ${esc(r.txId ?? '')} | ${esc(r.upstream)} |`,
    )
    .join('\n')

  const md = `# Marketplace Catalog Test Report

Generated: ${new Date().toISOString()}
Mode: ${DRY_RUN ? 'DRY RUN (no spend)' : 'LIVE'}
Total spent: $${cumulative.toFixed(7)} USDC (cap $${MAX_SPEND.toFixed(2)})

## Summary

| Status | Count |
|---|---|
| ✓ SUCCESS | ${counts.SUCCESS} |
| ⚠ UPSTREAM_FAILED (paid, refund flagged) | ${counts.UPSTREAM_FAILED} |
| NOT_MPP (no charge, bad payload) | ${counts.NOT_MPP} |
| PAUSED | ${counts.PAUSED} |
| SKIPPED_PRICE (>= $${PRICE_CEILING.toFixed(2)}) | ${counts.SKIPPED_PRICE} |
| SKIPPED_SETUP | ${counts.SKIPPED_SETUP} |
| SKIPPED_BUDGET | ${counts.SKIPPED_BUDGET} |
| SKIPPED_DISABLED (not enabled in dashboard) | ${counts.SKIPPED_DISABLED} |
| ERROR | ${counts.ERROR} |

**Providers to globally disable (paid but failed):** ${toDisable.length ? toDisable.join(', ') : 'none'}

**Providers needing a corrected example payload (NOT_MPP):** ${needExamples.length ? needExamples.join(', ') : 'none'}

**Working providers (author examples + keep enabled):** ${working.length ? working.join(', ') : 'none'}

## Results

| Provider | Endpoint | Price | Status | Cost | HTTP | Code | Tx | Upstream snippet |
|---|---|---|---|---|---|---|---|---|
${table}
`

  await writeFile(REPORT_PATH, md, 'utf8')
}

main().catch(async (e) => {
  console.error('Catalog test failed:', e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
