'use strict';
// Execute verbatim product functions AND actual registered report callback.
// SDK, storage, DOM and timers are synthetic adapters; no network is available.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const html = fs.readFileSync(process.env.WAKAF_SOURCE || path.join(__dirname, '../monitor-v2.html'), 'utf8');
function between(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw Error('missing source seam: ' + start);
  return html.slice(a, b);
}
const baseline = {
  wkkn_v2_upah: '[ {"id":91,"tgl":"1999-01-01","pelapor":"SYNTHETIC_OLD","qty":2,"tarif":17,"status":"sudah","src":"synthetic"} ]',
  wkkn_v2_cashbook: '[ {"id":"synthetic-cash","tgl":"1999-01-01","tipe":"masuk","kat":"synthetic","ket":"synthetic baseline","masuk":123,"keluar":7,"ref":"upah_91"} ]',
  wkkn_v2_kasbon: '[ {"id":"synthetic-advance","jumlah":13,"pekerja":"SYNTHETIC_OLD"} ]',
  wkkn_recovery_staff_pending_v1: '[ {"id":"synthetic-pending","detail":"preserve bytes"} ]',
  wkkn_lapor_pending_v1: '[ {"id":"synthetic-worker-pending","detail":"preserve bytes"} ]'
};
const report = (id = 'synthetic-report') => ({id, tanggal:'2000-01-02', pelapor:'SYNTHETIC_WORKER', kategori:'pemangkasan', kebun:['K3','K1'], jumlah_pohon:4, durasi:'satu_hari', catatan:'synthetic narrative', detail:{tipe_pemangkasan:'Wiwilan (tunas liar)'}, compliance:'pending', rain_24h_mm:2, rain_7d_mm:8});
function makeHarness({cache = [], cloud = 'empty', reconciliation = false} = {}) {
  const storage = new Map(Object.entries({...baseline, wkkn_v2_laporan:JSON.stringify(cache), wkkn_reconciliation_mode:reconciliation?'on':'off'}));
  const calls = {saveUpah:0, syncUpah:0, getDoc:0, renders:[], writes:[], listeners:[], timers:[], errors:[]};
  const context = {
    console:{log(){},warn(){},error(...v){calls.errors.push(v.map(String).join(' '));}},
    localStorage:{getItem:k=>storage.get(k)??null, setItem(k,v){calls.writes.push(k); storage.set(k,String(v));}},
    STATE:{laporan:structuredClone(cache)}, UPAH_ITEMS:JSON.parse(baseline.wkkn_v2_upah), CASHBOOK:JSON.parse(baseline.wkkn_v2_cashbook), KASBON_DATA:JSON.parse(baseline.wkkn_v2_kasbon),
    TARIF_PEKERJA:{SYNTHETIC_WORKER:{setengah_hari:31,full_day:61}},
    db:{}, q:{synthetic:true}, doc:(_db,...parts)=>parts.join('/'),collection:(_db,p)=>({path:p}),
    async getDoc(){calls.getDoc++; if(cloud==='error') throw Error('synthetic denied'); return {exists:()=>cloud!=='missing', data:()=> cloud==='malformed'?{data:{bad:true}}:{data:[]}};},
    onSnapshot(q, next, error){const item={next,error,unsubscribed:false}; if(q?.path==='report_heads')return ()=>{};calls.listeners.push(item);return ()=>{item.unsubscribed=true;};},
    setTimeout(fn,ms){calls.timers.push({fn,ms});return calls.timers.length;}, clearTimeout(){},
    document:{getElementById:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},remove(){}}),body:{appendChild(){},insertBefore(){}}},
    window:{addEventListener(){},privateReader:{allowed:()=>true},_deletedTombstones:new Set(),async syncUpahToFirestore(){calls.syncUpah++;}},
    correctionHeads:new Map(),REPORT_EDIT_TIMER:null,CURRENT_EDIT_LAPORAN_ID:null,
    reportForDisplay:value=>structuredClone(value?.contract_version===1?value.submitted_body:value),
    authorizedReports:{sessionOwner:()=> 'synthetic-staff',observeSession(fn){fn('synthetic-staff');},suspend(){}},
    mountReportSessionControls(){}, // DOM controls exercised separately by browser; finance predicates unchanged.
    setupBoronganListener(){},_boronganUnsub:null,
    computeRainfallAlerts:()=>[],
  };
  for(const name of ['renderLog','renderDashboard','renderUpah','renderUpahTable','renderUpahSummary']) context[name]=()=>calls.renders.push(name);
  Object.assign(context,context.window);context.window=context;
  vm.createContext(context);
  vm.runInContext(between('let _saveUpahDebounceTimer = null;', '\nfunction calcTotal('),context);
  vm.runInContext('const originalSaveUpah = saveUpah; saveUpah = (...a) => { calls.saveUpah++; return originalSaveUpah(...a); };',Object.assign(context,{calls}));
  vm.runInContext(between('function autoCreateUpahFromEntry(', '\n// ====================================================================\n// MANAGE WORKERS TAB'),context);
  vm.runInContext(between('    function normalizeWorkerEntry(', '\n    // ⭐ 1 Jun 2026: Window focus rehydrate'),context);
  // Auth now clears pre-auth cache by design; seed accepted read-model fixtures after that transition.
  context.STATE.laporan=structuredClone(cache);
  const snapshot=()=>({upah:JSON.stringify(context.UPAH_ITEMS),cash:JSON.stringify(context.CASHBOOK),advances:JSON.stringify(context.KASBON_DATA),bytes:Object.fromEntries(Object.keys(baseline).map(k=>[k,storage.get(k)]))});
  const fire=async(changes)=>calls.listeners.at(-1).next({metadata:{fromCache:true},docChanges:()=>changes});
  const change=(data,type='added',id=data?.id||'synthetic-malformed')=>({type,doc:{id,data:()=>data}});
  const runTimers=async(ms)=>{const timers=calls.timers.filter(t=>t.ms===ms);calls.timers=calls.timers.filter(t=>t.ms!==ms); for(const t of timers) await t.fn();};
  return {context,storage,calls,snapshot,fire,change,runTimers};
}
module.exports={makeHarness,report,baseline,between};
