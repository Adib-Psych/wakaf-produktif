import unittest,sys,json,hashlib
from pathlib import Path
from test_data_return import fixture
from stage_data_return import stage
class StageTests(unittest.TestCase):
 def test_actual_source_helpers_export_render_projection_without_mutation(self):
  c,m,r=fixture();before=(json.dumps(c),json.dumps(m),r);v=stage(c,m,r,Path(__file__).parent.parent);self.assertTrue(v['preflight']['structural_pass']);self.assertEqual(v['preview']['report_rows'],1);self.assertEqual(v['preview']['harvest_rows'],1);self.assertEqual(v['preview']['cherry_by_grade']['merah'],2.5);self.assertEqual(v['preview']['actual_export_download_calls'],1);self.assertEqual((json.dumps(c),json.dumps(m),r),before)
 def test_real_project_and_faulted_hash_never_enter_preview(self):
  c,m,r=fixture();m['synthetic']=False
  with self.assertRaises(ValueError):stage(c,m,r,Path(__file__).parent.parent)
  m['synthetic']=True;m['records_sha256']='0'*64
  with self.assertRaises(ValueError):stage(c,m,r,Path(__file__).parent.parent)
if __name__=='__main__':unittest.main()
