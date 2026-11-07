// Public read-only adapter. Uses existing server collections and owner validation, never Auth or writes.
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {getFirestore,collection,getDocsFromServer} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import {OWNER_READ_COLLECTIONS,validateOwnerSnapshot} from './owner-dashboard.js';
import {mountPrivateDashboard} from './restored-dashboard.js';
export const PUBLIC_READ_COLLECTIONS=Object.freeze([...OWNER_READ_COLLECTIONS]);
const reportSources=['laporan','report_heads','entry_receipts','operation_events','operation_receipts','device_reports','device_receipts'];
const domainSources={upah:'upah',cashbook:'cashbook',opt:'opt_observations',panen:'panen_data',lots:'panen_lots',sampling:'panen_sampling',benchmark:'panen_sampling',pic:'distribusi_pic',workers:'worker_defs_custom',milestones:'milestones',sopStatus:'sop_status',cabut:'sop_status',kasbon:'sop_status',pupuk:'sop_status',sop:'sop_master',invoices:'invoices'};
function decodeReports(rows,lastReports=new Map()){
 const ids=new Set(['laporan','device_reports','report_heads'].flatMap(c=>(rows[c]||[]).map(r=>r.id))),reports=[];let rejected=0,retained=0;
 for(const id of ids){
  const selected=Object.fromEntries(reportSources.map(c=>[c,(rows[c]||[]).filter(r=>r.id===id)]));
  // Only this report's correction chain belongs in its validation unit.
  const head=selected.report_heads[0]?.data;let command=head?.command_id;const seen=new Set();
  selected.operation_events=[];selected.operation_receipts=[];
  while(typeof command==='string'&&!seen.has(command)&&seen.size<500){seen.add(command);const e=(rows.operation_events||[]).filter(r=>r.id===command);selected.operation_events.push(...e);selected.operation_receipts.push(...(rows.operation_receipts||[]).filter(r=>r.id===command));command=e[0]?.data?.operation?.predecessor;}
  try{const valid=validateOwnerSnapshot(selected).reports;reports.push(...valid);for(const report of valid)lastReports.set(report.id,structuredClone(report));}catch{rejected++;if(lastReports.has(id)){reports.push(structuredClone(lastReports.get(id)));retained++;}}
 }
 for(const id of lastReports.keys())if(!ids.has(id))lastReports.delete(id);
 return {reports,rejected,retained};
}
export function createPublicReader({readCollection,timeoutMs=15000}){
 const rows={},collections={},previous={},lastReports=new Map();let pending=null,stopped=false;
 const bounded=c=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Object.assign(Error('server-timeout'),{code:'deadline-exceeded'})),timeoutMs);Promise.resolve().then(()=>readCollection(c)).then(resolve,reject).finally(()=>clearTimeout(timer));});
 async function collect(){
  await Promise.all(PUBLIC_READ_COLLECTIONS.map(async c=>{
   const attemptedAt=new Date().toISOString();
   try{const next=await bounded(c);if(!Array.isArray(next)||next.some(r=>!r||typeof r.id!=='string'||!r.data))throw Error('invalid-source');if(!reportSources.includes(c))validateOwnerSnapshot({[c]:next});rows[c]=next;collections[c]={state:next.length?'available':'empty',lastSuccess:attemptedAt,lastAttempt:attemptedAt};}
   catch(e){collections[c]={...collections[c],state:rows[c]?'stale':'error',lastAttempt:attemptedAt,code:['permission-denied','unavailable','deadline-exceeded'].includes(e.code)?e.code:'source-unavailable'};}
  }));
  const value=validateOwnerSnapshot(Object.fromEntries(Object.entries(rows).filter(([c])=>!reportSources.includes(c)))),domains={};
  const decoded=decodeReports(rows,lastReports),unavailable=reportSources.filter(c=>['stale','error'].includes(collections[c].state));
  if(unavailable.length&&previous.reports){value.reports=structuredClone(previous.reports);domains.reports={state:'stale',unavailable,rejected:decoded.rejected,retained:decoded.retained};}
  else{value.reports=decoded.reports;domains.reports={state:unavailable.length||decoded.rejected?'partial':decoded.reports.length?'available':'empty',unavailable,rejected:decoded.rejected,retained:decoded.retained};if(!unavailable.length&&!decoded.rejected)previous.reports=structuredClone(value.reports);}
  for(const [key,c]of Object.entries(domainSources))domains[key]={state:['stale','error'].includes(collections[c].state)?collections[c].state:value[key]==null?'missing':Array.isArray(value[key])&&!value[key].length?'empty':'available',sources:[c]};
  const errors=PUBLIC_READ_COLLECTIONS.filter(c=>['stale','error'].includes(collections[c].state));if(decoded.rejected)errors.push('reports:invalid-rows');
  value.raw=structuredClone(rows);
  value.missing=Object.keys(domains).filter(k=>value[k]==null);
  if(stopped)throw Error('reader-stopped');
  return {...value,_meta:{access:'public-live',collections:structuredClone(collections),domains,errors}};
 }
 function read(){if(stopped)return Promise.reject(Error('reader-stopped'));if(!pending)pending=collect().finally(()=>{pending=null;});return pending;}
 return Object.freeze({read,stop:()=>{stopped=true;}});
}
export async function mountPublicDashboard(config){
 const app=getApps().find(x=>x.name==='[DEFAULT]')||initializeApp(config),db=getFirestore(app);
 const reader=createPublicReader({readCollection:async c=>{
  const snapshot=await getDocsFromServer(collection(db,c));
  if(!snapshot.metadata||snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)throw Object.assign(Error('server-unconfirmed'),{code:'unavailable'});
  return snapshot.docs.map(d=>({id:d.id,data:d.data()}));
 }});
 // Original shell owns its existing 60-second/online refresh lifecycle. Each read has a 15-second bound.
 const model=await mountPrivateDashboard(config,{mode:'public-live',load:()=>reader.read()});
 model.publicMode=true;model.privateMode=true;window.dashboardReadModel=model;
 return model;
}
