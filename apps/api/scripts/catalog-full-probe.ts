/**
 * scripts/catalog-full-probe.ts
 *
 * Exhaustive x402 v2 probe of ALL MPP Router endpoints.
 * Calls every endpoint (not just cheapest-per-provider) directly via
 * performMppRequest (same production code path, bypasses Argens HTTP API).
 *
 * Spend guards:
 *   - Max $0.30 per endpoint (skip pricier ones)
 *   - Max $12.00 cumulative (env PROBE_MAX_SPEND to override)
 *   - Skip known-working, known-expensive, known-broken-facilitator providers
 *
 * Usage:
 *   PROBE_EMAIL=bldn.inc@gmail.com npx tsx scripts/catalog-full-probe.ts
 *   PROBE_EMAIL=bldn.inc@gmail.com npx tsx scripts/catalog-full-probe.ts --dry-run
 *
 * Output: tasks/catalog-full-probe-report.md + console summary
 */

import 'dotenv/config'
import { writeFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import { decryptSecretKey } from '../src/lib/crypto.js'
import { performMppRequest } from '../src/services/mpp-client.js'
import {
  listMppRouterServices,
  MPP_ROUTER_BASE_URL,
  providerKey,
  operationLabel,
  type MppRouterService,
} from '../src/services/mpp-router.js'
import { examplePayloadFor } from '../src/services/marketplace-examples.js'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

const DRY_RUN = process.argv.includes('--dry-run')
const EMAIL = process.env['PROBE_EMAIL'] ?? 'bldn.inc@gmail.com'
const MAX_SPEND = new Decimal(process.env['PROBE_MAX_SPEND'] ?? '12.00')
const PRICE_CEILING = 0.30  // skip endpoints above this in USD
const CALL_DELAY_MS = 800

const REPORT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../tasks/catalog-full-probe-report.md',
)

// ── Skip lists ────────────────────────────────────────────────────────────────

/** Known-working from prior smoke tests — skip to save USDC */
const SKIP_KNOWN_WORKING = new Set([
  'deepgram',    // verified: list-models, transcription
  'deepseek',    // verified: chat
  'firecrawl',   // verified: scrape
  '2captcha',    // verified: createtask
])

/** Broken facilitator — 502 "Invalid base64 JSON header", no charge */
const SKIP_BROKEN_FACILITATOR = new Set([
  'stableemail',   // merchant-side protocol mismatch
  'stabletravel',  // merchant-side protocol mismatch
])

/** Deposit/session model broken on MPP side */
const SKIP_DEPOSIT_MODEL = new Set([
  'anthropic',     // "Amount Exceeds Deposit" — MPP's deposit not funded
  'openai',        // same
])

/** Infrastructure issues on MPP's side */
const SKIP_INFRA = new Set([
  'googlemaps',    // 404 — API config on MPP side
])

/** Requires mandatory paid account setup before useful calls */
const SKIP_SETUP_REQUIRED = new Set([
  'agentmail',     // must create inbox first
])

function shouldSkip(provider: string): { skip: boolean; reason: string } {
  if (SKIP_KNOWN_WORKING.has(provider)) return { skip: true, reason: 'KNOWN_WORKING' }
  if (SKIP_BROKEN_FACILITATOR.has(provider)) return { skip: true, reason: 'BROKEN_FACILITATOR' }
  if (SKIP_DEPOSIT_MODEL.has(provider)) return { skip: true, reason: 'DEPOSIT_MODEL' }
  if (SKIP_INFRA.has(provider)) return { skip: true, reason: 'INFRA_ISSUE' }
  if (SKIP_SETUP_REQUIRED.has(provider)) return { skip: true, reason: 'SETUP_REQUIRED' }
  return { skip: false, reason: '' }
}

function parsePrice(price: string): number | null {
  if (/free/i.test(price)) return 0
  const m = String(price).match(/\$\s*([0-9]*\.?[0-9]+)/)
  return m ? parseFloat(m[1]!) : null
}

function snippet(v: unknown, max = 200): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  if (!s) return ''
  return s.replace(/\s+/g, ' ').slice(0, max)
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Result types ──────────────────────────────────────────────────────────────

type CallStatus = 'SUCCESS' | 'UPSTREAM_FAILED' | 'NO_CHARGE_ERROR' | 'PRICE_SKIPPED' | 'PROVIDER_SKIPPED' | 'BUDGET_HIT' | 'DRY_RUN'

