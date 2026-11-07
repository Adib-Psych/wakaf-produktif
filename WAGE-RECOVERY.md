# Wage recovery and current activation boundary

## Authorized release

The public dashboard reads operational reports and wages without login. Entry still requires an approved Google identity and the existing backend grants. This repair does not grant financial writes to the browser and does not make payments.

- Exact public worker bindings connect commissioned entry IDs to their original legacy worker identities. Names are presentation aliases; persisted report identities and business dates are unchanged.
- The reader combines historical `upah/active.data` with eligible direct `wage_entitlements` records, without replacing historical wages.
- October report visibility and wage status are separate: a saved report is not proof that an entitlement exists. Missing, stale and failed reads are not zero debt.
- Manual normal wage-generation invitations are removed. Selected-record recap export remains an export, not a wage generator.
- Paid daily workers must select a supported half/full-day duration. Partial submission status distinguishes acknowledged reports from reports still pending.

## Backend is staged, not activated

The Node 22 `wage-backend/` processor uses the report's business date, not the submitting device clock, and derives one unpaid entitlement per canonical worker/day. Matching original report/receipt pairs, explicit worker/rate policy, historical wage suppression, correction holds and same-day conflicts are checked in transactions. Historical legacy reports require explicit SHA-256 attestations and a finite trusted Admin invocation; receipts are not invented.

**The owner declined billing activation. Cloud Functions are not deployed, and ongoing automatic processing of future entries is not installed.** The Firebase configuration deliberately does not select a Functions codebase. No recurring Thar Lay/server job, browser financial writer or substitute payment automation is installed.

The finite October reconciliation was applied and independently read back: 11 unpaid entitlements totaling IDR 550,000, with Nardi 21 October held for missing duration. All 225 preexisting documents, including the 190 historical wages and cashbook, retained exact data/updateTimes. This is a separately verified operation, not proof that future entries will create wages automatically. A report with unknown duration remains unresolved rather than receiving a guessed amount. Existing wages and payment history must remain unchanged.

## Evidence boundaries

Automated tests exercise synthetic fixtures in isolated Auth/Firestore emulators and Chromium on Thar Lay/server. They do not certify genuine production Google OAuth, the owner's browser adoption or deployed event delivery. Administrative evidence and actual payroll snapshots stay outside this repository; no credentials, account UIDs or private evidence are included.

See [the live dashboard](https://adib-psych.github.io/wakaf-produktif/monitor-v2.html), [work status](https://adib-psych.github.io/wakaf-produktif/status-pekerjaan.html), and `wage-backend/VERIFICATION.md` for the staged processor scope.
