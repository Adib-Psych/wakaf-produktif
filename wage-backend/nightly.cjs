'use strict';
/*
 * PEMBENTUKAN HAK UPAH — SAAT ENTRY + SAPUAN MALAM — ADR-050 (Wakif, 9 Nov 2026)
 *
 * Revisi Wakif 9 Nov 12.12 NPT: hak upah dibentuk SAAT ADA ENTRY, bukan menunggu malam.
 *   --dengar  : proses tetap di Thar Lay yang memantau koleksi laporan; setiap entry baru
 *               langsung diproses (jeda 3 detik supaya laporan + tanda terima lengkap).
 *               Saat mulai, ia menjalankan sapuan penuh dulu (mengejar yang terlewat).
 *   sapuan malam (tanpa --dengar) tetap dijadwalkan sebagai jaring pengaman bila
 *               pendengar sempat mati, dan untuk catatan "N hari tanpa laporan".
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
 *   · TIDAK membayar, tidak menyentuh payroll_states/events, cashbook, atau upah lama.
 *     Hak upah lahir berstatus 'belum'; pembayaran tetap atas permintaan pekerja.
 *   · 14 Nov 2026: sesudah hak upah terbentuk, IZIN BAYAR (payroll_targets) dibuat lewat
 *     izin-bayar.cjs bila semua syarat protokol lolos (termasuk kasbon lunas). Yang tidak
 *     lolos ditahan dan ikut kode 3 → Keluhan. Sapuan juga mengejar hak upah tanpa izin.
 *   · TIDAK menerima laporan legacy (tanpa kontrak). Itu butuh atestasi hash pemilik
 *     (jalur finite). Laporan legacy sesudah tanggal berlaku hanya DILAPORKAN.
 *   · TIDAK mengulang unresolved lain (konflik durasi, dana campur, dsb.) kecuali
 *     --ulang-unresolved diberikan atas keputusan Claude/pemilik.
 *
 * PEMAKAIAN (Hermes, Thar Lay):
 *   node nightly.cjs --project wakaf-ngantang --dengar     # layanan tetap (dijalankan ulang otomatis bila keluar)
 *   node nightly.cjs --project wakaf-ngantang              # rencana saja (bawaan)
 *   node nightly.cjs --project wakaf-ngantang --terapkan   # memproses
 *   Opsi: --keluaran <berkas.json>  --ulang-unresolved
 *   Kredensial: Application Default Credentials milik pelaksana (di luar repo).
 *   FIRESTORE_EMULATOR_HOST untuk uji.
 * KODE KELUAR: 0 bersih · 3 ada yang ditahan/menunggu atestasi (catat Keluhan) · 1 galat.
 */
const {processCreated}=require('./processor.cjs');
const {buatIzin,sapuIzin}=require('./izin-bayar.cjs');

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
 const izin=await sapuIzin(db,{tulis:terapkan});
 const perluTinjau=ditahan.length+r.menunggu_atestasi.length+izin.ringkas.ditahan;
 return {...r,terapkan,hasil,izin_bayar:izin.hasil,ringkas:{diproses:hasil.length,dibuat,sudah_ada:ada,ditahan:ditahan.length,menunggu_atestasi:r.menunggu_atestasi.length,ditahan_lama:r.ditahan_lama.length,izin_dibuat:izin.ringkas.dibuat,izin_akan_dibuat:izin.ringkas.akan_dibuat,izin_ditahan:izin.ringkas.ditahan},kode:perluTinjau?3:0};
}

