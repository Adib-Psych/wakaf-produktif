'use strict';
// Acceptance derived from independent reviewer DOM reproduction; synthetic loopback only.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..'), {chromium} = require(root + '/recovery/node_modules/playwright');
const evidence = process.env.WAKAF_EVIDENCE || root;
const allow = ['monitor-v2.html', 'firebase-config.js', 'recovery/report-content.js', 'recovery/entry-recovery.js'];
let base, browser;
const result = {checks: [], pageErrors: [], blockedRemoteRequests: 0, productionRequests: 0, serviceWorkers: 'block; staff DOM acceptance only'};
const server = http.createServer((req, res) => {
  const f = new URL(req.url, base).pathname.slice(1);
  if (!allow.includes(f)) {res.writeHead(404); return res.end();}
  res.setHeader('Content-Type', f.endsWith('.js') ? 'application/javascript' : 'text/html');
  res.end(fs.readFileSync(root + '/' + f));
});
(async () => {
  try {
    await new Promise(r => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({headless: true, executablePath: '/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox']});
    const ctx = await browser.newContext({serviceWorkers: 'block'});
    await ctx.route('**/*', r => {
      if (new URL(r.request().url()).origin === base) return r.continue();
      if (r.request().url() === 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js') return r.fulfill({contentType: 'application/javascript', body: fs.readFileSync(root + '/recovery/node_modules/chart.js/dist/chart.umd.js')});
      result.blockedRemoteRequests++; return r.abort();
    });
    const p = await ctx.newPage(); p.on('pageerror', e => result.pageErrors.push(e.message));
    await p.goto(base + '/monitor-v2.html', {waitUntil: 'domcontentloaded'}); await p.waitForSelector('#entry-recovery-banner');
    const throwCases = process.env.UUID_THROW_AT ? [Number(process.env.UUID_THROW_AT)] : [1, 2];
    for (const throwAt of throwCases) {
      const observation = await p.evaluate(throwAt => {
        STATE.pelapor = 'WAKIF'; STATE.bidang = '1'; STATE.bidang_list = ['1'];
        document.getElementById('f-tgl').value = '2000-01-02';
        document.getElementById('f-kategori').value = document.getElementById('f-kategori').options[1].value;
        document.getElementById('f-catatan').value = 'synthetic preserved form';
        const key = 'wkkn_recovery_staff_pending_v1';
        localStorage.setItem(key, JSON.stringify([{id: 'synthetic-pending', created_at: '2000-01-01', detail: 'existing pending'}]));
        const calls = {alerts: [], sends: 0, enqueue: 0, drain: 0, resets: 0, writes: 0};
        window.alert = s => calls.alerts.push(s); window.confirm = () => true;
        window.syncLaporanEntryToFirestore = async () => {calls.sends++; throw Error('unexpected send');};
        window.collectExtraKategori = () => ['synthetic-extra'];
        let n = 0; Object.defineProperty(crypto, 'randomUUID', {configurable: true, value: () => {
          n++; if (n === throwAt) throw Error('synthetic UUID failure ' + throwAt);
          return '11111111-1111-4111-8111-111111111111';
        }});
        const queue = window.entryRecovery, reset = window.resetForm, setItem = Storage.prototype.setItem;
        window.entryRecovery = {...queue,
          enqueue: entries => {calls.enqueue++; return queue.enqueue(entries);},
          drain: () => {calls.drain++; return queue.drain();}
        };
        window.resetForm = (...args) => {calls.resets++; return reset(...args);};
        Storage.prototype.setItem = function (...args) {calls.writes++; return setItem.apply(this, args);};
        const snapshot = () => ({pending: localStorage.getItem(key), cache: localStorage.getItem('wkkn_v2_laporan'), state: JSON.stringify(STATE), form: JSON.stringify([...document.querySelectorAll('#panel-form input,#panel-form select,#panel-form textarea')].map(e => ({id: e.id, value: e.value, checked: e.checked}))) });
        const before = snapshot();
        try {
          const button = [...document.querySelectorAll('button[onclick]')].find(x => x.getAttribute('onclick').trim() === 'submitForm()');
          if (!button) throw Error('submit button absent'); button.click();
          return {throwAt, before, after: snapshot(), ...calls, uuidCalls: n};
        } finally {window.entryRecovery = queue; window.resetForm = reset; Storage.prototype.setItem = setItem;}
      }, throwAt);
      await p.waitForTimeout(50); // Flush uncaught DOM error events before asserting pageErrors.
      assert.deepEqual(observation.after, observation.before);
      for (const field of ['sends', 'enqueue', 'drain', 'resets', 'writes']) assert.equal(observation[field], 0, field);
      assert.equal(observation.uuidCalls, throwAt, 'no fallback or identity retry');
      assert.deepEqual(result.pageErrors, []);
      assert.equal(observation.alerts.length, 1);
      assert.match(observation.alerts[0], /laporan belum disimpan; form tetap tersedia/);
      result.checks.push({id: 'UUID-throw-' + (throwAt === 1 ? 'primary' : 'extra'), pass: true, preservedPendingFormSTATE: true, zeroEnqueueResetTransportWrites: true, uuidCalls: observation.uuidCalls, alerts: observation.alerts});
    }
    assert.deepEqual(result.pageErrors, []);
  } finally {
    fs.mkdirSync(evidence, {recursive: true});
    fs.writeFileSync(path.join(evidence, 'browser-staff-uuid-failure-results.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
    if (browser) await browser.close(); await new Promise(r => server.close(r));
  }
})().catch(e => {console.error(e); process.exitCode = 1;});
