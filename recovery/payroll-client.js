// Google-authenticated recording only. No money movement or legacy singleton writes.
import {doc,getDocFromServer,runTransaction,serverTimestamp,Timestamp} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import {buildPayrollState} from './payroll-contract.mjs';
import {payrollIntentStore} from './payroll-intent.mjs';
import {mountPayrollUI} from './payroll-ui.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const equal=(a,b)=>globalThis.workerReportContent(a)===globalThis.workerReportContent(b);
export function mountPayrollRecording({db,auth,sessionTicket,sessionMatches}){
 let flight=null;const intents=payrollIntentStore(localStorage,()=> 'pe_'+crypto.randomUUID().replaceAll('-',''));
 function identity(){const t=sessionTicket(),u=auth.currentUser;if(!t||!u||u.uid!==t.uid||u.isAnonymous||!u.emailVerified||!u.providerData.some(p=>p.providerId==='google.com'))throw Error('Masuk dengan akun Google berizin');return t;}
 async function record(input){if(flight)throw Error('Pencatatan sebelumnya masih diperiksa');const t=identity();if(input.status==='lunas'&&(!/^\d{4}-\d{2}-\d{2}$/.test(input.paidDate)||new Date(input.paidDate+'T00:00:00Z').toISOString().slice(0,10)!==input.paidDate||input.paidDate>new Date(Date.now()+7*3600000).toISOString().slice(0,10)||!['wakif','pribadi'].includes(input.source)))throw Error('Isi tanggal pembayaran nyata yang valid, bukan tanggal mendatang');if(typeof input.reason!=='string'||input.reason.length>500||(input.status==='belum'&&!input.reason.trim()))throw Error('Isi alasan koreksi');if(!intents.read(t.uid)){const selected=(typeof UPAH_ITEMS==='undefined'?[]:UPAH_ITEMS).find(w=>String(w.id)===input.id);if(input.status==='belum'&&!selected?.payroll_revision)throw Error('Pembayaran lama perlu rekonsiliasi; koreksi ini hanya untuk pencatatan baru yang memiliki jejak');}const existing=intents.read(t.uid),frozen=intents.obtain(t.uid,input),attempt={dispatched:false};flight=send(t,frozen,attempt);try{return await flight;}catch(e){if(!existing&&!attempt.dispatched)intents.confirm(frozen);throw e;}finally{flight=null;}}
 async function send(t,command,attempt){
  const id=command.input.id,ref=doc(db,'payroll_states',id),event=doc(db,'payroll_events',command.eventId);
  const current=()=>{if(!sessionMatches(t)||auth.currentUser?.uid!==t.uid)throw Error('Akun berubah; pencatatan ditahan');};
  const assertGrant=(p,g,ep,eg)=>{if(p?.enabled!==true||!Number.isSafeInteger(p.epoch)||p.epoch<1||g?.uid!==t.uid||g.enabled!==true||g.epoch!==p.epoch||ep?.paused!==false||eg?.uid!==t.uid||eg.enabled!==true||eg.writer_epoch!==ep.writer_epoch)throw Error('Akun ini belum diberi izin pencatatan pembayaran');};
  let intended;
  await runTransaction(db,async tx=>{
   const [p,g,ep,eg,s,e,old,ent,cash,target]=await Promise.all([
    tx.get(doc(db,'payroll_policy','active')),tx.get(doc(db,'payroll_grants',t.uid)),tx.get(doc(db,'entry_policy','active')),tx.get(doc(db,'entry_grants',t.uid)),tx.get(ref),tx.get(event),tx.get(doc(db,'upah','active')),tx.get(doc(db,'wage_entitlements',id)),tx.get(doc(db,'cashbook','active')),tx.get(doc(db,'payroll_targets',id))]);current();assertGrant(p.data(),g.data(),ep.data(),eg.data());
   if(e.exists()){const saved=e.data();if(saved.owner_uid!==t.uid||saved.wage_id!==id||saved.event_id!==command.eventId||saved.status!==command.input.status||saved.paid_date!==(command.input.status==='lunas'?command.input.paidDate:null)||saved.reason!==command.input.reason||saved.source!==(command.input.status==='lunas'?command.input.source:null))throw Error('Konflik konfirmasi server');intended=saved;return;}
   const previous=s.exists()?s.data():null,revision=previous?.revision||0;intents.revision(command,revision);
   const candidates=(old.data()?.data||[]).filter(w=>String(w.id)===id);if(candidates.length>1)throw Error('Identitas upah ganda; perlu pemeriksaan');
   const wage=previous?.wage||candidates[0]||(ent.exists()?ent.data():null);if(!wage)throw Error('Sumber upah tidak ditemukan');if(target.data()?.enabled!==true||!equal(target.data().wage,wage))throw Error('Upah ini belum lolos pemeriksaan sumber dan buku kas');if(ent.exists()&&!equal(ent.data(),wage))throw Error('Sumber upah sudah berubah');if(!cash.exists()||!Array.isArray(cash.data()?.data))throw Error('Buku kas belum dapat diperiksa');
   const linked=(cash.data()?.data||[]).filter(x=>typeof x.ref==='string'&&x.ref.startsWith('upah_')&&x.ref.slice(5).split('·').includes(id));if(linked.length)throw Error('Upah memiliki catatan kas lama; perlu rekonsiliasi, jangan dicatat ganda');
   intended=buildPayrollState({wage,previous,status:command.input.status,paidDate:command.input.status==='lunas'?command.input.paidDate:null,source:command.input.status==='lunas'?command.input.source:null,reason:command.input.reason,eventId:command.eventId,uid:t.uid,stamp:serverTimestamp()});
   current();attempt.dispatched=true;tx.set(ref,intended);tx.set(event,intended);
  });
  current();const [s,e]=await Promise.all([getDocFromServer(ref),getDocFromServer(event)]);current();
  if(s.metadata.fromCache||e.metadata.fromCache||s.metadata.hasPendingWrites||e.metadata.hasPendingWrites||!e.exists()||!s.exists()||!equal(s.data(),e.data())||e.data().event_id!==command.eventId||!(e.data().committed_at instanceof Timestamp))throw Error('Hasil belum pasti; periksa status server sebelum mencatat lagi');
  const {committed_at:ignored,...saved}=e.data(),{committed_at:ignored2,...wanted}=intended;if(!equal(saved,wanted))throw Error('Isi konfirmasi server berbeda');
  intents.confirm(command);await window.dashboardReadModel?.refresh?.();window.payrollRecording?.decorate?.();return command.eventId;
 }
 const ui=mountPayrollUI({document,readWages:()=>typeof UPAH_ITEMS==='undefined'?[]:UPAH_ITEMS,record,readIntent:()=>{try{return intents.read(identity().uid);}catch{return null;}},sessionAvailable:()=>{try{return !!identity();}catch{return false;}}});window.payrollRecording=ui;return ui;
}
