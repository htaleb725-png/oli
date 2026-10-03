import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';

export const NetworkStatusModal: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [showReconnectedToast, setShowReconnectedToast] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const consecutiveFailuresRef = useRef<number>(0);

  // Active check if network can actually reach external resources
  const checkRealConnection = useCallback(async (): Promise<boolean> => {
    // If navigator explicitly says offline, it's 100% offline
    if (!navigator.onLine) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2800);

      // Lightweight ping to reliable 204 endpoint without caching
      await fetch(`https://www.gstatic.com/generate_204?_t=${Date.now()}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return true;
    } catch {
      // Secondary fallback ping
      try {
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), 2800);
        await fetch(`https://cloudflare.com/cdn-cgi/trace?_t=${Date.now()}`, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller2.signal
        });
        clearTimeout(timeoutId2);
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  const handleManualRetry = async () => {
    setIsChecking(true);
    const hasNet = await checkRealConnection();
    setIsChecking(false);
    if (hasNet) {
      setIsOffline(false);
      consecutiveFailuresRef.current = 0;
      setShowReconnectedToast(true);
      setTimeout(() => setShowReconnectedToast(false), 4500);
    } else {
      setIsOffline(true);
    }
  };

  useEffect(() => {
    const handleBrowserOnline = async () => {
      const trulyOnline = await checkRealConnection();
      if (trulyOnline) {
        setIsOffline(false);
        consecutiveFailuresRef.current = 0;
        setShowReconnectedToast(true);
        setTimeout(() => setShowReconnectedToast(false), 4500);
      }
    };

    const handleBrowserOffline = () => {
      setIsOffline(true);
      consecutiveFailuresRef.current = 2;
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    // Fast and reliable connectivity heartbeat every 5 seconds
    const interval = setInterval(async () => {
      if (!navigator.onLine) {
        setIsOffline(true);
        consecutiveFailuresRef.current = 2;
        return;
      }

      const isConnected = await checkRealConnection();
      if (!isConnected) {
        consecutiveFailuresRef.current += 1;
        // Require at least 1 confirmed failure to trigger offline modal immediately
        if (consecutiveFailuresRef.current >= 1) {
          setIsOffline(true);
        }
      } else {
        if (consecutiveFailuresRef.current > 0 || isOffline) {
          setIsOffline(false);
          setShowReconnectedToast(true);
          setTimeout(() => setShowReconnectedToast(false), 4500);
        }
        consecutiveFailuresRef.current = 0;
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      clearInterval(interval);
    };
  }, [checkRealConnection, isOffline]);

  return (
    <>
      {/* ---------------- TOAST: RECONNECTED SUCCESS ---------------- */}
      {showReconnectedToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
          <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/50 flex items-center gap-3 backdrop-blur-md">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            </div>
            <div className="text-right">
              <h4 className="font-extrabold text-sm text-white">تمت استعادة الاتصال بالإنترنت</h4>
              <p className="text-[11px] text-emerald-100 font-medium">تمت إعادة المزامنة اللحظية مع السحابة بنجاح ⚡</p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: ELEGANT OFFLINE APOLOGY OVERLAY ---------------- */}
      {isOffline && (
        <div 
          className="fixed inset-0 z-[99990] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-300"
          dir="rtl"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 text-center relative overflow-hidden transition-colors duration-200">
            {/* Top decorative gradient glow */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600"></div>

            {/* Glowing Icon Container */}
            <div className="relative mx-auto w-20 h-20 mb-5">
              <div className="absolute inset-0 bg-rose-500/20 rounded-full animate-ping opacity-75"></div>
              <div className="relative w-20 h-20 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 rounded-full flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-inner">
                <WifiOff className="w-10 h-10" />
              </div>
            </div>

            {/* Apology Heading */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold mb-3">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>تنبيه انقطاع الاتصال</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
              نعتذر منك.. انقطع الاتصال بالإنترنت
            </h3>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-normal">
              يبدو أن جهازك (الحاسوب أو الهاتف) فقد الاتصال بشبكة الإنترنت حالياً. 
              يرجى التحقق من كابل الشبكة، أو شبكة الواي فاي (Wi-Fi)، أو باقة البيانات للمتابعة.
              <br />
              <span className="font-semibold text-slate-800 dark:text-slate-200 mt-2 block">
                سيتم استئناف العمل فوراً وتلقائياً بمجرد عودة الاتصال دون الحاجة لتحديث الصفحة.
              </span>
            </p>

            {/* Safety Assurance Note */}
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-3.5 mb-6 text-right flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">بياناتك المسجلة محفوظة بأمان:</span>
                <span className="text-slate-500 dark:text-slate-400">
                  جميع العمليات محفوظة محلياً في الذاكرة المؤقتة وسيتم رفعها ومزامنتها فور عودة الشبكة.
                </span>
              </div>
            </div>

            {/* Retry Button */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <button
                type="button"
                onClick={handleManualRetry}
                disabled={isChecking}
                className="w-full sm:w-auto flex-1 h-12 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-bold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'جاري فحص الاتصال...' : 'إعادة فحص الاتصال الآن'}</span>
              </button>
            </div>

            {/* Footer Device Hint */}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4">
              منظومة مكتب النائب علا الناشي • وحدة الحماية الذكية من انقطاع الشبكة
            </p>
          </div>
        </div>
      )}
    </>
  );
};
