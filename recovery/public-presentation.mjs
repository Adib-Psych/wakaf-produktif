// Presentation only: raw health metadata stays in the reader, never becomes public header text.
import {domainWarning} from './public-health.mjs';
export function publicReadStatus(value,{lastSuccess=null,readFailed=false}={}){
 const states=Object.values(value?._meta?.domains||{}).map(d=>d.state);
 const time=lastSuccess&&Number.isFinite(Date.parse(lastSuccess))?new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}).format(new Date(lastSuccess))+' WIB':null;
 if(readFailed)return {state:lastSuccess?'stale':'error',text:lastSuccess?'Pembaruan tertunda · menampilkan data terakhir.':'Data belum dapat dimuat. Silakan coba lagi.'};
 if(!lastSuccess)return {state:'loading',text:'Memuat data kebun…'};
 if(states.some(s=>['partial','stale','error','missing'].includes(s))||value?._meta?.errors?.length)return {state:'partial',text:'Sebagian data belum tersedia atau belum diperbarui. Periksa pemberitahuan pada bagian terkait.'};
 return {state:'ready',text:'Data diperbarui'+(time?' '+time:'.')};
}
export function publicDomainNotice(value,keys){
 const warnings=[...new Set(keys.map(k=>domainWarning(value?._meta,k)).filter(Boolean))];
 if(warnings.length)return warnings[0];
 if(keys.some(k=>value?.[k]==null))return 'Sebagian informasi pada bagian ini belum tersedia.';
 return '';
}
