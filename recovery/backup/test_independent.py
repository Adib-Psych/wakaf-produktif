"""Independent synthetic acceptance probes. Never opens real data or network."""
import copy
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE / 'candidate'))
import backup_runner as r

REG = {'alpha': 'required'}
IDENTITY = {'project': 'demo-independent', 'database': '(default)',
            'document_root': 'projects/demo-independent/databases/(default)/documents'}
SCHEMA = {'version': 1, 'metrics': {'a': {'kind': 'singleton-array', 'collection': 'alpha', 'document_id': 'active', 'field_path': ['data']}}}

def doc(n, col='alpha', key='active', project='demo-independent'):
    return {'name': f'projects/{project}/databases/(default)/documents/{col}/{key}',
            'fields': {'data': {'arrayValue': {'values': [
                {'mapValue': {'fields': {'id': {'stringValue': f'row-{i}'}}}} for i in range(n)]}}}}

def seed(root, docs=None, schema=None, registry=None, source_identity=IDENTITY):
    """Independent fixture encoder, not a production baseline authorization."""
    docs = {'alpha': [doc(2)]} if docs is None else docs
    schema = copy.deepcopy(SCHEMA if schema is None else schema)
    registry = copy.deepcopy(REG if registry is None else registry)
    run_id = '20261009T010203000004Z-' + 'a' * 32
    stage = root / run_id
    stage.mkdir(mode=0o700)
    counts = {}
    for key, metric in schema['metrics'].items():
        rows = docs[metric['collection']]
        counts[key] = len(rows) if metric['kind'] == 'documents' else len(next(d for d in rows if d['name'].split('/')[-1] == metric['document_id'])['fields']['data']['arrayValue']['values'])
    status = {'run_id': run_id, 'state': 'complete-in-declared-scope', 'capture_state': 'complete-in-declared-scope',
              'source_identity': source_identity,
              'synthetic': True, 'registry': registry, 'business_schema': schema, 'business_counts': counts,
              'health': {'state': 'passed'}, 'collections': {c: {'state': 'captured', 'count': len(v), 'http': 200} for c, v in docs.items()}}
    for c, body in docs.items():
        r.write_json(stage / 'raw' / (c + '.json'), body)
        r.write_json(stage / 'clean' / (c + '.json'), [{'_document_name': d['name'], '_document_id': d['name'].split('/')[-1], 'fields': {}} for d in body])
    r.write_json(stage / '_status.json', status)
    files = {str(p.relative_to(stage)): {'sha256': hashlib.sha256(p.read_bytes()).hexdigest(), 'bytes': len(p.read_bytes())} for p in stage.rglob('*') if p.is_file()}
    manifest = {'schema': 1, 'run_id': run_id, 'files': files, 'collections': status['collections'], 'source_identity': source_identity, 'business_schema': schema, 'business_counts': counts, 'source_sha256': hashlib.sha256(r.SOURCE.read_bytes()).hexdigest()}
    r.write_json(stage / 'manifest.json', manifest)
    status['manifest_sha256'] = hashlib.sha256((stage / 'manifest.json').read_bytes()).hexdigest()
    r.write_json(root / 'LATEST_GOOD.json', status)
    return stage

