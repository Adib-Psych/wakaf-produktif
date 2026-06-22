# Website Wakaf Produktif — Operating Manual (Sub-Sectional)

> **Sub-sectional CLAUDE.md** untuk konteks Wakaf Produktif ②. Khusus untuk maintain & deploy `wakaf-produktif` GitHub repo (public-facing pages + dashboard internal + Living Lab).
>
> **Last refresh:** 23 Mei 2026 — post single-brain migration (replace duplikat sectional)

---

## 📍 Reference Tree (jangan duplikasi)

| Untuk… | Baca file ini |
|--------|---------------|
| Identitas Adib (multi-role) + 4 konteks ekosistem + standing rules global | **`~/Documents/Claude/CLAUDE.md`** (THE BRAIN) |
| Wakaf Produktif sectional — tim Fase 4, status program, decisions Wakaf-specific, glossary istilah wakaf, PEOPLE locked 10 Mei | **`Wakaf Produktif/CLAUDE.md`** (parent sectional) |
| Architecture Worker PWA + Firestore + tabs dashboard + Section 23 V2 ref | **`Wakaf Produktif/Digital Platform/CLAUDE.md`** (sibling sub-sectional) |
| **Anything WEBSITE-specific** (deploy, page list, URL routing, asset paths) | **File ini** ⬇ |

**Single-brain rule:** sub-sectional ini TIDAK boleh duplikat identitas Adib, daftar tim, BRIN navigasi, atau prinsip syariah. Itu semua di root + parent sectional.

---

## 🌐 GitHub Repo & Deploy

| Field | Value |
|-------|-------|
| **Repo** | `adib-psych/wakaf-produktif` |
| **Live base URL** | `https://adib-psych.github.io/wakaf-produktif/` |
| **Hosting** | GitHub Pages (branch `main`, root deploy) |
| **CI** | `.github/` (untracked saat ini — pending decision apakah pakai GitHub Actions untuk auto-deploy ENSO state JSON) |
| **Push method** | **Git CLI via osascript workaround** — bash mount kadang gagal unlink `.git/lock`. Pakai `osascript do shell script` dengan native Mac path `/Users/adibasrori/Documents/...` |
| **Test method** | Adib hard-refresh production (Cmd+Shift+R di **Chrome** — wajib, jangan Safari per browser rule root CLAUDE.md) |

### Iterative Refinement Cycle (locked 9 Mei 2026, masih berlaku)
1. Edit file di `/Wakaf Produktif/Website Wakaf Produktif/`
2. Validate JS syntax kalau ubah `<script>` block (`new Function()` paste test)
3. `git add` + `git commit` (conventional commit: `feat(...)`, `fix(...)`, `cleanup`, dll)
4. `git push origin main` via osascript workaround
5. GitHub Pages deploy ~1-2 menit
6. Adib hard-refresh **di Chrome**, report kalau ada drift

---

## 📄 Page Inventory (13 HTML files + subfolders)

### Public-Facing
| File | URL slug | Fungsi |
|------|----------|--------|
| `index.html` | `/` | Landing — hero + program highlights + CTA |
| `program.html` | `/program.html` | Detail program wakaf produktif |
| `belajar.html` | `/belajar.html` | LMS hub — modul belajar agronomi (A-H + O, P, Q) → click ke `belajar/{X}/index.html` |
| `galeri.html` | `/galeri.html` | Foto-foto kebun. **WAJIB include tanggal upload** per memory `galeri-photo-date-mandatory` |
| `kontak.html` | `/kontak.html` | Form kontak + info Wakif |
| `lesson-learned.html` | `/lesson-learned.html` | Lesson learned v4 6-fase (pengelolaan kebun) |
| `methodology-compliance.html` | `/methodology-compliance.html` | Methodology SOP Compliance (publik view) |
| `sintesa-sop.html` | `/sintesa-sop.html` | SOP Synthesis Robusta Ngantang live |
| `notulen-brin-13mei2026.html` | `/notulen-brin-13mei2026.html` | Notulen rapat BRIN 13 Mei 2026 (live page) |
| `living-lab.html` | `/living-lab.html` | **Living Lab publik** — fetch dynamic dari `data/aktivitas-publik.json` |

