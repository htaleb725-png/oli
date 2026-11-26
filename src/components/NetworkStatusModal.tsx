import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, Wifi } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * Lightweight, Non-Blocking Network Status Banner & Reconnection Toast
 * -------------------------------------------------------------------
 * - Optimized for weak/intermittent internet connections (zero 5-second ping loops,
 *   zero full-screen blocking modals, zero forced page reloads, zero forced logouts).
 * - Keeps the employee on their exact active screen and preserves their live session
 *   throughout any disconnect.
 * - Automatically resumes background cloud sync and shows an elegant notification
 *   ("تم استعادة الاتصال بالإنترنت بنجاح") once internet returns.
 */
export const NetworkStatusModal: React.FC = () => {
  const { syncAllToFirestoreNow } = useApp();
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [showReconnectedToast, setShowReconnectedToast] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const wasOfflineRef = useRef<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const toastTimerRef = useRef<number | null>(null);

  const triggerReconnectedSuccess = useCallback(() => {
    setIsOffline(false);
    wasOfflineRef.current = false;
    setShowReconnectedToast(true);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setShowReconnectedToast(false);
      toastTimerRef.current = null;
    }, 5000);

    // Silently resume background cloud sync without touching currentUser or active screen
    try {
      syncAllToFirestoreNow().catch(() => {});
    } catch {
      // Non-fatal
    }
  }, [syncAllToFirestoreNow]);

  // Lightweight manual connectivity check (only triggered by user click when offline)
  const checkConnectionOnce = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 5000);
      await fetch(`https://www.gstatic.com/generate_204?_t=${Date.now()}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });
      window.clearTimeout(timeoutId);
      return true;
    } catch {
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
  }, []);

  const handleManualRetry = async () => {
    setIsChecking(true);
    const hasNet = await checkConnectionOnce();
    setIsChecking(false);
    if (hasNet) {
      triggerReconnectedSuccess();
    } else {
      setIsOffline(true);
      wasOfflineRef.current = true;
    }
  };

  useEffect(() => {
    const handleBrowserOnline = () => {
      if (wasOfflineRef.current || isOffline) {
        triggerReconnectedSuccess();
      } else {
        setIsOffline(false);
      }
    };

    const handleBrowserOffline = () => {
      wasOfflineRef.current = true;
      setIsOffline(true);
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    return () => {
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [isOffline, triggerReconnectedSuccess]);

  return (
    <>
      {/* Elegant Reconnected Toast — never interrupts the employee's screen */}
      {showReconnectedToast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-none px-3 w-full max-w-md"
          dir="rtl"
        >
          <div className="bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-700 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-300/50 flex items-center gap-3 backdrop-blur-md">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-100" />
            </div>
            <div className="text-right min-w-0 flex-1">
              <h4 className="font-black text-sm text-white flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>تم استعادة الاتصال بالإنترنت بنجاح</span>
              </h4>
              <p className="text-[11px] text-emerald-100 font-semibold mt-0.5">
                تم استئناف المزامنة السحابية تلقائياً مع الحفاظ الكامل على شاشتك الحالية.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Non-Blocking Floating Offline Banner — keeps session & current screen 100% active */}
      {isOffline && (
        <div
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md z-[99980] animate-in fade-in slide-in-from-bottom-3 duration-200"
          dir="rtl"
          role="status"
          aria-live="polite"
        >
          <div className="bg-slate-900/95 text-white border border-amber-400/50 rounded-2xl shadow-2xl p-3.5 flex items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <WifiOff className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-xs text-amber-300 leading-tight">
                  انقطع الاتصال بالإنترنت مؤقتاً
                </p>
                <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                  جلستك وشاشتك الحالية محفوظة بدون تسجيل خروج — سيُستأنف التزامن فور عودة الشبكة.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleManualRetry}
              disabled={isChecking}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'فحص...' : 'إعادة فحص'}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
