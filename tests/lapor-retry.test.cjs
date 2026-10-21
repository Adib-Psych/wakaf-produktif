const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(require('node:path').join(__dirname,'../lapor.html'),'utf8');
const {harness,fixture}=require('./authorized-report-harness.cjs');
const body=h.match(/window\.firestorePush = entryData => authorizedReports\.send\(entryData\);/)[0];
const entry=patch=>fixture('worker',{id:'lap_one',...patch});
function setup(existing){const x=harness({existing});const context={window:{},authorizedReports:{send:x.send}};vm.createContext(context);vm.runInContext(body,context);return {push:context.window.firestorePush,writes:()=>x.commits};}
test('worker retry rejects divergent body despite matching id and created_at',async()=>{const s=setup(entry({catatan:'different'}));await assert.rejects(s.push(entry({catatan:'original'})),/conflict/);assert.equal(s.writes(),0);});
test('worker ID collision fails closed',async()=>{const s=setup(entry({created_at:'different'}));await assert.rejects(s.push(entry()));assert.equal(s.writes(),0);});
test('new worker report still creates',async()=>{const s=setup(null);assert.equal(await s.push(entry()),'lap_one');assert.equal(s.writes(),1);});
