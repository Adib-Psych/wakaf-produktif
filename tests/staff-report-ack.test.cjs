// Staff submitted-content acceptance; exact application functions, synthetic storage/transport only.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'monitor-v2.html'), 'utf8');
const canonical = () => fs.readFileSync(path.join(root, 'recovery/report-content.js'), 'utf8');
const {harness,fixture}=require('./authorized-report-harness.cjs');
function staff(existing,lost=false){
 // Existing envelope stores business body only; retry metadata is removed by actual caller.
 const prior=existing?Object.fromEntries(Object.entries(existing).filter(([k])=>k!=='last_synced_at')):null;
 const h=harness({role:'staff',existing:prior,lost});const c=vm.createContext({authorizedReports:{send:h.send}});
 const start=html.indexOf('    function blockedWrite()');vm.runInContext(html.slice(start,html.indexOf('\n    // ⭐ Publish SOP',start)),c);
 return {send:data=>c.setDoc({path:'laporan/'+data.id},data),get record(){return h.record('lap_synth');},get writes(){return h.commits;},pair:id=>h.pair(id)};
}
test('STAFF ACK control: refreshed last_synced_at transport metadata does not conflict on exact retry', async () => {
  const h = staff({...entry(), last_synced_at: 'first-attempt'});
  assert.equal(await h.send({...entry(), last_synced_at: 'retry-attempt'}), 'lap_synth');
  assert.equal(h.writes, 0);
});
const entry = () => fixture('staff',{id:'lap_synth',alerts:[{b:2,a:1},{label:'second'}]});
test('STAFF ACCEPTANCE: same ID/time differing body rejects without success ACK or overwrite', async () => {
  const remote = {...entry(), detail: 'changed'}, h = staff(remote);
  await assert.rejects(h.send(entry()), /conflict/);
  assert.equal(h.writes, 0); assert.deepEqual(h.record, remote);
});
test('STAFF ACK control: lost ACK exact retry accepts reordered object keys without another write', async () => {
  const h = staff(null, true), e = entry();
  await assert.rejects(h.send(e), /lost ACK/);
  assert.equal(await h.send({...e, alerts:[{a:1,b:2},{label:'second'}]}), e.id); assert.equal(h.writes, 1);assert.deepEqual(h.pair(e.id)[0],h.pair(e.id)[1]);
});
test('STAFF ACK control: extra cloud fields and array order are submitted content conflicts', async () => {
  for (const remote of [{...entry(), extra: true}, {...entry(), alerts:[{label:'second'},{b:2,a:1}]}]) {
    const h = staff(remote); await assert.rejects(h.send(entry()), /conflict/); assert.equal(h.writes, 0);
  }
});
