# MPP Router Full Catalog Probe — Analysis
Generated: 2026-06-22
Probe cost: ~$0.17 USDC (wallet depleted after 16 successful calls)

---

## Summary

| Category | Providers | Endpoints |
|---|---|---|
| ✓ Confirmed working (x402 v2 paid) | 8 (+ 3 skip-listed) | 16 confirmed |
| ✗ Route does not exist (404 / unknown-route) | — | 7 dead routes |
| ✗ Incompatible auth (not x402 / session model) | 6 | ~50+ |
| ⚠ Balance-depleted — need top-up to verify | ~35 | ~200 |
| ⚠ Bad payload — 400 errors, now fixed in examples | ~25 | ~125 |

**WALLET NEEDS ~$5 USDC TOP-UP** to re-test the balance-depleted block.

---

## Confirmed Working Providers

These completed x402 v2 payment + returned valid upstream response:

| Provider | Endpoints confirmed | Cost each |
|---|---|---|
| **exa** | search, contents, findsimilar, answer | $0.005–$0.010 |
| **fal** | flux_dev, flux_schnell, flux-pro_v1_1, flux-pro_v1_1-ultra, fast-sdxl | $0.003–$0.060 |
| **browserbase** | session_create (free), search | $0.000–$0.010 |
| **buildwithlocus** | billing_mpp-top-up (free) | $0.000 |
| **modal** | sandbox_create (free) | $0.000 |
| **storage** | upload | $0.000 |
| **twocaptcha** | createtask | $0.003 |
| **deepl** | languages | $0.005 |

Previously skip-listed (confirmed working in prior session):
- **deepgram** — all 4 endpoints
- **deepseek** — all 3 endpoints  
- **firecrawl** — multiple endpoints

---

## Dead Routes (404 / Unknown Service Route)

These routes return 404 or "Unknown public service route" — catalog shows them but MPP Router doesn't serve them. Payload does not help.

| Endpoint ID | Error |
|---|---|
| `stableenrich_clado_linkedin-scrape` | HTTP 404 |
| `stablestudio_generate_gpt-image-1_generate` | HTTP 404 (not deployed on MPP) |
| `stablestudio_generate_gpt-image-1_edit` | HTTP 404 (not deployed on MPP) |
| `tako_mpp_v1_search_fast` | HTTP 404 |
| `quicknode_network` | "Unknown public service route" |
| `coingecko_coingecko_simple-price` | "Unknown public service route" |
| `groq_groq_chat` | "Unknown public service route" |

**Action:** Remove or hide these 7 endpoints from Argens catalog. Flag to MPP Router as catalog/route mismatch.

---

## Incompatible Auth Model (Not Fixable)

These providers use a session model that is incompatible with x402 v2 Stellar payments. No payload fix helps.

| Provider | Error | Endpoints |
|---|---|---|
| **nansen** | No `WWW-Authenticate` header on 402 — different session auth | ~40 endpoints |
| **openrouter** | Deposit model (requires pre-loaded balance like anthropic/openai) | 1 |
| **gemini** | TIP-1034 session required ("descriptor required for TIP-1034 session action") | 2 |
| **tempo** | TIP-1034 session required | 1 |
| **oxylabs** | "No Tempo channel installed" | 1 |
| **moltycash** | Different auth model on username-tip endpoint | 1 |

**Action:** Global kill-switch these 6 providers in Ops Console until MPP Router resolves their x402 compatibility. They are currently visible to users but always fail.

---

## Balance-Depleted — Need Re-Test After Top-Up

~200 endpoints got `HostError: Error(Contract, #10)` (Soroban USDC InsufficientBalance) because wallet ran dry at $0.0001804 after ~$0.17 in successful calls. These endpoints may work fine — we just couldn't test them.

Providers in this block include:
- stablesocial (30+ TikTok/Instagram/Facebook/Reddit endpoints)
- stablestudio (all image/video gen: nano-banana, grok, seedance, wan, sora-2, veo-3)
- stableenrich (apollo, google-maps, serper, reddit, hunter, diffbot endpoints)
- alphavantage (all 26 endpoints — though payloads also needed fixing)
- abstract-* (all Abstract API family: email, IP, phone, timezone, VAT, web-scraping)
- coingecko (most endpoints — payloads also needed fixing)
- clado (linkedin profile/scrape endpoints)
- diffbot, diffbot-kg
- govlaws, billboard
- alchemy (NFT endpoint), conduit (network RPC), quicknode (session RPC)
- tavily (search), perplexity (search), openweather
- screenshotone, wolframalpha, rentcast
- replicate, tako, suno (all need balance)
- stability-ai (text-to-image endpoint — image manipulation ones need base64 image)
- stripe-climate, papercut

**To re-test:** Top up probe wallet `GDCO2AKYBSLN34OFHAVUKCN3WIF6YEPMQOTEXM672HE7R3HD6LB67K4H` with $5–10 USDC and re-run `catalog-full-probe.ts` skipping all already-confirmed providers.

---

## Payload Fixes Applied (HTTP 400 → now fixed in marketplace-examples.ts)

These endpoints reached the upstream (payment was either free or pre-validated by MPP Router), returned 400 with a clear required-field error, and have now been fixed in `marketplace-examples.ts`:

