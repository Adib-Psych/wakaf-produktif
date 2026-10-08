# PR #1 reviewer corrections — candidate only

Executor: Thar Lay/server. Source: independently reviewed GitHub head `1f1e6989dcdf59ac909ee35210e80168c693d87b` and reviewer reproductions `novel-rules.cjs` / `legacy-id-probe.cjs`. Separate clone; no edits to parent/reviewer workspace. Code synchronizes through this PR, not a blanket Luna/Mac sync.

F1: candidate workers create permits only `{last_active: string}` for a known allowlisted ID; existing-record update permits only last_active changes. Deletions, removal/replacement of definitions and injection of name/token/role fields are denied. Actual dashboard registration at monitor-v2.html sends `{...newWorker,last_active:null}` and intentionally stays denied. Current PWA source has no worker-definition heartbeat writer; dashboard display derives activity from reports. This is restrictive compatibility, not authentication or privacy repair; names/tokens remain impersonable.

F2: each missing-ID pending report receives a cryptographic UUID inside a readwrite IndexedDB transaction, read from the current stored row; drain waits for commit before network. No local integer/timestamp-derived cloud fallback. Existing IDs stay unchanged. Abort or unavailable secure UUID leaves queue pending. No deduplication by body/time and no queue erasure. Lost ACK uses the committed ID again.

Existing remote report ACK now requires canonical equality of the full submitted body (nested object order normalized, arrays order-sensitive), excluding only transport-added synced_at and sync_source. A divergent or subsequently edited remote body fails closed and is never overwritten. Local synced marking also compares the currently persisted body against the submitted revision, within its readwrite transaction. Deliberate consequence: uncertain legacy/edited remote reports require reconciliation and remain pending; we do not infer delivery from ID + created_at.

RED evidence on Thar Lay/server: F1 novel replacement accepted before fix (139 pass / 1 fail); creation extra-field probes (142 pass / 7 fail). F2 missing stable identity and divergent-body false ACK reproduced as expected failures. Migration test first exposed missing queue preparation, then confirmed commit-before-network, abort retention and in-flight revision preservation.

Final verification commands:
- `node --test tests/*.test.cjs`: 84 pass, 0 fail/skipped.
- `npm run test:rules --prefix recovery`: 149 real demo-project emulator tests pass, 0 fail/skipped; loopback-only socket gate.
- `npm run test:rules:red --prefix recovery`: negative control against unchanged repository legacy rules, exit 1, 100 pass / 49 fail. Not deployed rules identity.
- `node tests/browser-correction.cjs`: six isolated Chromium cases, including two separate device contexts with identical local ID/time and divergent bodies. Production/CDN SDK requests blocked; no production requests or page errors. Existing browser smoke remains in CI, and correction browser is added to CI.

All fixtures synthetic. No production fetch, Firebase production query/write, deployment, merge, financial restore/payment/deletion, rules active replacement or paid service. B1 official Firebase release identity/auth and authoritative deployed-rules snapshot, and B2 old browser/Admin/Console writer containment remain independent release gates. Staff entry is NOT live-safe on this evidence. Offline-install readiness and cross-tab zero-loss guarantees are not established. Independent release review must use the exact new PR head and re-run the release gates.
