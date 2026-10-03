import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, 
  UserPlus, 
  FolderKanban, 
  Handshake, 
  Users2, 
  Printer, 
  Briefcase, 
  Search, 
  MessageSquare, 
  ShieldCheck, 
  Settings, 
  BarChart3, 
  CloudDownload,
  ChevronDown,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    activeSection, 
    setActiveSection, 
    requests, 
    interviews, 
    currentUser, 
    systemSettings,
    setIsDesktopInstallModalOpen,
    triggerDepartmentGreeting
  } = useApp();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const urgentRequestsCount = requests.filter(r => r.Priority === 'عاجل' || r.Priority === 'خاص جداً').length;
  const pendingInterviewsCount = interviews.filter(i => i.Status === 'مجدولة').length;

  const role = currentUser?.Role;
  const isSuperUser = role === 'developer' || role === 'director' || role === 'deputy';
  const isFollowUpOfficer = role === 'audit';

  let dashboardLabel = 'لوحة التحكم والمؤشرات المركزية';
  let dashboardBadge = 'الإدارة العليا';
  if (role === 'reception' || role === 'reception_officer') {
    dashboardLabel = 'واجهة الاستعلامات وتسجيل المراجعين';
    dashboardBadge = 'الاستقبال';
  } else if (role === 'admin' || role === 'admin_officer') {
    dashboardLabel = 'لوحة الإدارة والمعاملات اليومية';
    dashboardBadge = 'المعاملات';
  } else if (role === 'interviews_officer') {
    dashboardLabel = 'جدول ومواعيد مقابلات النائب';
    dashboardBadge = 'المقابلات';
  } else if (role === 'organization' || role === 'organization_officer') {
    dashboardLabel = 'سجل التنظيم والموقف الجماهيري';
    dashboardBadge = 'التنظيم';
  } else if (role === 'machine' || role === 'machine_officer') {
    dashboardLabel = 'وحدة المكنة والكتب الرسمية';
    dashboardBadge = 'الطباعة';
  } else if (role === 'audit') {
    dashboardLabel = 'لوحة المتابعة والرقابة والإحصائيات الشاملة';
    dashboardBadge = 'المتابعة';
  }

  const mainNavItems = [
    {
      id: 'dashboard',
      label: dashboardLabel,
      icon: LayoutDashboard,
      badge: dashboardBadge,
      badgeColor: 'bg-blue-500/30 text-blue-200 border-blue-500/40',
      hoverBg: 'hover:bg-blue-950/50 hover:border-blue-500/40 hover:text-blue-100 hover:shadow-lg hover:shadow-blue-950/50',
      hoverIcon: 'group-hover:text-blue-400 group-hover:drop-shadow-[0_0_10px_rgba(96,165,250,0.9)]',
      glowColor: 'bg-blue-500',
      color: 'text-blue-400',
      activeBg: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
    },
    {
      id: 'reception',
      label: 'قسم الاستعلامات والمراجعين',
      icon: UserPlus,
      badge: 'تسجيل',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      hoverBg: 'hover:bg-cyan-950/50 hover:border-cyan-500/40 hover:text-cyan-100 hover:shadow-lg hover:shadow-cyan-950/50',
      hoverIcon: 'group-hover:text-cyan-400 group-hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]',
      glowColor: 'bg-cyan-500',
      color: 'text-cyan-400',
      activeBg: 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/30'
    },
    {
      id: 'admin',
      label: 'قسم الإدارة والمعاملات',
      icon: FolderKanban,
      badge: urgentRequestsCount > 0 ? `${urgentRequestsCount} عاجل` : null,
      badgeColor: 'bg-red-500/30 text-red-300 border-red-500/40',
      hoverBg: 'hover:bg-amber-950/50 hover:border-amber-500/40 hover:text-amber-100 hover:shadow-lg hover:shadow-amber-950/50',
      hoverIcon: 'group-hover:text-amber-400 group-hover:drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]',
      glowColor: 'bg-amber-500',
      color: 'text-amber-400',
      activeBg: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/30'
    },
    {
      id: 'interviews',
      label: 'قسم مقابلات النائب',
      icon: Handshake,
      badge: pendingInterviewsCount > 0 ? `${pendingInterviewsCount} مجدولة` : null,
      badgeColor: 'bg-teal-500/30 text-teal-300 border-teal-500/40',
      hoverBg: 'hover:bg-teal-950/50 hover:border-teal-500/40 hover:text-teal-100 hover:shadow-lg hover:shadow-teal-950/50',
      hoverIcon: 'group-hover:text-teal-400 group-hover:drop-shadow-[0_0_10px_rgba(45,212,191,0.9)]',
      glowColor: 'bg-teal-500',
      color: 'text-teal-400',
      activeBg: 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg shadow-teal-600/30'
    },
    {
      id: 'organization',
      label: 'قسم التنظيم والجماهير',
      icon: Users2,
      badge: null,
      hoverBg: 'hover:bg-purple-950/50 hover:border-purple-500/40 hover:text-purple-100 hover:shadow-lg hover:shadow-purple-950/50',
      hoverIcon: 'group-hover:text-purple-400 group-hover:drop-shadow-[0_0_10px_rgba(192,132,252,0.9)]',
      glowColor: 'bg-purple-500',
      color: 'text-purple-400',
      activeBg: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
    },
    {
      id: 'machine',
      label: 'قسم مدير المكنة والطباعة',
      icon: Printer,
      badge: null,
      hoverBg: 'hover:bg-indigo-950/50 hover:border-indigo-500/40 hover:text-indigo-100 hover:shadow-lg hover:shadow-indigo-950/50',
      hoverIcon: 'group-hover:text-indigo-400 group-hover:drop-shadow-[0_0_10px_rgba(129,140,248,0.9)]',
      glowColor: 'bg-indigo-500',
      color: 'text-indigo-400',
      activeBg: 'bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-lg shadow-blue-700/30'
    },
    {
      id: 'director',
      label: 'قسم مدير المكتب التنفيذي',
      icon: Briefcase,
      badge: 'إشراف',
      badgeColor: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
      hoverBg: 'hover:bg-fuchsia-950/50 hover:border-fuchsia-500/40 hover:text-fuchsia-100 hover:shadow-lg hover:shadow-fuchsia-950/50',
      hoverIcon: 'group-hover:text-fuchsia-400 group-hover:drop-shadow-[0_0_10px_rgba(232,121,249,0.9)]',
      glowColor: 'bg-fuchsia-500',
      color: 'text-fuchsia-400',
      activeBg: 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-lg shadow-fuchsia-600/30'
    },
    {
      id: 'search_archive',
      label: 'البحث وطباعة الهوية والأرشيف',
      icon: Search,
      badge: null,
      hoverBg: 'hover:bg-sky-950/50 hover:border-sky-500/40 hover:text-sky-100 hover:shadow-lg hover:shadow-sky-950/50',
      hoverIcon: 'group-hover:text-sky-400 group-hover:drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]',
      glowColor: 'bg-sky-500',
      color: 'text-sky-400',
      activeBg: 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-lg shadow-sky-600/30'
    },
    {
      id: 'drive_requests',
      label: 'أرشيف طلبات Google Drive',
      icon: Printer,
      badge: 'Drive',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      hoverBg: 'hover:bg-green-950/50 hover:border-green-500/40 hover:text-green-100 hover:shadow-lg hover:shadow-green-950/50',
      hoverIcon: 'group-hover:text-green-400 group-hover:drop-shadow-[0_0_10px_rgba(74,222,128,0.9)]',
      glowColor: 'bg-green-500',
      color: 'text-green-400',
      activeBg: 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-emerald-600/30'
    },
    {
      id: 'reports',
      label: 'التقارير والإحصائيات وتدقيق القوائم',
      icon: BarChart3,
      badge: 'حصري للمتابعة والمدير',
      badgeColor: 'bg-pink-500/30 text-pink-200 border-pink-500/40',
      hoverBg: 'hover:bg-pink-950/50 hover:border-pink-500/40 hover:text-pink-100 hover:shadow-lg hover:shadow-pink-950/50',
      hoverIcon: 'group-hover:text-pink-400 group-hover:drop-shadow-[0_0_10px_rgba(244,114,182,0.9)]',
      glowColor: 'bg-pink-500',
      color: 'text-pink-400',
      activeBg: 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-600/30'
    },
    {
      id: 'audit',
      label: 'قسم المتابعة والرقابة والإحصائيات الشاملة',
      icon: ShieldCheck,
      badge: 'متابعة وتنزيل',
      badgeColor: 'bg-rose-500/30 text-rose-200 border-rose-500/40',
      hoverBg: 'hover:bg-rose-950/50 hover:border-rose-500/40 hover:text-rose-100 hover:shadow-lg hover:shadow-rose-950/50',
      hoverIcon: 'group-hover:text-rose-400 group-hover:drop-shadow-[0_0_10px_rgba(251,113,133,0.9)]',
      glowColor: 'bg-rose-500',
      color: 'text-rose-400',
      activeBg: 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-600/30'
    },
    {
      id: 'master_admin',
      label: 'لوحة التحكم والمطور',
      icon: Settings,
      badge: null,
      hoverBg: 'hover:bg-amber-950/50 hover:border-amber-500/40 hover:text-amber-100 hover:shadow-lg hover:shadow-amber-950/50',
      hoverIcon: 'group-hover:text-amber-400 group-hover:drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]',
      glowColor: 'bg-amber-500',
      color: 'text-amber-400',
      activeBg: 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-600/30'
    },
  ];

  const toolsNavItems = [
    {
      id: 'whatsapp',
      label: 'مراسلات واتساب التلقائية',
      icon: MessageSquare,
      badge: 'فوري',
      badgeColor: 'bg-emerald-500/30 text-emerald-300 border-emerald-500/40',
      hoverBg: 'hover:bg-emerald-950/50 hover:border-emerald-500/40 hover:text-emerald-100 hover:shadow-lg hover:shadow-emerald-950/50',
      hoverIcon: 'group-hover:text-emerald-400 group-hover:drop-shadow-[0_0_10px_rgba(52,211,153,0.9)]',
      glowColor: 'bg-emerald-500',
      color: 'text-emerald-400',
      activeBg: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
    },
    {
      id: 'apps_script',
      label: 'مزامنة Google Sheets',
      icon: CloudDownload,
      badge: 'سحابي',
      badgeColor: 'bg-blue-500/30 text-blue-300 border-blue-500/40',
      hoverBg: 'hover:bg-blue-950/50 hover:border-blue-500/40 hover:text-blue-100 hover:shadow-lg hover:shadow-blue-950/50',
      hoverIcon: 'group-hover:text-blue-400 group-hover:drop-shadow-[0_0_10px_rgba(96,165,250,0.9)]',
      glowColor: 'bg-blue-500',
      color: 'text-blue-400',
      activeBg: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
    },
  ];

  // Helper to check if current user has permission to see this section
  const canAccessSection = (sectionId: string): boolean => {
    if (!currentUser) return false;
    const role = currentUser.Role;
    
    // Developer has full unconstrained access to all tools and modules
    if (role === 'developer') return true;

    // Director and Deputy have full executive access EXCEPT developer tools
    if (role === 'director' || role === 'deputy') {
      return !['master_admin', 'apps_script'].includes(sectionId);
    }

    switch (role) {
      case 'audit':
        // قسم المتابعة: يتولى متابعة شكو إحصائيات بالنظام من الأول للآخر مع سحب الملفات والطباعة
        return ['dashboard', 'audit', 'reports', 'search_archive'].includes(sectionId);
      case 'reception':
      case 'reception_officer':
        return ['dashboard', 'reception', 'search_archive'].includes(sectionId);
      case 'admin':
      case 'admin_officer':
        return ['dashboard', 'admin', 'drive_requests', 'search_archive'].includes(sectionId);
      case 'interviews_officer':
        return ['dashboard', 'interviews', 'search_archive'].includes(sectionId);
      case 'organization':
      case 'organization_officer':
        return ['dashboard', 'organization', 'search_archive'].includes(sectionId);
      case 'machine':
      case 'machine_officer':
        return ['dashboard', 'machine', 'search_archive'].includes(sectionId);
      case 'archive':
        return ['dashboard', 'search_archive'].includes(sectionId);
      default:
        return ['dashboard', 'search_archive'].includes(sectionId);
    }
  };

  const filteredMainNavItems = mainNavItems.filter(item => canAccessSection(item.id));
  const filteredToolsNavItems = toolsNavItems.filter(item => canAccessSection(item.id));

  return (
    <aside 
      className={`no-print select-none bg-[#0a1122] text-white flex flex-col shrink-0 border-l border-slate-800/80 min-h-[calc(100vh-3.5rem)] shadow-2xl transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-full md:w-20' : 'w-full md:w-64'
      }`}
    >
      {/* Brand Header with Collapsible Toggle Button */}
      <div className="py-4 px-3 border-b border-slate-800/80 bg-[#070d1a] shrink-0 relative flex items-center justify-between">
        {!isCollapsed ? (
          <div className="min-w-0 pr-1 text-right flex-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <h1 className="text-xl font-black tracking-wide text-white font-['Cairo',sans-serif] truncate">
                {systemSettings.appName || 'مكتب النائب'}
              </h1>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
              {systemSettings.deputyTitle || 'نظام الإدارة المتكامل'}
            </p>
          </div>
        ) : (
          <div className="w-full flex justify-center py-1">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-black text-sm shadow-inner">
              ع
            </div>
          </div>
        )}

        {/* Dynamic Collapse/Expand Floating Button */}
        <button
          onClick={toggleCollapse}
          title={isCollapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية (وضع مدمج)'}
          className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-amber-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-slate-300" />
          )}
        </button>
      </div>

      {/* Navigation Menu (Smooth Hover Transitions & Floating Tooltips) */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
        {filteredMainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => {
                  setActiveSection(item.id);
                }}
                className={`w-full flex items-center ${
                  isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-2.5'
                } rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-right relative overflow-hidden group ${
                  isActive
                    ? item.activeBg
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white hover:translate-x-[-2px]'
                }`}
              >
                {/* Active Indicator Bar on right edge */}
                {isActive && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-l-full shadow-md" />
                )}

                {!isCollapsed && (
                  <>
                    {/* Right side: Chevron & Label */}
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDown 
                        className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                          isActive ? 'text-white rotate-0' : 'text-slate-500 -rotate-90 group-hover:text-slate-200'
                        }`} 
                      />
                      <span className="truncate group-hover:translate-x-[-2px] transition-transform duration-200">
                        {item.label}
                      </span>
                    </div>

                    {/* Left side: Icon & Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            isActive
                              ? 'bg-white/20 text-white border-white/30'
                              : item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      <Icon className={`w-4 h-4 shrink-0 transition-all duration-200 group-hover:scale-120 ${
                        isActive ? 'text-white' : 'text-slate-400 ' + item.color
                      }`} />
                    </div>
                  </>
                )}

                {isCollapsed && (
                  <div className="relative">
                    <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-125 ${
                      isActive ? 'text-white' : 'text-slate-400 ' + item.color
                    }`} />
                    {item.badge && (
                      <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
                    )}
                  </div>
                )}
              </button>

              {/* Floating Tooltip when Collapsed */}
              {isCollapsed && (
                <div className="fixed right-20 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 mr-2">
                  <div className="bg-[#0f172a] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border border-slate-700 whitespace-nowrap flex items-center gap-2">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-600 text-white">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredToolsNavItems.length > 0 && (
          <div className="pt-3">
            {!isCollapsed ? (
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>خدمات وتكامل</span>
                <span className="w-8 h-[1px] bg-slate-800"></span>
              </div>
            ) : (
              <div className="w-8 h-[1px] bg-slate-800 mx-auto my-2"></div>
            )}
            
            {filteredToolsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <div key={item.id} className="relative group mt-1">
                  <button
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center ${
                      isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-2.5'
                    } rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-right group ${
                      isActive
                        ? item.activeBg
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white hover:translate-x-[-2px]'
                    }`}
                  >
                    {!isCollapsed ? (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-400`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.badge && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}
                          <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-120 ${
                            isActive ? 'text-white' : 'text-slate-400 ' + item.color
                          }`} />
                        </div>
                      </>
                    ) : (
                      <Icon className={`w-5 h-5 transition-transform group-hover:scale-125 ${
                        isActive ? 'text-white' : 'text-slate-400 ' + item.color
                      }`} />
                    )}
                  </button>

                  {isCollapsed && (
                    <div className="fixed right-20 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 mr-2">
                      <div className="bg-[#0f172a] text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl border border-slate-700 whitespace-nowrap">
                        {item.label}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* Desktop App Installer Quick CTA */}
      <div className="p-2 bg-[#070d1a] border-t border-slate-800/80 shrink-0">
        <button
          onClick={() => setIsDesktopInstallModalOpen(true)}
          className={`w-full py-2.5 ${
            isCollapsed ? 'px-1 justify-center' : 'px-3 justify-between'
          } rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-white text-xs font-bold flex items-center transition-all cursor-pointer shadow-xs hover:border-amber-400/50 group`}
          title="تثبيت اختصار على سطح المكتب"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Monitor className="w-4 h-4 text-amber-400 group-hover:scale-125 group-hover:rotate-6 transition-transform" />
            {!isCollapsed && <span className="truncate">تثبيت سطح المكتب</span>}
          </div>
          {!isCollapsed && (
            <span className="text-[9px] bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-black shadow-2xs">
              PC
            </span>
          )}
        </button>
      </div>

      {/* User Role Card & Connection Status */}
      <div className="p-2.5 bg-[#060b15] border-t border-slate-800/80 shrink-0 space-y-2">
        <div className={`p-2 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center ${
          isCollapsed ? 'justify-center' : 'justify-between'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs ring-2 ring-blue-400/30">
              {currentUser?.FullName?.slice(0, 1) || 'ع'}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 text-right">
                <div className="text-xs font-bold text-white truncate">{currentUser?.FullName}</div>
                <div className="text-[10px] text-slate-400 truncate">{currentUser?.RoleArabic}</div>
              </div>
            )}
          </div>
        </div>

        {!isCollapsed ? (
          <div className="flex items-center justify-between text-[11px] px-1 text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span>النظام متصل</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">SECURE-SSL</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" title="متصل وآمن"></span>
          </div>
        )}
      </div>
    </aside>
  );
};


