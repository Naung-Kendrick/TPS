// offlineCache.js — IndexedDB-backed read cache for offline support
const DB_NAME = 'tps_offline_cache';
const DB_VERSION = 1;
const STORE = 'cache';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

export async function cacheSet(key, data) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ key, data, ts: Date.now() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (_) {}
}

export async function cacheGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => {
        const entry = req.result;
        if (!entry) return resolve(null);
        if (Date.now() - entry.ts > TTL_MS) return resolve(null); // expired
        resolve(entry.data);
      };
      req.onerror = () => resolve(null);
    });
  } catch (_) { return null; }
}

export async function cacheClear(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      key ? tx.objectStore(STORE).delete(key) : tx.objectStore(STORE).clear();
      tx.oncomplete = resolve;
    });
  } catch (_) {}
}
