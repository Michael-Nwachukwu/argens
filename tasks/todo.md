# Current Task

> Last updated: 2026-08-12
> Active: GitHub #30 — surface marketplace `mpp_router.upstream_body` in dashboard + ops console.

---

## Active 2026-08-12 — Issue #30: marketplace upstream error in UI

**Goal:** When a marketplace call fails, show `metadata.mpp_router` (upstream status/body, payment settled, progress, copyable diagnostic JSON) in the dashboard expand drawer and ops console Failed tab — no API data-capture changes.
**Files affected:** `apps/web/lib/mpp-diagnostics.ts` (new), `apps/web/lib/api.ts`, `apps/web/app/dashboard/transactions/page.tsx`, `apps/web/app/x/console-a3f9k2p7/page.tsx`, `tasks/todo.md`.
**Steps:**
- [x] Shared helpers: parse `mpp_router`, format object/string/HTML `upstream_body`, payment-settled copy, diagnostic blob (`apps/web/lib/mpp-diagnostics.ts`)
- [x] A1: on expand, `txApi.get(id)` + cache; render known fields immediately; slot upstream detail when ready
- [x] B: Upstream error block only when `FAILED` + `mpp_router` present (status, body, settled, progress, Copy diagnostic JSON)
- [x] C: widen ops console metadata type; show upstream body under Reason; signature counts bonus
- [x] Lint clean on changed files; README ops note updated
**Risks:** Detail endpoint is snake_case — do not treat `get()` as list-shaped camelCase. Do not render empty upstream section for non-marketplace failures.
**Done when:** Acceptance criteria in #30 are met; CCTP/direct failures unchanged.
**Note:** Local `node_modules` absent — could not run `tsc`/`next build` here; IDE lints on touched files are clean.

---

## Active 2026-06-16 — CCTP fee-after-burn + approve hardening

**Goal:** A failed cross-chain burn must never cost the user a fee; harden the fragile Soroban approve; lower CCTP fee floor to $0.01; fix stale api.argens.xyz base URLs.
**Root cause (verified on-chain):** approve tx `b460ef…` submitted PENDING but never included (Horizon 404, Soroban RPC NOT_FOUND) — dropped by 100-stroop inclusion fee + 30s validity window. Fee tx `5794a7…` succeeded, so the user lost $0.05 on a transfer that delivered nothing to Base.
**Files affected:** `apps/api/src/services/cctp.ts`, `apps/api/src/routes/transactions.ts`, `apps/web/app/dashboard/api-keys/page.tsx`, `apps/api/src/services/marketplace.ts`, `CLAUDE.md`, `AGENTS.md`.
**Steps:**
- [x] cctp.ts: `CCTP_FEE_MIN` 0.05 → 0.01 (+ docstring, test)
- [x] cctp.ts: harden `approveUsdcSpend` — 0.01 XLM inclusion fee, 60s window, retry once on drop
- [x] transactions.ts: reorder to burn → fee. Burn failure releases reservation + FAILED + "no fee charged". Fee failure after burn is non-fatal (transfer completes; fee logged uncollected)
- [x] approve.ts: identical burn → fee reorder (approval-token CCTP path; no releaseSpend since totalSpent increments in runRelay)
- [x] Fix `api.argens.xyz` → `api.argens.xyz` (api-keys page, marketplace.ts, CLAUDE.md, AGENTS.md)
- [x] Update fee-floor docs: SKILL.md (v6), LandingPage.tsx
- [x] tsc --noEmit clean; 50/50 tests pass
**Risks:** Live mainnet payment path. New non-atomic gap is "burn ok, fee fails" — favors the user (transfer completes, Argens misses the fee). Inclusion-fee bump must stay a sane XLM cost.
**Done when:** check passes; burn-failure path charges no fee and releases reservation; fee floor is $0.01.

---

## Active 2026-06-03 — Credits, CCTP, Admin Hardening

