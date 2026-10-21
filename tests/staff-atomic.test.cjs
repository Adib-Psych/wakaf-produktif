const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
test('staff serialized queue append and ACK mutation use same browser lock',async()=>{
 const records=new Map();let tail=Promise.resolve(),locks=0;const navigator={locks:{request:(_n,fn)=>{locks++;const p=tail.then(fn);tail=p.catch(()=>{});return p;}}};
 const c={console,JSON,Set,Object,navigator,window:{addEventListener(){},authorizedReports:{sessionOwner:()=> 'A',sessionTicket:()=>({uid:'A',generation:1}),sessionMatches:()=>true}},document:{addEventListener(){}},localStorage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}};vm.createContext(c);for(const n of ['report-content.js','entry-recovery.js'])vm.runInContext(fs.readFileSync('recovery/'+n,'utf8'),c);
 assert.equal(typeof c.window.entryRecovery.enqueueAtomic,'function');await Promise.all([c.window.entryRecovery.enqueueAtomic([{id:'lap_a',created_at:'2000'}]),c.window.entryRecovery.enqueueAtomic([{id:'lap_b',created_at:'2000'}])]);assert.equal(c.window.entryRecovery.pending().length,2);assert.equal(locks,2);
 c.window.syncLaporanEntryToFirestore=async b=>b.id;await c.window.entryRecovery.drain();assert.equal(c.window.entryRecovery.pending().length,0);assert(locks>=4);
});
