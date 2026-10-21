"""Fail-closed derivative of source/firestore_backup.py; no automatic network."""
import datetime
import importlib.util
import json
from pathlib import Path
import uuid
import business_guard

SOURCE = Path(__file__).parent / 'source' / 'firestore_backup.py'
spec = importlib.util.spec_from_file_location('legacy_backup', SOURCE)
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)

import hashlib
import os

def write_json(path, value):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    with path.open('x', encoding='utf-8') as out:
        os.chmod(path, 0o600)
        json.dump(value, out, ensure_ascii=False, indent=2)
        out.flush()
        os.fsync(out.fileno())

def atomic_json(path, value):
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    write_json(temporary, value)
    os.replace(temporary, path)
    sync_directory(path.parent)

def sync_directory(path):
    fd = os.open(path, os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)

def seal_snapshot(stage, result):
    files = {}
    for path in sorted(stage.rglob('*')):
        if path.is_file():
            body = path.read_bytes()
            files[str(path.relative_to(stage))] = {'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body)}
    write_json(stage / 'manifest.json', {'schema': 1, 'run_id': result['run_id'], 'files': files,
                                      'collections': result['collections'],
                                      'business_schema': result.get('business_schema'),
                                      'business_counts': result.get('business_counts'),
                                      'source_identity': result.get('source_identity'),
                                      'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest()})

def validate_snapshot(stage):
    stage = Path(stage)
    manifest = json.loads((stage / 'manifest.json').read_text())
    if (not isinstance(manifest, dict) or type(manifest.get('schema')) is not int or
            manifest['schema'] != 1):
        raise ValueError('Unsupported manifest schema')
    actual = {str(p.relative_to(stage)) for p in stage.rglob('*') if p.is_file()}
    if actual != set(manifest['files']) | {'manifest.json'}:
        raise ValueError('File set mismatch')
    for relative, expected in manifest['files'].items():
        path = stage / relative
        if path.is_symlink() or not path.resolve().is_relative_to(stage.resolve()):
            raise ValueError('Unsafe manifest path')
        body = path.read_bytes()
        if hashlib.sha256(body).hexdigest() != expected['sha256'] or len(body) != expected['bytes']:
            raise ValueError('Hash/size mismatch: ' + relative)
        if path.suffix == '.json':
            json.loads(body)
    for col, entry in manifest['collections'].items():
        if entry['state'] == 'captured':
            raw = json.loads((stage / 'raw' / (col + '.json')).read_text())
            clean = json.loads((stage / 'clean' / (col + '.json')).read_text())
            if len(raw) != entry['count'] or len(clean) != entry['count']:
                raise ValueError('Count mismatch: ' + col)
    status = json.loads((stage / '_status.json').read_text())
    if status.get('health', {}).get('state') == 'passed':
        business_guard.validate_schema(manifest['business_schema'], status['registry'])
        raw = {c: json.loads((stage / 'raw' / (c + '.json')).read_text())
               for c, e in manifest['collections'].items() if e['state'] == 'captured'}
        business_guard.validate_document_sources(raw, manifest.get('source_identity'))
        if manifest['source_identity'] != status.get('source_identity'):
            raise ValueError('Snapshot source identity mismatch')
        counts = manifest['business_counts']
        if (not isinstance(counts, dict) or any(type(v) is not int or v < 0 for v in counts.values()) or
                business_guard.count_business(raw, manifest['business_schema']) != counts):
            raise ValueError('Business count mismatch')
    return manifest

def fetch_collection(col, base, opener=None, sleep=None, headers=None, attempts=3):
    """Legacy list/pagination semantics, bounded retry; never return partial docs."""
    import time
    import urllib.request
    import urllib.error
    import urllib.parse
    opener = opener or urllib.request.urlopen
    sleep = sleep or time.sleep
    docs, token, seen = [], None, set()
    for page in range(10000):
        query = {'pageSize': 300}
        if token:
            query['pageToken'] = token
        url = base.rstrip('/') + '/' + urllib.parse.quote(col, safe='') + '?' + urllib.parse.urlencode(query)
        for attempt in range(attempts):
            try:
                req = urllib.request.Request(url, headers=headers or {'User-Agent': 'wakaf-backup/2.0'})
                with opener(req, timeout=30) as response:
                    body = json.loads(response.read())
                if not isinstance(body, dict) or not isinstance(body.get('documents', []), list):
                    raise ValueError('Malformed page')
                break
            except urllib.error.HTTPError as error:
                code = error.code
                error.close()
                if code not in (429, 500, 502, 503, 504) or attempt == attempts - 1:
                    return [], 'http-error', code
            except (TimeoutError, urllib.error.URLError, ConnectionError):
                if attempt == attempts - 1:
                    return [], 'transport-error', 0
            except (ValueError, TypeError):
                return [], 'malformed-response', 0
            sleep(min(0.25 * 2 ** attempt, 2))
        docs.extend(body.get('documents', []))
        token = body.get('nextPageToken')
        if not token:
            return docs, None, 200
        if not isinstance(token, str) or token in seen:
            return [], 'pagination-cycle', 0
        seen.add(token)
    return [], 'page-limit', 0

def run_backup(root, registry, fetch, excel=None, synthetic=False, business_schema=None, source_identity=None, source_base=None):
    import fcntl
    root = Path(root)
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(root, 0o700)
    with (root / '.backup.lock').open('a') as lock:
        os.chmod(root / '.backup.lock', 0o600)
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 75, {'state': 'locked'}
        try:
            return _run_locked(root, registry, fetch, excel, synthetic, business_schema, source_identity, source_base)
        except Exception as error:
            result = {'state': 'failed', 'error_class': type(error).__name__}
            try:
                atomic_json(root / 'LATEST_ATTEMPT.json', result)
            except OSError:
                pass  # disk failure: stderr/exit remains authoritative
            return 2, result

def _run_locked(root, registry, fetch, excel, synthetic, business_schema, source_identity, source_base):
    import re
    if not registry or not any(p == 'required' for p in registry.values()):
        raise ValueError('Required collection registry missing')
    if any(not re.fullmatch(r'[A-Za-z0-9_-]+', c) or p not in ('required', 'optional', 'expected-denied')
           for c, p in registry.items()):
        raise ValueError('Invalid registry')
    run_id = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ-') + uuid.uuid4().hex
    stage = root / (run_id + '.partial')
    stage.mkdir(mode=0o700)
    result = {'run_id': run_id, 'collections': {}, 'state': 'failed', 'synthetic': synthetic,
              'capture_start_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'consistency': 'sequential-list-not-point-in-time', 'registry': registry,
              'source_identity': source_identity, 'source_base': source_base}
    failed = False
    for col, policy in registry.items():
        docs, error, code = fetch(col)
        state = 'captured' if error is None else 'failed'
        if policy == 'expected-denied' and code == 403:
            state = 'expected-denied'
        if state == 'failed' and policy != 'optional':
            failed = True
        result['collections'][col] = {'state': state, 'count': len(docs) if state == 'captured' else None, 'http': code}
        if state == 'captured':
            write_json(stage / 'raw' / (col + '.json'), docs)
            try:
                business_guard.validate_document_sources({col: docs}, source_identity)
            except (ValueError, KeyError, TypeError):
                # Preserve the original capture before withholding health promotion.
                write_json(stage / 'clean' / (col + '.json'), [{} for _ in docs])
                continue
            clean = []
            for d in docs:
                entry = {'_document_id': d['name'].split('/')[-1], '_document_name': d['name']}
                try:
                    entry['fields'] = {k: legacy.decode_value(v) for k, v in d.get('fields', {}).items()}
                except (ValueError, TypeError, AttributeError, KeyError):
                    entry['fields'] = {}
                    entry['_decode_error'] = True
                    result['decode_failed'] = True
                clean.append(entry)
            write_json(stage / 'clean' / (col + '.json'), clean)
    result['excel'] = {'state': 'not-requested'}
    if excel:
        try:
            clean = {c: json.loads((stage / 'clean' / (c + '.json')).read_text())
                     for c, entry in result['collections'].items() if entry['state'] == 'captured'}
            ok, error = excel(clean, {}, stage / 'audit.xlsx')
            result['excel'] = {'state': 'captured' if ok else 'failed-optional'}
            if (stage / 'audit.xlsx').exists():
                os.chmod(stage / 'audit.xlsx', 0o600)
        except Exception:
            result['excel'] = {'state': 'failed-optional'}
            (stage / 'audit.xlsx').unlink(missing_ok=True)
    result['capture_end_utc'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    result['state'] = 'failed' if failed else 'complete-in-declared-scope'
    result['capture_state'] = result['state']
    healthy = business_guard.assess(root, stage, result, business_schema, validate_snapshot)
    if not failed and not healthy:
        result['state'] = 'quarantined'
    clean_data = {c: json.loads((stage / 'clean' / (c + '.json')).read_text())
                  for c, entry in result['collections'].items() if entry['state'] == 'captured'}
    write_json(stage / 'snapshot_combined.json', {'_meta': result, 'data': clean_data})
    schema = ('# Backup schema v2\n\nRAW typed values are the restore source. CLEAN is analysis only; '
              'identity is separate from fields. Sequential capture is not a point-in-time export.\n\n'
              'run_id: ' + run_id + '\n\n' +
              '\n'.join(c + ': ' + e['state'] + ', documents=' + str(e['count'])
                        for c, e in result['collections'].items()) +
              '\n\nExpected-denied means not captured, not empty or full-system recovery ready. '
              'Media, offline queues, configuration and credential recovery require separate coverage.\n')
    with (stage / 'README_SCHEMA.md').open('x', encoding='utf-8') as out:
        os.chmod(stage / 'README_SCHEMA.md', 0o600)
        out.write(schema)
        out.flush()
        os.fsync(out.fileno())
    write_json(stage / '_status.json', result)
    atomic_json(root / 'LATEST_ATTEMPT.json', result)
    if failed:
        return 2, result
    seal_snapshot(stage, result)
    validate_snapshot(stage)
    sync_directory(stage)
    destination = root / (run_id if healthy else run_id + '.quarantine')
    stage.rename(destination)
    sync_directory(root)
    result['manifest_sha256'] = hashlib.sha256((destination / 'manifest.json').read_bytes()).hexdigest()
    atomic_json(root / 'LATEST_ATTEMPT.json', result)
    if not healthy:
        return 3, result
    atomic_json(root / 'LATEST_GOOD.json', result)
    return 0, result

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Private deterministic backup; no scheduler or credentials provisioned')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--fixture', type=Path)
    parser.add_argument('--config', type=Path)
    parser.add_argument('--business-schema', type=Path, help='Exact reviewed business metric schema; no auto-detection')
    parser.add_argument('--source-identity', type=Path, help='Explicit project/database/document_root JSON; never inferred')
    args = parser.parse_args()
    if bool(args.fixture) == bool(args.config):
        parser.error('Choose exactly one of --fixture or --config')
    if args.fixture:
        fixture = json.loads(args.fixture.read_text())
        code, result = run_backup(args.output, {c: 'required' for c in fixture},
                                  lambda c: (fixture[c], None, 200), synthetic=True,
                                  source_identity=json.loads(args.source_identity.read_text()) if args.source_identity else None,
                                  business_schema=json.loads(args.business_schema.read_text()) if args.business_schema else None)
    else:
        config = json.loads(args.config.read_text())
        # No implicit production reads; integration must explicitly approve network/config.
        if config.get('approved_readonly_network') is not True:
            parser.error('Read-only network integration not approved in this config')
        base = config['base']
        if not base.startswith('https://firestore.googleapis.com/v1/projects/'):
            parser.error('Only explicit Firestore HTTPS base supported')
        code, result = run_backup(args.output, config['collections'], lambda c: fetch_collection(c, base),
                                 source_identity=config.get('source_identity'), source_base=base,
                                 business_schema=json.loads(args.business_schema.read_text()) if args.business_schema else config.get('business_schema'))
    print(json.dumps(result))
    return code

if __name__ == '__main__':
    raise SystemExit(main())
