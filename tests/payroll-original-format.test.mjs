import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPayrollDocument,payrollDocumentHTML} from '../recovery/payroll-documents.mjs';
const value={upah:[{id:7,tgl:'2026-10-20',pelapor:'NARDI',name:'Lek Nardi',aktivitas:'Rawat kopi',model:'harian',satuan:'setengah_hari',qty:1,tarif:50000,status:'belum'}],cashbook:[],kasbon:[]};
test('restores sourced July dual-mode letterhead, frame, info grid, fixed columns, terbilang and terms instead of simplified redesign',()=>{
 for(const mode of ['rekap','proof']){
  const v=structuredClone(value);if(mode==='proof')Object.assign(v.upah[0],{status:'lunas',bayar_tgl:'2026-11-08'});
  const html=payrollDocumentHTML(buildPayrollDocument({value:v,selected:[7],mode,generatedAt:'2026-11-09T02:00:00Z'}));
  for(const part of ['box-sizing:content-box','inset 0 0 0 2px #e4d9df','height:108px','— DOKUMEN RESMI —','border-top:2px dashed #e4d9df','grid-template-columns:1fr 1fr 1fr','width:200px','width:130px','NO &amp; TANGGAL','AKTIVITAS','SUBTOTAL','— TERBILANG —','Lima Puluh Ribu Rupiah','background:#ece7e9','background:#f5f2f3','background:#30282b'])assert.ok(html.includes(part),`missing original template / selected C palette anchor: ${part}`);
  if(mode==='rekap'){assert.match(html,/BELUM DIBAYAR/);assert.match(html,/dikumpulkan dulu/);}
  else {assert.match(html,/Barakallahu fiikum/);assert.match(html,/Hormat kami/);assert.match(html,/Penerima,/);assert.match(html,/Tanda tangan manual/);assert.doesNotMatch(html,/signature-|auto-generated|sudah menerima|telah menerima/);}
 }
});

