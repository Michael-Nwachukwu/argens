# Plan 001: Establish a test runner, unit-test baseline, and CI gate for the API

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a457cd0..HEAD -- package.json apps/api/package.json apps/api/src/services/policy.ts apps/api/src/services/cctp.ts apps/api/src/lib/response.ts apps/api/src/lib/crypto.ts apps/api/src/services/stellar.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `a457cd0`, 2026-06-12

## Why this matters

Argens is live payment infrastructure on Stellar **mainnet** — it signs real USDC transactions with user keys — and the repository has **zero automated tests, no test runner, no lint, and no CI**. The only verification gate today is the TypeScript compiler. Every other plan in `plans/` changes money-path logic; without this baseline, those changes land unverified. This plan installs Vitest, writes unit tests for the pure/deterministic money logic (policy check order, CCTP fee computation, decimal serialization, key encryption, address/memo validation), adds one-command `typecheck`/`test`/`verify` scripts at the repo root, and adds a GitHub Actions workflow so nothing merges without those passing.

## Current state

This is a pnpm workspace monorepo (`pnpm-workspace.yaml` → `apps/*`). Two packages: `@argens/api` (Express + TypeScript + Prisma, in `apps/api`) and `@argens/web` (Next.js 14, in `apps/web`).

- Root `package.json` scripts — note no test/typecheck/lint entries:

```json
"scripts": {
  "dev:api": "pnpm --filter @argens/api dev",
  "dev:web": "pnpm --filter @argens/web dev",
  "build:api": "pnpm --filter @argens/api build",
  "db:migrate": "pnpm --filter @argens/api db:migrate",
  "db:studio": "pnpm --filter @argens/api db:studio"
}
```

- `apps/api/package.json` — devDependencies contain `tsx`, `typescript`, `prisma`, `@types/*`; **no test runner**. `"build": "tsc"` works (verified: `pnpm exec tsc --noEmit` exits 0 at the planned-at commit).
- There is no `.github/` directory anywhere in the repo.
- The API uses ESM-style imports with `.js` extensions (e.g. `import { prisma } from '../lib/prisma.js'`). The tsconfig is at `apps/api/tsconfig.json` extending `../../tsconfig.base.json`.

Modules this plan writes tests for (read each before testing it):

- `apps/api/src/services/policy.ts` — `checkPolicy(userId, amount)` reads `prisma.policy.findUnique({ where: { userId } })` then applies three checks **in this exact order** (this order is a documented product rule from CLAUDE.md "Policy Engine Logic"):
  1. Max Transaction: BLOCKED with `reason: 'max_transaction_exceeded'` if `amount > maxTransactionLimit`
  2. Allowance: BLOCKED with `reason: 'allowance_exceeded'` if `amount > allowanceLimit - totalSpent`
  3. Approval Threshold: `PENDING_APPROVAL` if `amount >= approvalThreshold`
  4. Otherwise `APPROVED`.
  All three limits are nullable (`null` = not set, check skipped, detail field `'not_set'`). Amounts are Prisma `Decimal`s in the DB and 7-decimal strings at the API boundary. It throws `AppError('Policy record not found for user', 'POLICY_NOT_FOUND', 500)` when no policy row exists.
- `apps/api/src/services/cctp.ts` — `computeCctpFee(amount: string): string` with exported constants `CCTP_FEE_RATE = new Decimal('0.005')`, `CCTP_FEE_MIN = new Decimal('0.05')`, `CCTP_FEE_MAX = new Decimal('2.00')` (fee = 0.5% clamped to [$0.05, $2.00]). Also `encodeEvmRecipient(evmAddress: string): Buffer` (pads a 20-byte EVM address to 32 bytes).
- `apps/api/src/lib/response.ts` — `serializeDecimals` (module-private; test it through `sendSuccess` with a mock `res`, or export it — see Step 3) converts Prisma `Decimal` → `toFixed(7)` string and `Date` → ISO string, recursively.
- `apps/api/src/lib/crypto.ts` — `encryptSecretKey` / `decryptSecretKey` (AES-256-GCM using hex `ENCRYPTION_KEY` env var) and `generateSecureToken()`.
- `apps/api/src/services/stellar.ts` — `isStellarAddress`, `isEvmAddress`, `validateMemo` (pure validators).

Repo conventions to match: strict TypeScript, no `any` (use `unknown` + narrowing), files are `camelCase.ts` for services. Error type is `AppError` from `apps/api/src/lib/errors.ts` with `(message, code, statusCode, details?)`.

