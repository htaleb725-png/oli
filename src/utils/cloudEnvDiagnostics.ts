import localFirebaseConfig from '../../firebase-applet-config.json';

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
  const env = import.meta.env || ({} as ImportMetaEnv);
  const localCfg = (localFirebaseConfig || {}) as Record<string, string>;

  const checkFirebaseVar = (
    key: Extract<keyof ImportMetaEnv, string>,
    localKey: string,
    label: string,
    showFull = false
  ): EnvVarCheckResult => {
    const envRaw = cleanVal(env[key]);
    const localRaw = cleanVal(localCfg[localKey]);

    if (envRaw && !isPlaceholderOrInvalidValue(envRaw)) {
      return {
        key,
        label,
        category: 'firebase',
        configured: true,
        source: 'vercel_env',
        maskedValue: maskSecret(envRaw, showFull),
        required: true
      };
    }
    if (envRaw && isPlaceholderOrInvalidValue(envRaw)) {
      return {
        key,
        label,
        category: 'firebase',
        configured: false,
        source: 'placeholder',
        maskedValue: 'قيمة تجريبية/غير صالحة',
        required: true
      };
    }
    if (localRaw && !isPlaceholderOrInvalidValue(localRaw)) {
      return {
        key,
        label,
        category: 'firebase',
        configured: true,
        source: 'local_config',
        maskedValue: maskSecret(localRaw, showFull),
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

  const checkGoogleVar = (
    key: Extract<keyof ImportMetaEnv, string>,
    runtimeVal: string | undefined,
    label: string,
    validator: (v: string) => boolean
  ): EnvVarCheckResult => {
    const envRaw = cleanVal(env[key]);
    const runRaw = cleanVal(runtimeVal);

    if (envRaw && !isPlaceholderOrInvalidValue(envRaw) && validator(envRaw)) {
      return {
        key,
        label,
        category: 'google_sheets',
        configured: true,
        source: 'vercel_env',
        maskedValue: maskSecret(envRaw),
        required: true
      };
    }
    if (envRaw && (isPlaceholderOrInvalidValue(envRaw) || !validator(envRaw))) {
      return {
        key,
        label,
        category: 'google_sheets',
        configured: false,
        source: 'placeholder',
        maskedValue: 'قيمة غير صالحة أو نص إرشادي',
        required: true
      };
    }
    if (runRaw && !isPlaceholderOrInvalidValue(runRaw) && validator(runRaw)) {
      return {
        key,
        label,
        category: 'google_sheets',
        configured: true,
        source: 'local_config',
        maskedValue: maskSecret(runRaw),
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
    checkFirebaseVar('VITE_FIREBASE_API_KEY', 'apiKey', 'مفتاح Firebase API'),
    checkFirebaseVar('VITE_FIREBASE_AUTH_DOMAIN', 'authDomain', 'نطاق المصادقة (Auth Domain)', true),
    checkFirebaseVar('VITE_FIREBASE_PROJECT_ID', 'projectId', 'معرف مشروع Firebase', true),
    checkFirebaseVar('VITE_FIREBASE_STORAGE_BUCKET', 'storageBucket', 'حاوية التخزين (Storage Bucket)', true),
    checkFirebaseVar('VITE_FIREBASE_MESSAGING_SENDER_ID', 'messagingSenderId', 'معرف المراسلة (Sender ID)', true),
    checkFirebaseVar('VITE_FIREBASE_APP_ID', 'appId', 'معرف تطبيق Firebase'),
    checkFirebaseVar('VITE_FIREBASE_FIRESTORE_DATABASE_ID', 'firestoreDatabaseId', 'معرف قاعدة بيانات Firestore', true),
    checkGoogleVar(
      'VITE_GOOGLE_APPS_SCRIPT_URL',
      runtimeOverrides?.appsScriptUrl,
      'رابط تطبيق الويب (Google Apps Script)',
      (v) => v.startsWith('https://script.google.com/macros/s/')
    ),
    checkGoogleVar(
      'VITE_GOOGLE_SHEET_ID',
      runtimeOverrides?.googleSheetId,
      'معرف ملف Google Sheets',
      (v) => /^[a-zA-Z0-9-_]{20,}$/.test(v)
    )
  ];

  const missingRequiredKeys = items.filter(i => i.source === 'missing').map(i => i.key);
  const placeholderKeys = items.filter(i => i.source === 'placeholder').map(i => i.key);
  const firebaseReady = items.filter(i => i.category === 'firebase').every(i => i.configured);
  const googleSheetsReady = items.filter(i => i.category === 'google_sheets').every(i => i.configured);
  const allReady = firebaseReady && googleSheetsReady;

  let summaryMessage = 'جميع متغيرات الربط السحابي (Firebase + Google Sheets) مهيأة بشكل صحيح.';
  if (!firebaseReady && !googleSheetsReady) {
    summaryMessage = 'متغيرات Firebase و Google Sheets غير مكتملة أو تحتوي قيماً تجريبية. يرجى ضبطها في Vercel ثم إعادة النشر (Redeploy).';
  } else if (!firebaseReady) {
    summaryMessage = 'إعدادات Firebase غير مكتملة. يرجى التحقق من متغيرات VITE_FIREBASE_* في Vercel.';
  } else if (!googleSheetsReady) {
    summaryMessage = 'إعدادات Google Sheets / Apps Script غير مكتملة. يرجى ضبط VITE_GOOGLE_APPS_SCRIPT_URL و VITE_GOOGLE_SHEET_ID في Vercel.';
  }

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
