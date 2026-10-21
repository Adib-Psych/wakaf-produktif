'use strict';
// Pure candidate only: never mutates input or writes cloud/browser state.
function measurement(observed,unit,targetUnit=unit){
 const base={observed,unit,targetUnit};
 if(observed==null || (typeof observed==='string' && !observed.trim()))return {...base,status:'missing',value:null,converted:null};
 const mass=['g','kg'];
 if(!(mass.includes(unit)&&mass.includes(targetUnit)) && !(unit==='trees'&&targetUnit==='trees'))return {...base,status:'invalid',reason:'unit'};
 if(typeof observed!=='number' && !(typeof observed==='string' && /^\d+(?:[.,]\d+)?$/.test(observed.trim())))return {...base,status:'invalid',reason:'number'};
 const value=typeof observed==='number'?observed:Number(observed.trim().replace(',','.'));
 const converted=value*(unit==='kg'&&targetUnit==='g'?1000:unit==='g'&&targetUnit==='kg'?0.001:1);
 if(!Number.isFinite(value)||value<0||!Number.isFinite(converted)||(unit==='trees'&&!Number.isSafeInteger(value)))return {...base,status:'invalid',reason:'range'};
 return {...base,status:'valid',value,converted};
}
function planSort(snapshot,event,expectedRevision){
 if(!snapshot||!event||!Array.isArray(snapshot.batches)||!Array.isArray(snapshot.lots)||!Array.isArray(snapshot.sortEvents)||!event.id||!event.batchId||!['remainder','measured'].includes(event.mode)||event.unit!=='kg')return {status:'invalid',reason:'shape'};
 if(!expectedRevision||snapshot.revision!==expectedRevision)return {status:'conflict',reason:'revision'};
 const previous=snapshot.sortEvents.find(e=>e.id===event.id);
 if(previous)return {status:require('node:util').isDeepStrictEqual(previous,event)?'noop':'conflict',reason:'identity'};
 const batches=snapshot.batches.filter(b=>b.id===event.batchId);
 if(batches.length!==1)return {status:'invalid',reason:'parent'};
 const batch=batches[0];
 if(batch.has_split||snapshot.lots.some(l=>l.parent_batch_id===batch.id)||snapshot.sortEvents.some(e=>e.batchId===batch.id))return {status:'review-required',reason:'existing-split'};
 const keys=['gross','floating','kuning','hijau','hitam',...(event.mode==='measured'?['merah']:[])];
 const readings=Object.fromEntries(keys.map(k=>[k,measurement(event[k],event.unit,'kg')]));
 if(Object.values(readings).some(r=>r.status==='invalid'))return {status:'invalid',reason:'measurement',readings};
 if(Object.values(readings).some(r=>r.status==='missing'))return {status:'incomplete',readings};
 const v=Object.fromEntries(Object.entries(readings).map(([k,r])=>[k,r.value]));
 const parent=measurement(batch.cherry_kg,'kg','kg');
 if(parent.status!=='valid'||parent.value!==v.gross||v.gross<=0)return {status:'review-required',reason:'gross-denominator',readings};
 const remainder=v.gross-v.floating-v.kuning-v.hijau-v.hitam;
 const red=event.mode==='measured'?v.merah:remainder;
 const delta=event.mode==='measured'?v.floating+v.merah+v.kuning+v.hijau+v.hitam-v.gross:0;
 if(remainder<0||Math.abs(delta)>Number.EPSILON*Math.max(1,v.gross)*8)return {status:'review-required',reason:'mass-discrepancy',delta,remainder,readings};
 const lots=['merah','kuning','hijau','hitam'].map(grade=>({lot_id:'SORT-'+encodeURIComponent(batch.id)+'-'+grade,parent_batch_id:batch.id,sort_event_id:event.id,grade,kg_sortir_awal:grade==='merah'?red:v[grade],stage:'sortir_done'})).filter(l=>l.kg_sortir_awal>0);
 if(lots.some(n=>snapshot.lots.some(l=>l.lot_id===n.lot_id)))return {status:'conflict',reason:'lot-identity'};
 return {status:'ready',expectedRevision,event:structuredClone(event),readings,lots,parentPatch:{pengapung_kg:v.floating,has_split:true,processing_stage:'sortir_4warna'},derivedRed:event.mode==='remainder',delta};
}
function validateProcess(input){
 const readings=Object.fromEntries(['cherry','dried','gb','kupas'].map(k=>[k,measurement(input[k],input.unit,'g')]));
 const values=Object.values(readings);
 if(values.some(r=>r.status==='invalid'))return {status:'invalid',readings};
 if(values.some(r=>r.status==='missing'))return {status:'incomplete',readings};
 const {cherry,dried,gb,kupas}=Object.fromEntries(Object.entries(readings).map(([k,r])=>[k,r.converted]));
 // Only physical constraints. No invented 40/55% or agronomy threshold approval.
 return {status:cherry<=0||kupas>cherry||dried>cherry-kupas||gb>(kupas>0?kupas:dried)?'review-required':'valid',readings};
}
function validateCoverage(sessions,sessionId,coverIds){
 if(!Array.isArray(sessions)||!Array.isArray(coverIds)||new Set(coverIds).size!==coverIds.length||coverIds.includes(sessionId))return {status:'invalid',reason:'identity'};
 const parent=sessions.filter(s=>s.id===sessionId);
 if(parent.length!==1)return {status:'invalid',reason:'parent'};
 let cherry=measurement(parent[0].cherry_gram,'g','g');
 if(cherry.status!=='valid')return {status:cherry.status==='missing'?'incomplete':'invalid'};
 let total=cherry.value;
 for(const id of coverIds){
  const found=sessions.filter(s=>s.id===id);
  if(found.length!==1||found[0].pohon_id!==parent[0].pohon_id||found[0].type==='final')return {status:'invalid',reason:'linked-tree'};
  const child=found[0];
  if(child.dried_gram!=null||(child.dried_covered_by&&child.dried_covered_by!==sessionId)||sessions.some(s=>s.id!==sessionId&&Array.isArray(s.dried_covers)&&s.dried_covers.includes(id)))return {status:'review-required',reason:'measurement-or-link-conflict'};
  cherry=measurement(child.cherry_gram,'g','g');
  if(cherry.status!=='valid')return {status:cherry.status==='missing'?'incomplete':'invalid'};
  total+=cherry.value;
 }
 return {status:Number.isFinite(total)&&total>0?'valid':'review-required',cherryGram:total,coverIds:[...coverIds]};
}
function validateStock({unit,completed,withdrawals}){
 if(!Array.isArray(completed)||!Array.isArray(withdrawals))return {status:'incomplete'};
 const incoming=completed.map(v=>measurement(v,unit,'kg')),outgoing=withdrawals.map(v=>measurement(v,unit,'kg'));
 if([...incoming,...outgoing].some(r=>r.status==='invalid'))return {status:'invalid'};
 if([...incoming,...outgoing].some(r=>r.status==='missing'))return {status:'incomplete'};
 const balance=incoming.reduce((s,r)=>s+r.converted,0)-outgoing.reduce((s,r)=>s+r.converted,0);
 if(!Number.isFinite(balance))return {status:'invalid',reason:'overflow'};
 return {status:balance<0?'review-required':'valid',balance,unit:'kg'};
}
function deletionGate(id,links){
 if(!id||!links||!['lots','drying','sampling'].every(k=>Array.isArray(links[k])))return {status:'incomplete',reason:'reference-snapshot-required'};
 const references=[...links.lots.filter(l=>l.parent_batch_id===id||l.lot_id===id),...links.drying.filter(d=>d.batch_id===id||d.lot_id===id||d.parent_batch_id===id||(Array.isArray(d.source_batch_ids)&&d.source_batch_ids.includes(id))),...links.sampling.filter(s=>s.dried_covered_by===id||(Array.isArray(s.dried_covers)&&s.dried_covers.includes(id)))];
 return {status:references.length?'review-required':'unlinked',referenceCount:references.length,reason:'archive-or-reversal-only'};
}
function sopKey(year,month,activityId){
 if(!Number.isInteger(year)||year<1900||year>9999||!Number.isInteger(month)||month<1||month>12||typeof activityId!=='string'||!activityId.trim())throw new TypeError('explicit year/month/stable activity ID required');
 return `${year}-${String(month).padStart(2,'0')}:${encodeURIComponent(activityId)}`;
}
function mapLegacySOP(legacy,manifest){
 const mapped={},unresolved=[];
 for(const [key,value] of Object.entries(legacy)){
  const matches=manifest.filter(m=>m.legacyKey===key);
  if(matches.length!==1){unresolved.push(key);continue;}
  try{const m=matches[0],next=sopKey(m.year,m.month,m.activityId);if(Object.hasOwn(mapped,next)){unresolved.push(key);continue;}mapped[next]=structuredClone(value);}catch{unresolved.push(key);}
 }
 return {status:unresolved.length?'review-required':'ready',mapped,unresolved,legacy:structuredClone(legacy)};
}
const CACHE_CONTRACTS=Object.freeze({panen:{key:'wkkn_v2_panen_2026',versions:['1.0','1.1'],render:'renderPanen'},lots:{key:'wkkn_v2_panen_lots_2026',versions:['1.0'],render:'renderPanenLots'},sampling:{key:'wkkn_v2_panen_sampling_2026',versions:['1.1','1.2'],render:'renderPanenSampling'}});
function cacheEnvelope(name,version,data){
 const contract=CACHE_CONTRACTS[name];
 if(!contract||!Array.isArray(data))return {status:'invalid'};
 if(!contract.versions.includes(version))return {status:'review-required',reason:'version',preserved:data};
 return {status:'valid',key:contract.key,render:contract.render,envelope:{version,data:structuredClone(data)}};
}
function readCache(name,raw){
 try{const parsed=JSON.parse(raw);if(Array.isArray(parsed))return {status:'review-required',reason:'legacy-unversioned',preserved:parsed};if(!parsed||typeof parsed!=='object')return {status:'invalid'};const result=cacheEnvelope(name,parsed.version,parsed.data);return {...result,...(result.status==='valid'?{data:result.envelope.data}:{})};}catch{return {status:'invalid',reason:'json'};}
}
function fieldIntensity(input){
 const base={hypothesis:input.aiHypothesis??null,thresholdStatus:'unresolved'};
 if(input.source!=='field-count')return {...base,status:'hypothesis-only',percent:null};
 const surveyed=measurement(input.surveyed,'trees'),affected=measurement(input.affected,'trees');
 if([surveyed,affected].some(r=>r.status==='invalid'))return {...base,status:'invalid',percent:null};
 if([surveyed,affected].some(r=>r.status==='missing'))return {...base,status:'missing',percent:null};
 if(surveyed.value<=0||affected.value>surveyed.value)return {...base,status:'review-required',percent:null};
 return {...base,status:'measured',surveyed:surveyed.value,affected:affected.value,percent:100*affected.value/surveyed.value};
}
module.exports={measurement,planSort,validateProcess,validateCoverage,validateStock,deletionGate,sopKey,mapLegacySOP,cacheEnvelope,readCache,fieldIntensity};
