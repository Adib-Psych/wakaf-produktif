'use strict';
// Existing queue, exact source, synthetic browser storage; no second queue implementation.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
function queue() {
  const key = 'wkkn_recovery_staff_pending_v1'; let raw = '[]'; const extra=new Map();
  const c = vm.createContext({navigator:{locks:{request:async(_k,fn)=>fn()}},window: {addEventListener() {},authorizedReports:{sessionOwner:()=> 'synthetic-owner'}}, document: {addEventListener() {}},
    localStorage: {getItem: k => k === key ? raw : extra.get(k)??null, setItem: (k, v) => {if (k === key) raw = v;else extra.set(k,v);}}, console: {warn() {}}});
  for (const file of ['report-content.js', 'entry-recovery.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../recovery', file), 'utf8'), c);
  return {q: c.window.entryRecovery, c, replace: items => {raw = JSON.stringify(items);}};
}
const entry = () => ({id: 'synth', created_at: 'same-time', detail: 'sent', nested: {a: 1, b: 2}, photos: ['a', 'b']});
async function flight(h, change) {
  let release; const gate = new Promise(r => release = r);
  h.q.enqueue([entry()]);
  h.c.window.syncLaporanEntryToFirestore = async e => {await gate; return e.id;};
  const pending = h.q.drain(); change(); release(); await pending;
}
test('STAFF ACCEPTANCE: body changed in storage while upload in flight stays pending', async () => {
  const h = queue(), changed = {...entry(), detail: 'changed-in-another-tab'};
  await flight(h, () => h.replace([changed]));
  assert.deepEqual(JSON.parse(JSON.stringify(h.q.pending())), [changed]);
});
test('STAFF queue: same ID/time array order change stays pending', async () => {
  const h = queue(), changed = {...entry(), photos: ['b', 'a']};
  await flight(h, () => h.replace([changed])); assert.equal(h.q.pending().length, 1);
});
test('STAFF queue: exact canonical retry removes current item despite key order change', async () => {
  const h = queue(); await flight(h, () => h.replace([{...entry(), nested: {b: 2, a: 1}}])); assert.equal(h.q.pending().length, 0);
});
test('STAFF queue: changed same-ID item and appended report both survive original ACK', async () => {
  const h = queue(), changed = {...entry(), detail: 'changed'}, other = {...entry(), id: 'appended'};
  await flight(h, () => h.replace([changed, other])); assert.deepEqual(JSON.parse(JSON.stringify(h.q.pending())), [changed, other]);
});
