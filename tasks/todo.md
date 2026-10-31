## Task: Live verification follow-ups (2026-10-29)
**Goal:** Fix what the first live GET call (`mercury_txs_by_hash`, credit pool) exposed.
- [x] Live call: 404 with the catalog's example hash (no charge, classified `none`); 200 with a real hash — data delivered, **no settlement** (no `X-Payment-Tx`, pool balance unchanged)
- [x] Unsettled-but-delivered calls: `metadata.mpp_router.settlement` + `AuditLog MARKETPLACE_SETTLEMENT_UNCONFIRMED` + warn log; stays SUCCESS, markup still charged
- [x] Mainnet Soroban RPC fallback → `mainnet.sorobanrpc.com` (`mpp-client.ts`, `cctp.ts`)
- [x] Curated working `tx_hash` for `mercury_txs_by_hash`
- [ ] Raise the silent settle failure with MPP Router (Mercury, 2026-10-29 ~18:25 UTC, payer GADF…3ZJR)

## Task: MPP Router auto-refunds, path params, GET routes

**Goal:** Stop Argens double-refunding (and credit users losing credits) now that MPP Router auto-refunds non-delivered paid calls, and expose the catalog features agents currently can't use (path params, GET routes).

**Why:** MPP Router settles before calling upstream and, on non-delivery (timeout / 5xx / 4xx after payment / empty body), queues a full refund to the payer and returns `Refund-Status: pending` + `Refund-Id`. Argens ignores those headers and flags every settled-but-failed call for a manual ops refund → ops would refund the user a second time. On the credit path MPP refunds the pool, but the user's credits stay deducted.

**Refund-Status → Argens action** (source: rozo-mpprouter `src/mpp-proxy.ts`, `docs/receipts-and-refunds.md`):
| `Refund-Status` | Meaning | USDC path | Credit path |
|---|---|---|---|
| `pending` | MPP auto-refund queued to payer | no manual flag; store refund id/url | restore credits (pool gets USDC back) |
| `manual-review` | MPP couldn't queue / over its ceiling | manual flag (today's behaviour) | unchanged |
| `not-applicable-direct-settlement` | third-party route, paid provider directly | manual flag for ops review (Argens decides) | unchanged |
| absent | legacy / pre-settlement | unchanged | unchanged |

**Files affected:**
- `apps/api/src/services/mpp-client.ts` — parse `Refund-*` headers; no body on GET
- `apps/api/src/services/marketplace-refund.ts` (new) + test — pure Refund-Status classification
- `apps/api/src/services/marketplace.ts` — branch on classification; metadata; agent messages; path-param + GET handling; direct-settlement payTo check
- `apps/api/src/services/mpp-router.ts` — allow GET; type `path_params`, `example_params`, `settlement`, `operator`
- `apps/api/src/services/marketplace-examples.ts` — fall back to catalog `example_params`
- `apps/web/app/x/console-*/page.tsx`, `apps/web/app/dashboard/marketplace` — AUTO-REFUND badge; path params / settlement shown
- `apps/web/public/SKILL.md`, `CLAUDE.md`, `AGENTS.md` — refund semantics, path params, counts

**Steps:**
- [x] mpp-client: `refund: { status, id, status_url, mode } | null` on the result; derive status URL from `Refund-Id` when `Refund-Status-Url` is absent; never send a body on GET
- [x] marketplace-refund.ts: `classifyMarketplaceRefund(receipt, refund)` → `{ outcome, paymentCommitted, manualRefundRequired }`; unit tests for every row of the table
- [x] marketplace.ts failure branch: use the classification; restore credits on auto-refund; write `mpp_router.refund` metadata; ops alert/audit only when manual; agent message + `details.refund` per outcome
- [x] Path params: surface `path_params` + example query in catalog and skill.md; reject a call missing a declared path param with `400 MARKETPLACE_MISSING_PATH_PARAMS` before any payment work
- [x] GET routes: include them; send `payload` keys nowhere — reject non-empty payload on GET with `400 MARKETPLACE_GET_USES_QUERY`; skill example uses `query`
- [x] Direct settlement (`settlement: "direct"`): require the challenge `payTo` ∈ `operator.payouts` and the asset to be the USDC SAC; label in catalog + skill.md ("no automatic refunds")
- [x] Ops console: show `AUTO-REFUND (MPP)` with a link to the status URL instead of nothing
- [x] Docs: SKILL.md, per-provider skill text, CLAUDE.md/AGENTS.md status + counts
- [x] `pnpm verify` + web typecheck

**Out of scope:** polling `/v1/refunds/{id}` to confirm completion (store the URL; ops can check); `/v1/services/select` capability routing; session/channel intents.

**Risks:**
- GET + direct-settlement routes are unverified against a live Argens call (no mainnet tests) → first live call should be a $0.001 Mercury lookup by the developer.
- If MPP changes header names, we fall back to today's manual flag (fail-safe toward refunding).

**Done when:** a failed call with `Refund-Status: pending` produces no ops refund flag and restores credits; `manual-review`/direct/absent behave as before; GET + path-param endpoints appear in the catalog with usable examples; verify + typecheck pass.

---

## Task: Sponsored reserves + fee-bumped user transactions

**Goal:** New user wallets are created with 0 XLM — the ops wallet sponsors the account and USDC trustline reserves (CAP-33) and pays every user-signed transaction fee via fee-bump (CAP-15) — instead of gifting 2.0 XLM per signup.

