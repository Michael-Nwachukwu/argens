# Lessons Log

Format: most recent first.

---

## Lesson 2026-06-21 — Misdiagnosed marketplace failures as "unfixable downstream"; real cause was a stale client SDK

**What went wrong (in two stages — I jumped to a conclusion *twice*):**

1. First diagnosed the marketplace failures (`verification-failed: memo is not bound`, `Invalid base64 JSON header`) as MPP Router's "unfixable downstream Tempo settlement" — wrote that into `decisions.md`. Wrong.
2. Then, after MPP Router said they pushed a breaking protocol change, I concluded a **drop-in SDK version bump** (`@stellar/mpp` 0.5.1→0.7.0, `mppx`→0.7.0) was "the fix" and recorded *that* before live-testing it. **Also wrong** — and it's exactly the mistake this very lesson warns about.

**What live testing actually showed** (local harness against mainnet, using the funded `bldn.inc` wallet `GDCO2A…K4H` decrypted from the local DB + `performMppRequest`): the legacy `@stellar/mpp` `stellar.charge` (Payment-auth/mppx scheme) credential is now **rejected server-side** — full flow `challenge→signing→signed` completes, then MPP Router returns `502 Invalid base64 JSON header` on our credential. MPP Router has migrated to **x402 v2**: their 402 now carries an `payment-required: <base64 x402 JSON>` header and expects the credential in a `payment-signature` header. `mppx` (both 0.6.31 and 0.7.0) even *throws while parsing their x402 challenge header* (`HeaderCodec.decode` → `InvalidJsonHeaderError`). So the real fix is an **x402 v2 client migration** (Coinbase `@x402/core` + `@x402/stellar`, v2.16.0 — the packages the MPP integration guide recommends), not a version bump.
**Root cause:** Concluding before verifying — twice. The vendor deprecated a payment scheme server-side; only a live call against their server reveals that, not reading SDK types or version peers.
**Rule going forward:** For a payment/credential protocol break, **make a real call against the vendor and read the actual 402 challenge + the actual rejection before claiming any fix** — version peers and type signatures don't tell you which scheme the server still honors. The local harness (decrypt a funded wallet from the DB, call `performMppRequest` directly against mainnet MPP Router) is the verification tool — use it *before* writing "the fix is X," not after. And confirm whether USDC actually moved (`stellar_tx_hash`+`receipt` non-null) before calling a failure "paid"; the optimistic `cost_paid` field misleads.

---

## Lesson 2026-06-19 — `credentials: 'include'` breaks fetches to wildcard-CORS endpoints

**What went wrong:** The dashboard's new marketplace `skill.md` button always showed "No skill file available," even though `GET /v1/marketplace/services/:id/skill.md` returned 200 with content when curled.
**Root cause:** The web fetch passed `credentials: 'include'`, but that endpoint is intentionally public and returns `Access-Control-Allow-Origin: *`. Browsers forbid the combination of a wildcard ACAO with credentialed requests, so the response was blocked client-side (the curl had no such constraint, which masked it).
**Rule going forward:** Public, wildcard-CORS endpoints (SKILL.md, provider skill markdown, llms.txt) must be fetched **without** `credentials`. Only send credentials to same-origin or explicitly-whitelisted-origin endpoints. When a fetch "fails" but curl succeeds, suspect a CORS/credentials mismatch before anything else.

---

## Lesson 2026-06-19 — Docs drift: AGENTS.md lagged reality by weeks

**What went wrong:** AGENTS.md still said "API: local only, Railway is the #1 blocker" and described CCTP as having no Argens fee, long after the API shipped on Dokploy and CCTP gained a 0.5%/$0.01/$2.00 fee. CLAUDE.md even contradicted itself (Status said CCTP live; Key Decisions said deferred).
**Root cause:** Multiple near-duplicate source-of-truth files (CLAUDE.md for Claude Code, AGENTS.md for Codex, PROJECT_STATE.md) updated independently; feature work updated code + SKILL.md but not all the agent guides.
**Rule going forward:** When a shipped change alters deployment, fees, or the schema, update the Status section of **every** agent guide (CLAUDE.md, AGENTS.md) and PROJECT_STATE.md in the same pass — not just the one you happen to be reading. Treat a self-contradiction within one file as a hard bug.

---

## Lesson 2026-05-26 — Email delivery must surface provider setup errors

**What went wrong:** Approval/blocked/low-balance emails appeared not to send, while the API continued the main flow and only logged the failure.
**Root cause:** Resend rejected messages because the configured `updates.argens.xyz` sender domain is not verified, and the async email `.catch()` path did not make that visible in the dashboard/API response.
**Rule going forward:** When testing notification-dependent flows, check provider logs and server logs immediately. Before demo or production, verify the sender domain and add an admin-visible health/check warning for email provider failures.

---

## Lesson 2026-05-25 — Test new endpoints before reporting them done

**What went wrong:** Added marketplace search/filter endpoints and reported them as done without curling them. The server was running stale compiled code and the endpoint returned 500. The user had to ask if they were tested before the issue was caught.
**Root cause:** Assumed tsx watch had hot-reloaded the changes. It had not — a server restart was required.
**Rule going forward:** After any route change, always restart the dev server and curl the affected endpoint before marking the task complete. Do not rely on hot-reload to pick up route-level changes.

