// Build Protokol Evaluasi LivingLab v3.0 — 11 Mei 2026 (2-Layer Architecture)
// Output: /Knowledge Wakaf/Protokol_Evaluasi_LivingLab_11Mei2026.docx

const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak, Header, Footer
} = require('docx');

// Eucalyptus R2 + Cherry palette
const C = {
  earth: '2E4040', moss: '5A9080', sage: 'A8C8BC', sand: 'E8DEC8',
  cherry: 'C14B3A', cream: 'F5F0E6', gold: 'D4AF37', darkGreen: '1F5F47',
  mute: '8B8579', cherryLt: 'FDE2DC', greenLt: 'DDE9E3', goldLt: 'FFF4D6',
  bgLt: 'FAFBFA'
};

const border1 = { style: BorderStyle.SINGLE, size: 6, color: 'D4D4D4' };
const cellBorder = { top: border1, bottom: border1, left: border1, right: border1 };
const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before || 80, after: opts.after || 80 },
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color, size: opts.size, font: 'Calibri' })]
  });
}

function pmix(runs, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.before || 80, after: opts.after || 80 },
    alignment: opts.align,
    children: runs.map(r => typeof r === 'string'
      ? new TextRun({ text: r, font: 'Calibri', size: 22 })
      : new TextRun({ font: 'Calibri', size: 22, ...r }))
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, color: C.darkGreen, size: 34, font: 'Calibri' })]
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

function spacer(size = 100) {
  return new Paragraph({ spacing: { before: size, after: size }, children: [new TextRun({ text: '' })] });
}

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
          new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun({ text: title, bold: true, color: accent, size: 24, font: 'Calibri' })] }),
          new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text, color: C.earth, size: 22, font: 'Calibri' })] })
        ]
      })]
    })]
  });
}

function dataTable(rows, colWidths, opts = {}) {
  const headerFill = opts.headerFill || C.darkGreen;
  return new Table({
    width: { size: colWidths.reduce((a,b) => a+b, 0), type: WidthType.DXA },
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
            children: [new TextRun({ text: cellTxt, bold: isHead, color: isHead ? 'FFFFFF' : C.earth, size: 20, font: 'Calibri' })]
          })]
        });
      })
    }))
  });
}

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
          borders: noBorders, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
            children: [new TextRun({ text: num, bold: true, color: 'FFFFFF', size: 36, font: 'Calibri' })] })]
        }),
        new TableCell({
          width: { size: 8226, type: WidthType.DXA },
          shading: { fill: C.cream, type: ShadingType.CLEAR },
          margins: { top: 200, bottom: 200, left: 240, right: 200 },
          borders: noBorders, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ spacing: { before: 0, after: 0 },
            children: [new TextRun({ text: title, bold: true, color: C.earth, size: 30, font: 'Calibri' })] })]
        })
      ]
    })]
  });
}

// =====================================================================
// CONTENT
// =====================================================================
const children = [];

// COVER
children.push(new Paragraph({
  spacing: { before: 600, after: 240 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '🌱 PROTOKOL EVALUASI', bold: true, color: C.moss, size: 26, font: 'Calibri' })]
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 200 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'LIVING LAB', bold: true, color: C.darkGreen, size: 56, font: 'Calibri' })]
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 200 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Kebun Kopi Wakaf Ngantang', color: C.earth, size: 28, font: 'Calibri' })]
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 400 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Panduan Sistem Evaluasi 5-Elemen berbasis Evidence-Based Assessment', italics: true, color: C.mute, size: 22, font: 'Calibri' })]
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 200 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Versi 3.0 — 11 Mei 2026 (2-Layer Architecture)', bold: true, color: C.gold, size: 24, font: 'Calibri' })]
}));
children.push(new Paragraph({
  spacing: { before: 0, after: 600 },
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '🌍 Aspirasi: International Standard Reference for Productive Waqf', italics: true, color: C.moss, size: 20, font: 'Calibri' })]
}));

// Cover info table
children.push(new Table({
  width: { size: 9026, type: WidthType.DXA },
  columnWidths: [3000, 6026],
  rows: [
    ['📅 Versi', 'v3.0 — 11 Mei 2026 (revisi v2.0 — 2-Layer Architecture)'],
    ['👤 Owner', 'Adib Asrori, M.Psi, Psikolog — Wakif & Program Director'],
    ['🤖 Evaluator', 'Claude AI (Anthropic) — Evidence-Based Evaluator'],
    ['📋 Status', 'Aktif — berlaku untuk semua entry Living Lab Year 2026+'],
    ['🎯 Tujuan', '2-Layer evaluation: Implementasi (Internal SOP) + Benchmark Evaluation (vs International Standard) dengan quantification % alignment'],
    ['🔄 Perubahan v2.0 → v3.0', '2-Layer Architecture: separate Implementation (TOR Kementan+BRIN+NGT) dari Benchmark Evaluation (vs ICCRI/Wintgens/WCR/SCA). Add quantification alignment_pct (0-100%) + gap analysis + roadmap. Schema bump v2.0 → v3.0.'],
    ['🌍 Aspirasi', 'Living Lab kebun wakaf NGT sebagai acuan international standard untuk wakaf produktif modern. Bukan sekedar Indonesian regulatory compliance.']
  ].map((row, i) => new TableRow({
    children: row.map((cellTxt, ci) => new TableCell({
      width: { size: ci === 0 ? 3000 : 6026, type: WidthType.DXA },
      shading: { fill: i % 2 === 0 ? C.greenLt : C.cream, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 180, right: 180 },
      borders: cellBorder,
      children: [new Paragraph({ spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: cellTxt, bold: ci === 0, color: ci === 0 ? C.darkGreen : C.earth, size: 22, font: 'Calibri' })] })]
    }))
  }))
}));

