import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Sparkles, Rocket, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AppVersionInfo {
  version: string;
  buildTimestamp: number;
}

export const AppUpdateNotification: React.FC = () => {
  const { systemSettings } = useApp();
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [newVersionDetails, setNewVersionDetails] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(4);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Store the version active when the current page session opened
  const currentBuildRef = useRef<number | null>(null);
  const currentVersionRef = useRef<string | null>(null);

  // Calculate reliable absolute URL for version.json based on current URL path (supports GitHub Pages sub-directories)
  const getVersionUrl = (): string => {
    const origin = window.location.origin;
    let pathname = window.location.pathname;
    
    // Remove any trailing html file if present
    if (pathname.endsWith('.html')) {
      pathname = pathname.substring(0, pathname.lastIndexOf('/') + 1);
    }
    
    // Ensure path ends with slash
    if (!pathname.endsWith('/')) {
      pathname += '/';
    }

    return `${origin}${pathname}version.json?_t=${Date.now()}`;
  };

  // Apply update and reload cleanly bypassing browser cache
  const triggerAppUpdate = async () => {
    setIsUpdating(true);
    try {
      // 1. Clear any cached service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      // 2. Unregister service workers to force latest fetch
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }
    } catch (e) {
      console.warn('Cache clearing notice:', e);
    }
    // Hard reload from server
    window.location.reload();
  };

  // Check version from the deployed host (e.g. GitHub Pages or Hosting)
  const checkForUpdate = async () => {
    try {
      const url = getVersionUrl();
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!res.ok) return;

      const data: AppVersionInfo = await res.json();
      if (!data || !data.buildTimestamp) return;

      // First time initialization on page boot
      if (currentBuildRef.current === null) {
        currentBuildRef.current = data.buildTimestamp;
        currentVersionRef.current = data.version;
        console.log(`[Version Watcher] Current session build: ${data.version} (${data.buildTimestamp})`);
        return;
      }

      // If the server has a newer build timestamp or different version
      if (data.buildTimestamp > currentBuildRef.current || (data.version && data.version !== currentVersionRef.current)) {
        console.log(`[Version Watcher] New deployment detected! Server: ${data.buildTimestamp}, Current: ${currentBuildRef.current}`);
        setNewVersionDetails(data.version || 'إصدار أحدث');
        setUpdateAvailable(true);
      }
    } catch {
      // Silent catch on network drop
    }
  };

  // Watch for Firestore remote update trigger (instant live push)
  useEffect(() => {
    const remoteTimestamp = (systemSettings as any)?.lastDeployTimestamp || (systemSettings as any)?.buildTimestamp;
    const remoteVersion = (systemSettings as any)?.appVersion;

    if (remoteTimestamp && currentBuildRef.current && remoteTimestamp > currentBuildRef.current) {
      setNewVersionDetails(remoteVersion || 'إصدار سحابي جديد');
      setUpdateAvailable(true);
    }
  }, [systemSettings]);

  // Periodic polling every 10 seconds & tab visibility check
  useEffect(() => {
    // Initial check to register current build
    checkForUpdate();

    // Check every 10 seconds for rapid detection upon GitHub Pages deploy
    const interval = setInterval(checkForUpdate, 10000);

    // Also check immediately when the user switches back to this tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Automatic smooth countdown when update is detected
  useEffect(() => {
    if (!updateAvailable) return;

    if (countdown <= 0) {
      triggerAppUpdate();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [updateAvailable, countdown]);

  if (!updateAvailable) return null;

  return (
    <div 
      className="fixed inset-0 z-[99995] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-300"
      dir="rtl"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center relative overflow-hidden transition-colors duration-200">
        {/* Animated Gradient Bar at top */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 animate-pulse"></div>

        {/* Rocket / Update Icon */}
        <div className="relative mx-auto w-20 h-20 mb-5">
          <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping opacity-75"></div>
          <div className="relative w-20 h-20 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
            <Rocket className="w-10 h-10 animate-bounce" />
          </div>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>تحديث جديد متاح {newVersionDetails ? `(${newVersionDetails})` : ''}</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
          يرجى الانتظار.. جاري تحديث التطبيق
        </h3>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-normal">
          تم نشر إصدار جديد وتحديثات برمجية للمنظومة على السيرفر. 
          نقوم الآن بتجهيز أحدث نسخة لتثبيت التحسينات والميزات الجديدة لجهازك.
        </p>

        {/* Progress Countdown Bar */}
        <div className="bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-4 mb-6 border border-slate-200 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            <span>تطبيق التحديث تلقائياً:</span>
            <span className="font-mono text-blue-600 dark:text-blue-400 text-sm">
              {countdown > 0 ? `خلال ${countdown} ثوانٍ` : 'جاري التحديث الآن...'}
            </span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${Math.max(10, ((4 - countdown) / 4) * 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Security & Data Integrity Assurance */}
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-6">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>بياناتك وموقعك محفوظان في السحابة بأمان تام</span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={triggerAppUpdate}
          disabled={isUpdating}
          className="w-full h-12 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-bold text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
          <span>{isUpdating ? 'جاري إعادة التحميل وتطبيق التحديث...' : 'تحديث التطبيق فوراً الآن'}</span>
        </button>

        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4">
          منظومة مكتب النائب علا الناشي • نظام التحديثات الحية الذكية
        </p>
      </div>
    </div>
  );
};
