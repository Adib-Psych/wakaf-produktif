"""Aggregate local logs and scan only staged added lines; no network."""
import json
import pathlib
import re
import subprocess
root = pathlib.Path(__file__).resolve().parents[1]

def parse(name):
    text = (root / 'evidence' / name).read_text()
    counts = {}
    for key in ['tests', 'pass', 'fail', 'skipped']:
        match = re.search(r'ℹ ' + key + r' (\d+)', text)
        assert match is not None, (name, key)
        counts[key] = int(match[1])
    names = [re.sub(r' \([\d.]+ms\)$', '', line[2:]) for line in text.splitlines() if line.startswith('✔ ')]
    return counts, names
base, base_names = parse('baseline-regression.tap')
candidate, candidate_names = parse('regression.tap')
assert base == {'tests':149, 'pass':149, 'fail':0, 'skipped':0}, base
assert candidate == {'tests':163, 'pass':163, 'fail':0, 'skipped':0}, candidate
assert set(base_names) <= set(candidate_names)
diagnostics = [name for name in candidate_names if name.startswith('DEFECT:')]
assert len(diagnostics) == 4
browser = json.loads((root / 'evidence/browser-listener-finance.json').read_text())
assert browser['acceptanceCount'] == 5 and browser['diagnosticCount'] == 1
assert browser['financeCalls'] == {'save':0,'sync':0} and not browser['pageErrors']
diff = subprocess.check_output(['git','-C',str(root),'diff','--cached','--'],text=True)
added = '\n'.join(line[1:] for line in diff.splitlines() if line.startswith('+') and not line.startswith('+++'))
patterns = {
    'literal_secret_assignment': r'(?i)(api_key|secret|password|passwd)\s*=\s*[\'\"][^\'\"]{6,}[\'\"]',
    'shell_injection': r'os\.system\(|shell\s*=\s*True',
    'unsafe_deserialization': r'pickle\.loads?\(',
    'eval_or_exec': r'\beval\(|\bexec\('
}
findings = {name:re.findall(pattern,added) for name,pattern in patterns.items()}
# Evidence stack strings can contain eval at evaluate from browser tooling, not executable eval calls.
result = {'baseline':base,'candidate':candidate,'candidate_nondiagnostic':candidate['pass']-len(diagnostics),
          'unchanged_legacy_diagnostics':diagnostics,'new_test_names':sorted(set(candidate_names)-set(base_names)),
          'browser_acceptance':browser['acceptanceCount'],'browser_diagnostic':browser['diagnosticCount'],
          'static_added_lines_scan':findings,'independent_review':'pending; not approved',
          'limits':'bounded report/startup/reprocess side effects only; not all finance writers or cloud sync'}
(root / 'evidence/verification-summary.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
