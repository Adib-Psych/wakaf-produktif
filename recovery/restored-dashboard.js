import {buildPayrollDocument,payrollID,renderPayrollPNG,openPayrollPreview} from './payroll-documents.mjs';
import {showPublicOptDetail} from './opt-public-detail.mjs';
import {domainWarning,requireFreshPublicData} from './public-health.mjs';
import {publicReadStatus,publicDomainNotice} from './public-presentation.mjs';
import {bindPublicRefresh} from './public-refresh.mjs';
// Public reads are on-demand: no full-collection idle polling.
// Legacy operational-dashboard.js remains available only as a historical bounded-snapshot tool.
import {createPrivateReader,snapshotHealth} from './private-capability.mjs';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {getFirestore,doc,getDocFromServer} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
const domains={dashboard:['reports','panen','lots','cabut','sopStatus'],anggaran:['upah','cashbook','kasbon'],inventaris:['cabut','benchmark','pupuk'],reconcile:['reports','upah','cashbook'],rab:['cashbook'],log:['reports'],upah:['upah'],keuangan:['cashbook'],workers:['workers'],panen:['panen','lots','sampling'],opt:['opt'],milestones:['milestones'],kalender:['sop','sopStatus'],compliance:['sop','sopStatus'],distribusi:['pic','workers'],pupuk:['pupuk'],cabut:['cabut'],benchmark:['benchmark'],kasbon:['kasbon']};
export async function mountPrivateDashboard(config,{load,mode='private-capability'}={}){
 // Defer continuation one task so all ordinary DOMContentLoaded handlers finish first.
 await new Promise(r=>setTimeout(r,0));
 if(document.readyState==='loading')await new Promise(r=>document.addEventListener('DOMContentLoaded',()=>setTimeout(r,0),{once:true}));
 if(document.readyState==='interactive')await new Promise(r=>setTimeout(r,0));
 let snapshot=null,generation=0,selectedWages=new Set(),wageSelectionRevision=0,healthValue=null,lastAttempt=null,lastSuccess=null,readFailed=false;
 function wageSelection(){document.querySelectorAll('.upah-check').forEach(x=>{if(x.checked)selectedWages.add(x.dataset.id);else selectedWages.delete(x.dataset.id);});return [...selectedWages];}
 function restoreWages(ids){selectedWages=new Set(ids);document.querySelectorAll('.upah-check').forEach(x=>x.checked=selectedWages.has(x.dataset.id));}
 const isFixture=mode==='synthetic'||mode==='private-capture';
 document.body.dataset.ownerRead='active';document.body.dataset.restoredRead='active';
 const model={publicMode:mode==='public-live',privateMode:true,ownerActive:()=>snapshot!==null,summary:()=>({total:snapshot?.reports.length||0}),showOwner(){},showOwn(){}};window.dashboardReadModel=model;
 const status=document.createElement('p');status.id='restored-source-status';status.className='public-source-status';const header=document.createElement('header');header.className='public-page-header';const heading=document.createElement('div');const brand=document.createElement('span');brand.className='public-page-eyebrow';brand.textContent='Wakaf Produktif · Ngantang';const title=document.createElement('h1');title.textContent='Monitor Kebun';heading.append(brand,title,status);const entryLink=document.createElement('button');entryLink.type='button';entryLink.className='public-entry-link';entryLink.textContent='Masuk / Isi laporan';entryLink.onclick=()=>{document.querySelector('#tabs [data-panel="form"]')?.click();document.getElementById('device-entry-signin')?.focus();};header.append(heading,entryLink);document.querySelector('.content-wrap').prepend(header);
 document.addEventListener('change',e=>{if(e.target.matches('.upah-check, input[onchange="toggleAllPay(this)"]')){wageSelectionRevision++;selectedWages=new Set([...document.querySelectorAll('.upah-check:checked')].map(x=>x.dataset.id));}});
 function showHealth(){if(mode==='public-live'){const health=publicReadStatus(healthValue,{lastSuccess,readFailed});status.textContent=health.text;status.dataset.health=health.state;status.setAttribute('aria-label','Baca publik · '+health.text);status.setAttribute('role','status');return;}if(mode==='authenticated-session'){status.textContent='Baca privat · sesi akun berizin · baca terakhir '+(lastSuccess||'—')+(healthValue?._meta?.device_reports==='available:paired-read'?' · device_reports tercakup · receipt cocok · recorded-only, belum verifikasi lapangan':' · device_reports belum diizinkan oleh lingkup pembaca yang ada; bukan nol laporan perangkat.')+(readFailed?' · GAGAL membaca — data dibersihkan':'');status.setAttribute('role','status');return;}const h=snapshotHealth(healthValue,{lastAttempt,lastSuccess,readFailed});const label={stale:'STALE — capture melewati 24 jam',expired:'KEDALUWARSA — perbarui capability melalui pemulihan yang ditinjau',unknown:'Sumber privat belum tersedia — waktu capture/expiry belum diketahui','captured-daily':'capture terakhir tersedia'}[h.state];status.textContent=(isFixture?'SIMULASI/CAPTURE PRIVAT · ':'Baca privat · ')+'snapshot harian · bukan realtime · '+label+' · capture '+(h.captured_at||'—')+' · producer sukses '+(h.producer_last_success||'—')+' · upaya producer sesudahnya tidak diketahui · berikutnya perkiraan '+(h.next_due||'—')+' · expiry tetap '+(h.expires_at||'—')+' · baca terakhir '+(lastAttempt||'—')+' · baca sukses '+(lastSuccess||'—')+(readFailed?' · GAGAL membaca — data dibersihkan':'');status.dataset.health=h.state;status.setAttribute('role','status');}
 function clear(){wageSelection();snapshot=null;window.reportReadSession={active:false,generation:++generation};window.clearOwnerSnapshot();document.body.dataset.ownerRead='';document.querySelectorAll('.panel:not(#panel-form)').forEach(n=>{n.querySelectorAll('tbody,[id*=summary],[id*=grid],[id*=saldo]').forEach(x=>x.replaceChildren());});markUnknown();showHealth();}
 function markUnknown(){for(const [panel,keys] of Object.entries(domains)){const el=document.getElementById('panel-'+panel);if(!el)continue;const unavailable=keys.filter(k=>snapshot?.[k]==null);let note=el.querySelector(':scope > .domain-status');if(!note){note=document.createElement('p');note.className='domain-status';el.prepend(note);}note.textContent=publicDomainNotice(snapshot,keys);note.hidden=!note.textContent;for(const child of [...el.children])if(child!==note)child.hidden=unavailable.length===keys.length;}
 // Independent nested cards must not inherit another domain's missing status.
 const groups=[['worker-cards-grid','workers'],['distribusi-kpi','pic'],['chart-distribusi','pic'],['distribusi-fase-list','pic'],['upah-summary-cards','upah'],['upah-tbody','upah'],['cashbook-tbody','cashbook']];
 for(const [id,key]of groups){const target=document.getElementById(id);if(!target)continue;const host=target.closest('.card')||target;let note=host.querySelector(':scope > .domain-status[data-domain="'+key+'"]');if(!note){note=document.createElement('p');note.className='domain-status';note.dataset.domain=key;host.prepend(note);}const absent=snapshot?.[key]==null;note.textContent=domainWarning(snapshot?._meta,key)||(absent?'Informasi pada bagian ini belum tersedia.':Array.isArray(snapshot[key])&&snapshot[key].length===0?'Belum ada catatan pada bagian ini.':'');note.hidden=!note.textContent;for(const child of [...host.children])if(child!==note&&!child.classList.contains('domain-status'))child.hidden=absent;
 }
}
 function apply(value){if(!value||!Array.isArray(value.reports)||['upah','cashbook','workers','pic','kasbon'].some(k=>value[k]!=null&&!Array.isArray(value[k])))throw Error('Sumber tidak lengkap');const choices=wageSelection();snapshot=structuredClone(value);snapshot.reports=snapshot.reports.map(window.normalizeOwnerReport);document.body.dataset.ownerRead='active';window.applyOwnerSnapshot(snapshot);window.reportReadSession={active:true,generation:++generation};markUnknown();if(snapshot.sop==null||snapshot.sopStatus==null)document.getElementById('kpi-compliance').textContent='—';if(snapshot.panen==null)document.getElementById('dash-panen-summary')?.replaceChildren(document.createTextNode('Informasi panen dan inventaris belum tersedia.'));healthValue={_meta:structuredClone(snapshot._meta||{})};lastSuccess=new Date().toISOString();readFailed=false;showHealth();for(const fn of ['renderActivityChart','renderPelaporChart','renderKeuangan','renderWorkersTab'])window[fn]?.();restoreWages(choices);markUnknown();}
 let reader;
 if(load){let request=0;const read=async()=>{const ticket=++request;if(mode!=='public-live')clear();try{const v=await load();if(ticket!==request)throw Error('Sumber berubah');apply(v);return v;}catch(e){if(ticket===request&&mode!=='public-live')clear();throw e;}};reader={read,invalidate:()=>{request++;},exportRead:async emit=>{const pending=read(),ticket=request,v=await pending;if(ticket!==request||!snapshot||!window.reportReadSession.active)throw Error('Sumber berubah');return emit(v);}};}else{
 const secret=window.__ownerFragment;window.__ownerFragment=null;const db=getFirestore(initializeApp(config,'wakaf-owner-capability-v1'));
 reader=createPrivateReader({secret,scope:'wakaf-ngantang:owner-finance-v1',fetchDocument:id=>getDocFromServer(doc(db,'owner_read_bundles',id)),onData:apply,onClear:clear});
 }
 reader={...reader};const rawRead=reader.read.bind(reader);reader.read=async()=>{lastAttempt=new Date().toISOString();readFailed=false;showHealth();try{const value=await rawRead();lastSuccess=new Date().toISOString();showHealth();return value;}catch(e){readFailed=true;showHealth();throw e;}};
 const rawExport=reader.exportRead.bind(reader);reader.exportRead=async emit=>{lastAttempt=new Date().toISOString();try{const value=await rawExport(emit);readFailed=false;lastSuccess=new Date().toISOString();showHealth();return value;}catch(e){readFailed=true;showHealth();throw e;}};
 const mapping={laporan:'reports',report_heads:'reports',upah:'upah',cashbook:'cashbook',panen_data:'panen',panen_lots:'lots',panen_sampling:'sampling',opt_observations:'opt',milestones:'milestones',sop_status:'sopStatus',worker_defs_custom:'workers'};
 window.privateReader={allowed:c=>!!snapshot&&snapshot[mapping[c]||c]!=null,matches:()=>!!snapshot,exportRead:async(required,emit)=>reader.exportRead(v=>{requireFreshPublicData(v,required.map(c=>mapping[c]||c));if(required.some(c=>v[mapping[c]||c]==null))throw Error('Sumber ekspor belum tersedia');const out={};for(const c of required)out[c]=c==='report_heads'?[]:c==='laporan'?v.reports.map(x=>({id:x.id,data:x})):c==='upah'?[{id:'active',data:{data:v.upah}}]:c==='cashbook'?[{id:'active',data:{data:v.cashbook}}]:v[mapping[c]||c];return emit(out);})};window.decodePrivateReports=rows=>rows.map(x=>structuredClone(x.data));
 async function payrollOutput(mode){
  const selected=wageSelection(),revision=wageSelectionRevision;let preview=null;
  try{
   const ids=[...new Set(selected.map(payrollID))];if(!ids.length)throw Error('Pilih item upah terlebih dahulu');
   const exactBoxes=()=>{const boxes=[...document.querySelectorAll('.upah-check')];if(ids.some(id=>boxes.filter(x=>x.dataset.id===id&&x.checked).length!==1))throw Error('Pilihan berubah atau tidak tersedia');};
   exactBoxes();preview=openPayrollPreview();await reader.exportRead(async v=>{
    if(revision!==wageSelectionRevision)throw Error('Pilihan sudah berubah');
    const boxes=[...document.querySelectorAll('.upah-check')];if(ids.some(id=>boxes.filter(x=>x.dataset.id===id).length!==1))throw Error('Pilihan tidak tersedia setelah baca ulang');
    restoreWages(ids);const sourceGeneration=generation;
    const assertCurrent=()=>{if(revision!==wageSelectionRevision||sourceGeneration!==generation||!window.reportReadSession?.active)throw Error('Pilihan/sumber berubah; buat ulang dokumen');exactBoxes();};
    const d=buildPayrollDocument({value:v,selected:ids,mode,names:window.payrollDocumentNames?.()||{}});
    await renderPayrollPNG(d,{assertCurrent,preview});
   });
  }catch(e){preview?.close();alert('Dokumen ditahan — '+(e.message||'sumber perlu dimuat ulang')+'. Tidak ada pembayaran atau saldo yang diubah.');}
 }
 window.generateRekapUpah=()=>payrollOutput('rekap');
 window.generateBuktiBayar=mode=>payrollOutput(mode==='rekap'?'rekap':'proof');
 window.viewOptDetail=id=>{const rows=snapshot?.opt;if(!Array.isArray(rows))return;const matches=rows.filter(row=>row.id===id);if(matches.length!==1){alert('Observasi tidak tersedia atau identitas tidak unik.');return;}showPublicOptDetail(matches[0]);};
 // Owner read has no entry or finance-write authority; the ordinary route retains the device collector.
 model.refresh=()=>reader.read().catch(()=>{});await model.refresh();
 if(mode==='public-live'){
  const refreshButton=document.createElement('button');refreshButton.type='button';refreshButton.className='public-entry-link';refreshButton.textContent='Perbarui data';refreshButton.id='public-refresh-data';
  const refreshNote=document.createElement('p');refreshNote.className='public-source-status';refreshNote.textContent='Pembaruan otomatis dimatikan untuk menghemat kuota. Tekan Perbarui data untuk mengambil data terbaru.';refreshNote.setAttribute('role','status');heading.append(refreshNote);header.append(refreshButton);
  bindPublicRefresh({button:refreshButton,note:refreshNote,read:()=>reader.read()});
 }else{window.addEventListener('online',()=>reader.read().catch(()=>{}));if(!isFixture){setInterval(model.refresh,60000);setInterval(showHealth,1000);}}
 model.clear=()=>{reader.invalidate?.();clear();};
 document.getElementById('tabs').addEventListener('click',()=>queueMicrotask(markUnknown));return model;
}
export async function mountRestoredDashboard(config){
 if(window.__restorationAdapter)return mountPrivateDashboard(config,window.__restorationAdapter);
 if(window.__ownerFragment)return mountPrivateDashboard(config);
 if(new URLSearchParams(location.search).get('reader')==='owner')return (await import('./owner-session.js')).mountOwnerSession(config);
 return (await import('./public-reader.js')).mountPublicDashboard(config);
}
