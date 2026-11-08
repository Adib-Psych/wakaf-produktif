'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),{chromium}=require(root+'/recovery/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox']});try{
 const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 await page.setContent('<style>.hero-lightbox{display:none}.hero-lightbox.open{display:block}</style><button id="trigger">Photo</button><div id="hero-lightbox" class="hero-lightbox" onclick="this.classList.remove(\'open\')"><img alt="fixture"></div>');
 await page.addScriptTag({path:root+'/recovery/dashboard-ui-consolidation.js'});
 await page.evaluate(()=>document.getElementById('trigger').focus());
 for(let i=0;i<8;i++){
  await page.evaluate(()=>document.getElementById('hero-lightbox').classList.add('open'));
  await page.waitForFunction(()=>document.querySelector('#hero-lightbox').contains(document.activeElement));
  await page.locator('.dashboard-popup-media-close').click();
  await page.waitForFunction(()=>document.activeElement.id==='trigger');
 }
 await page.evaluate(()=>{const n=document.getElementById('hero-lightbox');n.classList.add('open');});
 await page.waitForFunction(()=>document.querySelector('#hero-lightbox').contains(document.activeElement));
 await page.evaluate(()=>{const n=document.getElementById('hero-lightbox');n.classList.remove('open');document.activeElement.blur();n.classList.add('open');});
 await page.waitForFunction(()=>document.querySelector('#hero-lightbox').contains(document.activeElement));
 assert.equal(await page.locator('.dashboard-popup-media-close').count(),1);
 console.log('PASS: 8 class-only open/close focus returns and same-task reopen focus; no network');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
