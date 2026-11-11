'use strict';
/**
 * Koreksi detail laporan perangkat (ADR-054, keluhan #48).
 *
 * Penulis resmi untuk satu hal saja: mengganti teks `detail` laporan yang HANYA ada di jalur perangkat
 * (`device_reports` + `device_receipts`), tanpa menghapus atau menulis ulang laporan aslinya.
 * Setiap koreksi ditulis sebagai rantai yang sama dengan koreksi staf: `operation_events/<cid>`,
 * `operation_receipts/<cid>` (isi identik) dan `report_heads/<id>` (revisi 2), dalam SATU transaksi.
 *
 * Yang dikunci kode: tanggal, pekerja, durasi, kebun, kategori dan semua kolom lain harus sama persis
 * dengan aslinya. Hak upah tidak disentuh dan dibandingkan sebelum/sesudah. Tidak membayar.
 *
 * Paket (JSON, disusun Claude atas persetujuan pemilik):
 *   {"paket":"<nama>","disetujui":"<siapa, kapan>","items":[
 *     {"report_id":"lap_…","detail_lama_sha256":"<sha256 teks detail lama>","detail_baru":"…","alasan":"…"}]}
 *
 * Pakai (Thar Lay, Application Default Credentials di luar repo):
 *   node koreksi-detail.cjs --project wakaf-ngantang --paket paket.json                 # uji kering (bawaan)
 *   node koreksi-detail.cjs --project wakaf-ngantang --paket paket.json --tulis --keluaran hasil.json
 *
 * Aman diulang: command_id tetap per laporan; koreksi yang sudah tercatat persis dilaporkan `sudah`.
 * Hanya koreksi pertama (revisi 1 -> 2) yang didukung; kepala revisi lain = BERHENTI, tanyakan Claude.
 * KODE KELUAR: 0 bersih · 3 ada item berhenti (catat Keluhan) · 1 galat.
 */
const {createHash}=require('node:crypto');
const {isDeepStrictEqual:equal}=require('node:util');
const fs=require('node:fs');
const {original,wageId,policyValid}=require('./processor.cjs');
const {validReportBody}=require('./report-body.cjs');

const KIND='device_detail';
const ID=/^lap_[A-Za-z0-9_-]{1,96}$/;
const sha256=t=>createHash('sha256').update(t,'utf8').digest('hex');
const commandId=id=>`cmd_detail_${id.slice(4)}_r2`;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

function bacaPaket(p){
 if(!obj(p)||typeof p.paket!=='string'||!p.paket||typeof p.disetujui!=='string'||!p.disetujui.trim()||!Array.isArray(p.items)||!p.items.length||p.items.length>50)throw Error('paket-tidak-sah');
 const seen=new Set();
 for(const it of p.items){
  if(!obj(it)||Object.keys(it).sort().join(',')!=='alasan,detail_baru,detail_lama_sha256,report_id')throw Error('item-tidak-sah');
  if(!ID.test(it.report_id)||commandId(it.report_id).length>100||seen.has(it.report_id))throw Error('report-id-tidak-sah: '+it.report_id);
  if(!/^[a-f0-9]{64}$/.test(it.detail_lama_sha256))throw Error('sha256-tidak-sah: '+it.report_id);
  if(typeof it.detail_baru!=='string'||!it.detail_baru.trim()||it.detail_baru.length>2000)throw Error('detail-baru-tidak-sah: '+it.report_id);
  if(typeof it.alasan!=='string'||!it.alasan.trim()||it.alasan.length>500)throw Error('alasan-tidak-sah: '+it.report_id);
  seen.add(it.report_id);
 }
 return p;
}

const potretUpah=s=>s.exists?(({status,eligible,tarif,satuan,qty,sources,blocked_reason})=>({status,eligible,tarif,satuan,qty,sources,blocked_reason:blocked_reason??null}))(s.data()):null;

