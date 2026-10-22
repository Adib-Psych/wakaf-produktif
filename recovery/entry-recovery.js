/* Entry-only recovery: no payment, deletion, publication or singleton write authority. */
(function () {
  'use strict';
  if(document.body?.dataset?.reportEntry==='device'||document.documentElement?.dataset?.reportEntry==='device'){
    for(const type of ['click','change','input','submit'])document.addEventListener(type,event=>{
      const target=event.target,panel=target.closest?.('[id^="panel-"]');if(!panel)return;
      const action=target.closest('button,input,select,textarea,a,[onclick]');if(!action)return;
      const code=action.getAttribute('onclick')||'';
      const unsafe=/edit|delete|hapus|bayar|paid|publish|sync|merge|void|restore|resetAll/i.test(code);
      const allowed=['panel-form','panel-log'].includes(panel.id)&&!unsafe;
      if(!allowed){event.preventDefault();event.stopImmediatePropagation();if(type==='click')alert('Fungsi pengelolaan ini tetap dilindungi. Hanya entry laporan perangkat dan riwayat sendiri.');}
    },true);
    return;
  }
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
  const ownerKey='wkkn_recovery_staff_owners_v1';
  let flight = null;
  function owners(){const x=JSON.parse(localStorage.getItem(ownerKey)||'{}');if(!x||Array.isArray(x)||typeof x!=='object')throw Error('Owner map corrupt; pending retained');return x;}
  function pending() {
    const items = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(items)) throw new Error('Antrian tidak valid; jangan hapus data browser.');
    return items;
  }
  function enqueue(entries) {
    const items = pending();
    const priorIds=new Set(items.map(x=>x.id));
    for (const entry of entries) {
      if (!entry.id || !entry.created_at) throw new Error('Identitas entry belum lengkap');
      const sameId = items.filter(x => x.id === entry.id);
      if (sameId.some(x => workerReportContent(x) !== workerReportContent(entry))) {
        throw new Error('Konflik ID laporan: isi berbeda; antrian lama tetap disimpan.');
      }
      if (!sameId.length) items.push(entry);
    }
    const owner=window.authorizedReports?.sessionOwner?.()||null;
    const map=owners();for(const entry of entries){if(priorIds.has(entry.id)&&!Object.hasOwn(map,entry.id))throw Error('Pending legacy tanpa pemilik: HOLD');if(Object.hasOwn(map,entry.id)&&map[entry.id]!==owner)throw Error('Pending owner conflict');map[entry.id]=owner;}
    // Ownership first: interruption may leave an unused binding, never an unowned send.
    localStorage.setItem(ownerKey,JSON.stringify(map));
    localStorage.setItem(key, JSON.stringify(items));
  }
  const lockName='wkkn-staff-pending-v2';
  async function locked(fn){
    if(!globalThis.navigator?.locks?.request)throw Error('Browser lock unavailable; form/pending retained');
    return navigator.locks.request(lockName,fn);
  }
  async function enqueueAtomic(entries){
    const frozen=JSON.parse(JSON.stringify(entries));
    const api=window.authorizedReports;
    const ticket=api?.sessionTicket?.()||{uid:api?.sessionOwner?.()||null};
    return locked(()=>{
      if(ticket.uid ? (api?.sessionMatches?!api.sessionMatches(ticket):api?.sessionOwner?.()!==ticket.uid) : !!api?.sessionOwner?.())throw Error('session-changed');
      enqueue(frozen);
    });
  }
  async function drain() {
    if (flight) return flight;
    flight = (async () => {
      const acknowledged = [];
      for (const entry of pending()) {
        try {
          if (typeof window.syncLaporanEntryToFirestore !== 'function') break;
          const uid=window.authorizedReports?.sessionOwner?.();
          if(!uid||owners()[entry.id]!==uid)throw Error('Pending pemilik lain/belum terikat: tetap ditahan');
          const ticket=window.authorizedReports?.sessionTicket?.();
          const submittedContent = workerReportContent(entry);
          const ack = await window.syncLaporanEntryToFirestore(entry);
          if (ack !== entry.id) throw new Error('Konfirmasi cloud belum cocok');
          // ACK applies only to the sent snapshot, not a same-ID body changed in another tab.
          await locked(()=>{
            if(window.authorizedReports?.sessionOwner?.()!==uid || (ticket&&!window.authorizedReports.sessionMatches(ticket)))throw Error('session-changed');
            localStorage.setItem(key, JSON.stringify(pending().filter(x => x.id !== entry.id || workerReportContent(x) !== submittedContent)));
          });
          acknowledged.push(entry.id);
        } catch (e) { console.warn('[Entry recovery] tetap pending:', e.message); }
      }
      return acknowledged;
    })();
    try { return await flight; } finally { flight = null; }
  }
  window.entryRecovery = Object.freeze({ enqueue, enqueueAtomic, drain, pending });
  window.addEventListener('online', () => drain().catch(console.warn));
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('div');
    banner.id = 'entry-recovery-banner';
    banner.style.cssText = 'position:sticky;top:0;z-index:99999;padding:12px;background:#fff1e8;color:#78350f;border:2px solid #c2410c';
    banner.textContent = 'MODE PEMULIHAN: baca, entry dan koreksi laporan berizin server. Keuangan, bayar, hapus dan publikasi dinonaktifkan. Data cache belum tentu cloud terkini. Antrian belum terkirim tetap disimpan di browser ini; jangan hapus data browser.';
    if(document.body.dataset?.reportAccess==='compact'){
      const guidance=document.createElement('details');guidance.id='entry-recovery-guidance';
      const summary=document.createElement('summary');summary.textContent='Panduan laporan & antrian';
      try{const count=pending().length;if(count){summary.textContent=count+' laporan belum dikonfirmasi — jangan hapus data browser';guidance.open=true;}}catch(e){summary.textContent='Antrian perlu diperiksa — jangan hapus data browser';guidance.open=true;}
      const copy=document.createElement('p');copy.textContent=banner.textContent;
      guidance.append(summary,copy);banner.textContent='';banner.append(guidance);
      (document.querySelector('#main-content > .content-wrap')||document.body).prepend(banner);
    }else document.body.prepend(banner);
  });
  // Capture before existing inline handlers can mutate cached state.
  for (const type of ['click', 'change', 'input', 'submit']) document.addEventListener(type, event => {
    const target = event.target;
    const panel = target.closest && target.closest('[id^="panel-"]');
    if(target.closest?.('#correction-controls')||/^(editLaporan|cancelEditLaporan|submitForm|submitCabut|newCabutReport)\(/.test(target.closest?.('[onclick]')?.getAttribute('onclick')||''))return;
    if(panel?.id==='panel-cabut'&&['input','change'].includes(type))return;
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
