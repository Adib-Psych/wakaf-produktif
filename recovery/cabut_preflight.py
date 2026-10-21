"""Non-executable cabut revision/event proposal. No array overwrite or production writer."""
import datetime,copy,json

def preview(snapshot,event,expected_revision):
 if not isinstance(snapshot,dict) or set(snapshot)!={'revision','events'} or type(snapshot['revision']) is not int or snapshot['revision']<1 or type(expected_revision) is not int or expected_revision<1 or not isinstance(snapshot['events'],list):raise ValueError('Explicit reviewed positive revision required')
 if not isinstance(event,dict) or set(event)!={'id','report_id','tanggal','kebun','jumlah_pohon'} or any(not isinstance(event[k],str) or not event[k] or '/' in event[k] for k in ['id','report_id']) or event['kebun'] not in ['K1','K2','K3','K4'] or type(event['jumlah_pohon']) is not int or event['jumlah_pohon']<=0:raise ValueError('Typed event required')
 datetime.date.fromisoformat(event['tanggal'])
 ids=[x.get('id') for x in snapshot['events']]
 if len(set(ids))!=len(ids) or any(not isinstance(x,str) for x in ids):raise ValueError('Existing event identity ambiguous')
 base={'executable':False,'writes':0,'financial_authority':False,'expected_revision':expected_revision,'mode':'append-only-event proposal; no shared-array replacement','requires':'server transaction binds expected revision, absent report/event and immutable receipt; old-client path stays denied'}
 if snapshot['revision']!=expected_revision:return {**base,'state':'HOLD_REVISION'}
 if event['id'] in ids:return {**base,'state':'HOLD_IDENTITY'}
 return {**base,'state':'PREVIEW_ONLY','proposed_event':copy.deepcopy(event),'next_revision':expected_revision+1}

def main():
 import argparse
 from pathlib import Path
 p=argparse.ArgumentParser();p.add_argument('--snapshot',required=True,type=Path);p.add_argument('--event',required=True,type=Path);p.add_argument('--expected-revision',required=True,type=int);a=p.parse_args();print(json.dumps(preview(json.loads(a.snapshot.read_text()),json.loads(a.event.read_text()),a.expected_revision),indent=2))
if __name__=='__main__':main()
