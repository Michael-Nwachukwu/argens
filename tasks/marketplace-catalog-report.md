# Marketplace Catalog Test Report

Generated: 2026-06-17T20:10:06.494Z
Mode: LIVE
Total spent: $0.0168000 USDC (cap $2.00)

## Summary

| Status | Count |
|---|---|
| ✓ SUCCESS | 2 |
| ⚠ UPSTREAM_FAILED (paid, refund flagged) | 22 |
| NOT_MPP (no charge, bad payload) | 55 |
| PAUSED | 0 |
| SKIPPED_PRICE (>= $0.50) | 1 |
| SKIPPED_SETUP | 1 |
| SKIPPED_BUDGET | 0 |
| SKIPPED_DISABLED (not enabled in dashboard) | 0 |
| ERROR | 5 |

**Providers to globally disable (paid but failed):** alchemy, allium, anthropic, doma, exa, fal, firecrawl, gemini, googlemaps, kicksdb, modal, openai, openrouter, oxylabs, stableemail, stableenrich, stablephone, stablesocial, storage, tako, tempo, twocaptcha

**Providers needing a corrected example payload (NOT_MPP):** abstract-company-enrichment, abstract-email-reputation, abstract-exchange-rates, abstract-holidays, abstract-iban-validation, abstract-ip-intelligence, abstract-phone-intelligence, abstract-timezone, abstract-vat, abstract-web-scraping, alphavantage, apollo, autoexchange, billboard, brave, buildwithlocus, builtwith, clado, codex, coingecko, conduit, deepl, deepseek, diffbot, diffbot-kg, diffbot-nl, edgar, edgar-search, govlaws, grok, groq, hunter, ipinfo, judge0, mapbox, mathpix, megapot, mistral, moltycash, nansen, openweather, papercut, perplexity, pinata, quicknode, rentcast, replicate, rozo-agent-api, screenshotone, stability-ai, stabletravel, stripe-climate, suno, tavily, wolframalpha

**Working providers (author examples + keep enabled):** browserbase, deepgram

## Results

