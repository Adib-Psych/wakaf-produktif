'use strict';
/*
 * PEMBENTUKAN HAK UPAH MALAM HARI — ADR-050 (Wakif, 9 Nov 2026)
 *
 * Cloud Functions (index.cjs) tidak dipasang karena billing ditolak pemilik. Penggantinya
 * adalah sapuan terjadwal yang memanggil processCreated() yang SAMA untuk setiap laporan
 * modern yang belum punya catatan wage_processing. processCreated transaksional dan
 * idempoten, jadi sapuan aman diulang dan tidak pernah menggandakan hak upah.
 *
 * YANG DILAKUKAN
 *   · laporan modern (device_reports/device_receipts, laporan/entry_receipts berkontrak)
 *     tanpa wage_processing/report_v1_<lane>_<id>  -> diproses
 *   · catatan unresolved beralasan pair_missing (tanda terima menyusul) -> diproses ulang
 * YANG TIDAK DILAKUKAN
 *   · TIDAK membayar, tidak menyentuh payroll_*, cashbook, atau upah lama.
 *     Hak upah lahir berstatus 'belum'; pembayaran tetap atas permintaan pekerja.
 *   · TIDAK menerima laporan legacy (tanpa kontrak). Itu butuh atestasi hash pemilik
 *     (jalur finite). Laporan legacy sesudah tanggal berlaku hanya DILAPORKAN.
 *   · TIDAK mengulang unresolved lain (konflik durasi, dana campur, dsb.) kecuali
 *     --ulang-unresolved diberikan atas keputusan Claude/pemilik.
 *
 * PEMAKAIAN (Hermes, Thar Lay):
 *   node nightly.cjs --project wakaf-ngantang              # rencana saja (bawaan)
 *   node nightly.cjs --project wakaf-ngantang --terapkan   # memproses
 *   Opsi: --keluaran <berkas.json>  --ulang-unresolved
 *   Kredensial: Application Default Credentials milik pelaksana (di luar repo).
 *   FIRESTORE_EMULATOR_HOST untuk uji.
 * KODE KELUAR: 0 bersih · 3 ada yang ditahan/menunggu atestasi (catat Keluhan) · 1 galat.
 */
const {processCreated}=require('./processor.cjs');

const PASANGAN={device_reports:'device_receipts',laporan:'entry_receipts'};
const ID=/^lap_[A-Za-z0-9_-]{1,96}$/;
const ULANG_OTOMATIS=new Set(['pair_missing']);
const kunciLaporan=(lane,id)=>`wage_processing/report_v1_${lane}_${id}`;

async function rencana(db,{ulangUnresolved=false}={}){
 const pol=(await db.doc('wage_policy/active').get()).data();
 const mulai=pol&&pol.workers&&Object.keys(pol.workers).length?Object.values(pol.workers).map(w=>w.effective_from).sort()[0]:null;
 const kandidat=new Map();let terakhir=null;
 for(const [lane,pasangan] of Object.entries(PASANGAN)){
  for(const col of [lane,pasangan]){
   const snap=await db.collection(col).get();
   for(const d of snap.docs){
    const v=d.data()||{},b=v.submitted_body||v,tgl=typeof b.tanggal==='string'?b.tanggal:null;
    if(tgl&&(!terakhir||tgl>terakhir))terakhir=tgl;
    const k=lane+'/'+d.id,lama=kandidat.get(k);
    kandidat.set(k,{lane,id:d.id,tgl:lama?.tgl||tgl,modern:(lama?.modern||false)||Object.hasOwn(v,'contract_version')});
   }
  }
 }
 const daftar=[...kandidat.values()].filter(c=>ID.test(c.id)).sort((a,b)=>(a.lane+a.id).localeCompare(b.lane+b.id));
 const refs=daftar.map(c=>db.doc(kunciLaporan(c.lane,c.id)));
 const catatan=refs.length?await db.getAll(...refs):[];
 const proses=[],menungguAtestasi=[],ditahanLama=[];
 daftar.forEach((c,i)=>{
  const pr=catatan[i].data();
  if(!c.modern){if(!pr&&mulai&&c.tgl&&c.tgl>=mulai)menungguAtestasi.push({lane:c.lane,id:c.id,tgl:c.tgl});return;}
  if(!pr)proses.push({lane:c.lane,id:c.id,tgl:c.tgl,sebab:'baru'});
  else if(pr.status==='unresolved'&&(ULANG_OTOMATIS.has(pr.reason)||ulangUnresolved))proses.push({lane:c.lane,id:c.id,tgl:c.tgl,sebab:'ulang:'+pr.reason});
  else if(pr.status==='unresolved')ditahanLama.push({lane:c.lane,id:c.id,tgl:c.tgl,alasan:pr.reason});
 });
 return {tanggal_berlaku_awal:mulai,laporan_terakhir:terakhir,proses,menunggu_atestasi:menungguAtestasi,ditahan_lama:ditahanLama};
}

