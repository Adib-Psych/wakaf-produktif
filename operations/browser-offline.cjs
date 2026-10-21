// Synthetic loopback fixture, actual lapor queue + real SW/IndexedDB; not production acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),{chromium}=require('../recovery/node_modules/playwright');
const baseline=process.argv.includes('--baseline');
const allowed=['lapor.html','demo/sw.js','demo/manifest.json','worker-sw.js','worker-manifest.json','firebase-config.js','images/logo-wakaf-produktif-transparan.png','images/logo-wakaf-produktif-2x1-bg.png'];
let version=1,origin,browser;
const result={executor:'Thar Lay/server',source:'PR#1 7c7c676 + clearly transformed synthetic fixture',baseline,checks:[],blockedExternal:[],errors:[]};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,origin),rel=url.pathname.replace(/^\/wakaf-produktif\//,'');
 if(!allowed.includes(rel)){res.writeHead(404);return res.end();}
 let data=fs.readFileSync(path.join(repo,rel));
 // Candidate is served exactly as assembled; no registration substitutions.
 if(baseline && ['lapor.html','demo/sw.js','demo/manifest.json'].includes(rel)) data=require('node:child_process').execFileSync('git',['show','d5135d8fe40d70eb5fc20226ca211001f273fe1d:'+rel],{cwd:repo});
 if(rel==='worker-sw.js')data=data.toString().replace("CACHE_PREFIX+'v1'",`CACHE_PREFIX+'v${version}'`);
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',rel.endsWith('.js')?'application/javascript':rel.endsWith('.json')?'application/json':rel.endsWith('.png')?'image/png':'text/html');res.end(data);
});
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE localhost']});
 const ctx=await browser.newContext({serviceWorkers:'allow'});
 await ctx.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();result.blockedExternal.push(u.origin);return route.abort();});
 let page=await ctx.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('dialog',d=>d.accept());
 const url=origin+'/wakaf-produktif/lapor.html?w=KUMPUL';await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof registerSW==='function');
 if(baseline){await page.evaluate(async()=>{await navigator.serviceWorker.getRegistrations();registerSW();});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true,'baseline root report has no controlling SW');return;}
 await page.evaluate(()=>registerSW());
 await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return !!r?.active;});
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.evaluate(async()=>{const c=await caches.open('sibling-important');await c.put('/sibling-qa',new Response('retain'));});
 assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller.scriptURL),origin+'/wakaf-produktif/worker-sw.js');result.checks.push('root scope controls actual report after explicit reload');
 await ctx.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof submitForm==='function');
 const queued=await page.evaluate(async()=>{STATE.selected.kebun=['K1'];STATE.kategori='cabut_borongan';STATE.selected.durasi='full_day';STATE.gps={lat:0,lng:0};document.getElementById('f-tgl').value='2000-01-01';await submitForm();await manualSync();const rows=await getPending();return {pending:rows.length,id:rows[0]?.data.id,message:document.getElementById('successModal').textContent};});
 assert.equal(queued.pending,1);assert.ok(queued.id);assert.match(queued.message,/Tersimpan di HP/);
 await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(async()=> (await getPending())[0].data.id),queued.id);result.checks.push('offline shell reload + actual submission + durable ID survives reload');
 await ctx.setOffline(false);
 const retry=await page.evaluate(async()=>{const stored=new Map();let calls=0;window.firestoreDB={};window.firestorePush=async data=>{calls++;if(!stored.has(data.id))stored.set(data.id,structuredClone(data));if(calls===1)throw Error('SYNTHETIC lost ACK');return data.id;};await drainWorkerQueue();const afterLost=(await getPending()).length;await drainWorkerQueue();return {afterLost,pending:(await getPending()).length,writes:stored.size,calls};});
 assert.deepEqual(retry,{afterLost:1,pending:0,writes:1,calls:2});result.checks.push('existing F2 reused: synthetic lost-ACK transport retries same ID without duplicate; actual IndexedDB ACK');
 version=2;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration())?.waiting);
 assert.ok((await page.evaluate(()=>caches.keys())).includes('wkkn-worker-v1'));result.checks.push('new SW waits while current report tab remains open');
 await page.close();page=await ctx.newPage();await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated'&&!r.waiting;});
 // activated state can precede the activate handler's waitUntil cache cleanup.
 await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('wkkn-worker-v2')&&!keys.includes('wkkn-worker-v1');});
 const keys=await page.evaluate(()=>caches.keys());assert.ok(keys.includes('sibling-important'));assert.ok(keys.includes('wkkn-worker-v2'));assert.ok(!keys.includes('wkkn-worker-v1'));result.checks.push('after old tab closes, update activates; only owned old cache deleted; sibling cache retained');
 await ctx.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(async()=> (await getPending()).length),0);result.checks.push('updated shell reloads offline and synced IndexedDB state persists');
 assert.equal(result.errors.length,0);result.blockedExternal=[...new Set(result.blockedExternal)];result.productionTraffic='blocked by context routes and host resolver; no production connection';
 fs.mkdirSync(path.join(repo,'../evidence'),{recursive:true});fs.writeFileSync(path.join(repo,'../evidence/offline-browser.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{if(browser)await browser.close();if(server.listening)await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
