# Serialized integration contract — candidate only

Executor: Thar Lay/server. Baseline PR#1 7c7c67644ce1139ebdcba1de54ef1d17cf7ddc46. No production reads/writes. Source-only candidate is not live-ready. Entry remains PAUSED.

## Apply order and ownership

1. Integrator t_087a43d7 reads current release checkpoint; rebase from fresh exact source, never replace current main with this old branch.
2. Keep entry-recovery lexical SDK writer gates, F1 restrictive heartbeats and F2 stable committed UUID/full-body ACK unchanged. No operations write re-enabled by these proposals.
3. Reuse operations/domain.cjs as a Node/CommonJS pure planning/validation module. It is not imported by product HTML. To use browser-side, integrator must package explicitly and test the chosen adapter; no implicit `require` in browsers.
4. `operations/proposals/monitor-v2.html.patch` is a narrow fail-closed guard/cache corrective proposal. `git apply --check` passed against captured baseline. It does NOT wire domain plans to cloud transactions, implement event storage or finish every validation path. Whole monolith remains byte-identical in this branch.
5. `operations/proposals/lapor.html.patch` moves manifest and registration to root candidate files. Browser fixture makes precisely these two substitutions only. worker-sw.js and worker-manifest.json are independently owned additions, not registered by existing page. No demo file changes.
6. Re-run combined tests then isolated browser against integrated source. Keep UI, multi-batch proportional allocation and cabut improvements. No PR push/merge/deploy performed by this task.

## Proposed domain contract

measurement(raw, sourceUnit, targetUnit): complete finite nonnegative readings; explicit g/kg/tree dimensions. Decimal comma accepted, mixed separators/partial strings rejected. Raw observed value preserved. Missing is distinct from recorded zero. No inferred bag weight.

planSort(snapshot,event,expectedRevision): snapshot `{revision,batches,lots,sortEvents}`; event `{id,batchId,unit:'kg',gross,floating,kuning,hijau,hitam,mode:'remainder'|'measured',merah?}`. A stable event ID must be persisted before request. Per-parent/grade deterministic proposed lot ID `SORT-<encoded parent>-<grade>`; legacy display IDs retained separately when an adapter is designed. Existing legacy split -> review, not automatic adoption/deletion. Floating only in parent. Measured red remains measured; derived red explicitly marked. Returns immutable plan with expectedRevision, never commits it.

An actual server transaction must read current parent/lot/event identities, compare revision, and atomically create event/lots plus parent patch. Two isolated snapshots returning same plan is NOT concurrent-write protection. Stale revision/conflicting ID is a conflict. Lost ACK requires authoritative exact event-content read-back, not local noop alone. Legacy duplicate identities/corruption need reconciliation.

validateProcess/validateCoverage/validateStock: enforce units, finite numbers, denominator and links, preserve physical discrepancies as review-required and keep negative stock visible. No forcing scale reading to expected yields. Covered sessions never have prior dried readings cleared; contradictory coverage is review-required. Archive/reversal only; deletionGate unlinked is NOT deletion permission.

SOP stable keys: YYYY-MM:encoded_activity_id. Activity ID belongs to governed SOP master, not array index/title. mapLegacySOP requires explicit verified `{legacyKey,year,month,activityId}` mapping; unproven/multi-match legacy state stays preserved and unresolved. No inferred legacy year and no master reorder migration performed. Integrator must change all readers, aggregation, handlers and seeds together, not only render key.

Cache uses explicit key/version/data/render contract. Harvest keys remain `_2026` for current schema, not an invented annual rollout; next-season migration is separate. Lots loader currently accepts 1.0 only; 1.1 needs reviewed loader change, not silent acceptance. PanenSampling setter mutates incoming migration data: cache output/readback must be exercised with that setter before broader integration. Factory acronym additive mappings for SOP/OPT and cashbook/OPT render fixes overlap other streams and are NOT applied here.

FieldIntensity uses only structured field-count surveyed/affected trees. Photo AI is hypothesis-only. Missing is not zero. No threshold classification, prevalence claim or public approval from this function. Existing conflicting yield ranges (30–55, 38–52, 40/55 and ~44%) have not been selected or validated.

Worker numeric tariff persistence touches financial ownership. It remains a documented pending finance integration gate; no guessed numeric tariff, new worker permission or PWA onboarding was added.

## Offline boundaries / rollback

Root SW network-first caches allowlisted shell assets only, not dashboard/API/private photos. Owned cache prefix cleanup leaves sibling caches intact. No skipWaiting/clients.claim: close old tabs after durable queue checkpoint; update waits. Worker token remains existing query link; manifest start alone does not remember worker identity and must not embed a real worker token. Install icon dimensions/install prompt and real-device identity retention remain unverified. Old demo SW migration/unregistration MUST enumerate exact owned script URL/scope and wait for pending queue preservation; never unregister all workers or delete all caches.

Rollback source proposals: none applied. Candidate files can be omitted. If later deployed, restore prior code via reviewed PR and preserve IndexedDB queues; do not clear storage or hard-delete legacy SW caches as a shortcut.

No agronomy approval, new AI service, payment action, public projection, cloud writer migration or rules/billing change in this stream.
