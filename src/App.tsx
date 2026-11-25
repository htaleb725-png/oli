import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { SplashLanding } from './components/SplashLanding';
import { Navbar } from './components/Navbar';
import { NewsTicker } from './components/NewsTicker';
import { DashboardModule } from './components/DashboardModule';
import { ReceptionModule } from './components/ReceptionModule';
import { AdminModule } from './components/AdminModule';
import { InterviewsModule } from './components/InterviewsModule';
import { OrganizationModule } from './components/OrganizationModule';
import { DirectorExecutiveModule } from './components/DirectorExecutiveModule';
import { GlobalSearchArchiveModule } from './components/GlobalSearchArchiveModule';
import { WhatsAppModule } from './components/WhatsAppModule';
import { AuditModule } from './components/AuditModule';
import { ReportsModule } from './components/ReportsModule';
import { MasterAdminModule } from './components/MasterAdminModule';
import { AppsScriptSyncModule } from './components/AppsScriptSyncModule';
import { DynamicSectionView } from './components/DynamicSectionView';
import { DriveRequestsArchiveModule } from './components/DriveRequestsArchiveModule';
import { BlacklistModule } from './components/BlacklistModule';
import { PrintableIdCard } from './components/PrintableIdCard';
import { PrintableReviewBadge } from './components/PrintableReviewBadge';
import { PrintableSmartArchiveDossier } from './components/PrintableSmartArchiveDossier';
import { CitizenHistoryModal } from './components/CitizenHistoryModal';
import { DesktopInstallModal } from './components/DesktopInstallModal';
import { SystemWipeModal } from './components/SystemWipeModal';
import { NetworkStatusModal } from './components/NetworkStatusModal';
import { AppUpdateNotification } from './components/AppUpdateNotification';
import { SessionLoadingOverlay } from './components/SessionLoadingOverlay';
import { MobileAppBottomNav } from './components/MobileAppBottomNav';
import { AdminLogoutExportModal } from './components/AdminLogoutExportModal';
import { CloudSyncStatusBanner } from './components/CloudSyncStatusBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { playUiClickSound } from './utils/audio';
import {
  canUserAccessSection,
  getHomeSectionForRole,
  SOCIAL_CARE_LEGACY_CUSTOM_ID
} from './utils/permissions';
import { generatePwaPngIcons, buildInlineManifestDataUrl } from './utils/pwaIconHelper';

