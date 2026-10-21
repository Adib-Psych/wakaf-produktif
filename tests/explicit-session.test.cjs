const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
function harness(initial={uid:'old'}){
 const records=new Map(),listeners=[],events=[];let callback,resolve,reject;
 const auth={currentUser:initial};
 const ctx={console,JSON,Date,Number,Error,Set,Map,Promise,localStorage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)},getAuth:()=>auth,onAuthStateChanged:(_a,fn)=>{callback=fn;fn(initial);},signOut:async()=>{throw Error('provider failed');},GoogleAuthProvider:class{},signInWithPopup:()=>new Promise((a,b)=>{resolve=a;reject=b;}),globalThis:null,window:{addEventListener:(n,fn)=>listeners.push(fn)}};
 ctx.globalThis=ctx;ctx.workerReportContent=x=>JSON.stringify(x);vm.createContext(ctx);
 const src=fs.readFileSync('recovery/authorized-reports.js','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');vm.runInContext(src+'\nthis.api=createAuthorizedReports({app:{},db:{}});',ctx);ctx.api.observeSession(u=>events.push(u));
 return {api:ctx.api,events,auth,callback:u=>callback(u),resolve:u=>{auth.currentUser=u;resolve({user:u});},records,ctx};
}
test('explicit managed sign-in restores after rejected logout, stale callbacks cannot restore',async()=>{
 const h=harness();await assert.rejects(h.api.signOutSession());h.callback({uid:'old'});assert.equal(h.events.at(-1),null);
 assert.equal(typeof h.api.signInSession,'function');const p=h.api.signInSession();h.resolve({uid:'fresh'});await p;assert.equal(h.events.at(-1),'fresh');h.callback({uid:'old'});assert.equal(h.events.at(-1),'fresh');
});
test('newer logout supersedes in-flight sign-in and reload retains denial barrier',async()=>{
 const h=harness();assert.equal(typeof h.api.signInSession,'function');const p=h.api.signInSession();await assert.rejects(h.api.signOutSession());h.resolve({uid:'fresh'});await assert.rejects(p,/session-changed/);assert.equal(h.events.at(-1),null);
 const c=h.ctx;vm.runInContext('this.again=createAuthorizedReports({app:{},db:{}});this.restored=[];again.observeSession(u=>restored.push(u));',c);assert.equal(c.restored.at(-1),null);
});

test('current provider identity replacement suspends old private session',()=>{const h=harness();h.auth.currentUser={uid:'different'};h.callback({uid:'different'});assert.equal(h.events.at(-1),null);assert.equal(h.api.sessionOwner(),null);});

test('delayed null Auth observer cannot cancel restored current provider session',async()=>{const h=harness();await assert.rejects(h.api.signOutSession());const p=h.api.signInSession();h.resolve({uid:'fresh'});await p;h.callback(null);assert.equal(h.api.sessionOwner(),'fresh');});
