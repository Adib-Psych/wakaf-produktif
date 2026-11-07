'use strict';
const {validReportBody}=require('./report-body.cjs');
const {Timestamp}=require('firebase-admin/firestore');
const {createHash}=require('node:crypto');
const {isDeepStrictEqual:equal}=require('node:util');
const lanes={device_reports:'device_receipts',laporan:'entry_receipts'};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exactKeys=(x,keys)=>obj(x)&&equal(Object.keys(x).sort(),keys.split(' ').sort());
const positive=x=>Number.isSafeInteger(x)&&x>0;
const calendar=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
function canonical(x){if(x===null||typeof x!=='object')return JSON.stringify(x);if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';}
const canonicalHash=x=>createHash('sha256').update(canonical(x),'utf8').digest('hex');
const wageId=(token,date)=>`wage_v1_${token}_${date}`;
const reportKey=(lane,id)=>`report_v1_${lane}_${id}`;
function policyValid(p){
 if(!obj(p)||p.contract_version!==1||!obj(p.workers)||!Object.keys(p.workers).length)return false;
 if(Object.keys(p).some(k=>!['contract_version','workers','legacy_report_hashes'].includes(k)))return false;
 const aliases=new Map();
 for(const [id,w] of Object.entries(p.workers)){
  if(!/^(?:w_[a-f0-9]{24}|[A-Z][A-Z0-9_]{0,63})$/.test(id)||!exactKeys(w,'legacy_token name half_day full_day effective_from')||!/^[A-Z][A-Z0-9_]{0,63}$/.test(w.legacy_token)||typeof w.name!=='string'||!w.name.trim()||!positive(w.half_day)||!positive(w.full_day)||!calendar(w.effective_from))return false;
  if(aliases.has(w.legacy_token)&&!equal(aliases.get(w.legacy_token),w))return false;
  aliases.set(w.legacy_token,w);
 }
 return p.legacy_report_hashes===undefined||obj(p.legacy_report_hashes)&&Object.entries(p.legacy_report_hashes).every(([k,v])=>/^lap_[A-Za-z0-9_-]{1,96}$/.test(k)&&/^[a-f0-9]{64}$/.test(v));
}
function original(lane,id,a,b){
 if(!a||!b)return 'pair_missing';
 if(!equal(a,b))return 'pair_mismatch';
 const extra=lane==='laporan'?'grant_epoch':'roster_version';
 if(!exactKeys(a,'contract_version report_id command_id writer_epoch '+extra+' submitted_body owner_uid committed_revision committed_at')||a.contract_version!==1||a.report_id!==id||a.command_id!==id||a.submitted_body?.id!==id||!positive(a.writer_epoch)||!(lane==='laporan'?positive(a.grant_epoch):typeof a.roster_version==='string'&&a.roster_version.length>0)||typeof a.owner_uid!=='string'||!a.owner_uid||a.committed_revision!==1||!(a.committed_at instanceof Timestamp)||!validReportBody(a.submitted_body))return 'original_contract_invalid';
 return null;
}
function legacyReason(lane,id,raw,receipt,p,acceptLegacy){
 if(lane!=='laporan'||!acceptLegacy)return 'legacy_not_enabled';
 if(!raw||['contract_version','submitted_body','report_id','command_id','owner_uid','committed_revision','committed_at','writer_epoch','grant_epoch','roster_version'].some(k=>Object.hasOwn(raw,k))||receipt)return 'legacy_shape_invalid';
 if(p.legacy_report_hashes?.[id]!==canonicalHash(raw))return 'legacy_hash_unapproved';
 // Historical sync/edit annotations are attested in the hash, but not part of the original body schema.
 const {last_synced_at,last_edited_at,...body}=raw;
 return body.id!==id||!validReportBody(body)?'legacy_body_invalid':null;
}
async function processCreated(db,lane,id,{acceptLegacy=false}={}){
 if(!lanes[lane]||!/^lap_[A-Za-z0-9_-]{1,96}$/.test(id)||typeof acceptLegacy!=='boolean')throw Error('invalid-source');
 return db.runTransaction(async tx=>{
  const [r,c,ps,old]=await Promise.all([tx.get(db.doc(`${lane}/${id}`)),tx.get(db.doc(`${lanes[lane]}/${id}`)),tx.get(db.doc('wage_policy/active')),tx.get(db.doc('upah/active'))]);
  const p=ps.data(),first=r.data()||c.data(),body=first?.submitted_body||first;
  const reportRef=db.doc(`wage_processing/${reportKey(lane,id)}`),reportSnapshot=await tx.get(reportRef);
  const reportFailure=reason=>{const result={status:'unresolved',reason,report_id:id,tgl:calendar(body?.tanggal)?body.tanggal:null,worker:null};if(!equal(reportSnapshot.data(),result))tx.set(reportRef,result);return result;};
  if(!policyValid(p))return reportFailure('policy_invalid');
  const w=p.workers[body?.pelapor];
  if(!w)return reportFailure('worker_unmapped');
  if(!calendar(body?.tanggal))return reportFailure('business_date_invalid');
  const key=wageId(w.legacy_token,body.tanggal),ref=db.doc(`wage_entitlements/${key}`),existing=await tx.get(ref);
  const aggregateRef=db.doc(`wage_processing/${key}`),aggregateSnapshot=await tx.get(aggregateRef);
  const snapshots=await Promise.all(Object.keys(lanes).flatMap(l=>['submitted_body.tanggal','tanggal'].map(field=>tx.get(db.collection(l).where(field,'==',body.tanggal)))));
  const candidates=new Map();
  snapshots.forEach((s,i)=>s.docs.forEach(d=>{const l=Object.keys(lanes)[Math.floor(i/2)],v=d.data(),b=v.submitted_body||v;if(p.workers[b.pelapor]?.legacy_token===w.legacy_token)candidates.set(l+'/'+d.id,{lane:l,id:d.id,value:v,body:b,legacy:!Object.hasOwn(v,'contract_version')});}));
  // A receipt can arrive first. It is never evidence of a complete report by itself.
  if(!candidates.has(lane+'/'+id))candidates.set(lane+'/'+id,{lane,id,value:r.data(),body,legacy:!first?.contract_version});
  const entries=[...candidates.values()].sort((a,b)=>(a.lane+'/'+a.id).localeCompare(b.lane+'/'+b.id));
  const receipts=await Promise.all(entries.map(e=>tx.get(db.doc(`${lanes[e.lane]}/${e.id}`))));
  const heads=await Promise.all(entries.map(e=>tx.get(db.doc(`report_heads/${e.id}`))));
  let reason=null;
  const identities=new Map();
  for(const e of entries){const identity={body:e.body,owner:e.value?.owner_uid||null,legacy:e.legacy};if(identities.has(e.id)&&!equal(identities.get(e.id),identity))reason||='report_identity_conflict';identities.set(e.id,identity);}
  const sources=[];
  for(const [i,e] of entries.entries()){
   const error=e.legacy?legacyReason(e.lane,e.id,e.value,receipts[i].data(),p,acceptLegacy):original(e.lane,e.id,e.value,receipts[i].data());
   if(error){reason||=error;continue;}
   if(heads[i].exists)reason||='correction_requires_review';
   sources.push({lane:e.lane,report_id:e.id,revision:1,...(e.legacy?{attestation:'policy-sha256',body_hash:canonicalHash(e.value)}:{})});
  }
  const unitOf=d=>d==='satu_hari'?'full_day':d;
  const units=new Set(entries.map(e=>unitOf(e.body.durasi)));
  const fields=new Set(entries.flatMap(e=>e.body.schema_version==='3.5'?e.body.kebun_list||[]:e.body.kebun||[]));
  if(body.tanggal<w.effective_from)reason||='before_effective_date';
  if(units.has(null)||units.has('')||units.has(undefined))reason||='duration_missing';
  if([...units].some(x=>!['setengah_hari','full_day'].includes(x)))reason||='duration_unsupported';
  if(units.size>1)reason||='duration_conflict';
  if(!fields.size||[...fields].some(x=>!['K1','K2','K3','K4'].includes(x)))reason||='fund_missing';
  if(fields.has('K4')&&fields.size>1)reason||='mixed_funds';
  if(!old.exists||!Array.isArray(old.data()?.data)||old.data().data.some(x=>!obj(x)||typeof x.pelapor!=='string'||!calendar(x.tgl)))reason||='legacy_wage_ledger_unavailable';
  const legacy=Array.isArray(old.data()?.data)&&old.data().data.some(x=>(p.workers[x.pelapor]?.legacy_token||x.pelapor)===w.legacy_token&&x.tgl===body.tanggal);
  const unit=[...units][0],rate=unit==='setengah_hari'?w.half_day:w.full_day;
  const saved=existing.data();
  if(saved&&(saved.pelapor!==w.legacy_token||saved.tgl!==body.tanggal||saved.id!==key||saved.model!=='harian'||saved.qty!==1||saved.satuan!==unit||saved.tarif!==rate))reason||='existing_entitlement_conflict';
  let status=existing.exists?'existing':'created';
  const updateIfChanged=patch=>{if(Object.entries(patch).some(([k,v])=>!equal(saved[k],v)))tx.update(ref,patch);};
  if(legacy){status='existing';reason='legacy_wage_exists';if(saved?.status==='belum')updateIfChanged({eligible:false,blocked_reason:reason});}
  else if(reason){status='unresolved';if(saved?.status==='belum')updateIfChanged({eligible:false,blocked_reason:reason});}
  else if(!existing.exists)tx.create(ref,{id:key,pelapor:w.legacy_token,tgl:body.tanggal,worker:w.name,model:'harian',qty:1,satuan:unit,tarif:rate,status:'belum',eligible:true,sources,fund:fields.has('K4')?'K4':'K1_K3'});
  else if(saved.status==='belum')updateIfChanged({sources,eligible:true,...(saved.blocked_reason?{blocked_reason:null}:{})});
  const result={status,reason:reason||'eligible',report_id:id,tgl:body.tanggal,worker:w.legacy_token,sources};
  // Preserve the first successful creation receipt on exact redelivery; callers still get 'existing'.
  const sameOutcome=old=>old&&equal({...old,status:result.status},result)&&!(old.status==='unresolved'&&result.status!=='unresolved');
  const aggregateResult={...result,report_id:entries[0].id};
  const aggregateOld=aggregateSnapshot.data();
  if(!aggregateOld||!equal({...aggregateOld,status:aggregateResult.status},aggregateResult)||aggregateOld.status==='unresolved'&&aggregateResult.status!=='unresolved')tx.set(aggregateRef,aggregateResult);
  if(!sameOutcome(reportSnapshot.data()))tx.set(reportRef,result);
  return result;
 });
}
module.exports={processCreated,wageId,canonical,canonicalHash,policyValid,original};
