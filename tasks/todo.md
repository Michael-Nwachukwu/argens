## Task: Platform-wallet alerting coverage (fee + Base relayer)
**Goal:** Check all four Argens-operated wallets on the existing 6h interval and 24h per-wallet rate limit, so a dry Base relayer or empty fee wallet pages ops instead of failing silently.
**Files affected:** `apps/api/src/services/alerting.ts`, `apps/api/src/services/admin-balances.ts`, `apps/api/src/services/email.ts`, `.env.example`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `tasks/PROJECT_STATE.md`
**Steps:**
- [x] Export `readBaseRelayer()` from `admin-balances.ts` so alerting reuses the existing ETH read
- [x] Add fee wallet (USDC, `USDC_ALERT_THRESHOLD_FEE` default `"0"`, inclusive) and Base relayer (ETH, `ETH_ALERT_THRESHOLD_RELAYER` default `"0.001"`) to `checkBalances()`
- [x] Widen `sendOpsAlertEmail` asset type to include `'ETH'`
- [x] Add the two env vars to `.env.example`; report all four thresholds in the startup log
- [x] Update CLAUDE.md / AGENTS.md / README.md / PROJECT_STATE.md so they no longer claim fee/relayer are unmonitored
- [x] Typecheck `@argens/api`
**Risks:** Default fee floor of `0` never fires with exclusive `lessThan` — must use inclusive comparison for that wallet. Duplicate ETH readers would drift; reuse `readBaseRelayer` only.
**Done when:** All four wallets are checked independently (a failed read of one does not skip the others); unconfigured wallets are skipped; startup log lists four thresholds; env list and docs match.
