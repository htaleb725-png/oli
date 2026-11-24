/**
 * Global Cloud Sync Status & Transparent Error Alert Bus
 * ------------------------------------------------------
 * Ensures NO Firebase Firestore or Google Sheets persistence failure is ever
 * silently swallowed or disguised as a successful save in Chrome.
 */

export type CloudTarget = 'firebase' | 'google_sheets' | 'both' | 'env';
export type AlertSeverity = 'success' | 'warning' | 'error' | 'info';

export interface CloudSyncAlert {
  id: string;
  severity: AlertSeverity;
  target: CloudTarget;
  title: string;
  message: string;
  details?: string;
  entityLabel?: string;
  timestamp: string;
  retry?: () => Promise<void>;
}

export interface CloudHealthSnapshot {
  firebaseStatus: 'connecting' | 'connected' | 'error';
  firebaseError: string | null;
  sheetsStatus: 'idle' | 'connected' | 'error';
  sheetsError: string | null;
  lastSuccessfulSyncAt: string | null;
  activeAlerts: CloudSyncAlert[];
}

type Listener = (snapshot: CloudHealthSnapshot) => void;

const listeners = new Set<Listener>();

let state: CloudHealthSnapshot = {
  firebaseStatus: 'connecting',
  firebaseError: null,
  sheetsStatus: 'idle',
  sheetsError: null,
  lastSuccessfulSyncAt: null,
  activeAlerts: []
};

function emit() {
  const snap: CloudHealthSnapshot = {
    ...state,
    activeAlerts: [...state.activeAlerts]
  };
  listeners.forEach(fn => {
    try {
      fn(snap);
    } catch {}
  });
}

export function subscribeCloudHealth(listener: Listener): () => void {
  listeners.add(listener);
  listener({ ...state, activeAlerts: [...state.activeAlerts] });
  return () => {
    listeners.delete(listener);
  };
}

export function getCloudHealthSnapshot(): CloudHealthSnapshot {
  return { ...state, activeAlerts: [...state.activeAlerts] };
}

export function updateFirebaseHealth(status: 'connecting' | 'connected' | 'error', errorMessage: string | null = null): void {
  state = {
    ...state,
    firebaseStatus: status,
    firebaseError: errorMessage,
    ...(status === 'connected' ? { lastSuccessfulSyncAt: new Date().toISOString() } : {})
  };
  emit();
}

export function updateSheetsHealth(status: 'idle' | 'connected' | 'error', errorMessage: string | null = null): void {
  state = {
    ...state,
    sheetsStatus: status,
    sheetsError: errorMessage,
    ...(status === 'connected' ? { lastSuccessfulSyncAt: new Date().toISOString() } : {})
  };
  emit();
}

export function pushCloudSyncAlert(alert: Omit<CloudSyncAlert, 'id' | 'timestamp'>): string {
  const id = `sync_alert_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const fullAlert: CloudSyncAlert = {
    ...alert,
    id,
    timestamp: new Date().toLocaleTimeString('ar-IQ')
  };

  // Deduplicate rapid identical error alerts within active list
  const filtered = state.activeAlerts.filter(
    a => !(a.target === fullAlert.target && a.title === fullAlert.title && a.message === fullAlert.message)
  );
  state = {
    ...state,
    activeAlerts: [fullAlert, ...filtered].slice(0, 6)
  };
  emit();

  // Auto-dismiss only success/info notifications; keep error/warning visible until dismissed or retried
  if (fullAlert.severity === 'success' || fullAlert.severity === 'info') {
    setTimeout(() => {
      dismissCloudSyncAlert(id);
    }, 5000);
  }

  return id;
}

export function dismissCloudSyncAlert(id: string): void {
  const next = state.activeAlerts.filter(a => a.id !== id);
  if (next.length !== state.activeAlerts.length) {
    state = { ...state, activeAlerts: next };
    emit();
  }
}

export function clearAllCloudSyncAlerts(): void {
  if (state.activeAlerts.length > 0) {
    state = { ...state, activeAlerts: [] };
    emit();
  }
}

export function reportDualCloudWriteResult(params: {
  entityLabel: string;
  firebaseOk: boolean;
  firebaseError?: string;
  sheetsOk: boolean;
  sheetsError?: string;
  retry?: () => Promise<void>;
}): void {
  const { entityLabel, firebaseOk, firebaseError, sheetsOk, sheetsError, retry } = params;

  if (firebaseOk) {
    updateFirebaseHealth('connected', null);
  } else if (firebaseError) {
    updateFirebaseHealth('error', firebaseError);
  }

  if (sheetsOk) {
    updateSheetsHealth('connected', null);
  } else if (sheetsError) {
    updateSheetsHealth('error', sheetsError);
  }

  if (firebaseOk && sheetsOk) {
    pushCloudSyncAlert({
      severity: 'success',
      target: 'both',
      entityLabel,
      title: `تم الحفظ السحابي المزدوج بنجاح (${entityLabel})`,
      message: 'تم ترحيل البيانات فعلياً إلى Firebase Firestore و Google Sheets بدون الاعتماد على ذاكرة المتصفح.'
    });
    return;
  }

  if (!firebaseOk && !sheetsOk) {
    pushCloudSyncAlert({
      severity: 'error',
      target: 'both',
      entityLabel,
      title: `فشل الحفظ السحابي الكلي (${entityLabel})`,
      message: 'تعذر حفظ السجل في كل من Firebase Firestore و Google Sheets. لم يتم تخزين البيانات في متصفح Chrome كبديل.',
      details: `Firebase: ${firebaseError || 'فشل الاتصال'} | Google Sheets: ${sheetsError || 'فشل الإرسال'}`,
      retry
    });
    return;
  }

  if (!firebaseOk) {
    pushCloudSyncAlert({
      severity: 'warning',
      target: 'firebase',
      entityLabel,
      title: `فشل الحفظ في Firebase Firestore (${entityLabel})`,
      message: 'تم الإرسال إلى Google Sheets، لكن تعذر الحفظ في قاعدة بيانات Firebase Firestore. تحقق من الصلاحيات ومتغيرات البيئة.',
      details: firebaseError || 'خطأ غير معروف في Firestore',
      retry
    });
    return;
  }

  if (!sheetsOk) {
    pushCloudSyncAlert({
      severity: 'warning',
      target: 'google_sheets',
      entityLabel,
      title: `فشل الترحيل إلى Google Sheets (${entityLabel})`,
      message: 'تم الحفظ في Firebase Firestore بنجاح، لكن تعذر الترحيل إلى ورقة Google Sheets عبر Apps Script.',
      details: sheetsError || 'تأكد من رابط Apps Script وإعادة نشره كإصدار جديد ومن متغيرات Vercel',
      retry
    });
  }
}
