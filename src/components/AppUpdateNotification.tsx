import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';

interface AppVersionData {
  version?: string;
  buildTime?: number;
  buildTimestamp?: number;
  releaseDate?: string;
}

// Poll /version.json cleanly every 45 seconds + immediately on tab focus/visibility
const POLL_INTERVAL_MS = 45 * 1000;
const AUTO_RELOAD_DELAY_MS = 1800; // 1.8 seconds (within 1.5s–2s calm transition window)

function getVersionUrl(): string {
  const base = (import.meta as any).env?.BASE_URL || '/';
  const normalizedBase = base === './' ? '' : String(base).replace(/\/$/, '');
  return `${normalizedBase}/version.json?t=${Date.now()}`;
}

/**
 * Self-Contained Auto-Update Modal ("جاري التحديث")
 * -------------------------------------------------
 * - Detects new GitHub/Vercel deployments via /version.json build version changes.
 * - Renders a calm, completely isolated centered modal with smooth progress bar.
 * - Auto-reloads after ~1.8s without touching login session, Firestore data, or app theme.
 */
export const AppUpdateNotification: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState(12);

  const initialVersionRef = useRef<string | null>(null);
  const hasTriggeredReloadRef = useRef<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    let reloadTimer: number | null = null;
    let progressTimer: number | null = null;

    const triggerGracefulReload = () => {
      if (hasTriggeredReloadRef.current || !isMounted) return;
      hasTriggeredReloadRef.current = true;
      setIsUpdating(true);
      setProgress(18);

      // Smooth visual fill over ~1.8s
      const startedAt = Date.now();
      progressTimer = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const pct = Math.min(98, Math.round(18 + (elapsed / AUTO_RELOAD_DELAY_MS) * 80));
        setProgress(pct);
      }, 60);

      reloadTimer = window.setTimeout(async () => {
        if (progressTimer !== null) window.clearInterval(progressTimer);
        setProgress(100);
        try {
          // Clear stale browser Cache API assets only — NEVER touch localStorage auth session or Firestore!
          if (typeof window !== 'undefined' && 'caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map((name) => caches.delete(name)));
          }
          if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((reg) => reg.update().catch(() => {})));
          }
        } catch {
          // Proceed safely with reload
        }
        window.location.reload();
      }, AUTO_RELOAD_DELAY_MS);
    };

    const checkBuildVersion = async () => {
      if (hasTriggeredReloadRef.current) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 5000);
        const response = await fetch(getVersionUrl(), {
          cache: 'no-store',
          signal: controller.signal
        });
        window.clearTimeout(timeoutId);
        if (!response.ok || !isMounted) return;

        const data: AppVersionData = await response.json();
        const latestVer = String(
          data.version || data.buildTimestamp || data.buildTime || data.releaseDate || ''
        ).trim();
        if (!latestVer) return;

        if (initialVersionRef.current === null) {
          initialVersionRef.current = latestVer;
          return;
        }

        if (latestVer !== initialVersionRef.current) {
          triggerGracefulReload();
        }
      } catch {
        // Ignore transient network hiccups quietly
      }
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      checkBuildVersion();
    };

    // Capture baseline immediately on startup, then check periodically and on tab focus
    checkBuildVersion();
    const pollTimer = window.setInterval(checkBuildVersion, POLL_INTERVAL_MS);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      isMounted = false;
      window.clearInterval(pollTimer);
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);
      if (progressTimer !== null) window.clearInterval(progressTimer);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  if (!isUpdating) return null;

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
      role="status"
      aria-live="polite"
      data-no-text-replace="true"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-700/80 shadow-2xl p-6 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center shadow-inner">
          <RefreshCw className="w-7 h-7 text-blue-600 dark:text-blue-400 animate-spin" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
            جاري التحديث
          </h3>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            يتم الآن تحميل أحدث نسخة من النظام تلقائياً...
          </p>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-l from-blue-600 via-sky-500 to-blue-500 transition-all duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
