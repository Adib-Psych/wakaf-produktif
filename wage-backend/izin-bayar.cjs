'use strict';
/*
 * IZIN BAYAR OTOMATIS — payroll_targets (refleksi 14 Nov 2026)
 *
 * Masalah: hak upah (wage_entitlements) terbentuk otomatis sejak ADR-050, tetapi izin bayar
 * per upah (payroll_targets/{wageId} = {enabled:true, wage:<salinan persis hak upah>}) hanya
 * dibuat sekali pada aktivasi 8 Nov. Akibatnya setiap upah baru ditolak saat dicatat dibayar
 * ("Upah ini belum lolos pemeriksaan sumber dan buku kas"). Kasus nyata: 7 upah Christo dan
 * 7 upah Lek Nardi, 14 Nov 2026.
 *
 * Modul ini membuat izin itu mengikuti protokol recovery/PAYROLL-RECORDING.md, satu transaksi
 * per upah, hanya create (tidak pernah mengubah izin yang ada). Syarat (semua harus lolos):
 *   1. hak upah ada, eligible:true, status 'belum', tepat satu sumber;
 *   2. wage_processing/{wageId} berstatus created/existing dengan alasan 'eligible';
 *   3. belum ada payroll_states/{wageId} (belum pernah dicatat dibayar);
 *   4. tidak ada baris upah lama (upah/active) untuk pekerja + tanggal yang sama;
 *   5. tidak ada kasbon pekerja yang belum lunas di buku kas
 *      (total baris "[kasbon]" atas nama pekerja dikurangi seluruh potong_kasbon pada baris
 *      "Upah <pekerja>" harus <= 0);
 *   6. bila izin sudah ada: harus enabled dan wage-nya sama persis → "sudah"; selain itu ditahan.
 * Yang tidak lolos → status 'ditahan' + alasan; tidak ada yang ditulis untuk upah itu.
 *
 * TIDAK membayar, tidak menyentuh payroll_states/events, cashbook, upah, atau hak upah.
 */
const {isDeepStrictEqual:equal}=require('node:util');

const ID=/^wage_v1_[A-Z][A-Z0-9_]{0,63}_\d{4}-\d\d-\d\d$/;
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

// Sisa kasbon untuk satu pekerja dari buku kas (angka rupiah). Nama dicocokkan sebagai kata utuh,
// baik nama tampilan (mis. "Christo", "Lek Nardi" → juga "Nardi") maupun token (CHRISTO, NARDI).
function sisaKasbon(rows,wage){
 const nama=[wage.worker,wage.pelapor,...String(wage.worker||'').split(/\s+/).filter(x=>x.length>=4)]
  .filter(x=>typeof x==='string'&&x.trim()).map(x=>esc(x.trim()));
 if(!nama.length)return {galat:'nama_pekerja_kosong'};
 const re=new RegExp('\\b(?:'+nama.join('|')+')\\b','i');
 let kasbon=0,potong=0;
 for(const r of rows){
  if(!r||typeof r!=='object')continue;
  const ket=typeof r.ket==='string'?r.ket:'';
  if(!re.test(ket))continue;
  if(/\[kasbon\]/i.test(ket)&&!/^\s*upah\b/i.test(ket))kasbon+=Number(r.keluar)||0;
  if(/^\s*upah\b/i.test(ket))potong+=Number(r.potong_kasbon)||0;
 }
 return {kasbon,potong,sisa:kasbon-potong};
}

async function buatIzin(db,wageId,{tulis=true}={}){
 if(!ID.test(wageId))throw Error('wage-id-tidak-valid');
 const ref=n=>db.doc(`${n}/${wageId}`);
 return db.runTransaction(async tx=>{
  const [e,t,s,p,u,c]=await Promise.all([tx.get(ref('wage_entitlements')),tx.get(ref('payroll_targets')),tx.get(ref('payroll_states')),tx.get(ref('wage_processing')),tx.get(db.doc('upah/active')),tx.get(db.doc('cashbook/active'))]);
  const tahan=alasan=>({id:wageId,status:'ditahan',alasan});
  if(!e.exists)return tahan('hak_upah_tidak_ada');
  const w=e.data();
  if(w.eligible!==true||w.status!=='belum')return tahan('hak_upah_tidak_eligible');
  if(!Array.isArray(w.sources)||w.sources.length!==1)return tahan('sumber_tidak_tunggal');
  const pr=p.data();
  if(!pr||!['created','existing'].includes(pr.status)||pr.reason!=='eligible')return tahan('proses_belum_tuntas');
  if(s.exists)return tahan('sudah_dicatat_dibayar');
  const upah=u.data()?.data;
  if(!Array.isArray(upah))return tahan('buku_upah_lama_tidak_terbaca');
  if(upah.some(x=>x&&x.pelapor===w.pelapor&&x.tgl===w.tgl))return tahan('upah_lama_tanggal_sama');
  const kas=c.data()?.data;
  if(!Array.isArray(kas))return tahan('buku_kas_tidak_terbaca');
  const k=sisaKasbon(kas,w);
  if(k.galat)return tahan(k.galat);
  if(k.sisa>0)return {...tahan('kasbon_belum_lunas'),kasbon:k};
  if(t.exists){
   const d=t.data();
   if(d.enabled===true&&equal(d.wage,w)&&equal(Object.keys(d).sort(),['enabled','wage']))return {id:wageId,status:'sudah'};
   return tahan('izin_ada_tapi_berbeda');
  }
  if(tulis)tx.create(ref('payroll_targets'),{enabled:true,wage:w});
  return {id:wageId,status:tulis?'dibuat':'akan_dibuat'};
 });
}

// Semua hak upah eligible + belum yang belum punya izin (jaring pengaman sapuan).
async function kandidat(db){
 const [e,t]=await Promise.all([db.collection('wage_entitlements').get(),db.collection('payroll_targets').get()]);
 const ada=new Set(t.docs.map(d=>d.id));
 return e.docs.filter(d=>!ada.has(d.id)&&d.data().eligible===true&&d.data().status==='belum').map(d=>d.id).sort();
}

async function sapuIzin(db,{tulis=false}={}){
 const hasil=[];
 for(const id of await kandidat(db))hasil.push(await buatIzin(db,id,{tulis}));
 const ditahan=hasil.filter(h=>h.status==='ditahan');
 return {tulis,hasil,ringkas:{diperiksa:hasil.length,dibuat:hasil.filter(h=>h.status==='dibuat').length,akan_dibuat:hasil.filter(h=>h.status==='akan_dibuat').length,ditahan:ditahan.length},kode:ditahan.length?3:0};
}

module.exports={buatIzin,sapuIzin,kandidat,sisaKasbon};
