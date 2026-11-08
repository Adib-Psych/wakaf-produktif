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
  if(mode==='rekap'?w.status!=='belum':w.status!=='lunas')throw Error(mode==='rekap'?'Rekapan sebelum bayar hanya untuk upah belum dibayar':'Bukti bayar hanya untuk upah lunas');
  if(!calendar(w.tgl)||(w.bayar_tgl!=null&&!calendar(w.bayar_tgl)))throw Error('Tanggal kerja/bayar tidak valid');
  if(w.voided_duplicate||w.eligible===false)throw Error('Upah tidak berlaku');
  if('fund' in w&&!['K1_K3','K4'].includes(w.fund))throw Error('Sumber dana tidak dikenal');
  const fund=w.fund||'K1_K3';
  if((fund==='K4'&&w.bayar_source!=null&&w.bayar_source!=='pribadi')||(fund!=='K4'&&w.bayar_source==='pribadi'))throw Error('Sumber pembayaran dan dana tidak konsisten');
  const total=w.qty*w.tarif;if(typeof w.qty!=='number'||!Number.isFinite(w.qty)||w.qty<=0||!Number.isSafeInteger(w.tarif)||w.tarif<=0||!Number.isSafeInteger(total))throw Error('Nilai upah tidak valid');
  if(w.payroll_revision!=null){
   if(!Number.isSafeInteger(w.payroll_revision)||w.payroll_revision<1||!text(w.payroll_event_id))throw Error('Proyeksi payroll tidak lengkap');
   const cash=value.cashbook.filter(c=>c.id==='cb_payroll_'+id);
   if(mode==='proof'&&(cash.length!==1||cash[0].ref!=='upah_'+id||cash[0].tgl!==w.bayar_tgl||cash[0].keluar!==total||cash[0].masuk!==0||cash[0].src!=='payroll'||(cash[0].fund||'K1_K3')!==fund||w.bayar_source!==(fund==='K4'?'pribadi':'wakif')))throw Error('Proyeksi payroll dan buku kas tidak konsisten');
   if(mode==='rekap'&&cash.length)throw Error('Proyeksi upah belum dibayar masih memiliki kas pembayaran');
  }
  const name=text(value.wageBindings?.find(b=>b.id===w.pelapor||b.legacy_token===w.pelapor)?.name)||text(w.name)||text(w.worker)||text(names[w.pelapor]);if(!name)throw Error('Nama pekerja belum tersedia');
  const unit=text(w.satuan_lbl)||text(w.satuan);
  const duration=({'full_day':'1 hari',full:'1 hari','full day':'1 hari',setengah_hari:'½ hari',half:'½ hari'})[unit]||unit?.replaceAll('_',' ')||'Durasi tidak tercatat';
  return {id,date:w.tgl,name,fund,fundLabel:fundLabel(fund),activity:text(w.aktivitas)||'Pekerjaan tercatat',duration,qty:w.qty,tariff:w.tarif,total,paymentDate:mode==='proof'?(text(w.bayar_tgl)||'Tidak tercatat'):null};
 }).sort((a,b)=>String(a.date).localeCompare(String(b.date))||a.id.localeCompare(b.id));
 const funds=rows.reduce((out,r)=>{out[r.fund]=(out[r.fund]||0)+r.total;return out;},{});
 const total=rows.reduce((n,r)=>n+r.total,0);let deductions=0,estimatedDeduction=0;const allocations=[];
 if(!Number.isSafeInteger(total))throw Error('Total upah tidak valid');
 if(!Array.isArray(value.kasbon))throw Error('Source kasbon belum tersedia');
 if(mode==='proof')for(const k of value.kasbon){
  if(k.potongan!=null&&!Array.isArray(k.potongan))throw Error('Jejak kasbon tidak valid');
  for(const p of k.potongan||[]){
   if(!Array.isArray(p.upah_ids))throw Error('Jejak potongan kasbon tidak lengkap');
   const linked=[...new Set(p.upah_ids.map(payrollID))];if(!linked.some(id=>ids.includes(id)))continue;
   if(!linked.every(id=>ids.includes(id))||!Number.isSafeInteger(p.jumlah)||p.jumlah<=0)throw Error('Pilih seluruh upah pada jejak potongan kasbon; alokasi parsial tidak tercatat');
   if(linked.some(id=>value.upah.find(w=>payrollID(w.id)===id)?.pelapor!==k.pelapor))throw Error('Pekerja pada potongan kasbon tidak cocok');
   const wages=linked.map(id=>value.upah.find(w=>payrollID(w.id)===id));
   if(!calendar(p.tgl)||wages.some(w=>w.bayar_tgl!==p.tgl||(w.fund||'K1_K3')!==(wages[0].fund||'K1_K3'))||p.jumlah>wages.reduce((n,w)=>n+w.qty*w.tarif,0))throw Error('Tanggal/dana/alokasi potongan kasbon tidak konsisten');
   if(!Number.isSafeInteger(k.jumlah)||!Number.isSafeInteger(k.terpotong)||k.terpotong<0||k.terpotong>k.jumlah||k.potongan.some(x=>!Number.isSafeInteger(x.jumlah)||x.jumlah<=0)||k.potongan.reduce((n,x)=>n+x.jumlah,0)!==k.terpotong)throw Error('Saldo dan jejak potongan kasbon tidak konsisten');
   allocations.push({ids:linked,amount:p.jumlah});
   deductions+=p.jumlah;
  }
 }
 if(mode==='rekap')for(const token of new Set(ids.map(id=>value.upah.find(w=>payrollID(w.id)===id).pelapor))){
  const gross=ids.map(id=>value.upah.find(w=>payrollID(w.id)===id)).filter(w=>w.pelapor===token).reduce((n,w)=>n+w.qty*w.tarif,0);
  let balance=0;for(const k of value.kasbon.filter(k=>k.pelapor===token)){if(!Number.isSafeInteger(k.jumlah)||k.jumlah<0||(k.terpotong!=null&&(!Number.isSafeInteger(k.terpotong)||k.terpotong<0||k.terpotong>k.jumlah)))throw Error('Saldo kasbon tidak konsisten');balance+=k.jumlah-(k.terpotong||0);}
  estimatedDeduction+=Math.min(gross,balance);
 }
 const linkedCash=value.cashbook.filter(c=>cashIDs(c).some(id=>ids.includes(id)));
 for(const c of linkedCash){
  const linked=cashIDs(c);if(!linked.every(id=>ids.includes(id)))throw Error('Pilih seluruh upah pada buku kas gabungan');
  const wages=linked.map(id=>value.upah.find(w=>payrollID(w.id)===id));
  if(mode==='rekap'||wages.some(w=>!w||w.status!=='lunas')||!Number.isSafeInteger(c.keluar)||c.keluar<0||c.masuk!==0||wages.some(w=>w.bayar_tgl&&w.bayar_tgl!==c.tgl)||(c.fund||'K1_K3')!==(wages[0].fund||'K1_K3')||wages.some(w=>(w.fund||'K1_K3')!==(c.fund||'K1_K3')))throw Error('Upah dan buku kas tidak konsisten');
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
 return {mode,rows,funds,total,deductions,estimatedDeduction,net:total-deductions,generatedAt,filename:mode==='rekap'?'REKAP-UPAH.png':'BUKTI-UPAH.png'};
}
export function openPayrollPreview(win=globalThis.window){
 try{const preview=win?.open('','_blank','width=900,height=1200,scrollbars=yes');if(preview){preview.document.title='Dokumen upah — memeriksa data';preview.document.body.textContent='Memeriksa data server dan membuat PNG…';}return preview;}catch{return null;}
}
function fillPreview(preview,d,href){
 if(!preview||preview.closed)return;
 const doc=preview.document;doc.title=d.filename;doc.body.replaceChildren();doc.body.style.cssText='margin:0;background:#2e4040;color:#fff;font:14px Arial,sans-serif';
 const bar=doc.createElement('header');bar.style.cssText='padding:16px;position:sticky;top:0;background:#1F5F47;display:flex;gap:12px;flex-wrap:wrap;align-items:center';
 const title=doc.createElement('strong');title.textContent=d.mode==='rekap'?'Rekapan upah — BUKAN bukti pembayaran':'Bukti pembayaran — catatan server';
 const download=doc.createElement('a');download.id='payroll-download';download.href=href;download.download=d.filename;download.textContent='Download PNG';download.style.color='#fff';
 const print=doc.createElement('button');print.id='payroll-print';print.textContent='Print';print.onclick=()=>preview.print();
 const wa=doc.createElement('a');wa.id='payroll-whatsapp';wa.href='https://wa.me/?text='+encodeURIComponent((d.mode==='rekap'?'Rekapan hak upah belum dibayar — BUKAN bukti pembayaran.':'Catatan pembayaran upah.')+' '+d.rows.map(r=>r.name+' · '+r.date+' · '+money(r.total)+' · '+r.fundLabel).join('\n')+'\nTotal hak upah: '+money(d.total)+'\nUnduh dan lampirkan PNG ini di WhatsApp.');wa.target='_blank';wa.rel='noopener noreferrer';wa.textContent='WhatsApp';wa.style.color='#fff';
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
export function payrollDocumentHTML(d){return `<section id="payroll-document-render" style="width:800px;background:#fff;color:#2e4040;font:14px Arial,sans-serif;border:3px solid #1F5F47;box-sizing:border-box;padding:30px"><header style="background:#f5f0e6;padding:20px;border-bottom:4px solid #1F5F47"><img src="images/logo-wakaf-produktif-3x1.png" alt="Wakaf Produktif Ngantang" style="width:360px;max-width:100%"><p>Catatan operasional kebun — alokasi dana dirinci di bawah</p><h1>${d.mode==='rekap'?'REKAPAN UPAH PEKERJA':'BUKTI PEMBAYARAN UPAH'}</h1>${d.mode==='rekap'?'<strong style="color:#b45309">BELUM DIBAYAR · BUKAN bukti pembayaran</strong>':''}</header><p>Tanggal pembuatan dokumen: ${escape(d.generatedAt)}</p><table style="width:100%;border-collapse:collapse"><thead><tr><th>Tanggal kerja</th><th>Pekerja / Aktivitas</th><th>Subtotal</th></tr></thead><tbody>${d.rows.map(r=>`<tr><td style="padding:12px;border-bottom:1px solid #ddd">${escape(r.date)}</td><td style="padding:12px;border-bottom:1px solid #ddd"><b>${escape(r.name)}</b><br>${escape(r.activity)}<br>Sumber dana: ${escape(r.fundLabel)}${d.mode==='proof'?`<br>Tanggal bayar: ${escape(r.paymentDate)}`:''}<br>${escape(r.duration)} · ${escape(r.qty)} × ${escape(money(r.tariff))}</td><td style="padding:12px;border-bottom:1px solid #ddd;white-space:nowrap">${money(r.total)}</td></tr>`).join('')}</tbody></table><h2>Total hak upah: ${money(d.total)}</h2><p>Sumber dana: ${Object.keys(d.funds).length>1?'Campuran — ':''}${Object.entries(d.funds).map(([f,n])=>`${fundLabel(f)}: ${money(n)}`).join(' · ')}</p>${d.estimatedDeduction?`<p>Perkiraan potongan kasbon: ${money(d.estimatedDeduction)} — estimasi saja, bukan potongan aktual. Perkiraan diterima: ${money(d.total-d.estimatedDeduction)}.</p>`:''}${d.deductions?`<p>Potongan kasbon tercatat: ${money(d.deductions)}</p><h2>Neto tercatat: ${money(d.net)}</h2>`:''}${d.mode==='rekap'?'<p>Mohon konfirmasi: upah mau diterima sekarang atau dikumpulkan dulu? Dokumen ini BUKAN bukti pembayaran.</p>':'<p>Status lunas berdasarkan catatan server; bukan pernyataan penerimaan yang ditandatangani.</p><div style="display:flex;justify-content:space-around;padding-top:50px"><p>Tanda tangan manual pengelola<br>____________________</p><p>Tanda tangan manual penerima<br>____________________</p></div>'}</section>`;}
