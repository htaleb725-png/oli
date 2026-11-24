import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer, Firestore, setLogLevel } from 'firebase/firestore';
import localFirebaseConfig from '../../firebase-applet-config.json';
import { inspectCloudEnvironment, isPlaceholderOrInvalidValue } from '../utils/cloudEnvDiagnostics';
import { updateFirebaseHealth, pushCloudSyncAlert } from '../services/cloudSyncAlerts';

// Keep critical error visibility while avoiding noisy debug spam
try {
  setLogLevel('error');
} catch {
  // Ignore
}

// Default production Firebase config for ola-aap-5fa57 (used only if VITE_FIREBASE_* env vars are absent)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB3yeS0tmdvi9-hhB0QixqUhKUW_eCyLMA',
  authDomain: 'ola-aap-5fa57.firebaseapp.com',
  projectId: 'ola-aap-5fa57',
  storageBucket: 'ola-aap-5fa57.firebasestorage.app',
  messagingSenderId: '364353645300',
  appId: '1:364353645300:web:230b3299331d7271accca1',
  measurementId: 'G-56LXF989SM',
  firestoreDatabaseId: '(default)'
} as const;

// Helper to strip accidental quotes pasted into Vercel environment variables
const cleanEnv = (val?: string) => (val || '').replace(/^["']|["']$/g, '').trim();

const resolveEnvOrFallback = (
  envVal: string | undefined,
  localJsonVal: string | undefined,
  defaultVal: string
): string => {
  const cleanedEnv = cleanEnv(envVal);
  if (cleanedEnv && !isPlaceholderOrInvalidValue(cleanedEnv)) {
    return cleanedEnv;
  }
  const cleanedLocal = cleanEnv(localJsonVal);
  if (cleanedLocal && !isPlaceholderOrInvalidValue(cleanedLocal)) {
    return cleanedLocal;
  }
  return defaultVal;
};

// 1. Universal Environment Variable Resolution for Vercel, GitHub, and Local/AI Studio
// Strictly prioritizes Vercel VITE_FIREBASE_* env vars, then falls back to firebase-applet-config.json / DEFAULT_FIREBASE_CONFIG
export const activeFirebaseConfig = {
  apiKey: resolveEnvOrFallback(
    import.meta.env.VITE_FIREBASE_API_KEY,
    (localFirebaseConfig as any).apiKey,
    DEFAULT_FIREBASE_CONFIG.apiKey
  ),
  authDomain: resolveEnvOrFallback(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    (localFirebaseConfig as any).authDomain,
    DEFAULT_FIREBASE_CONFIG.authDomain
  ),
  projectId: resolveEnvOrFallback(
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    (localFirebaseConfig as any).projectId,
    DEFAULT_FIREBASE_CONFIG.projectId
  ),
  storageBucket: resolveEnvOrFallback(
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    (localFirebaseConfig as any).storageBucket,
    DEFAULT_FIREBASE_CONFIG.storageBucket
  ),
  messagingSenderId: resolveEnvOrFallback(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    (localFirebaseConfig as any).messagingSenderId,
    DEFAULT_FIREBASE_CONFIG.messagingSenderId
  ),
  appId: resolveEnvOrFallback(
    import.meta.env.VITE_FIREBASE_APP_ID,
    (localFirebaseConfig as any).appId,
    DEFAULT_FIREBASE_CONFIG.appId
  ),
  measurementId: resolveEnvOrFallback(
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    (localFirebaseConfig as any).measurementId,
    DEFAULT_FIREBASE_CONFIG.measurementId
  ),
  firestoreDatabaseId:
    resolveEnvOrFallback(
      import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
      (localFirebaseConfig as any).firestoreDatabaseId,
      DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId
    ) || '(default)'
};

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(activeFirebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Target Firestore database ID — omit custom DB arg when targeting "(default)"
const rawDbId = cleanEnv(activeFirebaseConfig.firestoreDatabaseId) || '(default)';
const customNamedDbId = rawDbId !== '(default)' ? rawDbId : undefined;
const firestoreSettings = {
  ignoreUndefinedProperties: true,
  ...(typeof window !== 'undefined' ? { experimentalAutoDetectLongPolling: true } : {})
};

let firestoreInstance: Firestore;
try {
  firestoreInstance = customNamedDbId
    ? initializeFirestore(app, firestoreSettings, customNamedDbId)
    : initializeFirestore(app, firestoreSettings);
} catch {
  firestoreInstance = customNamedDbId ? getFirestore(app, customNamedDbId) : getFirestore(app);
}

export const db = firestoreInstance;

// Startup connection validation — surfaces real config/offline/permission errors in UI
export async function testFirestoreConnection(): Promise<{ ok: boolean; error?: string }> {
  const envCheck = inspectCloudEnvironment();
  if (!envCheck.firebaseReady) {
    const errMsg = `متغيرات بيئة Firebase غير مكتملة (${envCheck.missingRequiredKeys.filter(k => k.startsWith('VITE_FIREBASE')).join(', ')})`;
    updateFirebaseHealth('error', errMsg);
    pushCloudSyncAlert({
      severity: 'error',
      target: 'env',
      title: 'نقص في متغيرات بيئة Firebase (Vercel)',
      message: errMsg,
      details: 'يرجى ضبط متغيرات VITE_FIREBASE_* في إعدادات Vercel ثم تنفيذ Redeploy.'
    });
    return { ok: false, error: errMsg };
  }

  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      new Promise((_, reject) => setTimeout(() => reject(new Error('the client is offline')), 10000))
    ]);
    updateFirebaseHealth('connected', null);
    return { ok: true };
  } catch (error) {
    const rawMsg = error instanceof Error ? error.message : String(error);
    // A missing document (not-found) still confirms live server reachability!
    if (rawMsg.includes('not-found') || rawMsg.includes('No document to update')) {
      updateFirebaseHealth('connected', null);
      return { ok: true };
    }
    if (rawMsg.includes('permission-denied') || rawMsg.includes('Missing or insufficient permissions')) {
      const msg = 'تم رفض الاتصال بقاعدة بيانات Firebase بسبب قواعد الأمان (PERMISSION_DENIED). يرجى التحقق من قواعد Firestore Rules لمشروع ola-aap-5fa57.';
      updateFirebaseHealth('error', msg);
      pushCloudSyncAlert({
        severity: 'error',
        target: 'firebase',
        title: 'خطأ في صلاحيات Firebase Firestore',
        message: msg,
        details: rawMsg
      });
      return { ok: false, error: msg };
    }
    if (rawMsg.includes('the client is offline') || rawMsg.includes('backend') || rawMsg.includes('unavailable')) {
      const msg = 'تعذر الوصول إلى خادم Firebase Firestore حالياً (تحقق من الاتصال أو من تفعيل قاعدة (default) في مشروع ola-aap-5fa57).';
      updateFirebaseHealth('error', msg);
      pushCloudSyncAlert({
        severity: 'warning',
        target: 'firebase',
        title: 'تعثر الاتصال بـ Firebase Firestore',
        message: msg,
        details: `Project: ${activeFirebaseConfig.projectId} | Database ID: ${rawDbId} | ${rawMsg}`
      });
      return { ok: false, error: msg };
    }
    updateFirebaseHealth('error', rawMsg);
    return { ok: false, error: rawMsg };
  }
}

if (typeof window !== 'undefined') {
  testFirestoreConnection();
}