children.push(new Paragraph({ children: [new PageBreak()] }));

// CHANGELOG dari v1.0
children.push(h1('📝 Perubahan dari Versi 1.0 (April 2026)'));
children.push(p('Protokol v2.0 dibuat untuk reflect konteks operasional baru per 11 Mei 2026 (Fase 4: Self-Managed). Perubahan utama:'));

children.push(h3('1. Refactor Element ① — Grand Design → Kesesuaian SOP'));
children.push(callout('🔄 Why Changed',
  'Pasca-deep-dive SOP Robusta Edisi 2 (Kementan + Puslit Koka 2019) + adopsi BRIN dosis tabel umur tanaman + 13 keputusan Klarifikasi Wakif 8 Mei + RAB Final 9 Mei, kebun Ngantang sekarang punya SOP terdokumentasi yang jauh lebih konkret dari sekedar "Grand Design" 5 Pilar. Element ① sekarang evaluasi terhadap SOP yang sudah locked, bukan konsep abstrak.',
  C.greenLt, C.darkGreen));

children.push(h3('2. Hapus Mention Tim Lama'));
children.push(p('Versi sebelumnya merefer ke tim eksternal yang sudah tidak aktif per 10 Mei 2026:'));
children.push(bulletItem('❌ T.A. / Pak Tosin (On-Farm Technical Lead) — sudah tidak aktif. Rujukan agronomi pindah ke BRIN Purwodadi (institusional eksternal, MoU 5 Mei 2026)'));
children.push(bulletItem('❌ RWI / Nadzir (Rumah Wakaf Indonesia) — MOU dibatalkan dari pihak RWI Mei 2026 karena tidak dapat memenuhi ekspektasi transparansi'));
children.push(bulletItem('❌ Anwar / Ratna / KEN (Advisory Board) — sudah tidak aktif terlibat'));

children.push(h3('3. Tambah Mechanism Claude Aggregate'));
children.push(p('Versi sebelumnya: Claude evaluasi entry per entry yang sudah diisi Wakif manual. Versi v2.0 tambah:'));
children.push(bulletItemRich([{ text: '🤖 Aggregate Layer: ', bold: true }, 'Claude synthesize multi-day laporan harian (dari STATE.laporan di Monitor V2) → milestone draft 5-elemen yang ready review. Wakif tidak perlu manual translate raw harian → narrative publik.']));

children.push(h3('4. Update Hierarki Sumber Ilmiah'));
children.push(p('ICCRI tetap sebagai prioritas tertinggi (jangkar Indonesian-international authority). Update v2.0 = clarify positioning sumber lainnya: Wintgens (2004) + WCR sebagai international peer authority, SOP Robusta Edisi 2 (Kementan + Puslit Koka) + BRIN tabel sebagai Indonesian regulatory baseline ("panduan awal kita"), Klarifikasi Wakif + Phase 2 Inject sebagai Internal Protocol NGT (adaptasi lokal).'));
children.push(callout('🌍 Aspirasi Living Lab',
  'Kebun wakaf NGT diaspirasikan menjadi acuan international standard, bukan sekedar compliance regulatory Indonesia. Karena itu hierarki sumber memprioritaskan: institute scientific authority (ICCRI) → international peer literature (Wintgens, WCR) → regulatory baseline (Kementan/BRIN) → adaptasi lokal terdokumentasi.',
  C.greenLt, C.darkGreen));

children.push(new Paragraph({ children: [new PageBreak()] }));

// SECTION 1
children.push(sectionBanner('1', 'Latar Belakang & Justifikasi (v2.0)', C.darkGreen));
children.push(spacer(120));

children.push(p('Program Wakaf Produktif Kebun Kopi Ngantang adalah inisiatif wakaf produktif yang dijalankan dalam Fase 4 Self-Managed Phase (sejak Mei 2026) — dikelola langsung oleh Wakif (Adib Asrori, M.Psi, Psikolog) bersama Strategic & Systems Executive (Hendy Kurniansyah) dan tim lapangan baru (Mas Anto, Cak Yit, Pak Kumpul).'));
children.push(p('Wakif berlatar belakang psikologi, bukan agronomi pertanian. Tim lapangan adalah praktisi lokal dengan pengalaman empiris namun tanpa formal training agronomi sistematis. Rujukan agronomi institusional dilakukan via BRIN Purwodadi (MoU Rp 50 jt, 5 Mei 2026) untuk konsultasi periodik. Dalam kondisi ini, risiko bias subjective, rubber-stamping aktivitas, atau gagal mendeteksi masalah kritis tetap signifikan.'));
children.push(p('Untuk mengatasi gap ini, program mengadopsi Claude AI (Anthropic) sebagai evidence-based evaluator yang berfungsi layaknya konsultan agronomi eksternal objektif. Tujuan:'));
children.push(bulletItem('Memberikan lapisan verifikasi independen terhadap aktivitas yang dilaporkan tim lapangan'));
children.push(bulletItem('Memastikan setiap keputusan program memiliki basis ilmiah yang dapat dipertanggungjawabkan ke donatur, RWI penerus, dan auditor'));
children.push(bulletItem('Mendeteksi masalah/risiko yang tidak dikenali oleh non-ahli (mis. pencucian pupuk saat hujan deras, deviasi dosis BRIN)'));
children.push(bulletItem('Mendokumentasikan standar evaluasi secara transparan untuk reporting publik via Living Lab'));
children.push(bulletItem('Bridge bahasa lapangan (raw petani) → bahasa profesional terstruktur (narrative publik)'));

