// Pure status contract. No SDK, transfers, persistence, entitlement generation or tariff inference.
const id=x=>(typeof x==='string'||Number.isSafeInteger(x))&&/^[A-Za-z0-9_-]{1,120}$/.test(String(x));
const text=x=>typeof x==='string'&&x.trim().length>0;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const calendar=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const paymentKeys=['bayar_tgl','bayar_source','paid_date','source','payment_id','bayar_ref','cashbook_id'];
function original(w){
 if(!w||!id(w.id)||w.status!=='belum'||('fund' in w&&!['K1_K3','K4'].includes(w.fund))||w.voided_duplicate===true||('eligible' in w&&w.eligible!==true)||paymentKeys.some(k=>k in w)||!Number.isSafeInteger(w.tarif)||w.tarif<=0||typeof w.qty!=='number'||!Number.isFinite(w.qty)||w.qty<=0||!Number.isSafeInteger(w.tarif*w.qty))throw Error('Unsupported original wage');
}
export function buildPayrollState({wage,previous=null,status,paidDate=null,source=null,reason='',eventId,uid,stamp}){
 original(wage);
 if(!id(eventId)||!text(uid)||stamp==null)throw Error('Invalid event, uid or stamp');
 if(previous&&(!equal(previous.wage,wage)||previous.wage_id!==String(wage.id)||!Number.isSafeInteger(previous.revision)||previous.revision<1||!id(previous.event_id)))throw Error('Invalid previous wage');
 if(previous?.event_id===eventId)throw Error('Repeated event');
 const before=previous?.status||wage.status;
 if(!((before==='belum'&&status==='lunas')||(previous&&before==='lunas'&&status==='belum')))throw Error('Unsupported transition (legacy cancellation denied)');
 if(typeof reason!=='string'||reason.length>500||(status==='belum'&&!text(reason)))throw Error('Cancellation reason required');
 if(status==='lunas'?(!calendar(paidDate)||paidDate>new Date(Date.now()+7*60*60*1000).toISOString().slice(0,10)||source!==(wage.fund==='K4'?'pribadi':'wakif')):(paidDate!==null||source!==null))throw Error('Invalid payment date or source');
 return {wage_id:String(wage.id),wage:structuredClone(wage),revision:previous?previous.revision+1:1,predecessor:previous?previous.event_id:null,event_id:eventId,status,paid_date:paidDate,source,reason,owner_uid:uid,committed_at:stamp};
}
// Pass ORIGINAL wages and base cashbook only. Never re-project already-derived rows.
export function projectPayroll({upah,cashbook,states}){
 if(!Array.isArray(upah)||!Array.isArray(cashbook)||!Array.isArray(states))throw Error('Incomplete payroll sources');
 const seen=new Set(),wages=structuredClone(upah),cash=structuredClone(cashbook);
 for(const state of [...states].sort((a,b)=>String(a.wage_id).localeCompare(String(b.wage_id)))){
  if(!state||seen.has(state.wage_id))throw Error('Duplicate payroll state');seen.add(state.wage_id);
  const matches=upah.filter(w=>String(w.id)===state.wage_id);
  const display=w=>w?.satuan==='full_day'?{...w,satuan:'full'}:w;
  if(matches.length!==1||!equal(display(matches[0]),display(state.wage)))throw Error('Unknown or altered wage');
  original(state.wage);
  if(Object.keys(state).sort().join(',')!=='committed_at,event_id,owner_uid,paid_date,predecessor,reason,revision,source,status,wage,wage_id'||!Number.isSafeInteger(state.revision)||state.revision<1||!id(state.event_id)||!['lunas','belum'].includes(state.status)||!text(state.owner_uid)||state.committed_at==null||(state.revision===1?state.predecessor!==null:!id(state.predecessor)))throw Error('Malformed payroll state');
  const wid=state.wage_id,w=state.wage;
  if(cashbook.some(c=>c.id==='cb_payroll_'+wid||(typeof c.ref==='string'&&c.ref.startsWith('upah_')&&c.ref.slice(5).split('·').map(x=>x.trim()).includes(wid))||(typeof c.id==='string'&&c.id.toLowerCase().startsWith('cb_upah_'+String(w.pelapor).toLowerCase()+'_'))))throw Error('Existing linked cash row; reconciliation required');
  const out=wages.find(x=>String(x.id)===wid);out.status=state.status;out.payroll_revision=state.revision;out.payroll_event_id=state.event_id;
  if(out.satuan==='full_day')out.satuan='full';
  if(state.status==='lunas'){
   if(!calendar(state.paid_date)||state.source!==(w.fund==='K4'?'pribadi':'wakif'))throw Error('Malformed paid state');
   out.bayar_tgl=state.paid_date;out.bayar_source=state.source;
   cash.push({id:'cb_payroll_'+wid,tgl:state.paid_date,tipe:'bayar_upah',kat:w.model==='borongan'?'4.1':w.pelapor==='YIT'?'3.1':'3.2',ket:'Upah '+(w.name||w.worker||w.pelapor)+' — '+(w.aktivitas||w.tgl),masuk:0,keluar:w.tarif*w.qty,src:'payroll',nota:null,ref:'upah_'+wid,...(w.fund==='K4'?{fund:'K4'}:{})});
  }else if(state.paid_date!==null||state.source!==null||!text(state.reason)||state.revision<2)throw Error('Malformed cancellation');
 }
 return {upah:wages,cashbook:cash};
}
