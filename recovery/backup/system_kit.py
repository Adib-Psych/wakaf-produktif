"""Deterministic explicit tracked-code kit. No data capture, credentials or upload."""
import hashlib,json,os,subprocess,re
from pathlib import Path,PurePosixPath

def _safe(name):
 p=PurePosixPath(name)
 return isinstance(name,str) and bool(name) and not p.is_absolute() and '..' not in p.parts and not any(x in name.lower() for x in ['credential','private.key','.env','personal','token.json'])

def build(repo,paths,output):
 repo=Path(repo);files={};tracked=set(subprocess.check_output(['git','-C',str(repo),'ls-files','-z']).decode().split('\0'))
 if len(paths)!=len(set(paths)):raise ValueError('Duplicate paths')
 for name in sorted(paths):
  p=repo/name
  if not _safe(name) or name not in tracked or p.is_symlink() or not p.is_file():raise ValueError('Only explicit tracked regular code')
  if any(x.is_symlink() for x in p.parents if x!=repo.parent):raise ValueError('Symlink parent')
  data=p.read_bytes()
  if len(data)>4_000_000 or re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ya29\.[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}',data):raise ValueError('Secret-like/oversized source')
  text=data.decode('utf-8');files[name]={'sha256':hashlib.sha256(data).hexdigest(),'text':text}
 kit={'version':1,'kind':'tracked-code-only','head':subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD']).decode().strip(),'files':files,'production_config_verified':False,'data_included':False,'offhost_proven':False}
 data=(json.dumps(kit,sort_keys=True,separators=(',',':'))+'\n').encode();p=Path(output)
 with p.open('xb') as f:os.chmod(p,0o600);f.write(data);f.flush();os.fsync(f.fileno())
 return hashlib.sha256(data).hexdigest()

def restore(package,output):
 v=json.loads(Path(package).read_text());out=Path(output)
 if set(v)!={'version','kind','head','files','production_config_verified','data_included','offhost_proven'} or type(v['version']) is not int or v['version']!=1 or v['kind']!='tracked-code-only' or v['data_included'] is not False or not isinstance(v['files'],dict):raise ValueError('Unsupported code kit')
 for name,item in v['files'].items():
  if not _safe(name) or set(item)!={'sha256','text'} or hashlib.sha256(item['text'].encode()).hexdigest()!=item['sha256']:raise ValueError('Invalid kit member')
 if out.exists() or out.is_symlink():raise ValueError('New empty restore destination required')
 import tempfile,shutil,ctypes
 stage=Path(tempfile.mkdtemp(prefix='.'+out.name+'.staging-',dir=out.parent));os.chmod(stage,0o700)
 def syncdir(p):
  fd=os.open(p,os.O_DIRECTORY)
  try:os.fsync(fd)
  finally:os.close(fd)
 try:
  for name,item in v['files'].items():
   p=stage/name;p.parent.mkdir(parents=True,mode=0o700,exist_ok=True)
   with p.open('x') as f:os.chmod(p,0o600);f.write(item['text']);f.flush();os.fsync(f.fileno())
   if hashlib.sha256(p.read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Restore readback mismatch')
  for p in sorted([x for x in stage.rglob('*') if x.is_dir()],key=lambda x:len(x.parts),reverse=True):syncdir(p)
  syncdir(stage)
  # Linux renameat2 RENAME_NOREPLACE: never replace a competing target, even an empty directory.
  libc=ctypes.CDLL(None,use_errno=True)
  if not hasattr(libc,'renameat2'):raise OSError('Atomic no-replace publication unavailable')
  if libc.renameat2(-100,os.fsencode(stage),-100,os.fsencode(out),1)!=0:raise OSError(ctypes.get_errno(),'Atomic restore publication refused')
  syncdir(out.parent)
 finally:
  if stage.exists():shutil.rmtree(stage)
 return {'restored_files':len(v['files']),'network_requests':0,'scope':'code only, not database or independent offhost recovery'}
