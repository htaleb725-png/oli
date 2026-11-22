import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer, Firestore, setLogLevel } from 'firebase/firestore';
import localFirebaseConfig from '../../firebase-applet-config.json';

// Suppress false-alarm verbose transport warnings in proxy and sandbox environments
try {
  setLogLevel('silent');
} catch {
  // Ignore
}

// Helper to strip accidental quotes pasted into Vercel environment variables
const cleanEnv = (val?: string) => (val || '').replace(/^["']|["']$/g, '').trim();

// 1. Universal Environment Variable Resolution for Vercel, GitHub, and Local AI Studio
// Prioritizes Vercel VITE_* environment variables so credentials remain secure and immutable
// across GitHub Sync & Vercel builds, with seamless fallback to firebase-applet-config.json.
export const activeFirebaseConfig = {
  apiKey: cleanEnv(import.meta.env.VITE_FIREBASE_API_KEY) || (localFirebaseConfig as any).apiKey,
  authDomain: cleanEnv(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) || (localFirebaseConfig as any).authDomain,
  projectId: cleanEnv(import.meta.env.VITE_FIREBASE_PROJECT_ID) || (localFirebaseConfig as any).projectId,
  storageBucket: cleanEnv(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) || (localFirebaseConfig as any).storageBucket,
  messagingSenderId: cleanEnv(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) || (localFirebaseConfig as any).messagingSenderId,
  appId: cleanEnv(import.meta.env.VITE_FIREBASE_APP_ID) || (localFirebaseConfig as any).appId,
  firestoreDatabaseId: cleanEnv(import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID) || (localFirebaseConfig as any).firestoreDatabaseId || '(default)'
};

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(activeFirebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Target database ID
const dbId = activeFirebaseConfig.firestoreDatabaseId && activeFirebaseConfig.firestoreDatabaseId !== '(default)'
  ? activeFirebaseConfig.firestoreDatabaseId
  : '(default)';

// Initialize Cloud Firestore with auto-detect long polling for optimal connection in sandboxes & web preview
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    ...(typeof window !== 'undefined' ? { experimentalAutoDetectLongPolling: true } : {})
  }, dbId);
} catch {
  firestoreInstance = dbId === '(default)' ? getFirestore(app) : getFirestore(app, dbId);
}

export const db = firestoreInstance;

// Test Firestore Connection per Firebase skill guideline with graceful error handling and timeout safeguard
async function testFirestoreConnection() {
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
    await Promise.race([
      getDocFromServer(doc(db, 'test', 'connection')),
      new Promise((_, reject) => setTimeout(() => reject(new Error('the client is offline')), 3000))
    ]);
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('backend'))) {
      console.warn('Firebase client is offline or operating in local cache mode.');
    }
  }
}
testFirestoreConnection();
