## Task: Async-only marketplace endpoint guard (Track A / #29)
**Goal:** Reject async-only marketplace endpoints with a clear pre-payment `400 MARKETPLACE_ENDPOINT_REQUIRES_SESSION` before any wallet/credit/policy work, so agents never hit the opaque post-challenge upstream 401.
**Files affected:** `apps/api/src/services/marketplace-async.ts`, `apps/api/src/services/marketplace-async.test.ts`, `apps/api/src/services/marketplace.ts`, `apps/web/public/SKILL.md`, `tasks/decisions.md`.
**Guard shape (decided):** Hardcoded id set (`firecrawl_crawl`, `firecrawl_extract`) + `stablestudio_generate_` prefix. Not catalog-driven. See `tasks/decisions.md` 2026-07-31.
**Steps:**
- [x] Export pure `isAsyncOnlyEndpoint(serviceId)` + sync alternatives map (`marketplace-async.ts`)
- [x] Call guard in `executeMarketplaceCallInternal` immediately after service lookup, before wallet/credit/policy
- [x] Error: `400 MARKETPLACE_ENDPOINT_REQUIRES_SESSION` with `alternative` when one exists (`firecrawl_scrape`)
- [x] Confirm charge stays gated behind `onChallenge` in `mpp-client.ts` (no funds at risk even without guard)
- [x] Unit test: blocks async ids; passes every sync sibling (54/54 suite green)
- [x] Document error code in provider skill markdown + SKILL.md v8
- [x] Mark decisions.md UPDATE note that Track A is shipped
**Risks:** Over-blocking a future sync endpoint that starts with `stablestudio_generate_` — accept per decision. Under-blocking if MPP adds new async ids outside the set/prefix — escalate with #23.
**Done when:** Unit tests pass; calling an async id throws before wallet decrypt; sync siblings are not gated.
**Status:** DONE 2026-08-13. Track B remains blocked on #23.
