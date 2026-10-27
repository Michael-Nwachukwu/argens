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