test('paid and mixed recap restores old contract, accurate statuses, confirmation, unpaid-only estimated deductions',()=>{
 const v=structuredClone(value);Object.assign(v.upah[0],{status:'lunas',bayar_tgl:'2026-11-08',payroll_revision:1,payroll_event_id:'evt',bayar_source:'wakif'});
 v.cashbook=[{id:'cb_payroll_7',ref:'upah_7',tgl:'2026-11-08',keluar:50000,masuk:0,src:'payroll'}];
 v.kasbon=[{pelapor:'NARDI',jumlah:80000,terpotong:0,potongan:[]}];const before=JSON.stringify(v);
 const paid=buildPayrollDocument({value:v,selected:[7]});assert.equal(paid.estimatedDeduction,0);assert.equal(paid.rows[0].status,'lunas');
 let html=payrollDocumentHTML(paid);assert.match(html,/Semua item lunas/);assert.doesNotMatch(html,/BELUM DIBAYAR|Menunggu pembayaran/);assert.match(html,/bukan permintaan bayar ulang/);
 v.upah.push({...value.upah[0],id:'unpaid',fund:'K4'});
 const mixed=buildPayrollDocument({value:v,selected:[7,'unpaid']});assert.equal(mixed.estimatedDeduction,50000);html=payrollDocumentHTML(mixed);
 assert.match(html,/1 lunas · 1 belum dibayar/);assert.doesNotMatch(html,/BELUM DIBAYAR/);assert.match(html,/Lunas/);assert.match(html,/Belum dibayar/);
 assert.equal(JSON.stringify({...v,upah:[v.upah[0]]}),before);assert.throws(()=>buildPayrollDocument({value:v,selected:['unpaid'],mode:'proof'}),/lunas/);
});
test('paid recap confirmation required at the source-bound wrapper, cancel never renders',async()=>{
 const {readFile}=await import('node:fs/promises');const source=await readFile(new URL('../recovery/restored-dashboard.js',import.meta.url),'utf8');
 assert.match(source,/d\.mode==='rekap'[\s\S]{0,200}r\.status==='lunas'/);
 assert.match(source,/confirm\([\s\S]{0,600}return/);
 assert.ok(source.indexOf('confirm(',source.indexOf('const d=buildPayrollDocument'))<source.indexOf('await renderPayrollPNG(d'));
});
test('paid recap share text and deduction detail stay factual rather than all-unpaid copy',async()=>{
 const {readFile}=await import('node:fs/promises');const source=await readFile(new URL('../recovery/payroll-documents.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/Rekapan hak upah belum dibayar — BUKAN/);
 const v=structuredClone(value);Object.assign(v.upah[0],{status:'lunas',bayar_tgl:'2026-11-08'});
 v.kasbon=[{pelapor:'NARDI',tgl:'2026-09-20',keperluan:'Keperluan <keluarga>',jumlah:20000,terpotong:20000,potongan:[{tgl:'2026-11-08',jumlah:20000,upah_ids:[7]}]}];
 const d=buildPayrollDocument({value:v,selected:[7],mode:'proof'});const html=payrollDocumentHTML(d);
 assert.match(html,/20 Sep 2026/);assert.match(html,/Keperluan &lt;keluarga&gt;/);assert.equal(d.deductionDetails[0].jumlah,20000);
});
test('original worker/date/document identifier convention remains in PNG filename and letterhead',()=>{
 const d=buildPayrollDocument({value:structuredClone(value),selected:[7],generatedAt:'2026-11-09T02:00:00Z'});
 assert.match(d.filename,/^REKAP-NGT-20261109-NARDI-[0-9]{4}\.png$/);assert.match(payrollDocumentHTML(d),new RegExp(d.filename.slice(0,-4)));
});
test('payment dates use original info grid once for uniform dates, per-row dates only when needed',()=>{
 const v=structuredClone(value);Object.assign(v.upah[0],{status:'lunas',bayar_tgl:'2026-11-08'});
 let html=payrollDocumentHTML(buildPayrollDocument({value:v,selected:[7],mode:'proof'}));assert.match(html,/TANGGAL BAYAR TERCATAT/);assert.doesNotMatch(html,/<br>Tanggal bayar:/);
 v.upah.push({...v.upah[0],id:8,bayar_tgl:'2026-11-07'});html=payrollDocumentHTML(buildPayrollDocument({value:v,selected:[7,8],mode:'proof'}));assert.match(html,/<br>Tanggal bayar: 2026-11-07/);assert.match(html,/<br>Tanggal bayar: 2026-11-08/);
});
test('mixed recap distinguishes outstanding wages from total and estimates only unpaid net',()=>{
 const v=structuredClone(value);v.upah.push({...v.upah[0],id:8,status:'lunas',bayar_tgl:'2026-11-08'});v.kasbon=[{pelapor:'NARDI',jumlah:20000,terpotong:0}];
 const d=buildPayrollDocument({value:v,selected:[7,8]});assert.equal(d.total,100000);assert.equal(d.estimatedDeduction,20000);
 const html=payrollDocumentHTML(d);assert.match(html,/Belum dibayar: Rp 50.000/);assert.match(html,/Lunas: Rp 50.000/);assert.match(html,/Rp 30.000/);
});
test('daily wage quantity multipliers remain visible for accepted non-unit quantities',()=>{
 for(const qty of [0.5,2])for(const mode of ['rekap','proof']){
  const v=structuredClone(value);Object.assign(v.upah[0],{qty,tarif:100000,satuan:'full day',...(mode==='proof'?{status:'lunas',bayar_tgl:'2026-11-08'}:{})});
  const d=buildPayrollDocument({value:v,selected:[7],mode});const html=payrollDocumentHTML(d);
  assert.match(html,new RegExp(`${qty}× 1 hari`));assert.equal(d.total,qty*100000);
 }
});
export {value};