**Why:** Today `fundNewAccount` sends 2.0 XLM (1.0 account reserve + 0.5 trustline reserve + 0.5 fee buffer) that leaves Argens permanently; a user can export the key and merge the account to walk off with it. Sponsorship keeps the 1.5 XLM of reserves locked in the ops wallet (recoverable), and bootstrap becomes one atomic transaction.

**Files affected:**
- `apps/api/src/services/sponsorship.ts` (new) — fee-bump wrapping, sponsored activation txs, spendable-XLM maths
- `apps/api/src/services/sponsorship.test.ts` (new)
- `apps/api/src/services/stellar.ts` — remove `fundNewAccount` / `createUsdcTrustline` (replaced)
- `apps/api/src/services/wallet.ts` — atomic sponsored bootstrap + on-chain reconciliation on failure
- `apps/api/src/services/payment.ts` — submit through the fee sponsor
- `apps/api/src/services/cctp.ts` — fee-bump the Soroban approve + burn; confirm by polling
- `apps/api/src/routes/wallet.ts` — bootstrap-retry driven by on-chain state; export-key warning
- `apps/api/src/services/alerting.ts`, `apps/api/src/services/admin-balances.ts` — ops wallet judged on *spendable* XLM
- `apps/web/app/dashboard/wallet/page.tsx`, `apps/web/app/x/console-a3f9k2p7/page.tsx`, `apps/web/lib/api.ts`, `apps/web/app/docs/page.tsx`
- `apps/web/public/SKILL.md`, `.env.example`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `tasks/decisions.md`

**Every user-signed submission site (fee-bump coverage):**
| Site | Via |
|---|---|
| `POST /pay` (Stellar), `POST /refund`, `POST /wallet/send`, approval execution, `POST /pay/x402`, marketplace markup, CCTP fee transfer | `submitPayment` → one choke point |
| CCTP approve (Soroban) | `cctp.ts` `submitApproveOnce` |
| CCTP burn (Soroban) | `cctp.ts` `burnUsdcOnStellar` (was `signAndSend`) |
| Account activation + trustline retry | ops is a signer — built sponsored |
| Marketplace x402 (`mpp-client.ts`) | **not affected** — user signs only an auth entry; MPP's facilitator builds and pays (`areFeesSponsored` is mandatory in `@x402/stellar`) |

**Steps:**
- [x] `sponsorship.ts`: `getFeeSponsorKeypair()` (ops key; required on mainnet; optional on testnet), `withFeeSponsor(innerTx)` (fee-bump at ≥ inner inclusion rate, Soroban resource fee preserved), `submitClassic()` (Horizon), `buildSponsoredActivationTx()` (begin → createAccount(0) → changeTrust → end, signed by ops + user), `buildSponsoredTrustlineTx()` (for an existing account with no trustline), `inspectAccount()` (`missing` / `no_trustline` / `ready`), `spendableXlm()` (balance − min balance incl. `num_sponsoring`)
- [x] `wallet.ts` bootstrap: one atomic activation. On failure, inspect the chain before deciding — only delete the Wallet row if the account genuinely does not exist (a timed-out submit can still land)
- [x] Testnet: sponsored path when an ops key is configured (exercises the prod path); friendbot fallback only when it is not
- [x] `payment.ts`: sign inner, submit via `withFeeSponsor`; keep retry-once
- [x] `cctp.ts`: approve and burn both signed → fee-bumped → `sendTransaction` → confirmed by one shared poller; treat `TRY_AGAIN_LATER` as a failed attempt
- [x] `routes/wallet.ts` bootstrap-retry: decide from `inspectAccount`, not the DB status; ops pre-check uses spendable XLM; export-key warns the account holds no XLM of its own
- [x] Alerting + admin balances: ops XLM alert on spendable, not total (sponsored reserves inflate total); expose `xlm_spendable`
- [x] Dashboard wallet card: fees are sponsored, 0 XLM is normal; console shows spendable; docs page + SKILL.md wording
- [x] Docs: CLAUDE.md / AGENTS.md bootstrap flow + wallet roles, README, `.env.example`, decisions entry
- [x] Unit tests: fee-bump fee maths (classic + Soroban), activation tx structure + signatures, spendable-XLM maths
- [x] `pnpm verify` + web typecheck
- [x] **Testnet end-to-end** (no mainnet): sponsored activation → 0-XLM account → fee-bumped classic payment → fee-bumped Soroban call; verify reserves sit on ops (`num_sponsoring`) and user XLM stays 0

**Out of scope (deliberately):**
- Migrating existing wallets. They keep their 2.0 XLM; they simply stop spending it, because their transactions are now fee-bumped too.
- Revoking sponsorship on account closure — no account-closure flow exists yet.
- OpenZeppelin Relayer — fee-bumps don't consume the ops sequence number, so there is no submission contention to solve.

**Risks:**
- A missed submission path fails only for *new* (0-XLM) users → mitigated by the single helper and the coverage table above.
- Ops wallet empties → signups *and* all user payments stop (previously only signups). Alerting must be on spendable XLM.
- Mainnet without `ARGENS_OPS_WALLET_SECRET` must fail loudly, never fall back to unsponsored submission.
- Soroban fee-bump must keep the inner resource fee — verified: `buildFeeBumpTransaction` sets `fee = base × (ops+1) + resourceFee` (stellar-base 15.0.0).

**Done when:** a brand-new testnet wallet holds 0 XLM, its reserves are sponsored by ops, and it completes both a classic payment and a Soroban invocation with ops paying the fee; `pnpm verify` and the web typecheck pass.
