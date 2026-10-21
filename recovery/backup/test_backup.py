import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('runner', Path(__file__).with_name('backup_runner.py'))
IDENTITY = {'project': 'demo-wakaf', 'database': '(default)',
            'document_root': 'projects/demo-wakaf/databases/(default)/documents'}
runner = importlib.util.module_from_spec(SPEC) if SPEC else None
if SPEC and Path(SPEC.origin).exists():
    SPEC.loader.exec_module(runner)

def run_with_explicit_baseline(root, registry, fetch, **kwargs):
    """Old capture tests now declare document metrics and seed a synthetic baseline.

    Missing-baseline/schema HOLD is tested separately; no candidate bypass is used.
    """
    from test_shrinkage import seed_baseline
    import re
    if registry and all(re.fullmatch(r'[A-Za-z0-9_-]+', c) for c in registry):
        schema = {'version': 1, 'metrics': {c: {'kind': 'documents', 'collection': c}
                  for c, p in registry.items() if p != 'expected-denied'}}
        if not (Path(root) / 'LATEST_GOOD.json').exists():
            seed_baseline(root, {c: [] for c, p in registry.items() if p != 'expected-denied'}, schema, registry, IDENTITY)
        kwargs['business_schema'] = schema
    kwargs['synthetic'] = True
    kwargs['source_identity'] = IDENTITY
    return runner.run_backup(root, registry, fetch, **kwargs)


