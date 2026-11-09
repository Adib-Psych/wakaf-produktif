'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=n=>fs.readFileSync(root+'/recovery/'+n,'utf8').replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
async function load(){const {projectPayroll}=await import('../recovery/payroll-contract.mjs');const c={projectPayroll,structuredClone,setTimeout,clearTimeout,Date,console,window:{normalizeOwnerReport:x=>x}};vm.createContext(c);vm.runInContext(fs.readFileSync(root+'/recovery/report-content.js','utf8'),c);for(const [f,e]of [['authorized-reports.js','validReportBody'],['versioned-operations.js','validOperation'],['owner-report-authority.js','authority'],['owner-dashboard.js','validateOwnerSnapshot,OWNER_READ_COLLECTIONS']]){vm.runInContext('{'+source(f)+';Object.assign(globalThis,{'+e+'});}',c);}vm.runInContext('{'+source('public-reader.js')+';globalThis.createPublicReader=createPublicReader;}',c);return c;}
const row=(id,data)=>({id,data}),opaque='w_0123456789abcdef01234567';
// Complete known-empty payroll dependencies; projection is never stubbed.
const emptyPayrollSources={cashbook:[row('active',{data:[]})],payroll_states:[],payroll_events:[]};
const entitlement=(id='wage_1',extra={})=>row(id,{id,pelapor:'YIT',tgl:'2026-10-02',model:'harian',qty:1,satuan:'full_day',tarif:100000,status:'belum',eligible:true,sources:['report_1'],name:'Cak Yit',...extra});
test('public reader merges direct entitlements without duplicating old worker/day or changing any paid history',async()=>{
 const c=await load(),old=Array.from({length:190},(_,i)=>({id:i,pelapor:i===0?'YIT':'OLD',tgl:i===0?'2026-10-02':'2025-01-'+String(i%28+1).padStart(2,'0'),tarif:25000,qty:1,status:'lunas',archived:i%2===0}));const originals=structuredClone(old),calls=[];
 const v=await c.createPublicReader({readCollection:async name=>{calls.push(name);return name==='upah'?[row('active',{data:old})]:name==='wage_entitlements'?[entitlement(),entitlement('wage_2',{tgl:'2026-10-03'})]:emptyPayrollSources[name]||[];}}).read();
 assert(calls.includes('wage_entitlements'));assert(calls.includes('wage_processing'));assert(calls.includes('wage_worker_bindings'));assert(calls.includes('payroll_states'));assert(calls.includes('payroll_events'));assert.equal(v.upah.length,191);assert.deepEqual(JSON.parse(JSON.stringify(v.upah.slice(0,190))),originals);assert.equal(v.upah.at(-1).id,'wage_2');assert.equal(v.upah.at(-1).status,'belum');assert.equal(v.raw.wage_entitlements.length,2);
});
test('failed and malformed automatic sources make wage health incomplete while preserving last good values',async()=>{
 const c=await load();let mode='ok';const reader=c.createPublicReader({readCollection:async name=>{
  if(name==='upah')return [row('active',{data:[{id:1,pelapor:'OLD',status:'lunas'}]})];
  if(name==='wage_entitlements'){if(mode==='offline')throw Object.assign(Error('secret'),{code:'unavailable'});return [entitlement('wage_1',mode==='bad'?{tarif:'100000'}:{})];}
  return emptyPayrollSources[name]||[];
 }});await reader.read();mode='bad';let v=await reader.read();assert.equal(v.upah.length,2);assert.equal(v._meta.collections.wage_entitlements.state,'stale');assert.equal(v._meta.domains.upah.state,'stale');mode='offline';v=await reader.read();assert.equal(v._meta.domains.upah.state,'stale');assert.equal(v.upah.at(-1).tarif,100000);
 const first=await c.createPublicReader({readCollection:async name=>{if(name==='wage_processing')throw Error('offline');return name==='upah'?[row('active',{data:[]})]:emptyPayrollSources[name]||[];}}).read();assert.equal(first._meta.domains.upah.state,'error');assert(first._meta.errors.includes('wage_processing'));
});
test('exact public bindings name opaque reports without rewriting identities or timestamps',async()=>{
 const c=await load(),b={legacy_token:'HARNI',name:'Mba Harmi'};
 const v=await c.createPublicReader({readCollection:async name=>name==='wage_worker_bindings'?[row(opaque,b)]:name==='laporan'?[row('oct',{id:'oct',pelapor:opaque,tgl:'2026-10-02',created_at:'2026-11-07T00:00:00Z'})]:name==='worker_defs_custom'?[row('active',{data:[{token:'HARNI',nama:'Old name',active:true}]})]:emptyPayrollSources[name]||[]}).read();
 assert.equal(v.reports[0].display_name,'Mba Harmi');assert.equal(v.reports[0].pelapor,opaque);assert.equal(v.reports[0].tgl,'2026-10-02');assert.equal(v.reports[0].created_at,'2026-11-07T00:00:00Z');assert.equal(v.raw.laporan[0].data.pelapor,opaque);assert.equal(v.workers.find(w=>w.token===opaque).nama,'Mba Harmi');assert.equal(v.workers.find(w=>w.token==='HARNI').nama,'Mba Harmi');assert.equal(v.raw.worker_defs_custom[0].data.data[0].nama,'Old name');
});
test('cross-identity same-day legacy wage shadows entitlement using exact binding only',async()=>{
 const c=await load(),v=await c.createPublicReader({readCollection:async name=>name==='upah'?[row('active',{data:[{id:1,pelapor:opaque,tgl:'2026-10-02',status:'lunas',qty:1,tarif:17}]})]:name==='wage_entitlements'?[entitlement()]:name==='wage_worker_bindings'?[row(opaque,{legacy_token:'YIT',name:'Cak Yit'})]:emptyPayrollSources[name]||[]}).read();assert.equal(v.upah.length,1);assert.equal(v.upah[0].pelapor,opaque);assert.equal(v.upah[0].status,'lunas');assert.equal(v.raw.wage_entitlements.length,1);
});
test('backend provenance objects and worker display field are accepted, ineligible entitlements excluded from payable totals',async()=>{
 const c=await load(),good=entitlement('wage_1',{sources:[{lane:'device_reports',report_id:'lap_one',revision:1}],worker:'Cak Yit',eligible:true});delete good.data.name;
 const blocked=entitlement('wage_2',{tgl:'2026-10-03',eligible:false});const v=await c.createPublicReader({readCollection:async name=>name==='wage_entitlements'?[good,blocked]:name==='wage_processing'?[row('failed',{status:'unresolved',reason:'unsupported_source',report_id:'lap_bad',tgl:null,worker:null})]:name==='upah'?[row('active',{data:[]})]:emptyPayrollSources[name]||[]}).read();assert.equal(v._meta.domains.upah.state,'available');assert.equal(v.upah.length,1);assert.equal(v.upah[0].id,'wage_1');assert.equal(v.wageEntitlements.length,2);assert.equal(v.wageProcessing[0].reason,'unsupported_source');
});
test('entitlement-provided worker name renders even when historical worker definitions are absent',async()=>{
 const c=await load(),v=await c.createPublicReader({readCollection:async name=>name==='wage_entitlements'?[entitlement('wage_1',{pelapor:'EXACT_NEW',name:'Named worker'})]:emptyPayrollSources[name]||[]}).read();assert.equal(v.workers.find(w=>w.token==='EXACT_NEW').nama,'Named worker');assert.equal(v.raw.wage_entitlements[0].data.pelapor,'EXACT_NEW');
});
test('missing eligibility fails closed without dropping raw entitlements or 190 legacy wages',async()=>{
 const c=await load(),missing=entitlement('missing',{tgl:'2026-10-03'});delete missing.data.eligible;
 const old=Array.from({length:190},(_,i)=>({id:i,pelapor:'OLD',tgl:'2025-01-01',status:'lunas',qty:1,tarif:25000,archived:i%2===0}));
 const v=await c.createPublicReader({readCollection:async name=>name==='wage_entitlements'?[missing,entitlement('approved')]:name==='upah'?[row('active',{data:old})]:emptyPayrollSources[name]||[]}).read();
 assert.deepEqual(JSON.parse(JSON.stringify(v.upah.slice(0,190))),old);assert.equal(v.upah.length,191);assert.equal(v.upah.at(-1).id,'approved');assert.equal(v.wageEntitlements.length,2);assert.deepEqual(JSON.parse(JSON.stringify(v.raw.wage_entitlements[0])),missing);assert.equal(v._meta.domains.upah.state,'available');
});
test('unresolved aggregate holds eligible entitlement while retaining raw documents and legacy history',async()=>{
 const c=await load(),held=entitlement('held'),approved=entitlement('approved',{tgl:'2026-10-03'}),legacy={id:1,pelapor:'OLD',tgl:'2025-01-01',status:'lunas',qty:1,tarif:25000};
 const processing=[row('held',{status:'unresolved',reason:'conflict',report_id:'report_1',tgl:'2026-10-02',worker:'YIT'}),row('approved',{status:'created',reason:'created',report_id:'report_2',tgl:'2026-10-03',worker:'YIT'}),row('source_only',{status:'unresolved',reason:'source_conflict',report_id:'report_2',tgl:'2026-10-03',worker:'YIT'})];
 const v=await c.createPublicReader({readCollection:async name=>name==='wage_entitlements'?[held,approved]:name==='wage_processing'?processing:name==='upah'?[row('active',{data:[legacy]})]:emptyPayrollSources[name]||[]}).read();
 assert.deepEqual(JSON.parse(JSON.stringify(v.upah)),[legacy,{...approved.data,satuan:'full'}]);assert.equal(v.wageEntitlements.length,2);assert.deepEqual(JSON.parse(JSON.stringify(v.raw.wage_processing)),processing);assert.deepEqual(JSON.parse(JSON.stringify(v.raw.wage_entitlements)),[held,approved]);assert.equal(v.wageProcessing.length,3);
});
module.exports={load,row,opaque,entitlement};

