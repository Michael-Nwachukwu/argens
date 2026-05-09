# Argens — Project State

> This file is updated at the end of every phase and whenever something significant lands or changes.
> Last updated: 2026-05-09
> Current phase: **Phase 4 — MPP Router Mainnet Marketplace** (implementation built, migration + mainnet verification pending)

---

## Current Status

| Area | Status | Notes |
|---|---|---|
| CLAUDE.md | ✅ Complete | Updated to reflect all pivots (fee removal, Soroban dropped, marketplace revenue, transfer PIN, session security) |
| Monorepo (pnpm workspaces) | ✅ Complete | apps/api + apps/web |
| Database / Prisma | ✅ Complete | Schema migrated, running on local Postgres |
| Auth endpoints | ✅ Complete | Signup, verify, login, logout, resend-verification, transfer PIN set/remove |
| Email verification frontend | ✅ Complete | `/auth/verify?token=...` page created |
| Stellar wallet bootstrap | ✅ Complete | Friendbot on testnet; mainnet bootstrap sends 2 XLM (1.5 reserves + 0.5 fee buffer) |
| Policy engine (TS) | ✅ Complete | All 3 rules: max tx, allowance, approval threshold. Save-one-field bug fixed. |
| Payment endpoints | ✅ Complete | POST /pay (Stellar), POST /quote, POST /refund |
| Wallet endpoints | ✅ Complete | GET /wallet/balance (USDC + XLM), POST /wallet/send (with PIN support) |
| Approval queue | ✅ Complete | POST /approve/:token, POST /reject/:token, GET /approve/confirm frontend page |
| Agent endpoints | ✅ Complete | GET /agent/status, GET /spend/summary (fixed to return correct shape) |
| Transaction endpoints | ✅ Complete | GET /transactions, GET /transactions/:id (Invalid Date bug fixed) |
| Email service | ✅ Complete | Resend configured. Dev override to `dahformulah@gmail.com`. All templates implemented. |
| API key generation | ✅ Complete | argns_live_ prefix, bcrypt hash, gated on emailVerified |
| Transfer PIN | ✅ Complete | Optional 4-digit bcrypt PIN on /wallet/send. POST/DELETE /auth/transfer-pin. |
| Rate limiting | ✅ Complete | 100 req/min per API key |
| Zod validation | ✅ Complete | All endpoints |
| Dashboard — auth pages | ✅ Complete | Login, signup |
| Dashboard — layout + sidebar | ✅ Complete | Protected layout, sidebar navigation |
| Dashboard — overview | ✅ Complete | Balance, today's spend, recent transactions |
| Dashboard — wallet page | ✅ Complete | USDC + XLM balance, send modal, PIN flow, deposit address, export key UI |
| Dashboard — policies page | ✅ Complete | Three cards, save-one-field bug fixed, copy updated (Soroban reference removed) |
| Dashboard — transactions page | ✅ Complete | Paginated table, filters, CSV export, expand row. Invalid Date bug fixed. |
| Dashboard — analytics page | ✅ Complete | Bar chart, spend stats, policy breakdown. NaN bug fixed. |
| Dashboard — API keys page | ✅ Complete | Generate, copy, regenerate modal, SKILL.md onboarding prompt |
| Dashboard — settings page | ✅ Complete | Transfer PIN management, danger zone |
| CCTP V2 / Base settlement | ❌ Not started | V1 scope, deferred — Stellar-only path working |
| SKILL.md | ❌ Not started | To be written after marketplace is done |
| MPP Marketplace | 🔄 In progress | MPP Router mainnet integration built with per-service enablement; API/web builds pass; DB migration and live mainnet call pending |
| Wallet-funded SSE watcher | ⚠️ Unverified | Code exists, not tested end-to-end on testnet |
| All 10 test scenarios | ⚠️ Not verified | Infrastructure done; no formal pass/fail run yet |
| Demo agent script | ❌ Not started | Phase 5 |

---

## Pivots Since Initial Spec

| Decision | What changed |
|---|---|
| **Fee model** | 0.5% fee on all payments → **$0 on direct transfers**. Revenue from marketplace markup only (~20%). |
| **Soroban** | Dropped for V1. TypeScript policy engine in `services/policy.ts` is permanent. `sorobanContractId` field reserved but unused. |
| **Bootstrap XLM** | 1.5 XLM → **2.0 XLM** on mainnet (adds 0.5 XLM fee buffer, ~50k transactions). |
| **Ops wallet** | No fee wallet for direct payments. Fee wallet only used for marketplace markup revenue. |
| **Phase 4** | Was Soroban contract, then direct public MPP services. Now **MPP Router mainnet marketplace** — discover router services, pay via Stellar mainnet USDC using the user's Argens wallet, and collect marketplace markup. |
| **Email** | Resend configured (`re_9UJLyCkk_...`). Dev override sends all emails to `dahformulah@gmail.com`. Signup response includes `dev_verify_url` in dev mode. |

---

## Phase Completion

### Phase 1 — Foundation ✅ Complete

