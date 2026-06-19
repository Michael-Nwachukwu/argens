# Argens — Project State

> Last updated: 2026-06-19
> Current phase: **Phase 4 complete → Phase 5 / beta rollout hardening**

---

## Overall Status

| Area | Status | Notes |
|---|---|---|
| Network | ✅ Mainnet live | STELLAR_NETWORK=mainnet |
| Web app | ✅ Live on Vercel | argens.xyz — landing + full dashboard |
| API | ✅ Deployed | Live on a VPS via **Dokploy** (NOT Railway). Migrations run on container start via `prisma migrate deploy` in the Dockerfile CMD. |
| SKILL.md | ✅ v7 | v7 tightens per-service skill discovery (mandatory `GET /SKILL/{provider}.md` step), documents marketplace example payloads, the global pause (`MARKETPLACE_SERVICE_PAUSED`), and the refund-flag behaviour. CCTP fee documented (0.5% / $0.01 / $2.00). |
| Phase 1 — Foundation | ✅ Complete | Auth, wallet bootstrap, API keys. **Password reset flow added 2026-06-19** (`/auth/forgot-password`, `/auth/reset-password`). |
| Phase 2 — Core API | ✅ Complete | All payment/policy/transaction endpoints |
| Phase 3 — Dashboard | ✅ Complete | All pages built and functional. Dismiss-pending-approval, marketplace skill.md dialog, example-payload prefills added. |
| Phase 4 — Marketplace | ✅ Complete | 86 providers / 493 endpoints, E2E verified on mainnet. Hardened with global kill-switch + paid-but-failed refund flagging (see below). |
| Phase 5 — Polish & Demo | 🔄 In progress | Partially done; see below |
| CCTP Stellar → Base | ✅ Live & available | Direct path verified twice on mainnet (latest 0.0100000 USDC burn + Base relay, 2026-05-27). Argens fee `clamp(amount × 0.5%, $0.01, $2.00)`; both direct and approval paths fail closed before the fee when live `amount + fee` balance cannot be verified. Approval-token path still needs live verification. |
| Phase 6 — Mainnet infra | ⚠️ Partial | API deployed (VPS/Dokploy); credit-pool funded; alerting pending |

---

## Recent additions (2026-06-17 → 2026-06-19)

- **Marketplace global kill-switch** — `GlobalServiceSetting` model. Globally paused providers are hidden from `GET /marketplace/services` and rejected at `POST /marketplace/call` with `503 MARKETPLACE_SERVICE_PAUSED`. Managed from the Ops Console "Marketplace" tab and `POST /admin/marketplace/services/:providerId`.
- **Paid-but-upstream-failed refund flagging** — when MPP pulls the USDC (receipt present) but the upstream relay fails and it wasn't credit-funded, the FAILED tx gets `metadata.refund.required=true`, an `AuditLog MARKETPLACE_REFUND_REQUIRED`, and an ops-alert email. Ops Console Failed tab shows a "REFUND NEEDED" badge. Refunds stay manual.
- **Marketplace example payloads** — `services/marketplace-examples.ts` provides per-endpoint/per-provider `example_payload`s, surfaced in the catalog (dashboard prefills the body), embedded in per-provider skill markdown, and used by the catalog test harness.
- **Per-service skill discovery in dashboard** — marketplace detail view has a `skill.md` button that opens/downloads the provider skill file. SKILL.md v7 makes fetching `/SKILL/{provider}.md` a mandatory pre-call step for agents.
- **Catalog health test** — `apps/api/scripts/marketplace-catalog-test.ts` (committed) calls each provider's cheapest endpoint through Argens' own `/marketplace/call`, with a hard spend cap; writes `tasks/marketplace-catalog-report.md`. 16 providers fail at the MPP payment layer (`verification-failed`/504/channel) — flagged for global pause and an MPP Router escalation.
- **Password reset flow** — `User.passwordResetToken` + `passwordResetExpiry` (single-use, 1h). `POST /auth/forgot-password` + `POST /auth/reset-password`; `sendPasswordResetEmail`; web pages `/auth/forgot-password` + `/auth/reset-password`; "Forgot password?" link on login.
- **Dismiss pending approvals** — `POST /transactions/:id/dismiss` (JWT) rejects a PENDING_APPROVAL tx the user owns even after its token expired; overview page has a Dismiss button next to Review.
- **Login redirect** — `/login` now redirects already-authenticated users straight to `/dashboard`.
- **Misc UI** — removed the "20% Argens markup" label from the marketplace detail view; API-key copy button gated to a freshly-generated key (the full key is never retrievable later); X link (`https://x.com/argensonline`) added to the landing footer.