### New or corrected endpoint examples
| Endpoint | Fix |
|---|---|
| alphavantage_symbol-search | Added `keywords` |
| alphavantage_earnings-call-transcript | Added `quarter`, `year` |
| alphavantage_currency-exchange-rate | Added `from_currency`, `to_currency` |
| alphavantage_fx-daily | Added `from_symbol`, `to_symbol` |
| alphavantage_crypto-exchange-rate | Added `from_currency`, `to_currency` |
| alphavantage_digital-currency-daily | Added `market` |
| alphavantage_economic-indicator | Added `indicator` |
| alphavantage_sma/ema/rsi/bbands | Added `time_period` |
| alphavantage_macd | Added `series_type` |
| apollo_bulk-people-enrichment | Changed to `details` array |
| apollo_bulk-org-enrichment | Changed to `domains` array |
| apollo_people-search | Added `q_keywords` |
| apollo_org-search | Added `q_keywords` |
| apollo_job-postings | Added `organization_id` |
| apollo_news-search | Added `organization_ids` |
| brave_answers | Added `messages` array |
| builtwith_lists | Added `TECH` |
| builtwith_company-to-url | Added `COMPANY` |
| builtwith_product | Added `QUERY` |
| builtwith_trends | Added `TECH` |
| clado (all 9 endpoints) | LinkedIn URLs, jobId fields |
| coingecko_simple-token-price | Added `platform_id` |
| coingecko_coins-markets | Added `vs_currency` |
| coingecko_coin-data | Added `id` |
| coingecko_search | Added `query` |
| coingecko_market-chart | Added `id`, `vs_currency`, `days` |
| coingecko_coin-history | Added `id`, `date` |
| coingecko_top-gainers-losers | Added `vs_currency` |
| diffbot-kg_enhance | Added `type` |
| edgar_company-concept | Added `taxonomy`, `tag` |
| abstract-exchange-rates_convert | Fixed to `target` (was `from_currency`) |
| abstract-exchange-rates_historical | Added `date` |
| grok_image-generate | Added `prompt` |
| grok_image-edit | Added `prompt`, `image_url` |
| grok_tts | Added `text` |
| hunter_email-finder | Fixed to `first_name`+`last_name`+`domain` |
| hunter_email-verifier | Fixed to `email` |
| hunter_email-enrichment | Fixed to `email` |
| hunter_combined-enrichment | Fixed to `email` |
| mapbox_directions/matrix/isochrone/map-matching | Fixed profile to `mapbox/driving` |
| mapbox_static-image | Fixed to use `position` object |
| mapbox_tilequery | Fixed field name to `tileset_id` |
| martin-estate_purchase | Added `email`, `shipping` |
| mathpix_process-strokes | Added `strokes` |
| megapot_status | Fixed to `ticketIds` array |
| mistral_embed | Changed to `input` array |
| mistral_moderate | Changed to `input` array |
| openweather (all 6 endpoints) | Changed `q` to `lat`+`lon` |
| perplexity_search | Changed to `query` |
| perplexity_embed | Changed to `input` |
| perplexity_context-embed | Added `document` |
| rentcast_property-by-id | Added `id` |
| rentcast_value-estimate | Changed to `address` |
| rentcast_rent-estimate | Changed to `address`, added bedrooms etc |
| rentcast_sale/rental-listing-by-id | Added `id` |
| rentcast_markets | Added `zipCode` |
| replicate_run | Fixed from `version` to `model_owner`+`model_name` |
| replicate_get-prediction | Fixed to `prediction_id` |
| suno_generate-music | Added `customMode: true` |
| suno_get-music-status | Fixed to `taskId` |
| suno_get-lyrics-status | Fixed to `taskId` |
| stableenrich_exa_contents | Fixed to `urls` array |
| tavily_extract | Added `urls` array |
| tavily_map | Added `url` |
| tavily_crawl | Added `url` |
| abstract-timezone_convert-time | Added `base_location` |
| abstract-vat_calculate | Added `amount`, `country_code` |
| abstract-vat_categories | Added `country_code` |
| wolframalpha_full-results | Added `input` |
| papercut_send | Added `github_username` |
| doma_register | Added `contact` object |
| browserbase_session_id_extend | Fixed from `session_id` to `id` |
| megapot_status | Fixed to `ticketIds` array |
| autoexchange_agents_id_run | Fixed to `id` (path placeholder) |

### Provider fallback examples updated
- abstract-exchange-rates: added `target`
- apollo: changed to `q_keywords`
- coingecko: changed to `vs_currency`
- diffbot-kg: changed to `type`+`name`
- edgar: added `taxonomy`, `tag`
- openweather: changed `q` to `lat`+`lon`
- rentcast: changed to `address`
- replicate: changed from `version` to `model_owner`+`model_name`
- perplexity: changed to `query`

---

## Next Steps

1. **Top up wallet** with $5–10 USDC to re-test ~200 balance-depleted endpoints
2. **Global kill-switch** nansen, openrouter, gemini, tempo, oxylabs in Ops Console
3. **Remove dead routes** from catalog display: stablestudio gpt-image-1, tako search_fast, quicknode_network, coingecko_simple-price, groq_chat
4. **Escalate to MPP Router**: stablestudio gpt-image-1 routes in catalog but 404; tako search_fast 404; groq chat unknown route; coingecko simple-price route mismatch
5. **Deploy updated marketplace-examples.ts** to fix payload display in dashboard + skill files
