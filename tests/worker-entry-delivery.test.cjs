// Synthetic extracted-function regression tests. No Firebase/network/production acceptance.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const lapor = fs.readFileSync(path.join(root, 'lapor.html'), 'utf8');
const cabut = fs.readFileSync(path.join(root, 'lapor-cabut.html'), 'utf8');
const silent = { log() {}, warn() {}, error() {} };
function fn(source, name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, `actual source function ${name} exists`);
  const tail = source.slice(start);
  const end = tail.indexOf('\n}');
  return tail.slice(0, end + 2);
}
function deferred() { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function laporHarness(options = {}) {
  const items = [{ id: 1, status: 'pending', data: { id: 'lap_synthetic_1' } }];
  const writes = [], toasts = [], marked = [];
  const window = { firestoreDB: {}, firestorePush: async data => { writes.push(clone(data)); return data.id; } };
  Object.assign(window, options.window || {});
  const context = vm.createContext({ window, navigator: { onLine: true }, console: silent,
    getPending: async () => clone(items.filter(e => e.status === 'pending')),
    markSynced: async id => { marked.push(id); items.find(e => e.id === id).status = 'synced'; },
    refreshQueueBadge: async () => {}, renderQueueList: async () => {},
    showToast: (message, type) => toasts.push({ message, type }) });
  vm.runInContext('let workerDrainPromise = null;', context);
  for (const name of ['drainWorkerQueue', 'manualSync', 'maybeAutoSync']) {
    if (lapor.includes(`function ${name}(`)) vm.runInContext(fn(lapor, name), context);
  }
  return { context, items, writes, toasts, marked, window };
}
function pushHarness(setDoc = async () => {}) {
  const context = vm.createContext({ window: {}, db: {}, COLLECTIONS: { laporan: 'laporan' },
    doc: (_db, collection, id) => ({ collection, id }), setDoc,
    runTransaction: async (_db, fn) => { const staged=[]; await fn({get:async()=>({exists:()=>false}),set:(ref,data)=>staged.push([ref,data])}); for(const [ref,data] of staged) await setDoc(ref,data); },
    serverTimestamp: () => 'synthetic-time' });
  const code = lapor.match(/window\.firestorePush = async \(entryData, localId\) => \{[\s\S]*?\n    \};/);
  assert.ok(code, 'extract actual SDK push function');
  vm.runInContext(code[0], context);
  return context.window.firestorePush;
}
function cabutHarness() {
  let storage = '[]', storageFailure = false, fail = null;
  const reports = new Map(), logs = new Map(), calls = [], elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, { style: {}, textContent: '', innerHTML: '', value: '', checked: false, scrollIntoView() {} }); return elements.get(id); };
  const context = vm.createContext({ console: silent, db: {}, QKEY: 'synthetic-queue', NKEY: 'synthetic-name',
    PELAPOR: 'BORONGAN', KATEGORI: 'cabut_borongan', S: { kebun: 'K1', gps: null }, J: element('jumlah'),
    $: element, navigator: { onLine: true }, window: { addEventListener() {} },
    crypto: { randomUUID: () => 'synthetic-' + calls.length + '-' + Math.random().toString(36).slice(2) },
    localStorage: { getItem: key => key === 'synthetic-queue' ? storage : 'SYNTHETIC', setItem: (key, value) => { if (storageFailure) throw Error('synthetic storage full'); if (key === 'synthetic-queue') storage = value; } },
    muatRiwayat: async () => {}, tg: value => value, setTimeout() {},
    doc: (_db, collection, id) => ({ collection, id }), collection: (_db, name) => name,
    serverTimestamp: () => 'synthetic-time', arrayUnion: value => ({ union: clone(value) }),
    addDoc: async (_collection, data) => { const id = 'auto-' + reports.size; reports.set(id, clone(data)); if (fail === 'lost-ack') { fail = null; throw Error('synthetic lost ACK'); } return { id }; },
    updateDoc: async (ref, data) => { if (fail === 'log' && ref.collection === 'sop_status') throw Error('synthetic log failure'); if (data.data) logs.set(JSON.stringify(data.data.union), clone(data.data.union)); else reports.set(ref.id, { ...reports.get(ref.id), ...clone(data) }); },
    runTransaction: async (_db, callback) => {
      const changes = [];
      const tx = { get: async ref => ({ exists: () => reports.has(ref.id), data: () => clone(reports.get(ref.id)) }),
        set: (ref, data) => changes.push({ ref, data: clone(data) }), update: (ref, data) => changes.push({ ref, data: clone(data) }) };
      const result = await callback(tx);
      calls.push(clone(changes));
      if (fail === 'log' && changes.some(c => c.ref.collection === 'sop_status')) throw Error('synthetic log denied');
      for (const { ref, data } of changes) { if (ref.collection === 'laporan') reports.set(ref.id, data); else logs.set(JSON.stringify(data.data.union), data.data.union); }
      if (fail === 'lost-ack') { fail = null; throw Error('synthetic committed but ACK lost'); }
      return result;
    } });
  const code = cabut.slice(cabut.indexOf('/* ---- kirim ---- */'), cabut.indexOf('/* ---- progres & riwayat'));
  vm.runInContext(code, context);
  element('nama').value = 'SYNTHETIC'; element('tgl').value = '2000-01-01'; element('jumlah').value = '3'; element('lokasi').value = 'synthetic block';
  return { context, reports, logs, calls, element, get queue() { return JSON.parse(storage); },
    set queue(value) { storage = JSON.stringify(value); }, fail: value => { fail = value; }, storageFailure: value => { storageFailure = value; } };
}
const entry = () => ({ id: 'synthetic-cabut-1', created_at: '2000-01-01T00:00:00.000Z', kebun: 'K1', jumlah_pohon: 3, tgl: '2000-01-01', pekerja_nama: 'SYNTHETIC', lokasi: 'synthetic block', pending: [] });

