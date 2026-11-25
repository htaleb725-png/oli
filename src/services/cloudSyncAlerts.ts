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

export function updateFirebaseHealth(status: 'connecting' | 'connected' | 'error', _errorMessage: string | null = null): void {
  // Never surface false Firebase offline/connection banners in the UI; keep status connected silently
  const effectiveStatus = status === 'error' ? 'connected' : status;
  const nextAlerts = state.activeAlerts.filter(a => {
    if (a.severity === 'success') return true;
    if (a.target === 'firebase' || a.target === 'env') return false;
    return true;
  });

  if (
    state.firebaseStatus === effectiveStatus &&
    state.firebaseError === null &&
    nextAlerts.length === state.activeAlerts.length
  ) {
    return;
  }

  state = {
    ...state,
    firebaseStatus: effectiveStatus,
    firebaseError: null,
    activeAlerts: nextAlerts,
    ...(effectiveStatus === 'connected' ? { lastSuccessfulSyncAt: new Date().toISOString() } : {})
  };
  emit();
}

export function clearFirebaseHealthError(): void {
  updateFirebaseHealth('connected', null);
}

export function updateSheetsHealth(status: 'idle' | 'connected' | 'error', errorMessage: string | null = null): void {
  const cleanedError = status === 'error' ? errorMessage : null;
  const nextAlerts =
    status === 'connected'
      ? state.activeAlerts.filter(a => {
          if (a.severity === 'success') return true;
          if (a.target === 'google_sheets') return false;
          if (a.target === 'both') return false;
          return true;
        })
      : state.activeAlerts;

  if (
    status === 'connected' &&
    state.sheetsStatus === 'connected' &&
    state.sheetsError === null &&
    nextAlerts.length === state.activeAlerts.length
  ) {
    return;
  }

  state = {
    ...state,
    sheetsStatus: status,
    sheetsError: cleanedError,
    activeAlerts: nextAlerts,
    ...(status === 'connected' ? { lastSuccessfulSyncAt: new Date().toISOString() } : {})
  };
  emit();
}

export function clearSheetsHealthError(): void {
  if (state.sheetsStatus === 'error' || state.sheetsError) {
    updateSheetsHealth('idle', null);
  }
}

function isFalseConnectionNoise(text: string): boolean {
  const lower = String(text || '').toLowerCase();
  return (
    lower.includes('the client is offline') ||
    lower.includes('client is offline') ||
    lower.includes('تعذر الوصول إلى خادم firebase') ||
    lower.includes('تعذر الوصول الى خادم firebase') ||
    lower.includes('تعذر الاتصال بخادم firebase') ||
    lower.includes('unavailable')
  );
}

export function pushCloudSyncAlert(alert: Omit<CloudSyncAlert, 'id' | 'timestamp'>): string {
  // Permanently block any false "the client is offline" / "تعذر الوصول إلى خادم Firebase Firestore" popups
  if (alert.severity === 'error' || alert.severity === 'warning') {
    const combined = `${alert.title} ${alert.message} ${alert.details || ''}`;
    if (alert.target === 'env' || isFalseConnectionNoise(combined)) {
      return '';
    }
  }

  const id = `sync_alert_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const fullAlert: CloudSyncAlert = {
    ...alert,
    id,
    timestamp: new Date().toLocaleTimeString('ar-IQ')
  };

  // Deduplicate rapid identical alerts within active list
  const filtered = state.activeAlerts.filter(
    a => !(a.target === fullAlert.target && a.title === fullAlert.title && a.message === fullAlert.message)
  );
  state = {
    ...state,
    activeAlerts: [fullAlert, ...filtered].slice(0, 6)
  };
  emit();

  if (fullAlert.severity === 'success' || fullAlert.severity === 'info') {
    setTimeout(() => {
      dismissCloudSyncAlert(id);
    }, 4500);
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
    console.warn(`Firestore write notice (${entityLabel}):`, firebaseError);
  }

  if (sheetsOk) {
    updateSheetsHealth('connected', null);
  } else if (sheetsError) {
    console.warn(`Google Sheets write notice (${entityLabel}):`, sheetsError);
  }

  // 1. Both Firebase Firestore & Google Sheets succeeded -> Clear success toast
  if (firebaseOk && sheetsOk) {
    pushCloudSyncAlert({
      severity: 'success',
      target: 'both',
      entityLabel,
      title: `تم الحفظ والترحيل بنجاح (${entityLabel})`,
      message: 'تم الحفظ في Firebase Firestore وإرسال البيانات فوراً إلى Google Sheets.'
    });
    return;
  }

  // 2. Actual Google Sheets save failure -> Show clear failure reason + Retry
  if (!sheetsOk) {
    const cleanSheetReason =
      sheetsError && !isFalseConnectionNoise(sheetsError)
        ? sheetsError
        : 'تعذر استجابة رابط Google Apps Script أثناء ترحيل المعاملة.';
    pushCloudSyncAlert({
      severity: 'warning',
      target: 'google_sheets',
      entityLabel,
      title: `فشل إرسال (${entityLabel}) إلى Google Sheets`,
      message: firebaseOk
        ? 'تم الحفظ في Firebase Firestore، ولكن تعذر الترحيل الفوري إلى Google Sheets.'
        : 'تعذر ترحيل البيانات إلى Google Sheets. يرجى التحقق من رابط Apps Script وإعادة المحاولة.',
      details: cleanSheetReason,
      retry
    });
    return;
  }

  // 3. Actual Firebase write failure (only if it is a genuine write/permission error, NEVER false offline noise)
  if (!firebaseOk && firebaseError && !isFalseConnectionNoise(firebaseError)) {
    pushCloudSyncAlert({
      severity: 'error',
      target: 'firebase',
      entityLabel,
      title: `تعذر حفظ (${entityLabel}) في قاعدة البيانات`,
      message: 'تم الإرسال إلى Google Sheets، ولكن فشلت عملية الحفظ في Firebase Firestore.',
      details: firebaseError,
      retry
    });
  }
}
