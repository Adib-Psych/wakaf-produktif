// Sequential recording, never an atomic payment batch or money transfer.
const copy=x=>structuredClone(x);
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function payrollBatchStore(storage){
 const key=owner=>'wkkn_payroll_batch_v1_'+owner;let flight=false,blocked=false;
 function read(owner){if(!owner)throw Error('Akun Google diperlukan');const raw=storage.getItem(key(owner));if(raw===null)return null;const p=JSON.parse(raw);if(p.owner!==owner||!Array.isArray(p.items)||!p.items.length||p.items.some(x=>!x.input||typeof x.input.id!=='string'||!['ready','dispatching','ack'].includes(x.phase)||(x.phase==='ack'&&typeof x.eventId!=='string')))throw Error('Rencana batch rusak; jangan hapus data browser');return p;}
 function persist(p){const raw=JSON.stringify(p);storage.setItem(key(p.owner),raw);if(storage.getItem(key(p.owner))!==raw)throw Error('Rencana batch belum tersimpan; pengiriman ditahan');}
 function start(owner,inputs){if(flight||blocked)throw Error('Pencatatan masih diperiksa; muat ulang untuk rekonsiliasi');const old=read(owner);if(old?.items.some(x=>x.phase!=='ack'))throw Error('Selesaikan rencana batch sebelumnya');if(!Array.isArray(inputs)||!inputs.length||inputs.some(x=>!x.id||x.status!=='lunas')||new Set(inputs.map(x=>x.id)).size!==inputs.length)throw Error('Pilihan batch tidak valid');const p={owner,items:inputs.map(input=>({input:copy(input),phase:'ready',eventId:null}))};persist(p);return copy(p);}
 async function run(owner,{record,sessionAvailable,onProgress=()=>{},readIntent=()=>null}){
  if(flight||blocked)throw Error('Pencatatan masih diperiksa; muat ulang untuk rekonsiliasi');flight=true;
  try{const p=read(owner);if(!p)throw Error('Tidak ada rencana batch');
   const retained=readIntent();if(retained){const acknowledged=p.items.find(x=>x.phase==='ack'&&x.eventId===retained.eventId&&exact(x.input,retained.input));if(acknowledged){if(!sessionAvailable(owner))throw Error('Akun berubah; batch ditahan');const eventId=await record(copy(acknowledged.input));if(eventId!==acknowledged.eventId)throw Error('Konflik identitas konfirmasi batch');}}
   for(const item of p.items){if(item.phase==='ack')continue;if(!sessionAvailable(owner))throw Error('Akun berubah; batch ditahan');
    if(item.phase==='dispatching'){const prior=readIntent();if(!prior||!exact(prior.input,item.input))throw Error('Hasil item belum pasti; perbarui dan rekonsiliasi konfirmasi server sebelum melanjutkan');}
    record.prepareIntent?.(copy(item.input));item.phase='dispatching';persist(p);onProgress(copy(p));
    const checkpoint=eventId=>{item.phase='ack';item.eventId=eventId;try{persist(p);}catch(e){blocked=true;throw e;}};
    let eventId;try{eventId=await record(copy(item.input),{onAcknowledged:checkpoint});}catch(e){if(!blocked&&item.phase!=='ack'&&!readIntent()){item.phase='ready';persist(p);}throw e;}
    if(item.phase!=='ack')checkpoint(eventId);
    onProgress(copy(p));
   }return copy(p);
  }finally{flight=false;}
 }
 return {read,start,run};
}
