import unittest,copy,json,hashlib
from test_data_return import fixture
from data_return import validate,canonical
class ReviewGateTests(unittest.TestCase):
 def test_F2_strict_contract_and_manifest_metadata(self):
  for target,key,value in [('m','synthetic','false'),('c','unexpected',True),('c','id',''),('spec','required','false'),('spec','unknown',1)]:
   c,m,r=fixture();obj=m if target=='m' else c if target=='c' else c['collections']['laporan'];obj[key]=value;m['contract_sha256']=hashlib.sha256(canonical(c)).hexdigest();self.assertFalse(validate(c,m,r)['structural_pass'],(target,key,value))
 def test_F3_timestamp_base64_and_undeclared_reference(self):
  for tag,value,good in [('timestampValue','2000-01-02',False),('timestampValue','2000-01-02T00:00:00.123456789Z',True),('bytesValue','!!!bad!!!',False),('bytesValue','YQ==',True),('referenceValue','projects/foreign/databases/(default)/documents/x/y',False)]:
   c,m,r=fixture();c['collections']['laporan']['required_fields']['typed']=tag;docs=json.loads(r);docs[0]['fields']['typed']={tag:value};r=json.dumps(docs).encode();m['contract_sha256']=hashlib.sha256(canonical(c)).hexdigest();m['records_sha256']=hashlib.sha256(r).hexdigest();self.assertEqual(validate(c,m,r)['structural_pass'],good,(tag,value))
 def test_F2_F3_residual_empty_row_key_and_offset_minutes_refuse(self):
  c,m,r=fixture();c['collections']['panen_data']['row_array']['required_fields']['']='stringValue';docs=json.loads(r);docs[1]['fields']['data']['arrayValue']['values'][0]['mapValue']['fields']['']={'stringValue':'x'};r=json.dumps(docs).encode();m['records_sha256']=hashlib.sha256(r).hexdigest();m['contract_sha256']=hashlib.sha256(canonical(c)).hexdigest();self.assertFalse(validate(c,m,r)['structural_pass'])
  c,m,r=fixture();c['collections']['laporan']['required_fields']['typed']='timestampValue';docs=json.loads(r);docs[0]['fields']['typed']={'timestampValue':'2000-01-02T00:00:00+00:60'};r=json.dumps(docs).encode();m['records_sha256']=hashlib.sha256(r).hexdigest();m['contract_sha256']=hashlib.sha256(canonical(c)).hexdigest();self.assertFalse(validate(c,m,r)['structural_pass'])
if __name__=='__main__':unittest.main()
