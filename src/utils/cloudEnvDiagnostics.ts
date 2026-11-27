import localFirebaseConfig from '../../firebase-applet-config.json';

export const PINNED_BACKUP_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzZjjn-nyfPa8GYC17GphCV2v5CJSsB-f-YsCFebkLtMWpnxi-0eUq_vTUYXvRkxD_4/exec';
export const PINNED_BACKUP_SHEET_ID = '1deoTjgvDflnJBh4B4EGuHN2h_1UiD1VEhssiSS7pDfM';
export const PINNED_BACKUP_SHEET_GID = '1677268204';

export interface EnvVarCheckResult {
  key: string;
  label: string;
  category: 'firebase' | 'google_sheets';
  configured: boolean;
  source: 'vercel_env' | 'local_config' | 'missing' | 'placeholder';
  maskedValue: string;
  required: boolean;
}

export interface CloudEnvDiagnosticsReport {
  firebaseReady: boolean;
  googleSheetsReady: boolean;
  allReady: boolean;
  missingRequiredKeys: string[];
  placeholderKeys: string[];
  items: EnvVarCheckResult[];
  summaryMessage: string;
}

const cleanVal = (raw?: string | null): string =>
  String(raw || '').replace(/^["']|["']$/g, '').trim();

export function isPlaceholderOrInvalidValue(val: string): boolean {
  if (!val) return true;
  if (val.trim() === '(default)') return false;
  const lower = val.toLowerCase();
  return (
    val.startsWith('(') ||
    val.includes('ضع هنا') ||
    val.includes('معرف ملف') ||
    val.includes('الرابط الذي') ||
    val.includes('MY_') ||
    lower.includes('remixed-project-id') ||
    val === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' ||
    val.includes('AKfycbx.../')
  );
}

function maskSecret(val: string, showFull = false): string {
  if (!val) return 'غير مضبوط';
  if (showFull || val.length <= 16) return val;
  return `${val.slice(0, 10)}...${val.slice(-6)}`;
}

export function inspectCloudEnvironment(runtimeOverrides?: {
  appsScriptUrl?: string;
  googleSheetId?: string;
}): CloudEnvDiagnosticsReport {
  const localCfg = (localFirebaseConfig || {}) as Record<string, string>;

  // Firebase alaa-office-2026 is pinned directly in code as Single Source of Truth
  const checkPinnedFirebaseVar = (
    key: string,
    localKey: string,
    label: string,
    showFull = false
  ): EnvVarCheckResult => {
    const pinnedRaw = cleanVal(localCfg[localKey]);
    if (pinnedRaw && !isPlaceholderOrInvalidValue(pinnedRaw)) {
      return {
        key,
        label,
        category: 'firebase',
        configured: true,
        source: 'local_config',
        maskedValue: maskSecret(pinnedRaw, showFull),
        required: true
      };
    }
    return {
      key,
      label,
      category: 'firebase',
      configured: false,
      source: 'missing',
      maskedValue: 'غير مضبوط',
      required: true
    };
  };

  const checkGoogleBackupVar = (
    key: string,
    runtimeVal: string | undefined,
    pinnedFallback: string,
    label: string,
    validator: (v: string) => boolean
  ): EnvVarCheckResult => {
    const runRaw = cleanVal(runtimeVal);
    const effective = runRaw && !isPlaceholderOrInvalidValue(runRaw) && validator(runRaw)
      ? runRaw
      : pinnedFallback;

    if (effective && validator(effective)) {
      return {
        key,
        label,
        category: 'google_sheets',
        configured: true,
        source: 'local_config',
        maskedValue: maskSecret(effective),
        required: true
      };
    }
    return {
      key,
      label,
      category: 'google_sheets',
      configured: false,
      source: 'missing',
      maskedValue: 'غير مضبوط',
      required: true
    };
  };

  const items: EnvVarCheckResult[] = [
    checkPinnedFirebaseVar('VITE_FIREBASE_API_KEY', 'apiKey', 'مفتاح الاتصال الأساسي (مثبت)'),
    checkPinnedFirebaseVar('VITE_FIREBASE_AUTH_DOMAIN', 'authDomain', 'نطاق المصادقة (مثبت)', true),
    checkPinnedFirebaseVar('VITE_FIREBASE_PROJECT_ID', 'projectId', 'معرف قاعدة البيانات المركزية (المصدر الأساسي)', true),
    checkPinnedFirebaseVar('VITE_FIREBASE_STORAGE_BUCKET', 'storageBucket', 'حاوية التخزين السحابي', true),
    checkPinnedFirebaseVar('VITE_FIREBASE_MESSAGING_SENDER_ID', 'messagingSenderId', 'معرف خدمة الإشعارات', true),
    checkPinnedFirebaseVar('VITE_FIREBASE_APP_ID', 'appId', 'معرف المنظومة السحابية'),
    checkPinnedFirebaseVar('VITE_FIREBASE_FIRESTORE_DATABASE_ID', 'firestoreDatabaseId', 'قاعدة البيانات المركزية', true),
    checkGoogleBackupVar(
      'VITE_GOOGLE_APPS_SCRIPT_URL',
      runtimeOverrides?.appsScriptUrl,
      PINNED_BACKUP_APPS_SCRIPT_URL,
      'رابط خدمة الأرشيف الاحتياطي',
      (v) => v.startsWith('https://script.google.com/macros/s/')
    ),
    checkGoogleBackupVar(
      'VITE_GOOGLE_SHEET_ID',
      runtimeOverrides?.googleSheetId,
      PINNED_BACKUP_SHEET_ID,
      'معرف الأرشيف الاحتياطي',
      (v) => /^[a-zA-Z0-9-_]{20,}$/.test(v)
    )
  ];

  const missingRequiredKeys = items.filter(i => i.source === 'missing').map(i => i.key);
  const placeholderKeys = items.filter(i => i.source === 'placeholder').map(i => i.key);
  const firebaseReady = items.filter(i => i.category === 'firebase').every(i => i.configured);
  const googleSheetsReady = items.filter(i => i.category === 'google_sheets').every(i => i.configured);
  const allReady = firebaseReady && googleSheetsReady;

  const summaryMessage = allReady
    ? 'قاعدة البيانات المركزية متصلة كمصدر أساسي، والأرشيف الاحتياطي مهيأ للمزامنة.'
    : 'يرجى التحقق من إعدادات الاتصال بقاعدة البيانات.';

  return {
    firebaseReady,
    googleSheetsReady,
    allReady,
    missingRequiredKeys,
    placeholderKeys,
    items,
    summaryMessage
  };
}
