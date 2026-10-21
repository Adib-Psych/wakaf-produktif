"""Provider-free synthetic operations. No upload, deletion, production or scheduler."""
import hashlib,json,re
from pathlib import Path
from datetime import datetime

def retention_plan(entries,keep,owner_approved=False):
 if type(keep) is not int or keep<1 or not isinstance(entries,list):raise ValueError('Explicit retention required')
 if any(set(e)!={'id','captured_at','protected'} or not isinstance(e['id'],str) or type(e['protected']) is not bool for e in entries):raise ValueError('Invalid retention metadata')
 if len({e['id'] for e in entries})!=len(entries):raise ValueError('Duplicate archive identity')
 ordered=sorted(entries,key=lambda e:datetime.fromisoformat(e['captured_at']),reverse=True)
 candidates=[e['id'] for e in ordered[keep:] if not e['protected']]
 # This kit intentionally has no deletion implementation, even with a decision flag.
 return {'candidates':candidates,'delete':[],'executable':False,'owner_decision_recorded':owner_approved is True,'protected':'last-good, exceptions and incident evidence must remain protected'}

def alarm(status,offhost=False,recovery=False):
 ready=status.get('state')=='complete-in-declared-scope' and status.get('health',{}).get('state')=='passed' and offhost is True and recovery is True
 return {'state':'READY_SYNTHETIC_ONLY' if ready else 'HOLD','manifest_success_is_recovery':False,'offhost_proven':offhost is True,'isolated_recovery_proven':recovery is True,'production_commissioned':False}

def _fixture(path):
 p=Path(path)
 if p.is_symlink() or p.stat().st_size>2_000_000:raise ValueError('Unsafe fixture')
 body=p.read_bytes();v=json.loads(body)
 if not isinstance(v,dict) or set(v)!={'synthetic','documents'} or v['synthetic'] is not True or not isinstance(v['documents'],list):raise ValueError('Synthetic fixture only')
 ids=set()
 for d in v['documents']:
  if not isinstance(d,dict) or set(d)!={'name','fields'} or not re.fullmatch(r'projects/demo-wakaf-kit/databases/\(default\)/documents/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+',d.get('name','')) or not isinstance(d['fields'],dict) or d['name'] in ids:raise ValueError('Invalid fixture identity')
  ids.add(d['name'])
 return body,v

def seal_fixture(path):
 body,v=_fixture(path);return {'sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body),'documents':len(v['documents']),'synthetic':True}

def validate_restore(path,seal):
 actual=seal_fixture(path)
 if actual!=seal:raise ValueError('Restore source digest/count differs')
 return {'documents':actual['documents'],'validated':True,'restored':False,'network_requests':0,'scope':'manifest/identity only; independent emulator recovery separate'}

def main():
 import argparse
 p=argparse.ArgumentParser();p.add_argument('--fixture',required=True,type=Path);args=p.parse_args()
 s=seal_fixture(args.fixture);print(json.dumps({'seal':s,'restore_validation':validate_restore(args.fixture,s),'alarm':alarm({}),'retention':'PLAN ONLY; no deletion'}))
if __name__=='__main__':main()
