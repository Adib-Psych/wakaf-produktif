"""Explicit-schema local promotion gate. No operator exception/bypass API."""
import json
import re


def validate_source_identity(identity):
    if (not isinstance(identity, dict) or set(identity) != {'project', 'database', 'document_root'} or
            not isinstance(identity['project'], str) or
            not re.fullmatch(r'[A-Za-z0-9_-]+', identity['project']) or
            not isinstance(identity['database'], str) or
            not re.fullmatch(r'(?:\(default\)|[A-Za-z0-9_-]+)', identity['database']) or
            identity['document_root'] != 'projects/' + identity['project'] + '/databases/' + identity['database'] + '/documents'):
        raise ValueError('Explicit source identity required')


def validate_document_sources(raw, identity):
    validate_source_identity(identity)
    for col, docs in raw.items():
        if not isinstance(docs, list):
            raise ValueError('Document list required')
        prefix = identity['document_root'] + '/' + col + '/'
        names = set()
        for doc in docs:
            name = doc.get('name') if isinstance(doc, dict) else None
            if (not isinstance(name, str) or not name.startswith(prefix) or
                    not name[len(prefix):] or '/' in name[len(prefix):] or name in names):
                raise ValueError('Invalid, mixed or duplicate document source')
            names.add(name)


def validate_schema(schema, registry):
    if (not isinstance(schema, dict) or set(schema) != {'version', 'metrics'} or
            type(schema['version']) is not int or schema['version'] != 1 or
            not isinstance(schema['metrics'], dict) or not schema['metrics']):
        raise ValueError('Explicit business schema required')
    covered = set()
    for key, metric in schema['metrics'].items():
        if not isinstance(key, str) or not re.fullmatch(r'[A-Za-z0-9_-]+', key) or not isinstance(metric, dict):
            raise ValueError('Invalid metric')
        kind = metric.get('kind')
        expected = {'kind', 'collection'}
        if kind == 'singleton-array':
            expected |= {'document_id', 'field_path'}
            if (not isinstance(metric.get('document_id'), str) or
                    not re.fullmatch(r'[A-Za-z0-9_-]+', metric['document_id']) or
                    not isinstance(metric.get('field_path'), list) or not metric['field_path'] or
                    any(not isinstance(p, str) or not p for p in metric['field_path'])):
                raise ValueError('Invalid explicit singleton path')
        elif kind != 'documents':
            raise ValueError('Unsupported business metric kind')
        col = metric.get('collection')
        if set(metric) != expected or not isinstance(col, str) or registry.get(col) not in ('required', 'optional'):
            raise ValueError('Invalid metric scope')
        covered.add(col)
    if covered != {c for c, policy in registry.items() if policy != 'expected-denied'}:
        raise ValueError('Schema must explicitly cover every readable collection')


def count_business(raw, schema):
    counts = {}
    for key, metric in schema['metrics'].items():
        docs = raw[metric['collection']]
        if not isinstance(docs, list):
            raise ValueError('Document list required')
        if metric['kind'] == 'documents':
            counts[key] = len(docs)
            continue
        selected = [d for d in docs if d['name'].split('/')[-1] == metric['document_id']]
        if len(selected) != 1:
            raise ValueError('Required singleton document absent or duplicate')
        fields = selected[0]['fields']
        for i, part in enumerate(metric['field_path']):
            if not isinstance(fields, dict):
                raise ValueError('Map fields required')
            value = fields[part]
            tag = 'arrayValue' if i == len(metric['field_path']) - 1 else 'mapValue'
            if not isinstance(value, dict) or set(value) != {tag} or not isinstance(value[tag], dict):
                raise ValueError('Required typed business path invalid')
            if tag == 'mapValue':
                if set(value[tag]) != {'fields'}:
                    raise ValueError('Required nested fields absent')
                fields = value[tag]['fields']
            else:
                if set(value[tag]) - {'values'}:
                    raise ValueError('Unknown array members')
                rows = value[tag].get('values', [])  # REST protobuf permits empty arrayValue={}
                if not isinstance(rows, list):
                    raise ValueError('Business rows must be a list')
                for row in rows:
                    if (not isinstance(row, dict) or set(row) != {'mapValue'} or
                            not isinstance(row['mapValue'], dict) or set(row['mapValue']) - {'fields'} or
                            not isinstance(row['mapValue'].get('fields', {}), dict)):
                        raise ValueError('Business row must be a typed map')
                counts[key] = len(rows)
    return counts


