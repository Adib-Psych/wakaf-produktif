import unittest,copy,json,hashlib,tempfile
from pathlib import Path
import data_return as gate

def fixture():
 contract={'version':1,'id':'synthetic-contract-v1','source':{'project':'demo-wakaf-return','database':'(default)'},'collections':{'laporan':{'required':True,'required_fields':{'id':'stringValue','tanggal':'stringValue','jumlah_pohon':'integerValue','catatan':'nullValue','pelapor':'stringValue','kategori':'stringValue','compliance':'stringValue'},'units':{'jumlah_pohon':'trees'},'row_array':None,'links':[]},'panen_data':{'required':True,'required_fields':{'data':'arrayValue'},'units':{'data/*/cherry_kg':'kg'},'row_array':{'path':['data'],'id_field':'id','required_fields':{'id':'stringValue','tgl':'stringValue','cherry_kg':'doubleValue'}},'links':[]}}}
 docs=[{'name':'projects/demo-wakaf-return/databases/(default)/documents/laporan/lap_synthetic','fields':{'id':{'stringValue':'lap_synthetic'},'tanggal':{'stringValue':'2000-01-02'},'jumlah_pohon':{'integerValue':'0'},'catatan':{'nullValue':None},'pelapor':{'stringValue':'SYNTHETIC'},'kategori':{'stringValue':'lain'},'compliance':{'stringValue':'pending'}}},{'name':'projects/demo-wakaf-return/databases/(default)/documents/panen_data/active','fields':{'data':{'arrayValue':{'values':[{'mapValue':{'fields':{'id':{'stringValue':'batch1'},'tgl':{'stringValue':'2000-01-02'},'cherry_kg':{'doubleValue':2.5}}}}]}}}}]
 records=json.dumps(docs,separators=(',',':')).encode();contract_bytes=json.dumps(contract,sort_keys=True,separators=(',',':')).encode()
 manifest={'version':1,'schema':'wakaf-typed-return-v1','synthetic':True,'source':contract['source'],'cutoff':'2000-01-03T00:00:00+00:00','capture_start':'2000-01-03T00:00:00+00:00','capture_end':'2000-01-03T00:01:00+00:00','contract_sha256':hashlib.sha256(contract_bytes).hexdigest(),'records_sha256':hashlib.sha256(records).hexdigest(),'collections':{'laporan':{'captured':True,'documents':1,'rows':1},'panen_data':{'captured':True,'documents':1,'rows':1}},'units':{'laporan/jumlah_pohon':'trees','panen_data/data/*/cherry_kg':'kg'},'historical_union':False}
 return contract,manifest,records
