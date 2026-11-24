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

// Helper to strip accidental quotes pasted into Vercel environment variables
const cleanEnv = (val?: string) => (val || '').replace(/^["']|["']$/g, '').trim();

const resolveEnvOrFallback = (envVal: string | undefined, fallbackVal: string | undefined): string => {
  const cleanedEnv = cleanEnv(envVal);
  if (cleanedEnv && !isPlaceholderOrInvalidValue(cleanedEnv)) {
    return cleanedEnv;
  }
  return cleanEnv(fallbackVal);
};

// 1. Universal Environment Variable Resolution for Vercel, GitHub, and AI Studio
// Prioritizes Vercel VITE_FIREBASE_* environment variables with safe fallback to firebase-applet-config.json
export const activeFirebaseConfig = {
  apiKey: resolveEnvOrFallback(import.meta.env.VITE_FIREBASE_API_KEY, (localFirebaseConfig as any).apiKey),
  authDomain: resolveEnvOrFallback(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, (localFirebaseConfig as any).authDomain),
  projectId: resolveEnvOrFallback(import.meta.env.VITE_FIREBASE_PROJECT_ID, (localFirebaseConfig as any).projectId),
  storageBucket: resolveEnvOrFallback(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, (localFirebaseConfig as any).storageBucket),
  messagingSenderId: resolveEnvOrFallback(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, (localFirebaseConfig as any).messagingSenderId),
  appId: resolveEnvOrFallback(import.meta.env.VITE_FIREBASE_APP_ID, (localFirebaseConfig as any).appId),
  firestoreDatabaseId:
    resolveEnvOrFallback(
      import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
      (localFirebaseConfig as any).firestoreDatabaseId
    ) || '(default)'
};

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(activeFirebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Target database ID
const dbId =
  activeFirebaseConfig.firestoreDatabaseId && activeFirebaseConfig.firestoreDatabaseId !== '(default)'
    ? activeFirebaseConfig.firestoreDatabaseId
    : '(default)';

// Initialize Cloud Firestore with auto-detect long polling for optimal connection across Vercel & browsers
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      ignoreUndefinedProperties: true,
      ...(typeof window !== 'undefined' ? { experimentalAutoDetectLongPolling: true } : {})
    },
    dbId
  );
} catch {
  firestoreInstance = dbId === '(default)' ? getFirestore(app) : getFirestore(app, dbId);
}

export const db = firestoreInstance;

// Startup connection validation per Firebase Integration Skill — surfaces real config/offline/permission errors in UI
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
      const msg = 'تم رفض الاتصال بقاعدة بيانات Firebase بسبب قواعد الأمان (PERMISSION_DENIED). يرجى التحقق من نشر firestore.rules.';
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
      const msg = 'تعذر الوصول إلى خادم Firebase Firestore حالياً (قد يكون الاتصال مقطوعاً أو معرف قاعدة البيانات غير مطابق).';
      updateFirebaseHealth('error', msg);
      pushCloudSyncAlert({
        severity: 'warning',
        target: 'firebase',
        title: 'تعثر الاتصال بـ Firebase Firestore',
        message: msg,
        details: `Database ID: ${dbId} | ${rawMsg}`
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
