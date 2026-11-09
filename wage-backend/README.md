# Server-only automatic unpaid wage entitlements

## Pembentukan hak upah saat entry + sapuan malam (ADR-050, 9 Nov 2026) — jalur yang DIPAKAI

Karena Cloud Functions tidak dipasang (billing ditolak), `nightly.cjs` memanggil `processCreated` yang sama dari Thar Lay dengan Application Default Credentials Hermes (di luar repo). Atas arahan Wakif (9 Nov), hak upah dibentuk **saat ada entry**:

- `node nightly.cjs --project wakaf-ngantang --dengar` — layanan tetap: sapuan pengejar saat mulai, lalu memantau `device_reports`, `device_receipts`, `laporan`, `entry_receipts`; entry baru diproses ±3 detik kemudian. Keluar kode 1 bila pemantauan putus → penyelia Hermes menjalankan ulang. Biaya baca: satu kali keadaan awal (±250 dokumen) per sambungan, sesudahnya hanya perubahan — jauh di bawah kuota Spark.
- Sapuan malam (tanpa `--dengar`) tetap dijadwalkan sebagai jaring pengaman dan untuk catatan *N hari tanpa laporan*.

- `node nightly.cjs --project wakaf-ngantang` — rencana saja (bawaan). `--terapkan` untuk memproses, `--keluaran <json>` untuk bukti.
- Memproses laporan **modern** (berkontrak) di `device_reports`/`device_receipts` dan `laporan`/`entry_receipts` yang belum punya `wage_processing/report_v1_<lane>_<id>`, serta mengulang otomatis `unresolved` beralasan `pair_missing`.
- **Tidak membayar.** Tidak menyentuh `payroll_*`, `cashbook`, `upah`. Hak upah lahir `status:'belum'`; pembayaran tetap atas permintaan pekerja (± tiap 10 hari kerja).
- Laporan **legacy** (tanpa kontrak) tidak pernah diterima otomatis; yang bertanggal ≥ `effective_from` dilaporkan sebagai *menunggu atestasi* (jalur finite dengan pin hash pemilik).
- `unresolved` lain (durasi kosong/konflik, dana campur, koreksi) tidak diulang otomatis; diulang hanya dengan `--ulang-unresolved` atas keputusan Claude/pemilik.
- Kode keluar: `0` bersih · `3` ada yang ditahan atau menunggu atestasi → Hermes membuka Keluhan · `1` galat.
- Uji: `test/nightly.test.cjs` (emulator, ikut langkah CI wage processor).

This directory is a separate Firebase Functions Node 22 codebase. **Staged only: the owner denied billing activation, so Cloud Functions production deployment is blocked and automatic processing is not installed.** It does not deploy itself and provides no remote HTTP/callable/Admin endpoint. The publisher owns Rules, policy commissioning and separately authorized finite historical reconciliation. Do not enable billing/APIs, deploy resources or replace this boundary with client financial write authority. No production records or identities are included.

## Integration contract

Add `functions: {source: "wage-backend", codebase: "wages", runtime: "nodejs22"}` to the root Firebase config. Four v2 Firestore `onDocumentCreated` exports watch `device_reports`, `device_receipts`, `laporan`, `entry_receipts`. Receipt handlers use the corresponding report lane. Each event rereads current authoritative documents inside a transaction; retries never use event timestamps or host-clock ordering. `FUNCTION_REGION` selects the trigger region, default `asia-southeast2` (Jakarta); publisher must confirm the Firestore-compatible region before any future reviewed deployment. Set this at discovery/deploy as well as runtime. No cron/browser dependency. Existing documents require an explicitly finite Admin invocation, not startup replay.

### Server-only `wage_policy/active`

```json
{
  "contract_version": 1,
  "workers": {
    "w_000000000000000000000001": {
      "legacy_token": "TEST_WORKER",
      "name": "Synthetic example only",
      "half_day": 50000,
      "full_day": 100000,
      "effective_from": "2026-10-01"
    },
    "TEST_WORKER": {
      "legacy_token": "TEST_WORKER",
      "name": "Synthetic example only",
      "half_day": 50000,
      "full_day": 100000,
      "effective_from": "2026-10-01"
    }
  },
  "legacy_report_hashes": {}
}
```

Actual values must come from owner-approved evidence, never this example. Both exact original random worker ID and legacy token aliases should be explicitly keyed. Aliases sharing a `legacy_token` must have identical contract values. Rates are positive safe integers; no implicit tariffs, display-name matching, headcount multiplication, worker ID conversion or current-date eligibility. Unknown policy fields fail closed. Client reads/writes of policy must stay denied. Changes to effective contracts are not a payroll amendment workflow: any conflicting persisted entitlement is held, never repriced.