### Schema models beyond the original CLAUDE.md schema
`MarketplaceServiceSetting` (per-user provider enablement), `GlobalServiceSetting` (platform-wide pause), `AccessCode` (beta gating), `CreditGrant` (expirable marketplace credits). `User` also has `accessCodeId`, `passwordResetToken`, `passwordResetExpiry`.

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
- [x] POST /pay — Stellar direct + Base/CCTP, policy → tx → notify/relay
- [x] POST /quote — dry run, returns would_succeed / would_be_blocked / would_require_approval, including Base recipient metadata
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
- [x] POST /pay — Base/CCTP V2 direct-approved path verified on mainnet
- [x] POST /pay + POST /approve/:token CCTP preflight — shared helper verifies live USDC balance >= amount + fee before fee transfer
- [ ] POST /approve/:token — Base/CCTP approval path compiles but still needs live approval-path verification
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
- [x] GET /marketplace/services/:providerId/skill.md — public provider-specific skill markdown
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
- [x] SKILL.md v4 local — adds `/docs`, `/llms.txt`, and per-provider skill file discovery
- [x] Documentation page (`/docs`) — quickstart, payments, CCTP, approvals, marketplace, errors
- [x] Per-service skill files (`/SKILL/<provider>.md`) — web proxy + API markdown endpoint
- [x] llms.txt at `/llms.txt` — discovery index for agents and crawlers
- [x] Targeted error handling audit — CCTP burn details, duplicate spend accounting, marketplace replay query metadata, cleaner marketplace validation details
- [ ] Example payloads for marketplace endpoints
- [ ] Demo script rehearsed
- [ ] Loom demo recording (SCF submission requirement)

---

### Phase 6 — Mainnet Infra ⚠️

- [x] STELLAR_NETWORK=mainnet
- [x] Mainnet ops wallet funded + in use
- [x] Fee wallet — USDC trustline verified, receives marketplace markup
- [x] Credit pool wallet — bootstrapped and funded on mainnet; working well
- [x] argens.xyz live (Vercel)
- [x] **API deployment** — live on a VPS via Dokploy (Railway plan dropped)
- [ ] XLM balance alerting on ops wallet
- [ ] Wallet-funded SSE watcher E2E test
- [ ] Low balance email E2E verification
- [ ] Post-launch: monitor Stellar submission failure rate for 72h

---

## Prioritised Next Steps

| Priority | Task | Blocks |
|---|---|---|
| 1 | **Approval-token CCTP live verification** | Accurate CCTP claims for approval flow |
| 2 | **Example payloads** | Marketplace UX usable by agents |
| 3 | **Loom demo** | SCF submission |
| 4 | **Demo script** | SCF submission |

---

## What Is Not In Scope (V1)

- Soroban contract enforcement — dropped (TS policy engine is permanent V1)
- SDK (@argens/sdk npm package) — V2
- Multi-chain routing beyond Stellar and Base — V2
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
| Email | Resend — noreply@argens.xyz sender |
| Auth | Custom JWT + bcrypt + email verification required |
| Custody | Agent-custodial — AES-256-GCM encrypted secret key in Postgres |
| Policy engine | TypeScript (permanent V1) |
| Stellar bootstrap | 2 XLM per new wallet on mainnet |
| Marketplace payment rail | @stellar/mpp charge intent, pull mode, USDC SAC, Stellar mainnet only |
| Marketplace markup | 20% — base cost to service + 20% USDC to ARGENS_FEE_WALLET |
| Fee on direct payments | $0 — single-op Stellar tx, no Argens fee |
| Service discoverability | GET /marketplace/services with ?search, ?category, ?enabled filters |
| Agent onboarding | SKILL.md at argens.xyz/SKILL.md — no SDK in V1 |

## Latest CCTP Verification

- Transaction id: `cmpn8yh5900011uqzobaa94qn`
- Amount: `0.0100000` USDC
- Stellar burn tx: `5d889c2691236a068a22d900fd86996862dc9022ab8ea667a51945fb53114044`
- Base relay tx: `0xb086f56e0259d9241043d051dc2b2280567c85775997594ff966aad9496bb2ef`
- Status: `SUCCESS`

## Latest Beta Hardening Verification — 2026-06-03

- `GET /v1/admin/wallets` now returns partial-success balance data instead of generic card failures. Ops wallet, fee wallet, and Base relayer read successfully on mainnet; credit-pool wallet reports `Account not found on the active Stellar network`.
- CCTP preflight read-only checks returned `402 INSUFFICIENT_FUNDS_PLUS_FEES` for an underfunded wallet and `503 CCTP_PREFLIGHT_UNAVAILABLE` for an uncreated wallet. No fee or burn transaction was submitted in either check.
- Admin endpoints smoke-tested: missing `x-admin-secret` returns `401 UNAUTHORIZED`; `/v1/admin/stats` and `/v1/admin/credit-grants?limit=1` return 200 with the expected response envelopes.
- API build passed with `pnpm --filter @argens/api build`.
