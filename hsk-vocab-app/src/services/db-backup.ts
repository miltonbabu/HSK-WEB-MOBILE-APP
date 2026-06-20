// Database backup service — stores SQLite snapshots in IndexedDB.
// Protects against localStorage corruption (which is the primary persistence
// layer for the sql.js DB). Keeps the last 7 daily snapshots.
//
// Backups are created automatically once per 24h on app load, and can be
// triggered manually from Settings.

import { getDatabase } from './database';

const DB_NAME = 'hsk-db-backups';
const STORE = 'snapshots';
const DB_VERSION = 1;
const MAX_BACKUPS = 7;
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const LAST_BACKUP_KEY = 'hsk-last-backup';

export interface BackupMetadata {
  timestamp: number;
  size: number;
  tableCount: number;
}

interface BackupRecord extends BackupMetadata {
  data: string; // base64-encoded SQLite binary
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
        db.createObjectStore(STORE, { keyPath: 'timestamp' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]);
  return btoa(binary);
}

export async function createBackup(): Promise<BackupMetadata | null> {
  const db = getDatabase();
  if (!db) return null;
  try {
    const binary: Uint8Array = db.export();
    const base64 = arrayBufferToBase64(binary);
    const timestamp = Date.now();

    // Count tables for metadata.
    let tableCount = 0;
    try {
      const result = db.exec("SELECT count(*) as c FROM sqlite_master WHERE type='table'");
      tableCount = result[0]?.values?.[0]?.[0] as number || 0;
    } catch {
      // Non-fatal.
    }

    const record: BackupRecord = {
      timestamp,
      size: binary.length,
      tableCount,
      data: base64,
    };

    const idb = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Rotate: keep only the last MAX_BACKUPS.
    await rotateBackups();

    localStorage.setItem(LAST_BACKUP_KEY, String(timestamp));
    return { timestamp, size: binary.length, tableCount };
  } catch (err) {
    console.error('[db-backup] createBackup failed:', err);
    return null;
  }
}

async function rotateBackups(): Promise<void> {
  try {
    const idb = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result as BackupRecord[]).sort((a, b) => b.timestamp - a.timestamp);
        for (const old of records.slice(MAX_BACKUPS)) {
          store.delete(old.timestamp);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-fatal.
  }
}

export async function listBackups(): Promise<BackupMetadata[]> {
  try {
    const idb = await openDb();
    return await new Promise<BackupMetadata[]>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const records = req.result as BackupRecord[];
        const metas = records
          .map((r) => ({ timestamp: r.timestamp, size: r.size, tableCount: r.tableCount }))
          .sort((a, b) => b.timestamp - a.timestamp);
        resolve(metas);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function restoreBackup(timestamp: number): Promise<boolean> {
  try {
    const idb = await openDb();
    const base64 = await new Promise<string | null>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(timestamp);
      req.onsuccess = () => {
        const rec = req.result as BackupRecord | undefined;
        resolve(rec ? rec.data : null);
      };
      req.onerror = () => reject(req.error);
    });
    if (!base64) return false;

    // Write the restored binary back to localStorage so the next initDatabase()
    // call picks it up. The caller should reload the page after this.
    localStorage.setItem('hsk-sqlite-db', base64);
    return true;
  } catch (err) {
    console.error('[db-backup] restoreBackup failed:', err);
    return false;
  }
}

export async function maybeAutoBackup(): Promise<void> {
  const last = localStorage.getItem(LAST_BACKUP_KEY);
  const lastTs = last ? parseInt(last, 10) : 0;
  if (Date.now() - lastTs < BACKUP_INTERVAL_MS) return;
  await createBackup();
}

export function getLastBackupTime(): number {
  const last = localStorage.getItem(LAST_BACKUP_KEY);
  return last ? parseInt(last, 10) : 0;
}
