// Browser adaptation of hash-pinned reviewed read-only report authority. No provider/authority lifecycle.
import {validReportBody} from './authorized-reports.js';
import {validOperation} from './versioned-operations.js';
const canonical=x=>globalThis.workerReportContent(x);
// Preserve SDK timestamp nanoseconds before canonical equality; never JSON-round timestamps.
function project(x){
 if(x&&typeof x.toDate==='function'&&Number.isInteger(x.seconds)&&Number.isInteger(x.nanoseconds)){
  if(x.nanoseconds<0||x.nanoseconds>=1000000000)throw Error('report-integrity-rejected');
  return new Date(x.seconds*1000).toISOString().slice(0,19)+'.'+String(x.nanoseconds).padStart(9,'0')+'Z';
 }
 if(Array.isArray(x))return x.map(project);
 if(x!==null&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,project(v)]));
 return x;
}
const fail=()=>{throw Error('report-integrity-rejected');};
const map=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,k)=>map(x)&&Object.keys(x).sort().join(',')===k.split(' ').sort().join(',');
const positive=x=>Number.isSafeInteger(x)&&x>0;
const equal=(a,b)=>canonical(a)===canonical(b);
// ADR-054 (keluhan #48): device-lane detail amendment. Only `detail` may differ from the original body;
// date, worker, duration, plots, category and every other field stay locked to the original.
export const DEVICE_DETAIL_KIND='device_detail';
export function sameExceptDetail(original,next){
 if(!map(original)||!map(next))return false;
 const {detail:a,...lockedA}=original,{detail:b,...lockedB}=next;
 return equal(lockedA,lockedB)&&typeof b==='string'&&b.trim().length>0&&b.length<=2000;
}
// Firestore REST preserves up to nanosecond precision; do not round to milliseconds.
function timestamp(x){if(typeof x!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(x))return false;const d=new Date(x);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,19)===x.slice(0,19);}
export function authority(input){
 for(const rows of Object.values(input))if(!Array.isArray(rows)||rows.some(r=>!r||typeof r.id!=='string'||!r.data)||new Set(rows.map(r=>r.id)).size!==rows.length)fail();
 const source=Object.fromEntries(Object.entries(input).map(([lane,rows])=>[lane,rows.map(r=>({id:r.id,data:project(r.data)}))]));
 const index=lane=>new Map(source[lane].map(r=>[r.id,r.data]));
 const receipts={laporan:index('entry_receipts'),device_reports:index('device_receipts')},heads=index('report_heads'),events=index('operation_events'),ops=index('operation_receipts');
 const originals=new Map(),result=[];
 function base(lane,r){const d=r.data;
  if(map(d.submitted_body)&&Object.hasOwn(d.submitted_body,'id')&&d.submitted_body.id!==r.id)throw Error('report-identity-mismatch');
  const head=heads.get(r.id);if(map(head?.body)&&Object.hasOwn(head.body,'id')&&head.body.id!==r.id)throw Error('report-identity-mismatch');
  if(!Object.hasOwn(d,'contract_version')){
   if(lane==='device_reports')fail();
   // Only genuinely plain historical bodies are legacy. Partial modern envelopes fail closed.
   if(['submitted_body','report_id','command_id','owner_uid','committed_revision','committed_at','writer_epoch','grant_epoch','roster_version'].some(k=>Object.hasOwn(d,k)))fail();
   if(Object.hasOwn(d,'id')&&d.id!==r.id)throw Error('report-identity-mismatch');
   return {body:d,modern:false};
  }
  const epoch=lane==='laporan'?'grant_epoch':'roster_version';
  if(!keys(d,'contract_version report_id command_id writer_epoch '+epoch+' submitted_body owner_uid committed_revision committed_at')||d.contract_version!==1||d.report_id!==r.id||d.command_id!==r.id||d.submitted_body?.id!==r.id||!positive(d.writer_epoch)||!(lane==='laporan'?positive(d.grant_epoch):typeof d.roster_version==='string'&&d.roster_version.length>0)||typeof d.owner_uid!=='string'||!d.owner_uid||d.committed_revision!==1||!timestamp(d.committed_at)||!validReportBody(d.submitted_body)||!receipts[lane].has(r.id)||!equal(d,receipts[lane].get(r.id)))fail();
  return {body:d.submitted_body,modern:true,owner:d.owner_uid,binding:lane==='device_reports'?{writer_epoch:d.writer_epoch,roster_version:d.roster_version}:null};
 }
 // Compare original bodies BEFORE any common correction head can erase divergence.
 for(const lane of ['laporan','device_reports'])for(const r of source[lane]){const b=base(lane,r),old=originals.get(r.id);if(old&&(!equal(old.body,b.body)||old.modern!==b.modern||old.owner!==b.owner))throw Error('report-identity-conflict');originals.set(r.id,b);result.push({lane,r,...b});}
 function corrected(entry,h){const {r,body,modern,owner}=entry;
  if(!modern||body.schema_version!=='3.5'||!keys(h,'revision command_id owner_uid body')||!positive(h.revision)||h.revision<2||h.revision>501||h.owner_uid!==owner||h.body?.id!==r.id)fail();
  let cid=h.command_id,revision=h.revision,first=true;const seen=new Set();
  while(revision>1){if(seen.has(cid)||seen.size>=500)fail();seen.add(cid);const e=events.get(cid),receipt=ops.get(cid);
   if(!keys(e,'operation owner_uid writer_epoch grant_epoch revision committed_at')||!receipt||!equal(e,receipt)||!positive(e.writer_epoch)||!positive(e.grant_epoch)||!timestamp(e.committed_at)||e.owner_uid!==owner||e.revision!==revision||!validOperation(e.operation))fail();
   const o=e.operation;if(o.kind!=='correction'||o.command_id!==cid||o.target!==r.id||o.body.id!==r.id||o.expected_revision!==revision-1||first&&!equal(h.body,o.body))fail();
   if(revision===2&&o.predecessor!==r.id)fail();cid=o.predecessor;revision--;first=false;
  }
  return h.body;
 }
 function correctedDevice(entry,h){const {r,body,modern,owner,binding}=entry;
  if(!modern||!binding||body.schema_version!=='3.5'||!keys(h,'revision command_id owner_uid body')||!positive(h.revision)||h.revision<2||h.revision>501||h.owner_uid!==owner||h.body?.id!==r.id||!sameExceptDetail(body,h.body))fail();
  let cid=h.command_id,revision=h.revision,first=true;const seen=new Set();
  while(revision>1){if(seen.has(cid)||seen.size>=500)fail();seen.add(cid);const e=events.get(cid),receipt=ops.get(cid);
   if(!keys(e,'operation owner_uid writer_epoch roster_version revision committed_at')||!receipt||!equal(e,receipt)||e.writer_epoch!==binding.writer_epoch||e.roster_version!==binding.roster_version||!timestamp(e.committed_at)||e.owner_uid!==owner||e.revision!==revision)fail();
   const o=e.operation;
   if(!keys(o,'kind command_id target expected_revision predecessor reason body')||o.kind!==DEVICE_DETAIL_KIND||o.command_id!==cid||!/^cmd_[A-Za-z0-9_-]{1,96}$/.test(cid)||o.target!==r.id||o.body?.id!==r.id||o.expected_revision!==revision-1||typeof o.reason!=='string'||!o.reason.trim()||o.reason.length>500||!validReportBody(o.body)||!sameExceptDetail(body,o.body)||first&&!equal(h.body,o.body))fail();
   if(revision===2&&o.predecessor!==r.id)fail();cid=o.predecessor;revision--;first=false;
  }
  return h.body;
 }
 for(const id of heads.keys())if(!source.laporan.some(r=>r.id===id)&&!source.device_reports.some(r=>r.id===id))fail();
 const out=new Map();for(const entry of result){const {lane,r}=entry,h=heads.get(r.id);let body=entry.body;
  if(h&&lane==='laporan')body=corrected(entry,h);
  // Device documents never inherit staff correction authority. A device-only report accepts only its own
  // detail-amendment chain (ADR-054); a report present in both lanes keeps the staff chain on the laporan side.
  const deviceOnly=lane==='device_reports'&&!source.laporan.some(x=>x.id===r.id);
  if(h&&deviceOnly)body=correctedDevice(entry,h);
  const integrity=!entry.modern?'legacy-unreceipted':h&&lane==='laporan'?'paired-correction-chain':h&&deviceOnly?'paired-detail-correction-chain':'paired-original';
  const row={...body,id:r.id,_provenance:{status:'recorded-only',integrity,lane}};
  if(out.has(r.id)){const previous=out.get(r.id);if(!equal({...previous,_provenance:null},{...row,_provenance:null}))throw Error('report-identity-conflict');previous._provenance.lane='laporan+device_reports';}else out.set(r.id,row);
 }
 return [...out.values()];
}
