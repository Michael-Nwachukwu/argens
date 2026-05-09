# Current Task

## Task: Phase 4 Pivot — MPP Router Mainnet Marketplace
**Goal:** Replace the stale direct-service MPP marketplace with a clean MPP Router integration on Stellar mainnet, including per-service enablement gates for API-key calls.
**Files affected:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*`, `apps/api/src/services/marketplace.ts`, `apps/api/src/services/mpp-client.ts`, `apps/api/src/routes/marketplace.ts`, `apps/web/lib/api.ts`, `apps/web/app/dashboard/marketplace/page.tsx`, package/dependency files if needed.
**Steps:**
- [x] Add `MarketplaceServiceSetting` persistence for per-user service enablement.
- [x] Replace static marketplace registry usage with MPP Router catalog/search data.
- [x] Make API-key service calls require the service to be enabled; dashboard JWT can toggle services.
- [x] Wire marketplace calls to MPP Router mainnet Stellar charge paths and fail clearly outside mainnet.
- [x] Remove unused direct-service registry code.
- [x] Update dashboard marketplace UX with enable/disable toggles and disabled-call states.
- [x] Generate Prisma client and build API/web.
- [ ] Apply the new Prisma migration locally once the Prisma schema-engine error is resolved.
- [ ] Run an end-to-end mainnet marketplace call from a funded mainnet wallet.
**Risks:** MPP Router is mainnet-only; wallet must have mainnet XLM + classic USDC trustline + balance; legacy mppx signing may need SDK 15 despite local compile; service prices can change at challenge time.
**Done when:** Dashboard lists router services, users can enable/disable services, API-key calls are blocked for disabled services, enabled calls use MPP Router Stellar mainnet challenges, builds pass, migration is applied, and one funded mainnet call is verified.

---

## Task: Marketplace UX + Runtime Repair
**Goal:** Fix the dashboard 500 experience, remove public markup display, and correct MPP cost handling before testnet E2E.
**Files affected:** `apps/api/src/services/mpp-client.ts`, `apps/api/src/services/marketplace.ts`, `apps/web/lib/api.ts`, `apps/web/app/dashboard/marketplace/page.tsx`, `tasks/lessons.md`
**Steps:**
- [x] Convert Stellar MPP challenge amounts from base units to 7-decimal USDC before policy checks, transaction logging, and markup transfer.
- [x] Wrap MPP SDK/payment failures in explicit `AppError`s so the dashboard receives actionable codes instead of `INTERNAL_ERROR`.
- [x] Remove marketplace markup percentage/amount from service catalog and dashboard result UI.
- [x] Mark Tempo/Base-only public services as unavailable for the current Stellar testnet marketplace path.
- [x] Build API and web after the repair.
**Risks:** MPP service availability and wallet funding/trustline state can still make a live call fail; that should return a specific error instead of a generic 500.
**Done when:** Clicking Call service no longer surfaces generic `INTERNAL_ERROR` for expected MPP/payment failures, the dashboard does not display Argens markup, and local builds pass.

---

## Task: Phase 4 — MPP Marketplace
**Goal:** Add a real MPP marketplace path where agents call Argens once, Argens enforces user policy, pays MPP services from the user's agent-custodial Stellar wallet, collects a 20% markup, logs the marketplace transaction, and returns the service response.
**Files affected:** `apps/api/src/services/mpp-registry.ts`, `apps/api/src/services/mpp-client.ts`, `apps/api/src/routes/marketplace.ts`, `apps/api/src/index.ts`, `apps/web/lib/api.ts`, `apps/web/components/dashboard/Sidebar.tsx`, `apps/web/app/dashboard/marketplace/page.tsx`, package manifests as needed.
**Steps:**
- [x] Install `@stellar/mpp` and `mppx`; inspect installed types/exports before using any SDK API.
- [x] Confirm whether a scoped per-request MPP client is available; avoid global `fetch` mutation in the Express server.
- [x] Create a curated marketplace registry with service IDs, endpoint metadata, display pricing, payload examples, and network/payment-method notes.
- [x] Implement MPP client wrapper that decrypts the user's Stellar secret only in memory, performs the paid request, captures payment progress/hash data when available, and never logs secrets.
- [x] Implement `GET /marketplace/services` with JWT or API-key auth and Argens-marked-up display prices.
- [x] Implement `POST /marketplace/call` with policy check on total cost, marketplace transaction logging, MPP service call, 20% markup USDC transfer to fee wallet, `totalSpent` increment only on full success, and exact response envelope.
- [x] Define and implement explicit handling for `BLOCKED`, `PENDING_APPROVAL`, upstream failure, MPP payment failure, and markup-payment failure.
- [x] Wire the marketplace router into `apps/api/src/index.ts`.
- [x] Add dashboard API client helpers and a `/dashboard/marketplace` page with service cards, payload editor, call result, and recent marketplace transaction link/filter.
- [x] Add Marketplace to the dashboard sidebar.
- [x] Build API and web; run the deepest feasible local verification.
- [ ] Run an end-to-end testnet MPP call before marking Phase 4 complete.
**Risks:** MPP SDK API may differ from docs; `mppx` may patch global `fetch`; MPP service pricing may only be known after a 402 challenge; MPP service payment and Argens markup are two transactions and therefore not atomic; approval-threshold flow for marketplace may require safely storing/replaying payloads.
**Done when:** At least one real MPP service can be called on Stellar testnet from an Argens wallet, policy enforcement works for allowed/blocked paths, Argens markup is paid to the fee wallet, the transaction appears in Argens history as `type=marketplace`, and API/web builds pass.

---

## Recently Completed

- Phase 1 — Foundation: complete.
- Phase 2 — Core API: complete, with CCTP/Base deferred and wallet-funded watcher still unverified.
- Phase 3 — Dashboard: complete.
- MPP research: complete enough to start SDK verification. The accepted direction is Argens-as-MPP-client using the user's Stellar wallet, not Argens hosting upstream service API keys.
