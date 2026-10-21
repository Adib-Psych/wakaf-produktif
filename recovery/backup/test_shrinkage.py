"""Synthetic-only promotion acceptance; bootstrap is an explicit fixture, not approval."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import backup_runner as runner

SCHEMA = {'version': 1, 'metrics': {'alpha_rows': {
    'kind': 'singleton-array', 'collection': 'alpha',
    'document_id': 'active', 'field_path': ['data']}}}
REGISTRY = {'alpha': 'required'}
IDENTITY = {'project': 'demo-wakaf-review', 'database': '(default)',
            'document_root': 'projects/demo-wakaf-review/databases/(default)/documents'}


def document(n):
    return {'name': 'projects/demo-wakaf-review/databases/(default)/documents/alpha/active',
            'fields': {'data': {'arrayValue': {'values': [
                {'mapValue': {'fields': {'id': {'stringValue': 'synthetic-' + str(i)}}}}
                for i in range(n)]}}}}


def seed_baseline(root, docs=None, schema=None, registry=None, source_identity=IDENTITY):
    """Build a trusted synthetic fixture; never a runner bootstrap/bypass API."""
    root = Path(root)
    root.mkdir(exist_ok=True)
    schema = schema or SCHEMA
    registry = registry or REGISTRY
    docs = {'alpha': [document(2)]} if docs is None else docs
    run_id = '20261009T000000000000Z-' + '0' * 32
    stage = root / run_id
    stage.mkdir(mode=0o700)
    counts = {}
    for key, metric in schema['metrics'].items():
        rows = docs[metric['collection']]
        if metric['kind'] == 'documents':
            counts[key] = len(rows)
        else:
            doc = next(d for d in rows if d['name'].split('/')[-1] == metric['document_id'])
            fields = doc['fields']
            for part in metric['field_path'][:-1]:
                fields = fields[part]['mapValue']['fields']
            counts[key] = len(fields[metric['field_path'][-1]]['arrayValue'].get('values', []))
    result = {'run_id': run_id, 'state': 'complete-in-declared-scope', 'synthetic': True,
              'source_identity': source_identity,
              'registry': registry, 'business_schema': schema, 'business_counts': counts,
              'health': {'state': 'passed'}, 'capture_state': 'complete-in-declared-scope',
              'collections': {c: {'state': 'captured', 'count': len(v), 'http': 200} for c, v in docs.items()}}
    for col, rows in docs.items():
        runner.write_json(stage / 'raw' / (col + '.json'), rows)
        runner.write_json(stage / 'clean' / (col + '.json'), [
            {'_document_name': d['name'], '_document_id': d['name'].split('/')[-1],
             'fields': {k: runner.legacy.decode_value(v) for k, v in d['fields'].items()}}
            for d in rows])
    runner.write_json(stage / '_status.json', result)
    # Fixture seal includes proposed schema fields even against the unmodified runner.
    runner.seal_snapshot(stage, result)
    manifest = json.loads((stage / 'manifest.json').read_text())
    manifest.update({k: result[k] for k in ('business_schema', 'business_counts')})
    (stage / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    result['manifest_sha256'] = hashlib.sha256((stage / 'manifest.json').read_bytes()).hexdigest()
    runner.atomic_json(root / 'LATEST_GOOD.json', result)
    return result


class ShrinkageTests(unittest.TestCase):
    def test_two_business_rows_to_zero_same_doc_count_is_quarantined(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            root = Path(tmp)
            baseline = seed_baseline(root)
            before = (root / 'LATEST_GOOD.json').read_bytes()
            # On the old runner this exact call promotes; do not introduce an API error as RED.
            kwargs = {'business_schema': SCHEMA} if 'business_schema' in __import__('inspect').signature(runner.run_backup).parameters else {}
            code, result = runner.run_backup(root, REGISTRY, lambda c: ([document(0)], None, 200), synthetic=True, source_identity=IDENTITY, **kwargs)
            self.assertNotEqual(code, 0, 'Old defect: 2 singleton business rows -> 0 advanced LATEST_GOOD')
            self.assertEqual(result['state'], 'quarantined')
            self.assertEqual(result['capture_state'], 'complete-in-declared-scope')
            self.assertEqual(result['business_counts'], {'alpha_rows': 0})
            self.assertEqual(result['health']['baseline_run_id'], baseline['run_id'])
            self.assertEqual(result['health']['reductions'], [{'metric': 'alpha_rows', 'before': 2, 'after': 0}])
            self.assertEqual((root / 'LATEST_GOOD.json').read_bytes(), before)
            self.assertEqual(json.loads((root / 'LATEST_ATTEMPT.json').read_text())['run_id'], result['run_id'])
            snapshot = root / (result['run_id'] + '.quarantine')
            self.assertEqual(json.loads((snapshot / 'raw/alpha.json').read_text()), [document(0)])
            runner.validate_snapshot(snapshot)

    def test_explicit_schema_required_fields_and_types_fail_closed(self):
        import copy
        mutations = [
            ('missing-field', lambda d: d['fields'].pop('data')),
            ('wrong-field-type', lambda d: d['fields'].update(data={'stringValue': 'not-array'})),
            ('null-values', lambda d: d['fields'].update(data={'arrayValue': {'values': None}})),
            ('string-values', lambda d: d['fields'].update(data={'arrayValue': {'values': 'xx'}})),
            ('scalar-row', lambda d: d['fields'].update(data={'arrayValue': {'values': [{'integerValue': '7'}]}})),
            ('wrong-map-fields', lambda d: d['fields'].update(data={'arrayValue': {'values': [{'mapValue': {'fields': []}}]}})),
            ('multi-type-field', lambda d: d['fields']['data'].update(stringValue='junk')),
        ]
        for label, mutate in mutations:
            with self.subTest(label=label), tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
                root = Path(tmp); seed_baseline(root)
                before = (root / 'LATEST_GOOD.json').read_bytes()
                doc = document(2); mutate(doc)
                code, result = runner.run_backup(root, REGISTRY, lambda c: ([doc], None, 200), business_schema=SCHEMA, synthetic=True, source_identity=IDENTITY)
                self.assertEqual(code, 3)
                self.assertEqual(result['health']['reason'], 'business-schema-or-payload-invalid')
                self.assertEqual((root / 'LATEST_GOOD.json').read_bytes(), before)
                self.assertEqual(json.loads((root / (result['run_id'] + '.quarantine') / 'raw/alpha.json').read_text()), [doc])
        schemas = [None, {}, {'version': True, 'metrics': SCHEMA['metrics']},
                   {'version': 1, 'metrics': {}},
                   {'version': 1, 'metrics': {'x': {'kind': 'guess', 'collection': 'alpha'}}},
                   dict(SCHEMA, approved_reduction=True)]
        for schema in schemas:
            with self.subTest(schema=schema), tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
                root = Path(tmp); seed_baseline(root)
                code, result = runner.run_backup(root, REGISTRY, lambda c: ([document(2)], None, 200), business_schema=copy.deepcopy(schema), synthetic=True, source_identity=IDENTITY)
                self.assertEqual(code, 3)
                self.assertEqual(result['health']['reason'], 'business-schema-or-payload-invalid')
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            seed_baseline(tmp)
            code, result = runner.run_backup(tmp, REGISTRY, lambda c: ([], None, 200), business_schema=SCHEMA, synthetic=True, source_identity=IDENTITY)
            self.assertEqual(code, 3)
            self.assertEqual(result['health']['reason'], 'business-schema-or-payload-invalid')

    def test_absent_corrupt_or_incompatible_baseline_always_holds(self):
        import copy
        scenarios = ['absent', 'pointer-json', 'pointer-hash', 'unsafe-id', 'raw-tamper',
                     'manifest-json', 'schema-mismatch', 'counts-forged', 'status-not-good',
                     'synthetic-mismatch', 'registry-mismatch', 'pointer-id-mismatch', 'symlink',
                     'pointer-not-object', 'manifest-not-object', 'status-not-object']
        for scenario in scenarios:
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
                root = Path(tmp)
                if scenario != 'absent':
                    pointer = seed_baseline(root)
                    stage = root / pointer['run_id']
                    if scenario == 'pointer-not-object':
                        pointer = []
                    elif scenario == 'manifest-not-object':
                        (stage / 'manifest.json').write_text('null')
                        pointer['manifest_sha256'] = hashlib.sha256(b'null').hexdigest()
                    elif scenario == 'status-not-object':
                        (stage / '_status.json').write_text('null')
                        manifest = json.loads((stage / 'manifest.json').read_text())
                        manifest['files']['_status.json'] = {'sha256': hashlib.sha256(b'null').hexdigest(), 'bytes': 4}
                        (stage / 'manifest.json').write_text(json.dumps(manifest))
                        pointer['manifest_sha256'] = hashlib.sha256((stage / 'manifest.json').read_bytes()).hexdigest()
                    elif scenario == 'pointer-json':
                        (root / 'LATEST_GOOD.json').write_text('{')
                    elif scenario == 'pointer-hash':
                        pointer['manifest_sha256'] = '0' * 64
                    elif scenario == 'unsafe-id':
                        pointer['run_id'] = '../escape'
                    elif scenario == 'raw-tamper':
                        (stage / 'raw/alpha.json').write_text('[]')
                    elif scenario == 'manifest-json':
                        (stage / 'manifest.json').write_text('{')
                    elif scenario in ('schema-mismatch', 'counts-forged'):
                        manifest = json.loads((stage / 'manifest.json').read_text())
                        if scenario == 'schema-mismatch':
                            manifest['business_schema']['metrics']['alpha_rows']['field_path'] = ['other']
                        else:
                            manifest['business_counts']['alpha_rows'] = 0
                        (stage / 'manifest.json').write_text(json.dumps(manifest))
                        pointer['manifest_sha256'] = hashlib.sha256((stage / 'manifest.json').read_bytes()).hexdigest()
                    elif scenario in ('status-not-good', 'synthetic-mismatch', 'registry-mismatch', 'pointer-id-mismatch'):
                        status = json.loads((stage / '_status.json').read_text())
                        if scenario == 'status-not-good': status['health']['state'] = 'hold'
                        elif scenario == 'synthetic-mismatch': status['synthetic'] = False
                        elif scenario == 'registry-mismatch': status['registry'] = {'alpha': 'optional'}
                        else: status['run_id'] = 'different'
                        (stage / '_status.json').write_text(json.dumps(status))
                        manifest = json.loads((stage / 'manifest.json').read_text())
                        body = (stage / '_status.json').read_bytes()
                        manifest['files']['_status.json'] = {'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body)}
                        (stage / 'manifest.json').write_text(json.dumps(manifest))
                        pointer['manifest_sha256'] = hashlib.sha256((stage / 'manifest.json').read_bytes()).hexdigest()
                    elif scenario == 'symlink':
                        target = root / 'saved-baseline'
                        stage.rename(target)
                        stage.symlink_to(target, target_is_directory=True)
                    if scenario != 'pointer-json':
                        (root / 'LATEST_GOOD.json').write_text(json.dumps(pointer))
                before = (root / 'LATEST_GOOD.json').read_bytes() if (root / 'LATEST_GOOD.json').exists() else None
                code, result = runner.run_backup(root, REGISTRY, lambda c: ([document(2)], None, 200), business_schema=copy.deepcopy(SCHEMA), synthetic=True, source_identity=IDENTITY)
                self.assertEqual(code, 3)
                self.assertEqual(result['health']['reason'], 'baseline-unavailable-or-invalid')
                self.assertEqual((root / 'LATEST_GOOD.json').read_bytes() if (root / 'LATEST_GOOD.json').exists() else None, before)
                self.assertTrue((root / (result['run_id'] + '.quarantine') / 'raw/alpha.json').exists())

    def test_unchanged_growth_and_zero_baseline_promote(self):
        for initial, sequence in [(2, [2, 3, 3]), (0, [0, 1])]:
            with self.subTest(initial=initial), tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
                root = Path(tmp); seed_baseline(root, {'alpha': [document(initial)]})
                ids = set()
                for n in sequence:
                    code, result = runner.run_backup(root, REGISTRY, lambda c: ([document(n)], None, 200), business_schema=SCHEMA, synthetic=True, source_identity=IDENTITY)
                    self.assertEqual(code, 0)
                    self.assertEqual(result['health']['state'], 'passed')
                    self.assertEqual(result['business_counts'], {'alpha_rows': n})
                    self.assertEqual(json.loads((root / 'LATEST_GOOD.json').read_text())['run_id'], result['run_id'])
                    runner.validate_snapshot(root / result['run_id'])
                    ids.add(result['run_id'])
                self.assertEqual(len(ids), len(sequence))

    def test_quarantine_is_not_next_comparison_baseline(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            root = Path(tmp); original = seed_baseline(root)
            for n in (0, 1):
                code, result = runner.run_backup(root, REGISTRY, lambda c: ([document(n)], None, 200), business_schema=SCHEMA, synthetic=True, source_identity=IDENTITY)
                self.assertEqual(code, 3)
                self.assertEqual(result['health']['baseline_run_id'], original['run_id'])
                self.assertEqual(result['health']['reductions'][0]['before'], 2)
            code, result = runner.run_backup(root, REGISTRY, lambda c: ([document(2)], None, 200), business_schema=SCHEMA, synthetic=True, source_identity=IDENTITY)
            self.assertEqual(code, 0)

    def test_partial_capture_keeps_raw_attempt_and_previous_good(self):
        registry = {'alpha': 'required', 'beta': 'required'}
        schema = {'version': 1, 'metrics': dict(SCHEMA['metrics'], beta_docs={'kind': 'documents', 'collection': 'beta'})}
        for policy in ('required', 'optional'):
            with self.subTest(policy=policy), tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
                root = Path(tmp); registry['beta'] = policy
                seed_baseline(root, {'alpha': [document(2)], 'beta': []}, schema, registry)
                before = (root / 'LATEST_GOOD.json').read_bytes()
                code, result = runner.run_backup(root, registry, lambda c: ([document(2)], None, 200) if c == 'alpha' else ([], 'partial-page-failed', 500), business_schema=schema, synthetic=True, source_identity=IDENTITY)
                self.assertEqual(code, 2 if policy == 'required' else 3)
                suffix = '.partial' if policy == 'required' else '.quarantine'
                self.assertEqual(json.loads((root / (result['run_id'] + suffix) / 'raw/alpha.json').read_text()), [document(2)])
                self.assertFalse((root / (result['run_id'] + suffix) / 'raw/beta.json').exists())
                self.assertEqual((root / 'LATEST_GOOD.json').read_bytes(), before)
                self.assertEqual(json.loads((root / 'LATEST_ATTEMPT.json').read_text())['run_id'], result['run_id'])

    def test_concurrent_shrinkage_cannot_overwrite_good_or_attempt(self):
        import threading
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            root = Path(tmp); seed_baseline(root)
            before = (root / 'LATEST_GOOD.json').read_bytes()
            entered, release = threading.Event(), threading.Event()
            outcomes = []
            def fetch(c):
                entered.set()
                if not release.wait(5): raise RuntimeError('test timeout')
                return [document(0)], None, 200
            thread = threading.Thread(target=lambda: outcomes.append(runner.run_backup(root, REGISTRY, fetch, business_schema=SCHEMA, synthetic=True, source_identity=IDENTITY)))
            thread.start()
            self.assertTrue(entered.wait(2))
            try:
                code, result = runner.run_backup(root, REGISTRY, lambda c: ([document(3)], None, 200), business_schema=SCHEMA, synthetic=True, source_identity=IDENTITY)
                self.assertEqual(code, 75)
                self.assertFalse((root / 'LATEST_ATTEMPT.json').exists())
                self.assertEqual((root / 'LATEST_GOOD.json').read_bytes(), before)
            finally:
                release.set(); thread.join(5)
            self.assertFalse(thread.is_alive())
            self.assertEqual(outcomes[0][0], 3)
            self.assertEqual((root / 'LATEST_GOOD.json').read_bytes(), before)
            self.assertEqual(json.loads((root / 'LATEST_ATTEMPT.json').read_text())['run_id'], outcomes[0][1]['run_id'])

    def test_declared_documents_and_each_metric_compared_not_global_total(self):
        registry = {'alpha': 'required', 'beta': 'required'}
        schema = {'version': 1, 'metrics': dict(SCHEMA['metrics'], beta_docs={'kind': 'documents', 'collection': 'beta'})}
        beta = lambda n: [{'name': 'projects/demo-wakaf-review/databases/(default)/documents/beta/' + str(i), 'fields': {}} for i in range(n)]
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            seed_baseline(tmp, {'alpha': [document(2)], 'beta': beta(2)}, schema, registry)
            code, result = runner.run_backup(tmp, registry, lambda c: ([document(3)] if c == 'alpha' else beta(1), None, 200), business_schema=schema, synthetic=True, source_identity=IDENTITY)
            self.assertEqual(code, 3)
            self.assertEqual(result['health']['reductions'], [{'metric': 'beta_docs', 'before': 2, 'after': 1}])

    def test_unrelated_decode_failure_retains_raw_and_holds(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            root = Path(tmp); seed_baseline(root)
            before = (root / 'LATEST_GOOD.json').read_bytes()
            doc = document(2); doc['fields']['unrelated'] = {'integerValue': 'not-integer'}
            code, result = runner.run_backup(root, REGISTRY, lambda c: ([doc], None, 200), business_schema=SCHEMA, synthetic=True, source_identity=IDENTITY)
            self.assertEqual(code, 3)
            self.assertEqual(result['health']['reason'], 'clean-decode-failed')
            self.assertEqual((root / 'LATEST_GOOD.json').read_bytes(), before)
            self.assertEqual(json.loads((root / (result['run_id'] + '.quarantine') / 'raw/alpha.json').read_text()), [doc])

    def test_snapshot_validator_recomputes_explicit_business_counts(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            root = Path(tmp); pointer = seed_baseline(root)
            path = root / pointer['run_id'] / 'manifest.json'
            manifest = json.loads(path.read_text())
            manifest['business_counts']['alpha_rows'] = 0
            path.write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                runner.validate_snapshot(path.parent)

    def test_cli_explicit_schema_with_trusted_fixture_baseline_promotes(self):
        import subprocess
        import sys
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as tmp:
            root = Path(tmp)
            output = root / 'output'; seed_baseline(output)
            fixture = root / 'fixture.json'; fixture.write_text(json.dumps({'alpha': [document(3)]}))
            schema = root / 'schema.json'; schema.write_text(json.dumps(SCHEMA))
            identity = root / 'identity.json'; identity.write_text(json.dumps(IDENTITY))
            p = subprocess.run([sys.executable, str(Path(__file__).with_name('backup_runner.py')),
                                '--fixture', str(fixture), '--business-schema', str(schema),
                                '--source-identity', str(identity), '--output', str(output)], capture_output=True, text=True)
            self.assertEqual(p.returncode, 0, p.stderr)
            result = json.loads(p.stdout)
            self.assertEqual(result['business_counts'], {'alpha_rows': 3})
            self.assertEqual(json.loads((output / 'LATEST_GOOD.json').read_text())['run_id'], result['run_id'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
