/* Musim Panen presentation only. No auth, data, storage, handler or intent writes. */
(function () {
  'use strict';
  const overlayIds = ['login-overlay', 'audit-modal-overlay', 'trx-modal-overlay',
    'opt-obs-modal-overlay', 'opt-expert-modal-overlay', 'opt-detail-modal-overlay',
    'paid-modal-overlay', 'recover-modal-overlay', 'dlg-panen-sortir4-overlay',
    'add-worker-modal', 'bc-draft-modal-overlay', 'ms-modal-overlay',
    'suggest-modal-overlay', 'ms-preview-modal-overlay', 'panen-jemur-modal-overlay',
    'sampling-input-modal-overlay', 'sampling-edit-modal-overlay',
    'jemur-event-modal-overlay', 'jual-event-modal-overlay', 'giling-event-modal-overlay',
    'pic-edit-overlay', 'laporan-related-overlay', 'progress-slider-overlay'];
  const selector = overlayIds.map(id => '#' + id).join(',') + ',dialog,.hero-lightbox,[data-report-private-overlay]';
  let scheduled = false;
  const visible = node => !!node?.isConnected && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
  const opened = new Map();
  function decorate(root) {
    const native = root.tagName === 'DIALOG';
    const media = root.matches('.hero-lightbox,[data-report-private-overlay]');
    if (media) {
      root.classList.add('dashboard-popup', 'dashboard-popup-media');
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', 'Foto laporan · tutup untuk kembali');
      if (!root.querySelector('.dashboard-popup-media-close')) {
        const close = document.createElement('button');
        close.type = 'button'; close.className = 'dashboard-popup-media-close';
        close.textContent = 'Tutup foto'; close.onclick = () => root.click();
        root.append(close);
      }
      if (visible(root) && !opened.has(root)) {
        opened.set(root, document.activeElement);
        root.querySelector('.dashboard-popup-media-close').focus({preventScroll: true});
      } else if (!visible(root) && opened.has(root)) {
        const previous = opened.get(root); opened.delete(root);
        if (visible(previous)) previous.focus({preventScroll: true});
      }
      return;
    }
    const panel = native ? root : root.firstElementChild;
    if (!panel) return;
    root.classList.add(native ? 'dashboard-popup-native' : 'dashboard-popup');
    panel.classList.add('dashboard-popup-panel');
    const header = native ? panel.querySelector('.dlg-head,h3') : panel.firstElementChild;
    if (header) header.classList.add('dashboard-popup-header');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    if (!panel.hasAttribute('aria-labelledby') && !panel.hasAttribute('aria-label')) {
      const heading = header?.querySelector('h1,h2,h3,[id$="title"]') || (header?.children.length ? header.querySelector('div') : header);
      if (heading?.textContent.trim()) {
        if (!heading.id) heading.id = (root.id || 'dashboard-popup') + '-heading';
        panel.setAttribute('aria-labelledby', heading.id);
      } else panel.setAttribute('aria-label', 'Detail dashboard');
    }
    for (const label of panel.querySelectorAll('label:not([for])')) {
      const field = label.nextElementSibling;
      if (!label.querySelector('input,select,textarea') && field?.matches('input,select,textarea') && field.id) label.htmlFor = field.id;
    }
    for (const button of panel.querySelectorAll('button')) {
      const code = button.getAttribute('onclick') || '';
      if (/^[×✕✖]$/.test(button.textContent.trim()) && !button.hasAttribute('aria-label')) button.setAttribute('aria-label', 'Tutup dialog');
      if (button.classList.contains('btn-primary')) button.classList.add('dashboard-popup-primary');
      if (button.classList.contains('btn-secondary') || /^\s*close\w*\(/.test(code)) button.classList.add('dashboard-popup-secondary');
      if (/^\s*(?:delete|hapus|void)\w*\(/i.test(code)) button.classList.add('dashboard-popup-danger');
    }
    // Native dialogs already own focus/dismiss/busy behavior; never interfere.
    if (!native) {
      const isOpen = visible(root);
      if (isOpen && !opened.has(root)) {
        opened.set(root, document.activeElement);
        if (!panel.contains(document.activeElement)) {
          panel.tabIndex = -1;
          panel.focus({preventScroll: true});
        }
      } else if (!isOpen && opened.has(root)) {
        const previous = opened.get(root); opened.delete(root);
        if (previous?.isConnected && visible(previous)) previous.focus({preventScroll: true});
      }
    }
  }
  // Exact retired local-first cross-page repair mutations only. Read-only audit,
  // reconciliation matrix/export, freshness, history and ordinary writes remain.
  const retired = new Set(['auditUnmarkPaid', 'auditResetAllPaid', 'auditDeleteCashbook',
    'auditMergeUpahDup', 'auditDeleteUpahDup', 'auditMarkUpahPaid',
    'reconcileRevertUpah', 'reconcileCreateCashflow', 'reconcileMergeDoublePay',
    'reconcileWhitelistTgl', 'reconcileUnwhitelist', 'toggleReconciliationMode',
    'openRecoverDlg', 'confirmRecover']);
  function consolidate() {
    for (const button of document.querySelectorAll('button[onclick="openAuditModal()"]')) {
      if (button.closest('.dashboard-repair-diagnostics')) continue;
      const details = document.createElement('details');
      details.className = 'dashboard-repair-diagnostics';
      const summary = document.createElement('summary');
      summary.textContent = 'Diagnostik historis · baca saja';
      const note = document.createElement('p');
      note.textContent = 'Pemeriksaan tautan lama tetap tersedia untuk dibaca. Alat perbaikan lokal lama disembunyikan; pembayaran dan riwayat tetap di kontrol operasional.';
      button.before(details); details.append(summary, note, button);
      button.textContent = 'Lihat diagnostik tautan lama';
      button.title = 'Baca pemeriksaan historis; bukan jalur perbaikan data';
    }
    for (const id of ['audit-modal-overlay', 'panel-reconcile']) {
      const target = document.getElementById(id);
      if (!target || target.querySelector('.dashboard-repair-note')) continue;
      const note = document.createElement('p');
      note.className = 'dashboard-repair-note';
      note.textContent = 'Diagnostik historis, baca saja. Mutasi perbaikan lokal lama disembunyikan; data, matriks dan ekspor tidak dihapus. Ini bukan indikator kesiapan otomatisasi upah.';
      if (id === 'audit-modal-overlay') target.firstElementChild.firstElementChild.after(note);
      else target.prepend(note);
    }
    for (const node of document.querySelectorAll('[onclick],[onchange]')) {
      const code = node.getAttribute('onclick') || node.getAttribute('onchange') || '';
      const handler = code.trim().match(/^([A-Za-z_$][\w$]*)\s*\(/)?.[1];
      if (!retired.has(handler)) continue;
      // Keep a stranded pause-OFF warning actionable if it is already present:
      // it reports state, not a new invitation to start a retired repair cycle.
      if (handler === 'toggleReconciliationMode' && node.tagName === 'BUTTON') continue;
      const target = handler === 'toggleReconciliationMode' ? node.closest('label') || node : node;
      target.dataset.retiredRepair = handler;
      target.hidden = true;
    }
  }
  function refresh() {
    scheduled = false;
    consolidate();
    for (const root of document.querySelectorAll(selector)) decorate(root);
    for (const [root, previous] of opened) if (!root.isConnected) {
      opened.delete(root);
      if (visible(previous)) previous.focus({preventScroll: true});
    }
  }
  function start() {
    refresh();
    new MutationObserver(() => {
      if (!scheduled) { scheduled = true; requestAnimationFrame(refresh); }
    }).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'open']});
    document.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || document.querySelector('dialog[open]')) return;
      const roots = [...document.querySelectorAll('.dashboard-popup')].filter(visible);
      const root = roots.sort((a, b) => Number(getComputedStyle(a).zIndex) - Number(getComputedStyle(b).zIndex)).at(-1);
      if (!root) return;
      const panel = root.classList.contains('dashboard-popup-media') ? root : root.firstElementChild;
      const fields = [...panel.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(n => visible(n) && !n.disabled && n.tabIndex >= 0);
      const first = fields[0], last = fields.at(-1);
      if (!first) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !fields.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !fields.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