### Worker PWA & Dashboard
| File | URL pattern | Fungsi |
|------|-------------|--------|
| `lapor.html` | `/lapor.html?w=KUMPUL` atau `?w=YIT` (ANTO inactive per 19 Mei 2026) | **Worker PWA** entry lapangan. Token-based auth, online-first sync ke Firestore |
| `monitor-v2.html` | `/monitor-v2.html` | **Dashboard internal** — 14 tabs, tier akses 3-level (Publik/Internal/Wakif) |

### Testing & Demo
| File / Folder | Catatan |
|---------------|---------|
| `test-lang.html` | Test bilingual class pattern (lang-id/lang-en toggle) |
| `demo/` | Demo sandbox untuk eksperimen UI |
| `scratch/` | Scratch space — JANGAN commit production-critical work disini |

### Subfolder
| Folder | Isi |
|--------|-----|
| `belajar/` | LMS modul: subfolders `A/`, `B/`, `C/`, ..., `H/` plus modul terbaru `O/`, `P/`, `Q/` (pasca-panen primer, locked 21 Mei) — masing-masing punya `index.html` |
| `data/` | JSON data sources: `aktivitas-publik.json` (curated milestones), `laporan.json` (legacy pre-Firestore), `sop_aktivitas_per_bulan.json`, `enso-state.json` |
| `images/` | Asset gambar (hero, logo, dll). Hindari taro foto cherry/kebun yang sensitif disini — gunakan Aset Photos Wakaf untuk internal |
| `digital-platform/` | (catatan: ada folder dengan nama mirip di parent — cek isi sebelum write, jangan confuse) |
| `archive/` | File deprecated yang tidak dihapus (mis. `monitor.html` v1 superseded 17 Mei, `arsitektur-dashboard.html` Mermaid superseded oleh Arsitektur Interaktif v2) |
| `Info Aset Design Website Wakaf/` | Reference design assets (palette, typography, icon set) |
| `node_modules/` | npm packages (tidak boleh masuk git — pastikan `.gitignore` cover) |
| `rib/` | (TBD — cek isi sebelum touch) |

---

## 🎨 Design System (locked)

| Element | Spec |
|---------|------|
| **Palette utama** | Eucalyptus R2 + Cherry (per CLAUDE.md root visual style preference) |
| **Font heading** | Sesuai brand book (cek `Info Aset Design Website Wakaf/`) |
| **Bilingual classes** | `.lang-id` + `.lang-en` di **SEMUA** block elements (`<ul>`, `<ol>`, `<div>`, `<table>`, `<blockquote>` — bukan hanya `<p>`) per memory `bilingual-class-pattern-lms` |
| **Date format** | "DD MMM YYYY" Indonesia (mis. "15 Mei 2026") — per root CLAUDE.md Section 5.4 |

---

## 🔗 Firebase Config (client-side public)

- `firebase-config.js` — API key by-design public (Firebase pattern, real security via Firestore Rules)
- **Project:** `wakaf-ngantang` · **Region:** `asia-southeast2` (Jakarta) · **Plan:** Spark (free tier)
- **⚠️ Deadline 2026-06-15:** Test mode rules expire. Setelah expire, default deny-all → lapor + monitor sync break. Action di Digital Platform sub-sectional Pending section.

---

## 🚦 Browser Rule (kritis untuk Adib)

Per root CLAUDE.md Section 6 (Safari/Chrome split):

