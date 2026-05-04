# Current Task

## Task: Phase 2 — Core API
**Goal:** All 9 agent-facing endpoints live and tested. Policy engine enforcing rules. Stellar payments executing on testnet. All 10 test scenarios passing.
**Files affected:** services/policy.ts, services/payment.ts, services/watcher.ts, routes/transactions.ts, routes/policies.ts, routes/wallet.ts, routes/agent.ts, routes/approve.ts, services/email.ts (additional templates), index.ts (register routes)
**Steps:**
- [ ] services/policy.ts — TypeScript policy stand-in
- [ ] services/payment.ts — submitPayment with 2-op atomic tx (recipient + fee wallet)
- [ ] routes/transactions.ts — POST /pay (Stellar), POST /quote, POST /refund
- [ ] routes/wallet.ts — GET /wallet/balance (30s cache)
- [ ] routes/agent.ts — GET /agent/status, GET /spend/summary
- [ ] routes/policies.ts — GET /policies, POST /policies
- [ ] routes/approve.ts — POST /approve/:token, POST /reject/:token
- [ ] Email templates: blocked, pending-approval, approval-acted-on, low-balance
- [ ] services/watcher.ts — Horizon SSE stream + 60s fallback poller
- [ ] Low-balance warning trigger (post-payment)
- [ ] Register all new routes in index.ts
- [ ] Generate testnet ops + fee wallet keypairs, fund via friendbot, add to .env
- [ ] Verify ARGENS_FEE_WALLET has USDC trustline on testnet
- [ ] All 10 test scenarios passing
**Risks:** Decimal math errors in fee calculation; totalSpent incrementing on non-SUCCESS; approval token not single-use; CCTP V2 SDK not verified yet (Base path deferred to Phase 2b)
**Done when:** All 10 test scenarios pass against testnet. POST /pay with a real USDC balance returns a Stellar tx hash visible on Horizon explorer.