async function satu(db,it,{tulis}){
 const id=it.report_id,cid=commandId(id);
 const refs={dev:db.doc(`device_reports/${id}`),rcp:db.doc(`device_receipts/${id}`),lap:db.doc(`laporan/${id}`),head:db.doc(`report_heads/${id}`),ev:db.doc(`operation_events/${cid}`),op:db.doc(`operation_receipts/${cid}`),pol:db.doc('wage_policy/active')};
 const {FieldValue}=require('firebase-admin/firestore');
 let rencana=null;
 const hasil=await db.runTransaction(async tx=>{
  const [dev,rcp,lap,head,ev,op,pol]=await Promise.all(Object.values(refs).map(r=>tx.get(r)));
  const stop=sebab=>({report_id:id,command_id:cid,status:'berhenti',sebab});
  const a=dev.data(),b=rcp.data();
  const salah=original('device_reports',id,a,b);if(salah)return stop('asli-tidak-sah:'+salah);
  if(lap.exists)return stop('ada-di-jalur-laporan');
  const body=a.submitted_body;
  if(body.schema_version!=='3.5')return stop('skema-bukan-3.5');
  const baru={...body,detail:it.detail_baru};
  if(!validReportBody(baru))return stop('body-baru-tidak-sah');
  const operation={kind:KIND,command_id:cid,target:id,expected_revision:1,predecessor:id,reason:it.alasan,body:baru};
  const kepala={revision:2,command_id:cid,owner_uid:a.owner_uid,body:baru};
  if(head.exists){
   const h=head.data();
   if(h.command_id===cid&&equal(h,kepala)&&ev.exists&&op.exists&&equal(ev.data(),op.data())&&equal(ev.data().operation,operation))return {report_id:id,command_id:cid,status:'sudah'};
   return stop('kepala-sudah-ada:'+h.command_id+'@'+h.revision);
  }
  if(ev.exists||op.exists)return stop('event-tanpa-kepala');
  if(sha256(body.detail)!==it.detail_lama_sha256)return stop('detail-lama-berubah');
  if(body.detail===it.detail_baru)return stop('detail-sama');
  const p=pol.data(),w=policyValid(p)?p.workers[body.pelapor]:null;
  rencana={wage:w?db.doc(`wage_entitlements/${wageId(w.legacy_token,body.tanggal)}`):null};
  if(!tulis)return {report_id:id,command_id:cid,status:'rencana',detail_lama:body.detail,detail_baru:it.detail_baru};
  const row={operation,owner_uid:a.owner_uid,writer_epoch:a.writer_epoch,roster_version:a.roster_version,revision:2,committed_at:FieldValue.serverTimestamp()};
  tx.create(refs.ev,row);tx.create(refs.op,row);tx.create(refs.head,kepala);
  return {report_id:id,command_id:cid,status:'ditulis'};
 });
 return {hasil,wageRef:rencana?.wage||null};
}

async function jalankan(db,paket,{tulis=false}={}){
 const p=bacaPaket(paket),out=[];
 for(const it of p.items){
  // Potret hak upah sebelum, untuk dibandingkan sesudah (harus identik).
  const awal=await satu(db,it,{tulis:false});
  const sebelum=awal.wageRef?potretUpah(await awal.wageRef.get()):null;
  let r=awal.hasil;
  if(tulis&&r.status==='rencana')r=(await satu(db,it,{tulis:true})).hasil;
  if(['ditulis','sudah'].includes(r.status)){
   // Baca ulang dari server: kepala, event == kwitansi, detail baru, dan hak upah tidak berubah.
   const [h,e,o]=await Promise.all([db.doc(`report_heads/${it.report_id}`).get(),db.doc(`operation_events/${r.command_id}`).get(),db.doc(`operation_receipts/${r.command_id}`).get()]);
   const sesudah=awal.wageRef?potretUpah(await awal.wageRef.get()):null;
   const ok=h.exists&&e.exists&&o.exists&&equal(e.data(),o.data())&&h.data().revision===2&&h.data().command_id===r.command_id&&h.data().body.detail===it.detail_baru&&e.data().committed_at&&equal(sebelum,sesudah);
   r={...r,baca_ulang:ok?'cocok':'TIDAK-COCOK',upah_sebelum:sebelum,upah_sesudah:sesudah};
   if(!ok)r.status='berhenti';
  }
  out.push(r);
 }
 const ringkas={paket:p.paket,disetujui:p.disetujui,mode:tulis?'TULIS':'UJI KERING',jumlah:out.length,ditulis:out.filter(x=>x.status==='ditulis').length,sudah:out.filter(x=>x.status==='sudah').length,rencana:out.filter(x=>x.status==='rencana').length,berhenti:out.filter(x=>x.status==='berhenti').length};
 return {ringkas,hasil:out};
}

async function main(argv=process.argv.slice(2)){
 const nilai=n=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:null;};
 const project=nilai('--project'),berkas=nilai('--paket');
 if(!process.env.FIRESTORE_EMULATOR_HOST&&project!=='wakaf-ngantang'){console.error('Wajib --project wakaf-ngantang (atau FIRESTORE_EMULATOR_HOST untuk uji).');return 1;}
 if(!berkas){console.error('Wajib --paket <berkas.json>.');return 1;}
 const {initializeApp,applicationDefault}=require('firebase-admin/app');
 const {getFirestore}=require('firebase-admin/firestore');
 const app=initializeApp(process.env.FIRESTORE_EMULATOR_HOST?{projectId:project||'demo-wakaf-wages'}:{projectId:project,credential:applicationDefault()},'koreksi-detail');
 const out=await jalankan(getFirestore(app),JSON.parse(fs.readFileSync(berkas,'utf8')),{tulis:argv.includes('--tulis')});
 const s=out.ringkas;
 console.log(`Koreksi detail ${s.paket} · ${s.mode} · ditulis ${s.ditulis} · sudah ${s.sudah} · rencana ${s.rencana} · berhenti ${s.berhenti}`);
 for(const h of out.hasil)console.log(`  ${h.report_id}: ${h.status}${h.sebab?' ('+h.sebab+')':''}${h.baca_ulang?' · baca ulang '+h.baca_ulang:''}`);
 const k=nilai('--keluaran');if(k)fs.writeFileSync(k,JSON.stringify(out,null,1));
 return s.berhenti?3:0;
}

if(require.main===module)main().then(c=>process.exit(c),e=>{console.error('GALAT:',e.message);process.exit(1);});
module.exports={jalankan,bacaPaket,commandId,KIND,sha256};
