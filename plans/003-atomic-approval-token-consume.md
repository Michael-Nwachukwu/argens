# Plan 003: Make approval/rejection token consumption atomic (single-use under concurrency)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a457cd0..HEAD -- apps/api/src/routes/approve.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (touches the payment-executing approval flow)
- **Depends on**: plans/001-test-ci-baseline.md (vitest harness; logic change itself has no dependency)
- **Category**: bug
- **Planned at**: commit `a457cd0`, 2026-06-12

## Why this matters

Approval tokens are documented as single-use ("Approval tokens — `crypto.randomBytes(32)`. Expire 24h. Single use." — CLAUDE.md Security Rules), and `POST /approve/:token` executes a real USDC payment on Stellar mainnet. Today the "single-use" guarantee is a check-then-act across two separate queries: `findAndValidateToken` reads the row and checks `status === 'PENDING'`, then a second query sets it `APPROVED`. Two concurrent `POST /approve/:token` requests (double-click, email-client prefetch retry, or a deliberate replay) can both pass validation before either write lands — and both execute the payment. The fix is a conditional `updateMany` that consumes the token and reports whether *this* request won, in one atomic statement.

## Current state

All in `apps/api/src/routes/approve.ts` (487 lines). Routes mounted under `/v1` in `apps/api/src/index.ts` (`app.use('/v1', approveRouter)`).

- The shared validator (lines ~468–487):

```ts
async function findAndValidateToken(token: string) {
  const queue = await prisma.approvalQueue.findUnique({
    where: { token },
    include: { transaction: true },
  })

  // Token must exist, be PENDING, and not expired. (The token itself is the bearer
  // authorisation — it is only ever sent to the account owner's email.)
  if (!queue) return null
  if (queue.status !== 'PENDING') return null
  if (queue.expiresAt < new Date()) {
    await prisma.approvalQueue.update({
      where: { id: queue.id },
      data: { status: 'EXPIRED' },
    })
    return null
  }

  return { queue, transaction: queue.transaction }
}
```

- `POST /approve/:token` (lines ~102–123) — read, then unconditional update:

```ts
const entry = await findAndValidateToken(tokenParam)
if (!entry) {
  sendError(res, 'Approval token is invalid, expired, or already used.', 'INVALID_TOKEN', 400)
  return
}

const { queue, transaction } = entry
const userId = transaction.userId

// Mark token consumed immediately (single-use)
await prisma.approvalQueue.update({
  where: { id: queue.id },
  data: { status: 'APPROVED', actedAt: new Date() },
})
```

The race: between `findAndValidateToken` and the `update`, a second request's `findAndValidateToken` also sees `PENDING`. Note the `update`'s `where` is by `id` only — no `status` condition, so it cannot detect that it lost.

- `POST /reject/:token` (lines ~425–443) has the identical pattern: `findAndValidateToken`, then `prisma.approvalQueue.update({ where: { id: queue.id }, data: { status: 'REJECTED', actedAt: new Date() } })` followed by marking the transaction `REJECTED`.

- Relevant Prisma model (`apps/api/prisma/schema.prisma`):

```prisma
model ApprovalQueue {
  id            String         @id @default(cuid())
  transactionId String         @unique
  transaction   Transaction    @relation(fields: [transactionId], references: [id])
  userId        String
  status        ApprovalStatus @default(PENDING)   // PENDING | APPROVED | REJECTED | EXPIRED
  token         String         @unique
  expiresAt     DateTime
  actedAt       DateTime?
  createdAt     DateTime       @default(now())
}
```

- Conventions: responses via `sendSuccess`/`sendError` (`apps/api/src/lib/response.ts`); structured logs via `logger` with `userId` context; repo rule "Prisma only, no raw SQL".

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm --filter @argens/api exec tsc --noEmit` | exit 0 |
| Tests | `pnpm --filter @argens/api test` | all pass |

## Scope

**In scope**:
- `apps/api/src/routes/approve.ts`
- `apps/api/src/routes/approve.test.ts` (create)

**Out of scope** (do NOT touch):
- `GET /approve/:token` (lines ~47–98) — read-only summary for the confirmation page; it intentionally does not consume the token.
- The payment-execution logic after the token is consumed (marketplace execution, CCTP path, Stellar submit) — unchanged.
- `apps/api/prisma/schema.prisma` — no migration needed; `status` + `@unique token` already support the conditional update.
- Plan 002's policy changes — if plan 002 already landed, `approve.ts` still uses plain `checkPolicy`; leave that as-is (its migration is explicitly deferred, see plan 002 maintenance notes).

## Git workflow

- Branch: `advisor/003-atomic-approval-token`
- Conventional commit, e.g. `fix: consume approval tokens atomically to prevent double execution`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add an atomic consume helper

In `approve.ts`, next to `findAndValidateToken`, add:

```ts
/**
 * Atomically consume a PENDING, unexpired token by flipping it to `nextStatus`.
 * Returns the queue row (with transaction) if THIS call won the consume,
 * or null if the token was missing, expired, or already consumed —
 * updateMany's `count` is the atomic compare-and-swap result.
 */
