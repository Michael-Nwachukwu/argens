# Argens — Project State

> This file is updated at the end of every phase and whenever something significant lands or changes.
> Last updated: 2026-05-03
> Current phase: **Pre-Phase 1 — Setup**

---

## Current Status

| Area | Status | Notes |
|---|---|---|
| CLAUDE.md | ✅ Complete | Single source of truth, fully specced |
| PRD (argens-prd.docx) | ⚠️ Needs update | 14-point correction list documented — apply in Claude chat |
| Design | ⏳ Pending | Design prompt written, not yet submitted to claude.ai/design |
| Monorepo | ❌ Not started | |
| Database / Prisma | ❌ Not started | Schema written in CLAUDE.md, not yet migrated |
| Auth endpoints | ❌ Not started | |
| Stellar wallet bootstrap | ❌ Not started | |
| Policy engine (TS stand-in) | ❌ Not started | |
| Payment endpoints | ❌ Not started | |
| CCTP V2 / Base settlement | ❌ Not started | |
| Dashboard (Next.js) | ❌ Not started | |
| SKILL.md content | ❌ Not started | Intentionally deferred — write after all APIs are done |
| Soroban contract | ❌ Not started | Phase 4 — TS stand-in covers Phase 2–3 |
| Demo agent script | ❌ Not started | Phase 3 |

---

## Phase Completion

### Phase 1 — Foundation ❌ Not started
**Goal:** Auth, wallet creation, email verification, API key generation. Every new-user flow working end-to-end on testnet.

- [ ] Monorepo scaffold (npm workspaces, apps/web + apps/api)
- [ ] Docker Compose — Postgres local
- [ ] Prisma schema + initial migration
- [ ] Express server skeleton (TypeScript, cors, helmet, rate-limit, zod)
- [ ] `POST /auth/signup` — create user (emailVerified=false), send verification email
- [ ] `GET  /auth/verify/:token` — verify email → trigger wallet bootstrap → return public key
- [ ] `POST /auth/resend-verification`
- [ ] `POST /auth/login` — return JWT
- [ ] `POST /auth/logout`
- [ ] Stellar testnet ops wallet setup (friendbot-funded)
- [ ] Wallet bootstrap service — friendbot → createAccount → changeTrust (USDC trustline)
- [ ] AES-256-GCM secret key encryption / decryption service
- [ ] API key generation service (`argns_live_` prefix + bcrypt hash, gated on emailVerified)
- [ ] Smoke test: full signup → verify → wallet ready → API key generated — all on testnet

**Done when:** A developer can sign up, verify email, get a wallet address on Stellar testnet with a USDC trustline, and generate an API key.

---

### Phase 2 — Core API ❌ Not started
**Goal:** All 9 agent-facing endpoints live. Policy engine enforcing rules. Payments executing on testnet.

- [ ] TypeScript policy engine stand-in (`services/policy.ts`)
- [ ] `POST /pay` — Stellar path (G... recipient)
- [ ] `POST /pay` — Base path (0x... recipient via CCTP V2)
- [ ] `POST /quote` — dry run, no DB write, no Stellar tx
- [ ] `GET  /wallet/balance` — Horizon query, 30s cache
- [ ] `GET  /agent/status`
- [ ] `GET  /transactions` + `GET /transactions/:id`
- [ ] `GET  /policies` + `POST /policies` (update)
- [ ] `GET  /spend/summary`
- [ ] `POST /refund`
- [ ] Approval queue — `POST /approve/:token` + `POST /reject/:token`
- [ ] Email service (Resend or Ethereal for dev) — all notification templates
- [ ] Wallet-funded detection (Horizon SSE + 60s poll fallback)
- [ ] Low-balance warning trigger
- [ ] Rate limiting — 100 req/min per API key
- [ ] Zod validation on all endpoints
- [ ] All 10 test scenarios passing (see CLAUDE.md Testing section)

**Done when:** All 10 test scenarios pass on testnet. Cross-chain payment (Base) confirmed on testnet (Stellar testnet → Base Sepolia).

