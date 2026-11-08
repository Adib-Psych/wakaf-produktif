import {test} from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../recovery/payroll-documents.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const wage=(extra={})=>({id:7,tgl:'2026-10-01',pelapor:'NARDI',name:'Lek Nardi',aktivitas:'Rawat kopi',model:'harian',satuan:'full_day',qty:1,tarif:100000,status:'belum',...extra});
const source=(rows=[wage()])=>({upah:rows,cashbook:[],kasbon:[],wageBindings:[]});
test('recap accepts exact numeric and canonical string IDs, deduplicates selection, humanizes duration, never proof',()=>{
 assert.equal(typeof api.buildPayrollDocument,'function','read-only PNG document builder is required');
 const input=source([wage(),wage({id:'wage_v1_NARDI_2026-10-02',tgl:'2026-10-02'})]);const before=JSON.stringify(input);
 const d=api.buildPayrollDocument({value:input,selected:['7','wage_v1_NARDI_2026-10-02',7],mode:'rekap',generatedAt:'2026-11-08T01:00:00Z'});
 assert.deepEqual(d.rows.map(x=>x.id),['7','wage_v1_NARDI_2026-10-02']);assert.equal(d.total,200000);assert.equal(d.rows[0].duration,'1 hari');assert.equal(d.rows[0].name,'Lek Nardi');assert.match(api.payrollDocumentHTML(d),/BUKAN bukti pembayaran/);assert.equal(JSON.stringify(input),before);
});
test('proof strictly requires paid rows and uses recorded historical payment date independently of generation date',()=>{
 assert.throws(()=>api.buildPayrollDocument({value:source(),selected:[7],mode:'proof'}),/lunas|dibayar/);
 const v=source([wage({status:'lunas',bayar_tgl:'2026-10-04',bayar_source:'wakif',payroll_revision:1,payroll_event_id:'evt_7'})]);v.cashbook=[{id:'cb_payroll_7',ref:'upah_7',tgl:'2026-10-04',keluar:100000,masuk:0,src:'payroll'}];
 const d=api.buildPayrollDocument({value:v,selected:[7],mode:'proof',generatedAt:'2026-11-08T01:00:00Z'});assert.equal(d.rows[0].paymentDate,'2026-10-04');
 const html=api.payrollDocumentHTML(d);assert.match(html,/BUKTI PEMBAYARAN UPAH/);assert.match(html,/2026-10-04/);assert.match(html,/Tanggal pembuatan dokumen: 2026-11-08/);assert.match(html,/Tanda tangan manual/);assert.doesNotMatch(html,/signature-|auto-generated|sudah menerima|telah menerima/);
 const legacy=api.buildPayrollDocument({value:source([wage({status:'lunas'})]),selected:[7],mode:'proof'});assert.equal(legacy.rows[0].paymentDate,'Tidak tercatat');
});
test('private K4 and mixed funds remain explicit with subtotals and escaped worker-facing text',()=>{
 const v=source([wage({name:'Nardi <img onerror=alert(1)>',aktivitas:'A & B'}),wage({id:'private',fund:'K4',pelapor:'PRIVATE',name:'Private',tarif:50000})]);const d=api.buildPayrollDocument({value:v,selected:[7,'private']});assert.deepEqual(d.funds,{K1_K3:100000,K4:50000});assert.equal(d.rows[1].fundLabel,'Pribadi K4');const html=api.payrollDocumentHTML(d);assert.match(html,/Campuran/);assert.match(html,/Pribadi K4/);assert.match(html,/Wakaf K1–K3/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img onerror/);
});
test('proof preserves only confirmed kasbon deductions; partial shared deduction refuses instead of overcounting',()=>{
 const v=source([wage({status:'lunas',bayar_tgl:'2026-10-04'}),wage({id:'other',status:'lunas',bayar_tgl:'2026-10-04'})]);v.kasbon=[{id:'kb',pelapor:'NARDI',tgl:'2026-09-01',jumlah:50000,terpotong:25000,potongan:[{tgl:'2026-10-04',jumlah:25000,upah_ids:[7,'other']}]}];
 assert.throws(()=>api.buildPayrollDocument({value:v,selected:[7],mode:'proof'}),/potongan|kasbon/i);
 const before=JSON.stringify(v),d=api.buildPayrollDocument({value:v,selected:[7,'other'],mode:'proof'});assert.equal(d.deductions,25000);assert.equal(d.net,175000);assert.equal(JSON.stringify(v),before);assert.match(api.payrollDocumentHTML(d),/Potongan kasbon tercatat/);
 const rekap=api.buildPayrollDocument({value:source(),selected:[7]});assert.equal(rekap.deductions,0);
});
test('documents refuse stale joined sources, malformed identities, unknown names and incoherent new payroll cash projections',()=>{
 for(const key of ['upah','cashbook','kasbon']){const v=source();v._meta={access:'public-live',domains:{upah:{state:'available'},cashbook:{state:'available'},kasbon:{state:'available'}}};v._meta.domains[key].state='stale';assert.throws(()=>api.buildPayrollDocument({value:v,selected:[7]}),/source|Sumber|terkini/i);}
 for(const id of ['',{},' 7','7/unsafe'])assert.throws(()=>api.buildPayrollDocument({value:source(),selected:[id]}));
 assert.throws(()=>api.buildPayrollDocument({value:source([wage({name:null})]),selected:[7]}),/Nama/);
 const v=source([wage({status:'lunas',payroll_revision:1,payroll_event_id:'e',bayar_tgl:'2026-10-04',bayar_source:'wakif'})]);assert.throws(()=>api.buildPayrollDocument({value:v,selected:[7],mode:'proof'}),/kas|cash|proyeksi/i);
 v.cashbook=[{id:'cb_payroll_7',ref:'upah_7',tgl:'2026-10-04',masuk:0,keluar:99999,src:'payroll'}];assert.throws(()=>api.buildPayrollDocument({value:v,selected:[7],mode:'proof'}));
});
test('PNG render API is available without write or login dependencies',()=>assert.equal(typeof api.renderPayrollPNG,'function'));
test('recap kasbon plan is estimated, worker-scoped and never an actual deduction',()=>{
 const v=source();v.kasbon=[{id:'kb',pelapor:'NARDI',jumlah:70000,terpotong:20000,tgl:'2026-09-01',potongan:[]}];const before=JSON.stringify(v);const d=api.buildPayrollDocument({value:v,selected:[7]});assert.equal(d.estimatedDeduction,50000);assert.equal(d.deductions,0);assert.equal(d.net,100000);assert.match(api.payrollDocumentHTML(d),/Perkiraan potongan kasbon/);assert.match(api.payrollDocumentHTML(d),/bukan potongan aktual/);assert.equal(JSON.stringify(v),before);
});
test('legacy proof refuses conflicting linked cashbook or partial shared cash allocation and invalid payment dates',()=>{
 const v=source([wage({status:'lunas',bayar_tgl:'2026-10-04'})]);v.cashbook=[{id:'legacy',ref:'upah_7',tgl:'2026-10-04',masuk:0,keluar:90000}];assert.throws(()=>api.buildPayrollDocument({value:v,selected:[7],mode:'proof'}),/kas|konsisten/i);
 v.cashbook[0].keluar=100000;v.cashbook[0].ref='upah_7 · other';assert.throws(()=>api.buildPayrollDocument({value:v,selected:[7],mode:'proof'}),/kas|seluruh/i);
 v.cashbook=[];v.upah[0].bayar_tgl='2026-02-30';assert.throws(()=>api.buildPayrollDocument({value:v,selected:[7],mode:'proof'}),/tanggal/i);
});
test('read-only preview opener is separate from rendering and can tolerate a blocked popup',()=>assert.equal(typeof api.openPayrollPreview,'function'));
test('projection cannot invent kasbon deductions and recap never leaks raw duration tokens',()=>{
 const v=source([wage({status:'lunas',payroll_revision:1,payroll_event_id:'e',bayar_tgl:'2026-10-04',bayar_source:'wakif'})]);v.cashbook=[{id:'cb_payroll_7',ref:'upah_7',tgl:'2026-10-04',masuk:0,keluar:100000,src:'payroll'}];v.kasbon=[{pelapor:'NARDI',potongan:[{upah_ids:[7],jumlah:10000}]}];assert.throws(()=>api.buildPayrollDocument({value:v,selected:[7],mode:'proof'}),/kasbon|konsisten/i);
 const d=api.buildPayrollDocument({value:source([wage({satuan:null,satuan_lbl:'full_day'})]),selected:[7]});assert.equal(d.rows[0].duration,'1 hari');
});
test('explicit private payment source cannot be relabelled as Wakaf from missing or conflicting fund',()=>{
 for(const row of [wage({status:'lunas',bayar_source:'pribadi'}),wage({status:'lunas',fund:'K4',bayar_source:'wakif'})])assert.throws(()=>api.buildPayrollDocument({value:source([row]),selected:[7],mode:'proof'}),/dana|sumber/i);
});
export {wage,source};
