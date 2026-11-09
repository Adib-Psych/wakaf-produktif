# Wakaf — current working information

Updated: 7 November 2026. Active short handover; historical registers are evidence, not a queue to replay.

## Agent roles — 9 November 2026 (ADR-049)

Claude changes code, rules, formulas, SOP content and data packages (code via PR); Hermes posts approved packages, runs routines, merges passing Claude PRs and files `keluhan` issues. See `CLAUDE.md` › Delivery.

## Owner decisions

- PUBLIC TRANSPARENCY: everyone may read complete dashboard operational data, staff reports and financial detail without login. Credentials/signing capabilities are not dashboard data.
  - **Open conflict (QC 9 Nov, S8):** Luna `Wakaf Produktif/CLAUDE.md` §2 no. 21 says public pages carry no worker names, while worker advance (kasbon) purposes are currently public. Awaiting the owner's decision; do not change either until decided.
- Entry requires verified Google authentication AND an explicitly approved enabled account grant. Google login alone does not authorize writes. Restore valid sessions; ask for login when attempting entry, not reading.
- Publish coherent tested changes promptly through GitHub/Pages. Preserve integrity checks, pending ownership, receipt ACK and correction history. No fabricated production submissions.

## Wage/October repair — latest scope

- Worker activity cards join exact commissioned opaque IDs to legacy tokens for display/aggregation. October business dates count toward the same worker; persisted report identities and timestamps are not rewritten.
- Public reading adds direct entitlement, processing and exact-worker binding collections alongside the unchanged historical wage ledger. Ineligible or unresolved entitlements are not payable; source failures remain explicit.
- Normal manual wage-creation invitations are removed; selected-record recap is still an export. Paid daily roster entries require a supported duration. Partial queue success distinguishes acknowledged reports from those still pending.
- **Owner declined billing activation. Ongoing Cloud Functions automatic processing is not installed.** `wage-backend/` is staged and tested only; root Firebase config deliberately contains no Functions deployment target. No recurring personal-server processor or browser financial writer is substituted.
- Finite October recovery applied and independently read back: 11 unpaid entitlements totaling IDR 550,000; Nardi 21 October remains unresolved because duration is missing. All 225 preexisting documents, including 190 historical wages and cashbook, retained exact data/updateTimes. No payment was made. See [activation boundary](WAGE-RECOVERY.md). Frontend publication still requires its own served-source/browser readbacks; candidate tests alone are not live verification.

## Earlier application changes (historical release evidence)

- Default monitor reads existing Firestore dashboard collections directly, without authentication or the bounded `operational_snapshot` derivative. Refresh every 60 seconds and on reconnect; source reads are bounded.
- Per-domain failures distinguish unavailable/partial/stale data from confirmed empty. Last-known valid data is retained; exports refuse incomplete/stale required sources.
- Google entry uses separate persistent authentication; logout and denied grants do not clear public data. Anonymous queues remain owned by their original identity and are not adopted or replayed.
- `firebase.json` deploys `recovery/firestore.production.rules`. Its byte-identical root companion `firestore.rules` is retained for existing tests. Public get/list applies only to dashboard collections, not grants, worker tokens or capabilities. Writes retain schema/receipt validation plus Google and explicit-grant enforcement.

## Frontend readability update

- Public header contains a concise freshness/availability notice, not collection names, raw error codes or repeated diagnostics. Unavailable/stale data is still disclosed; backend metadata and export freshness guards are preserved.
- Google entry has a labelled account card and logo, separate sign-out action and explicit public-reading note. Form controls align in a responsive two-column grid; garden labels, rainfall controls and input tables are spaced consistently.
- Owner-approved Musim Panen direction: plum/coffee/clay styling, compact mosaic, existing harvest summary emphasized, harvest entry and log proportions aligned. Concept sample values/filters/charts are not installed. Only presentation markup and a new stylesheet change; every existing script and control contract stays identical. See [preservation and release scope](HARVEST-PRESENTATION.md).
- Candidate: 347 offline regressions pass; same-fixture comparison preserves data, all 21 navigation destinations, 22 generated category templates, charts and report/selected-wage CSV. Two exact presentation deltas are documented rather than disguised as a raw strict-comparison pass. Populated 63-state scan and ten-width public-read/focus/hidden-state checks pass. Real Google login/staff ACK and original Safari acceptance remain separate outstanding checks.

## Account/session repair

- Observer-backed account identity is always available in the public header, with expandable email, entry readiness, switch-account and signout. The form mirrors identity separately from report/ACK status.
- Google identity and entry permission are separate: denied/unavailable entry does not imply signed out. Popup refusal preserves an existing session; fixed allowlisted diagnostics replace generic errors. Failed signout holds entry explicitly. Stale observer/refresh completions cannot restore superseded readiness or overwrite a newer draft.
- Existing queue, envelope, paired receipt/ACK, draft ownership and backend authorization checks are preserved; no grants, policies, Rules or business data change. See [scope and limits](SESSION-STATUS.md).
- Genuine Google completion in the owner's browser and actual staff submission ACK remain unverified; synthetic callback tests do not claim those outcomes.

## Verification and outstanding activation

- Candidate: 335 offline regressions passed; configured-source public/Google Rules emulator 32 passed; existing containment emulator passed; isolated browser failure/offline upgrade checks passed. These are not a genuine staff submission.
- Production activation verified: one explicitly owner-approved genuine Google staff identity has an enabled `staff_entry` grant; `entry_policy/active` is unpaused with matching epoch. The grant and policy were created atomically with absent guards after independent review. No owner-management, payment or historical-mutation privileges were added; no business records were written.
- PR14 is live; configured production Rules match deployed bytes and 18 served frontend dependencies match the merge. A fresh signed-out production browser reads 213 reports, 190 wage rows and 153 cash rows without source/runtime errors, including after staff activation.
- Owner's original browser acceptance and genuine staff report → server ACK → reload → shared reader remain outstanding. Do not manufacture business reports for testing.

## Inspection

- Application: https://adib-psych.github.io/wakaf-produktif/monitor-v2.html
- Work status: https://adib-psych.github.io/wakaf-produktif/status-pekerjaan.html
- Source: https://github.com/Adib-Psych/wakaf-produktif

Executor/source: Thar Lay/server worktree. Output: GitHub source and Pages after verified publication, Firestore Rules after separate verified deployment. Luna/Mac and Drive have not been synchronized or modified by this release. No secrets or business-record copies are included in this handover.
