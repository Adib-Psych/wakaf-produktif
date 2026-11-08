// No timers, storage or backend authority: refresh only on explicit request.
export function bindPublicRefresh({button,note,read,now=Date.now,cooldownMs=60000}){
 let pending=null,lastAttempt=-Infinity;
 const refresh=()=>{
  if(pending)return pending;
  const wait=cooldownMs-(now()-lastAttempt);
  if(wait>0){note.textContent='Tunggu '+Math.ceil(wait/1000)+' detik sebelum memperbarui lagi.';return Promise.resolve();}
  lastAttempt=now();button.disabled=true;button.textContent='Memperbarui…';note.textContent='Mengambil data terbaru…';
  pending=Promise.resolve().then(read).then(()=>{note.textContent='Tekan Perbarui data untuk mengambil data terbaru. Periksa status sumber di atas.';}).catch(()=>{note.textContent='Pembaruan belum berhasil. Data terakhir bukan konfirmasi sinkronisasi laporan.';}).finally(()=>{pending=null;button.disabled=false;button.textContent='Perbarui data';});
  return pending;
 };
 button.addEventListener('click',()=>void refresh());
 return refresh;
}
