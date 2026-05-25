# Argens — Project State

> Last updated: 2026-05-25
> Current phase: **Phase 4 complete → Phase 5 (Polish & Demo) next**

---

## Overall Status

| Area | Status | Notes |
|---|---|---|
| Network | ✅ Mainnet live | STELLAR_NETWORK=mainnet |
| Web app | ✅ Live on Vercel | argens.xyz — landing + full dashboard |
| API | ⚠️ Local only | Railway deploy is the next infrastructure task |
| SKILL.md | ✅ v2 deployed | argens.xyz/SKILL.md — accurate, comprehensive |
| Phase 1 — Foundation | ✅ Complete | Auth, wallet bootstrap, API keys |
| Phase 2 — Core API | ✅ Complete | All payment/policy/transaction endpoints |
| Phase 3 — Dashboard | ✅ Complete | All pages built and functional |
| Phase 4 — Marketplace | ✅ Complete | 86 providers, E2E verified on mainnet |
| Phase 5 — Polish & Demo | 🔄 In progress | Partially done; see below |
| Phase 6 — Mainnet infra | ⚠️ Partial | Mainnet code is live; Railway + alerting pending |

---

## Detailed Checklist

### Phase 1 — Foundation ✅

- [x] Monorepo (pnpm workspaces) — apps/api + apps/web
- [x] PostgreSQL + Prisma schema + all migrations applied
- [x] Express server (TypeScript, cors, helmet, rate-limit, zod)
- [x] POST /auth/signup — email validation (format + disposable blocklist + DNS MX)
- [x] GET /auth/verify/:token — verify email → wallet bootstrap → return public key
- [x] GET /auth/verify?token=... — frontend page
- [x] POST /auth/resend-verification
- [x] POST /auth/login — JWT
- [x] POST /auth/logout
- [x] POST /auth/transfer-pin + DELETE /auth/transfer-pin
- [x] Stellar mainnet ops wallet — funds 2 XLM per new wallet (1.5 reserve + 0.5 buffer)
- [x] Wallet bootstrap — createAccount + changeTrust (USDC trustline)
- [x] AES-256-GCM secret key encryption
- [x] API key generation (argns_live_ prefix, bcrypt hash, gated on emailVerified)

---

### Phase 2 — Core API ✅

- [x] TypeScript policy engine — max tx, allowance, approval threshold (correct check order)
- [x] POST /pay — Stellar-only, policy → Stellar tx → notify
- [x] POST /quote — dry run, returns would_succeed / would_be_blocked / would_require_approval
- [x] GET /wallet/balance — USDC + XLM, 30s cache
- [x] GET /agent/status
- [x] GET /transactions + GET /transactions/:id (with approvalToken when PENDING)
- [x] GET /policies + POST /policies
- [x] GET /spend/summary
- [x] POST /refund
- [x] GET /approve/:token — public, no JWT (token IS the bearer)
- [x] POST /approve/:token + POST /reject/:token — no JWT required
- [x] Email service — all templates via Resend
- [x] Rate limiting — 100 req/min per API key
- [x] Zod validation on all endpoints
- [x] All 10 test scenarios verified E2E on mainnet ✅
- [ ] POST /pay — Base/CCTP V2 path — **DEFERRED**
- [ ] Wallet-funded SSE watcher — code exists, never E2E tested
- [ ] XLM balance alerting on ops wallet — not implemented

---

### Phase 3 — Dashboard ✅

- [x] Next.js 14 + Tailwind CSS
- [x] Auth pages — login, signup, email verify
- [x] Protected layout + sidebar
- [x] Overview page — balance, today's spend, recent transactions, pending approvals
- [x] Wallet page — USDC + XLM balance, send modal, PIN flow, deposit address, export key
- [x] Policies page — three cards, save per field
- [x] Transactions page — paginated, filters, CSV export, expand row
- [x] Analytics page — bar chart, stats grid, policy breakdown
- [x] API Keys page — generate, copy, regenerate, SKILL.md onboarding prompt
- [x] Settings page — transfer PIN, danger zone
- [x] Approve/confirm page — magic-link, no JWT, approve/reject via POST

---

### Phase 4 — MPP Marketplace ✅

