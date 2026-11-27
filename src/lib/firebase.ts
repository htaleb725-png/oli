import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { testSupabaseConnection } from './supabase';

/**
 * Minimal Firebase App/Auth helper (kept ONLY for optional Google OAuth popup in Google Sheets/Drive integration).
 * Primary real-time database has been migrated completely to Supabase (src/lib/supabase.ts).
 * Zero Firebase Firestore imports or connections exist in the application.
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
  firestoreDatabaseId: 'supabase-primary'
} as const;

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, inMemoryPersistence).catch(() => {});
export const googleAuthProvider = new GoogleAuthProvider();

// Legacy compatibility export — checks Supabase primary database connection
export async function testFirestoreConnection(): Promise<{ ok: boolean; error?: string }> {
  return testSupabaseConnection();
}
