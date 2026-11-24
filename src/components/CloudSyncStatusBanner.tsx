import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Database,
  FileSpreadsheet,
  RefreshCw,
  X,
  Info
} from 'lucide-react';
import {
  CloudHealthSnapshot,
  CloudSyncAlert,
  clearFirebaseHealthError,
  clearSheetsHealthError,
  dismissCloudSyncAlert,
  subscribeCloudHealth
} from '../services/cloudSyncAlerts';

/**
 * Transparent Cloud Persistence Alert Banner & Toast Stack
 * --------------------------------------------------------
 * Surfaces real Firebase Firestore and Google Sheets write failures
 * immediately and clears automatically as soon as connection or saving succeeds.
 */
export const CloudSyncStatusBanner: React.FC = () => {
  const [health, setHealth] = useState<CloudHealthSnapshot>(() => ({
    firebaseStatus: 'connecting',
    firebaseError: null,
    sheetsStatus: 'idle',
    sheetsError: null,
    lastSuccessfulSyncAt: null,
    activeAlerts: []
  }));
  const [retryingId, setRetryingId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeCloudHealth(setHealth);
  }, []);

  const handleRetry = async (alert: CloudSyncAlert) => {
    if (!alert.retry) return;
    setRetryingId(alert.id);
    try {
      await alert.retry();
      dismissCloudSyncAlert(alert.id);
    } finally {
      setRetryingId(null);
    }
  };

  const hasConnectionIssue = health.firebaseStatus === 'error' || health.sheetsStatus === 'error';

  if (!hasConnectionIssue && health.activeAlerts.length === 0) {
    return null;
  }

  return (
    <div className="no-print w-full" dir="rtl">
      {/* Top Health Strip ONLY shown when an actual cloud save failed; clears immediately on next successful connection/save */}
      {hasConnectionIssue && (
        <div className="bg-rose-950/95 text-rose-50 border-b border-rose-500/40 px-4 py-2 text-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold">
              <CloudOff className="w-4 h-4 text-rose-400 shrink-0" />
              <span>تعثر حفظ سحابي (يختفي هذا التنبيه تلقائياً بمجرد نجاح الاتصال أو الحفظ):</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {health.firebaseStatus === 'error' && (
                <span className="inline-flex items-center gap-1.5 bg-rose-900/80 border border-rose-500/40 px-2.5 py-0.5 rounded-lg">
                  <Database className="w-3.5 h-3.5 text-rose-300" />
                  <strong>Firebase:</strong>
                  <span className="text-rose-200">{health.firebaseError || 'فشل الحفظ'}</span>
                </span>
              )}
              {health.sheetsStatus === 'error' && (
                <span className="inline-flex items-center gap-1.5 bg-amber-950/80 border border-amber-500/40 px-2.5 py-0.5 rounded-lg text-amber-100">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300" />
                  <strong>Google Sheets:</strong>
                  <span className="text-amber-200">{health.sheetsError || 'تعذر المزامنة'}</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  clearFirebaseHealthError();
                  clearSheetsHealthError();
                }}
                className="p-1 rounded-lg hover:bg-white/15 text-rose-200 hover:text-white transition-colors cursor-pointer"
                title="إغلاق الشريط"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Transparent Sync Alert Stack */}
      {health.activeAlerts.length > 0 && (
        <div className="fixed bottom-14 left-4 z-50 flex flex-col gap-2.5 max-w-md w-[calc(100vw-2rem)] pointer-events-none">
          {health.activeAlerts.map((alert) => {
            const styleMap = {
              error: {
                bg: 'bg-rose-950/95 border-rose-500/50 text-white',
                icon: <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              },
              warning: {
                bg: 'bg-amber-950/95 border-amber-500/50 text-amber-50',
                icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              },
              success: {
                bg: 'bg-emerald-950/95 border-emerald-500/50 text-emerald-50',
                icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              },
              info: {
                bg: 'bg-slate-900/95 border-blue-500/50 text-slate-50',
                icon: <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              }
            }[alert.severity];

            return (
              <div
                key={alert.id}
                className={`pointer-events-auto rounded-2xl border p-3.5 shadow-2xl backdrop-blur-md transition-all ${styleMap.bg}`}
              >
                <div className="flex items-start gap-2.5">
                  {styleMap.icon}
                  <div className="flex-1 min-w-0 text-right space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-extrabold leading-snug">{alert.title}</h4>
                      <span className="text-[10px] opacity-65 font-mono shrink-0">{alert.timestamp}</span>
                    </div>
                    <p className="text-[11px] opacity-90 leading-relaxed">{alert.message}</p>
                    {alert.details && (
                      <div className="mt-1.5 rounded-lg bg-black/30 px-2.5 py-1.5 text-[10px] font-mono opacity-90 break-words">
                        {alert.details}
                      </div>
                    )}
                    {alert.retry && (
                      <div className="pt-1.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRetry(alert)}
                          disabled={retryingId === alert.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${retryingId === alert.id ? 'animate-spin' : ''}`} />
                          <span>{retryingId === alert.id ? 'جاري إعادة المحاولة...' : 'إعادة محاولة الحفظ السحابي'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissCloudSyncAlert(alert.id)}
                    className="p-1 rounded-lg hover:bg-white/15 opacity-75 hover:opacity-100 transition-colors cursor-pointer shrink-0"
                    title="إغلاق التنبيه"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
