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
import { MachineModule } from './components/MachineModule';
import { DirectorExecutiveModule } from './components/DirectorExecutiveModule';
import { GlobalSearchArchiveModule } from './components/GlobalSearchArchiveModule';
import { WhatsAppModule } from './components/WhatsAppModule';
import { AuditModule } from './components/AuditModule';
import { ReportsModule } from './components/ReportsModule';
import { MasterAdminModule } from './components/MasterAdminModule';
import { AppsScriptSyncModule } from './components/AppsScriptSyncModule';
import { DynamicSectionView } from './components/DynamicSectionView';
import { DriveRequestsArchiveModule } from './components/DriveRequestsArchiveModule';
import { PrintableIdCard } from './components/PrintableIdCard';
import { PrintableReviewBadge } from './components/PrintableReviewBadge';
import { CitizenHistoryModal } from './components/CitizenHistoryModal';
import { DesktopInstallModal } from './components/DesktopInstallModal';
import { SystemWipeModal } from './components/SystemWipeModal';
import { NetworkStatusModal } from './components/NetworkStatusModal';
import { AppUpdateNotification } from './components/AppUpdateNotification';
import { SessionLoadingOverlay } from './components/SessionLoadingOverlay';
import { playUiClickSound } from './utils/audio';

const MainAppLayout: React.FC = () => {
  const { 
    isAuthenticated, 
    activeSection, 
    currentUser, 
    setActiveSection,
    isDesktopInstallModalOpen,
    setIsDesktopInstallModalOpen,
    isSystemWipeModalOpen,
    setIsSystemWipeModalOpen,
    departmentGreeting,
    setDepartmentGreeting,
    syncAllToFirestoreNow,
    isSessionLoading,
    sessionLoadingMessage,
    systemSettings
  } = useApp();

  const [isCloudSyncing, setIsCloudSyncing] = React.useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = React.useState<string | null>(null);

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

  // Helper to determine the home workspace for each role
  const getHomeSectionForRole = (role?: string): string => {
    switch (role) {
      case 'reception':
      case 'reception_officer':
        return 'reception';
      case 'admin':
      case 'admin_officer':
        return 'admin';
      case 'interviews_officer':
        return 'interviews';
      case 'organization':
      case 'organization_officer':
        return 'organization';
      case 'machine':
      case 'machine_officer':
        return 'machine';
      case 'audit':
        return 'audit';
      case 'archive':
        return 'search_archive';
      case 'developer':
      case 'director':
      case 'deputy':
      default:
        return 'dashboard';
    }
  };

  if (!isAuthenticated) {
    return <SplashLanding />;
  }

  // RBAC Permission Guard
  const canUserAccess = (section: string): boolean => {
    if (!currentUser) return false;
    const role = currentUser.Role;
    if (role === 'developer' || role === 'director' || role === 'deputy') return true;

    // Every department has access to its statistics dashboard
    if (section === 'dashboard') return true;

    // Allow custom dynamic sections created by the developer
    if (section.startsWith('custom_section_')) return true;

    switch (role) {
      case 'reception':
      case 'reception_officer':
        return ['dashboard', 'reception', 'search_archive'].includes(section);
      case 'admin':
      case 'admin_officer':
        return ['dashboard', 'admin', 'drive_requests', 'search_archive', 'reports', 'whatsapp'].includes(section);
      case 'interviews_officer':
        return ['dashboard', 'interviews', 'search_archive', 'reports', 'whatsapp'].includes(section);
      case 'organization':
      case 'organization_officer':
        return ['dashboard', 'organization', 'search_archive', 'reports', 'whatsapp'].includes(section);
      case 'machine':
      case 'machine_officer':
        return ['dashboard', 'machine', 'search_archive', 'reports'].includes(section);
      case 'audit':
        return ['dashboard', 'audit', 'search_archive', 'reports'].includes(section);
      case 'archive':
        return ['dashboard', 'search_archive', 'reports'].includes(section);
      default:
        return ['dashboard', 'search_archive', 'reports'].includes(section);
    }
  };

  const renderActiveModule = () => {
    // If the employee is trying to access a section outside their department/role, redirect safely
    if (!canUserAccess(activeSection)) {
      const homeSec = getHomeSectionForRole(currentUser?.Role);
      return (
        <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4 max-w-lg mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">هذا القسم غير متاح لصلاحية حسابك</h3>
            <p className="text-xs text-slate-500">
              أنت مسجل حالياً كـ ({currentUser?.RoleArabic}). يرجى استخدام الأقسام المخصصة لمهامك الإدارية أو التواصل مع المطور / المدير لمنحك الصلاحية.
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
      return <DynamicSectionView sectionId={secId} />;
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
      case 'machine':
        return <MachineModule />;
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

      {/* Main Workspace Body: نظام الأيقونات المباشرة بالكامل بدون قائمة جانبية */}
      <div className="flex-1 w-full min-w-0">
        <main className="w-full p-3 sm:p-4 md:p-6 overflow-y-auto bg-[#F1F5F9] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
          <div className="max-w-7xl mx-auto w-full">
            {renderActiveModule()}
          </div>
        </main>
      </div>

      {/* High-Density Executive Footer */}
      <footer className="no-print h-9 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 text-[11px] text-slate-500 dark:text-slate-400 font-medium z-10 transition-colors duration-200">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          <span>منظومة مكتب النائب علا الناشي © {new Date().getFullYear()} - الإصدار التنفيذي عالي الكثافة (High Density)</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <button
            type="button"
            onClick={handleManualCloudSync}
            disabled={isCloudSyncing}
            className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700 transition-all cursor-pointer disabled:opacity-50"
            title="مزامنة شاملة لكافة بيانات النظام مع Firebase Firestore الآن"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isCloudSyncing ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`}></span>
            <span>{isCloudSyncing ? 'جاري رفع البيانات...' : 'مزامنة Firebase السحابية ⚡'}</span>
          </button>
          {cloudSyncMsg && (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold animate-in fade-in">
              {cloudSyncMsg}
            </span>
          )}
          <span className="hidden sm:inline font-mono">DB v4.3.0-PRO</span>
        </div>
      </footer>

      {/* Print Overlays & Modal Dossiers */}
      <PrintableIdCard />
      <PrintableReviewBadge />
      <CitizenHistoryModal />
      <DesktopInstallModal 
        isOpen={isDesktopInstallModalOpen} 
        onClose={() => setIsDesktopInstallModalOpen(false)} 
      />
      <SystemWipeModal
        isOpen={isSystemWipeModalOpen}
        onClose={() => setIsSystemWipeModalOpen(false)}
      />

      {/* Network Disconnection Apology Overlay */}
      <NetworkStatusModal />

      {/* Live System Update Notification */}
      <AppUpdateNotification />

      {/* 2-Second Employee Entry Loading Message Overlay */}
      <SessionLoadingOverlay 
        isLoading={isSessionLoading} 
        message={sessionLoadingMessage}
        userName={currentUser?.FullName}
        userRole={currentUser?.RoleArabic}
        officeName={systemSettings?.officeName || systemSettings?.appName}
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
