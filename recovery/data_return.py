"""Read-only typed data-return preflight. Never writes, unions, imports or approves business truth."""
import json,hashlib,re,math,datetime

def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()
def sha(b):return hashlib.sha256(b).hexdigest()
def date(v):
 if not isinstance(v,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})',v):raise ValueError('RFC3339 timestamp required')
 if v[-1]!='Z':
  hours,minutes=map(int,v[-5:].split(':'))
  if hours>23 or minutes>59:raise ValueError('timezone-offset-range')
 return datetime.datetime.fromisoformat(v.replace('Z','+00:00'))
def contract_valid(c):
 tags={'stringValue','integerValue','doubleValue','nullValue','booleanValue','referenceValue','timestampValue','bytesValue','mapValue','arrayValue','geoPointValue'}
 if not isinstance(c,dict) or set(c)!={'version','id','source','collections'} or type(c['version']) is not int or c['version']!=1 or not isinstance(c['id'],str) or not c['id'] or not isinstance(c['source'],dict) or not isinstance(c['collections'],dict) or not c['collections']:raise ValueError('contract-schema')
 for col,spec in c['collections'].items():
  if not isinstance(col,str) or not re.fullmatch(r'[A-Za-z0-9_-]+',col) or not isinstance(spec,dict) or set(spec)!={'required','required_fields','units','row_array','links'} or type(spec['required']) is not bool or not isinstance(spec['required_fields'],dict) or not spec['required_fields'] or not isinstance(spec['units'],dict) or not isinstance(spec['links'],list):raise ValueError('collection-contract-schema')
  if any(not isinstance(k,str) or not k or v not in tags for k,v in spec['required_fields'].items()) or any(not isinstance(k,str) or not isinstance(v,str) or not v for k,v in spec['units'].items()):raise ValueError('field-contract-schema')
  r=spec['row_array']
  if r is not None and (not isinstance(r,dict) or set(r)!={'path','id_field','required_fields'} or not isinstance(r['path'],list) or not r['path'] or any(not isinstance(x,str) or not x for x in r['path']) or not isinstance(r['id_field'],str) or not isinstance(r['required_fields'],dict) or r['required_fields'].get(r['id_field'])!='stringValue' or any(not isinstance(k,str) or not k or v not in tags for k,v in r['required_fields'].items())):raise ValueError('row-contract-schema')
  for link in spec['links']:
   if not isinstance(link,dict) or set(link)!={'field','collection'} or not isinstance(link['field'],str) or link['collection'] not in c['collections'] or spec['required_fields'].get(link['field'])!='referenceValue':raise ValueError('link-contract-schema')
def typed(v,p,issues):
 def bad(code):issues.append({'code':code,'pointer':p})
 if not isinstance(v,dict) or len(v)!=1:bad('typed-envelope');return
 tag,x=next(iter(v.items()))
 if tag=='nullValue':
  if x is not None:bad('null-type')
 elif tag in ['stringValue','referenceValue','timestampValue','bytesValue']:
  if not isinstance(x,str):bad('string-type')
  elif tag=='bytesValue':
   try:
    import base64
    base64.b64decode(x,validate=True)
   except (ValueError,TypeError):bad('base64')
  elif tag=='timestampValue':
   try:date(x)
   except (ValueError,TypeError):bad('timestamp')
 elif tag=='booleanValue':
  if type(x) is not bool:bad('boolean-type')
 elif tag=='integerValue':
  if not isinstance(x,str) or not re.fullmatch(r'-?(0|[1-9][0-9]*)',x):bad('integer-type')
  elif abs(int(x))>9007199254740991:bad('unsafe-browser-integer')
 elif tag=='doubleValue':
  if type(x) not in [int,float] or not math.isfinite(x):bad('finite-double')
 elif tag=='geoPointValue':
  if not isinstance(x,dict) or set(x)!={'latitude','longitude'} or any(type(x[k]) not in [int,float] or not math.isfinite(x[k]) for k in x) or not -90<=x['latitude']<=90 or not -180<=x['longitude']<=180:bad('geopoint')
 elif tag=='arrayValue':
  if not isinstance(x,dict) or set(x)-{'values'} or not isinstance(x.get('values',[]),list):bad('array-type')
  else:
   for i,row in enumerate(x.get('values',[])):typed(row,p+'/arrayValue/values/'+str(i),issues)
 elif tag=='mapValue':
  if not isinstance(x,dict) or set(x)-{'fields'} or not isinstance(x.get('fields',{}),dict):bad('map-type')
  else:
   for k,val in x.get('fields',{}).items():typed(val,p+'/mapValue/fields/'+k,issues)
 else:bad('unknown-type-tag')

def strict_pairs(pairs):
 result={}
 for k,v in pairs:
  if k in result:raise ValueError('duplicate-json-key')
  result[k]=v
 return result
