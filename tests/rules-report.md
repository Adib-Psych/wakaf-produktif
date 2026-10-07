# Entry-safe server containment candidate — NOT DEPLOYED

- Created `recovery/firestore.entry-safe.rules`, `recovery/package.json`, `recovery/firebase.json`, `tests/rules-entry-safe.cjs`, `tests/rules-network.cjs`, `tests/rules-run.cjs`, this report, and emulator-derived `tests/rules-results-{legacy,candidate}.json`.
- Unchanged production `firestore.rules`; no commit, deploy, production database access, credential use, dashboard/CI/backup work, or board completion.
- Read unchanged existing rules and updated `lapor-cabut.html`; matched the stable report ID, `cabut_` marker, transaction and `arrayUnion` payload. Kept all existing veteran/dynamic worker tokens and WAKIF/ADIB create compatibility; BORONGAN is allowed only for `cabut_borongan`.
- Frozen all shared singleton create/update/delete writes, including cashbook seed/replacement/merge, upah, panen*, opt*, SOP, compliance, milestones/publication, distribusi, worker definitions/tokens, invoices creation/signing/deletion. Unknown collections remain default deny. `workers` last_active tracking and append-only audit creation retain legacy behavior.
- The sole singleton exception is update of **existing** `sop_status/pohon_cabut`: exactly one appended unchecked row, all historical rows/order/duplicates unchanged via exact `old.data.concat([newRow])` equality, only delivery metadata changes, server timestamp, fixed source/updater, and `getAfter` report association. Associated report must not exist before the commit; report ID, log ID/src_laporan, kebun, quantity, date, pending, creation time and unverified marker are checked. Marked reports also require this append atomically. Report/log payment/publication fields and singleton field injection are denied. No laporan updates/deletes. Lost-ACK retry must read marker and perform **no writes**.

## Executed real emulator evidence

```sh
cd /root/.hermes/workspaces/wakaf-operational-recovery/repo/recovery
npm install --ignore-scripts --package-lock=false --no-audit --no-fund
npm run test:rules:red   # EXPECTED exit 1: unchanged legacy rules
npm run test:rules       # exit 0: candidate
```

Initial strict red-before-candidate execution: **133 tests, 96 pass, 37 fail**. Initial candidate: **133 pass, 0 fail**. Added six edge-case tests; reran unchanged legacy and candidate with the final same suite: **red 139 total / 99 pass / 40 fail / exit 1; green 139 total / 139 pass / 0 fail / exit 0; no skipped or cancelled tests**. JSON results are parsed from actual runner output, not invented. Real SDK transactions, batches, concurrent distinct submissions, read-only retry after administrative log correction, rejection rollback readback, nonempty pending checklist, malformed/missing singleton, wrong associations, historical mutation/reordering, duplicate preservation, multi-row append, invoice signing, and forbidden piggyback writes were exercised.

Project is hardcoded **demo-entry-safe**; Firestore is **127.0.0.1:8688**. Test process blocks non-loopback socket/DNS calls before connection; runner strips secret/credential environment keys, uses scratch-isolated CLI configuration and never imports production Firebase config. All fixture values are synthetic locally generated test inputs, not raw production fixtures. npm package acquisition is separate from test networking. Emulator/runtime logs stay in Hermes scratch, not the repository.

## Limitations / review blockers

- **NOT authentication:** public veteran tokens, WAKIF/ADIB and publicly readable dynamic token mirror entries can be impersonated. BORONGAN has no secret. These rules prevent overwrite/payment/publication, not forged reports, spam, fabricated physical work or client-time manipulation. Existing corrupted mirror membership is not cleaned up here.
- **NOT privacy:** legacy public get/list access is retained, including reports, financial state, worker tokens and invoices. Token URL secrecy does not hide publicly listable invoice documents. Audit reads remain denied.
- Operator/dashboard writes (including invoice signing and singleton seed) intentionally fail under containment; Console/Admin SDK still bypass rules. Missing/malformed or full cabut singleton fails closed and needs separately reviewed privileged intervention.
- Unmarked ordinary/cabut laporan creates retain baseline legacy schema compatibility; they do not authorize singleton appends. Existing reports without the new marker cannot be automatically upgraded/replayed.
- Rules validate resulting document state, not whether the caller used `arrayUnion`: an exact fresh concat is indistinguishable and equally safe; stale/history-replacing writes are denied.
- Singleton size/doc growth remains Firestore-limited; no migration or backend identity/rate-limit service is introduced. GPS/checklist accuracy and physical work are not attested.
- Some legacy negative cabut tests pass because legacy rules reject BORONGAN entirely; candidate-positive and fine-grained candidate-negative tests provide the meaningful cabut evidence. Final red failures include permissive legacy singleton/report writes and denied legitimate BORONGAN delivery.
- npm install reported dependency deprecations and `superstatic@10.0.0` engine warning (Node 26 vs supported 20/22/24); actual emulator tests nevertheless passed. Dependencies require parent release review. Heartbeat was requested for long commands, but this one-shot subagent runtime does not support notification delivery; processes were explicitly waited to completion.

No cabut expressibility blocker remains in the emulator-tested candidate. Parent retains production-release approval, CI/dashboard/backup and any deployment decision.