| Provider | Endpoint | Price | Status | Cost | HTTP | Code | Tx | Upstream snippet |
|---|---|---|---|---|---|---|---|---|
| abstract-company-enrichment | abstract-company-enrichment_abstract-company-enrichment_lookup | $0.006/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"domain is required"} |
| abstract-email-reputation | abstract-email-reputation_abstract-email-reputation_check | $0.006/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"email is required"} |
| abstract-exchange-rates | abstract-exchange-rates_abstract-exchange-rates_live | $0.006/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"base is required"} |
| abstract-holidays | abstract-holidays_abstract-holidays_lookup | $0.006/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"country is required"} |
| abstract-iban-validation | abstract-iban-validation_abstract-iban-validation_validate | $0.006/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"iban is required"} |
| abstract-ip-intelligence | abstract-ip-intelligence_abstract-ip-intelligence_lookup | $0.006/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"ip_address is required"} |
| abstract-phone-intelligence | abstract-phone-intelligence_abstract-phone-intelligence_lookup | $0.006/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"phone is required"} |
| abstract-timezone | abstract-timezone_abstract-timezone_current-time | $0.006/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"location is required"} |
| abstract-vat | abstract-vat_abstract-vat_validate | $0.006/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"vat_number is required"} |
| abstract-web-scraping | abstract-web-scraping_abstract-web-scraping_scrape | $0.006/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"url is required"} |
| agentmail | agentmail_inboxes_inbox_id_messages_send | $0.010/request | SKIPPED_SETUP |  |  |  |  | requires mandatory paid setup |
| alchemy | alchemy_rpc | $0.000/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqihu6y00073ta2vn303vy56 | {"error":"Merchant payment failed","status":504,"detail":"<!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[ |
| allium | allium_explorer_queries_run-async | $0.010/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqihwd8i0075ta2vkpbos15l | {"error":"Merchant payment failed","status":422,"detail":"{\"detail\":[{\"type\":\"missing\",\"loc\":[\"body\",\"parameters\"],\"msg\":\"Field required\",\"inpu |
| alphavantage | alphavantage_alphavantage_time-series-intraday | $0.008/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"symbol is required"} |
| anthropic | anthropic_chat_completions | free | UPSTREAM_FAILED ⚠refund |  | 503 | MARKETPLACE_SERVICE_UNAVAILABLE | cmqihwppu0077ta2vqrfgcx3d | This marketplace service is temporarily unavailable due to a provider configuration issue on Argens's side. Your request was valid — contact support@argens.xyz  |
| apollo | apollo_apollo_people-enrichment | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"At least one identifier is required: email, linkedin_url, id, first_name+last_name, or organization_name/domain"} |
| autoexchange | autoexchange_agents_id_run | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Bad upstream path placeholder","detail":"Route autoexchange_agents_id_run requires {id} placeholder but no value was supplied (no ?id= query param and |
| billboard | billboard_billboard_post | $0.010/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"text is required"} |
| brave | brave_brave_web-search | $0.035/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"q is required"} |
| browserbase | browserbase_browser_session_create | free | SUCCESS | 0.0120000 | 200 |  | cmqihwznl0079ta2v1ji4qwe3 | {"sessionId":"session_f324109d-e6ac-4e51-8e51-63fd6e048c0a","connectUrl":"wss://connect.usw2.browserbase.com/?signingKey=eyJhbGciOiJBMjU2S1ciLCJlbmMiOiJBMjU2R0N |
| buildwithlocus | buildwithlocus_auth_mpp-sign-up | $0.000/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"tempoAddress is required when signup is free","code":"MPP_TEMPO_ADDRESS_REQUIRED"} |
| builtwith | builtwith_builtwith_free | $0.015/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"LOOKUP is required"} |
| clado | clado_clado_search | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"query is required (or search_id for pagination)"} |
| codestorage | codestorage_repos | $1.000/request | SKIPPED_PRICE |  |  |  |  | cheapest endpoint priced $1.000/request |
| codex | codex_graphql | $0.001/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"type":"https://ietf.org/payment/problems/invalid-request","title":"Invalid Request","status":400,"detail":"GraphQL request must include a query string"} |
| coingecko | coingecko_coingecko_simple-price | $0.060/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"ids is required"} |
| conduit | conduit_network | $0.000/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Bad upstream path placeholder","detail":"Route conduit_network requires {network} placeholder but no value was supplied (no ?network= query param and  |
| deepgram | deepgram_deepgram_list-models | $0.004/request | SUCCESS | 0.0048000 | 200 |  | cmqihyyl7007bta2v9lzt9q15 | {"success":true,"data":{"stt":[{"name":"conversationalai","canonical_name":"conversationalai","architecture":"base","languages":["en","en-US"],"version":"2021-1 |
| deepl | deepl_deepl_translate | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"text is required"} |
| deepseek | deepseek_deepseek_chat | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"model is required"} |
| diffbot | diffbot_diffbot_article | $0.004/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"url is required"} |
| diffbot-kg | diffbot-kg_diffbot-kg_search | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"query is required"} |
| diffbot-nl | diffbot-nl_diffbot-nl_analyze | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"content is required"} |
| doma | doma_register | free | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii10my007dta2vwjmvssvo | {"error":"Merchant payment failed","detail":"Invalid charge request: split total must be less than total amount."} |
| edgar | edgar_edgar_company-submissions | $0.008/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"cik is required"} |
| edgar-search | edgar-search_edgar-search_search | $0.008/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"q is required"} |
| exa | exa_search | $0.005/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii2n8f007fta2vn1ccguci | {"error":"Merchant payment failed","status":402,"detail":"{\"type\":\"https://paymentauth.org/problems/verification-failed\",\"title\":\"Verification Failed\",\ |
| fal | fal_flux_schnell | $0.003/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii2tp9007hta2vnidlkhmv | {"error":"Merchant payment failed","status":402,"detail":"{\"type\":\"https://paymentauth.org/problems/verification-failed\",\"title\":\"Verification Failed\",\ |
| firecrawl | firecrawl_scrape | $0.002/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii32tt007jta2v0wlhbtrf | {"error":"Merchant payment failed","status":402,"detail":"{\"type\":\"https://paymentauth.org/problems/verification-failed\",\"title\":\"Verification Failed\",\ |
| gemini | gemini_generate | $0.000/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii3bxe007lta2v1el9kyfv | {"error":"Merchant payment failed","status":402,"detail":"{\"type\":\"https://paymentauth.org/problems/verification-failed\",\"title\":\"Verification Failed\",\ |
| googlemaps | googlemaps_places_v1_placesautocomplete | $0.002/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii3ky4007nta2vkstn7yip | {"error":"Merchant payment failed","status":402,"detail":"{\"type\":\"https://paymentauth.org/problems/verification-failed\",\"title\":\"Verification Failed\",\ |
| govlaws | govlaws_mpp_search | $0.030/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"invalid_query","message":"query must be a non-empty string of at least 3 characters"} |
| grok | grok_grok_chat | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"model is required"} |
| groq | groq_groq_chat | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"model is required"} |
| hunter | hunter_hunter_domain-search | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"domain or company is required"} |
| ipinfo | ipinfo_ipinfo_ip-lite | $0.001/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"ip is required"} |
| judge0 | judge0_judge0_get-submission | $0.005/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"token is required"} |
| kicksdb | kicksdb_stockx_prices | $0.000/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii413t007pta2v4s052dyr | {"error":"Merchant payment failed","status":402,"detail":"{\"type\":\"https://paymentauth.org/problems/verification-failed\",\"title\":\"Verification Failed\",\ |
| mapbox | mapbox_mapbox_matrix | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"profile is required"} |
| martin-estate | martin-estate_purchase | free | ERROR |  | 402 | POLICY_BLOCKED | cmqii5qr8007rta2vut05td16 | Marketplace call blocked by policy |
| mathpix | mathpix_mathpix_process-image | $0.005/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"src is required"} |
| megapot | megapot_status | $0.000/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request body","message":"OpenAPI request validation failed: body.ticketIds is required"} |
| mistral | mistral_mistral_chat | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"model is required"} |
| modal | modal_sandbox_create | free | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii5wfd007tta2vjpvui1sd | {"error":"Merchant payment failed","status":402,"detail":"{\"type\":\"https://paymentauth.org/problems/verification-failed\",\"title\":\"Verification Failed\",\ |
| moltycash | moltycash_a2a | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Merchant returned 402 without WWW-Authenticate header"} |
| nansen | nansen_smart-money_historical-holdings | $0.010/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Merchant returned 402 without WWW-Authenticate header"} |
| openai | openai_responses | free | UPSTREAM_FAILED ⚠refund |  | 503 | MARKETPLACE_SERVICE_UNAVAILABLE | cmqii64xq007vta2v68r1s0ff | This marketplace service is temporarily unavailable due to a provider configuration issue on Argens's side. Your request was valid — contact support@argens.xyz  |
| openrouter | openrouter_chat | free | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii6b7p007xta2v3ljh8i19 | {"error":"Merchant payment failed","status":402,"detail":"{\"type\":\"https://paymentauth.org/problems/verification-failed\",\"title\":\"Verification Failed\",\ |
| openweather | openweather_openweather_geocode | $0.005/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"q is required"} |
| oxylabs | oxylabs_proxy | free | UPSTREAM_FAILED ⚠refund |  | 503 | MARKETPLACE_SERVICE_UNAVAILABLE | cmqii6obe007zta2vcxmnk67g | This marketplace service is temporarily unavailable due to a provider configuration issue on Argens's side. Your request was valid — contact support@argens.xyz  |
| papercut | papercut_send | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"github_username is required"} |
| parallel | parallel_task | free | ERROR |  | 202 |  |  | {"data":{"status":"pending_approval","transaction_id":"cmqii6vlo0081ta2vil53rvvs","message":"Awaiting developer approval.","poll_url":"/v1/transactions/cmqii6vl |
| perplexity | perplexity_perplexity_chat | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"model is required"} |
| pinata | pinata_pin_public | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":{"code":429,"message":"Too many requests. Please reach out to pinata support for assistance"}} |
| postalform | postalform_machine_mpp_orders | free | ERROR |  | 402 | POLICY_BLOCKED | cmqii6zlh0084ta2vspsok15s | Marketplace call blocked by policy |
| quicknode | quicknode_session_network | $0.000/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Bad upstream path placeholder","detail":"Route quicknode_session_network requires {network} placeholder but no value was supplied (no ?network= query  |
| rentcast | rentcast_rentcast_properties | $0.033/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"At least one location parameter is required: address, city, state, zipCode, latitude, or longitude"} |
| replicate | replicate_replicate_run | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"model_owner is required"} |
| rozo-agent-api | rozo-agent-api_pay-invoice | $0.010/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"code":"QUOTE_UNAVAILABLE","error":"Cannot derive exact invoice amount for pay-invoice route","message":"Router refuses fallback quote to avoid undercharging.  |
| screenshotone | screenshotone_screenshotone_take | $0.055/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"One of url, html, or markdown is required"} |
| stability-ai | stability-ai_stability-ai_generate-sd3 | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"prompt is required"} |
| stableemail | stableemail_subdomain_inbox_messages | $0.001/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii77sb0086ta2vjyhltcag | {"error":"Merchant payment failed","status":400,"detail":"{\"success\":false,\"error\":\"Validation failed\",\"issues\":[{\"expected\":\"string\",\"code\":\"inv |
| stableenrich | stableenrich_exa_contents | $0.002/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii7gsk0088ta2vhh2tjajd | {"error":"Merchant payment failed","status":400,"detail":"{\"success\":false,\"error\":\"Validation failed\",\"issues\":[{\"code\":\"custom\",\"path\":[\"urls\" |
| stablephone | stablephone_lookup | $0.050/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii7pyd008ata2vz2ni95zj | {"error":"Merchant payment failed","status":400,"detail":"{\"success\":false,\"error\":\"Validation failed\",\"issues\":[{\"expected\":\"string\",\"code\":\"inv |
| stablesocial | stablesocial_tiktok_profile | $0.060/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii7xy8008cta2vc10lq6bg | {"error":"Merchant payment failed","status":400,"detail":"{\"success\":false,\"error\":\"Validation failed\",\"issues\":[{\"expected\":\"string\",\"code\":\"inv |
| stablestudio | stablestudio_generate_nano-banana-pro_generate | free | ERROR |  | 402 | POLICY_BLOCKED | cmqii86v6008eta2vbxnnu5ce | Marketplace call blocked by policy |
| stabletravel | stabletravel_flightaware_flights_id_intents | $0.001/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Bad upstream path placeholder","detail":"Route stabletravel_flightaware_flights_id_intents requires {id} placeholder but no value was supplied (no ?id |
| stableupload | stableupload_upload | free | ERROR |  | 402 | POLICY_BLOCKED | cmqii88v8008gta2vn8vd1qbz | Marketplace call blocked by policy |
| storage | storage_upload | $0.000/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii89y0008ita2veo0j0twz | {"error":"Merchant payment failed","status":402,"detail":"{\"type\":\"https://paymentauth.org/problems/verification-failed\",\"title\":\"Verification Failed\",\ |
| stripe-climate | stripe-climate_contribute | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"amount must be an integer between 1 and 10000 (cents)"} |
| suno | suno_suno_get-music-status | $0.005/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"taskId is required"} |
| tako | tako_mpp_v1_thinviz_create | $0.010/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii8k5x008kta2vhv1wj3sr | {"error":"Merchant payment failed","status":400,"detail":"{\"error\":\"1 validation error for CreateCardRequest\\ncomponents\\n Field required [type=missing, in |
| tavily | tavily_tavily_search | free | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"query is required"} |
| tempo | tempo_rpc | $0.001/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii8s19008mta2vtwdum79c | {"error":"Merchant payment failed","status":402,"detail":"{\"type\":\"https://paymentauth.org/problems/verification-failed\",\"title\":\"Verification Failed\",\ |
| twocaptcha | twocaptcha_createtask | $0.003/request | UPSTREAM_FAILED ⚠refund |  | 502 | MARKETPLACE_UPSTREAM_FAILED | cmqii8z9i008ota2vyq19iy4a | {"error":"Merchant payment failed","status":402,"detail":"{\"type\":\"https://paymentauth.org/problems/verification-failed\",\"title\":\"Verification Failed\",\ |
| wolframalpha | wolframalpha_wolframalpha_short-answer | $0.055/request | NOT_MPP |  | 502 | MARKETPLACE_NOT_MPP |  | {"error":"Invalid request","message":"i is required"} |