`prisma` is a singleton exported from `apps/api/src/lib/prisma.ts`. Unit tests must NOT hit a real database — mock the module with `vi.mock`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` (repo root) | exit 0 |
| Typecheck API | `pnpm --filter @argens/api exec tsc --noEmit` | exit 0, no output |
| Build API | `pnpm build:api` | exit 0 |
| Tests (after this plan) | `pnpm --filter @argens/api test` | all pass |

## Scope

**In scope** (the only files you should modify or create):
- `package.json` (root — add scripts only)
- `apps/api/package.json` (add devDeps + `test` script)
- `apps/api/vitest.config.ts` (create)
- `apps/api/src/services/policy.test.ts` (create)
- `apps/api/src/services/cctp.test.ts` (create)
- `apps/api/src/services/stellar.test.ts` (create)
- `apps/api/src/lib/crypto.test.ts` (create)
- `apps/api/src/lib/response.test.ts` (create)
- `apps/api/src/lib/response.ts` (only if exporting `serializeDecimals` — Step 3)
- `apps/api/tsconfig.json` (only if needed to exclude test files from `dist` build)
- `.github/workflows/ci.yml` (create)

**Out of scope** (do NOT touch):
- Any production logic in `policy.ts`, `cctp.ts`, `crypto.ts`, `stellar.ts` — these tests *characterize* current behavior; if a test reveals a bug, record it in your report, do not fix it here (plans 002/003 fix the known ones).
- `apps/web` entirely (no web tests in this plan).
- `apps/api/prisma/schema.prisma` — no schema changes.
- `docker-compose.yml`, deployment config.

## Git workflow

- Branch: `advisor/001-test-ci-baseline`
- Commit style: conventional commits, matching history (e.g. `feat: add wallet bootstrap retry endpoint`). Use `test: ...` / `ci: ...` prefixes.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Install Vitest in the API package

In `apps/api`, add devDependencies `vitest` (^2.x or ^3.x, latest stable) and add script `"test": "vitest run"` plus `"test:watch": "vitest"` to `apps/api/package.json`. Run `pnpm install` from the repo root. Note the root `package.json` has `pnpm.onlyBuiltDependencies` — vitest/esbuild may need `esbuild` there; it is already listed.

Create `apps/api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

If the API tsconfig (`"include": ["src"]`) causes `tsc` to try to compile test files into `dist`, add `"**/*.test.ts"` to the `exclude` array of `apps/api/tsconfig.json` — but then typecheck tests via vitest's own transform (vitest does not typecheck; that is acceptable, `tsc` still covers production code).

**Verify**: `pnpm --filter @argens/api test` → "no test files found" exit code may be non-zero; that's expected until Step 2. `pnpm --filter @argens/api exec tsc --noEmit` → exit 0.

### Step 2: Write `policy.test.ts` (the core suite)

Create `apps/api/src/services/policy.test.ts`. Mock the prisma singleton **before** importing the module under test:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    policy: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from '../lib/prisma.js'
import { checkPolicy } from './policy.js'

const mockFindUnique = vi.mocked(prisma.policy.findUnique)

