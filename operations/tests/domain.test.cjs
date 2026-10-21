const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const modulePath=path.join(__dirname,'../domain.cjs');
const domain=fs.existsSync(modulePath)?require(modulePath):{};
const sortEvent=()=>({id:'sort-id',batchId:'b',unit:'kg',gross:100,floating:10,kuning:20,hijau:10,hitam:0,mode:'remainder'});
const snapshot=()=>({revision:'r1',batches:[{id:'b',cherry_kg:100}],lots:[],sortEvents:[]});
test('explicit cache contracts survive serialization and reject versions; field counts never use AI or turn missing into zero',()=>{
 assert.equal(typeof domain.cacheEnvelope,'function','cache contract missing');
 for(const name of ['panen','lots','sampling']){const rows=[{id:'synthetic',value:0}];const r=domain.cacheEnvelope(name,name==='sampling'?'1.2':'1.0',rows);assert.equal(r.status,'valid');assert.deepEqual(domain.readCache(name,JSON.stringify(r.envelope)).data,rows);assert.equal(domain.readCache(name,JSON.stringify(rows)).status,'review-required');assert.equal(domain.readCache(name,JSON.stringify({...r.envelope,version:'99'})).status,'review-required');}
 assert.equal(domain.cacheEnvelope('lots','1.0',[]).render,'renderPanenLots');
 assert.equal(domain.readCache('lots','broken').status,'invalid');assert.equal(domain.cacheEnvelope('unknown','1.0',[]).status,'invalid');
 const input={surveyed:100,affected:10,source:'field-count',aiHypothesis:'root disease'};
 const r=domain.fieldIntensity(input);assert.equal(r.status,'measured');assert.equal(r.percent,10);assert.equal(r.hypothesis,'root disease');assert.equal(r.thresholdStatus,'unresolved');
 assert.equal(domain.fieldIntensity({...input,affected:null}).status,'missing');assert.equal(domain.fieldIntensity({...input,affected:0}).percent,0);
 assert.equal(domain.fieldIntensity({...input,surveyed:0}).status,'review-required');assert.equal(domain.fieldIntensity({...input,affected:101}).status,'review-required');assert.equal(domain.fieldIntensity({...input,source:'photo-ai'}).status,'hypothesis-only');
});
test('SOP identity separates years, uses stable activity id and refuses ambiguous legacy migration',()=>{
 assert.equal(typeof domain.sopKey,'function','SOP identity missing');
 assert.notEqual(domain.sopKey(2026,1,'a'),domain.sopKey(2027,1,'a'));
 assert.notEqual(domain.sopKey(2026,1,'a'),domain.sopKey(2026,1,'b'));
 assert.throws(()=>domain.sopKey(2026,13,'a'));assert.throws(()=>domain.sopKey(2026,1,''));
 const legacy={'1-0':{status:'done'}};assert.equal(domain.mapLegacySOP(legacy,[]).status,'review-required');
 const manifest=[{legacyKey:'1-0',year:2026,month:1,activityId:'a'}];const p=domain.mapLegacySOP(legacy,manifest);assert.equal(p.status,'ready');assert.deepEqual(p.legacy,legacy);assert.equal(p.mapped[domain.sopKey(2026,1,'a')].status,'done');
 assert.equal(domain.mapLegacySOP(legacy,[...manifest,...manifest]).status,'review-required');
});
test('linked sampling and stock validation retains raw discrepancies; deletion requires review for references',()=>{
 assert.equal(typeof domain.validateProcess,'function','process validator missing');
 const good={unit:'g',cherry:1000,dried:440,gb:190,kupas:0};const before=JSON.stringify(good);
 assert.equal(domain.validateProcess(good).status,'valid');assert.equal(JSON.stringify(good),before);
 assert.equal(domain.validateProcess({...good,dried:-1}).status,'invalid');
 assert.equal(domain.validateProcess({...good,dried:Infinity}).status,'invalid');
 assert.equal(domain.validateProcess({...good,dried:1500}).status,'review-required');
 assert.equal(domain.validateProcess({...good,dried:null}).status,'incomplete');
 assert.equal(domain.validateProcess({...good,cherry:0}).status,'review-required');
 assert.equal(domain.validateProcess({...good,kupas:1200}).status,'review-required');
 assert.equal(domain.validateProcess({...good,unit:'bags'}).status,'invalid');
 const sessions=[{id:'a',pohon_id:'tree',cherry_gram:1000},{id:'b',pohon_id:'tree',cherry_gram:1000,dried_covered_by:'a'},{id:'c',pohon_id:'other',cherry_gram:1000}];
 assert.equal(domain.validateCoverage(sessions,'a',['b']).status,'valid');
 for(const ids of [['a'],['c'],['missing'],['b','b']])assert.notEqual(domain.validateCoverage(sessions,'a',ids).status,'valid');
 sessions[1].dried_gram=440;assert.equal(domain.validateCoverage(sessions,'a',['b']).status,'review-required');
 const stock=domain.validateStock({unit:'kg',completed:[10,0],withdrawals:[12]});assert.equal(stock.status,'review-required');assert.equal(stock.balance,-2);
 assert.equal(domain.validateStock({unit:'kg',completed:[null],withdrawals:[]}).status,'incomplete');
 assert.equal(domain.validateStock({unit:'kg',completed:[10],withdrawals:[-1]}).status,'invalid');
 assert.equal(domain.validateStock({unit:'kg',completed:[10],withdrawals:[3]}).balance,7);
 assert.equal(domain.deletionGate('b',{lots:[{parent_batch_id:'b'}],drying:[{source_batch_ids:['b']}],sampling:[]}).status,'review-required');
 assert.equal(domain.deletionGate('a',{lots:[],drying:[],sampling:[{id:'b',dried_covered_by:'a'}]}).status,'review-required');
 assert.equal(domain.deletionGate('unused',{lots:[],drying:[],sampling:[]}).status,'unlinked');
 assert.equal(domain.deletionGate('unused',{}).status,'incomplete');
});
test('sort plan is immutable, stable per parent/grade, excludes floating lot; repeat is noop and divergent retry conflicts',()=>{
 assert.equal(typeof domain.planSort,'function','sort planning missing');
 const s=snapshot(),e=sortEvent(),before=JSON.stringify({s,e});
 const p=domain.planSort(s,e,'r1');assert.equal(p.status,'ready');assert.equal(p.expectedRevision,'r1');assert.equal(p.parentPatch.pengapung_kg,10);assert.equal(p.lots.length,3);assert.equal(p.lots.find(l=>l.grade==='merah').kg_sortir_awal,60);assert.equal(JSON.stringify({s,e}),before);
 const same=domain.planSort(s,e,'r1');assert.deepEqual(same.lots,p.lots);
 s.sortEvents.push(p.event);s.lots.push(...p.lots);s.batches[0].has_split=true;
 assert.equal(domain.planSort(s,e,'r1').status,'noop');assert.equal(domain.planSort(s,{...e,hijau:11},'r1').status,'conflict');
 assert.equal(domain.planSort(snapshot(),e,'r0').status,'conflict');
 const legacy=snapshot();legacy.lots.push({lot_id:'legacy',parent_batch_id:'b'});assert.equal(domain.planSort(legacy,e,'r1').status,'review-required');
 assert.equal(domain.planSort(snapshot(),{...e,floating:-1},'r1').status,'invalid');
 assert.equal(domain.planSort(snapshot(),{...e,floating:null},'r1').status,'incomplete');
 assert.equal(domain.planSort(snapshot(),{...e,mode:'measured',merah:70},'r1').status,'review-required');
 assert.equal(domain.planSort(snapshot(),{...e,floating:101},'r1').status,'review-required');
 assert.equal(domain.planSort(snapshot(),{...e,gross:0},'r1').status,'review-required');
});

test('measurement parser requires complete finite nonnegative values and explicit linked units; missing differs from zero',()=>{
 assert.equal(typeof domain.measurement,'function','measurement validation is missing');
 assert.deepEqual(domain.measurement('0','kg','g'),{status:'valid',observed:'0',unit:'kg',value:0,converted:0,targetUnit:'g'});
 assert.equal(domain.measurement('1,25','kg','g').converted,1250);
 assert.equal(domain.measurement('1250','g','kg').converted,1.25);
 for(const raw of [null,undefined,'','  '])assert.equal(domain.measurement(raw,'g','g').status,'missing');
 for(const raw of [-1,NaN,Infinity,'Infinity','12 kg','1.2.3','1,000.5','1e309',true,{},'0x10'])assert.equal(domain.measurement(raw,'kg','g').status,'invalid',String(raw));
 for(const units of [['bag','kg'],['kg','trees'],['trees','kg']])assert.equal(domain.measurement(1,...units).status,'invalid');
 assert.equal(domain.measurement(1.2,'trees','trees').status,'invalid');
 assert.equal(domain.measurement(Number.MAX_VALUE,'kg','g').status,'invalid');
});
