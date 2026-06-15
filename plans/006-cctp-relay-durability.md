# Plan 006: Make the CCTP Stellar→Base relay durable (survive crashes, retry failures, never strand burned funds silently)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a457cd0..HEAD -- apps/api/src/routes/transactions.ts apps/api/src/routes/approve.ts apps/api/src/services/cctp.ts apps/api/src/index.ts`
> If any in-scope file changed since this plan was written — **plan 002
> intentionally edits the same region of transactions.ts** — re-read the live
> code and reconcile before proceeding; on an unexplained mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/001-test-ci-baseline.md, plans/002-policy-totalspent-and-atomic-allowance.md (it rewrites the relay block this plan extracts)
- **Category**: bug / reliability
- **Planned at**: commit `a457cd0`, 2026-06-12

## Why this matters

A cross-chain payment burns real USDC on Stellar, then completes via Circle's attestation (Iris) and a `receiveMessage` transaction on Base. Today that second half runs in an **unawaited async IIFE** inside the HTTP handler:

- If the **process restarts** between burn and relay (Dokploy redeploy, crash, container restart), the IIFE dies. The transaction stays `APPROVED` forever with `stellarTxHash` set and no `destinationTxHash` — the user's USDC is burned and nobody mints it on Base. Nothing scans for these.
- If the **relay fails** (Iris timeout after 5 minutes, Base RPC hiccup), the transaction is marked `FAILED` — but the burn already happened, so "FAILED" is a lie that hides burned funds. The Iris message/attestation are not persisted, so a retry must restart from the burn hash (fortunately Iris is queryable by burn tx hash, so recovery is possible — it just never happens automatically).

The fix: persist relay progress on the transaction row, extract the relay into a service function, and add a small reconciler loop (same pattern as the existing payment watcher) that picks up stuck relays on startup and on an interval. CCTP V2 attestations remain fetchable from Iris by burn-transaction hash, so a relay is always resumable from just `stellarTxHash`.

## Current state

- `apps/api/src/routes/transactions.ts` — `POST /pay` CCTP branch. After a successful burn, response is sent (`status: 'cross_chain_pending'`), then (~lines 340–358):

```ts
// Fire-and-forget: attest + relay. Updates transaction record when done.
void (async () => {
  try {
    const { message, attestation } = await pollAttestation(stellarTxHash)
    const { baseTxHash } = await relayOnBase(message, attestation)
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { status: 'SUCCESS', destinationTxHash: baseTxHash },
    })
    await incrementTotalSpent(userId, amount)   // ← plan 002 removes this line
    logger.info('CCTP relay complete', { txId: tx.id, baseTxHash })
  } catch (relayErr) {
    await prisma.transaction.update({
      where: { id: tx.id },
      data: { status: 'FAILED', blockedReason: (relayErr as Error).message },
    })
    logger.error('CCTP relay failed', { txId: tx.id, error: (relayErr as Error).message })
  }
})()
```

