# Marketplace Catalog Test — Action Items (2026-06-17)

Source: `tasks/marketplace-catalog-report.md` (live run, enabled-only, deployed API).
Spend: wallet dropped **$0.2050510** total — $0.0168 to 2 real successes, **~$0.1883 to paid-but-failed calls that delivered nothing** (the silent-loss case).

> ⚠️ **Deploy caveat:** this run hit the **deployed prod API, which runs the OLD code.** Track A (kill-switch) and Track B (refund flag + ops-alert email) were NOT active for this run — so the ~$0.188 was not auto-flagged in the DB and no alert fired. **This report is the manual record.** After deploying the new code, the kill-switch list below must be applied on prod, and future failures will auto-flag.

## 1. Globally disable now — broken at the PAYMENT layer (body can't fix)

`verification-failed` ("memo not bound"), upstream 504, or MPP channel not installed. Pause platform-wide:

`alchemy, anthropic, exa, fal, firecrawl, gemini, googlemaps, kicksdb, modal, openai, openrouter, oxylabs, storage, tempo, twocaptcha, doma`

(doma = MPP "split total must be less than total amount" — an Argens/MPP charge-config bug, not a payload issue.)

## 2. Author example + RETEST before deciding — charged then merchant-rejected the body

These pulled payment but the merchant rejected the (empty) request body with a 400/422 validation error. A correct payload may make them work:

`allium, stableemail, stableenrich, stablephone, stablesocial, tako`

## 3. Reachable, just needed a payload — examples now authored (Track C)

55 returned `NOT_MPP` (no charge). Examples authored in `marketplace-examples.ts` for the ~40 whose required field was documented in the error. Retest these with the new examples; expect many to move to SUCCESS:

`abstract-* (10), alphavantage, apollo, billboard, brave, builtwith, clado, codex, coingecko, deepl, deepseek, diffbot, diffbot-kg, diffbot-nl, edgar, edgar-search, govlaws, grok, groq, hunter, ipinfo, mathpix, openweather, rentcast, screenshotone, stability-ai, stripe-climate, tavily, wolframalpha`

Not authored (need `query` placeholder, stateful token, or Argens-side config — handle separately):
`autoexchange (?id=), conduit (?network=), quicknode (?network=), stabletravel (?id=), judge0 (token), suno (taskId), pinata (rate-limited), megapot, moltycash/nansen (402 w/o WWW-Authenticate), rozo-agent-api (quote), buildwithlocus (tempoAddress)`

## 4. Confirmed working (keep enabled)

`browserbase` ($0.012), `deepgram` ($0.0048) — both succeeded with an empty body.

## 5. Not failures — policy/approval outcomes (provider is reachable)

These were caught by the test account's own policy, not a provider bug:
- `POLICY_BLOCKED`: martin-estate, postalform, stablestudio, stableupload
- `pending_approval`: parallel

## 6. Skipped by design

- `SKIPPED_PRICE` (≥ $0.50): codestorage ($1.00)
- `SKIPPED_SETUP`: agentmail (mandatory paid inbox setup)

## Refund reconciliation

The ~$0.1883 left the test wallet (`bldn.inc@gmail.com`) across the section-1/section-2 calls. Because the deployed API was old code, these are recorded `FAILED` in prod **without** the `metadata.refund.required` flag. Reconcile manually (or re-run after deploy so the flag + alert fire), and check with MPP Router whether the `verification-failed` charges were actually captured on their side.
