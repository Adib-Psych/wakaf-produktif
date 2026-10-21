'use strict';
// Synthetic acceptance of assembled source; no Firebase network or real records.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const html=fs.readFileSync('monitor-v2.html','utf8');
const base=cp.execFileSync('git',['show','d5135d8fe40d70eb5fc20226ca211001f273fe1d:monitor-v2.html'],{encoding:'utf8',maxBuffer:4*1024*1024});
function topFn(text,name){const i=text.indexOf('function '+name+'(');assert.ok(i>=0,name);return text.slice(i,text.indexOf('\n}',i)+2);}
const factory=html.slice(html.indexOf('    function _makeStateSync('),html.indexOf('\n    // === UPAH (with MERGE GUARD'));
function fixture(name,version,rows,setter){let state=[],callback,renders=0;const cache=new Map();const cloud={version,data:structuredClone(rows)};
 const c=vm.createContext({console:{log(){},warn(){},error(){}},window:{render(){renders++;}},localStorage:{setItem:(k,v)=>cache.set(k,v)},Date,db:{},doc:()=>({}),getDoc:async()=>({exists:()=>true,data:()=>structuredClone(cloud)}),onSnapshot:(_,fn)=>{callback=fn;return ()=>{};},setTimeout(){},setDoc:async()=>{throw Error('synthetic containment');},serverTimestamp:()=>null,privateReader:{ticket:()=>({uid:'synthetic'}),matches:()=>true}});
 vm.runInContext(factory+'\nthis.make=_makeStateSync;',c);
 const f=c.make(name,'cache','synthetic',()=>state,d=>{state=d;if(setter)setter(d);},()=>version,'render');
 return {f,cache,cloud,get state(){return state;},get renders(){return renders;},snapshot:async rows=>{callback({exists:()=>true,data:()=>({version,data:structuredClone(rows)})});}};
}
test('INTEGRATED preservation: lexical SDK gates, proportional allocation, cabut and restrictive rules unchanged',()=>{
 // Staff setDoc is the approved bounded correction: only identity/content ACK check differs.
 const oldAck = '          return; // Lost ACK retry must never overwrite later dashboard edits.';
 const safeAck = "          // Transport timestamp changes on retry; every other payload field is submitted content.\n          const { last_synced_at: oldSync, ...oldContent } = old;\n          const { last_synced_at: newSync, ...submittedContent } = payload;\n          if (workerReportContent(oldContent) !== workerReportContent(submittedContent)) throw new Error('Konflik isi laporan; tetap pending');\n          return; // Exact retry only; never ACK or overwrite divergent cloud content.";
 assert.equal(topFn(html,'setDoc'),topFn(base,'setDoc').replace(oldAck,safeAck));
 for(const name of ['updateDoc','deleteDoc','submitFinishJemurMulti'])assert.equal(topFn(html,name),topFn(base,name));
 for(const file of ['recovery/firestore.entry-safe.rules','invoice-generator.html','invoice-sign.html'])assert.equal(fs.readFileSync(file,'utf8'),cp.execFileSync('git',['show','d5135d8fe40d70eb5fc20226ca211001f273fe1d:'+file],{encoding:'utf8',maxBuffer:4*1024*1024}));
});
test('INTEGRATED actual cache factory: load and snapshot preserve version/data, recorded zero and rendering',async()=>{
 for(const [name,version] of [['PanenData','1.1'],['PanenLots','1.0'],['PanenSampling','1.2']]){
  const f=fixture(name,version,[{id:'synthetic',value:0}]);await f.f.loadFn();assert.deepEqual(JSON.parse(f.cache.get('cache')),{version,data:[{id:'synthetic',value:0}]});assert.equal(f.renders,1);
  f.f.subscribeFn();await f.snapshot([{id:'new',value:0}]);assert.equal(JSON.parse(f.cache.get('cache')).data[0].id,'new');assert.equal(f.renders,2);
 }
});
test('INTEGRATED sampling cache executes real migration setter and reload preserves migrated gram fields',async()=>{
 const start=html.indexOf('      const panenSamplingMigrateSetter = (d) => {');const end=html.indexOf('\n      const { syncFn, loadFn, subscribeFn }',start);
 const c=vm.createContext({PANEN_SAMPLING_DATA:[],console:{log(){}}});vm.runInContext(html.slice(start,end)+'\nthis.setter=panenSamplingMigrateSetter;',c);
 const f=fixture('PanenSampling','1.2',[{id:'synthetic',kg:'1.25'}],c.setter);await f.f.loadFn();const saved=JSON.parse(f.cache.get('cache'));assert.equal(saved.data[0].cherry_gram,1250);assert.equal(saved.data[0].kg,1.25);assert.equal(saved.version,'1.2');
});
test('INTEGRATED schema mismatch cannot overwrite cache or announce a rendered result',async()=>{const f=fixture('PanenLots','99',[]);const c=vm.createContext({console:{log(){},warn(){},error(){}},window:{},localStorage:{setItem(){assert.fail('unknown schema cached');}},Date,db:{},doc:()=>({}),getDoc:async()=>({exists:()=>true,data:()=>f.cloud}),onSnapshot(){},setTimeout(){}});vm.runInContext(factory+'\nthis.make=_makeStateSync;',c);const actual=c.make('PanenLots','cache','lots',()=>[],()=>assert.fail('unknown schema applied'),()=> '1.0','render');assert.equal(await actual.loadFn(),null);});
test('INTEGRATED cache repairs do not introduce a new finance or operations cloud writer',async()=>{const f=fixture('PanenLots','1.0',[]);assert.equal(await f.f.syncFn(),false);assert.equal(fs.readFileSync('lapor.html','utf8').includes("register('worker-sw.js', { scope: './', updateViaCache: 'none' })"),true);assert.equal(html.includes("require('./finance/finance-domain.cjs')"),false);});