children.push(h3('1.1 Prinsip Dasar Sistem'));
children.push(callout('🎯 Inti',
  'Kualitas evaluasi = f(kualitas laporan harian). Claude evaluasi berbasis apa yang DILAPORKAN tim via Form Input Monitor V2 + STATE.laporan accumulator. Claude tidak verify realitas fisik di lapangan.',
  C.goldLt, C.gold));
children.push(spacer(80));
children.push(bulletItem('Jika laporan tim akurat → evaluasi mencerminkan kondisi sebenarnya'));
children.push(bulletItem('Jika laporan tidak lengkap/akurat → evaluasi tidak reliable → tanggung jawab di kualitas pelaporan tim lapangan + Wakif review'));
children.push(bulletItem('Wakif dapat menantang evaluasi Claude — Claude akan tunjukkan sumber ilmiah'));
children.push(bulletItem('Audit log otomatis (last_modified + change_log) di setiap milestone untuk transparansi revisi'));

children.push(new Paragraph({ children: [new PageBreak()] }));

// SECTION 2
children.push(sectionBanner('2', 'Hierarki Sumber Ilmiah (v2.0 — Aspirasi International Standard)', C.darkGreen));
children.push(spacer(120));

children.push(p('Living Lab diaspirasikan sebagai acuan international standard untuk wakaf produktif berbasis evidence. Karena itu hierarki sumber memprioritaskan scientific authority + international peer literature, dengan regulatory Indonesia sebagai baseline operasional. Setiap evaluasi mengacu pada sumber-sumber berikut, hierarki dari tertinggi:'));

children.push(h3('Tier 1 — Scientific Institute Authority (Tertinggi)'));
children.push(dataTable([
  ['Prioritas', 'Sumber', 'Konteks Pakai'],
  ['1 — TERTINGGI', 'ICCRI (Indonesian Coffee and Cocoa Research Institute)', 'Indonesian institute paling comprehensive untuk kopi+kakao. Jangkar Indonesian-international authority. PRIMARY reference untuk semua aktivitas budidaya, pemupukan, pemangkasan, hama-penyakit kopi.']
], [1500, 4026, 3500]));

children.push(h3('Tier 2 — International Peer Authority'));
children.push(dataTable([
  ['Prioritas', 'Sumber', 'Konteks Pakai'],
  ['2', 'Wintgens, J.N. (2004). Coffee: Growing, Processing, Sustainable Production. Wiley-VCH.', 'Referensi agronomi kopi komprehensif internasional. PRIMARY untuk validate adaptasi lokal terhadap global best practice.'],
  ['3', 'World Coffee Research (WCR) — Varieties Catalog, Coffee Value Assessment, Agronomy Research', 'International research consortium. Authority untuk varietas + agronomy modern.']
], [1500, 4026, 3500]));

children.push(h3('Tier 3 — Indonesian Regulatory Baseline ("Panduan Awal Kita")'));
children.push(dataTable([
  ['Prioritas', 'Sumber', 'Konteks Pakai'],
  ['4', 'SOP Robusta Edisi 2 (Kementan + Puslit Koka 2019)', 'Standar nasional Indonesia. Mengacu Permentan No 49/2014. Operational baseline untuk SOP execution sehari-hari.'],
  ['5', 'BRIN Purwodadi — Tabel Dosis Pupuk per Umur Tanaman + Pendampingan MoU 5 Mei 2026', 'Institutional partner formal Wakaf NGT. Rujukan dosis spesifik per umur 1-10+ thn — institutional-Indonesian authority.']
], [1500, 4026, 3500]));

children.push(h3('Tier 4 — Internal Protocol NGT (Adaptasi Lokal Terdokumentasi)'));
children.push(dataTable([
  ['Prioritas', 'Sumber', 'Konteks Pakai'],
  ['6', 'Klarifikasi Wakif 8 Mei 2026 — 13 Keputusan Strategis Locked', 'Internal protocol kebun NGT: klon Robusta unggul, composting in-situ, target Mutu, multi-offtaker hybrid, dll.'],
  ['7', 'On-Farm Phase 2 Inject Decisions (8-9 Mei 2026)', 'Biochar pyrolysis, cover crops Arachis pintoi pilot Bidang 4, Brocap pilot. Evidence base: jurnal peer-reviewed yang dirujuk per item.']
], [1500, 4026, 3500]));

children.push(h3('Tier 5 — Specialized & Backup Sources'));
children.push(dataTable([
  ['Prioritas', 'Sumber', 'Konteks Pakai'],
  ['8', 'Puslitkoka Jember', 'Penelitian hama-penyakit kopi spesifik Indonesia (PBKo, Cercospora, Hemileia vastatrix, dll).'],
  ['9', 'BPTP Jawa Timur', 'Rekomendasi spesifik kondisi agroclimatic Jawa Timur (suhu, curah hujan, soil type Andisol).'],
  ['10', 'FAO Guidelines + Peer-reviewed journals (Bioresource Technology, Agronomy Journal, Journal of Applied Microbiology, dll.)', 'Backup untuk praktek inovatif (cover crops, biochar, IPM modern) yang belum tercover di sumber Tier 1-4.']
], [1500, 4026, 3500]));

