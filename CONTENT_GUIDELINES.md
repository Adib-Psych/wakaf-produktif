# Website Wakaf Produktif — Content Guidelines

**Purpose:** Editorial standard + reusable patterns untuk semua copy & visual decisions di public-facing website `adib-psych.github.io/wakaf-produktif/`. Read SEBELUM modifikasi caption, hero text, footer, atau create page baru.

**Last extracted:** 23 Jun 2026 (Pre-archive handover by Website-Curator session)
**Authoring agent / role:** Website-Curator
**Live site:** [adib-psych.github.io/wakaf-produktif/](https://adib-psych.github.io/wakaf-produktif/) (6 public pages: Beranda, Program, Belajar, Living Lab, Galeri, Kontak)

---

## 1. Brand Voice & Tone of Voice

### 1.1 Reframe negative → positive integrity story (LOCKED 18 Mei 2026)

Kata "insiden" punya konotasi negatif (kecelakaan, penyalahgunaan, kematian). **Reframe ke positive/integrity-driven framing.**

| Hindari | Pakai |
|---|---|
| "insiden tanah wakaf" | "**penjagaan asas tanah wakaf**" |
| "Waqf Land Incident" | "**Safeguarding Waqf Principles**" |
| "dokumentasi insiden" | "dokumentasi **momen ini**" |
| "Wakif batalkan setelah deteksi penipuan" | "Wakif memilih **integrity over convenience** — batalkan setelah terdeteksi tidak align dengan asas wakaf" |

**Why:** Story Wakaf Produktif adalah story-of-integrity, bukan story-of-mistake. Konsistensi framing penting untuk donor/mitra/visitor trust.

### 1.2 Tambah motivasi awal kalau ada keputusan yang berubah

Kalau ada cerita "Wakif setuju awalnya, lalu batalkan", **WAJIB tambah konteks kenapa setuju awal**.

> ✅ "Wakif setuju awalnya **karena dipresentasikan untuk kepentingan umat (fasilitas umum)** — sebagian bidang sudah dibersihkan selebar rencana jalan."

**Why:** Tanpa motivasi awal, reader bisa misjudge kompetensi Wakif. Dengan motivasi awal, framing jadi "vigilance yang baik, bukan ketidaktahuan."

### 1.3 No Rupiah nominal di public-facing captions (LOCKED 18 Mei 2026)

**Hindari** disclosure nominal Rupiah spesifik di photo captions / public infografik. **Hapus** "Rp 2,75 jt" / "Rp 3 jt" / dst.

Substantive narrative > specific numbers. Lesson learned tetap kuat tanpa disclose financial figures.

**Exception:** monitor-v2.html, lapor.html, lesson-learned.html — internal/dashboard pages BOLEH disclose untuk transparansi audit.

### 1.4 Anti-over-claim discipline (LOCKED 13 Mei 2026)

| Hindari | Pakai |
|---|---|
| "mitra BRIN" / "kerjasama BRIN ditandatangani" | "**penjajakan BRIN**" / "pertemuan awal" |
| "RWI partner aktif" | (historical only di Living Lab — RWI MoU dibatalkan 1 Mei 2026) |
| "Mas Anto Koordinator Lapangan" (post-19 Mei) | (hapus, atau historical mention dengan label era pre-19 Mei) |
| "Lembaga Nadzir Mawrid sudah berdiri" | "Mawrid dalam pendirian (calon nazhir formal)" |

**Why:** Public-facing copy dipercaya audience. Over-claim = breach of trust. Lesson dari RWI (1 Mei 2026 MoU cancel): substansi locked di klausul, bukan asumsi goodwill.

### 1.5 Cross-reference ke `lesson-learned.html` (LOCKED 18 Mei 2026)

Section yang berisi historical/decision-related content **WAJIB punya "Read More" CTA** ke `lesson-learned.html` (untuk konteks finansial + decision rationale).

- Multi-era sections (mis. Galeri per-kebun) → link ke `lesson-learned.html` general (tanpa anchor)
- Specific era sections → link ke anchor `#f1`, `#f2`, `#f3`, `#f4`

### 1.6 False attribution check

Saat naratifkan capability tim, **JANGAN attribute hal yang Wakif lakukan ke nadzir/lembaga lain**.

Casus: caption Galeri sempat tulis "Era Nadzir 2 = pencatatan terbaik (detail per pekerja/hari)" — itu **salah**, pencatatan detail done by Wakif sendiri, bukan Nadzir 2. Per Adib clarification 18 Mei 2026.

### 1.7 Spesifik per era nadzir, honest accounting

Honest disclosure terhadap multi-fase journey (4 fase nadzir, 1 wakif tetap). Setiap fase punya lessons + scars + accomplishments. Jangan defensive, jangan glorify.

---

## 2. Number Discipline (Editorial)

### 2.1 Konsistensi jumlah pohon lintas halaman (LOCKED 19 Mei 2026)

**Public-facing**: pakai "**~1.000**" (konservatif estimasi rounded).

**Internal/dashboard**: pakai actual specific numbers (1.382 baseline 2023, ~915 observation Mei 2026, ~912 projected, 750 target post-selection).

**Anti-pattern:** JANGAN auto-derive angka publish dari memory. ASK Adib eksplisit dulu sebelum publish angka baru. Casus 19 Mei: infografis Inventarisasi pakai 1.367 yang ternyata salah (real 1.382 per xlsx validated).

### 2.2 Date format

**WAJIB** pakai "DD MMM YYYY" Indonesia format: `15 Mei 2026`, `25 Jan 2025`. Hindari ISO atau US format.

### 2.3 Coordinate / location format

- Lokasi: "Ngantang, Malang, Jawa Timur" (consistent)
- Elevasi: "648 mdpl" (locked per Google Earth + BRIN 13 Mei 2026)
- Luas: "4.918 m²" (4 kebun: K1 617 + K2 2.324 + K3 1.977 + K4 824 = 5.742 m² total, **TAPI Adib pakai 4.918 m² konsisten** — perlu klarifikasi mana yang final canonical untuk public)

---

## 3. Reusable Copy Templates

### 3.1 Hero H1 (1-liner, italic emphasis di "outcome" phrase) — LOCKED 23 Mei 2026

```
ID: "Dari Kebun Wakaf Menjadi *Ekosistem Kopi Berdampak Sosial*"
EN: "From a Waqf Garden to a *Coffee Ecosystem with Social Impact*"
```

Em emphasis = transformation outcome (vision-forward, scalable framing).

### 3.2 Sub-quote Wakaf (locked 13 Mei 2026, validated syariah)

```
ID: "Wakaf bukanlah apa yang diberikan, namun yang terus memberi —
     siapa pun yang merawatnya, berbagi dalam pahalanya.
     Satu mata air, tiga aliran: pendidikan, sosial, pemberdayaan ekonomi."

EN: "Waqf is not what is given, but what keeps giving —
     whoever tends to it shares in the reward.
     One spring, three streams: education, social, economic empowerment."

Attribution: — Adib Asrori, Wakif Kebun Kopi Ngantang · 1 Mei 2026
```

**Pakai di:** semua footer halaman publik (6 pages). Date updated 31 Mar 2026 → 1 Mei 2026 per Fase 6 lock.

### 3.3 Closing-verse Hadis Muslim (LOCKED 19 Mei 2026)

```
ID: "Apabila manusia meninggal dunia, terputuslah amalnya kecuali tiga perkara:
     *sedekah jariyah*, ilmu yang bermanfaat, dan anak saleh yang mendoakannya."
     — HR. Muslim

EN: "When a person dies, their deeds come to an end except for three:
     *ongoing charity*, beneficial knowledge, and a righteous child who prays for them."
     — HR. Muslim
```

**Pakai di:** Kontak page closing section (gold/cream tone). 1 baris pada layar wide (max-width 1600px container).

### 3.4 Hero lead pattern (Lora justified, full width)

CSS template (sudah aktif di belajar/kontak/living-lab/galeri):

```css
.page-hero-lead {
  font-family: 'Lora', serif;
  font-size: 1rem; line-height: 1.8;
  color: rgba(168,200,188,0.8);
  text-align: justify;
  /* NO max-width — fill .page-hero-inner (1600px max) */
}
```

### 3.5 Section description pattern (Galeri, etc)

```css
.section-desc {
  font-family: 'Lora', serif;
  color: var(--muted); font-size: 1rem;
  line-height: 1.8;
  text-align: justify;
}
```

### 3.6 Footer (LOCKED 18 Mei 2026 — simplified)

Tagline-only. NO duplicate navbar nav-links. NO hadis (sebelumnya digabung, sekarang hadis Muslim hanya di Kontak closing). Format: max-width 760px centered, Lora italic, color cream.

### 3.7 CTA copy konsisten

| Page | Sub-hero CTA / lead |
|---|---|
| Beranda | "Kami terbuka untuk riset kolaboratif, kemitraan strategis, relawan, pelatihan, dan berbagai bentuk dukungan lainnya. Mari tumbuh bersama." |
| Belajar | "Lihat data terbuka dari Living Lab kami, atau kenali lebih dalam program wakaf yang menggerakkan semua ini." |
| Galeri | "Dokumentasi visual kondisi kebun, pekerjaan tim lapangan, dan progres budidaya — sebagai bagian dari komitmen transparansi Wakaf Produktif. Setiap kunjungan diabadikan untuk akuntabilitas wakif, mitra, dan komunitas." |
| Kontak | "Tidak ada yang terlalu kecil untuk dimulai bersama. Baik Anda peneliti yang mencari data, jurnalis yang ingin bercerita, atau seseorang yang sekadar ingin tahu lebih banyak — kami di sini." |

---

## 4. Visual Style (Locked)

### 4.1 Palette R2 Eucalyptus

```css
--dark:    #2e4040  /* navbar, hero bg, footer */
--medium:  #5a9080  /* links, button hover */
--light:   #a8c8bc  /* body text on dark */
--accent:  #c4906a  /* DEFAULT terracotta — CTA, border accent */
--cream:   #e8d5b8  /* SCOPED override di .hero (dark BG) — also closing-verse gold */
--bg:      #f0f5f3  /* body bg light section */
--bg-tint: #e8f4f0
--bg-deep: #d8eeea
--white:   #ffffff
--text:    #1e3030
--muted:   #5a7878
```

**Scoped override pattern:** `.hero { --accent: #e8d5b8; }` — cream khusus di dark hero BG, sisanya tetap terracotta. JANGAN ganti `:root --accent` global (sebelumnya dicoba, terlalu pucat di white BG sections).

### 4.2 Typography stack

| Family | Use |
|---|---|
| **Plus Jakarta Sans** | Body, navbar, buttons (sans-serif default) |
| **Playfair Display** | H1, H2, closing-verse (serif italic emphasis) |
| **Lora** | Page-hero-lead, section-desc, footer tagline (serif italic body) |
| **Caveat / Cormorant Garamond** | Signature lines, signatures (handwriting / display italic) |

### 4.3 Layout principles

- `.page-hero-inner { max-width: 1600px; margin: 0 auto; }` — canonical content width
- Hero padding: `3.5rem 2rem 3rem` (slightly tight per 23 Mei iteration)
- Grid `1.15fr 0.85fr`, `align-items: center` (hero 2-col untuk Beranda)
- Hero lead: NO max-width restriction → fill column
- Card pattern: `.card-df` (light) + `.card-df-dark` (hero) — border accent + box-shadow 4px offset
- Hover: translate -2px + box-shadow 6px (subtle lift)

### 4.4 Component patterns

- **`.rwi-nav-badge`** (legacy class name, sekarang dipakai untuk WAKIF badge di navbar) — gradient + accent border + box-shadow + clickable (lang-id → home.html?lang=id, lang-en → home.html?lang=en, target=_blank)
- **`.brand-tag`** (logo nav slot di kiri) — replaced dengan img logo-wakaf-produktif-3x1-bg.png 144×48
- **`.hero-image img`** — max-width 220px, border-radius 14px, soft drop shadow
- **`.section-read-more`** (Read More CTA) — dark BG, cream text, accent border + shadow 2px, hover translate -1px

### 4.5 Galeri date badge (LOCKED 18 Mei 2026)

WAJIB: setiap foto baru upload ke galeri.html harus include tanggal pengambilan.

- Position: top-right (was bottom-right, moved 18 Mei karena overlap caption)
- Format: `📅 17 Mei 2026` (DD Bulan YYYY Indonesia)
- Data-driven 3 layer: `EDITION_DATE` global → `sec.date` per section → `p.date` per foto

### 4.6 Galeri map hero rule

Map Kebun Wakaf di-render `object-fit: contain` di hero standalone — **JANGAN crop garis putus-putus 4 bidang**. Per Adib feedback 18 Mei 2026.

---

## 5. Cross-Page Consistency Audit (sebagai checklist)

Saat update content/CSS, cek konsistensi di:

| Layer | What to check |
|---|---|
| **Navbar items** | 6 halaman publik harus sama (Beranda · Program · Belajar · Living Lab · Galeri · Kontak · Bergabung). Active state per halaman |
| **Footer** | Identical tagline-only across 6 pages |
| **Hero H1 wording** | Match locked taglines |
| **Hero lead style** | Lora + justify + no max-width (semua page-hero-lead/cta-lead/section-desc) |
| **Tree count** | Public: "~1.000". Internal: actual |
| **People** | Mas Anto OUT permanent post-19 Mei. RWI historical only. BRIN penjajakan. |
| **Date format** | DD Bulan YYYY (mis. "17 Mei 2026") |
| **Lang switching** | setLang() patches anchor href auto via `?lang=` query param (internal links only, external skipped) |

---

## 6. SEO / Keyword Strategy

**Status:** ❌ **Belum di-address eksplisit dalam session ini.**

**Implicit keywords yang sudah ada di copy:**
- "Wakaf Produktif Kebun Kopi Ngantang" (brand exact match)
- "Robusta", "Kebun Wakaf"
- "Sedekah jariyah", "Wakaf khairi", "Mauquf alaih"
- "Living Lab", "BRIN" (penjajakan)
- "Bonsari Coffee", "Nomad Coffee" (offtaker)
- "Ngantang Malang Jawa Timur 648 mdpl"

**Pending TODO untuk future Web Curator:**
- Define primary keywords per page
- Add `<meta name="description">` audit per halaman (sudah ada, perlu polish)
- OG tags untuk social sharing (galeri foto = high-shareability candidate)
- Schema.org structured data (Organization, Place, Article)
- Sitemap.xml + robots.txt

---

## 7. Content Calendar / Posting Cadence

**Status:** ⚠️ **Belum formal, hanya implicit pattern.**

**Implicit cadence dari pattern existing:**

| Content Type | Cadence | Trigger |
|---|---|---|
| Galeri foto kunjungan | Per kunjungan lapangan (irregular, ad-hoc) | Adib upload batch → trigger conversion + caption + publish |
| Notulen rapat | Per rapat penting | Mis. `notulen-brin-13mei2026.html` |
| SOP/Living Lab updates | Per milestone agronomi | Mis. dose recovery, hadis methodology |
| Lesson Learned | Quarterly review (TBD) | Per fase transition (4 fase nadzir track) |
| Edition baseline (Galeri) | Append historikal per batch upload | Adib siapkan + naming convention `subject - kondisi YEAR.HEIC` |

**Pending TODO:**
- Formalize publishing checklist per content type
- Editorial calendar 3 bulan ke depan (Jun-Aug 2026)
- BRIN PKS announcement window (TBD timing)

---

## 8. Performance Metrics / Engagement

**Status:** ❌ **Tidak ada analytics integrated.**

**Pending TODO:**
- Add Google Analytics 4 atau Plausible (privacy-first)
- Track event: galeri lightbox open, edition pill click, language toggle, external link (myjourney, lesson-learned)
- Baseline metrics dulu (3-bulan window), lalu set KPI

---

## 9. Pending Content Drafts / Polish Opportunities

| Item | Status | Priority |
|---|---|---|
| Caption Pohon Kopi #1–#10 (Latest 17 Mei edition) | Generic placeholder ("Detail percabangan", "Variasi karakteristik") — bisa di-polish dengan konteks observasi spesifik per pohon | P2 |
| Caption Cherry #4–#18 | Similar generic | P2 |
| Section "Cross-Kebun & Misc" untuk Cherry Aug 2024 + Jalan Setapak Dec 2023 | Sudah masuk ke K1 + K2 group respective (decision 18 Mei). Stable. | — |
| Baseline foto belum ada: 2025, 2022 | TBD upload Adib | P3 |
| BRIN PKS announcement page | Pending MoU resmi (BRIN status: penjajakan) | P1 saat MoU |
| Yayasan Mawrid announcement | Pending pendirian formal (calon nazhir) | P1 saat akta |
| Donor appeal copy template | Not yet drafted | P2 |
| About page (replacing archived `latar-belakang.html`) | Currently navbar nav-item "Kisah" removed (slot kosong, "kita isi dengan konsep lain"). Adib pernah mention possibility: Wakif profile, Roadmap, Donasi, Lapor, Galeri (sudah pakai Galeri), Berita | P2 |

---

## 10. Anti-Patterns (Don't Do These)

1. ❌ **Auto-derive angka publik dari memory** — wajib confirm dengan Adib dulu (casus 1.367 vs 1.382)
2. ❌ **Duplicate navbar di footer** — footer sekarang tagline-only
3. ❌ **`max-width` restriction inconsistent** lintas hero-lead/section-desc — semua harus fill page-hero-inner 1600px
4. ❌ **Sebut mitra penjajakan sebagai "mitra aktif"** — BRIN, CV Dorya = penjajakan only
5. ❌ **Reframe "insiden" jadi konotasi negatif** — gunakan "penjagaan asas"
6. ❌ **Disclose Rp nominal di public foto captions**
7. ❌ **Pakai 1.100 atau ~915 di public** (sekarang ~1.000 konservatif)
8. ❌ **Pakai "Mas Anto" sebagai mitra aktif** — OUT permanent 19 Mei 2026
9. ❌ **Crop dashed lines Map Kebun Wakaf** — `object-fit: contain` wajib
10. ❌ **Bikin file baru di folder `Memory/`** — folder deprecated per migrasi 23 Mei 2026
11. ❌ **Skip date badge saat upload foto baru ke galeri** — WAJIB per audit trail rule
12. ❌ **Set `:root --accent` global ke cream** — terlalu pucat di white BG. Pakai `.hero` scoped override saja
13. ❌ **Test di Safari sebelum Chrome (untuk GitHub PAT operations)** — Chrome WAJIB

---

## 11. Reference Files & Cross-Links

### Live Site
- Beranda: [adib-psych.github.io/wakaf-produktif/](https://adib-psych.github.io/wakaf-produktif/)
- 6 halaman public: index, program, belajar, living-lab, galeri, kontak
- 1 halaman special: `notulen-brin-13mei2026.html` (live notulen 13 Mei)
- Archived: `archive/latar-belakang.html` (was "Kisah", redirect → myjourney)
- Internal docs: `digital-platform/arsitektur-dashboard.html`, `monitor-v2.html`, `sintesa-sop.html`, `methodology-compliance.html`, `lesson-learned.html`

### Repo
- GitHub: `adib-psych/wakaf-produktif` (PAT in Chrome)
- Deploy: GitHub Pages, branch `main`, root
- Workflow: edit local → git commit (osascript with native macOS path workaround) → git push → ~30-60s deploy

### Sister Site (External)
- myjourney: `adib-psych.github.io/myjourney/home.html` — Adib personal journey site
- Supports `?lang=en` / `?lang=id` URL parameter (patched 16 Mei 2026 via Compressed DEPLOY repo)

### Key Memory Files (for context)
- `feedback_galeri_photo_date_mandatory.md` — date badge wajib + multi-edition workflow
- `project_galeri_baseline_context.md` — narrative per folder historikal (Dec 2023, Feb 2024, Jul 2023, dll)
- `project_estimasi_pohon_konservatif_1000.md` — ~1.000 logic
- `feedback_confirm_numbers_before_publish.md` — anti-pattern auto-derive
- `feedback_pisahkan_instruksi_dari_content.md` — JANGAN campur instruksi dgn content list
- `project_wakaf_produktif_tagline_kop_surat.md` — tagline 1 Mei 2026 lock

### Sectional Manual
- Parent: `~/Documents/Claude/Wakaf Produktif/CLAUDE.md`
- Sub-sectional: `~/Documents/Claude/Wakaf Produktif/Website Wakaf Produktif/CLAUDE.md` (operational manual untuk website)

---

## 12. Editorial Decision Log (Session 18-23 Mei 2026 — Pre-Archive Summary)

Significant copy/visual decisions yang baru di-lock di session ini (yang belum tertulis di memory granular):

| Date | Decision | Why |
|---|---|---|
| 18 Mei | Galeri date badge **TOP-RIGHT** (was bottom-right) | Overlap dengan caption text bawah |
| 18 Mei | Map Kebun Wakaf `object-fit: contain` di hero | Garis putus-putus 4 bidang TIDAK BOLEH terpotong |
| 18 Mei | Baseline foto **per-kebun grouping** (4 group K1-K4) | Less fragmented vs per-edition (10 sections) |
| 19 Mei | Tree count public = **~1.000** konservatif | Konsistensi cross-page, anti auto-derive |
| 19 Mei | Closing-verse di Kontak: **Hadis Muslim sedekah jariyah** (was Al-An'am khalifah) | Theme-aligned ke wakaf (3 pilar: jariyah/ilmu/anak saleh) |
| 23 Mei | Footer SIMPLIFY: tagline-only di 6 halaman | Sebelumnya gold standard 3-block terlalu panjang per Adib |
| 23 Mei | Hero H1 baru: **"Dari Kebun Wakaf Menjadi Ekosistem Kopi Berdampak Sosial"** (1-liner) | Vision-forward framing, scalable narrative |
| 23 Mei | Hero index proporsi tightened (padding, gap, image 220px, align-items center) | Reduce empty space |
| 23 Mei | Closing-inner Kontak max-width 1600px | Fit hadis 1 baris pada layar wide |
| 23 Mei | `.page-hero-lead` no max-width restriction (was 900px di belajar+kontak) | Konsistensi visual fill content area |
| 23 Mei | Filter pills Galeri = per-kebun (4 group) bukan per-edition (6) | Story per area > story per kunjungan |
| 23 Mei | Verse khalifah Al-An'am 6:165 — historical try (rolled back) | Adib prefer hadis sedekah jariyah |

---

*End of Content Guidelines. Living document — append updates dengan tanggal lock.*
