import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer, Firestore, setLogLevel } from 'firebase/firestore';
import localFirebaseConfig from '../../firebase-applet-config.json';

// Suppress false-alarm verbose transport warnings in proxy and sandbox environments
try {
  setLogLevel('error');
} catch {
  // Ignore
}

// 1. Universal Environment Variable Resolution for Vercel, GitHub, and Local AI Studio
// Prioritizes Vercel VITE_* environment variables so credentials remain secure and immutable
// across GitHub Sync & Vercel builds, with seamless fallback to firebase-applet-config.json.
export const activeFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (localFirebaseConfig as any).apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (localFirebaseConfig as any).authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (localFirebaseConfig as any).projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (localFirebaseConfig as any).storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (localFirebaseConfig as any).messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || (localFirebaseConfig as any).appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || (localFirebaseConfig as any).firestoreDatabaseId || '(default)'
};

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(activeFirebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Auto sign-in anonymously for app session security if not signed in
onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth).catch(() => {
      // Offline fallback
    });
  }
});

// Target database ID
const dbId = activeFirebaseConfig.firestoreDatabaseId && activeFirebaseConfig.firestoreDatabaseId !== '(default)'
  ? activeFirebaseConfig.firestoreDatabaseId
  : '(default)';

// Initialize Cloud Firestore with experimentalForceLongPolling for robust connectivity in browser/iframe environments
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    ...(typeof window !== 'undefined' ? { experimentalForceLongPolling: true } : {})
  }, dbId);
} catch {
  firestoreInstance = dbId === '(default)' ? getFirestore(app) : getFirestore(app, dbId);
}

export const db = firestoreInstance;

// Test Firestore Connection per Firebase skill guideline with graceful error handling
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or configuration check required.');
    }
  }
}
testFirestoreConnection();
