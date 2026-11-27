/**
 * Unified Database Service Facade -> Supabase (Primary Real-Time Database)
 * ------------------------------------------------------------------------
 * All Firebase Firestore code has been removed and replaced by Supabase
 * across the 6 tables: citizens, requests, blacklist, users, departments, system_settings
 * with Supabase Realtime enabled alongside Google Sheets dual-sync.
 */
export * from './supabaseService';
