const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),{harness,fixture}=require('./authorized-report-harness.cjs');
const html=fs.readFileSync('lapor.html','utf8'),a=html.indexOf('const REGISTRY ='),b=html.indexOf('\n};',a)+3,c={};vm.createContext(c);vm.runInContext(html.slice(a,b)+';this.registry=REGISTRY;',c);
for(const [category,spec] of Object.entries(c.registry))test('actual registry category accepts serialized control types and refuses unknown detail '+category,async()=>{
 const detail={};for(const f of spec.fields){detail[f.id]=f.type==='multi'?[f.options[0]]:f.type==='chip-method'?f.options[0].val:f.type==='select'?f.options[0]:'1';}
 const h=harness(),body=fixture('worker',{id:'lap_'+category,kategori:category,detail});assert.equal(await h.send(body),body.id);await assert.rejects(h.send({...body,id:'lap_bad_'+category,detail:{...detail,unknown_field:true}}),/unsupported-entry/);
});
