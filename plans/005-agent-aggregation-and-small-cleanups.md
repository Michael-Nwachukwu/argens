# Plan 005: DB-side aggregation for agent endpoints, single Horizon call for balances, watcher server reuse, dead next.config removal

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a457cd0..HEAD -- apps/api/src/routes/agent.ts apps/api/src/routes/wallet.ts apps/api/src/services/stellar.ts apps/api/src/services/watcher.ts apps/web/next.config.mjs apps/web/next.config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M (four small independent fixes; each individually S)
- **Risk**: LOW
- **Depends on**: plans/001-test-ci-baseline.md (tests for fix A; B–D verifiable without)
- **Category**: perf / tech-debt
- **Planned at**: commit `a457cd0`, 2026-06-12

## Why this matters

Four independent, low-risk cleanups, batched because each is too small for its own plan:

- **A — agent endpoints load every transaction into memory and sum with floats.** `GET /agent/status` and `GET /spend/summary` fetch all matching rows with unbounded `findMany` and reduce with `parseFloat(...)` — both an O(n)-per-request hot path for exactly the busiest users (AI agents making many small payments), and a violation of the repo's "no floating point for money" rule (CLAUDE.md Anti-Hallucination Rule 7). Postgres can do these sums exactly with `aggregate`/`groupBy`.
- **B — the wallet balance endpoint makes two sequential Horizon round-trips** (`getUsdcBalance` + `getXlmBalance`), each a `loadAccount` returning the *same* account object that contains *both* balances. The XLM call runs even when USDC was served from cache. One `loadAccount` suffices.
- **C — the payment watcher creates a new `Horizon.Server` per (re)subscription** instead of reusing the singleton exported by `stellar.ts`, churning connection state on every reconnect cycle.
- **D — `apps/web/next.config.ts` is dead code.** Next.js 14 loads `next.config.mjs`; the `.ts` file (which lacks the SKILL.md CORS headers) is silently ignored, and a future edit to it would silently do nothing — SKILL.md public fetchability is a core product requirement (it is the V1 agent-onboarding primitive).

## Current state

### A — `apps/api/src/routes/agent.ts`

