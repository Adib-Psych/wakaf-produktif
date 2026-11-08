import {test} from 'node:test';
import assert from 'node:assert/strict';
const batch=await import('./payroll-batch.mjs').catch(()=>({}));
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('fresh pre-dispatch refusal permits explicit exact retry without locking plan',async()=>{
 const b=batch.payrollBatchStore(storage());b.start('owner',inputs);await assert.rejects(b.run('owner',{sessionAvailable:()=>true,record:async()=>{throw Error('grant refused before dispatch');}}),/grant/);
 const seen=[];await b.run('owner',{sessionAvailable:()=>true,record:async input=>{seen.push(input);return 'pe_'+input.id;}});assert.deepEqual(seen,inputs);
});
test('ACK checkpoint failure blocks same instance then remount retries only exact pending event',async()=>{
 const s=storage(),set=s.setItem;let fail=false,intent=null,calls=0;const b=batch.payrollBatchStore(s);b.start('owner',inputs);s.setItem=(k,v)=>{if(fail)throw Error('storage failed');set(k,v);};
 const record=async(input,{onAcknowledged})=>{calls++;intent={input,eventId:'pe_stable'};fail=true;onAcknowledged(intent.eventId);intent=null;return 'pe_stable';};
 await assert.rejects(b.run('owner',{sessionAvailable:()=>true,readIntent:()=>intent,record}),/storage/);fail=false;await assert.rejects(b.run('owner',{sessionAvailable:()=>true,readIntent:()=>intent,record}),/rekonsiliasi/);assert.equal(calls,1);
 const reloaded=batch.payrollBatchStore(s),seen=[];await reloaded.run('owner',{sessionAvailable:()=>true,readIntent:()=>intent,record:async(input,{onAcknowledged})=>{seen.push(input);onAcknowledged('pe_stable');intent=null;return 'pe_stable';}});assert.deepEqual(seen,inputs);
});
test('run never starts on read and never adopts another owner plan',async()=>{const s=storage(),a=batch.payrollBatchStore(s);a.start('owner',inputs);assert.equal(batch.payrollBatchStore(s).read('other'),null);assert.equal(a.read('owner').items[0].phase,'ready');await assert.rejects(a.run('owner',{sessionAvailable:()=>false,record:()=>assert.fail('no dispatch')}),/Akun berubah/);});
test('retained acknowledged intent is replayed before next item and completed plans reconcile too',async()=>{for(const count of [1,2]){const s=storage(),b=batch.payrollBatchStore(s);b.start('owner',inputs.slice(0,count));let intent=null;await assert.rejects(b.run('owner',{sessionAvailable:()=>true,readIntent:()=>intent,record:async(input,{onAcknowledged})=>{intent={input,eventId:'pe_retained'};onAcknowledged(intent.eventId);throw Error('remove failed');}}),/remove/);const seen=[];await batch.payrollBatchStore(s).run('owner',{sessionAvailable:()=>true,readIntent:()=>intent,record:async(input,{onAcknowledged}={})=>{seen.push(input);onAcknowledged?.('pe_retained');intent=null;return 'pe_retained';}});assert.deepEqual(seen,inputs.slice(0,count));}});
test('stable per-item intent exists before dispatching phase becomes durable',async()=>{const s=storage(),b=batch.payrollBatchStore(s);b.start('owner',inputs);let prepared=null;const set=s.setItem;s.setItem=(k,v)=>{if(JSON.parse(v).items.some(x=>x.phase==='dispatching'))assert.ok(prepared,'prepare intent before dispatch checkpoint');set(k,v);};const record=async input=>'pe_'+input.id;record.prepareIntent=input=>{prepared={input,eventId:'pe_'+input.id};return prepared;};await b.run('owner',{sessionAvailable:()=>true,record});});
test('crash after dispatch checkpoint restores prepared intent without permanent lock',async()=>{const s=storage(),b=batch.payrollBatchStore(s);b.start('owner',inputs);let intent=null,sends=0;const record=async(input,{onAcknowledged}={})=>{sends++;onAcknowledged?.(intent.eventId);intent=null;return 'pe_prepared';};record.prepareIntent=input=>intent??=({input,eventId:'pe_prepared'});await assert.rejects(b.run('owner',{sessionAvailable:()=>true,readIntent:()=>intent,record,onProgress:()=>{throw Error('synthetic crash before record');}}),/crash/);assert.equal(sends,0);assert.ok(intent);await batch.payrollBatchStore(s).run('owner',{sessionAvailable:()=>true,readIntent:()=>intent,record});assert.equal(sends,2);});
const inputs=[{id:'12',status:'lunas',source:'wakif',paidDate:'2026-11-07',reason:'Nyata'},{id:'w_k4',status:'lunas',source:'pribadi',paidDate:'2026-11-07',reason:'Nyata'}];
test('durable exact owner plan runs sequentially and checkpoints each ACK',async()=>{
 assert.equal(typeof batch.payrollBatchStore,'function','batch orchestration must exist');
 const s=storage(),b=batch.payrollBatchStore(s);b.start('owner',inputs);assert.deepEqual(b.read('owner').items.map(x=>x.input),inputs);assert.equal(b.read('other'),null);
 const seen=[];await b.run('owner',{sessionAvailable:()=>true,record:async input=>{assert.ok(s.getItem('wkkn_payroll_batch_v1_owner'));seen.push(input);return 'pe_'+input.id;}});
 assert.deepEqual(seen,inputs);assert.deepEqual(b.read('owner').items.map(x=>x.eventId),['pe_12','pe_w_k4']);
});
