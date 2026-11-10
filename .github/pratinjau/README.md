# Pratinjau PR (ADR-053, 10 Nov 2026)

**Tujuan.** Adib dapat memeriksa perubahan pada aplikasi yang sudah live di alamat terpisah sebelum PR dipasang. Hermes hanya terlibat sekali, saat Adib menyatakan final.

## Alamat
- Live, tidak berubah: `https://adib-psych.github.io/wakaf-produktif/…`
- Pratinjau: `https://adib-psych.github.io/wakaf-produktif/pratinjau/pr-N/…`
- Daftar pratinjau: `…/pratinjau/`

## Pagar mode pratinjau (`mode-pratinjau.js`, disuntikkan oleh `rakit.py`)
1. Data live hanya dibaca. Semua permintaan selain GET/HEAD/OPTIONS ditolak, kecuali POST baca Firestore (`runQuery`, `runAggregationQuery`, `batchGet`, `Listen`) dan login Google. Firestore `Write`, `:commit`, PATCH/DELETE, GitHub API PUT, `sendBeacon`, dan form POST ditolak.
2. Penyimpanan peramban dipisah dengan awalan `pratinjau-prN:` (localStorage, sessionStorage, IndexedDB, CacheStorage). Login Firebase, cache Firestore, antrean offline staf, dan token yang tersimpan di versi live tidak terlihat dan tidak tersentuh.
3. Service worker tidak didaftarkan.
4. Pita "PRATINJAU PR #N · revisi abc1234 · data live hanya-baca" dan judul tab `[PRATINJAU]`; `noindex`.
5. Foto `images/gallery/` tidak disalin kecuali diubah oleh PR (ukuran situs maks. 1 GB).

Uji: `.github/pratinjau/test_rakit.py` (perakitan, byte main identik) dan `tests/pratinjau-mode.browser.cjs` (pagar di peramban; dashboard dan lapor tidak mendapat error baru). Keduanya berjalan di CI.

## Alur kerja
1. Claude membuka PR **Draft tanpa tanda `antrian-hermes`**. GitHub sendiri menolak merge PR Draft.
2. Setiap push ke PR memicu terbit ulang (`pratinjau-picu.yml` → `terbitkan-pages.yml`, selalu dari konteks main).
3. Adib memeriksa dan mengoreksi; Claude mendorong revisi ke PR yang sama.
4. Adib menyatakan final → Claude mengubah PR ke Ready dan menambah tanda 🟢 → Hermes memasang lewat papan.
5. Saat PR ditutup atau dipasang, pratinjaunya hilang pada terbit berikutnya.

## Pengaktifan sekali jalan (Hermes, atas persetujuan Adib)
1. Pastikan PR ini sudah ada di `main`.
2. Ubah sumber Pages: Settings → Pages → Source = **GitHub Actions**.
3. Setel variabel repo `PAGES_LEWAT_ACTIONS=ya`.
4. Jalankan `gh workflow run terbitkan-pages.yml --ref main`. Tunggu sampai pekerjaan `periksa` hijau: `pratinjau/TERBIT.json` yang tersaji harus memuat nomor run ini (bukti situs berasal dari Actions, bukan build cabang lama), lalu berkas tersaji harus sama byte dengan `main`.

**Pemulihan.** Sumber Pages dikembalikan ke "Deploy from a branch: main / (root)", lalu variabel diset `tidak`. Situs kembali terbit seperti sebelum ADR-053.

## Batas yang diketahui
- Origin pratinjau sama dengan versi live. Pemisahan penyimpanan dilakukan di peramban oleh skrip, bukan oleh browser. Pengamanan lapis kedua ada di aturan Firestore: tanpa login di pratinjau, penulisan anonim tetap ditolak server.
- Service worker live (lingkup `/wakaf-produktif/`) tetap bisa mengendalikan halaman pratinjau. Ia hanya meng-cache enam berkas di akar, jadi halaman pratinjau tidak tersentuh.
- Halaman dengan CSP ketat tanpa skrip (mis. `ringkasan.html`) hanya mendapat pita HTML. CSP-nya sendiri sudah melarang semua koneksi.
