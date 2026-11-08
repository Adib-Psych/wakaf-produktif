import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPayrollDocument} from '../recovery/payroll-documents.mjs';
const wage=(id,worker,extra={})=>({id,pelapor:worker,name:worker,tgl:'2026-10-01',bayar_tgl:'2026-10-04',status:'lunas',qty:1,tarif:100000,...extra});
const cash=(id,amount,extra={})=>({id:'legacy_'+id,ref:'upah_'+id,tgl:'2026-10-04',masuk:0,keluar:amount,...extra});
const advance=(extra={})=>({id:'kb',pelapor:'A',jumlah:50000,terpotong:50000,potongan:[{tgl:'2026-10-04',jumlah:50000,upah_ids:['a']}],...extra});
const proof=(upah,cashbook,kasbon=[])=>buildPayrollDocument({value:{upah,cashbook,kasbon},selected:upah.map(x=>x.id),mode:'proof'});
test('IR-001 refuses compensating cash across workers, funds and independent cash groups',()=>{
 for(const b of [wage('b','B'),wage('b','A'),wage('b','A',{fund:'K4',bayar_source:'pribadi'})])assert.throws(()=>proof([wage('a','A'),b],[cash('a',0),cash('b',200000,b.fund?{fund:b.fund}:{})]));
 assert.throws(()=>proof([wage('a','A'),wage('b','B')],[cash('a',50000)],[advance({pelapor:'B',potongan:[{tgl:'2026-10-04',jumlah:50000,upah_ids:['b']}]})]));
 assert.throws(()=>proof([wage('a','A'),wage('b','B',{tarif:1000000})],[cash('a',0),cash('b',950000)],[advance({jumlah:150000,terpotong:150000,potongan:[{tgl:'2026-10-04',jumlah:150000,upah_ids:['a']}]})]));
});
test('IR-002 refuses invalid dates, payment-date mismatch and contradictory parent advance',()=>{
 for(const tgl of ['2026-02-30','2026-10-09'])assert.throws(()=>proof([wage('a','A')],[cash('a',50000)],[advance({potongan:[{tgl,jumlah:50000,upah_ids:['a']}]})]));
 for(const extra of [{jumlah:10000,terpotong:0},{jumlah:50000,terpotong:0},{jumlah:50000,terpotong:undefined}])assert.throws(()=>proof([wage('a','A')],[cash('a',50000)],[advance(extra)]));
});
test('coherent worker-group and separate funding net allocations remain available',()=>{
 const d=proof([wage('a','A'),wage('b','B',{fund:'K4',bayar_source:'pribadi'})],[cash('a',50000),cash('b',100000,{fund:'K4'})],[advance()]);assert.equal(d.net,150000);
 const grouped=proof([wage('a','A'),wage('b','A')],[cash('a · b',150000)],[advance({potongan:[{tgl:'2026-10-04',jumlah:50000,upah_ids:['a','b']}]})]);assert.equal(grouped.net,150000);
});
