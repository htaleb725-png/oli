import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, ArrowUpCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AppVersionData {
  version?: string;
  buildTime?: number;
  buildTimestamp?: number;
  releaseDate?: string;
  notes?: string;
}

const POLL_INTERVAL_MS = 15_000; // Check /version.json every 15 seconds
const COUNTDOWN_SECONDS = 60; // 60-second automatic update countdown

function getVersionUrl(): string {
  const base = (import.meta as any).env?.BASE_URL || '/';
  const normalizedBase = base === './' ? '' : String(base).replace(/\/$/, '');
  return `${normalizedBase}/version.json?t=${Date.now()}`;
}

export const AppUpdateNotification: React.FC = () => {
  const { systemSettings } = useApp();
  const [updateActive, setUpdateActive] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [updateSubtitle, setUpdateSubtitle] = useState(
    'تم إصدار نسخة محدثة من منظومة مكتب النائب علا الناشي. سيتم تحديث الصفحة تلقائياً لتطبيق آخر التحسينات ومزامنة البيانات.'
  );
  const [detectedVersion, setDetectedVersion] = useState<string>('');
  const [isReloadingNow, setIsReloadingNow] = useState(false);

  const initialVersionRef = useRef<string | null>(null);
  const baselineSettingsVersionRef = useRef<number>(0);
  const hasTriggeredReloadRef = useRef(false);

  const executeCleanReload = useCallback(async () => {
    if (hasTriggeredReloadRef.current) return;
    hasTriggeredReloadRef.current = true;
    setIsReloadingNow(true);

    try {
      // Clear browser static asset caches so fresh index.html and JS chunks load immediately
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      // Update any registered service workers cleanly
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.update().catch(() => {})));
      }
    } catch {
      // Proceed to reload regardless
    }

    window.location.reload();
  }, []);

  // Trigger the 60-second Glassmorphism update overlay
  const startUpdateOverlay = useCallback((versionLabel?: string, subtitle?: string) => {
    setUpdateActive((alreadyOpen) => {
      if (alreadyOpen) return true;
      setCountdown(COUNTDOWN_SECONDS);
      if (versionLabel) setDetectedVersion(versionLabel);
      if (subtitle) setUpdateSubtitle(subtitle);
      return true;
    });
  }, []);

  // Initialize settings baseline version
  useEffect(() => {
    try {
      const storedBaseline = Number(sessionStorage.getItem('al_nashi_baseline_settings_ver') || '0');
      const localVer = Number(systemSettings?.settingsVersion || 0);
      baselineSettingsVersionRef.current = Math.max(storedBaseline, localVer);
    } catch {
      baselineSettingsVersionRef.current = Number(systemSettings?.settingsVersion || 0);
    }
  }, []);

  // Poll /version.json every 15 seconds with no-store cache busting
  useEffect(() => {
    let isMounted = true;

    const checkBuildVersion = async () => {
      try {
        let response = await fetch(getVersionUrl(), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache'
          }
        });
        // Fallback to root /version.json if relative path fails on nested route
        if (!response.ok) {
          response = await fetch(`/version.json?t=${Date.now()}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              Pragma: 'no-cache'
            }
          });
        }
        if (!response.ok || !isMounted) return;

        const data: AppVersionData = await response.json();
        const latestVer = String(data.version || data.buildTime || data.buildTimestamp || '').trim();
        if (!latestVer) return;

        if (initialVersionRef.current === null) {
          initialVersionRef.current = latestVer;
          return;
        }

        if (latestVer !== initialVersionRef.current) {
          startUpdateOverlay(
            latestVer,
            data.notes ||
              'تم إطلاق تحديث جديد للمنظومة على الخادم. سيتم تحديث الصفحة تلقائياً خلال ثوانٍ لتطبيق النسخة الأحدث.'
          );
        }
      } catch {
        // Silently ignore transient network hiccups during background version check
      }
    };

    // Immediate baseline check on mount, then every 15 seconds
    checkBuildVersion();
    const pollTimer = window.setInterval(checkBuildVersion, POLL_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkBuildVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkBuildVersion);

    return () => {
      isMounted = false;
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkBuildVersion);
    };
  }, [startUpdateOverlay]);

  // Also detect remote developer icon/settings version bumps via Firestore real-time state
  useEffect(() => {
    const remoteVer = Number(systemSettings?.settingsVersion || 0);
    if (!remoteVer) return;

    let localInitiatedVer = 0;
    try {
      localInitiatedVer = Number(sessionStorage.getItem('al_nashi_local_initiated_settings_ver') || '0');
    } catch {}

    if (
      baselineSettingsVersionRef.current > 0 &&
      remoteVer > baselineSettingsVersionRef.current &&
      remoteVer > localInitiatedVer
    ) {
      try {
        sessionStorage.setItem('al_nashi_baseline_settings_ver', String(remoteVer));
      } catch {}
      startUpdateOverlay(
        `v${remoteVer}`,
        systemSettings.lastUpdateNote ||
          'تم تحديث إعدادات وأيقونات المنظومة من قبل الإدارة. سيتم إعادة تحميل الصفحة تلقائياً لتطبيق التحديث.'
      );
    }
  }, [systemSettings?.settingsVersion, systemSettings?.lastUpdateNote, startUpdateOverlay]);

  // 60-second live countdown -> automatic window.location.reload()
  useEffect(() => {
    if (!updateActive) return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          executeCleanReload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [updateActive, executeCleanReload]);

  if (!updateActive) return null;

  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((COUNTDOWN_SECONDS - countdown) / COUNTDOWN_SECONDS) * 100))
  );

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-xl transition-opacity duration-300 font-['Tajawal',sans-serif]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-update-title"
      dir="rtl"
    >
      {/* Glassmorphism Card */}
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900/75 border border-white/15 shadow-[0_24px_80px_-16px_rgba(0,0,0,0.65)] backdrop-blur-2xl overflow-hidden text-white">
        {/* Subtle top specular hairline */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-sky-300/60 to-transparent pointer-events-none" />

        <div className="p-7 sm:p-8 flex flex-col items-center text-center">
          {/* Animated Refresh Icon Emblem */}
          <div className="relative mb-5 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center shadow-inner">
              <RefreshCw
                className="w-8 h-8 text-sky-300 animate-spin"
                style={{ animationDuration: '2.4s' }}
              />
            </div>
          </div>

          {/* Primary Heading */}
          <h2
            id="system-update-title"
            className="text-xl sm:text-2xl font-extrabold tracking-tight text-white mb-2"
          >
            جاري تحديث النظام...
          </h2>

          {/* Explanatory Copy */}
          <p className="text-sm text-slate-300 leading-relaxed max-w-sm mb-6">
            {updateSubtitle}
          </p>

          {/* Countdown & Progress Panel */}
          <div className="w-full rounded-2xl bg-white/[0.05] border border-white/10 p-4 mb-6">
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="text-slate-300 font-semibold">
                {isReloadingNow ? 'جاري إعادة تحميل المنظومة الآن...' : 'الوقت المتبقي للتحديث التلقائي'}
              </span>
              <span className="font-mono tabular-nums text-sky-300 font-bold text-sm">
                {countdown} ثانية
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-l from-sky-400 to-blue-500 transition-all duration-1000 ease-linear"
                style={{ width: `${isReloadingNow ? 100 : progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5">
              <span>{detectedVersion ? `الإصدار الجديد: ${detectedVersion}` : 'نسخة محدثة جاهزة'}</span>
              <span className="font-mono tabular-nums">{isReloadingNow ? '100%' : `${progressPercent}%`}</span>
            </div>
          </div>

          {/* Immediate Reload Action */}
          <button
            type="button"
            onClick={executeCleanReload}
            disabled={isReloadingNow}
            className="w-full py-3 px-5 rounded-xl bg-sky-500 hover:bg-sky-400 active:scale-[0.99] text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 transition-all cursor-pointer disabled:opacity-70"
          >
            {isReloadingNow ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUpCircle className="w-4 h-4" />
            )}
            <span>{isReloadingNow ? 'جاري إعادة التحميل...' : 'تحديث النظام الآن'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