- [x] MPP Router catalog integration (86 providers / 493 endpoints, Stellar mainnet)
- [x] services/mpp-client.ts — scoped per-request charge client
- [x] services/mpp-router.ts — catalog fetch, filtering, URL builder, provider helpers
- [x] services/marketplace.ts — enablement gate, policy gate, 20% markup, tx logging, approval replay
- [x] GET /marketplace/services — all providers, grouped by provider key
- [x] GET /marketplace/services?search=&category=&enabled= — server-side filtering
- [x] GET /marketplace/services/:providerId — single provider detail
- [x] PATCH /marketplace/services/:serviceId — enable/disable provider toggle
- [x] POST /marketplace/call — proxy + markup + policy + tx log
- [x] Provider-level MarketplaceServiceSetting (migration applied — collapsed from operation-keyed)
- [x] Dashboard marketplace page — two-column layout, endpoint table, call form, load-more
- [x] All policy paths verified on mainnet (block, pending, approve, reject, enablement-gate)
- [ ] example_payload — always null; generation pipeline not built

---

### Phase 5 — Polish & Demo 🔄

- [x] SKILL.md v2 — accurate response shapes, marketplace discovery, error codes
- [x] SKILL.md deployed at argens.xyz/SKILL.md with CORS * headers
- [x] Favicon — app/icon.png + app/apple-icon.png (1024×1024)
- [x] Meta title, description, OG, Twitter card tags
- [x] Vercel build fixed — removed vestigial (dashboard) route group
- [x] Vercel root directory set to apps/web for GitHub integration
- [ ] Example payloads for marketplace endpoints
- [ ] Documentation page (/docs) — quickstart, API reference, policies, marketplace, agent onboarding
- [ ] Per-service skill files (/SKILL/<provider>.md)
- [ ] llms.txt at argens.xyz/llms.txt (depends on docs page)
- [ ] Error handling audit — all endpoints
- [ ] Demo script rehearsed
- [ ] Loom demo recording (SCF submission requirement)

---

### Phase 6 — Mainnet Infra ⚠️

- [x] STELLAR_NETWORK=mainnet
- [x] Mainnet ops wallet funded + in use
- [x] Fee wallet — USDC trustline verified, receives marketplace markup
- [x] argens.xyz live (Vercel)
- [ ] **Railway API deployment** — #1 blocker for external users
- [ ] XLM balance alerting on ops wallet
- [ ] Wallet-funded SSE watcher E2E test
- [ ] Low balance email E2E verification
- [ ] Post-launch: monitor Stellar submission failure rate for 72h

---

## Prioritised Next Steps

| Priority | Task | Blocks |
|---|---|---|
| 1 | **Railway API deploy** | Everything for external users |
| 2 | **Example payloads** | Marketplace UX usable by agents |
| 3 | **Documentation page** | External onboarding, llms.txt |
| 4 | **Error handling audit** | Phase 5 gate, SCF demo quality |
| 5 | **Loom demo** | SCF submission |
| 6 | **Per-service skill files + llms.txt** | Agent DX, after docs |

---

## What Is Not In Scope (V1)

- CCTP V2 / Base settlement — deferred
- Soroban contract enforcement — dropped (TS policy engine is permanent V1)
- SDK (@argens/sdk npm package) — V2
- Multi-chain routing beyond Stellar — V2
- KYC / AML — not in scope

---

## Key URLs

| Service | URL |
|---|---|
| Web app (prod) | https://argens.xyz |
| SKILL.md (prod) | https://argens.xyz/SKILL.md |
| API (local) | http://localhost:3001/v1 |
| Dashboard (local) | http://localhost:3000 |
| MPP Router catalog | https://apiserver.mpprouter.dev/v1/services/catalog |
| Horizon mainnet | https://horizon.stellar.org |
| Stellar Lab | https://laboratory.stellar.org |

---

## Tech Decisions Locked

| Decision | Choice |
|---|---|
| Package manager | pnpm workspaces |
| Database | PostgreSQL local, Prisma ORM |
| Email | Resend — noreply@argens.io sender |
| Auth | Custom JWT + bcrypt + email verification required |
| Custody | Agent-custodial — AES-256-GCM encrypted secret key in Postgres |
| Policy engine | TypeScript (permanent V1) |
| Stellar bootstrap | 2 XLM per new wallet on mainnet |
| Marketplace payment rail | @stellar/mpp charge intent, pull mode, USDC SAC, Stellar mainnet only |
| Marketplace markup | 20% — base cost to service + 20% USDC to ARGENS_FEE_WALLET |
| Fee on direct payments | $0 — single-op Stellar tx, no Argens fee |
| Service discoverability | GET /marketplace/services with ?search, ?category, ?enabled filters |
| Agent onboarding | SKILL.md at argens.xyz/SKILL.md — no SDK in V1 |
