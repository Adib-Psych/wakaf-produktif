# Staged verification

- Final combined run: `firebase emulators:exec --only firestore --project demo-wakaf-wages --config firebase.test.json 'npx --yes --package=node@22 node --test test/*.test.cjs'` — **19 tests, 19 pass, 0 fail, 0 skip**, exit 0, after Jakarta default-region change.
- Equivalent complete suite also passed on local Node 26; deploy target and final verification use Node 22.
- `npm audit --omit=dev --audit-level=moderate` — **0 vulnerabilities**, exit 0. Dependencies pinned to firebase-admin 14.5.0 and firebase-functions 7.4.0; lockfile includes audited transitive updates.
- `git diff --check` — exit 0. This worker created/modified only `wage-backend/`; shared-tree changes elsewhere belong to parallel workers.
- RED observed before GREEN for initial missing processor, full-day same-day aggregation, missing-pair handling, late duration conflict, legacy paid suppression, ambiguous duration/funds, forged revision, policy validation, hash-attested legacy, missing function exports, cross-lane identity conflict. Supplementary invariant/contract tests added after these behavior slices passed. Exact repeated-set updateTime test already passed on Firestore (identical sets can be no-ops); explicit equality guards were still added to avoid sending redundant writes, without claiming that supplemental test was initially red.
- Synthetic fixtures only in demo Firestore emulator. Real Admin transaction concurrency and direct Cloud Functions handler execution exercised; deployed Eventarc delivery, production IAM/Rules and full staff/browser entitlement journey are not certified by this suite.
- New Admin SDK issued a benign metadata discovery warning (`MetadataLookupWarning`, ETIMEDOUT/ENOTFOUND) during emulator startup; tests passed. No production Firestore calls, production writes, deploys, billing/API activation, commits or payment/cashbook changes were made.

## Release limitation

**Staged only.** Owner denied billing activation; Cloud Functions cannot be deployed under the authorized current project state. No ongoing automatic backend is installed. Parent can separately authorize/apply a finite approved Admin reconciliation with the exported `processCreated` function and exact policy/hash pins. No alternative client financial writer or scheduler is included.
