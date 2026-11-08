import {test} from 'node:test';
import assert from 'node:assert/strict';
const api=await import('./payroll-contract.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const wage={id:7,pelapor:'TEST_WORKER',tgl:'2026-10-01',model:'harian',satuan:'full',qty:1,tarif:100000,status:'belum'};
const stamp={serverTimestamp:true};
const input=(extra={})=>({wage,previous:null,status:'lunas',paidDate:'2026-10-02',source:'wakif',reason:'',eventId:'pay_aaaaaaaaaaaaaaaaaaaa',uid:'approved',stamp,...extra});
test('first paid status records original wage unchanged without creating money',()=>{
 assert.equal(typeof api.buildPayrollState,'function','payroll builder must exist');
 const state=api.buildPayrollState(input());
 assert.deepEqual(state,{wage_id:'7',wage,revision:1,predecessor:null,event_id:input().eventId,status:'lunas',paid_date:'2026-10-02',source:'wakif',reason:'',owner_uid:'approved',committed_at:stamp});
 assert.notEqual(state.wage,wage);assert.deepEqual(wage,input().wage);
});
test('status transitions link one predecessor and require meaningful cancellation reason',()=>{
 const paid=api.buildPayrollState(input());
 assert.throws(()=>api.buildPayrollState(input({previous:paid,eventId:'pay_new'})),/transition/);
 for(const reason of ['', '   '])assert.throws(()=>api.buildPayrollState(input({previous:paid,status:'belum',paidDate:null,source:null,reason,eventId:'pay_bbbbbbbbbbbbbbbbbbbb'})),/reason/);
 const cancelled=api.buildPayrollState(input({previous:paid,status:'belum',paidDate:null,source:null,reason:'Recorded incorrectly',eventId:'pay_bbbbbbbbbbbbbbbbbbbb'}));
 assert.equal(cancelled.revision,2);assert.equal(cancelled.predecessor,paid.event_id);
 const repaid=api.buildPayrollState(input({previous:cancelled,eventId:'pay_cccccccccccccccccccc',source:'wakif'}));assert.equal(repaid.revision,3);
 assert.throws(()=>api.buildPayrollState(input({status:'belum',paidDate:null,source:null,reason:'cancel'})),/transition/);
 assert.throws(()=>api.buildPayrollState(input({wage:{...wage,status:'lunas'},status:'belum',paidDate:null,source:null,reason:'cancel'})),/original|legacy|transition/);
});
for(const [label,extra] of Object.entries({
 'invalid date':{paidDate:'2026-02-30'},'future date':{paidDate:'2999-01-01'},'noncalendar date':{paidDate:'2026-2-02'},'unknown source':{source:'bank'},'missing event':{eventId:''},'unsafe event':{eventId:'a/b'},'missing uid':{uid:''},'missing stamp':{stamp:null},'void wage':{wage:{...wage,voided_duplicate:true}},'nonpositive tariff':{wage:{...wage,tarif:0}},'string amount':{wage:{...wage,qty:'1'}},'ineligible':{wage:{...wage,eligible:false}},'payment metadata':{wage:{...wage,bayar_tgl:null}},'wage tamper':{previous:{wage:{...wage,tarif:50000},revision:1,event_id:'pay_old',status:'belum'}}
}))test('builder rejects '+label,()=>assert.throws(()=>api.buildPayrollState(input(extra))));
test('projection overlays paid status and derives a single deterministic cash row, never mutates originals',()=>{
 const state=api.buildPayrollState(input()),base=[{id:'old',keluar:13,ref:'unrelated'}],old=structuredClone({wage,base});
 assert.equal(typeof api.projectPayroll,'function');
 const result=api.projectPayroll({upah:[wage],cashbook:base,states:[state]});
 assert.equal(result.upah[0].status,'lunas');assert.equal(result.upah[0].bayar_tgl,'2026-10-02');assert.equal(result.upah[0].bayar_source,'wakif');assert.equal(result.upah[0].payroll_revision,1);
 assert.deepEqual(result.cashbook[0],base[0]);assert.equal(result.cashbook[1].id,'cb_payroll_7');assert.equal(result.cashbook[1].ref,'upah_7');assert.equal(result.cashbook[1].keluar,100000);assert.equal(result.cashbook[1].masuk,0);assert.equal(result.cashbook[1].tipe,'bayar_upah');
 assert.deepEqual({wage,base},old);assert.deepEqual(api.projectPayroll({upah:[wage],cashbook:base,states:[state]}),result);
 const cancelled=api.buildPayrollState(input({previous:state,status:'belum',paidDate:null,source:null,reason:'mistake',eventId:'pay_cancel'}));assert.deepEqual(api.projectPayroll({upah:[wage],cashbook:base,states:[cancelled]}).cashbook,base);
});
test('canonical full_day source remains exact while projection uses UI full',()=>{const canonical={...wage,id:'wage_new',satuan:'full_day',eligible:true};const state=api.buildPayrollState(input({wage:canonical,source:'wakif'}));const result=api.projectPayroll({upah:[canonical],cashbook:[],states:[state]});assert.equal(result.upah[0].satuan,'full');assert.equal(state.wage.satuan,'full_day');assert.equal(result.cashbook[0].tipe,'bayar_upah');});
for(const cash of [[{ref:'upah_7'}],[{ref:'upah_3·7·9'}],[{id:'cb_payroll_7'}],[{id:'cb_upah_test_worker_123'}]])test('projection fails closed for existing cash '+JSON.stringify(cash),()=>assert.throws(()=>api.projectPayroll({upah:[wage],cashbook:cash,states:[api.buildPayrollState(input())]}),/cash|linked/));
for(const [label,upah,states]of [['unknown',[],[api.buildPayrollState(input())]],['duplicate',[wage],[api.buildPayrollState(input()),api.buildPayrollState(input())]],['tampered',[{...wage,tarif:50}],[api.buildPayrollState(input())]]])test('projection rejects '+label,()=>assert.throws(()=>api.projectPayroll({upah,cashbook:[],states})));
test('previous event cannot be reused',()=>{const paid=api.buildPayrollState(input());assert.throws(()=>api.buildPayrollState(input({previous:paid,eventId:paid.event_id,status:'belum',paidDate:null,source:null,reason:'mistake'})),/event/);});
test('projection accepts only the canonical full_day UI display alias',()=>{const w={...wage,id:'canonical',satuan:'full_day',eligible:true},s=api.buildPayrollState(input({wage:w}));assert.equal(api.projectPayroll({upah:[{...w,satuan:'full'}],cashbook:[],states:[s]}).upah[0].satuan,'full');assert.throws(()=>api.projectPayroll({upah:[{...w,satuan:'full',tarif:123}],cashbook:[],states:[s]}));});
for(const [label,extra]of Object.entries({'extra key':{amount:12},'bad predecessor':{predecessor:'unexpected'},'missing predecessor':{revision:2,predecessor:null},'empty reason':{revision:2,predecessor:'old',status:'belum',paid_date:null,source:null,reason:''}}))test('projection rejects malformed '+label,()=>assert.throws(()=>api.projectPayroll({upah:[wage],cashbook:[],states:[{...api.buildPayrollState(input()),...extra}]})));
test('builder admits same WIB business day while UTC is still previous day',t=>{t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-08T18:00:00Z')});assert.equal(api.buildPayrollState(input({paidDate:'2026-11-09'})).paid_date,'2026-11-09');assert.throws(()=>api.buildPayrollState(input({paidDate:'2026-11-10'})));});
test('projection preserves typed source identity instead of numeric-string coercion',()=>{const s=api.buildPayrollState(input());assert.throws(()=>api.projectPayroll({upah:[{...wage,id:'7'}],cashbook:[],states:[s]}),/altered/);});
test('Anto source and K4 wages remain HOLD',()=>{assert.throws(()=>api.buildPayrollState(input({source:'anto'})));assert.throws(()=>api.buildPayrollState(input({wage:{...wage,fund:'K4'}})));assert.throws(()=>api.projectPayroll({upah:[wage],cashbook:[],states:[{...api.buildPayrollState(input()),source:'anto'}]}));});
