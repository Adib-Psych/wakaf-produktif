// NOT DEPLOYED. Demo-project emulator runner; never reads production configuration.
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const path = require('node:path');
const repo = path.resolve(__dirname, '..');
const mode = process.argv[2];
if (!['legacy', 'candidate'].includes(mode)) throw new Error('Expected legacy or candidate');
const scratch = process.env.TMPDIR || path.join(require('node:os').homedir(), '.hermes/cache/scratch');
const dir = mkdtempSync(path.join(scratch, 'rules-emulator-'));
const config = JSON.parse(readFileSync(path.join(repo, 'recovery/firebase.json'), 'utf8'));
config.firestore.rules = path.join(repo, mode === 'legacy' ? 'firestore.rules' : 'recovery/firestore.entry-safe.rules');
writeFileSync(path.join(dir, 'firebase.json'), JSON.stringify(config));
const env = { ...process.env, CI: 'true', FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true', RULES_MODE: mode, RULES_REPO: repo,
  XDG_CONFIG_HOME: dir, GOOGLE_CLOUD_DISABLE_GRPC_GCP_OBSERVABILITY: 'true',
  GCLOUD_PROJECT: 'demo-entry-safe', GOOGLE_CLOUD_PROJECT: 'demo-entry-safe' };
for (const key of Object.keys(env)) if (/credential|token|api.?key|password|secret/i.test(key)) delete env[key];
const command = `${JSON.stringify(process.execPath)} --require ${JSON.stringify(path.join(__dirname, 'rules-network.cjs'))} --test --test-concurrency=1 ${JSON.stringify(path.join(__dirname, 'rules-entry-safe.cjs'))}`;
const result = spawnSync(process.execPath, [path.join(repo, 'recovery/node_modules/firebase-tools/lib/bin/firebase.js'),
  'emulators:exec', '--config', path.join(dir, 'firebase.json'), '--project', 'demo-entry-safe', '--only', 'firestore', command],
  { cwd: dir, env, encoding:'utf8', maxBuffer:16*1024*1024 });
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
const output=(result.stdout || '')+'\n'+(result.stderr || '');
const counts={};
for (const key of ['tests','pass','fail','cancelled','skipped']) {
  const match=output.match(new RegExp('(?:ℹ|#) '+key+' (\\d+)'));
  if (match) counts[key]=Number(match[1]);
}
if (counts.tests > 0) writeFileSync(path.join(__dirname,`rules-results-${mode}.json`),JSON.stringify({
  deployed:false, project: 'demo-entry-safe', host:'127.0.0.1:8688', mode,
  command:mode === 'legacy' ? 'npm run test:rules:red' : 'npm run test:rules',
  emulatorExit:result.status, ...counts
},null,2)+'\n');
// Runtime logs are scratch-only, not tracked evidence or raw production fixtures.
rmSync(dir, { recursive: true, force: true });
process.exit(result.status ?? 1);
