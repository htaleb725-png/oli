import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getFirestore, memoryLocalCache, doc, getDocFromServer, Firestore, setLogLevel } from 'firebase/firestore';
import localFirebaseConfig from '../../firebase-applet-config.json';
import { inspectCloudEnvironment, isPlaceholderOrInvalidValue } from '../utils/cloudEnvDiagnostics';
import { updateFirebaseHealth } from '../services/cloudSyncAlerts';

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
  localCache: memoryLocalCache(),
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

// Silent startup connection probe — confirms reachability without displaying any UI alerts.
export async function testFirestoreConnection(): Promise<{ ok: boolean; error?: string }> {
  const envCheck = inspectCloudEnvironment();
  if (!envCheck.firebaseReady) {
    return { ok: false };
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
    if (rawMsg.includes('not-found') || rawMsg.includes('No document to update')) {
      updateFirebaseHealth('connected', null);
      return { ok: true };
    }
    updateFirebaseHealth('connected', null);
    return { ok: false, error: rawMsg };
  }
}

if (typeof window !== 'undefined') {
  testFirestoreConnection();
}