All auth and wallet bootstrap flows working on testnet.

- [x] Monorepo scaffold (pnpm workspaces)
- [x] PostgreSQL + Prisma schema + migration
- [x] Express server (TypeScript, cors, helmet, rate-limit, zod)
- [x] `POST /auth/signup` — create user, send verification email, return `dev_verify_url` in dev
- [x] `GET /auth/verify/:token` — verify email → wallet bootstrap → return public key
- [x] `GET /auth/verify?token=...` frontend page
- [x] `POST /auth/resend-verification`
- [x] `POST /auth/login` — return JWT (7d expiry)
- [x] `POST /auth/logout`
- [x] `POST /auth/transfer-pin` + `DELETE /auth/transfer-pin`
- [x] Stellar testnet ops wallet setup (friendbot-funded)
- [x] Wallet bootstrap service — friendbot → changeTrust (USDC trustline)
- [x] AES-256-GCM secret key encryption / decryption
- [x] API key generation (`argns_live_` prefix, bcrypt hash, gated on emailVerified)

---

### Phase 2 — Core API ✅ Complete (unverified end-to-end)

All endpoints built. Formal 10-scenario test run not yet done.

- [x] TypeScript policy engine (`services/policy.ts`) — 3 rules, correct check order
- [x] `POST /pay` — Stellar path, full policy → Stellar tx → notify flow
- [x] `POST /quote` — dry run, no DB write
- [x] `GET /wallet/balance` — USDC + XLM balance, 30s USDC cache
- [x] `GET /agent/status`
- [x] `GET /transactions` + `GET /transactions/:id`
- [x] `GET /policies` + `POST /policies` (save-one-field bug fixed)
- [x] `GET /spend/summary` (fixed: now returns `total_spent`, `blocked_count`, `breakdown[]`)
- [x] `POST /refund`
- [x] Approval queue — `POST /approve/:token` + `POST /reject/:token`
- [x] Email service — all templates (blocked, pending approval, approval acted, low balance, wallet funded, policy changed, API key regen)
- [x] Rate limiting — 100 req/min per API key
- [x] Zod validation on all endpoints
- [ ] `POST /pay` — Base path (CCTP V2) — deferred
- [ ] Wallet-funded SSE watcher — code exists, not tested
- [ ] All 10 test scenarios verified on testnet

---

### Phase 3 — Dashboard ✅ Complete

All pages built and functional. Minor bugs fixed during this phase.

- [x] Next.js 14 + Tailwind CSS + custom design system (Space Grotesk / Inter / JetBrains Mono)
- [x] Auth pages: login, signup, email verify
- [x] Protected layout + sidebar navigation
- [x] Overview page
- [x] Wallet page — USDC + XLM balance, send modal, PIN flow, deposit address
- [x] Policies page — three cards, centered layout (860px max-width)
- [x] Transactions page — paginated, filters, CSV export, expand row, date fixed
- [x] Analytics page — bar chart, stats grid, policy breakdown, NaN fixed
- [x] API Keys page — generate, copy, regenerate, SKILL.md onboarding prompt
- [x] Settings page — transfer PIN, danger zone
- [x] Approve/confirm page — transaction detail, approve/reject buttons
- [ ] SKILL.md authored and deployed — deferred to Phase 5
- [ ] Demo agent script — Phase 5

---

### Phase 4 — MPP Router Mainnet Marketplace 🔄 In Progress

**Goal:** Connect to MPP Router services on Stellar mainnet. Agents call `POST /marketplace/call`, Argens confirms the user has enabled that service, acts as MPP client using the user's Stellar wallet, runs policy on the marked-up total cost, returns the service result, and collects marketplace markup.

**Research done:**

- MPP = Machine Payments Protocol. HTTP 402-based per-request payments; payment rails vary by service.
- `@stellar/mpp` + `mppx` SDK handle full 402 → USDC SAC payment → retry cycle.
- USDC_SAC_TESTNET / USDC_SAC_MAINNET are Soroban wrapper contract addresses (not traditional USDC issuer).
- Pull mode: client signs tx, server broadcasts — correct for agent-custodial model.
- Probed public services on 2026-05-08: OpenAI/Anthropic return Tempo session challenges; Exa/Firecrawl return Tempo charge challenges; Parallel returns Tempo plus Base x402. None are callable by the current Stellar-testnet-only client.
- Probed MPP Router on 2026-05-09: `/x402/supported` advertises `stellar:pubnet`; catalog/search returns OpenAI, Exa, Parallel, and many other services with `payment_method=stellar`, `network=stellar-mainnet`, `intent=charge`.
- `mppx` can augment global fetch, but `@stellar/mpp/charge/client` exposes a scoped per-request `Mppx.create({ polyfill: false })` path that is safer for a multi-user Express server.
- 20% markup = MPP payment (base cost, user → service via Soroban) + separate USDC transfer (0.20 × cost, user → Argens fee wallet).
- MPP Router is mainnet-only for this path; local testnet calls should fail clearly rather than pretending to work.

**Built locally:**

