// Offline submission queue using IndexedDB
const DB_NAME = 'lapor_ngt_db';
const STORE = 'pending_submissions';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        os.createIndex('status', 'status');
        os.createIndex('submitted_at', 'submitted_at');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function queueSubmission(data) {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const entry = {
    data,
    status: 'pending',
    submitted_at: new Date().toISOString(),
    retry_count: 0,
    last_attempt: null
  };
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE).add(entry);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getPending() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE)
      .index('status').getAll('pending');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function markSynced(id) {
  const db = await openDB();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const entry = getReq.result;
      if (entry) {
        entry.status = 'synced';
        entry.synced_at = new Date().toISOString();
        const putReq = store.put(entry);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      } else { resolve(); }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

async function pendingCount() {
  const pending = await getPending();
  return pending.length;
}

// Auto-sync when online
window.addEventListener('online', async () => {
  console.log('[OfflineQueue] Online detected — flushing queue');
  const pending = await getPending();
  for (const item of pending) {
    try {
      // POST to backend (Firestore) — implementation comes later
      // await postToFirestore(item.data);
      // For now, just mark synced as placeholder
      console.log('[OfflineQueue] Would sync:', item);
      // await markSynced(item.id);
    } catch (e) {
      console.error('[OfflineQueue] Sync failed for', item.id, e);
    }
  }
});

export { queueSubmission, getPending, markSynced, pendingCount };
