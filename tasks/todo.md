# Current Task

> Last updated: 2026-05-27
> Phase 4 complete. Phase 5 in progress. Active: CCTP verification, service skill files, docs, and error audit.

---

## Active 2026-05-27 — CCTP + Agent Docs Completion

**Goal:** Finish the CCTP verification loop, document the API clearly for agents/developers, expose per-service skill files, and tighten loose error-handling edges.
**Files affected:** `apps/api/src/routes/*`, `apps/api/src/services/*`, `apps/web/public/SKILL.md`, `apps/web/public/llms.txt`, `apps/web/app/docs/page.tsx`, `tasks/*`, docs/status files.
**Steps:**
- [ ] Explain the approval-token CCTP status in plain language.
- [ ] Run another small mainnet CCTP burn through the public API-key endpoints and verify both Stellar + Base hashes.
- [ ] Ensure `POST /quote`, `POST /pay`, `GET /transactions/:id`, and approval paths return complete CCTP response shapes.
- [ ] Update `/SKILL.md` with CCTP, docs, `llms.txt`, and per-service skill discovery.
- [ ] Add `GET /marketplace/services/:providerId/skill.md` for agent-readable per-provider service docs.
- [ ] Add `/SKILL/<provider>.md` proxy endpoint on the web app for service skill files.
- [ ] Create `/docs` with a comprehensive responsive guide and code snippets.
- [ ] Add `/llms.txt` so agents can discover Argens docs and skill entry points.
- [ ] Audit expected endpoint errors for clean response envelopes and fix obvious loose ends.
- [ ] Run API/web builds and focused endpoint smoke tests.
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

- [ ] **Railway API deploy** — biggest external-user blocker; dashboard is non-functional without it
- [ ] **Example payloads** — `example_payload` is always `null`; marketplace call form has no prefills; need a generation pipeline (curated + OpenAPI extraction + LLM-generated fallback)
- [ ] **Documentation page** (`/docs`) — at minimum: quickstart, API reference, policies explainer, marketplace guide, agent onboarding walkthrough

### Medium priority

- [ ] **Error handling audit** — walk every endpoint, confirm all error cases return correct codes and shapes; prerequisite for SCF demo quality
- [ ] **Demo script** — define the exact scenario: signup → fund → set policy → agent pays → block → approve → marketplace call
- [ ] **Loom demo recording** — required for SCF submission

### Lower priority (after above)

- [ ] Per-service skill files (`/SKILL/<provider>.md`) — sourced from `docs.llms_txt` field in MPP catalog
- [ ] `llms.txt` at argens.xyz/llms.txt — links SKILL.md + docs pages; depends on docs existing first
- [ ] XLM balance alerting on ops wallet
- [ ] Wallet-funded SSE watcher E2E test
- [ ] Low balance email E2E verification

---

## Deferred (not V1)

- CCTP V2 / Base settlement
- SDK (@argens/sdk npm)
- Soroban contract enforcement
- Multi-chain routing
