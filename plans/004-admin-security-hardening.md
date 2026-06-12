# Plan 004: Stop returning encrypted signing keys from the admin API; timing-safe admin auth; remove token leak from signup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat a457cd0..HEAD -- apps/api/src/routes/admin.ts apps/api/src/routes/auth.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (can land before or in parallel with plans 001–003)
- **Category**: security
- **Planned at**: commit `a457cd0`, 2026-06-12

## Why this matters

Three independent, small, high-confidence security fixes in a mainnet payment API that custodies user signing keys:

1. **`GET /admin/users/:userId` returns `wallet.stellarSecretKeyEnc`** — the AES-256-GCM-encrypted Stellar secret key — to any caller holding the admin secret. CLAUDE.md's non-negotiable rule is "Private keys — never logged, never in responses, never to frontend, encrypted at rest always." Encrypted or not, the key must never leave the API; combined with an `ENCRYPTION_KEY` leak it is full wallet compromise, and it currently flows to the admin console in a browser.
2. **The admin secret check uses `!==`** — a non-constant-time comparison on a bearer credential, allowing timing side-channel attacks. The API is already deployed publicly (VPS via Dokploy), so this exposure is live.
3. **Signup returns `dev_verify_url`** (containing the email-verification token) **whenever `NODE_ENV !== 'production'`** — any staging/preview deployment that forgets to set NODE_ENV hands account verification to whoever calls signup. The web app does not consume this field (verified: `grep -rn "dev_verify_url" apps/web` → no matches), so removal is safe.

Out of band, for the operator (not the executor): the single shared `ADMIN_SECRET` / no-RBAC model is a documented V1 decision (comment at the top of `admin.ts`) and is not changed by this plan.

## Current state

- `apps/api/src/routes/admin.ts` — admin router, mounted at `/v1/admin` (`apps/api/src/index.ts:53`), guarded by `requireAdmin` middleware:

```ts
// admin.ts:35-48
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env['ADMIN_SECRET']
  if (!expected) {
    logger.error('ADMIN_SECRET not configured — admin endpoints disabled')
    sendError(res, 'Admin endpoints are not enabled.', 'ADMIN_DISABLED', 503)
    return
  }
  const provided = req.header('x-admin-secret')
  if (!provided || provided !== expected) {
    sendError(res, 'Unauthorized.', 'UNAUTHORIZED', 401)
    return
  }
  next()
}
```

- The leaking endpoint, `GET /admin/users/:userId` (starts ~line 348):

```ts
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    wallet: true,                    // ← pulls ALL wallet fields incl. stellarSecretKeyEnc
    policies: true,
    creditGrants: { orderBy: [{ createdAt: 'desc' }], take: 20 },
    _count: { select: { transactions: true } },
  },
})
...
sendSuccess(res, {
  ...user,                           // ← spreads user INCLUDING the nested wallet object
  passwordHash: undefined,           // these strip only TOP-LEVEL fields;
  emailVerificationToken: undefined, // wallet.stellarSecretKeyEnc survives
  transferPinHash: undefined,
  active_credits_balance: ...,
  tx_by_status: ...,
})
```

- The safe exemplar in the same file — `GET /admin/users` (list, ~line 314) already does it right with an explicit nested select:

```ts
wallet: { select: { stellarPublicKey: true, status: true, balanceCache: true, creditsGranted: true } },
```

- The Wallet model fields (from `apps/api/prisma/schema.prisma`): `id, userId, stellarPublicKey, stellarSecretKeyEnc, status, balanceCache, balanceCachedAt, creditsGranted, createdAt`.

- The admin console UI (`apps/web/app/x/console-a3f9k2p7/page.tsx`) reads `u.wallet.balanceCache` and `u.wallet.creditsGranted` from the list endpoint; check what the detail view reads before finalizing the select list (grep that file for `wallet.`).

- `apps/api/src/routes/auth.ts` — signup response (~lines 113–120):

```ts
const isDev = process.env['NODE_ENV'] !== 'production'
const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000'

logger.info('User signed up', { userId: user.id, accessCodeId: code.id })
sendSuccess(res, {
  message: 'Account created. Check your email to verify and activate your wallet.',
  ...(isDev && { dev_verify_url: `${frontendUrl}/auth/verify?token=${emailVerificationToken}` }),
}, 201)
```

