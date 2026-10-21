const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../monitor-v2.html'),'utf8');
const start=html.indexOf('    function blockedWrite()');
const code=html.slice(start,html.indexOf('\n    // ⭐ Publish SOP',start));
const {harness,fixture}=require('./authorized-report-harness.cjs');
const entry=patch=>fixture('staff',{id:'lap_one',...patch});
function sdk(existing,fail=false){const x=harness({role:'staff',existing:existing?.id==='lap_one'?existing:null,failRead:fail});const c={authorizedReports:{send:x.send}};c.navigator={locks:{request:async(_k,fn)=>fn()}};vm.createContext(c);vm.runInContext(code,c);return {c,writes:()=>x.commits,reads:()=>x.reads};}

for(const p of ['cashbook/active','upah/active','sop_status/pohon_cabut','sop_status/compliance','sop_status/kasbon','sop_status/pupuk','sop_master/active','panen_data/active','panen_sampling/active','panen_lots/active','worker_tokens/TEST','worker_defs_custom/active','distribusi_pic/active','milestones/active','opt_observations/active']){
 test('blocked dashboard singleton '+p+' regardless of stale/loaded/failed client',async()=>{for(const state of [null,{revision:42}, {revision:0}]){const h=sdk(state);await assert.rejects(h.c.setDoc({path:p},{data:[{id:'seed'}]}));assert.equal(h.writes(),0);assert.equal(h.reads(),0);}});
}
test('dashboard update and deletion unavailable',async()=>{const h=sdk(null);await assert.rejects(h.c.updateDoc());await assert.rejects(h.c.deleteDoc());assert.equal(h.writes(),0);});
// Former defect-positive ACK assertion is now a regression: preserve remote edits, reject false success.
test('dashboard lost ACK retry preserves edited report and rejects divergent content',async()=>{const h=sdk(entry({detail:'edited'}));await assert.rejects(h.c.setDoc({path:'laporan/one'},entry({detail:'old'})),/conflict/);assert.equal(h.writes(),0);});
test('dashboard read failure fails closed',async()=>{const h=sdk(null,true);await assert.rejects(h.c.setDoc({path:'laporan/one'},entry()));assert.equal(h.writes(),0);});
test('dashboard ID conflict fails closed',async()=>{const h=sdk(entry({created_at:'other'}));await assert.rejects(h.c.setDoc({path:'laporan/one'},entry()));assert.equal(h.writes(),0);});
function queue(){const values=new Map();const events={};const c={window:{addEventListener:()=>{},authorizedReports:{sessionOwner:()=> 'synthetic-owner'}},document:{addEventListener:(type,f)=>{events[type]=f;}},localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);}},console:{warn:()=>{}},alert:()=>{}};c.navigator={locks:{request:async(_k,fn)=>fn()}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../recovery/report-content.js'),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../recovery/entry-recovery.js'),'utf8'),c);return {c,q:c.window.entryRecovery,events};}
test('staff missing SDK retains durable pending',async()=>{const h=queue();h.q.enqueue([entry()]);await h.q.drain();assert.equal(h.q.pending().length,1);});
test('staff wrong ACK retained',async()=>{const h=queue();h.q.enqueue([entry()]);h.c.window.syncLaporanEntryToFirestore=async()=>false;await h.q.drain();assert.equal(h.q.pending().length,1);});
test('staff queue single-flight preserves append during drain',async()=>{const h=queue();let release,calls=0;const gate=new Promise(r=>release=r);h.q.enqueue([entry()]);h.c.window.syncLaporanEntryToFirestore=async e=>{calls++;await gate;return e.id;};const a=h.q.drain(),b=h.q.drain();await new Promise(r=>setImmediate(r));h.q.enqueue([{id:'two',created_at:'t'}]);release();await Promise.all([a,b]);assert.equal(calls,1);assert.equal(h.q.pending()[0].id,'two');});
