// Public recorded narrative only; device attachment blobs have no public ownership binding.
const label=value=>typeof value==='string'&&value.trim()?value:'Tidak tercatat';
export function optDetailFields(row){
 if(!row||typeof row.id!=='string'||!row.id)throw Error('Observasi tidak tersedia');
 return [['Kebun',label(row.kebun)],['Tanggal observasi',label(row.tgl)],['Pelapor',label(row.pelapor)],['Keterangan lapangan',label(row.keterangan)],['Foto',Array.isArray(row.foto)&&row.foto.length?'Referensi foto tercatat; berkas pada perangkat asal belum terikat ke pembaca publik.':'Tidak ada referensi foto tercatat.'],['Status analisis AI',label(row.ai_status)],['Hipotesis AI',label(row.ai_hypothesis)],['Rekomendasi AI',label(row.ai_treatment)],['Confidence AI',label(row.ai_confidence)],['Status validasi ahli',label(row.expert_status)],['Nama ahli',label(row.expert_name)],['Afiliasi ahli',label(row.expert_affiliation)],['Catatan ahli',label(row.expert_notes)],['Tanggal kunjungan ahli',label(row.expert_visit_date)]];
}
export function showPublicOptDetail(row,{document=globalThis.document}={}){
 const body=document.getElementById('opt-detail-body'),overlay=document.getElementById('opt-detail-modal-overlay');
 if(!body||!overlay)throw Error('Panel detail belum tersedia');
 const fields=optDetailFields(row),list=document.createElement('dl');
 for(const [title,text]of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=title;dd.textContent=text;dd.style.whiteSpace='pre-wrap';list.append(dt,dd);}
 body.replaceChildren(list);overlay.style.display='flex';
}