test('QC S1: activity of an automatic entitlement is a display map from its source report; wage rows stay byte-identical',async()=>{
 const c=await load(),v=await c.createPublicReader({readCollection:async name=>name==='upah'?[row('active',{data:[]})]:name==='laporan'?[row('report_1',{id:'report_1',pelapor:'YIT',tgl:'2026-10-02',kategori:'babat_rumput',detail:'Babat piringan K1',created_at:'2026-10-02T09:00:00Z'})]:name==='wage_entitlements'?[entitlement(),entitlement('wage_2',{tgl:'2026-10-03',sources:['unknown_report']})]:emptyPayrollSources[name]||[]}).read();
 assert.equal(v.wageActivity.wage_1,'babat rumput — Babat piringan K1');
 assert.equal(v.wageActivity.wage_2,undefined);
 // Baris upah tidak boleh berubah: proyeksi payroll membandingkannya persis dengan payroll_states.
 assert.equal(v.upah.find(x=>x.id==='wage_1').aktivitas,undefined);
});

test('QC S1: form placeholder "(no detail)" is not shown as activity text',async()=>{
 const c=await load(),v=await c.createPublicReader({readCollection:async name=>name==='upah'?[row('active',{data:[]})]:name==='laporan'?[row('report_1',{id:'report_1',pelapor:'YIT',tgl:'2026-10-02',kategori:'lain',detail:'(no detail)',created_at:'2026-10-02T09:00:00Z'})]:name==='wage_entitlements'?[entitlement()]:emptyPayrollSources[name]||[]}).read();
 assert.equal(v.wageActivity.wage_1,'lain-lain');
});
