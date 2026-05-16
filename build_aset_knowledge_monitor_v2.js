// Build Aset Knowledge — Monitoring Tools V2 (.docx)
// Output: /Knowledge Wakaf/Aset_Knowledge_Monitor_V2_9Mei2026.docx

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, TabStopType, TabStopPosition,
  HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak, ExternalHyperlink, Header, Footer
} = require('docx');

// ===== PALETTE (Eucalyptus R2 + Cherry — match dashboard) =====
const C = {
  earth: '2E4040',
  moss: '5A9080',
  sage: 'A8C8BC',
  sand: 'E8DEC8',
  cherry: 'C14B3A',
  cream: 'F5F0E6',
  gold: 'D4AF37',
  darkGreen: '1F5F47',
  mute: '8B8579',
  cherryLt: 'FDE2DC',
  greenLt: 'DDE9E3',
  goldLt: 'FFF4D6',
  bgLt: 'FAFBFA'
};

// ===== HELPERS =====
const border1 = { style: BorderStyle.SINGLE, size: 6, color: 'D4D4D4' };
const cellBorder = { top: border1, bottom: border1, left: border1, right: border1 };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before || 80, after: opts.after || 80 },
    alignment: opts.align,
    children: [new TextRun({
      text, bold: opts.bold, italics: opts.italics, color: opts.color, size: opts.size, font: 'Calibri'
    })]
  });
}

function pmix(runs, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before || 80, after: opts.after || 80 },
    alignment: opts.align,
    children: runs.map(r => typeof r === 'string'
      ? new TextRun({ text: r, font: 'Calibri', size: r.size || 22 })
      : new TextRun({ font: 'Calibri', ...r }))
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    pageBreakBefore: false,
    children: [new TextRun({ text, bold: true, color: C.darkGreen, size: 36, font: 'Calibri' })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, color: C.earth, size: 28, font: 'Calibri' })]
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, color: C.moss, size: 24, font: 'Calibri' })]
  });
}

function bulletItem(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: 'Calibri', size: 22 })]
  });
}

function bulletItemRich(runs) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: runs.map(r => typeof r === 'string'
      ? new TextRun({ text: r, font: 'Calibri', size: 22 })
      : new TextRun({ font: 'Calibri', size: 22, ...r }))
  });
}

function numItem(text) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: 'Calibri', size: 22 })]
  });
}

function spacer(size = 100) {
  return new Paragraph({
    spacing: { before: size, after: size },
    children: [new TextRun({ text: '' })]
  });
}

function divider(color = 'D4D4D4') {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 } },
    children: [new TextRun({ text: '' })]
  });
}

// Callout box (bordered table 1×1 with shading)
function callout(title, text, bg = C.greenLt, accent = C.darkGreen) {
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [9026],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 9026, type: WidthType.DXA },
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 200, right: 200 },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 24, color: accent },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: accent },
          left: { style: BorderStyle.SINGLE, size: 6, color: accent },
          right: { style: BorderStyle.SINGLE, size: 6, color: accent }
        },
        children: [
          new Paragraph({
            spacing: { before: 0, after: 80 },
            children: [new TextRun({ text: title, bold: true, color: accent, size: 24, font: 'Calibri' })]
          }),
          new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [new TextRun({ text, color: C.earth, size: 22, font: 'Calibri' })]
          })
        ]
      })]
    })]
  });
}

// Build a styled data table
function dataTable(rows, colWidths, opts = {}) {
  const headerFill = opts.headerFill || C.darkGreen;
  const headerColor = opts.headerColor || 'FFFFFF';
  return new Table({
    width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map((row, ri) => new TableRow({
      tableHeader: ri === 0,
      children: row.map((cellTxt, ci) => {
        const isHead = ri === 0;
        const isAlt = ri > 0 && ri % 2 === 0;
        return new TableCell({
          width: { size: colWidths[ci], type: WidthType.DXA },
          shading: { fill: isHead ? headerFill : (isAlt ? C.bgLt : 'FFFFFF'), type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 140, right: 140 },
          borders: cellBorder,
          children: [new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [new TextRun({
              text: cellTxt,
              bold: isHead,
              color: isHead ? headerColor : C.earth,
              size: 20, font: 'Calibri'
            })]
          })]
        });
      })
    }))
  });
}

// Section header banner (like "1. Executive Summary" with colored background bar)
function sectionBanner(num, title, color = C.darkGreen) {
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [800, 8226],
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 800, type: WidthType.DXA },
          shading: { fill: color, type: ShadingType.CLEAR },
          margins: { top: 200, bottom: 200, left: 0, right: 0 },
          borders: noBorders,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [new TextRun({ text: num, bold: true, color: 'FFFFFF', size: 36, font: 'Calibri' })]
          })]
        }),
        new TableCell({
          width: { size: 8226, type: WidthType.DXA },
          shading: { fill: C.cream, type: ShadingType.CLEAR },
          margins: { top: 200, bottom: 200, left: 240, right: 200 },
          borders: noBorders,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            spacing: { before: 0, after: 0 },
            children: [new TextRun({ text: title, bold: true, color: C.earth, size: 30, font: 'Calibri' })]
          })]
        })
      ]
    })]
  });
}

// ============================================================
// CONTENT
// ============================================================

const children = [];

// ---------- COVER ----------
children.push(new Paragraph({
  spacing: { before: 600, after: 240 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '🌱 ASET KNOWLEDGE', bold: true, color: C.moss, size: 28, font: 'Calibri' })]
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 200 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'MONITORING TOOLS V2', bold: true, color: C.darkGreen, size: 56, font: 'Calibri' })]
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 400 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'monitor-v2.html · Dashboard Internal SOP-Compliant', color: C.earth, size: 26, font: 'Calibri' })]
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 600 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Wakaf Produktif Kebun Kopi Ngantang', italics: true, color: C.mute, size: 22, font: 'Calibri' })]
}));