### Historical attestation and finite Admin backfill

`legacy_report_hashes` is an optional server-only map of **exact laporan document ID -> lowercase SHA-256 digest**. Generate via `canonicalHash(rawDocument)` exported from `processor.cjs`. Canonicalization is UTF-8 JSON recursively sorting object keys (JavaScript `.sort()` order), retaining array order and JSON primitive encodings; no whitespace. Hash the complete persisted raw body including `last_synced_at`/`last_edited_at` metadata, not a reader projection containing `_provenance`. Digest computation does not authorize a source; the publisher must compare against a reviewed approved snapshot before commissioning.

Trusted local Admin SDK usage (not an unauthenticated remote endpoint):

```js
const {processCreated, canonicalHash} = require('./wage-backend/processor.cjs');
// db is the publisher's explicitly configured Admin Firestore instance.
await processCreated(db, 'device_reports', approvedModernReportId);
await processCreated(db, 'laporan', approvedLegacyReportId, {acceptLegacy: true});
```

Legacy acceptance requires BOTH explicit `acceptLegacy:true` and an exact policy pin. It only supports plain original schema 3.5/1.1 bodies with optional attested sync/edit annotations; partial modern envelopes, any original receipt, wrong ID/hash or unsupported shape fail closed. No original receipt is fabricated. Default deployed triggers do not enable legacy acceptance. Source references mark historical provenance `attestation:'policy-sha256'` with `body_hash`. For a preview, run this exact processor against a separately controlled emulator populated with the exact reviewed snapshot, compare planned writes, then invoke only the approved finite IDs. No broad replay tool is shipped.

## Public read model

- Wage ID: `wage_v1_<LEGACY_TOKEN>_<YYYY-MM-DD>`.
- `wage_entitlements/{id}` contains `id,pelapor,tgl,worker,model:'harian',qty:1,satuan:'setengah_hari'|'full_day',tarif,status:'belum',eligible:true,sources,fund`.
- `worker` is configured display name, `pelapor` canonical legacy token. `fund` is `K4` or `K1_K3`. Known full-day alias `satu_hari` normalizes to `full_day`.
- `sources` is deterministically sorted `{lane,report_id,revision:1}` (plus historical attestation when applicable). No owner UID, email, grant/roster config, photo or submitted body is published.
- `wage_processing/{wageId}` tracks aggregate `status:'created'|'existing'|'unresolved',reason,report_id,tgl,worker,sources`; processing worker is canonical token.
- `wage_processing/report_v1_<lane>_<reportId>` tracks the particular event, including policy/unmapped failures where no valid wage ID can be formed. Its source event ID is not an ordering authority. Aggregate sources/reasons are authoritative, not which trigger happened last.
- Readers must not count an entitlement with `eligible !== true` or aggregate processing `status:'unresolved'`. Render a blocked retained row as under review, not newly payable; payment is outside scope.

The transaction reads all same-business-date sources in both lanes and joins exact canonical worker aliases, receipt, original contract and any existing correction head. One worker/day has one amount even for multiple categories/headcount. Missing/unknown duration, generic borongan, missing funds, mixed K1–K3/K4, malformed/unpaired originals or corrected reports are unresolved. An existing `upah/active.data` item with canonical worker/date suppresses creation regardless of paid/archive status. Missing/malformed legacy ledger fails closed. The legacy singleton is read-only.

Late conflict marks an **unpaid** retained row `eligible:false,blocked_reason` without deleting or changing its earned amount/status. Existing paid rows remain completely unchanged; processing records surface conflict. Historical corrections/payment are not automated by these create-only triggers. A correction head already present blocks derivation; a later correction needs a separate reviewed reconciliation workflow, not silent rewriting.

## Verification

```sh
cd wage-backend
npm ci --ignore-scripts
npm test
npm run test:emulator
```

`npm test` runs pure tests and deliberately skips emulator tests if `FIRESTORE_EMULATOR_HOST` is absent. Use `npm run test:emulator` for required real Firestore transaction tests. Test configuration is a `demo-` project and deny-all Rules; fixtures are synthetic only. Integration calls use Admin SDK against the emulator, not proof of production IAM, Rules, deployed delivery or the full staff/browser journey. No payment, cashbook, receipt, report or policy writes occur in the processor; only `wage_entitlements` and `wage_processing` are writable targets.
