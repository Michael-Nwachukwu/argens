/**
 * Async-only marketplace endpoints dispatch a background job and bind ownership via the
 * x402 `session` scheme. Our MPP client (`mpp-client.ts`) speaks only one-shot `exact`/
 * charge, so these always fail upstream AFTER the challenge with an opaque 401 — and never
 * settle (`receipt: null`). Callers must reject them before wallet/credit/policy work.
 *
 * Hardcoded id set + prefix (not catalog-driven): MPP does not expose a session flag today.
 * See tasks/decisions.md 2026-07-31. Revisit only if #23 lands session support.
 *
 * The set spans providers — membership is decided by the upstream failure signature
 * (`401 "Async jobs require a Stellar payment credential to bind ownership"`), not by the
 * provider name. To confirm a candidate before adding it, check for that exact body in
 * `tasks/catalog-full-probe-report.md` or in `GET /v1/admin/transactions/failed`
 * (`metadata.mpp_router.upstream_body`).
 */

const ASYNC_ONLY_ENDPOINT_IDS = new Set([
  'firecrawl_crawl',
  'firecrawl_extract',
  // Confirmed by the same 401 signature: catalog-full-probe-report.md + 3 prod failures.
  'browserbase_fetch',
])
const ASYNC_ONLY_ENDPOINT_PREFIX = 'stablestudio_generate_'

/** Synchronous alternatives for async-only endpoints that have one. */
export const ASYNC_SYNC_ALTERNATIVES: Readonly<Record<string, string>> = {
  firecrawl_crawl: 'firecrawl_scrape',
  firecrawl_extract: 'firecrawl_scrape',
}

/** True when the endpoint requires x402 session (async job) and cannot be paid via charge. */
export function isAsyncOnlyEndpoint(serviceId: string): boolean {
  return (
    ASYNC_ONLY_ENDPOINT_IDS.has(serviceId) || serviceId.startsWith(ASYNC_ONLY_ENDPOINT_PREFIX)
  )
}
