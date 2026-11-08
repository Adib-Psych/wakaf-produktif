'use strict';
// Full current dashboard, synthetic read adapter, no production network or writes.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),{chromium}=require(root+'/recovery/node_modules/playwright');
const out=process.env.UI_CONSOLIDATION_EVIDENCE||'/root/.hermes/cache/scratch/dashboard-ui-consolidation';
const fixture={reports:[],upah:[],cashbook:[],workers:[],wageBindings:[],wageProcessing:[],pic:[],kasbon:[],sopStatus:{},panen:[],lots:[],sampling:[],opt:[],milestones:[],_meta:{domains:{upah:{state:'available'},reports:{state:'available'}}}};
const result={checks:[],errors:[],popups:[],requests:[],baseline:'548a44d',limits:['Synthetic public reader; no real login, permission grant, save, payment, publication or production calls. Native alert/confirm/prompt remain browser-owned and unthemed.']};
const script='recovery/dashboard-ui-consolidation.js',css='recovery/dashboard-ui-consolidation.css';
let base,browser,server;
(async()=>{try{
 fs.mkdirSync(out,{recursive:true});
 server=http.createServer((req,res)=>{const u=new URL(req.url,base),file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+'/')||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}let body=fs.readFileSync(file);if(file.endsWith('monitor-v2.html')){let text=body.toString().replace('<script type="module">','<script>window.__restorationAdapter={mode:"synthetic",load:async()=>structuredClone('+JSON.stringify(fixture)+')};</script><script type="module">').replace('void mountDeviceEntry(firebaseConfig).catch','void Promise.resolve().catch');text=text.replace('</head>',(fs.existsSync(root+'/'+css)&&!text.includes(css)?'<link rel="stylesheet" href="/'+css+'">':'')+(fs.existsSync(root+'/'+script)&&!text.includes(script)?'<script defer src="/'+script+'"></script>':'')+'</head>');body=Buffer.from(text);}res.setHeader('Content-Type',/\.(?:js|mjs)$/.test(file)?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(body);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
 for(const width of [1440,390,320]){
 const context=await browser.newContext({viewport:{width,height:width===1440?1000:740},serviceWorkers:'block'});
 await context.route('**/*',r=>{const u=r.request().url();result.requests.push({url:u,method:r.request().method()});if(new URL(u).origin===base)return r.continue();if(u.includes('chart.umd.min.js'))return r.fulfill({contentType:'application/javascript',body:fs.readFileSync(root+'/recovery/node_modules/chart.js/dist/chart.umd.js')});if(u.startsWith('https://www.gstatic.com/firebasejs/'))return r.fulfill({contentType:'application/javascript',body:'export const initializeApp=()=>({}),getApps=()=>[],getAuth=()=>({}),onAuthStateChanged=()=>{},GoogleAuthProvider=class{},signInWithPopup=()=>{},signOut=()=>{},setPersistence=()=>{},browserLocalPersistence={},getFirestore=()=>({}),doc=()=>({}),collection=()=>({}),getDocFromServer=()=>{},getDocsFromServer=()=>{},onSnapshot=()=>{},query=()=>{},orderBy=()=>{},deleteDoc=()=>{},getDoc=()=>{},setDoc=()=>{},serverTimestamp=()=>{},where=()=>{},updateDoc=()=>{},runTransaction=()=>{},Timestamp=class{};'});return r.abort();});
 const p=await context.newPage();p.on('pageerror',e=>result.errors.push(e.message));p.on('dialog',async d=>{result.nativeDialogs??=[];result.nativeDialogs.push({type:d.type(),message:d.message()});await d.dismiss();});
 await p.goto(base+'/monitor-v2.html',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.dashboardReadModel?.ownerActive());
 await p.evaluate(()=>openTrxModal('masuk'));
 await p.waitForTimeout(60);
 const style=await p.locator('#trx-modal-overlay > div').evaluate(n=>({background:getComputedStyle(n.firstElementChild).backgroundColor,color:getComputedStyle(n.firstElementChild).color}));
 result.beforeOrAfterStyle=style;
 assert.equal(style.background,'rgb(67, 45, 56)','actual transaction popup header must use accepted Musim Panen earth, not old white/gold/green');
 result.checks.push('actual transaction opener themed at '+width);
 assert.equal(await p.locator('details.dashboard-repair-diagnostics button[onclick="openAuditModal()"] ').count(),2,'legacy audit entrypoints are consolidated into collapsed read-only diagnostics, not removed');
 await p.evaluate(()=>closeTrxModal());
 const cases=[
  ['trx-modal-overlay',"openTrxModal('masuk')",'keuangan'],
  ['opt-obs-modal-overlay','openOptObsModal()','opt'],
  ['add-worker-modal','openAddWorkerModal()','workers'],
  ['dlg-panen-sortir4-overlay',"openPanenSortir4Dialog({id:'fixture-batch',cherry_kg:10,pengapung_kg:1,komposisi:{merah:60,kuning:20,hijau:10,hitam:10}})",'panen'],
  ['panen-jemur-modal-overlay',"openPanenJemurDialog({id:'fixture-lot',grade:'merah',kg_sortir_awal:10})",'panen'],
  ['sampling-input-modal-overlay','openSamplingInput(SAMPLING_POHON_BASELINE[0].id)','panen'],
  ['sampling-edit-modal-overlay',"PANEN_SAMPLING_DATA=[{id:'fixture-session',pohon_id:SAMPLING_POHON_BASELINE[0].id,tgl:'2026-11-01',cherry_gram:100}];editSamplingSession(SAMPLING_POHON_BASELINE[0].id,'fixture-session')",'panen'],
  ['jemur-event-modal-overlay','openJemurEventDialog()','panen'],
  ['jual-event-modal-overlay','openJualEventDialog()','panen'],
  ['giling-event-modal-overlay','openGilingEventDialog()','panen'],
  ['pic-edit-overlay','DISTRIBUSI_DATA=structuredClone(DISTRIBUSI_DATA_DEFAULT);openPICEditModal(0,0)','distribusi'],
  ['laporan-related-overlay',"showLaporanRelatedModal(encodeURIComponent(JSON.stringify({title:'Laporan terkait · uji pembaca',monthN:11,year:2026,kategoriList:'lain',count:0})))",'kalender'],
  ['progress-slider-overlay',"SOP_STATUS.fixture={status:'sedang_berjalan',progress:50};openProgressSliderModal('fixture')",'kalender'],
  ['ms-modal-overlay','openMilestoneDlg()','milestones'],
  ['ms-preview-modal-overlay',"openMilestoneDlg();document.getElementById('ms-title-id').value='Uji pratinjau';openPreviewMilestoneDlg();closeMilestoneDlg()",'milestones'],
  ['suggest-modal-overlay','openSuggestDlg()','milestones'],
  ['bc-draft-modal-overlay',"BC_SELECTED.add('fixture-missing');openBatchDraftModal()",'milestones'],
  ['audit-modal-overlay','openAuditModal()','anggaran'],
  ['recover-modal-overlay','openRecoverDlg()','anggaran'],
  ['paid-modal-overlay','_prepPaidModalCommon()','anggaran'],
  ['upah-dialog','openDlg()','anggaran'],
  ['opt-expert-modal-overlay',"OPT_OBSERVATIONS=[{id:'fixture-opt',tgl:'2026-11-01',kebun:'K1',foto:[],keterangan:'Uji gejala',ai_status:'pending'}];openExpertModal('fixture-opt')",'opt'],
  ['opt-detail-modal-overlay',"document.getElementById('opt-detail-modal-overlay').style.display='flex'",'opt'],
  ['payroll-recording-dialog',"window.__uiWages=[{id:'fixture-wage',tgl:'2026-11-01',aktivitas:'Uji upah privat',qty:1,tarif:50000,fund:'K4',status:'belum'}];window.__uiPayroll.decorate();document.querySelector('[data-payroll-action=paid]').click()",'anggaran']
 ];
 await p.evaluate(async()=>{const {mountPayrollUI}=await import('/recovery/payroll-ui.mjs');window.__uiPayroll=mountPayrollUI({document,readWages:()=>window.__uiWages||[],sessionAvailable:()=>true,sessionOwner:()=> 'fixture-only',record:()=>{throw Error('fixture refuses all writes');}});});
 for(const [id,code,route] of cases){
  await p.evaluate(({id,route})=>{const actual=document.getElementById(id)?.closest('.panel')?.id||'panel-'+route;document.querySelectorAll('.panel').forEach(n=>n.classList.toggle('active',n.id===actual));},{id,route});
  if(id==='payroll-recording-dialog')await p.evaluate(()=>{document.getElementById('upah-tbody').innerHTML='<tr data-wage="fixture-wage"><td><input type="checkbox" class="upah-check" data-id="fixture-wage"><button onclick="openPaidModalById(1)">Bayar</button></td></tr>';});
  await p.evaluate(code=>{(0,eval)(code);},code);
  await p.waitForTimeout(65);
  const loc=p.locator('#'+id);
  assert.equal(await loc.isVisible(),true,id+' opens');
  const geometry=await loc.evaluate(root=>{const panel=root.matches('dialog')?root:root.firstElementChild,r=panel.getBoundingClientRect();const h=panel.querySelector('.dashboard-popup-header');return {id:root.id,width:innerWidth,x:r.x,right:r.right,y:r.y,bottom:r.bottom,scrollWidth:panel.scrollWidth,clientWidth:panel.clientWidth,overflow:panel.scrollWidth>panel.clientWidth+1,overflowNodes:[...panel.querySelectorAll('*')].filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>({tag:n.tagName,id:n.id,style:n.getAttribute('style'),scroll:n.scrollWidth,client:n.clientWidth,text:n.textContent.slice(0,80),right:n.getBoundingClientRect().right})).slice(0,12),name:panel.getAttribute('aria-labelledby')||panel.getAttribute('aria-label'),header:h?getComputedStyle(h).backgroundColor:null,headerContents:h?[...h.querySelectorAll('*')].map(n=>({tag:n.tagName,id:n.id,text:n.textContent,display:getComputedStyle(n).display,color:getComputedStyle(n).color,width:n.getBoundingClientRect().width})):[],fields:[...panel.querySelectorAll('input,select,textarea')].filter(n=>n.type!=='hidden').map(n=>({id:n.id,type:n.type,width:n.getBoundingClientRect().width,disabled:n.disabled})),hiddenRepair:[...panel.querySelectorAll('[data-retired-repair]')].map(n=>({handler:n.dataset.retiredRepair,hidden:n.hidden})),primary:[...panel.querySelectorAll('.dashboard-popup-primary')].map(n=>getComputedStyle(n).backgroundColor)};});
  geometry.route=route;geometry.openMode=id==='opt-detail-modal-overlay'?'existing static shell only: real opener requires reader ticket':id==='payroll-recording-dialog'?'real module + isolated synthetic authority; click opening only':'actual opener; no submit';
  result.popups.push(geometry);
  assert.equal(geometry.header,'rgb(67, 45, 56)',id+' accepted palette header');
  assert.ok(geometry.name,id+' accessible name');
  if(id==='trx-modal-overlay')assert.equal(await p.locator('#trx-modal-title').isVisible(),true,'popup title must be visible, not merely an aria reference');
  if(id==='trx-modal-overlay')assert.equal(await p.locator('#trx-modal-overlay > div > div:first-child button').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)','header close is quiet, not secondary cream');
  assert.ok(geometry.x>=-1&&geometry.right<=width+1,id+' fits viewport horizontally');
  assert.ok(geometry.y>=-1&&geometry.bottom<=(width===1440?1000:740)+1,id+' fits viewport vertically');
  assert.equal(geometry.overflow,false,id+' no horizontal panel overflow');
  for(const bg of geometry.primary)assert.equal(bg,'rgb(116, 70, 95)',id+' primary uses plum');
  if(id==='trx-modal-overlay'){
   await p.locator('#trx-ket').fill('Draft aman');
   await p.keyboard.press('Tab');
   assert.equal(await p.locator('#trx-modal-overlay > div').evaluate(n=>n.contains(document.activeElement)),true,'keyboard stays in modal');
   assert.equal(await p.locator('#trx-ket').inputValue(),'Draft aman');
  }
  if(id==='payroll-recording-dialog'){
   await p.locator('#payroll-recording-date').fill('2026-11-01');
   await p.locator('#payroll-recording-reason').fill('Isian tetap pada penolakan');
   await p.locator('[data-payroll-action=save]').click();
   await p.waitForFunction(()=>document.querySelector('#payroll-recording-dialog [role=status]').textContent.includes('fixture refuses all writes'));
   assert.equal(await p.locator('#payroll-recording-reason').inputValue(),'Isian tetap pada penolakan');
   assert.equal(await p.locator('#payroll-recording-date').inputValue(),'2026-11-01');
   assert.equal(await loc.evaluate(root=>root.open),true);
   await loc.evaluate(root=>{root.scrollTop=root.scrollHeight;});
   const end=await loc.evaluate(root=>({bottom:root.getBoundingClientRect().bottom,saveBottom:root.querySelector('[data-payroll-action=save]').getBoundingClientRect().bottom}));
   assert.ok(end.saveBottom<=end.bottom-5,'save fully reachable with bottom padding');
  }
  if(['trx-modal-overlay','sampling-input-modal-overlay','giling-event-modal-overlay','laporan-related-overlay','payroll-recording-dialog','audit-modal-overlay'].includes(id))await p.screenshot({path:out+'/'+id+'-'+width+'.png',fullPage:false});
  await loc.evaluate(root=>{if(root.matches('dialog'))root.close();else root.style.display='none';});
 }
 result.checks.push(cases.length+' real/modal-shell opens; payroll save calls a fixture-only refusal, no persistence, at '+width);
 // Real retired renderers populated with synthetic historical rows, never saved.
 await p.evaluate(()=>{UPAH_ITEMS=[{id:1,pelapor:'YIT',tgl:'2026-11-01',status:'lunas',tarif:50000,qty:1,aktivitas:'fixture'},{id:2,pelapor:'YIT',tgl:'2026-11-01',status:'belum',tarif:50000,qty:1,aktivitas:'fixture'}];CASHBOOK=[{id:'fixture-c1',ref:'upah_1',tgl:'2026-11-01',keluar:50000},{id:'fixture-c2',ref:'upah_1',tgl:'2026-11-01',keluar:50000},{id:'fixture-c3',ref:'upah_2',tgl:'2026-11-01',keluar:50000}];});
 for(const tab of ['paid','unpaid','dup','upahdup','orphan']){
  await p.evaluate(tab=>{openAuditModal();switchAuditTab(tab);},tab);await p.waitForTimeout(65);
  const repaired=await p.locator('#audit-content button').evaluateAll(nodes=>nodes.map(n=>({code:n.getAttribute('onclick'),hidden:n.hidden,retired:n.dataset.retiredRepair})));
  for(const row of repaired)assert.ok(row.hidden&&row.retired,'only retired audit mutations are hidden: '+row.code);
  result.checks.push('retired audit '+tab+' controls hidden, rows retained at '+width);
 }
 await p.evaluate(()=>{closeAuditModal();window.RECONCILE_MATRIX=['ORPHAN_UPAH','DOUBLE_PAY','LEGIT_WHITELIST'].map((verdict,i)=>({tgl:'2026-11-0'+(i+1),pelapor:'YIT',hak:50000,aktivitas:'fixture',upah:{id:1,status:'lunas'},cashflows:[],bukti:null,verdict}));renderReconcileMatrix();});
 await p.waitForTimeout(65);
 assert.equal(await p.locator('#reconcile-matrix-tbody tr').count(),3);
 assert.equal(await p.locator('#reconcile-matrix-tbody button:not([hidden])').count(),0);
 assert.equal(await p.locator('button[onclick="openTrxModal(\'masuk\')"][hidden]').count(),0,'ordinary operational entry not blanket hidden');
 result.checks.push('retired reconcile repair only; ordinary operational writes retained at '+width);
 await p.evaluate(()=>{window.CABUT_BORONGAN=[{id:'fixture-photo',photos:[{data_url:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%2374465f"/></svg>'}]}];lihatFotoBorongan('fixture-photo',0);});
 await p.waitForTimeout(65);
 assert.equal(await p.locator('[data-report-private-overlay]').getAttribute('role'),'dialog','photo lightbox is a named accessible dialog');
 await p.locator('[data-report-private-overlay]').click();
 await p.evaluate(()=>openHeroLightbox({target:document.getElementById('form-hero-banner')}));await p.waitForTimeout(65);
 assert.equal(await p.locator('#hero-lightbox').getAttribute('role'),'dialog');
 await p.locator('#hero-lightbox .dashboard-popup-media-close').click();
 assert.equal(await p.locator('#hero-lightbox').isVisible(),false);
 await p.evaluate(()=>{document.activeElement.blur();openHeroLightbox({target:document.getElementById('form-hero-banner')});});await p.waitForTimeout(65);
 assert.equal(await p.locator('#hero-lightbox').evaluate(n=>n.contains(document.activeElement)),true,'reopened class-driven photo dialog receives focus');
 await p.locator('#hero-lightbox .dashboard-popup-media-close').click();
 result.checks.push('photo/report and hero lightboxes accessible and close safely at '+width);
 if(width===1440){
  result.popupRootInventory=await p.evaluate(()=>[...document.querySelectorAll('.dashboard-popup,.dashboard-popup-native')].map(n=>({id:n.id,tag:n.tagName,route:n.closest('.panel')?.id||'shell',state:getComputedStyle(n).display,media:n.classList.contains('dashboard-popup-media')})));
  result.controls=await p.evaluate(()=>{
   const controls=[...document.querySelectorAll('button,a[href],input,select,textarea,summary,[onclick],[onchange],[oninput]')];
   const alerts=[],reached=new Set();window.alert=m=>alerts.push(String(m));
   const stopper=e=>{reached.add(e.target);e.preventDefault();e.stopImmediatePropagation();};
   for(const type of ['click','change','input','submit'])document.addEventListener(type,stopper,true);
   const rows=controls.map((n,index)=>{const event=n.matches('input,select,textarea')?'change':'click',start=alerts.length;n.dispatchEvent(new Event(event,{bubbles:true,cancelable:true}));const code=n.getAttribute('onclick')||n.getAttribute('onchange')||n.getAttribute('oninput')||'';return {index,id:n.id,tag:n.tagName,route:n.closest('.panel')?.id||'shell',text:(n.textContent||n.getAttribute('aria-label')||'').trim().slice(0,140),handler:code,hidden:!!n.closest('[hidden]'),retired:n.dataset.retiredRepair||n.closest('[data-retired-repair]')?.dataset.retiredRepair||null,captureProbe:alerts.length>start?'existing guard refusal':reached.has(n)?'reached safety stopper; target deliberately not executed':'not reached',classification:!code?'native/presentation':/export|render|showLaporanRelated|printKajian|generateRekap|generateBukti|runReconciliation/.test(code)?'read/output candidate: retain':/save|submit|delete|paid|publish|sync|edit|Bayar|Merge|Revert|recover|reset/i.test(code)?'operational mutation/hold: retain unless exact retired allowlist':'needs handler trace / presentation'};});
   for(const type of ['click','change','input','submit'])document.removeEventListener(type,stopper,true);
   return rows;
  });
  result.controlCount=result.controls.length;
  result.routes=[...new Set(result.controls.map(x=>x.route))].sort();
  result.routeCount=result.routes.length;
  result.guardedControlCount=result.controls.filter(x=>x.captureProbe==='existing guard refusal').length;
  result.retiredHiddenCount=result.controls.filter(x=>x.retired&&x.hidden).length;
  const source=fs.readFileSync(root+'/monitor-v2.html','utf8');
  result.nativeCallsites=Object.fromEntries(['alert','confirm','prompt'].map(name=>[name,[...source.matchAll(new RegExp('\\b'+name+'\\s*\\(','g'))].length]));
 }
 const guard=await p.evaluate(()=>{
  const messages=[];window.alert=m=>messages.push(String(m));
  document.querySelectorAll('.panel').forEach(n=>n.classList.toggle('active',n.id==='panel-keuangan'));
  const btn=document.querySelector('button[onclick="openTrxModal(\'masuk\')"]');btn.click();
  return {messages,open:getComputedStyle(document.getElementById('trx-modal-overlay')).display};
 });
 assert.match(guard.messages[0]||'',/dilindungi/,'existing unsigned management guard still refuses actual click');
 assert.equal(guard.open,'none','visual code does not authorize operational write opener');
 result.checks.push('actual unsigned management click still refused; no auth bypass at '+width);
 assert.equal(await p.evaluate(()=>window.dashboardReadModel.ownerActive()),true,'public read remains available');
 await context.close();
 }
 result.popupOpenCount=result.popups.length;
 result.uniqueOpenedPopupCount=new Set(result.popups.map(x=>x.id)).size;
 result.additionalMediaOpenCount=6;
 result.viewportCounts=Object.fromEntries([1440,390,320].map(w=>[w,result.popups.filter(x=>x.width===w).length]));
 assert.deepEqual(Object.values(result.viewportCounts),[24,24,24]);
 assert.deepEqual(result.errors,[],'no runtime errors');
 assert.ok(result.requests.every(x=>x.method==='GET'),'no mutation request attempted');
 const crypto=require('node:crypto');
 result.sourceHashes=Object.fromEntries(['monitor-v2.html','recovery/entry-recovery.js','recovery/restored-dashboard.js',script,css,'recovery/payroll-ui.mjs', 'tests/dashboard-ui-consolidation.browser.cjs'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex')]));
 const source=fs.readFileSync(root+'/monitor-v2.html','utf8');
 result.enumeratedOverlayIds=[...new Set([...source.matchAll(/<(?:div|dialog)[^>]*id="([^"]+)"[^>]*>/g)].filter(m=>m[0].includes('position:fixed')||m[0].startsWith('<dialog')).map(m=>m[1]))].filter(id=>id!=='bukti-bayar-render');
 result.nonPopupExclusions=['sb-overlay: navigation scrim','bukti-bayar-render: offscreen export canvas, not dialog','toasts: transient status, existing semantic colors retained','window.open: browser tabs/print windows, not CSS-styleable dashboard dialogs','login-overlay: retired access shell themed but deliberately not reactivated'];
 result.templateHandlerInventory=[...new Set([...source.matchAll(/on(?:click|change|input|submit)="([^"]+)"/g)].map(m=>m[1]))];
 result.templateHandlerCount=result.templateHandlerInventory.length;
 result.passed=true;
}catch(e){result.passed=false;result.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/manifest.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}})();
