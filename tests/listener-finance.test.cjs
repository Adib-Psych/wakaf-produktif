'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {makeHarness,report} = require('./listener-finance-harness.cjs');
function unchanged(h,before){assert.deepEqual(h.snapshot(),before);assert.equal(h.calls.saveUpah,0);assert.equal(h.calls.syncUpah,0);assert.equal(h.calls.getDoc,0);}
for(const cloud of ['empty','missing','malformed','error']) test('startup and explicit reprocess preserve finance: '+cloud,async()=>{
  const h=makeHarness({cache:[report('synthetic-cache')],cloud}), before=h.snapshot();
  await h.runTimers(3000); await h.context.reprocessPendingEntries(); await h.runTimers(500);
  unchanged(h,before);assert.equal(h.context.STATE.laporan[0].compliance,'compliant');
});
test('actual error callback re-registers and cached duplicate/retry does not mutate finance',async()=>{
  const h=makeHarness(), before=h.snapshot(), first=h.calls.listeners[0];
  await h.fire([h.change(report())]); first.error(Error('synthetic stream failure'));await h.runTimers(5000);
  assert.equal(first.unsubscribed,true);assert.equal(h.calls.listeners.length,2);
  await h.fire([h.change(report())]); await h.fire([h.change({...report(),catatan:'synthetic modified'},'modified')]);
  assert.equal(h.context.STATE.laporan.length,1);assert.equal(h.context.STATE.laporan[0].detail,'synthetic modified');
  await h.fire([h.change(report(),'removed')]);assert.equal(h.context.STATE.laporan.length,0);unchanged(h,before);
});
test('retry cap and recovery remain read-only',async()=>{
  const h=makeHarness(), before=h.snapshot();
  for(let n=0;n<6;n++){h.calls.listeners.at(-1).error(Error('synthetic stream failure'));await h.runTimers(5000*Math.pow(1.5,n));}
  assert.equal(h.calls.listeners.length,6);assert.equal(h.calls.timers.filter(t=>t.ms!==3000).length,0);unchanged(h,before);
});
test('reconciliation flag neither disables the listener nor reopens auto finance',async()=>{
  const h=makeHarness({reconciliation:true}), before=h.snapshot();assert.equal(h.calls.timers.length,0);
  h.storage.set('wkkn_reconciliation_mode','off');
  await h.fire([h.change(report())]);assert.equal(h.context.autoCreateUpahFromEntry(report()),null);unchanged(h,before);
});
test('cabut and tombstoned reports do not enter the display or finance',async()=>{
  const h=makeHarness(), before=h.snapshot();h.context.window._deletedTombstones.add('synthetic-tomb');
  await h.fire([h.change({...report(),kategori:'cabut_borongan'}),h.change(report('synthetic-tomb'))]);
  assert.equal(h.context.STATE.laporan.length,0);unchanged(h,before);
});
test('malformed reports and throwing snapshot leave finance and queues unchanged',async()=>{
  const h=makeHarness(), before=h.snapshot();
  for(const value of [null,{}, {id:'synthetic-malformed',pelapor:'SYNTHETIC_WORKER',durasi:'satu_hari',kategori:42,detail:{}}]) await h.fire([h.change(value)]);
  await assert.rejects(h.calls.listeners.at(-1).next({docChanges(){throw Error('synthetic corrupt snapshot');}}),/synthetic corrupt/);
  unchanged(h,before);
});
test('compliance failure keeps pending and does not escape into finance',async()=>{
  const h=makeHarness({cache:[report()]}), before=h.snapshot();h.context.computeRainfallAlerts=()=>{throw Error('synthetic compliance failure');};
  await h.runTimers(3000);await h.fire([h.change(report('synthetic-next'))]);
  assert.ok(h.context.STATE.laporan.every(l=>l.compliance==='pending'));unchanged(h,before);
});
test('disabled auto factory is null-safe without reading finance inputs',()=>{
  const h=makeHarness(),before=h.snapshot();assert.equal(h.context.autoCreateUpahFromEntry(null),null);
  assert.equal(h.context.autoCreateUpahFromEntry(new Proxy({},{get(){throw Error('must not inspect');}})),null);unchanged(h,before);
});
test('report arrival and startup compliance do not read finance while frozen',async()=>{
  const h=makeHarness({cache:[report('synthetic-cache')],cloud:'error'}), before=h.snapshot();
  await h.runTimers(3000);
  await h.fire([h.change(report())]);
  assert.deepEqual(h.snapshot(),before);
  assert.equal(h.calls.getDoc,0,'report display must not depend on finance reads');
  assert.equal(h.calls.saveUpah,0);
  assert.equal(h.context.STATE.laporan.find(l=>l.id==='synthetic-cache').compliance,'compliant');
});
test('startup isolates unbound retired-worker cache without changing historical bytes',()=>{
 const vm=require('node:vm'),{between}=require('./listener-finance-harness.cjs');
 const rows=[{id:'synthetic-retired',pelapor:'ANTO',qty:2,tarif:17},{id:'synthetic-other',pelapor:'SYNTHETIC',qty:1,tarif:13}];
 const raw=JSON.stringify(rows);let reads=0,writes=0;
 const ctx={localStorage:{getItem(){reads++;return raw;},setItem(){writes++;},removeItem(){writes++;}}};vm.createContext(ctx);
 vm.runInContext(between('let UPAH_ITEMS = JSON.parse(null','// PRODUCTION: empty default — diisi dari Distribusi Tugas tab')+'\nthis.loaded=UPAH_ITEMS;',ctx);
 assert.equal(JSON.stringify(ctx.loaded),'[]');assert.equal(reads,0);assert.equal(writes,0);assert.equal(JSON.stringify(rows),raw);
});
test('actual registered report arrival preserves nonzero finance and pending bytes',async()=>{
  const h=makeHarness(), before=h.snapshot();
  await h.fire([h.change(report())]);
  assert.deepEqual(h.snapshot(),before,'report arrival must not create or persist wages');
  assert.equal(h.calls.saveUpah,0); assert.equal(h.calls.syncUpah,0);
  assert.equal(h.context.STATE.laporan.length,1);
  const row=h.context.STATE.laporan[0];
  assert.equal(row.id,'synthetic-report'); assert.equal(row.tgl,'2000-01-02');
  assert.equal(row.bidang,'3'); assert.equal(row.kebun,'K3+K1');
  assert.equal(JSON.stringify(row.kebun_list),'["K3","K1"]'); assert.equal(row.pohon,4);
  assert.equal(row.detail,'synthetic narrative'); assert.equal(row.detail_fields.tipe_pemangkasan_token,'wiwilan');
  assert.equal(row.compliance,'compliant'); assert.ok(h.calls.renders.includes('renderDashboard')); assert.ok(h.calls.renders.includes('renderLog'));
});
