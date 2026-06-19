/**
 * services/marketplace-examples.ts
 *
 * Hand-authored example request bodies for marketplace endpoints.
 *
 * The MPP Router catalog ships NO request schemas, so neither the dashboard nor
 * an agent can infer a valid body from the catalog alone. These examples are the
 * canonical "what a working call looks like" source. They are:
 *   - surfaced as `example_payload` on each endpoint in GET /marketplace/services
 *     (the dashboard pre-fills the payload textarea from this)
 *   - embedded in the per-provider skill markdown (/SKILL/{provider}.md)
 *   - used by the catalog test harness (scripts/marketplace-catalog-test.ts)
 *
 * Resolution order (see examplePayloadFor): endpoint id → provider id → null.
 *
 * The PROVIDER_EXAMPLES below were authored from the 2026-06-17 catalog test
 * (tasks/marketplace-catalog-report.md). The harness called each provider's
 * cheapest endpoint with an empty body; the upstream "X is required" errors told
 * us the minimum fields. Values are realistic placeholders an agent/dev edits.
 *
 * NOT included (and why):
 *   - Providers that fail at the PAYMENT layer regardless of body
 *     (verification-failed / channel-not-installed) — a body won't fix them; they
 *     should be paused platform-wide instead. See report "providers to disable".
 *   - Endpoints whose required input is a URL/path placeholder (?id=, ?network=),
 *     which go in `query`, not the body.
 *   - Stateful endpoints needing a prior token/session id (judge0, suno status).
 */

/** Endpoint-specific examples, keyed by the operation id (endpoints[].id). */
export const ENDPOINT_EXAMPLES: Record<string, Record<string, unknown>> = {
  // Codex uses a GraphQL POST body.
  codex_graphql: { query: '{ getNetworks { name networkId } }' },
  // CoinGecko simple price needs both ids and target currencies.
  coingecko_coingecko_simple_price: { ids: 'bitcoin,stellar', vs_currencies: 'usd' },
  // AlphaVantage intraday needs a symbol and an interval.
  alphavantage_alphavantage_time_series_intraday: { symbol: 'AAPL', interval: '5min' },
  // AlphaVantage commodity price needs a commodity code (not a stock symbol).
  // Catalog ID may use a hyphen or underscore depending on the MPP Router version.
  'alphavantage_alphavantage_commodity-price': { commodity: 'WTI' },
  alphavantage_alphavantage_commodity_price: { commodity: 'WTI' },

  // ── stableenrich / Exa ──────────────────────────────────────────────────────
  // Exa search (via stableenrich) takes a plain query string.
  stableenrich_exa_search: { query: 'stellar usdc payments for AI agents' },
  // Exa answer takes a plain query string (same shape as exa_search, not messages[]).
  stableenrich_exa_answer: { query: 'What is Stellar blockchain and how does USDC work on it?' },

  // ── stabletravel / Amadeus-style flight search ───────────────────────────────
  // Requires originDestinations, travelers, and sources — all arrays.
  stabletravel_flights_ava: {
    originDestinations: [
      {
        id: '1',
        originLocationCode: 'JFK',
        destinationLocationCode: 'LHR',
        departureDateTimeRange: { date: '2026-09-01' },
      },
    ],
    travelers: [{ id: '1', travelerType: 'ADULT' }],
    sources: ['GDS'],
  },
}

/** Provider-level fallback examples, keyed by the provider id (the toggle key). */
export const PROVIDER_EXAMPLES: Record<string, Record<string, unknown>> = {
  // ── Abstract API family (each needs one identifier field) ──────────────────
  'abstract-company-enrichment': { domain: 'stripe.com' },
  'abstract-email-reputation': { email: 'support@stripe.com' },
  'abstract-exchange-rates': { base: 'USD' },
  'abstract-holidays': { country: 'US' },
  'abstract-iban-validation': { iban: 'DE89370400440532013000' },
  'abstract-ip-intelligence': { ip_address: '8.8.8.8' },
  'abstract-phone-intelligence': { phone: '+14155552671' },
  'abstract-timezone': { location: 'London, United Kingdom' },
  'abstract-vat': { vat_number: 'DE811907980' },
  'abstract-web-scraping': { url: 'https://example.com' },

  // ── Search / web / data ────────────────────────────────────────────────────
  alphavantage: { symbol: 'AAPL', interval: '5min' },
  apollo: { first_name: 'Patrick', last_name: 'Collison', organization_name: 'Stripe' },
  billboard: { text: 'Hello from an autonomous agent' },
  brave: { q: 'stellar usdc payments' },
  builtwith: { LOOKUP: 'shopify.com' },
  clado: { query: 'AI infrastructure engineers in San Francisco' },
  coingecko: { ids: 'bitcoin,stellar', vs_currencies: 'usd' },
  diffbot: { url: 'https://www.example.com/article' },
  'diffbot-kg': { query: 'type:Organization name:"Stripe"' },
  'diffbot-nl': { content: 'Stripe is a financial infrastructure company headquartered in San Francisco.' },
  edgar: { cik: '320193' },
  'edgar-search': { q: 'Apple Inc annual report' },
  govlaws: { query: 'data privacy' },
  hunter: { domain: 'stripe.com' },
  ipinfo: { ip: '8.8.8.8' },
  mathpix: { src: 'https://mathpix-ocr-examples.s3.amazonaws.com/cases_hw.jpg' },
  openweather: { q: 'London,GB' },
  rentcast: { city: 'Austin', state: 'TX' },
  screenshotone: { url: 'https://example.com' },
  tavily: { query: 'stellar usdc payments' },
  wolframalpha: { i: 'population of France' },

  // ── LLM chat providers (OpenAI-style {model, messages}) ─────────────────────
  deepseek: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'Reply with the single word: ok' }] },
  grok: { model: 'grok-2-latest', messages: [{ role: 'user', content: 'Reply with the single word: ok' }] },
  groq: { model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'Reply with the single word: ok' }] },
  mistral: { model: 'mistral-small-latest', messages: [{ role: 'user', content: 'Reply with the single word: ok' }] },
  perplexity: { model: 'sonar', messages: [{ role: 'user', content: 'Reply with the single word: ok' }] },

  // ── Translation / NLP / media gen ───────────────────────────────────────────
  deepl: { text: 'Hello, world.', target_lang: 'DE' },
  'stability-ai': { prompt: 'a serene mountain lake at sunset, photorealistic' },

  // ── Travel / flights ────────────────────────────────────────────────────────
  stabletravel: {
    originDestinations: [
      {
        id: '1',
        originLocationCode: 'JFK',
        destinationLocationCode: 'LHR',
        departureDateTimeRange: { date: '2026-09-01' },
      },
    ],
    travelers: [{ id: '1', travelerType: 'ADULT' }],
    sources: ['GDS'],
  },

  // ── stableenrich (Exa search) ────────────────────────────────────────────────
  stableenrich: { query: 'stellar usdc payments for AI agents' },

  // ── Misc with documented numeric/array bodies ───────────────────────────────
  'stripe-climate': { amount: 100 },
}

/**
 * Resolve the best example body for an endpoint: an endpoint-specific example if
 * one exists, otherwise the provider-level fallback, otherwise null (caller shows
 * an empty object). Returns a shallow clone so callers can't mutate the source.
 */
export function examplePayloadFor(
  endpointId: string,
  providerId: string,
): Record<string, unknown> | null {
  const hit = ENDPOINT_EXAMPLES[endpointId] ?? PROVIDER_EXAMPLES[providerId] ?? null
  return hit ? { ...hit } : null
}
