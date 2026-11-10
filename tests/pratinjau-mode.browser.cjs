'use strict';
// ADR-053: halaman pratinjau tidak boleh menulis dan tidak boleh berbagi penyimpanan dengan versi live.
// Semua jaringan luar dicegat; tidak ada permintaan yang keluar ke produksi.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),{chromium}=require(root+'/recovery/node_modules/playwright');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pratinjau-'));
const result={checks:[],errors:{},seen:[],complete:false};
const fixture={reports:[],upah:[],cashbook:[],workers:[],wageBindings:[],wageProcessing:[],pic:[],kasbon:[],sop:[],sopStatus:{},panen:[],lots:[],sampling:[],opt:[],milestones:[]};
function adapter(t,file){return file.endsWith('monitor-v2.html')?t.replace('<script type="module">','<script>window.__restorationAdapter={mode:"synthetic",load:async()=>structuredClone('+JSON.stringify(fixture)+')};</script><script type="module">').replace('void mountDeviceEntry(firebaseConfig).catch','void Promise.resolve().catch'):t;}
function suntik(src,dst){execFileSync('python3',['-B',root+'/.github/pratinjau/rakit.py','--suntik-satu',src,dst,'--pr','7','--sha','abc1234']);}
fs.writeFileSync(tmp+'/uji-src.html','<!doctype html><html><head><meta charset="utf-8"><title>Uji</title></head><body><form id="f" method="post" action="/kirim"><button>kirim</button></form></body></html>');
suntik(tmp+'/uji-src.html',tmp+'/uji.html');
for(const f of ['monitor-v2.html','lapor.html']){fs.writeFileSync(tmp+'/asli-'+f,adapter(fs.readFileSync(root+'/'+f,'utf8'),f));suntik(tmp+'/asli-'+f,tmp+'/pr-'+f);}
const firebaseStub='export const initializeApp=()=>({}),getApps=()=>[],getApp=()=>({}),getAuth=()=>({}),onAuthStateChanged=()=>{},GoogleAuthProvider=class{},signInWithPopup=()=>{},signOut=()=>{},setPersistence=()=>{},browserLocalPersistence={},getFirestore=()=>({}),initializeFirestore=()=>({}),doc=()=>({}),collection=()=>({}),getDocFromServer=()=>{},getDocsFromServer=()=>{},getDocs=async()=>({docs:[],forEach(){}}),onSnapshot=()=>()=>{},query=()=>{},orderBy=()=>{},limit=()=>{},deleteDoc=()=>{throw Error("write forbidden")},getDoc=async()=>({exists:()=>false,data:()=>({})}),setDoc=()=>{throw Error("write forbidden")},addDoc=()=>{throw Error("write forbidden")},serverTimestamp=()=>{},where=()=>{},updateDoc=()=>{throw Error("write forbidden")},runTransaction=()=>{throw Error("write forbidden")},writeBatch=()=>{throw Error("write forbidden")},Timestamp=class{};';
let base,browser,server;
(async()=>{try{
server=http.createServer((req,res)=>{const u=new URL(req.url,base).pathname;let body,file;
 if(u==='/live.html')body='<!doctype html><meta charset="utf-8"><title>live</title><body>live</body>';
 else if(u==='/pratinjau/pr-7/uji.html')file=tmp+'/uji.html';
 else if(/^\/pratinjau\/pr-7\/(monitor-v2|lapor)\.html$/.test(u))file=tmp+'/pr-'+path.basename(u);
 else if(/^\/asli\/(monitor-v2|lapor)\.html$/.test(u))file=tmp+'/asli-'+path.basename(u);
 else{const rel=u.replace(/^\/pratinjau\/pr-7\//,'/').replace(/^\/asli\//,'/');file=path.resolve(root,'.'+rel);if(!file.startsWith(root+'/'))file=null;}
 if(file&&(!fs.existsSync(file)||fs.statSync(file).isDirectory()))file=null;
 if(body===undefined&&!file){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',/\.(m?js)$/.test(u)?'application/javascript':u.endsWith('.css')?'text/css':u.endsWith('.png')?'image/png':u.endsWith('.json')?'application/json':'text/html; charset=utf-8');
 res.end(body!==undefined?body:fs.readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.route('**/*',r=>{const q=r.request(),url=q.url();
 if(new URL(url).origin===base)return r.continue();
 result.seen.push(q.method()+' '+url);
 if(url.includes('chart.umd.min.js'))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(root+'/recovery/node_modules/chart.js/dist/chart.umd.js')});
 if(url.startsWith('https://www.gstatic.com/firebasejs/'))return r.fulfill({contentType:'application/javascript',body:firebaseStub});
 if(/googleapis\.com|api\.github\.com/.test(url))return r.fulfill({contentType:'application/json',body:'{}'});
 return r.abort();});
// 1. Versi live menyimpan rahasia, data login, dan antrean
const live=await context.newPage();await live.goto(base+'/live.html');
await live.evaluate(()=>new Promise((ok,no)=>{localStorage.setItem('wkkn_v2_github_pat','RAHASIA');localStorage.setItem('lang','id');const r=indexedDB.open('firebaseLocalStorageDb',1);r.onupgradeneeded=()=>r.result.createObjectStore('s');r.onsuccess=()=>{r.result.close();ok();};r.onerror=()=>no(r.error);}));
// 2. Halaman pratinjau
const p=await context.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(base+'/pratinjau/pr-7/uji.html');
const r=await p.evaluate(async()=>{
 const o={};
 o.patTak=localStorage.getItem('wkkn_v2_github_pat');o.langTak=localStorage.lang;
 localStorage.setItem('lang','en');localStorage.wkkn_x='1';
 o.langPrev=localStorage.getItem('lang');
 o.keys=Object.keys(localStorage).sort();o.len=localStorage.length;
 localStorage.removeItem('wkkn_x');
 await new Promise((ok,no)=>{const q=indexedDB.open('antrean',1);q.onupgradeneeded=()=>q.result.createObjectStore('s');q.onsuccess=()=>{q.result.close();ok();};q.onerror=()=>no(q.error);});
 o.dbPrev=(await indexedDB.databases()).map(d=>d.name).sort();
 o.instansiIDB=indexedDB instanceof IDBFactory;
 const coba=async f=>{try{await f();return 'lolos';}catch(e){return 'tolak';}};
 o.commit=await coba(()=>fetch('https://firestore.googleapis.com/v1/projects/wakaf-ngantang/databases/(default)/documents:commit',{method:'POST',body:'{}'}));
 o.patch=await coba(()=>fetch('https://firestore.googleapis.com/v1/projects/wakaf-ngantang/databases/(default)/documents/upah/x',{method:'PATCH',body:'{}'}));
 o.reqPost=await coba(()=>fetch(new Request('https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents/kas',{method:'POST',body:'{}'})));
 o.github=await coba(()=>fetch('https://api.github.com/repos/a/b/contents/x',{method:'PUT',body:'{}'}));
 o.runQuery=await coba(()=>fetch('https://firestore.googleapis.com/v1/projects/wakaf-ngantang/databases/(default)/documents:runQuery',{method:'POST',body:'{}'}));
 o.get=await coba(()=>fetch('https://firestore.googleapis.com/v1/projects/wakaf-ngantang/databases/(default)/documents/upah'));
 const xhr=(m,u)=>new Promise(ok=>{const x=new XMLHttpRequest();x.open(m,u);x.onload=()=>ok('lolos');x.onerror=()=>ok('tolak');x.send('{}');});
 o.xWrite=await xhr('POST','https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8');
 o.xListen=await xhr('POST','https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?VER=8');
 o.beacon=navigator.sendBeacon('https://contoh.invalid/b','x');
 o.sw=await coba(()=>navigator.serviceWorker.register('worker-sw.js'));
 document.getElementById('f').requestSubmit();await new Promise(ok=>setTimeout(ok,50));o.tetapDiHalaman=location.pathname;
 o.judul=document.title;o.pita=document.getElementById('pratinjau-pita').textContent;o.status=window.__PRATINJAU_STATUS__();
 return o;});
Object.assign(r,await live.evaluate(async()=>({langAsli:localStorage.getItem('lang'),langNs:localStorage.getItem('pratinjau-pr7:lang'),xHilang:localStorage.getItem('pratinjau-pr7:wkkn_x'),patAsli:localStorage.getItem('wkkn_v2_github_pat'),dbAsli:(await indexedDB.databases()).map(d=>d.name).sort()})));
result.checks.push(r);assert.equal(r.patAsli,'RAHASIA');
assert.equal(r.patTak,null,'token live tidak terlihat');assert.equal(r.langTak,undefined);
assert.equal(r.langPrev,'en');assert.equal(r.langAsli,'id','kunci live tidak berubah');assert.equal(r.langNs,'en');
assert.deepEqual(r.keys,['lang','wkkn_x']);assert.equal(r.len,2);assert.equal(r.xHilang,null);
assert.ok(r.dbAsli.includes('pratinjau-pr7:antrean')&&!r.dbAsli.includes('antrean'),'IndexedDB berawalan');
assert.deepEqual(r.dbPrev,['antrean'],'login Firebase live tidak terlihat');assert.equal(r.instansiIDB,true);
assert.equal(r.commit,'tolak');assert.equal(r.patch,'tolak');assert.equal(r.reqPost,'tolak');assert.equal(r.github,'tolak');
assert.equal(r.runQuery,'lolos');assert.equal(r.get,'lolos');assert.equal(r.xWrite,'tolak');assert.equal(r.xListen,'lolos');
assert.equal(r.beacon,false);assert.equal(r.sw,'tolak');assert.equal(r.tetapDiHalaman,'/pratinjau/pr-7/uji.html');
assert.match(r.judul,/^\[PRATINJAU\] Uji$/);assert.match(r.pita,/PRATINJAU PR #7 · revisi abc1234 · data live hanya-baca · \d+ penulisan diblokir/);
assert.equal(r.status.diblokir,7);assert.deepEqual(errs,[]);
const keluar=result.seen.filter(s=>!s.startsWith('GET '));
assert.deepEqual(keluar.map(s=>s.replace(/\?.*$/,'')).sort(),['POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel','POST https://firestore.googleapis.com/v1/projects/wakaf-ngantang/databases/(default)/documents:runQuery'],'hanya POST baca yang sampai ke jaringan');
// 3. Halaman asli dashboard dan lapor: mode pratinjau tidak menambah error apa pun
for(const f of ['monitor-v2.html','lapor.html']){const e={asli:[],pratinjau:[]};
 for(const [jenis,url] of [['asli','/asli/'+f],['pratinjau','/pratinjau/pr-7/'+f]]){const q=await context.newPage();q.on('pageerror',x=>e[jenis].push(x.message));q.on('dialog',d=>d.dismiss());await q.goto(base+url);
  if(f==='monitor-v2.html')await q.waitForFunction(()=>window.dashboardReadModel?.ownerActive(),null,{timeout:20000});else await q.waitForTimeout(1500);
  if(jenis==='pratinjau'){assert.match(await q.title(),/^\[PRATINJAU\]/);assert.equal(await q.locator('#pratinjau-pita').count(),1);}
  await q.close();}
 result.errors[f]=e;assert.deepEqual(e.pratinjau.filter(m=>!e.asli.includes(m)),[],f+': error baru di mode pratinjau');result.checks.push({halaman:f,ok:true});}
const sesudah=result.seen.filter(s=>!s.startsWith('GET ')&&!/Listen\/channel|:runQuery/.test(s));
assert.deepEqual(sesudah,[],'tidak ada penulisan yang keluar');
result.complete=true;
}catch(e){result.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true});console.log(JSON.stringify(result,null,1));}})();
