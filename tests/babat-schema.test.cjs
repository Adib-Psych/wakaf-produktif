const {test}=require('node:test'),assert=require('node:assert/strict'),{harness,fixture}=require('./authorized-report-harness.cjs');
test('existing babat worker constructor strings and keys preserved; unknown key/type refused',async()=>{
 const h=harness(),b=fixture('worker',{kategori:'babat_rumput',detail:{method:'sabit',area_m2:'12',tinggi_gulma_pre_cm:'40',status_mulsa:'Dibiarkan',bahan_habis_rp:'0',sumber_tenaga:'Sendiri'}});
 assert.equal(await h.send(b),b.id);assert.deepEqual(h.record(b.id),b);
 for(const detail of [{...b.detail,invented:true},{...b.detail,area_m2:12},{...b.detail,method:'unknown'}])await assert.rejects(h.send({...b,id:'lap_bad-babat',detail}),/unsupported-entry/);
});
