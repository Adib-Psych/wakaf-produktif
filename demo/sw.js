const CACHE_NAME = 'lapor-ngt-v1';
const ASSETS = [
  'lapor.html',
  'manifest.json',
  '../images/logo-wakaf-produktif-transparan.png',
  // Add more critical assets as built
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
