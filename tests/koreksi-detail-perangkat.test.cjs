'use strict';
// ADR-054 (keluhan #48): pembaca menerima rantai koreksi detail pada laporan yang hanya ada di jalur perangkat,
// dan menolak apa pun yang mengubah kolom selain `detail`. Data sintetis saja.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=name=>fs.readFileSync(path.join(root,'recovery',name),'utf8').replace(/^import .*;\s*$/gm,'').replace(/export /g,'');
async function load(){
 const {projectPayroll}=await import('../recovery/payroll-contract.mjs');
 const c={projectPayroll,structuredClone,setTimeout,clearTimeout,Date,console,window:{normalizeOwnerReport:x=>x}};c.globalThis=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync(root+'/recovery/report-content.js','utf8'),c);
 for(const [f,g] of [['authorized-reports.js','globalThis.validReportBody=validReportBody;'],['versioned-operations.js','globalThis.validOperation=validOperation;'],['owner-report-authority.js','globalThis.authority=authority;'],['owner-dashboard.js','globalThis.validateOwnerSnapshot=validateOwnerSnapshot;globalThis.OWNER_READ_COLLECTIONS=OWNER_READ_COLLECTIONS;globalThis.wageActivityMap=wageActivityMap;']])vm.runInContext('{'+source(f)+';'+g+'}',c);
 vm.runInContext('{'+source('public-reader.js')+';globalThis.api={createPublicReader};}',c);
 return c;
}
const row=(id,data)=>({id,data});
const empty={cashbook:[row('active',{data:[]})],payroll_states:[],payroll_events:[]};
function setup(over={}){
 const {fixture}=require('./authorized-report-harness.cjs');
 const body=fixture('staff',{detail:'Menggali lubang. Durasi 1/2 hari dikonfirmasi; dicatat Hermes. Nilai 0 bawaan formulir bukan pengukuran.'});
 const original={contract_version:1,report_id:body.id,command_id:body.id,writer_epoch:3,roster_version:'r-1',submitted_body:body,owner_uid:'synthetic-device-owner',committed_revision:1,committed_at:'2026-11-11T00:50:53.980836000Z'};
 const corrected={...body,detail:'Menggali lubang pada titik yang sudah dipatok.',...(over.body||{})};
 const cid='cmd_detail_synthetic_r2';
 const operation={kind:'device_detail',command_id:cid,target:body.id,expected_revision:1,predecessor:body.id,reason:'Catatan audit dipindah dari detail.',body:corrected,...(over.operation||{})};
 const event={operation,owner_uid:'synthetic-device-owner',writer_epoch:3,roster_version:'r-1',revision:2,committed_at:'2026-11-11T02:00:00.000000000Z',...(over.event||{})};
 const rows={device_reports:[row(body.id,original)],device_receipts:[row(body.id,original)],report_heads:[row(body.id,{revision:2,command_id:cid,owner_uid:'synthetic-device-owner',body:corrected})],operation_events:[row(cid,event)],operation_receipts:[row(cid,event)]};
 if(over.noEvent){rows.operation_events=[];rows.operation_receipts=[];}
 return {body,corrected,rows};
}
async function read(rows){const c=await load();return c.api.createPublicReader({readCollection:async n=>rows[n]||empty[n]||[]}).read();}

test('laporan perangkat saja: rantai koreksi detail diterima, hanya detail yang berubah',async()=>{
 const {body,corrected,rows}=setup();const v=await read(rows);
 assert.equal(v._meta.domains.reports.state,'available');assert.equal(v.reports.length,1);
 const r=v.reports[0];assert.equal(r.detail,corrected.detail);assert.equal(r._provenance.integrity,'paired-detail-correction-chain');
 for(const k of ['tanggal','pelapor','durasi','kategori','kebun_list','pohon'])assert.deepEqual(r[k],body[k]);
});

test('tanpa koreksi, laporan perangkat tampil apa adanya',async()=>{
 const {body,rows}=setup();rows.report_heads=[];rows.operation_events=[];rows.operation_receipts=[];
 const v=await read(rows);assert.equal(v.reports[0].detail,body.detail);assert.equal(v.reports[0]._provenance.integrity,'paired-original');
});

for(const [nama,over] of [
 ['mengubah durasi',{body:{durasi:'full_day'}}],
 ['mengubah tanggal',{body:{tanggal:'2026-10-01',tgl:'2026-10-01'}}],
 ['tanpa event/kwitansi',{noEvent:true}],
 ['jenis operasi staf',{operation:{kind:'correction'}}],
 ['epoch penulis berbeda',{event:{writer_epoch:4}}],
 ['detail kosong',{body:{detail:'   '}}],
])test('ditolak: '+nama,async()=>{
 const {rows}=setup(over);const v=await read(rows);
 assert.equal(v.reports.length,0);assert.equal(v._meta.domains.reports.rejected,1);assert.equal(v._meta.domains.reports.state,'partial');
});

test('kolom aktivitas Upah memakai detail ringkas',async()=>{
 const {body,corrected,rows}=setup();const v=await read(rows);
 const c=await load();const map=c.wageActivityMap([{id:'w1',sources:[{report_id:body.id}]}],v.reports);
 assert.ok(map.w1.endsWith(' — '+corrected.detail));assert.ok(!map.w1.includes('Hermes'));
});
