# Architectural Decisions

Format: most recent first. Do not re-litigate these without a strong reason.

---

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
