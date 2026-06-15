# Plan 002: Make POST /pay count against the allowance, and make allowance enforcement atomic

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a457cd0..HEAD -- apps/api/src/routes/transactions.ts apps/api/src/services/policy.ts apps/api/src/routes/wallet.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-test-ci-baseline.md (for the vitest harness; Part A can land without it in an emergency)
- **Category**: bug
- **Planned at**: commit `a457cd0`, 2026-06-12

## Why this matters

Two related correctness bugs in the policy engine, the product's core promise ("agents spend USDC **within rules you define**"):

**Part A (critical):** the direct Stellar success path of `POST /pay` — the primary agent-facing payment endpoint — marks the transaction `SUCCESS` and returns **without ever calling `incrementTotalSpent`**. Dashboard sends (`POST /wallet/send`), approval executions, marketplace calls, and refunds all increment `policy.totalSpent`; the main agent path does not. Result: an agent paying via the API never consumes its allowance — the Allowance policy is effectively unenforced for exactly the spender it exists to constrain. This is live on mainnet.

**Part B:** even where the increment exists, `checkPolicy` (read) and `incrementTotalSpent` (write) are separate, unsynchronized queries with seconds of Stellar submission between them. N concurrent payments each read the same `totalSpent`, each pass the allowance check, and jointly overshoot the allowance. The fix is an atomic *reserve-then-settle* pattern: reserve the spend inside a serializable DB transaction before submitting to Stellar, and roll the reservation back if the Stellar submission fails.

## Current state

- `apps/api/src/services/policy.ts` — the policy engine:
  - `checkPolicy(userId, amount)` (lines 54–131): `prisma.policy.findUnique` then three in-process checks (max-tx → allowance → approval-threshold). Pure read, no locking.
  - `incrementTotalSpent(userId, amount)` (lines 140–152):

    ```ts
    export async function incrementTotalSpent(
      userId: string,
      amount: string,
    ): Promise<void> {
      await prisma.policy.update({
        where: { userId },
        data: {
          totalSpent: {
            increment: new Decimal(amount),
          },
        },
      })
    }
    ```

- `apps/api/src/routes/transactions.ts` — `POST /pay` (handler starts ~line 83). After `checkPolicy` returns `APPROVED`, the direct Stellar branch (lines 201–228) reads:

  ```ts
  if (isStellar) {
    // ── Stellar direct payment ──────────────────────────────────────────────
    try {
      const secretKey = decryptSecretKey(wallet.stellarSecretKeyEnc)
      const stellarResult = await submitPayment({ ... })

      await prisma.transaction.update({
        where: { id: tx.id },
        data: { status: 'SUCCESS', stellarTxHash: stellarResult.hash },
      })

      void refreshBalanceCache(wallet.id, wallet.stellarPublicKey).catch(() => undefined)
      void checkAndNotifyLowBalance(userId, wallet.id).catch(() => undefined)

      sendSuccess(res, { status: 'success', ... })
    } catch (stellarErr) {
      ... // marks tx FAILED, sends 502
    }
  }
  ```

  **There is no `incrementTotalSpent` call in this branch.** Verify: `grep -n "incrementTotalSpent" apps/api/src/routes/transactions.ts` → only line ~349 (inside the CCTP fire-and-forget relay block) and ~518 (refund path).

- Contrast with `apps/api/src/routes/wallet.ts` `POST /wallet/send` success path (~line 369), which does it correctly:

  ```ts
  await prisma.transaction.update({
    where: { id: tx.id },
    data: { status: 'SUCCESS', stellarTxHash: stellarResult.hash },
  })

  // Increment totalSpent
  await incrementTotalSpent(userId, amount)
  ```

- Other `incrementTotalSpent` call sites (callers of the new atomic API in Part B): `apps/api/src/routes/approve.ts:315` (CCTP approved relay) and `:373` (Stellar approved), `apps/api/src/services/marketplace.ts:645`, `apps/api/src/routes/transactions.ts:518` (refund).

