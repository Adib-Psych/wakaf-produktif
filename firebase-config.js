// Firebase configuration — Wakaf Ngantang Production
// Created 16 Mei 2026 via Firebase Console
// Project: wakaf-ngantang · Region: asia-southeast2 (Jakarta)
// Plan: Spark (free tier) · Test mode rules expire 2026-06-15
//
// SECURITY NOTE: API key di-expose by design (Firebase client-side pattern).
// Real security via Firestore Rules + (later) App Check.

export const firebaseConfig = {
  apiKey: "AIzaSyARd7KlzNLaRumTtdqR0j-jOnt6aZHyFKA",
  authDomain: "wakaf-ngantang.firebaseapp.com",
  projectId: "wakaf-ngantang",
  storageBucket: "wakaf-ngantang.firebasestorage.app",
  messagingSenderId: "137839409790",
  appId: "1:137839409790:web:e9a08901a13c320eca762f"
};

// Firestore collection paths
export const COLLECTIONS = {
  laporan: 'laporan',       // Worker submissions (primary collection)
  workers: 'workers',       // Worker activity log (last_active timestamps)
  audit_log: 'audit_log',   // Change tracking for transparency
};