const MainAppLayout: React.FC = () => {
  const { 
    isAuthenticated, 
    activeSection, 
    currentUser, 
    setActiveSection,
    logout,
    isDesktopInstallModalOpen,
    setIsDesktopInstallModalOpen,
    isSystemWipeModalOpen,
    setIsSystemWipeModalOpen,
    departmentGreeting,
    setDepartmentGreeting,
    syncAllToFirestoreNow,
    isSessionLoading,
    sessionLoadingMessage,
    systemSettings,
    updateSystemSettings,
    customSections
  } = useApp();

  const [isCloudSyncing, setIsCloudSyncing] = React.useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = React.useState<string | null>(null);
  const [showAdminLogoutModal, setShowAdminLogoutModal] = React.useState(false);

  const handleRequestLogout = () => {
    if (currentUser?.Role === 'admin' || currentUser?.Role === 'director' || currentUser?.Role === 'developer') {
      setShowAdminLogoutModal(true);
    } else {
      logout();
    }
  };

  const lastRenderedLogoRef = React.useRef<string>('');
  const generatedIconsForLogoRef = React.useRef<string>('');

  // Dynamic Browser Tab Title, Favicon & Genuine PNG Desktop PWA App Icon Sync (AI Studio + Vercel)
  React.useEffect(() => {
    let cancelled = false;
    if (systemSettings?.appName) {
      document.title = systemSettings.appName;
    }

    const customLogo = (
      systemSettings?.logoUrl ||
      systemSettings?.customImages?.appIcon ||
      ''
    ).trim();
    const existing192 = (systemSettings?.pwaIcon192 || '').trim();
    const existing512 = (systemSettings?.pwaIcon512 || '').trim();
    const versionTag = String(
      systemSettings?.settingsVersion ||
        (existing192 ? existing192.length : 0) + (customLogo ? customLogo.length : 1)
    );

    const applyIconsToDom = async (png192: string, png512: string) => {
      if (cancelled) return;
      const faviconHref =
        png192 ||
        (customLogo.startsWith('data:image/')
          ? customLogo
          : customLogo
          ? `/api/pwa-icon/192?v=${encodeURIComponent(versionTag)}`
          : './icon.svg');

      const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (favicon) favicon.href = faviconHref;
      const touchIcon = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
      if (touchIcon) touchIcon.href = faviconHref;

      const manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null;
      if (!manifestLink) return;

      if (!cancelled && png192 && png512) {
        manifestLink.setAttribute(
          'href',
          buildInlineManifestDataUrl(
            systemSettings?.appName || 'نظام مكتب النائب علا الناشي',
            png192,
            png512
          )
        );
      }
    };

    (async () => {
      let final192 = existing192;
      let final512 = existing512;

      // Guard: generate PNG icons at most ONCE per unique customLogo to prevent Firestore/state feedback loops
      if (
        customLogo &&
        generatedIconsForLogoRef.current !== customLogo &&
        (!final192 || !final512 || (lastRenderedLogoRef.current && lastRenderedLogoRef.current !== customLogo))
      ) {
        generatedIconsForLogoRef.current = customLogo;
        const generated = await generatePwaPngIcons(customLogo);
        if (!cancelled && generated) {
          final192 = generated.icon192;
          final512 = generated.icon512;
          lastRenderedLogoRef.current = customLogo;
          if (final192 !== existing192 || final512 !== existing512) {
            updateSystemSettings({
              pwaIcon192: final192,
              pwaIcon512: final512
            });
          }
        }
      } else if (customLogo && final192 && final512) {
        lastRenderedLogoRef.current = customLogo;
      }

      await applyIconsToDom(final192, final512);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    systemSettings?.appName,
    systemSettings?.logoUrl,
    systemSettings?.pwaIcon192,
    systemSettings?.pwaIcon512,
    systemSettings?.settingsVersion
  ]);

  const handleManualCloudSync = async () => {
    setIsCloudSyncing(true);
    try {
      const res = await syncAllToFirestoreNow();
      setCloudSyncMsg(`تمت المزامنة مع Firebase (${res.successCount} عنصر) ☁️`);
      setTimeout(() => setCloudSyncMsg(null), 4000);
    } catch {
      setCloudSyncMsg('فشلت المزامنة');
      setTimeout(() => setCloudSyncMsg(null), 4000);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Global sound listener: any click on an icon, button, or clickable element plays the sound
  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | SVGElement | null;
      if (!target) return;
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('svg') ||
        target.closest('[role="button"]') ||
        target.closest('.cursor-pointer') ||
        target.closest('[data-clickable="true"]') ||
        target.closest('input[type="button"]') ||
        target.closest('input[type="submit"]') ||
        target.closest('summary') ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.tagName === 'SVG' ||
        target.tagName === 'svg' ||
        target.tagName === 'PATH' ||
        target.tagName === 'path' ||
        (typeof SVGElement !== 'undefined' && target instanceof SVGElement)
      ) {
        playUiClickSound();
      }
    };

    window.addEventListener('click', handleGlobalClick, { capture: true });
    return () => window.removeEventListener('click', handleGlobalClick, { capture: true });
  }, []);

  React.useEffect(() => {
    if (departmentGreeting) {
      const timer = setTimeout(() => {
        setDepartmentGreeting(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [departmentGreeting, setDepartmentGreeting]);

  // Developer Live Global Text Replacement Engine (applies anywhere in the UI safely)
  React.useEffect(() => {
    const rules = (systemSettings?.textReplacements || []).filter(
      (r) => r.from && r.to && r.from.trim() !== '' && r.from !== r.to
    );
    if (rules.length === 0) return;

    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'CODE', 'PRE']);
    let isApplying = false;

    const applyToTree = () => {
      if (isApplying || !document.body) return;
      isApplying = true;
      try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
          const parentEl = node.parentElement;
          if (
            parentEl &&
            !SKIP_TAGS.has(parentEl.tagName) &&
            !parentEl.closest('[data-no-text-replace="true"]')
          ) {
            const currentText = node.nodeValue;
            if (currentText && currentText.trim().length > 0) {
              let nextText = currentText;
              for (const rule of rules) {
                if (nextText.includes(rule.from)) {
                  nextText = nextText.split(rule.from).join(rule.to);
                }
              }
              if (nextText !== currentText) {
                node.nodeValue = nextText;
              }
            }
          }
          node = walker.nextNode();
        }
      } finally {
        isApplying = false;
      }
    };

    let debounceTimer: number | null = null;
    const observer = new MutationObserver(() => {
      if (isApplying) return;
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        observer.disconnect();
        applyToTree();
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
      }, 180);
    });

    applyToTree();
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer.disconnect();
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    };
  }, [systemSettings?.textReplacements, activeSection, isAuthenticated]);

  if (!isAuthenticated) {
    return <SplashLanding />;
  }

  const renderActiveModule = () => {
    // Strict centralized RBAC guard (including standalone Social Care & custom sections)
    if (!canUserAccessSection(currentUser, activeSection, customSections)) {
      const homeSec = getHomeSectionForRole(currentUser?.Role);
      return (
        <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 max-w-lg mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">هذا القسم غير متاح لصلاحية حسابك</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              أنت مسجل حالياً كـ ({currentUser?.RoleArabic}). يرجى استخدام الأقسام المخصصة لمهامك الإدارية أو التواصل مع المطور أو المدير التنفيذي لمنحك الصلاحية.
            </p>
          </div>
          <button
            onClick={() => setActiveSection(homeSec)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            العودة إلى قسمك المعتمد ({currentUser?.RoleArabic})
          </button>
        </div>
      );
    }

    // Dynamic Custom Sections created by developer
    if (activeSection.startsWith('custom_section_')) {
      const secId = activeSection.replace('custom_section_', '');
      return <DynamicSectionView sectionId={secId} isStandaloneSocialCare={secId === SOCIAL_CARE_LEGACY_CUSTOM_ID} />;
    }

    switch (activeSection) {
      case 'dashboard':
        return <DashboardModule />;
      case 'reception':
        return <ReceptionModule />;
      case 'admin':
        return <AdminModule />;
      case 'interviews':
        return <InterviewsModule />;
      case 'organization':
        return <OrganizationModule />;
      case 'director':
        return <DirectorExecutiveModule />;
      case 'drive_requests':
        return <DriveRequestsArchiveModule />;
      case 'search_archive':
        return <GlobalSearchArchiveModule />;
      case 'whatsapp':
        return <WhatsAppModule />;
      case 'audit':
        return <AuditModule />;
      case 'reports':
        return <ReportsModule />;
      case 'master_admin':
        return <MasterAdminModule />;
      case 'apps_script':
        return <AppsScriptSyncModule />;
      case 'blacklist':
        return <BlacklistModule />;
      case 'social_care':
        return <DynamicSectionView sectionId={SOCIAL_CARE_LEGACY_CUSTOM_ID} isStandaloneSocialCare={true} />;
      default:
        return <DashboardModule />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100 flex flex-col font-['Tajawal',sans-serif] selection:bg-blue-600 selection:text-white transition-colors duration-200" dir="rtl">
      {/* Administrative Announcement Ticker */}
      <NewsTicker />

      {/* Top Header / Navbar */}
      <Navbar />

      {/* Live Cloud Sync Health & Transparent Error Alerts */}
      <CloudSyncStatusBanner />

      {/* Department Entry Welcome Greeting Toast / Notification */}
      {departmentGreeting && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-blue-400/40 flex items-start gap-3 backdrop-blur-md">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-amber-300 flex items-center justify-center font-bold text-lg border border-amber-400/40 shrink-0 mt-0.5">
              ✨
            </div>
            <div className="flex-1 min-w-0 text-right">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-blue-300 bg-blue-900/60 px-2 py-0.5 rounded-full border border-blue-400/30">
                  تحية القسم الرسمية
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {departmentGreeting.date}
                </span>
              </div>
              <h4 className="font-extrabold text-sm text-white mt-1">
                {departmentGreeting.title}
              </h4>
              <p className="text-xs text-blue-200/90 mt-0.5 leading-relaxed">
                {departmentGreeting.message}
              </p>
            </div>
            <button
              onClick={() => setDepartmentGreeting(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="إغلاق الترحيب"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Body: Do NOT mount heavy workspace modules until actual cloud data load finishes */}
      <div className="flex-1 w-full min-w-0 pb-16 md:pb-0">
        <main className="w-full p-3 sm:p-4 md:p-6 overflow-y-auto bg-[#F1F5F9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
          <div className="max-w-7xl mx-auto w-full">
            {isSessionLoading ? (
              <div className="min-h-[60vh]" aria-busy="true" />
            ) : (
              <ErrorBoundary key={activeSection} sectionName={activeSection} compact={true}>
                {renderActiveModule()}
              </ErrorBoundary>
            )}
          </div>
        </main>
      </div>

      {/* Mobile APK-style Native Bottom Navigation (Visible exclusively on mobile md:hidden) */}
      <MobileAppBottomNav onOpenLogoutModal={handleRequestLogout} />

      {/* High-Density Executive Footer */}
      <footer className="no-print h-9 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 text-[11px] text-slate-500 dark:text-slate-400 font-medium z-10 transition-colors duration-200">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-3.5 bg-amber-500 rounded-full shrink-0" />
          <span className="truncate">
            {systemSettings?.footerText?.trim() ||
              `منظومة ${systemSettings?.officeName || systemSettings?.appName || 'مكتب النائب علا الناشي'} © ${new Date().getFullYear()}`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400 shrink-0">
          <button
            type="button"
            onClick={handleManualCloudSync}
            disabled={isCloudSyncing}
            className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-2.5 py-0.5 rounded-lg border border-emerald-300 dark:border-emerald-700 transition-all cursor-pointer disabled:opacity-50"
            title="مزامنة شاملة لكافة بيانات النظام مع Firebase Firestore الآن"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isCloudSyncing ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span>{isCloudSyncing ? 'جاري رفع البيانات...' : 'مزامنة Firebase السحابية'}</span>
          </button>
          {cloudSyncMsg && (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-in fade-in">
              {cloudSyncMsg}
            </span>
          )}
          <span className="hidden sm:inline font-mono tabular-nums">v4.5.0</span>
        </div>
      </footer>

      {/* Print Overlays & Modal Dossiers */}
      <PrintableIdCard />
      <PrintableReviewBadge />
      <PrintableSmartArchiveDossier />
      <CitizenHistoryModal />
      <DesktopInstallModal 
        isOpen={isDesktopInstallModalOpen} 
        onClose={() => setIsDesktopInstallModalOpen(false)} 
      />
      <SystemWipeModal
        isOpen={isSystemWipeModalOpen}
        onClose={() => setIsSystemWipeModalOpen(false)}
      />

      {/* Admin Logout Confirmation & Multi-Sheet Excel Export Modal */}
      <AdminLogoutExportModal
        isOpen={showAdminLogoutModal}
        onClose={() => setShowAdminLogoutModal(false)}
        onConfirmLogout={() => {
          setShowAdminLogoutModal(false);
          logout();
        }}
      />

      {/* Network Disconnection Apology Overlay */}
      <NetworkStatusModal />

      {/* Live System Update Notification */}
      <AppUpdateNotification />

      {/* Ceremonial Post-Login Loading Screen Overlay */}
      <SessionLoadingOverlay 
        isLoading={isSessionLoading} 
        message={sessionLoadingMessage}
        userName={currentUser?.FullName}
        userRole={currentUser?.RoleArabic}
        officeName={systemSettings?.officeName || systemSettings?.appName}
        emblemUrl={
          systemSettings?.customImages?.loadingEmblem ||
          systemSettings?.parliamentEmblemUrl ||
          systemSettings?.logoUrl
        }
        customTitle={systemSettings?.loadingScreenTitle}
        customSubtitle={systemSettings?.loadingScreenSubtitle}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppLayout />
    </AppProvider>
  );
}