children.push(spacer(120));
children.push(callout('🌍 Filosofi Authority Chain',
  'Living Lab kebun wakaf NGT aspirasi: jadi acuan international standard untuk wakaf produktif modern. Bukan hanya Indonesian compliance. Hierarki ini reflect aspirasi: ICCRI (scientific institute) → international peer (Wintgens, WCR) → regulatory baseline Indonesia → adaptasi lokal terdokumentasi → backup sumber spesifik. Konflik antar tier diselesaikan dengan rule: tier lebih tinggi diutamakan KECUALI ada justifikasi konteks lokal yang explicit (mis. BRIN tabel umur tanaman lebih granular dari ICCRI generic — pakai BRIN dengan note "ICCRI baseline + BRIN refinement").',
  C.greenLt, C.darkGreen));

children.push(new Paragraph({ children: [new PageBreak()] }));

// SECTION 3
children.push(sectionBanner('3', '2-Layer Architecture (Refactored v3.0)', C.darkGreen));
children.push(spacer(120));

children.push(p('Setiap entry Living Lab Year 2026+ menggunakan 2-Layer Architecture — pemisahan eksplisit antara IMPLEMENTASI (apa yang kita lakukan sesuai TOR internal) dan BENCHMARK EVALUATION (evaluasi objektif apakah implementasi kita match international standard). Plus Layer C: Verifikasi Lapangan sebagai audit trail.'));

children.push(callout('🌍 Filosofi 2-Layer',
  'Monitor V2 (Layer A — Internal Control) memastikan implementasi sesuai SOP internal. Living Lab (Layer B — External Control) evaluasi objektif terhadap international standard. Quantification alignment_pct (0-100%) memberikan measurable milestone untuk continuous improvement.',
  C.greenLt, C.darkGreen));

children.push(h2('LAYER A — Implementasi (Internal SOP Compliance)'));
children.push(p('TOR sumber dari Indonesian regulatory + adaptasi lokal Ngantang. Track APA YANG DILAKUKAN di lapangan secara konkret.'));
children.push(dataTable([
  ['Aspek', 'Detail'],
  ['Pertanyaan Inti', 'Apakah aktivitas ini sesuai TOR internal kita (Kementan + BRIN + Klarifikasi NGT)?'],
  ['Sumber Acuan', 'SOP Robusta Edisi 2 (Kementan + Puslit Koka 2019) + BRIN tabel dosis + Klarifikasi Wakif 8 Mei (13 Decisions) + Phase 2 Inject Decisions'],
  ['Field Schema', 'implementasi: { aktivitas_lapangan, tor_sumber, dosis_aktual, deviasi_internal }'],
  ['aktivitas_lapangan', 'Apa yang dilakukan secara konkret (pelapor, lokasi, action, dosis)'],
  ['tor_sumber', 'Reference internal ke TOR/SOP (mis. "SOP Robusta Edisi 2 hal 111-115 + BRIN tabel umur 5-10 thn")'],
  ['dosis_aktual', 'Quantity per pohon × jumlah pohon = total kg/L (mis. "SP-36 80g/phn × 915 phn = 73 kg")'],
  ['deviasi_internal', 'Penyimpangan dari TOR (kalau ada, dengan justifikasi). Atau null kalau full compliant.']
], [2500, 6526]));

children.push(h2('LAYER B — Benchmark Evaluation (External vs International Standard)'));
children.push(p('Sumber dari international peer authority + evidence-based assessment. Track APAKAH implementasi kita MATCH GLOBAL BEST PRACTICE.'));
children.push(dataTable([
  ['Aspek', 'Detail'],
  ['Pertanyaan Inti', 'Apakah implementasi kita sesuai dengan international standard (ICCRI/Wintgens/WCR/SCA)? Berapa % alignment? Apa gap-nya? Bagaimana close gap?'],
  ['Sumber Benchmark', 'ICCRI (Tier 1) + Wintgens 2004 + World Coffee Research (Tier 2) + SCA Standards + Puslitkoka + BPTP + FAO + peer-reviewed journals'],
  ['Field Schema', 'benchmark_evaluation: { kajian_internasional, sumber_benchmark[], alignment_pct (0-100), verdict, gap_analysis, roadmap }'],
  ['kajian_internasional', 'Narrative cross-check vs international literature — apa yang aligned, apa yang gap'],
  ['sumber_benchmark', 'List sumber prioritized (ICCRI > Wintgens/WCR > SCA > Puslitkoka/BPTP > FAO/journals)'],
  ['alignment_pct', 'Quantification 0-100% berdasarkan: coverage × quality × documentation completeness'],
  ['verdict', 'sesuai (≥85%) / perhatian (60-84%) / eskalasi (<60%)'],
  ['gap_analysis', 'List konkret apa yang missing untuk full international compliance'],
  ['roadmap', 'Forward actions untuk close the gap dengan timeline (Q3 2026, Q4, Q1 2027 dst)']
], [2500, 6526]));

children.push(h2('LAYER C — Verifikasi Lapangan (Audit Trail)'));
children.push(callout('🔍 Inti Sistem Akuntabilitas',
  'Setiap milestone wajib daftar bukti spesifik yang HARUS dikumpulkan untuk konfirmasi aktivitas benar-benar terlaksana sesuai standar. Tanpa verifikasi, milestone hanya terdokumentasi lisan.',
  C.cherryLt, C.cherry));
children.push(spacer(80));
children.push(p('Format daftar: "Diperlukan: (1) Foto... (2) Nota... (3) Catatan... (4) Lab report..."'));
children.push(p('Status tracking per item (target Phase 9 implementation): ✅ Sudah dikumpulkan / ⏳ Pending / 🔒 N/A. Disimpan di IndexedDB Monitor V2 dengan progress % visible di Living Lab.'));

