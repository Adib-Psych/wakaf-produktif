'use strict';
// Full existing dashboard DOM + actual module listener, synthetic SDK/storage only.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),{chromium}=require(root+'/recovery/node_modules/playwright');
const {baseline,report}=require('./listener-finance-harness.cjs');
const out=process.env.WAKAF_EVIDENCE||path.join(root,'evidence');
const results={checks:[],pageErrors:[],externalNetwork:0,blockedRequests:[],sdk:'synthetic ES module adapter, not Firebase emulator/Auth',serviceWorkers:'blocked'};
let browser,base;
const server=http.createServer((req,res)=>{
  const name=new URL(req.url,base).pathname.slice(1);
  if(!['monitor-v2.html','recovery/report-content.js','recovery/entry-recovery.js'].includes(name)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':'text/html');
  res.end(fs.readFileSync(name==='monitor-v2.html'&&process.env.WAKAF_SOURCE?process.env.WAKAF_SOURCE:path.join(root,name)));
});
const sdk=`
const c=window.__syntheticSDK={listeners:[],reads:[],writes:[]};
export const getFirestore=()=>({});
export const collection=(_db,...parts)=>({path:parts.join('/')});
export const doc=collection;
export const query=(ref,...filters)=>({...ref,filters});
export const orderBy=(...args)=>args;
export const where=(...args)=>args;
export const serverTimestamp=()=>({synthetic:true});
export function onSnapshot(ref,next,error){const x={path:ref.path,next,error,unsubscribed:false};c.listeners.push(x);return ()=>{x.unsubscribed=true;};}
export async function getDoc(ref){c.reads.push(ref.path);return {exists:()=>false,data:()=>({})};}
const denied=async(...args)=>{c.writes.push({path:args[0]?.path||'transaction',stack:new Error().stack});throw Error('synthetic SDK writes disabled');};
export const deleteDoc=denied,setDoc=denied,updateDoc=denied,runTransaction=denied;
`;
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:'/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
 const ctx=await browser.newContext({serviceWorkers:'block'});
 await ctx.route('**/*',r=>{
  const url=r.request().url();
  if(url.endsWith('/firebase-app.js'))return r.fulfill({contentType:'application/javascript',body:'export const initializeApp=()=>({synthetic:true});'});
  if(url.endsWith('/firebase-firestore.js'))return r.fulfill({contentType:'application/javascript',body:sdk});
  if(url===base+'/firebase-config.js')return r.fulfill({contentType:'application/javascript',body:'export const firebaseConfig={};export const COLLECTIONS={laporan:"laporan",sop_master:"sop_master"};'});
  if(url==='https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js')return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(root+'/recovery/node_modules/chart.js/dist/chart.umd.js')});
  if(new URL(url).origin===base&&!url.includes('/data/'))return r.continue();
  results.blockedRequests.push(url);return r.abort();
 });
 const p=await ctx.newPage();p.on('pageerror',e=>results.pageErrors.push(e.stack));
 const seed={...baseline,wkkn_v2_laporan:JSON.stringify([{...report('synthetic-cache'),tgl:'2000-01-02',bidang:'3',pohon:4,detail:'synthetic cached narrative'}]),wkkn_v2_upah_ver:'synthetic-old-version',wkkn_reconciliation_mode:'off'};
 // Include retired worker to catch the previous startup history deletion.
 seed.wkkn_v2_upah=JSON.stringify([...JSON.parse(seed.wkkn_v2_upah),{id:92,pelapor:'ANTO',tgl:'1999-01-02',qty:1,tarif:19,status:'belum',src:'synthetic'}]);
 await p.addInitScript(seed=>{for(const [k,v]of Object.entries(seed))localStorage.setItem(k,v);},seed);
 await p.goto(base+'/monitor-v2.html',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.__syntheticSDK?.listeners.some(l=>l.path==='laporan'));
 const observe=()=>p.evaluate(keys=>({upah:JSON.stringify(UPAH_ITEMS),cash:JSON.stringify(CASHBOOK),advances:JSON.stringify(KASBON_DATA),bytes:Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),sdkWrites:window.__syntheticSDK.writes.slice()}),Object.keys(baseline));
 const startup=await observe();
 assert.equal(startup.upah,JSON.stringify(JSON.parse(seed.wkkn_v2_upah)),'startup must preserve all historical wage rows');
 for(const k of Object.keys(baseline))assert.equal(startup.bytes[k],seed[k],k+' startup bytes');
 const run=async (data,type='added')=>p.evaluate(async({data,type})=>{
  TARIF_PEKERJA.SYNTHETIC_WORKER={setengah_hari:31,full_day:61};
  const listener=window.__syntheticSDK.listeners.filter(l=>l.path==='laporan').at(-1);
  await listener.next({metadata:{fromCache:true},docChanges:()=>[{type,doc:{id:data?.id||'synthetic-malformed',data:()=>data}}]});
 },{data,type});
 await p.evaluate(()=>{window.__financeCalls={save:0,sync:0};const original=saveUpah;window.saveUpah=(...args)=>{window.__financeCalls.save++;return original(...args);};window.syncUpahToFirestore=async()=>{window.__financeCalls.sync++;};});
 await p.waitForTimeout(3200); // Real scheduled startup reprocess, not a surrogate call.
 assert.deepEqual(await observe(),startup);results.checks.push('startup/cache/nonzero-history-and-pending-bytes');
 await run(report());assert.deepEqual(await observe(),startup);
 const display=await p.evaluate(()=>{const r=STATE.laporan.find(l=>l.id==='synthetic-report');return {tgl:r.tgl,pohon:r.pohon,kebun:r.kebun,detail:r.detail,token:r.detail_fields.tipe_pemangkasan_token,compliance:r.compliance,text:document.getElementById('panel-log')?.innerText||document.body.innerText};});
 assert.equal(display.tgl,'2000-01-02');assert.equal(display.pohon,4);assert.equal(display.kebun,'K3+K1');assert.equal(display.token,'wiwilan');assert.equal(display.detail,'synthetic narrative');assert.equal(display.compliance,'compliant');assert.match(display.text,/synthetic narrative/);
 results.checks.push('actual-listener-arrival-normalization-and-log-DOM');
 const listenersBefore=await p.evaluate(()=>window.__syntheticSDK.listeners.filter(l=>l.path==='laporan').length);
 await p.evaluate(()=>window.__syntheticSDK.listeners.filter(l=>l.path==='laporan').at(-1).error(Error('synthetic stream failure')));
 await p.waitForTimeout(5100);assert.equal(await p.evaluate(()=>window.__syntheticSDK.listeners.filter(l=>l.path==='laporan').length),listenersBefore+1);
 await run(report());await run({...report(),catatan:'synthetic modified'},'modified');assert.deepEqual(await observe(),startup);results.checks.push('actual-error-retry-cache-modified');
 await assert.rejects(run({...report('synthetic-malformed'),kategori:42}),/kategori.replace is not a function/);
 assert.deepEqual(await observe(),startup);results.malformedDisplayLimit='Existing renderLog rejects non-string category; finance/queues still unchanged. No generic validation added.';
 await run(report('synthetic-malformed'),'removed');results.checks.push('malformed-report-finance-preserved-display-rejection-diagnostic');
 await run(report(),'removed');assert.deepEqual(await observe(),startup);results.checks.push('removed-report-finance-preserved');
 assert.deepEqual(await p.evaluate(()=>window.__financeCalls),{save:0,sync:0});
 // Other domain startup reads are allowed by this synthetic adapter; report path no longer fetches upah.
 assert.deepEqual(results.pageErrors,[]);
 assert.ok(startup.sdkWrites.every(x=>x.path==='transaction'&&x.stack.includes('entry-recovery.js')),'only existing pending-report drain may attempt SDK transaction');
 results.startupReportQueueAttempts=startup.sdkWrites;results.reads=await p.evaluate(()=>window.__syntheticSDK.reads);results.financeCalls=await p.evaluate(()=>window.__financeCalls);
 results.checks.push('zero-saveUpah-sync-new-SDK-write-and-page-errors');
 results.acceptanceCount=results.checks.length-1;results.diagnosticCount=1;
 }finally{
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'browser-listener-finance.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
  if(browser)await browser.close();await new Promise(r=>server.close(r));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