- `apps/api/src/routes/approve.ts` — the approved-path CCTP branch (~lines 307–325) has a near-identical IIFE (keeps its `incrementTotalSpent` — plan 002 deliberately did not migrate approve.ts).
- `apps/api/src/services/cctp.ts`:
  - `pollAttestation(stellarTxHash)` — GETs `${IRIS_BASE_URL}/v2/messages/27?transactionHash=...` every 5s, up to 60 attempts (5 min), returns `{ message, attestation }` when `status === 'complete'`. **Read-only and idempotent — safe to re-call with the same burn hash at any time.**
  - `relayOnBase(message, attestation)` — viem `walletClient.writeContract` calling `receiveMessage` on the Base MessageTransmitter from the `ARGENS_BASE_RELAYER_SECRET` account. **NOT idempotent**: re-submitting an already-consumed message reverts (Circle's MessageTransmitter rejects used nonces). Throws `CctpError('Base relay transaction failed', { error })` on any failure, including that revert.
- Relevant Transaction fields (`apps/api/prisma/schema.prisma`): `status` (enum: SUCCESS | BLOCKED | PENDING_APPROVAL | APPROVED | REJECTED | FAILED), `stellarTxHash String?`, `destinationTxHash String?`, `destinationChain String?`, `crossChain Boolean @default(false)`, `metadata Json?`, `blockedReason String?`.
- Startup-job exemplar — `apps/api/src/services/watcher.ts` (started from `index.ts`):

```ts
void scanAndSubscribe()
setInterval(() => void scanAndSubscribe(), SCAN_INTERVAL_MS)
```

Find where `index.ts` calls the watcher's start function (`grep -n "watcher" apps/api/src/index.ts`) and mirror that wiring.

- Key product constraint (CLAUDE.md): a stuck relay is **not** a normal failure — funds were burned. The state model below distinguishes "in-flight/recoverable" from "exhausted/needs human".

## State model (no schema migration)

Adding an enum value would be a schema migration (operator check-in required per repo rules) — avoid it. Encode relay state with existing fields:

| Relay state | Encoding |
|---|---|
| Relay pending / in-flight | `status: 'APPROVED'`, `crossChain: true`, `stellarTxHash != null`, `destinationTxHash: null` |
| Relay complete | `status: 'SUCCESS'`, `destinationTxHash` set |
| Relay exhausted (needs human) | `status: 'FAILED'`, `metadata.relay.exhausted: true`, `blockedReason` explains funds were burned |

Attempt counter and trace live in `metadata.relay`: `{ attempts: number, lastError: string | null, lastAttemptAt: ISO string, exhausted?: true }`. **Important**: `metadata` writes elsewhere in the CCTP path store `cctpFee` — always spread/merge the existing metadata object when updating (`metadata: { ...(tx.metadata as object ?? {}), relay: {...} }`), never overwrite it.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm --filter @argens/api exec tsc --noEmit` | exit 0 |
| Tests | `pnpm --filter @argens/api test` | all pass |

## Scope

**In scope**:
- `apps/api/src/services/cctp-relay.ts` (create — the relay executor + reconciler)
- `apps/api/src/routes/transactions.ts` (replace the relay IIFE with a call into cctp-relay)
- `apps/api/src/routes/approve.ts` (same replacement)
- `apps/api/src/index.ts` (start the reconciler, next to the watcher startup)
- `apps/api/src/services/cctp-relay.test.ts` (create)

**Out of scope** (do NOT touch):
- `pollAttestation` / `relayOnBase` / `burnUsdcOnStellar` in `cctp.ts` — reuse as-is.
- The fee-then-burn sequence and its failure handling (pre-burn failures are correctly terminal).
- `prisma/schema.prisma` — explicitly no migration in this plan.
- The x402 route's 501 gate for Base — separate product decision.
- Policy accounting — plan 002 defined where increments/reservations live; on the approve path keep `incrementTotalSpent` exactly where the relay success lands (now inside the shared executor — see Step 1 for how the two paths differ).

## Git workflow

- Branch: `advisor/006-cctp-relay-durability`
- Conventional commits (`fix: ...` / `feat: ...`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `services/cctp-relay.ts`

Export two functions.

**`runRelay(txId: string): Promise<void>`** — the single source of truth for completing a burned transaction:

1. Load the transaction (`prisma.transaction.findUnique`). If it is not in the "relay pending" encoding (see state model), log and return — idempotency guard.
2. Read `metadata.relay.attempts ?? 0`. If `attempts >= MAX_RELAY_ATTEMPTS` (use 5), mark exhausted: `status: 'FAILED'`, merged metadata `relay.exhausted: true`, `blockedReason: 'CCTP relay exhausted after N attempts — USDC was burned on Stellar (tx <hash>); manual relay required.'`, log at error level, return.
3. Increment `attempts` + set `lastAttemptAt` in metadata (write before attempting, so a crash mid-attempt still counts it).
4. `pollAttestation(tx.stellarTxHash)` → `relayOnBase(message, attestation)`.
5. On success: update `status: 'SUCCESS'`, `destinationTxHash`, merged metadata `relay.lastError: null`. Then the **policy accounting hook**: call the per-path completion callback (see below).
6. On failure: write `relay.lastError` into merged metadata, leave `status: 'APPROVED'` (still pending — the reconciler will retry). Special case: if the error message contains `'Nonce already used'` (case-insensitive substring — also accept `'nonce'` + `'used'`), the message was already relayed (e.g. a previous attempt's tx landed but we crashed before recording it). Mark `status: 'SUCCESS'` with merged metadata `relay.note: 'nonce_already_used — mint landed in a prior attempt; destination hash unknown'` and leave `destinationTxHash` null. Log warn.

Accounting difference between the two call sites: after plan 002, the `/pay` path **reserves** spend up front (no increment on relay success), while the approve path still increments on success. Handle with a parameter: `runRelay(txId, { incrementOnSuccess: boolean })`, and have it call `incrementTotalSpent(tx.userId, amountString)` only when true, where `amountString = tx.amount.toFixed(7)`. Persist that flag at enqueue time inside `metadata.relay.incrementOnSuccess` so the **reconciler** (which doesn't know the origin path) uses the persisted value, not a guess. If plan 002 has NOT landed when you execute this plan: both paths pass `incrementOnSuccess: true` — check `grep -n "checkPolicyAndReserve" apps/api/src/routes/transactions.ts` to determine which world you are in, and say which in your report.

**`startCctpRelayReconciler(): void`** — mirror the watcher pattern:

```ts
const RECONCILE_INTERVAL_MS = 120_000
export function startCctpRelayReconciler(): void {
  void reconcileOnce()
  setInterval(() => void reconcileOnce(), RECONCILE_INTERVAL_MS)
}

async function reconcileOnce(): Promise<void> {
  try {
    const stuck = await prisma.transaction.findMany({
      where: {
        crossChain: true,
        status: 'APPROVED',
        stellarTxHash: { not: null },
        destinationTxHash: null,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7-day window
      },
      take: 20,
      orderBy: { createdAt: 'asc' },
    })
    for (const tx of stuck) {
      await runRelayFromMetadata(tx)   // reads incrementOnSuccess from metadata.relay
    }
  } catch (e) {
    logger.error('CCTP relay reconciler scan failed', { error: (e as Error).message })
  }
}
```

Guard against the reconciler racing the in-request relay: keep a module-level `Set<string>` of tx IDs currently being relayed in this process; skip IDs already in the set (add in `runRelay` entry, remove in `finally`). This is in-process only — acceptable for the current single-instance deployment; note it in a comment.

Caution on `pollAttestation`: it blocks up to 5 minutes per call. Processing 20 stuck transactions sequentially could take 100 minutes. For the reconciler path, that's acceptable for v1 (low CCTP volume; the loop is sequential by design to avoid hammering Iris) — but add a comment, and process newest-pending first attempt quickly by keeping `take: 20`.

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0.

### Step 2: Replace both fire-and-forget IIFEs

In `transactions.ts` (after the `cross_chain_pending` response is sent) and `approve.ts` (same position), replace the whole IIFE with:

```ts
void enqueueRelay(tx.id, { incrementOnSuccess: /* false on /pay if plan 002 landed; true on approve path */ })
```

where `enqueueRelay` (exported from `cctp-relay.ts`) first persists `metadata.relay = { attempts: 0, incrementOnSuccess, lastError: null }` (merged) and then calls `runRelay` — fire-and-forget at the call site is now fine because state is persisted *before* the first attempt, so a crash is recoverable by the reconciler.

Delete the now-unused imports in both route files (`pollAttestation`, `relayOnBase` — keep `burnUsdcOnStellar`, `computeCctpFee`, etc.).

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0; `grep -n "pollAttestation\|relayOnBase" apps/api/src/routes/transactions.ts apps/api/src/routes/approve.ts` → no matches.

### Step 3: Start the reconciler

In `index.ts`, next to the existing watcher startup call, add `startCctpRelayReconciler()` (match how the watcher is imported/invoked — find it: `grep -n "Watcher\|watcher" apps/api/src/index.ts`).

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0; if a local dev stack is available, `pnpm dev:api` boots and logs no reconciler errors within 30s (skip if no local DB; say so).

### Step 4: Tests

`apps/api/src/services/cctp-relay.test.ts`, prisma + cctp mocked (`vi.mock('../lib/prisma.js', ...)`, `vi.mock('./cctp.js', ...)`):

1. Happy path: pending tx → pollAttestation + relayOnBase mocked OK → status SUCCESS, destinationTxHash set; `incrementTotalSpent` called iff `metadata.relay.incrementOnSuccess` true (mock `./policy.js`).
2. Relay throws generic error → status stays APPROVED, `relay.attempts` incremented, `relay.lastError` recorded.
3. Attempts already at MAX → marked FAILED with `relay.exhausted: true` and a `blockedReason` mentioning burned funds; pollAttestation NOT called.
4. Error containing "Nonce already used" → status SUCCESS with `relay.note`, no destinationTxHash.
5. Transaction not in pending encoding (already SUCCESS) → no writes (idempotency guard).
6. Metadata merge: a tx whose metadata already has `cctpFee` keeps it after a relay-state write (the regression test for clobbering).

**Verify**: `pnpm --filter @argens/api test` → all pass, ≥6 new tests.

## Test plan

Step 4. Live mainnet verification of an actual stuck-relay recovery is an operator task (it requires deliberately killing the API mid-relay with real funds) — out of executor scope; note it as untested in your report.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter @argens/api exec tsc --noEmit` exits 0
- [ ] `pnpm --filter @argens/api test` exits 0 with the new cctp-relay suite passing
- [ ] `grep -rn "void (async" apps/api/src/routes/transactions.ts apps/api/src/routes/approve.ts` → no CCTP relay IIFEs remain
- [ ] `grep -n "startCctpRelayReconciler" apps/api/src/index.ts` → 1 match
- [ ] No schema change: `git diff --stat -- apps/api/prisma` → empty
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- Plan 002 has not landed AND the transactions.ts relay block differs from both the excerpt above and plan 002's expected output — the file is in an unknown state.
- You cannot determine from viem/Circle behavior what error text an already-consumed message produces (the "Nonce already used" detection in Step 1.6) — implement states 1–5, leave a `// TODO(STOP)` comment for 6, and report; do NOT guess a different match string.
- The reconciler design seems to require cross-process locking (i.e. the operator has scaled to multiple API instances) — the in-process Set is insufficient there; report.
- Anything suggests `metadata` is written concurrently elsewhere during relay (merge conflicts) beyond the documented `cctpFee` write.

## Maintenance notes

- When the API scales past one instance, the in-process relay lock must become a DB-level claim (e.g. compare-and-swap on a `metadata.relay.claimedBy` field or a proper job table). The reconciler's `findMany` is the place to add it.
- The "relay pending" encoding (`APPROVED` + burned + no destination hash) is now load-bearing — any future code that sets `status: 'APPROVED'` on cross-chain transactions after burn must keep that invariant, and any dashboard display of APPROVED cross-chain txs should render it as "relay in progress".
- Follow-up worth its own plan: an ops notification (email via the existing `services/email.ts` patterns) when a relay is marked exhausted — silent FAILED rows with burned funds still need a human to notice them; the reconciler at least makes them queryable: `status: FAILED, metadata.relay.exhausted: true`.
- Reviewer should scrutinize: metadata merges (test 6), and that the approve path's `incrementTotalSpent` moved into the executor without double-counting (it must no longer also be called in approve.ts).
