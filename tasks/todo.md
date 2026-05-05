# Current Task

## Task: Phase 3 — Dashboard
**Goal:** Full Next.js 14 dashboard live and connected to Phase 2 API. All pages functional against testnet.
**Files affected:** apps/web/ (entire Next.js app)
**Steps:**
- [ ] apps/web scaffold — Next.js 14 App Router, TypeScript, Tailwind CSS
- [ ] apps/web/package.json — dependencies (next, react, tailwind, shadcn/ui or custom components)
- [ ] Auth pages — /login, /signup (wired to POST /v1/auth/login, /v1/auth/signup)
- [ ] Email verification redirect — /auth/verify?token=... hits GET /v1/auth/verify/:token
- [ ] Protected layout — sidebar nav, auth guard, JWT stored in httpOnly cookie or memory
- [ ] Overview page — wallet balance, today spend, recent transactions
- [ ] Wallet page — balance, deposit address, QR code, wallet status
- [ ] Policies page — edit allowance/max_tx/threshold inline, POST /v1/policies
- [ ] Pending approvals section on Policies page — list PENDING_APPROVAL txs, approve/reject buttons
- [ ] /approve/confirm?token=... page — shows tx detail, Approve/Reject buttons → POST /approve/:token
- [ ] Transactions page — table, status badges, filters, pagination
- [ ] Analytics page — spend chart (Recharts), blocked tx breakdown
- [ ] API Keys page — masked key, copy button, regenerate (POST /v1/auth/api-keys)
- [ ] Settings page — password change, notifications
- [ ] API client lib (apps/web/lib/api.ts) — typed fetch wrapper with JWT header
**Risks:** Cookie vs localStorage JWT strategy; CORS between :3000 and :3001; chart library choice
**Done when:** Full signup → verify → fund → set policy → agent pay → block → approve flow works end-to-end through the UI.

---

## Phase 2 — COMPLETED ✅
All 10 test scenarios passed against testnet (2026-05-05).

| # | Scenario | Result |
|---|---|---|
| 1 | Pay within all limits | ✅ SUCCESS — hash 62ed61c1... on Horizon ledger 2385967 |
| 2 | Pay above maxTransactionLimit | ✅ BLOCKED — max_transaction_exceeded |
| 3 | Pay when allowance exhausted | ✅ BLOCKED — allowance_exceeded |
| 4 | Pay above approvalThreshold | ✅ PENDING_APPROVAL — approval queue entry created |
| 5 | Developer approves pending tx | ✅ APPROVED → SUCCESS — hash cf013d63... |
| 6 | Developer rejects pending tx | ✅ REJECTED — no payment made |
| 7 | Approval token re-used (single-use) | ✅ 400 INVALID_TOKEN |
| 8 | Invalid API key | ✅ 401 UNAUTHORIZED |
| 9 | Wallet has insufficient USDC | ✅ FAILED — op_underfunded from Stellar |
| 10 | /quote on would-be-blocked tx | ✅ would_be_blocked, zero DB records created |

Fee wallet: GBAR7W4RW2B2Q2J5JPLDC627K6JB7Q7VBOLIJS6DJE3JRLYBMQRODROE (testnet, USDC trustline ✅)
