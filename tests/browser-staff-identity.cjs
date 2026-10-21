'use strict';
// Actual monitor and queue in isolated Chromium; loopback allowlist, no remote access.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.WAKAF_EVIDENCE||path.resolve(root,'../evidence');
const {chromium}=require(root+'/recovery/node_modules/playwright');
const files=['monitor-v2.html','firebase-config.js','recovery/entry-recovery.js','recovery/report-content.js'];
let base,browser;const result={checks:[],pageErrors:[],blockedRemoteRequests:0,productionRequests:0,serviceWorkers:'block; staff DOM only, not upgrade evidence'};
const server=http.createServer((req,res)=>{const file=new URL(req.url,base).pathname.slice(1);if(!files.includes(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(root+'/'+file));});
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:'/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
 const c=await browser.newContext({serviceWorkers:'block'});
 await c.route('**/*',r=>{if(new URL(r.request().url()).origin===base)return r.continue();if(r.request().url()==='https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js')return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(root+'/recovery/node_modules/chart.js/dist/chart.umd.js')});result.blockedRemoteRequests++;return r.abort();});
 const p=await c.newPage();p.on('pageerror',e=>result.pageErrors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(base+'/monitor-v2.html',{waitUntil:'domcontentloaded'});await p.waitForSelector('#entry-recovery-banner');
 const first=await p.evaluate(async()=>{
   STATE.pelapor='WAKIF';STATE.bidang='1';STATE.bidang_list=['1'];document.getElementById('f-tgl').value='2000-01-01';document.getElementById('f-kategori').value=document.getElementById('f-kategori').options[1].value;
   window.syntheticSends=[];window.syncLaporanEntryToFirestore=async e=>{syntheticSends.push({entry:e,durable:localStorage.getItem('wkkn_recovery_staff_pending_v1')});throw Error('synthetic lost ACK');};
   submitForm();await entryRecovery.drain();return {pending:entryRecovery.pending(),sends:syntheticSends};
 });
 assert.match(first.pending[0].id,/^lap_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 assert.deepEqual(JSON.parse(first.sends[0].durable),first.pending);
 await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('#entry-recovery-banner');
 const retry=await p.evaluate(async()=>{const before=entryRecovery.pending();let sent;window.syncLaporanEntryToFirestore=async e=>{sent=e;throw Error('synthetic lost ACK');};await entryRecovery.drain();return {before,after:entryRecovery.pending(),sent};});
 assert.deepEqual(retry.before,first.pending);assert.deepEqual(retry.after,first.pending);assert.deepEqual(retry.sent,first.pending[0]);
 result.checks.push({id:'actual-secure-UUID-durable-before-transport-reload-lost-ACK-retry',passed:true});
 const conflict=await p.evaluate(()=>{const key='wkkn_recovery_staff_pending_v1',before=localStorage.getItem(key),entry=entryRecovery.pending()[0];let error;try{entryRecovery.enqueue([{...entry,id:'synthetic-append'},{...entry,detail:'different'}]);}catch(e){error=e.message;}entryRecovery.enqueue([Object.fromEntries(Object.entries(entry).reverse())]);return {before,after:localStorage.getItem(key),error};});
 assert.match(conflict.error,/Konflik.*ID/);assert.equal(conflict.after,conflict.before);
 result.checks.push({id:'actual-enqueue-conflict-batch-preservation-canonical-retry',passed:true});
 const caller=await p.evaluate(()=>{
   const key='wkkn_recovery_staff_pending_v1',before=localStorage.getItem(key),old=entryRecovery.pending()[0];
   Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=>old.id.slice(4)});
   STATE.pelapor='WAKIF';STATE.bidang='1';STATE.bidang_list=['1'];document.getElementById('f-tgl').value='2000-01-02';document.getElementById('f-kategori').value=document.getElementById('f-kategori').options[1].value;document.getElementById('f-catatan').value='synthetic form retained';
   window.syntheticAlerts=[];window.alert=s=>syntheticAlerts.push(s);let sends=0;window.syncLaporanEntryToFirestore=async()=>{sends++;throw Error('unexpected transport');};const state=JSON.stringify(STATE.laporan);submitForm();
   return {before,after:localStorage.getItem(key),state,stateAfter:JSON.stringify(STATE.laporan),form:document.getElementById('f-catatan').value,alerts:syntheticAlerts,sends};
 });
 assert.equal(caller.after,caller.before);assert.equal(caller.stateAfter,caller.state);assert.equal(caller.form,'synthetic form retained');assert.equal(caller.sends,0);assert.match(caller.alerts.join(' '),/Konflik.*ID/);
 result.checks.push({id:'actual-submit-collision-preserves-pending-form-STATE-no-transport',passed:true});
 const unavailable=await p.evaluate(()=>{Object.defineProperty(crypto,'randomUUID',{configurable:true,value:undefined});const key='wkkn_recovery_staff_pending_v1',before=localStorage.getItem(key);syntheticAlerts=[];submitForm();return {before,after:localStorage.getItem(key),form:document.getElementById('f-catatan').value,alerts:syntheticAlerts};});
 assert.equal(unavailable.after,unavailable.before);assert.equal(unavailable.form,'synthetic form retained');assert.match(unavailable.alerts.join(' '),/UUID/);
 result.checks.push({id:'actual-submit-unavailable-secure-UUID-fail-closed',passed:true});
 assert.equal(result.pageErrors.length,0);
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/browser-staff-identity-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
