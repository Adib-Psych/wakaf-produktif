const {test}=require('node:test'),assert=require('node:assert/strict'),{harness,fixture}=require('./authorized-report-harness.cjs');
test('two concurrent sends serialize whole sidecar operation, preserving both envelopes',async()=>{
 const h=harness();let active=0,max=0,tail=Promise.resolve(),count=0;
 h.context.navigator={locks:{request:(_key,fn)=>{count++;const p=tail.then(async()=>{active++;max=Math.max(max,active);try{return await fn();}finally{active--;}});tail=p.catch(()=>{});return p;}}};
 await Promise.all([h.send(fixture('worker',{id:'lap_lockA'})),h.send(fixture('worker',{id:'lap_lockB'}))]);assert.equal(count,2);assert.equal(max,1);assert.equal(JSON.parse(h.storage.get('wkkn_authorized_report_envelopes_v1')).length,2);
});