---

## Lesson 2026-05-25 — Ask for credentials before digging through the DB

**What went wrong:** Needed an API key to test endpoints. Instead of asking the user, started querying the database to find key prefixes.
**Root cause:** Defaulted to self-sufficiency when the right move was a simple question.
**Rule going forward:** If a test requires a credential (API key, password, token) that the user would reasonably have, ask them directly first. Only resort to DB inspection if they confirm they don't have it.

---

## Lesson 2026-05-25 — Vestigial route groups cause Vercel manifest errors

**What went wrong:** `app/(dashboard)/page.tsx` was a pass-through re-export of `app/page.tsx` left over from an earlier restructure. Vercel's build tracer expected a `page_client-reference-manifest.js` for it that the Next.js build never generated, causing a hard ENOENT crash on every deployment.
**Root cause:** The `(dashboard)` route group was hollowed out when the real dashboard moved to `app/dashboard/`, but the files were never deleted.
**Rule going forward:** When restructuring Next.js route groups, delete the old group's files entirely rather than leaving pass-through stubs. A stub `page.tsx` in a route group creates a real route that the build system tracks.

---

## Lesson 2026-05-25 — SKILL.md must be committed for Vercel CLI to include it

**What went wrong:** `argens.xyz/SKILL.md` returned a Next.js 404 page after deployment. The file existed locally but the deployment was stale — the previous `vercel deploy` had failed (due to the manifest error above) and never updated the live site.
**Root cause:** Two separate issues: (1) the deployment failure meant the live site was never updated; (2) the user wasn't aware `vercel deploy` (without `--prod`) creates a preview URL, not a production update.
**Rule going forward:** After fixing a deployment blocker, confirm with the user that `vercel deploy --prod` ran successfully and check the live URL directly before closing the task.

---

## Lesson 2026-05-09 — Separate native MPP merchants from router bridges
**What went wrong:** The first marketplace direction treated directly probed public MPP services as the whole opportunity, which made the idea look blocked when those services exposed Tempo/Base rails instead of Stellar testnet.
**Root cause:** We had not classified marketplace access into native Stellar merchants, router-bridged services, and unsupported direct services before judging feasibility.
**Rule going forward:** Before dismissing a payment marketplace path, check discovery/router endpoints and label each service as native, bridged, or unsupported for the active network.

---

## Lesson 2026-05-08 — Verify MPP rails before listing services
**What went wrong:** The marketplace listed public MPP services that expose Tempo/Base payment challenges, while Argens's V1 marketplace client only supports Stellar testnet `stellar.charge`.
**Root cause:** Service URLs were seeded from the public MPP ecosystem without probing their actual `WWW-Authenticate` methods and networks.
**Rule going forward:** Do not mark a marketplace service callable until a probe confirms it offers the exact rail Argens supports in the active environment.

---

## Lesson 2026-05-08 — Marketplace revenue disclosure
**What went wrong:** The marketplace dashboard exposed Argens's markup percentage directly in the service catalog UI.
**Root cause:** Internal revenue mechanics leaked into user-facing product copy during the first implementation pass.
**Rule going forward:** Keep marketplace pricing user-facing as final cost/price language only. Do not display internal markup percentages in UI or public API catalog responses.

---

## Lesson 2026-05-08 — MPP amount units
**What went wrong:** MPP charge challenge amounts were initially treated as display USDC amounts.
**Root cause:** The SDK examples use base units for Soroban SEP-41 transfers, while Argens API/database amounts use 7-decimal USDC strings.
**Rule going forward:** Convert MPP charge challenge amounts from base units to 7-decimal USDC before policy checks, database writes, and Stellar classic payment calls.

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

## Lesson 2026-08-12 — Duplicated reference material silently rots into landmines
**What went wrong:** `CLAUDE.md` / `AGENTS.md` carried their own copies of the env list, the Prisma schema, the project tree, and the endpoint list. Every copy had drifted, and several had drifted into actively dangerous claims: `SOROBAN_RPC_URL` was labelled "unused in V1 — Soroban dropped" and pointed at testnet (the x402 marketplace client needs it on mainnet for every paid call); the wallet table said "there is no fee wallet" while `ARGENS_FEE_WALLET` is required or `/marketplace/call` 500s; the policy architecture said the Soroban contract was the source of truth and that policy writes must go on-chain first; the project tree listed `routes/apikeys.ts`, `routes/analytics.ts`, `middleware/apikey.ts`, `services/soroban.ts` and a `contracts/` directory, none of which exist, while omitting 13 real services. All 64 Build Order items were unticked despite Phases 1–4 being live on mainnet.
**Root cause:** The docs were written as a build spec before the code existed and were never re-derived from it. Duplication made drift invisible — nothing failed when a copy went stale, and each copy drifted in a different direction, so they didn't even agree with each other.
**Rule going forward:** One source per fact. `.env.example` owns configuration; `apps/api/prisma/schema.prisma` owns the schema; the code owns the file tree and endpoint list. `CLAUDE.md` points at them and documents only the non-obvious semantics (what breaks when a var is missing, which invariants aren't visible in the schema). When you add an env var or a route, update the canonical source in the same commit. Before trusting any list in a doc, spot-check three entries against the filesystem — if one is wrong, re-derive the whole list rather than patching the entry.