- Product rules this plan must honor (from CLAUDE.md, the repo's authoritative spec):
  - "`policy.totalSpent` increments ONLY when a transaction reaches `SUCCESS` status. Never for `PENDING_APPROVAL`, `BLOCKED`, or `FAILED`." — Part B's reservation pattern temporarily increments before SUCCESS and compensates on failure; the *settled* invariant is preserved. Step 5 updates CLAUDE.md to document this (one paragraph; the operator selected this plan knowing that).
  - Money is never floating point: Prisma `Decimal` in DB, 7-decimal strings at boundaries.
  - "Database — Prisma only. No raw SQL." — Part B uses Prisma interactive transactions with `isolationLevel: 'Serializable'`, not `$queryRaw`.
- Error convention: `AppError(message, code, statusCode, details?)` from `apps/api/src/lib/errors.ts`; responses via `sendSuccess`/`sendError` from `apps/api/src/lib/response.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm --filter @argens/api exec tsc --noEmit` | exit 0 |
| Tests | `pnpm --filter @argens/api test` | all pass |
| Find increment call sites | `grep -rn "incrementTotalSpent\|reserveSpend" apps/api/src` | matches listed per step |

## Scope

**In scope** (the only files you should modify):
- `apps/api/src/services/policy.ts`
- `apps/api/src/routes/transactions.ts`
- `apps/api/src/services/policy.test.ts` (extend; exists after plan 001)
- `CLAUDE.md` (one paragraph, Step 5 only)

**Out of scope** (do NOT touch, even though they look related):
- `apps/api/src/routes/wallet.ts`, `apps/api/src/routes/approve.ts`, `apps/api/src/services/marketplace.ts` — they already increment correctly; migrating them to the atomic reservation API is a follow-up (see Maintenance notes). Touching them here multiplies regression risk on approval/marketplace flows.
- `apps/api/prisma/schema.prisma` — no schema change is needed.
- The CCTP branch of `POST /pay` (lines ~240–385) — its accounting problem is a different failure mode handled by plan 006.
- Response shapes — agents depend on them.

## Git workflow

- Branch: `advisor/002-policy-totalspent-atomic`
- Conventional commits (`fix: ...`), e.g. `fix: count direct /pay against allowance and reserve spend atomically`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the atomic reservation API to policy.ts

In `apps/api/src/services/policy.ts`, add two functions (keep `checkPolicy` and `incrementTotalSpent` unchanged — other routes still use them):

```ts
/**
 * Atomically re-check the allowance and reserve `amount` against it.
 * Runs checkPolicy's logic and the totalSpent increment inside one
 * SERIALIZABLE transaction, so concurrent payments cannot jointly
 * exceed the allowance. Call releaseSpend() if the payment later fails.
 *
 * Returns the PolicyResult; increments totalSpent ONLY when status is APPROVED.
 */
export async function checkPolicyAndReserve(
  userId: string,
  amount: string,
): Promise<PolicyResult> {
  const MAX_RETRIES = 3
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const policy = await tx.policy.findUnique({ where: { userId } })
          if (!policy) {
            throw new AppError('Policy record not found for user', 'POLICY_NOT_FOUND', 500)
          }
          const result = evaluatePolicy(policy, amount)   // see below
          if (result.status === 'APPROVED') {
            await tx.policy.update({
              where: { userId },
              data: { totalSpent: { increment: new Decimal(amount) } },
            })
          }
          return result
        },
        { isolationLevel: 'Serializable' },
      )
    } catch (e) {
      // P2034: serialization conflict — safe to retry
      if ((e as { code?: string }).code === 'P2034' && attempt < MAX_RETRIES) continue
      throw e
    }
  }
}

/** Compensating action: release a reservation after a failed payment. */
export async function releaseSpend(userId: string, amount: string): Promise<void> {
  await prisma.policy.update({
    where: { userId },
    data: { totalSpent: { decrement: new Decimal(amount) } },
  })
}
```

To avoid duplicating the three checks, extract the existing check body of `checkPolicy` (everything after the `findUnique`, lines ~64–130) into a **pure synchronous function** `evaluatePolicy(policy, amount): PolicyResult` and have both `checkPolicy` and `checkPolicyAndReserve` call it. `evaluatePolicy` takes the policy row (the Prisma `Policy` type) — this is a mechanical move, change no logic, keep the exact `detail`/`policySnapshot` construction.

Note on Prisma typing: the `tx` callback parameter is `Prisma.TransactionClient`. `isolationLevel` requires Prisma ≥4.4 — this repo is on `@prisma/client ^5.22.0`, fine. The P2034 retry code is Prisma's documented serialization-conflict error.

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0.

### Step 2: Fix the /pay direct Stellar path (Part A + Part B together)

In `apps/api/src/routes/transactions.ts`:

1. In the `POST /pay` handler, replace `const policyResult = await checkPolicy(userId, amount)` with `const policyResult = await checkPolicyAndReserve(userId, amount)` (update the import from `../services/policy.js` to include `checkPolicyAndReserve` and `releaseSpend`).
2. The BLOCKED and PENDING_APPROVAL branches need no change — `checkPolicyAndReserve` only increments on APPROVED.
3. In the direct Stellar branch's `catch (stellarErr)` block (currently marks the tx FAILED and sends 502), add the compensation **before** sending the error response:

   ```ts
   await releaseSpend(userId, amount).catch((releaseErr: unknown) =>
     logger.error('Failed to release reserved spend after Stellar failure', {
       userId, transactionId: tx.id, error: (releaseErr as Error).message,
     }),
   )
   ```

4. The success path needs **no** increment call anymore (the reservation already counted it) — this simultaneously fixes Part A.
5. The CCTP branch (`else` / `isEvm`) of the same handler also flows through the now-reserving policy check. Add the same `releaseSpend` compensation to its three pre-burn failure exits: fee-wallet-not-configured (~line 247), preflight failure (~line 259), fee-payment failure (~line 294), and the burn-failure catch (~line 359). Do NOT touch the fire-and-forget relay IIFE — but **remove** the now-duplicate `await incrementTotalSpent(userId, amount)` at ~line 349 inside it (the reservation already counted the spend; leaving it would double-count). On relay failure the funds were burned on Stellar, so the reservation correctly stays (do not release there).

**Verify**:
- `pnpm --filter @argens/api exec tsc --noEmit` → exit 0
- `grep -n "incrementTotalSpent" apps/api/src/routes/transactions.ts` → only the refund call site (~line 518) remains
- `grep -c "releaseSpend" apps/api/src/routes/transactions.ts` → 5 (import + 4 failure exits) — adjust if your line-by-line reading found a different number of pre-burn failure exits, and say so in your report

### Step 3: Extend the test suite

In `apps/api/src/services/policy.test.ts` (created by plan 001), add a `describe('checkPolicyAndReserve')` block. Mock `prisma.$transaction` to invoke its callback with a `tx` object whose `policy.findUnique`/`policy.update` are `vi.fn()`s:

- APPROVED → `tx.policy.update` called once with `increment` of the amount.
- BLOCKED (over max-tx) → `tx.policy.update` NOT called.
- PENDING_APPROVAL → `tx.policy.update` NOT called.
- P2034 thrown twice then success → returns result (retry loop works); P2034 thrown 4 times → throws.
- `releaseSpend` issues a `decrement` update with the same amount.
- `evaluatePolicy` (now exported or tested through `checkPolicy`) still passes all plan-001 scenarios unchanged — run the full suite.

**Verify**: `pnpm --filter @argens/api test` → all pass, including ≥5 new tests.

### Step 4: Manual smoke verification against the local stack

Only if a local API + Postgres are already running and configured (check `docker-compose.yml` / `.env` presence; do NOT create or fund wallets, do NOT submit mainnet transactions). If not available, skip and note it in your report — the unit tests are the gate.

### Step 5: Document the reservation semantics in CLAUDE.md

In CLAUDE.md's "Critical: totalSpent Update Rule" section, append one paragraph:

> **Reservation semantics (since plan 002):** `checkPolicyAndReserve` increments `totalSpent` atomically at approval time, *before* Stellar submission, and `releaseSpend` decrements it if the submission fails. The settled invariant is unchanged — a transaction that ends BLOCKED/FAILED/PENDING contributes nothing to `totalSpent` — but in-flight payments briefly hold a reservation so concurrent requests cannot jointly exceed the allowance.

**Verify**: `grep -n "Reservation semantics" CLAUDE.md` → 1 match.

## Test plan

Covered in Step 3. Pattern to follow: the prisma `vi.mock` harness in `apps/api/src/services/policy.test.ts` from plan 001. Full suite: `pnpm --filter @argens/api test` → 0 failures.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter @argens/api exec tsc --noEmit` exits 0
- [ ] `pnpm --filter @argens/api test` exits 0 with the new `checkPolicyAndReserve` tests passing
- [ ] `grep -n "checkPolicyAndReserve" apps/api/src/routes/transactions.ts` → used in POST /pay
- [ ] `grep -n "incrementTotalSpent" apps/api/src/routes/transactions.ts` → only the refund path remains
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The `/pay` handler around lines 183–385 does not match the "Current state" excerpts (drift).
- Prisma rejects `isolationLevel: 'Serializable'` against the configured Postgres (it shouldn't; if it does, the DB layer is unusual — report).
- You find an additional `incrementTotalSpent` call inside `transactions.ts`'s `/pay` flow not listed here (means the bug analysis is stale).
- The compensation logic would require touching `approve.ts` or `marketplace.ts` to stay consistent — those are out of scope; report the inconsistency instead.

## Maintenance notes

- **Follow-up (deferred):** migrate `wallet.ts` send, `approve.ts` execution, and `marketplace.ts` to `checkPolicyAndReserve`/`releaseSpend` so the whole codebase uses one accounting path; plan 005's dedup work is the natural vehicle. Until then those paths keep the small race window (low traffic, human-initiated).
- Reviewer should scrutinize: the four CCTP failure exits each release exactly once (no double-release), and the relay IIFE no longer increments.
- If a queue/worker is introduced later (plan 006), the reservation must move with the burn step, not the relay step.