async function consumeToken(
  token: string,
  nextStatus: 'APPROVED' | 'REJECTED',
): Promise<{ queue: ApprovalQueue; transaction: Transaction } | null> {
  const consumed = await prisma.approvalQueue.updateMany({
    where: { token, status: 'PENDING', expiresAt: { gt: new Date() } },
    data: { status: nextStatus, actedAt: new Date() },
  })
  if (consumed.count !== 1) {
    // Lazily mark expired-but-still-PENDING tokens, mirroring findAndValidateToken.
    await prisma.approvalQueue.updateMany({
      where: { token, status: 'PENDING', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    })
    return null
  }
  const queue = await prisma.approvalQueue.findUnique({
    where: { token },
    include: { transaction: true },
  })
  if (!queue) return null // deleted between update and read — treat as lost
  return { queue, transaction: queue.transaction }
}
```

Import the `ApprovalQueue` and `Transaction` types from `@prisma/client` (check how other files in `apps/api/src/routes/` import Prisma model types and match that style; if none do, use `import type { ApprovalQueue, Transaction } from '@prisma/client'`).

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0.

### Step 2: Switch POST /approve/:token to consumeToken

Replace the read-then-write block (the `findAndValidateToken` call through the "Mark token consumed immediately" update, lines ~110–123) with:

```ts
const entry = await consumeToken(tokenParam, 'APPROVED')
if (!entry) {
  sendError(res, 'Approval token is invalid, expired, or already used.', 'INVALID_TOKEN', 400)
  return
}
const { transaction } = entry
const userId = transaction.userId
```

Everything after (policy re-check, BLOCKED handling, marketplace vs Stellar vs CCTP execution) stays byte-for-byte unchanged. One subtlety: the old code's post-consume policy re-check can mark the transaction `BLOCKED` after the queue row is `APPROVED` — that mismatch already exists today; do not change it (report it as an observation if you like).

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0.

### Step 3: Switch POST /reject/:token the same way

Replace its `findAndValidateToken` + update pair with `consumeToken(tokenParam, 'REJECTED')`. The subsequent `prisma.transaction.update` to `status: 'REJECTED'` and the rejection email stay unchanged.

After both switches, `findAndValidateToken` should have no remaining callers: `grep -n "findAndValidateToken" apps/api/src/routes/approve.ts` → only the function definition. Delete the function.

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0; `grep -c "findAndValidateToken" apps/api/src/routes/approve.ts` → 0.

### Step 4: Tests

Create `apps/api/src/routes/approve.test.ts` using the prisma `vi.mock` pattern from `apps/api/src/services/policy.test.ts` (plan 001). Test `consumeToken` via the route module's behavior or export it for direct testing (exporting a route-file helper is acceptable; match the file's existing export style):

1. `updateMany` resolves `{ count: 1 }` → returns the queue+transaction from the follow-up `findUnique`.
2. `updateMany` resolves `{ count: 0 }` → returns null AND issues the lazy-expire `updateMany` (assert its `where` includes `expiresAt: { lte: ... }`).
3. Called with `'REJECTED'` → `data.status === 'REJECTED'`.
4. The race regression test (the point of this plan): simulate two sequential calls where the first returns `{ count: 1 }` and the second `{ count: 0 }` — assert exactly one wins.

**Verify**: `pnpm --filter @argens/api test` → all pass including ≥4 new tests.

## Test plan

Covered in Step 4. Pattern: `policy.test.ts` from plan 001. Full suite green: `pnpm --filter @argens/api test`.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter @argens/api exec tsc --noEmit` exits 0
- [ ] `pnpm --filter @argens/api test` exits 0, new approve tests pass
- [ ] `grep -c "findAndValidateToken" apps/api/src/routes/approve.ts` → 0
- [ ] Both `POST /approve/:token` and `POST /reject/:token` consume via the conditional `updateMany` (`grep -n "consumeToken" apps/api/src/routes/approve.ts` → ≥3 matches: definition + 2 call sites)
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `approve.ts` around lines 100–130 / 425–445 doesn't match the excerpts (drift).
- You find any *other* caller of `findAndValidateToken` beyond the two POST handlers (`grep` first).
- The fix seems to require changing the GET handler or the execution logic after consumption — out of scope.

## Maintenance notes

- If approval ever moves to a queue/worker model (see plan 006 for CCTP), `consumeToken` remains the correct entry gate — workers must only act on a row they personally flipped from PENDING.
- Reviewer should scrutinize: the lazy-expire branch cannot flip an already-APPROVED/REJECTED row (its `where` pins `status: 'PENDING'`), and the 400 message for "already used" is unchanged so the dashboard confirm page copy still matches.
- Known pre-existing quirk left intentionally unfixed: a token consumed as APPROVED whose post-consume policy re-check blocks the payment leaves `ApprovalQueue.status = 'APPROVED'` with `Transaction.status = 'BLOCKED'`. Cosmetic, but worth a follow-up.
