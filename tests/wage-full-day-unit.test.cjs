'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const plain=value=>JSON.parse(JSON.stringify(value));
function loadActualDecoderAndProjection(){
 const c={structuredClone,Date,console,window:{normalizeOwnerReport:x=>x,privateViewEpoch:0},document:{querySelectorAll:()=>[]},STATE:{},WORKER_DEFS:[],SOP_AKTIVITAS_PER_BULAN:{}};
 vm.createContext(c);
 vm.runInContext(fs.readFileSync(path.join(root,'recovery/report-content.js'),'utf8'),c);
 for(const [file,exports] of [['authorized-reports.js','validReportBody'],['versioned-operations.js','validOperation'],['owner-report-authority.js','authority'],['owner-dashboard.js','validateOwnerSnapshot']]){
  const source=fs.readFileSync(path.join(root,'recovery',file),'utf8').replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
  vm.runInContext('{'+source+';Object.assign(globalThis,{'+exports+'});}',c);
 }
 const html=fs.readFileSync(path.join(root,'monitor-v2.html'),'utf8');
 const start=html.indexOf('window.applyOwnerSnapshot=v=>{');
 const end=html.indexOf('\nvoid mountDeviceEntry(',start);
 assert(start!==-1&&end>start,'actual UI snapshot projection is available');
 vm.runInContext(html.slice(start,end),c);
 const calc=html.match(/function calcTotal\(item\) \{[\s\S]*?\n\}/);
 assert(calc,'actual wage total function is available');
 vm.runInContext(calc[0],c);
 return c;
}
test('actual decoder projects only new full-day entitlements as legacy full without altering source documents or wages',()=>{
 const c=loadActualDecoderAndProjection();
 const entitlement=(id,tgl,satuan,extra={})=>({id,data:{id,pelapor:'WORKER',name:'Named worker',tgl,model:'harian',qty:1,satuan,tarif:satuan==='full_day'?100000:50000,status:'belum',eligible:true,sources:[{lane:'device_reports',report_id:'report_'+id,revision:1}],created_at:'2026-11-07T16:19:45Z',metadata:{keep:'verbatim'},...extra}});
 const legacy={id:190,pelapor:'OLD',tgl:'2026-10-01',model:'harian',qty:2,satuan:'full_day',tarif:40000,status:'lunas',satuan_lbl:'historical label',archived:true};
 const rows={upah:[{id:'active',data:{data:[legacy]}}],wage_entitlements:[entitlement('new_full','2026-10-15','full_day'),entitlement('new_half','2026-10-16','setengah_hari'),entitlement('not_payable','2026-10-17','full_day',{eligible:false})],invoices:[]};
 const original=structuredClone(rows);
 const snapshot=c.validateOwnerSnapshot(rows);
 c.window.applyOwnerSnapshot(snapshot);
 const items=plain(c.UPAH_ITEMS);
 assert.equal(items.find(x=>x.id==='new_full').satuan,'full');
 assert.deepEqual(items,[legacy,{...original.wage_entitlements[0].data,satuan:'full'},original.wage_entitlements[1].data]);
 assert.equal(c.calcTotal(items[1]),100000);
 assert.equal(c.calcTotal(items[2]),50000);
 assert.deepEqual(plain(snapshot.wageEntitlements),original.wage_entitlements.map(x=>x.data));
 assert.deepEqual(plain(snapshot.raw),original);
 assert.deepEqual(rows,original);
 assert.notStrictEqual(snapshot.upah[1],snapshot.wageEntitlements[0]);
 assert.deepEqual(plain(c.window.ownerRenderErrors),[]);
});
