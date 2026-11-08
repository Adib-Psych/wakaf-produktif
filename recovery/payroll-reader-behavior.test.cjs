'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const dependencies=['cashbook','upah','wage_entitlements','wage_processing','wage_worker_bindings','payroll_states','payroll_events'];
const row=(id,data)=>({id,data});
const plain=value=>JSON.parse(JSON.stringify(value));

// Same VM seam as tests/public-reader.test.cjs: evaluate the actual reader and
// owner validators, replacing module plumbing only, never the payroll projection.
async function loadReader(){
 const contract=await import('./payroll-contract.mjs');
 const context={projectPayroll:contract.projectPayroll,structuredClone,setTimeout,clearTimeout,Date,console,window:{normalizeOwnerReport:x=>x}};
 context.globalThis=context;
 vm.createContext(context);
 const source=name=>fs.readFileSync(path.join(__dirname,name),'utf8').replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
 vm.runInContext(fs.readFileSync(path.join(__dirname,'report-content.js'),'utf8'),context);
 const exports={
  'authorized-reports.js':'globalThis.validReportBody=validReportBody;',
  'versioned-operations.js':'globalThis.validOperation=validOperation;',
  'owner-report-authority.js':'globalThis.authority=authority;',
  'owner-dashboard.js':'globalThis.validateOwnerSnapshot=validateOwnerSnapshot;globalThis.OWNER_READ_COLLECTIONS=OWNER_READ_COLLECTIONS;',
  'public-reader.js':'globalThis.api={createPublicReader,PUBLIC_READ_COLLECTIONS};'
 };
 for(const [name,expose]of Object.entries(exports))vm.runInContext('{'+source(name)+';'+expose+'}',context,{filename:path.join(__dirname,name)});
 return {...context.api,...contract};
}

function fixtures(buildPayrollState){
 const baseWage={id:'synthetic_base_wage',pelapor:'TEST_BASE',name:'Synthetic base worker',tgl:'2000-01-01',aktivitas:'Synthetic work',model:'harian',qty:1,satuan:'full',tarif:12500,status:'belum',fund:'K1_K3'};
 const bindingId='w_0123456789abcdef01234567';
 const entitlement={id:'synthetic_entitlement',pelapor:bindingId,name:'Synthetic entitlement worker',tgl:'2000-01-02',model:'harian',qty:1,satuan:'full_day',tarif:20000,status:'belum',eligible:true,sources:[{lane:'laporan',report_id:'synthetic_report',revision:1}]};
 const states=[baseWage,entitlement].map((wage,index)=>buildPayrollState({wage,status:'lunas',paidDate:'2000-01-03',source:'wakif',eventId:'synthetic_payment_'+index,uid:'synthetic_owner',stamp:'2000-01-03T00:00:00Z'}));
 const collections={
  upah:[row('active',{data:[baseWage]})],
  cashbook:[row('active',{data:[{id:'synthetic_base_cash',tgl:'2000-01-01',tipe:'masuk',masuk:100000,keluar:0,ref:'synthetic_deposit'}]})],
  wage_entitlements:[row(entitlement.id,entitlement)],
  wage_processing:[row(entitlement.id,{status:'created',reason:'Synthetic entitlement created',report_id:'synthetic_report',tgl:entitlement.tgl,worker:entitlement.pelapor})],
  wage_worker_bindings:[row(bindingId,{legacy_token:'TEST_ENTITLEMENT',name:entitlement.name})],
  payroll_states:[],payroll_events:[]
 };
 const paid=structuredClone(collections);
 // A new unrelated cash value makes mixed old-payroll/new-cash snapshots visible.
 paid.cashbook[0].data.data[0].masuk=150000;
 paid.payroll_states=states.map(state=>row(state.wage_id,structuredClone(state)));
 paid.payroll_events=states.map(state=>row(state.event_id,structuredClone(state)));
 return {initial:collections,paid};
}

