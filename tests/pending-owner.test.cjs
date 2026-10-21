const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
test('actual worker queue records original account outside immutable body',async()=>{
 const html=fs.readFileSync('lapor.html','utf8');const a=html.indexOf('async function queueSubmission('),b=html.indexOf('\nasync function getAllSubmissions',a);
 let saved;const request={};const tx={objectStore:()=>({add:v=>{saved=v;queueMicrotask(()=>{request.result=7;request.onsuccess();tx.oncomplete();});return request;}})};
 const c={Date,Promise,DB_STORE:'synthetic',window:{authorizedReports:{sessionOwner:()=> 'owner-A'}},openDB:async()=>({transaction:()=>tx})};vm.createContext(c);vm.runInContext(html.slice(a,b)+';this.queue=queueSubmission;',c);await c.queue({id:'lap_x'});
 assert.equal(saved.owner_uid,'owner-A');assert.equal(saved.data.owner_uid,undefined);
});
