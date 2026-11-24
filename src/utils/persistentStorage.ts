/**
 * IndexedDB Storage Guard (سياسة منع التخزين الصامت للسجلات في متصفح Chrome)
 * --------------------------------------------------------------------------
 * Business records (citizens, requests, users, dropdowns, custom sections/records)
 * MUST live exclusively in Cloud Databases (Firebase Firestore + Google Sheets),
 * NEVER silently cached in Chrome IndexedDB.
 */

import { isBusinessRecordStorageKey } from './safeStorage';

const DB_NAME = 'al_nashi_persistent_db_v1';
const STORE_NAME = 'kv_store';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });
  return dbPromise;
}

export async function idbGetJSON<T = any>(key: string): Promise<T | null> {
  if (isBusinessRecordStorageKey(key)) {
    return null;
  }
  try {
    const db = await openDB();
    if (!db) return null;
    return await new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? (req.result as T) : null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function idbSetJSON(key: string, value: any): Promise<boolean> {
  if (isBusinessRecordStorageKey(key)) {
    return false;
  }
  try {
    const db = await openDB();
    if (!db) return false;
    return await new Promise<boolean>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Removes any legacy business records previously saved in IndexedDB kv_store.
 */
export async function clearBusinessRecordsFromIDB(): Promise<void> {
  try {
    const db = await openDB();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const keysReq = store.getAllKeys();
        keysReq.onsuccess = () => {
          const keys = keysReq.result || [];
          for (const k of keys) {
            if (isBusinessRecordStorageKey(String(k))) {
              try {
                store.delete(k);
              } catch {}
            }
          }
          resolve();
        };
        keysReq.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {}
}
