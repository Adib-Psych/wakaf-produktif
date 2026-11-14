// Izin bayar otomatis (payroll_targets) — emulator Firestore saja.
const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {buatIzin,sapuIzin,sisaKasbon}=require('../izin-bayar.cjs');
const enabled=!!process.env.FIRESTORE_EMULATOR_HOST;
const app=enabled?initializeApp({projectId:'demo-wakaf-wages'},'izin-bayar-tests'):null;
const db=app?getFirestore(app,'uji-izin-bayar'):null;   // basis data sendiri (uji paralel)
const ID='wage_v1_CHRISTO_2026-11-09';
const wage=(o={})=>({id:ID,pelapor:'CHRISTO',tgl:'2026-11-09',worker:'Christo',model:'harian',qty:1,satuan:'setengah_hari',tarif:50000,status:'belum',eligible:true,sources:[{lane:'device_reports',report_id:'lap_x',revision:1}],fund:'K1_K3',...o});
async function siap({w=wage(),proses={status:'created',reason:'eligible'},upah=[],kas=[]}={}){
 await db.doc('wage_entitlements/'+ID).set(w);
 if(proses)await db.doc('wage_processing/'+ID).set({...proses,report_id:'lap_x',tgl:'2026-11-09',worker:'CHRISTO',sources:w.sources});
 await db.doc('upah/active').set({data:upah});await db.doc('cashbook/active').set({data:kas});
}
const izin=async()=>(await db.doc('payroll_targets/'+ID).get());
beforeEach(async()=>{if(!enabled)return;for(const c of await db.listCollections())await db.recursiveDelete(c);});
after(async()=>{if(app)await deleteApp(app);});

test('sisa kasbon: kasbon dikurangi potongan pada baris upah atas nama yang sama',()=>{
 const rows=[{ket:'Kasbon Christo — raket [kasbon]',keluar:200000},{ket:'Kasbon Christo — tas [kasbon]',keluar:100000},
  {ket:'Upah Christo — lain di Kebun 3 [lgs·batch] — dipotong kasbon',keluar:0,potong_kasbon:250000},
  {ket:'Kasbon Lek Nardi — bensin [kasbon]',keluar:50000},{ket:'Upah Nardi — lain [lgs]',keluar:50000}];
 assert.deepEqual(sisaKasbon(rows,wage()),{kasbon:300000,potong:250000,sisa:50000});
 assert.deepEqual(sisaKasbon(rows,{worker:'Lek Nardi',pelapor:'NARDI'}),{kasbon:50000,potong:0,sisa:50000});
 assert.deepEqual(sisaKasbon(rows,{worker:'Mak Mis',pelapor:'MAKMIS'}),{kasbon:0,potong:0,sisa:0});
});

test('semua syarat lolos: izin dibuat dengan salinan persis hak upah; ulang = sudah',{skip:!enabled},async()=>{
 await siap();
 assert.deepEqual(await buatIzin(db,ID),{id:ID,status:'dibuat'});
 assert.deepEqual((await izin()).data(),{enabled:true,wage:wage()});
 assert.deepEqual(await buatIzin(db,ID),{id:ID,status:'sudah'});
});

test('kasbon belum lunas menahan izin; lunas tidak',{skip:!enabled},async()=>{
 await siap({kas:[{ket:'Kasbon Christo — x [kasbon]',keluar:100000},{ket:'Upah Christo — y — dipotong kasbon',keluar:0,potong_kasbon:50000}]});
 const r=await buatIzin(db,ID);assert.equal(r.status,'ditahan');assert.equal(r.alasan,'kasbon_belum_lunas');assert.equal(r.kasbon.sisa,50000);
 assert.equal((await izin()).exists,false);
 await db.doc('cashbook/active').set({data:[{ket:'Kasbon Christo — x [kasbon]',keluar:100000},{ket:'Upah Christo — y — dipotong kasbon',keluar:0,potong_kasbon:100000}]});
 assert.equal((await buatIzin(db,ID)).status,'dibuat');
});

test('syarat lain menahan tanpa menulis',{skip:!enabled},async()=>{
 const kasus=[
  [{w:wage({eligible:false})},'hak_upah_tidak_eligible'],
  [{w:wage({status:'lunas'})},'hak_upah_tidak_eligible'],
  [{w:wage({sources:[]})},'sumber_tidak_tunggal'],
  [{proses:{status:'unresolved',reason:'duration_missing'}},'proses_belum_tuntas'],
  [{proses:null},'proses_belum_tuntas'],
  [{upah:[{pelapor:'CHRISTO',tgl:'2026-11-09',status:'lunas'}]},'upah_lama_tanggal_sama'],
 ];
 for(const [opsi,alasan] of kasus){
  for(const c of await db.listCollections())await db.recursiveDelete(c);
  await siap(opsi);
  const r=await buatIzin(db,ID);assert.equal(r.status,'ditahan',alasan);assert.equal(r.alasan,alasan);assert.equal((await izin()).exists,false,alasan);
 }
});

test('sudah dicatat dibayar atau izin berbeda: ditahan, izin lama tidak diubah',{skip:!enabled},async()=>{
 await siap();await db.doc('payroll_states/'+ID).set({status:'lunas'});
 assert.equal((await buatIzin(db,ID)).alasan,'sudah_dicatat_dibayar');
 await db.doc('payroll_states/'+ID).delete();
 const lain={enabled:true,wage:wage({tarif:999})};await db.doc('payroll_targets/'+ID).set(lain);
 assert.equal((await buatIzin(db,ID)).alasan,'izin_ada_tapi_berbeda');
 assert.deepEqual((await izin()).data(),lain);
});

test('sapuan: rencana tidak menulis; terapkan membuat; yang ditahan memberi kode 3',{skip:!enabled},async()=>{
 await siap();
 const id2='wage_v1_NARDI_2026-11-10';
 await db.doc('wage_entitlements/'+id2).set(wage({id:id2,pelapor:'NARDI',worker:'Lek Nardi',tgl:'2026-11-10'}));
 await db.doc('wage_processing/'+id2).set({status:'unresolved',reason:'duration_missing'});
 const a=await sapuIzin(db);
 assert.equal(a.ringkas.akan_dibuat,1);assert.equal(a.ringkas.ditahan,1);assert.equal(a.kode,3);assert.equal((await izin()).exists,false);
 const b=await sapuIzin(db,{tulis:true});
 assert.equal(b.ringkas.dibuat,1);assert.equal((await izin()).exists,true);
 const c=await sapuIzin(db,{tulis:true});
 assert.equal(c.ringkas.diperiksa,1,'hanya yang belum punya izin yang diperiksa ulang');
});
