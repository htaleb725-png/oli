import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer, Firestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Suppress false-alarm verbose transport warnings in proxy and sandbox environments
try {
  setLogLevel('error');
} catch {
  // Ignore
}

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

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
const dbId = (firebaseConfig as any).firestoreDatabaseId && (firebaseConfig as any).firestoreDatabaseId !== '(default)'
  ? (firebaseConfig as any).firestoreDatabaseId
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

