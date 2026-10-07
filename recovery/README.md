# Bounded entry-safe recovery (not deployed)

Executor: Thar Lay/server. Source: fresh GitHub main e15b15e. Output: hotfix branch/PR; not mirrored to Luna. Original worker URLs remain unchanged. This is not full accounting stabilization or authentication/privacy remediation.

## What changes

- Dashboard startup no longer discards cashbook cache or automatically seeds projected Panen 2025 money. Historical migration retained but throws before modifying data.
- Preserve first incident cache copies under wkkn_recovery_preserved_* before normalization/listeners. Copies stay in that browser, never uploaded automatically. Quota failure is warned, not disguised as backup success.
- Dashboard lexical SDK gates deny all singleton changes, update and delete. New laporan writes are transaction create-only with stable identity and no-op retries; failed reads cannot become writes. Frozen state is intentionally unavailable rather than partially revision-protected.
- Permanent entry-only banner and capture UI gate. Staff new reports enter a separate durable browser queue before reset, retry single-flight on online/SDK initialization, and acknowledge only exact report IDs. No wage calculation or payment generated from staff entry.
- General PWA retains pending with missing SDK, ACK or storage failures. Retry transactions never replace later report edits. Cabut form remains usable with missing SDK; stable report/log marker transaction prevents lost-ACK duplicates.
- recovery/firestore.entry-safe.rules is a NOT DEPLOYED server enforcement candidate. Original firestore.rules is unchanged. This candidate freezes legacy writers, financial/publication changes and report deletion/editing, except validated atomic cabut append and baseline new reports. Legacy open reads and impersonable token allowlist remain; do not call it authorization/privacy repair.

## Verification

    node --test tests/*.test.cjs
    cd recovery
    npm install --ignore-scripts --package-lock=false --no-audit --no-fund
    npm run test:rules

Source/synthetic suite: 77 passes (including inline syntax). Real rules emulator: 139 passes; same suite against old source rules fails 40/139. Both are isolated synthetic evidence, not production write acceptance. CI repeats source and real emulator tests at exact PR head. Dependency tooling has deprecation/engine warnings and audit vulnerabilities; dev-only, not shipped SDK changes. Avoid npm audit fix --force.

Browser smoke uses real Chromium, fresh context, loopback HTTP, real installed Chart.js served from disk, and blocks Firebase/production network. Actual staff submit queues pending, cashbook startup remains empty, cabut submit remains pending with blocked SDK, zero page errors. Command:

    CHROME_PATH=/absolute/path/to/chrome node tests/browser-smoke.cjs

On server the existing Chromium executable is /root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome. For another host install the browser with recovery/node_modules/.bin/playwright install chromium. Browser smoke covers selected isolated paths, not every dashboard function. Single-flight is per page, not a cross-tab lock. Legacy cabut addDoc lost-ACK duplicates cannot be inferred or automatically repaired.

## Mandatory release gates

1. Independently rerun exact-head tests and inspect UI gate/cache handling, including field-worker names and deployment SDK compatibility.
2. Obtain latest deployed rules, backup and rollback using authorized console/credentials; compare exact active rules. Do not deploy this whole candidate blindly over unknown deployed rules.
3. Establish server-side old-client containment before calling entry operational. Existing open tabs retain destructive code; frontend release alone cannot protect cloud. Privileged Console/Admin writers bypass rules. Luna package metadata was reachable (mtime 4 Oct); writer quiescence is NOT proved.
4. Confirm real cabut singleton exists and valid; candidate cannot create a missing singleton. Preserve old rows and all post-backup changes.
5. No automatic cashbook restore, financial entry/payment, invoice/signature, deletion or milestone publication. General/staff entry creates are separate from these authorities.
6. Merge only in dependent release task after safety gates, verify Pages exact commit/hashes. No merge/deploy/rules write performed by implementation task.

Private read-only incident backup lives outside repository, mode 0700 directory / 0600 files; contains scoped operational Firestore documents including inline evidence, not a separate Storage-bucket export or point-in-time snapshot. Parent verified every hash/count/permission. No private contents are in tests or this PR. Reconciliation is separate from backup success.
