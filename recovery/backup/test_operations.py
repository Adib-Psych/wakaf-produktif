import unittest,tempfile,json,sys
from pathlib import Path
import operations
class OperationTests(unittest.TestCase):
 def test_retention_plan_is_nondestructive_and_requires_exact_owner_choice(self):
  entries=[{'id':'old','captured_at':'2000-01-01T00:00:00+00:00','protected':False},{'id':'good','captured_at':'2000-01-02T00:00:00+00:00','protected':True}]
  original=json.dumps(entries);plan=operations.retention_plan(entries,keep=1,owner_approved=False)
  self.assertEqual(plan['delete'],[]);self.assertEqual(plan['candidates'],['old']);self.assertFalse(plan['executable']);self.assertEqual(json.dumps(entries),original)
 def test_alarm_requires_independent_offhost_recovery_not_manifest_success(self):
  status={'state':'complete-in-declared-scope','health':{'state':'passed'}}
  self.assertEqual(operations.alarm(status,offhost=False,recovery=False)['state'],'HOLD')
  self.assertEqual(operations.alarm(status,offhost=True,recovery=True)['state'],'READY_SYNTHETIC_ONLY')
 def test_restore_validation_rejects_tampered_typed_bytes_without_network(self):
  with tempfile.TemporaryDirectory() as td:
   p=Path(td)/'snapshot.json';p.write_text(json.dumps({'synthetic':True,'documents':[{'name':'projects/demo-wakaf-kit/databases/(default)/documents/laporan/synthetic','fields':{'note':{'stringValue':'fixture'}}}]}))
   sealed=operations.seal_fixture(p);self.assertEqual(operations.validate_restore(p,sealed)['documents'],1)
   p.write_text('{}')
   with self.assertRaises(ValueError):operations.validate_restore(p,sealed)
if __name__=='__main__':unittest.main()