class ReturnTests(unittest.TestCase):
 def test_exact_valid_readonly_preserves_null_zero_and_input_bytes(self):
  c,m,r=fixture();before=copy.deepcopy((c,m,r));v=gate.validate(c,m,r);self.assertTrue(v['structural_pass'],v);self.assertFalse(v['production_authorized']);self.assertEqual((c,m,r),before)
 def test_fault_controls_reject_before_staging_and_never_repair(self):
  c,m,r=fixture()
  for mutate in [lambda x:x.update(historical_union=True),lambda x:x.update(source={'project':'wrong','database':'(default)'}),lambda x:x['collections'].pop('laporan'),lambda x:x['collections']['laporan'].update(captured=False),lambda x:x['units'].update({'laporan/jumlah_pohon':'kg'}),lambda x:x.update(cutoff='not-date'),lambda x:x.update(records_sha256='0'*64)]:
   bad=copy.deepcopy(m);mutate(bad);v=gate.validate(c,bad,r);self.assertFalse(v['structural_pass'],bad);self.assertTrue(v['issues'])
 def test_duplicate_conflict_shrinkage_and_missing_are_not_unioned(self):
  c,m,r=fixture();docs=json.loads(r);docs.append(docs[0]);bad=json.dumps(docs).encode();mm=copy.deepcopy(m);mm['records_sha256']=hashlib.sha256(bad).hexdigest();self.assertFalse(gate.validate(c,mm,bad)['structural_pass'])
  old=gate.validate(c,m,r);docs=json.loads(r);docs[1]['fields']['data']['arrayValue']['values']=[];new=json.dumps(docs).encode();mm=copy.deepcopy(m);mm['records_sha256']=hashlib.sha256(new).hexdigest();mm['collections']['panen_data']['rows']=0
  v=gate.validate(c,mm,new,baseline=(m,r));self.assertFalse(v['structural_pass']);self.assertTrue(any(x['code']=='shrinkage' for x in v['issues']))
 def test_wrong_typed_tag_invalid_calendar_unsafe_double_and_extra_collection(self):
  c,m,r=fixture()
  for mutate in [lambda d:d[0]['fields'].update(jumlah_pohon={'integerValue':True}),lambda d:d[0]['fields'].update(tanggal={'stringValue':'1900-02-29'}),lambda d:d[1]['fields']['data']['arrayValue']['values'][0]['mapValue']['fields'].update(cherry_kg={'doubleValue':float('nan')}),lambda d:d[0].update(name=d[0]['name'].replace('/laporan/','/unexpected/'))]:
   docs=json.loads(r);mutate(docs);b=json.dumps(docs).encode();mm=copy.deepcopy(m);mm['records_sha256']=hashlib.sha256(b).hexdigest();self.assertFalse(gate.validate(c,mm,b)['structural_pass'])
 def test_duplicate_json_keys_and_unexpected_business_fields_refuse(self):
  c,m,r=fixture();bad=r.replace(b'"jumlah_pohon":{"integerValue":"0"}',b'"jumlah_pohon":{"integerValue":"0"},"jumlah_pohon":{"integerValue":"9"}')
  mm=copy.deepcopy(m);mm['records_sha256']=hashlib.sha256(bad).hexdigest();self.assertFalse(gate.validate(c,mm,bad)['structural_pass'])
  docs=json.loads(r);docs[0]['fields']['unreviewed']={'stringValue':'not in contract'};bad=json.dumps(docs).encode();mm['records_sha256']=hashlib.sha256(bad).hexdigest();self.assertFalse(gate.validate(c,mm,bad)['structural_pass'])
 def test_declared_link_and_domain_separation(self):
  c,m,r=fixture();c['collections']['laporan']['required_fields']['parent']='referenceValue';c['collections']['laporan']['links']=[{'field':'parent','collection':'panen_data'}]
  docs=json.loads(r);docs[0]['fields']['parent']={'referenceValue':docs[1]['name']};r=json.dumps(docs).encode();m['records_sha256']=hashlib.sha256(r).hexdigest();m['contract_sha256']=hashlib.sha256(gate.canonical(c)).hexdigest();self.assertTrue(gate.validate(c,m,r)['structural_pass'])
  docs[0]['fields']['parent']['referenceValue']=docs[1]['name'].replace('panen_data/active','panen_data/absent');r=json.dumps(docs).encode();m['records_sha256']=hashlib.sha256(r).hexdigest();self.assertFalse(gate.validate(c,m,r)['structural_pass'])
 def test_source_unsafe_integer_negative_measurement_and_missing_unit_refuse(self):
  c,m,r=fixture()
  for mutate in [lambda d:d[0]['fields'].update(jumlah_pohon={'integerValue':'9007199254740993'}),lambda d:d[0]['fields'].update(jumlah_pohon={'integerValue':'-1'}),lambda d:d[1]['fields']['data']['arrayValue']['values'][0]['mapValue']['fields'].update(cherry_kg={'doubleValue':-2.5})]:
   docs=json.loads(r);mutate(docs);b=json.dumps(docs).encode();mm=copy.deepcopy(m);mm['records_sha256']=hashlib.sha256(b).hexdigest();self.assertFalse(gate.validate(c,mm,b)['structural_pass'])
if __name__=='__main__':unittest.main()