interface EndpointResult {
  provider: string
  endpointId: string
  endpointLabel: string
  price: string
  status: CallStatus
  skipReason?: string
  httpStatus?: number
  charged: boolean
  costUSDC?: string
  settleTx?: string
  responseSnippet: string
  payloadUsed?: string
  requiredFields?: string  // extracted from error messages
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== MPP Router All-Endpoints Probe ===`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE (real USDC)'}`)
  console.log(`Email: ${EMAIL}`)
  console.log(`Budget cap: $${MAX_SPEND} | Price ceiling: $${PRICE_CEILING} per endpoint\n`)

  // Load wallet
  const walletRow = await prisma.wallet.findFirst({
    where: { user: { email: EMAIL } },
    select: { stellarPublicKey: true, stellarSecretKeyEnc: true, balanceCache: true },
  })
  if (!walletRow) throw new Error(`No wallet found for ${EMAIL}`)
  const secretKey = decryptSecretKey(walletRow.stellarSecretKeyEnc)
  console.log(`Wallet: ${walletRow.stellarPublicKey} | Cached balance: ${walletRow.balanceCache} USDC\n`)

  // Fetch catalog
  const services = await listMppRouterServices()
  console.log(`Catalog: ${services.length} endpoints\n`)

  const results: EndpointResult[] = []
  let totalSpent = new Decimal(0)
  let budgetHit = false

  for (const svc of services) {
    const provider = providerKey(svc)
    const label = operationLabel(svc)
    const price = svc.price
    const priceNum = parsePrice(price)
    const endpointId = svc.id

    // Provider-level skip
    const { skip, reason } = shouldSkip(provider)
    if (skip) {
      results.push({
        provider, endpointId, endpointLabel: label, price,
        status: 'PROVIDER_SKIPPED', skipReason: reason,
        charged: false, responseSnippet: reason,
      })
      continue
    }

    // Price ceiling
    if (priceNum !== null && priceNum > PRICE_CEILING) {
      results.push({
        provider, endpointId, endpointLabel: label, price,
        status: 'PRICE_SKIPPED', skipReason: `$${priceNum} > ceiling $${PRICE_CEILING}`,
        charged: false, responseSnippet: '',
      })
      continue
    }

    // Budget cap
    if (budgetHit) {
      results.push({
        provider, endpointId, endpointLabel: label, price,
        status: 'BUDGET_HIT', charged: false, responseSnippet: '',
      })
      continue
    }

    // Example payload
    const payload = examplePayloadFor(endpointId, provider) ?? {}
    const payloadStr = JSON.stringify(payload)

    if (DRY_RUN) {
      console.log(`[dry] ${provider}/${endpointId} (${price}) payload=${payloadStr.slice(0, 60)}`)
      results.push({
        provider, endpointId, endpointLabel: label, price,
        status: 'DRY_RUN', charged: false, responseSnippet: 'dry-run', payloadUsed: payloadStr,
      })
      continue
    }

    // Live call
    const url = `${MPP_ROUTER_BASE_URL}${svc.public_path}`
    process.stdout.write(`[call] ${provider}/${endpointId} (${price}) ... `)

    let charged = false
    let status: CallStatus = 'NO_CHARGE_ERROR'
    let httpStatus: number | undefined
    let costUSDC: string | undefined
    let settleTx: string | undefined
    let responseSnippet = ''
    let requiredFields: string | undefined

    try {
      const result = await performMppRequest({
        secretKey,
        url,
        method: svc.method,
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
        onChallenge: async () => {
          // No policy gate here — this is the probe harness
        },
      })

      httpStatus = result.status
      charged = result.receipt !== null
      settleTx = result.receipt?.reference

      if (result.receipt) {
        // Estimate cost from price string (actual charge not returned by performMppRequest)
        costUSDC = priceNum != null ? priceNum.toFixed(7) : undefined
        if (priceNum) totalSpent = totalSpent.plus(priceNum)
      }

      if (result.ok && result.receipt) {
        status = 'SUCCESS'
        responseSnippet = snippet(result.body)
      } else if (result.receipt) {
        // Paid but got error response
        status = 'UPSTREAM_FAILED'
        responseSnippet = snippet(result.body)
      } else {
        status = 'NO_CHARGE_ERROR'
        responseSnippet = snippet(result.body)
        // Try to extract required fields from error messages
        const bodyStr = typeof result.body === 'string' ? result.body : JSON.stringify(result.body)
        const reqMatch = bodyStr.match(/(?:required|missing|must provide)[^"]*["']?([a-z_A-Z]+)["']?/i)
        if (reqMatch) requiredFields = reqMatch[0].slice(0, 100)
      }
    } catch (e) {
      status = 'NO_CHARGE_ERROR'
      responseSnippet = (e as Error).message.slice(0, 200)
    }

    const tag = status === 'SUCCESS' ? '✓' : charged ? '⚠PAID' : '✗'
    console.log(`${tag} ${status} HTTP=${httpStatus ?? '?'} ${charged ? `settle=${settleTx?.slice(0,10)}` : 'no-charge'}`)
    if (status !== 'SUCCESS') console.log(`   └─ ${responseSnippet.slice(0, 120)}`)

    results.push({
      provider, endpointId, endpointLabel: label, price,
      status, charged, httpStatus, costUSDC, settleTx,
      responseSnippet, payloadUsed: payloadStr, requiredFields,
    })

    if (totalSpent.greaterThanOrEqualTo(MAX_SPEND)) {
      budgetHit = true
      console.log(`\n*** Budget cap $${MAX_SPEND} reached ($${totalSpent.toFixed(4)} spent). Remaining endpoints skipped. ***\n`)
    }

    await sleep(CALL_DELAY_MS)
  }

  await prisma.$disconnect()

  // Write report
  await writeReport(results, totalSpent)
  console.log(`\nTotal USDC spent: ~$${totalSpent.toFixed(4)}`)
  console.log(`Report: ${REPORT_PATH}`)
}

