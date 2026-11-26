/**
 * Strict Zero-IndexedDB Policy (منع تخزين السجلات والجلسات في IndexedDB بمتصفح Chrome)
 * ------------------------------------------------------------------------------------
 * All business records and user sessions reside strictly in live React memory
 * synchronized with Cloud Databases (Firebase Firestore + Google Sheets).
 * Chrome IndexedDB is never used for storing records or sessions and any legacy DB is deleted on startup.
 */

const LEGACY_DB_NAMES = [
  'al_nashi_persistent_db_v1',
  'al_nashi_cache',
  'al_nashi_db'
];

export async function idbGetJSON<T = any>(_key: string): Promise<T | null> {
  return null;
}

export async function idbSetJSON(_key: string, _value: any): Promise<boolean> {
  return false;
}

/**
 * Actively deletes any legacy application IndexedDB databases from Chrome so zero records/sessions linger.
 */
export async function clearBusinessRecordsFromIDB(): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;
  try {
    for (const dbName of LEGACY_DB_NAMES) {
      try {
        window.indexedDB.deleteDatabase(dbName);
      } catch {}
    }
  } catch {}
}
