# Cadangan harian Firestore Wakaf — resep v2

Disusun Claude, 9 Nov 2026, untuk Keluhan #37 dan ADR-050 (cadangan harian). Skrip: `recovery/backup/cadangan_harian.py`. Skrip ini menggantikan `firestore_backup.py` v1 (24 Jun 2026) di Luna, `Wakaf Produktif/Paket Konsolidasi 26 Sep 2026/Backup Firestore/`.

## Cakupan

**Inklusi (26 koleksi).** Semua koleksi yang dapat dibaca publik menurut `firestore.rules` ikut dicadangkan.

| Kelompok | Koleksi |
|---|---|
| Inti (v1) | laporan, workers, upah, cashbook, opt_observations, panen_data, panen_lots, panen_sampling, sop_status, distribusi_pic, sop_master, worker_defs_custom, milestones, invoices |
| Upah sesudah Oktober 2026 | wage_entitlements, wage_processing, wage_worker_bindings, payroll_states, payroll_events |
| Entri dan perangkat | report_heads, entry_receipts, device_reports, device_receipts, cabut_state |
| Operasi | operation_events, operation_receipts |

**Eksklusi (13 penyimpanan).** Penyimpanan berikut ditutup Rules. Isinya tidak pernah disimpan:

- audit_log
- penyimpanan kapabilitas: worker_tokens, entry_grants, payroll_grants, reader_grants
- payroll_targets
- penyimpanan kebijakan: payroll_policy, entry_policy, device_entry_policy, reader_policy, operation_policy
- penyimpanan turunan: entry_roster, operational_snapshot

Setiap penyimpanan yang dikecualikan tetap diperiksa pada setiap putaran. Bila salah satunya terbaca publik, skrip keluar dengan kode 3 (alarm keamanan) dan isinya tidak ditulis.

**Penjaga perubahan rules.** Uji `test_cadangan_harian.py` mencocokkan kedua daftar dengan `firestore.rules`. Koleksi baru di rules yang belum diputuskan masuk inklusi atau eksklusi membuat CI gagal.

## Keluaran dan integritas

Format v1 dipertahankan: `raw/`, `clean/`, `snapshot_combined.json`, `README_SCHEMA.md`, Excel ringkas, `_status.json`, `LATEST.txt` dan `backup_log.csv`. Tambahan dalam v2:

- **`MANIFEST.json`** mencatat jumlah dokumen, jumlah rekaman dan SHA-256 setiap berkas. Manifest diverifikasi ulang segera sesudah ditulis.
- **`_status.json`** memuat `rekaman_per_koleksi`, `penyusutan` dan `berubah_saat_cadangan`. Pembacaan berlangsung berurutan, bukan snapshot atomik, sehingga dokumen yang berubah selama proses dicatat di sini.
- **Pemeriksaan penyusutan.** Bila jumlah rekaman suatu koleksi turun lebih dari 20% dibanding cadangan sebelumnya, skrip keluar dengan kode 5. Pembanding bisa berupa cadangan v1 maupun v2.

| Kode keluar | Arti |
|---|---|
| 0 | Lengkap dan terverifikasi |
| 2 | Ada koleksi inklusi yang gagal dibaca atau di bawah jumlah minimum (dokumen inti harus ada) |
| 3 | Penyimpanan yang dikecualikan terbaca publik |
| 4 | Berkas tidak cocok dengan manifest |
| 5 | Cadangan tersimpan, tetapi ada penyusutan besar |

Setiap kode selain 0 wajib diteruskan pelaksana sebagai notifikasi gagal kepada pemilik.

## Pemasangan (Hermes)

1. Pasang PR ini setelah CI lulus.
2. Salin `recovery/backup/cadangan_harian.py` dari `main` ke folder `Backup Firestore` di Luna, berdampingan dengan v1. Berkas v1 tidak dihapus.
3. Arahkan wrapper harian ke `cadangan_harian.py`, lalu ganti hash yang dikunci dengan SHA-256 berkas dari `main`.
4. Jalankan satu kali sebagai uji. Hasilnya harus `OK : LENGKAP dan terverifikasi.` dengan kode 0 dan 26/26 koleksi.
5. Laporkan nomor folder snapshot dan `manifest_sha256`.

Kredensial tidak diperlukan. Cadangan tetap berada di Luna dan tidak boleh diunggah ke GitHub.

## Pemulihan yang aman

Memulihkan berarti menulis ulang data produksi. Langkah ini termasuk keputusan pemilik dan tidak boleh dilakukan otomatis.

1. **Verifikasi.** Jalankan `python3 cadangan_harian.py --verifikasi snapshots/<folder>`. Hasilnya harus `Manifest COCOK`.
2. **Latihan di emulator.** Jalankan `python3 cadangan_harian.py --latih-pulih snapshots/<folder> --emulator http://127.0.0.1:8080`. Hasilnya harus 0 dokumen berbeda. Alamat selain localhost ditolak.
3. **Tentukan cakupan sempit.** Tentukan satu dokumen atau satu koleksi, sebutkan alasannya, dan bandingkan isinya dengan keadaan live saat ini.
4. **Susun paket.** Claude menyusun paket pulih yang menggunakan `raw/<koleksi>.json` sebagai sumber, ditulis melalui `Alat Jaga Data/tulis_aman.py` dengan deklarasi selisih dan metadata (§2A).
5. **Posting dan baca ulang.** Hermes memposting paket itu dan melakukan baca ulang. Pemulihan massal yang menimpa seluruh database tidak diizinkan.

Hasil latihan pada 9 Nov 2026: 306 dokumen dari snapshot produksi dipulihkan ke emulator dengan 0 perbedaan.
