'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {harness:authorizedHarness,fixture}=require('./authorized-report-harness.cjs');

// Reuse the current device harness without registering its tests. Only SDK/Auth,
// DOM and storage are synthetic; both device-entry and its validator are real.
const setup=fs.readFileSync(path.join(__dirname,'google-device-entry.test.cjs'),'utf8').split("const body={id:'lap_test'")[0];
const context={require,console,queueMicrotask,setImmediate};
vm.createContext(context);
vm.runInContext(setup+';this.deviceHarness=harness;this.google=google;this.approved=approved;this.worker=worker;',context);
const validator=authorizedHarness({role:'staff'}).context.validReportBody;
const queueKey='wkkn_device_entry_v1';
const secondWorker='w_'+'b'.repeat(24);
async function queued(){
 const records=context.approved();
 records['entry_roster/active'].workers[secondWorker]={id:secondWorker,name:'Second synthetic worker',active:true,retired:false};
 const h=context.deviceHarness({user:context.google(),records});
 h.ctx.validReportBody=validator;
 await h.mount();
 const bodies=[fixture('staff',{id:'lap_batch_first',pelapor:context.worker,durasi:'setengah_hari'}),fixture('staff',{id:'lap_batch_second',pelapor:secondWorker,durasi:'setengah_hari'})];
 assert.ok(bodies.every(validator),'actual validator accepts both complete staff fixtures');
 await h.ctx.entryRecovery.enqueueAtomic(bodies);
 return {h,bodies};
}

test('partial drain headlines acknowledged and unconfirmed counts without changing queue or receipt mechanics',async()=>{
 const {h,bodies:[first,second]}=await queued();
 h.records['entry_roster/active'].workers[secondWorker].active=false;
 const ack=await h.ctx.entryRecovery.drain();
 assert.deepEqual([...ack],[first.id]);
 assert.deepEqual(JSON.parse(JSON.stringify(h.ctx.entryRecovery.pending())),[second]);
 assert.deepEqual([...h.calls.writes],['device_reports/'+first.id,'device_receipts/'+first.id]);
 assert.equal(h.records['device_reports/'+second.id],undefined);
 assert.deepEqual(h.records['device_reports/'+first.id],h.records['device_receipts/'+first.id]);
 assert.deepEqual(JSON.parse(JSON.stringify(h.records['device_reports/'+first.id].submitted_body)),first);
 const stored=JSON.parse(h.localStorage.getItem(queueKey))[0];
 assert.equal(stored.owner,'google-a');
 assert.deepEqual(stored.envelopes.map(e=>e.report_id),[first.id,second.id]);
 assert.deepEqual(stored.envelopes[1].submitted_body,second);
 const status=h.find('device-entry-status').textContent;
 assert.match(status,/1 laporan dikonfirmasi server/);
 assert.match(status,/1 laporan belum dikonfirmasi/);
 assert.match(status,/belum disetujui pengelola/);
 assert.doesNotMatch(status,/google-a|example\.test|lap_batch|w_[a-f0-9]{24}/);
 assert.equal(h.find('device-entry-recovery').hidden,false);
 assert.equal(h.find('device-entry-recovery').children[0].textContent,'1 laporan belum dikonfirmasi');
});

test('zero ACK keeps its controlled failure diagnostic and every pending report',async()=>{
 const {h,bodies}=await queued();
 h.records['entry_roster/active'].workers[context.worker].active=false;
 assert.deepEqual([...(await h.ctx.entryRecovery.drain())],[]);
 assert.equal(h.find('device-entry-status').textContent,'Belum terkirim: Entry/pekerja tidak aktif');
 assert.deepEqual(JSON.parse(JSON.stringify(h.ctx.entryRecovery.pending())),bodies);
 assert.deepEqual([...h.calls.writes],[]);
 assert.equal(h.find('device-entry-recovery').children[0].textContent,'2 laporan belum dikonfirmasi');
});

test('zero ACK exposes no raw SDK error or identity in the failure diagnostic',async()=>{
 const {h,bodies}=await queued();
 const original=h.ctx.runTransaction;
 h.ctx.runTransaction=async()=>{throw Error('SECRET token=private google-a@example.test owner_uid=google-a '+bodies[0].id);};
 assert.deepEqual([...(await h.ctx.entryRecovery.drain())],[]);
 const status=h.find('device-entry-status').textContent;
 assert.match(status,/Belum terkirim/);
 assert.match(status,/antrian tetap disimpan/);
 assert.doesNotMatch(status,/SECRET|token=|private|google-a|example\.test|lap_batch/);
 assert.deepEqual(JSON.parse(JSON.stringify(h.ctx.entryRecovery.pending())),bodies);
 assert.deepEqual([...h.calls.writes],[]);
 h.ctx.runTransaction=original;
 assert.deepEqual([...(await h.ctx.entryRecovery.drain())],bodies.map(b=>b.id),'flight cleanup permits exact retries');
 assert.equal(h.ctx.entryRecovery.pending().length,0);
 assert.equal(h.find('device-entry-status').textContent,'Laporan dikonfirmasi server; belum disetujui pengelola.');
});
