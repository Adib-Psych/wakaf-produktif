import {test} from 'node:test';
import assert from 'node:assert/strict';
import {optDetailFields} from '../recovery/opt-public-detail.mjs';
test('public OPT details are literal text and do not resolve device-owned photos',()=>{
 const row={id:'opt_opaque',tgl:'2026-11-01',kebun:'K1',pelapor:'Worker',keterangan:'<img src=x onerror=alert(1)>\nGejala',foto:['device-photo'],ai_status:'analyzed',ai_hypothesis:'<script>bad</script>',expert_status:'validated',expert_notes:'Catatan'};
 const fields=optDetailFields(row);assert.equal(fields.find(x=>x[0]==='Keterangan lapangan')[1],row.keterangan);assert.match(fields.find(x=>x[0]==='Foto')[1],/perangkat asal/);assert.equal(fields.find(x=>x[0]==='Hipotesis AI')[1],'<script>bad</script>');assert.equal(JSON.stringify(row.foto),'["device-photo"]');
});
test('unknown or malformed detail is refused instead of rendered as zero',()=>{assert.throws(()=>optDetailFields(null));assert.throws(()=>optDetailFields({}));});
