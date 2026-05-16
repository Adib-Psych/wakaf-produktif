# Worker PWA — Wakaf Produktif Kebun Kopi Ngantang

**Status:** Phase 0 Infrastructure scaffolding (16 Mei 2026)

## Files
- `lapor-demo.html` — Current demo form (existing, Phase 0)
- `lapor.html` — Production worker form (TODO Phase 1)
- `manifest.json` — PWA manifest (installable to home screen)
- `sw.js` — Service Worker (offline cache + queue sync)
- `offline-queue.js` — IndexedDB queue helper
- `firebase-config.example.js` — Firebase config placeholder (rename + fill)

## Setup
1. Create Firebase project (see firebase-config.example.js)
2. Copy firebase-config.example.js → firebase-config.js + fill keys
3. Configure security rules (firestore.rules dan storage.rules TBD)
4. Generate token URLs per worker (TBD Phase 1B at monitor-v2 dashboard)

## PWA Install on HP
- Open URL di Chrome / Safari mobile
- Menu → "Add to Home Screen"
- Icon "Lapor NGT" muncul di home screen
- Tap icon → app full-screen (no browser bar)

## Offline Support
- Service Worker cache critical assets (HTML, CSS, JS, logo, fonts)
- Submissions saat offline → queue di IndexedDB
- Auto-sync saat signal balik (navigator.onLine listener)

## Phase Plan
- **Phase 0 (current):** Infrastructure scaffolding (manifest, sw, queue helpers, Firebase config template)
- **Phase 1 (post final SOP):** Build production lapor.html dengan SOP content from final synthesis
- **Phase 1B:** Wakif side sync (Firestore listener di monitor-v2, Manage Worker URLs tab)
- **Phase 1C:** SOP master mirror to Firestore

## Architecture Reference
Lihat `/Digital Platform/Worker_PWA_Design_Spec_16Mei2026.md` untuk full spec.