**Goal:** Finish the beta rollout repair cleanly: make admin balances reliable, fail CCTP safely before non-atomic fee/burn execution, notify users when credits are granted, and audit every endpoint touched by credits/CCTP/admin work.
**Files affected:** `apps/api/src/routes/admin.ts`, `apps/api/src/routes/transactions.ts`, `apps/api/src/routes/approve.ts`, `apps/api/src/services/admin-balances.ts`, `apps/api/src/services/cctp.ts`, `apps/api/src/services/credits.ts`, `apps/api/src/services/email.ts`, `apps/web/app/x/console-a3f9k2p7/page.tsx`, docs/status files.
**Steps:**
- [x] Reproduce `/v1/admin/wallets` locally and identify the root cause of Stellar/Base balance failures.
- [x] Fix admin balance fetching/reporting while preserving partial success for wallets that can be read.
- [x] Audit and patch CCTP preflight verification so direct and approval-token paths fail before sending the CCTP fee when `amount + fee` is unavailable or unverifiable.
- [x] Add immediate credit-grant emails with amount/details and a dashboard link for both user-id and email grant endpoints.
- [x] Audit changed endpoints end-to-end: access codes/signup, admin routes, wallet balance/credits, marketplace call/approval credits, `/pay`, `/approve`, transaction details, docs/SKILL discoverability.
- [x] Run focused typechecks/builds and local smoke tests for the changed flows.
- [x] Update status docs with what was verified and any remaining risks.
**Verification:**
- `pnpm --filter @argens/api build` passed.
- `GET /v1/admin/wallets` returned 200 on current code. Ops wallet, fee wallet, and Base relayer balances read successfully; credit-pool wallet is configured but not created/funded on mainnet, so it now reports `Account not found on the active Stellar network.`
- `verifyCctpPreflightBalance(ARGENS_FEE_WALLET, 10.0000000, 0.0500000)` returned `402 INSUFFICIENT_FUNDS_PLUS_FEES` without sending funds.
- `verifyCctpPreflightBalance(ARGENS_CREDIT_POOL_PUBLIC, 0.0100000, 0.0500000)` returned `503 CCTP_PREFLIGHT_UNAVAILABLE` without sending funds.
- Admin route smoke: missing `x-admin-secret` returns `401 UNAUTHORIZED`; `/v1/admin/stats` and `/v1/admin/credit-grants?limit=1` return 200 with expected envelopes.
**Audit notes:** Access-code signup is transactional; admin credit grants are transactional and now notify after commit; wallet balance includes credits and falls back to cached USDC on Horizon outage; marketplace credit path refunds deductions on pre-payment/no-receipt failure paths; direct and approval CCTP paths now share fail-closed preflight; transaction detail/list response shapes include CCTP and approval metadata.
**Remaining risks:** Credit-grant email was typechecked but not sent via a real grant in this pass to avoid mutating user credits. Approval-token CCTP still needs a small live end-to-end payment. Credit-pool wallet must be bootstrapped/funded on mainnet before credit-funded marketplace calls can work.
**Risks:** Mainnet CCTP testing spends real funds; Horizon/Base RPC errors must not be hidden behind generic messages; admin tools must stay private and auditable before production exposure.
**Done when:** Admin balance cards return useful data or precise errors, CCTP preflight fails closed before fee execution, credit grants send user notifications, endpoint audit findings are fixed or documented, and verification commands pass.

---

## Active 2026-05-27 — CCTP + Agent Docs Completion

**Goal:** Finish the CCTP verification loop, document the API clearly for agents/developers, expose per-service skill files, and tighten loose error-handling edges.
**Files affected:** `apps/api/src/routes/*`, `apps/api/src/services/*`, `apps/web/public/SKILL.md`, `apps/web/public/llms.txt`, `apps/web/app/docs/page.tsx`, `tasks/*`, docs/status files.
**Steps:**
- [x] Explain the approval-token CCTP status in plain language.
- [x] Run another small mainnet CCTP burn through the public API-key endpoints and verify both Stellar + Base hashes.
- [x] Ensure `POST /quote`, `POST /pay`, `GET /transactions/:id`, and approval paths return complete CCTP response shapes.
- [x] Update `/SKILL.md` with CCTP, docs, `llms.txt`, and per-service skill discovery.
- [x] Add `GET /marketplace/services/:providerId/skill.md` for agent-readable per-provider service docs.
- [x] Add `/SKILL/<provider>.md` proxy endpoint on the web app for service skill files.
- [x] Create `/docs` with a comprehensive responsive guide and code snippets.
- [x] Add `/llms.txt` so agents can discover Argens docs and skill entry points.
- [x] Audit expected endpoint errors for clean response envelopes and fix obvious loose ends.
- [x] Run API/web builds and focused endpoint smoke tests.
**Verification:** New 0.0100000 USDC CCTP mainnet tx `cmpn8yh5900011uqzobaa94qn` succeeded with Stellar burn `5d889c2691236a068a22d900fd86996862dc9022ab8ea667a51945fb53114044` and Base relay `0xb086f56e0259d9241043d051dc2b2280567c85775997594ff966aad9496bb2ef`. API/web builds passed. Local smoke tests passed for `/v1/marketplace/services/agentmail/skill.md`, `/docs`, `/llms.txt`, and `/SKILL/agentmail.md`.
**Follow-up:** Approval-token CCTP still needs a live pending-approval payment test. The direct path has now been verified twice.
**Risks:** Mainnet CCTP tests spend real USDC/Base gas; MPP Router catalog shape may drift; documentation must not overpromise unverified approval-path behavior.
**Done when:** A new CCTP tx succeeds end-to-end, service skill discovery works, docs build, errors are cleaner, and task/status docs match reality.

