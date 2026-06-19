# Architectural Decisions

Format: most recent first. Do not re-litigate these without a strong reason.

---

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
