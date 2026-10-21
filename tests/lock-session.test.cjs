const {test}=require('node:test'),assert=require('node:assert/strict'),{harness,fixture}=require('./authorized-report-harness.cjs');
test('session intent captured before waiting for browser lock cannot be rebound',async()=>{
 const h=harness();let release;h.context.navigator={locks:{request:async(_k,fn)=>{await new Promise(r=>release=r);return fn();}}};const p=h.send(fixture());h.context.transport.suspend();h.context.GoogleAuthProvider=class{};h.context.signInWithPopup=async()=>({user:{uid:'synthetic-worker'}});h.context.localStorage.removeItem=k=>h.storage.delete(k);await h.context.transport.signInSession();release();await assert.rejects(p,/session-changed|sign-in-required/);assert.equal(h.commits,0);assert.equal(h.storage.has('wkkn_authorized_report_envelopes_v1'),false);
});