function policyRow(over: Partial<{
  allowanceLimit: Decimal | null
  maxTransactionLimit: Decimal | null
  approvalThreshold: Decimal | null
  totalSpent: Decimal
}> = {}) {
  return {
    id: 'pol_1', userId: 'usr_1',
    allowanceLimit: null, maxTransactionLimit: null, approvalThreshold: null,
    totalSpent: new Decimal(0), sorobanContractId: null, updatedAt: new Date(),
    ...over,
  }
}
```

Cases to cover (each asserts `status`, `reason` where applicable, and the relevant `detail` field). These mirror the 10 manual scenarios in CLAUDE.md "Testing":

1. No limits set → `APPROVED`, all detail fields `'not_set'`.
2. Amount under all limits → `APPROVED`, `max_transaction: 'passed'`, `allowance: 'passed'`, `approval_threshold: 'passed'`.
3. Amount > maxTransactionLimit → `BLOCKED`, `reason: 'max_transaction_exceeded'` — even when allowance would also fail (check order: max-tx first).
4. Amount exactly equal to maxTransactionLimit → `APPROVED` path continues (limit is `>` strict).
5. Amount > allowanceLimit − totalSpent → `BLOCKED`, `reason: 'allowance_exceeded'`.
6. Amount exactly equal to remaining allowance → not blocked (strict `>`).
7. Amount ≥ approvalThreshold → `PENDING_APPROVAL` (test both equal and greater).
8. Amount just below approvalThreshold → `APPROVED`.
9. Policy row missing (`findUnique` resolves null) → throws `AppError` with `code === 'POLICY_NOT_FOUND'`.
10. Decimal-string fidelity: with `allowanceLimit: new Decimal('500')`, `totalSpent: new Decimal('7.5')`, the returned `policy.allowance_remaining === '492.5000000'`.

**Verify**: `pnpm --filter @argens/api test` → policy suite passes (10+ tests).

### Step 3: Write the pure-function suites

- `cctp.test.ts`: `computeCctpFee('25.0000000')` → `'0.1250000'`; tiny amount (`'1.0000000'`) clamps to `'0.0500000'`; huge amount (`'1000.0000000'`) clamps to `'2.0000000'`; result is always a 7-decimal string. `encodeEvmRecipient('0x' + '11'.repeat(20))` → `Buffer` of length 32 with 12 leading zero bytes. Importing `cctp.ts` may require env vars (it reads config at module load — check the top of the file first; if module-load requires env like `BASE_RELAYER_SECRET`, set dummy values via `vi.stubEnv` or a `beforeAll`, or skip `encodeEvmRecipient` and keep only what imports cleanly — record what you did).
- `stellar.test.ts`: `isStellarAddress` true for a 56-char `G...` string, false for 0x addresses/short strings; `isEvmAddress` true for 42-char `0x...`, false otherwise; `validateMemo` accepts ≤28 bytes, throws on 29+ bytes (test a multi-byte UTF-8 string near the limit if the implementation is byte-based — read the implementation first and characterize what it actually does).
- `crypto.test.ts`: set `process.env.ENCRYPTION_KEY` to a 64-hex-char dummy (generate with `crypto.randomBytes(32).toString('hex')` inside the test — it is a test-only value, never a real key); assert `decryptSecretKey(encryptSecretKey('SABC...'))` round-trips; assert tampering with the ciphertext throws; `generateSecureToken()` returns 64 hex chars and two calls differ. Note: if `crypto.ts` reads `ENCRYPTION_KEY` at module load rather than per-call, set the env var before the dynamic `await import('./crypto.js')`.
- `response.test.ts`: easiest path — add `export` to `serializeDecimals` in `apps/api/src/lib/response.ts` (a one-word change; allowed). Assert: `Decimal('25')` → `'25.0000000'`; nested objects/arrays converted; `Date` → ISO string; null/strings pass through.

**Verify**: `pnpm --filter @argens/api test` → all suites pass. `pnpm --filter @argens/api exec tsc --noEmit` → exit 0.

### Step 4: Root one-command verification scripts

Add to root `package.json` scripts:

```json
"typecheck": "pnpm --filter @argens/api exec tsc --noEmit",
"test": "pnpm --filter @argens/api test",
"verify": "pnpm typecheck && pnpm test"
```

(Web typecheck is intentionally excluded for now: `apps/web` typechecks during `next build` and adding it here may surface unrelated pre-existing errors. Do not expand scope.)

**Verify**: `pnpm verify` from repo root → exit 0.

### Step 5: GitHub Actions CI

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @argens/api exec prisma generate
      - run: pnpm typecheck
      - run: pnpm test
```

Note the `prisma generate` step — the API imports `@prisma/client`, which requires generation before `tsc` passes on a fresh checkout. Confirm the generate command works locally first: `pnpm --filter @argens/api exec prisma generate` (it only writes into `node_modules`, safe).

**Verify**: `pnpm install --frozen-lockfile && pnpm --filter @argens/api exec prisma generate && pnpm verify` locally → exit 0. (Actual GitHub run happens after the operator pushes; you cannot verify that here.)

## Test plan

This plan IS the test plan. Final count expectation: ≥25 tests across 5 files, all passing, zero network/database access (run with Wi-Fi off if in doubt — tests must still pass).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm verify` exits 0 at repo root
- [ ] `pnpm --filter @argens/api test` reports ≥25 passing tests, 0 failures
- [ ] `ls apps/api/src/services/policy.test.ts apps/api/src/services/cctp.test.ts apps/api/src/services/stellar.test.ts apps/api/src/lib/crypto.test.ts apps/api/src/lib/response.test.ts` → all exist
- [ ] `.github/workflows/ci.yml` exists and `pnpm install --frozen-lockfile` + the workflow's commands succeed locally
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `checkPolicy`'s behavior contradicts the documented check order (that would mean the code drifted or the characterization is wrong — the test must record actual behavior, but a *contradiction with CLAUDE.md's order* is a bug to report, not to fix here).
- Importing `cctp.ts` or `crypto.ts` in a test fails due to module-load side effects you cannot satisfy with dummy env vars.
- `vi.mock('../lib/prisma.js', ...)` does not intercept (ESM path-alias issues) after two fix attempts — report the exact error.
- Adding vitest breaks `pnpm build:api`.

## Maintenance notes

- Plans 002 and 003 add tests to `policy.test.ts`'s patterns — keep the prisma-mock helper reusable (consider extracting to `apps/api/src/test-utils.ts` only if both plans land).
- A future integration-test layer (real Postgres via docker-compose, mocked Horizon) is deliberately deferred — unit tests on pure logic are the highest-leverage first step.
- Reviewer should scrutinize: that no test asserts a *wrong* behavior as correct (especially scenario 4/6 boundary semantics — strict `>` vs `>=` must match the code, which matches CLAUDE.md).
