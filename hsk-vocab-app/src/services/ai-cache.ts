// Browser-side AI response cache (IndexedDB, 7-day TTL).
// Tier 2 in the cache hierarchy: checked after module memory (tier 1) and
// before the server proxy (which itself checks Redis, tier 3).
//
// IndexedDB is used instead of localStorage because:
//   - AI responses can be multi-KB; localStorage is capped at ~5MB and is
//     already used for the SQLite DB.
//   - IndexedDB is async and won't block the UI thread.
//
// Cache key matches the server-side derivation (sha256 of model+temp+max_tokens+messages)
// so a browser hit skips the network entirely.

const DB_NAME = 'hsk-ai-cache';
const STORE = 'responses';
const DB_VERSION = 1;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheRecord {
  key: string;
  body: string;
  stream: boolean;
  createdAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function getCached(key: string): Promise<{ body: string; stream: boolean } | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const rec = req.result as CacheRecord | undefined;
        if (!rec) return resolve(null);
        if (Date.now() - rec.createdAt > TTL_MS) {
          // Expired — delete lazily.
          const delTx = db.transaction(STORE, 'readwrite');
          delTx.objectStore(STORE).delete(key);
          resolve(null);
          return;
        }
        resolve({ body: rec.body, stream: rec.stream });
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setCached(key: string, body: string, stream: boolean): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const rec: CacheRecord = { key, body, stream, createdAt: Date.now() };
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Cache write failure is non-fatal.
  }
}

export async function clearExpired(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const now = Date.now();
        const records = req.result as CacheRecord[];
        for (const rec of records) {
          if (now - rec.createdAt > TTL_MS) store.delete(rec.key);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal.
  }
}
