import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, inMemoryPersistence } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  memoryLocalCache,
  doc,
  getDocFromServer,
  Firestore,
  setLogLevel
} from 'firebase/firestore';
import { updateFirebaseHealth, pushCloudSyncAlert } from '../services/cloudSyncAlerts';

// Keep critical error visibility while avoiding noisy debug spam
try {
  setLogLevel('error');
} catch {
  // Ignore
}

/**
 * Authoritative Pinned Firebase Configuration — alaa-office-2026 / (default)
 * --------------------------------------------------------------------------
 * Pinned directly in code as the Single Source of Truth so stale Vercel
 * environment variables from legacy projects can never override the active DB.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyABAAALUEpnLQ8RmPL5GEHZMacX_CRdDmjw',
  authDomain: 'alaa-office-2026.firebaseapp.com',
  projectId: 'alaa-office-2026',
  storageBucket: 'alaa-office-2026.firebasestorage.app',
  messagingSenderId: '1045853891678',
  appId: '1:1045853891678:web:ecbac6c7a99c45145a98cf'
} as const;

export const activeFirebaseConfig = {
  ...firebaseConfig,
  firestoreDatabaseId: '(default)'
} as const;

// Initialize Firebase App singleton directly against alaa-office-2026
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth (strictly in-memory persistence — zero business cache in IndexedDB/localStorage)
export const auth = getAuth(app);
setPersistence(auth, inMemoryPersistence).catch(() => {});
export const googleAuthProvider = new GoogleAuthProvider();

// Target Firestore database: "(default)"
const firestoreSettings = {
  localCache: memoryLocalCache(),
  ignoreUndefinedProperties: true,
  ...(typeof window !== 'undefined' ? { experimentalAutoDetectLongPolling: true } : {})
};

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, firestoreSettings);
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;

// Startup connection probe against Firestore "(default)" — surfaces genuine permission/config errors clearly
export async function testFirestoreConnection(): Promise<{ ok: boolean; error?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, error: 'لا يوجد اتصال بالإنترنت حالياً.' };
  }

  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
    updateFirebaseHealth('connected', null);
    return { ok: true };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    const lower = rawMsg.toLowerCase();

    // Missing test document still confirms live server reachability
    if (lower.includes('not-found') && !lower.includes('database')) {
      updateFirebaseHealth('connected', null);
      return { ok: true };
    }

    // Surface real Firestore database/permission errors clearly in the UI
    if (
      lower.includes('permission-denied') ||
      lower.includes('permission_denied') ||
      lower.includes('missing or insufficient permissions')
    ) {
      const msg = 'تعذر القراءة من Firebase Firestore (alaa-office-2026): صلاحيات قواعد الأمان غير مفعّلة.';
      updateFirebaseHealth('error', msg);
      pushCloudSyncAlert({
        severity: 'error',
        target: 'firebase',
        title: 'خطأ في صلاحيات قاعدة البيانات (Firestore)',
        message: msg,
        details: rawMsg
      });
      return { ok: false, error: msg };
    }

    if (lower.includes('database') && lower.includes('not found')) {
      const msg = 'قاعدة بيانات Firestore (default) غير مهيأة في مشروع alaa-office-2026.';
      updateFirebaseHealth('error', msg);
      pushCloudSyncAlert({
        severity: 'error',
        target: 'firebase',
        title: 'خطأ في الاتصال بقاعدة البيانات',
        message: msg,
        details: rawMsg
      });
      return { ok: false, error: msg };
    }

    if (lower.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (alaa-office-2026).', rawMsg);
    }
    return { ok: false, error: rawMsg };
  }
}

if (typeof window !== 'undefined') {
  testFirestoreConnection();
}