function assertUnpaid(value){
 assert.deepEqual(Array.from(value.upah,w=>w.status),['belum','belum']);
 assert.equal(value.upah.some(w=>'payroll_revision'in w||'bayar_tgl'in w),false);
 assert.equal(value.cashbook.length,1);
 assert.equal(value.cashbook[0].masuk,100000);
 assert.equal(value.cashbook.some(c=>c.src==='payroll'),false);
}
function assertAvailable(value){
 assert.equal(value._meta.domains.upah.state,'available');
 assert.equal(value._meta.domains.cashbook.state,'available');
 assert.deepEqual(plain(value._meta.errors),[]);
}

for(const failedCollection of dependencies){
 test('PAY-REVIEW-02: '+failedCollection+' failure retains coherent unpaid/cash snapshot despite fresh payroll, then fully recovers',async()=>{
  const {createPublicReader,PUBLIC_READ_COLLECTIONS,buildPayrollState}=await loadReader();
  const {initial,paid}=fixtures(buildPayrollState);
  let current=initial,failed=null;
  const reads=[];
  const reader=createPublicReader({readCollection:async collection=>{
   reads.push(collection);
   if(collection===failed)throw Object.assign(Error('Synthetic server failure'),{code:'unavailable'});
   return structuredClone(current[collection]||[]);
  }});
  try{
   const first=await reader.read();
   assertUnpaid(first);
   assertAvailable(first);
   assert.deepEqual([...reads].sort(),[...PUBLIC_READ_COLLECTIONS].sort());
   const previous={upah:plain(first.upah),cashbook:plain(first.cashbook)};

   current=paid;failed=failedCollection;reads.length=0;
   const stale=await reader.read();
   assert.equal(stale._meta.collections[failedCollection].state,'stale');
   assert.equal(stale._meta.collections[failedCollection].code,'unavailable');
   assert(stale._meta.errors.includes(failedCollection));
   for(const collection of dependencies.filter(c=>c!==failedCollection))assert.equal(stale._meta.collections[collection].state,'available',collection+' must actually have a fresh successful read');
   // For base/entitlement/processing/cash failures both complete paid collections
   // really arrived; do not substitute an unpaired or malformed projection stub.
   for(const collection of ['payroll_states','payroll_events'].filter(c=>c!==failedCollection))assert.deepEqual(plain(stale.raw[collection]),paid[collection]);
   assert.deepEqual([...reads].sort(),[...PUBLIC_READ_COLLECTIONS].sort());
   assert.equal(stale._meta.domains.upah.state,'stale');
   assert.equal(stale._meta.domains.cashbook.state,'stale');
   assert(stale._meta.errors.includes('payroll-events-unconfirmed'));
   assert.deepEqual(plain(stale.upah),previous.upah,'must not expose freshly paid wages over stale inputs');
   assert.deepEqual(plain(stale.cashbook),previous.cashbook,'cash must remain paired with the prior unpaid wages, not fresh base/derived cash');
   assertUnpaid(stale);

   failed=null;
   const recovered=await reader.read();
   assertAvailable(recovered);
   for(const collection of dependencies)assert.equal(recovered._meta.collections[collection].state,'available');
   assert.deepEqual(Array.from(recovered.upah,w=>w.status),['lunas','lunas']);
   for(const wage of recovered.upah){assert.equal(wage.payroll_revision,1);assert.equal(wage.bayar_tgl,'2000-01-03');assert.equal(wage.bayar_source,'wakif');}
   assert.equal(recovered.upah.find(w=>w.id==='synthetic_entitlement').satuan,'full','real contract accepts normalized full_day entitlements');
   assert.equal(recovered.cashbook[0].masuk,150000);
   assert.equal(recovered.cashbook.length,3);
   const derived=recovered.cashbook.filter(c=>c.src==='payroll');
   assert.deepEqual(Array.from(derived,c=>c.id).sort(),['cb_payroll_synthetic_base_wage','cb_payroll_synthetic_entitlement']);
   assert.equal(derived.reduce((sum,c)=>sum+c.keluar,0),32500);
   assert.equal(recovered.cashbook.reduce((sum,c)=>sum+c.masuk-c.keluar,0),117500);
   // Refresh must project original source rows again, never duplicate derived cash.
   const refreshed=await reader.read();
   assertAvailable(refreshed);
   assert.deepEqual(plain(refreshed.upah),plain(recovered.upah));
   assert.deepEqual(plain(refreshed.cashbook),plain(recovered.cashbook));
  }finally{reader.stop();}
 });
}
