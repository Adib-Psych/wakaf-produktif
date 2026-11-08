'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../monitor-v2.html'),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function actualFunction(name){
 const source=html.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n\\}'));
 assert(source,'actual '+name+' must exist');return source[0];
}
function harness(names,extra={}){
 const context={console,Date,Blob,structuredClone,...extra};context.window=context;vm.createContext(context);
 const helpers=['cashbookForFund'];
 for(const name of [...helpers,...names]){if(helpers.includes(name)&&!html.includes('function '+name+'('))continue;vm.runInContext(actualFunction(name),context);}
 return context;
}
const legacyCash=[
 {id:'legacy_in',tgl:'2000-01-01',tipe:'masuk',masuk:1000000,keluar:0,ket:'Legacy deposit'},
 {id:'legacy_wage',tgl:'2000-01-02',tipe:'bayar_upah',masuk:0,keluar:120000,kat:'3.1',ket:'Legacy wage'},
 {id:'wakaf_wage',tgl:'2000-01-03',tipe:'bayar_upah',masuk:0,keluar:100000,kat:'3.2',fund:'K1_K3',ket:'Wakaf wage'},
 {id:'legacy_purchase',tgl:'2000-01-04',tipe:'keluar_langsung',masuk:0,keluar:50000,kat:'1.1',ket:'Legacy purchase'},
 {id:'legacy_transfer',tgl:'2000-01-05',tipe:'transfer_anto',masuk:0,keluar:30000,kat:'4.1',ket:'Legacy transfer'},
 {id:'legacy_anto',tgl:'2000-01-06',tipe:'keluar_anto',masuk:0,keluar:10000,kat:'4.1',ket:'Legacy settlement'}
];
const rab={'2026':{periode:'Synthetic cycle',kategori:[{id:'1',items:[{qty:1,hf:200000}]},{id:'3',items:[{qty:1,hf:300000}]},{id:'4',items:[{qty:1,hf:100000}]}]}};
function dom(){
 const nodes=new Map();
 const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',style:{}});return nodes.get(id);};
 return {nodes,get,document:{getElementById:get,querySelectorAll:()=>[]}};
}
const privateCash=[
 {id:'cb_payroll_private',tgl:'2000-02-01',tipe:'bayar_upah',masuk:0,keluar:90000,kat:'3.2',ket:'Private K4 work',fund:'K4',src:'payroll',ref:'upah_private'},
 {id:'private_in',tgl:'2000-02-01',tipe:'masuk',masuk:200000,keluar:0,ket:'Private deposit',fund:'K4'}
];
test('K4 cash delta never changes historical Wakaf balance or RAB actuals; full source remains intact',()=>{
 const c=harness(['computeSaldo','getKategoriAktual','getItemAktual'],{CASHBOOK:structuredClone(legacyCash)});
 const amounts=()=>({saldo:plain(c.computeSaldo()),labor:c.getKategoriAktual('3'),wage:c.getItemAktual('3.2'),purchase:c.getItemAktual('1.1')});
 const before=amounts();
 assert.deepEqual(before,{saldo:{kasWakif:700000,antoSaldo:20000,antoIn:30000,antoOut:10000},labor:220000,wage:100000,purchase:50000});
 c.CASHBOOK.push(...structuredClone(privateCash));const snapshot=plain(c.CASHBOOK);
 assert.deepEqual(amounts(),before,'private payment and private deposit must not debit/credit Wakaf');
 assert.deepEqual(plain(c.CASHBOOK),snapshot,'report partition must not mutate or discard ledger rows');
});
test('accounting keeps Wakaf KPI/table unchanged and visibly reports separate K4 actual payments with history',()=>{
 const d=dom(),c=harness(['renderCashbook','fmtRp'],{document:d.document,CASHBOOK:structuredClone(legacyCash),formatTglShort:x=>x});
 c.renderCashbook();
 const ids=['total-masuk-display','total-bayar-pekerja-display','total-pengeluaran-display','ringkasan-masuk','ringkasan-keluar','ringkasan-saldo'];
 const before=ids.map(id=>d.get(id).textContent),oldTable=d.get('cashbook-tbody').innerHTML;
 assert.deepEqual(before,['Rp. 1.000.000,-','Rp. 220.000,-','Rp. 300.000,-','Rp. 1.000.000,-','Rp. 300.000,-','Rp. 700.000,-']);
 c.CASHBOOK.push(...structuredClone(privateCash));const full=plain(c.CASHBOOK);c.renderCashbook();
 assert.deepEqual(ids.map(id=>d.get(id).textContent),before,'K4 must not affect Wakaf accounting');
 assert.equal(d.get('cashbook-tbody').innerHTML,oldTable);
 assert.equal(d.get('total-k4-private-payments').textContent,'Rp. 90.000,-');
 assert.match(d.get('k4-private-cashbook-tbody').innerHTML,/Private K4 work/);
 assert.match(d.get('k4-private-cashbook-tbody').innerHTML,/2000-02-01/);
 assert.match(html,/<section[^>]*id="k4-private-accounting"[^>]*>[\s\S]*?K4 pribadi[\s\S]*?tidak mengurangi Kas Wakif[\s\S]*?<\/section>/i);
 assert.deepEqual(plain(c.CASHBOOK),full);
});
test('dashboard burn rate and planned/actual comparison chart exclude private K4 delta',()=>{
 const d=dom(),charts=[];
 function Chart(_ctx,config){charts.push(plain(config));}Chart.getChart=()=>null;
 const c=harness(['renderDashboard','renderBudgetChart'],{document:d.document,CASHBOOK:structuredClone(legacyCash),STATE:{laporan:[]},RAB_DATA:rab,ownerCashbookKnown:true,Chart,getComputedStyle:()=>({getPropertyValue:()=>''})});
 c.renderDashboard();c.renderBudgetChart();
 const before=[d.get('kpi-budget').textContent,d.get('kpi-budget-trend').textContent,charts.at(-1).data];
 assert.equal(before[0],'Rp. 300.000,- / Rp. 600.000,-');
 assert.deepEqual(before[2].datasets[1].data,[260000,0,50000,0]);
 c.CASHBOOK.push(...structuredClone(privateCash));c.renderDashboard();c.renderBudgetChart();
 assert.deepEqual([d.get('kpi-budget').textContent,d.get('kpi-budget-trend').textContent,charts.at(-1).data],before);
});
test('monthly cash summaries, Wakaf month filters and Anto ledger never include K4 cash',()=>{
 const d=dom(),now=new Date().toISOString().slice(0,10);
 const cash=structuredClone(legacyCash).map(t=>({...t,tgl:now}));
 const c=harness(['renderKeuangan','computeSaldo','fmtRp','populateCashbookFilters','renderAntoLedger'],{document:d.document,CASHBOOK:cash,RAB_DATA:rab,CURRENT_CYCLE:'2026',renderCashbook(){},updateNotaStorageStatus(){},formatTglShort:x=>x});
 c.renderKeuangan();const ids=['bulan-masuk','bulan-keluar','saldo-wakif-display','anto-total-in','anto-total-out','anto-sisa'];
 const before=ids.map(id=>d.get(id).textContent),anto=d.get('anto-tbody').innerHTML,months=d.get('filter-cb-bulan').innerHTML;
 assert.deepEqual(before,['Rp. 1.000.000,-','Rp. 300.000,-','Rp. 700.000,-','Rp. 30.000,-','Rp. 10.000,-','Rp. 20.000,-']);
 c.CASHBOOK.push(...structuredClone(privateCash).map(t=>({...t,tgl:now})),{id:'private_month',tgl:'1999-12-31',tipe:'transfer_anto',keluar:5000,fund:'K4',ket:'Private transfer'},{id:'private_anto',tgl:now,tipe:'keluar_anto',keluar:4000,fund:'K4',ket:'Private settlement'});
 c.renderKeuangan();assert.deepEqual(ids.map(id=>d.get(id).textContent),before);assert.equal(d.get('anto-tbody').innerHTML,anto);assert.equal(d.get('filter-cb-bulan').innerHTML,months);
});

