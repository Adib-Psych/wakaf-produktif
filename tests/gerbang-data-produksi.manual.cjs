// Pakai: jalankan "python3 -m http.server 8766" di akar repo cabang PR, lalu
// node tests/gerbang-data-produksi.manual.cjs https://adib-psych.github.io/wakaf-produktif/monitor-v2.html http://127.0.0.1:8766/monitor-v2.html
// Bukan uji CI (butuh jaringan produksi). Semua tulis Firestore diblokir; hanya membaca.
// Gerbang data produksi: bandingkan dashboard URL A (sebelum) vs B (sesudah) dengan data produksi, tulis Firestore diblokir.
const {chromium}=require('playwright');
async function ukur(url){
 const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let tulis=0;await p.route('**/*',r=>{const u=r.request().url();if(/Write\/channel|:commit|batchWrite|beginTransaction/.test(u)){tulis++;return r.abort();}r.continue();});
 await p.goto(url+'?gate='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
 for(let i=0;i<40;i++){if(await p.evaluate(()=>typeof CASHBOOK!=='undefined'&&CASHBOOK.length>0&&UPAH_ITEMS.length>0))break;await p.waitForTimeout(1000);}
 await p.waitForTimeout(2500);
 const r=await p.evaluate(()=>{const sum=a=>a.reduce((n,x)=>n+(x.qty||0)*(x.tarif||0),0);return {upah:UPAH_ITEMS.length,upahTotal:sum(UPAH_ITEMS),belum:UPAH_ITEMS.filter(x=>x.status==='belum').length,kas:CASHBOOK.length,kasKeluar:CASHBOOK.reduce((n,t)=>n+(t.keluar||0),0),lap:STATE.laporan.length,kpi:document.getElementById('kpi-budget')?.textContent,trend:document.getElementById('kpi-budget-trend')?.textContent,aktivitas:window.WAGE_ACTIVITY?Object.values(window.WAGE_ACTIVITY):null};});
 r.errors=errs.length;r.tulisDiblokir=tulis;await b.close();return r;
}
(async()=>{const A=await ukur(process.argv[2]),B=await ukur(process.argv[3]);
 const keys=['upah','upahTotal','belum','kas','kasKeluar','lap','kpi','trend','errors'];
 for(const k of keys)console.log((JSON.stringify(A[k])===JSON.stringify(B[k])?'SAMA ':'BEDA ')+k.padEnd(10)+' sebelum='+JSON.stringify(A[k])+' sesudah='+JSON.stringify(B[k]));
 console.log('aktivitas sebelum:',JSON.stringify(A.aktivitas));console.log('aktivitas sesudah:',JSON.stringify(B.aktivitas));
})();
