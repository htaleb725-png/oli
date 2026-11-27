import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { updateFirebaseHealth, pushCloudSyncAlert } from '../services/cloudSyncAlerts';

/**
 * Authoritative Pinned Supabase Configuration (Primary Real-Time Database)
 * ------------------------------------------------------------------------
 * Uses the 6 core tables:
 *   citizens | requests | blacklist | users | departments | system_settings
 * with Supabase Realtime (postgres_changes) enabled alongside Google Sheets dual-sync.
 */
export const SUPABASE_URL = 'https://omwcrhwmjeutdyyyaqps.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_egWtP2Da7eFSZOPhpaLgWA_b7jGn8RD';

export const SUPABASE_TABLES = {
  CITIZENS: 'citizens',
  REQUESTS: 'requests',
  BLACKLIST: 'blacklist',
  USERS: 'users',
  DEPARTMENTS: 'departments',
  SYSTEM_SETTINGS: 'system_settings'
} as const;

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

/**
 * Lightweight startup & diagnostic connectivity check against Supabase.
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; error?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, error: 'لا يوجد اتصال بالإنترنت حالياً.' };
  }

  try {
    const { error } = await supabase
      .from(SUPABASE_TABLES.SYSTEM_SETTINGS)
      .select('key')
      .limit(1);

    if (error) {
      const msg = `تعذر الاتصال بقاعدة البيانات: ${error.message}`;
      updateFirebaseHealth('error', msg);
      pushCloudSyncAlert({
        severity: 'error',
        target: 'firebase',
        title: 'خطأ في الاتصال بقاعدة البيانات',
        message: msg,
        details: error.message
      });
      return { ok: false, error: msg };
    }

    updateFirebaseHealth('connected', null);
    return { ok: true };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const msg = `تعذر الاتصال بخادم قاعدة البيانات: ${rawMsg}`;
    updateFirebaseHealth('error', msg);
    return { ok: false, error: msg };
  }
}

if (typeof window !== 'undefined') {
  void testSupabaseConnection();
}
