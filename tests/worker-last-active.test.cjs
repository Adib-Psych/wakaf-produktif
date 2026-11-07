'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'monitor-v2.html'), 'utf8');
const start = html.indexOf('function renderWorkersTab() {');
const end = html.indexOf('\nfunction copyWorkerUrl(', start);
assert.ok(start >= 0 && end > start, 'extract actual renderWorkersTab');
const source = html.slice(start, end);
const worker = token => ({ token, nama: token === 'NARDI' ? 'Pak Nardi' : token, active: true, color: '#123', icon: '', role: '', tarif_label: '' });
function render(reports, bindings, tokens = ['NARDI', 'CHRISTO']) {
  const grid = { innerHTML: '' };
  const context = {
    document: { getElementById: id => id === 'worker-cards-grid' ? grid : null },
    window: { location: { origin: 'https://example.test', pathname: '/monitor-v2.html' }, ownerWageSnapshot: { wageBindings: bindings } },
    STATE: { laporan: reports }, WORKER_DEFS: tokens.map(worker), formatTglShort: date => date
  };
  vm.runInNewContext(source + '\nrenderWorkersTab();', context);
  return grid.innerHTML.match(/<div style="color:[^"\n]+;font-weight:600;margin-top:2px">([^<]+)<\/div>/g)
    .map(card => card.replace(/^.*">|<\/div>$/g, ''));
}

const bindings = [
  { id: 'w_111111111111111111111111', legacy_token: 'NARDI', name: 'Pak Nardi' },
  { id: 'w_222222222222222222222222', legacy_token: 'CHRISTO', name: 'Christo' }
];
test('legacy September and bound opaque October reports share latest business date and count once', () => {
  const reports = [
    { id: 'sept', pelapor: 'NARDI', tanggal: '2026-09-29', created_at: '2026-11-05T10:00:00Z' },
    { id: 'oct', pelapor: bindings[0].id, tanggal: '2026-10-15', created_at: '2026-10-16T10:00:00Z' },
    { id: 'other', pelapor: 'CHRISTO', tgl: '2026-09-28', created_at: '2026-11-06T10:00:00Z' },
    { id: 'unbound', pelapor: 'w_333333333333333333333333', tanggal: '2026-10-31', name: 'Pak Nardi' }
  ];
  const before = JSON.stringify({ reports, bindings });
  const cards = render(reports, bindings, ['NARDI', 'CHRISTO', 'w_333333333333333333333333']);
  assert.match(cards[0], /^2026-10-15 .* · 2 entries total$/);
  assert.match(cards[1], /^2026-09-28 .* · 1 entries total$/);
  assert.match(cards[2], /^2026-10-31 .* · 1 entries total$/);
  assert.equal(JSON.stringify({ reports, bindings }), before, 'persisted fields and exact binding data stay untouched');
  assert.match(render(reports, bindings, [bindings[0].id])[0], /^2026-10-15 .* · 2 entries total$/, 'opaque card tokens use the same canonical lookup');
});

test('unbound lookalike identities are not normalized or matched by display name', () => {
  const reports = [
    { id: 'legacy', pelapor: 'NARDI', tanggal: '2026-09-29' },
    { id: 'lookalike', pelapor: 'nardi', tanggal: '2026-10-30', name: 'Pak Nardi' },
    { id: 'spaced', pelapor: ' NARDI ', tanggal: '2026-10-31', name: 'Pak Nardi' }
  ];
  const cards = render(reports, bindings, ['NARDI', 'nardi', ' NARDI ']);
  assert.match(cards[0], /^2026-09-29 .* · 1 entries total$/);
  assert.match(cards[1], /^2026-10-30 .* · 1 entries total$/);
  assert.match(cards[2], /^2026-10-31 .* · 1 entries total$/);
});