test('lapor: absent SDK never marks pending as synced or claims success', async () => {
  const h = laporHarness({ window: { firestoreDB: null, firestorePush: undefined } });
  await h.context.manualSync(); assert.equal(h.items[0].status, 'pending'); assert.equal(h.marked.length, 0); assert.ok(h.toasts.every(t => t.type !== 'success'));
});
test('lapor: SDK DB without push function retains pending', async () => {
  const h = laporHarness({ window: { firestorePush: undefined } }); await h.context.manualSync(); assert.equal(h.items[0].status, 'pending');
});
test('lapor: rejected push retains pending', async () => {
  const h = laporHarness({ window: { firestorePush: async () => { throw Error('synthetic denied'); } } }); await h.context.manualSync(); assert.equal(h.items[0].status, 'pending');
});
test('lapor: undefined push acknowledgement retains pending', async () => {
  const h = laporHarness({ window: { firestorePush: async () => undefined } }); await h.context.manualSync(); assert.equal(h.items[0].status, 'pending');
});
test('lapor: wrong document acknowledgement retains pending', async () => {
  const h = laporHarness({ window: { firestorePush: async () => 'wrong-id' } }); await h.context.maybeAutoSync(); assert.equal(h.items[0].status, 'pending');
});
test('lapor: correct acknowledged push marks synced', async () => {
  const h = laporHarness(); await h.context.manualSync(); assert.equal(h.items[0].status, 'synced'); assert.equal(h.writes.length, 1);
});
test('lapor: manual, auto and submit drain share one flight', async () => {
  const gate = deferred(), h = laporHarness(); let pushes = 0;
  h.window.firestorePush = async data => { pushes++; await gate.promise; return data.id; };
  const one = h.context.manualSync(), two = h.context.maybeAutoSync();
  await new Promise(r => setImmediate(r)); gate.resolve(); await Promise.all([one, two]); assert.equal(pushes, 1);
  assert.match(lapor, /const delivery = await drainWorkerQueue\(\)/, 'submit uses the same drain');
});
test('lapor: append while draining is preserved pending', async () => {
  const gate = deferred(), h = laporHarness(); h.window.firestorePush = async data => { await gate.promise; return data.id; };
  const drain = h.context.maybeAutoSync(); await new Promise(r => setImmediate(r)); h.items.push({ id: 2, status: 'pending', data: { id: 'lap_appended' } });
  gate.resolve(); await drain; assert.equal(h.items[1].status, 'pending');
});
test('lapor: drain failure releases single-flight lock for retry', async () => {
  const h = laporHarness(); h.window.firestorePush = async () => { throw Error('synthetic fail'); }; await h.context.maybeAutoSync();
  h.window.firestorePush = async data => data.id; await h.context.maybeAutoSync(); assert.equal(h.items[0].status, 'synced');
});
test('lapor: lost ACK reuses same persisted document ID', async () => {
  const h = laporHarness(), ids = new Set(); let lost = true;
  h.window.firestorePush = pushHarness(async ref => { ids.add(ref.id); if (lost) { lost = false; throw Error('synthetic lost ACK'); } });
  await h.context.maybeAutoSync(); assert.equal(h.items[0].status, 'pending'); await h.context.maybeAutoSync(); assert.equal(h.items[0].status, 'synced'); assert.deepEqual([...ids], ['lap_synthetic_1']);
});
test('lapor: legacy local-only ID is namespaced string', async () => {
  const refs = [], push = pushHarness(async ref => refs.push(ref)); const id = await push({}, 42);
  assert.equal(typeof refs[0].id, 'string'); assert.equal(id, refs[0].id); assert.notEqual(id, '42');
});
test('lapor: push rejects entry without stable identity', async () => {
  const push = pushHarness(); await assert.rejects(() => push({}, undefined));
});
test('lapor: success text is reset for each acknowledgement including offline', () => {
  const title = {}, message = {}, modal = { querySelector: selector => selector.includes('title') ? title : message, showModal() {} };
  const context = vm.createContext({ document: { getElementById: () => modal } }); vm.runInContext(fn(lapor, 'showDeliveryAcknowledgement'), context);
  context.showDeliveryAcknowledgement(true); assert.match(title.textContent, /Terkirim/);
  context.showDeliveryAcknowledgement(false); assert.match(title.textContent, /Tersimpan di HP/); assert.doesNotMatch(message.textContent, /langsung masuk/);
});
test('lapor: IndexedDB queue acknowledgement waits for transaction commit', async () => {
  const request = {}, tx = { objectStore: () => ({ add: () => request }) };
  const context = vm.createContext({ openDB: async () => ({ transaction: () => tx }), DB_STORE: 'synthetic' });
  vm.runInContext(fn(lapor, 'queueSubmission'), context); let settled = false;
  const result = context.queueSubmission({ id: 'synthetic' }).then(value => { settled = true; return value; });
  await new Promise(r => setImmediate(r)); request.result = 9; request.onsuccess(); await Promise.resolve(); assert.equal(settled, false);
  tx.oncomplete(); assert.equal(await result, 9);
});
test('lapor: IndexedDB queue abort never acknowledges local save', async () => {
  const request = {}, tx = { error: Error('synthetic abort'), objectStore: () => ({ add: () => request }) };
  const context = vm.createContext({ openDB: async () => ({ transaction: () => tx }), DB_STORE: 'synthetic' }); vm.runInContext(fn(lapor, 'queueSubmission'), context);
  const result = context.queueSubmission({ id: 'synthetic' }); await new Promise(r => setImmediate(r)); request.result = 9; request.onsuccess();
  if (tx.onabort) tx.onabort(); await assert.rejects(result, /synthetic abort/);
});
test('cabut: retry uses one report and one stable log', async () => {
  const h = cabutHarness(), e = entry(); await h.context.kirimSatu(e); await h.context.kirimSatu(e); assert.equal(h.reports.size, 1); assert.equal(h.logs.size, 1);
});
test('cabut: committed write with lost ACK retries without duplicates', async () => {
  const h = cabutHarness(), e = entry(); h.fail('lost-ack'); await assert.rejects(() => h.context.kirimSatu(e)); await h.context.kirimSatu(e);
  assert.equal(h.reports.size, 1); assert.equal(h.logs.size, 1);
});
test('cabut: log failure cannot acknowledge full delivery', async () => {
  const h = cabutHarness(); h.fail('log'); await assert.rejects(() => h.context.kirimSatu(entry())); assert.equal(h.logs.size, 0);
});
test('cabut: completed retry preserves subsequent verification', async () => {
  const h = cabutHarness(), e = entry(); await h.context.kirimSatu(e); const id = [...h.reports.keys()][0]; h.reports.get(id).status_verifikasi = 'masuk_log';
  await h.context.kirimSatu(e); assert.equal(h.reports.size, 1); assert.equal(h.reports.get(id).status_verifikasi, 'masuk_log');
});
test('cabut: log identity, timestamp and report reference derive from persisted entry', async () => {
  const h = cabutHarness(), e = entry(); await h.context.kirimSatu(e); const log = [...h.logs.values()][0];
  assert.equal(log.id, 'cabut_' + e.id); assert.equal(log.src_laporan, e.id); assert.equal(log.created_at, e.created_at);
});
test('cabut: missing SDK keeps existing pending entries', async () => {
  const h = cabutHarness(); h.queue = [entry()]; h.context.db = null; await h.context.kurasAntrian(); assert.equal(h.queue.length, 1); assert.equal(h.reports.size, 0);
});
test('cabut: missing SDK submission saves locally without false remote success', async () => {
  const h = cabutHarness(); h.context.db = null; await h.element('kirim').onclick(); assert.equal(h.queue.length, 1); assert.ok(h.queue[0].id);
  assert.match(h.element('done').innerHTML, /Tersimpan di HP/); assert.equal(h.reports.size, 0);
});
test('cabut: initial SDK load failure does not prevent local form handlers', () => {
  assert.doesNotMatch(cabut, /^import .*from "https:\/\/www.gstatic.com/m, 'remote static imports would block offline UI');
  assert.match(cabut, /async function initDeliverySDK\(/);
});
test('cabut: persist identity before first remote write', async () => {
  const h = cabutHarness(); let captured;
  h.context.runTransaction = async (_db, callback) => { captured = h.queue; throw Error('synthetic denied'); };
  h.context.addDoc = async () => { captured = h.queue; throw Error('synthetic denied'); };
  await h.element('kirim').onclick(); assert.equal(captured.length, 1); assert.ok(captured[0].id); assert.equal(h.queue[0].id, captured[0].id);
});
test('cabut: legacy queue gets identity persisted before retry', async () => {
  const h = cabutHarness(), e = entry(); delete e.id; h.queue = [e]; let captured;
  h.context.runTransaction = async () => { captured = h.queue; throw Error('synthetic denied'); };
  h.context.addDoc = async () => { captured = h.queue; throw Error('synthetic denied'); };
  await h.context.kurasAntrian(); assert.ok(captured[0].id); assert.equal(h.queue[0].id, captured[0].id);
});
test('cabut: append during drain survives acknowledgement', async () => {
  const h = cabutHarness(), gate = deferred(); h.queue = [entry()]; h.context.kirimSatu = async e => { await gate.promise; return e.id; };
  const drain = h.context.kurasAntrian(); await new Promise(r => setImmediate(r)); h.queue = [...h.queue, { ...entry(), id: 'synthetic-appended' }];
  gate.resolve(); await drain; assert.deepEqual(h.queue.map(e => e.id), ['synthetic-appended']);
});
test('cabut: simultaneous drains share one flight', async () => {
  const h = cabutHarness(), gate = deferred(); h.queue = [entry()]; let sends = 0;
  h.context.kirimSatu = async e => { sends++; await gate.promise; return e.id; };
  const one = h.context.kurasAntrian(), two = h.context.kurasAntrian(); await new Promise(r => setImmediate(r)); gate.resolve(); await Promise.all([one, two]); assert.equal(sends, 1);
});
test('cabut: undefined acknowledgement never removes pending', async () => {
  const h = cabutHarness(); h.queue = [entry()]; h.context.kirimSatu = async () => undefined; await h.context.kurasAntrian(); assert.equal(h.queue.length, 1);
});
test('cabut: storage failure keeps form and never claims local save', async () => {
  const h = cabutHarness(); h.storageFailure(true); await h.element('kirim').onclick(); assert.equal(h.reports.size, 0);
  assert.equal(h.element('jumlah').value, '3'); assert.doesNotMatch(h.element('done').innerHTML, /Tersimpan di HP|sudah masuk catatan/); assert.match(h.element('err').textContent, /menyimpan/i);
});
test('lapor: synced acknowledgement waits for IndexedDB commit', async () => {
  const getReq = {}, putReq = {}, record = { id: 1, status: 'pending' };
  const tx = { objectStore: () => ({ get: () => getReq, put: () => putReq }) };
  const context = vm.createContext({ openDB: async () => ({ transaction: () => tx }), DB_STORE: 'synthetic' });
  vm.runInContext(fn(lapor, 'markSynced'), context); let settled = false;
  const result = context.markSynced(1).then(() => { settled = true; });
  await new Promise(r => setImmediate(r)); getReq.result = record; getReq.onsuccess(); putReq.onsuccess();
  await Promise.resolve(); assert.equal(settled, false); assert.equal(typeof tx.oncomplete, 'function'); tx.oncomplete(); await result;
});
test('lapor: aborted synced transaction does not acknowledge delivery', async () => {
  const getReq = {}, putReq = {}, tx = { error: Error('synthetic sync abort'), objectStore: () => ({ get: () => getReq, put: () => putReq }) };
  const context = vm.createContext({ openDB: async () => ({ transaction: () => tx }), DB_STORE: 'synthetic' }); vm.runInContext(fn(lapor, 'markSynced'), context);
  const result = context.markSynced(1); await new Promise(r => setImmediate(r)); getReq.result = { id: 1 }; getReq.onsuccess(); putReq.onsuccess();
  if (tx.onabort) tx.onabort(); await assert.rejects(result, /synthetic sync abort/);
});
test('cabut: lost ACK followed by edited log cannot reintroduce stale log', async () => {
  const h = cabutHarness(), e = entry(); h.fail('lost-ack'); await assert.rejects(() => h.context.kirimSatu(e));
  h.logs.clear(); h.logs.set('synthetic-edit', { id: 'cabut_' + e.id, dicek: true }); await h.context.kirimSatu(e);
  assert.deepEqual([...h.logs.values()], [{ id: 'cabut_' + e.id, dicek: true }]);
});
test('cabut: pre-existing identity without marker remains pending', async () => {
  const h = cabutHarness(), e = entry(); h.reports.set(e.id, { status_verifikasi: 'menunggu' }); h.queue = [e];
  await h.context.kurasAntrian(); assert.equal(h.queue.length, 1); assert.equal(h.logs.size, 0);
});
test('cabut: failed drain releases lock and retry clears pending', async () => {
  const h = cabutHarness(); h.queue = [entry()]; h.fail('log'); await h.context.kurasAntrian(); assert.equal(h.queue.length, 1);
  h.fail(null); await h.context.kurasAntrian(); assert.equal(h.queue.length, 0); assert.equal(h.reports.size, 1); assert.equal(h.logs.size, 1);
});
test('cabut: SDK import rejection is contained and retry remains possible', async () => {
  const context = vm.createContext({ console: silent });
  vm.runInContext('let db = null, collection, getDocs, query, where, doc, runTransaction, arrayUnion, serverTimestamp; let sdkFlight = null;', context);
  vm.runInContext(fn(cabut, 'initDeliverySDK'), context);
  assert.equal(await context.initDeliverySDK(), false); assert.equal(await context.initDeliverySDK(), false);
});
test('cabut: corrupt pending queue is not silently overwritten', async () => {
  const h = cabutHarness(); h.context.localStorage.getItem = () => '{corrupt'; await h.element('kirim').onclick();
  assert.equal(h.reports.size, 0); assert.equal(h.element('jumlah').value, '3'); assert.match(h.element('err').textContent, /menyimpan/i);
});