def assess(root, stage, result, schema, validate):
    result['business_schema'] = schema
    result['business_counts'] = {}
    health = {'state': 'hold', 'reason': 'business-schema-or-payload-invalid', 'reductions': []}
    result['health'] = health
    try:
        validate_schema(schema, result['registry'])
        raw = {c: json.loads((stage / 'raw' / (c + '.json')).read_text())
               for c, e in result['collections'].items() if e['state'] == 'captured'}
        health['reason'] = 'source-identity-or-payload-invalid'
        validate_document_sources(raw, result.get('source_identity'))
        if (result.get('source_base') is not None and
                result['source_base'] != 'https://firestore.googleapis.com/v1/' + result['source_identity']['document_root']):
            raise ValueError('Capture base/source identity mismatch')
        health['reason'] = 'business-schema-or-payload-invalid'
        result['business_counts'] = count_business(raw, schema)
        if result.get('decode_failed'):
            health['reason'] = 'clean-decode-failed'
            return False
    except (ValueError, KeyError, TypeError, OSError):
        return False
    try:
        health['reason'] = 'baseline-unavailable-or-invalid'
        import hashlib
        pointer_path = root / 'LATEST_GOOD.json'
        if pointer_path.is_symlink():
            raise ValueError('Unsafe baseline pointer')
        pointer = json.loads(pointer_path.read_text())
        run_id = pointer['run_id']
        if not isinstance(run_id, str) or not re.fullmatch(r'[0-9]{8}T[0-9]{12}Z-[0-9a-f]{32}', run_id):
            raise ValueError('Invalid baseline run ID')
        directory = root / run_id
        if directory.is_symlink() or any(p.is_symlink() for p in directory.rglob('*')):
            raise ValueError('Unsafe baseline directory')
        body = (directory / 'manifest.json').read_bytes()
        if hashlib.sha256(body).hexdigest() != pointer['manifest_sha256']:
            raise ValueError('Baseline manifest anchor mismatch')
        baseline = validate(directory)
        status = json.loads((directory / '_status.json').read_text())
        for value in (pointer, status):
            if (value['run_id'] != run_id or value['state'] != 'complete-in-declared-scope' or
                    value['capture_state'] != 'complete-in-declared-scope' or value['health']['state'] != 'passed' or
                    type(value['synthetic']) is not bool or value['synthetic'] != result['synthetic'] or
                    value['registry'] != result['registry'] or value['business_schema'] != schema or
                    value['source_identity'] != result['source_identity'] or
                    value['business_counts'] != baseline['business_counts'] or
                    value['collections'] != baseline['collections']):
                raise ValueError('Baseline status/scope mismatch')
        if (baseline['run_id'] != run_id or baseline['business_schema'] != schema or
                baseline['source_identity'] != result['source_identity']):
            raise ValueError('Baseline schema/identity mismatch')
        prior = baseline['business_counts']
        if (set(prior) != set(schema['metrics']) or
                any(type(v) is not int or v < 0 for v in prior.values())):
            raise ValueError('Invalid baseline counts')
        prior_raw = {c: json.loads((directory / 'raw' / (c + '.json')).read_text())
                     for c, e in baseline['collections'].items() if e['state'] == 'captured'}
        if count_business(prior_raw, schema) != prior:
            raise ValueError('Baseline counts do not match typed raw')
        health['baseline_run_id'] = pointer['run_id']
        health['reductions'] = [{'metric': key, 'before': prior[key], 'after': count}
                                for key, count in result['business_counts'].items() if count < prior[key]]
        health['reason'] = 'unexplained-business-shrinkage' if health['reductions'] else 'counts-nondecreasing'
        health['state'] = 'hold' if health['reductions'] else 'passed'
    except (ValueError, KeyError, TypeError, OSError, AttributeError):
        pass
    return health['state'] == 'passed'