| Aksi | Browser |
|------|---------|
| Update GitHub via PAT | **Chrome ATAU Terminal** — PAT di Apple Keychain (sejak 26 Mei 2026), terminal `git push` browser-independent. |
| Test live page `monitor-v2.html` setelah push | **Chrome ATAU Safari** ✅ — post commits a9f867b + 196f1d9 (1-6 Juni 2026): cross-browser onSnapshot listeners aktif untuk 9 collections + auto-retry + window.onfocus rehydrate + L3 Firestore-authoritative dedup. Concern lama "lose 50% kerjaan" RESOLVED. |
| Test live page `lapor.html` (Worker PWA) | **Chrome ATAU Safari** ✅ — online-first sync Pattern #9 (commit e7ec9c2 16 Mei 2026). |
| Test live page `living-lab.html` | **Chrome ATAU Safari** ✅ — read-only, fetch JSON. |
| Saat generate output dengan link production page | Boleh "Open di browser pilihan Adib (Chrome atau Safari)" + URL plain text. **Pengecualian**: Apps Script editor + Firebase Console = **Chrome WAJIB** (session auth). |
| Saat link ke `computer://` local file (preview HTML/PDF/MD lokal) | Safari OK (no auth required) |

**Honest disclosure cross-browser sync history:**
- ❌ Pre-24 Mei 2026: dashboard hanya jalan Chrome (Firestore client init asumsi Chrome session).
- ⚠️ 24 Mei (commit ac7aee4): "Layer 1 Systematic Sync 7 states · 100% Firestore-backed" — claim over-stated. Code-path hanya push + initial-load once, TANPA continuous onSnapshot listener.
- ⚠️ 1 Jun 2026 (commit a9f867b): L1+L2 fix — onSnapshot listeners ke 7 state + auto-retry + window.onfocus rehydrate. Safari Listen stream drop ~1-2 jam interval addressed.
- ✅ 6 Jun 2026 (commit 196f1d9): L3 fix — Firestore-authoritative dedup di `autoCreateUpahFromEntry` (eliminates Pak Kumpul ghost + Cak Yit double-pay race). saveUpah/saveCashbook debounce 500ms (prevent push storm).
- ⏳ Soak test 24-48 jam multi-device Safari + Chrome pending Adib verify.

---

## 📚 Live vs Static Data Map (8 groups — ref Section 20 V2)

Untuk detail teknis Live vs Static mapping, lihat **`Wakaf Produktif/Digital Platform/Arsitektur_Interaktif_v2_19Mei2026_malam.html`** Section 20.

Quick reference:
- **Live (Firestore-backed):** worker submissions (`laporan` collection), distribusi PIC (`distribusi_pic/active`), SOP master (`sop_master/active`)
- **Static (localStorage-only):** UPAH items, CASHBOOK, MILESTONE (sebelum publish), inventarisasi pohon (planned migration TBD)
- **Static (JSON files in `/data/`):** `aktivitas-publik.json` (curated milestones — Wakif Export button), `enso-state.json` (NOAA ONI cache via GitHub Action mingguan)

---

## ⚙️ LMS Modul Structure (belajar/)

8 modul awal (A-H) + 3 modul tambahan (O, P, Q post-21 Mei). Pattern:

```
belajar/
├── A/index.html  — Modul A: ...
├── B/index.html  — Modul B: ...
├── C/index.html  — Modul C: ...
... dst
├── O/index.html  — Petik Selektif Merah (Clinical Triage analogy)
├── P/index.html  — Window 12 Jam (Therapeutic Window)
└── Q/index.html  — Pasca-Panen Primer 4 Fase (+ Section 4.5 Giling Kering vs Basah)
```

Hub: `belajar.html` — 3 card terbaru (O, P, Q) sudah clickable per commit `bbf54ca`.

---

## 🛡️ Anti-Patterns

