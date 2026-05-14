# Setup Feedback Form — Google Apps Script + Sheets

*Setup guide untuk feedback form di notulen HTML. One-time setup, lalu bisa di-reuse untuk notulen lainnya.*

---

## 🎯 Outcome

Setelah setup selesai:
- Form di `notulen-brin-13mei2026.html` (atau notulen lain) bisa menerima masukan dari participant
- Setiap submission **otomatis masuk** ke Google Sheet "Notulen Feedback Log" di folder Drive Adib
- Adib dapat **email notification** instan untuk setiap masukan baru
- Adib bisa monitor & filter responses di Sheet (sortir by date, bagian notulen, dll)
- Data 100% dimiliki Adib (di Google Workspace pribadi), bukan di layanan pihak ketiga

---

## 📋 Step-by-Step (Sekali Saja — ~15 menit)

### 1. Buat Google Sheet di Folder yang Ditentukan

1. Buka folder Drive: <https://drive.google.com/drive/folders/125qG6Au_jYPFWigK0Ha9eChh-g0gFuj_>
2. Klik kanan di area kosong folder → **New** → **Google Sheets**
3. Beri nama: **`Notulen Feedback Log — Wakaf Produktif`**
4. Pastikan sheet sudah berada di folder yang benar (lihat breadcrumb di top bar)

### 2. Tambahkan Apps Script ke Sheet

1. Di Sheet yang baru dibuat, klik menu **Extensions** → **Apps Script**
2. Tab baru akan terbuka dengan Apps Script editor
3. **Hapus** kode default `function myFunction() {}`
4. **Copy seluruh isi** file `apps-script-feedback-receiver.gs` (di folder ini)
5. **Paste** ke editor
6. Tekan **Ctrl/Cmd + S** untuk save
7. Ketika diminta nama project, beri nama: **`Notulen Feedback Receiver`**

### 3. Test Setup (Optional tapi Disarankan)

1. Di Apps Script editor, dropdown pilih fungsi: **`testSetup`**
2. Klik tombol **Run** (icon ▶)
3. Pertama kali akan minta authorize:
   - Klik **Review permissions**
   - Pilih akun `asroriadib@gmail.com`
   - Akan muncul warning "Google hasn't verified this app" → klik **Advanced** → **Go to Notulen Feedback Receiver (unsafe)**
   - *Aman karena script ini dijalankan di Google environment Adib sendiri*
   - Klik **Allow**
4. Setelah run berhasil, buka sheet — akan terlihat header row "Feedback" tab terbentuk otomatis

### 4. Deploy Sebagai Web App

1. Di Apps Script editor, klik **Deploy** (kanan atas) → **New deployment**
2. Klik icon gear ⚙ di kiri "Select type" → pilih **Web app**
3. Isi:
   - **Description:** `Notulen feedback receiver v1`
   - **Execute as:** `Me (asroriadib@gmail.com)`
   - **Who has access:** `Anyone` *(penting: agar form dari public web page bisa submit)*
4. Klik **Deploy**
5. **Copy "Web app URL"** yang muncul — formatnya:
   ```
   https://script.google.com/macros/s/AKfycbz.....abc123/exec
   ```

### 5. Update HTML File

1. Buka file: `Website Wakaf Produktif/notulen-brin-13mei2026.html`
2. Cari teks: `const SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL';`
3. **Ganti** `YOUR_APPS_SCRIPT_URL` dengan Web App URL yang baru di-copy
4. Save file

### 6. Test End-to-End

1. Buka file HTML di browser
2. Scroll ke section "Kotak Masukan, Koreksi & Edit"
3. Isi form test:
   - Nama: "Test Submission"
   - Email: email Adib sendiri
   - Institusi: "Test"
   - Bagian: pilih apa saja
   - Masukan: "Ini test submission via Apps Script"
4. Klik **Kirim Masukan**
5. Cek:
   - ✅ Apakah muncul success message di halaman?
   - ✅ Apakah row baru muncul di Google Sheet "Notulen Feedback Log"?
   - ✅ Apakah email notification masuk ke inbox Adib?

