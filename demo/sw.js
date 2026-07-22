const CACHE_NAME = 'lapor-ngt-v4';  // v3 19 Jul 2026: tarif pemanen 50/100 (SOP P2: bump tiap deploy sentuh PWA)
const ASSETS = [
  // Paths resolved relative to sw.js location (/demo/)
  '../lapor.html',                                     // PRODUCTION lapor.html at root (FIX 16 Mei 2026)
  'manifest.json',                                     // /demo/manifest.json (exists)
  '../images/logo-wakaf-produktif-2x1-bg.png',         // new 2:1 BG logo (16 Mei 2026)
  '../images/logo-wakaf-produktif-transparan.png',     // fallback favicon
  '../firebase-config.js',                             // Firestore config
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Cache-first for assets, network-first for Firestore API
  if (e.request.url.includes('firestore.googleapis.com') || e.request.url.includes('open-meteo.com')) {
    // Network-first for API calls
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
