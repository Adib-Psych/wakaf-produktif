const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('monitor-v2.html','utf8');
function extract(name){const start=html.indexOf('function '+name+'(');assert.ok(start>=0);return html.slice(start,html.indexOf('\n}',start)+2);}
test('INTEGRATED valid measured sort then repeat preserves exactly one parent/grade allocation',()=>{
 const values={'dlg-sortir4-batch-id':'b','dlg-sortir4-merah':'60','dlg-sortir4-kuning':'20','dlg-sortir4-hijau':'10','dlg-sortir4-hitam':'0'};
 const c=vm.createContext({console,Date,alert(){},confirm:()=>true,document:{getElementById:id=>({value:values[id]})},PANEN_DATA:[{id:'b',tgl:'2000-01-01',kebun:['1'],cherry_kg:100,pengapung_kg:10}],PANEN_LOTS_DATA:[],PANEN_GRADES:{merah:{},kuning:{},hijau:{}},todayIso:()=> '2000-01-01',savePanenToLS(){},savePanenLotsToLS(){},closePanenSortir4Dialog(){},renderPanen(){}});
 vm.runInContext(extract('submitPanenSortir4'),c);c.submitPanenSortir4();assert.equal(c.PANEN_LOTS_DATA.length,3);const before=JSON.stringify({b:c.PANEN_DATA,l:c.PANEN_LOTS_DATA});c.submitPanenSortir4();assert.equal(JSON.stringify({b:c.PANEN_DATA,l:c.PANEN_LOTS_DATA}),before);
});
test('INTEGRATED linked lot prevents permanent removal without altering drying references',()=>{
 const c=vm.createContext({alert(){},confirm:()=>true,PANEN_DATA:[{id:'b'}],PANEN_LOTS_DATA:[{lot_id:'lot',parent_batch_id:'b'}],PANEN_JEMUR_DATA:[{source_batch_ids:['lot']}],savePanenToLS(){assert.fail('deleted parent');},savePanenLotsToLS(){assert.fail('deleted lot');},renderPanen(){},renderPanenLots(){}});vm.runInContext(extract('deletePanenLot')+'\n'+extract('deletePanenEntry'),c);c.deletePanenLot('lot');c.deletePanenEntry('b');assert.equal(c.PANEN_DATA.length,1);assert.equal(c.PANEN_LOTS_DATA.length,1);
});
