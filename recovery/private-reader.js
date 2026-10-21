// Private read lifecycle only. Never grants writes, provisions identities, or uses durable caches.
import {onSnapshot as sdkSnapshot,getDocFromServer,getDocsFromServer,collection,doc} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
export const PRIVATE_COLLECTIONS=Object.freeze('upah cashbook opt_observations panen_data panen_lots panen_sampling distribusi_pic sop_master worker_defs_custom milestones invoices worker_tokens workers sop_status laporan operation_events operation_receipts report_heads cabut_state entry_receipts'.split(' '));
export function createPrivateReader({session,db,clear}){
 let serial=0,scopes=new Set(),ready=false,loading=false;const listeners=new Set(),timers=new Set(),waiters=new Set();let authorityOff=[],exportBusy=false;
 const collectionOf=r=>(r.path||r._query?.path?.canonicalString?.()||'').split('/')[0];
 const ticket=()=>({serial,session:session.sessionTicket()});
 const matches=t=>ready&&t.serial===serial&&session.sessionMatches(t.session);
 function stop(){for(const w of waiters)w.reject(Error('reader-superseded'));waiters.clear();serial++;ready=false;loading=false;scopes.clear();for(const off of authorityOff)off();authorityOff=[];for(const t of timers)clearTimeout(t);timers.clear();for(const l of listeners){l.off?.();l.off=null;}clear();window.dispatchEvent(new CustomEvent('private-reader-stopped'));}
 async function refresh(){stop();const n=serial,s=session.sessionTicket();if(!s)return;loading=true;try{const p=await session.readPermissionStatus();if(n!==serial||!session.sessionMatches(s))return;scopes=new Set(p.collections);loading=false;ready=true;for(const w of waiters)w.resolve();waiters.clear();watchAuthority(p,s);for(const l of listeners)start(l);window.dispatchEvent(new CustomEvent('private-reader-ready'));}catch(e){if(n===serial){loading=false;for(const w of waiters)w.reject(Error('private-read-unavailable'));waiters.clear();}}}
 function watchAuthority(p,s){
  const t=ticket(),reader=p.readerEpoch!==null;
  const paths=reader?['reader_policy/active','reader_grants/'+s.uid]:['entry_policy/active','entry_grants/'+s.uid];
  paths.forEach((path,i)=>{authorityOff.push(sdkSnapshot(doc(db,path),snap=>{
   if(!matches(t)||snap.metadata.fromCache)return;const d=snap.data();
   const valid=reader?(i===0?d&&Object.keys(d).length===1&&d.reader_epoch===p.readerEpoch:d&&Object.keys(d).length===4&&d.uid===s.uid&&d.enabled===true&&d.reader_epoch===p.readerEpoch&&Array.isArray(d.collections)&&JSON.stringify(d.collections)===JSON.stringify(p.collections)):(d&&(i===0?d.paused===false&&d.writer_epoch===p.writerEpoch:d.uid===s.uid&&d.enabled===true&&d.role==='staff'&&d.writer_epoch===p.writerEpoch&&d.grant_epoch===p.grantEpoch));
   if(!valid)stop();
  },()=>{if(matches(t))stop();}));});
 }
 function start(l){if(!ready||l.off||!scopes.has(collectionOf(l.ref)))return;const t=ticket();l.off=sdkSnapshot(l.ref,s=>{if(!matches(t)||s.metadata.fromCache)return;l.next(s);},e=>{if(!matches(t))return;l.off=null;l.error?.(e);});}
 function onSnapshot(ref,next,error){const l={ref,next,error,off:null};listeners.add(l);start(l);return()=>{l.off?.();listeners.delete(l);};}
 async function getDoc(ref){const t=ticket();if(!ready&&loading&&t.session){await new Promise((resolve,reject)=>waiters.add({resolve,reject}));}if(!matches(t)||!scopes.has(collectionOf(ref)))throw Object.assign(Error('private-read-unavailable'),{code:'permission-denied'});const v=await getDocFromServer(ref);if(!matches(t))throw Error('session-changed');return v;}
 function later(fn,ms,...args){const t=ticket();const id=setTimeout(()=>{timers.delete(id);if(t.serial!==serial||!session.sessionMatches(t.session))return;fn(...args);},ms);timers.add(id);return id;}
 async function exportRead(required,emit){
  if(exportBusy)throw Error('export-busy');exportBusy=true;
  try{
   const t=ticket();if(!matches(t)||!Array.isArray(required)||new Set(required).size!==required.length||required.some(c=>!scopes.has(c)))throw Error('private-export-unavailable');
   const p=await session.readPermissionStatus();if(!matches(t)||required.some(c=>!p.collections.includes(c)))throw Error('private-export-unavailable');
   const rows={};for(const c of required){const snap=await getDocsFromServer(collection(db,c));if(!matches(t)||snap.metadata.fromCache||snap.metadata.hasPendingWrites)throw Error('private-export-not-server');rows[c]=snap.docs.map(d=>({id:d.id,data:d.data()}));}
   const end=await session.readPermissionStatus();if(!matches(t)||JSON.stringify(end)!==JSON.stringify(p))throw Error('private-export-authority-changed');
   return await emit(rows);
  }finally{exportBusy=false;}
 }
 session.observeSession(()=>{void refresh();});
 return Object.freeze({onSnapshot,getDoc,later,refresh,stop,exportRead,allowed:c=>ready&&scopes.has(c),ticket,matches});
}
