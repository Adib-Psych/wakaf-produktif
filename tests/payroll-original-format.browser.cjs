'use strict';
// Original 548a44d generator template and candidate, identical synthetic fixtures; no live reads/writes.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),{chromium}=require(root+'/recovery/node_modules/playwright');
const out=process.env.WAKAF_EVIDENCE||path.join(root,'test-results/payroll-original-format');
const canvasPath=process.env.HTML2CANVAS_PATH||path.join(root,'recovery/node_modules/html2canvas/dist/html2canvas.min.js');
assert.ok(fs.existsSync(canvasPath),`html2canvas dependency not found: ${canvasPath}; set HTML2CANVAS_PATH`);
const baseline=require('node:child_process').execFileSync('git',['show','548a44d:monitor-v2.html'],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const start=baseline.indexOf('function generateBuktiBayar('),end=baseline.indexOf('\nfunction ',start+15);const legacy=baseline.slice(start,end);
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/legacy-generator-548a44d.js',legacy);
// Evaluate the original document-construction body only. Dormant UID hold is skipped in this isolated harness.
// No startup/writer code, unsafe old proof confirmation, async/privateViewLater or old preview is executed.
const prefix=legacy.slice(legacy.indexOf('  const isRekap'),legacy.indexOf('  // Insert into DOM'));
const fixture={upah:[{id:7,tgl:'2026-10-20',pelapor:'NARDI',name:'Lek Nardi',aktivitas:'Rawat kopi',model:'harian',satuan:'setengah_hari',qty:1,tarif:50000,status:'belum'},{id:8,tgl:'2026-10-21',pelapor:'NARDI',name:'Lek Nardi',aktivitas:'Bersihkan kebun',model:'harian',satuan:'full day',qty:1,tarif:100000,status:'belum'}],cashbook:[],kasbon:[]};
let server,browser,base;const result={checks:[],errors:[],renders:[],legacyHarnessChanges:['skip dormant local-UID guard; no old startup','evaluate original template-construction only; dedicated real html2canvas/download driver avoids legacy undefined privateViewLater','freeze time to fixture generation date; original numeric IDs retained'],networkRequests:[]};
(async()=>{try{
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/matching-fixture.json',JSON.stringify(fixture,null,2));
 server=http.createServer((req,res)=>{const u=new URL(req.url,base);if(u.pathname==='/harness.html'){res.setHeader('Content-Type','text/html');return res.end('<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><style>body{margin:0;background:#2e4040}#stage{padding:16px;display:flex;justify-content:center}#stage img{max-width:100%;height:auto}header{color:white;padding:16px;font:14px Arial}</style></head><body><header id="label"></header><div id="stage"></div><script src="/html2canvas.js"></script></body></html>');}let file=u.pathname==='/html2canvas.js'?canvasPath:path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+'/')&&u.pathname!='/html2canvas.js'){res.writeHead(403);return res.end();}if(!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.mjs')?'application/javascript':file.endsWith('.png')?'image/png':'application/javascript');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});
 for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
  const size=viewport.width===390?'phone':'desktop',context=await browser.newContext({acceptDownloads:true,viewport,timezoneId:'Asia/Jakarta',serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():(result.networkRequests.push(r.request().url()),r.abort()));
  const p=await context.newPage();p.on('pageerror',e=>result.errors.push(e.message));await p.goto(base+'/harness.html');
  await p.evaluate(()=>{const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-11-09T02:00:00Z']));}static now(){return new RealDate('2026-11-09T02:00:00Z').getTime();}};});
  for(const mode of ['rekap','proof']){
   const v=structuredClone(fixture);if(mode==='proof')for(const w of v.upah)Object.assign(w,{status:'lunas',bayar_tgl:'2026-11-08'});
   for(const variant of ['original','restored']){
    const name=`${variant}-${mode}-${size}`;
    const data=await p.evaluate(async({v,prefix,mode,variant})=>{
     globalThis.UPAH_ITEMS=v.upah;globalThis.NAMA_PEKERJA={NARDI:'Lek Nardi'};globalThis.calcTotal=it=>it.qty*it.tarif;globalThis._kasbonUntukDokumen=()=>({total:0,rincian:[]});
     document.querySelectorAll('.upah-check').forEach(x=>x.remove());for(const w of v.upah){const c=document.createElement('input');c.type='checkbox';c.className='upah-check';c.checked=true;c.dataset.id=w.id;c.hidden=true;document.body.append(c);}globalThis.confirm=()=>true;
     const api=await import('/recovery/payroll-documents.mjs');let html,d;
     if(variant==='original')html=new Function('mode',prefix+';return receiptHTML;')(mode);
     else{d=api.buildPayrollDocument({value:v,selected:v.upah.map(x=>x.id),mode,generatedAt:'2026-11-09T02:00:00Z'});html=api.payrollDocumentHTML(d);}
     const holder=document.createElement('div');holder.innerHTML=html;document.body.append(holder);const target=holder.firstElementChild;target.style.position='absolute';target.style.top='0';target.style.left='-10000px';await Promise.all([...target.querySelectorAll('img')].map(i=>i.decode()));await document.fonts.ready;
     const style=x=>{const s=getComputedStyle(x),r=x.getBoundingClientRect();return {width:r.width,height:r.height,font:s.fontFamily,color:s.color,background:s.backgroundColor,border:s.border,columns:s.gridTemplateColumns};};
     const metrics={root:style(target),logo:style(target.querySelector('img')),header:style(target.children[mode==='rekap'?1:0]),th:[...target.querySelectorAll('th')].map(x=>({text:x.textContent,...style(x)})),col:[...target.querySelectorAll('col')].map(x=>x.style.width),rows:target.querySelectorAll('tbody tr').length,signatureImages:target.querySelectorAll('img[src*="signature"]').length,text:target.innerText};
     globalThis.__captureTarget=target;globalThis.__holder=holder;globalThis.__documentModel=d;return {html,metrics};
    },{v,prefix,mode,variant});
    fs.writeFileSync(out+'/'+name+'.html',data.html);result.renders.push({name,metrics:data.metrics});
    const pending=p.waitForEvent('download');
    if(variant==='original')await p.evaluate(async name=>{const canvas=await html2canvas(__captureTarget,{scale:2,backgroundColor:'#ffffff',logging:false,useCORS:true,allowTaint:false});const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=name+'.png';document.body.append(a);a.click();a.remove();},name);
    else await p.evaluate(async()=>{const api=await import('/recovery/payroll-documents.mjs');await api.renderPayrollPNG(__documentModel);});
    const dl=await pending;await dl.saveAs(out+'/'+name+'.png');const bytes=fs.readFileSync(out+'/'+name+'.png');assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),1612);
    await p.evaluate(({name})=>{document.getElementById('label').textContent=name+' — synthetic fixture';__holder.remove();document.getElementById('stage').replaceChildren();}, {name});
    // Display the exact downloaded bytes, not a snapshot-only proxy.
    await p.evaluate(async({data,name})=>{const img=document.createElement('img');img.src=data;img.alt=name;document.getElementById('stage').replaceChildren(img);await img.decode();},{data:'data:image/png;base64,'+bytes.toString('base64'),name});
    await p.screenshot({path:out+'/'+name+'-screen.png',fullPage:true});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    result.checks.push(name+' actual html2canvas PNG download + screenshot');
   }
   const original=result.renders.find(x=>x.name===`original-${mode}-${size}`).metrics,restored=result.renders.find(x=>x.name===`restored-${mode}-${size}`).metrics;
   assert.equal(restored.root.width,original.root.width);assert.equal(restored.logo.height,108);assert.deepEqual(restored.col,original.col);assert.deepEqual(restored.th.map(x=>[x.text,x.width,x.background]),original.th.map(x=>[x.text,x.width,x.background]));assert.equal(restored.rows,original.rows);assert.equal(restored.signatureImages,0);result.checks.push(mode+' '+size+' legacy frame/logo/columns/header palette/grouping comparison');
  }
  await context.close();
 }
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.networkRequests,[]);result.passed=true;
}catch(e){result.passed=false;result.failure=e.stack;process.exitCode=1;}finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(out+'/visual-comparison-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}})();
