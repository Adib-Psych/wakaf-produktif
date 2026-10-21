"""Local-only source provenance; no source reads beyond tracked code bytes."""
import hashlib
import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
parent = pathlib.Path('/root/.hermes/workspaces/wakaf-staff-uuid-failure-fix/candidate')
expected = '7178622e9e6b30dfe97beae162b53297575d1907'

def git(directory, *args):
    return subprocess.check_output(['git', '-C', str(directory), *args])

def sha(data):
    return hashlib.sha256(data).hexdigest()

assert git(parent, 'rev-parse', 'HEAD').decode().strip() == expected
assert not git(parent, 'status', '--porcelain')
paths = git(parent, 'ls-files', '-z').decode().split('\0')
manifest = []
changed = []
for name in filter(None, paths):
    before, after = parent / name, root / name
    baseline = git(parent, 'show', expected + ':' + name)
    assert before.read_bytes() == baseline, name
    assert (before.stat().st_dev, before.stat().st_ino) != (after.stat().st_dev, after.stat().st_ino), name
    record = {'path': name, 'baseline_sha256': sha(baseline), 'candidate_sha256': sha(after.read_bytes())}
    manifest.append(record)
    if record['baseline_sha256'] != record['candidate_sha256']:
        changed.append(name)
assert changed == ['monitor-v2.html'], changed
patch = git(root, 'diff', expected, '--', 'monitor-v2.html')
(root / 'evidence' / 'frontend-only.patch').write_bytes(patch)
result = {'parent': str(parent), 'parent_commit': expected, 'parent_clean': True,
          'copy_method': 'git clone --no-hardlinks (local source)', 'all_tracked_files_nonhardlinked': True,
          'tracked_source_files': len(manifest), 'changed_existing_paths': changed,
          'frontend_patch_sha256': sha(patch), 'manifest': manifest}
(root / 'evidence' / 'provenance.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: v for k, v in result.items() if k != 'manifest'}))
