# Handoff — gate efek samping finance dari report (belum disetujui independen)

## Kandidat dan scope

- Parent bersih: `/root/.hermes/workspaces/wakaf-staff-uuid-failure-fix/candidate`, HEAD `7178622e9e6b30dfe97beae162b53297575d1907`.
- Kandidat milik executor: `/root/.hermes/workspaces/wakaf-listener-finance-containment/source`, branch `fix/listener-finance-containment`; clone lokal `--no-hardlinks`.
- Hanya satu file produk berubah: `monitor-v2.html` (+18/-132). Patch frontend: `evidence/frontend-only.patch`; SHA256 `edf695cd6f773a9da1dce326f41ed865d1b9deb7979d71cf875b2587f9093e9b`.
- `evidence/provenance.json` mencatat hash seluruh 349 file tracked parent/candidate dan inode berbeda. Parent tetap bersih dan hash sesuai commit. Sidecar approved R1 tidak diubah/tidak diintegrasikan.

## Akar masalah dan patch minimal

Listener laporan serta `reprocessPendingEntries` memanggil `autoCreateUpahFromEntry`, yang menambah `UPAH_ITEMS` dan langsung `saveUpah` ke localStorage sebelum penolakan cloud. Kegagalan finance read malah fallback local. Startup juga memfilter pekerja ANTO dari histori in-memory.

- `autoCreateUpahFromEntry` tetap memiliki signature lama, tetapi menjadi no-op `return null` permanen untuk kandidat finance UNWIRED; kode pembentuk upah dihapus, tidak ada implementasi finance baru.
- Listener dan reprocess tidak membaca finance/tidak memanggil factory; hanya report read model dan compliance dipertahankan. Render finance yang tidak diperlukan serta pesan auto-upah dibuang.
- Filter startup ANTO dihapus agar histori/ID tidak dihilangkan.
- Reconciliation flag tidak membuka gate finance. Banner menjelaskan bahwa mematikan flag hanya mengizinkan reprocess compliance. Normalizer, ID, report queue dan write-door lama tidak diganti.

## TDD dan bukti aktual

Perintah dari root kandidat:

```sh
node --test tests/listener-finance.test.cjs
node --test tests/*.test.cjs
node tests/browser-listener-finance.cjs
WAKAF_EVIDENCE=evidence node tests/browser-staff-uuid-failure.cjs
python tests/listener-finance-provenance.py
```

Dependensi terpasang dipakai read-only lewat symlink lokal `recovery/node_modules` (git-excluded) ke `/root/.hermes/workspaces/wakaf-stabilization-integration/source/recovery/node_modules`; tidak install. Chromium terpasang `/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`. Browser baru isolated, loopback saja, service worker diblok; URL SDK dipenuhi adapter ES module sintetis, bukan network Firebase/Auth. Semua request eksternal lain diblok. Data produk/keuangan nyata tidak dibaca.

- RED arrival: `evidence/red-arrival.tap`: 1 gagal dengan upah baru ID92 + perubahan bytes storage melalui callback produk yang benar-benar diregistrasikan.
- GREEN pertama: `evidence/green-arrival.tap`: 1 lulus.
- RED finance read: `evidence/red-finance-read.tap`: 1 gagal karena dua getDoc finance dari startup/listener. GREEN: `evidence/green-finance-read.tap`: 2 lulus.
- RED startup filter: `evidence/red-startup-filter.tap`: 1 gagal karena histori ANTO hilang sebelum patch; diperbaiki setelah RED.
- Replay final matrix terhadap baseline: `evidence/red-baseline-matrix.tap`: 13 gagal/1 lulus; kandidat `evidence/green-matrix.tap`: 14 lulus. Tidak dihitung sebagai 14 fitur baru independen; beberapa kontrol menguji gate yang sama.
- Regression baseline terpisah: 149 test lulus, termasuk 4 `DEFECT:` diagnostic lama. Kandidat: 163 lulus = 159 nondiagnostic + 4 diagnostic lama, 0 gagal/skip (`evidence/baseline-regression.tap`, `evidence/regression.tap`). Tidak ada klaim full-system/financial-ready.
- Browser full dashboard **menjalankan module report listener**, callback actual, timer startup 3 detik dan retry error 5 detik. `evidence/browser-listener-finance.json`: 5 acceptance checks + 1 diagnostic malformed-display; 0 pageerror; saveUpah=0/syncUpah=0 setelah instrumentation. Baseline browser gagal karena filter histori (`evidence/red-browser-startup.log`). Baseline VM juga membuktikan startup/reprocess mutasi upah dan save lokal.
- Browser UUID regression: 2 acceptance checks, 0 pageerror, pending/form/STATE tetap, 0 transport/enqueue/reset/write (`evidence/browser-staff-uuid-failure-results.json`).

