"""Generate exact control-type predicates from actual worker registry; no business thresholds."""
from pathlib import Path
import subprocess,json,re,hashlib
root=Path(__file__).resolve().parent.parent
s=(root/'lapor.html').read_text();a=s.index('const REGISTRY =');b=s.index('\n};',a)+3
registry=json.loads(subprocess.check_output(['node','-e',s[a:b]+';console.log(JSON.stringify(REGISTRY))']))
a=s.index('function collectWakifOnlyStubs(');b=s.index('\n}',a)+2
stubs=json.loads(subprocess.check_output(['node','-e',s[a:b]+';console.log(JSON.stringify(Object.fromEntries('+json.dumps(list(registry)) +'.map(k=>[k,collectWakifOnlyStubs(k)]))))']))
contract={c:{'fields':{f['id']:{'type':f['type'],'options':f.get('options',[])} for f in spec['fields']},'null_stubs':stubs[c]} for c,spec in registry.items()}
(root/'recovery/worker-category-contract.json').write_text(json.dumps({'source_registry_sha256':hashlib.sha256(s[s.index('const REGISTRY ='):s.index('\n};',s.index('const REGISTRY ='))+3].encode()).hexdigest(),'categories':contract},indent=2,ensure_ascii=False)+'\n')
js='''// BEGIN GENERATED WORKER CATEGORY CONTRACT
const workerCategories=CONTRACT;
function categoryDetail(category,d){
 const spec=workerCategories[category];if(!spec||!obj(d))return false;
 return Object.entries(d).every(([k,v])=>{
  if(spec.null_stubs.includes(k))return v===null;
  const f=spec.fields[k];if(!f)return false;
  if(f.type==='multi')return Array.isArray(v)&&v.every(x=>typeof x==='string'&&f.options.includes(x));
  if(typeof v!=='string')return false;
  if(f.type==='select')return v===''||f.options.includes(v);
  if(f.type==='chip-method')return f.options.some(x=>x.val===v);
  return true; // number/date/time controls deliberately serialize their literal input.value strings.
 });
}
// END GENERATED WORKER CATEGORY CONTRACT'''.replace('CONTRACT;',json.dumps(contract,separators=(',',':'),ensure_ascii=False)+';')
p=root/'recovery/authorized-reports.js';text=p.read_text()
if '// BEGIN GENERATED WORKER CATEGORY CONTRACT' in text:text=re.sub(r'// BEGIN GENERATED WORKER CATEGORY CONTRACT.*?// END GENERATED WORKER CATEGORY CONTRACT',lambda _:js,text,flags=re.S)
else:
 a=text.index('const babatKeys=');b=text.index('export function validReportBody',a);text=text[:a]+js+'\n'+text[b:]
text=text.replace("!['lain','babat_rumput'].includes(b.kategori)","!Object.hasOwn(workerCategories,b.kategori)")
text=text.replace("(b.kategori==='lain'||validBabat(b.detail))",'categoryDetail(b.kategori,b.detail)')
p.write_text(text)
# Rules: dispatch on category before evaluating category-specific field predicate.
q=lambda v:json.dumps(v,ensure_ascii=False,separators=(',',':'))
functions=[];branches=[]
for i,(cat,spec) in enumerate(contract.items()):
 name='category'+str(i);keys=list(spec['fields'])+spec['null_stubs'];checks=['d is map','d.keys().hasOnly('+q(keys)+')']
 for k,f in spec['fields'].items():
  ref='d['+q(k)+']'
  if f['type']=='multi':pred=ref+' is list && '+ref+'.hasOnly('+q(f['options'])+')'
  elif f['type']=='chip-method':pred=ref+' in '+q([x['val'] for x in f['options']])
  elif f['type']=='select':pred=ref+' in '+q(['']+f['options'])
  else:pred=ref+' is string'
  checks.append('(!('+q(k)+' in d)||('+pred+'))')
 for k in spec['null_stubs']:checks.append('(!('+q(k)+' in d)||d['+q(k)+']==null)')
 functions.append(' function '+name+'(d){return '+' && '.join(checks)+';}')
 branches.append('(category=='+q(cat)+' && '+name+'(d))')
rules='// BEGIN GENERATED WORKER CATEGORY RULES\n'+'\n'.join(functions)+'\n function categoryDetail(category,d){return '+''.join('(category=='+q(cat)+'?category'+str(i)+'(d):' for i,cat in enumerate(contract))+'false'+')'*len(contract)+';}\n// END GENERATED WORKER CATEGORY RULES'
p=root/'recovery/firestore.authorized-report.rules';text=p.read_text()
if '// BEGIN GENERATED WORKER CATEGORY RULES' in text:text=re.sub(r'// BEGIN GENERATED WORKER CATEGORY RULES.*?// END GENERATED WORKER CATEGORY RULES',lambda _:rules,text,flags=re.S)
else:
 a=text.index(' function babat(');b=text.index(' function body(',a);text=text[:a]+rules+'\n'+text[b:]
text=text.replace("b.kategori in ['lain','babat_rumput']",'b.kategori in '+q(list(contract)))
text=text.replace("(b.kategori=='lain'||babat(b.detail))",'categoryDetail(b.kategori,b.detail)');p.write_text(text)
print(json.dumps({'categories':len(contract),'qualified_fields':sum(len(x['fields']) for x in contract.values()),'source':'actual worker REGISTRY and collectWakifOnlyStubs','business_numeric_bounds':'not invented'}))