async function sapu(db,{terapkan=false,ulangUnresolved=false}={}){
 const r=await rencana(db,{ulangUnresolved});
 const hasil=[];
 if(terapkan)for(const p of r.proses){const x=await processCreated(db,p.lane,p.id);hasil.push({...p,status:x.status,alasan:x.reason,wage:x.worker&&x.tgl?`wage_v1_${x.worker}_${x.tgl}`:null});}
 const dibuat=hasil.filter(h=>h.status==='created').length,ada=hasil.filter(h=>h.status==='existing').length;
 const ditahan=hasil.filter(h=>h.status==='unresolved');
 const perluTinjau=ditahan.length+r.menunggu_atestasi.length;
 return {...r,terapkan,hasil,ringkas:{diproses:hasil.length,dibuat,sudah_ada:ada,ditahan:ditahan.length,menunggu_atestasi:r.menunggu_atestasi.length,ditahan_lama:r.ditahan_lama.length},kode:perluTinjau?3:0};
}

function hariIniJakarta(now=new Date()){return new Date(now.getTime()+7*3600e3).toISOString().slice(0,10);}

async function main(argv=process.argv.slice(2)){
 const arg=n=>argv.includes(n),nilai=n=>{const i=argv.indexOf(n);return i>=0?argv[i+1]:null;};
 const project=nilai('--project');
 if(!process.env.FIRESTORE_EMULATOR_HOST&&project!=='wakaf-ngantang'){console.error('Wajib --project wakaf-ngantang (atau FIRESTORE_EMULATOR_HOST untuk uji).');return 1;}
 const {initializeApp,applicationDefault}=require('firebase-admin/app');
 const {getFirestore}=require('firebase-admin/firestore');
 const app=initializeApp(process.env.FIRESTORE_EMULATOR_HOST?{projectId:project||'demo-wakaf-wages'}:{projectId:project,credential:applicationDefault()},'upah-malam');
 const db=getFirestore(app);
 const out=await sapu(db,{terapkan:arg('--terapkan'),ulangUnresolved:arg('--ulang-unresolved')});
 const s=out.ringkas,hari=hariIniJakarta();
 const jeda=out.laporan_terakhir?Math.round((Date.parse(hari)-Date.parse(out.laporan_terakhir))/864e5):null;
 console.log(`Hak upah malam ${hari} · ${out.terapkan?'DITERAPKAN':'RENCANA SAJA'}`);
 console.log(`Akan/telah diproses ${out.proses.length} · dibuat ${s.dibuat} · sudah ada ${s.sudah_ada} · ditahan ${s.ditahan}`);
 if(s.ditahan)console.log('Ditahan: '+out.hasil.filter(h=>h.status==='unresolved').map(h=>`${h.id} (${h.alasan})`).join(', '));
 if(s.menunggu_atestasi)console.log(`Laporan legacy menunggu atestasi pemilik: ${s.menunggu_atestasi} (tidak diproses otomatis)`);
 if(s.ditahan_lama)console.log(`Unresolved lama yang tidak diulang otomatis: ${s.ditahan_lama}`);
 console.log(`Laporan terakhir bertanggal ${out.laporan_terakhir||'-'}${jeda!==null&&jeda>7?` — CATATAN: ${jeda} hari tanpa laporan baru`:''}`);
 console.log('Pembayaran: tidak disentuh (atas permintaan pekerja).');
 const p=nilai('--keluaran');
 if(p)require('node:fs').writeFileSync(p,JSON.stringify({...out,hari_jakarta:hari},null,1));
 const {deleteApp}=require('firebase-admin/app');await deleteApp(app);
 return out.kode;
}

module.exports={rencana,sapu,hariIniJakarta};
if(require.main===module)main().then(c=>process.exit(c),e=>{console.error('GALAT:',e.message);process.exit(1);});