// Cover info table
children.push(new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: [3000, 6026],
  rows: [
    ['📅 Tanggal Snapshot', '9 Mei 2026 (Sab) — pasca-iterasi 4 commit'],
    ['👤 Wakif / Owner', 'Adib Asrori, M.Psi'],
    ['🏛️ Repo GitHub', 'adib-psych/wakaf-produktif'],
    ['🌐 Live URL', 'adib-psych.github.io/wakaf-produktif/monitor-v2.html'],
    ['🎨 Palette', 'Eucalyptus R2 + Cherry (earth/moss/sage/cherry/gold)'],
    ['📦 Tech Stack', 'Vanilla HTML+JS, single-file, ~250KB, ~3,800 lines'],
    ['🗂️ Storage', 'localStorage (data) + IndexedDB (binary photo/nota)'],
    ['🔐 Tier Akses', '3-level — Publik · Internal · Wakif']
  ].map((row, i) => new TableRow({
    children: row.map((cellTxt, ci) => new TableCell({
      width: { size: ci === 0 ? 3000 : 6026, type: WidthType.DXA },
      shading: { fill: i % 2 === 0 ? C.greenLt : C.cream, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 180, right: 180 },
      borders: cellBorder,
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({
          text: cellTxt,
          bold: ci === 0,
          color: ci === 0 ? C.darkGreen : C.earth,
          size: 22, font: 'Calibri'
        })]
      })]
    }))
  }))
}));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ---------- TOC ----------
children.push(h1('📑 Daftar Isi'));
const toc = [
  ['1', 'Executive Summary — Apa, Kenapa, Untuk Siapa', '3'],
  ['2', 'Tech Stack & Architecture Overview', '4'],
  ['3', 'Tier Akses 3-Level (Publik, Internal, Wakif)', '5'],
  ['4', '10 Tabs Breakdown — Fungsi per Tab', '6'],
  ['5', 'Features Final Status — Build Complete', '9'],
  ['6', 'Recent Iterations — Trial & Perbaikan 9 Mei 2026', '11'],
  ['7', '7 Architectural Patterns Locked', '14'],
  ['8', 'Lessons Learned & Challenges', '16'],
  ['9', 'Pending Items / Future Roadmap', '18'],
  ['10', 'Reference Links & Related Assets', '19']
];
children.push(dataTable([['#', 'Bab', 'Halaman'], ...toc], [800, 7426, 800], { headerFill: C.moss }));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 1. EXECUTIVE SUMMARY
// ============================================================
children.push(sectionBanner('1', 'Executive Summary', C.darkGreen));
children.push(spacer(120));

children.push(h2('Apa itu Monitor-V2?'));
children.push(p('Monitor-V2 (file: monitor-v2.html) adalah dashboard internal single-file untuk monitoring operasional Wakaf Produktif Kebun Kopi Ngantang — proyek wakaf 4.918 m² dengan ~915 pohon Robusta yang dikelola dengan SOP Robusta Edisi 2 (Kementan + Puslit Koka 2019) dan injeksi BRIN dosis pupuk per umur tanaman.'));
children.push(p('Dashboard ini dibangun sebagai aset publik yang transparan untuk donatur & komunitas, sekaligus alat operasional harian untuk tim lapangan (Mas Anto, Cak Yit, Pak Kumpul) dan Wakif (Adib).'));

children.push(h2('Kenapa Monitor-V2 Penting?'));
children.push(callout('🔍 Filosofi Inti',
  'Transparansi keuangan + akuntabilitas SOP adalah komitmen utama dari konsep wakaf produktif. Monitor-V2 menerjemahkan filosofi ini ke tools praktis yang dipakai harian — bukan dokumen statis di rak.',
  C.greenLt, C.darkGreen));
children.push(spacer(80));
children.push(bulletItem('Tim lapangan punya tools input laporan harian yang terstruktur (form, voice note, photo)'));
children.push(bulletItem('Wakif punya dashboard real-time untuk track compliance SOP, finansial, distribusi tugas'));
children.push(bulletItem('Donatur & publik bisa lihat progress tanpa harus minta laporan — built-in transparency'));
children.push(bulletItem('Konsultan eksternal (Ratna, Sasmito, Tosin) bisa review remote tanpa harus on-site'));