def reanchor(root, stage):
    manifest = json.loads((stage / 'manifest.json').read_text())
    for relative in manifest['files']:
        body = (stage / relative).read_bytes()
        manifest['files'][relative] = {'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body)}
    (stage / 'manifest.json').write_text(json.dumps(manifest))
    pointer = json.loads((root / 'LATEST_GOOD.json').read_text())
    pointer['manifest_sha256'] = hashlib.sha256((stage / 'manifest.json').read_bytes()).hexdigest()
    (root / 'LATEST_GOOD.json').write_text(json.dumps(pointer))

class IndependentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=HERE)
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def run_case(self, docs=None, schema=None, registry=None, fetch=None):
        docs = {'alpha': [doc(2)]} if docs is None else docs
        registry = REG if registry is None else registry
        schema = SCHEMA if schema is None else schema
        return r.run_backup(self.root, registry, fetch or (lambda c: (docs[c], None, 200)), synthetic=True, business_schema=copy.deepcopy(schema), source_identity=IDENTITY)

    def assert_hold(self, docs=None, schema=None, registry=None, fetch=None, expected=3):
        pointer = self.root / 'LATEST_GOOD.json'
        before = pointer.read_bytes() if pointer.exists() else None
        code, result = self.run_case(docs, schema, registry, fetch)
        after = pointer.read_bytes() if pointer.exists() else None
        with (self.root / 'probe-observations.jsonl').open('a') as log:
            log.write(json.dumps({'test': self.id(), 'expected_exit': expected, 'actual_exit': code,
                                  'good_pointer_unchanged': before == after, 'result': result}) + '\n')
        self.assertEqual(code, expected, result)
        self.assertEqual(pointer.read_bytes() if pointer.exists() else None, before)
        if code == 3:
            target = self.root / (result['run_id'] + '.quarantine')
            r.validate_snapshot(target)
            self.assertEqual(json.loads((self.root / 'LATEST_ATTEMPT.json').read_text())['run_id'], result['run_id'])
            self.assertEqual(json.loads((target / 'raw/alpha.json').read_text()), (docs or {'alpha': [doc(2)]})['alpha'])
        return result

    def test_absent_baseline_never_bootstraps(self):
        self.assert_hold()

    def test_corrupt_pointer_json(self):
        seed(self.root); (self.root / 'LATEST_GOOD.json').write_text('{broken')
        self.assert_hold()

    def test_corrupt_raw_integrity(self):
        stage = seed(self.root); (stage / 'raw/alpha.json').write_text('[]')
        self.assert_hold()

    def test_corrupt_manifest_anchor(self):
        stage = seed(self.root); (stage / 'manifest.json').write_text('{}')
        self.assert_hold()

    def test_baseline_count_forgery_even_rehashed(self):
        stage = seed(self.root)
        manifest = json.loads((stage / 'manifest.json').read_text())
        manifest['business_counts']['a'] = 0
        (stage / 'manifest.json').write_text(json.dumps(manifest)); reanchor(self.root, stage)
        self.assert_hold()

    def test_legacy_baseline_without_business_schema(self):
        stage = seed(self.root)
        manifest = json.loads((stage / 'manifest.json').read_text()); manifest.pop('business_schema')
        (stage / 'manifest.json').write_text(json.dumps(manifest)); reanchor(self.root, stage)
        self.assert_hold()

    def test_synthetic_mode_incompatible(self):
        seed(self.root)
        pointer = json.loads((self.root / 'LATEST_GOOD.json').read_text()); pointer['synthetic'] = False
        (self.root / 'LATEST_GOOD.json').write_text(json.dumps(pointer)); self.assert_hold()

    def test_singleton_two_to_zero(self):
        seed(self.root); result = self.assert_hold({'alpha': [doc(0)]})
        self.assertEqual(result['health']['reductions'], [{'metric': 'a', 'before': 2, 'after': 0}])

    def test_singleton_document_disappears(self):
        seed(self.root); self.assert_hold({'alpha': [doc(2, key='replacement')]})

    def test_document_count_disappears(self):
        schema = {'version': 1, 'metrics': {'a': {'kind': 'documents', 'collection': 'alpha'}}}
        seed(self.root, {'alpha': [doc(0, key='one'), doc(0, key='two')]}, schema)
        self.assert_hold({'alpha': [doc(0, key='one')]}, schema)

    def test_growth_other_metric_cannot_mask_shrinkage(self):
        reg = {'alpha': 'required', 'beta': 'required'}
        schema = copy.deepcopy(SCHEMA)
        schema['metrics']['b'] = dict(schema['metrics']['a'], collection='beta')
        seed(self.root, {'alpha': [doc(4)], 'beta': [doc(1, col='beta')]}, schema, reg)
        result = self.assert_hold({'alpha': [doc(1)], 'beta': [doc(4, col='beta')]}, schema, reg)
        self.assertEqual(result['health']['reductions'], [{'metric': 'a', 'before': 4, 'after': 1}])

    def test_schema_metric_key_swap(self):
        reg = {'alpha': 'required', 'beta': 'required'}
        schema = copy.deepcopy(SCHEMA); schema['metrics']['b'] = dict(schema['metrics']['a'], collection='beta')
        docs = {'alpha': [doc(2)], 'beta': [doc(4, col='beta')]}
        seed(self.root, docs, schema, reg)
        changed = copy.deepcopy(schema); changed['metrics']['a'], changed['metrics']['b'] = changed['metrics']['b'], changed['metrics']['a']
        self.assert_hold(docs, changed, reg)

    def test_schema_downgrade_singleton_to_documents(self):
        seed(self.root)
        schema = {'version': 1, 'metrics': {'a': {'kind': 'documents', 'collection': 'alpha'}}}
        self.assert_hold({'alpha': [doc(0)]}, schema)

    def test_schema_version_downgrade(self):
        seed(self.root); self.assert_hold(schema=dict(SCHEMA, version=0))

    def test_optional_capture_failure(self):
        reg = {'alpha': 'required', 'beta': 'optional'}
        schema = copy.deepcopy(SCHEMA); schema['metrics']['b'] = {'kind': 'documents', 'collection': 'beta'}
        seed(self.root, {'alpha': [doc(2)], 'beta': []}, schema, reg)
        self.assert_hold(schema=schema, registry=reg, fetch=lambda c: ([doc(2)], None, 200) if c == 'alpha' else ([], 'optional-timeout', 0))

    def test_required_capture_failure(self):
        seed(self.root)
        self.assert_hold(fetch=lambda c: ([], 'timeout', 0), expected=2)

    def test_optional_excel_failure_does_not_block(self):
        seed(self.root)
        def excel(*args): raise OSError('synthetic workbook failure')
        code, result = r.run_backup(self.root, REG, lambda c: ([doc(2)], None, 200), excel=excel, synthetic=True, business_schema=SCHEMA, source_identity=IDENTITY)
        self.assertEqual(code, 0, result); self.assertEqual(result['excel']['state'], 'failed-optional')

    def test_attempt_never_becomes_baseline(self):
        seed(self.root)
        self.assert_hold({'alpha': [doc(0)]}); result = self.assert_hold({'alpha': [doc(1)]})
        self.assertEqual(result['health']['reductions'][0]['before'], 2)

    def test_no_reduction_boolean_bypass(self):
        seed(self.root); self.assert_hold({'alpha': [doc(0)]}, dict(SCHEMA, approved_reduction=True))

    def test_baseline_pointer_symlink(self):
        seed(self.root)
        pointer = self.root / 'LATEST_GOOD.json'; pointer.rename(self.root / 'original-pointer.json'); pointer.symlink_to('original-pointer.json')
        self.assert_hold()

    def test_baseline_raw_directory_symlink(self):
        stage = seed(self.root); (stage / 'raw').rename(self.root / 'raw-target'); (stage / 'raw').symlink_to(self.root / 'raw-target', target_is_directory=True)
        self.assert_hold()

    def test_unchanged_then_growth_promote_valid_pointers(self):
        seed(self.root)
        for n in (2, 3, 4):
            code, result = self.run_case({'alpha': [doc(n)]}); self.assertEqual(code, 0, result)
            pointer = json.loads((self.root / 'LATEST_GOOD.json').read_text()); self.assertEqual(pointer['run_id'], result['run_id'])
            manifest = r.validate_snapshot(self.root / pointer['run_id'])
            self.assertEqual(manifest['business_counts'], {'a': n})

    def test_manifest_version_incompatible_must_hold(self):
        stage = seed(self.root)
        manifest = json.loads((stage / 'manifest.json').read_text()); manifest['schema'] = 0
        (stage / 'manifest.json').write_text(json.dumps(manifest)); reanchor(self.root, stage)
        self.assert_hold()

    def test_manifest_version_missing_must_hold(self):
        stage = seed(self.root)
        manifest = json.loads((stage / 'manifest.json').read_text()); manifest.pop('schema')
        (stage / 'manifest.json').write_text(json.dumps(manifest)); reanchor(self.root, stage)
        self.assert_hold()

    def test_manifest_version_boolean_must_hold(self):
        stage = seed(self.root)
        manifest = json.loads((stage / 'manifest.json').read_text()); manifest['schema'] = True
        (stage / 'manifest.json').write_text(json.dumps(manifest)); reanchor(self.root, stage)
        self.assert_hold()

    def test_source_project_incompatible_must_hold(self):
        seed(self.root, {'alpha': [doc(2, project='demo-source-a')]}, source_identity=dict(IDENTITY, project='demo-source-a', document_root='projects/demo-source-a/databases/(default)/documents'))
        self.assert_hold({'alpha': [doc(2, project='demo-source-b')]})

    def test_source_database_incompatible_must_hold(self):
        seed(self.root)
        changed = doc(2); changed['name'] = changed['name'].replace('databases/(default)', 'databases/other-demo')
        self.assert_hold({'alpha': [changed]})

    def crash_case(self, boundary, n):
        seed(self.root)
        before = (self.root / 'LATEST_GOOD.json').read_bytes()
        pid = os.fork()
        if pid == 0:
            original_replace = r.os.replace
            original_rename = Path.rename
            def replace(src, dst):
                if Path(dst).name == 'LATEST_GOOD.json' and boundary == 'before-good': os._exit(91)
                result = original_replace(src, dst)
                if Path(dst).name == 'LATEST_GOOD.json' and boundary == 'after-good': os._exit(92)
                return result
            def rename(path, target):
                if path.name.endswith('.partial') and boundary == 'before-seal-rename': os._exit(93)
                result = original_rename(path, target)
                if path.name.endswith('.partial') and boundary == 'after-seal-rename': os._exit(94)
                return result
            with patch.object(r.os, 'replace', replace), patch.object(Path, 'rename', rename):
                self.run_case({'alpha': [doc(n)]})
            os._exit(95)
        _, status = os.waitpid(pid, 0)
        self.assertIn(os.waitstatus_to_exitcode(status), (91, 92, 93, 94))
        pointer = json.loads((self.root / 'LATEST_GOOD.json').read_text())
        r.validate_snapshot(self.root / pointer['run_id'])
        if boundary != 'after-good': self.assertEqual((self.root / 'LATEST_GOOD.json').read_bytes(), before)
        else: self.assertNotEqual((self.root / 'LATEST_GOOD.json').read_bytes(), before)
        # Dead process releases flock; next legitimate capture must use old/new valid good.
        code, result = self.run_case({'alpha': [doc(3)]}); self.assertEqual(code, 0, result)

    def test_crash_before_seal_rename_preserves_good(self): self.crash_case('before-seal-rename', 2)
    def test_crash_after_seal_rename_preserves_good(self): self.crash_case('after-seal-rename', 2)
    def test_crash_before_good_pointer_replace_preserves_good(self): self.crash_case('before-good', 2)
    def test_crash_after_good_pointer_replace_is_valid(self): self.crash_case('after-good', 2)
    def test_crash_after_quarantine_rename_preserves_good(self): self.crash_case('after-seal-rename', 0)

if __name__ == '__main__': unittest.main(verbosity=2)
