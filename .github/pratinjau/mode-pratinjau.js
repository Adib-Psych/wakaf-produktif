/* Mode pratinjau (ADR-053). Disuntikkan oleh rakit.py ke setiap halaman di pratinjau/pr-N/.
   Tujuan: halaman pratinjau membaca data live, tetapi TIDAK BISA menulis apa pun dan TIDAK
   berbagi penyimpanan peramban dengan versi live (origin GitHub Pages-nya sama).
   1. localStorage/sessionStorage, IndexedDB, CacheStorage diberi awalan "pratinjau-prN:".
      Akibatnya login Firebase, cache Firestore, antrean offline, dan token yang tersimpan di
      versi live tidak terlihat dan tidak tersentuh dari pratinjau.
   2. Semua permintaan jaringan selain GET/HEAD/OPTIONS ditolak, kecuali POST baca Firestore
      (runQuery, runAggregationQuery, batchGet, Listen) dan login Google.
   3. Service worker tidak didaftarkan; sendBeacon dan kirim form POST ditolak.
   Jangan menulis urutan karakter penutup tag script di berkas ini. */
(function () {
  'use strict';
  var P = window.__PRATINJAU__ || { pr: '?', sha: '?' };
  var NS = 'pratinjau-pr' + P.pr + ':';
  var diblokir = 0;

  function tandai(metode, url) {
    diblokir++;
    try { console.warn('[pratinjau] diblokir: ' + metode + ' ' + url); } catch (e) {}
    var n = document.getElementById('pratinjau-hitung');
    if (n) n.textContent = ' · ' + diblokir + ' penulisan diblokir';
  }
  function definisi(obj, nama, nilai) {
    try { Object.defineProperty(obj, nama, { configurable: true, enumerable: true, get: function () { return nilai; } }); }
    catch (e) { try { console.warn('[pratinjau] gagal membungkus ' + nama); } catch (e2) {} }
  }

  /* 1a. Web Storage berawalan */
  function bungkusStorage(asli) {
    function kunci() {
      var out = [];
      for (var i = 0; i < asli.length; i++) { var k = asli.key(i); if (k && k.indexOf(NS) === 0) out.push(k.slice(NS.length)); }
      return out;
    }
    var api = {
      getItem: function (k) { return asli.getItem(NS + k); },
      setItem: function (k, v) { asli.setItem(NS + k, String(v)); },
      removeItem: function (k) { asli.removeItem(NS + k); },
      clear: function () { kunci().forEach(function (k) { asli.removeItem(NS + k); }); },
      key: function (i) { var ks = kunci(); return i >= 0 && i < ks.length ? ks[i] : null; }
    };
    return new Proxy(api, {
      get: function (t, p) {
        if (p === 'length') return kunci().length;
        if (Object.prototype.hasOwnProperty.call(t, p)) return t[p];
        if (typeof p !== 'string') return undefined;
        var v = asli.getItem(NS + p); return v === null ? undefined : v;
      },
      set: function (t, p, v) { if (typeof p === 'string') asli.setItem(NS + p, String(v)); return true; },
      deleteProperty: function (t, p) { if (typeof p === 'string') asli.removeItem(NS + p); return true; },
      has: function (t, p) { return Object.prototype.hasOwnProperty.call(t, p) || (typeof p === 'string' && asli.getItem(NS + p) !== null); },
      ownKeys: function () { return kunci(); },
      getOwnPropertyDescriptor: function (t, p) {
        if (typeof p !== 'string') return undefined;
        var v = asli.getItem(NS + p);
        return v === null ? undefined : { value: v, writable: true, enumerable: true, configurable: true };
      }
    });
  }
  ['localStorage', 'sessionStorage'].forEach(function (nama) {
    var asli = null;
    try { asli = window[nama]; } catch (e) { asli = null; }
    if (asli) definisi(window, nama, bungkusStorage(asli));
  });

  /* 1b. IndexedDB berawalan (login Firebase, cache Firestore, antrean offline) */
  try {
    var idb = window.indexedDB;
    if (idb) {
      var pabrik = {
        open: function (n, v) { return v === undefined ? idb.open(NS + n) : idb.open(NS + n, v); },
        deleteDatabase: function (n) { return idb.deleteDatabase(NS + n); },
        cmp: function (a, b) { return idb.cmp(a, b); },
        databases: function () {
          if (!idb.databases) return Promise.resolve([]);
          return idb.databases().then(function (l) {
            return l.filter(function (d) { return d.name && d.name.indexOf(NS) === 0; })
              .map(function (d) { return { name: d.name.slice(NS.length), version: d.version }; });
          });
        }
      };
      if (window.IDBFactory) Object.setPrototypeOf(pabrik, window.IDBFactory.prototype);
      definisi(window, 'indexedDB', pabrik);
    }
  } catch (e) {}

  /* 1c. CacheStorage berawalan */
  try {
    var cs = window.caches;
    if (cs) {
      var milik = function () { return cs.keys().then(function (ks) { return ks.filter(function (k) { return k.indexOf(NS) === 0; }); }); };
      var cache = {
        open: function (n) { return cs.open(NS + n); },
        has: function (n) { return cs.has(NS + n); },
        'delete': function (n) { return cs['delete'](NS + n); },
        keys: function () { return milik().then(function (ks) { return ks.map(function (k) { return k.slice(NS.length); }); }); },
        match: function (req, opt) {
          if (opt && opt.cacheName) return cs.open(NS + opt.cacheName).then(function (c) { return c.match(req, opt); });
          return milik().then(function (ks) {
            return ks.reduce(function (p, k) { return p.then(function (hit) { return hit || cs.open(k).then(function (c) { return c.match(req, opt); }); }); }, Promise.resolve(undefined));
          });
        }
      };
      definisi(window, 'caches', cache);
    }
  } catch (e) {}

  /* 2. Jaringan: hanya baca */
  var POST_BACA = [/firestore\.googleapis\.com\/.*:(runQuery|runAggregationQuery|batchGet)\b/,
                   /firestore\.googleapis\.com\/google\.firestore\.v1\.Firestore\/Listen\/channel/,
                   /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//];
  function boleh(metode, url) {
    var m = String(metode || 'GET').toUpperCase();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return true;
    var u; try { u = new URL(url, location.href).href; } catch (e) { u = String(url); }
    for (var i = 0; i < POST_BACA.length; i++) if (POST_BACA[i].test(u)) return m === 'POST';
    return false;
  }
  var fetchAsli = window.fetch;
  if (fetchAsli) {
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || String(input);
      var metode = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
      if (!boleh(metode, url)) {
        tandai(metode, url);
        return Promise.reject(new TypeError('Mode pratinjau: penulisan diblokir (' + String(metode).toUpperCase() + ')'));
      }
      return fetchAsli.apply(this, arguments);
    };
  }
  var X = window.XMLHttpRequest;
  if (X) {
    var bukaAsli = X.prototype.open, kirimAsli = X.prototype.send;
    X.prototype.open = function (metode, url) { this.__pratinjau = [metode, url]; return bukaAsli.apply(this, arguments); };
    X.prototype.send = function () {
      var info = this.__pratinjau || ['GET', ''];
      if (!boleh(info[0], info[1])) {
        tandai(info[0], info[1]);
        var x = this;
        setTimeout(function () { try { x.dispatchEvent(new Event('error')); x.dispatchEvent(new Event('loadend')); } catch (e) {} }, 0);
        return;
      }
      return kirimAsli.apply(this, arguments);
    };
  }
  if (navigator.sendBeacon) {
    try { Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: function (url) { tandai('BEACON', url); return false; } }); } catch (e) {}
  }

  /* 3. Service worker dan form POST */
  if (navigator.serviceWorker) {
    try {
      Object.defineProperty(navigator.serviceWorker, 'register', { configurable: true, value: function () {
        return Promise.reject(new Error('Mode pratinjau: service worker tidak didaftarkan'));
      } });
    } catch (e) {}
  }
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && String(f.method || 'get').toLowerCase() === 'post') { e.preventDefault(); tandai('FORM', f.action || location.href); }
  }, true);

  /* Penanda di judul tab dan pita bila halaman menghapusnya */
  function pastikanPita() {
    if (document.title.indexOf('[PRATINJAU]') !== 0) document.title = '[PRATINJAU] ' + document.title;
    if (!document.getElementById('pratinjau-pita') && document.body) {
      var d = document.createElement('div');
      d.id = 'pratinjau-pita';
      d.setAttribute('style', 'position:fixed;left:8px;bottom:8px;z-index:2147483647;max-width:92vw;background:#FAEEDA;color:#633806;border:1px solid #BA7517;border-radius:8px;padding:6px 10px;font:12px/1.4 system-ui,sans-serif');
      d.textContent = 'PRATINJAU PR #' + P.pr + ' · revisi ' + P.sha + ' · data live hanya-baca';
      var s = document.createElement('span'); s.id = 'pratinjau-hitung'; d.appendChild(s);
      document.body.appendChild(d);
    }
  }
  document.addEventListener('DOMContentLoaded', pastikanPita);
  window.addEventListener('load', pastikanPita);
  window.__PRATINJAU_STATUS__ = function () { return { pr: P.pr, ns: NS, diblokir: diblokir }; };
})();
