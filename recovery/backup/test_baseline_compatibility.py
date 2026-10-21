"""Own adverse controls: synthetic only; explicit identity, never bootstrap."""
import copy
import inspect
import json
from pathlib import Path
import tempfile
import unittest
import backup_runner as r
from test_independent import seed, reanchor, doc, REG, SCHEMA

IDENTITY = {'project': 'demo-independent', 'database': '(default)',
            'document_root': 'projects/demo-independent/databases/(default)/documents'}
DOC_SCHEMA = {'version': 1, 'metrics': {'a': {'kind': 'documents', 'collection': 'alpha'}}}


def explicit_seed(root, docs=None, schema=None, identity=IDENTITY):
    stage = seed(root, docs, schema)
    for path in (stage / '_status.json', stage / 'manifest.json', root / 'LATEST_GOOD.json'):
        body = json.loads(path.read_text()); body['source_identity'] = copy.deepcopy(identity)
        path.write_text(json.dumps(body))
    reanchor(root, stage)
    return stage


def capture(root, docs=None, schema=SCHEMA, identity=IDENTITY):
    docs = {'alpha': [doc(2)]} if docs is None else docs
    kwargs = {'source_identity': copy.deepcopy(identity)} if 'source_identity' in inspect.signature(r.run_backup).parameters else {}
    return r.run_backup(root, REG, lambda c: (docs[c], None, 200), synthetic=True, business_schema=schema, **kwargs)


class CompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def hold(self, docs=None, schema=SCHEMA, identity=IDENTITY):
        pointer = self.root / 'LATEST_GOOD.json'
        before = pointer.read_bytes() if pointer.exists() else None
        code, result = capture(self.root, docs, schema, identity)
        self.assertEqual(code, 3, result)
        self.assertEqual(result['health']['state'], 'hold')
        self.assertEqual(pointer.read_bytes() if pointer.exists() else None, before)
        attempt = json.loads((self.root / 'LATEST_ATTEMPT.json').read_text())
        self.assertEqual(attempt['run_id'], result['run_id'])
        stage = self.root / (result['run_id'] + '.quarantine')
        self.assertEqual(json.loads((stage / 'raw/alpha.json').read_text()), (docs if docs is not None else {'alpha': [doc(2)]})['alpha'])
        r.validate_snapshot(stage)
        return result

    def test_explicit_identity_persisted_even_when_empty(self):
        explicit_seed(self.root, {'alpha': []}, DOC_SCHEMA)
        code, result = capture(self.root, {'alpha': []}, DOC_SCHEMA)
        self.assertEqual(code, 0, result)
        stage = self.root / result['run_id']
        for path in (stage / '_status.json', stage / 'manifest.json', self.root / 'LATEST_GOOD.json', self.root / 'LATEST_ATTEMPT.json'):
            body = json.loads(path.read_text())
            self.assertIn('source_identity', body)
            self.assertEqual(body['source_identity'], IDENTITY)
        self.assertEqual(result['source_identity'], IDENTITY)

    def test_empty_collection_project_switch_holds(self):
        explicit_seed(self.root, {'alpha': []}, DOC_SCHEMA)
        other = {'project': 'demo-other', 'database': '(default)', 'document_root': 'projects/demo-other/databases/(default)/documents'}
        self.hold({'alpha': []}, DOC_SCHEMA, other)

    def test_empty_collection_database_switch_holds(self):
        explicit_seed(self.root, {'alpha': []}, DOC_SCHEMA)
        other = dict(IDENTITY, database='other-demo', document_root='projects/demo-independent/databases/other-demo/documents')
        self.hold({'alpha': []}, DOC_SCHEMA, other)

    def test_matching_documents_cannot_authorize_project_or_database_switch(self):
        explicit_seed(self.root)
        for project, database in (('demo-other', '(default)'), ('demo-independent', 'other-demo')):
            with self.subTest(project=project, database=database):
                identity = {'project': project, 'database': database,
                    'document_root': f'projects/{project}/databases/{database}/documents'}
                d = doc(2); d['name'] = identity['document_root'] + '/alpha/active'
                result = self.hold({'alpha': [d]}, identity=identity)
                self.assertEqual(result['health']['reason'], 'baseline-unavailable-or-invalid')

    def test_missing_explicit_current_identity_holds(self):
        explicit_seed(self.root); self.hold(identity=None)

    def test_mixed_document_sources_hold_and_keep_raw(self):
        explicit_seed(self.root)
        self.hold({'alpha': [doc(2), doc(2, key='other', project='demo-other')]})

    def test_wrong_document_source_holds_and_keeps_raw(self):
        explicit_seed(self.root); self.hold({'alpha': [doc(2, project='demo-other')]})

    def test_document_scope_exact_not_penultimate_segment(self):
        explicit_seed(self.root)
        for name in ('alpha/active', IDENTITY['document_root'] + '/nested/id/alpha/active', IDENTITY['document_root'] + '/alpha/', IDENTITY['document_root'] + '/beta/active'):
            with self.subTest(name=name):
                d = doc(2); d['name'] = name
                self.hold({'alpha': [d]})

    def test_duplicate_document_names_hold_keep_raw(self):
        explicit_seed(self.root); self.hold({'alpha': [doc(2), doc(2)]})

    def test_missing_document_name_holds_keep_raw(self):
        explicit_seed(self.root); d = doc(2); d.pop('name'); self.hold({'alpha': [d]})

    def test_invalid_explicit_identity_holds(self):
        explicit_seed(self.root)
        for identity in ({}, True, [], dict(IDENTITY, document_root=IDENTITY['document_root'] + '/'), dict(IDENTITY, project=True), dict(IDENTITY, database='x/y'), dict(IDENTITY, extra='ignored')):
            with self.subTest(identity=identity): self.hold(identity=identity)

    def test_each_baseline_identity_slot_required_and_equal(self):
        for slot in ('pointer', 'status', 'manifest'):
            for mutation in ('missing', 'different'):
                with self.subTest(slot=slot, mutation=mutation), tempfile.TemporaryDirectory(dir=self.root) as temp:
                    saved = self.root; self.root = Path(temp)
                    try:
                        stage = explicit_seed(self.root)
                        path = {'pointer': self.root / 'LATEST_GOOD.json', 'status': stage / '_status.json', 'manifest': stage / 'manifest.json'}[slot]
                        body = json.loads(path.read_text())
                        if mutation == 'missing': body.pop('source_identity')
                        else: body['source_identity'] = dict(IDENTITY, project='demo-other', document_root='projects/demo-other/databases/(default)/documents')
                        path.write_text(json.dumps(body)); reanchor(self.root, stage)
                        self.hold()
                    finally: self.root = saved

    def test_rehashed_baseline_raw_wrong_source_holds(self):
        stage = explicit_seed(self.root)
        (stage / 'raw/alpha.json').write_text(json.dumps([doc(2, project='demo-other')]))
        reanchor(self.root, stage); self.hold()

    def test_runner_created_baseline_enforces_source(self):
        explicit_seed(self.root)
        code, result = capture(self.root); self.assertEqual(code, 0, result)
        self.hold({'alpha': [doc(2, project='demo-other')]})

    def test_runner_created_baseline_manifest_schema_rejections(self):
        for mutation in ('missing', 0, True, 2):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory(dir=self.root) as temp:
                saved = self.root; self.root = Path(temp)
                try:
                    explicit_seed(self.root)
                    code, result = capture(self.root); self.assertEqual(code, 0, result)
                    stage = self.root / result['run_id']
                    manifest = json.loads((stage / 'manifest.json').read_text())
                    if mutation == 'missing': manifest.pop('schema')
                    else: manifest['schema'] = mutation
                    (stage / 'manifest.json').write_text(json.dumps(manifest)); reanchor(self.root, stage)
                    self.hold()
                finally: self.root = saved

    def test_no_baseline_never_bootstraps_even_with_identity(self):
        self.hold()

    def test_manifest_schema_exact_integer_supported(self):
        stage = explicit_seed(self.root)
        original = json.loads((stage / 'manifest.json').read_text())
        for value in (0, 2, -1, True, False, 1.0, '1', None):
            with self.subTest(value=value):
                manifest = dict(original, schema=value)
                (stage / 'manifest.json').write_text(json.dumps(manifest)); reanchor(self.root, stage)
                with self.assertRaises(ValueError): r.validate_snapshot(stage)
                self.hold()

    def test_network_config_base_must_match_explicit_identity_when_empty(self):
        # Stub the fetch seam: no network; the real CLI/config path still runs.
        import contextlib
        import io
        from unittest.mock import patch
        stage = explicit_seed(self.root, {'alpha': []}, DOC_SCHEMA)
        # Exercise config mode's False metadata using synthetic bytes only.
        for path in (stage / '_status.json', self.root / 'LATEST_GOOD.json'):
            body = json.loads(path.read_text()); body['synthetic'] = False
            path.write_text(json.dumps(body))
        reanchor(self.root, stage)
        config = self.root / 'config.json'
        config.write_text(json.dumps({'approved_readonly_network': True, 'collections': REG,
            'business_schema': DOC_SCHEMA, 'source_identity': IDENTITY,
            'base': 'https://firestore.googleapis.com/v1/projects/demo-other/databases/(default)/documents'}))
        before = (self.root / 'LATEST_GOOD.json').read_bytes()
        with patch('sys.argv', ['backup_runner', '--config', str(config), '--output', str(self.root)]), patch.object(r, 'fetch_collection', return_value=([], None, 200)), contextlib.redirect_stdout(io.StringIO()):
            code = r.main()
        self.assertEqual(code, 3)
        self.assertEqual((self.root / 'LATEST_GOOD.json').read_bytes(), before)
        attempt = json.loads((self.root / 'LATEST_ATTEMPT.json').read_text())
        self.assertEqual(attempt['health']['state'], 'hold')
        self.assertEqual(json.loads((self.root / (attempt['run_id'] + '.quarantine') / 'raw/alpha.json').read_text()), [])

    def test_matching_network_base_allows_empty_capture(self):
        explicit_seed(self.root, {'alpha': []}, DOC_SCHEMA)
        code, result = r.run_backup(self.root, REG, lambda c: ([], None, 200), synthetic=True,
            business_schema=DOC_SCHEMA, source_identity=IDENTITY,
            source_base='https://firestore.googleapis.com/v1/' + IDENTITY['document_root'])
        self.assertEqual(code, 0, result)

    def test_manifest_must_be_object(self):
        stage = explicit_seed(self.root)
        for value in ([], None, True, 1, 'x'):
            with self.subTest(value=value):
                (stage / 'manifest.json').write_text(json.dumps(value))
                with self.assertRaises(ValueError): r.validate_snapshot(stage)

    def test_supported_schema_and_matching_nonempty_source_promote(self):
        explicit_seed(self.root)
        for n in (2, 3):
            code, result = capture(self.root, {'alpha': [doc(n)]})
            self.assertEqual(code, 0, result)
            r.validate_snapshot(self.root / result['run_id'])