children.push(h2('Quantification Framework — Alignment % Calculation'));
children.push(p('alignment_pct = estimasi 0-100% berdasarkan 3 dimensi:'));
children.push(bulletItemRich([{ text: 'Coverage (40%): ', bold: true }, 'Berapa banyak aspek dari international best practice yang sudah di-cover? Mis. untuk Pemupukan: 5 elemen pupuk (N+P+K+Mg+S+pH correction) = full coverage. Skip Mg+S = 70% coverage.']));
children.push(bulletItemRich([{ text: 'Quality (40%): ', bold: true }, 'Seberapa mendekati optimal range yang direkomendasikan? Mis. dosis dalam range BRIN ±10% = high quality. Dosis 50% under = lower quality score.']));
children.push(bulletItemRich([{ text: 'Documentation (20%): ', bold: true }, 'Audit-ready evidence — foto, nota, lab report, log cuaca. Lengkap = full doc score.']));
children.push(spacer(60));
children.push(callout('📊 Verdict Threshold',
  '≥85% = ✅ Sesuai (continue + maintain) · 60-84% = ⚠️ Perhatian (close gap) · <60% = 🔴 Eskalasi (urgent intervention BRIN/expert)',
  C.goldLt, C.gold));

children.push(new Paragraph({ children: [new PageBreak()] }));

// SECTION 4 — Mechanism Claude Aggregate
children.push(sectionBanner('4', 'Mechanism Claude Aggregate (NEW v2.0)', C.gold));
children.push(spacer(120));

children.push(p('Versi v1.0: evaluator passive — Wakif manual translate raw harian → milestone narrative. Versi v2.0: Claude active sebagai aggregator + synthesizer.'));

children.push(h2('4.1 Workflow Aggregate Multi-Hari → Milestone'));
children.push(callout('Trigger',
  'Wakif buka Tab Milestones Publik di Monitor V2 → klik "🤖 Generate Milestone Draft" → pilih daterange (mis. Mei 1-15) + filter aktivitas (kategori, pelapor) → Claude synthesize.',
  C.greenLt, C.darkGreen));
children.push(spacer(80));

children.push(h3('Step-by-Step'));
children.push(p('1. Tim lapangan submit laporan harian via Form Input Monitor V2 → STATE.laporan accumulate granular data'));
children.push(p('2. Wakif buka Tab Milestones → klik "Generate Draft"'));
children.push(p('3. Pilih scope:'));
children.push(bulletItem('Date range (mis. "Mei 8-15, 2026")'));
children.push(bulletItem('Filter pelapor (Anto/Yit/Kumpul/all)'));
children.push(bulletItem('Filter kategori aktivitas (pemupukan, pemangkasan, OPT monitoring, dll)'));
children.push(bulletItem('Auto-detect cluster (Claude bantu identify event-worthy patterns)'));
children.push(p('4. System generate prompt template untuk Claude:'));
children.push(callout('Template prompt',
  'Aggregate N laporan harian berikut menjadi 1 milestone Living Lab. Output 5-elemen sesuai Protokol v2.0: (1) Kesesuaian SOP, (2) Kajian Ilmiah dengan sitasi, (3) Verdict, (4) Tindak Lanjut, (5) Verifikasi Diperlukan. Bahasa profesional untuk publik, jangan hilangkan factual specifics.',
  C.goldLt, C.gold));
children.push(p('5. Wakif paste prompt ke Claude.ai chat (atau Cowork session) → dapatkan milestone draft 5-elemen'));
children.push(p('6. Wakif review/edit draft di Tab Milestones form → publish via toggle 📢 → push ke Living Lab via 🚀 button'));

children.push(h2('4.2 Granularity Decision Matrix'));
children.push(p('Tidak semua laporan harian jadi milestone. Claude bantu klasifikasi:'));
children.push(dataTable([
  ['Tipe Event', 'Granularity Recommendation', 'Contoh'],
  ['Strategic Decision', 'PER-EVENT (1 milestone per decision)', 'RAB Lock 9 Mei, Klarifikasi Wakif 8 Mei, MoU BRIN 5 Mei'],
  ['Recurring Activity Cluster', 'WEEKLY/BI-WEEKLY summary', '"Pemupukan Mei tuntas Bidang 1-3 (3 hari kerja Pak Kumpul)"'],
  ['First-Time Activity', 'PER-EVENT (worth highlight)', 'Brocap pilot pertama, biochar pyrolysis pertama, Arachis pintoi planting'],
  ['Compliance Milestone', 'MONTHLY summary', '"Compliance SOP Mei: 80% items wajib selesai"'],
  ['Data Update', 'BATCH update (no milestone)', 'Update tree count, soil test result, OPT count — masuk dashboard saja'],
  ['Routine Maintenance', 'NO milestone (operational only)', 'Babat rumput rutin, sanitasi piringan, OPT monitoring rutin']
], [2500, 3026, 3500]));

