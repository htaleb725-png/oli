import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, Wifi, ShieldAlert } from 'lucide-react';
import { useApp } from '../context/AppContext';

const RECONNECTED_TOAST_DURATION_MS = 8000;

/**
 * Network Disconnection Overlay Lock & Auto-Hiding Reconnection Toast
 * -------------------------------------------------------------------
 * - When offline: renders a centered floating card with a full-screen Overlay Lock
 *   preventing clicks, saves, or keyboard submissions behind it so no records are lost
 *   or conflicted, while keeping the employee on their exact page & department without logout.
 * - When online returns: immediately unlocks interaction on the exact same screen,
 *   resumes background cloud sync, and shows "تم استعادة الاتصال بالإنترنت بنجاح"
 *   with a dedicated 8000ms timer that cleanly hides the toast after exactly 8 seconds.
 */
export const NetworkStatusModal: React.FC = () => {
  const { syncAllToFirestoreNow } = useApp();
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [showReconnectedToast, setShowReconnectedToast] = useState<boolean>(false);
  const [reconnectedToastNonce, setReconnectedToastNonce] = useState<number>(0);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const wasOfflineRef = useRef<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const modalCardRef = useRef<HTMLDivElement | null>(null);
  const syncRef = useRef(syncAllToFirestoreNow);
  syncRef.current = syncAllToFirestoreNow;

  const triggerReconnectedSuccess = useCallback(() => {
    wasOfflineRef.current = false;
    setIsOffline(false);
    setShowReconnectedToast(true);
    setReconnectedToastNonce((n) => n + 1);

    // Silently resume background cloud sync without touching currentUser or active screen
    try {
      syncRef.current().catch(() => {});
    } catch {
      // Non-fatal
    }
  }, []);

  // Dedicated 8000ms auto-hide timer — completely isolated from online/offline listener lifecycle
  useEffect(() => {
    if (!showReconnectedToast) return;
    const hideTimer = window.setTimeout(() => {
      setShowReconnectedToast(false);
    }, RECONNECTED_TOAST_DURATION_MS);

    return () => {
      window.clearTimeout(hideTimer);
    };
  }, [showReconnectedToast, reconnectedToastNonce]);

  // Lightweight connectivity check (triggered on manual retry or when recovering from offline)
  const checkConnectionOnce = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 4500);
      await fetch(`https://www.gstatic.com/generate_204?_t=${Date.now()}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });
      window.clearTimeout(timeoutId);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleManualRetry = async () => {
    setIsChecking(true);
    const hasNet = await checkConnectionOnce();
    setIsChecking(false);
    if (hasNet) {
      triggerReconnectedSuccess();
    } else {
      wasOfflineRef.current = true;
      setIsOffline(true);
    }
  };

  // Register browser online/offline listeners once without tearing down on isOffline flips
  useEffect(() => {
    const handleBrowserOnline = () => {
      if (wasOfflineRef.current) {
        triggerReconnectedSuccess();
      } else {
        setIsOffline(false);
      }
    };

    const handleBrowserOffline = () => {
      wasOfflineRef.current = true;
      setShowReconnectedToast(false);
      setIsOffline(true);
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    return () => {
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
    };
  }, [triggerReconnectedSuccess]);

  // While strictly offline: lock background scrolling, blur active underlying inputs,
  // block keyboard actions outside the modal card, and watch for network return.
  useEffect(() => {
    if (!isOffline) return;

    // Blur any active element behind the overlay so typing/Enter cannot alter underlying forms
    try {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (!modalCardRef.current || !modalCardRef.current.contains(activeEl))) {
        activeEl.blur();
      }
    } catch {}

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const blockUnderlyingKeys = (e: KeyboardEvent) => {
      const target = e.target as Node | null;
      if (modalCardRef.current && target && modalCardRef.current.contains(target)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('keydown', blockUnderlyingKeys, { capture: true });

    // Passive recovery check ONLY while locked offline (zero activity when online)
    const recoveryInterval = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        triggerReconnectedSuccess();
      }
    }, 2500);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', blockUnderlyingKeys, { capture: true });
      window.clearInterval(recoveryInterval);
    };
  }, [isOffline, triggerReconnectedSuccess]);

  return (
    <>
      {/* Elegant Reconnected Toast — auto-hides permanently after exactly 8000ms */}
      {showReconnectedToast && !isOffline && (
        <div
          key={reconnectedToastNonce}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100001] animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-none px-3 w-full max-w-md font-['Tajawal',sans-serif]"
          dir="rtl"
          role="status"
          aria-live="polite"
        >
          <div className="relative overflow-hidden bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-700 text-white px-4 py-3.5 rounded-2xl shadow-2xl border border-emerald-300/60 flex items-center gap-3 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0 border border-white/25">
              <CheckCircle2 className="w-5 h-5 text-emerald-100" />
            </div>
            <div className="text-right min-w-0 flex-1">
              <h4 className="font-black text-sm text-white flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-emerald-200 shrink-0" />
                <span>تم استعادة الاتصال بالإنترنت بنجاح</span>
              </h4>
              <p className="text-[11px] text-emerald-100 font-semibold mt-0.5">
                تم فتح النظام في نفس صفحتك وقسمك واستئناف المزامنة السحابية تلقائياً.
              </p>
            </div>
            {/* Subtle 8-second countdown progress bar */}
            <div className="absolute bottom-0 right-0 left-0 h-1 bg-black/15">
              <div
                className="h-full bg-emerald-200/90 origin-right"
                style={{
                  animation: `networkToastShrink ${RECONNECTED_TOAST_DURATION_MS}ms linear forwards`
                }}
              />
            </div>
          </div>
          <style>{`
            @keyframes networkToastShrink {
              from { transform: scaleX(1); }
              to { transform: scaleX(0); }
            }
          `}</style>
        </div>
      )}

      {/* Full-Screen Overlay Lock + Centered Floating Offline Card */}
      {isOffline && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md select-none font-['Tajawal',sans-serif] animate-in fade-in duration-200"
          dir="rtl"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="offline-lock-title"
          aria-describedby="offline-lock-desc"
          onClick={(e) => {
            if (modalCardRef.current && modalCardRef.current.contains(e.target as Node)) return;
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            if (modalCardRef.current && modalCardRef.current.contains(e.target as Node)) return;
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div
            ref={modalCardRef}
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-amber-400/50 dark:border-amber-500/40 overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Top accent bar */}
            <div className="h-1.5 w-full bg-gradient-to-l from-rose-500 via-amber-500 to-rose-500" />

            <div className="p-6 sm:p-7 text-center space-y-5">
              {/* Prominent Offline Icon */}
              <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping" />
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-600 text-white shadow-xl shadow-rose-500/30 flex items-center justify-center border-2 border-white/30">
                  <WifiOff className="w-10 h-10" />
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3
                  id="offline-lock-title"
                  className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug"
                >
                  انقطع الاتصال بالإنترنت — بانتظار عودة الشبكة...
                </h3>
                <p
                  id="offline-lock-desc"
                  className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium"
                >
                  تم قفل التفاعل مؤقتاً لحماية المعاملات والبيانات من الفقدان أو التضارب أثناء انقطاع الشبكة.
                </p>
              </div>

              {/* Session Preservation Notice */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3.5 flex items-start gap-2.5 text-right">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] sm:text-xs text-amber-900 dark:text-amber-200 font-semibold leading-relaxed">
                  جلستك وصفحتك وقسمك الحالي محفوظة بالكامل دون تسجيل خروج — سيُفتح النظام تلقائياً فور عودة الإنترنت.
                </p>
              </div>

              {/* Live Waiting Indicator + Manual Check Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <span>بانتظار عودة الاتصال تلقائياً...</span>
                </div>
                <button
                  type="button"
                  onClick={handleManualRetry}
                  disabled={isChecking}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>{isChecking ? 'جاري الفحص...' : 'إعادة فحص الاتصال'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