- Conventions: `sendError(res, message, code, status)`; structured `logger`; strict TS (no `any`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm --filter @argens/api exec tsc --noEmit` | exit 0 |
| Tests (if plan 001 landed) | `pnpm --filter @argens/api test` | all pass |
| Leak scan | `grep -rn "stellarSecretKeyEnc" apps/api/src/routes/` | see Done criteria |

## Scope

**In scope**:
- `apps/api/src/routes/admin.ts`
- `apps/api/src/routes/auth.ts` (signup response only)
- `apps/api/src/routes/admin.test.ts` (create — only if plan 001's vitest harness exists; otherwise skip tests and note it)

**Out of scope** (do NOT touch):
- Legitimate `stellarSecretKeyEnc` *reads* in services (`decryptSecretKey(wallet.stellarSecretKeyEnc)` in `transactions.ts`, `wallet.ts`, `approve.ts`, `marketplace.ts`, `payment.ts`) — those are the signing path, in-process only, correct.
- The admin auth *model* (single shared secret, no RBAC) — documented V1 decision.
- The wallet private-key **export** feature on the user dashboard (if present in `wallet.ts` routes) — that is a deliberate product feature (user-initiated, JWT-authed), not a leak.
- `apps/web/app/x/console-a3f9k2p7/page.tsx` — unless the detail view renders a field you removed; see STOP conditions.

## Git workflow

- Branch: `advisor/004-admin-security-hardening`
- Conventional commits (`fix: ...`), one commit per step is fine.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace `include: { wallet: true }` with an explicit safe select

In `GET /admin/users/:userId`, change the `findUnique` to:

```ts
include: {
  wallet: {
    select: {
      id: true,
      stellarPublicKey: true,
      status: true,
      balanceCache: true,
      balanceCachedAt: true,
      creditsGranted: true,
      createdAt: true,
    },
  },
  policies: true,
  creditGrants: { orderBy: [{ createdAt: 'desc' }], take: 20 },
  _count: { select: { transactions: true } },
},
```

(Everything except `userId` and `stellarSecretKeyEnc`; `userId` is redundant with the parent. First grep the console page — `grep -n "wallet\." apps/web/app/x/console-a3f9k2p7/page.tsx` — and keep any wallet field its detail view renders.)

Keep the `passwordHash: undefined` / `emailVerificationToken: undefined` / `transferPinHash: undefined` strips — they cover the top-level User fields, which are still spread.

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0. `grep -n "wallet: true" apps/api/src/routes/admin.ts` → no matches.

### Step 2: Timing-safe admin secret comparison

In `admin.ts`, add at the top: `import { timingSafeEqual, createHash } from 'crypto'` (Node builtin; match the file's existing import style — check whether it uses `node:crypto` prefix elsewhere in the repo: `grep -rn "from 'crypto'\|from \"node:crypto\"" apps/api/src/lib/crypto.ts`).

Replace the comparison in `requireAdmin`:

```ts
const provided = req.header('x-admin-secret')
if (!provided || !secretsMatch(provided, expected)) {
  sendError(res, 'Unauthorized.', 'UNAUTHORIZED', 401)
  return
}
```

with the helper (hashing both sides first makes lengths equal, so `timingSafeEqual` never throws on length mismatch and leaks nothing through the length path):

```ts
function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}
```

**Verify**: `pnpm --filter @argens/api exec tsc --noEmit` → exit 0.

### Step 3: Remove `dev_verify_url` from the signup response

In `auth.ts`, delete the `isDev` conditional spread from the signup `sendSuccess` (and the now-unused `isDev` variable if nothing else references it — check with grep within the handler). To preserve the local-dev convenience it provided, log it server-side instead, right before `sendSuccess`:

```ts
if (process.env['NODE_ENV'] !== 'production') {
  logger.info('Dev verification URL', { userId: user.id, url: `${frontendUrl}/auth/verify?token=${emailVerificationToken}` })
}
```

(Server logs in dev are the developer's own terminal — acceptable; the response body is not. `frontendUrl` stays since the log uses it; if the resend-verification handler or anything else in the file also emits `dev_verify_url`, apply the same change there — check: `grep -n "dev_verify_url" apps/api/src/routes/auth.ts`.)

**Verify**: `grep -rn "dev_verify_url" apps/api/src` → no matches. `pnpm --filter @argens/api exec tsc --noEmit` → exit 0.

### Step 4: Regression test (only if vitest exists from plan 001)

Create `apps/api/src/routes/admin.test.ts` with one focused test: import nothing from the route (supertest isn't installed); instead unit-test `secretsMatch` (export it) — equal strings → true; differing strings → false; differing lengths → false (no throw). Add a leak-scan test that reads `apps/api/src/routes/admin.ts` source with `fs.readFileSync` and asserts it does not contain `wallet: true` — a cheap tripwire against regression.

**Verify**: `pnpm --filter @argens/api test` → all pass.

## Test plan

Step 4, plus the grep gates in Done criteria. If plan 001 hasn't landed, the grep gates are the verification.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter @argens/api exec tsc --noEmit` exits 0
- [ ] `grep -rn "stellarSecretKeyEnc" apps/api/src/routes/admin.ts` → no matches
- [ ] `grep -rn "dev_verify_url" apps/api/src` → no matches
- [ ] `grep -n "timingSafeEqual" apps/api/src/routes/admin.ts` → ≥1 match
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- The admin console detail view (`apps/web/app/x/console-a3f9k2p7/page.tsx`) renders `stellarSecretKeyEnc` or another field your select removed — that's a product decision (the console would be *displaying* encrypted keys); report it, don't redesign the console.
- `requireAdmin` or the user-detail endpoint doesn't match the excerpts (drift).
- You find other endpoints returning `stellarSecretKeyEnc` (`grep -rn "stellarSecretKeyEnc" apps/api/src/routes/` shows hits outside admin.ts beyond signing-path `decryptSecretKey` reads in route files) — fix only admin.ts here, report the rest.

## Maintenance notes

- Any future admin endpoint that includes `wallet` must use an explicit `select` — the list endpoint (~line 314) and the now-fixed detail endpoint are the patterns. A Prisma client extension globally omitting `stellarSecretKeyEnc` (Prisma `omit` config, available in Prisma 5.16+ as preview) would make this structural; deferred as a follow-up.
- The API is already live on a VPS (Dokploy): the operator should rotate `ADMIN_SECRET` now if the production value ever lived in dev terminals/logs, and confirm `NODE_ENV=production` is set explicitly in the Dokploy environment (the `dev_verify_url` leak in Step 3 fires whenever it isn't).
- Reviewer should scrutinize: the console's user-detail screen still renders (fields it needs survived the select), and the signup flow in local dev still gives the developer a way to verify accounts (the logged URL).
