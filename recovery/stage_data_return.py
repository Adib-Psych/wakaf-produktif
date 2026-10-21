"""Synthetic-only ephemeral preview projection. Reads explicit input; no database/network writes."""
import json,sys,hashlib,subprocess
from pathlib import Path
from data_return import validate

def stage(contract,manifest,records,source):
 verdict=validate(contract,manifest,records)
 if not verdict['structural_pass']:raise ValueError(json.dumps(verdict))
 if manifest['synthetic'] is not True or not manifest['source']['project'].startswith('demo-'):raise ValueError('Synthetic staging only; production import not implemented')
 html=(Path(source)/'monitor-v2.html').read_text()
 def between(start,end):
  a=html.index(start);b=html.index(end,a);return html[a:b]
 normalize=between('    function normalizeWorkerEntry(','\n    // Migration:')
 helpers={name:between('function '+name+'(',end) for name,end in [('getCherryPerGrade','\n// ═══ Ledger Output'),('getGbInventory','\n// Catat Jual'),('calcTotal','\n// ============================================================================')]}
 export=between('async function exportCSV()','\n// ===== ANGGARAN')
 payload={'documents':json.loads(records),'source_sha256':hashlib.sha256(html.encode()).hexdigest()}
 js=r'''const vm=require('vm'),assert=require('assert/strict');let raw='';process.stdin.on('data',x=>raw+=x);process.stdin.on('end',async()=>{const input=JSON.parse(raw),docs=input.documents;function decode(v){const [k,x]=Object.entries(v)[0];if(k==='nullValue')return null;if(k==='integerValue')return Number(x);if(k==='mapValue')return Object.fromEntries(Object.entries(x.fields||{}).map(([k,v])=>[k,decode(v)]));if(k==='arrayValue')return(x.values||[]).map(decode);return x;}
const by={};for(const d of docs){const [collection,id]=d.name.split('/').slice(-2);by[collection]??=[];by[collection].push({id,...Object.fromEntries(Object.entries(d.fields).map(([k,v])=>[k,decode(v)]))});}
const c={console:{warn(){}},computeRainfallAlerts:()=>[],DRIED_GRADES:['merah','kuning','hijau','hitam','mengambang'],PANEN_DATA:by.panen_data?.flatMap(x=>x.data||[])||[],PANEN_LOTS_DATA:by.panen_lots?.flatMap(x=>x.data||[])||[],STATE:{laporan:[]},window:{reportReadSession:{active:true},decodePrivateReports:rows=>rows.map(x=>c.normalizeWorkerEntry(x.data)),privateReader:{exportRead:async(_scope,emit)=>emit({laporan:(by.laporan||[]).map(d=>({id:d.id,data:d})),report_heads:[]})}},Blob:class{constructor(p){this.text=p.join('');}},URL:{createObjectURL:b=>{c.csv=b.text;return 'blob:synthetic';}},document:{getElementById:()=>({value:''}),createElement:()=>({click(){c.downloads=(c.downloads||0)+1;}})},Date,alert(){throw Error('unexpected refusal');}};
vm.createContext(c);vm.runInContext(NORMALIZE+HELPERS+EXPORT,c);for(const d of by.laporan||[])c.STATE.laporan.push(c.normalizeWorkerEntry(d));await c.exportCSV();const cherry=c.getCherryPerGrade(),gb=c.getGbInventory();assert(Object.values(cherry).every(Number.isFinite));assert(Object.values(gb).every(Number.isFinite));assert.equal(c.downloads,1);assert(!/NaN|undefined|\[object Object\]/.test(c.csv));const result={synthetic:true,source_sha256:input.source_sha256,report_rows:c.STATE.laporan.length,harvest_rows:c.PANEN_DATA.length,lot_rows:c.PANEN_LOTS_DATA.length,cherry_by_grade:cherry,greenbean_by_grade:gb,csv:c.csv,actual_export_download_calls:c.downloads,mutations:0,network:0,semantic_acceptance:false};process.stdout.write(JSON.stringify(result));});'''
 js=js.replace('NORMALIZE',json.dumps(normalize)).replace('HELPERS',json.dumps('\n'.join(helpers.values()))).replace('EXPORT',json.dumps(export))
 run=subprocess.run(['node','-e',js],input=json.dumps(payload),text=True,capture_output=True,timeout=20)
 if run.returncode:raise ValueError('Actual-source staged calculation failed: '+run.stderr[-2000:])
 return {'preflight':verdict,'preview':json.loads(run.stdout),'mode':'ephemeral VM actual normalization/calculation/export; not native DOM/Firestore restore'}

def main():
 import argparse
 p=argparse.ArgumentParser();p.add_argument('--contract',type=Path,required=True);p.add_argument('--manifest',type=Path,required=True);p.add_argument('--records',type=Path,required=True);p.add_argument('--source',type=Path,required=True);a=p.parse_args()
 print(json.dumps(stage(json.loads(a.contract.read_bytes()),json.loads(a.manifest.read_bytes()),a.records.read_bytes(),a.source),indent=2))
if __name__=='__main__':main()
