import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildPayrollDocument,payrollDocumentHTML} from '../recovery/payroll-documents.mjs';

// Golden HTML digests from the explicitly selected C preview, not the implementation.
// Fixed synthetic input matches build-preview.cjs; hashes cover every color, glyph,
// wording, logo reference, font, geometry and amount in both approved documents.
const approved={rekap:'2a89e892001e46aece584a089beaf5c7ed9238aca3fba87d3aa9f74aff00080b',proof:'37cd9871d27263861c72f1e978b0f806fcb78068e1d74ac2ac882c6a4b28bee5'};
const fixture={upah:[{id:'DEMO_1',tgl:'2026-11-02',pelapor:'CONTOH',name:'Pekerja Contoh',aktivitas:'Perawatan tanaman kopi',model:'harian',satuan:'full day',qty:1,tarif:100000,status:'belum'},{id:'DEMO_2',tgl:'2026-11-03',pelapor:'CONTOH',name:'Pekerja Contoh',aktivitas:'Pembersihan kebun',model:'harian',satuan:'setengah_hari',qty:1,tarif:50000,status:'belum'},{id:'DEMO_3',tgl:'2026-11-04',pelapor:'CONTOH',name:'Pekerja Contoh',aktivitas:'Pemeliharaan jalur kebun',model:'harian',satuan:'full day',qty:0.5,tarif:100000,status:'belum'}],cashbook:[],kasbon:[{id:'DEMO_K',pelapor:'CONTOH',tgl:'2026-11-01',keperluan:'Contoh kasbon untuk pemeriksaan warna',jumlah:25000,terpotong:0,potongan:[]}]};
test('payroll documents exactly match selected palette C recap and proof preview HTML',()=>{
 for(const mode of ['rekap','proof']){
  const value=structuredClone(fixture);
  if(mode==='proof'){
   for(const w of value.upah)Object.assign(w,{status:'lunas',bayar_tgl:'2026-11-08'});
   value.kasbon[0].terpotong=25000;value.kasbon[0].potongan=[{upah_ids:['DEMO_1','DEMO_2','DEMO_3'],jumlah:25000,tgl:'2026-11-08'}];
  }
  const before=JSON.stringify(value);
  const html=payrollDocumentHTML(buildPayrollDocument({value,selected:value.upah.map(w=>w.id),mode,generatedAt:'2026-11-09T02:00:00Z'}));
  // Explicit inherited cell colors prevent global dashboard th CSS from overriding
  // the approved row palette. This color-only isolation is the sole golden delta.
  assert.equal((html.match(/<th style="background:inherit;color:inherit;/g)||[]).length,3);
  const normalized=html.replaceAll('<th style="background:inherit;color:inherit;','<th style="');
  assert.equal(createHash('sha256').update(normalized).digest('hex'),approved[mode],mode+' must reproduce approved C preview except explicit table-cell color inheritance');
  assert.doesNotMatch(html,/💵|🌱|#(?:1f5f47|5a9080|2e4040|6b7878|a8c8bc|e8f1ec|166534)\b/i);
  assert.match(html,/− (?:PERKIRAAN )?POTONGAN KASBON/);assert.match(html,/• <strong/);
  assert.equal(JSON.stringify(value),before,'presentation must not mutate source');
 }
});
