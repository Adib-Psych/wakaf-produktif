/**
 * ════════════════════════════════════════════════════════════════
 * APPS SCRIPT — Notulen Feedback Receiver
 * Wakaf Produktif Kebun Kopi Ngantang
 * ════════════════════════════════════════════════════════════════
 *
 * INSTRUKSI SETUP (lihat juga README di folder Website):
 *
 * 1. Buka folder Drive Adib:
 *    https://drive.google.com/drive/folders/125qG6Au_jYPFWigK0Ha9eChh-g0gFuj_
 *
 * 2. Klik kanan di folder > New > Google Sheets
 *    Beri nama: "Notulen Feedback Log — Wakaf Produktif"
 *
 * 3. Di sheet baru, klik menu: Extensions > Apps Script
 *
 * 4. Paste seluruh kode di bawah ini ke editor Apps Script
 *    (replace default code "function myFunction()...")
 *
 * 5. Simpan (Ctrl/Cmd + S), beri nama project:
 *    "Notulen Feedback Receiver"
 *
 * 6. Klik Deploy (kanan atas) > New deployment
 *    - Type: Web app
 *    - Description: "Notulen feedback receiver v1"
 *    - Execute as: Me (asroriadib@gmail.com)
 *    - Who has access: Anyone
 *    Klik Deploy.
 *
 * 7. Authorize akses (klik Authorize > pilih akun > Advanced
 *    > Go to project > Allow). Aman karena script dijalankan
 *    di Google environment Adib sendiri.
 *
 * 8. Setelah deploy berhasil, copy "Web app URL"
 *    (format: https://script.google.com/macros/s/AKfycb.../exec)
 *
 * 9. Buka file notulen-brin-13mei2026.html, cari teks:
 *    const SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL';
 *    Ganti dengan URL yang baru dicopy.
 *
 * 10. Done. Setiap submission akan masuk otomatis ke sheet.
 *
 * ════════════════════════════════════════════════════════════════
 */

// Configuration
const SHEET_NAME = 'Feedback';
const HEADERS = [
  'Timestamp',
  'Nama',
  'Email',
  'Institusi / Posisi',
  'Bagian Notulen',
  'Masukan / Koreksi',
  'Persetujuan Publikasi',
  'Sumber Form',
  'Status Review',
  'Catatan Internal'
];

/**
 * Handle POST request dari form submission.
 * Form data dikirim sebagai application/x-www-form-urlencoded
 * atau FormData (multipart).
 */
function doPost(e) {
  try {
    const sheet = getOrCreateSheet();
    const params = e.parameter || {};

    // Append row
    const row = [
      new Date(),                                          // Timestamp
      params.nama || '',
      params.email || params._replyto || '',
      params.institusi || '',
      params.bagian || 'Umum',
      params.masukan || '',
      params.persetujuan_publikasi === 'ya' ? 'Ya' : 'Tidak',
      params._subject || 'Notulen BRIN Serpong 13 Mei 2026',
      'Belum direview',                                    // Status default
      ''                                                    // Catatan internal (kosong, diisi Adib)
    ];
    sheet.appendRow(row);

    // Optional: send email notification ke Adib
    try {
      MailApp.sendEmail({
        to: 'asroriadib@gmail.com',
        subject: '🍃 Masukan Notulen Baru: ' + (params.nama || 'Anonim'),
        htmlBody: buildEmailNotification(params)
      });
    } catch (mailErr) {
      // Mail might fail (quota, permissions) — don't break submission
      console.error('Email notification failed:', mailErr);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, message: 'Terima kasih, masukan tersimpan.' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error('doPost error:', err);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET request — untuk testing / health check.
 * Buka URL Web App di browser akan tampilkan pesan ini.
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      service: 'Notulen Feedback Receiver',
      project: 'Wakaf Produktif Kebun Kopi Ngantang',
      status: 'active',
      message: 'Endpoint aktif. Kirim POST request untuk submit feedback.'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Ambil atau buat sheet "Feedback" + setup header bila baru.
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }

  // Cek apakah header sudah ada
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    // Styling header
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#2e4040');
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 150);   // Timestamp
    sheet.setColumnWidth(2, 180);   // Nama
    sheet.setColumnWidth(3, 220);   // Email
    sheet.setColumnWidth(4, 280);   // Institusi
    sheet.setColumnWidth(5, 200);   // Bagian Notulen
    sheet.setColumnWidth(6, 500);   // Masukan
    sheet.setColumnWidth(7, 120);   // Persetujuan
    sheet.setColumnWidth(8, 250);   // Sumber Form
    sheet.setColumnWidth(9, 140);   // Status
    sheet.setColumnWidth(10, 300);  // Catatan Internal
  }

  return sheet;
}

/**
 * Build HTML email notification body
 */
function buildEmailNotification(params) {
  return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2e4040; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">🍃 Masukan Notulen Baru</h2>
        <p style="margin: 4px 0 0; opacity: 0.85; font-size: 14px;">Wakaf Produktif Kebun Kopi Ngantang</p>
      </div>
      <div style="background: white; border: 1px solid #ddd; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #5a7878; width: 140px;"><strong>Dari:</strong></td><td style="padding: 8px 0;">${escapeHtml(params.nama || '-')}</td></tr>
          <tr><td style="padding: 8px 0; color: #5a7878;"><strong>Email:</strong></td><td style="padding: 8px 0;"><a href="mailto:${escapeHtml(params.email || params._replyto || '')}">${escapeHtml(params.email || params._replyto || '-')}</a></td></tr>
          <tr><td style="padding: 8px 0; color: #5a7878;"><strong>Institusi:</strong></td><td style="padding: 8px 0;">${escapeHtml(params.institusi || '-')}</td></tr>
          <tr><td style="padding: 8px 0; color: #5a7878;"><strong>Bagian:</strong></td><td style="padding: 8px 0;">${escapeHtml(params.bagian || 'Umum')}</td></tr>
          <tr><td style="padding: 8px 0; color: #5a7878;"><strong>Persetujuan publikasi:</strong></td><td style="padding: 8px 0;">${params.persetujuan_publikasi === 'ya' ? '✓ Ya' : '✗ Tidak'}</td></tr>
        </table>
        <div style="margin-top: 20px; padding: 16px; background: #f0f5f3; border-left: 4px solid #b8860b; border-radius: 4px;">
          <strong style="display: block; margin-bottom: 8px; color: #2e4040;">Masukan / Koreksi:</strong>
          <div style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(params.masukan || '-')}</div>
        </div>
        <p style="margin-top: 24px; font-size: 12px; color: #999;">Submission tersimpan otomatis di Google Sheet "Notulen Feedback Log". Bisa diakses kapan saja untuk review.</p>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * UTILITY: Run sekali untuk test bahwa script & sheet OK.
 * Klik fungsi ini di editor Apps Script > Run > authorize.
 */
function testSetup() {
  const sheet = getOrCreateSheet();
  Logger.log('Sheet ready: ' + sheet.getName());
  Logger.log('Total rows: ' + sheet.getLastRow());
  Logger.log('Headers: ' + sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0].join(' | '));
}
