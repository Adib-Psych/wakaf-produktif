import unittest,copy
import cabut_preflight as c
class CabutTests(unittest.TestCase):
 def test_readonly_revision_plan_does_not_mutate_aggregate_or_infer_authority(self):
  snapshot={'revision':4,'events':[{'id':'old','jumlah':2}]};event={'id':'cabut_new','report_id':'lap_new','tanggal':'2000-01-02','kebun':'K1','jumlah_pohon':3};before=copy.deepcopy((snapshot,event));v=c.preview(snapshot,event,4);self.assertEqual(v['state'],'PREVIEW_ONLY');self.assertEqual(v['expected_revision'],4);self.assertFalse(v['executable']);self.assertEqual((snapshot,event),before)
  self.assertEqual(c.preview(snapshot,event,3)['state'],'HOLD_REVISION')
  self.assertEqual(c.preview(snapshot,{**event,'id':'old'},4)['state'],'HOLD_IDENTITY')
 def test_unknown_revision_types_and_invalid_payload_do_not_create_plan(self):
  for revision in [None,True,0,'4']:
   with self.assertRaises(ValueError):c.preview({'revision':revision,'events':[]},{'id':'x'},revision)
if __name__=='__main__':unittest.main()
