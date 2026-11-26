import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  Info
} from 'lucide-react';
import {
  CloudHealthSnapshot,
  CloudSyncAlert,
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

  const visibleAlerts = health.activeAlerts.filter((alert) => {
    if (alert.target === 'env') {
      return false;
    }
    // When browser is offline, NetworkStatusModal handles the full-screen overlay lock cleanly
    if (typeof navigator !== 'undefined' && !navigator.onLine && alert.severity === 'error') {
      const combined = `${alert.title} ${alert.message} ${alert.details || ''}`.toLowerCase();
      if (combined.includes('client is offline')) {
        return false;
      }
    }
    return true;
  });

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className="no-print w-full" dir="rtl">
      {/* Floating Sync Notification Stack (excludes all red/yellow Firebase/offline banners) */}
      <div className="fixed bottom-14 left-4 z-50 flex flex-col gap-2.5 max-w-md w-[calc(100vw-2rem)] pointer-events-none">
        {visibleAlerts.map((alert) => {
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
                        <span>{retryingId === alert.id ? 'جاري إعادة المحاولة...' : 'إعادة المحاولة'}</span>
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
    </div>
  );
};
