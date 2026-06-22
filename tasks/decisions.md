# Architectural Decisions

Format: most recent first. Do not re-litigate these without a strong reason.

---

## 2026-06-21 — Migrated marketplace payments to x402 v2 (@x402/core + @x402/stellar) — WORKING, verified end-to-end
**Done:** Rewrote `services/mpp-client.ts` to speak x402 v2 — `createEd25519Signer` + `ExactStellarScheme` (`@x402/stellar`) registered on an `x402Client` / `x402HTTPClient` (`@x402/core/client`). Flow: request → parse `payment-required` 402 → `onChallenge` policy gate → `createPaymentPayload` (signs Soroban SEP-41 transfer) → retry with `PAYMENT-SIGNATURE` header → read settlement. Public interface unchanged (snapshot still method=`stellar`/intent=`charge`/atomic `amount`/SAC `currency`/payTo `recipient`), so `marketplace.ts` needs **no** changes. Added type shim `src/types/x402.d.ts` (node10 can't read x402's `exports`), removed dead `stellar-mpp.d.ts`. Committed live harness `scripts/mpp-x402-smoketest.ts`. Build passes. RPC via existing `SOROBAN_RPC_URL` (`mainnet.sorobanrpc.com`).
**Settlement receipt:** MPP Router signals settlement with its own `x-payment-tx` (on-chain hash) + `x-payment-settle-status: settled` headers, NOT the x402-standard PAYMENT-RESPONSE header. `mpp-client.ts` reads the standard header first, then falls back to `x-payment-*`. Receipt is non-null only on real settlement (also fixes the old false-positive refund flag).
**VERIFIED end-to-end on mainnet** (funded wallet `GDCO2A…K4H` decrypted from DB, via the smoke test): `deepgram_list-models` ($0.004) and `deepseek_chat` both returned `200` with the real upstream body, `progress: challenge→signing→signed→paid`, and a receipt with the on-chain settlement hash. The earlier `502 "Invalid base64 JSON header"` was **service-specific to stableemail** (a broken merchant on MPP's side), NOT our integration — most of the catalog works again under x402 v2.
**Next:** redeploy to Dokploy; globally pause stableemail (and re-test the other previously-"verification-failed" providers — they should mostly work now). `@stellar/mpp`@0.7.0 + `mppx`@0.6.29 are now unused by `mpp-client.ts` (kept to avoid churn; remove later). Earlier mass failures were pre-payment rejections (`receipt:null`, no `stellar_tx_hash`) — no USDC moved, so the old "flag for refund" amounts are moot.

## 2026-06-21 — MPP Router migrated to x402 v2; legacy `stellar.charge` is dead server-side → x402 client migration required (NOT a version bump)
**Finding (live-verified):** MPP Router (Rozo) deprecated the legacy Payment-auth/mppx `stellar.charge` scheme on the server. A real mainnet call (local harness: decrypt the funded `bldn.inc` wallet `GDCO2A…K4H` from the DB, run `performMppRequest` against `apiserver.mpprouter.dev`) completes `challenge→signing→signed` and is then **rejected `502 Invalid base64 JSON header`** on our credential. Their 402 now sends an `payment-required: <base64 x402 v2 JSON>` header (`x402Version:2`, `accepts:[{scheme:"exact",network:"stellar:pubnet",amount,asset,payTo,…}]`) and expects the credential in a `payment-signature` header. `mppx` 0.6.31 **and** 0.7.0 both *throw while parsing* that x402 header (`HeaderCodec.decode → InvalidJsonHeaderError`).
**Decision:** Marketplace payments must migrate to the **x402 v2 "exact" Stellar flow** using Coinbase `@x402/core` + `@x402/stellar` (v2.16.0 — the packages MPP's integration guide recommends). A `@stellar/mpp`/`mppx` version bump is **necessary-but-not-sufficient and on its own does nothing** — the legacy scheme it speaks is no longer honored.
**Current repo state:** `apps/api/package.json` is at `@stellar/mpp@^0.7.0` + `mppx@^0.6.29` (matched peer pair; builds clean) but this does **not** fix marketplace calls by itself. The real work is the x402 client migration in `services/mpp-client.ts` (read `payment-required`, build+sign a Stellar x402 exact credential, send via `payment-signature`, parse the receipt) — payment-critical, so implement against the local funded-wallet harness and verify a real successful charge before shipping.
**Supersedes the earlier same-day claim** that "upgrade to 0.7.0 is the fix" (premature — disproven by the live call). The 2026-06-19 "don't rebuild MPP Router / settlement is on Tempo" decision still stands; only the failure root-cause and the proposed fix changed.

## 2026-06-19 — Don't rebuild MPP Router — settlement is on Tempo; keep MPP + kill-switch
**Decision:** Keep MPP Router as the marketplace upstream. Do NOT build "our own router" to pay merchants directly.
**Reason:** Research this session (the public discovery catalog `mpp.dev/api/services`) showed the merchants settle on **Tempo** (asset `0x20c000000000000000000000b9537d11c60e8b50`, 6 decimals) — 40+ services — plus a couple on Stripe USD (fiat). Almost none advertise direct x402-on-Base. MPP Router's core value-add is therefore the **Stellar USDC → Tempo settlement bridge**, which is exactly the step throwing `verification-failed` ("memo not bound to this challenge"). Argens's existing Base/CCTP infra (`services/cctp.ts` + `cctp-relay.ts`, viem, `ARGENS_BASE_RELAYER_SECRET`) mints on **Base**, not Tempo — so it gives no head start here. Rebuilding would mean standing up a Stellar→Tempo settlement rail + becoming merchant-of-record (Tempo float, value movement, charge handshake) plus a fiat treasury for the Stripe merchants — MPP Router's hardest component, not justified while the marketplace isn't the main revenue line.
**Mitigation instead:** Pressure MPP Router on the specific bugs (escalation drafted), and use the already-shipped global kill-switch (`GlobalServiceSetting`) to take broken providers offline platform-wide.
**No Stellar-native merchant subset exists (verified).** Inspecting the live `apiserver.mpprouter.dev/v1/services/catalog` (496 endpoints): every endpoint has `payment_method: stellar` / `network: stellar-mainnet`, and **all 493 Stellar-payable endpoints share one `pay_to` address — `GDK3AVW3YE6UL3J4WLNKBMP65KSY32YPUKIOC6PXW65XJ3LEG3YIDXXB`, the Router's own pool wallet** (the same address seen in our failed-tx receipts). Both the `stellar` charge and `stellar_x402` methods are just ways to pay the **Router**; the merchant settlement is `tempo` with `"role": "upstream"` on all 87 providers. So there is **no** merchant whose own account accepts Stellar USDC directly — going direct *necessarily* means Tempo settlement. This kills the "direct on a Stellar-native subset" hedge.
**Held in reserve (only real future option):** Argens's value layer is portable — the upstream call is a single inline site, `performMppRequest(...)` at `apps/api/src/services/marketplace.ts:444` inside `executeMarketplaceCallInternal`, with policy/markup/credits/tx-logging/refund all payment-agnostic around it, and MPP-specific code isolated to `mpp-client.ts` (the `@stellar/mpp` charge handshake) and `mpp-router.ts` (catalog). A later move would extract an `UpstreamAdapter` interface at that call site (MPP becomes one implementation), but the only direct alternative backend is a **Stellar→Tempo settlement rail** — substantial. Note: `routes/x402.ts` implements only the Stellar x402 flow today; its Base branch is stubbed `501 CCTP_NOT_YET_IMPLEMENTED`.

## 2026-06-19 — Password reset uses a raw single-use token (mirrors email verification)
**Decision:** `POST /auth/forgot-password` writes a `crypto`-random `passwordResetToken` + 1h `passwordResetExpiry` on the User row; `POST /auth/reset-password` validates token+expiry, sets the new bcrypt(12) hash, and clears both. Token is stored raw (not hashed), single-use, and `forgot-password` always returns the same response to avoid email enumeration.
**Reason:** Consistency with the existing `emailVerificationToken` pattern; the token is short-lived, single-use, and unique-indexed. Hashing the reset token is a V2 hardening, not a V1 blocker.

## 2026-06-19 — "Dismiss" pending approval = reject-by-id, JWT only
**Decision:** Added `POST /transactions/:id/dismiss` (JWT) that moves a user-owned PENDING_APPROVAL tx to REJECTED and flips its ApprovalQueue row, **regardless of token expiry**. Kept separate from `POST /reject/:token` (which requires a live magic-link token).
**Reason:** The dashboard user is already authenticated by JWT and owns the tx, so a token isn't needed. Expired pending approvals can never be actioned via the token path, so the dashboard needs an id-based path to clear them.

## 2026-06-17 — Marketplace global kill-switch: absence = enabled
**Decision:** `GlobalServiceSetting` rows are written only to *pause* a provider. No row = enabled, so we never seed 86 rows. Globally paused providers are hidden from the catalog AND rejected at call time (`503 MARKETPLACE_SERVICE_PAUSED`). Global pause wins over per-user enablement. Cached ~30s.
**Reason:** A buggy upstream provider must be takeable-offline platform-wide without touching every user's settings; default-on keeps the table tiny.

## 2026-06-17 — Paid-but-upstream-failed: flag for manual refund, never auto
**Decision:** When MPP pulls USDC (receipt present) but the upstream relay fails and it wasn't credit-funded, write `metadata.refund.required=true` + `AuditLog MARKETPLACE_REFUND_REQUIRED` + ops-alert email, and surface a "REFUND NEEDED" badge in the Ops Console. No auto-refund, no auto-disable.
**Reason:** Refund correctness needs a human (verify with MPP Router whether the charge was actually captured); auto-disable on a single failure is too blunt — the operator decides via the kill-switch.

## 2026-06-16 — CCTP fee is a hybrid clamp, and cross-chain is LIVE
**Decision:** CCTP cross-chain payments charge `clamp(amount × 0.5%, $0.01, $2.00)` (`computeCctpFee`), debited as `amount + fee`; Argens absorbs Circle's protocol fee within it. Direct Stellar payments stay $0. Stellar → Base via CCTP V2 is a shipped, callable feature (supersedes any earlier "cross-chain deferred" note).
**Reason:** A pure 0.5% gives near-zero revenue on tiny payments and unbounded fees on large ones; the floor/ceiling make the fee sane at both ends. Base settlement unlocks x402 paywalls and is verified on mainnet.

## 2026-05-03 — SKILL.md deferred to Phase 5
**Decision:** Write SKILL.md content after all Phase 2 APIs are tested on testnet.
**Reason:** Examples in the file must reflect real API behaviour. Writing it first risks inaccurate request/response shapes that mislead agents.

## 2026-05-03 — Base USDC settlement moved to V1
**Decision:** CCTP V2 Base settlement is a V1 feature. Full multi-chain (Ethereum, Solana, etc.) and CCTP hooks remain V2.
**Reason:** Base covers x402 paywalls, which is a major differentiator. CCTP V2 is already live on Stellar testnet + Base Sepolia — demo works free. One extra chain is manageable scope.

## 2026-05-03 — CCTP fee absorbed in 0.5%
**Decision:** Argens absorbs Circle's CCTP protocol fee within its 0.5% platform fee. Agent sees one number.
**Reason:** Simplicity. No surprise fee line items. Can revisit if CCTP fees become material at scale.

## 2026-05-03 — Chain detection is automatic
**Decision:** Chain is auto-detected from recipient address format (G... = Stellar, 0x... = Base). No explicit `chain:` param in V1.
**Reason:** Zero friction for agents. They pass the address they received from the paywall — Argens figures out where it lives.

## 2026-05-03 — Argens funds wallet bootstrap (Option A)
**Decision:** Argens pays 1.5 XLM per new wallet from the ops wallet. User-funded bootstrap deferred.
**Reason:** ~$0.20 CAC is noise. The friction of requiring users to acquire and send XLM kills signup conversion. "Instant wallet ready to receive USDC" is the product promise.

## 2026-05-03 — Agent-custodial model for V1
**Decision:** Argens generates keypairs, encrypts secrets, signs transactions server-side. Users can export the key once.
**Reason:** True non-custodial (user signs every tx) defeats the product's value prop — agents can't transact autonomously without a human. V2 goal: Soroban-held funds for true trustless custody.

## 2026-05-03 — TypeScript policy stand-in for Phase 2
**Decision:** Phase 2 enforces policies in TypeScript (reads Postgres). Soroban contract replaces this in Phase 4.
**Reason:** Soroban/Rust contract takes weeks to write and deploy. TS stand-in ships the identical enforcement logic in hours. Phase 2 → Phase 4 is a single function swap.

## 2026-05-03 — Approval demo shortcut
**Decision:** For the demo video, approval flow uses a hard-coded dashboard button rather than the full email-link flow.
**Reason:** Demonstrates the concept (agent held, human decides, payment executes) without wiring up the full email → link → landing page → POST chain just for the recording.
