'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,'recovery',name),'utf8').replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
function load(extra={}){
 const c={structuredClone,setTimeout,clearTimeout,Date,console,window:{normalizeOwnerReport:x=>x},...extra};c.globalThis=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync(root+'/recovery/report-content.js','utf8'),c);
 for(const f of ['authorized-reports.js','versioned-operations.js','owner-report-authority.js','owner-dashboard.js'])vm.runInContext('{'+source(f)+';'+({ 'authorized-reports.js':'globalThis.validReportBody=validReportBody;', 'versioned-operations.js':'globalThis.validOperation=validOperation;', 'owner-report-authority.js':'globalThis.authority=authority;', 'owner-dashboard.js':'globalThis.validateOwnerSnapshot=validateOwnerSnapshot;globalThis.OWNER_READ_COLLECTIONS=OWNER_READ_COLLECTIONS;' }[f])+'}',c);
 const file=root+'/recovery/public-reader.js';if(fs.existsSync(file))vm.runInContext('{'+source('public-reader.js')+';globalThis.api={createPublicReader,PUBLIC_READ_COLLECTIONS,...(typeof mountPublicDashboard==="function"?{mountPublicDashboard}:{})};}',c);
 return {api:c.api||{},context:c};
}
const row=(id,data)=>({id,data});
test('collection failures preserve prior values, expose stale/error separately from known empty, and allow other domains',async()=>{
 let fail=false;const {api}=load();const reader=api.createPublicReader({readCollection:async c=>{if(fail&&c==='upah')throw Object.assign(Error('DO NOT DISPLAY RAW SERVER DETAIL'),{code:'permission-denied'});return c==='upah'?[row('active',{data:[{id:'synthetic-wage',tarif:123}]})]:c==='cashbook'?[row('active',{data:fail?[{id:'new-cash'}]:[]})]:[];}});
 await reader.read();fail=true;const v=await reader.read();assert.equal(v.upah[0].tarif,123);assert.equal(v.cashbook[0].id,'new-cash');assert.equal(v._meta.collections.upah.state,'stale');assert(v._meta.errors.includes('upah'));assert.equal(v._meta.collections.upah.code,'permission-denied');assert(!JSON.stringify(v._meta).includes('DO NOT DISPLAY'));
 const first=await api.createPublicReader({readCollection:async c=>{if(c==='upah')throw Error('offline');return [];}}).read();assert.equal(first.upah,null);assert.equal(first._meta.collections.upah.state,'error');assert.equal(first._meta.collections.cashbook.state,'empty');
});
test('malformed singleton preserves its previous domain while valid report rows survive an invalid sibling',async()=>{
 let bad=false;const {api}=load();const reader=api.createPublicReader({readCollection:async c=>c==='upah'?[row('active',{data:bad?'invalid':[{id:'wage'}]})]:c==='cashbook'?[row('active',{data:[{id:bad?'new':'old'}]})]:c==='laporan'?[row('good',{id:'good',kategori:'lain'}),...(bad?[row('bad',{id:'mismatch'})]:[])]:[]});
 await reader.read();bad=true;const v=await reader.read();assert.equal(v.upah[0].id,'wage');assert.equal(v.cashbook[0].id,'new');assert.equal(v.reports.length,1);assert.equal(v.reports[0].id,'good');assert.equal(v._meta.collections.upah.state,'stale');assert.equal(v._meta.domains.reports.state,'partial');assert.equal(v._meta.domains.reports.rejected,1);
});
test('a malformed existing report retains last validated row, without hiding other fresh reports',async()=>{
 let bad=false;const {api}=load();const reader=api.createPublicReader({readCollection:async c=>c==='laporan'?[row('same',{id:bad?'mismatch':'same',detail:'prior'}),row('other',{id:'other',detail:bad?'fresh':'old'})]:[]});await reader.read();bad=true;const v=await reader.read();assert.equal(v.reports.find(x=>x.id==='same').detail,'prior');assert.equal(v.reports.find(x=>x.id==='other').detail,'fresh');assert.equal(v._meta.domains.reports.rejected,1);assert.equal(v._meta.domains.reports.retained,1);
});
test('real paired reports and correction chains are validated; bad receipts cannot replace retained good reports',async()=>{
 const {fixture}=require('./authorized-report-harness.cjs');const body=fixture('staff'),corrected={...body,detail:'corrected SYNTHETIC'};
 const original={contract_version:1,report_id:body.id,command_id:body.id,writer_epoch:7,grant_epoch:2,submitted_body:body,owner_uid:'synthetic-owner',committed_revision:1,committed_at:'2000-01-02T00:00:00Z'};
 const operation={kind:'correction',command_id:'cmd_synthetic',target:body.id,expected_revision:1,predecessor:body.id,reason:'synthetic correction',body:corrected},event={operation,owner_uid:'synthetic-owner',writer_epoch:7,grant_epoch:2,revision:2,committed_at:'2000-01-03T00:00:00Z'};
 const rows={laporan:[row(body.id,original)],entry_receipts:[row(body.id,original)],report_heads:[row(body.id,{revision:2,command_id:operation.command_id,owner_uid:'synthetic-owner',body:corrected})],operation_events:[row(operation.command_id,event)],operation_receipts:[row(operation.command_id,event)]};
 const {api}=load();const reader=api.createPublicReader({readCollection:async c=>rows[c]||[]});let v=await reader.read();assert.equal(v.reports[0].detail,corrected.detail);assert.equal(v.reports[0]._provenance.integrity,'paired-correction-chain');assert.equal(v._meta.domains.reports.state,'available');rows.operation_receipts=[];v=await reader.read();assert.equal(v.reports[0].detail,corrected.detail);assert.equal(v._meta.domains.reports.state,'partial');assert.equal(v._meta.domains.reports.retained,1);
});
test('bounded reads coalesce refreshes, recover after timeout, and invalidate on stop',async()=>{
 let hung=true,calls=0;const {api}=load();const reader=api.createPublicReader({timeoutMs:10,readCollection:async c=>{calls++;if(hung&&c==='upah')return new Promise(()=>{});return [];}});const a=reader.read(),b=reader.read();assert.equal(a,b);const v=await a;assert.equal(v._meta.collections.upah.code,'deadline-exceeded');assert.equal(calls,api.PUBLIC_READ_COLLECTIONS.length);hung=false;assert.equal((await reader.read())._meta.collections.upah.state,'empty');reader.stop();await assert.rejects(reader.read(),/reader-stopped/);
});
test('public mount reuses original presentation and server-only SDK, marks public mode, rejects cached/pending snapshots',async()=>{
 let options,cache=false,pending=false;const calls=[];const {api,context}=load({getApps:()=>[],initializeApp:()=>({}),getFirestore:()=>({}),collection:(_db,c)=>c,getDocsFromServer:async c=>{calls.push(c);return {metadata:{fromCache:cache,hasPendingWrites:pending},docs:c==='upah'?[{id:'active',data:()=>({data:[{id:'wage'}]})}]:[]};},mountPrivateDashboard:async(_config,o)=>{options=o;await o.load();return {privateMode:true};}});
 assert.equal(typeof api.mountPublicDashboard,'function');const model=await api.mountPublicDashboard({});assert.equal(options.mode,'public-live');assert.equal(model.publicMode,true);assert.equal(model.privateMode,true);assert.equal(calls.length,api.PUBLIC_READ_COLLECTIONS.length);cache=true;let v=await options.load();assert.equal(v._meta.collections.upah.state,'stale');cache=false;pending=true;v=await options.load();assert.equal(v._meta.collections.upah.state,'stale');assert.equal(v.upah[0].id,'wage');assert.equal(v.raw.upah[0].id,'active');assert.equal(context.window.dashboardReadModel,model);
});
test('anonymous public reader reads every existing owner collection directly from server with full wage/staff data',async()=>{
 const calls=[];const {api}=load();assert.equal(typeof api.createPublicReader,'function');
 const reader=api.createPublicReader({readCollection:async c=>{calls.push(c);return c==='upah'?[row('active',{data:[{id:'synthetic-wage',tarif:123}]})]:c==='worker_defs_custom'?[row('active',{data:[{id:'synthetic-worker',nama:'TEST ONLY'}]})]:[];}});
 const value=await reader.read();assert.equal(value.upah[0].tarif,123);assert.equal(value.workers[0].nama,'TEST ONLY');assert.deepEqual(calls.sort(),[...api.PUBLIC_READ_COLLECTIONS].sort());assert(!calls.includes('operational_snapshot'));assert.equal(value._meta.access,'public-live');assert.equal(value._meta.collections.upah.state,'available');assert.equal(value._meta.collections.invoices.state,'empty');
});
