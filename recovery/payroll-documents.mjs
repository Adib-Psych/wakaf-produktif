import {requireFreshPublicData} from './public-health.mjs';
// Read-only payroll documents. No persistence, payment actions or balance mutation.
export function payrollID(value){if(!((typeof value==='string'||Number.isSafeInteger(value))&&/^[A-Za-z0-9_-]{1,120}$/.test(String(value))))throw Error('ID pilihan tidak valid');return String(value);}
const text=x=>typeof x==='string'&&x.trim()&&!['undefined','null'].includes(x.trim())?x.trim():null;
const calendar=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const cashIDs=c=>typeof c.ref==='string'&&c.ref.startsWith('upah_')?c.ref.slice(5).split('·').map(x=>x.trim()):[];
const fundLabel=f=>f==='K4'?'Pribadi K4':'Wakaf K1–K3';
const money=x=>'Rp '+x.toLocaleString('id-ID');
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function buildPayrollDocument({value,selected,mode='rekap',generatedAt=new Date().toISOString(),names={}}){
 requireFreshPublicData(value,['upah','cashbook','kasbon']);
 if(!Array.isArray(value?.cashbook))throw Error('Sumber kas belum tersedia');
 if(!['rekap','proof'].includes(mode))throw Error('Mode dokumen tidak valid');
 if(!Array.isArray(value?.upah)||!Array.isArray(selected)||!selected.length)throw Error('Pilih item upah terlebih dahulu');
 const ids=[...new Set(selected.map(payrollID))];
 const rows=ids.map(id=>{const matches=value.upah.filter(w=>payrollID(w.id)===id);if(matches.length!==1)throw Error('Pilihan sudah tidak tersedia atau duplikat');const w=matches[0];
  if(!['belum','lunas'].includes(w.status))throw Error('Status upah tidak dikenal');
  if(mode==='proof'&&w.status!=='lunas')throw Error('Bukti bayar hanya untuk upah lunas');
  if(!calendar(w.tgl)||(w.bayar_tgl!=null&&!calendar(w.bayar_tgl)))throw Error('Tanggal kerja/bayar tidak valid');
  if(w.voided_duplicate||w.eligible===false)throw Error('Upah tidak berlaku');
  if('fund' in w&&!['K1_K3','K4'].includes(w.fund))throw Error('Sumber dana tidak dikenal');
  const fund=w.fund||'K1_K3';
  if((fund==='K4'&&w.bayar_source!=null&&w.bayar_source!=='pribadi')||(fund!=='K4'&&w.bayar_source==='pribadi'))throw Error('Sumber pembayaran dan dana tidak konsisten');
  const total=w.qty*w.tarif;if(typeof w.qty!=='number'||!Number.isFinite(w.qty)||w.qty<=0||!Number.isSafeInteger(w.tarif)||w.tarif<=0||!Number.isSafeInteger(total))throw Error('Nilai upah tidak valid');
  if(w.payroll_revision!=null){
   if(!Number.isSafeInteger(w.payroll_revision)||w.payroll_revision<1||!text(w.payroll_event_id))throw Error('Proyeksi payroll tidak lengkap');
   const cash=value.cashbook.filter(c=>c.id==='cb_payroll_'+id);
   if(w.status==='lunas'&&(cash.length!==1||cash[0].ref!=='upah_'+id||cash[0].tgl!==w.bayar_tgl||cash[0].keluar!==total||cash[0].masuk!==0||cash[0].src!=='payroll'||(cash[0].fund||'K1_K3')!==fund||w.bayar_source!==(fund==='K4'?'pribadi':'wakif')))throw Error('Proyeksi payroll dan buku kas tidak konsisten');
   if(w.status==='belum'&&cash.length)throw Error('Proyeksi upah belum dibayar masih memiliki kas pembayaran');
  }
  const name=text(value.wageBindings?.find(b=>b.id===w.pelapor||b.legacy_token===w.pelapor)?.name)||text(w.name)||text(w.worker)||text(names[w.pelapor]);if(!name)throw Error('Nama pekerja belum tersedia');
  const unit=text(w.satuan_lbl)||text(w.satuan);
  const duration=({'full_day':'1 hari',full:'1 hari','full day':'1 hari',setengah_hari:'½ hari',half:'½ hari'})[unit]||unit?.replaceAll('_',' ')||'Durasi tidak tercatat';
  return {id,date:w.tgl,name,workerKey:w.pelapor,model:w.model,status:w.status,fund,fundLabel:fundLabel(fund),activity:text(w.aktivitas)||'Pekerjaan tercatat',duration,qty:w.qty,tariff:w.tarif,total,paymentDate:w.status==='lunas'?(text(w.bayar_tgl)||'Tidak tercatat'):null};
 }).sort((a,b)=>String(a.date).localeCompare(String(b.date))||a.id.localeCompare(b.id));
 const funds=rows.reduce((out,r)=>{out[r.fund]=(out[r.fund]||0)+r.total;return out;},{});
 const total=rows.reduce((n,r)=>n+r.total,0);let deductions=0,estimatedDeduction=0;const allocations=[],deductionDetails=[];
 if(!Number.isSafeInteger(total))throw Error('Total upah tidak valid');
 if(!Array.isArray(value.kasbon))throw Error('Source kasbon belum tersedia');
 if(rows.some(r=>r.status==='lunas'))for(const k of value.kasbon){
  if(k.potongan!=null&&!Array.isArray(k.potongan))throw Error('Jejak kasbon tidak valid');
  for(const p of k.potongan||[]){
   if(!Array.isArray(p.upah_ids))throw Error('Jejak potongan kasbon tidak lengkap');
   const linked=[...new Set(p.upah_ids.map(payrollID))];if(!linked.some(id=>ids.includes(id)))continue;
   if(!linked.every(id=>ids.includes(id))||!Number.isSafeInteger(p.jumlah)||p.jumlah<=0)throw Error('Pilih seluruh upah pada jejak potongan kasbon; alokasi parsial tidak tercatat');
   if(linked.some(id=>value.upah.find(w=>payrollID(w.id)===id)?.pelapor!==k.pelapor))throw Error('Pekerja pada potongan kasbon tidak cocok');
   const wages=linked.map(id=>value.upah.find(w=>payrollID(w.id)===id));
   if(wages.some(w=>w.status!=='lunas')||!calendar(p.tgl)||wages.some(w=>w.bayar_tgl!==p.tgl||(w.fund||'K1_K3')!==(wages[0].fund||'K1_K3'))||p.jumlah>wages.reduce((n,w)=>n+w.qty*w.tarif,0))throw Error('Tanggal/dana/alokasi potongan kasbon tidak konsisten');
   if(!Number.isSafeInteger(k.jumlah)||!Number.isSafeInteger(k.terpotong)||k.terpotong<0||k.terpotong>k.jumlah||k.potongan.some(x=>!Number.isSafeInteger(x.jumlah)||x.jumlah<=0)||k.potongan.reduce((n,x)=>n+x.jumlah,0)!==k.terpotong)throw Error('Saldo dan jejak potongan kasbon tidak konsisten');
   allocations.push({ids:linked,amount:p.jumlah});
   if(mode==='proof')deductionDetails.push({tgl:text(k.tgl),nama:rows.find(r=>linked.includes(r.id))?.name,keperluan:text(k.keperluan),jumlah:p.jumlah});
   deductions+=p.jumlah;
  }
 }
 if(mode==='rekap')for(const token of new Set(ids.map(id=>value.upah.find(w=>payrollID(w.id)===id).pelapor))){
  const gross=ids.map(id=>value.upah.find(w=>payrollID(w.id)===id)).filter(w=>w.pelapor===token&&w.status==='belum').reduce((n,w)=>n+w.qty*w.tarif,0);
  let balance=0;for(const k of value.kasbon.filter(k=>k.pelapor===token)){if(!Number.isSafeInteger(k.jumlah)||k.jumlah<0||(k.terpotong!=null&&(!Number.isSafeInteger(k.terpotong)||k.terpotong<0||k.terpotong>k.jumlah)))throw Error('Saldo kasbon tidak konsisten');balance+=k.jumlah-(k.terpotong||0);}
  const estimate=Math.min(gross,balance);estimatedDeduction+=estimate;
  let remaining=estimate;for(const k of value.kasbon.filter(k=>k.pelapor===token)){const amount=Math.min(remaining,k.jumlah-(k.terpotong||0));if(amount>0){deductionDetails.push({tgl:text(k.tgl),nama:rows.find(r=>r.workerKey===token)?.name,keperluan:text(k.keperluan),jumlah:amount});remaining-=amount;}}
 }
 const linkedCash=value.cashbook.filter(c=>cashIDs(c).some(id=>ids.includes(id)));
 for(const c of linkedCash){
  const linked=cashIDs(c);if(!linked.every(id=>ids.includes(id)))throw Error('Pilih seluruh upah pada buku kas gabungan');
  const wages=linked.map(id=>value.upah.find(w=>payrollID(w.id)===id));
  if(wages.some(w=>!w||w.status!=='lunas')||!Number.isSafeInteger(c.keluar)||c.keluar<0||c.masuk!==0||wages.some(w=>w.bayar_tgl&&w.bayar_tgl!==c.tgl)||(c.fund||'K1_K3')!==(wages[0].fund||'K1_K3')||wages.some(w=>(w.fund||'K1_K3')!==(c.fund||'K1_K3')))throw Error('Upah dan buku kas tidak konsisten');
  if(!calendar(c.tgl)||new Set(linked).size!==linked.length||wages.some(w=>w.pelapor!==wages[0].pelapor))throw Error('Alokasi buku kas gabungan tidak tercatat');
  const related=allocations.filter(a=>a.ids.some(id=>linked.includes(id)));
  if(related.some(a=>!a.ids.every(id=>linked.includes(id))))throw Error('Alokasi potongan antar buku kas tidak tercatat');
  if(c.keluar!==wages.reduce((n,w)=>n+w.qty*w.tarif,0)-related.reduce((n,a)=>n+a.amount,0))throw Error('Nilai kas dan potongan per kelompok tidak konsisten');
 }
 if(linkedCash.length){
  const linked=linkedCash.flatMap(cashIDs);if(new Set(linked).size!==linked.length)throw Error('Buku kas pembayaran duplikat');
  if(allocations.some(a=>!a.ids.every(id=>linked.includes(id))))throw Error('Buku kas untuk potongan terpilih tidak lengkap');
 }
 if(allocations.some(a=>allocations.some(b=>a!==b&&a.ids.some(id=>b.ids.includes(id))&&(a.ids.length!==b.ids.length||!a.ids.every(id=>b.ids.includes(id))))))throw Error('Alokasi potongan tumpang tindih tidak tercatat');
 for(const row of rows){const related=allocations.filter(a=>a.ids.includes(row.id));const connected=[...new Set(related.flatMap(a=>a.ids))];if(connected.length&&related.reduce((n,a)=>n+a.amount,0)>rows.filter(r=>connected.includes(r.id)).reduce((n,r)=>n+r.total,0))throw Error('Potongan kasbon melebihi kelompok upah');}
 if(deductions>total)throw Error('Potongan kasbon melebihi upah');
 const clock=new Date(generatedAt);if(!Number.isFinite(clock.getTime()))throw Error('Tanggal dokumen tidak valid');
 const dateParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(clock);
 const dateKey=['year','month','day'].map(t=>dateParts.find(p=>p.type===t).value).join('');
 const workerKeys=[...new Set(rows.map(r=>r.workerKey))],code=workerKeys.length===1&&/^[A-Za-z0-9_-]{1,120}$/.test(String(workerKeys[0]))?String(workerKeys[0]):'MULTI';
 const documentNumber=`${mode==='rekap'?'REKAP':'BUKTI'}-NGT-${dateKey}-${code}-${String(clock.getTime()).slice(-4)}`;
 return {mode,rows,funds,total,deductions,estimatedDeduction,deductionDetails,net:total-deductions,generatedAt,documentNumber,filename:documentNumber+'.png'};
}
export function openPayrollPreview(win=globalThis.window){
 try{const preview=win?.open('','_blank','width=900,height=1200,scrollbars=yes');if(preview){preview.document.title='Dokumen upah — memeriksa data';preview.document.body.textContent='Memeriksa data server dan membuat PNG…';}return preview;}catch{return null;}
}
function fillPreview(preview,d,href){
 if(!preview||preview.closed)return;
 const doc=preview.document;doc.title=d.filename;doc.body.replaceChildren();doc.body.style.cssText='margin:0;background:#30282b;color:#fff;font:14px Arial,sans-serif';
 const bar=doc.createElement('header');bar.style.cssText='padding:16px;position:sticky;top:0;background:#74465f;display:flex;gap:12px;flex-wrap:wrap;align-items:center';
 const title=doc.createElement('strong');title.textContent=d.mode==='rekap'?'Rekapan upah — BUKAN bukti pembayaran':'Bukti pembayaran — catatan server';
 const download=doc.createElement('a');download.id='payroll-download';download.href=href;download.download=d.filename;download.textContent='Download PNG';download.style.color='#fff';
 const print=doc.createElement('button');print.id='payroll-print';print.textContent='Print';print.onclick=()=>preview.print();
 const wa=doc.createElement('a');wa.id='payroll-whatsapp';wa.href='https://wa.me/?text='+encodeURIComponent((d.mode==='rekap'?'Rekapan hak upah — status setiap item tercantum; BUKAN bukti pembayaran.':'Catatan pembayaran upah.')+' '+d.rows.map(r=>r.name+' · '+r.date+' · '+money(r.total)+' · '+r.fundLabel+' · '+(r.status==='lunas'?'Lunas':'Belum dibayar')).join('\n')+'\nTotal hak upah: '+money(d.total)+'\nUnduh dan lampirkan PNG ini di WhatsApp.');wa.target='_blank';wa.rel='noopener noreferrer';wa.textContent='WhatsApp';wa.style.color='#fff';
 const image=doc.createElement('img');image.id='payroll-preview-image';image.src=href;image.alt=title.textContent;image.style.cssText='display:block;max-width:100%;height:auto;margin:20px auto;background:white';
 const hint=doc.createElement('p');hint.textContent='PNG diunduh otomatis. Jika belum tersimpan, tekan Download PNG; lampirkan gambarnya saat mengirim WhatsApp.';hint.style.padding='0 16px';
 const style=doc.createElement('style');style.textContent='@media print{header,p{display:none}body{background:white!important}img{margin:0!important;max-width:100%!important}}';
 bar.append(title,download,print,wa);doc.body.append(style,bar,hint,image);
}
export async function renderPayrollPNG(d,{document=globalThis.document,html2canvas=globalThis.html2canvas,assertCurrent=()=>{},preview=null}={}){
 if(typeof html2canvas!=='function')throw Error('Pustaka PNG belum tersedia; periksa koneksi lalu coba lagi');
 const wrapper=document.createElement('div');wrapper.style.cssText='position:fixed;top:0;left:-10000px;pointer-events:none';wrapper.innerHTML=payrollDocumentHTML(d);document.body.append(wrapper);
 try{
  const target=wrapper.firstElementChild;await Promise.all([...target.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));await document.fonts?.ready;
  assertCurrent();const canvas=await html2canvas(target,{backgroundColor:'#ffffff',scale:2,logging:false,useCORS:true,allowTaint:false});assertCurrent();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG gagal dibuat')),'image/png'));assertCurrent();
  const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=d.filename;document.body.append(a);a.click();a.remove();fillPreview(preview,d,href);if(!preview||preview.closed)setTimeout(()=>URL.revokeObjectURL(href),60000);else preview.addEventListener('pagehide',()=>URL.revokeObjectURL(href),{once:true});return {filename:d.filename,width:canvas.width,height:canvas.height};
 }finally{wrapper.remove();}
}
// Presentation recovered from 548a44d monitor-v2.html generateBuktiBayar (July dual-mode template).
// Keep the original frame, letterhead, grid, columns, total, terms and signature geometry.
// Safety/factual deviations: projected/escaped data, actual payment dates, explicit funds/status,
// no invented recipient signatures or receipt attestation; recap is never payment evidence.
const documentDate=value=>{
 const date=new Date(value?.length===10?value+'T00:00:00Z':value);
 if(!Number.isFinite(date.getTime()))return 'Tidak tercatat';
 const parts=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',weekday:'long',day:'numeric',month:'short',year:'numeric'}).formatToParts(date);
 const part=t=>parts.find(p=>p.type===t)?.value||'';
 return `${part('weekday')}, ${part('day')} ${part('month')} ${part('year')}`;
};
export function payrollDocumentHTML(d){
 const isRekap=d.mode==='rekap',items=d.rows,total=d.total;
 const paid=items.filter(r=>r.status==='lunas').length;
 const outstanding=items.filter(r=>r.status==='belum').reduce((n,r)=>n+r.total,0);
 const statusLabel=paid===0?'⏳ Menunggu pembayaran':paid===items.length?'✓ Semua item lunas':`${paid} lunas · ${items.length-paid} belum dibayar`;
 const watermark=paid===0?'BELUM DIBAYAR':'REKAPAN UPAH';
 const multi=new Set(items.map(r=>r.workerKey||r.name)).size>1,multiFund=Object.keys(d.funds).length>1;
 const namaPenerima=multi?'Multi-Pekerja':items[0].name;
 const todayLbl=documentDate(d.generatedAt);
 const paymentDates=[...new Set(items.map(r=>r.paymentDate))].map(x=>x==='Tidak tercatat'?x:documentDate(x)+' ('+x+')').join(' · ');
 const sumberDana=Object.keys(d.funds).map(fundLabel).join(' + ');
 const nomorBukti=d.documentNumber;
 const kasbonInfo={total:isRekap?d.estimatedDeduction:d.deductions,rincian:(d.deductionDetails?.length?d.deductionDetails:[{jumlah:isRekap?d.estimatedDeduction:d.deductions,keperluan:isRekap?'Estimasi saja — bukan potongan aktual':'Potongan kasbon tercatat'}])};
 const recapTerms=paid===0?'❓ <b>Mohon konfirmasi:</b> upah panjenengan mau <b>diterima sekarang</b> atau <b>dikumpulkan dulu</b> (diserahkan nanti sekaligus)?':`ℹ️ <b>Status pilihan:</b> ${escape(statusLabel)}. Item lunas hanya ditampilkan sebagai riwayat, bukan permintaan bayar ulang.${paid<items.length?' Untuk upah belum dibayar: mohon konfirmasi mau <b>diterima sekarang</b> atau <b>dikumpulkan dulu</b>.':''}`;
  function terbilangAngka(n) {
    const a = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
    n = Math.floor(Math.abs(n));
    if (n === 0) return '';
    if (n < 12) return a[n];
    if (n < 20) return a[n - 10] + ' belas';
    if (n < 100) return a[Math.floor(n / 10)] + ' puluh' + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 200) return 'seratus' + (n % 100 ? ' ' + terbilangAngka(n % 100) : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' ratus' + (n % 100 ? ' ' + terbilangAngka(n % 100) : '');
    if (n < 2000) return 'seribu' + (n % 1000 ? ' ' + terbilangAngka(n % 1000) : '');
    if (n < 1000000) return terbilangAngka(Math.floor(n / 1000)) + ' ribu' + (n % 1000 ? ' ' + terbilangAngka(n % 1000) : '');
    if (n < 1000000000) return terbilangAngka(Math.floor(n / 1000000)) + ' juta' + (n % 1000000 ? ' ' + terbilangAngka(n % 1000000) : '');
    return terbilangAngka(Math.floor(n / 1000000000)) + ' miliar' + (n % 1000000000 ? ' ' + terbilangAngka(n % 1000000000) : '');
  }
  function terbilangRupiah(n) {
    if (n === 0) return 'Nol Rupiah';
    const words = terbilangAngka(n);
    return words.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Rupiah';
  }

  const itemRowsHTML = items.map((it, i) => {
    const subtotal = it.total;
    const tglStr = documentDate(it.date);
    const statusIco = it.status==='lunas'?'✓ Lunas':'⏳ Belum dibayar';
    const rowBg = i % 2 === 0 ? '#faf9f8' : '#ffffff';
    // Activity description with inline qty/tarif detail
    // Preserve the compact unit daily row, but show every non-unit multiplier.
    const qtyDisplay = it.model==='harian'&&it.qty===1?it.duration:`${it.qty}× ${it.duration}`;
    const aktDesc = `<span style="color:#30282b;font-weight:600">${escape(it.activity)}</span> <span style="color:#70636a;font-size:11px">· ${statusIco} ${escape(qtyDisplay)} · Rp ${it.tariff.toLocaleString('id-ID')}</span>`;
    const details = `${multi?`<br><b>${escape(it.name)}</b>`:''}${multiFund?`<br>Sumber dana: ${escape(it.fundLabel)}`:''}${!isRekap&&new Set(items.map(r=>r.paymentDate)).size>1?`<br>Tanggal bayar: ${escape(it.paymentDate)}`:''}`;
    return `<tr style="background:${rowBg}">
      <td style="padding:9px 12px;border-bottom:1px solid #e4d9df;font-size:12px;color:#30282b;white-space:nowrap;vertical-align:middle"><span style="color:#70636a;font-weight:700;display:inline-block;width:22px">${i+1}.</span><span style="font-weight:600">${tglStr}</span></td>
      <td style="padding:9px 12px;border-bottom:1px solid #e4d9df;font-size:12px;line-height:1.45;vertical-align:middle">${aktDesc}${details}</td>
      <td style="padding:9px 12px;text-align:right;border-bottom:1px solid #e4d9df;font-size:12.5px;font-weight:700;color:#30282b;white-space:nowrap;vertical-align:middle">Rp ${subtotal.toLocaleString('id-ID')}</td>
    </tr>`;
  }).join('');

 return `
    <div id="payroll-document-render" style="position:relative;width:800px;background:#ffffff;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#30282b;border:3px solid #74465f;box-shadow:inset 0 0 0 1px #ffffff, inset 0 0 0 2px #e4d9df, 0 4px 12px rgba(0,0,0,.1);box-sizing:content-box">
      ${isRekap?`<div style="position:absolute;top:46%;left:50%;transform:translate(-50%,-50%) rotate(-18deg);font-size:52px;font-weight:900;color:rgba(116,70,95,.09);white-space:nowrap;pointer-events:none;z-index:5">${watermark}</div>`:''}
      <!-- HEADER — Professional letterhead style -->
      <div style="background:#ffffff;padding:22px 32px 16px;border-bottom:4px solid #74465f;position:relative">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:20px">
          <img src="images/logo-wakaf-produktif-3x1.png" style="height:108px;width:auto;max-width:480px;display:block;flex-shrink:0" alt="Logo Wakaf Produktif Kebun Kopi Ngantang">
          <div style="text-align:right;flex-shrink:0;max-width:280px">
            <div style="font-size:9px;font-weight:800;color:#74465f;letter-spacing:2.5px;margin-bottom:6px">— DOKUMEN RESMI —</div>
            <div style="font-size:11px;color:#70636a;line-height:1.55;font-style:italic">Wakaf produktif berbasis kebun kopi<br>untuk amal jariyah berkelanjutan</div>
            <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e4d9df;font-size:9px;color:#70636a;letter-spacing:.5px;font-weight:600">📍 Ngantang, Malang · Jawa Timur</div>
          </div>
        </div>
        <div style="margin-top:14px;padding-top:12px;border-top:2px dashed #e4d9df;display:flex;align-items:center;justify-content:space-between;gap:14px">
          <div style="font-size:19px;font-weight:800;color:${isRekap?'#74465f':'#74465f'};letter-spacing:1.8px">${isRekap?'REKAPAN UPAH PEKERJA':'BUKTI PEMBAYARAN UPAH'}</div>
          <div style="font-size:10px;color:#70636a;letter-spacing:.6px;font-weight:600;text-align:right;line-height:1.4">No. Bukti<br><span style="font-family:'Courier New',monospace;color:#30282b;font-size:11px;font-weight:700">${escape(nomorBukti)}</span></div>
        </div>
      </div>

      <!-- INFO BOX — 1x3 grid since No. Bukti moved to header -->
      <div style="padding:22px 32px 0">
        <div style="background:#ffffff;padding:14px 18px;border-radius:8px;border-left:4px solid #432d38;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px 18px;font-size:13px">
          <div><div style="color:#70636a;font-size:10px;letter-spacing:1.2px;font-weight:700;margin-bottom:3px">${isRekap?'TANGGAL REKAP':'TANGGAL BAYAR TERCATAT'}</div><div style="color:#30282b;font-weight:700">${escape(isRekap?todayLbl:paymentDates)}</div></div>
          <div><div style="color:#70636a;font-size:10px;letter-spacing:1.2px;font-weight:700;margin-bottom:3px">PENERIMA</div><div style="color:#30282b;font-weight:800;font-size:15px">${escape(namaPenerima)}</div></div>
          <div><div style="color:#70636a;font-size:10px;letter-spacing:1.2px;font-weight:700;margin-bottom:3px">${isRekap?'STATUS':'SUMBER DANA'}</div><div style="color:${isRekap?'#74465f':'#30282b'};font-weight:700">${escape(isRekap?statusLabel:sumberDana)}</div></div>
        </div>
      </div>

      <div style="margin:10px 32px 0;font-size:10.5px;color:#70636a;line-height:1.55">Sumber dana: ${Object.keys(d.funds).length>1?'Campuran — ':''}${Object.entries(d.funds).map(([f,n])=>escape(fundLabel(f))+': '+money(n)).join(' · ')}${isRekap&&paid?`<br>Lunas: ${money(total-outstanding)} · Belum dibayar: ${money(outstanding)}`:''}</div>
      <!-- ITEMS TABLE -->
      <div style="padding:18px 32px 8px">
        <div style="font-size:11px;font-weight:800;color:#70636a;letter-spacing:1.5px;margin-bottom:8px">📋 RINCIAN PEKERJAAN (${items.length} ITEM)</div>
        <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.06);table-layout:fixed">
          <colgroup>
            <col style="width:200px">
            <col style="width:auto">
            <col style="width:130px">
          </colgroup>
          <thead>
            <tr style="background:#ece7e9;color:#30282b">
              <th style="background:inherit;color:inherit;padding:11px 12px;font-size:11px;text-align:center;letter-spacing:.5px">NO &amp; TANGGAL</th>
              <th style="background:inherit;color:inherit;padding:11px 12px;font-size:11px;text-align:center;letter-spacing:.5px">AKTIVITAS</th>
              <th style="background:inherit;color:inherit;padding:11px 12px;font-size:11px;text-align:center;letter-spacing:.5px">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>${itemRowsHTML}</tbody>
          <tfoot>
            <tr style="background:#f5f2f3">
              <td colspan="3" style="padding:14px 14px">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap">
                  <div style="flex:1;min-width:240px">
                    <div style="font-size:9px;font-weight:800;color:#70636a;letter-spacing:1.5px;margin-bottom:3px">— TERBILANG —</div>
                    <div style="font-size:12.5px;color:#30282b;font-style:italic;font-weight:600;line-height:1.45">${terbilangRupiah(total)}</div>
                  </div>
                  <div style="text-align:right;flex-shrink:0">
                    <div style="font-size:11px;font-weight:800;color:#70636a;letter-spacing:.8px;margin-bottom:3px;text-transform:uppercase">${kasbonInfo.total?'Total Hak Upah':(isRekap?'Total Upah':'Total Upah Tercatat')}</div>
                    <div style="font-size:22px;font-weight:800;color:#432d38;white-space:nowrap;letter-spacing:.3px">Rp ${total.toLocaleString('id-ID')}</div>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- POTONGAN KASBON — only supported recorded/estimated allocations -->
      ${kasbonInfo.total?`
      <div style="margin:14px 32px 0">
        <div style="font-size:11px;font-weight:800;color:#854027;letter-spacing:1.5px;margin-bottom:8px">${isRekap?'− PERKIRAAN POTONGAN KASBON':'− POTONGAN KASBON TERCATAT'}</div>
        <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.06)">
          <tbody>
            ${kasbonInfo.rincian.map(r=>`<tr style="background:#fbf3ec">
              <td style="padding:9px 14px;font-size:12px;color:#854027;border-bottom:1px solid #e8cfc1">${escape(r.tgl?documentDate(r.tgl):'Alokasi terpilih')}${r.nama?` · <b>${escape(r.nama)}</b>`:''}<div style="font-size:11px;color:#854027;font-style:italic">${escape(r.keperluan||'—')}</div></td>
              <td style="padding:9px 14px;font-size:13px;font-weight:700;color:#854027;text-align:right;white-space:nowrap;border-bottom:1px solid #e8cfc1">− Rp ${r.jumlah.toLocaleString('id-ID')}</td>
            </tr>`).join('')}
            <tr style="background:#f5f2f3">
              <td style="padding:12px 14px;font-size:12px;font-weight:800;color:#30282b;letter-spacing:.5px">${isRekap?'PERKIRAAN DITERIMA SETELAH POTONGAN':'NETO TERCATAT (SETELAH POTONGAN KASBON)'}</td>
              <td style="padding:12px 14px;font-size:19px;font-weight:800;color:#432d38;text-align:right;white-space:nowrap">Rp ${((isRekap?outstanding:total)-kasbonInfo.total).toLocaleString('id-ID')}</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:7px;font-size:10.5px;color:#70636a;line-height:1.6;font-style:italic">
          ${isRekap?'Perkiraan potongan kasbon — estimasi saja, bukan potongan aktual. Hanya upah belum dibayar yang diperhitungkan.':'Potongan kasbon tercatat sesuai jejak pembayaran terpilih. Bukan pernyataan serah-terima baru.'}
        </div>
      </div>`:''}

      <!-- DOA (bukti) / KONFIRMASI (rekap) SECTION -->
      ${isRekap?`
      <div style="margin:16px 32px 0;padding:16px 22px;background:#fbf3ec;border-radius:8px;border:1.5px dashed #9b4f2e;font-size:12.5px;color:#854027;line-height:1.7">
        ${recapTerms}<br>
        ⚠️ Dokumen ini <b>rekapan hak upah — BUKAN bukti pembayaran</b>. Bukti Bayar resmi diterbitkan terpisah setelah upah diserahkan.
      </div>`:`
      <div style="margin:16px 32px 0;padding:18px 22px;background:#f5f2f3;border-radius:8px;border-left:4px solid #70636a;text-align:center">
        <div style="font-size:13px;line-height:1.7;color:#30282b;font-style:italic">Terima kasih atas kerja keras dan amanahnya. Semoga rezeki ini barakah dan menguatkan keluarga.</div>
        <div style="margin-top:10px;font-size:15px;font-weight:700;color:#70636a;letter-spacing:.5px">Barakallahu fiikum.</div>
      </div>`}

      <!-- SIGNATURE SECTION — manual placeholders, omitted in recap -->
      ${isRekap?'<div style="height:14px"></div>':`
      <div style="padding:24px 32px 6px;display:grid;grid-template-columns:1fr 1fr;gap:24px;font-size:12px">
        <div style="text-align:center">
          <div style="color:#70636a;margin-bottom:6px">Hormat kami,</div>
          <div style="height:54px"></div>
          <div style="border-top:1.5px solid #30282b;padding-top:8px;font-weight:800;color:#30282b;font-size:13px">Mas Tito (Adib Asrori)</div>
          <div style="color:#70636a;font-size:11px;margin-top:2px">Wakif &amp; Program Director</div>
        </div>
        <div style="text-align:center">
          <div style="color:#70636a;margin-bottom:6px">Penerima,</div>
          <div style="height:54px"></div>
          <div style="border-top:1.5px solid #30282b;padding-top:8px;font-weight:800;color:#30282b;font-size:13px">${escape(namaPenerima)}</div>
          <div style="color:#70636a;font-size:11px;margin-top:2px">Pekerja Lapangan</div>
        </div>
      </div>

      <!-- Manual signature / server-record scope -->
      <div style="margin:0 32px 18px;padding:9px 14px;background:#faf9f8;border-radius:6px;border:1px solid #e4d9df;font-size:10px;color:#70636a;text-align:center;font-style:italic;line-height:1.55">
        Tanda tangan manual bila diperlukan. Catatan pembayaran server, bukan pengesahan tanda tangan atau pernyataan penerimaan uang.
      </div>`}

      <!-- FOOTER -->
      <div style="background:#30282b;color:#ece7e9;padding:11px 32px;font-size:10px;text-align:center;letter-spacing:.5px;line-height:1.5">
        • <strong style="color:#ffffff">Wakaf Produktif Kebun Kopi Ngantang</strong> · Dokumen dari monitor-v2 · ${escape(todayLbl)}<br>Tanggal pembuatan dokumen: ${escape(d.generatedAt)}
      </div>
    </div>
  `;
}
