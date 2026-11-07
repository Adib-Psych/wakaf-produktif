const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const base='90ef6e67f5954a1137767c77c9efe6f0f0399a7a';
const file='recovery/device-entry.js';
const before=execFileSync('git',['show',base+':'+file],{encoding:'utf8'});
const after=fs.readFileSync(file,'utf8');
// These existing functions are deliberately single-line contracts. UI lifecycle changes
// must not rewrite queue validation, immutable envelopes, receipt ACK or draft ownership.
for(const name of ['read','own','commit','googleCurrent','identity','identityMatches','ticket','matches','authorized','lock','paint','publishDeviceView','list','saveDraft','restoreDraft']){
 test('preserves existing '+name+' contract bytes',()=>{
  const line=before.split('\n').find(l=>new RegExp('(?:function '+name+'\\(|const '+name+'=)').test(l));
  assert.ok(line,'baseline function exists: '+name);
  assert.ok(after.includes(line),'existing contract changed: '+name);
 });
}
test('preserves transaction and exact receipt ACK bytes; partial drain wording covered separately',()=>{
 const start=before.indexOf(' async function send(body)');
 const end=before.indexOf(' async function drain()',start);
 assert.ok(start>=0&&end>start);
 assert.ok(after.includes(before.slice(start,end)),'send/ACK contract changed');
});
for(const f of ['recovery/restored-dashboard.js','recovery/firestore.production.rules','firestore.rules','firebase-config.js','monitor-v2.html','recovery/authorized-reports.js']){
 test('historical account release preserved unrelated shipped '+f,()=>{
  const expected=execFileSync('git',['show',base+':'+f],{maxBuffer:32*1024*1024});
  const accountRelease=execFileSync('git',['show','bba6129d937faae36e4200aa1415da199772c1fd:'+f],{maxBuffer:32*1024*1024});
  assert.deepEqual(accountRelease,expected);
 });
}
