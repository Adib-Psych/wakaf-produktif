'use strict';
// Actual submitForm + actual recovery queue, isolated synthetic DOM/storage only.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const {randomUUID} = require('node:crypto');
const key = 'wkkn_recovery_staff_pending_v1';
const html = fs.readFileSync(path.join(__dirname, '../monitor-v2.html'), 'utf8');
const submit = html.slice(html.indexOf('async function submitForm() {'), html.indexOf('// ⭐ 22 Jul 2026 — MULTI-AKTIVITAS INLINE'));
function harness(options = {}) {
  const storage = options.storage || new Map();
  const calls = {alerts: [], resets: 0, transport: [], uuid: 0, writes: [], enqueue: 0, drain: 0};
  const fields = {'f-tgl': '2026-01-01', 'f-kategori': 'lain', 'f-catatan': 'synthetic body'};
  const c = vm.createContext({
    navigator:{locks:{request:async(_k,fn)=>fn()}},
    window: {validateStaffReport:()=>true,addEventListener() {},authorizedReports:{sessionOwner:()=> 'synthetic-owner'}}, document: {querySelectorAll:()=>[{value:'lain'},{value:'panen'}],addEventListener() {}, getElementById: id => ({value: fields[id] || ''})},
    localStorage: {getItem: k => storage.get(k) ?? null, setItem: (k, v) => {calls.writes.push({k, v}); if (options.storageFailure && k === key) throw Error('synthetic disk full'); storage.set(k, v);}},
    console: {warn() {}}, alert: s => calls.alerts.push(s), confirm: () => true,
    crypto: options.noCrypto ? undefined : {randomUUID: () => {calls.uuid++; if (calls.uuid === options.throwAt) throw Error('synthetic entropy failure'); return options.uuid || randomUUID();}},
    CURRENT_EDIT_LAPORAN_ID: null, TARIF_PEKERJA: {},
    STATE: {pelapor: 'SYNTHETIC', bidang: '1', bidang_list: ['1'], laporan: [], durasi: null},
    computeRainfallAlerts: () => [], harvestDetailForm: () => null,
    collectExtraKategori: () => options.extras || [],
    resetForm: () => calls.resets++, renderDashboard() {}, renderLog() {}
  });
  for (const file of ['report-content.js', 'entry-recovery.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../recovery', file), 'utf8'), c);
  vm.runInContext(submit, c);
  c.window.syncLaporanEntryToFirestore = async e => {
    calls.transport.push({entry: JSON.parse(JSON.stringify(e)), durable: storage.get(key)});
    throw Error('synthetic lost ACK');
  };
  const q = c.window.entryRecovery;
  c.window.entryRecovery = {...q,
    enqueue: entries => {calls.enqueue++; return q.enqueue(entries);},
    enqueueAtomic: entries=>{calls.enqueue++;return q.enqueueAtomic(entries);},
    drain: (...args) => {calls.drain++; return q.drain(...args);}
  };
  calls.writes.length = 0; // Exclude existing startup preservation, measure only submission.
  return {c, q, storage, calls, fields, submit: () => c.submitForm()};
}
const uuidID = /^lap_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const entry = () => ({id: 'synthetic-existing', created_at: 'synthetic-time', detail: 'original', nested: {a: 1, b: 2}, photos: ['a', 'b']});
test('STAFF enqueue: differing body with same ID/time explicitly conflicts and preserves pending bytes', () => {
  const h = harness(); h.q.enqueue([entry()]); const before = h.storage.get(key);
  assert.throws(() => h.q.enqueue([{...entry(), detail: 'changed'}]), /Konflik.*ID/);
  assert.equal(h.storage.get(key), before);
});
test('STAFF enqueue control: canonical exact retry ignores object key order without duplicating', () => {
  const h = harness(); h.q.enqueue([entry()]); const before = h.storage.get(key);
  h.q.enqueue([{...entry(), nested: {b: 2, a: 1}}]);
  assert.equal(h.storage.get(key), before);
});
test('STAFF enqueue control: array order difference conflicts', () => {
  const h = harness(); h.q.enqueue([entry()]); const before = h.storage.get(key);
  assert.throws(() => h.q.enqueue([{...entry(), photos: ['b', 'a']}]), /Konflik.*ID/);
  assert.equal(h.storage.get(key), before);
});
test('STAFF enqueue control: conflict after batch append leaves entire persisted queue unchanged', () => {
  const h = harness(); h.q.enqueue([entry()]); const before = h.storage.get(key);
  assert.throws(() => h.q.enqueue([{...entry(), id: 'new'}, {...entry(), detail: 'changed'}]), /Konflik.*ID/);
  assert.equal(h.storage.get(key), before);
});
test('STAFF enqueue control: conflicting IDs inside one batch write nothing', () => {
  const h = harness();
  assert.throws(() => h.q.enqueue([entry(), {...entry(), detail: 'changed'}]), /Konflik.*ID/);
  assert.equal(h.storage.get(key), undefined);
});
test('STAFF caller control: UUID collision leaves old pending, form and STATE intact with zero transport', async () => {
  const uuid = '12345678-1234-4123-8123-123456789abc';
  const h = harness({uuid}); h.q.enqueue([{...entry(), id: 'lap_' + uuid}]); const before = h.storage.get(key);
  await assert.doesNotReject(()=>h.submit());
  assert.equal(h.storage.get(key), before); assert.equal(h.c.STATE.laporan.length, 0);
  assert.equal(h.calls.resets, 0); assert.equal(h.calls.transport.length, 0);
  assert.match(h.calls.alerts.join(' '), /Konflik.*ID/);
});
test('STAFF caller control: storage failure retains form and never starts transport', async () => {
  const h = harness({storageFailure: true}); await h.submit();
  assert.equal(h.storage.get(key), undefined); assert.equal(h.c.STATE.laporan.length, 0);
  assert.equal(h.calls.resets, 0); assert.equal(h.calls.transport.length, 0);
  assert.match(h.calls.alerts.join(' '), /Antrian gagal disimpan/);
});
test('STAFF ID: primary secure UUID is persisted before transport and survives lost ACK reload/retry', async () => {
  const h = harness(); await h.submit(); await h.q.drain();
  const saved = JSON.parse(h.storage.get(key));
  assert.match(saved[0].id, uuidID);
  assert.equal(h.calls.uuid, 1);
  assert.deepEqual(JSON.parse(h.calls.transport[0].durable), saved);
  const reloaded = harness({storage: h.storage}); await reloaded.q.drain();
  assert.deepEqual(JSON.parse(reloaded.storage.get(key)), saved);
  assert.deepEqual(reloaded.calls.transport[0].entry, saved[0]);
  assert.equal(reloaded.calls.uuid, 0, 'retry must not mint another identity');
});
test('STAFF ID: unavailable secure UUID fails closed with form retained and zero transport', async () => {
  const h = harness({noCrypto: true});
  await assert.doesNotReject(()=>h.submit());
  assert.equal(h.storage.get(key), undefined);
  assert.equal(h.c.STATE.laporan.length, 0);
  assert.equal(h.calls.resets, 0);
  assert.equal(h.calls.transport.length, 0);
  assert.match(h.calls.alerts.join(' '), /UUID/);
});
test('STAFF ID: unsupported multi-category batch refuses before identity/save/reset', async () => {
 const h=harness({extras:['synthetic-extra']});await h.submit();assert.equal(h.storage.get(key),undefined);assert.equal(h.calls.uuid,0);assert.equal(h.calls.resets,0);assert.equal(h.calls.transport.length,0);
});

