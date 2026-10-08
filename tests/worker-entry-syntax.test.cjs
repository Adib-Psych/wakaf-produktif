// Offline syntax validation only; does not execute scripts or contact the network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
for (const name of ['lapor.html', 'lapor-cabut.html', 'monitor-v2.html']) {
  const html = fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8');
  let index = 0;
  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!match[2].trim()) continue;
    index++;
    const type = match[1].includes('module') ? 'module' : 'commonjs';
    test(`offline syntax: ${name} inline script ${index} (${type})`, () => {
      const result = spawnSync(process.execPath, ['--check', '--input-type=' + type], { input: match[2], encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || String(result.error || 'syntax check failed'));
    });
  }
}
