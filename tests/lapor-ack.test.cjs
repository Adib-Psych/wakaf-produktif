// Submitted-content identity regression; synthetic transport, no cloud calls.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(require('node:path').join(__dirname,'../lapor.html'),'utf8');
const {harness:actual,fixture}=require('./authorized-report-harness.cjs');
function harness(){const x=actual({lost:true});const c=vm.createContext({window:{},authorizedReports:{send:x.send}});const line=h.match(/window\.firestorePush = entryData => authorizedReports\.send\(entryData\);/);assert(line);vm.runInContext(line[0],c);const docs={set:(id,b)=>x.seed(b),get:id=>x.record(id),get size(){return x.store.size/2;}};return {push:c.window.firestorePush,docs,get writes(){return x.commits;},pair:x.pair};}
const entry=()=>fixture('worker',{id:'lap_unique',detail:{deskripsi_kerja:'fixture'},_filled_by:{nested:{a:1,b:2}}});
test('real push lost ACK retries same content without duplicate write',async()=>{const s=harness(),e=entry();await assert.rejects(s.push(e),/lost ACK/);assert.equal(await s.push({...e,_filled_by:{nested:{b:2,a:1}}}),e.id);assert.equal(s.writes,1);assert.deepEqual(s.pair(e.id)[0],s.pair(e.id)[1]);});
test('extra remote content cannot be acknowledged or overwritten',async()=>{const s=harness(),e=entry();s.docs.set(e.id,{...e,other:'divergent'});await assert.rejects(s.push(e),/conflict/);assert.equal(s.writes,0);assert.equal(s.docs.get(e.id).other,'divergent');});
test('array order is part of submitted revision',async()=>{const s=harness(),e=entry();s.docs.set(e.id,{...e,photos:[{id:'b',data_url:'b',size_kb:1},{id:'a',data_url:'a',size_kb:1}]});await assert.rejects(s.push(e),/conflict/);assert.equal(s.writes,0);});
test('two legitimate distinct IDs with identical bodies never collapse',async()=>{const s=harness(),a=entry(),b={...a,id:'lap_second'};await assert.rejects(s.push(a),/lost ACK/);await s.push(b);await s.push(a);assert.equal(s.docs.size,2);assert.equal(s.writes,2);});
