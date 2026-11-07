# Wakaf — current working information

Updated: 7 November 2026. Active short handover; historical registers are evidence, not a queue to replay.

## Owner decisions

- PUBLIC TRANSPARENCY: everyone may read complete dashboard operational data, staff reports and financial detail without login. Credentials/signing capabilities are not dashboard data.
- Entry requires verified Google authentication AND an explicitly approved enabled account grant. Google login alone does not authorize writes. Restore valid sessions; ask for login when attempting entry, not reading.
- Publish coherent tested changes promptly through GitHub/Pages. Preserve integrity checks, pending ownership, receipt ACK and correction history. No fabricated production submissions.

## Current application change

- Default monitor reads existing Firestore dashboard collections directly, without authentication or the bounded `operational_snapshot` derivative. Refresh every 60 seconds and on reconnect; source reads are bounded.
- Per-domain failures distinguish unavailable/partial/stale data from confirmed empty. Last-known valid data is retained; exports refuse incomplete/stale required sources.
- Google entry uses separate persistent authentication; logout and denied grants do not clear public data. Anonymous queues remain owned by their original identity and are not adopted or replayed.
- `firebase.json` deploys `recovery/firestore.production.rules`. Its byte-identical root companion `firestore.rules` is retained for existing tests. Public get/list applies only to dashboard collections, not grants, worker tokens or capabilities. Writes retain schema/receipt validation plus Google and explicit-grant enforcement.

## Frontend readability update

- Public header contains a concise freshness/availability notice, not collection names, raw error codes or repeated diagnostics. Unavailable/stale data is still disclosed; backend metadata and export freshness guards are preserved.
- Google entry has a labelled account card and logo, separate sign-out action and explicit public-reading note. Form controls align in a responsive two-column grid; garden labels, rainfall controls and input tables are spaced consistently.
- Candidate: 342 offline tests pass; read-only Chromium at 1440px/390px confirms public data remains present, no runtime errors or page overflow, Google card renders and hidden sign-out remains hidden. Real Google login/staff ACK and original Safari acceptance are separate outstanding checks.

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
