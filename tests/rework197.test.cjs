'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../monitor-v2.html','utf8');
function extract(name){const i=html.indexOf('function '+name+'(');assert.ok(i>=0);return html.slice(i,html.indexOf('\n}',i)+2);}
function sortContext(kind,raw,field=0){
 const keys=kind===5?['sortir5-mengambang','sortir5-kuning','sortir5-hijau','sortir5-hitam']:['dlg-sortir4-merah','dlg-sortir4-kuning','dlg-sortir4-hijau','dlg-sortir4-hitam'];
 const values=Object.fromEntries(keys.map((k,i)=>[k,(kind===5?['10','20','10','0']:['60','20','10','0'])[i]]));
 values[keys[field]]=raw;values['sortir5-batch-select']='b';values['dlg-sortir4-batch-id']='b';values['sortir5-catatan']='SYNTH';
 let writes=0,alerts=0;
 const cache={untouched:'SYNTH'};
 const c=vm.createContext({Date,console,alert(){alerts++;},confirm:()=>true,document:{getElementById:id=>({value:values[id]})},PANEN_DATA:[{id:'b',tgl:'2000-01-01',kebun:['1'],cherry_kg:100,pengapung_kg:10}],PANEN_LOTS_DATA:[],PANEN_GRADES:{merah:{},kuning:{},hijau:{},hitam:{}},todayIso:()=> '2000-01-01',savePanenToLS(){writes++;cache.batch='changed';},savePanenLotsToLS(){writes++;cache.lots='changed';},resetSortir5Form(){},renderPanen(){},populateSortir5BatchDropdown(){},closePanenSortir4Dialog(){}});
 const name=kind===5?'submitSortir5Warna':'submitPanenSortir4';vm.runInContext(extract(name),c);
 return {c,submit:()=>c[name](),writes:()=>writes,alerts:()=>alerts,cache,snapshot:()=>JSON.stringify({batch:c.PANEN_DATA,lots:c.PANEN_LOTS_DATA,cache})};
}
for(const kind of [4,5]){
 test('assembled sort'+kind+' rejects missing/junk in EVERY measured bucket without mutation/save/cache',()=>{
  for(const raw of ['', ' ', 'oops','10abc','-1','Infinity','NaN','1e309','0x10','1,2'])for(let field=0;field<4;field++){
   const f=sortContext(kind,raw,field),before=f.snapshot();f.submit();assert.equal(f.snapshot(),before,`${kind}/${field}/${raw}`);assert.equal(f.writes(),0);assert.ok(f.alerts()>0);
  }
 });
 test('assembled sort'+kind+' accepts explicit zero, decimal and preserves raw provenance; retry cannot duplicate',()=>{
  const f=sortContext(kind,kind===5?'10.00':'60.00');f.submit();assert.equal(f.writes(),2);assert.equal(f.c.PANEN_LOTS_DATA.length,3);assert.ok(f.c.PANEN_DATA[0].has_split);assert.equal(f.c.PANEN_DATA[0].sortir_measurements_raw.unit,'kg');assert.equal(Object.values(f.c.PANEN_DATA[0].sortir_measurements_raw.readings)[0],kind===5?'10.00':'60.00');const before=f.snapshot();f.submit();assert.equal(f.snapshot(),before);assert.equal(f.writes(),2);
 });
}
test('assembled sort5 explicit zero floating accepted only after confirmation, distinct from missing',()=>{const f=sortContext(5,'0');f.submit();assert.equal(f.writes(),2);assert.equal(f.c.PANEN_DATA[0].pengapung_kg,0);});
test('assembled final sampling rejects partial gram parser inputs before mutation/save',()=>{
 for(const raw of ['', 'oops', '10abc','1,2abc','1.2','1,2,3','Infinity','-1']){
  let writes=0;const c=vm.createContext({SAMPLING_POHON_BASELINE:[],PANEN_SAMPLING_DATA:[],document:{getElementById:id=>({value:id==='final-dried-input'?raw:'0'})},aggregateSamplingPerPohon:()=>({total_gram:1000}),alert(){},confirm:()=>true,savePanenSamplingToLS(){writes++;},renderPanenSampling(){},privateViewLater(){},setTimeout(){}});
  vm.runInContext(extract('parseGramInput')+'\n'+extract('saveSamplingFinal'),c);const before=JSON.stringify(c.PANEN_SAMPLING_DATA);c.saveSamplingFinal('tree');assert.equal(JSON.stringify(c.PANEN_SAMPLING_DATA),before,raw);assert.equal(writes,0);
 }
});
test('assembled final sampling accepts Indonesian gram conventions and explicit zero, retry updates same marker',()=>{
 for(const [dried,gb,expected] of [['1,345','400',1345],['1.345','400',1345],['0','0',0]]){
  let writes=0;const c=vm.createContext({Date,SAMPLING_POHON_BASELINE:[{id:'tree',kebun:'1'}],PANEN_SAMPLING_DATA:[],document:{getElementById:id=>({value:id==='final-dried-input'?dried:gb})},aggregateSamplingPerPohon:()=>({total_gram:2000}),alert(){},confirm:()=>true,savePanenSamplingToLS(){writes++;},renderPanenSampling(){},privateViewLater(){},setTimeout(){}});
  vm.runInContext(extract('parseGramInput')+'\n'+extract('saveSamplingFinal'),c);c.saveSamplingFinal('tree');assert.equal(writes,1);assert.equal(c.PANEN_SAMPLING_DATA[0].dried_final_gram,expected);assert.equal(c.PANEN_SAMPLING_DATA[0].final_measurements_raw.readings[0],dried);c.saveSamplingFinal('tree');assert.equal(c.PANEN_SAMPLING_DATA.length,1);assert.equal(writes,2);
 }
});
test('sort5 cancelled zero confirmation cannot mutate or save',()=>{const f=sortContext(5,'0');f.c.confirm=()=>false;const before=f.snapshot();f.submit();assert.equal(f.snapshot(),before);assert.equal(f.writes(),0);});
const domain=require('../finance/finance-domain.cjs');
function state(){return {revision:0,upah:[{id:'w1',pelapor:'SYNTH',fund:'K1-3',gross:10,status:'belum'}],kasbon:[],cashbook:[],payments:[],events:[],commands:[]};}
const cmd={kind:'pay',command_id:'c1',payment_id:'p1',upah_ids:['w1'],fund:'K1-3',date:'2026-01-20',at:'2026-01-20T00:00:00Z',actor:'SYNTH',source:'synthetic',apply_kasbon:false};
test('cash ID collision rejects active/reversed/unrelated legacy row without rewriting it',()=>{for(const status of ['active','reversed',undefined]){const s=state();s.cashbook=[{id:'cash:p1',ref:'unrelated',keluar:1,fund:'K1-3',status}];const before=structuredClone(s);assert.throws(()=>domain.transition(s,cmd),/cash identity/);assert.deepEqual(s,before);}});
test('execute cash ID collision never writes or commits and preserves legacy state',async()=>{const s=state();s.cashbook=[{id:'cash:p1',ref:'unrelated'}];const before=structuredClone(s);let writes=0,commits=0;const store={transaction:async fn=>{const out=await fn({read:async()=>s,write:async()=>{writes++;}});commits++;return out;}};await assert.rejects(domain.execute(store,cmd,0),/cash identity/);assert.equal(writes,0);assert.equal(commits,0);assert.deepEqual(s,before);});
test('execute valid payment/retry/reversal remains usable with noncolliding legacy row',async()=>{let s=state(),writes=0;s.cashbook=[{id:'legacy-other',ref:'unrelated'}];const store={transaction:async fn=>fn({read:async()=>s,write:async next=>{writes++;s=next;}})};const paid=await domain.execute(store,cmd,0);assert.equal(writes,1);assert.equal(new Set(paid.cashbook.map(c=>c.id)).size,2);assert.deepEqual(await domain.execute(store,cmd,0),paid);assert.equal(writes,1);const reversed=await domain.execute(store,{kind:'reverse',command_id:'r1',payment_id:'p1',fund:'K1-3',date:'2026-01-21',at:'2026-01-21T00:00:00Z',actor:'SYNTH',reason:'synthetic'},1);assert.equal(writes,2);assert.equal(reversed.cashbook[1].status,'reversed');assert.equal(reversed.upah[0].status,'belum');});
