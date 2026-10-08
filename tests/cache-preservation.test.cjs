const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(require('node:path').join(__dirname,'../monitor-v2.html'),'utf8');
for(const key of ['wkkn_v2_upah','wkkn_v2_milestones','wkkn_sop_status_v1','wkkn_v2_opt_obs'])test('never removes incident cache '+key,()=>assert.ok(!h.includes("localStorage.removeItem('"+key+"')"), key+' removed by source'));
