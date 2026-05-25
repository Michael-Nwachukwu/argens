# Current Task

> Last updated: 2026-05-25
> Phase 4 is complete. Phase 5 (Polish & Demo) is in progress.

---

## Completed this session (2026-05-25)

- [x] SKILL.md v2 — rewrote with accurate response shapes, marketplace section, discovery workflow, error codes
- [x] GET /marketplace/services — added ?search=, ?category=, ?enabled= server-side filtering
- [x] GET /marketplace/services/:providerId — new single-provider detail endpoint
- [x] Favicon — app/icon.png + app/apple-icon.png wired in Next.js App Router
- [x] Meta title, description, OG, Twitter card tags in layout.tsx
- [x] Vercel build fix — removed vestigial (dashboard) route group that caused manifest error on Vercel
- [x] SKILL.md serving fix — confirmed accessible at argens.xyz/SKILL.md
- [x] Vercel root directory — set to apps/web for GitHub-triggered deployments
- [x] CLAUDE.md + PROJECT_STATE.md + todo.md updated

---

## Phase 5 — Remaining

### High priority

- [ ] **Railway API deploy** — biggest external-user blocker; dashboard is non-functional without it
- [ ] **Example payloads** — `example_payload` is always `null`; marketplace call form has no prefills; need a generation pipeline (curated + OpenAPI extraction + LLM-generated fallback)
- [ ] **Documentation page** (`/docs`) — at minimum: quickstart, API reference, policies explainer, marketplace guide, agent onboarding walkthrough

### Medium priority

- [ ] **Error handling audit** — walk every endpoint, confirm all error cases return correct codes and shapes; prerequisite for SCF demo quality
- [ ] **Demo script** — define the exact scenario: signup → fund → set policy → agent pays → block → approve → marketplace call
- [ ] **Loom demo recording** — required for SCF submission

### Lower priority (after above)

- [ ] Per-service skill files (`/SKILL/<provider>.md`) — sourced from `docs.llms_txt` field in MPP catalog
- [ ] `llms.txt` at argens.xyz/llms.txt — links SKILL.md + docs pages; depends on docs existing first
- [ ] XLM balance alerting on ops wallet
- [ ] Wallet-funded SSE watcher E2E test
- [ ] Low balance email E2E verification

---

## Deferred (not V1)

- CCTP V2 / Base settlement
- SDK (@argens/sdk npm)
- Soroban contract enforcement
- Multi-chain routing