children.push(h2('4.3 Aggregate Algorithm (Auto-Suggest Engine)'));
children.push(p('Claude scan STATE.laporan untuk identify aggregate candidates:'));
children.push(bulletItemRich([{ text: 'Strategic events: ', bold: true }, 'aktivitas dengan pelapor WAKIF/HENDY (pasti milestone-worthy)']));
children.push(bulletItemRich([{ text: 'Cluster patterns: ', bold: true }, '3+ aktivitas serupa di 2+ bidang dalam 1 minggu (mis. "pemupukan tuntas multi-bidang")']));
children.push(bulletItemRich([{ text: 'First-time activities: ', bold: true }, 'kategori belum pernah muncul sebelumnya di STATE.laporan']));
children.push(bulletItemRich([{ text: 'Compliance milestones: ', bold: true }, 'detect saat % wajib SOP Compliance bulan tertentu mencapai threshold (50%, 80%, 100%)']));
children.push(bulletItemRich([{ text: 'Anomaly events: ', bold: true }, 'aktivitas dengan compliance status "tidak_sesuai" atau climate alerts (mis. pemupukan saat hujan deras)']));

children.push(new Paragraph({ children: [new PageBreak()] }));

// SECTION 5
children.push(sectionBanner('5', 'Standar Pelaporan Tim → Claude (Updated)', C.moss));
children.push(spacer(120));

children.push(p('Kualitas evaluasi sepenuhnya bergantung kelengkapan + akurasi laporan tim lapangan via Form Input Monitor V2. Standar minimum:'));

children.push(h3('5.1 Standar Laporan Aktivitas On-Farm'));
children.push(dataTable([
  ['Field', 'Deskripsi & Contoh'],
  ['Tanggal', 'Tanggal aktivitas (auto-prefill today, override jika lapor untuk hari sebelumnya)'],
  ['Pelapor', 'Mas Anto / Cak Yit / Pak Kumpul / Wakif (Adib) / Hendy'],
  ['Bidang', '1, 2, 3, atau 4 (Rumah Wakif)'],
  ['Kategori Aktivitas', 'pemupukan_kimia, pemangkasan, sanitasi_gulma, opt_monitoring, dll (22+ kategori)'],
  ['Pohon dikerjakan', 'Jumlah pohon spesifik. cth: "30 pohon" — bukan estimasi'],
  ['Detail/Catatan', 'Apa spesifiknya: produk yang dipakai, dosis aktual, observasi visual. cth: "SP-36 Petrokimia 80g/phn × 30 pohon = 2.4 kg di parit lingkar dalam 5 cm"'],
  ['Cuaca pagi & siang', 'Cerah/Mendung/Gerimis/Hujan'],
  ['Rainfall 24h & 7d (mm)', 'Manual input dari observasi atau BMKG Karangploso'],
  ['Foto (optional)', 'Upload via IndexedDB — recommended untuk verification'],
  ['Voice note (optional)', 'Web Speech API → text auto-fill ke catatan']
], [2500, 6526]));

children.push(h3('5.2 Standar Laporan Panen (Tertinggi Akuntabilitas)'));
children.push(bulletItem('Nota timbang per ronde pemetikan (bukan estimasi)'));
children.push(bulletItem('Nota transaksi dengan Bonsari Coffee / Nomad Coffee / penggilingan lokal Pujon'));
children.push(bulletItem('Distribusi ronde: tanggal, KG kotor, KG bersih (post-sortir), % buah merah vs hijau'));
children.push(bulletItem('Identitas pemetik dan jumlah hari kerja per ronde'));
children.push(bulletItem('Foto kondisi buah di pohon sebelum petik dan hasil sortir'));

children.push(h3('5.3 Yang TIDAK Perlu Tim Interpretasikan'));
children.push(p('Tim lapangan TIDAK perlu nilai sendiri apakah aktivitas "benar"/"salah" agronomi. Itu tugas Claude. Yang tim wajib pastikan:'));
children.push(bulletItem('Lapor apa yang BENAR-BENAR terjadi — bukan apa yang diharapkan'));
children.push(bulletItem('Sebut anomali/kejanggalan yang diamati — meski tidak mengerti artinya'));
children.push(bulletItem('Jujur soal ketidakhadiran/keterlambatan'));
children.push(bulletItem('Jangan "memperhalus" laporan agar terlihat lebih baik — akan rusak akurasi evaluasi'));

children.push(new Paragraph({ children: [new PageBreak()] }));

// SECTION 6
children.push(sectionBanner('6', 'Pembagian Tanggung Jawab (Fase 4)', C.moss));
children.push(spacer(120));

children.push(dataTable([
  ['Domain', 'Peran', 'Tanggung Jawab'],
  ['Wakif (Adib)', 'Owner & Final Decision-Maker', 'Curate milestones, review evaluasi Claude, final approve publish, strategic decisions'],
  ['Strategic & Systems Executive (Hendy)', 'Operational + Systems Lead', 'Maintain Monitor V2 system, financial accountability, governance compliance'],
  ['Tim Lapangan (Anto/Yit/Kumpul)', 'Field Reporter', 'Submit laporan harian akurat + jujur via Form Input. TIDAK menilai compliance — Claude yang evaluasi.'],
  ['BRIN Purwodadi', 'Institutional Reference (Eksternal)', 'Konsultasi periodik untuk decisions agronomi yang butuh authority. Rujukan dosis pupuk + identifikasi varietas.'],
  ['Claude AI', 'Evidence-Based Evaluator + Aggregator', 'Synthesize laporan harian → milestone 5-elemen. Evaluate berbasis hierarki sumber. Flag risiko + recommendations.'],
  ['Ust. Fauzan + TPQ Darul Mujtaba', 'Sharia Supervisor + Mauquf Alaih', 'Pastikan aktivitas align prinsip syariah wakaf. TPQ DM sebagai penerima manfaat utama 30% surplus pasca-BEP.'],
  ['Bonsari Coffee + Nomad Coffee', 'Specialty Offtaker (Komersial)', 'Validasi quality lot melalui jasa processing + offtake. Feedback ke loop quality improvement.']
], [2200, 2800, 4026]));