- ❌ JANGAN test di Safari sebelum Chrome — sync issue Adib pernah kena
- ❌ JANGAN hapus file produksi langsung — pindahkan ke `archive/` dulu, baru hapus setelah 2-4 minggu confirm stable
- ❌ JANGAN commit `node_modules/` ke git
- ❌ JANGAN bikin file dengan nama duplikat di subfolder lain (mis. `digital-platform/` di Website vs `Digital Platform/` di parent) — cek lokasi sebelum write
- ❌ JANGAN auto-update content live (mis. `aktivitas-publik.json`) tanpa Wakif curate via Tab Milestones Publik dulu — itu editorial gate, bukan otomatis
- ❌ JANGAN sebut Mas Anto sebagai aktor aktif di komunikasi publik atau Living Lab (OUT permanen 19 Mei 2026)

---

## 🌿 Living Lab — Rule Konten (Locked 25 Mei 2026)

> **Prinsip inti:** Living Lab HANYA untuk intervensi yang **SUDAH DIJALANKAN**, bukan placeholder/disclaimer untuk fase yang belum aktif.

### Aturan Konten
- ✅ **Push hanya event yang sudah dilakukan** (status `s-done`, `s-ongoing`) — semua jenis: intervensi agronomi, asesmen lapangan, lesson learned, strategi locked
- ❌ **JANGAN auto-add disclaimer** untuk fase yang belum punya event (mis. "Periode ini belum aktif" untuk Awal MH yang belum dimulai). Biarkan phase block ke-hide oleh CSS rule `phase-block:not(:has(.act-log-item:not(.status-planned):not(.status-upcoming))):not(:has(.ll5-card))`
- ❌ **JANGAN bikin item s-norecord placeholder** untuk transparansi "siklus penuh" — Adib lebih prefer fase yang belum aktif TIDAK ditampilkan sama sekali daripada placeholder kosong
- ✅ **Adib push manual** setiap update baru via Claude session — bukan auto-generated content

### Aturan Ordering (Locked 23 Mei 2026)
- **Tahun berjalan (2026)**: phase block + items reverse-chronological — newest at TOP
  - Phase order: Awal MH (Nov-Des) → Post-Panen → Panen → Pre-Panen (oldest at bottom)
  - Items per phase: newest event di top, oldest di bottom
- **Tahun statis (2024, 2025)**: original chronological order (no reverse)

### Aturan Anti-Over-Claim (untuk konten Living Lab publik)
- BRIN = "penjajakan kemitraan" / "penjajakan" — JANGAN "mitra BRIN" / "kerja sama BRIN" sampai MoU/PKS resmi dittd
- Mas Anto, Pak Tosin, RWI, TA RWI = historical (sebelum OUT date) — bukan aktor aktif
- Disclaimer 2025 ringkas (1 kalimat) — bukan naratif panjang
- Honest: tidak meng-glorifikasi periode tanpa data primer

### File Implementation
- HTML: `living-lab.html` — `act-log-item` per event + theoryData/evalData per index
- Status class: `s-done`, `s-ongoing`, `s-planned` (hidden), `s-upcoming` (hidden)
- Reverse phase block: function `reversePhaseBlocksForCurrentYear()` di-call setelah `buildTheoryColumns()`

---

## 📅 Active Git Repos with PAT in Chrome (per root CLAUDE.md)

- ✅ `wakaf-produktif/` (ini)
- `Skema_Yayasan_Bundle/` (separate repo, ada di `/Wakaf Produktif/Skema_Yayasan_Bundle/`)
- `Website Claude/Website ADB/Perjalanan ADB Compressed DEPLOY/` (cross-folder)

---

## 🔄 Versi & Update Trail

- **v1** (pre-23 Mei 2026) — Duplikat sectional Wakaf Produktif (violation single-brain)
- **v2** (23 Mei 2026) — Total rewrite jadi hybrid sub-sectional. Reference balik ke root + parent sectional + sibling Digital Platform. Konten website-specific only (deploy, page inventory, design system, browser rule, LMS structure, anti-patterns)

---

_End of Website Sub-Sectional. Untuk perubahan arsitektural ke monitor-v2/lapor.html, **WAJIB auto-update** Section 23 V2 reference per memory rule `auto-update-arsitektur-v2`._
