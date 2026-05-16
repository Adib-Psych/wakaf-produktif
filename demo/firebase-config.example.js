// Firebase config — fill these AFTER creating Firebase project
// See: https://console.firebase.google.com → Project Settings → Web App

export const FIREBASE_CONFIG = {
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "wakaf-ngt.firebaseapp.com",
  projectId: "wakaf-ngt",
  storageBucket: "wakaf-ngt.appspot.com",
  messagingSenderId: "REPLACE_WITH_SENDER_ID",
  appId: "REPLACE_WITH_APP_ID"
};

// Setup steps:
// 1. Buka https://console.firebase.google.com
// 2. Create Project "wakaf-ngt" (free tier Spark plan cukup)
// 3. Add Web App → copy config object
// 4. Enable Firestore Database → Production mode → asia-southeast1 (Singapore, closest to ID)
// 5. Enable Storage → asia-southeast1
// 6. Configure security rules (lihat firestore.rules + storage.rules)
// 7. Copy config ke file ini, rename ke firebase-config.js (no .example)
// 8. .gitignore harus include firebase-config.js (jaga API key)

// Firestore collections yang akan dipakai:
// - workers/        : { id, name, code (KUMPUL/YIT/ANTO), token, last_active, role }
// - laporan/        : entries dari workers (mirror STATE.laporan schema)
// - sop_master/     : SOP_AKTIVITAS_PER_BULAN mirror (Phase 1C)
// - notifications/  : alerts Wakif → workers (Phase 1B)
// - glossary/       : bahasa_petani ⇄ istilah_ilmiah (linked to Glossary feature)
