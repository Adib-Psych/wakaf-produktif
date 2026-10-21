const {test}=require('node:test'),assert=require('node:assert/strict'),{harness,fixture}=require('./authorized-report-harness.cjs');
test('server denial latches session instead of retaining authority for automatic retry',async()=>{
 const h=harness();h.context.getDocFromServer=async()=>{const e=Error('denied');e.code='permission-denied';throw e;};await assert.rejects(h.send(fixture()),/denied/);assert.equal(h.context.transport.sessionOwner(),null);h.context.onAuthStateChanged({},()=>{});await assert.rejects(h.send(fixture()),/sign-in-required/);assert.equal(h.commits,0);
});