---

### Phase 3 — Dashboard ❌ Not started
**Goal:** A working Next.js dashboard a developer can actually use to manage their agent's wallet and policies.

- [ ] Next.js 14 + Tailwind CSS setup
- [ ] Auth pages: login, signup
- [ ] Protected layout + sidebar navigation
- [ ] Overview page — balance, today's spend, recent transactions, quick actions
- [ ] Wallet page — balance, deposit address, QR code, one-time private key download
- [ ] Policies page — three editable policy cards + pending approval queue
- [ ] Transactions page — paginated table, filters, CSV export
- [ ] Analytics page — spend chart, blocked tx breakdown
- [ ] API Keys page — masked key, copy, regenerate
- [ ] Settings page — notifications, password, danger zone
- [ ] `GET /approve/confirm?token=...` — approval landing page (shows tx detail, Approve/Reject buttons)
- [ ] Demo agent script (`demo/agent.py` or `demo/agent.ts`) — reads SKILL.md, calls local API, streams conversation
- [ ] End-to-end demo run-through confirmed working

**Done when:** Full demo video script can be recorded in one take without errors.

---

### Phase 4 — Soroban Contract ❌ Not started
**Goal:** Replace TypeScript policy stand-in with on-chain Soroban enforcement.

- [ ] Write Soroban policy contract in Rust
- [ ] Deploy to Stellar testnet
- [ ] Replace `services/policy.ts` stand-in with Soroban contract calls
- [ ] Store contract ID in `policies.sorobanContractId`
- [ ] End-to-end test: dashboard policy → agent API → Soroban validates → Stellar tx executes

**Done when:** Contract deployed on testnet, TS stand-in deleted, all 10 test scenarios pass through the contract.

---

### Phase 5 — Polish & Demo ❌ Not started
- [ ] SKILL.md content authored (now that all APIs are finalized)
- [ ] SKILL.md deployed to Vercel at `/SKILL.md`
- [ ] Test SKILL.md by running demo agent script cold (no prior context)
- [ ] Error handling audit — every endpoint handles error cases
- [ ] Consistent error response format verified across all endpoints
- [ ] Demo script rehearsed and recorded (Loom)

---

### Phase 6 — Mainnet ❌ Not started
See CLAUDE.md Phase 6 checklist.

---

## Open Blockers

| Blocker | Needed for | Status |
|---|---|---|
| Package manager decision (npm/pnpm/yarn) | Phase 1 scaffold | ⏳ Awaiting answer |
| Postgres setup (Docker local / Neon / Supabase) | Phase 1 scaffold | ⏳ Awaiting answer |
| Resend account + sending domain | Phase 2 email | ⏳ Awaiting answer |
| Domain ownership (argens.xyz, argens.io) | Phase 5 SKILL.md, Phase 6 | ⏳ Awaiting answer |
| Circle CCTP V2 JS SDK — verify package name | Phase 2 Base settlement | ⏳ Must verify before building |
| Anthropic API key for demo agent script | Phase 3 demo | ⏳ Awaiting answer |

---

## Testnet Accounts

| Account | Public Key | Status |
|---|---|---|
| Ops wallet (XLM) | TBD | ❌ Not generated |
| Fee wallet (USDC) | TBD | ❌ Not generated |

---

## Key URLs (local dev)

| Service | URL |
|---|---|
| API | http://localhost:3001/v1 |
| Dashboard | http://localhost:3000 |
| SKILL.md (local) | http://localhost:3000/SKILL.md |
| Horizon testnet | https://horizon-testnet.stellar.org |
| Soroban RPC testnet | https://soroban-testnet.stellar.org |
| Stellar Lab | https://laboratory.stellar.org |
| Circle USDC testnet faucet | https://faucet.circle.com |
| Base Sepolia faucet | https://www.alchemy.com/faucets/base-sepolia |
| Ethereal email (dev) | https://ethereal.email |
