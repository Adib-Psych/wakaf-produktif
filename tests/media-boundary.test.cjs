const {test}=require('node:test'),assert=require('node:assert/strict'),{harness,fixture}=require('./authorized-report-harness.cjs');
test('media wrong nested type and technical oversized document refuse before sidecar or provider',async()=>{
 for(const patch of [{photos:[{id:'p',data_url:42,size_kb:1}]},{voice_notes:[{id:'v',duration_sec:'oops',blob_b64:'x'}]},{photos:[{id:'p',data_url:'x'.repeat(900001),size_kb:900}]}]){const h=harness();await assert.rejects(h.send(fixture('worker',patch)),/unsupported-entry/);assert.equal(h.commits,0);assert.equal(h.reads,0);assert.equal(h.storage.has('wkkn_authorized_report_envelopes_v1'),false);}
});
