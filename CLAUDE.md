# CLAUDE.md — Argens

This file is the **single source of truth** for the Claude Code agent building Argens.

**Read this entire file before writing a single line of code.**
**Re-read the relevant sections before starting any new task.**
**When in doubt, re-read this file.**

---

## Status — 2026-06-12

- **Network: Stellar MAINNET.** Live on mainnet. Testnet code paths exist for local-dev parity only.
- **Web app: live on Vercel** at `argens.xyz`. Landing page + full dashboard deployed. `SKILL.md` accessible at `argens.xyz/SKILL.md`. Vercel root directory set to `apps/web` for GitHub-triggered deployments.
- **API: deployed.** Live on a VPS via Dokploy. The live dashboard calls the deployed API for external users.
- **Cross-chain / CCTP V2: implemented locally, direct path verified.** `POST /pay` accepts Stellar `G...` and Base `0x...` recipients. A 0.0100000 USDC mainnet Stellar → Base transfer completed burn, Iris attestation, Base relay, and transaction-history update on 2026-05-27. Direct and approval-token CCTP paths now share a fail-closed preflight: verify live USDC balance >= amount + Argens CCTP fee before sending the fee. Approval-token CCTP path compiles but still needs live approval-path verification.
- **Marketplace: LIVE on mainnet.** 86 providers / 493 endpoints via MPP Router (`apiserver.mpprouter.dev`). Provider-level enablement toggles. Search/filter on `GET /marketplace/services`. All policy paths verified E2E. ~20% markup to `ARGENS_FEE_WALLET`.
- **Marketplace credits: LIVE.** Admin can grant expirable credits. Marketplace calls can consume credits via the credit-pool wallet, refund deductions on no-payment failure paths, and re-check credits at approval execution. The credit-pool Stellar account is bootstrapped and funded on mainnet and has been working well.
- **Credit-grant emails: implemented locally.** Admin credit grants send an immediate user notification with amount, expiry, reason, and dashboard link after the DB transaction commits.
- **Admin ops console: implemented.** Backend admin balance route was repaired on 2026-06-03. Ops wallet, fee wallet, Base relayer, and credit-pool wallet balances all read successfully.
- **SKILL.md: v5 local.** Documents CCTP response shapes, Base recipient rules, fee behavior, per-service skill discovery, `/docs`, and `/llms.txt`.
- **Approval flow: fixed.** `GET /approve/:token` is public (no JWT). Approval email contains magic link → dashboard confirm page → `POST /approve/:token` or `POST /reject/:token`. Token is the bearer credential.
- **Email validation: live.** Signup rejects disposable domains and addresses that fail DNS MX check.
- **What is NOT done yet:** approval-token CCTP live verification, example payloads, demo Loom, ops/XLM/credit-pool alerting, wallet-funded SSE E2E, low-balance email E2E.

---

## Table of Contents

