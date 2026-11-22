import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Sparkles, X, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AppVersionData {
  version: string;
  buildTime: number;
  notes?: string;
}

interface RemoteSettingsPayload {
  systemSettings?: Record<string, any>;
  customSections?: any[];
  settingsVersion?: number;
  updateSummary?: string;
  updatedBy?: string;
}

const STORAGE_KEY_PREFIX = 'al_nashi_office_v3_';

export const AppUpdateNotification: React.FC = () => {
  const { systemSettings, logout, isAuthenticated, currentUser } = useApp();
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateNotes, setUpdateNotes] = useState<string>('');
  const [updateKind, setUpdateKind] = useState<'icons_settings' | 'build'>('icons_settings');
  const [isUpdating, setIsUpdating] = useState(false);

  const initialVersionRef = useRef<string | null>(null);
  const baselineSettingsVersionRef = useRef<number>(0);
  const pendingRemotePayloadRef = useRef<RemoteSettingsPayload | null>(null);
  const dismissedVersionRef = useRef<number>(0);

  // Initialize session baseline settings version
  useEffect(() => {
    try {
      const storedBaseline = Number(sessionStorage.getItem('al_nashi_baseline_settings_ver') || '0');
      const localVer = Number(systemSettings?.settingsVersion || 0);
      baselineSettingsVersionRef.current = Math.max(storedBaseline, localVer);
    } catch {
      baselineSettingsVersionRef.current = Number(systemSettings?.settingsVersion || 0);
    }
  }, []);

  // Poll /api/settings every 5 seconds & version.json every 45 seconds so any icon/settings change propagates to ALL users immediately
  useEffect(() => {
    let isMounted = true;

    const checkSettingsBroadcast = async () => {
      try {
        const res = await fetch(`/api/settings?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok || !isMounted) return;
        const data = await res.json();
        const remoteVer = Number(data?.settingsVersion || data?.systemSettings?.settingsVersion || 0);
        if (!remoteVer) return;

        // First poll establishes baseline if none existed yet
        if (baselineSettingsVersionRef.current === 0) {
          baselineSettingsVersionRef.current = remoteVer;
          try {
            sessionStorage.setItem('al_nashi_baseline_settings_ver', String(remoteVer));
          } catch {}
          return;
        }

        // Ignore updates initiated by THIS same browser tab (e.g. Developer currently editing icons)
        let localInitiatedVer = 0;
        try {
          localInitiatedVer = Number(sessionStorage.getItem('al_nashi_local_initiated_settings_ver') || '0');
        } catch {}

        if (remoteVer <= localInitiatedVer) {
          baselineSettingsVersionRef.current = Math.max(baselineSettingsVersionRef.current, remoteVer);
          return;
        }

        // Another user / Developer published a newer icon or settings version!
        if (remoteVer > baselineSettingsVersionRef.current && remoteVer !== dismissedVersionRef.current) {
          pendingRemotePayloadRef.current = {
            systemSettings: data.systemSettings,
            customSections: data.customSections,
            settingsVersion: remoteVer,
            updateSummary: data.updateSummary || data.systemSettings?.lastUpdateNote,
            updatedBy: data.updatedBy || data.systemSettings?.lastUpdatedBy
          };
          setUpdateKind('icons_settings');
          setUpdateNotes(
            data.updateSummary ||
              data.systemSettings?.lastUpdateNote ||
              'قام المطور بتحديث أيقونات وإعدادات المنظومة. يرجى الضغط على تحديث لتطبيق الأيقونات الجديدة وإعادة الدخول.'
          );
          setHasUpdate(true);
        }
      } catch {
        // Ignore transient network errors
      }
    };

    const checkBuildVersion = async () => {
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok || !isMounted) return;
        const data: AppVersionData = await response.json();
        const latestVer = String(data.version || data.buildTime);

        if (initialVersionRef.current === null) {
          initialVersionRef.current = latestVer;
          return;
        }

        if (latestVer !== initialVersionRef.current) {
          setUpdateKind('build');
          setUpdateNotes(data.notes || 'تم إطلاق تحديث جديد للمنظومة مع تحسينات في الأداء والأيقونات.');
          setHasUpdate(true);
        }
      } catch {
        // Ignore
      }
    };

    // Immediate check on mount
    checkSettingsBroadcast();
    checkBuildVersion();

    const settingsInterval = setInterval(checkSettingsBroadcast, 5000);
    const buildInterval = setInterval(checkBuildVersion, 45000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSettingsBroadcast();
        checkBuildVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkSettingsBroadcast);

    return () => {
      isMounted = false;
      clearInterval(settingsInterval);
      clearInterval(buildInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkSettingsBroadcast);
    };
  }, []);

  // Also detect cross-tab localStorage updates on the same browser or Firestore real-time settingsVersion bumps
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
      remoteVer > localInitiatedVer &&
      remoteVer !== dismissedVersionRef.current
    ) {
      setUpdateKind('icons_settings');
      setUpdateNotes(
        systemSettings.lastUpdateNote ||
          'تم تحديث أيقونات وإعدادات النظام بواسطة المطور. اضغط تحديث لتطبيق التعديلات فوراً.'
      );
      setHasUpdate(true);
    }
  }, [systemSettings?.settingsVersion, systemSettings?.lastUpdateNote]);

  const handleApplyUpdateAndLogout = async () => {
    setIsUpdating(true);
    try {
      // 1. Fetch freshest settings & custom sections from server so ALL icons across the app update cleanly
      let payload = pendingRemotePayloadRef.current;
      try {
        const res = await fetch(`/api/settings?t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const fresh = await res.json();
          payload = {
            systemSettings: fresh.systemSettings,
            customSections: fresh.customSections,
            settingsVersion: Number(fresh.settingsVersion || fresh.systemSettings?.settingsVersion || Date.now()),
            updateSummary: fresh.updateSummary
          };
        }
      } catch {}

      if (payload?.systemSettings && Object.keys(payload.systemSettings).length > 0) {
        try {
          const existingRaw = localStorage.getItem(STORAGE_KEY_PREFIX + 'settings');
          const existing = existingRaw ? JSON.parse(existingRaw) : {};
          const merged = { ...existing, ...payload.systemSettings };
          localStorage.setItem(STORAGE_KEY_PREFIX + 'settings', JSON.stringify(merged));
        } catch {}
      }

      if (Array.isArray(payload?.customSections) && payload.customSections.length > 0) {
        try {
          localStorage.setItem(STORAGE_KEY_PREFIX + 'custom_sections', JSON.stringify(payload.customSections));
        } catch {}
      }

      if (payload?.settingsVersion) {
        try {
          sessionStorage.setItem('al_nashi_baseline_settings_ver', String(payload.settingsVersion));
        } catch {}
      }

      // 2. Clear browser static caches (keeping local data intact)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // 3. Log out cleanly so user re-enters the refreshed system with the new icons across the entire app
      if (isAuthenticated && currentUser) {
        logout();
      }
      try {
        sessionStorage.removeItem('al_nashi_active_session');
        localStorage.removeItem('al_nashi_current_user');
      } catch {}

      // 4. Hard reload cleanly into the updated app
      setTimeout(() => {
        window.location.reload();
      }, 250);
    } catch {
      window.location.reload();
    }
  };

  if (!hasUpdate) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-300 font-['Tajawal',sans-serif]"
      dir="rtl"
    >
      <div className="relative w-full max-w-md bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border-2 border-amber-400/70 rounded-3xl p-6 shadow-2xl text-white overflow-hidden">
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Sparkles className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[11px] font-black">
              <span>{updateKind === 'icons_settings' ? 'تحديث أيقونات وإعدادات النظام' : 'تحديث جديد للمنظومة'}</span>
            </div>
            <h3 className="text-lg font-black text-white">
              يتوفر تحديث جديد من المطور!
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              {updateNotes}
            </p>
            <p className="text-[11px] text-amber-300/90 font-bold pt-1">
              عند الضغط على «تحديث وإعادة الدخول» سيتم تحديث الأيقونات في كامل التطبيق والخروج تلقائياً لإعادة الدخول بالنسخة المحدثة.
            </p>
          </div>

          <div className="w-full flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleApplyUpdateAndLogout}
              disabled={isUpdating}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 disabled:opacity-70"
            >
              {isUpdating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>{isUpdating ? 'جاري التحديث والخروج...' : 'تحديث والخروج الآن'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                dismissedVersionRef.current = Number(pendingRemotePayloadRef.current?.settingsVersion || systemSettings?.settingsVersion || Date.now());
                setHasUpdate(false);
              }}
              disabled={isUpdating}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title="تأجيل التحديث مؤقتاً"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