test('K4 wage work and both payment controls remain visible with explicit private funding label',()=>{
 const d=dom(),wages=[{id:1,tgl:'2000-01-02',pelapor:'TEST',aktivitas:'Wakaf task',model:'harian',qty:1,tarif:100000,status:'belum'},
 {id:'private_unpaid',tgl:'2000-01-03',pelapor:'TEST',aktivitas:'Private unpaid task',model:'harian',qty:1,tarif:90000,status:'belum',fund:'K4'},
 {id:'private_paid',tgl:'2000-01-04',pelapor:'TEST',aktivitas:'Private paid task',model:'harian',qty:1,tarif:80000,status:'lunas',fund:'K4',bayar_tgl:'2000-01-05'}];
 const c=harness(['renderUpahTable'],{document:d.document,UPAH_ITEMS:structuredClone(wages),calcTotal:w=>w.qty*w.tarif,fmtRpShort:String,formatTgl:x=>x,workerPillHtml:x=>x});
 d.get('filter-bayar-archive').value='active';c.renderUpahTable();const out=d.get('upah-tbody').innerHTML;
 assert.equal((out.match(/class="upah-check"/g)||[]).length,3);assert.match(out,/Private unpaid task/);assert.match(out,/Private paid task/);
 assert.equal((out.match(/K4 pribadi/g)||[]).length,2);assert.match(out,/openPaidModalById/);assert.match(out,/markUnpaid/);
 assert.deepEqual(plain(c.UPAH_ITEMS),wages);
});
test('cashbook CSV revalidates fresh projected cash then exports Wakaf only, never stale local or K4 rows',async()=>{
 const d=dom(),blobs=[],downloads=[];d.document.createElement=()=>({click(){downloads.push(this.download);}});
 const fresh=structuredClone([...legacyCash,...privateCash]);
 const c=harness(['exportCashbookCSV','spreadsheetCSVCell'],{document:d.document,CASHBOOK:[{id:'stale',ket:'STALE LOCAL'}],privateReader:{exportRead:async(required,emit)=>{assert.deepEqual(plain(required),['cashbook']);return emit({cashbook:[{id:'active',data:{data:fresh}}]});}},URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:test';},revokeObjectURL(){}},alert:message=>{throw Error(message);}});
 await c.exportCashbookCSV();assert.equal(blobs.length,1);const csv=await blobs[0].text();assert.match(csv,/Legacy wage/);assert.doesNotMatch(csv,/Private K4 work|Private deposit|STALE LOCAL/);assert.equal(csv.split('\n').length,legacyCash.length+1);assert.match(downloads[0],/^cashbook_wakaf_/);assert.deepEqual(fresh,[...legacyCash,...privateCash]);
});

test('active applyOwnerSnapshot retains all paired payroll rows while renderers exclude only new K4 cash delta',async()=>{
 const {buildPayrollState,projectPayroll}=await import('./payroll-contract.mjs');
 const wages=[0,1,2,3].map(i=>({id:'synthetic_boundary_'+i,tgl:'2000-01-02',pelapor:'TEST',aktivitas:'Boundary task '+i,model:'harian',qty:1,tarif:10000*(i+1),status:'belum',...(i>=2?{fund:'K4'}:{})}));
 const state=w=>buildPayrollState({wage:w,status:'lunas',paidDate:'2000-01-03',source:w.fund==='K4'?'pribadi':'wakif',eventId:'payment_'+w.id,uid:'synthetic_owner',stamp:'2000-01-03T00:00:00Z'});
 const states=wages.slice(0,3).map(state); // Prior paired states are preserved, never assumed zero.
 const d=dom(),c=harness(['renderCashbook','computeSaldo','getItemAktual','fmtRp','renderUpahTable'],{document:d.document,calcTotal:w=>w.qty*w.tarif,fmtRpShort:String,formatTgl:x=>x,formatTglShort:x=>x,workerPillHtml:x=>x});
 vm.runInContext('let UPAH_ITEMS=[],CASHBOOK=[],OPT_OBSERVATIONS=[],PANEN_DATA=[],PANEN_LOTS_DATA=[],PANEN_SAMPLING_DATA=[],MILESTONES=[],SOP_STATUS={},CABUT_DATA=[],BENCHMARK_DATA=[],KASBON_DATA=[],PUPUK_DATA={},DISTRIBUSI_DATA=[];const STATE={laporan:[]},WORKER_DEFS=[],SOP_AKTIVITAS_PER_BULAN={};',c);
 const a=html.indexOf('window.applyOwnerSnapshot=v=>{'),b=html.indexOf('\n};',a);assert(a>0&&b>a);vm.runInContext(html.slice(a,b+3),c);
 const base=projectPayroll({upah:wages,cashbook:legacyCash,states});c.applyOwnerSnapshot({reports:[],...base});
 assert.deepEqual(plain(c.ownerRenderErrors),[]);const before={saldo:plain(c.computeSaldo()),actual:c.getItemAktual('3.2'),wakaf:d.get('total-pengeluaran-display').textContent};
 assert.equal(d.get('total-k4-private-payments').textContent,'Rp. 30.000,-');
 const next=projectPayroll({upah:wages,cashbook:legacyCash,states:[...states,state(wages[3])]});c.applyOwnerSnapshot({reports:[],...next});
 assert.deepEqual({saldo:plain(c.computeSaldo()),actual:c.getItemAktual('3.2'),wakaf:d.get('total-pengeluaran-display').textContent},before);
 assert.equal(d.get('total-k4-private-payments').textContent,'Rp. 70.000,-');
 assert.equal((d.get('upah-tbody').innerHTML.match(/class="upah-check"/g)||[]).length,4);
 assert.deepEqual(plain(vm.runInContext('CASHBOOK',c)),plain(next.cashbook));
 assert.deepEqual(next.cashbook.slice(0,legacyCash.length),legacyCash);
 const restored=fs.readFileSync(path.join(__dirname,'restored-dashboard.js'),'utf8'),reader=fs.readFileSync(path.join(__dirname,'public-reader.js'),'utf8');
 assert.match(reader,/projectPayroll\(\{upah:value.upah,cashbook:value.cashbook,states\}\)/);
 assert.match(restored,/window.applyOwnerSnapshot\(snapshot\)/);assert.match(restored,/window\[fn\]\?\.\(\)/);
 assert.doesNotMatch(restored,/window\.(?:renderCashbook|renderDashboard|renderBudgetChart|renderUpahTable)\s*=/);
});

test('isolated browser active restored public-live route preserves Wakaf totals and exposes K4 private history at desktop/mobile widths',async()=>{
 const {chromium}=require('./node_modules/playwright');
 const {buildPayrollState,projectPayroll}=await import('./payroll-contract.mjs');
 const wage={id:'synthetic_browser_k4',tgl:'2000-01-02',pelapor:'TEST',aktivitas:'Private browser work',model:'harian',qty:1,tarif:90000,status:'belum',fund:'K4'};
 const state=buildPayrollState({wage,status:'lunas',paidDate:'2000-01-03',source:'pribadi',eventId:'synthetic_browser_paid',uid:'synthetic_owner',stamp:'2000-01-03T00:00:00Z'});
 const base={reports:[],upah:[wage],cashbook:legacyCash,workers:[],pic:[],kasbon:[],sop:null,sopStatus:null,panen:null,wageBindings:[],_meta:{}};
 const paid={...base,...projectPayroll({upah:[wage],cashbook:legacyCash,states:[state]})};
 const names=['cashbookForFund','computeSaldo','getKategoriAktual','getItemAktual','renderCashbook','renderKeuangan','populateCashbookFilters','renderAntoLedger','renderUpahTable','fmtRp','renderDashboard','renderBudgetChart'];
 const start=html.indexOf('window.applyOwnerSnapshot=v=>{'),end=html.indexOf('\n};',start);
 const script=`let UPAH_ITEMS=[],CASHBOOK=[],OPT_OBSERVATIONS=[],PANEN_DATA=[],PANEN_LOTS_DATA=[],PANEN_SAMPLING_DATA=[],MILESTONES=[],SOP_STATUS={},CABUT_DATA=[],BENCHMARK_DATA=[],KASBON_DATA=[],PUPUK_DATA={},DISTRIBUSI_DATA=[];const STATE={laporan:[]},WORKER_DEFS=[],SOP_AKTIVITAS_PER_BULAN={};window.privateViewEpoch=0;const RAB_DATA=${JSON.stringify(rab)},CURRENT_CYCLE='2026';function calcTotal(w){return w.qty*w.tarif}function formatTgl(x){return x}function formatTglShort(x){return x}function workerPillHtml(x){return x}function fmtRpShort(x){return String(x)}function updateNotaStorageStatus(){}window.clearOwnerSnapshot=()=>{};window.normalizeOwnerReport=x=>x;window.Chart=class {static getChart(){return null}constructor(ctx,config){window.chartConfig=config}};${names.map(actualFunction).join('\n')}\n${html.slice(start,end+3)};window.fixtures=${JSON.stringify([base,paid])};window.fixtureIndex=0;`;
 const body=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</body>',`<script>${script}</script><script type="module">import {mountPrivateDashboard} from '/recovery/restored-dashboard.js';window.model=await mountPrivateDashboard({}, {load:async()=>fixtures[fixtureIndex],mode:'public-live'});window.testReady=true;</script></body>`);
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'});
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='www.gstatic.com')return route.fulfill({contentType:'text/javascript',body:'export const initializeApp=()=>({}),getFirestore=()=>({}),doc=()=>({}),getDocFromServer=()=>{};'});
   if(url.hostname!=='fund-reporting.test')return route.abort();
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body});
   const filename=path.join(__dirname,'..',url.pathname);
   if(!filename.startsWith(path.join(__dirname,'..')+path.sep)||!fs.existsSync(filename))return route.abort();
   return route.fulfill({contentType:/\.(?:mjs|js)$/.test(filename)?'text/javascript':filename.endsWith('.css')?'text/css':'application/octet-stream',body:fs.readFileSync(filename)});
  });
  await page.goto('https://fund-reporting.test/');await page.waitForFunction(()=>window.testReady);
  await page.evaluate(()=>{document.querySelectorAll('.panel').forEach(n=>n.classList.remove('active'));document.getElementById('panel-keuangan').classList.add('active');});
  const before=await page.locator('#total-pengeluaran-display').innerText();assert.equal(before,'Rp. 300.000,-',JSON.stringify(await page.evaluate(()=>({errors:window.ownerRenderErrors,status:document.getElementById('restored-source-status')?.textContent,cash:CASHBOOK})))+' browserErrors='+JSON.stringify(errors));
  await page.evaluate(async()=>{fixtureIndex=1;await model.refresh();});
  assert.equal(await page.locator('#total-pengeluaran-display').innerText(),before);
  assert.equal(await page.locator('#total-k4-private-payments').innerText(),'Rp. 90.000,-');
  assert.equal(await page.locator('#k4-private-accounting').isVisible(),true);
  assert.match(await page.locator('#k4-private-accounting').innerText(),/Private browser work/);
  assert.doesNotMatch(await page.locator('#cashbook-tbody').innerText(),/Private browser work/);
  assert.match(await page.locator('#upah-tbody').innerText(),/K4 pribadi/);
  assert.deepEqual(await page.evaluate(()=>ownerRenderErrors),[]);assert.deepEqual(errors,[]);
  await context.close();
 }}finally{await browser.close();}
});