1. [What Is Argens](#what-is-argens)
2. [Anti-Hallucination Rules](#anti-hallucination-rules) ← READ THIS FIRST
3. [Workflow Orchestration](#workflow-orchestration)
4. [Task Management](#task-management)
5. [Tech Stack](#tech-stack)
6. [Wallet & Policy Architecture — At a Glance](#wallet--policy-architecture--at-a-glance)
7. [Project Structure](#project-structure)
8. [Database Schema](#database-schema)
9. [API Reference](#api-reference)
10. [Agent Onboarding](#agent-onboarding)
11. [Policy Engine Logic](#policy-engine-logic)
12. [Notifications](#notifications)
13. [Stellar Integration](#stellar-integration)
14. [CCTP V2 — Cross-Chain Payments](#cctp-v2--cross-chain-payments)
15. [Soroban Contract](#soroban-contract-policy-engine)
16. [Environment Variables](#environment-variables)
17. [Build Order](#build-order)
18. [Code Standards](#code-standards)
19. [Security Rules](#security-rules--non-negotiable)
20. [Testing](#testing)
21. [Key Decisions](#key-decisions-already-made)
22. [What Argens Is NOT](#what-argens-is-not)

---

## What Is Argens?

Argens is a programmable payment infrastructure platform for autonomous AI agents. It gives AI agents the ability to spend USDC autonomously on the Stellar blockchain, within human-defined spending policies enforced by Soroban smart contracts.

**One-line pitch:** Argens gives your AI agent the ability to pay — an API key that authorizes autonomous USDC spending on Stellar, within rules you define.

**Three components:**
1. **Smart Wallet** — **agent-custodial** USDC wallet on Stellar. Argens holds an encrypted signing key so agents can transact autonomously within policy. Developer funds the wallet with USDC, and can export the private key at any time. Manual dashboard transfers are also supported (with optional 4-digit transfer PIN).
2. **Policy Engine** — TypeScript-enforced spending rules. Three rules in V1: Allowance, Max Transaction, Approval Threshold. This is the permanent V1 policy engine — Soroban was dropped (see Key Decisions).
3. **REST API** — any AI agent can call with just an API key. No blockchain knowledge required.
4. **MPP Marketplace** — a curated catalog of AI services (LLMs, data, tooling) that agents can call and pay for in a single step. Argens applies a ~20% markup — this is the primary revenue model. Direct USDC transfers carry no Argens fee.

> **Custody terminology.** Do not write "non-custodial" in code, comments, user-facing strings, or docs. Use **agent-custodial** and explain the trade-off when asked. This language must stay consistent with the PRD.

---

## Anti-Hallucination Rules

These rules exist to prevent confident but wrong output. Violating them costs more time than following them.

### Rule 1 — Never Invent APIs or SDK Methods

**NEVER** assume a method exists on `@stellar/stellar-sdk`, `soroban-client`, Prisma, or any other library without verifying it first. If you are unsure whether a method exists:

- Check the installed package version in `package.json`
- Read the actual type definitions in `node_modules`
- Use `console.log(Object.keys(sdk))` to inspect available methods if needed
- If still unsure: write a comment `// TODO: verify this method exists` and flag it to the developer

```typescript
// BAD — assuming method exists without checking
await stellarServer.loadAccountOffers(publicKey)

// GOOD — verified against SDK docs before writing
const account = await server.loadAccount(publicKey)
```

---

### Rule 2 — Never Assume Environment State

Never assume:
- A database migration has run
- An environment variable is set
- A Stellar testnet wallet is funded
- A Soroban contract is deployed
- A previous build step succeeded

Always verify state explicitly before depending on it.

---

### Rule 3 — No Placeholder Logic in Payment Paths

**NEVER** write placeholder return values in payment-critical code paths.

```typescript
// BAD — silent lie
async function submitPayment() {
  // TODO: implement
  return { status: 'success', hash: 'fake_hash' }
}

// GOOD — explicit failure so it is never silently skipped
async function submitPayment() {
  throw new Error('NOT_IMPLEMENTED: submitPayment — do not call before Phase 2')
}
```

---

### Rule 4 — Flag Uncertainty Explicitly

If uncertain about a Stellar behaviour, Soroban constraint, or USDC format — say so in a comment rather than guessing silently.

```typescript
// ⚠️ VERIFY: USDC on Stellar uses 7 decimal places. Confirm before production use.
const USDC_DECIMALS = 7
```

---

### Rule 5 — Stellar Facts — Do Not Contradict These

- Stellar addresses: start with `G`, 56 characters long
- Stellar secret keys: start with `S`, 56 characters long
- USDC testnet issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- USDC mainnet issuer: `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`
- Stellar SDK amounts are **strings**, not numbers (`"25.0000000"`)
- A wallet must have a USDC trustline before it can receive USDC
- Minimum account balance: 1 XLM base + 0.5 XLM per trustline
- Transaction memo max: 28 bytes

---

### Rule 6 — Never Swallow Errors

```typescript
// BAD — empty catch
try {
  await submitStellarTransaction(tx)
} catch (e) {}

// BAD — log but lie about success
try {
  await submitStellarTransaction(tx)
} catch (e) {
  console.error(e)
  return { status: 'success' } // lie
}

// GOOD
try {
  const result = await submitStellarTransaction(tx)
  return { status: 'success', hash: result.hash }
} catch (e) {
  await logFailedTransaction(txId, e)
  throw new PaymentError('STELLAR_SUBMISSION_FAILED', e.message)
}
```

---

### Rule 7 — No Floating Point for Money

```typescript
// BAD — floating point errors
const fee = amount * 0.005

// GOOD — string arithmetic for Stellar, Decimal for DB
import { Decimal } from '@prisma/client/runtime/library'
const fee = new Decimal(amount).mul('0.005').toFixed(7)
```

---

### Rule 8 — Verify Before Marking Complete

Before calling any task done, confirm:
- Does the endpoint return the exact response shape in this file?
- Does it handle error cases, not just the happy path?
- Has it been tested against the testnet, not just mocked?
- Would a staff engineer approve this without changes?

If any answer is no — it is not done.

---

## Workflow Orchestration

### 1. Plan Before You Build

For ANY non-trivial task (3+ steps, schema changes, new features, architectural decisions):

1. Write a plan to `tasks/todo.md` with checkable items **before touching code**
2. Check in with the developer before implementing if it involves schema changes, new dependencies, or architectural choices
3. If something goes wrong mid-build — **STOP and re-plan**. Do not keep pushing broken code forward.

**Plan template for `tasks/todo.md`:**
```markdown
## Task: [name]
**Goal:** [one sentence]
**Files affected:** [list]
**Steps:**
- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
**Risks:** [what could go wrong]
**Done when:** [specific, verifiable condition]
```

---

### 2. Self-Improvement Loop

After **any** correction from the developer:

1. Immediately update `tasks/lessons.md` with what went wrong
2. Write a rule that prevents the same mistake
3. Do not repeat the same mistake in the same session

**`tasks/lessons.md` format:**
```markdown
## Lesson [date] — [short title]
**What went wrong:** [description]
**Root cause:** [why it happened]
**Rule going forward:** [specific prevention rule]
```

Review `tasks/lessons.md` at the start of every new session.

---

### 3. Verification Before Done

Never mark a task complete without proving it works:
- Run the endpoint against testnet
- Check the database reflects expected state
- Verify error cases, not just happy path
- For payment flows: verify the Stellar transaction appears on the testnet explorer

---

### 4. Demand Elegance

For non-trivial changes, before submitting: ask "is there a more elegant way?"

If a fix feels hacky, stop and implement the clean solution. Tech debt in payment infrastructure compounds fast.

Skip this for genuinely simple one-line fixes — do not over-engineer.

---

### 5. Autonomous Bug Fixing

When given a bug report:
- Read logs, error messages, and failing tests
- Identify root cause — do not treat symptoms
- Fix it without asking for step-by-step guidance
- Verify the fix resolves the bug
- Update `tasks/lessons.md` if the bug reveals a repeatable pattern

---

### 6. Minimal Impact Principle

Every change should touch **only what is necessary**. No drive-by refactors. No "while I'm in here" changes.

Before committing: diff your changes and confirm — "did I change anything not strictly required for this task?"

---

## Task Management

### File Structure
```
tasks/
├── todo.md       # Current task plan with checkable items
├── lessons.md    # Running log of corrections and rules learned
└── decisions.md  # Architectural decisions made and why
```

### Workflow for Every Task

1. **Plan first** — write to `tasks/todo.md` before touching code
2. **Verify plan** — check in if schema changes or new deps are involved
3. **Track progress** — mark items `[x]` as you go
4. **Explain changes** — high-level summary at each step
5. **Verify done** — prove it works before marking complete
6. **Capture lessons** — update `tasks/lessons.md` after any correction

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS | Use server components where possible |
| Backend | Node.js, Express, TypeScript | Separate service from frontend |
| Database | PostgreSQL via Prisma ORM | See schema below |
| Smart Contracts | Soroban (Rust) | Policy enforcement on-chain |
| Blockchain | Stellar **mainnet** (live) | USDC only in V1; `STELLAR_NETWORK=mainnet` |
| Auth | Custom JWT + bcrypt | No third-party auth in V1 |
| Email | Resend | Transactional emails only |
| Hosting | Vercel (frontend), VPS via Dokploy (backend) | |
| Stellar SDK | @stellar/stellar-sdk | JavaScript/TypeScript |

---

## Wallet & Policy Architecture — At a Glance

A compressed mental model of how wallets and policies actually work in Argens V1. Read before touching any code in `services/wallet.ts`, `services/stellar.ts`, `services/policy.ts`, or `services/soroban.ts`.

### Wallets — plain Stellar keypairs, Argens-custodied

- No third-party wallet provider (no Circle, no Fireblocks, no Freighter). Every wallet is a Stellar keypair generated in the API server with `Keypair.random()` from `@stellar/stellar-sdk`.
- The public key (`G...`, 56 chars) is the wallet address. Stored in the clear in Postgres.
- The secret key (`S...`, 56 chars) is encrypted with AES-256-GCM using `ENCRYPTION_KEY` env var, then stored in `Wallet.stellarSecretKeyEnc`. Decrypted only in memory, only for signing, then wiped.
- This is the **agent-custodial** model: Argens signs on behalf of the user so the agent can transact autonomously.
- The system uses **two** wallet roles. All are just keypairs — the distinction is operational:

| Role | Generated | Holds | Used for |
|---|---|---|---|
| User wallet | By API server on signup | USDC | Signs outgoing payments (agent-driven and dashboard transfers) |
| Ops wallet (`ARGENS_OPS_WALLET`) | Manually, once per env | XLM | Funds 1.5 XLM account reserve + trustline reserve for each new user wallet |

> There is no fee wallet — direct USDC transfers carry $0 Argens fee. Revenue comes from marketplace markup only.

### Policies — stored on-chain, enforced in two places, executed off-chain

Policies go through three separate concerns. Do not conflate them.

**1. Storage — Soroban contract is the source of truth.**
   - When the user saves a policy in the dashboard, the backend calls `PolicyContract.set_policies(...)` on Stellar, then mirrors the values to Postgres's `Policy` table for fast reads.
   - If Postgres and the contract ever disagree, the contract wins. Postgres is a cache.
   - One contract instance per user, deployed lazily on first policy save. Contract ID stored in `Policy.sorobanContractId`.

**2. Enforcement — TypeScript policy engine is permanent in V1. Soroban was dropped.**

   The TypeScript function `checkPolicy(amount, userId)` in `services/policy.ts` reads Postgres and returns `APPROVED / BLOCKED / PENDING_APPROVAL`. This is the final implementation — there is no Phase 4 Soroban swap-out. See Key Decisions.

**3. Execution — always the backend, never the contract (in V1).**

   Even after the Soroban contract is live, the Node backend is what builds and signs the actual Stellar payment (two-op atomic tx: recipient + fee wallet — see [Fee Mechanics](#fee-mechanics)). The contract is consulted but does not move funds.

   Implication: V1's trust model is "Argens backend consults an on-chain policy before signing." A compromised backend could bypass the consult. This is honest, and it's why the custody model is **agent-custodial**, not trustless. V2's goal is to move to contract-held funds and contract-executed payments — at that point the consult and the execution merge into a single atomic contract call.

### The Approval Threshold path is different

Max Transaction and Allowance are straightforward validate-and-block rules. Approval Threshold produces a `PendingApproval` result, which triggers a flow that lives entirely off-chain:

1. Contract/TS check returns `PendingApproval`.
2. Backend writes an `ApprovalQueue` row with a 24h single-use token.
3. Backend sends the user an email with a link to the dashboard confirmation page.
4. User clicks → lands on `/approve/confirm?token=...` → clicks approve or reject → dashboard sends `POST /approve/:token` or `POST /reject/:token`.
5. On approve: backend re-runs policy check, then signs and submits the payment. On reject: tx marked `REJECTED`, no payment.

The Soroban contract participates only in step 1. Everything else is backend + frontend.

### What this means for new code

- Signing the payment is always a backend responsibility. Never try to make the contract move USDC in V1.
- Policy reads for display/analytics: use Postgres. Policy reads for enforcement decisions: use the contract (Phase 4+) or the TS stand-in (Phase 2–3).
- Policy writes: always write to the contract first, then mirror to Postgres. If the contract call fails, the Postgres write must not happen.
- When in doubt about which enforcement model is active, check `STELLAR_NETWORK` and `Policy.sorobanContractId`. If the contract ID is null, the TS stand-in is authoritative; otherwise the contract is.

---

## Project Structure

```
argens/
├── apps/
│   ├── web/                        # Next.js frontend (dashboard)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── signup/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx        # Overview
│   │   │   │   ├── wallet/
│   │   │   │   ├── policies/
│   │   │   │   ├── transactions/
│   │   │   │   ├── analytics/
│   │   │   │   ├── api-keys/
│   │   │   │   └── settings/
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                 # Base UI components
│   │   │   ├── dashboard/          # Dashboard-specific components
│   │   │   └── shared/
│   │   └── lib/
│   │       ├── api.ts
│   │       └── utils.ts
│   │
│   └── api/                        # Express backend
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── wallet.ts
│       │   │   ├── transactions.ts
│       │   │   ├── policies.ts
│       │   │   ├── apikeys.ts
│       │   │   └── analytics.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts         # JWT middleware
│       │   │   ├── apikey.ts       # API key auth middleware
│       │   │   └── ratelimit.ts
│       │   ├── services/
│       │   │   ├── stellar.ts      # Stellar SDK wrapper
│       │   │   ├── policy.ts       # Policy engine
│       │   │   ├── wallet.ts       # Wallet operations
│       │   │   ├── email.ts        # Resend email service
│       │   │   └── soroban.ts      # Soroban contract calls
│       │   ├── lib/
│       │   │   ├── prisma.ts
│       │   │   └── crypto.ts       # AES-256 encryption for private keys
│       │   └── index.ts
│       └── prisma/
│           └── schema.prisma
│
├── contracts/                      # Soroban smart contracts (Rust)
│   └── policy/
│       ├── src/
│       │   └── lib.rs
│       └── Cargo.toml
│
└── tasks/                          # Task management — create on Day 1
    ├── todo.md
    ├── lessons.md
    └── decisions.md
```

---

## Database Schema

```prisma
// prisma/schema.prisma — authoritative as of 2026-05-07

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                      String        @id @default(cuid())
  email                   String        @unique
  passwordHash            String
  emailVerified           Boolean       @default(false)
  emailVerificationToken  String?       @unique
  emailVerificationExpiry DateTime?
  transferPinHash         String?       // bcrypt hash of 4-digit PIN; null = no PIN
  createdAt               DateTime      @default(now())
  updatedAt               DateTime      @updatedAt
  wallet                  Wallet?
  apiKeys                 ApiKey[]
  policies                Policy?
  transactions            Transaction[]
  auditLogs               AuditLog[]
}

model Wallet {
  id                  String        @id @default(cuid())
  userId              String        @unique
  user                User          @relation(fields: [userId], references: [id])
  stellarPublicKey    String        @unique
  stellarSecretKeyEnc String        // AES-256-GCM encrypted — NEVER expose raw
  status              WalletStatus  @default(INITIALISING)
  balanceCache        Decimal       @default(0) @db.Decimal(18, 7)
  balanceCachedAt     DateTime?
  createdAt           DateTime      @default(now())
  transactions        Transaction[]
}

enum WalletStatus {
  INITIALISING       // created in DB, awaiting on-chain bootstrap
  TRUSTLINE_PENDING  // account exists on-chain but USDC trustline failed — retryable
  READY              // account exists + trustline established — can receive USDC
}

model ApiKey {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  keyHash    String    @unique  // bcrypt hash — original never stored after creation
  keyPrefix  String             // First 8 chars for UI e.g. "argns_ab"
  isActive   Boolean   @default(true)
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())
}

model Policy {
  id                  String   @id @default(cuid())
  userId              String   @unique
  user                User     @relation(fields: [userId], references: [id])
  allowanceLimit      Decimal? @db.Decimal(18, 7)  // null = unlimited
  maxTransactionLimit Decimal? @db.Decimal(18, 7)  // null = unlimited
  approvalThreshold   Decimal? @db.Decimal(18, 7)  // null = no threshold
  totalSpent          Decimal  @default(0) @db.Decimal(18, 7)
  sorobanContractId   String?  // reserved for future use; null in V1
  updatedAt           DateTime @updatedAt
}

model Transaction {
  id                String            @id @default(cuid())
  userId            String
  user              User              @relation(fields: [userId], references: [id])
  walletId          String
  wallet            Wallet            @relation(fields: [walletId], references: [id])
  stellarTxHash     String?           // null if blocked before Stellar submission
  recipientAddress  String
  amount            Decimal           @db.Decimal(18, 7)
  // NOTE: no fee field — direct transfers carry $0 Argens fee
  currency          String            @default("USDC")
  status            TransactionStatus
  type              String            @default("payment")  // "payment" | "marketplace"
  serviceId         String?           // marketplace only
  serviceEndpoint   String?           // marketplace only
  costPaid          Decimal?          @db.Decimal(18, 7)   // marketplace: marked-up amount charged to user
  memo              String?
  metadata          Json?
  policyResult      Json?
  blockedReason     String?
  destinationChain  String?           // V2 cross-chain: 'stellar' | 'base' etc.
  destinationTxHash String?           // V2 cross-chain: mint tx hash on destination
  crossChain        Boolean           @default(false)
  createdAt         DateTime          @default(now())
  approvalQueue     ApprovalQueue?
}

enum TransactionStatus {
  SUCCESS
  BLOCKED
  PENDING_APPROVAL
  APPROVED
  REJECTED
  FAILED
}

model ApprovalQueue {
  id            String         @id @default(cuid())
  transactionId String         @unique
  transaction   Transaction    @relation(fields: [transactionId], references: [id])
  userId        String
  status        ApprovalStatus @default(PENDING)
  token         String         @unique  // crypto.randomBytes(32) — expires 24h
  expiresAt     DateTime
  actedAt       DateTime?
  createdAt     DateTime       @default(now())
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  EXPIRED
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  eventType String   // POLICY_UPDATED | API_KEY_REGENERATED | WALLET_FUNDED | etc.
  eventData Json
  createdAt DateTime @default(now())
}
```

---

## API Reference

### Base URL
- Development: `http://localhost:3001/v1`
- Production: `https://api.argens.xyz/v1`

### Authentication

Two distinct auth methods — do not mix them:

**Dashboard routes (JWT):** Issued on login, used by Next.js frontend.
```
Authorization: Bearer <jwt_token>
```

**Agent API routes (API Key):** Used by AI agents. Never expires unless revoked.
```
Authorization: Bearer argns_live_xxxxxxxxxxxxxxxx
```

### Response Envelope

Every response — success or error — must use this exact shape. No exceptions.

```typescript
// Success
{ "data": T, "meta"?: { "page": number, "total": number, "pages": number } }

// Error
{ "error": string, "code": string, "details"?: unknown }
```

---

### Endpoints

#### POST /pay — Execute a payment

**All amount fields are JSON strings with 7 decimals (e.g. `"25.0000000"`). Never numbers. This applies to request bodies and response bodies.**

**Request:**
```json
{
  "recipient": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "amount": "25.0000000",
  "currency": "USDC",
  "memo": "Payment for OpenAI API usage",
  "metadata": {
    "agent_id": "research-agent-01",
    "service": "openai",
    "job_id": "job_abc123"
  }
}
```

No Argens fee on direct payments. The wallet is debited exactly `amount` — single-operation Stellar transaction.

**Success (200):**
```json
{
  "data": {
    "status": "success",
    "transaction_id": "txn_abc123",
    "stellar_tx_hash": "abc...xyz",
    "amount": "25.0000000",
    "recipient": "GXXX...",
    "timestamp": "2026-04-19T12:00:00Z",
    "policy_check": {
      "allowance": "passed",
      "max_transaction": "passed",
      "approval_threshold": "passed"
    }
  }
}
```

**Blocked (402):**
```json
{
  "error": "Transaction blocked by policy",
  "code": "POLICY_BLOCKED",
  "details": {
    "reason": "max_transaction_exceeded",
    "policy": { "max_transaction_limit": "50.0000000", "attempted_amount": "75.0000000" }
  }
}
```

**Pending Approval (202):**
```json
{
  "data": {
    "status": "pending_approval",
    "transaction_id": "txn_abc125",
    "message": "Awaiting developer approval.",
    "poll_url": "/v1/transactions/txn_abc125"
  }
}
```

---

#### POST /quote — Dry run, no execution

Request: identical to POST /pay.
No Stellar transaction, no DB write, no fee.

**Response:**
```json
{
  "data": {
    "status": "would_succeed",
    "amount": "25.0000000",
    "policy_check": {
      "allowance": "would_pass",
      "max_transaction": "would_pass",
      "approval_threshold": "would_pass"
    }
  }
}
```

---

#### POST /wallet/send — Manual dashboard transfer (JWT only)

**Auth:** JWT only (`requireJwt`). Not callable with API key. This keeps agent spend and manual transfers on separate auth paths.

**Request:**
```json
{
  "recipient": "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "amount": "10.0000000",
  "memo": "optional memo",
  "pin": "1234"
}
```
`pin` required only if user has set a transfer PIN (`transferPinHash != null`). Policy check runs the same as `/pay`.

**Success (200):** same envelope as POST /pay (no fee fields).

---

#### GET /wallet/balance
```json
{
  "data": {
    "balance": "492.5000000",
    "currency": "USDC",
    "wallet_address": "GXXX...",
    "cached_at": "2026-04-19T11:55:00Z"
  }
}
```
Note: balance is a **string**, not a number.

---

#### GET /agent/status
```json
{
  "data": {
    "api_key_status": "active",
    "wallet_balance": "492.5000000",
    "policies": {
      "allowance_limit": "500.0000000",
      "allowance_remaining": "492.5000000",
      "max_transaction_limit": "50.0000000",
      "approval_threshold": "100.0000000"
    },
    "today_spend": "7.5000000",
    "today_transactions": 3
  }
}
```

---

#### GET /transactions
Query params: `page`, `limit` (max 100), `status`, `from_date`, `to_date`

---

#### GET /transactions/:id
Full detail including Stellar explorer link.

---

#### GET /policies
```json
{
  "data": {
    "allowance_limit": "500.0000000",
    "max_transaction_limit": "50.0000000",
    "approval_threshold": "100.0000000",
    "total_spent": "7.5000000",
    "soroban_contract_id": "CXXX..."
  }
}
```

---

#### POST /auth/transfer-pin — Set transfer PIN (JWT)
```json
{ "pin": "1234", "password": "current-account-password" }
```
Requires current account password to confirm. PIN is bcrypt-hashed and stored in `User.transferPinHash`.

#### DELETE /auth/transfer-pin — Remove transfer PIN (JWT)
```json
{ "password": "current-account-password" }
```

#### POST /refund
```json
{ "transaction_id": "txn_abc123", "reason": "Service not delivered" }
```
⚠️ Refunds are new outgoing transactions, not reversals. Log both transaction IDs. No Argens fee on refunds.

---

#### GET /spend/summary
Query params: `period` (daily | weekly | monthly)

---

## Agent Onboarding

V1 ships without an SDK. There are two onboarding paths, in order of preference:

### 1. SKILL.md — primary onboarding primitive for V1

Argens exposes a single plain-text file at `https://argens.xyz/SKILL.md` that any AI agent can fetch and read as context. This is the fastest possible agent integration — no package install, no language-specific client, just:

> **"Hi, read https://argens.xyz/SKILL.md and continue with the onboarding steps."**

The agent fetches the file, loads it into its context, and now understands the full Argens API surface. It then asks the user for their API key and starts transacting.

**Why this works for agents specifically:**
- Agents already have web-fetch as a core capability. Reading a URL is zero new plumbing.
- The file fits naturally inside an LLM context window (target: under 6,000 tokens).
- Language-agnostic — no "we only support Node/Python" problem.
- Updates to the API are propagated instantly: agents re-fetch and get the latest. No client version drift.
- The prompt itself becomes the integration: *one line, paste into any agent*.

**`SKILL.md` contents** (host at `https://argens.xyz/SKILL.md` — plain text, `Content-Type: text/markdown`):

- One-paragraph product overview ("Argens is a payment API for AI agents…")
- Authentication — *"Ask the user for their `ARGENS_KEY` (format: `argns_live_...`). Set it as `Authorization: Bearer <key>`."*
- Base URL — `https://api.argens.xyz/v1`
- The five endpoints an agent actually needs: `POST /pay`, `POST /quote`, `GET /wallet/balance`, `GET /agent/status`, `GET /transactions/:id`. Full request and response shapes in JSON.
- Amount format rule (strings, 7 decimals).
- Chain detection rule: `G...` Stellar address → Stellar payment; `0x...` EVM address → Base USDC via CCTP V2. Agent passes the recipient address as-is — Argens routes automatically.
- How to interpret the three response outcomes: 200 success, 402 policy-blocked (do not retry), 202 pending-approval (poll `poll_url`).
- Cross-chain success returns both `stellar_tx_hash` (burn tx) and `destination_tx_hash` (Base mint tx).
- An onboarding-step section the agent walks the user through:
  1. "Do you have an Argens account? If not, point them to `https://argens.xyz/signup`."
  2. "Ask them for their API key."
  3. "Call `GET /agent/status` to verify the key works and show them their current policies + balance."
  4. "You're ready. Describe what you're about to do before calling `/pay` for the first time."
- A short "things to never do" list: never log the key, never ignore a 402, never retry a 402, never call `/pay` without explaining the amount to the user first.

**Implementation:**
- `SKILL.md` lives in the `apps/web/public/` directory and is served directly at `/SKILL.md` from the Next.js site. Also exposed at `https://argens.xyz/SKILL.md`.
- Versioning: the file contains a `# Argens Skill — vN — updated YYYY-MM-DD` header. Bump `N` on any breaking change; keep `v1`, `v2` side by side if older agents reference them (`/SKILL.v1.md`).
- Keep the file under 6,000 tokens. If it grows larger than that, split the verbose reference examples into a linked `/SKILL-examples.md`.
- Do not add a login wall, auth check, or rate limit to this endpoint. It must be trivially fetchable by any user agent.
- CORS: `Access-Control-Allow-Origin: *` — this file is intentionally public.

### 2. Direct REST calls

Developers integrating manually (without an agent) use the REST API directly. This is what the API Reference section above documents.

### 3. SDK — V2

An `@argens/sdk` npm package (and Python equivalent) is on the V2 roadmap. It will wrap the REST API with typed clients and convenience helpers. **Not built in V1.** The SKILL.md path deliberately makes the SDK feel less urgent — agents onboard faster with SKILL.md than with any SDK, because they don't need to install anything.

---

## Policy Engine Logic

The most critical business logic in the codebase. Implement exactly as specified.

### Check Order

First failure stops processing immediately. Checks run in this order:

```
1. MAX TRANSACTION CHECK
   IF policy.maxTransactionLimit IS SET
   AND amount > policy.maxTransactionLimit
   THEN status = BLOCKED, reason = max_transaction_exceeded
        → send blocked notification email, return immediately

2. ALLOWANCE CHECK
   IF policy.allowanceLimit IS SET
   AND amount > (policy.allowanceLimit - policy.totalSpent)
   THEN status = BLOCKED, reason = allowance_exceeded
        → send blocked notification email, return immediately

3. APPROVAL THRESHOLD CHECK
   IF policy.approvalThreshold IS SET
   AND amount >= policy.approvalThreshold
   THEN status = PENDING_APPROVAL
        → create approval_queue entry with 24h token
        → send approval request email with approve/reject links
        → return immediately

4. ALL CHECKS PASSED
   → submit Stellar transaction
   → on Stellar success: status = SUCCESS, increment policy.totalSpent
   → on Stellar failure: status = FAILED, log full error, notify developer
```

### Critical: totalSpent Update Rule

`policy.totalSpent` increments ONLY when a transaction reaches `SUCCESS` status. Never for `PENDING_APPROVAL`, `BLOCKED`, or `FAILED`. If a `PENDING_APPROVAL` transaction is later `APPROVED` and executes, increment `totalSpent` at execution time.

`policy.totalSpent` tracks the **requested amount only**. There is no Argens fee on direct payments — nothing else to exclude.

**Reservation semantics (implemented in `services/policy.ts`).** `checkPolicyAndReserve` atomically checks policy AND increments `totalSpent` in a single `Serializable` transaction so concurrent payments cannot both pass the allowance check independently. The increment happens at check time, not at Stellar submission time. If Stellar submission fails, `releaseSpend` decrements `totalSpent` as a compensating write. For CCTP cross-chain payments via `POST /pay`, the reservation is made at check time (`incrementOnSuccess: false` in the relay executor). For CCTP payments routed through the approval flow (`POST /approve/:token`), `totalSpent` is incremented inside the relay executor on SUCCESS (`incrementOnSuccess: true`). Do not add a second `incrementTotalSpent` call in either path — the relay executor (`services/cctp-relay.ts`) owns that call.

---

## Notifications

All notifications are sent via Resend. Every notification is idempotent (same trigger → same email ID → deduped by Resend) and rate-limited where noted.

| Trigger | Timing | Rate limit |
|---|---|---|
| Email verification (on signup) | Immediate | Rate-limited per email to 3/hour to prevent spam |
| Wallet funded (incoming USDC detected) | Within 60s of deposit | 1 per user per 5 min (batches rapid deposits) |
| Transaction blocked (policy violation) | Immediate | None — rare, high-signal |
| Transaction pending approval | Immediate — contains link to dashboard confirmation page | None |
| Approval acted on (approved/rejected) | Immediate | None |
| Low balance warning | On transaction, when `balanceCache < max(10 USDC, 10% of remaining allowance)` | 1 per user per 24h |
| API key regenerated | Immediate | None |
| Policy changed | Immediate | None |

**Wallet-funded detection mechanism.** Argens subscribes to Horizon's payments SSE stream per active wallet: `/accounts/{publicKey}/payments?cursor=now`. On an incoming USDC payment, it invalidates `balanceCache`, writes an AuditLog entry, and sends the email (subject to rate limit). If the SSE stream drops, a 60s fallback poller reads `/accounts/{publicKey}/payments?cursor={lastSeen}` to catch missed events. Never rely on polling alone — SSE gives sub-second latency, poll is a backstop.

**Approval email security.** Emails **must not** contain direct `GET` action URLs. The email contains a link to a dashboard confirmation page (`https://app.argens.xyz/approve/confirm?token=...`) that renders the transaction detail and submits `POST /approve/:token` or `POST /reject/:token` from a form. See [Security Rules](#security-rules--non-negotiable).

---

## Stellar Integration

### Non-Negotiable Rules

- Every Stellar SDK call is wrapped in `try/catch`
- Never log private keys or secret keys — not even partially
- Stellar SDK amounts are always **strings** — never numbers
- Create USDC trustline immediately after wallet creation
- Verify transaction on Horizon after submission — submission ≠ confirmation
- Retry failed Stellar submissions **once** before marking FAILED
- Network toggled via `STELLAR_NETWORK` env var — never hardcoded

### Network Setup

```typescript
import { Horizon, Networks, Keypair, TransactionBuilder,
         Operation, Asset, Memo, BASE_FEE } from '@stellar/stellar-sdk'

const NETWORK = process.env.STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet'

const HORIZON_URL = NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org'

const NETWORK_PASSPHRASE = NETWORK === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET

// ⚠️ VERIFY these before mainnet deployment
const USDC_ISSUER = NETWORK === 'mainnet'
  ? 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
  : 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

export const USDC_ASSET = new Asset('USDC', USDC_ISSUER)
```

### Wallet Creation

```typescript
export function createStellarWallet() {
  const keypair = Keypair.random()
  return {
    publicKey: keypair.publicKey(),  // G..., 56 chars
    secretKey: keypair.secret()      // S..., 56 chars — encrypt before storing
  }
}
```

### USDC Trustline (required before wallet can receive USDC)

```typescript
async function createUsdcTrustline(secretKey: string): Promise<void> {
  const keypair = Keypair.fromSecret(secretKey)
  const server = new Horizon.Server(HORIZON_URL)
  const account = await server.loadAccount(keypair.publicKey())
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE
  })
    .addOperation(Operation.changeTrust({ asset: USDC_ASSET }))
    .setTimeout(30)
    .build()
  tx.sign(keypair)
  await server.submitTransaction(tx)
}
```

### Payment Submission (fee-free, single operation)

Direct payments are a **single-operation Stellar transaction** — one payment op to the recipient. No fee wallet, no second op.

```typescript
async function submitPayment(params: {
  senderSecretKey: string
  recipientPublicKey: string
  amount: string    // STRING — "25.0000000"
  memo?: string     // max 28 bytes
}): Promise<{ hash: string; ledger: number }> {
  const keypair = Keypair.fromSecret(params.senderSecretKey)
  const server = new Horizon.Server(HORIZON_URL)
  const account = await server.loadAccount(keypair.publicKey())

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE
  })
    .addOperation(Operation.payment({
      destination: params.recipientPublicKey,
      asset: USDC_ASSET,
      amount: params.amount
    }))
    .setTimeout(30)

  if (params.memo) builder.addMemo(Memo.text(params.memo))

  const tx = builder.build()
  tx.sign(keypair)
  const result = await server.submitTransaction(tx)
  return { hash: result.hash, ledger: result.ledger ?? 0 }
}
```

**Retry policy:** retry once on failure before marking FAILED (already implemented in `services/payment.ts`).

### Wallet Bootstrap Flow

A new Stellar account cannot hold USDC until two conditions are met: (1) the account exists on-chain with ≥1 XLM base reserve, (2) it has a USDC trustline with 0.5 XLM reserve. Both must be funded by Argens on behalf of the user on signup.

**Bootstrap sequence (part of `POST /auth/signup`):**

```
1. Generate keypair in memory:
     const { publicKey, secretKey } = createStellarWallet()
2. Encrypt secretKey and persist to DB (Wallet row, status = 'initialising')
3. From ARGENS_OPS_WALLET, send 1.5 XLM (createAccount op) to publicKey
     → this creates the account on Stellar
4. Using the user's secretKey, submit a changeTrust op for the USDC asset
     → trustline established; wallet can now receive USDC
5. Mark Wallet row status = 'ready'
6. Return the public key in the signup response
```

**Failure handling:**
- If step 3 fails (ops wallet out of XLM, Horizon down), roll back: delete the Wallet row, return 503 with a clear error. Never leave a Wallet row in `initialising` state permanently. Alert ops.
- If step 4 fails but step 3 succeeded, retry step 4 once. If still failing, mark the Wallet row `trustline_pending` and expose a dashboard action for the user to retry manually. The account is recoverable — the XLM is not lost.
- Both ops wallets (`ARGENS_OPS_WALLET` for XLM, `ARGENS_FEE_WALLET` for USDC) must exist and be funded before the API is deployed. Document their public keys in the deployment runbook.

**Cost per signup (mainnet):** 1.5 XLM in reserves per wallet, plus tiny tx fees (~0.00002 XLM). At current XLM prices, sub-$0.20 per user. Deliberately absorbed by Argens as a CAC cost — developers see "instant wallet ready to receive USDC" without paying anything first.

⚠️ **On testnet**, use friendbot (`https://friendbot.stellar.org?addr=<PUBLIC_KEY>`) to fund accounts instead of the ops wallet. Keep the ops-wallet code path for mainnet parity.

### Argens-Operated Wallets

Argens runs one platform-level Stellar wallet — NOT a user wallet:

| Wallet | Purpose | Holds | Must Have Trustline? |
|---|---|---|---|
| **Ops Wallet** (`ARGENS_OPS_WALLET`) | Funds new user account reserves + trustline reserves on signup | XLM | No |

Monitor and alarm on XLM balance. A depleted ops wallet silently breaks new signups.

### Private Key Encryption

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes

export function encryptSecretKey(secretKey: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(secretKey, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), encrypted.toString('hex'), tag.toString('hex')].join(':')
}

export function decryptSecretKey(enc: string): string {
  const [ivHex, encHex, tagHex] = enc.split(':')
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final()
  ]).toString('utf8')
}
```

---

## CCTP V2 — Cross-Chain Payments

> **STATUS — 2026-05-26: implemented locally, direct path verified.** `POST /pay` accepts Stellar `G...` and Base `0x...` recipients. Direct-approved Stellar → Base CCTP completed on mainnet with burn + Iris attestation + Base relay. Approval-token CCTP path is implemented and builds, but still needs live approval-path verification before calling it fully done.

CCTP V2 allows USDC to move natively between Stellar and 15+ chains via Circle's burn-and-mint mechanism. No bridges. No wrapped tokens. No wrapped USDC.

### V1 scope — Base settlement only

**Base USDC settlement is V1.** An agent with a Stellar/Argens wallet can pay any recipient on Base by sending a standard `POST /pay` with a `0x...` address. Argens detects the destination chain automatically and routes via CCTP V2. From the agent's perspective: one API call, USDC arrives on Base.

This directly enables **x402 paywall support** — the emerging HTTP payment standard on Base requires USDC on Base. Argens agents can pay x402-gated APIs natively without the agent knowing anything about Base.

**Full multi-chain routing (Ethereum, Solana, Avalanche, hooks) is V2.** Base is the priority because of x402 and because CCTP V2 is already live on Stellar testnet + Base Sepolia — meaning the demo runs free on testnet today.

### The cross-chain payment flow

```
Agent: POST /pay { recipient: "0xABC...123", amount: "25.0000000" }
                           ↓
Argens detects 0x address → Base via CCTP V2
                           ↓
Argens burns 25 USDC on Stellar (user's wallet, same 2-op atomic tx structure)
                           ↓
Circle attests the burn (Fast Transfer — near-instant)
                           ↓
25 USDC minted natively on Base to 0xABC...123
                           ↓
Returns stellar_tx_hash + destination_tx_hash
```

### Chain detection — V1

Auto-detected from recipient address format. No `chain:` param required in V1.

```typescript
function detectChain(recipient: string): 'stellar' | 'base' {
  if (recipient.startsWith('G') && recipient.length === 56) return 'stellar'
  if (recipient.startsWith('0x') && recipient.length === 42) return 'base'
  throw new Error(`Cannot detect destination chain from recipient: ${recipient}`)
}
```

⚠️ **VERIFY before building:** Confirm the exact Circle CCTP V2 JavaScript/TypeScript SDK package name and API against Circle's developer docs (`developers.circle.com/stablecoins/docs/cctp-getting-started`) before writing any CCTP integration code. Do not assume method names exist. Rule 1 applies.

### Fee handling for cross-chain payments

Circle's CCTP V2 can charge a protocol fee depending on route and amount. V1 does **not** add an Argens direct-payment fee to CCTP payments. Marketplace markup remains marketplace-only.

```
total_debited = amount
// Any CCTP protocol fee is handled inside the burn/mint path via max_fee.
```

### Cross-chain success response

```json
{
  "data": {
    "status": "cross_chain_pending",
    "transaction_id": "txn_abc123",
    "stellar_tx_hash": "abc...xyz",
    "destination_chain": "base",
    "message": "USDC burned on Stellar. Relay to Base is in progress.",
    "poll_url": "/v1/transactions/txn_abc123"
  }
}
```

After the relay completes, `GET /transactions/:id` returns:

```json
{
  "data": {
    "status": "SUCCESS",
    "stellar_tx_hash": "abc...xyz",
    "destination_tx_hash": "0xdef...456",
    "amount": "25.0000000",
    "recipient": "0xABC...123",
    "destination_chain": "base",
    "cross_chain": true,
    "timestamp": "2026-04-19T12:00:00Z"
  }
}
```

### Testnet setup for demo

- Stellar testnet → Base Sepolia via CCTP V2 testnet
- No real money required on either chain
- Circle testnet USDC faucet: `https://faucet.circle.com`
- Base Sepolia faucet: `https://www.alchemy.com/faucets/base-sepolia`
- CCTP V2 testnet contracts are live — verify addresses at `developers.circle.com`

### V2 additions (not V1)

- Explicit `chain:` param to override auto-detection
- CCTP Hooks — trigger contract execution on Base after USDC arrives
- Multi-chain routing beyond Base (Ethereum, Solana, Avalanche, 11+ others)
- Per-chain fee display in `/quote`

The V1 schema already includes nullable `destinationChain`, `destinationTxHash`, and `crossChain` fields. No schema migration needed for V2 chain expansion.

---

## Soroban Contract (Policy Engine)

The Soroban contract stores policies on-chain and **validates** payment attempts. **It does not hold funds and does not execute the Stellar payment** in V1. The API server, after receiving an `Approved` result from the contract, builds and submits the native Stellar payment (see [Payment Submission](#payment-submission-with-fee)).

This split is deliberate:
- The contract is the **source of truth** for policy — visible on-chain, auditable, tamper-evident.
- The API server is the **executor** — it holds the signing key (agent-custodial model) and composes the two-op atomic payment (recipient + fee).
- A V2 migration to contract-held funds (true user-custodial) replaces the executor step with a contract call, without changing the validation contract. Keep the validation surface narrow so V2 doesn't break V1 data.

```rust
// contracts/policy/src/lib.rs

pub trait PolicyContract {
    fn initialize(env: Env, owner: Address) -> Result<(), Error>;

    fn set_policies(
        env: Env,
        allowance_limit: Option<i128>,
        max_transaction_limit: Option<i128>,
        approval_threshold: Option<i128>,
    ) -> Result<(), Error>;

    fn validate_payment(
        env: Env,
        amount: i128,
        total_spent: i128,
    ) -> Result<ValidationResult, Error>;

    fn get_policies(env: Env) -> Policies;
}

pub enum ValidationResult {
    Approved,
    Blocked(BlockReason),
    PendingApproval,
}

pub enum BlockReason {
    MaxTransactionExceeded,
    AllowanceExceeded,
}
```

**Deployment notes:**
- The TypeScript policy engine (Phase 2) is a stand-in only — replace with Soroban calls in Phase 4
- Deploy to testnet first, verify all paths before mainnet
- Store deployed contract ID in `policies.sorobanContractId`
- The contract never receives or sends USDC in V1 — don't add payment logic to it. Payment execution stays in the Node API server.

---

## Environment Variables

```env
# apps/api/.env

DATABASE_URL="postgresql://user:pass@localhost:5432/argens"

JWT_SECRET="minimum-32-character-random-string"
JWT_EXPIRES_IN="1h"   # 1 hour — client-side tab-idle logout (5 min) is primary defense

# Live on mainnet. (Testnet values kept here as a comment for local-dev parity:
#   STELLAR_NETWORK="testnet" / HORIZON_URL="https://horizon-testnet.stellar.org")
STELLAR_NETWORK="mainnet"
HORIZON_URL="https://horizon.stellar.org"
SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"   # unused in V1 — Soroban dropped

ENCRYPTION_KEY="generate-with: openssl rand -hex 32"

RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@argens.xyz"

API_PORT=3001
FRONTEND_URL="http://localhost:3000"

# --- Argens-operated Stellar wallets ---
# Ops wallet — funds XLM reserves for new user wallets on signup.
# On testnet, leave empty and bootstrap uses friendbot instead.
# On mainnet, MUST be set and funded before deployment.
ARGENS_OPS_WALLET_SECRET="S..."     # 56-char Stellar secret key
ARGENS_OPS_WALLET_PUBLIC="G..."     # 56-char Stellar public key (for monitoring)

# NOTE: No fee wallet. Direct USDC transfers carry $0 Argens fee.
# Revenue comes from marketplace markup only (handled in marketplace service, not payment.ts).
```

---

## Build Order

Build in this exact order. Do not skip phases.

### Phase 1 — Foundation (Days 1–3)
- [ ] Create `tasks/todo.md`, `tasks/lessons.md`, `tasks/decisions.md`
- [ ] Monorepo setup (npm workspaces)
- [ ] PostgreSQL + Prisma schema + initial migration
- [ ] Express server scaffolding with TypeScript
- [ ] `POST /auth/signup` — create user (emailVerified=false), send verification email with token. No wallet created yet.
- [ ] `GET /auth/verify/:token` — verify email → trigger wallet bootstrap (account creation + trustline) → return wallet public key
- [ ] `POST /auth/resend-verification` — generate a new token, invalidate old one, email it
- [ ] `POST /auth/login` — return JWT. Unverified users can log in but cannot generate API keys or access agent endpoints.
- [ ] `POST /auth/logout`
- [ ] Stellar ops-wallet setup (fund on testnet via friendbot; mainnet funded manually)
- [ ] Stellar wallet creation + bootstrap flow (see [Wallet Bootstrap Flow](#wallet-bootstrap-flow))
- [ ] USDC trustline creation as part of bootstrap
- [ ] API key generation service (`argns_live_` prefix + bcrypt hash) — gated behind emailVerified=true

### Phase 2 — Core API (Days 4–8)
- [ ] Policy engine service in TypeScript (Soroban stand-in for now)
- [ ] `POST /pay` — full flow: auth → chain detection → policy check → Stellar tx (or CCTP V2 burn for Base recipients) → log → notify
- [ ] `POST /quote` — dry run, no DB write, no Stellar tx. Returns `destination_chain` and `cross_chain` fields when recipient is a Base address.
- [ ] `GET /wallet/balance` — Horizon query with 30s cache
- [ ] `GET /agent/status`
- [ ] `GET /transactions` + `GET /transactions/:id`
- [ ] `GET /policies`
- [ ] `GET /spend/summary`
- [ ] `POST /refund`
- [ ] Email service via Resend (blocked tx, pending approval, approval confirmation, low balance, wallet funded, API key regenerated, policy changed templates)
- [ ] Wallet-funded detection: Horizon payment stream watcher (SSE) per wallet, 60s polling fallback. On incoming USDC payment: invalidate `balanceCache`, send "wallet funded" email (rate-limited to one per 5 minutes to batch rapid deposits)
- [ ] Low-balance warning: triggered on any transaction that leaves `balanceCache` below `max(10 USDC, 10% of remaining allowance)`. Rate-limited to one email per user per 24h.
- [ ] Approval queue — `POST /approve/:token` + `POST /reject/:token` (POST only — see [Security Rules](#security-rules--non-negotiable)) + `GET /approve/confirm?token=...` landing page on the dashboard
- [ ] Rate limiting — 100 req/min per API key
- [ ] Zod input validation on all endpoints
- [ ] `SKILL.md` authored and served at `/SKILL.md` from the Next.js web app (see [Agent Onboarding](#agent-onboarding)). Test by fetching in a fresh chat and walking through onboarding with a real API key.
- [ ] All 10 test scenarios passing (see Testing section)

### Phase 3 — Dashboard (Days 9–16)
- [ ] Next.js 14 + Tailwind CSS setup
- [ ] Auth pages: login, signup
- [ ] Protected layout + sidebar navigation
- [ ] Overview page
- [ ] Wallet page — balance, deposit address, QR code, private key download (one-time)
- [ ] Policies page — edit inline, save, pending approval queue
- [ ] Transactions page — table, filters, pagination, CSV export
- [ ] Analytics page — Recharts spend chart, blocked tx breakdown
- [ ] API Keys page — masked key, copy, regenerate
- [ ] Settings page — notifications, password, danger zone

### Phase 4 — MPP Marketplace (Tranche 1)
- [ ] Read MPP docs: `mpp.dev/overview`, `mpp.dev/payment-methods/stellar/charge`, `mpp.dev/api/services` before writing any code
- [ ] `POST /marketplace/call` — agent calls a service by ID, Argens proxies + adds markup, policy check runs, payment logs as type=marketplace
- [ ] Marketplace service registry (curated list of services with base cost + marked-up price)
- [ ] `GET /marketplace/services` — list available services
- [ ] Dashboard marketplace page
- [ ] End-to-end test: agent calls service → policy check → payment logged → balance updated

### Phase 5 — Polish & Demo
- [ ] Error handling audit — every endpoint handles error cases
- [ ] Consistent error response format across all endpoints verified
- [ ] Demo script: signup → fund → set policies → agent pays → agent blocked → developer approves → analytics
- [ ] Record Loom demo video for SCF submission

### Phase 6 — Mainnet Cut-Over (Days 23–25)
- [ ] Verify mainnet USDC issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` against Circle's published list
- [ ] Provision mainnet ops wallet, fund with XLM (estimate: 1.5 XLM × expected signups + buffer)
- [ ] Provision mainnet fee wallet, create USDC trustline manually, verify on Stellar Expert
- [ ] Deploy Soroban contract to mainnet, verify the ABI matches the TS client, pin contract ID in env
- [ ] Rotate `ENCRYPTION_KEY` to a fresh mainnet key — never reuse the testnet key
- [ ] Switch `STELLAR_NETWORK=mainnet` in prod env, redeploy
- [ ] Smoke test: signup → verify email → wallet bootstrap → fund with a small amount of real USDC → send $1 payment → confirm on mainnet explorer → policy violation path → refund path
- [ ] Run full 10 test scenarios against mainnet — no mocks
- [ ] Enable balance alerting on ops wallet (XLM) and fee wallet (USDC)
- [ ] Announce mainnet availability, onboard first external user
- [ ] Post-launch: monitor Stellar submission failure rate for 72 hours before calling it done

### Phase Transition Gates

**Do not start the next phase until the previous phase's verification bar is met.** Specifically:

| Before starting | You must have |
|---|---|
| Phase 2 | Phase 1 complete + every auth/bootstrap flow exercised on testnet |
| Phase 3 | Phase 2 complete + all 10 test scenarios passing on testnet |
| Phase 4 (Marketplace) | Phase 3 complete + MPP docs read + dashboard end-to-end demo runs cleanly |
| Phase 5 (Polish) | Phase 4 complete + at least one marketplace service callable end-to-end |
| Phase 6 (Mainnet) | Phase 5 complete + Loom demo recorded + all open bugs triaged |

If a phase gate fails, **stop and fix it** — do not paper over with Phase N+1 work. Violations of this rule are the single largest source of shipping regressions in payment infra.

---

## Code Standards

### TypeScript
- Strict mode in `tsconfig.json`
- No `any` — use proper interfaces or `unknown`
- All async functions in `try/catch`
- All `catch` blocks do something meaningful — never empty
- Zod validation on every request body

### Error Format

Every error response without exception:
```typescript
{ error: string, code: string, details?: Record<string, unknown> }
```

### Naming
- Route files: `kebab-case.ts`
- Service files: `camelCase.ts`
- Database models: `PascalCase`
- Env vars: `SCREAMING_SNAKE_CASE`
- API response keys: `snake_case`
- TypeScript interfaces: `PascalCase`

### Logging

Structured logs. Always include `userId` and context. Never log sensitive data.

```typescript
// GOOD
logger.error('Payment failed', { userId, transactionId, error: e.message })

// BAD
console.log('error', e)
```

---

## Security Rules — Non-Negotiable

- **Private keys** — never logged, never in responses, never to frontend, encrypted at rest always
- **API keys** — bcrypt hash only. Original shown once on creation. Never retrievable after.
- **Approval tokens** — `crypto.randomBytes(32).toString('hex')`. Expire 24h. Single use.
- **Rate limiting** — 100 req/min per API key. Enforced in middleware before business logic.
- **Database** — Prisma only. No raw SQL. No string interpolation in queries.
- **Input validation** — Zod on every endpoint. Reject unknown fields.
- **JWT secrets** — minimum 32 chars. Always from environment. Never hardcoded.
- **CORS** — whitelist `FRONTEND_URL` only. Never `*` in production.
- **Approval links in email — NEVER `GET` state-change.** Email clients and link-scanners (Gmail, Outlook, antivirus, Slack previews) auto-fetch URLs to generate previews. A `GET /approve/:token` endpoint that actions the approval will be triggered accidentally by scanners. The email link must point to a dashboard landing page (`/approve/confirm?token=...`) that shows the transaction detail and requires the user to click a button that issues a `POST /approve/:token` with a CSRF-safe payload. Same for `/reject`. Tokens remain single-use and 24h-expiring regardless.
- **Ops wallet secret** — treat like any production credential. Never commit. Rotate if exposed. Access limited to production env. Balance alerting is mandatory — if the ops wallet runs out of XLM, new signups silently break.

---

## Testing

### Stellar Testnet Setup
1. Create wallet: https://laboratory.stellar.org/#account-creator
2. Fund with XLM: `https://friendbot.stellar.org?addr=<PUBLIC_KEY>`
3. Get testnet USDC: https://developers.circle.com/stablecoins/docs/usdc-on-test-networks

### Required Test Scenarios — All Must Pass Before Phase 2 Is Done

| # | Scenario | Expected Outcome |
|---|---|---|
| 1 | Agent pays within all policy limits | SUCCESS, tx hash returned, totalSpent incremented |
| 2 | Agent pays above maxTransactionLimit | BLOCKED, reason: max_transaction_exceeded, email sent |
| 3 | Agent pays when allowance exhausted | BLOCKED, reason: allowance_exceeded, email sent |
| 4 | Agent pays above approvalThreshold | PENDING_APPROVAL, approval email sent |
| 5 | Developer approves pending tx | APPROVED → SUCCESS, tx executes, totalSpent incremented |
| 6 | Developer rejects pending tx | REJECTED, no payment made |
| 7 | Approval token expired | 400 error, no action taken |
| 8 | Invalid API key | 401 response |
| 9 | Wallet has insufficient USDC | FAILED, Stellar error logged, developer notified |
| 10 | /quote on would-be-blocked tx | would_be_blocked returned, zero records created |

---

## Key Decisions Already Made

Do not re-litigate these. They are settled.

| Decision | Choice | Reason |
|---|---|---|
| Target user | Global developers building AI agents | Larger market |
| Core product | Dashboard + REST API + public `SKILL.md` in V1. SDK is V2. | SKILL.md is the primary agent-onboarding primitive — one prompt, any agent, no install |
| Agent onboarding | Public `SKILL.md` at `https://argens.xyz/SKILL.md`; agents fetch it on demand | Faster than any SDK; language-agnostic; no client version drift |
| Asset | USDC on Stellar only in V1 | Simplest, most stable |
| Revenue | ~20% markup on MPP marketplace service calls; **$0 on direct transfers** | Aligns revenue with value-added services, not tax on transfers |
| Fee model | No Argens fee on direct USDC payments — single-op Stellar tx | Removes friction; developers and agents pay nothing to move money |
| Custody model | **Agent-custodial** — Argens holds encrypted signing key; user can export | True non-custodial impossible for autonomous agents in V1 |
| Soroban | **Dropped for V1** — TypeScript policy engine in `services/policy.ts` is permanent | Soroban complexity not justified vs. marketplace priority; TS engine covers all V1 needs |
| Wallet bootstrap | Argens funds 1.5 XLM per new wallet (1 XLM reserve + 0.5 XLM trustline reserve) | Zero-friction onboarding; sub-$0.20 CAC |
| Auth | Custom JWT + required email verification before API access | No external dep; prevents spam-signup XLM burn |
| Rate limiting | 100 req/min per API key (V1). Per-IP limiting deferred to V2. | Simple, effective for V1 load |
| Testnet/mainnet toggle | Single env var `STELLAR_NETWORK`. No user-facing dashboard toggle. | Reduces user confusion; deployment-time choice |
| Private key storage | AES-256-GCM encrypted in Postgres for V1. HSM / KMS is V2. | Simple; key rotation is straightforward |
| Email | Resend | Best DX, good deliverability |
| V1 policies | Allowance + Max Tx + Approval Threshold | Covers 90% of use cases |
| Source | Closed source | Commercial product |
| Agent-to-agent | Supported — any Stellar address is valid recipient | Core differentiator |
| x402 | Leverage where applicable, not compete | Additive to ecosystem |
| Cross-chain | **Deferred** to a later version (was planned as V1 Base settlement via CCTP V2). Not in the current build. | Refocused on mainnet direct payments + the MPP marketplace; cross-chain picked up later |
| CCTP fee handling | Argens absorbs Circle's CCTP protocol fee within its 0.5% cut | Agent sees one clean number; no surprise fee line items |
| Chain detection | Auto-detected from address format — `G...` = Stellar, `0x...` = Base. No explicit `chain:` param in V1. | Zero friction for agents |
| CCTP V2 prep | Nullable `destinationChain`, `destinationTxHash`, `crossChain` already in schema | No migration needed when V2 adds more chains |
| Decimal handling | Strings for Stellar + API request/response, Prisma Decimal for DB | No floating point errors |
| Policy check order | Max Tx → Allowance → Threshold | Fail-fast on most common violations |
| Approval email UX | Email links to confirmation page; state change via `POST` from that page | Prevents email scanners from auto-actioning approvals |
| Transfer PIN | Optional 4-digit PIN (bcrypt-hashed) on `POST /wallet/send` | Protects manual dashboard transfers even if session is compromised; agents use API key path, unaffected |
| Session security | JWT expires 1h; client-side tab-idle logout after 5 min hidden | Short-lived tokens + idle logout reduce exposure without degrading UX |
| Separate send endpoint | `POST /wallet/send` is JWT-only; agent payments via `POST /pay` (API key only) | Keeps agent and human-initiated spend on separate auth paths — no mixing |
| Policy applies to marketplace | Same policy check (`checkPolicy`) runs for marketplace calls as for direct payments | Agents cannot bypass policy limits by routing through marketplace |

---

## What Argens Is NOT

- Not a wallet app for end users
- Not a crypto exchange
- Not a KYC / AML compliance product
- Not an agent creation or hosting platform
- Not a multi-chain router — Stellar USDC only; cross-chain (Base/CCTP V2) is deferred to a later version
- Not open source
- Not a bridge — CCTP V2 uses burn-and-mint, not bridging
- Not responsible for what the AI agent does with the payment capability — that is the developer's responsibility
