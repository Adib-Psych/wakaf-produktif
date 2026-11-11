// ADR-054 (keluhan #48): koreksi detail laporan perangkat. Emulator demo saja; tidak menyentuh produksi.
const {test,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {policy,pair}=require('./fixtures.cjs');
const {processCreated,detailOnlyHead}=require('../processor.cjs');
const {jalankan,commandId,sha256}=require('../koreksi-detail.cjs');
const enabled=!!process.env.FIRESTORE_EMULATOR_HOST;
const app=enabled?initializeApp({projectId:'demo-wakaf-wages'},'koreksi-detail-tests'):null;
const db=app?getFirestore(app,'uji-koreksi-detail'):null;   // basis data terpisah: berkas uji lain menghapus (default) secara paralel
const wid='wage_v1_TEST_WORKER_2026-10-19';
const panjang='synthetic isolated test';
async function seed(id='lap_test',overrides={},lane='device_reports'){const v=pair(id,overrides,lane),b=db.batch();b.set(db.doc(lane+'/'+id),v);b.set(db.doc((lane==='device_reports'?'device_receipts':'entry_receipts')+'/'+id),v);await b.commit();return v;}
const data=async p=>(await db.doc(p).get()).data();
const paket=(over={})=>({paket:'uji',disetujui:'uji sintetis',items:[{report_id:'lap_test',detail_lama_sha256:sha256(panjang),detail_baru:'Ringkasan sintetis.',alasan:'Catatan audit dipindah dari detail.',...over}]});
beforeEach(async()=>{if(!enabled)return;for(const c of await db.listCollections())await db.recursiveDelete(c);await db.doc('wage_policy/active').set(policy);await db.doc('upah/active').set({data:[]});});
after(async()=>{if(app)await deleteApp(app);});

test('detailOnlyHead hanya menerima perubahan kolom detail',()=>{
 const b={id:'lap_x',detail:'lama',durasi:'setengah_hari',tanggal:'2026-10-19'};
 assert.equal(detailOnlyHead({revision:2,command_id:'cmd_a',owner_uid:'u',body:{...b,detail:'baru'}},b,'u'),true);
 assert.equal(detailOnlyHead({revision:2,command_id:'cmd_a',owner_uid:'u',body:{...b,detail:'baru',durasi:'full_day'}},b,'u'),false);
 assert.equal(detailOnlyHead({revision:2,command_id:'cmd_a',owner_uid:'lain',body:{...b,detail:'baru'}},b,'u'),false);
 assert.equal(detailOnlyHead({revision:2,command_id:'cmd_a',owner_uid:'u',body:{...b,detail:'  '}},b,'u'),false);
});

test('uji kering tidak menulis apa pun',{skip:!enabled},async()=>{
 await seed();await processCreated(db,'device_reports','lap_test');
 const out=await jalankan(db,paket());
 assert.equal(out.hasil[0].status,'rencana');
 for(const p of ['report_heads/lap_test','operation_events/'+commandId('lap_test'),'operation_receipts/'+commandId('lap_test')])assert.equal(await data(p),undefined);
});

test('tulis: rantai lengkap, asli utuh, hak upah identik, dan sapuan ulang tetap eligible',{skip:!enabled},async()=>{
 const asli=await seed();await processCreated(db,'device_reports','lap_test');
 const upahAwal=await data('wage_entitlements/'+wid);assert.equal(upahAwal.eligible,true);
 const out=await jalankan(db,paket(),{tulis:true});
 assert.equal(out.hasil[0].status,'ditulis');assert.equal(out.hasil[0].baca_ulang,'cocok');
 const cid=commandId('lap_test'),h=await data('report_heads/lap_test'),e=await data('operation_events/'+cid),r=await data('operation_receipts/'+cid);
 assert.equal(h.revision,2);assert.equal(h.body.detail,'Ringkasan sintetis.');assert.deepEqual(e,r);
 assert.equal(e.operation.kind,'device_detail');assert.equal(e.operation.predecessor,'lap_test');assert.equal(e.writer_epoch,asli.writer_epoch);assert.equal(e.roster_version,asli.roster_version);
 const {detail:_a,...kunciAsli}=asli.submitted_body,{detail:_b,...kunciBaru}=h.body;assert.deepEqual(kunciBaru,kunciAsli);
 assert.deepEqual(await data('device_reports/lap_test'),await data('device_receipts/lap_test'));
 assert.equal((await data('device_reports/lap_test')).submitted_body.detail,panjang);
 // Laporan lain pada hari yang sama memicu pemrosesan ulang seluruh hari pekerja: hak upah tidak boleh diblokir.
 await seed('lap_sameday');await processCreated(db,'device_reports','lap_sameday');
 const upahAkhir=await data('wage_entitlements/'+wid);assert.equal(upahAkhir.eligible,true);assert.equal(upahAkhir.blocked_reason??null,null);assert.equal(upahAkhir.tarif,upahAwal.tarif);assert.equal(upahAkhir.status,'belum');
 assert.notEqual((await data('wage_processing/'+wid)).reason,'correction_requires_review');
});

test('diulang: idempoten, tidak menulis ulang',{skip:!enabled},async()=>{
 await seed();await jalankan(db,paket(),{tulis:true});
 const before=await data('operation_events/'+commandId('lap_test'));
 const out=await jalankan(db,paket(),{tulis:true});
 assert.equal(out.hasil[0].status,'sudah');assert.equal(out.hasil[0].baca_ulang,'cocok');
 assert.deepEqual(await data('operation_events/'+commandId('lap_test')),before);
});

test('pagar: detail lama berubah, laporan staf, kepala lain, isi berbeda',{skip:!enabled},async()=>{
 await seed();
 assert.equal((await jalankan(db,paket({detail_lama_sha256:sha256('bukan ini')}),{tulis:true})).hasil[0].sebab,'detail-lama-berubah');
 await seed('lap_staf',{},'laporan');
 assert.equal((await jalankan(db,paket({report_id:'lap_staf'}),{tulis:true})).hasil[0].sebab,'asli-tidak-sah:pair_missing');
 await db.doc('report_heads/lap_test').set({revision:2,command_id:'cmd_lain',owner_uid:'synthetic-private-owner',body:{}});
 assert.match((await jalankan(db,paket(),{tulis:true})).hasil[0].sebab,/^kepala-sudah-ada/);
 await db.doc('report_heads/lap_test').delete();await jalankan(db,paket(),{tulis:true});
 assert.match((await jalankan(db,paket({detail_baru:'Teks lain.'}),{tulis:true})).hasil[0].sebab,/^kepala-sudah-ada/);
});

test('kepala yang mengubah kolom upah tetap ditahan untuk review',{skip:!enabled},async()=>{
 const asli=await seed();await processCreated(db,'device_reports','lap_test');
 await db.doc('report_heads/lap_test').set({revision:2,command_id:'cmd_x',owner_uid:asli.owner_uid,body:{...asli.submitted_body,durasi:'full_day'}});
 await seed('lap_sameday');await processCreated(db,'device_reports','lap_sameday');
 const w=await data('wage_entitlements/'+wid);assert.equal(w.eligible,false);assert.equal(w.blocked_reason,'correction_requires_review');
});
