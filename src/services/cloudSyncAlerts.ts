/**
 * Global Cloud Sync Status & Transparent Error Alert Bus
 * ------------------------------------------------------
 * Surfaces real Firebase Firestore connection/save failures immediately in the UI
 * and clears automatically as soon as Firestore recovers or saving succeeds.
 * Google Sheets alerts are surfaced only during explicit manual backup/import/export.
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

export function updateFirebaseHealth(
  status: 'connecting' | 'connected' | 'error',
  errorMessage: string | null = null
): void {
  const cleanedError = status === 'error' ? errorMessage : null;
  const nextAlerts =
    status === 'connected'
      ? state.activeAlerts.filter(a => {
          if (a.severity === 'success') return true;
          if (a.target === 'firebase' || a.target === 'both') return false;
          return true;
        })
      : state.activeAlerts;

  if (
    state.firebaseStatus === status &&
    state.firebaseError === cleanedError &&
    nextAlerts.length === state.activeAlerts.length
  ) {
    return;
  }

  state = {
    ...state,
    firebaseStatus: status,
    firebaseError: cleanedError,
    activeAlerts: nextAlerts,
    ...(status === 'connected' ? { lastSuccessfulSyncAt: new Date().toISOString() } : {})
  };
  emit();
}

export function clearFirebaseHealthError(): void {
  updateFirebaseHealth('connected', null);
}

export function updateSheetsHealth(
  status: 'idle' | 'connected' | 'error',
  errorMessage: string | null = null
): void {
  const cleanedError = status === 'error' ? errorMessage : null;
  const nextAlerts =
    status === 'connected'
      ? state.activeAlerts.filter(a => {
          if (a.severity === 'success') return true;
          if (a.target === 'google_sheets') return false;
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

export function pushCloudSyncAlert(alert: Omit<CloudSyncAlert, 'id' | 'timestamp'>): string {
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

/**
 * Reports live Firebase Firestore write outcomes clearly to the UI.
 * (Google Sheets is strictly manual backup/import/export and never blocks or warns during live Firestore saves.)
 */
export function reportDualCloudWriteResult(params: {
  entityLabel: string;
  firebaseOk: boolean;
  firebaseError?: string;
  sheetsOk?: boolean;
  sheetsError?: string;
  actionType?: 'save' | 'delete';
  retry?: () => Promise<void>;
}): void {
  const { entityLabel, firebaseOk, firebaseError, actionType = 'save', retry } = params;
  const isDelete = actionType === 'delete';

  if (firebaseOk) {
    updateFirebaseHealth('connected', null);
    pushCloudSyncAlert({
      severity: 'success',
      target: 'firebase',
      entityLabel,
      title: isDelete
        ? `تم الحذف النهائي من قاعدة البيانات (${entityLabel})`
        : `تم الحفظ في قاعدة البيانات (${entityLabel})`,
      message: isDelete
        ? 'تم حذف السجل نهائياً من Supabase ومزامنة الحذف مع Google Sheet فوراً.'
        : 'تم حفظ البيانات مباشرة في Supabase ومزامنتها مع Google Sheet.'
    });
    return;
  }

  const cleanErr =
    firebaseError ||
    (isDelete
      ? 'تعذر حذف السجل من Supabase. يرجى التحقق من الاتصال وإعادة المحاولة.'
      : 'تعذر حفظ البيانات في Supabase. يرجى التحقق من الاتصال وإعادة المحاولة.');
  updateFirebaseHealth('error', cleanErr);
  pushCloudSyncAlert({
    severity: 'error',
    target: 'firebase',
    entityLabel,
    title: isDelete
      ? `فشل الحذف من قاعدة البيانات (${entityLabel})`
      : `فشل الحفظ في قاعدة البيانات (${entityLabel})`,
    message: isDelete
      ? 'تعذر إتمام عملية الحذف في Supabase. يرجى التحقق من الاتصال والمحاولة مجدداً.'
      : 'تعذر حفظ التعديلات مباشرة في Supabase. يرجى التحقق من الاتصال والمحاولة مجدداً.',
    details: cleanErr,
    retry
  });
}
