const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('recovery/device-entry.js','utf8').replace(/^import .*;\n/gm,'').replace('export async function mountDeviceEntry','async function mountDeviceEntry');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.value='';this.hidden=false;this.textContent='';}
 append(...nodes){this.children.push(...nodes);}
 prepend(...nodes){this.children.unshift(...nodes);}
 after(...nodes){this.siblings=[...nodes,...(this.siblings||[])];}
 setAttribute(k,v){this[k]=v;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 replaceChildren(...nodes){this.children=nodes;}
 contains(){return true;}
}
function storage(seed={}){const data=new Map(Object.entries(seed));return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),data};}
function harness({user=null,records={},seed={}}={}){
 const elements={'panel-form':new Element(),'main-content':new Element()},events={},calls={anonymous:0,popup:0,transactions:0,writes:[],reads:[],apps:[],persistence:[]};
 const document={createElement:t=>new Element(t),getElementById:id=>elements[id]||find(id),querySelectorAll:()=>[],addEventListener:(type,fn)=>(events[type]??=[]).push(fn)};
 function find(id){const visit=n=>n.id===id?n:[...(n.children||[]),...(n.siblings||[])].map(visit).find(Boolean);return Object.values(elements).map(visit).find(Boolean)||null;}
 const auth={currentUser:user};let observer,authError;
 const localStorage=storage(seed),sessionStorage=storage();
 const snap=value=>({data:()=>value,exists:()=>value!==undefined});
 const ctx={console,document,localStorage,sessionStorage,queueMicrotask,crypto:{randomUUID:()=> 'test-slot'},navigator:{locks:{request:async(name,options,fn)=>typeof options==='function'?options():fn({})}},workerReportContent:JSON.stringify,
 initializeApp:(config,name)=>(calls.apps.push(name),{name}),getAuth:()=>auth,getFirestore:()=>({}),browserLocalPersistence:{kind:'local'},setPersistence:async(a,p)=>calls.persistence.push(p),
 signInAnonymously:async()=>{calls.anonymous++;throw Error('anonymous sign-in forbidden');},GoogleAuthProvider:class {},signInWithPopup:async()=>{calls.popup++;return {user:auth.currentUser};},signOut:async()=>{auth.currentUser=null;await observer(null);},onAuthStateChanged:(a,fn,error)=>{observer=fn;authError=error;queueMicrotask(()=>void Promise.resolve(fn(a.currentUser)).catch(()=>{}));return ()=>{};},
 doc:(db,c,id)=>c+'/'+id,collection:(db,c)=>c,query:(...q)=>q,where:(...q)=>q,getDocFromServer:async path=>{calls.reads.push(path);if(records[path] instanceof Error)throw records[path];return snap(records[path]);},getDocsFromServer:async()=>({docs:[]}),
 runTransaction:async(db,fn)=>{calls.transactions++;return fn({get:async path=>snap(records[path]),set:(path,data)=>{calls.writes.push(path);records[path]=data;}});},serverTimestamp:()=>new ctx.Timestamp(),Timestamp:class {},validReportBody:b=>!!b?.id&&typeof b.detail==='string',
 STATE:{laporan:[{id:'public-report'}]},UPAH_ITEMS:[{id:'public-wage'}],CASHBOOK:[{id:'public-cash'}],OPT_OBSERVATIONS:[],PANEN_DATA:[],PANEN_LOTS_DATA:[],PANEN_SAMPLING_DATA:[],MILESTONES:[],SOP_STATUS:{},CABUT_DATA:[],BENCHMARK_DATA:[],KASBON_DATA:[],WORKER_DEFS:[],entryRoster:{},holdEntryRoster(){ctx.entryRoster.status='hold';},populateFormPelaporRadio(){},renderLog(){},renderDashboard(){},renderActivityForm(){},Option:class {constructor(text,value){this.text=text;this.value=value;}},addEventListener:(type,fn)=>(events[type]??=[]).push(fn)};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,auth,calls,records,localStorage,find,events,error:()=>authError(Error('auth-unavailable')),mount:()=>ctx.mountDeviceEntry({}),change:async u=>{auth.currentUser=u;await observer(u);await tick();}};
}
const google=(uid='google-a')=>({uid,email:uid+'@example.test',emailVerified:true,isAnonymous:false,providerData:[{providerId:'google.com'}],getIdTokenResult:async()=>({signInProvider:'google.com'})});
const worker='w_'+ 'a'.repeat(24);
function approved(uid='google-a'){return {'entry_policy/active':{paused:false,writer_epoch:3},['entry_grants/'+uid]:{uid,enabled:true,role:'staff_entry',worker_token:'',writer_epoch:3,grant_epoch:1},'device_entry_policy/active':{enabled:true,epoch:4,roster_version:'roster-1'},'entry_roster/active':{version:'roster-1',workers:{[worker]:{id:worker,name:'Operator',active:true,retired:false}}}};}
const body={id:'lap_test',detail:'work',pelapor:worker};
test('signed-out mount uses persistent named Google auth and resolves without anonymous sign-in',async()=>{
 const h=harness();await h.mount();
 assert.deepEqual(h.calls.apps,['wakaf-device-entry-v1']);assert.equal(h.calls.persistence.length,1);assert.equal(h.calls.anonymous,0);
 assert.match(h.find('device-entry-signin').textContent,/Google/);assert.ok(h.find('device-entry-signout'));assert.match(h.find('device-entry-status').textContent,/Google/);
 assert.equal(h.ctx.authorizedReports.sessionTicket(),null);
});
test('Google account without existing valid grant cannot acquire tickets, enqueue or drain',async()=>{
 const h=harness({user:google(),records:{'device_entry_policy/active':approved()['device_entry_policy/active'],'entry_roster/active':approved()['entry_roster/active']}});await h.mount();
 assert.equal(h.ctx.authorizedReports.sessionTicket(),null);
 await assert.rejects(h.ctx.entryRecovery.enqueueAtomic([body]),/Google/);await assert.rejects(h.ctx.entryRecovery.drain(),/Google/);
 assert.equal(h.localStorage.getItem('wkkn_device_entry_v1'),null);assert.equal(h.calls.transactions,0);
});
test('valid persisted Google session rehydrates against entry policy and existing UID grant',async()=>{
 const h=harness({user:google(),records:approved()});await h.mount();
 assert.ok(h.ctx.authorizedReports.sessionTicket());assert.equal(h.calls.popup,0);
 assert.ok(h.calls.reads.includes('entry_policy/active'));assert.ok(h.calls.reads.includes('entry_grants/google-a'));
 await h.ctx.entryRecovery.enqueueAtomic([body]);assert.equal(h.ctx.entryRecovery.pending().length,1);
});
test('mount, account changes and logout preserve public dashboard arrays without an active reader marker',async()=>{
 const h=harness({user:google(),records:approved()});const reports=h.ctx.STATE.laporan,wages=h.ctx.UPAH_ITEMS,cash=h.ctx.CASHBOOK;await h.mount();
 assert.equal(h.ctx.STATE.laporan,reports);assert.equal(h.ctx.UPAH_ITEMS,wages);assert.equal(h.ctx.CASHBOOK,cash);
 await h.change(null);assert.equal(h.ctx.STATE.laporan,reports);
 await h.change(google());h.find('device-entry-signout').onclick();await tick();assert.equal(h.ctx.STATE.laporan,reports);
});
test('auth changes never invalidate an active public reader session or replace its export adapter',async()=>{const h=harness({user:google(),records:approved()});const read={active:true,generation:22},adapter={matches:()=>true};h.ctx.dashboardReadModel={publicMode:true,ownerActive:()=>true};h.ctx.reportReadSession=read;h.ctx.privateReader=adapter;await h.mount();assert.equal(h.ctx.reportReadSession,read);assert.equal(h.ctx.privateReader,adapter);await h.change(null);assert.equal(h.ctx.reportReadSession,read);assert.equal(read.active,true);h.find('device-entry-signout').onclick();assert.equal(read.active,true);});
test('revoked grant is rechecked before enqueue and does not expose a session ticket',async()=>{
 const h=harness({user:google(),records:approved()});await h.mount();h.records['entry_grants/google-a'].enabled=false;
 await assert.rejects(h.ctx.entryRecovery.enqueueAtomic([body]),/Google/);
 assert.equal(h.ctx.authorizedReports.sessionTicket(),null);assert.equal(h.ctx.authorizedReports.sessionOwner(),null);
 assert.match(h.find('device-entry-status').textContent,/Google/);assert.equal(h.localStorage.getItem('wkkn_device_entry_v1'),null);
});
test('revoked grant prevents draining an existing queue and preserves pending bytes',async()=>{
 const h=harness({user:google(),records:approved()});await h.mount();await h.ctx.entryRecovery.enqueueAtomic([body]);const bytes=h.localStorage.getItem('wkkn_device_entry_v1');h.records['entry_grants/google-a'].enabled=false;
 await assert.rejects(h.ctx.entryRecovery.drain(),/Google/);assert.equal(h.calls.transactions,0);assert.equal(h.localStorage.getItem('wkkn_device_entry_v1'),bytes);
});
test('grant revoked inside the write transaction cannot write or ACK pending reports',async()=>{
 const h=harness({user:google(),records:approved()});await h.mount();await h.ctx.entryRecovery.enqueueAtomic([body]);
 const original=h.ctx.runTransaction;h.ctx.runTransaction=async(db,fn)=>{h.records['entry_grants/google-a'].enabled=false;return original(db,fn);};
 await h.ctx.entryRecovery.drain().catch(()=>{});assert.deepEqual(h.calls.writes,[]);assert.equal(h.ctx.entryRecovery.pending().length,1);
});
test('unauthorized submit click is intercepted with actionable Google login guidance before roster validation',async()=>{
 const h=harness();await h.mount();let stopped=false;
 const button={getAttribute:name=>name==='onclick'?'submitForm()':null,closest:()=>button};
 const event={target:{closest:()=>button},preventDefault(){stopped=true;},stopImmediatePropagation(){stopped=true;}};
 for(const fn of h.events.click||[])fn(event);
 assert.equal(stopped,true);assert.match(h.find('device-entry-status').textContent,/Google/);
});
test('denied grant shows actionable status at rehydration instead of leaving preparation text',async()=>{
 const h=harness({user:google(),records:{}});await h.mount();assert.match(h.find('device-entry-status').textContent,/Google/);
});
test('linked Google profile authenticated with another provider never receives authority',async()=>{
 const user=google();user.getIdTokenResult=async()=>({signInProvider:'password'});
 const h=harness({user,records:approved()});await h.mount();assert.equal(h.ctx.authorizedReports.sessionTicket(),null);
});
test('unsupported browser entry capabilities do not reject mount or clear public data',async()=>{
 const h=harness();h.ctx.navigator.locks=undefined;await h.mount();assert.equal(h.ctx.STATE.laporan[0].id,'public-report');assert.match(h.find('device-entry-status').textContent,/Google|Browser/);
});
test('approved session status identifies Google email and activates existing report consumers until logout',async()=>{
 const h=harness({user:google(),records:approved()});await h.mount();assert.equal(h.ctx.reportReadSession.active,true);assert.match(h.find('device-entry-status').textContent,/google-a@example.test/);
 h.find('device-entry-signout').onclick();assert.equal(h.ctx.authorizedReports.sessionTicket(),null);assert.equal(h.ctx.reportReadSession.active,false);await tick();
});
test('draft click after grant denial does not throw from a missing authorized ticket',async()=>{
 const h=harness({user:google(),records:{}});await h.mount();for(const fn of h.ctx.document.getElementById('panel-form').listeners.click||[])assert.doesNotThrow(()=>fn({}));await tick();
});
test('logout bars delayed provider callbacks until an explicit new Google login',async()=>{
 const h=harness({user:google(),records:approved()});await h.mount();h.find('device-entry-signout').onclick();await tick();await h.change(google());assert.equal(h.ctx.authorizedReports.sessionTicket(),null);
 h.find('device-entry-signin').onclick();await tick();await h.change(google());assert.ok(h.ctx.authorizedReports.sessionTicket());
});
test('anonymous owner queue and draft bytes are preserved and never adopted on Google switch',async()=>{
 const queue=JSON.stringify([{owner:'anonymous-old',pending:[body],envelopes:[]}]),draft=JSON.stringify({owner:'anonymous-old',fields:[]});
 const h=harness({user:{uid:'anonymous-old',isAnonymous:true},records:approved(),seed:{wkkn_device_entry_v1:queue,wkkn_device_draft_v1_test: draft}});await h.mount();assert.equal(h.ctx.authorizedReports.sessionTicket(),null);
 await h.change(google());assert.equal(h.localStorage.getItem('wkkn_device_entry_v1'),queue);assert.equal(h.localStorage.getItem('wkkn_device_draft_v1_test'),draft);assert.equal(h.ctx.entryRecovery.pending().length,0);assert.equal(h.calls.transactions,0);
});
for(const [name,mutate] of Object.entries({disabled:r=>r['entry_grants/google-a'].enabled=false,paused:r=>r['entry_policy/active'].paused=true,role:r=>r['entry_grants/google-a'].role='admin',uid:r=>r['entry_grants/google-a'].uid='other',writer_epoch:r=>r['entry_grants/google-a'].writer_epoch=2,grant_epoch:r=>r['entry_grants/google-a'].grant_epoch=0}))test('invalid '+name+' grant remains read-only',async()=>{
 const records=approved();mutate(records);const h=harness({user:google(),records});await h.mount();assert.equal(h.ctx.authorizedReports.sessionTicket(),null);await assert.rejects(h.ctx.entryRecovery.enqueueAtomic([body]),/Google/);assert.equal(h.calls.transactions,0);
});
test('auth observer errors revoke entry authority without touching public reading',async()=>{
 const h=harness({user:google(),records:approved()});await h.mount();h.error();assert.equal(h.ctx.authorizedReports.sessionTicket(),null);assert.equal(h.ctx.STATE.laporan[0].id,'public-report');
});
test('approved Google send retains immutable envelope, receipt ACK and same-ID retry idempotency',async()=>{
 const h=harness({user:google(),records:approved()});await h.mount();await h.ctx.entryRecovery.enqueueAtomic([body]);assert.equal((await h.ctx.entryRecovery.drain())[0],body.id);assert.equal(h.ctx.entryRecovery.pending().length,0);
 const saved=h.records['device_reports/'+body.id];assert.equal(saved.owner_uid,'google-a');assert.equal(saved.writer_epoch,4);assert.equal(saved.roster_version,'roster-1');assert.deepEqual(h.records['device_receipts/'+body.id],saved);
 assert.equal(Object.keys(saved).sort().join(','),'command_id,committed_at,committed_revision,contract_version,owner_uid,report_id,roster_version,submitted_body,writer_epoch');
 await h.ctx.entryRecovery.enqueueAtomic([body]);await h.ctx.entryRecovery.drain();assert.equal(h.calls.writes.length,2);assert.equal(h.ctx.entryRecovery.pending().length,0);
});




