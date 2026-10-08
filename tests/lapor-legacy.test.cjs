// Exact source + synthetic IndexedDB transactions; no production network.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const html=fs.readFileSync(require('node:path').join(__dirname,'../lapor.html'),'utf8');
function fn(name){const start=html.search(new RegExp(`(?:async )?function ${name}\\(`)); assert.notEqual(start,-1,`${name} exists`);const tail=html.slice(start);return tail.slice(0,tail.indexOf('\n}')+2);}
const clone=x=>JSON.parse(JSON.stringify(x));
function device(record){let saved=clone(record),writes=0; const txs=[];
 const c=vm.createContext({crypto,console:{warn(){}},DB_STORE:'synthetic',window:{firestoreDB:{}},navigator:{onLine:true},
 openDB:async()=>({transaction:()=>{const tx={objectStore:()=>({get:()=>{const req={};tx.req=req;return req;},put:value=>{tx.staged=clone(value);writes++;return {};}})};txs.push(tx);return tx;}}),
 refreshQueueBadge:async()=>{},renderQueueList:async()=>{},getPending:async()=>saved.status==='pending'?[clone(saved)]:[]});
 for(const name of ['workerReportContent','prepareQueuedSubmission','markSynced','drainWorkerQueue']) if(html.includes(`function ${name}(`))vm.runInContext(fn(name),c);
 assert.equal(typeof c.prepareQueuedSubmission,'function','queue must persist identity before send');
 vm.runInContext('let workerDrainPromise=null;',c);
 async function tick(){await new Promise(r=>setImmediate(r));}
 async function read(tx){tx.req.result=clone(saved);tx.req.onsuccess();await tick();}
 function commit(tx){if(tx.staged)saved=tx.staged;tx.oncomplete();}
 return {c,txs,tick,read,commit,get saved(){return saved},set saved(v){saved=clone(v)},get writes(){return writes}};
}
const legacy=()=>({id:42,status:'pending',data:{pelapor:'KUMPUL',created_at:'same-time',catatan:'SYNTHETIC A',nested:{b:2,a:[1,2]}}});
test('legacy migration commits globally unique identity before network, retaining both device reports',async()=>{
 const a=device(legacy()),b=device({...legacy(),data:{...legacy().data,catatan:'SYNTHETIC B'}}),sent=[];
 for(const d of [a,b]){
  d.c.window.firestorePush=async data=>{assert.equal(data.id,d.saved.data.id);assert.equal(d.saved.status,'pending');sent.push(clone(data));throw Error('synthetic lost ACK');};
  const drain=d.c.drainWorkerQueue();await d.tick();assert.equal(sent.length,d===a?0:1);await d.read(d.txs[0]);assert.equal(d.saved.data.id,undefined);d.commit(d.txs[0]);await drain;
  assert.equal(d.saved.status,'pending');assert.ok(d.saved.data.id);assert.equal(d.saved.data.catatan,d===a?'SYNTHETIC A':'SYNTHETIC B');
 }
 assert.equal(sent.length,2);assert.notEqual(sent[0].id,sent[1].id);assert.doesNotMatch(sent[0].id,/lap_local_42/);
 const first=a.saved.data.id;const retry=a.c.drainWorkerQueue();await a.tick();await a.read(a.txs[1]);a.commit(a.txs[1]);await retry;assert.equal(sent[2].id,first);assert.equal(a.writes,1);
});
test('aborted identity migration never sends or changes pending legacy record',async()=>{
 const d=device(legacy());let sent=0;d.c.window.firestorePush=async()=>{sent++;};
 const drain=d.c.drainWorkerQueue();await d.tick();await d.read(d.txs[0]);d.txs[0].error=Error('synthetic abort');d.txs[0].onabort();await drain;
 assert.equal(sent,0);assert.deepEqual(d.saved,legacy());
});
test('local content edited in flight is not marked synced by previous revision ACK',async()=>{
 const d=device({...legacy(),data:{...legacy().data,id:'immutable'}});let release,started;const start=new Promise(r=>started=r),gate=new Promise(r=>release=r);
 d.c.window.firestorePush=async data=>{started();await gate;return data.id;};
 const drain=d.c.drainWorkerQueue();await d.tick();await d.read(d.txs[0]);d.commit(d.txs[0]);await start;
 d.saved={...d.saved,data:{...d.saved.data,catatan:'SYNTHETIC NEW REVISION'}};release();await d.tick();await d.read(d.txs[1]);d.commit(d.txs[1]);await drain;
 assert.equal(d.saved.status,'pending');assert.equal(d.saved.data.catatan,'SYNTHETIC NEW REVISION');
});
