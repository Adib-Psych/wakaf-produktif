const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),workspace=process.env.BROWSER_EVIDENCE_DIR||process.env.TMPDIR||require('node:os').tmpdir();
const {chromium}=require(path.join(repo,'recovery/node_modules/playwright'));
(async()=>{
 const fixture=fs.mkdtempSync(path.join(workspace,'qa-fixture-'));
 const files=['monitor-v2.html','lapor.html','lapor-cabut.html','firebase-config.js','recovery/entry-recovery.js'];
 for(const file of files){const dst=path.join(fixture,file);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(repo,file),dst);}
 const nonce=crypto.randomUUID();let base,browser;
 const server=http.createServer((req,res)=>{const url=new URL(req.url,base);if(url.pathname==='/qa-nonce'){res.end(nonce);return;}const rel=decodeURIComponent(url.pathname).slice(1);if(!files.includes(rel)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',rel.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(path.join(fixture,rel)));});
 const result={head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),executor:process.env.BROWSER_EXECUTOR||'isolated CI runner',isolated:true,productionRequests:0,blockedHosts:[],checks:[],pageErrors:[]};
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
  const ctx=await browser.newContext({serviceWorkers:'block'});
  await ctx.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();if(u.href==='https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js')return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(repo,'recovery/node_modules/chart.js/dist/chart.umd.js'))});result.blockedHosts.push(u.hostname);return r.abort();});
  const page=await ctx.newPage();page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base+'/lapor.html?w=KUMPUL',{waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(()=>fetch('/qa-nonce').then(r=>r.text())),nonce);
  await page.waitForFunction(()=>typeof submitForm==='function' && typeof getPending==='function');
  const general=await page.evaluate(async()=>{STATE.selected.kebun=['K1'];STATE.kategori='cabut_borongan';STATE.selected.durasi='full_day';STATE.gps={lat:0,lng:0};document.getElementById('f-tgl').value='2000-01-01';await submitForm();await manualSync();return {pending:(await getPending()).length,all:await getAllSubmissions(),modal:document.getElementById('successModal').textContent,worker:STATE.workerToken};});
  assert.equal(general.pending,1);assert.match(general.modal,/Tersimpan di HP/);assert.equal(general.all[0].status,'pending');
  result.checks.push({path:'lapor.html?w=KUMPUL',case:'actual form submit and manualSync, missing SDK',pending:general.pending,worker:general.worker});
  const interleaving=await page.evaluate(async()=>{const sent=[];let unblock;const blocked=new Promise(r=>unblock=r);window.firestoreDB={};window.firestorePush=async e=>{sent.push(e.id);await blocked;return e.id;};const first=maybeAutoSync();while(!sent.length)await new Promise(r=>setTimeout(r,5));await queueSubmission({id:'lap_browser_appended',created_at:'2000-01-01',pelapor:'KUMPUL'});unblock();await first;return {pending:await getPending(),sent};});
  assert.equal(interleaving.pending.length,1);assert.equal(interleaving.pending[0].data.id,'lap_browser_appended');result.checks.push({path:'lapor.html',case:'real IndexedDB append during source drain with synthetic transport',remaining:1});
  const legacyIDs=[];
  for(let device=0;device<2;device++){
    const isolated=await browser.newContext({serviceWorkers:'block'});
    await isolated.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
    const p=await isolated.newPage();p.on('pageerror',e=>result.pageErrors.push(e.message));
    await p.goto(base+'/lapor.html?w=KUMPUL',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>typeof prepareQueuedSubmission==='function');
    const probe=await p.evaluate(async device=>{
      const local=await queueSubmission({pelapor:'KUMPUL',created_at:'same-time',catatan:'SYNTHETIC DEVICE '+device});
      let persisted,sent;window.firestoreDB={};window.firestorePush=async data=>{sent=data.id;persisted=(await getPending())[0].data.id;throw Error('synthetic lost ACK');};
      await drainWorkerQueue();const first=(await getPending())[0];await drainWorkerQueue();const retry=(await getPending())[0];
      return {local,persisted,sent,id:first.data.id,retry:retry.data.id,body:retry.data.catatan,status:retry.status};
    },device);
    assert.equal(probe.local,1);assert.ok(probe.id);assert.equal(probe.persisted,probe.id);assert.equal(probe.retry,probe.id);assert.equal(probe.status,'pending');assert.equal(probe.body,'SYNTHETIC DEVICE '+device);legacyIDs.push(probe.id);
    await isolated.close();
  }
  assert.notEqual(legacyIDs[0],legacyIDs[1]);result.checks.push({path:'lapor.html',case:'two isolated devices same local ID/time commit unique immutable legacy identities before synthetic network and retain on lost ACK',devices:2});
  await page.goto(base+'/monitor-v2.html',{waitUntil:'domcontentloaded'});await page.waitForSelector('#entry-recovery-banner');
  const staff=await page.evaluate(async()=>{STATE.pelapor='WAKIF';STATE.bidang='1';STATE.bidang_list=['1'];document.getElementById('f-tgl').value='2000-01-01';document.getElementById('f-kategori').value=document.getElementById('f-kategori').options[1].value;submitForm();await entryRecovery.drain();return {pending:entryRecovery.pending().length,cashbook:CASHBOOK.length,banner:document.getElementById('entry-recovery-banner').textContent};});
  assert.equal(staff.pending,1);assert.equal(staff.cashbook,0);assert.match(staff.banner,/bayar, edit\/hapus dan publikasi dinonaktifkan/);result.checks.push({path:'monitor-v2.html',case:'actual staff submit, missing SDK, anti-startup-seed',pending:1,cashbook:0});
  const restriction=await page.evaluate(()=>{const p=document.createElement('div');p.id='panel-financial-qa';const b=document.createElement('button');b.setAttribute('onclick','window.qaPaymentExecuted=true');p.append(b);document.body.append(p);window.qaPaymentExecuted=false;b.click();return window.qaPaymentExecuted;});assert.equal(restriction,false);result.checks.push({path:'monitor-v2.html',case:'financial panel capture guard, synthetic control',executed:false});
  await page.goto(base+'/lapor-cabut.html',{waitUntil:'domcontentloaded'});await page.locator('#nama').fill('SYNTHETIC');await page.locator('#jumlah').fill('2');await page.locator('#lokasi').fill('synthetic block');await page.locator('#kebunSeg button').first().click();await page.locator('#kirim').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('wkkn_cabut_antri')||'[]').length===1);const cabut=await page.evaluate(()=>({queue:JSON.parse(localStorage.getItem('wkkn_cabut_antri')),message:document.getElementById('done').textContent}));assert.match(cabut.message,/HP/);assert.ok(cabut.queue[0].id);result.checks.push({path:'lapor-cabut.html',case:'actual submit with rejected SDK',pending:1,stableID:!!cabut.queue[0].id});
  assert.equal(result.pageErrors.length,0);result.blockedHosts=[...new Set(result.blockedHosts)];fs.writeFileSync(path.join(workspace,'independent-browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{if(browser)await browser.close();if(server.listening)await new Promise(r=>server.close(r));fs.rmSync(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
