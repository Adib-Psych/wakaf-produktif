const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '..');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require(path.join(repo, 'recovery/node_modules/@firebase/rules-unit-testing'));
const { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, runTransaction, arrayUnion, serverTimestamp } = require(path.join(repo, 'recovery/node_modules/firebase/firestore'));
const PROJECT = 'demo-entry-safe';
const frozen = ['upah', 'cashbook', 'panen_data', 'panen_lots', 'panen_sampling', 'panen_future', 'opt_observations', 'opt_future', 'milestones', 'distribusi_pic', 'distribusi_future', 'sop_master', 'sop_status', 'worker_defs_custom', 'worker_tokens', 'invoices'];
const openRead = ['laporan','workers','upah','cashbook','opt_observations','panen_data','panen_lots','panen_sampling','sop_status','distribusi_pic','sop_master','worker_defs_custom','milestones','invoices','worker_tokens'];
const oldRow = { id: 'historical-row', kebun: 'K1', jumlah: 2, dicek: true, arbitrary_legacy: 'preserve-exactly' };
const oldRows = [oldRow, oldRow, { id: 'second-row', note: 'order and duplicates retained' }];
const singleton = { version: 'pohon-cabut-1.0', data: oldRows, updated_at: 'legacy-time', updated_by: 'legacy-admin', source: 'legacy', other_legacy_field: 42 };
const oldPayload = { version: '1.0', data: [], updated_at: 'test', nama: 'Synthetic worker', status: 'sent', signature_png: null };
const report = (id = 'synthetic-report', pelapor = 'BORONGAN', kategori = 'cabut_borongan') => ({ id, pelapor, kategori, tanggal: '2026-10-08', tgl: '2026-10-08', kebun: 'K1', jumlah_pohon: 3, pekerja_nama: 'Synthetic worker', lokasi: 'Synthetic location', metode: 'cabut', tali: 'merah', pending: [], created_at: '2026-10-08T01:00:00.000Z', schema_version: 'cabut-borongan-1.4', src: 'lapor_cabut_v4', status_verifikasi: 'masuk_log_belum_dicek', cabut_id: 'cabut_' + id });
const log = r => ({ id: 'cabut_' + r.id, kebun: r.kebun, jumlah: r.jumlah_pohon, tgl: r.tgl, metode: 'cabut', tali: 'merah', sakit: false, kondisi: 'Tali Merah · Dicabut', catatan: `Borongan · ${r.pekerja_nama} · ${r.lokasi}`, src_laporan: r.id, dicek: false, pending: r.pending, created_at: r.created_at });
let env, db;
before(async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^127\.0\.0\.1:8688$/);
  assert.equal(process.env.GCLOUD_PROJECT, PROJECT);
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host: '127.0.0.1', port: 8688,
    rules: fs.readFileSync(path.join(repo, process.env.RULES_MODE === 'legacy' ? 'firestore.rules' : 'recovery/firestore.entry-safe.rules'), 'utf8') } });
  db = env.unauthenticatedContext().firestore();
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const admin = ctx.firestore();
    const batch = writeBatch(admin);
    for (const c of new Set([...frozen,...openRead])) batch.set(doc(admin,c,'existing'),oldPayload);
    batch.set(doc(admin,'sop_status','pohon_cabut'),singleton);
    batch.set(doc(admin,'worker_tokens','SYNTHETIC_DYNAMIC'),{ nama: 'Synthetic registered worker' });
    batch.set(doc(admin,'laporan','immutable'),report('immutable','ANTO','harian'));
    batch.set(doc(admin,'audit_log','existing'),{ action: 'test', timestamp: 'test' });
    await batch.commit();
  });
});
after(async () => { if (env) await env.cleanup(); });
function atomic(r, l = log(r), fields = {}) {
  const b = writeBatch(db);
  b.set(doc(db,'laporan',r.id),r);
  b.update(doc(db,'sop_status','pohon_cabut'),{ data: arrayUnion(l), updated_at: serverTimestamp(), updated_by:'lapor_cabut', source:'lapor-cabut.html arrayUnion', ...fields });
  return b.commit();
}
async function rejectedAtomic(r, l, fields) {
  await assertFails(atomic(r,l,fields));
  assert.equal((await getDoc(doc(db,'laporan',r.id))).exists(), false);
  assert.deepEqual((await getDoc(doc(db,'sop_status','pohon_cabut'))).data(), singleton);
}
test('test network rejects non-loopback connection before making one', () => {
  assert.throws(() => require('node:net').connect({ host:'example.invalid', port:443 }), /Non-loopback/);
});
for (const c of frozen) for (const op of ['create','replace','delete']) {
  test(`freeze ${c}: ${op} (including old-client seed/replacement)`, async () => {
    const ref = doc(db,c,op === 'create' ? 'seed' : 'existing');
    await assertFails(op === 'delete' ? deleteDoc(ref) : setDoc(ref,oldPayload));
  });
}
for (const c of openRead) test(`legacy read compatibility: ${c} get and list (NOT privacy)`, async () => {
  await assertSucceeds(getDoc(doc(db,c,'existing')));
  await assertSucceeds(getDocs(collection(db,c)));
});
test('audit_log reads and unknown collection reads remain denied', async () => {
  await assertFails(getDoc(doc(db,'audit_log','existing')));
  await assertFails(getDocs(collection(db,'unknown')));
});
for (const pelapor of ['KUMPUL','YIT','ANTO','YASIR','KAMTO','HARNI','MAKMIS','CHRISTO','NARDI','WAKIF','ADIB','SYNTHETIC_DYNAMIC']) {
  test(`existing laporan create: ${pelapor}`, async () => {
    const r = report('ordinary-'+pelapor,pelapor,'harian'); delete r.cabut_id;
    await assertSucceeds(setDoc(doc(db,'laporan',r.id),r));
  });
}
test('BORONGAN unmarked cabut-only report remains allowed', async () => {
  const r = report(); delete r.cabut_id; r.status_verifikasi='menunggu';
  await assertSucceeds(setDoc(doc(db,'laporan',r.id),r));
});
test('BORONGAN cannot submit non-cabut category', async () => {
  const r = report('wrong-category','BORONGAN','harian'); delete r.cabut_id;
  await assertFails(setDoc(doc(db,'laporan',r.id),r));
});
test('unregistered pelapor cannot create laporan', async () => {
  const r=report('outsider','UNREGISTERED','harian'); delete r.cabut_id;
  await assertFails(setDoc(doc(db,'laporan',r.id),r));
});
test('worker cannot register their own allowlist token', async () => {
  await assertFails(setDoc(doc(db,'worker_tokens','UNREGISTERED'),{nama:'Synthetic attacker'}));
  const r=report('outsider','UNREGISTERED','harian'); delete r.cabut_id;
  await assertFails(setDoc(doc(db,'laporan',r.id),r));
});
for (const field of ['pelapor','tanggal','kategori','created_at','schema_version']) test(`laporan create rejects missing ${field}`, async () => {
  const r=report('invalid','ANTO','harian'); delete r.cabut_id; delete r[field];
  await assertFails(setDoc(doc(db,'laporan',r.id),r));
});
test('laporan updates denied even known worker', async () => {
  await assertFails(updateDoc(doc(db,'laporan','immutable'),{jumlah_pohon:999}));
});
test('laporan deletes denied', async () => { await assertFails(deleteDoc(doc(db,'laporan','immutable'))); });
test('known workers can retain last_active tracking (not worker definitions)', async () => {
  await assertSucceeds(setDoc(doc(db,'workers','ANTO'),{last_active:'synthetic-iso'}));
  await assertFails(deleteDoc(doc(db,'workers','ANTO')));
});
test('append-only audit create remains compatible; edits/deletes denied', async () => {
  await assertSucceeds(setDoc(doc(db,'audit_log','new'),{action:'synthetic',timestamp:'synthetic'}));
  await assertFails(updateDoc(doc(db,'audit_log','existing'),{action:'altered'}));
  await assertFails(deleteDoc(doc(db,'audit_log','existing')));
});
test('atomic cabut creates report and exactly one unchecked log; preserves every historical row', async () => {
  const r=report(); await assertSucceeds(atomic(r));
  assert.deepEqual((await getDoc(doc(db,'laporan',r.id))).data(),r);
  const stored=(await getDoc(doc(db,'sop_status','pohon_cabut'))).data();
  assert.deepEqual(stored.data,[...oldRows,log(r)]);
  assert.equal(stored.version,singleton.version);
  assert.equal(stored.other_legacy_field,42);
});
test('two concurrent distinct transaction submissions both append without clobber', async () => {
  const submit = r => runTransaction(db,async tx => {
    const ref=doc(db,'laporan',r.id); if ((await tx.get(ref)).exists()) return;
    tx.set(ref,r); tx.update(doc(db,'sop_status','pohon_cabut'),{data:arrayUnion(log(r)),updated_at:serverTimestamp(),updated_by:'lapor_cabut',source:'lapor-cabut.html arrayUnion'});
  });
  const outcomes=await Promise.allSettled([submit(report('concurrent-a')),submit(report('concurrent-b'))]);
  assert.deepEqual(outcomes.map(o=>o.status),['fulfilled','fulfilled']);
  const rows=(await getDoc(doc(db,'sop_status','pohon_cabut'))).data().data;
  assert.deepEqual(rows.slice(0,oldRows.length),oldRows);
  assert.equal(rows.length,oldRows.length+2);
  assert.deepEqual(new Set(rows.slice(oldRows.length).map(l=>l.src_laporan)),new Set(['concurrent-a','concurrent-b']));
});
test('lost-ACK retry reads marker and makes no writes, preserving an already edited log', async () => {
  const r=report(); await assertSucceeds(atomic(r));
  const verified={...log(r),dicek:true,catatan:'synthetic admin correction'};
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'sop_status','pohon_cabut'),{data:[...oldRows,verified]}));
  await assertSucceeds(runTransaction(db,async tx=> {
    const existing=await tx.get(doc(db,'laporan',r.id));
    if (existing.exists() && existing.data().cabut_id === 'cabut_'+r.id) return;
    throw new Error('Unexpected missing marker');
  }));
  assert.deepEqual((await getDoc(doc(db,'sop_status','pohon_cabut'))).data().data,[...oldRows,verified]);
});
test('report marker without atomic append denied', async () => { const r=report(); await assertFails(setDoc(doc(db,'laporan',r.id),r)); });
test('standalone log append without report denied', async () => {
  await assertFails(updateDoc(doc(db,'sop_status','pohon_cabut'),{data:arrayUnion(log(report())),updated_at:serverTimestamp(),updated_by:'lapor_cabut',source:'lapor-cabut.html arrayUnion'}));
});
test('preexisting report cannot authorize a later append', async () => {
  const r=report(); await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'laporan',r.id),r));
  await assertFails(updateDoc(doc(db,'sop_status','pohon_cabut'),{data:arrayUnion(log(r)),updated_at:serverTimestamp(),updated_by:'lapor_cabut',source:'lapor-cabut.html arrayUnion'}));
});
for (const [name, patch] of Object.entries({ 'wrong id':{id:'cabut_wrong'},'wrong src_laporan':{src_laporan:'wrong'},'wrong kebun':{kebun:'K2'},'wrong quantity':{jumlah:99},'wrong date':{tgl:'2026-01-01'},'wrong created_at':{created_at:'wrong'},'wrong pending':{pending:['akar_keluar']},'verified log':{dicek:true},'wrong method':{metode:'tebang'},'wrong tali':{tali:'hijau'},'sakit flag':{sakit:true},'wrong kondisi':{kondisi:'paid'},'pay field':{paid:true},'publication field':{published:true} })) {
  test(`atomic append denies ${name}`,async()=>{const r=report();await rejectedAtomic(r,{...log(r),...patch});});
}
for (const [name, fields] of Object.entries({ 'change version':{version:'overwritten'},'pay field':{paid:true},'publish field':{published:true},'change legacy field':{other_legacy_field:0},'wrong source':{source:'monitor-v2'},'wrong updated_by':{updated_by:'WAKIF'},'client timestamp':{updated_at:'fake'},'replace history':{data:[log(report())]},'reorder history':{data:[...oldRows].reverse().concat(log(report()))},'modify historical row':{data:[{...oldRow,jumlah:999},...oldRows.slice(1),log(report())]},'two new log rows':{data:[...oldRows,log(report()),{...log(report()),id:'extra'}]} })) {
  test(`atomic append denies ${name}`,async()=>{const r=report();await rejectedAtomic(r,log(r),fields);});
}
for (const [name, patch] of Object.entries({ 'zero quantity':{jumlah_pohon:0},'negative quantity':{jumlah_pohon:-1},'fraction quantity':{jumlah_pohon:1.5},'wrong category':{kategori:'harian'},'wrong pelapor':{pelapor:'ANTO'},'mismatched report id':{id:'other'},'wrong marker':{cabut_id:'wrong'},'verified report':{status_verifikasi:'masuk_log'},'non-list pending':{pending:'bad'},'unknown pending':{pending:['unknown']} })) {
  test(`atomic cabut denies report ${name}`,async()=>{const r={...report(),...patch};await rejectedAtomic(r,log(r));});
}
test('missing cabut singleton cannot be seeded even with atomic report',async()=>{
  await env.withSecurityRulesDisabled(ctx=>deleteDoc(doc(ctx.firestore(),'sop_status','pohon_cabut')));
  const r=report(), b=writeBatch(db); b.set(doc(db,'laporan',r.id),r); b.set(doc(db,'sop_status','pohon_cabut'),{...singleton,data:[log(r)],updated_at:serverTimestamp(),updated_by:'lapor_cabut',source:'lapor-cabut.html arrayUnion'});
  await assertFails(b.commit());
  assert.equal((await getDoc(doc(db,'laporan',r.id))).exists(),false);
});
test('invoice signing, compliance publication, cashbook merge and cabut full replacement are frozen',async()=>{
  await assertFails(updateDoc(doc(db,'invoices','existing'),{signature_png:'synthetic',signed_at:'synthetic',signed_meta:{},status:'signed'}));
  await assertFails(setDoc(doc(db,'sop_status','compliance'),{version:'compliance-1.0',ytd_pct:100}));
  await assertFails(setDoc(doc(db,'cashbook','existing'),{version:'1.0',data:[]},{merge:true}));
  await assertFails(setDoc(doc(db,'sop_status','pohon_cabut'),{...singleton,data:[]}));
});
test('real client report shape accepts nonempty pending checklist without verification or pay',async()=>{
  const r={...report(),kebun_primary:'K1',kebun_list_str:'K1',checklist:{tali_merah:true,akar_keluar:false,lubang_ditutup:true,kayu_dibawa_keluar:true},pending:['akar_keluar'],pending_label:['dicabut sampai akar'],gps:null,photos:[]};
  await assertSucceeds(atomic(r));
  assert.deepEqual((await getDoc(doc(db,'sop_status','pohon_cabut'))).data().data,[...oldRows,log(r)]);
});
test('cabut report cannot inject payment or publication fields',async()=>{
  for (const extra of [{paid:true},{published:true}]) {
    const r={...report(),...extra};await rejectedAtomic(r,log(r));
  }
});
test('second write retry is denied; callers must read and no-op',async()=>{
  const r=report();await assertSucceeds(atomic(r));
  await assertFails(atomic(r));
  assert.deepEqual((await getDoc(doc(db,'sop_status','pohon_cabut'))).data().data,[...oldRows,log(r)]);
});
test('malformed historical cabut data fails closed',async()=>{
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'sop_status','pohon_cabut'),{data:'not-a-list'}));
  const r=report();await assertFails(atomic(r));
  assert.equal((await getDoc(doc(db,'laporan',r.id))).exists(),false);
  assert.equal((await getDoc(doc(db,'sop_status','pohon_cabut'))).data().data,'not-a-list');
});
test('cabut cannot piggyback cashbook or worker token writes in same commit',async()=>{
  for (const c of ['cashbook','worker_tokens']) {
    const r=report();const b=writeBatch(db);b.set(doc(db,'laporan',r.id),r);
    b.update(doc(db,'sop_status','pohon_cabut'),{data:arrayUnion(log(r)),updated_at:serverTimestamp(),updated_by:'lapor_cabut',source:'lapor-cabut.html arrayUnion'});
    b.set(doc(db,c,'forbidden'),oldPayload);await assertFails(b.commit());
    assert.equal((await getDoc(doc(db,'laporan',r.id))).exists(),false);
    assert.deepEqual((await getDoc(doc(db,'sop_status','pohon_cabut'))).data(),singleton);
  }
});
test('empty but existing log supports exactly one append',async()=>{
  await env.withSecurityRulesDisabled(ctx=>updateDoc(doc(ctx.firestore(),'sop_status','pohon_cabut'),{data:[]}));
  const r=report();await assertSucceeds(atomic(r));
  assert.deepEqual((await getDoc(doc(db,'sop_status','pohon_cabut'))).data().data,[log(r)]);
});