for (const legacy of [false, true]) for (const throwAt of [1, 2]) test('STAFF UUID exception at ' + (throwAt === 1 ? 'primary' : 'extra') + (legacy ? ' with legacy bidang_list' : '') + ': controlled not-saved alert and atomic preservation', async () => {
  const storage = new Map([[key, JSON.stringify([entry()])], ['wkkn_v2_laporan', 'synthetic cached bytes']]);
  const h = harness({storage, throwAt, extras: ['synthetic-extra']});
  if (legacy) h.c.STATE.bidang_list = [];
  const before = [...storage], state = JSON.stringify(h.c.STATE), form = JSON.stringify(h.fields);
  await assert.doesNotReject(h.submit);
  assert.deepEqual([...storage], before);
  assert.equal(JSON.stringify(h.c.STATE), state);
  assert.equal(JSON.stringify(h.fields), form);
  assert.equal(h.calls.resets, 0); assert.equal(h.calls.transport.length, 0);
  assert.equal(h.calls.enqueue, 0); assert.equal(h.calls.drain, 0); assert.deepEqual(h.calls.writes, []);
  assert.equal(h.calls.uuid, 0, 'unsupported extra is refused before UUID; no fallback or identity retry');
  assert.equal(h.calls.alerts.length, 1);
  assert.match(h.calls.alerts[0], /laporan belum disimpan; form tetap tersedia/);
});
