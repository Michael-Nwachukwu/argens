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
  // ── Deepgram ─────────────────────────────────────────────────────────────────
  'deepgram_deepgram_list-models': {},
  'deepgram_deepgram_analyze': { text: 'I love using Argens for autonomous AI payments on Stellar.' },
  'deepgram_deepgram_speak': { text: 'Hello from an autonomous AI agent powered by Argens.', model: 'aura-asteria-en' },
  'deepgram_deepgram_transcribe': { url: 'https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav', model: 'nova-2', language: 'en' },

  // ── Anthropic ─────────────────────────────────────────────────────────────────
  // chat_completions is OpenAI-compatible (auto-converted to Anthropic format).
  // anthropic_messages is unavailable upstream, so not surfaced.
  anthropic_chat_completions: { model: 'claude-haiku-4-5', messages: [{ role: 'user', content: 'Write a haiku about autonomous AI agents.' }], max_tokens: 256 },

  // ── Codex (GraphQL) ─────────────────────────────────────────────────────────
  codex_graphql: { query: '{ getNetworks { name networkId } }' },

  // ── Firecrawl (v2) — only `url`/`query`/`urls` is required per endpoint ────────
  firecrawl_scrape: { url: 'https://stellar.org', formats: ['markdown'], onlyMainContent: true },
  firecrawl_crawl: { url: 'https://stellar.org', limit: 10, scrapeOptions: { formats: ['markdown'] } },
  firecrawl_map: { url: 'https://stellar.org' },
  firecrawl_search: { query: 'stellar usdc payments for AI agents', limit: 5 },
  firecrawl_extract: { urls: ['https://stellar.org'], prompt: 'Extract the main product name and one-line description.' },

  // ── StableEmail ───────────────────────────────────────────────────────────────
  // Shared relay: sends from relay@stableemail.dev. Requires `html` or `text`.
  stableemail_send: { to: ['recipient@example.com'], subject: 'Hello from Argens', text: 'Sent via the Argens marketplace using StableEmail.' },
  // Custom subdomain: $5 to buy yourname.stableemail.dev.
  stableemail_subdomain_buy: { subdomain: 'yourname' },
  stableemail_subdomain_send: { from: 'you@yourname.stableemail.dev', to: ['recipient@example.com'], subject: 'Hello', text: 'Sent from my StableEmail subdomain.' },
  stableemail_subdomain_inbox_create: { subdomain: 'yourname', localPart: 'agent', forwardTo: 'you@gmail.com' },
  stableemail_subdomain_inbox_messages: { subdomain: 'yourname', localPart: 'agent', limit: 20 },
  stableemail_subdomain_inbox_messages_read: { messageId: 'replace-with-message-id' },
  // Forwarding inbox: username@stableemail.dev, $1/30 days.
  stableemail_inbox_buy: { username: 'alice', forwardTo: 'alice@gmail.com' },
  stableemail_inbox_topup: { username: 'alice' },
  stableemail_inbox_topup_quarter: { username: 'alice' },
  stableemail_inbox_topup_year: { username: 'alice' },
  stableemail_inbox_send: { username: 'alice', to: ['recipient@example.com'], subject: 'Hello', text: 'Sent from my StableEmail inbox address.' },
  stableemail_inbox_messages: { username: 'alice', limit: 20 },
  stableemail_inbox_messages_read: { messageId: 'replace-with-message-id' },

  // ── CoinGecko ───────────────────────────────────────────────────────────────
  coingecko_simple_price: { ids: 'bitcoin', vs_currencies: 'usd' },
  coingecko_coingecko_simple_price: { ids: 'bitcoin', vs_currencies: 'usd' },

  // ── AlphaVantage ────────────────────────────────────────────────────────────
  alphavantage_alphavantage_time_series_intraday: { symbol: 'AAPL', interval: '5min' },
  'alphavantage_alphavantage_commodity-price': { commodity: 'WTI' },
  alphavantage_alphavantage_commodity_price: { commodity: 'WTI' },
  'alphavantage_alphavantage_symbol-search': { keywords: 'Apple' },
  'alphavantage_alphavantage_earnings-call-transcript': { symbol: 'AAPL', quarter: 'Q1', year: 2025 },
  'alphavantage_alphavantage_currency-exchange-rate': { from_currency: 'USD', to_currency: 'EUR' },
  'alphavantage_alphavantage_fx-daily': { from_symbol: 'USD', to_symbol: 'EUR' },
  'alphavantage_alphavantage_crypto-exchange-rate': { from_currency: 'BTC', to_currency: 'USD' },
  'alphavantage_alphavantage_digital-currency-daily': { symbol: 'BTC', market: 'USD' },
  'alphavantage_alphavantage_economic-indicator': { indicator: 'REAL_GDP' },
  'alphavantage_alphavantage_sma': { symbol: 'AAPL', interval: 'daily', time_period: 14 },
  'alphavantage_alphavantage_ema': { symbol: 'AAPL', interval: 'daily', time_period: 14 },
  'alphavantage_alphavantage_macd': { symbol: 'AAPL', interval: 'daily', series_type: 'close' },
  'alphavantage_alphavantage_rsi': { symbol: 'AAPL', interval: 'daily', time_period: 14 },
  'alphavantage_alphavantage_bbands': { symbol: 'AAPL', interval: 'daily', time_period: 20 },

  // ── stableenrich / Exa (stableenrich provider) ──────────────────────────────
  stableenrich_exa_search: { query: 'stellar usdc payments for AI agents' },
  stableenrich_exa_answer: { query: 'What is Stellar blockchain and how does USDC work on it?' },
  stableenrich_exa_contents: { urls: ['https://stellar.org'] },
  'stableenrich_exa_find-similar': { url: 'https://stellar.org' },

  // ── stabletravel / Amadeus-style flight search ───────────────────────────────
  stabletravel_flights_ava: {
    originDestinations: [
      { id: '1', originLocationCode: 'JFK', destinationLocationCode: 'LHR', departureDateTimeRange: { date: '2026-09-01' } },
    ],
    travelers: [{ id: '1', travelerType: 'ADULT' }],
    sources: ['GDS'],
  },

  // ── Exa (standalone provider, separate from stableenrich) ───────────────────
  exa_search: { query: 'stellar blockchain usdc payments' },
  exa_answer: { query: 'What is Stellar blockchain and how does it handle USDC?' },
  exa_contents: { urls: ['https://stellar.org'] },
  exa_findsimilar: { url: 'https://stellar.org' },

  // ── fal.ai — image/video generation ─────────────────────────────────────────
  fal_flux_dev: { prompt: 'a serene mountain lake at sunset, photorealistic' },
  fal_flux_schnell: { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'fal_flux-pro_v1_1': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'fal_flux-pro_v1_1-ultra': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'fal_stable-diffusion-v35-large': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'fal_fast-sdxl': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'fal_recraft-v3': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'fal_grok-imagine-image': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'fal_grok-imagine-image_edit': { prompt: 'make the sky more dramatic', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'fal_stable-video': { image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'fal_minimax_video-01': { prompt: 'a camera panning over a mountain lake at sunset' },
  'fal_minimax_video-01-live': { prompt: 'a camera panning over a mountain lake at sunset' },
  'fal_grok-imagine-video_text-to-video': { prompt: 'a camera panning over a mountain lake at sunset' },
  'fal_grok-imagine-video_image-to-video': { image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png', prompt: 'animate this image' },
  fal_model: { model: 'fal-ai/flux/dev', input: { prompt: 'a serene mountain lake at sunset' } },
  fal_namespace_model: { namespace: 'fal-ai', model: 'flux/dev', input: { prompt: 'a serene mountain lake at sunset' } },

  // ── Gemini ───────────────────────────────────────────────────────────────────
  gemini_generate: { model: 'gemini-1.5-flash', contents: [{ parts: [{ text: 'Say hello in one sentence.' }] }] },
  gemini_version_files: { version: 'v1beta', display_name: 'test-upload.txt' },

  // ── Judge0 — code execution ──────────────────────────────────────────────────
  'judge0_judge0_execute-code': { source_code: "print('Hello from Argens!')", language_id: 71, stdin: '' },
  'judge0_judge0_submit-code': { source_code: "print('Hello from Argens!')", language_id: 71, stdin: '' },
  'judge0_judge0_get-submission': { token: 'placeholder-token' },
  'judge0_judge0_list-languages': {},
  'judge0_judge0_list-statuses': {},

  // ── Mapbox ──────────────────────────────────────────────────────────────────
  'mapbox_mapbox_geocode-forward': { q: '1600 Pennsylvania Ave NW, Washington DC' },
  'mapbox_mapbox_geocode-reverse': { longitude: -77.0366, latitude: 38.897 },
  mapbox_mapbox_directions: { coordinates: [[-77.0366, 38.897], [-74.006, 40.7128]], profile: 'mapbox/driving' },
  mapbox_mapbox_matrix: { coordinates: [[-77.0366, 38.897], [-74.006, 40.7128]], profile: 'mapbox/driving' },
  mapbox_mapbox_isochrone: { profile: 'mapbox/driving', coordinates: [-77.0366, 38.897], contours_minutes: [15] },
  'mapbox_mapbox_map-matching': { coordinates: [[-77.0366, 38.897], [-77.035, 38.898]], profile: 'mapbox/driving' },
  'mapbox_mapbox_static-image': { style: 'streets-v11', position: { lon: -77.0366, lat: 38.897, zoom: 12 }, overlay: null, width: 300, height: 200 },
  mapbox_mapbox_tilequery: { tileset_id: 'mapbox.mapbox-terrain-v2', longitude: -77.0366, latitude: 38.897, radius: 10 },

  // ── Nansen — wallet analytics ────────────────────────────────────────────────
  'nansen_smart-money_netflow': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  'nansen_smart-money_dex-trades': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  'nansen_smart-money_perp-trades': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  'nansen_smart-money_dcas': { token_address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  'nansen_smart-money_holdings': { limit: 10 },
  'nansen_smart-money_historical-holdings': { limit: 10 },
  nansen_profiler_address_transactions: { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', chain: 'ethereum' },
  'nansen_transaction-with-token-transfer-lookup': { transaction_hash: '0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060', chain: 'ethereum' },
  'nansen_profiler_address_pnl-summary': { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', chain: 'ethereum' },
  'nansen_profiler_address_current-balance': { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', chain: 'ethereum' },
  nansen_profiler_address_counterparties: { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', chain: 'ethereum' },
  'nansen_profiler_address_historical-balances': { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', chain: 'ethereum' },
  'nansen_profiler_address_related-wallets': { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', chain: 'ethereum' },
  nansen_profiler_address_pnl: { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', chain: 'ethereum' },
  'nansen_profiler_perp-positions': { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },
  'nansen_profiler_perp-trades': { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },
  nansen_tgm_flows: { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  'nansen_tgm_who-bought-sold': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  'nansen_tgm_dex-trades': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  nansen_tgm_transfers: { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  nansen_tgm_holders: { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  'nansen_tgm_pnl-leaderboard': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  'nansen_tgm_perp-pnl-leaderboard': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  'nansen_tgm_perp-positions': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  'nansen_tgm_perp-trades': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  'nansen_tgm_flow-intelligence': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  'nansen_tgm_position-intelligence': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  'nansen_tgm_token-information': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  nansen_tgm_indicators: { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
  'nansen_tgm_token-ohlcv': { token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum', interval: '1d' },
  'nansen_tgm_jup-dca': { token_address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
  'nansen_token-screener': { chain: 'ethereum', limit: 10 },
  'nansen_perp-screener': { limit: 10 },
  'nansen_perp-leaderboard': { limit: 10 },
  'nansen_prediction-market_ohlcv': { market_id: 'will-bitcoin-hit-100k-in-2025', interval: '1d' },
  'nansen_prediction-market_orderbook': { market_id: 'will-bitcoin-hit-100k-in-2025' },
  'nansen_prediction-market_top-holders': { market_id: 'will-bitcoin-hit-100k-in-2025' },
  'nansen_prediction-market_trades-by-market': { market_id: 'will-bitcoin-hit-100k-in-2025' },
  'nansen_prediction-market_market-screener': { limit: 10 },
  'nansen_prediction-market_event-screener': { limit: 10 },
  'nansen_prediction-market_pnl-by-market': { market_id: 'will-bitcoin-hit-100k-in-2025' },
  'nansen_prediction-market_pnl-by-address': { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },
  'nansen_prediction-market_position-detail': { market_id: 'will-bitcoin-hit-100k-in-2025', address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },
  'nansen_prediction-market_trades-by-address': { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },
  'nansen_prediction-market_categories': {},

  // ── Allium — blockchain analytics ────────────────────────────────────────────
  allium_developer_prices: { chain: 'ethereum', token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  'allium_developer_prices_at-timestamp': { chain: 'ethereum', token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', timestamp: '2026-01-01T00:00:00Z' },
  allium_developer_prices_history: { chain: 'ethereum', token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  allium_developer_prices_stats: { chain: 'ethereum', token_address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  'allium_developer_tokens_chain-address': { chain: 'ethereum', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  allium_developer_wallet_balances: { chain: 'ethereum', wallet_address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },
  allium_developer_wallet_balances_history: { chain: 'ethereum', wallet_address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },
  allium_developer_wallet_transactions: { chain: 'ethereum', wallet_address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },
  allium_developer_wallet_pnl: { chain: 'ethereum', wallet_address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },
  'allium_explorer_queries_run-async': { query: 'SELECT block_number, transaction_count FROM ethereum.blocks ORDER BY block_number DESC LIMIT 5' },
  'allium_explorer_queries_query_id_run-async': { query_id: 'placeholder-query-id' },

  // ── Alchemy / Conduit / QuickNode / Tempo — JSON-RPC ────────────────────────
  alchemy_rpc: { method: 'eth_blockNumber', params: [], network: 'eth-mainnet' },
  alchemy_network_nft_v3_endpoint: { endpoint: 'getNFTsForOwner', params: { owner: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' }, network: 'eth-mainnet' },
  conduit_network: { network: 'conduit-mainnet', jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
  tempo_rpc: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
  quicknode_network: { network: 'eth-mainnet', jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
  // NOTE: network goes in the `query` field of POST /v1/marketplace/call, not payload — it substitutes into the URL path
  quicknode_session_network: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },

  // ── StableSocial — TikTok / Instagram / Facebook / Reddit ───────────────────
  stablesocial_tiktok_profile: { username: 'nasa' },
  stablesocial_tiktok_posts: { username: 'nasa' },
  'stablesocial_tiktok_post-comments': { video_id: '7000000000000000000' },
  'stablesocial_tiktok_comment-replies': { comment_id: '7000000000000000000' },
  stablesocial_tiktok_followers: { username: 'nasa' },
  stablesocial_tiktok_following: { username: 'nasa' },
  stablesocial_tiktok_search: { keyword: 'stellar blockchain' },
  'stablesocial_tiktok_search-hashtag': { hashtag: 'blockchain' },
  'stablesocial_tiktok_search-profiles': { keyword: 'crypto' },
  'stablesocial_tiktok_search-music': { keyword: 'lo-fi beats' },
  stablesocial_instagram_profile: { username: 'nasa' },
  stablesocial_instagram_posts: { username: 'nasa' },
  'stablesocial_instagram_post-comments': { post_id: 'placeholder-post-id' },
  'stablesocial_instagram_comment-replies': { comment_id: 'placeholder-comment-id' },
  stablesocial_instagram_followers: { username: 'nasa' },
  stablesocial_instagram_following: { username: 'nasa' },
  stablesocial_instagram_stories: { username: 'nasa' },
  stablesocial_instagram_highlights: { username: 'nasa' },
  stablesocial_instagram_search: { keyword: 'stellar blockchain' },
  'stablesocial_instagram_search-tags': { tag: 'blockchain' },
  stablesocial_facebook_profile: { page_id: 'nasa' },
  stablesocial_facebook_posts: { page_id: 'nasa' },
  'stablesocial_facebook_post-comments': { post_id: 'nasa_placeholder' },
  'stablesocial_facebook_comment-replies': { comment_id: 'placeholder-comment-id' },
  stablesocial_facebook_followers: { page_id: 'nasa' },
  stablesocial_facebook_following: { page_id: 'nasa' },
  stablesocial_facebook_search: { keyword: 'stellar blockchain' },
  'stablesocial_facebook_search-people': { keyword: 'blockchain developer' },
  'stablesocial_facebook_search-pages': { keyword: 'crypto' },
  'stablesocial_facebook_search-groups': { keyword: 'crypto' },
  stablesocial_reddit_post: { post_id: 'placeholder-post-id' },
  'stablesocial_reddit_post-comments': { post_id: 'placeholder-post-id' },
  stablesocial_reddit_comment: { comment_id: 'placeholder-comment-id' },
  stablesocial_reddit_search: { query: 'stellar blockchain' },
  'stablesocial_reddit_search-profiles': { query: 'blockchain developer' },
  stablesocial_reddit_subreddit: { subreddit: 'cryptocurrency' },

  // ── StableStudio — image/video generation ────────────────────────────────────
  'stablestudio_generate_nano-banana_generate': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'stablestudio_generate_nano-banana_edit': { prompt: 'make the sky more dramatic', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'stablestudio_generate_nano-banana-pro_generate': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'stablestudio_generate_nano-banana-pro_edit': { prompt: 'make the sky more dramatic', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'stablestudio_generate_grok_generate': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'stablestudio_generate_grok_edit': { prompt: 'make the sky more dramatic', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'stablestudio_generate_grok-video_generate': { prompt: 'a camera panning over a mountain lake at sunset' },
  'stablestudio_generate_gpt-image-1_generate': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'stablestudio_generate_gpt-image-1_edit': { prompt: 'make the sky more dramatic', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'stablestudio_generate_gpt-image-1_5_generate': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'stablestudio_generate_gpt-image-1_5_edit': { prompt: 'make the sky more dramatic', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'stablestudio_generate_flux-2-pro_generate': { prompt: 'a serene mountain lake at sunset, photorealistic' },
  'stablestudio_generate_flux-2-pro_edit': { prompt: 'make the sky more dramatic', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'stablestudio_generate_seedance_t2v': { prompt: 'a camera panning over a mountain lake at sunset' },
  'stablestudio_generate_seedance_i2v': { prompt: 'animate this image', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'stablestudio_generate_seedance-fast_t2v': { prompt: 'a camera panning over a mountain lake at sunset' },
  'stablestudio_generate_seedance-fast_i2v': { prompt: 'animate this image', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'stablestudio_generate_wan-2_6_t2v': { prompt: 'a camera panning over a mountain lake at sunset' },
  'stablestudio_generate_wan-2_6_i2v': { prompt: 'animate this image', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'stablestudio_generate_sora-2_generate': { prompt: 'a camera panning over a mountain lake at sunset' },
  'stablestudio_generate_sora-2-pro_generate': { prompt: 'a camera panning over a mountain lake at sunset' },
  'stablestudio_generate_veo-3_1_generate': { prompt: 'a camera panning over a mountain lake at sunset' },
  'stablestudio_generate_veo-3_1-fast_generate': { prompt: 'a camera panning over a mountain lake at sunset' },
  stablestudio_upload: { filename: 'test.png', content_type: 'image/png' },

  // ── Suno — music generation ──────────────────────────────────────────────────
  suno_suno_generate_music: { prompt: 'An upbeat electronic track about autonomous AI agents', title: 'Agent Anthem', tags: 'electronic, upbeat, futuristic', customMode: true },
  'suno_suno_generate-music': { prompt: 'An upbeat electronic track about autonomous AI agents', title: 'Agent Anthem', tags: 'electronic, upbeat, futuristic', customMode: true },
  'suno_suno_generate-lyrics': { prompt: 'A song about autonomous AI agents on the Stellar blockchain' },
  suno_suno_generate_lyrics: { prompt: 'A song about autonomous AI agents on the Stellar blockchain' },
  'suno_suno_get-music-status': { taskId: 'placeholder-task-id' },
  'suno_suno_get-lyrics-status': { taskId: 'placeholder-task-id' },

  // ── Tako — data visualization ────────────────────────────────────────────────
  tako_mpp_v1_visualize: { query: 'GDP by country 2025' },
  'tako_mpp_v1_thinviz_create': { prompt: 'Show cryptocurrency market cap trend for 2024', query: 'crypto market cap 2024', components: ['chart'] },
  'tako_mpp_v1_search_deep': { query: 'bitcoin price trend 2024' },
  'tako_mpp_v1_threads_deep': { query: 'cryptocurrency market cap 2024' },
  'tako_mpp_v1_reports_generate': { query: 'global crypto market overview 2024' },
  'tako_mpp_v1_charts_edit': { chart_id: 'placeholder-chart-id', prompt: 'change the chart type to bar' },

  // ── Replicate — ML model inference ───────────────────────────────────────────
  replicate_replicate_run: { model_owner: 'stability-ai', model_name: 'stable-diffusion', input: { prompt: 'a mountain lake at sunset' } },
  'replicate_replicate_get-prediction': { prediction_id: 'placeholder-prediction-id' },
  'replicate_replicate_get-model': { model_owner: 'stability-ai', model_name: 'stable-diffusion' },
  'replicate_replicate_list-models': {},

  // ── Browserbase ──────────────────────────────────────────────────────────────
  browserbase_browser_session_create: {},
  'browserbase_browser_session_id_extend': { id: 'placeholder-session-id', duration: 60 },
  browserbase_search: { query: 'stellar blockchain usdc payments' },
  browserbase_fetch: { url: 'https://stellar.org' },

  // ── Parallel ─────────────────────────────────────────────────────────────────
  parallel_search: { query: 'stellar blockchain usdc payments for AI agents' },
  parallel_extract: { url: 'https://stellar.org' },
  parallel_task: { task: 'What is Stellar blockchain and how does USDC work on it?' },

  // ── KicksDB ──────────────────────────────────────────────────────────────────
  'kicksdb_stockx_prices': { styleIds: ['Nike-Air-Jordan-1-Retro-High-OG-Black-White-2019'] },

  // ── OpenRouter ───────────────────────────────────────────────────────────────
  openrouter_chat: { model: 'google/gemma-3-4b-it:free', messages: [{ role: 'user', content: 'Reply with the single word: ok' }] },

  // ── moltycash — X (Twitter) gigs / tips ─────────────────────────────────────
  moltycash_a2a: { task: 'Post about Argens - the AI payment platform for autonomous agents', reward: 1 },
  'moltycash_username_a2a': { username: 'argensonline', amount: 1, message: 'Test tip from Argens probe' },  // {username} substituted into path

  // ── AutoExchange ─────────────────────────────────────────────────────────────
  autoexchange_agents_id_run: { id: 'placeholder-agent-id', input: 'What is 2 + 2?' },  // {id} substituted into path

  // ── Oxylabs — web scraping proxy ─────────────────────────────────────────────
  oxylabs_proxy: { url: 'https://example.com' },

  // ── Pinata IPFS ──────────────────────────────────────────────────────────────
  pinata_pin_public: { cid: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco' },

  // ── Object Storage ───────────────────────────────────────────────────────────
  storage_upload: { action: 'start', key: 'argens-test.txt', content_type: 'text/plain', size: 12 },

  // ── StableUpload ─────────────────────────────────────────────────────────────
  stableupload_upload: { filename: 'test.txt', content_type: 'text/plain', size: 100 },
  stableupload_site: { domain: 'test-argens' },

  // ── Doma — domain registration ───────────────────────────────────────────────
  doma_register: { domain: 'test-domain-probe-99999.com', contact: { first_name: 'Test', last_name: 'User', email: 'test@example.com', phone: '+14155552671', address: '123 Main St', city: 'San Francisco', state: 'CA', postal_code: '94102', country: 'US' } },

  // ── BuildWithLocus ───────────────────────────────────────────────────────────
  'buildwithlocus_billing_mpp-top-up': { amount: 1 },

  // ── Modal — sandboxed code execution ─────────────────────────────────────────
  modal_sandbox_create: { timeout: 300, cpu: 0.25, memory: 256 },
  modal_sandbox_status: { sandbox_id: 'placeholder-sandbox-id' },
  modal_sandbox_terminate: { sandbox_id: 'placeholder-sandbox-id' },

  // ── 2Captcha / twocaptcha ────────────────────────────────────────────────────
  twocaptcha_createtask: { task: { type: 'ImageToTextTask', body: 'R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' } },

  // ── Megapot — lottery ────────────────────────────────────────────────────────
  megapot_purchase: { recipient_wallet: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },
  megapot_status: { ticketIds: ['placeholder-ticket-id'] },

  // ── PostalForm — print-and-mail ───────────────────────────────────────────────
  postalform_machine_mpp_orders: {
    message: 'Hello from an Argens AI agent!',
    to_address: { name: 'Test User', address_line1: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'US' },
  },

  // ── Martin Estate Winery ─────────────────────────────────────────────────────
  'martin-estate_purchase': {
    product_id: 'placeholder-wine-id',
    quantity: 1,
    email: 'buyer@example.com',
    shipping: { address: '123 Main St', city: 'San Francisco', state: 'CA', zip: '94102', country: 'US' },
  },

  // ── Rozo Agent API (pay-invoice — real payment action, stub only) ─────────────
  'rozo-agent-api_pay-invoice': { invoice_url: 'https://commerce.coinbase.com/charges/placeholder' },

  // ── Apollo — sales intelligence ──────────────────────────────────────────────
  'apollo_apollo_bulk-people-enrichment': { details: [{ first_name: 'Patrick', last_name: 'Collison', organization_name: 'Stripe' }] },
  'apollo_apollo_bulk-org-enrichment': { domains: ['stripe.com'] },
  'apollo_apollo_people-search': { q_keywords: 'software engineer fintech', page: 1, per_page: 5 },
  'apollo_apollo_org-search': { q_keywords: 'fintech payments', page: 1, per_page: 5 },
  'apollo_apollo_job-postings': { organization_id: 'placeholder-org-id' },
  'apollo_apollo_news-search': { organization_ids: ['placeholder-org-id'] },

  // ── Brave — AI answer ────────────────────────────────────────────────────────
  'brave_brave_answers': { messages: [{ role: 'user', content: 'What is Stellar blockchain?' }] },

  // ── BuildWith — technology intelligence ──────────────────────────────────────
  'builtwith_builtwith_lists': { TECH: 'Shopify' },
  'builtwith_builtwith_company-to-url': { COMPANY: 'Stripe' },
  'builtwith_builtwith_product': { QUERY: 'payment gateway' },
  'builtwith_builtwith_trends': { TECH: 'React' },

  // ── Clado — LinkedIn / contacts ──────────────────────────────────────────────
  'clado_clado_deep-research-status': { jobId: 'placeholder-job-id' },
  'clado_clado_deep-research-cancel': { jobId: 'placeholder-job-id' },
  'clado_clado_deep-research-more': { jobId: 'placeholder-job-id' },
  'clado_clado_contacts': { linkedin_url: 'https://www.linkedin.com/in/satoshi-nakamoto' },
  'clado_clado_scrape': { linkedin_url: 'https://www.linkedin.com/in/satoshi-nakamoto' },
  'clado_clado_linkedin-profile': { linkedin_url: 'https://www.linkedin.com/in/satoshi-nakamoto' },
  'clado_clado_post-reactions': { url: 'https://www.linkedin.com/posts/placeholder' },
  'clado_clado_bulk-contacts': { linkedin_urls: ['https://www.linkedin.com/in/satoshi-nakamoto'] },
  'clado_clado_bulk-contacts-status': { jobId: 'placeholder-job-id' },

  // ── CoinGecko — crypto data ──────────────────────────────────────────────────
  'coingecko_coingecko_simple-token-price': { platform_id: 'ethereum', contract_addresses: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', vs_currencies: 'usd' },
  'coingecko_coingecko_coins-markets': { vs_currency: 'usd' },
  'coingecko_coingecko_coin-data': { id: 'bitcoin' },
  'coingecko_coingecko_search': { query: 'bitcoin' },
  'coingecko_coingecko_market-chart': { id: 'bitcoin', vs_currency: 'usd', days: 7 },
  'coingecko_coingecko_coin-history': { id: 'bitcoin', date: '01-01-2025' },
  'coingecko_coingecko_top-gainers-losers': { vs_currency: 'usd' },

  // ── Diffbot KG ───────────────────────────────────────────────────────────────
  'diffbot-kg_diffbot-kg_enhance': { type: 'Organization', name: 'Stripe' },

  // ── EDGAR ────────────────────────────────────────────────────────────────────
  'edgar_edgar_company-concept': { cik: '320193', taxonomy: 'us-gaap', tag: 'Revenues' },

  // ── Abstract Exchange Rates ───────────────────────────────────────────────────
  'abstract-exchange-rates_abstract-exchange-rates_convert': { base: 'USD', target: 'EUR', value: 100 },
  'abstract-exchange-rates_abstract-exchange-rates_historical': { base: 'USD', target: 'EUR', date: '2025-01-01' },

  // ── Grok — xAI image / audio ─────────────────────────────────────────────────
  'grok_grok_image-generate': { prompt: 'a serene mountain lake at sunset, photorealistic', model: 'aurora' },
  'grok_grok_image-edit': { prompt: 'make the sky more dramatic', image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png' },
  'grok_grok_tts': { text: 'Hello from an autonomous AI agent.', voice: 'default' },

  // ── Hunter — email intelligence ──────────────────────────────────────────────
  'hunter_hunter_email-finder': { first_name: 'Patrick', last_name: 'Collison', domain: 'stripe.com' },
  'hunter_hunter_email-verifier': { email: 'support@stripe.com' },
  'hunter_hunter_email-enrichment': { email: 'support@stripe.com' },
  'hunter_hunter_combined-enrichment': { email: 'support@stripe.com' },

  // ── Mathpix — handwriting / math OCR ────────────────────────────────────────
  'mathpix_mathpix_process-strokes': { strokes: { x: [[0, 1, 2, 3]], y: [[0, 1, 0, 1]], t: [[0, 100, 200, 300]] } },

  // ── Mistral — embed / moderate ───────────────────────────────────────────────
  'mistral_mistral_embed': { model: 'mistral-embed', input: ['What is Stellar blockchain?'] },
  'mistral_mistral_moderate': { model: 'mistral-moderation-latest', input: ['This is a test message.'] },

  // ── OpenWeather ──────────────────────────────────────────────────────────────
  'openweather_openweather_current-weather': { lat: 51.509865, lon: -0.118092 },
  'openweather_openweather_forecast-5day': { lat: 51.509865, lon: -0.118092 },
  'openweather_openweather_air-quality': { lat: 51.509865, lon: -0.118092 },
  'openweather_openweather_reverse-geocode': { lat: 51.509865, lon: -0.118092, limit: 1 },
  'openweather_openweather_onecall': { lat: 51.509865, lon: -0.118092 },
  'openweather_openweather_weather-overview': { lat: 51.509865, lon: -0.118092 },

  // ── Perplexity ───────────────────────────────────────────────────────────────
  'perplexity_perplexity_search': { query: 'What is Stellar blockchain?' },
  'perplexity_perplexity_embed': { input: ['What is Stellar blockchain?'] },
  'perplexity_perplexity_context-embed': { document: 'Stellar is an open blockchain network designed for payments.' },

  // ── Rentcast — real estate data ──────────────────────────────────────────────
  'rentcast_rentcast_property-by-id': { id: 'placeholder-property-id' },
  'rentcast_rentcast_value-estimate': { address: '123 Main St, Austin, TX 78701' },
  'rentcast_rentcast_rent-estimate': { address: '123 Main St, Austin, TX 78701', bedrooms: 2, bathrooms: 1, propertyType: 'House' },
  'rentcast_rentcast_sale-listing-by-id': { id: 'placeholder-listing-id' },
  'rentcast_rentcast_rental-listing-by-id': { id: 'placeholder-listing-id' },
  'rentcast_rentcast_markets': { zipCode: '78701' },

  // ── BuildWithLocus ───────────────────────────────────────────────────────────
  'buildwithlocus_auth_mpp-sign-up': { email: 'probe-test@example.com', tempoAddress: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZXM' },

  // ── Tavily ───────────────────────────────────────────────────────────────────
  'tavily_tavily_extract': { urls: ['https://stellar.org'] },
  'tavily_tavily_map': { url: 'https://stellar.org' },
  'tavily_tavily_crawl': { url: 'https://stellar.org' },

  // ── Abstract Timezone ────────────────────────────────────────────────────────
  'abstract-timezone_abstract-timezone_convert-time': { base_location: 'London, United Kingdom', base_datetime: '2026-01-01T12:00:00', target_location: 'New York, USA' },

  // ── Abstract VAT ────────────────────────────────────────────────────────────
  'abstract-vat_abstract-vat_calculate': { amount: 100, country_code: 'DE', is_vat_incl: false },
  'abstract-vat_abstract-vat_categories': { country_code: 'DE' },

  // ── WolframAlpha ──────────────────────────────────────────────────────────────
  'wolframalpha_wolframalpha_full-results': { input: 'population of France' },

  // ── Papercut — developer gifting ─────────────────────────────────────────────
  'papercut_send': { github_username: 'stellar' },
}

/** Provider-level fallback examples, keyed by the provider id (the toggle key). */
export const PROVIDER_EXAMPLES: Record<string, Record<string, unknown>> = {
  // ── Abstract API family (each needs one identifier field) ──────────────────
  'abstract-company-enrichment': { domain: 'stripe.com' },
  'abstract-email-reputation': { email: 'support@stripe.com' },
  'abstract-exchange-rates': { base: 'USD', target: 'EUR' },
  'abstract-holidays': { country: 'US' },
  'abstract-iban-validation': { iban: 'DE89370400440532013000' },
  'abstract-ip-intelligence': { ip_address: '8.8.8.8' },
  'abstract-phone-intelligence': { phone: '+14155552671' },
  'abstract-timezone': { location: 'London, United Kingdom' },
  'abstract-vat': { vat_number: 'DE811907980' },
  'abstract-web-scraping': { url: 'https://example.com' },

  // ── Search / web / data ────────────────────────────────────────────────────
  alphavantage: { symbol: 'AAPL', interval: '5min' },
  apollo: { q_keywords: 'software engineer payments' },
  billboard: { text: 'Hello from an autonomous agent' },
  brave: { q: 'stellar usdc payments' },
  builtwith: { LOOKUP: 'shopify.com' },
  clado: { query: 'AI infrastructure engineers in San Francisco' },
  coingecko: { ids: 'bitcoin', vs_currencies: 'usd' },
  diffbot: { url: 'https://www.example.com/article' },
  'diffbot-kg': { type: 'Organization', name: 'Stripe' },
  'diffbot-nl': { content: 'Stripe is a financial infrastructure company headquartered in San Francisco.' },
  edgar: { cik: '320193', taxonomy: 'us-gaap', tag: 'Revenues' },
  'edgar-search': { q: 'Apple Inc annual report' },
  govlaws: { query: 'data privacy' },
  hunter: { domain: 'stripe.com' },
  ipinfo: { ip: '8.8.8.8' },
  mathpix: { src: 'https://mathpix-ocr-examples.s3.amazonaws.com/cases_hw.jpg' },
  openweather: { lat: 51.509865, lon: -0.118092 },
  rentcast: { address: '123 Main St, Austin, TX 78701' },
  screenshotone: { url: 'https://example.com' },
  tavily: { query: 'stellar usdc payments' },
  wolframalpha: { i: 'population of France' },

  // ── LLM chat providers (OpenAI-style {model, messages}) ─────────────────────
  deepseek: { model: 'deepseek-chat', messages: [{ role: 'user', content: 'Reply with the single word: ok' }] },
  grok: { model: 'grok-2-latest', messages: [{ role: 'user', content: 'Reply with the single word: ok' }] },
  groq: { model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'Reply with the single word: ok' }] },
  mistral: { model: 'mistral-small-latest', messages: [{ role: 'user', content: 'Reply with the single word: ok' }] },
  perplexity: { query: 'What is Stellar blockchain?' },

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

  // ── stableemail ───────────────────────────────────────────────────────────────
  stableemail: { to: ['recipient@example.com'], subject: 'Hello from Argens', text: 'Sent via the Argens marketplace using StableEmail.' },

  // ── Firecrawl ─────────────────────────────────────────────────────────────────
  firecrawl: { url: 'https://stellar.org', formats: ['markdown'], onlyMainContent: true },

  // ── Exa (standalone) ────────────────────────────────────────────────────────
  exa: { query: 'stellar blockchain usdc payments' },

  // ── fal.ai fallback ─────────────────────────────────────────────────────────
  fal: { prompt: 'a serene mountain lake at sunset, photorealistic' },

  // ── Gemini fallback ──────────────────────────────────────────────────────────
  gemini: { model: 'gemini-1.5-flash', contents: [{ parts: [{ text: 'Say hello in one sentence.' }] }] },

  // ── Judge0 fallback ──────────────────────────────────────────────────────────
  judge0: { source_code: "print('Hello from Argens!')", language_id: 71, stdin: '' },

  // ── Mapbox fallback (forward geocode) ────────────────────────────────────────
  mapbox: { q: '1600 Pennsylvania Ave NW, Washington DC' },

  // ── Nansen fallback (wallet) ─────────────────────────────────────────────────
  nansen: { address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296', chain: 'ethereum' },

  // ── Allium fallback ──────────────────────────────────────────────────────────
  allium: { chain: 'ethereum', wallet_address: '0x3DdfA8eC3052539b6C9549F12cEA2C295cfF5296' },

  // ── Alchemy / RPC providers ───────────────────────────────────────────────────
  alchemy: { method: 'eth_blockNumber', params: [], network: 'eth-mainnet' },
  conduit: { network: 'conduit-mainnet', jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
  tempo: { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },
  quicknode: { network: 'eth-mainnet', jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 },

  // ── OpenRouter ───────────────────────────────────────────────────────────────
  openrouter: { model: 'google/gemma-3-4b-it:free', messages: [{ role: 'user', content: 'Reply with the single word: ok' }] },

  // ── Anthropic (OpenAI-compatible chat completions) ────────────────────────────
  anthropic: { model: 'claude-haiku-4-5', messages: [{ role: 'user', content: 'Write a haiku about autonomous AI agents.' }], max_tokens: 256 },

  // ── Parallel ─────────────────────────────────────────────────────────────────
  parallel: { query: 'stellar blockchain usdc payments for AI agents' },

  // ── StableSocial fallback ─────────────────────────────────────────────────────
  stablesocial: { username: 'nasa' },

  // ── StableStudio fallback ─────────────────────────────────────────────────────
  stablestudio: { prompt: 'a serene mountain lake at sunset, photorealistic' },

  // ── Browserbase fallback ─────────────────────────────────────────────────────
  browserbase: { query: 'stellar blockchain usdc payments' },

  // ── Modal fallback ────────────────────────────────────────────────────────────
  modal: { timeout: 300 },

  // ── moltycash fallback ────────────────────────────────────────────────────────
  moltycash: { task: 'Post about Argens', reward: 1 },

  // ── Oxylabs ──────────────────────────────────────────────────────────────────
  oxylabs: { url: 'https://example.com' },

  // ── Suno fallback ─────────────────────────────────────────────────────────────
  suno: { prompt: 'An upbeat electronic track about autonomous AI agents', title: 'Agent Anthem', tags: 'electronic, upbeat' },

  // ── Tako fallback ─────────────────────────────────────────────────────────────
  tako: { query: 'bitcoin price 2024' },

  // ── Replicate fallback ────────────────────────────────────────────────────────
  replicate: { model_owner: 'stability-ai', model_name: 'stable-diffusion', input: { prompt: 'a mountain lake at sunset' } },

  // ── Storage ───────────────────────────────────────────────────────────────────
  storage: { action: 'start', key: 'test.txt', content_type: 'text/plain', size: 12 },

  // ── Pinata ────────────────────────────────────────────────────────────────────
  pinata: { cid: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco' },

  // ── Doma ─────────────────────────────────────────────────────────────────────
  doma: { domain: 'test-probe-argens-99999.com' },

  // ── BuildWithLocus ────────────────────────────────────────────────────────────
  buildwithlocus: { email: 'probe@example.com', tempoAddress: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGZXM' },

  // ── KicksDB ──────────────────────────────────────────────────────────────────
  kicksdb: { styleIds: ['Nike-Air-Jordan-1-Retro-High-OG-Black-White-2019'] },

  // ── twocaptcha alias ─────────────────────────────────────────────────────────
  twocaptcha: { task: { type: 'ImageToTextTask', body: 'R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' } },

  // ── AutoExchange ─────────────────────────────────────────────────────────────
  autoexchange: { id: 'placeholder-agent-id', input: 'What is 2 + 2?' },

  // ── PostalForm ────────────────────────────────────────────────────────────────
  postalform: { message: 'Hello from an AI agent!', to_address: { name: 'Test', address_line1: '123 Main St', city: 'New York', state: 'NY', zip: '10001', country: 'US' } },

  // ── StableUpload ─────────────────────────────────────────────────────────────
  stableupload: { filename: 'test.txt', content_type: 'text/plain', size: 100 },

  // ── StablePhone fallback (will be above price ceiling anyway) ────────────────
  stablephone: { to: '+14155552671', task: 'Say hello and hang up' },

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

/**
 * Endpoint-specific query params (sent as ?key=value in the MPP Router URL).
 * These are path placeholders that MPP Router substitutes into the upstream URL.
 * The dashboard pre-fills its "Path parameters" box from this map.
 */
export const ENDPOINT_QUERY_PARAMS: Record<string, Record<string, string>> = {
  // ── QuickNode ────────────────────────────────────────────────────────────────
  quicknode_session_network: { network: 'eth-mainnet' },

  // ── Conduit ──────────────────────────────────────────────────────────────────
  conduit_network: { network: 'conduit-mainnet' },

  // ── Alchemy ──────────────────────────────────────────────────────────────────
  alchemy_network_nft_v3_endpoint: { network: 'eth-mainnet', endpoint: 'getNFTsForOwner' },

  // ── fal.ai dynamic model routes ──────────────────────────────────────────────
  fal_model: { model: 'fal-ai/flux/dev' },
  fal_namespace_model: { namespace: 'fal-ai', model: 'flux/dev' },

  // ── Gemini file upload ────────────────────────────────────────────────────────
  gemini_version_files: { version: 'v1beta' },

  // ── moltycash tip-by-username ────────────────────────────────────────────────
  moltycash_username_a2a: { username: 'argensonline' },

  // ── AutoExchange agent run ────────────────────────────────────────────────────
  autoexchange_agents_id_run: { id: 'placeholder-agent-id' },

  // ── Allium async query by id ──────────────────────────────────────────────────
  'allium_explorer_queries_query_id_run-async': { query_id: 'placeholder-query-id' },

  // ── Browserbase session extend ────────────────────────────────────────────────
  'browserbase_browser_session_id_extend': { id: 'placeholder-session-id' },
}

/** Returns example query params for a path-placeholder endpoint, or null. */
export function exampleQueryFor(endpointId: string): Record<string, string> | null {
  const hit = ENDPOINT_QUERY_PARAMS[endpointId] ?? null
  return hit ? { ...hit } : null
}
