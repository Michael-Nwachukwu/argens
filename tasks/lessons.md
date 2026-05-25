# Lessons Log

Format: most recent first.

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
