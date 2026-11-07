const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('recovery/device-entry.js','utf8').replace(/^import .*;\n/gm,'').replace('export async function mountDeviceEntry','async function mountDeviceEntry');
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.hidden=false;this.textContent='';this.listeners={};}
 append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}
 prepend(...nodes){for(const n of nodes)n.parentNode=this;this.children.unshift(...nodes);}
 after(...nodes){const p=this.parentNode;for(const n of nodes)n.parentNode=p;p.children.splice(p.children.indexOf(this)+1,0,...nodes);}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 contains(n){return n===this||this.children.some(c=>c.contains(n));}
}
function harness({user=null,records={},seed={}}={}){
 const panel=new Element(),main=new Element(),header=new Element('header');panel.id='panel-form';main.id='main-content';header.id='public-header';main.append(panel);
 const find=id=>{const visit=n=>n.id===id?n:n.children.map(visit).find(Boolean);return [main,header].map(visit).find(Boolean);};
 const storage=(values={})=>{const data=new Map(Object.entries(values));return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
 let callback;const calls={popup:0,writes:0};const auth={currentUser:user};
 const context={document:{createElement:t=>new Element(t),getElementById:find,querySelectorAll:()=>[],addEventListener(){}},localStorage:storage(seed),sessionStorage:storage(),crypto:{randomUUID:()=> 'presentation-slot'},navigator:{locks:{request:async(name,opts,fn)=>fn({})}},addEventListener(){},queueMicrotask,workerReportContent:JSON.stringify,
 initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),browserLocalPersistence:{},setPersistence:async()=>{},onAuthStateChanged:(a,fn)=>{callback=fn;queueMicrotask(()=>fn(a.currentUser));},GoogleAuthProvider:class{},signInWithPopup:async()=>{calls.popup++;},signOut:async()=>{auth.currentUser=null;await callback(null);},holdEntryRoster(){},validReportBody:()=>true,
 doc:(db,collection,id)=>collection+'/'+id,getDocFromServer:async path=>({data:()=>records[path]}),collection:()=>({}),query:()=>({}),where:()=>({}),getDocsFromServer:async()=>({docs:[]}),WORKER_DEFS:[],entryRoster:{},populateFormPelaporRadio(){}};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 return {find,panel,main,header,calls,mount:()=>context.mountDeviceEntry({})};
}
test('entry account controls are a labelled compact region only inside the report panel',async()=>{
 const h=harness();await h.mount();const card=h.find('device-entry-account');assert.ok(card,'account card exists');
 assert.equal(card.tagName,'div');assert.equal(card.attributes.role,'region');assert.equal(card.attributes['aria-labelledby'],'device-entry-account-title');
 const title=h.find('device-entry-account-title');assert.equal(title.tagName,'h3');assert.equal(title.textContent,'Masuk untuk mengisi laporan');
 assert.match(h.find('device-entry-account-note').textContent,/tanpa.*masuk/i);
 assert.ok(h.panel.contains(card));assert.equal(h.header.children.length,0);
 for(const id of ['device-entry-signin','device-entry-signout','device-entry-status','device-entry-recovery','device-entry-retry'])assert.ok(card.contains(h.find(id)),id+' remains in account card');
 assert.equal(h.find('device-entry-recovery').hidden,true,'empty recovery starts hidden until the existing queue painter reveals pending/error state');
 const status=h.find('device-entry-status');assert.equal(status.attributes.role,'status');assert.equal(status.attributes['aria-live'],'polite');assert.equal(status.hidden,false);assert.match(status.textContent,/Google/);
 const login=h.find('device-entry-signin');assert.equal(login.type,'button');assert.equal(login.textContent,'Masuk dengan Google');assert.equal(login.hidden,false);
 const icon=login.children[0];assert.equal(icon.attributes['aria-hidden'],'true');assert.match(icon.innerHTML,/<svg/);assert.match(icon.innerHTML,/#4285F4/);assert.match(icon.innerHTML,/#34A853/);assert.match(icon.innerHTML,/#FBBC05/);assert.match(icon.innerHTML,/#EA4335/);assert.match(icon.innerHTML,/focusable="false"/);
 const logout=h.find('device-entry-signout');assert.equal(logout.type,'button');assert.equal(logout.hidden,true);assert.notEqual(logout.parentNode,login.parentNode,'logout is a separate secondary action');
 login.onclick();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.popup,1);
});
const approvedUser={uid:'presentation-user',email:'synthetic@example.test',emailVerified:true,providerData:[{providerId:'google.com'}],getIdTokenResult:async()=>({signInProvider:'google.com'})};
const approvedRecords={'entry_policy/active':{paused:false,writer_epoch:1},'entry_grants/presentation-user':{uid:'presentation-user',enabled:true,role:'staff_entry',worker_token:'',writer_epoch:1,grant_epoch:1},'device_entry_policy/active':{enabled:true,epoch:1,roster_version:'test-roster'},'entry_roster/active':{version:'test-roster',workers:{}}};
test('existing queue painter reveals real pending reports and keeps signed-in email within account card',async()=>{
 const seed={wkkn_device_entry_v1:JSON.stringify([{owner:'presentation-user',pending:[{id:'pending-report'}],envelopes:[]}])};
 const h=harness({user:approvedUser,records:approvedRecords,seed});await h.mount();
 assert.equal(h.find('device-entry-recovery').hidden,false);assert.match(h.find('device-entry-recovery').children[0].textContent,/1 laporan/);
 assert.equal(h.find('device-entry-signout').hidden,false);assert.match(h.find('device-entry-status').textContent,/synthetic@example.test/);assert.equal(h.header.children.length,0);
});
test('queue validation errors remain visible rather than disappearing with empty recovery',async()=>{
 const h=harness({user:approvedUser,records:approvedRecords,seed:{wkkn_device_entry_v1:'not-json'}});await h.mount();
 assert.equal(h.find('device-entry-recovery').hidden,false);assert.ok(h.find('device-entry-recovery').children[1].textContent.length>0);assert.equal(h.find('device-entry-status').hidden,false);
});
test('account styles are scoped, preserve hidden states and provide touch-sized focusable controls',()=>{
 assert.ok(fs.existsSync('recovery/entry-login.css'),'dedicated account stylesheet exists');
 const css=fs.readFileSync('recovery/entry-login.css','utf8');
 assert.match(css,/#panel-form\s+\.entry-account-card\s+\[hidden\]\s*\{\s*display:\s*none\s*!important/);
 assert.match(css,/min-height:\s*44px/);assert.match(css,/:focus-visible/);assert.match(css,/outline:\s*3px/);
 assert.match(css,/overflow-wrap:\s*anywhere/);assert.match(css,/@media\s*\(max-width:\s*480px\)/);
 assert.doesNotMatch(css,/(?:^|\})\s*(?:body|header|button|\[hidden\])\s*\{/,'no global styling side effects');
});