def validate(contract,manifest,records_bytes,baseline=None):
 issues=[];counts={};index={};row_index={};references=[]
 def issue(code,p):issues.append({'code':code,'pointer':p})
 result={'structural_pass':False,'production_authorized':False,'business_accepted':False,'writes':0,'network':0,'issues':issues,'counts':counts,'changes':{'added':[],'replaced':[],'absent':[]},'auto_fixes':[]}
 try:
  contract_valid(contract)
  if type(manifest.get('synthetic')) is not bool:raise ValueError('synthetic-boolean')
  if type(contract.get('version')) is not int or contract['version']!=1 or not isinstance(contract.get('collections'),dict):raise ValueError('contract')
  if set(manifest)!={'version','schema','synthetic','source','cutoff','capture_start','capture_end','contract_sha256','records_sha256','collections','units','historical_union'}:raise ValueError('manifest-keys')
  if type(manifest['version']) is not int or manifest['version']!=1 or manifest['schema']!='wakaf-typed-return-v1':issue('schema-version','/manifest')
  if manifest['source']!=contract['source']:issue('source-identity','/manifest/source')
  if set(contract['source'])!={'project','database'} or not re.fullmatch(r'[a-zA-Z0-9_-]+',contract['source']['project']) or not re.fullmatch(r'\(default\)|[a-zA-Z0-9_-]+',contract['source']['database']):raise ValueError('source-contract')
  if manifest['contract_sha256']!=sha(canonical(contract)):issue('contract-hash','/manifest/contract_sha256')
  if manifest['records_sha256']!=sha(records_bytes):issue('source-hash','/manifest/records_sha256')
  if manifest['historical_union'] is not False:issue('historical-union','/manifest/historical_union')
  cutoff,start,end=map(date,[manifest['cutoff'],manifest['capture_start'],manifest['capture_end']])
  if any(d.tzinfo is None for d in [cutoff,start,end]) or start>end:issue('capture-interval','/manifest')
  expected_units={c+'/'+p:u for c,s in contract['collections'].items() for p,u in s['units'].items()}
  if manifest['units']!=expected_units:issue('units','/manifest/units')
  if set(manifest['collections'])!=set(contract['collections']):issue('capture-coverage','/manifest/collections')
  docs=json.loads(records_bytes,object_pairs_hook=strict_pairs,parse_constant=lambda _: (_ for _ in ()).throw(ValueError('non-finite-json')))
  if not isinstance(docs,list):raise ValueError('documents-list')
  prefix='projects/'+contract['source']['project']+'/databases/'+contract['source']['database']+'/documents/'
  for i,d in enumerate(docs):
   ptr='/records/'+str(i)
   if not isinstance(d,dict) or set(d)!={'name','fields'} or not isinstance(d['name'],str) or not d['name'].startswith(prefix) or not isinstance(d['fields'],dict):issue('document-shape-source',ptr);continue
   rel=d['name'][len(prefix):].split('/')
   if len(rel)!=2 or any(not re.fullmatch(r'[A-Za-z0-9_-]+',x) for x in rel):issue('document-path',ptr);continue
   c,identity=rel
   if c not in contract['collections']:issue('unexpected-collection',ptr);continue
   if d['name'] in index:issue('duplicate-document',ptr);continue
   index[d['name']]=d;spec=contract['collections'][c];
   if set(d['fields'])-set(spec['required_fields']):issue('unexpected-field',ptr+'/fields')
   counts.setdefault(c,{'documents':0,'rows':0});counts[c]['documents']+=1
   for k,v in d['fields'].items():
    typed(v,ptr+'/fields/'+k,issues)
    if spec['units'].get(k) in ['kg','g','trees'] and isinstance(v,dict):
     raw=v.get('integerValue',v.get('doubleValue'))
     if raw is not None:
      try:
       if float(raw)<0:issue('negative-measurement',ptr+'/fields/'+k)
      except (ValueError,TypeError):issue('measurement-type',ptr+'/fields/'+k)
   for k,tag in spec['required_fields'].items():
    if k not in d['fields'] or not isinstance(d['fields'][k],dict) or set(d['fields'][k])!={tag}:issue('required-field-type',ptr+'/fields/'+k)
   if 'id' in d['fields'] and d['fields']['id']!={'stringValue':identity}:issue('document-id-mismatch',ptr+'/fields/id')
   if 'tanggal' in d['fields']:
    try:
     dt=datetime.date.fromisoformat(d['fields']['tanggal']['stringValue'])
     if dt>cutoff.date():issue('post-cutoff',ptr+'/fields/tanggal')
    except (ValueError,KeyError,TypeError):issue('calendar',ptr+'/fields/tanggal')
   row_spec=spec['row_array']
   if row_spec:
    fields=d['fields'];node=None
    try:
     for j,k in enumerate(row_spec['path']):
      node=fields[k];fields=node['mapValue']['fields'] if j<len(row_spec['path'])-1 else fields
     if node is None:raise ValueError('missing-row-path')
     rows=node['arrayValue'].get('values',[])
     for n,row in enumerate(rows):
      rptr=ptr+'/rows/'+str(n);rf=row['mapValue']['fields'];
      if set(rf)-set(row_spec['required_fields']):issue('unexpected-row-field',rptr)
      rid=rf[row_spec['id_field']]['stringValue'];key=d['name']+'#'+rid
      if not isinstance(rid,str) or not rid or key in row_index:issue('duplicate-row-identity',rptr)
      row_index[key]=row
      for k,val in rf.items():
       if spec['units'].get('/'.join(row_spec['path'])+'/*/'+k) in ['kg','g','trees']:
        raw=val.get('integerValue',val.get('doubleValue'))
        if raw is not None:
         try:
          if float(raw)<0:issue('negative-measurement',rptr+'/'+k)
         except (ValueError,TypeError):issue('measurement-type',rptr+'/'+k)
      for k,tag in row_spec['required_fields'].items():
       if k not in rf or set(rf[k])!={tag}:issue('row-required-type',rptr+'/'+k)
      if 'tgl' in rf:
       try:
        if datetime.date.fromisoformat(rf['tgl']['stringValue'])>cutoff.date():issue('post-cutoff',rptr+'/tgl')
       except (ValueError,TypeError,KeyError):issue('calendar',rptr+'/tgl')
     counts[c]['rows']+=len(rows)
    except (KeyError,TypeError,AttributeError):issue('required-row-array',ptr)
   else:counts[c]['rows']+=1
   for link in spec['links']:
    field=link['field'];value=d['fields'].get(field)
    if value is None:issue('required-link',ptr+'/fields/'+field)
    elif value.get('referenceValue') is not None:references.append((value['referenceValue'],ptr+'/fields/'+field,link['collection']))
    else:issue('link-type',ptr+'/fields/'+field)
  def scan_refs(value,pointer):
   if not isinstance(value,dict):return
   if 'referenceValue' in value:
    name=value['referenceValue']
    if not isinstance(name,str) or name not in index or not name.startswith(prefix):issue('undeclared-or-foreign-reference',pointer)
   for key,val in value.items():
    if isinstance(val,dict):scan_refs(val,pointer+'/'+key)
    elif isinstance(val,list):
     for n,item in enumerate(val):scan_refs(item,pointer+'/'+key+'/'+str(n))
  for name,doc in index.items():scan_refs(doc['fields'],'/records/'+name+'/fields')
  for name,ptr,col in references:
   if name not in index or not name.startswith(prefix+col+'/'):issue('link-target',ptr)
  for c,spec in contract['collections'].items():
   declared=manifest['collections'].get(c,{})
   actual=counts.setdefault(c,{'documents':0,'rows':0})
   if set(declared)!={'captured','documents','rows'} or type(declared.get('captured')) is not bool:issue('capture-declaration','/manifest/collections/'+c);continue
   if spec['required'] and declared['captured'] is not True:issue('missing-capture','/manifest/collections/'+c)
   if not declared['captured'] and actual['documents']:issue('uncaptured-with-records','/manifest/collections/'+c)
   if any(type(declared.get(k)) is not int or declared[k]!=actual[k] for k in ['documents','rows']):issue('declared-count','/manifest/collections/'+c)
  if baseline:
   bm,br=baseline;bv=validate(contract,bm,br)
   if not bv['structural_pass']:issue('invalid-baseline','/baseline')
   else:
    before={d['name']:d for d in json.loads(br)}
    result['before_counts']=bv['counts'];result['after_counts']=counts
    for c,old in bv['counts'].items():
     if counts[c]['documents']<old['documents'] or counts[c]['rows']<old['rows']:issue('shrinkage','/collections/'+c)
    for k,v in index.items():
     if k not in before:result['changes']['added'].append(k)
     elif v!=before[k]:result['changes']['replaced'].append(k);issue('replacement-conflict','/records/'+k)
    for k in before:
     if k not in index:result['changes']['absent'].append(k);issue('absent-before-record','/records/'+k)
 except (ValueError,TypeError,KeyError,AttributeError,UnicodeDecodeError,OverflowError) as e:issue('invalid-'+str(e)[:60],'/')
 result['structural_pass']=not issues
 return result

def main():
 import argparse
 from pathlib import Path
 p=argparse.ArgumentParser();p.add_argument('--contract',type=Path,required=True);p.add_argument('--manifest',type=Path,required=True);p.add_argument('--records',type=Path,required=True);p.add_argument('--baseline-manifest',type=Path);p.add_argument('--baseline-records',type=Path);a=p.parse_args()
 if bool(a.baseline_manifest)!=bool(a.baseline_records):p.error('Both baseline paths required')
 v=validate(json.loads(a.contract.read_bytes()),json.loads(a.manifest.read_bytes()),a.records.read_bytes(),(json.loads(a.baseline_manifest.read_bytes()),a.baseline_records.read_bytes()) if a.baseline_manifest else None);print(json.dumps(v,indent=2));return 0 if v['structural_pass'] else 2
if __name__=='__main__':raise SystemExit(main())