Baseline sintetis finance nonzero: upah qty2×tarif17; cash masuk123/keluar7; kasbon13; browser menambah baris histori ANTO tarif19. Memori finance serta **bytes asli** upah/cash/kasbon dan dua pending-key dibandingkan sebelum/sesudah. Adapters memakai fungsi `saveUpah` aktual (diinstrumentasi, bukan diganti no-op). Report arrival/modified/removed, cache duplicate, retry/retry-cap, startup/explicit reprocess, reconciliation on/off, cabut/tombstone, finance missing/malformed/read-denied, malformed report/throwing snapshot dan compliance error tercakup.

## Batas yang tetap HOLD — jangan klaim freeze seluruh writer

1. Tab lama masih menjalankan kode lama; Admin/Console bypass frontend. Tidak ada containment server baru, perubahan rules/roles/provider/grants, deploy/push/merge atau Auth wiring. Entry/pay tetap PAUSED secara operasional; finance UNWIRED.
2. Fungsi `saveUpah` dan manual finance lain sengaja tidak dibungkus freeze generik. Manual gap bulk, archive/reconcile/pay, recovery dan console functions berada di luar gate report otomatis. Daftar itu bukan jalur yang disetujui digunakan. Kandidat ini bukan bukti semua interaksi finance aman.
3. Finance load/listener/focus rehydrate yang sudah ada (`upah`, `cashbook`, `sop_status/kasbon`) masih dapat mengganti cache dari snapshot. Test browser mengizinkan pembacaan adapter missing-doc tetapi tidak mengeksekusi semua callback domain finance. **Zero mutation yang terbukti hanya berasal dari report/startup factory/reprocess dalam scope ini**, bukan seluruh sinkronisasi cloud. Jika gate berikutnya menuntut semua domain, petakan setter/merge dan provenance/revision secara terpisah, bukan menambah wrapper di seluruh monolit.
4. Existing pending staff queue tetap mencoba satu report transaction saat startup; adapter menolaknya dan bytes pending tetap. Ini bukan finance write; tidak diklaim nol semua percobaan SDK.
5. Malformed category angka tetap menyebabkan `renderLog` menolak (`kategori.replace is not a function`); rejection dipantau diagnostik, finance/pending tidak berubah. Normalizer shallow alias detail dan modified-only persistence/render gap belum diperbaiki. Tidak ada klaim malformed report aman ditampilkan atau submitted-body immutability diperbaiki.
6. Proof sidecar, product Auth/principal/query/projection, rekonsiliasi data nyata, backup custody/offhost, dan penerimaan perangkat nyata tetap gate terpisah.

## Gate berikutnya

Review independen pada copy terpisah atas commit kandidat dan hash patch ini, dengan probe adversarial callback/timer actual, byte-preservation nonzero, history ANTO, batas malformed/error, dan perbandingan baseline. Approval independen belum ada; commit ini hanya menyimpan kandidat/evidence. Jangan integrasikan/deploy atau membuka entry/pay sebelum keputusan review dan gate gabungan yang berwenang.
