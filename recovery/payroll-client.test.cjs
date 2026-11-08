// Emulator-only behavioral integration: the actual client, SDK transactions and shipped Rules.
'use strict';
const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {initializeTestEnvironment}=require('./node_modules/@firebase/rules-unit-testing');
const sdk=require('./node_modules/firebase/firestore');
const PROJECT='demo-payroll-client',HOST='127.0.0.1:8691',UID='synthetic-payroll-approved';
const wage={id:'wage_synthetic_1',pelapor:'SYNTHETIC_WORKER',tgl:'2026-10-01',model:'harian',satuan:'full',qty:1,tarif:100000,status:'belum'};
const entitlement={...wage,id:'wage_synthetic_entitlement',pelapor:'SYNTHETIC_ENTITLEMENT_WORKER',satuan:'full_day',eligible:true,name:'Synthetic worker',sources:[{lane:'laporan',report_id:'lap_synthetic_entitlement',revision:1}]};
const baseCash=[{id:'synthetic-unrelated',ref:'unrelated',keluar:13,masuk:0}];
const paid=(extra={})=>({id:wage.id,status:'lunas',paidDate:'2026-10-02',source:'wakif',reason:'Synthetic actual-payment record',...extra});
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const content=x=>JSON.stringify(canonical(x));
const dataModule=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
function browserStorage(){const values=new Map();return {getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(key),clear:()=>values.clear()};}
let env,sequence=0,refreshes=0;
const harnesses=new Map();
globalThis.__payrollClientHarnesses=harnesses;
before(async()=>{
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,HOST,'Use node recovery/payroll-client-run.cjs; never connect outside the dedicated loopback emulator');
 assert.equal(process.env.GCLOUD_PROJECT,PROJECT);
 assert.equal(process.env.GOOGLE_CLOUD_PROJECT,PROJECT);
 // Keep direct --test invocations fail-closed too (the runner preloads this already).
 require('../tests/rules-network.cjs');
 env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:'127.0.0.1',port:8691,rules:fs.readFileSync(process.env.PAYROLL_TEST_RULES_PATH||path.join(__dirname,'firestore.production.rules'),'utf8')}});
 globalThis.workerReportContent=content;
 globalThis.document={};
 globalThis.window={dashboardReadModel:{refresh:async()=>{refreshes++;}}};
 globalThis.UPAH_ITEMS=[structuredClone(wage),structuredClone(entitlement)];
});
after(async()=>{if(env)await env.cleanup();for(const key of ['__payrollClientHarnesses','workerReportContent','document','window','UPAH_ITEMS','localStorage','__payrollReaderSdk'])delete globalThis[key];});
beforeEach(async()=>{
 harnesses.clear();refreshes=0;globalThis.localStorage=browserStorage();globalThis.UPAH_ITEMS=[structuredClone(wage),structuredClone(entitlement)];await env.clearFirestore();
 await seed({
  'entry_policy/active':{paused:false,writer_epoch:1},
  ['entry_grants/'+UID]:{uid:UID,enabled:true,role:'staff',worker_token:'',writer_epoch:1,grant_epoch:1},
  'payroll_policy/active':{enabled:true,epoch:1},
  ['payroll_grants/'+UID]:{uid:UID,enabled:true,epoch:1},
  ['payroll_targets/'+wage.id]:{enabled:true,wage},
  ['payroll_targets/'+entitlement.id]:{enabled:true,wage:entitlement},
  'upah/active':{data:[wage]},'cashbook/active':{data:baseCash},
  ['wage_entitlements/'+entitlement.id]:entitlement
 });
});
async function seed(rows){await env.withSecurityRulesDisabled(async c=>{const db=c.firestore(),batch=sdk.writeBatch(db);for(const [p,d]of Object.entries(rows))batch.set(sdk.doc(db,p),d);await batch.commit();});}
async function inspect(){const out={};await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();for(const name of ['payroll_states','payroll_events','upah','cashbook','wage_entitlements','payroll_policy','payroll_grants','payroll_targets','entry_policy','entry_grants'])out[name]=(await sdk.getDocs(sdk.collection(db,name))).docs.map(d=>({id:d.id,data:d.data()})).sort((a,b)=>a.id.localeCompare(b.id));});return out;}
function googleDb(uid=UID,provider='google.com',verified=true){return env.authenticatedContext(uid,{email:uid+'@example.test',email_verified:verified,firebase:{sign_in_provider:provider}}).firestore();}
async function mount({uid=UID,db=googleDb(uid),hooks={},storage=globalThis.localStorage}={}){
 const key=String(++sequence),state={sets:[],reads:[],transactions:0,attempts:0,decorations:0,options:null,hooks,storage};

 const ticket={uid,generation:1};let liveTicket=ticket;
 const auth={currentUser:{uid,isAnonymous:false,emailVerified:true,providerData:[{providerId:'google.com'}]}};
 state.sdk={...sdk,
  runTransaction:async(database,callback,...rest)=>{
   state.transactions++;
   return sdk.runTransaction(database,async real=>{
    state.attempts++;
    const tx={get:async ref=>{const snap=await real.get(ref);state.reads.push(ref.path);await hooks.afterGet?.(ref,snap);return snap;},set:(ref,value,...args)=>{state.sets.push({path:ref.path,value});real.set(ref,value,...args);return tx;}};
    await hooks.beforeBody?.();const result=await callback(tx);await hooks.afterBody?.(state);return result;
   },...rest);
  },
  getDocFromServer:async ref=>{await hooks.beforeReadback?.(ref);return sdk.getDocFromServer(ref);}
 };
 state.mountUI=options=>{state.options=options;return {decorate:()=>{state.decorations++;}};};
 harnesses.set(key,state);
 const adapter=dataModule(`const h=globalThis.__payrollClientHarnesses.get(${JSON.stringify(key)});export const {doc,getDocFromServer,runTransaction,serverTimestamp,Timestamp}=h.sdk;`);
 const ui=dataModule(`export const mountPayrollUI=options=>globalThis.__payrollClientHarnesses.get(${JSON.stringify(key)}).mountUI(options);`);
 let source=fs.readFileSync(path.join(__dirname,'payroll-client.js'),'utf8');
 source=source.replace(/(['"])https:\/\/www\.gstatic\.com\/firebasejs\/[^'"]+\/firebase-firestore\.js\1/,JSON.stringify(adapter))
  .replace(/(['"])\.\/payroll-contract\.mjs\1/,JSON.stringify(pathToFileURL(path.join(__dirname,'payroll-contract.mjs')).href))
  .replace(/(['"])\.\/payroll-ui\.mjs\1/,JSON.stringify(ui))
  .replace(/(['"])\.\/payroll-intent\.mjs\1/,JSON.stringify(pathToFileURL(path.join(__dirname,'payroll-intent.mjs')).href));
 source=`const localStorage=globalThis.__payrollClientHarnesses.get(${JSON.stringify(key)}).storage;\n`+source;
 const api=await import(dataModule(source+`\n// harness instance ${key}`));
 api.mountPayrollRecording({db,auth,sessionTicket:()=>liveTicket,sessionMatches:t=>t===liveTicket});
 return Object.assign(state,{record:state.options.record,auth,changeSession:()=>{liveTicket={uid,generation:2};}});
}
function assertUnchangedSources(before,after){for(const name of Object.keys(before).filter(x=>!['payroll_states','payroll_events'].includes(x)))assert.deepEqual(after[name],before[name],name+' must not be written');}
async function publishServerWages(){const snapshot=await inspect();globalThis.UPAH_ITEMS=[wage,entitlement].map(w=>{const state=snapshot.payroll_states.find(s=>s.id===String(w.id))?.data;return state?{...w,status:state.status,payroll_revision:state.revision}:structuredClone(w);});}
function assertNoPayroll(snapshot){assert.deepEqual(snapshot.payroll_states,[]);assert.deepEqual(snapshot.payroll_events,[]);}
test('verified server ACK remains successful when display refresh fails',async()=>{
 const client=await mount(),prior=window.dashboardReadModel.refresh;window.dashboardReadModel.refresh=async()=>{throw Error('synthetic display refresh failure');};
 try{const eventId=await client.record(paid());assert.match(eventId,/^pe_/);const saved=await inspect();assert.equal(saved.payroll_events.length,1);assert.equal(saved.payroll_states.length,1);assert.equal(client.storage.getItem('wkkn_payroll_intent_v1_'+UID),null);}finally{window.dashboardReadModel.refresh=prior;}
});
test('actual SDK batch records mixed funds once and leaves source ledgers unchanged',async()=>{
 const {payrollBatchStore}=await import('./payroll-batch.mjs'),client=await mount(),privateEntitlement={...entitlement,fund:'K4'};await seed({['wage_entitlements/'+entitlement.id]:privateEntitlement,['payroll_targets/'+entitlement.id]:{enabled:true,wage:privateEntitlement}});
 const before=await inspect(),store=payrollBatchStore(client.storage);store.start(UID,[paid(),paid({id:entitlement.id,source:'pribadi'})]);const plan=await store.run(UID,{record:client.record,sessionAvailable:owner=>owner===UID,readIntent:()=>JSON.parse(client.storage.getItem('wkkn_payroll_intent_v1_'+UID))});
 assert.ok(plan.items.every(x=>x.phase==='ack'));const after=await inspect();assert.equal(after.payroll_events.length,2);assert.equal(after.payroll_states.length,2);assert.equal(after.payroll_states.find(x=>x.id===entitlement.id).data.source,'pribadi');assertUnchangedSources(before,after);
 await store.run(UID,{record:()=>{throw Error('confirmed item must not redispatch');},sessionAvailable:()=>true});assert.deepEqual(await inspect(),after);
});
test('actual SDK batch resumes lost second ACK after remount without duplicate revisions',async()=>{
 const {payrollBatchStore}=await import('./payroll-batch.mjs'),shared=browserStorage();let reads=0;const first=await mount({storage:shared,hooks:{beforeReadback:async ref=>{if(ref.path.startsWith('payroll_states/')&&++reads===2)throw Error('synthetic second ACK loss');}}}),store=payrollBatchStore(shared),intent=()=>JSON.parse(shared.getItem('wkkn_payroll_intent_v1_'+UID));store.start(UID,[paid(),paid({id:entitlement.id})]);
 await assert.rejects(store.run(UID,{record:first.record,sessionAvailable:()=>true,readIntent:intent}),/second ACK loss/);const before=await inspect(),pending=intent();assert.equal(before.payroll_events.length,2);assert.deepEqual(store.read(UID).items.map(x=>x.phase),['ack','dispatching']);
 const retry=await mount({storage:shared}),remount=payrollBatchStore(shared);await remount.run(UID,{record:retry.record,sessionAvailable:()=>true,readIntent:intent});assert.equal(remount.read(UID).items[1].eventId,pending.eventId);assert.deepEqual(await inspect(),before);assert.equal(intent(),null);
});
test('actual SDK batch preserves stable intent if checkpoint fails after server ACK',async()=>{
 const {payrollBatchStore}=await import('./payroll-batch.mjs'),base=browserStorage();let fail=true;const shared={getItem:k=>base.getItem(k),removeItem:k=>base.removeItem(k),setItem(k,v){if(fail&&k.startsWith('wkkn_payroll_batch_v1_')&&JSON.parse(v).items.some(x=>x.phase==='ack'))throw Error('synthetic checkpoint failure');base.setItem(k,v);}},client=await mount({storage:shared}),store=payrollBatchStore(shared),intent=()=>JSON.parse(shared.getItem('wkkn_payroll_intent_v1_'+UID));store.start(UID,[paid(),paid({id:entitlement.id})]);
 await assert.rejects(store.run(UID,{record:client.record,sessionAvailable:()=>true,readIntent:intent}),/checkpoint failure/);assert.equal((await inspect()).payroll_events.length,1);const eventId=intent().eventId;fail=false;const retry=await mount({storage:shared}),resumed=payrollBatchStore(shared);await resumed.run(UID,{record:retry.record,sessionAvailable:()=>true,readIntent:intent});const after=await inspect();assert.equal(after.payroll_events.length,2);assert.equal(after.payroll_states.find(x=>x.id===String(wage.id)).data.event_id,eventId);assert.equal(after.payroll_states.find(x=>x.id===String(wage.id)).data.revision,1);
});
test('actual SDK batch reconciles retained acknowledged intent after cleanup storage failure',async()=>{
 const {payrollBatchStore}=await import('./payroll-batch.mjs'),base=browserStorage();let fail=true;const shared={getItem:k=>base.getItem(k),setItem:(k,v)=>base.setItem(k,v),removeItem(k){if(fail&&k.startsWith('wkkn_payroll_intent_v1_'))throw Error('synthetic cleanup failure');base.removeItem(k);}},client=await mount({storage:shared}),store=payrollBatchStore(shared),intent=()=>JSON.parse(shared.getItem('wkkn_payroll_intent_v1_'+UID));store.start(UID,[paid(),paid({id:entitlement.id})]);
 await assert.rejects(store.run(UID,{record:client.record,sessionAvailable:()=>true,readIntent:intent}),/cleanup failure/);const original=intent().eventId;assert.equal((await inspect()).payroll_events.length,1);fail=false;const retry=await mount({storage:shared}),resumed=payrollBatchStore(shared);await resumed.run(UID,{record:retry.record,sessionAvailable:()=>true,readIntent:intent});const after=await inspect();assert.equal(after.payroll_events.length,2);assert.equal(after.payroll_states.find(x=>x.id===String(wage.id)).data.event_id,original);assert.equal(after.payroll_states.find(x=>x.id===String(wage.id)).data.revision,1);assert.equal(intent(),null);
});
test('actual SDK batch stops after session changes and does not adopt another owner plan',async()=>{
 const {payrollBatchStore}=await import('./payroll-batch.mjs'),client=await mount(),store=payrollBatchStore(client.storage);let active=true;store.start(UID,[paid(),paid({id:entitlement.id})]);await assert.rejects(store.run(UID,{record:async(...args)=>{const result=await client.record(...args);active=false;return result;},sessionAvailable:()=>active}),/Akun berubah/);assert.equal((await inspect()).payroll_events.length,1);assert.equal(store.read('synthetic-other-owner'),null);assert.deepEqual(store.read(UID).items.map(x=>x.phase),['ack','ready']);
});
test('actual client commits a paired state/event and confirms server timestamps without singleton writes',async()=>{
 const before=await inspect(),client=await mount(),eventId=await client.record(paid()),after=await inspect();
 assert.match(eventId,/^pe_[A-Za-z0-9_]+$/);assert.equal(after.payroll_states.length,1);assert.equal(after.payroll_events.length,1);
 const state=after.payroll_states[0].data,event=after.payroll_events[0];
 assert.equal(event.id,eventId);assert.deepEqual(state,event.data);assert.equal(state.event_id,eventId);assert.equal(state.owner_uid,UID);assert.equal(state.revision,1);assert.equal(state.status,'lunas');assert.deepEqual(state.wage,wage);assert.ok(state.committed_at instanceof sdk.Timestamp);
 assertUnchangedSources(before,after);assert.equal(refreshes,1);assert.equal(client.decorations,1);
 assert.deepEqual(client.sets.map(x=>x.path).sort(),['payroll_events/'+eventId,'payroll_states/'+wage.id].sort());
});
test('server entitlement is used without mutating canonical full_day source',async()=>{
 const before=await inspect(),client=await mount();await client.record(paid({id:entitlement.id}));const after=await inspect();
 assert.deepEqual(after.payroll_states[0].data.wage,entitlement);assertUnchangedSources(before,after);
});
for(const origin of ['legacy','entitlement'])test('K4 '+origin+' actual SDK records private payment, survives lost ACK and public reload, then cancels',async()=>{
 const w={...(origin==='legacy'?wage:entitlement),fund:'K4',eligible:true};
 await seed({[origin==='legacy'?'upah/active':'wage_entitlements/'+w.id]:origin==='legacy'?{data:[w]}:w,['payroll_targets/'+w.id]:{enabled:true,wage:w}});
 UPAH_ITEMS=UPAH_ITEMS.map(x=>x.id===w.id?w:x);
 const before=await inspect();let lose=true;
 const client=await mount({hooks:{beforeReadback:()=>{if(lose){lose=false;throw Error('synthetic private lost ACK');}}}}),input=paid({id:w.id,source:'pribadi'});
 await assert.rejects(client.record(input),/synthetic private lost ACK/);
 const committed=await inspect();assert.equal(committed.payroll_events.length,1);assert.deepEqual(committed.payroll_states[0].data.wage,w);assert.equal(committed.payroll_states[0].data.source,'pribadi');
 const reloaded=await mount();assert.equal(await reloaded.record(input),committed.payroll_events[0].id);assert.deepEqual(await inspect(),committed);
 window.normalizeOwnerReport=x=>x;
 const {createPublicReader}=await import(await loadBrowserModule(path.join(__dirname,'public-reader.js'))),db=env.unauthenticatedContext().firestore();
 const reload=async()=>{const reader=createPublicReader({readCollection:async name=>(await sdk.getDocsFromServer(sdk.collection(db,name))).docs.map(d=>({id:d.id,data:d.data()}))});try{return await reader.read();}finally{reader.stop();}};
 const result=await reload();assert.ok(!result._meta.errors.includes('payroll-events-unconfirmed'));assert.equal(result._meta.domains.cashbook.state,'available');
 const projected=result.upah.find(x=>String(x.id)===w.id);assert.equal(projected.status,'lunas');assert.equal(projected.fund,'K4');assert.equal(projected.bayar_source,'pribadi');
 assert.equal(result.cashbook.length,baseCash.length+1);assert.equal(result.cashbook.find(x=>x.ref==='upah_'+w.id).fund,'K4');assert.deepEqual(result.cashbook.filter(x=>x.fund!=='K4'),baseCash);
 UPAH_ITEMS=UPAH_ITEMS.map(x=>x.id===w.id?{...w,status:'lunas',payroll_revision:1}:x);
 await reloaded.record(paid({id:w.id,status:'belum',paidDate:null,source:null,reason:'Synthetic private correction'}));
 const after=await inspect(),cancelled=await reload();assert.equal(after.payroll_events.length,2);assert.deepEqual(after.payroll_events.find(e=>e.id===committed.payroll_events[0].id),committed.payroll_events[0]);
 assert.equal(after.payroll_states[0].data.predecessor,committed.payroll_events[0].id);assert.equal(after.payroll_states[0].data.source,null);assert.deepEqual(after.payroll_states[0].data.wage,w);
 assert.equal(cancelled.upah.find(x=>String(x.id)===w.id).status,'belum');assert.deepEqual(cancelled.cashbook,baseCash);assertUnchangedSources(before,after);
});
test('untrusted displayed K4 fund cannot block a trusted Wakaf original payment',async()=>{UPAH_ITEMS[0]={...wage,fund:'K4'};const client=await mount();await client.record(paid());assert.deepEqual((await inspect()).payroll_states[0].data.wage,wage);});
for(const kind of ['private with wakif','Wakaf with pribadi','forged input fund','changed trusted target fund'])test('actual SDK refuses wrong original fund/source '+kind,async()=>{
 let input=paid({source:'pribadi'});
 if(kind==='private with wakif'){const w={...wage,fund:'K4',eligible:true};await seed({'upah/active':{data:[w]},['payroll_targets/'+w.id]:{enabled:true,wage:w}});UPAH_ITEMS[0]=w;input=paid();}
 if(kind==='forged input fund'){UPAH_ITEMS[0]={...wage,fund:'K4'};input.fund='K4';}
 if(kind==='changed trusted target fund')await seed({['payroll_targets/'+wage.id]:{enabled:true,wage:{...wage,fund:'K4'}}});
 const before=await inspect(),client=await mount();await assert.rejects(client.record(input));assert.equal(client.sets.length,0);assert.deepEqual(await inspect(),before);assert.equal(localStorage.getItem('wkkn_payroll_intent_v1_'+UID),null);
});
test('unsupported payment source is rejected before a transaction',async()=>{const client=await mount();await assert.rejects(client.record(paid({source:'anto'})));assert.equal(client.transactions,0);assertNoPayroll(await inspect());});
for(const kind of ['missing user','anonymous','unverified','non-Google','mismatched ticket'])test('local identity rejects '+kind,async()=>{
 const client=await mount();
 if(kind==='missing user')client.auth.currentUser=null;
 if(kind==='anonymous')client.auth.currentUser.isAnonymous=true;
 if(kind==='unverified')client.auth.currentUser.emailVerified=false;
 if(kind==='non-Google')client.auth.currentUser.providerData=[{providerId:'password'}];
 if(kind==='mismatched ticket')client.auth.currentUser.uid='synthetic-other';
 await assert.rejects(client.record(paid()),/Google|akun/i);assert.equal(client.transactions,0);assertNoPayroll(await inspect());
});
for(const kind of ['missing payroll grant','disabled payroll grant','wrong payroll epoch','disabled entry grant','paused entry policy','non-Google token','unverified token'])test('real Rules/client deny '+kind,async()=>{
 let db;
 if(kind==='missing payroll grant')db=googleDb('synthetic-outsider');
 if(kind==='disabled payroll grant')await seed({['payroll_grants/'+UID]:{uid:UID,enabled:false,epoch:1}});
 if(kind==='wrong payroll epoch')await seed({['payroll_grants/'+UID]:{uid:UID,enabled:true,epoch:2}});
 if(kind==='disabled entry grant')await seed({['entry_grants/'+UID]:{uid:UID,enabled:false,role:'staff',worker_token:'',writer_epoch:1,grant_epoch:1}});
 if(kind==='paused entry policy')await seed({'entry_policy/active':{paused:true,writer_epoch:1}});
 if(kind==='non-Google token')db=googleDb(UID,'password');
 if(kind==='unverified token')db=googleDb(UID,'google.com',false);
 const client=await mount({uid:kind==='missing payroll grant'?'synthetic-outsider':UID,...(db?{db}:{})});
 await assert.rejects(client.record(paid()));assertNoPayroll(await inspect());assert.equal(refreshes,0);
});
test('session generation changed while reading aborts before commit',async()=>{
 let client,changed=false;client=await mount({hooks:{afterGet:()=>{if(!changed){changed=true;client.changeSession();}}}});
 await assert.rejects(client.record(paid()),/Akun berubah|Sesi|session/i);assertNoPayroll(await inspect());assert.equal(refreshes,0);
});
test('session change after commit does not acknowledge old UI and remount recovers the same event',async()=>{
 let client,changed=false;client=await mount({hooks:{beforeReadback:()=>{if(!changed){changed=true;client.changeSession();}}}});
 await assert.rejects(client.record(paid()),/Akun berubah|Sesi|session/i);const before=await inspect();
 assert.equal(before.payroll_events.length,1);assert.equal(refreshes,0);
 const reloaded=await mount();assert.equal(await reloaded.record(paid()),before.payroll_events[0].id);assert.deepEqual(await inspect(),before);
});
test('failed persistent intent storage blocks all transaction/network writes',async()=>{
 const storage=browserStorage();storage.setItem=()=>{throw Error('synthetic storage unavailable');};
 const client=await mount({storage});await assert.rejects(client.record(paid()),/synthetic storage/);assert.equal(client.transactions,0);assertNoPayroll(await inspect());
});
test('corrupt pending intent fails closed without erasing browser recovery data',async()=>{
 localStorage.setItem('wkkn_payroll_intent_v1_'+UID,'not-valid-json');
 const client=await mount();await assert.rejects(client.record(paid()));assert.equal(client.transactions,0);assert.equal(localStorage.getItem('wkkn_payroll_intent_v1_'+UID),'not-valid-json');assertNoPayroll(await inspect());
});
test('disabled trusted payroll target denies before dispatch without locking the account',async()=>{
 await seed({['payroll_targets/'+wage.id]:{enabled:false,wage}});
 const before=await inspect(),client=await mount();await assert.rejects(client.record(paid()),/pemeriksaan sumber|permission/i);assert.deepEqual(await inspect(),before);assert.equal(client.sets.length,0);assert.equal(localStorage.getItem('wkkn_payroll_intent_v1_'+UID),null);
});
test('target revoked after client reads is denied by real Rules and keeps dispatched intent',async()=>{
 const client=await mount({hooks:{afterBody:async()=>{await seed({['payroll_targets/'+wage.id]:{enabled:false,wage}});}}});
 await assert.rejects(client.record(paid()),{code:'permission-denied'});assertNoPayroll(await inspect());assert.equal(client.sets.length,2);assert.ok(localStorage.getItem('wkkn_payroll_intent_v1_'+UID));
});
test('unsupported legacy cancellation cannot lock account before a valid other-wage payment',async()=>{
 const legacy={...wage,id:'wage_synthetic_legacy',status:'lunas',bayar_tgl:'2026-10-01',bayar_source:'wakif'};
 await seed({'upah/active':{data:[wage,legacy]}});UPAH_ITEMS.push(legacy);
 const client=await mount();await assert.rejects(client.record(paid({id:legacy.id,status:'belum',paidDate:null,source:null,reason:'Unsupported legacy correction'})),/lama|rekonsiliasi|jejak/i);
 assert.equal(client.transactions,0);assert.equal(localStorage.getItem('wkkn_payroll_intent_v1_'+UID),null);
 await client.record(paid({id:entitlement.id}));assert.equal((await inspect()).payroll_states[0].id,entitlement.id);
});
for(const kind of ['missing source','duplicate source','linked cash','unsupported original','K4 source'])test('fresh pre-dispatch '+kind+' failure releases only its own new intent',async()=>{
 let input=paid();
 if(kind==='missing source')input=paid({id:'wage_synthetic_missing'});
 if(kind==='duplicate source')await seed({'upah/active':{data:[wage,wage]}});
 if(kind==='linked cash')await seed({'cashbook/active':{data:[...baseCash,{id:'synthetic-linked',ref:'upah_'+wage.id}]}});
 if(kind==='unsupported original')await seed({'upah/active':{data:[{...wage,eligible:false}]}});
 if(kind==='K4 source'){UPAH_ITEMS[0]={...wage,fund:'K4'};await seed({'upah/active':{data:[{...wage,fund:'K4'}]}});}
 const client=await mount();await assert.rejects(client.record(input));assert.equal(client.sets.length,0);assertNoPayroll(await inspect());assert.equal(localStorage.getItem('wkkn_payroll_intent_v1_'+UID),null);
 await client.record(paid({id:entitlement.id}));assert.equal((await inspect()).payroll_states[0].id,entitlement.id);
});
test('existing uncertainty remains locked on a later pre-dispatch grant failure',async()=>{
 const original=await mount({hooks:{afterBody:()=>{throw Error('synthetic uncertain dispatch');}}});await assert.rejects(original.record(paid()),/synthetic uncertain/);
 const raw=localStorage.getItem('wkkn_payroll_intent_v1_'+UID);assert.ok(raw);
 await seed({['payroll_grants/'+UID]:{uid:UID,enabled:false,epoch:1}});
 const reloaded=await mount();await assert.rejects(reloaded.record(paid()));assert.equal(reloaded.sets.length,0);assert.equal(localStorage.getItem('wkkn_payroll_intent_v1_'+UID),raw);
});
test('failure before commit preserves the original intent and retry event ID',async()=>{
 let fail=true;const client=await mount({hooks:{afterBody:()=>{if(fail){fail=false;throw Error('synthetic precommit transport failure');}}}});
 await assert.rejects(client.record(paid()),/synthetic precommit/);assertNoPayroll(await inspect());
 const first=client.sets.find(x=>x.path.startsWith('payroll_events/')).value.event_id;
 const actual=await client.record(paid());assert.equal(actual,first);
 const after=await inspect();assert.equal(after.payroll_events.length,1);assert.equal(after.payroll_states[0].data.revision,1);assert.equal(refreshes,1);
});
test('lost acknowledgment retries the committed event without creating another event or revision',async()=>{
 let lose=true;const client=await mount({hooks:{beforeReadback:()=>{if(lose){lose=false;throw Error('synthetic lost ACK');}}}});
 await assert.rejects(client.record(paid()),/synthetic lost ACK/);
 const before=await inspect();assert.equal(before.payroll_events.length,1);assert.equal(refreshes,0);
 const eventId=await client.record(paid());const after=await inspect();
 assert.equal(eventId,before.payroll_events[0].id);assert.deepEqual(after,before);assert.equal(client.sets.length,2);assert.equal(refreshes,1);
});
test('lost acknowledgment survives remount using the persisted account-bound event ID',async()=>{
 let lose=true;const original=await mount({hooks:{beforeReadback:()=>{if(lose){lose=false;throw Error('synthetic lost ACK before reload');}}}});
 await assert.rejects(original.record(paid()),/synthetic lost ACK/);const before=await inspect();
 const reloaded=await mount();assert.equal(await reloaded.record(paid()),before.payroll_events[0].id);
 assert.deepEqual(await inspect(),before);assert.equal(reloaded.sets.length,0);assert.equal(localStorage.getItem('wkkn_payroll_intent_v1_'+UID),null);
});
test('uncertain intent refuses edited input even after remount and preserves its exact ID',async()=>{
 const original=await mount({hooks:{afterBody:()=>{throw Error('synthetic precommit');}}});
 await assert.rejects(original.record(paid()),/synthetic precommit/);const raw=localStorage.getItem('wkkn_payroll_intent_v1_'+UID);
 const reloaded=await mount();await assert.rejects(reloaded.record(paid({reason:'Synthetic alternate actual-payment record'})),/belum pasti|isian sebelumnya/i);
 assert.equal(reloaded.transactions,0);assert.equal(localStorage.getItem('wkkn_payroll_intent_v1_'+UID),raw);assertNoPayroll(await inspect());
});
test('another authorized account cannot adopt or erase an uncertain command',async()=>{
 const original=await mount({hooks:{afterBody:()=>{throw Error('synthetic precommit');}}});await assert.rejects(original.record(paid()),/synthetic precommit/);
 const raw=localStorage.getItem('wkkn_payroll_intent_v1_'+UID),prior=JSON.parse(raw),other='synthetic-payroll-other';
 await seed({['entry_grants/'+other]:{uid:other,enabled:true,role:'staff',worker_token:'',writer_epoch:1,grant_epoch:1},['payroll_grants/'+other]:{uid:other,enabled:true,epoch:1}});
 const client=await mount({uid:other});const id=await client.record(paid());assert.notEqual(id,prior.eventId);assert.equal(localStorage.getItem('wkkn_payroll_intent_v1_'+UID),raw);
 assert.equal((await inspect()).payroll_events[0].data.owner_uid,other);
});
test('lost acknowledgment of an unpaid correction replays the same committed null-valued event',async()=>{
 let lose=false;const client=await mount({hooks:{beforeReadback:()=>{if(lose){lose=false;throw Error('synthetic lost correction ACK');}}}});
 await client.record(paid());await publishServerWages();lose=true;
 const correction=paid({status:'belum',paidDate:null,source:null,reason:'Synthetic correction with lost ACK'});
 await assert.rejects(client.record(correction),/synthetic lost correction ACK/);
 const before=await inspect();assert.equal(before.payroll_events.length,2);assert.equal(before.payroll_states[0].data.status,'belum');
 assert.equal(await client.record(correction),before.payroll_states[0].data.event_id);assert.deepEqual(await inspect(),before);
});
for(const ref of ['upah_wage_synthetic_1','upah_other·wage_synthetic_1·third'])test('reject legacy linked cashbook ref '+ref,async()=>{
 await seed({'cashbook/active':{data:[...baseCash,{id:'synthetic-old-payment',ref,keluar:100000}]}});
 const before=await inspect(),client=await mount();await assert.rejects(client.record(paid()),/kas lama|cash|rekonsiliasi/i);
 assert.deepEqual(await inspect(),before);assert.equal(client.sets.length,0);
});
test('two actual concurrent transactions cannot silently overwrite a stale revision',async()=>{
 let entered=0,release;const barrier=new Promise(resolve=>{release=resolve;});
 const hooks=()=>{let first=true;return {afterBody:async()=>{if(!first)return;first=false;if(++entered===2)release();await barrier;}};};
 const a=await mount({hooks:hooks(),storage:browserStorage()}),b=await mount({hooks:hooks(),storage:browserStorage()});
 const result=await Promise.allSettled([a.record(paid()),b.record(paid({reason:'Synthetic alternate actual-payment record'}))]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);const failure=result.find(r=>r.status==='rejected');
 // Emulator Rules may reject the stale commit before the SDK gets an ABORTED retry.
 assert.ok(failure.reason.code==='permission-denied'||/Status berubah|revision|perangkat lain/i.test(failure.reason.message),failure.reason.message);
 const after=await inspect();assert.equal(after.payroll_states.length,1);assert.equal(after.payroll_events.length,1);assert.equal(after.payroll_states[0].data.revision,1);
 assert.equal(entered,2,'both real transaction callbacks read the original revision before either commit');assert.equal(refreshes,1);
});
test('retry of a failed intent detects another client revision rather than rebasing silently',async()=>{
 let fail=true;const stale=await mount({hooks:{afterBody:()=>{if(fail){fail=false;throw Error('synthetic precommit failure');}}}});
 await assert.rejects(stale.record(paid()),/synthetic precommit/);
 const winner=await mount({storage:browserStorage()});await winner.record(paid({reason:'Synthetic alternate actual-payment record'}));const before=await inspect();
 await assert.rejects(stale.record(paid()),/Status berubah|revision|perangkat lain/i);assert.deepEqual(await inspect(),before);assert.equal(before.payroll_events.length,1);
});
test('single-flight rejects a second send while an actual transaction is pending',async()=>{
 let release,entered;const ready=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;});
 const client=await mount({hooks:{beforeBody:async()=>{entered();await gate;}}});
 const first=client.record(paid());await ready;
 try{await assert.rejects(client.record(paid()),/sebelumnya|diperiksa/i);}finally{release();}
 await first;assert.equal((await inspect()).payroll_events.length,1);
});
test('correction to unpaid records a second immutable event and advances the paired head',async()=>{
 const client=await mount(),first=await client.record(paid()),before=await inspect();
 await publishServerWages();const second=await client.record(paid({status:'belum',paidDate:null,source:null,reason:'Synthetic correction of mistaken actual-payment record'}));
 const after=await inspect(),state=after.payroll_states[0].data;
 assert.notEqual(first,second);assert.equal(state.status,'belum');assert.equal(state.revision,2);assert.equal(state.predecessor,first);assert.equal(after.payroll_events.length,2);
 assert.deepEqual(after.payroll_events.find(e=>e.id===first),before.payroll_events[0]);assertUnchangedSources(before,after);
});
// Evaluate real local reader dependencies in memory, replacing only CDN SDK resolution.
async function loadBrowserModule(filename,cache=new Map()){
 if(cache.has(filename))return cache.get(filename);
 let source=fs.readFileSync(filename,'utf8');
 const pattern=/from\s*(['"])([^'"]+)\1/g;let match;const replacements=[];
 while((match=pattern.exec(source))){let target=match[2],url;
  if(target.startsWith('https://www.gstatic.com/firebasejs/')){
   const names=Object.keys({...require('./node_modules/firebase/app'),...require('./node_modules/firebase/auth'),...sdk}).filter(x=>/^[A-Za-z_$][\w$]*$/.test(x));
   globalThis.__payrollReaderSdk={...require('./node_modules/firebase/app'),...require('./node_modules/firebase/auth'),...sdk};
   url=dataModule(`export const {${names.join(',')}}=globalThis.__payrollReaderSdk;`);
  }else if(target.startsWith('.'))url=await loadBrowserModule(path.resolve(path.dirname(filename),target),cache);
  else continue;
  replacements.push({start:match.index,end:pattern.lastIndex,value:'from '+JSON.stringify(url)});
 }
 for(const r of replacements.reverse())source=source.slice(0,r.start)+r.value+source.slice(r.end);
 const url=dataModule(source+'\n// actual local module '+filename);cache.set(filename,url);return url;
}
test('fresh public reader reload projects committed state once and correction removes only derived cash',async()=>{
 const before=await inspect(),client=await mount();await client.record(paid());
 window.normalizeOwnerReport=x=>x;
 const {createPublicReader}=await import(await loadBrowserModule(path.join(__dirname,'public-reader.js')));
 const db=env.unauthenticatedContext().firestore();
 const reload=async()=>{
  const reader=createPublicReader({readCollection:async name=>{const snap=await sdk.getDocsFromServer(sdk.collection(db,name));assert.equal(snap.metadata.fromCache,false);return snap.docs.map(d=>({id:d.id,data:d.data()}));}});
  try{return await reader.read();}finally{reader.stop();}
 };
 const a=await reload(),b=await reload();assert.ok(!a._meta.errors.includes('payroll-events-unconfirmed'));
 const projected=a.upah.find(w=>String(w.id)===wage.id);assert.equal(projected.status,'lunas');assert.equal(projected.bayar_tgl,'2026-10-02');
 assert.deepEqual(a.upah,b.upah);assert.deepEqual(a.cashbook,b.cashbook);
 const cash=a.cashbook.filter(c=>c.ref==='upah_'+wage.id);assert.equal(cash.length,1);assert.equal(cash[0].keluar,100000);assert.equal(cash[0].id,'cb_payroll_'+wage.id);
 await publishServerWages();await client.record(paid({status:'belum',paidDate:null,source:null,reason:'Synthetic correction'}));
 const c=await reload();assert.equal(c.upah.find(w=>String(w.id)===wage.id).status,'belum');assert.deepEqual(c.cashbook,baseCash);assertUnchangedSources(before,await inspect());
 delete globalThis.__payrollReaderSdk;
});