---

## Active 2026-05-26 — CCTP Mainnet Repair

**Goal:** Make Stellar → Base CCTP payments work end-to-end from `POST /pay`, including direct-approved and approval-token paths.
**Files affected:** `apps/api/src/services/cctp.ts`, `apps/api/src/routes/transactions.ts`, `apps/api/src/routes/approve.ts`, `apps/api/tsconfig.json`, `apps/web/public/SKILL.md`, task docs if status changes.
**Steps:**
- [x] Fix the API build failure introduced by `viem`/`ox` typings.
- [x] Restart a single clean API dev server on port 3001.
- [x] Verify CCTP contract/API assumptions against official Circle/Stellar docs and installed SDK types.
- [x] Fix Stellar SAC approval + `deposit_for_burn` execution.
- [x] Verify direct `POST /pay` to a Base `0x...` recipient reaches `cross_chain_pending` with a Stellar burn hash.
- [x] Verify Iris attestation + Base relay populates `destinationTxHash` and marks the transaction `SUCCESS`.
- [ ] Verify pending-approval CCTP path does the same after approval.
- [x] Update SKILL/task state to advertise only what is proven.
**Risks:** Mainnet payment testing spends real USDC and Base gas; CCTP/Soroban SDK behavior may differ from docs; duplicate dev servers can make tests hit stale code.
**Done when:** API build passes, exactly one dev server is serving current code, a small mainnet Stellar → Base payment completes burn + relay, and transaction history shows both hashes.

---

## Implemented But Not Yet Verified 2026-05-26

- [x] CCTP cross-chain payments (Stellar → Base via Circle CCTP V2 direct-approved path)
  - `services/cctp.ts` — burn on Stellar (Soroban), poll Iris, relay on Base (viem)
  - `POST /pay` accepts Base `0x...` addresses alongside Stellar `G...` addresses
  - Fire-and-forget relay: response returns after burn; Base tx hash populated async
  - SKILL.md v3 — cross-chain section, response shapes, rules updated
  - `viem` added as API dependency

## Completed 2026-05-25

- [x] SKILL.md v2 — rewrote with accurate response shapes, marketplace section, discovery workflow, error codes
- [x] GET /marketplace/services — added ?search=, ?category=, ?enabled= server-side filtering
- [x] GET /marketplace/services/:providerId — new single-provider detail endpoint
- [x] Favicon — app/icon.png + app/apple-icon.png wired in Next.js App Router
- [x] Meta title, description, OG, Twitter card tags in layout.tsx
- [x] Vercel build fix — removed vestigial (dashboard) route group that caused manifest error on Vercel
- [x] SKILL.md serving fix — confirmed accessible at argens.xyz/SKILL.md
- [x] Vercel root directory — set to apps/web for GitHub-triggered deployments
- [x] CLAUDE.md + PROJECT_STATE.md + todo.md updated

---

## Phase 5 — Remaining

### High priority

- [x] **API deploy** — live on a VPS via Dokploy (Railway plan dropped)
- [x] **Example payloads** — `services/marketplace-examples.ts` provides curated per-endpoint/provider `example_payload` + `example_query` (surfaced in catalog, embedded in per-provider skill md, prefilled in the dashboard call form). Endpoint→provider→null resolution order.
- [x] **Documentation page** (`/docs`) — quickstart, API reference, policies, marketplace, CCTP, agent onboarding

### Medium priority

- [x] **Targeted error handling audit** — fixed obvious CCTP/marketplace loose ends; full endpoint-by-endpoint audit can still happen before demo
- [ ] **Demo script** — define the exact scenario: signup → fund → set policy → agent pays → block → approve → marketplace call
- [ ] **Loom demo recording** — required for SCF submission

### Lower priority (after above)

- [x] Per-service skill files (`/SKILL/<provider>.md`) — generated from the MPP catalog and upstream docs links
- [x] `llms.txt` at argens.xyz/llms.txt — links SKILL.md + docs pages
- [ ] Async-only marketplace endpoints (firecrawl_crawl/extract, stablestudio_generate_*) — x402 session scheme unsupported upstream. Guard prototyped then reverted 2026-08-06; deferred to GitHub issue #29. See decisions.md 2026-07-31.
- [~] XLM/credit-pool balance alerting — `services/alerting.ts` implemented (ops XLM + credit-pool USDC, 6h interval, 24h rate limit). NOT yet E2E-verified against a real low balance.
- [ ] Wallet-funded SSE watcher E2E test
- [ ] Low balance email E2E verification

---

## Deferred (not V1)

- SDK (@argens/sdk npm)
- Soroban contract enforcement
- Multi-chain routing beyond Stellar and Base
