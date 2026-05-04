# Lessons Log

Format: most recent first.

---

## Lesson 2026-05-03 — SKILL.md timing
**What went wrong:** N/A — caught before build.
**Root cause:** SKILL.md examples would have been written against assumed API shapes, not real ones.
**Rule going forward:** Write SKILL.md only after all Phase 2 endpoints are tested against testnet. The file's request/response examples must come from actual API responses, not CLAUDE.md specs.

---

## Lesson 2026-05-03 — "Non-custodial" language
**What went wrong:** PRD used "non-custodial" which is technically incorrect for V1 (Argens holds encrypted signing keys).
**Root cause:** Marketing language drifted ahead of the actual architecture.
**Rule going forward:** Never write "non-custodial" in code, comments, or docs. Use "agent-custodial". If asked, explain the V1 trade-off honestly and note the V2 path to contract-held funds.

---

## Lesson 2026-05-03 — Amount types
**What went wrong:** PRD showed amounts as JSON numbers (25.00). CLAUDE.md and Stellar SDK both require strings ("25.0000000").
**Root cause:** Two documents maintained separately, no single enforced format.
**Rule going forward:** All USDC amounts in request bodies, response bodies, and Stellar SDK calls are strings with 7 decimals. No exceptions. Zod schemas enforce `z.string().regex(/^\d+\.\d{7}$/)` on all amount fields.

---

## Lesson 2026-05-03 — Soroban timing vs grant tranches
**What went wrong:** PRD said Soroban contract deployed in Tranche 0 (before core API). CLAUDE.md had it in Phase 4 (after dashboard). These were incompatible.
**Root cause:** PRD written aspirationally; build order written pragmatically.
**Rule going forward:** PRD tranche deliverables must match CLAUDE.md build phases. If they diverge, update the PRD to match the build order — not the other way around.