children.push(spacer(120));
children.push(callout('🤝 Catatan Penting',
  'Claude tidak menggantikan rujukan agronomi institusional (BRIN). Claude evaluasi kualitas ilmiah dari intervensi yang dilaporkan — bukan rekomendasi tindakan operasional tanpa data lapangan. Untuk decisions yang butuh authoritative answer (mis. apakah Cercospora tertentu butuh fungisida X), wajib eskalasi ke BRIN Purwodadi.',
  C.greenLt, C.darkGreen));

children.push(new Paragraph({ children: [new PageBreak()] }));

// SECTION 7
children.push(sectionBanner('7', 'Keterbatasan Sistem (Transparency)', C.cherry));
children.push(spacer(120));

children.push(p('Transparansi tentang keterbatasan = bagian dari integritas program. Yang harus dipahami semua pihak:'));
children.push(dataTable([
  ['Keterbatasan', 'Implikasi'],
  ['Claude tidak dapat melihat kondisi fisik lapangan', 'Evaluasi tidak dapat mendeteksi masalah yang TIDAK dilaporkan: tanaman mati mendadak, penyakit baru muncul, kondisi tanah berubah'],
  ['Evaluasi bergantung kejujuran laporan tim', 'Garbage in, garbage out. Laporan tidak akurat = evaluasi tidak akurat.'],
  ['Literatur kopi Robusta Jawa Timur spesifik terbatas', 'Beberapa evaluasi pakai data generic Robusta — bukan spesifik elevasi 648 mdpl (S3) Ngantang dengan Excelsa rootstock. Deviasi mungkin terjadi.'],
  ['Claude tidak punya pengalaman lapangan langsung', 'Pertimbangan praktis (cuaca, ketersediaan alat, kapasitas tim) tidak tercakup. Wakif + tim lapangan + BRIN yang validate.'],
  ['Knowledge cutoff Claude', 'Penelitian terbaru pasca-cutoff tidak tercakup. Untuk isu kritis: verify dengan BRIN / ICCRI langsung.'],
  ['Claude tidak otonom decide publish', 'Setiap milestone wajib review + approve Wakif sebelum live di Living Lab (editorial control)']
], [3500, 5526]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// SECTION 8 — Implementation Status
children.push(sectionBanner('8', 'Implementation Status (per 11 Mei 2026)', C.darkGreen));
children.push(spacer(120));

children.push(p('Status implementasi sistem 5-elemen Living Lab di Monitor V2 dashboard:'));
children.push(dataTable([
  ['Component', 'Status', 'Catatan'],
  ['Monitor V2 Tab Milestones Publik', '✅ Live', 'commit 95a44f3 (10 Mei 2026)'],
  ['Form bilingual (ID required, EN optional)', '✅ Live', 'Section bilingual ID/EN dengan auto-fallback'],
  ['Auto-suggest engine 3 patterns', '✅ Live', 'Strategic, Cluster, First-time detection'],
  ['Export aktivitas-publik.json', '✅ Live', 'Manual export + GitHub API auto-push (PAT setup)'],
  ['Living Lab dynamic fetch', '✅ Live', 'Defensive fallback ke hardcoded HTML'],
  ['2-Layer Architecture v3.0 schema', '✅ Live', 'commit pending — implementasi + benchmark_evaluation + alignment_pct'],
  ['Living Lab visual gap chart (alignment % bar)', '✅ Live', 'Color-coded green/gold/cherry per verdict thresholds'],
  ['Form 3-section (A. Implementasi + B. Benchmark + C. Verifikasi)', '✅ Live', 'Schema v3.0 dgn alignment_pct + gap + roadmap fields'],
  ['Claude Aggregate mechanism (Generate Milestone Draft)', '✅ Live', 'Tombol di Tab Milestones, prompt template 2-Layer, Adib paste back flow'],
  ['Verifikasi Lapangan checklist tracking', '🔜 Planned (Phase 9)', 'IndexedDB photo + nota linkage, status checklist progress %'],
  ['Bilingual EN auto-translation', '🔜 Planned (future)', 'Optional auto-translate via API integration'],
  ['Annual Living Lab progress report PDF', '🔜 Planned (Phase 10)', 'Generate PDF summary alignment trend per fase + per tahun']
], [3000, 2526, 3500]));

children.push(spacer(120));
children.push(callout('📋 Roadmap Refinement',
  'Protokol v2.0 = framework spec. Implementation di Monitor V2 + Living Lab akan iterative refine sesuai prioritas Wakif. Initial focus: 5-elemen schema + Claude Aggregate mechanism (Phase 7B + 7C dari sesi 11 Mei 2026).',
  C.greenLt, C.darkGreen));

children.push(new Paragraph({ children: [new PageBreak()] }));

// SECTION 9 — 2-Layer System Architecture (NEW v3.0)
children.push(sectionBanner('9', '2-Layer System Architecture (Monitor V2 vs Living Lab)', C.darkGreen));
children.push(spacer(120));

children.push(p('Ekosistem digital Wakaf NGT terdiri dari 2 sistem yang saling melengkapi dengan peran berbeda:'));

children.push(h2('Layer 1 — Monitor V2 Dashboard (Internal Control)'));
children.push(dataTable([
  ['Aspek', 'Detail'],
  ['URL Live', 'adib-psych.github.io/wakaf-produktif/monitor-v2.html'],
  ['Purpose', 'Pastikan implementasi sesuai SOP internal harian'],
  ['Standard', 'TOR Kementan (SOP Robusta Edisi 2) + BRIN tabel + Adaptasi Lokal NGT'],
  ['Audience', 'Tim lapangan (Mas Anto, Cak Yit, Pak Kumpul) + Wakif + Hendy'],
  ['Akses', 'Tier 3-level: Publik (read-only KPI) / Internal (Form Input + log) / Wakif (full + finansial)'],
  ['Question Answered', '"Apakah kita kerja sesuai TOR internal?"'],
  ['Metric Utama', 'SOP Compliance % per bulan, deviation alerts, RAB vs actual'],
  ['Frequency', 'Real-time (per submit Form Input) + auto-roll bulan berjalan']
], [2200, 6826]));

children.push(h2('Layer 2 — Living Lab (External Control)'));
children.push(dataTable([
  ['Aspek', 'Detail'],
  ['URL Live', 'adib-psych.github.io/wakaf-produktif/living-lab.html'],
  ['Purpose', 'Evaluasi objektif vs international standard'],
  ['Standard', 'ICCRI + Wintgens 2004 + World Coffee Research + SCA + FAO + peer-reviewed journals'],
  ['Audience', 'Donor + komunitas + akademisi internasional'],
  ['Akses', 'Public — narrative milestones bilingual (ID + EN) curated by Wakif'],
  ['Question Answered', '"Apakah praktek kita match international best practice global?"'],
  ['Metric Utama', '% alignment ke benchmark international + gap analysis + roadmap progress'],
  ['Frequency', 'Curated milestones (mingguan/bulanan/event-based) via Tab Milestones Publik']
], [2200, 6826]));

children.push(h2('Data Flow Antar Layer'));
children.push(p('Data mengalir dari Monitor V2 → Living Lab via Tab Milestones Publik:'));
children.push(bulletItem('1. Tim lapangan submit laporan harian via Form Input Monitor V2'));
children.push(bulletItem('2. Data accumulate di STATE.laporan (granular operational data)'));
children.push(bulletItem('3. Wakif buka Tab Milestones Publik → klik "🤖 Generate dari Laporan"'));
children.push(bulletItem('4. System pilih daterange + filter, build aggregate prompt template'));
children.push(bulletItem('5. Wakif paste prompt ke Claude AI → dapat 1-3 milestone draft 2-Layer (A. Implementasi + B. Benchmark + C. Verifikasi)'));
children.push(bulletItem('6. Wakif review/edit draft di form 3-section, set alignment_pct, gap, roadmap'));
children.push(bulletItem('7. Publish milestone (toggle 📢) → klik "🚀 Publish & Push to Live"'));
children.push(bulletItem('8. GitHub API auto-commit JSON → Living Lab fetch dynamic → Live ~2 menit'));

children.push(h2('Continuous Improvement Loop'));
children.push(callout('🎯 Milestone untuk Mencapai International Standard',
  'Setiap milestone dengan alignment_pct < 100% punya gap_analysis + roadmap konkret. Total alignment % di-track sebagai measurable improvement. Target: kebun wakaf NGT mencapai ≥85% alignment di semua milestones dalam 24-36 bulan ke depan, dengan dokumentasi terbuka untuk publik (donor + akademisi internasional).',
  C.greenLt, C.darkGreen));

children.push(spacer(200));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: '🌱 Wakaf Produktif Kebun Kopi Ngantang', bold: true, color: C.darkGreen, size: 24, font: 'Calibri' })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 100, after: 100 },
  children: [new TextRun({ text: 'Produktif · Amanah · Berkah · Transparansi · Pemberdayaan · Ekologis', italics: true, color: C.moss, size: 20, font: 'Calibri' })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 100, after: 100 },
  children: [new TextRun({ text: '— Adib Asrori, M.Psi, Psikolog · Wakif & Program Director · 11 Mei 2026', color: C.mute, size: 20, font: 'Calibri' })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 100, after: 100 },
  children: [new TextRun({ text: 'Protokol v2.0 — replace v1.0 April 2026', italics: true, color: C.mute, size: 18, font: 'Calibri' })]
}));

