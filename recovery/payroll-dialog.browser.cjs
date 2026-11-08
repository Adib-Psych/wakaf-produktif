'use strict';
// Isolated synthetic fixture: every request is fulfilled locally, never production.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('./node_modules/playwright');
const artifactDir=process.env.PAYROLL_ARTIFACT_DIR||path.join(process.env.TMPDIR||require('node:os').tmpdir(),'payroll-dialog-ui');const defaultChrome=()=>{try{return require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'../tests/browser-path.cjs')],{encoding:'utf8'}).trim();}catch{return chromium.executablePath();}};
const widths=[1440,390];
async function fixture(width,run){
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||defaultChrome()});
 const context=await browser.newContext({viewport:{width,height:width<500?740:1000},serviceWorkers:'block',isMobile:width<500,hasTouch:width<500});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.route('**/*',route=>{
   const pathname=new URL(route.request().url()).pathname;
   const assets={'/payroll-ui.mjs':'text/javascript','/entry-recovery.js':'text/javascript','/harvest-presentation.css':'text/css'};
   if(assets[pathname])return route.fulfill({contentType:assets[pathname],body:fs.readFileSync(path.join(__dirname,pathname),'utf8')});
   if(pathname!=='/')return route.abort();
   return route.fulfill({contentType:'text/html',body:`<!doctype html><html data-report-entry="device"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/harvest-presentation.css"><style>body{margin:0;padding:24px}label{display:inline-flex;align-items:center}input,select,textarea{width:auto;padding:8px;border:1px solid #999}button{padding:6px;background:#ddd;border:1px solid #999}table{width:100%}td{padding:10px}#fixture-unrelated{background:rgb(221,221,221)}</style></head><body data-report-entry="device"><h1>Musim Panen · Uji pencatatan</h1><button id="fixture-unrelated">Tombol dashboard</button><div id="panel-anggaran"><button onclick="batchPay()">Batch</button><button id="legacy" onclick="confirmPaid()">Legacy</button><table><tbody id="upah-tbody"></tbody></table></div><button id="device-entry-signin">Google</button><script>
window.alerts=[];window.alert=m=>alerts.push(m);window.signed=true;window.failSave=true;window.holdSave=false;window.legacyWrites=0;window.confirmPaid=()=>legacyWrites++;window.dashboardReadModel={ownerActive:()=>true};window.calls=[];window.intent=null;
window.wages=[{id:'w_20261001_nardi',tgl:'2026-10-01',aktivitas:'Panen kopi',tarif:50000,qty:2,fund:'K1'},{id:'w_k4_nardi',tgl:'2026-10-02',aktivitas:'Pekerjaan kebun pribadi K4',tarif:75000,qty:2,fund:'K4'},{id:'w_k4_revised',tgl:'2026-10-03',aktivitas:'Koreksi upah pribadi K4',tarif:50000,qty:1,fund:'K4',payroll_revision:1},{id:'w_legacy',tgl:'2026-10-04',aktivitas:'Riwayat lama',tarif:50000,qty:1,fund:'K1'}];
window.renderRows=()=>{document.querySelector('#upah-tbody').innerHTML=wages.map((w,i)=>'<tr data-wage="'+w.id+'"><td><input class="upah-check" data-id="'+w.id+'">'+w.aktivitas+'</td><td><button onclick="'+(i>1?'markUnpaid':'openPaidModalById')+'('+w.id+')">Bayar</button></td></tr>').join('');};renderRows();
</script><script src="/entry-recovery.js"></script><script type="module">import {mountPayrollUI} from '/payroll-ui.mjs';window.payrollRecording=mountPayrollUI({document,readWages:()=>wages,sessionAvailable:()=>signed,readIntent:()=>intent,record:async data=>{calls.push(data);if(holdSave)await new Promise(resolve=>window.releaseSave=resolve);if(failSave)throw Error('izin dicabut');}});window.testReady=true;</script></body></html>`});
  });
  await page.goto('https://payroll.test/');await page.waitForFunction(()=>window.testReady);
  await run(page);
  assert.deepEqual(errors,[],'no browser runtime errors');
 }finally{await context.close();await browser.close();}
}
const action=(page,id,type='paid')=>page.locator(`tr[data-wage="${id}"] [data-payroll-action="${type}"]`);
for(const width of widths){
 test(`K4 capture and allocation come from wages, not a source switch (${width}px)`,()=>fixture(width,async page=>{
  assert.equal(await action(page,'w_k4_nardi').count(),1,'K4 payment button must stay available');
  assert.equal(await action(page,'w_k4_revised','unpaid').count(),1,'K4 revision correction must stay available');
  await action(page,'w_k4_nardi').click();
  assert.equal(await page.locator('dialog select').inputValue(),'pribadi');
  assert.equal(await page.locator('dialog select').isDisabled(),true,'allocation is not user-selectable');
  assert.equal(await page.locator('dialog select option').count(),1);
  assert.match(await page.locator('dialog').innerText(),/pribadi K4/);
  await page.locator('input[type="date"]').fill('2026-11-01');
  await page.locator('textarea').fill('Dibayar dari rekening pribadi');
  await page.locator('[data-payroll-action="save"]').click();
  await page.waitForFunction(()=>calls.length===1&&!document.querySelector('[data-payroll-action="save"]').disabled);
  assert.deepEqual(await page.evaluate(()=>calls[0]),{id:'w_k4_nardi',status:'lunas',paidDate:'2026-11-01',source:'pribadi',reason:'Dibayar dari rekening pribadi'});
  assert.match(await page.locator('dialog [role="status"]').innerText(),/izin dicabut/);
  assert.equal(await page.locator('input[type="date"]').inputValue(),'2026-11-01');
  await page.locator('[data-payroll-action="close"]').click();
  await action(page,'w_20261001_nardi').click();
  assert.equal(await page.locator('dialog select').inputValue(),'wakif');
  assert.equal(await page.locator('dialog select').isDisabled(),true);
  assert.equal(await page.locator('dialog select option').count(),1);
  await page.locator('input[type="date"]').fill('2026-11-01');
  await page.locator('[data-payroll-action="save"]').click();
  await page.waitForFunction(()=>calls.length===2&&!document.querySelector('[data-payroll-action="save"]').disabled);
  assert.equal(await page.evaluate(()=>calls[1].source),'wakif');
  await page.locator('[data-payroll-action="close"]').click();
  await action(page,'w_k4_revised','unpaid').click();
  assert.equal(await page.locator('input[type="date"]').isDisabled(),true);
  await page.locator('textarea').fill('Koreksi penerimaan belum terjadi');
  await page.locator('[data-payroll-action="save"]').click();
  await page.waitForFunction(()=>calls.length===3&&!document.querySelector('[data-payroll-action="save"]').disabled);
  assert.equal(await page.evaluate(()=>calls[2].status),'belum');
  assert.equal(await page.evaluate(()=>calls[2].source),'pribadi');
  assert.equal(await action(page,'w_legacy','unpaid').count(),0,'legacy correction hold remains');
 }));
}
for(const width of widths){
 test(`owned controls, durable intent, unsaved form and busy safety remain intact (${width}px)`,()=>fixture(width,async page=>{
  await page.evaluate(()=>signed=false);
  await action(page,'w_k4_nardi').click();
  assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);
  assert.match(await page.locator('#payroll-recording-status').innerText(),/Masuk/);
  await page.evaluate(()=>{signed=true;intent={input:{id:'w_k4_nardi',status:'lunas',paidDate:'2026-11-02',source:'pribadi',reason:'Percobaan tertunda'}};});
  await action(page,'w_20261001_nardi').click();
  assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);
  assert.match(await page.locator('#payroll-recording-status').innerText(),/belum pasti/);
  await action(page,'w_k4_nardi').click();
  assert.equal(await page.getByLabel('Tanggal pembayaran',{exact:true}).inputValue(),'2026-11-02');
  assert.equal(await page.getByLabel('Catatan / alasan koreksi',{exact:true}).inputValue(),'Percobaan tertunda');
  assert.equal(await page.getByLabel('Sumber pembayaran',{exact:true}).inputValue(),'pribadi');
  await page.getByLabel('Catatan / alasan koreksi',{exact:true}).fill('Tetap ada setelah pembaruan tabel');
  await page.evaluate(()=>renderRows());
  await page.waitForFunction(()=>document.querySelectorAll('#upah-tbody [data-payroll-action="paid"]').length===2);
  assert.equal(await page.getByLabel('Catatan / alasan koreksi',{exact:true}).inputValue(),'Tetap ada setelah pembaruan tabel');
  assert.equal(await page.evaluate(()=>payrollRecording.allowsAction(document.querySelector('[data-payroll-action="save"]'))),true);
  assert.equal(await page.evaluate(()=>{const spoof=document.createElement('button');spoof.dataset.payrollAction='save';return payrollRecording.allowsAction(spoof);}),false);
  await page.evaluate(()=>{holdSave=true;failSave=false;});
  await page.getByRole('button',{name:'Simpan pencatatan',exact:true}).click();
  await page.waitForFunction(()=>typeof releaseSave==='function');
  assert.equal(await page.locator('[data-payroll-action="save"]').isDisabled(),true);
  assert.equal(await page.locator('[data-payroll-action="close"]').isDisabled(),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').evaluate(d=>d.open),true,'busy dialog cannot be dismissed');
  await page.evaluate(()=>releaseSave());
  await page.waitForFunction(()=>!document.querySelector('dialog').open);
  assert.equal(await page.evaluate(()=>calls.length),1);
  await page.locator('#legacy').click();
  assert.equal(await page.evaluate(()=>legacyWrites),0);
  assert.equal(await page.evaluate(()=>alerts.length),1);
  assert.equal(await page.locator('button[onclick="batchPay()"]').isDisabled(),true);
 }));
}
for(const width of [1440,390,320]){
 test(`named, stacked Musim Panen dialog fits and keeps feedback/actions visible (${width}px)`,()=>fixture(width,async page=>{
  await action(page,'w_k4_nardi').click();
  const dialog=page.getByRole('dialog',{name:'Catat upah sudah dibayar',exact:true});
  assert.equal(await dialog.count(),1,'dialog must have its visible heading as accessible name');
  await page.getByLabel('Tanggal pembayaran',{exact:true}).fill('2026-11-01');
  await page.getByLabel('Catatan / alasan koreksi',{exact:true}).fill('Pembayaran tunai telah diterima pekerja.');
  assert.match(await dialog.innerText(),/Tanggal kerja/);
  assert.match(await dialog.innerText(),/2026-10-02/);
  assert.match(await dialog.innerText(),/Rp\s*150\.000/);
  assert.match(await dialog.innerText(),/tidak masuk kas wakaf/i);
  const geometry=await dialog.evaluate(d=>{
   const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   const fields=[...d.querySelectorAll('input,select,textarea')].map(n=>({rect:rect(n),label:rect(n.closest('label')),labelText:rect(n.closest('label').querySelector('span')),style:getComputedStyle(n).boxSizing}));
   return {dialog:rect(d),fields,overflow:d.scrollWidth>d.clientWidth,viewport:{width:innerWidth,height:innerHeight},save:rect(d.querySelector('[data-payroll-action="save"]')),close:rect(d.querySelector('[data-payroll-action="close"]')),colors:[getComputedStyle(d.querySelector('[data-payroll-action="save"]')).backgroundColor,getComputedStyle(d.querySelector('[data-payroll-action="close"]')).backgroundColor]};
  });
  assert.equal(geometry.overflow,false,'dialog has no horizontal scroll');
  assert.ok(geometry.dialog.x>=0&&geometry.dialog.right<=geometry.viewport.width);
  assert.ok(geometry.dialog.y>=0&&geometry.dialog.bottom<=geometry.viewport.height);
  for(const field of geometry.fields){
   assert.ok(field.rect.y>=field.labelText.bottom+3,'label stacks above input with a gap');
   assert.ok(Math.abs(field.rect.width-field.label.width)<2,'input occupies full field width');
   assert.ok(field.rect.height>=44,'touch target is at least 44px');
   assert.equal(field.style,'border-box');
  }
  assert.ok(Math.abs(geometry.fields[0].rect.width-geometry.fields[2].rect.width)<2,'consistent widths');
  assert.notEqual(...geometry.colors,'save is visually primary, close secondary');
  assert.equal(geometry.colors[0],'rgb(116, 70, 95)','uses dashboard brand plum token');
  assert.ok(geometry.save.height>=44&&geometry.close.height>=44);
  assert.ok(geometry.save.x>=geometry.close.right+8||geometry.close.y>=geometry.save.bottom+8||geometry.save.y>=geometry.close.bottom+8,'actions have a real gap');
  assert.equal(await page.locator('#fixture-unrelated').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(221, 221, 221)','styles do not leak to dashboard');
  await page.locator('[data-payroll-action="save"]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-payroll-action="save"]').disabled);
  assert.match(await dialog.locator('[role="status"]').innerText(),/izin dicabut/);
  assert.equal(await page.getByLabel('Catatan / alasan koreksi',{exact:true}).inputValue(),'Pembayaran tunai telah diterima pekerja.');
  if(width>=390)assert.equal(await dialog.evaluate(d=>d.scrollHeight>d.clientHeight),false,'standard mobile and desktop show full error form without vertical clipping');
  await dialog.evaluate(d=>{d.scrollTop=d.scrollHeight;});
  const end=await dialog.evaluate(d=>({bottom:d.getBoundingClientRect().bottom,saveBottom:d.querySelector('[data-payroll-action="save"]').getBoundingClientRect().bottom}));
  assert.ok(end.bottom-end.saveBottom>=14,'bottom action retains breathing room when scrolled to end');
  fs.mkdirSync(artifactDir,{recursive:true});
  await page.screenshot({path:path.join(artifactDir,`payroll-dialog-${width}.png`),fullPage:true});
  console.log(`SCREENSHOT ${path.join(artifactDir,`payroll-dialog-${width}.png`)}`);
 }));
}