`GET /agent/status` (today's spend, ~lines 66–83):

```ts
const todayTxs = await prisma.transaction.findMany({
  where: { userId, status: 'SUCCESS', createdAt: { gte: todayStart } },
  select: { amount: true },
})

const todaySpend = todayTxs
  .reduce((sum, tx) => sum + parseFloat(tx.amount.toFixed(7)), 0)
  .toFixed(7)

const todayCount = todayTxs.length
```

`GET /spend/summary` (~lines 142–169): same pattern — `findMany` with `select: { amount: true, createdAt: true }`, float `reduce` for `totalSpent`, then an in-memory date-bucket loop:

```ts
const buckets: Record<string, number> = {}
for (const tx of successTxs) {
  const key = tx.createdAt.toISOString().slice(0, 10)
  buckets[key] = (buckets[key] ?? 0) + parseFloat(tx.amount.toFixed(7))
}
const breakdown = Object.entries(buckets)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([date, amount]) => ({ date, amount: amount.toFixed(7), count: 1 }))
```

Note the pre-existing bug: `count: 1` is hardcoded — every bucket reports count 1 regardless of how many transactions it contains. Fix it as part of the rewrite (track counts in the buckets).

### B — `apps/api/src/routes/wallet.ts` (`GET /wallet/balance`, ~lines 60–122)

USDC: 60s cache (`CACHE_TTL_MS`) → on miss, `await getUsdcBalance(...)` then cache update; `null` (account not found) resets cache to 0; Horizon error falls back to stale cache. Then **unconditionally**:

```ts
const xlmBalance = await getXlmBalance(wallet.stellarPublicKey).catch(() => null)
```

`apps/api/src/services/stellar.ts` has `export const server = new Horizon.Server(HORIZON_URL)` (line 32) and both helpers call `server.loadAccount(publicKey)` independently (lines 121–146 and 147+). `getUsdcBalance` returns `null` on 404, throws `StellarError` otherwise; preserve those exact semantics.

### C — `apps/api/src/services/watcher.ts` (~line 85)

```ts
function subscribeToPayments(state: WatchState): void {
  const server = new Horizon.Server(HORIZON_URL)
  ...
}
```

The reconnect path (`resetFallbackTimer`, lines ~125–140) calls `subscribeToPayments` again on every fallback fire, creating a fresh `Horizon.Server` each time. `stellar.ts` already exports a singleton `server`.

### D — `apps/web/next.config.mjs` vs `next.config.ts`

`.mjs` (active): `reactStrictMode` + `async headers()` setting `Access-Control-Allow-Origin: *`, `Content-Type: text/markdown`, and `Cache-Control` on `/SKILL.md`. `.ts` (dead): only `reactStrictMode: true`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck API | `pnpm --filter @argens/api exec tsc --noEmit` | exit 0 |
| Tests | `pnpm --filter @argens/api test` | all pass |
| Web build | `pnpm --filter @argens/web build` | exit 0 (run for fix D) |

## Scope

**In scope**:
- `apps/api/src/routes/agent.ts`
- `apps/api/src/routes/wallet.ts` (balance endpoint only)
- `apps/api/src/services/stellar.ts` (add one helper; do not change existing exports' behavior)
- `apps/api/src/services/watcher.ts` (server reuse only)
- `apps/web/next.config.ts` (delete)
- `apps/api/src/routes/agent.test.ts` (create, if vitest exists)

**Out of scope** (do NOT touch):
- `POST /wallet/send` in `wallet.ts` — money path, owned by plans 002/003 follow-ups.
- Watcher reconnect/fallback *logic* (`resetFallbackTimer`, `handlePayment`) — restructuring stream lifecycle is riskier than this plan's budget; only swap the Server instance.
- `next.config.mjs` — it is correct; do not "unify" into TS (Next 14 does not support `next.config.ts`; that lands with Next 15).
- Response shapes of `/agent/status`, `/spend/summary`, `/wallet/balance` — agents and the dashboard consume them.

## Git workflow

- Branch: `advisor/005-agent-aggregation-cleanups`
- One conventional commit per fix (A–D): `perf: ...`, `chore: ...`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1 (A): Replace in-memory sums with Prisma aggregation

In `agent.ts` `GET /agent/status`, replace the `findMany` + reduce with:

```ts
const todayAgg = await prisma.transaction.aggregate({
  where: { userId, status: 'SUCCESS', createdAt: { gte: todayStart } },
  _sum: { amount: true },
  _count: { _all: true },
})
const todaySpend = (todayAgg._sum.amount ?? new Decimal(0)).toFixed(7)
const todayCount = todayAgg._count._all
```

(`Decimal` from `@prisma/client/runtime/library` — match the import in `apps/api/src/services/policy.ts:18`.)

In `GET /spend/summary`, replace the success-tx `findMany` + float reduce + bucket loop with `prisma.transaction.groupBy`. Prisma cannot group by a date *truncation* without raw SQL (repo rule: Prisma only), so group in JS but with **Decimal** arithmetic and a row cap as a safety valve:

```ts
const [agg, successTxs, blockedCount] = await Promise.all([
  prisma.transaction.aggregate({
    where: { userId, status: 'SUCCESS', createdAt: { gte: periodStart } },
    _sum: { amount: true },
    _count: { _all: true },
  }),
  prisma.transaction.findMany({
    where: { userId, status: 'SUCCESS', createdAt: { gte: periodStart } },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
    take: 10000,
  }),
  prisma.transaction.count({ where: { userId, status: 'BLOCKED', createdAt: { gte: periodStart } } }),
])
const totalSpent = (agg._sum.amount ?? new Decimal(0)).toFixed(7)

const buckets = new Map<string, { amount: Decimal; count: number }>()
for (const tx of successTxs) {
  const key = tx.createdAt.toISOString().slice(0, 10)
  const cur = buckets.get(key) ?? { amount: new Decimal(0), count: 0 }
  buckets.set(key, { amount: cur.amount.plus(tx.amount), count: cur.count + 1 })
}
const breakdown = [...buckets.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([date, b]) => ({ date, amount: b.amount.toFixed(7), count: b.count }))
```

`transaction_count` in the response becomes `agg._count._all`. This also fixes the hardcoded `count: 1` bug.

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0; `grep -n "parseFloat" apps/api/src/routes/agent.ts` → no matches.

### Step 2 (B): One `loadAccount` for both balances

In `stellar.ts`, add (below `getXlmBalance`, same style):

```ts
/** Fetch USDC and XLM balances with a single Horizon loadAccount call.
 *  Returns null when the account doesn't exist on this network (404). */
export async function getAccountBalances(
  publicKey: string,
): Promise<{ usdc: string; xlm: string } | null> { ... }
```

Implementation: copy `getUsdcBalance`'s `loadAccount` + 404/StellarError handling exactly; extract USDC as it does, and XLM via `account.balances.find((b) => b.asset_type === 'native')` (read `getXlmBalance`'s body first and reuse its extraction precisely).

In `wallet.ts` `GET /wallet/balance`, replace the cache-miss `getUsdcBalance` call with `getAccountBalances`, take `usdc` for the existing cache logic and keep `xlm` in a local; on cache-*hit*, fetch XLM with the existing `getXlmBalance(...).catch(() => null)` (XLM isn't cached — preserve that behavior rather than inventing an XLM cache). Net effect: cache-miss path goes from 2 Horizon calls to 1; cache-hit path is unchanged. Remove the now-duplicate unconditional XLM fetch.

Leave `getUsdcBalance`/`getXlmBalance` exported — other call sites (`agent.ts`, `watcher.ts`, CCTP preflight) still use them.

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0; `grep -c "loadAccount" apps/api/src/services/stellar.ts` → grew by exactly 1.

### Step 3 (C): Reuse the Horizon server singleton in the watcher

In `watcher.ts`, delete `const server = new Horizon.Server(HORIZON_URL)` inside `subscribeToPayments` and import the singleton: `import { server } from './stellar.js'` (check `watcher.ts`'s existing imports for the path style; it likely already imports from `./stellar.js`). Remove the now-unused `Horizon`/`HORIZON_URL` imports if nothing else in the file uses them.

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0; `grep -n "new Horizon.Server" apps/api/src/services/watcher.ts` → no matches.

### Step 4 (D): Delete the dead next config

Delete `apps/web/next.config.ts`. Then build the web app and confirm the SKILL.md headers still apply (they live in `.mjs`).

**Verify**: `pnpm --filter @argens/web build` → exit 0. Optionally `pnpm --filter @argens/web start` + `curl -sI http://localhost:3000/SKILL.md | grep -i access-control` → `Access-Control-Allow-Origin: *` (skip if you can't run a server; the build gate suffices since the deleted file contained no headers).

### Step 5: Tests (if plan 001 landed)

`apps/api/src/routes/agent.test.ts`: with the prisma mock pattern from `policy.test.ts`, assert (1) `aggregate` is called with the SUCCESS/date filter and its `_sum` flows through as a 7-decimal string, (2) Decimal summation: amounts `'0.1000000'` × 3 bucket to `'0.3000000'` exactly (the float version yields `0.30000000000000004` — this is the regression test), (3) bucket counts are real counts, not 1.

**Verify**: `pnpm --filter @argens/api test` → all pass.

## Test plan

Step 5; B–D are covered by typecheck, grep gates, and the web build.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter @argens/api exec tsc --noEmit` exits 0
- [ ] `grep -n "parseFloat" apps/api/src/routes/agent.ts` → no matches
- [ ] `grep -n "new Horizon.Server" apps/api/src/services/watcher.ts` → no matches
- [ ] `apps/web/next.config.ts` does not exist; `pnpm --filter @argens/web build` exits 0
- [ ] `pnpm --filter @argens/api test` exits 0 (if vitest present)
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `getXlmBalance`'s native-balance extraction differs materially from the sketch (read it first; characterize, don't guess).
- The watcher's `server` usage turns out to depend on per-instance state (e.g. it mutates server config per wallet) — report instead of forcing the singleton.
- `pnpm --filter @argens/web build` fails for reasons unrelated to the config deletion (pre-existing breakage) — report with the error; do not fix web build issues here.
- Response-shape consumers (dashboard pages) visibly depend on the buggy `count: 1` (unlikely; check `grep -rn "breakdown" apps/web/app/dashboard/analytics/` before changing).

## Maintenance notes

- **Deferred follow-up (recorded, not planned):** `/pay` (transactions.ts) and `/wallet/send` (wallet.ts) duplicate ~80 lines of policy→branch→submit flow; that duplication caused the plan-002 bug. Extracting a shared `executePaymentFlow` service is worth doing *after* plans 002/003 land and stabilize, as its own plan.
- If/when transaction volume makes the 10k `take` in `/spend/summary` insufficient, the date bucketing must move to raw-SQL `date_trunc` — that requires revisiting the "Prisma only" rule with the maintainer.
- Reviewer should scrutinize: `/spend/summary` `total_spent` now comes from `aggregate` over ALL rows while `breakdown` covers at most 10k rows — at very high volume they could diverge; acceptable, but the response keeps `total_spent` authoritative.