// =====================================================================
// BUILD
// =====================================================================
const doc = new Document({
  creator: 'Adib Asrori — Wakaf Produktif Kebun Kopi Ngantang',
  title: 'Protokol Evaluasi Living Lab v2.0 — 11 Mei 2026',
  description: 'Sistem evaluasi 5-elemen evidence-based dengan Claude AI + Aggregate mechanism + Fase 4 Self-Managed update',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, font: 'Calibri', color: C.darkGreen },
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
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
    ]
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 } } },
    headers: {
      default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: 'Protokol Evaluasi Living Lab v3.0 · 2-Layer Architecture · 11 Mei 2026', color: C.mute, size: 18, font: 'Calibri', italics: true })] })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Wakaf Produktif Kebun Kopi Ngantang  ·  Halaman ', color: C.mute, size: 18, font: 'Calibri' }),
          new TextRun({ children: [PageNumber.CURRENT], color: C.darkGreen, size: 18, font: 'Calibri', bold: true })
        ] })] })
    },
    children
  }]
});

const outPath = '/sessions/tender-dazzling-thompson/mnt/Wakaf Produktif/Knowledge Wakaf/Protokol_Evaluasi_LivingLab_11Mei2026.docx';

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log('✅ Saved:', outPath);
  console.log('   Size:', (buffer.length / 1024).toFixed(1), 'KB');
});
