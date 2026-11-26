import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, ArrowUpCircle, X } from 'lucide-react';

interface AppVersionData {
  version?: string;
  buildTime?: number;
  buildTimestamp?: number;
  releaseDate?: string;
  notes?: string;
}

// Gentle low-bandwidth interval (10 minutes) — never stalls weak internet or forces reloads
const POLL_INTERVAL_MS = 10 * 60 * 1000;

function getVersionUrl(): string {
  const base = (import.meta as any).env?.BASE_URL || '/';
  const normalizedBase = base === './' ? '' : String(base).replace(/\/$/, '');
  return `${normalizedBase}/version.json?t=${Date.now()}`;
}

/**
 * Non-Intrusive Update Banner
 * ---------------------------
 * - NEVER auto-reloads the browser (prevents kicking logged-in staff back to the passcode screen).
 * - Does NOT reload on Firestore settings changes (Firestore onSnapshot applies settings live in memory).
 * - Only shows a small, dismissible corner notification when a new production build is deployed.
 */
export const AppUpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [detectedVersion, setDetectedVersion] = useState<string>('');
  const [updateNote, setUpdateNote] = useState<string>('');
  const [isReloadingNow, setIsReloadingNow] = useState(false);

  const initialVersionRef = useRef<string | null>(null);
  const dismissedVersionRef = useRef<string | null>(null);

  const executeManualReload = useCallback(async () => {
    setIsReloadingNow(true);
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.update().catch(() => {})));
      }
    } catch {
      // Proceed cleanly
    }
    window.location.reload();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkBuildVersion = async () => {
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
        const latestVer = String(data.version || data.buildTime || data.buildTimestamp || '').trim();
        if (!latestVer) return;

        if (initialVersionRef.current === null) {
          initialVersionRef.current = latestVer;
          return;
        }

        if (latestVer !== initialVersionRef.current && latestVer !== dismissedVersionRef.current) {
          setDetectedVersion(latestVer);
          setUpdateNote(data.notes || 'يتوفر إصدار محدث من المنظومة — يمكنك التحديث متى شئت.');
          setUpdateAvailable(true);
        }
      } catch {
        // Ignore silently on weak internet
      }
    };

    // Establish initial baseline once after idle delay, then check gently every 10 minutes
    const startupTimer = window.setTimeout(checkBuildVersion, 8000);
    const pollTimer = window.setInterval(checkBuildVersion, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      window.clearTimeout(startupTimer);
      window.clearInterval(pollTimer);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-[9950] max-w-sm w-[calc(100%-2rem)] animate-in fade-in slide-in-from-bottom-3 duration-200 font-['Tajawal',sans-serif]"
      dir="rtl"
    >
      <div className="rounded-2xl bg-slate-900/95 border border-sky-400/40 shadow-2xl p-3.5 text-white flex items-center gap-3 backdrop-blur-md">
        <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shrink-0">
          <ArrowUpCircle className="w-5 h-5 text-sky-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-white leading-tight">
            تحديث جديد متوفر {detectedVersion ? `(${detectedVersion})` : ''}
          </p>
          <p className="text-[11px] text-slate-300 leading-snug mt-0.5 line-clamp-2">
            {updateNote}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={executeManualReload}
            disabled={isReloadingNow}
            className="px-2.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReloadingNow ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </button>
          <button
            type="button"
            onClick={() => {
              dismissedVersionRef.current = detectedVersion;
              setUpdateAvailable(false);
            }}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
            title="تأجيل التحديث"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
