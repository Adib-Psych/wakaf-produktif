import unittest,tempfile,subprocess
from pathlib import Path
import system_kit
class SystemKitTests(unittest.TestCase):
 def test_code_kit_is_deterministic_and_restores_exact_source_without_provider(self):
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);repo=root/'repo';repo.mkdir();subprocess.run(['git','init',str(repo)],check=True,capture_output=True)
   subprocess.run(['git','-C',str(repo),'config','user.email','synthetic@example.invalid'],check=True);subprocess.run(['git','-C',str(repo),'config','user.name','Synthetic'],check=True)
   (repo/'app.js').write_text('export const synthetic=true;\n');subprocess.run(['git','-C',str(repo),'add','app.js'],check=True);subprocess.run(['git','-C',str(repo),'commit','-m','synthetic fixture'],check=True,capture_output=True)
   a=system_kit.build(repo,['app.js'],root/'a.json');b=system_kit.build(repo,['app.js'],root/'b.json');self.assertEqual(a,b)
   out=root/'restored';system_kit.restore(root/'a.json',out);self.assertEqual((out/'app.js').read_bytes(),(repo/'app.js').read_bytes())
   (repo/'private.key').write_text('never include');
   with self.assertRaises(ValueError):system_kit.build(repo,['private.key'],root/'bad.json')
 def test_R5_failed_restore_never_publishes_partial_target_and_can_retry(self):
  from unittest.mock import patch
  import hashlib,json
  with tempfile.TemporaryDirectory() as td:
   root=Path(td);p=root/'kit.json';files={n:{'text':'fixture','sha256':hashlib.sha256(b'fixture').hexdigest()} for n in ['a.js','b.js']}
   p.write_text(json.dumps({'version':1,'kind':'tracked-code-only','head':'synthetic','files':files,'production_config_verified':False,'data_included':False,'offhost_proven':False}))
   original=Path.open
   def fail(path,*a,**kw):
    if path.name=='b.js' and a and 'x' in a[0]:raise OSError('synthetic disk fault')
    return original(path,*a,**kw)
   out=root/'restored'
   with patch.object(Path,'open',fail):
    with self.assertRaises(OSError):system_kit.restore(p,out)
   self.assertFalse(out.exists(),'failed restore must not publish partial target')
   system_kit.restore(p,out);self.assertEqual((out/'b.js').read_text(),'fixture')
if __name__=='__main__':unittest.main()
