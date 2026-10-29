# Argens

**Programmable payment infrastructure for autonomous AI agents.**

Argens gives an AI agent the ability to spend USDC on Stellar — autonomously, within spending
policies a human defines. The agent gets an API key and a REST endpoint. The developer gets a
dashboard, hard spending limits, and an approval queue for anything above threshold.

> **Live on Stellar mainnet.** Dashboard at [argens.xyz](https://argens.xyz), API at
> `https://api.argens.xyz/v1`.

Closed source, commercial. This repository is private.

---

## Contents

- [What it does](#what-it-does)
- [Repository layout](#repository-layout)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [API surface](#api-surface)
- [Domain rules that bite](#domain-rules-that-bite)
- [Testing & CI](#testing--ci)
- [Deployment](#deployment)
- [Operations runbook](#operations-runbook)
- [Documentation map](#documentation-map)

---

## What it does

Four components:

**1. Smart wallet.** An agent-custodial USDC wallet on Stellar. Argens generates a keypair per
user, encrypts the secret with AES-256-GCM, and signs on the user's behalf so the agent can
transact without a human in the loop. The user can export the private key at any time.

**2. Policy engine.** Three rules enforced in TypeScript before any signature: **Allowance**
(cumulative cap), **Max Transaction** (per-payment cap), and **Approval Threshold** (above this,
email the human and wait). Checks run in that order and fail fast.

**3. REST API.** Any agent can call it with an API key. No blockchain knowledge required — pass a
recipient address and an amount string. Onboarding is a single public file at
[`argens.xyz/SKILL.md`](https://argens.xyz/SKILL.md): point an agent at that URL and it can
integrate itself. There is no SDK in V1, deliberately.

**4. MPP marketplace.** A catalog of ~450 paid AI/data endpoints across ~85 providers, callable and
payable in one step. Argens applies a 20% markup — this is the revenue model. Direct USDC transfers
are free.

Two things Argens can do that are worth calling out: it settles **cross-chain to Base** via Circle's
CCTP V2 (send to a `0x…` address and it burns on Stellar, mints on Base — which makes x402 paywalls
payable from a Stellar wallet), and it enforces the **same policy checks on marketplace calls** as
on direct payments, so an agent can't route around its limits.

### Custody

Argens is **agent-custodial**, not non-custodial. Argens holds the encrypted signing key, because
an autonomous agent cannot sign for itself without one. Say so plainly — the phrase
"non-custodial" must not appear in code, comments, UI strings, or docs. V2's goal is
contract-held funds on Soroban, at which point the policy consult and the payment execution merge
into one atomic call.

---

## Repository layout

```text
argens/
├── apps/
│   ├── api/                    @argens/api — Express + TypeScript backend
│   │   ├── prisma/schema.prisma
│   │   ├── scripts/            marketplace catalog health harness
│   │   └── src/
│   │       ├── routes/         auth, wallet, transactions, policies, approve,
│   │       │                   marketplace, x402, agent, admin
│   │       ├── services/       stellar, payment, policy, wallet, cctp, cctp-relay,
│   │       │                   marketplace, mpp-client, mpp-router, credits,
│   │       │                   email, watcher, alerting
│   │       ├── middleware/     auth (JWT), apikey, ratelimit, validate
│   │       └── lib/            prisma, crypto (AES-256-GCM), errors, response
│   └── web/                    @argens/web — Next.js 14 App Router dashboard
│       ├── app/(auth)/         login, signup
│       ├── app/dashboard/      overview, wallet, policies, transactions,
│       │                       analytics, api-keys, marketplace, settings
│       ├── app/approve/confirm approval landing page (POST-only state change)
│       ├── app/x/…             admin ops console (obscured path)
│       └── public/SKILL.md     the agent onboarding file
├── tasks/                      todo, lessons, decisions, catalog reports
└── CLAUDE.md / AGENTS.md       authoritative build spec for AI agents
```

There is no `contracts/` directory. Soroban was dropped for V1 — see
[Domain rules](#domain-rules-that-bite).

---

## Local development

**Prerequisites:** Node ≥ 20, pnpm ≥ 9, Docker (for Postgres).

```bash
# 1. Install
pnpm install

# 2. Start Postgres
docker compose up -d postgres

# 3. Configure the API
cp .env.example apps/api/.env
#    then generate the two secrets you cannot fake:
openssl rand -hex 32     # → ENCRYPTION_KEY
openssl rand -hex 32     # → JWT_SECRET

# 4. Migrate + generate the Prisma client
pnpm db:migrate

# 5. Run
pnpm dev:api             # → http://localhost:3001
pnpm dev:web             # → http://localhost:3000
```

Set `EMAIL_PROVIDER=ethereal` for local work — it spins up a throwaway inbox and logs a preview URL
to the console instead of sending real mail.

For local Stellar work, set `STELLAR_NETWORK=testnet` and give `ARGENS_OPS_WALLET_SECRET` a
[friendbot](https://friendbot.stellar.org)-funded testnet key, so local runs exercise the same
sponsored-reserve and fee-bump path as production. Leave it empty and wallets fall back to
friendbot funding and pay their own fees — that path never exercises the sponsorship code.

### Common commands

| Command | Does |
| --- | --- |
| `pnpm dev:api` / `pnpm dev:web` | Run API (tsx watch) / dashboard |
| `pnpm build:api` | Compile the API to `dist/` |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:studio` | Prisma Studio |
| `pnpm typecheck` | `tsc --noEmit` across the API |
| `pnpm test` | Vitest |
| `pnpm verify` | Typecheck **and** test — run before every push |

---

## Environment variables

All are read by the API from `apps/api/.env`.

### Required

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | ≥ 32 chars. `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | **64-char hex = 32 bytes.** AES-256-GCM key for Stellar secret keys. Rotating this without re-encrypting orphans every wallet |
| `STELLAR_NETWORK` | `mainnet` \| `testnet` — the single toggle; never hardcode network values anywhere else. The Horizon endpoint is derived from this, not configured separately |
| `SOROBAN_RPC_URL` | Required — the x402 marketplace client uses it to build SEP-41 transfers. Must match the network |
| `FRONTEND_URL` | CORS whitelist origin. Never `*` in production |

### Platform wallets

| Variable | Holds | Purpose |
| --- | --- | --- |
| `ARGENS_OPS_WALLET_SECRET` / `_PUBLIC` | XLM | Sponsors every user wallet's reserves and pays every user transaction fee. **Empty ops wallet = signups and all user payments stop** |
| `ARGENS_FEE_WALLET` | USDC | Receives marketplace markup and CCTP fees. Needs a USDC trustline |
| `ARGENS_CREDIT_POOL_SECRET` / `_PUBLIC` | USDC | Funds marketplace calls made against granted credits |
| `ARGENS_BASE_RELAYER_SECRET` | ETH | Relays CCTP mints on Base |

### Optional

| Variable | Default / notes |
| --- | --- |
| `EMAIL_PROVIDER` | `resend` \| `ethereal` |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Required when `EMAIL_PROVIDER=resend` |
| `RESEND_DEV_OVERRIDE_TO` | Redirect all mail to one inbox while testing |
| `ADMIN_SECRET` | Gates `/v1/admin/*` via the `x-admin-secret` header. Unset ⇒ admin routes return 503 |
| `ADMIN_ALERT_EMAIL` | Destination for ops alerts (refund-needed, low balances) |
| `MPP_ROUTER_BASE_URL` | `https://apiserver.mpprouter.dev` |
| `BASE_RPC_URL` / `BASE_TESTNET_RPC_URL` | CCTP destination-chain RPC |
| `XLM_ALERT_THRESHOLD_OPS`, `USDC_ALERT_THRESHOLD_POOL`, `USDC_ALERT_THRESHOLD_FEE`, `ETH_ALERT_THRESHOLD_RELAYER` | Balance alert floors (ops XLM, credit-pool USDC, fee USDC, Base-relayer ETH) |
| `JWT_EXPIRES_IN` | `1h` — deliberate, paired with the dashboard's 5-minute tab-idle logout. Don't lengthen it without revisiting that pairing |
| `API_PORT`, `NODE_ENV`, `ARGENS_WEB_URL` | `ARGENS_WEB_URL` builds links in emails and skill files; `WEB_URL` is a legacy fallback |

---

## Architecture

### Two auth paths, deliberately separate

| Path | Credential | Used by | Endpoints |
| --- | --- | --- | --- |
| Dashboard | JWT (`Authorization: Bearer <jwt>`) | Next.js frontend | `/wallet/send`, `/policies`, settings, dismiss |
| Agent | API key (`Bearer argns_live_…`) | AI agents | `/pay`, `/quote`, `/refund`, `/pay/x402` |

They do not mix. `POST /pay` is API-key only; `POST /wallet/send` is JWT only (plus an optional
4-digit transfer PIN). Human-initiated and agent-initiated spend stay on separate rails so a
compromised session can't drive the agent path, and vice versa.

API keys are bcrypt-hashed and shown exactly once. Rate limit: 100 req/min per key.

### The payment path

```text
POST /pay
  → API key auth
  → Zod validation
  → detect chain from recipient format   G… = Stellar · 0x… = Base
  → checkPolicyAndReserve()              atomic check + totalSpent reservation
      ├── BLOCKED           → 402, email the user, stop
      ├── PENDING_APPROVAL  → 202, queue + 24h token, email a magic link
      └── APPROVED          ↓
  → sign + submit (Stellar payment, or CCTP burn for Base)
  → verify on Horizon, retry once on failure
  → log the transaction, notify
```

### Marketplace calls (x402 v2)

MPP Router migrated to the x402 v2 payment protocol in June 2026. `services/mpp-client.ts` speaks
it directly:

```text
request → 402 + payment-required challenge
        → onChallenge()  ← policy check, credits, approval gate ALL run here,
                            before anything is signed
        → sign a Stellar SEP-41 transfer credential (@x402/stellar)
        → retry with payment-signature header
        → read settlement receipt
        → Argens collects 20% markup into ARGENS_FEE_WALLET
```

The `onChallenge` placement is the safety property: policy is enforced *before* the credential is
signed or submitted, so a blocked call moves zero funds.

Two failure modes are handled explicitly. If MPP fails before settling, `receipt` is `null` and no
USDC moved. If MPP settled but the upstream service failed, the user paid and got nothing — that
writes `metadata.refund.required = true`, an audit log, and an ops alert. **Refunds are manual by
design.**

### Approval flow

1. Policy returns `PENDING_APPROVAL`; an `ApprovalQueue` row is created with a single-use 24h token.
2. The user is emailed a link to a dashboard confirmation page — **never a direct action URL**.
3. That page renders the transaction and issues `POST /approve/:token` or `POST /reject/:token`.
4. On approve, policy is re-checked, then the payment is signed and submitted.

Step 2 is a security requirement, not a UX preference. Gmail, Outlook, Slack and antivirus scanners
auto-fetch URLs to build previews; a `GET` endpoint that actions an approval *will* be triggered by
a link scanner. `GET /approve/:token` exists but only *reads* the transaction for display.

---

## API surface

Base URL: `http://localhost:3001/v1` · `https://api.argens.xyz/v1`

Every response uses one envelope, without exception:

```jsonc
{ "data": T, "meta": { "page": 1, "total": 42, "pages": 3 } }   // success
{ "error": "…", "code": "…", "details": { } }                   // error
```

**Amounts are always JSON strings with 7 decimals** — `"25.0000000"`, never `25.0`. This applies to
requests and responses alike.

### Agent (API key)

| Method | Path | |
| --- | --- | --- |
| `POST` | `/pay` | Execute a payment. 200 success · 402 blocked · 202 pending approval |
| `POST` | `/quote` | Dry run. No Stellar tx, no DB write |
| `POST` | `/refund` | New outgoing payment, not a reversal — both IDs are logged |
| `POST` | `/pay/x402` | Pay an x402-gated resource |
| `GET` | `/agent/status` | Key status, balance, policies, today's spend |
| `GET` | `/spend/summary` | `?period=daily\|weekly\|monthly` |
| `GET` | `/transactions`, `/transactions/:id` | Filter by status, type, date |
| `POST` | `/marketplace/call` | Call + pay a marketplace service in one step |
| `GET` | `/marketplace/services`, `/marketplace/services/:providerId` | Catalog, searchable |
| `GET` | `/marketplace/services/:providerId/skill.md` | Per-provider agent instructions (public) |

### Dashboard (JWT)

`/auth/*` (signup, verify, login, logout, forgot/reset password, api-keys, me, transfer-pin) ·
`/wallet/balance`, `/wallet/send`, `/wallet/export-key`, `/wallet/bootstrap-retry` ·
`/policies` · `/transactions/:id/dismiss` · `/marketplace/services/:serviceId/enable|disable`

### Admin (`x-admin-secret`)

`/admin/stats`, `/admin/wallets`, `/admin/users`, `/admin/access-codes`, `/admin/credit-grants`,
`/admin/transactions/failed`, `/admin/marketplace/services` (+ per-provider global pause).

---

## Domain rules that bite

Read these before touching payment code. Each one has already cost time.

### Fees

| Path | Argens fee |
| --- | --- |
| Direct Stellar USDC payment | **$0** — single-operation transaction, no fee wallet |
| Marketplace call | **20% markup**, transferred separately to `ARGENS_FEE_WALLET` |
| CCTP cross-chain | `clamp(amount × 0.5%, $0.01, $2.00)` — the wallet is debited `amount + fee`; the Base recipient receives the full `amount` |

### `totalSpent` accounting

`checkPolicyAndReserve` increments `totalSpent` **at check time**, inside a `Serializable`
transaction, so two concurrent payments can't both pass the allowance check. If submission then
fails, `releaseSpend` decrements as a compensating write.

Do not add a second `incrementTotalSpent` anywhere in the CCTP paths — `services/cctp-relay.ts`
owns that call, and duplicating it double-counts spend.

### Money and Stellar

- **Never floating point.** Strings for Stellar, `Decimal` for the DB. `amount * 0.005` is a bug.
- Stellar addresses are 56 chars starting `G`; secrets are 56 chars starting `S`.
- A wallet needs a USDC trustline before it can receive USDC. Bootstrap is **one atomic
  transaction**: the ops wallet sponsors the account and trustline reserves (CAP-33), so user
  wallets hold **0 XLM** and the 1.5 XLM stays locked in the ops wallet.
- **User wallets cannot pay their own fees.** Every user-signed transaction must be submitted
  through `withFeeSponsor` / `submitClassic` (`services/sponsorship.ts`), which wraps it in an
  ops-paid fee-bump. A path that submits directly works for pre-sponsorship wallets and fails
  only for new ones.
- Submission ≠ confirmation. Verify on Horizon. Retry once, then mark `FAILED`.
- Memos max 28 bytes.
- Mainnet USDC issuer: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`

### Never

- Log a secret key, even partially. Never return one in a response.
- Swallow an error, or return `{ status: 'success' }` from a path that didn't succeed.
- Write a placeholder return value in a payment path — `throw new Error('NOT_IMPLEMENTED: …')`
  instead, so it can never silently pass.
- Invent an SDK method. Verify against `node_modules` type definitions first.
- Write "non-custodial" anywhere.

### Soroban is dropped in V1

The TypeScript engine in `services/policy.ts` is the permanent V1 policy engine, not a stand-in.
`Policy.sorobanContractId` is null everywhere, there is no Rust crate, and no contract is deployed.
`CLAUDE.md` § Soroban is explicitly labelled a V2 design sketch — do not implement against it.

---

## Testing & CI

```bash
pnpm verify        # typecheck + test — the pre-push gate
```

Vitest: 50 tests across 6 files — `policy`, `stellar`, `cctp`, `cctp-relay`, plus `lib/crypto` and
`lib/response`.
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs the same gate on push to `main` and on
every PR.

Unit tests are not the bar for payment code. Ten scenarios must pass against a live network before
any payment change ships — within-limits success, each of the three block/threshold paths, approve,
reject, expired token, invalid key, insufficient funds, and a quote on a would-be-blocked
transaction. They are enumerated in `CLAUDE.md` § Testing.

`apps/api/scripts/marketplace-catalog-test.ts` is a committed catalog health harness that exercises
one endpoint per provider through the real `/marketplace/call` path. **It spends real mainnet
USDC** — it has a cumulative spend cap and a `--dry-run` mode. Read the header before running it.

---

## Deployment

| Component | Where |
| --- | --- |
| Dashboard | Vercel, root directory `apps/web`, deployed from GitHub |
| API | VPS via **Dokploy** (not Railway), Docker |
| Database | Postgres on the same VPS |

`apps/api/Dockerfile` runs `prisma migrate deploy` in its `CMD`, so schema migrations apply
automatically on container start. A redeploy is a migration.

Mainnet cut-over checklist — ops wallet funded, fee wallet trustline verified, `ENCRYPTION_KEY`
rotated to a fresh mainnet key, alerting enabled — is in `CLAUDE.md` § Build Order, Phase 6.

---

## Operations runbook

**Monitor these balances.** Each one fails silently:

| Wallet | Runs out ⇒ |
| --- | --- |
| Ops (XLM, **spendable**) | New signups **and every user payment** break — it sponsors reserves and pays all user fees. Watch `xlm_spendable`, not the raw balance |
| Fee (USDC) | Revenue collection fails |
| Credit pool (USDC) | Credit-funded marketplace calls fail |
| Base relayer (ETH) | CCTP mints stop relaying |

`GET /admin/wallets` reports all four.

**Marketplace kill-switch.** `GlobalServiceSetting` pauses a provider platform-wide: it disappears
from `GET /marketplace/services` and `POST /marketplace/call` returns `503
MARKETPLACE_SERVICE_PAUSED`. Toggle it from the ops console or
`POST /admin/marketplace/services/:providerId`. Use it when a provider starts failing upstream —
16 providers are known-broken at MPP's payment layer.

**Diagnosing a failed marketplace call.** `blockedReason` is generic ("MPP Router returned HTTP
502"). The real cause is in `metadata.mpp_router.upstream_body` — shown in the dashboard
transaction drawer (expand a FAILED marketplace row) and the Ops Console Failed tab. Check
`receipt` in the same object: `null` means MPP aborted before settling and **no USDC was charged**.

**Refunds are manual.** A paid-but-undelivered call sets `metadata.refund.required = true`, writes
a `MARKETPLACE_REFUND_REQUIRED` audit log, emails ops, and shows a REFUND NEEDED badge in the
console's Failed tab. Nothing refunds automatically.

**Signup is gated** by an `AccessCode` during beta. Generate codes via `POST /admin/access-codes`.

---

## Documentation map

| File | What it is |
| --- | --- |
| **`CLAUDE.md`** | The authoritative build spec. Anti-hallucination rules, schema, policy logic, settled decisions. Read it before writing code — it overrides everything else, including this README |
| `AGENTS.md` | Same content, for non-Claude agents |
| `tasks/todo.md` | Current task plan |
| `tasks/lessons.md` | Corrections and the rule each one produced. Read at session start |
| `tasks/decisions.md` | Architectural decisions and why |
| `tasks/marketplace-catalog-*.md` | Per-provider catalog health findings |
| `apps/web/public/SKILL.md` | The agent-facing integration file (v7), served at `argens.xyz/SKILL.md` |
| `design.md`, `FRAME.md` | Visual and brand direction |

Two conventions worth keeping: plan non-trivial work in `tasks/todo.md` before writing code, and
after any correction, write the lesson and the preventing rule into `tasks/lessons.md`.

---

## What Argens is not

Not a consumer wallet app. Not an exchange. Not a KYC/AML product. Not an agent hosting platform.
Not a bridge — CCTP V2 is burn-and-mint, and there is no wrapped USDC anywhere in the system. Not a
full multi-chain router in V1: Stellar USDC and Stellar → Base settlement are live; Ethereum,
Solana, Avalanche and CCTP hooks are V2.

And not responsible for what an agent does with the payment capability it's been given. That is the
developer's call — which is exactly why the policy engine exists.