class BackupTests(unittest.TestCase):
    def test_required_500_never_publishes_good(self):
        self.assertTrue(runner is not None and hasattr(runner, 'run_backup'),
                        'Missing fail-closed derivative run_backup')
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as root:
            def failed(col):
                return [], 'HTTP failure', 500
            code, result = runner.run_backup(root, {'alpha': 'required'}, failed)
            self.assertNotEqual(code, 0)
            self.assertEqual(result['collections']['alpha']['state'], 'failed')
            self.assertFalse((Path(root) / 'LATEST_GOOD.json').exists())
            self.assertTrue((Path(root) / 'LATEST_ATTEMPT.json').exists())

    def test_good_snapshot_has_verified_manifest_and_private_modes(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as root:
            doc = {'name': 'projects/demo-wakaf/databases/(default)/documents/alpha/active',
                   'fields': {'x': {'integerValue': '7'}}}
            code, result = run_with_explicit_baseline(root, {'alpha': 'required'}, lambda c: ([doc], None, 200))
            self.assertEqual(code, 0)
            snapshot = Path(root) / result['run_id']
            self.assertTrue((snapshot / 'manifest.json').exists(), 'Missing manifest')
            runner.validate_snapshot(snapshot)
            self.assertEqual(snapshot.stat().st_mode & 0o777, 0o700)
            self.assertEqual((snapshot / 'raw/alpha.json').stat().st_mode & 0o777, 0o600)
            (snapshot / 'raw/alpha.json').write_text('[]')
            with self.assertRaises(ValueError):
                runner.validate_snapshot(snapshot)

    def test_parallel_run_is_rejected_without_changing_good(self):
        import threading
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as root:
            entered, release = threading.Event(), threading.Event()
            from test_shrinkage import seed_baseline
            schema = {'version': 1, 'metrics': {'alpha': {'kind': 'documents', 'collection': 'alpha'}}}
            seed_baseline(root, {'alpha': []}, schema, {'alpha': 'required'}, IDENTITY)
            def blocked(col):
                entered.set()
                release.wait(5)
                return [], None, 200
            thread = threading.Thread(target=run_with_explicit_baseline, args=(root, {'alpha': 'required'}, blocked))
            thread.start()
            self.assertTrue(entered.wait(2))
            try:
                code, result = run_with_explicit_baseline(root, {'alpha': 'required'}, lambda c: ([], None, 200))
                self.assertEqual(code, 75, 'Concurrent backup must fail lock')
            finally:
                release.set()
                thread.join(5)

    def test_pagination_retry_is_bounded_and_drops_partial_on_failure(self):
        self.assertTrue(hasattr(runner, 'fetch_collection'), 'Missing retrying fetch')
        import urllib.error
        from unittest.mock import Mock
        delays = []
        prefix = 'projects/demo-wakaf/databases/(default)/documents/alpha/'
        class Response:
            def __init__(self, body): self.body = body
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return json.dumps(self.body).encode()
        first = Response({'documents': [{'name': prefix + 'one', 'fields': {}}], 'nextPageToken': 'a/b +'})
        second = Response({'documents': [{'name': prefix + 'two', 'fields': {}}]})
        calls = []
        sequence = iter([first, urllib.error.HTTPError('synthetic', 429, 'rate', {}, None), second])
        def opener(req, timeout):
            calls.append(req.full_url)
            item = next(sequence)
            if isinstance(item, Exception): raise item
            return item
        docs, err, code = runner.fetch_collection('alpha', 'https://example.invalid/documents', opener=opener, sleep=delays.append)
        self.assertIsNone(err)
        self.assertEqual(len(docs), 2)
        self.assertIn('pageToken=a%2Fb+%2B', calls[-1])
        self.assertEqual(delays, [0.25])
        transient = Mock(side_effect=TimeoutError('synthetic'))
        docs, err, code = runner.fetch_collection('alpha', 'https://example.invalid/documents', opener=transient, sleep=lambda x: None)
        self.assertEqual(transient.call_count, 3)
        self.assertEqual(docs, [])
        denied = Mock(side_effect=urllib.error.HTTPError('synthetic', 403, 'deny', {}, None))
        runner.fetch_collection('alpha', 'https://example.invalid/documents', opener=denied, sleep=lambda x: None)
        self.assertEqual(denied.call_count, 1)

    def test_excel_failure_does_not_block_json(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as root:
            def crash(clean, warnings, path):
                raise RuntimeError('synthetic workbook crash')
            code, result = run_with_explicit_baseline(root, {'alpha': 'required'}, lambda c: ([], None, 200), excel=crash)
            self.assertEqual(code, 0)
            self.assertEqual(result.get('excel', {}).get('state'), 'failed-optional')
            runner.validate_snapshot(Path(root) / result['run_id'])

    def test_registry_and_document_identity_fail_closed(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as root:
            code, _ = run_with_explicit_baseline(root, {}, lambda c: ([], None, 200))
            self.assertNotEqual(code, 0, 'Empty registry cannot certify completeness')
            code, _ = run_with_explicit_baseline(root, {'../escape': 'required'}, lambda c: ([], None, 200))
            self.assertNotEqual(code, 0)
            duplicate = {'name': 'projects/demo-wakaf/databases/(default)/documents/alpha/x', 'fields': {}}
            code, _ = run_with_explicit_baseline(root, {'alpha': 'required'}, lambda c: ([duplicate, duplicate], None, 200))
            self.assertNotEqual(code, 0)

    def test_failure_matrix_retains_last_good(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as root:
            code, good = run_with_explicit_baseline(root, {'alpha': 'required'}, lambda c: ([], None, 200))
            original = (Path(root) / 'LATEST_GOOD.json').read_bytes()
            for http in (403, 429, 500, 0):
                with self.subTest(http=http):
                    code, bad = run_with_explicit_baseline(root, {'alpha': 'required'}, lambda c: ([], 'synthetic', http))
                    self.assertEqual(code, 2)
                    self.assertEqual((Path(root) / 'LATEST_GOOD.json').read_bytes(), original)
                    self.assertNotEqual(bad['run_id'], good['run_id'])
            with patch.object(runner, 'write_json', side_effect=OSError(28, 'synthetic disk full')):
                code, result = run_with_explicit_baseline(root, {'alpha': 'required'}, lambda c: ([], None, 200))
            self.assertEqual(code, 2)
            self.assertEqual((Path(root) / 'LATEST_GOOD.json').read_bytes(), original)

    def test_expected_denied_only_accepts_403(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as root:
            for http, expected in ((403, 0), (500, 2), (0, 2)):
                with self.subTest(http=http):
                    code, result = run_with_explicit_baseline(root, {'alpha': 'required', 'audit_log': 'expected-denied'},
                        lambda c: ([], None, 200) if c == 'alpha' else ([], 'synthetic', http))
                    self.assertEqual(code, expected)

    def test_clean_preserves_original_id_as_field_and_separate_identity(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as root:
            doc = {'name': 'projects/demo-wakaf/databases/(default)/documents/alpha/real-id',
                   'fields': {'_id': {'stringValue': 'business-id'}, 'n': {'integerValue': '42'}}}
            code, result = run_with_explicit_baseline(root, {'alpha': 'required'}, lambda c: ([doc], None, 200))
            clean = json.loads((Path(root) / result['run_id'] / 'clean/alpha.json').read_text())[0]
            self.assertEqual(clean.get('_document_id'), 'real-id', 'Must not lose Firestore identity')
            self.assertEqual(clean['fields']['_id'], 'business-id')
            self.assertEqual(clean['fields']['n'], 42)

    def test_cli_synthetic_snapshot_is_shared_by_analysis_outputs(self):
        import subprocess
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as root:
            fixture = Path(root) / 'fixture.json'
            fixture.write_text(json.dumps({'alpha': []}))
            output = Path(root) / 'output'
            cli = subprocess.run(['python3', str(Path(__file__).with_name('backup_runner.py')),
                                  '--fixture', str(fixture), '--output', str(output)], capture_output=True, text=True)
            self.assertEqual(cli.returncode, 3, cli.stderr)
            self.assertFalse((output / 'LATEST_GOOD.json').exists(), 'CLI must not silently bootstrap missing baseline/schema')
            pointer = json.loads((output / 'LATEST_ATTEMPT.json').read_text())
            snapshot = output / (pointer['run_id'] + '.quarantine')
            self.assertTrue(pointer['synthetic'])
            combined = json.loads((snapshot / 'snapshot_combined.json').read_text())
            self.assertEqual(combined['_meta']['run_id'], pointer['run_id'])
            self.assertEqual(combined['data'], {'alpha': []})
            self.assertTrue((snapshot / 'README_SCHEMA.md').exists())
            self.assertIn('manifest_sha256', pointer)

    def test_page_two_500_is_not_partial_success(self):
        import urllib.error
        calls = []
        class First:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return json.dumps({'documents': [{'name': 'projects/demo-x/databases/(default)/documents/alpha/a', 'fields': {}}], 'nextPageToken': 'next'}).encode()
        def opener(req, timeout):
            calls.append(req.full_url)
            if len(calls) == 1: return First()
            raise urllib.error.HTTPError('synthetic', 500, 'failure', {}, None)
        docs, error, http = runner.fetch_collection('alpha', 'https://example.invalid/documents', opener=opener, sleep=lambda x: None)
        self.assertEqual(docs, [])
        self.assertEqual(http, 500)
        self.assertEqual(len(calls), 4)
        self.assertIsNotNone(error)

    def test_http_error_stream_is_closed(self):
        import io
        import urllib.error
        stream = io.BytesIO(b'{}')
        failure = urllib.error.HTTPError('synthetic', 403, 'denied', {}, stream)
        def opener(req, timeout): raise failure
        runner.fetch_collection('alpha', 'https://example.invalid/documents', opener=opener)
        self.assertTrue(stream.closed, 'HTTP error response stream leaked')

if __name__ == '__main__':
    unittest.main(verbosity=2)