// ------------------------------------------------------------------ pendengar entry
function dengar(db,{log=console.log,onHasil=()=>{},jeda=3000,onPutus=()=>{}}={}){
 const antre=new Map(),subs=[];
 const proses=async(lane,id)=>{
  try{const x=await processCreated(db,lane,id);const h={lane,id,status:x.status,alasan:x.reason,wage:x.worker&&x.tgl?`wage_v1_${x.worker}_${x.tgl}`:null};log(`[entry] ${lane}/${id}: ${h.status} (${h.alasan})${h.wage?' -> '+h.wage:''}`);
   if(h.wage&&x.reason==='eligible'){const z=await buatIzin(db,h.wage);h.izin=z;log(`[izin] ${h.wage}: ${z.status}${z.alasan?' ('+z.alasan+')':''}`);}
   onHasil(h);}
  catch(e){log(`[entry] GALAT ${lane}/${id}: ${e.message}`);onHasil({lane,id,status:'galat',alasan:e.message});}
 };
 for(const [lane,pasangan] of Object.entries(PASANGAN))for(const col of [lane,pasangan]){
  let awal=true;
  subs.push(db.collection(col).onSnapshot(snap=>{
   if(awal){awal=false;return;}                       // keadaan awal sudah ditangani sapuan saat mulai
   for(const ch of snap.docChanges()){
    if(ch.type!=='added')continue;
    const id=ch.doc.id,v=ch.doc.data()||{};
    if(!ID.test(id))continue;
    if(!Object.hasOwn(v,'contract_version')){
     if(col===lane){log(`[entry] ${lane}/${id}: laporan format lama — menunggu atestasi pemilik, tidak diproses otomatis`);onHasil({lane,id,status:'menunggu_atestasi'});}
     continue;
    }
    const k=lane+'/'+id;clearTimeout(antre.get(k));
    antre.set(k,setTimeout(()=>{antre.delete(k);proses(lane,id);},jeda));
   }
  },e=>{log(`[entry] pendengar ${col} putus: ${e.message}`);onPutus(e);}));
 }
 return ()=>{subs.forEach(u=>u());antre.forEach(clearTimeout);antre.clear();};
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
 if(arg('--dengar')){
  const awal=await sapu(db,{terapkan:true});
  console.log(`[mulai] sapuan pengejar: diproses ${awal.ringkas.diproses}, dibuat ${awal.ringkas.dibuat}, ditahan ${awal.ringkas.ditahan}, menunggu atestasi ${awal.ringkas.menunggu_atestasi}`);
  return await new Promise(selesai=>{
   const stop=dengar(db,{onPutus:()=>{stop();selesai(1);}});
   console.log('[mulai] mendengarkan entry baru (device_reports, device_receipts, laporan, entry_receipts)…');
   for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>{stop();selesai(0);});
  });
 }
 const out=await sapu(db,{terapkan:arg('--terapkan'),ulangUnresolved:arg('--ulang-unresolved')});
 const s=out.ringkas,hari=hariIniJakarta();
 const jeda=out.laporan_terakhir?Math.round((Date.parse(hari)-Date.parse(out.laporan_terakhir))/864e5):null;
 console.log(`Hak upah malam ${hari} · ${out.terapkan?'DITERAPKAN':'RENCANA SAJA'}`);
 console.log(`Akan/telah diproses ${out.proses.length} · dibuat ${s.dibuat} · sudah ada ${s.sudah_ada} · ditahan ${s.ditahan}`);
 if(s.ditahan)console.log('Ditahan: '+out.hasil.filter(h=>h.status==='unresolved').map(h=>`${h.id} (${h.alasan})`).join(', '));
 if(s.menunggu_atestasi)console.log(`Laporan legacy menunggu atestasi pemilik: ${s.menunggu_atestasi} (tidak diproses otomatis)`);
 if(s.ditahan_lama)console.log(`Unresolved lama yang tidak diulang otomatis: ${s.ditahan_lama}`);
 console.log(`Izin bayar: ${out.terapkan?'dibuat '+s.izin_dibuat:'akan dibuat '+s.izin_akan_dibuat} · ditahan ${s.izin_ditahan}`);
 if(s.izin_ditahan)console.log('Izin ditahan: '+out.izin_bayar.filter(h=>h.status==='ditahan').map(h=>`${h.id} (${h.alasan})`).join(', '));
 console.log(`Laporan terakhir bertanggal ${out.laporan_terakhir||'-'}${jeda!==null&&jeda>7?` — CATATAN: ${jeda} hari tanpa laporan baru`:''}`);
 console.log('Pembayaran: tidak dicatat otomatis (atas permintaan pekerja); hanya izin bayar yang disiapkan.');
 const p=nilai('--keluaran');
 if(p)require('node:fs').writeFileSync(p,JSON.stringify({...out,hari_jakarta:hari},null,1));
 const {deleteApp}=require('firebase-admin/app');await deleteApp(app);
 return out.kode;
}

module.exports={rencana,sapu,dengar,hariIniJakarta};
if(require.main===module)main().then(c=>process.exit(c),e=>{console.error('GALAT:',e.message);process.exit(1);});
