/* Entry-only recovery: no payment, deletion, publication or singleton write authority. */
(function () {
  'use strict';
  // Preserve incident evidence before listeners or historical defaults can normalize it.
  for (const cacheKey of ['wkkn_v2_laporan','wkkn_v2_cashbook','wkkn_v2_upah','wkkn_v2_milestones','wkkn_sop_status_v1','wkkn_v2_opt_obs','wkkn_panen_data_v1','wkkn_panen_lots_v1','wkkn_panen_sampling_v1']) {
    try {
      const preserved = 'wkkn_recovery_preserved_' + cacheKey;
      const value = localStorage.getItem(cacheKey);
      if (value !== null && localStorage.getItem(preserved) === null) localStorage.setItem(preserved, value);
    } catch (e) { console.warn('[Recovery] Cache backup unavailable:', cacheKey); }
  }
  const readFetch = window.fetch && window.fetch.bind(window);
  if (readFetch) window.fetch = (input, options = {}) => {
    const method = (options.method || input.method || 'GET').toUpperCase();
    const url = String(input.url || input);
    if (/^https:\/\/(api\.github\.com|api\.anthropic\.com)\//.test(url) && !['GET','HEAD'].includes(method)) return Promise.reject(new Error('Mode pemulihan: API AI/publikasi dinonaktifkan.'));
    return readFetch(input, options);
  };
  const key = 'wkkn_recovery_staff_pending_v1';
  let flight = null;
  function pending() {
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(items)) throw new Error('Antrian tidak valid; jangan hapus data browser.');
    return items;
  }
  function enqueue(entries) {
    const items = pending();
    for (const entry of entries) {
      if (!entry.id || !entry.created_at) throw new Error('Identitas entry belum lengkap');
      if (!items.some(x => x.id === entry.id)) items.push(entry);
    }
    localStorage.setItem(key, JSON.stringify(items));
  }
  async function drain() {
    if (flight) return flight;
    flight = (async () => {
      const acknowledged = [];
      for (const entry of pending()) {
        try {
          if (typeof window.syncLaporanEntryToFirestore !== 'function') break;
          const ack = await window.syncLaporanEntryToFirestore(entry);
          if (ack !== entry.id) throw new Error('Konfirmasi cloud belum cocok');
          localStorage.setItem(key, JSON.stringify(pending().filter(x => x.id !== entry.id)));
          acknowledged.push(entry.id);
        } catch (e) { console.warn('[Entry recovery] tetap pending:', e.message); }
      }
      return acknowledged;
    })();
    try { return await flight; } finally { flight = null; }
  }
  window.entryRecovery = Object.freeze({ enqueue, drain, pending });
  window.addEventListener('online', () => drain().catch(console.warn));
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.id = 'entry-recovery-banner';
    banner.style.cssText = 'position:sticky;top:0;z-index:99999;padding:12px;background:#fff1e8;color:#78350f;border:2px solid #c2410c';
    banner.textContent = 'MODE PEMULIHAN: hanya baca dan entry laporan baru. Keuangan, bayar, edit/hapus dan publikasi dinonaktifkan. Data cache belum tentu cloud terkini. Antrian belum terkirim tetap disimpan di browser ini; jangan hapus data browser.';
    document.body.prepend(banner);
  });
  // Capture before existing inline handlers can mutate cached state.
  for (const type of ['click', 'change', 'input', 'submit']) document.addEventListener(type, event => {
    const target = event.target;
    const panel = target.closest && target.closest('[id^="panel-"]');
    if (!panel) return; // Sidebar navigation and tier selection remain available.
    const action = target.closest('button,input,select,textarea,a,[onclick]');
    if (!action) return;
    const code = action.getAttribute('onclick') || '';
    const unsafe = /edit|delete|hapus|bayar|paid|publish|sync|merge|void|restore|resetAll/i.test(code);
    const readAction = /^(render|toggle|switch|filter|set.*Filter|export|print|open.*(Lightbox|Preview))/i.test(code);
    const allowed = (panel.id === 'panel-form' && !unsafe) || (['panel-dashboard', 'panel-log'].includes(panel.id) && !unsafe) || readAction;
    if (!allowed || unsafe) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (type === 'click') alert('Fungsi ini dinonaktifkan dalam mode pemulihan. Hanya baca dan entry laporan baru.');
    }
  }, true);
})();