children.push(h2('Untuk Siapa?'));
children.push(dataTable([
  ['Tier', 'User', 'Akses'],
  ['🔓 Publik', 'Donatur, komunitas, calon mitra', 'View-only — Dashboard, Log, KPI publik'],
  ['🔑 Internal', 'Mas Anto, Cak Yit, Pak Kumpul, konsultan', 'Form Input, status SOP, distribusi tugas'],
  ['👑 Wakif', 'Adib Asrori', 'Full akses — RAB, Cashbook, edit semua, export, sweep']
], [1500, 3500, 4026]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 2. TECH STACK
// ============================================================
children.push(sectionBanner('2', 'Tech Stack & Architecture Overview', C.darkGreen));
children.push(spacer(120));

children.push(h2('Filosofi Teknis'));
children.push(p('Monitor-V2 sengaja dibuat single-file HTML tanpa framework JS modern (React/Vue/Svelte) — alasan teknis dan strategis:'));
children.push(bulletItemRich([{ text: 'Self-contained', bold: true }, ' — bisa di-host di GitHub Pages tanpa build step, tanpa server backend, tanpa database eksternal']));
children.push(bulletItemRich([{ text: 'Zero downtime', bold: true }, ' — file diakses langsung, tidak ada API yang bisa down, tidak ada server yang bisa crash']));
children.push(bulletItemRich([{ text: 'Survivability', bold: true }, ' — kalau Adib menonaktif, file ini tetap bisa di-fork siapa saja yang melanjutkan amanah wakaf']));
children.push(bulletItemRich([{ text: 'Iterative refinement', bold: true }, ' — edit → push → live <2 menit, tidak perlu deploy pipeline kompleks']));
children.push(bulletItemRich([{ text: 'Privacy-friendly', bold: true }, ' — semua data sensitif (RAB, Cashbook) tersimpan di localStorage browser Wakif, tidak di-upload ke cloud']));

children.push(h2('Komponen Teknis'));
children.push(dataTable([
  ['Komponen', 'Fungsi', 'Catatan'],
  ['HTML/CSS/JS', 'Single-file ~250KB ~3,800 lines', 'Vanilla, no framework'],
  ['localStorage', 'STATE.laporan, UPAH_ITEMS, CASHBOOK, SOP_STATUS, RAB', 'Schema versioned (v3.x) auto-clear on bump'],
  ['IndexedDB', 'Binary blob — foto kerja, nota pembayaran', 'Async, tidak block UI'],
  ['Web Speech API', 'Voice transcription (lang=id-ID) di Form Input', 'Browser-native, no API key'],
  ['Chart rendering', 'Bar chart, line chart inline SVG', 'No external chart lib (lighter)'],
  ['GitHub Pages', 'Hosting deploy via push ke main branch', 'Auto-deploy <2 menit pasca-push']
], [2000, 4026, 3000]));

children.push(h2('Schema Versioning untuk localStorage'));
children.push(p('Setiap struktur data utama punya version constant. Kalau struktur berubah (breaking), bump version → otomatis clear data lama supaya tidak corrupt:'));
children.push(dataTable([
  ['Variable', 'Current', 'Storage Key'],
  ['UPAH_SCHEMA_VERSION', "'3.0'", 'wkkn_v2_upah'],
  ['CASHBOOK_SCHEMA_VERSION', "'1.1'", 'wkkn_v2_cashbook'],
  ['SOP_STATUS_VERSION', "'1.1'", 'wkkn_v2_sop_status']
], [3500, 1500, 4026]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 3. TIER AKSES 3-LEVEL
// ============================================================
children.push(sectionBanner('3', 'Tier Akses 3-Level', C.darkGreen));
children.push(spacer(120));

children.push(p('Monitor-V2 dirancang dengan tier akses progresif — informasi sensitif (finansial, identitas) hanya muncul kalau user login dengan tier yang sesuai.'));

children.push(h2('Tier 1 — Publik (Default, no login)'));
children.push(callout('🔓 Akses Publik',
  'Setiap orang yang buka URL tanpa login langsung masuk tier publik. Tidak ada barrier — sesuai filosofi transparansi wakaf.',
  C.greenLt, C.moss));
children.push(spacer(60));
children.push(bulletItem('Dashboard utama: KPI publik (total laporan 30 hari, area aktif, status compliance %)'));
children.push(bulletItem('Log Harian: aktivitas tim lapangan (sanitized — tanpa detail finansial)'));
children.push(bulletItem('Tab SOP Compliance: progress per kategori (tanpa nama pelapor specific)'));
children.push(bulletItem('Tab SOP Kalender: kalender fenologi 12 bulan dengan dosis pupuk publik'));

children.push(h2('Tier 2 — Internal (login: kode internal)'));
children.push(callout('🔑 Akses Internal',
  'Untuk tim lapangan & konsultan. Tambahan akses input data + view detail operasional, tapi tidak bisa lihat anggaran atau edit master data.',
  C.goldLt, C.gold));
children.push(spacer(60));
children.push(bulletItem('Tab Form Input — submit laporan harian (otomatis populate ke Log + UPAH)'));
children.push(bulletItem('Tab Distribusi Tugas — siapa kerja apa, kapan'));
children.push(bulletItem('Tab Inventarisasi — data pohon, bidang, kondisi'));
children.push(bulletItem('Tab Pra-Panen — checklist pra-panen tahunan'));
children.push(bulletItem('Tab OPT — log monitoring OPT mingguan (5-pohon-diagonal)'));

children.push(h2('Tier 3 — Wakif (login: kode wakif)'));
children.push(callout('👑 Akses Wakif',
  'Hanya untuk Adib. Full akses ke data finansial, RAB, Cashbook, edit master, export data, dan tools admin (recover, sweep, reset).',
  C.cherryLt, C.cherry));
children.push(spacer(60));
children.push(bulletItem('Tab Anggaran (RAB) — alokasi siklus 2026 + 2027, breakdown per kategori, bar chart'));
children.push(bulletItem('Tab Laporan Keuangan — Cashbook (kas wakif langsung) + Petty Cash Anto'));
children.push(bulletItem('Tab Upah Pekerja — semua entry pembayaran, mark lunas, recover entry lama'));
children.push(bulletItem('Tools admin: Reset Status SOP, Sweep, Export ZIP nota, Form Input Wakif-only'));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 4. 10 TABS BREAKDOWN
// ============================================================
children.push(sectionBanner('4', '10 Tabs Breakdown — Fungsi per Tab', C.darkGreen));
children.push(spacer(120));

const tabs = [
  ['🏠 Dashboard', 'Wakif & Internal', 'KPI cards (laporan 30hr, compliance %, burn rate dinamis dari Cashbook), grafik aktivitas timeline 30 hari, OPT heatmap, alerts compliance terkini'],
  ['📒 Log Harian', 'Semua tier', 'Tabel laporan harian dari STATE.laporan: tanggal (Sab, 9 Mei 2026), pelapor, bidang, kategori, pohon, detail. Filter & sort live. Format CSV export.'],
  ['📝 Form Input', 'Internal & Wakif', 'Submit laporan harian. Field: tanggal (preview hari live), pelapor, bidang, kategori (22+ items), pohon, durasi (½ hr/full day/panjat), cuaca, rainfall 24h+7d, catatan, voice note (Web Speech), upload foto. Auto-link ke UPAH (Yit/Kumpul) + auto-trigger climate alerts.'],
  ['💰 Anggaran (RAB)', 'Wakif only', 'RAB Final 9 Mei 2026 — Siklus 2026 Rp 27,055 jt + Siklus 2027 Rp 44,235 jt. Breakdown 9 kategori expandable: Pupuk, Pestisida, Alat, Pekerja, Borongan, Pengolahan Tanah, Mutu, Sertifikasi, Operasional. Bar chart distribusi.'],
  ['💵 Laporan Keuangan', 'Wakif only', 'Cashbook (transaksi kas wakif langsung) + Petty Cash Anto (uang muka koordinator). Auto-link dari UPAH lunas → Cashbook. Form input transaksi manual + IndexedDB photo nota.'],
  ['🌳 Inventarisasi', 'Internal & Wakif', 'Data pohon: 4 bidang (1 atas, 2 atas, 3 bawah+jahe, 4 Rumah Wakif), ~915 phn aktual, target 750 ideal post-selection. Status per pohon, sambung pucuk Robusta klon unggul.'],
  ['🌾 Pra-Panen', 'Internal & Wakif', 'Checklist pra-panen tahunan: kondisi pohon, target SNI mutu (Mutu 3 → 2 → 1 bertahap), kesiapan pulper/penjemuran. Ready untuk Q3 2026 (Jul-Sep).'],
  ['👥 Distribusi Tugas', 'Internal & Wakif', 'Siapa kerja apa, kapan. Auto-create dari Form Input. Filter per pekerja (Cak Yit/Pak Kumpul/Mas Anto), per bidang, per kategori.'],
  ['🐛 OPT (Hama Penyakit)', 'Internal & Wakif', 'Log monitoring OPT mingguan: PBKo, Cercospora, jamur akar Rigidoporus. Heatmap visual. Brocap pilot Bidang 4 (Mei 2026), full deploy 50 unit Nov-Des 2026.'],
  ['✅ SOP Compliance', 'Semua tier', 'Real-time tracking status SOP per bulan. Anchor Mei 2026 (pre-project filter Jan-Apr = N/A). Action Items 4-tier: Deviations, Fokus Bulan Ini, Overdue, Heads-up Bulan Depan.'],
  ['📅 SOP Kalender', 'Semua tier', 'Kalender fenologi 12 bulan dengan SOP_AKTIVITAS_PER_BULAN. Auto-shift bulan berjalan. Detail per item: prio, siapa, dosis BRIN-corrected, lokal adjust notes Ngantang.']
];

children.push(dataTable(
  [['Tab', 'Tier', 'Fungsi Detail'], ...tabs],
  [1800, 1800, 5426]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 5. FEATURES FINAL STATUS
// ============================================================
children.push(sectionBanner('5', 'Features Final Status — Build Complete', C.darkGreen));
children.push(spacer(120));

children.push(p('Berikut features yang sudah finalized & live (per 9 Mei 2026):'));

children.push(h2('🎯 Core Features (sudah final & stable)'));
const coreFeatures = [
  ['Sidebar Navigation', '10 tabs dengan icon, active state, responsive', '✅ Final'],
  ['Tier Akses Login', '3-level dengan kode unik per tier, persist localStorage', '✅ Final'],
  ['Form Input 22 Kategori', 'Pemupukan, pemangkasan, sanitasi, OPT, panen, dst dengan sub-form per kategori', '✅ Final'],
  ['Voice Note Transcription', 'Web Speech API lang=id-ID, output text auto-fill ke catatan', '✅ Final'],
  ['Photo Upload IndexedDB', 'Compress + thumbnail + simpan binary di IDB (no localStorage bloat)', '✅ Final'],
  ['Climate Alert Engine', 'Auto-detect rainfall 24h/7d trigger SOP deviation (mis. spray Cercospora skip kalau hujan deras)', '✅ Final'],
  ['Schema v2 Multi-Pelapor', 'laporan.json schema YIT/KUMPUL/ANTO dengan field SOP-compliant', '✅ Final'],
  ['Compliance Anchor Project', 'SOP_PROJECT_START Mei 2026, pre-project filtered N/A, auto-roll', '✅ Final 9 Mei'],
  ['Action Items 4-Tier', 'Deviations → Fokus Bulan Ini → Overdue → Heads-up Bulan Depan', '✅ Final 9 Mei'],
  ['Date Format dgn HARI', 'Sab/Sen/Sel prefix di semua tanggal, full hari di Form preview', '✅ Final 9 Mei']
];
children.push(dataTable([['Feature', 'Detail', 'Status'], ...coreFeatures], [2500, 5026, 1500]));

children.push(h2('💼 Finansial Features'));
const finFeatures = [
  ['RAB Tab', 'Strip + bar chart 9 kategori expandable, siklus 2026 + 2027 separate', '✅ Final'],
  ['Cashbook', 'Form input + tabel + filter + export CSV', '✅ Final'],
  ['Petty Cash Anto', 'Top-up + spending tracker + reconciliation', '✅ Final'],
  ['UPAH Auto-Link Form', 'submitForm → auto-create UPAH entry (Yit/Kumpul, skip Anto)', '✅ Final 9 Mei'],
  ['UPAH Auto-Link Cashbook', 'Mark lunas → auto-create cashbook entry (kas wakif/via Anto)', '✅ Final'],
  ['Recover Entry Lama Modal', 'Backfill UPAH dari laporan lama dengan picker durasi per row', '✅ Final 9 Mei'],
  ['IndexedDB Nota Storage', 'Upload bukti bayar saat mark lunas, simpan thumbnail di IDB', '✅ Final'],
  ['Export ZIP Nota', 'Bulk download semua nota sebagai ZIP backup', '✅ Final']
];
children.push(dataTable([['Feature', 'Detail', 'Status'], ...finFeatures], [2500, 5026, 1500]));

children.push(h2('🌾 SOP & Operasional Features'));
const sopFeatures = [
  ['SOP Kalender 12 Bulan', 'Per-bulan: fase fenologi, ~5 aktivitas dgn prio (wajib/rutin/rekomendasi/larangan)', '✅ Final'],
  ['Dosis BRIN per Pohon', 'Tabel BRIN umur 5-10 thn × pohon aktual = total kg per item pemupukan', '✅ Final'],
  ['Lokal Adjust Notes', 'Catatan adaptasi Ngantang per item (mis. La Nina, Andisol pH, Cercospora freq)', '✅ Final'],
  ['SOP Status Tracking', 'Per-item: Sudah/Belum/Tidak Sesuai/N/A dengan note untuk deviation', '✅ Final'],
  ['Bulan Berjalan Auto-Shift', 'Wheel calendar geser otomatis ke bulan now, live refresh tiap load', '✅ Final'],
  ['Dual Baseline Pre/Post Selection', 'Pemupukan: 915 phn pre + 750 phn post-Nov 2026 dengan rumus universal', '✅ Final']
];
children.push(dataTable([['Feature', 'Detail', 'Status'], ...sopFeatures], [2800, 4726, 1500]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 6. RECENT ITERATIONS
// ============================================================
children.push(sectionBanner('6', 'Recent Iterations — Trial & Perbaikan 9 Mei 2026', C.cherry));
children.push(spacer(120));

children.push(p('Session 9 Mei 2026 menghasilkan 4 commit ke main branch — 1 bug fix + 1 recovery flow + 2 enhancement. Semua live <2 menit pasca-push via GitHub Pages auto-deploy.'));

children.push(h2('🐛 Iterasi #1 — Bug Fix: UPAH Auto-Link Missing'));
children.push(callout('Commit: dce0a0a',
  'Bug report Adib: "sudah entry detail pekerja di input harian, tapi laporan upah pekerja tidak masuk terhitung otomatis, coba cek"',
  C.cherryLt, C.cherry));
children.push(spacer(60));
children.push(h3('Diagnosa'));
children.push(p('submitForm() hanya simpan ke STATE.laporan (log harian) — tidak pernah create entry ke UPAH_ITEMS. Jadi walau Pak Kumpul/Cak Yit + durasi sudah diinput, tab Upah Pekerja tetap kosong.'));
children.push(h3('Fix'));
children.push(p('Tambah auto-link logic di submitForm() (line 2061-2111):'));
children.push(bulletItemRich([{ text: 'Mapping durasi → tarif: ', bold: true }, '½ hari (Yit 60K · Kumpul 50K) · full day (Yit 120K · Kumpul 100K) · panjat per pohon (20K × jumlah)']));
children.push(bulletItemRich([{ text: 'Skip ANTO: ', bold: true }, 'sweat equity (pro-bono per Notulen 1-2 Mei) — show info message instead']));
children.push(bulletItemRich([{ text: 'Tag src=auto_form: ', bold: true }, 'biar bisa dibedakan dari entry manual saat dedup']));
children.push(bulletItemRich([{ text: 'Auto re-render: ', bold: true }, 'renderUpahTable() + renderUpahSummary() setelah push']));

children.push(h2('🔄 Iterasi #2 — Recovery Flow: Backfill Entry Lama'));
children.push(callout('Commit: 9a05280',
  'Setelah fix #1, entry yang Adib sudah submit SEBELUM fix tetap nyangkut di STATE.laporan tanpa UPAH entry. Plus schema newEntry tidak simpan field "durasi" — recovery susah.',
  C.goldLt, C.gold));
children.push(spacer(60));
children.push(h3('Solusi 2-bagian'));
children.push(numItem('Schema fix going forward: tambah field durasi: STATE.durasi ke newEntry — semua laporan baru fully traceable.'));
children.push(numItem('Backfill modal: tombol "🔄 Recover Entry Lama" di tab Upah Pekerja → modal scan STATE.laporan untuk YIT/KUMPUL tanpa UPAH match → user pick durasi per row → bulk create dengan src=auto_backfill.'));
children.push(h3('UI Modal'));
children.push(bulletItem('Tabel scrollable dengan kolom: Tgl, Pekerja, Bidang, Aktivitas, Pohon, [Durasi dropdown], Total Rp realtime, Skip checkbox'));
children.push(bulletItem('Per-row dropdown: ½ hari / Full day / Panjat per pohon — total Rp auto-update saat dipilih'));
children.push(bulletItem('Footer: live counter "Total entry akan dibuat: X · Total nilai: Rp Y"'));
children.push(bulletItem('Empty state: "✅ Tidak ada laporan tanpa entry upah" kalau semua sudah ter-link'));

children.push(h2('📅 Iterasi #3 — Enhancement: Hari di Tanggal'));
children.push(callout('Commit: 3a6de60',
  'Adib request: "untuk memudahkan entry, bisakah ditambahkan Hari, sebelum DDMMYY?"',
  C.greenLt, C.darkGreen));
children.push(spacer(60));
children.push(h3('Implementation'));
children.push(p('Update fungsi inti formatTgl() + formatTglShort() supaya prefix nama hari. Karena banyak tempat pakai fungsi ini, update otomatis kepropagate ke semua tabel & modal.'));
children.push(dataTable([
  ['Helper', 'Output Sebelum', 'Output Sesudah'],
  ['formatTgl', '9 Mei 2026', 'Sab, 9 Mei 2026'],
  ['formatTglShort', '9 Mei', 'Sab, 9 Mei'],
  ['formatTglFull (NEW)', '—', 'Sabtu, 9 Mei 2026'],
  ['updateTglPreview (NEW)', '—', 'Live preview di Form Input']
], [3000, 3026, 3000]));
children.push(p('Form Input dapat live preview moss-color di bawah field tanggal — auto-update onchange + saat reset/init.'));

children.push(h2('🎯 Iterasi #4 — Enhancement: SOP Compliance Project Anchor'));
children.push(callout('Commit: cd86b8b',
  'Adib observasi screenshot: "utk halaman SOP compliance, apakah sudah dibuat live per bulan berjalan? ini kok masih muncul Jan"',
  C.greenLt, C.darkGreen));
children.push(spacer(60));
children.push(h3('Diagnosa'));
children.push(p('Logic lama: items pre-Mei (Jan, Feb, Mar, Apr) dianggap overdue karena bulan < currentMonth. Padahal proyek SOP baru live Mei 2026 (Notulen 1-2 Mei) — items pre-anchor seharusnya N/A pre-project, bukan overdue.'));
children.push(h3('Fix Strukur'));
children.push(numItem('Tambah konstanta SOP_PROJECT_START = { year: 2026, month: 5 }'));
children.push(numItem('Items di bulan SEBELUM project start → preProject metric (skip dari total)'));
children.push(numItem('Items dalam window proyek dibreakdown 4-tier:'));
children.push(bulletItemRich([{ text: '🔥 Fokus Bulan Berjalan ', bold: true }, '(current month, prio wajib first)']));
children.push(bulletItemRich([{ text: '⚠️ Deviations ', bold: true }, '(tidak sesuai SOP, severity tertinggi)']));
children.push(bulletItemRich([{ text: '⏰ Overdue ', bold: true }, '(bulan lewat & belum, only after project start)']));
children.push(bulletItemRich([{ text: '📅 Heads-up Bulan Depan ', bold: true }, '(wajib only, info-only)']));
children.push(h3('Auto-Roll Behavior'));
children.push(dataTable([
  ['Tanggal', 'Bulan Berjalan', 'Overdue', 'Fokus'],
  ['9 Mei 2026', 'Mei', '0', 'Items Mei'],
  ['1 Jun 2026', 'Juni', 'Items Mei belum', 'Items Juni'],
  ['1 Jul 2026', 'Juli', 'Mei + Jun belum', 'Items Juli'],
  ['1 Jan 2027', 'Januari', 'Mei-Des 2026 belum', 'Items Jan']
], [2200, 2500, 2300, 2026]));
children.push(p('Mulai 1 Jan 2027 (siklus tahun ke-2), filter pre-project di-disable otomatis (isFirstYear jadi false), semua 12 bulan masuk window normal.'));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 7. ARCHITECTURAL PATTERNS LOCKED
// ============================================================
children.push(sectionBanner('7', '7 Architectural Patterns Locked', C.darkGreen));
children.push(spacer(120));

children.push(p('Pattern-pattern berikut dilocked 9 Mei 2026 sebagai standard untuk semua future enhancement & bug fix di monitor-v2.html. Wajib dirujuk sebelum modifikasi.'));

children.push(h2('Pattern #1 — Schema Durability Rule'));
children.push(p('Semua field STATE.* yang user input HARUS ikut tertulis ke STATE.laporan newEntry. Field temporary di STATE (mis. STATE.durasi) tidak boleh hilang setelah submit.'));
children.push(callout('Why', 'Tanpa field tersimpan, recovery & cross-tab auto-link jadi impossible. Lesson dari bug 9 Mei: durasi missing → recovery painful, harus minta user pick ulang per row.', C.cherryLt, C.cherry));

children.push(h2('Pattern #2 — Auto-Link via src Tag'));
children.push(p('Saat satu tab create entry yang relate ke tab lain, gunakan tag src untuk traceability + dedup:'));
children.push(dataTable([
  ['src value', 'Asal Entry'],
  ['auto_form', 'Auto-create dari Form Input submitForm()'],
  ['auto_backfill', 'Recovery via modal Recover Entry Lama'],
  ['autolink', 'Auto-create dari UPAH lunas → CASHBOOK'],
  ['manual', 'User input via dialog/form manual (default)']
], [3000, 6026]));

children.push(h2('Pattern #3 — SOP Compliance Project Anchor'));
children.push(p('Const SOP_PROJECT_START = { year: 2026, month: 5 }. Items pre-anchor = N/A pre-project (skip total). Auto-roll setiap awal bulan, no manual update.'));

children.push(h2('Pattern #4 — Date Format Convention'));
children.push(p('Semua date display pakai prefix nama hari. Helpers ready: formatTgl (Sab, 9 Mei 2026), formatTglShort (Sab, 9 Mei), formatTglFull (Sabtu, 9 Mei 2026), updateTglPreview (live preview Form Input).'));

children.push(h2('Pattern #5 — Schema Versioning untuk localStorage'));
children.push(p('Bump version saat schema breaking change → auto-clear data lama. Format: const X_SCHEMA_VERSION = "3.0" + check storedVer !== current → removeItem.'));

children.push(h2('Pattern #6 — Iterative Refinement Workflow'));
children.push(p('Bug fix / fitur kecil: edit → validate JS syntax (new Function) → commit → push → live <2 menit. Adib test di production via hard-refresh (Cmd+Shift+R). Pattern recurring? Tulis ke section ini supaya tidak diulang.'));

children.push(h2('Pattern #7 — Git Lockfile Workaround'));
children.push(p('Bash di mount filesystem kadang gagal hapus .git/index.lock ("Operation not permitted"). Workaround: pakai osascript do shell script dengan native Mac path /Users/adibasrori/Documents/. Lockfile cleanup wajib di prefix command:'));
children.push(callout('Code Pattern',
  'rm -f .git/index.lock .git/HEAD.lock .git/refs/remotes/origin/main.lock 2>/dev/null',
  C.bgLt, C.mute));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 8. LESSONS LEARNED
// ============================================================
children.push(sectionBanner('8', 'Lessons Learned & Challenges', C.gold));
children.push(spacer(120));

children.push(p('Berikut pelajaran utama dari journey membangun monitor-v2 yang akan kita rujuk supaya progress ke depan lebih smooth:'));

children.push(h2('💡 Lesson #1 — Schema Design Wajib Tahap Awal'));
children.push(callout('Challenge',
  'Field durasi tidak disimpan di STATE.laporan saat submitForm() pertama kali. Saat butuh recovery 1 minggu kemudian, harus bikin modal manual picker — UX jelek + risiko salah pick.',
  C.cherryLt, C.cherry));
children.push(spacer(60));
children.push(h3('Pelajaran ke depan'));
children.push(bulletItemRich([{ text: '✅ Saat tambah field di Form Input: ', bold: true }, 'wajib pastikan ikut newEntry schema. Default null kalau optional.']));
children.push(bulletItemRich([{ text: '✅ Saat design schema baru: ', bold: true }, 'tanya "kalau bug serupa terjadi 1 bulan lagi, recovery butuh field apa saja?"']));
children.push(bulletItemRich([{ text: '✅ Saat add cross-tab integration: ', bold: true }, 'dokumentasi explicit field mapping di awal.']));

children.push(h2('💡 Lesson #2 — Auto-Link Wajib di Definisi Awal'));
children.push(callout('Challenge',
  'Form Input dan UPAH dibangun terpisah, baru disadari minggu kemudian bahwa Form Input tidak push entry ke UPAH. Tim sudah submit data lama yang nyangkut.',
  C.cherryLt, C.cherry));
children.push(spacer(60));
children.push(h3('Pelajaran ke depan'));
children.push(bulletItemRich([{ text: '✅ Saat design 2 tab baru yang related: ', bold: true }, 'tulis flowchart auto-link sebelum coding (Form → UPAH → CASHBOOK).']));
children.push(bulletItemRich([{ text: '✅ Test integration sejak hari ke-1: ', bold: true }, 'submit dummy entry, cek apakah muncul di tab tujuan. Jangan tunda.']));
children.push(bulletItemRich([{ text: '✅ Pakai src tag dari awal: ', bold: true }, 'jangan tunggu butuh dedup baru tambah. Konsisten dari entry pertama.']));

children.push(h2('💡 Lesson #3 — Project Anchor Beda dari Calendar Anchor'));
children.push(callout('Challenge',
  'SOP Calendar full 12 bulan, tapi project SOP baru live Mei 2026. Awalnya logic compliance flag Jan-Apr sebagai overdue — bikin Action Items spam dengan items pre-project.',
  C.cherryLt, C.cherry));
children.push(spacer(60));
children.push(h3('Pelajaran ke depan'));
children.push(bulletItemRich([{ text: '✅ Saat build time-series tracker: ', bold: true }, 'pisahkan "calendar reference" dari "project window". Calendar = static SOP, window = active period.']));
children.push(bulletItemRich([{ text: '✅ Auto-roll behavior wajib explicit: ', bold: true }, 'logic apa yang harus berubah saat awal bulan baru (overdue cutoff, fokus shift, dll).']));
children.push(bulletItemRich([{ text: '✅ Konstanta config di top file: ', bold: true }, 'const SOP_PROJECT_START supaya gampang adjust kalau Adib mau ubah anchor.']));

children.push(h2('💡 Lesson #4 — Iterative Beats Big-Bang'));
children.push(callout('Insight',
  '4 iterasi 1 hari (9 Mei) dari bug → recovery → enhancement #1 → enhancement #2. Semua live <10 menit per cycle. Tidak ada satu "big release" tapi 4 small wins berkelanjutan.',
  C.greenLt, C.darkGreen));
children.push(spacer(60));
children.push(h3('Pelajaran ke depan'));
children.push(bulletItemRich([{ text: '✅ Bug muncul → patch hari itu juga: ', bold: true }, 'jangan accumulate. Adib menghargai responsiveness.']));
children.push(bulletItemRich([{ text: '✅ Validate JS syntax tiap edit: ', bold: true }, 'node -e "new Function(allJs)" — 5 detik, hindari production crash.']));
children.push(bulletItemRich([{ text: '✅ Commit message structured: ', bold: true }, 'feat(monitor-v2): / fix(monitor-v2): prefix supaya history readable.']));

children.push(h2('💡 Lesson #5 — Persist Knowledge Sejak Awal'));
children.push(callout('Challenge',
  'Tanpa Aset Knowledge ini (yang baru dibuat 9 Mei sore), pattern + lesson yang dipelajari hari ini berisiko hilang. Conversation context hilang setelah session berakhir.',
  C.cherryLt, C.cherry));
children.push(spacer(60));
children.push(h3('Pelajaran ke depan'));
children.push(bulletItemRich([{ text: '✅ Update CLAUDE.md tiap sesi: ', bold: true }, 'pattern baru, decision baru, config baru — wajib kepush ke memory file.']));
children.push(bulletItemRich([{ text: '✅ Auto-memory cross-conversation: ', bold: true }, 'feedback & project memory di ~/Library/.../memory/ supaya persist across sessions.']));
children.push(bulletItemRich([{ text: '✅ Aset Knowledge per major artifact: ', bold: true }, 'monitor-v2 punya doc ini, future tools (NGT Coffee Hub, Rumah Wakif, etc) juga harus.']));

children.push(h2('💡 Lesson #6 — Filesystem Permission Quirk'));
children.push(callout('Challenge',
  'Bash dari workspace mount filesystem (/sessions/) sering fail saat git operation karena lockfile permission. Trial-error 30 menit di session pertama sebelum tau workaround.',
  C.cherryLt, C.cherry));
children.push(spacer(60));
children.push(h3('Pelajaran ke depan'));
children.push(bulletItemRich([{ text: '✅ Default ke osascript untuk git ops: ', bold: true }, 'native Mac path bypass mount permission boundary.']));
children.push(bulletItemRich([{ text: '✅ Prefix lockfile cleanup: ', bold: true }, 'rm -f .git/*.lock 2>/dev/null sebelum semua git command.']));
children.push(bulletItemRich([{ text: '✅ Bash mount hanya untuk read-only: ', bold: true }, 'git status, log, diff, validate. Jangan write operations.']));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 9. PENDING / FUTURE
// ============================================================
children.push(sectionBanner('9', 'Pending Items / Future Roadmap', C.moss));
children.push(spacer(120));

children.push(p('Items yang sudah teridentifikasi tapi belum dikerjakan — backlog untuk iterasi berikutnya:'));

children.push(h2('🔜 Tier 1 — Quick Wins (next session)'));
children.push(bulletItem('Tab Inventarisasi: input bulk pohon hasil seleksi pasca-panen 2026 (update 915 → 750 phn final)'));
children.push(bulletItem('SOP Kalender: tambah kemudahan filter "hanya wajib" / "hanya untuk pekerja X"'));
children.push(bulletItem('Form Input: shortcut "duplikasi laporan kemarin" supaya tidak input ulang field yang sama'));
children.push(bulletItem('Dashboard: KPI "BEP Progress" — projected revenue vs target Rp 250 jt untuk tracking ke 2027'));
children.push(bulletItem('Cashbook: filter date range + summary per kategori (mis. "total pupuk Mei-Aug")'));

children.push(h2('🔜 Tier 2 — Medium Effort (2-4 minggu ke depan)'));
children.push(bulletItem('Integrasi laporan-publik.json — auto-generate snapshot publik dari STATE.laporan untuk living-lab.html'));
children.push(bulletItem('Tab Pra-Panen: integrasi dengan Bonsari Coffee (specialty offtaker)— SOP penghantaran cherry'));
children.push(bulletItem('OPT: integrasi dengan referensi gambar (Cercospora vs Rust vs PBKo) untuk visual ID'));
children.push(bulletItem('Distribusi Tugas: kalender mingguan visual (Senin-Sabtu) supaya tim tahu jadwal'));
children.push(bulletItem('Export PDF report bulanan: 1-page summary untuk donatur (compliance %, keuangan, foto highlight)'));

children.push(h2('🔜 Tier 3 — Strategic (1-3 bulan)'));
children.push(bulletItem('Mobile-friendly UI tweaks (sekarang masih desktop-first) — tim lapangan mostly pakai HP'));
children.push(bulletItem('Offline-first capability dengan Service Worker — submit laporan saat tidak ada signal di kebun'));
children.push(bulletItem('Multi-kebun support: kalau Wakaf Produktif scale ke kebun lain, dashboard support multiple sites'));
children.push(bulletItem('Integrasi BMKG API real-time untuk rainfall (sekarang manual input by Anto)'));
children.push(bulletItem('Notifikasi WhatsApp via Twilio: alert ke Anto kalau ada deviation tinggi atau heads-up wajib'));

children.push(h2('🚧 Pending Klarifikasi Wakif'));
children.push(p('Items yang menunggu keputusan Adib sebelum bisa dibangun:'));
children.push(bulletItem('Tarif borongan top-graft pucuk Robusta — TBD per pohon'));
children.push(bulletItem('Tarif petik selektif merah — TBD per kg (trade-off kualitas vs volume)'));
children.push(bulletItem('Tarif pemangkasan kopi (jika borongan) — analisis harian vs borongan pending'));
children.push(bulletItem('Strategi distribusi hasil panen 2026 (siapa offtaker, % alokasi)'));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ============================================================
// 10. REFERENCE LINKS
// ============================================================
children.push(sectionBanner('10', 'Reference Links & Related Assets', C.moss));
children.push(spacer(120));

children.push(h2('🌐 Live URLs'));
children.push(dataTable([
  ['Asset', 'URL'],
  ['Monitor-V2 Live', 'https://adib-psych.github.io/wakaf-produktif/monitor-v2.html'],
  ['Repo GitHub', 'https://github.com/adib-psych/wakaf-produktif'],
  ['Living Lab (publik, pending)', 'https://adib-psych.github.io/wakaf-produktif/living-lab.html'],
  ['Yayasan Bundle', 'https://adib-psych.github.io/wakaf-governance/']
], [3000, 6026]));

children.push(h2('📂 File Lokasi (di /Users/adibasrori/Documents/Claude/Wakaf Produktif/)'));
children.push(dataTable([
  ['File', 'Fungsi'],
  ['Website Wakaf Produktif/monitor-v2.html', 'File utama dashboard'],
  ['CLAUDE.md', 'Project memory (auto-load di setiap conversation)'],
  ['Knowledge Wakaf/Aset_Knowledge_Monitor_V2_9Mei2026.docx', 'Doc ini'],
  ['SOP/RAB_FINAL_9Mei2026.docx', 'RAB locked decisions'],
  ['SOP/SOP_vs_GrandDesain_Analysis_8Mei2026.md', 'Deep-dive 30 discrepancy'],
  ['SOP/Robusta Edisi 2_).pdf', 'SOP otoritatif Kementan + Puslit Koka 2019'],
  ['Digital Platform/schema_v2/laporan_v2_schema.json', 'JSON Schema laporan multi-pelapor'],
  ['Meeting Minutes Wakaf/Notulen_Rapat_1-2_Mei_2026.docx', 'Tim lapangan + strategi awal']
], [4500, 4526]));

children.push(h2('🧠 Auto-Memory Files (cross-conversation)'));
children.push(p('Path: ~/Library/Application Support/Claude/.../memory/'));
children.push(dataTable([
  ['File', 'Type', 'Fungsi'],
  ['MEMORY.md', 'index', 'Master index semua memory'],
  ['project_monitor_v2_architecture.md', 'project', '7 patterns quick reference'],
  ['feedback_iterative_dashboard_workflow.md', 'feedback', 'Adib preference fix-push-live cycle'],
  ['feedback_git_lockfile_workaround.md', 'feedback', 'osascript native path fallback'],
  ['user_adib_personal_context.md', 'user', 'Konteks personal Adib & filosofi amal jariyah'],
  ['feedback_terminology_warisan.md', 'feedback', 'Hindari term warisan, pakai amal jariyah']
], [3500, 1200, 4326]));

children.push(h2('📝 Commit History 9 Mei 2026'));
children.push(dataTable([
  ['Commit Hash', 'Tipe', 'Deskripsi'],
  ['dce0a0a', 'fix', 'Auto-create UPAH entry from Form Input submitForm()'],
  ['9a05280', 'feat', 'Recover Entry Lama modal — backfill UPAH'],
  ['3a6de60', 'feat', 'Tambah hari sebelum tanggal di Form Input + Log Harian'],
  ['cd86b8b', 'feat', 'SOP Compliance anchor ke project start + restructure Action Items']
], [1800, 1200, 6026]));

children.push(spacer(200));

// ---------- CLOSING ----------
children.push(divider(C.moss));
children.push(spacer(100));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 200, after: 100 },
  children: [new TextRun({ text: '🌱 Wakaf Produktif Kebun Kopi Ngantang', bold: true, color: C.darkGreen, size: 24, font: 'Calibri' })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 100 },
  children: [new TextRun({ text: 'Produktif · Amanah · Berkah · Transparansi · Pemberdayaan · Ekologis', italics: true, color: C.moss, size: 20, font: 'Calibri' })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 100 },
  children: [new TextRun({ text: 'Aset Knowledge — Monitoring Tools V2 · Snapshot 9 Mei 2026', color: C.mute, size: 18, font: 'Calibri' })]
}));

// ============================================================
// BUILD DOCUMENT
// ============================================================

const doc = new Document({
  creator: 'Adib Asrori — Wakaf Produktif Kebun Kopi Ngantang',
  title: 'Aset Knowledge Monitoring Tools V2',
  description: 'Snapshot lengkap monitor-v2.html: features, iterations, patterns, lessons learned',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Calibri', color: C.darkGreen },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Calibri', color: C.earth },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Calibri', color: C.moss },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } }
    ]
  },
  numbering: {
    config: [
      { reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },  // A4
        margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'Aset Knowledge — Monitor-V2 · 9 Mei 2026', color: C.mute, size: 18, font: 'Calibri', italics: true })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Wakaf Produktif Kebun Kopi Ngantang  ·  Halaman ', color: C.mute, size: 18, font: 'Calibri' }),
            new TextRun({ children: [PageNumber.CURRENT], color: C.darkGreen, size: 18, font: 'Calibri', bold: true })
          ]
        })]
      })
    },
    children
  }]
});

const outPath = '/sessions/tender-dazzling-thompson/mnt/Wakaf Produktif/Knowledge Wakaf/Aset_Knowledge_Monitor_V2_9Mei2026.docx';

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log('✅ Saved:', outPath);
  console.log('   Size:', (buffer.length / 1024).toFixed(1), 'KB');
});
