const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {policy,pair,body}=require('./fixtures.cjs');
const {sapu,rencana,hariIniJakarta}=require('../nightly.cjs');
const enabled=!!process.env.FIRESTORE_EMULATOR_HOST;
const app=enabled?initializeApp({projectId:'demo-wakaf-wages'},'nightly-tests'):null;
const db=app?getFirestore(app):null;
const hari=t=>({tgl:t,tanggal:t});
async function seed(id,overrides={},{lane='device_reports',receipt=true}={}){const v=pair(id,overrides,lane);await db.doc(lane+'/'+id).set(v);if(receipt)await db.doc((lane==='device_reports'?'device_receipts':'entry_receipts')+'/'+id).set(v);return v;}
async function ukuran(c){return (await db.collection(c).get()).size;}
beforeEach(async()=>{if(!enabled)return;for(const c of await db.listCollections())await db.recursiveDelete(c);await db.doc('wage_policy/active').set(policy);await db.doc('upah/active').set({data:[]});});
after(async()=>{if(app)await deleteApp(app);});

test('rencana saja tidak menulis apa pun',{skip:!enabled},async()=>{
 await seed('lap_a',hari('2026-11-02'));
 const r=await sapu(db);
 assert.equal(r.proses.length,1);assert.equal(r.hasil.length,0);
 assert.equal(await ukuran('wage_entitlements'),0);assert.equal(await ukuran('wage_processing'),0);
});

test('laporan modern baru membentuk satu hak upah belum dibayar; sapuan ulang tidak menggandakan',{skip:!enabled},async()=>{
 await seed('lap_a',hari('2026-11-02'));await seed('lap_b',{...hari('2026-11-03'),durasi:'full_day'});
 const r1=await sapu(db,{terapkan:true});
 assert.equal(r1.ringkas.dibuat,2);assert.equal(r1.kode,0);
 const w=(await db.doc('wage_entitlements/wage_v1_TEST_WORKER_2026-11-03').get()).data();
 assert.equal(w.status,'belum');assert.equal(w.tarif,100000);assert.equal(w.eligible,true);
 const r2=await sapu(db,{terapkan:true});
 assert.equal(r2.proses.length,0);assert.equal(await ukuran('wage_entitlements'),2);
});

test('tanda terima menyusul: pair_missing diulang otomatis pada malam berikutnya',{skip:!enabled},async()=>{
 const v=await seed('lap_c',hari('2026-11-04'),{receipt:false});
 const r1=await sapu(db,{terapkan:true});
 assert.equal(r1.ringkas.ditahan,1);assert.equal(r1.kode,3);
 await db.doc('device_receipts/lap_c').set(v);
 const r2=await sapu(db,{terapkan:true});
 assert.equal(r2.proses[0].sebab,'ulang:pair_missing');assert.equal(r2.ringkas.dibuat,1);
});

test('unresolved lain tidak diulang otomatis, hanya dilaporkan',{skip:!enabled},async()=>{
 await seed('lap_d',{...hari('2026-11-05'),durasi:null});
 const r1=await sapu(db,{terapkan:true});
 assert.equal(r1.hasil[0].alasan,'duration_missing');
 const r2=await sapu(db,{terapkan:true});
 assert.equal(r2.proses.length,0);assert.equal(r2.ditahan_lama.length,1);
 const r3=await rencana(db,{ulangUnresolved:true});
 assert.equal(r3.proses.length,1);
});

test('laporan legacy tidak pernah diterima otomatis; sesudah tanggal berlaku dilaporkan menunggu atestasi',{skip:!enabled},async()=>{
 await db.doc('laporan/lap_legacy_baru').set(body('lap_legacy_baru',hari('2026-11-06')));
 await db.doc('laporan/lap_legacy_lama').set(body('lap_legacy_lama',hari('2026-09-20')));
 await db.doc('laporan/AbcRandomLegacy').set(body('AbcRandomLegacy',hari('2026-11-06')));
 const r=await sapu(db,{terapkan:true});
 assert.deepEqual(r.menunggu_atestasi.map(x=>x.id),['lap_legacy_baru']);
 assert.equal(r.kode,3);assert.equal(await ukuran('wage_entitlements'),0);assert.equal(await ukuran('wage_processing'),0);
});

test('tidak pernah menyentuh pembayaran, kas, atau upah lama',{skip:!enabled},async()=>{
 const lama=[{id:1,pelapor:'X',tgl:'2026-09-01',status:'lunas',tarif:50000}];
 await db.doc('upah/active').set({data:lama});
 await seed('lap_e',hari('2026-11-07'));
 await sapu(db,{terapkan:true});
 for(const c of ['payroll_states','payroll_events','cashbook'])assert.equal(await ukuran(c),0,c);
 assert.deepEqual((await db.doc('upah/active').get()).data().data,lama);
});

test('tanggal Jakarta dipakai untuk catatan jeda laporan',()=>{
 assert.equal(hariIniJakarta(new Date('2026-11-09T18:30:00Z')),'2026-11-10');
});
