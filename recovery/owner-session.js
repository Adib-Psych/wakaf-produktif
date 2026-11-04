// Read-only bridge: existing persistent account session, exact effective reader scopes, original shell.
import {initializeApp,getApps} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {getFirestore} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import {createAuthorizedReports,mountReportSessionControls} from './authorized-reports.js';
import {createPrivateReader} from './private-reader.js';
import {OWNER_READ_COLLECTIONS,validateOwnerSnapshot} from './owner-dashboard.js';
import {mountPrivateDashboard} from './restored-dashboard.js';
export async function readSessionSnapshot(reader){
 const required=OWNER_READ_COLLECTIONS.filter(c=>reader.allowed(c));
 if(required.includes('device_reports')!==required.includes('device_receipts'))throw Error('Lingkup laporan/receipt perangkat belum lengkap');
 if(!required.includes('laporan')||!required.includes('report_heads'))throw Error('Lingkup laporan/revisi belum tersedia');
 return reader.exportRead(required,rows=>{
  const value=validateOwnerSnapshot(rows);
  value._meta={access:'authenticated-session',captured_at:new Date().toISOString(),device_reports:required.includes('device_reports')?'available:paired-read':'unavailable:not-in-existing-reader-scopes'};
  return value;
 });
}
export async function mountOwnerSession(config){
 const app=getApps().find(x=>x.name==='[DEFAULT]')||initializeApp(config),db=getFirestore(app);
 const session=createAuthorizedReports({app,db});
 const host=document.createElement('div');host.id='owner-session-access';host.className='device-save-status';document.querySelector('.content-wrap').prepend(host);
 const home=document.createElement('a');home.href='monitor-v2.html';home.textContent='Dashboard tanpa email / entry';host.append(home);
 mountReportSessionControls(session,host);
 let model=null,revision=0;
 const reader=createPrivateReader({session,db,clear:()=>{revision++;model?.clear();}});
 document.body.dataset.reportAccess='compact';
 model=await mountPrivateDashboard(config,{mode:'authenticated-session',load:async()=>{const current=revision;const value=await readSessionSnapshot(reader);if(current!==revision)throw Error('Sesi berubah');return value;}});
 window.addEventListener('private-reader-ready',()=>void model.refresh());
 if(reader.allowed('laporan'))await model.refresh();
 const refresh=document.createElement('button');refresh.type='button';refresh.textContent='Muat ulang data privat';refresh.onclick=()=>void reader.refresh();host.append(refresh);
 return model;
}