async function writeReport(results: EndpointResult[], totalSpent: Decimal) {
  const success = results.filter(r => r.status === 'SUCCESS')
  const paid_failed = results.filter(r => r.status === 'UPSTREAM_FAILED')
  const no_charge = results.filter(r => r.status === 'NO_CHARGE_ERROR')
  const price_skip = results.filter(r => r.status === 'PRICE_SKIPPED')
  const prov_skip = results.filter(r => r.status === 'PROVIDER_SKIPPED')
  const budget_hit = results.filter(r => r.status === 'BUDGET_HIT')

  const esc = (s: string) => String(s ?? '').replace(/\|/g, '\\|')

  const summaryByProvider = new Map<string, { success: number; failed: number; nocharge: number; skipped: number }>()
  for (const r of results) {
    if (!summaryByProvider.has(r.provider)) summaryByProvider.set(r.provider, { success:0, failed:0, nocharge:0, skipped:0 })
    const s = summaryByProvider.get(r.provider)!
    if (r.status === 'SUCCESS') s.success++
    else if (r.status === 'UPSTREAM_FAILED') s.failed++
    else if (r.status === 'NO_CHARGE_ERROR') s.nocharge++
    else s.skipped++
  }

  const providerTable = [...summaryByProvider.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([p, s]) =>
      `| ${p} | ${s.success > 0 ? '✓' : s.failed > 0 ? '⚠paid' : s.nocharge > 0 ? '✗no-charge' : 'skipped'} | ${s.success} | ${s.failed} | ${s.nocharge} | ${s.skipped} |`
    ).join('\n')

  const detailRows = results
    .filter(r => !['PROVIDER_SKIPPED', 'PRICE_SKIPPED', 'BUDGET_HIT', 'DRY_RUN'].includes(r.status))
    .map(r =>
      `| ${esc(r.provider)} | ${esc(r.endpointId)} | ${esc(r.price)} | ${r.status} | ${r.charged ? 'YES' : 'no'} | ${r.httpStatus ?? ''} | ${esc(r.settleTx?.slice(0,12) ?? '')} | ${esc(r.payloadUsed?.slice(0,80) ?? '')} | ${esc(r.responseSnippet.slice(0,100))} |`
    ).join('\n')

  const skippedProviderTable = [...new Map(
    prov_skip.map(r => [r.provider, r.skipReason!])
  ).entries()].sort().map(([p, r]) => `| ${p} | ${r} |`).join('\n')

  const md = `# MPP Router All-Endpoints Probe Report

Generated: ${new Date().toISOString()}
Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}
Total USDC spent: ~$${totalSpent.toFixed(4)}
Budget cap: $${MAX_SPEND}

## Summary

| Status | Count |
|---|---|
| ✓ SUCCESS (paid + valid response) | ${success.length} |
| ⚠ UPSTREAM_FAILED (paid but error) | ${paid_failed.length} |
| ✗ NO_CHARGE_ERROR (rejected before payment) | ${no_charge.length} |
| PRICE_SKIPPED (>${PRICE_CEILING}) | ${price_skip.length} |
| PROVIDER_SKIPPED (known-working/broken/etc) | ${prov_skip.length} |
| BUDGET_HIT | ${budget_hit.length} |

## Provider Summary

| Provider | Best Result | ✓ | ⚠paid | ✗no-charge | skipped |
|---|---|---|---|---|---|
${providerTable}

## Skipped Providers

| Provider | Reason |
|---|---|
${skippedProviderTable}

## Endpoint Detail (called only)

| Provider | Endpoint | Price | Status | Charged | HTTP | Settle Tx | Payload Used | Response |
|---|---|---|---|---|---|---|---|---|
${detailRows}

## Successful Endpoints — Verified Payloads

${success.map(r => `### ${r.provider} / ${r.endpointId}
- **Price**: ${r.price}
- **Payload**: \`${r.payloadUsed ?? '{}'}\`
- **Response**: ${r.responseSnippet}
- **Settle tx**: ${r.settleTx ?? 'n/a'}
`).join('\n')}

## No-Charge Errors — Payload Hints

${no_charge.map(r => `### ${r.provider} / ${r.endpointId}
- **Payload tried**: \`${r.payloadUsed ?? '{}'}\`
- **Error**: ${r.responseSnippet}
${r.requiredFields ? `- **Required field hint**: ${r.requiredFields}` : ''}
`).join('\n')}

## Paid but Failed

${paid_failed.map(r => `### ${r.provider} / ${r.endpointId}
- **Settle tx**: ${r.settleTx ?? 'n/a'}
- **Response**: ${r.responseSnippet}
`).join('\n')}
`

  await writeFile(REPORT_PATH, md, 'utf8')
}

main().catch(async e => {
  console.error('Probe failed:', e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