Kalau ketiganya ✓, setup berhasil!

### 7. Deploy ke GitHub Pages

```bash
cd "/path/to/Website Wakaf Produktif"
git add notulen-brin-13mei2026.html data/apps-script-feedback-receiver.gs data/SETUP_FEEDBACK_FORM.md images/logo-wakaf-produktif.png images/signature-adib.png
git commit -m "feat: notulen BRIN 13 Mei + Google Apps Script feedback receiver"
git push origin main
```

URL hidupnya: `https://adib-psych.github.io/wakaf-produktif/notulen-brin-13mei2026.html`

---

## 🔄 Update / Re-deploy Apps Script

Kalau perlu update kode (mis. tambah field baru, ubah notifikasi):

1. Edit kode di Apps Script editor
2. Save (Ctrl/Cmd + S)
3. Klik **Deploy** → **Manage deployments**
4. Klik pencil icon (Edit) pada deployment yang aktif
5. Version: **New version**
6. Klik **Deploy**

URL Web App **tidak berubah** — HTML tidak perlu di-update.

---

## 📊 Cara Review Submissions

1. Buka Sheet "Notulen Feedback Log — Wakaf Produktif" di folder Drive
2. Tab **Feedback** berisi semua submissions
3. Kolom **Status Review** default-nya "Belum direview" — Adib bisa update manual ke "Sudah direview", "Sedang ditindaklanjuti", "Selesai", dll
4. Kolom **Catatan Internal** untuk Adib catat tindak lanjut

### Filter & Sort
- Klik kolom header → **Create a filter** untuk filter by bagian notulen, status, dll
- Sort by Timestamp untuk lihat yang terbaru

### Export
- File → Download → Excel/CSV — untuk arsip atau analysis offline

---

## 🔐 Privacy Consideration

Form punya checkbox **"Saya bersedia masukan ini dipertimbangkan dan dirujuk secara terbatas dalam revisi notulen internal..."** (opsional).

Saat review:
- Kalau checkbox **✓ Ya** → bisa di-rujuk di revisi notulen (dengan attribution)
- Kalau checkbox **✗ Tidak** atau kosong → treat sebagai internal-only, jangan dipublish

---

## 🧩 Reuse untuk Notulen Lain

Kalau nanti ada notulen baru yang juga perlu feedback form:

**Option A — Pakai Sheet & Script yang sama (recommended)**
- Tinggal duplicate file HTML notulen (rename file)
- Update isi notulen
- Form action tetap pakai SCRIPT_URL yang sama
- Update `_subject` hidden field di form (mis. `value="Masukan Notulen [Topic] [Date]"`)
- Submissions akan masuk ke sheet yang sama; bedakan via kolom "Sumber Form"

**Option B — Sheet terpisah per notulen**
- Buat sheet baru
- Deploy script baru
- Update SCRIPT_URL di HTML notulen baru

Option A lebih simple & terpusat. Option B kalau volume tinggi & mau separated.

---

## ⚠ Troubleshooting

| Gejala | Kemungkinan & Solusi |
|---|---|
| Submit tidak masuk ke Sheet | Cek Apps Script logs (View > Executions di editor) untuk error. Pastikan deploy access = "Anyone" |
| Email notification tidak datang | Cek spam folder. Cek `MailApp.sendEmail` quota (100/day di free tier — cukup untuk feedback form) |
| CORS error di browser console | Wajar, fetch sekarang fallback ke `mode: 'no-cors'` otomatis. Submission tetap masuk. |
| Form selalu show error message | Cek SCRIPT_URL di HTML sudah benar (tidak ada typo). Buka URL di browser → harus return JSON `{"ok":true,"status":"active"...}` |
| Authorize keluar warning "unsafe" | Aman — script milik Adib sendiri di Google Workspace pribadi. Klik Advanced > Go to project > Allow |

---

*Setup ini dirancang sederhana, durable, dan murah (gratis selama Google account aktif).*
*Disusun: 13 Mei 2026 · Untuk Wakaf Produktif Kebun Kopi Ngantang*