- [x] Installed `@stellar/mpp@0.5.1` + `mppx@0.4.12`; upgraded `@stellar/stellar-sdk` to satisfy the MPP peer range; verified installed exports/types before use
- [x] `services/mpp-client.ts` — scoped per-request charge client wrapper
- [x] `services/mpp-router.ts` — MPP Router catalog client, Stellar mainnet charge filtering, URL builder
- [x] `services/marketplace.ts` — service enablement gate, policy gate, marketplace transaction logging, 20% markup payment, approval replay path
- [x] Removed the old static direct-service registry
- [x] `GET /marketplace/services`
- [x] `PATCH /marketplace/services/:serviceId` plus enable/disable convenience routes for dashboard toggles
- [x] `POST /marketplace/call`
- [x] Wired marketplace router into `index.ts`
- [x] `apps/web/app/dashboard/marketplace/page.tsx`
- [x] Dashboard sidebar + API client helpers
- [x] Dashboard enable/disable service toggles and disabled call states
- [x] `.env.example` and API local env moved to Stellar mainnet values
- [x] API build passes
- [x] Web build passes

**Still required:**

- [ ] Resolve local Prisma schema-engine error and apply `20260509103000_add_marketplace_service_settings`
- [ ] Create or migrate users to real mainnet Stellar accounts; existing testnet wallet rows should not be treated as funded mainnet wallets
- [ ] Fund a mainnet wallet with XLM and USDC, with trustlines in place
- [ ] Verify `ARGENS_FEE_WALLET` has a mainnet USDC trustline
- [ ] Run one end-to-end paid mainnet MPP Router call

---

### Phase 5 — Polish & Demo ❌ Not started

- [ ] SKILL.md authored (after marketplace APIs finalised)
- [ ] SKILL.md deployed at `/SKILL.md` on Next.js site
- [ ] Test SKILL.md by running cold agent onboarding
- [ ] Error handling audit across all endpoints
- [ ] Demo script rehearsed and recorded (Loom)

---

### Phase 6 — Mainnet ❌ Not started
See CLAUDE.md Phase 6 checklist.

---

## Open Blockers

| Blocker | Needed for | Status |
|---|---|---|
| Prisma migration apply | Phase 4 service toggles | ⚠️ Migration file exists and client generated, but local Prisma schema engine errors before applying |
| Live MPP Router mainnet execution | Phase 4 | ⏳ Code built locally; real paid request not yet run |
| Mainnet wallet funding/trustlines | Phase 4 | ⚠️ Users need mainnet XLM + USDC trustline + USDC; existing testnet wallets are not valid funded mainnet state |
| Fee wallet USDC trustline on mainnet | Phase 4 markup tx | ⚠️ Wallet exists in .env, trustline status unverified |
| `mppx` optional Express peer warning | Phase 4 | ⚠️ `mppx` wants Express >=5, but Argens does not use its Express middleware |
| Domain (argens.xyz, argens.io) | Phase 5 SKILL.md, Phase 6 | ⏳ Unresolved |
| CCTP V2 JS SDK verification | Phase 2 Base path | ⏳ Deferred |
| All 10 test scenarios formal run | Phase 2 gate | ⏳ Pending |

---

## Testnet Accounts

| Account | Public Key | Status |
|---|---|---|
| Ops wallet (XLM) | Set in .env | ⚠️ Mainnet configuration required; must hold XLM for account bootstrap |
| Fee wallet (USDC) | Set in .env | ⚠️ Mainnet USDC trustline status unverified |

---

## Key URLs (local dev)

| Service | URL |
|---|---|
| API | http://localhost:3001/v1 |
| Dashboard | http://localhost:3000 |
| SKILL.md (local) | http://localhost:3000/SKILL.md |
| Horizon mainnet | https://horizon.stellar.org |
| Soroban RPC mainnet | https://mainnet.sorobanrpc.com |
| Stellar Lab | https://laboratory.stellar.org |
| Circle USDC testnet faucet | https://faucet.circle.com |
| MPP services directory | [mpp.dev/services](https://mpp.dev/services) |
| MPP charge guide (Stellar) | [Stellar docs](https://developers.stellar.org/docs/build/agentic-payments/mpp/charge-guide) |

---

## Tech Decisions Locked

| Decision | Choice |
|---|---|
| Package manager | pnpm workspaces |
| Database | PostgreSQL local (Docker), Prisma ORM |
| Email | Resend (prod) — `onboarding@resend.dev` sender, dev override to `dahformulah@gmail.com` |
| Auth | Custom JWT (7d expiry) + bcrypt + required email verification |
| Custody | Agent-custodial — AES-256-GCM encrypted secret key in Postgres |
| Policy engine | TypeScript (permanent V1 — Soroban dropped) |
| Stellar fees | 2 XLM bootstrap on mainnet (0.5 XLM fee buffer) |
| Marketplace payment | `@stellar/mpp` charge intent, pull mode, USDC SAC |
| Marketplace markup | 20% — MPP base cost to service + 20% USDC to Argens fee wallet |
