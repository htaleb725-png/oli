import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Bell, 
  LogOut, 
  ShieldAlert, 
  ChevronDown, 
  Search,
  Monitor,
  Moon,
  Sun,
  Maximize,
  Minimize,
  Globe,
  SlidersHorizontal,
  Menu,
  CheckCheck,
  CheckCircle2,
  Trash2,
  ArrowLeft,
  LayoutGrid,
  Download
} from 'lucide-react';
import { exportUnifiedSystemExcel } from '../services/unifiedExcelExporter';

export const Navbar: React.FC = () => {
  const { 
    systemSettings, 
    currentUser, 
    logout, 
    notifications, 
    markAllNotificationsAsRead,
    activeSection,
    setActiveSection,
    setIsDesktopInstallModalOpen,
    setIsSystemWipeModalOpen,
    users,
    switchUser,
    citizens,
    requests,
    interviews,
    cheques,
    organizationRecords,
    officialLetters,
    customSections,
    customRecords
  } = useApp();

  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [lang, setLang] = useState<'AR' | 'EN'>('EN');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showNavbarToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('ola_theme_mode');
    if (savedTheme === 'dark' || document.documentElement.classList.contains('dark')) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ola_theme_mode', 'light');
      setIsDarkMode(false);
      showNavbarToast('تم تفعيل الوضع النهاري ☀️');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ola_theme_mode', 'dark');
      setIsDarkMode(true);
      showNavbarToast('تم تفعيل الوضع الليلي 🌙');
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        showNavbarToast('تعذر الدخول في وضع ملء الشاشة');
      });
      setIsFullscreen(true);
      showNavbarToast('تم تفعيل وضع ملء الشاشة المكتبي');
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
      showNavbarToast('تم الخروج من ملء الشاشة');
    }
  };

  const handleToggleLang = () => {
    const nextLang = lang === 'EN' ? 'AR' : 'EN';
    setLang(nextLang);
    showNavbarToast(nextLang === 'AR' ? 'اللغة الحالية: العربية (العراق)' : 'Display Language: English');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (navSearch.trim()) {
      showNavbarToast(`جاري البحث عن: ${navSearch.trim()}`);
    }
    setActiveSection('search_archive');
  };

  return (
    <header className="no-print sticky top-0 z-40 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xs transition-colors duration-200">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-fade-in backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="w-full px-4 sm:px-6 h-15 flex items-center justify-between gap-4">
        
        {/* Right Section (in RTL): Global Search Bar - Hidden completely in Reception & Director sections as requested */}
        {activeSection !== 'reception' && activeSection !== 'director' ? (
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md flex items-center">
              <input
                type="text"
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                placeholder="بحث شامل... (Ctrl+K)"
                className="w-full h-9.5 pr-9 pl-10 bg-slate-50 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all shadow-2xs font-medium"
              />
              <button
                type="submit"
                className="w-4 h-4 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 absolute right-3 cursor-pointer"
                title="بحث"
              >
                <Search className="w-4 h-4" />
              </button>
              <div className="absolute left-3 flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                <kbd 
                  onClick={() => setActiveSection('search_archive')}
                  className="px-1.5 py-0.5 bg-slate-200/70 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 border border-slate-300/80 dark:border-slate-600 rounded text-slate-600 dark:text-slate-300 font-bold cursor-pointer transition-colors"
                  title="فتح شاشة البحث والأرشيف"
                >
                  Ctrl+K
                </kbd>
              </div>
            </form>

            <button 
              onClick={() => setActiveSection('search_archive')}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200/70 dark:border-slate-700 hidden sm:flex active:scale-95"
              title="تصفية وخيارات البحث"
            >
              <Menu className="w-4 h-4" />
            </button>
          </div>
        ) : activeSection === 'reception' ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shadow-2xs">
                🏛️
              </div>
              <div>
                <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white block leading-tight">
                  قسم الاستعلامات والمراجعين
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  مكتب النائب علا عودة الناشي • نظام الأيقونات المباشرة
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveSection('dashboard')}
              className="h-8.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-2xs"
              title="العودة إلى لوحة الأقسام المركزية بالأيقونات"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
              <span>لوحة الأيقونات</span>
            </button>
          </div>
        ) : activeSection === 'director' ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs shadow-2xs">
                💼
              </div>
              <div>
                <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white block leading-tight">
                  قسم مدير المكتب التنفيذي والإشراف العام
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  اعتماد وتوجيه وارد الاستعلامات وتصفح كافة أقسام المنظومة
                </span>
              </div>
            </div>

            {/* Direct Exit to Central Icon Hub for Director */}
            <button
              onClick={() => setActiveSection('dashboard')}
              className="h-8.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
              title="الخروج إلى لوحة الأيقونات المركزية وتصفح كامل أقسام النظام"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-950" />
              <span>الخروج للوحة الأيقونات 🌐</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveSection('dashboard')}
              className="h-8.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-2xs"
              title="العودة إلى لوحة الأقسام المركزية بالأيقونات"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
              <span>لوحة الأيقونات المركزية</span>
            </button>
          </div>
        )}

        {/* Global Return to Icon Hub if not on dashboard and not already shown */}
        {activeSection !== 'dashboard' && activeSection !== 'reception' && activeSection !== 'director' && (
          <div className="hidden lg:flex items-center">
            <button
              onClick={() => setActiveSection('dashboard')}
              className="h-8.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              title="العودة إلى لوحة الأقسام المركزية"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
              <span>لوحة الأقسام</span>
            </button>
          </div>
        )}

        {/* Left Section (in RTL): User Profile, Notifications, Dark Mode & Language */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Universal Full Database Excel Export Button for Admin, Deputy, Developer */}
          {(currentUser?.Role === 'admin' || currentUser?.Role === 'deputy' || currentUser?.Role === 'developer') && (
            <button
              onClick={() => {
                const success = exportUnifiedSystemExcel({
                  citizens,
                  requests,
                  interviews,
                  cheques,
                  organizationRecords,
                  officialLetters,
                  customSections,
                  customRecords,
                  officeName: systemSettings.officeName || systemSettings.appName,
                  exporterName: currentUser?.FullName || 'المستخدم المصرح'
                });
                if (success) {
                  showNavbarToast('تم تصدير قاعدة البيانات بالكامل مع الصور إلى Excel بنجاح 📥');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-200 dark:border-teal-800/60 bg-teal-50/80 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-900 dark:text-teal-300 text-xs font-bold transition-all cursor-pointer shadow-2xs group active:scale-95"
              title="تصدير قاعدة بيانات المنظومة بالكامل مع الصور في ملف Excel واحد (خاص بالإدارة والمدير والمطور)"
            >
              <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">تصدير Excel الشامل</span>
            </button>
          )}

          {/* Desktop App Installer Button */}
          <button
            onClick={() => setIsDesktopInstallModalOpen(true)}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-900 dark:text-indigo-300 text-xs font-bold transition-all cursor-pointer shadow-2xs group active:scale-95"
            title="تثبيت المنظومة على سطح المكتب (Windows Desktop App)"
          >
            <Monitor className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>تثبيت مكتبي</span>
          </button>

          {/* Fullscreen Mode Button */}
          <button 
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer hidden md:flex active:scale-95"
            title={isFullscreen ? "الخروج من ملء الشاشة" : "عرض ملء الشاشة المكتبي (Fullscreen)"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <Maximize className="w-4 h-4 text-slate-600 dark:text-slate-300" />}
          </button>

          {/* Modern Tailwind CSS Dark Mode Toggle Switch */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              role="switch"
              aria-checked={isDarkMode}
              onClick={toggleTheme}
              className={`group relative inline-flex h-8 w-15 sm:w-16 items-center rounded-full p-0.5 transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400/50 shadow-inner select-none ${
                isDarkMode 
                  ? 'bg-slate-950 border border-amber-500/50' 
                  : 'bg-slate-200 border border-slate-300'
              }`}
              title={isDarkMode ? "الوضع الليلي مفعّل (انقر للتبديل للوضع النهاري)" : "الوضع النهاري مفعّل (انقر للتبديل للوضع الليلي)"}
            >
              {/* Stationary Background Icons */}
              <span className="absolute left-1.5 pointer-events-none transition-opacity duration-200">
                <Moon className={`w-3.5 h-3.5 ${isDarkMode ? 'text-amber-400 opacity-90' : 'text-slate-400 opacity-30'}`} />
              </span>
              <span className="absolute right-1.5 pointer-events-none transition-opacity duration-200">
                <Sun className={`w-3.5 h-3.5 ${!isDarkMode ? 'text-amber-600 opacity-90' : 'text-slate-500 opacity-30'}`} />
              </span>

              {/* Smooth Animated Sliding Thumb */}
              <span
                className={`inline-flex items-center justify-center h-6.5 w-6.5 rounded-full shadow-md transform transition-all duration-300 ease-in-out z-10 ${
                  isDarkMode
                    ? 'translate-x-0 bg-slate-900 text-amber-400 border border-amber-400/60 shadow-amber-500/20'
                    : 'translate-x-7.5 sm:translate-x-8.5 bg-white text-amber-500 border border-amber-200 shadow-slate-300'
                }`}
              >
                {isDarkMode ? (
                  <Moon className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                ) : (
                  <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                )}
              </span>
            </button>

            {/* Quick Text Label for Clarity */}
            <span
              onClick={toggleTheme}
              className="hidden xl:inline-block text-[10px] font-black px-1 text-slate-600 dark:text-amber-300 cursor-pointer select-none transition-colors"
            >
              {isDarkMode ? 'ليلي' : 'نهاري'}
            </span>
          </div>

          {/* Language Switcher Pill */}
          <button 
            onClick={handleToggleLang}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200/70 text-slate-700 text-xs font-black transition-colors cursor-pointer active:scale-95"
            title="تغيير لغة العرض"
          >
            {lang}
          </button>

          {/* Notifications Dropdown with Red Counter - Hidden for Reception Staff */}
          {currentUser?.Role !== 'reception' && currentUser?.Role !== 'reception_officer' && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifDropdown(!showNotifDropdown);
                  setShowRoleDropdown(false);
                }}
                className="relative p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer active:scale-95"
                title="الإشعارات والتنبيهات العاجلة"
              >
                <Bell className="w-4 h-4 text-red-500" />
                {unreadCount > 0 ? (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse border-2 border-white dark:border-slate-900">
                    {unreadCount}
                  </span>
                ) : (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500"></span>
                )}
              </button>

              {showNotifDropdown && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-4 space-y-3 z-50 text-slate-800 dark:text-slate-100">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">التنبيهات الإدارية العاجلة</h4>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => {
                        markAllNotificationsAsRead();
                        showNavbarToast('تم تحديد جميع الإشعارات كمقروءة');
                      }}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>تحديد الكل كمقروء</span>
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">لا توجد إشعارات جديدة حالياً.</p>
                  ) : (
                    notifications.map((n, idx) => (
                      <div
                        key={`${n.id || 'notif'}-${idx}`}
                        onClick={() => {
                          if (n.linkSection) setActiveSection(n.linkSection);
                          setShowNotifDropdown(false);
                        }}
                        className={`p-2.5 rounded-xl border text-right transition-colors cursor-pointer ${
                          n.read 
                            ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300' 
                            : 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                          <span className="text-slate-900 dark:text-white">{n.title}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{n.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          )}

          {/* User Profile Badge (Avatar initials + Name & Role) */}
          <div className="relative">
            <button
              onClick={() => {
                setShowRoleDropdown(!showRoleDropdown);
                setShowNotifDropdown(false);
              }}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/70 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer text-right"
            >
              <div className="w-8 h-8 rounded-full bg-[#0c1427] dark:bg-amber-500/20 text-white dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-slate-700 dark:border-amber-500/40">
                {currentUser?.FullName ? currentUser.FullName.slice(0, 2) : 'ع ن'}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight truncate max-w-[140px]">
                  {currentUser?.FullName || 'النائب علا عودة الناشي'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                  {currentUser?.RoleArabic || 'عضو مجلس النواب'}
                </div>
              </div>
            </button>

            {showRoleDropdown && (
              <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-3 space-y-3 z-50 text-right text-slate-800 dark:text-slate-100">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#0c1427] dark:bg-amber-500/20 text-white dark:text-amber-300 flex items-center justify-center font-bold text-sm border border-slate-700 dark:border-amber-500/40">
                      {currentUser?.FullName.slice(0, 2) || 'ع ن'}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white">{currentUser?.FullName}</div>
                      <div className="text-[10px] text-blue-700 dark:text-amber-400 font-semibold">{currentUser?.RoleArabic}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span>القسم: {currentUser?.Department}</span>
                    <span className="font-mono text-slate-400 dark:text-slate-500 font-bold">{currentUser?.User_ID}</span>
                  </div>
                </div>

                {/* Quick Department Switcher - EXCLUSIVELY for Developer */}
                {currentUser?.Role === 'developer' && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>تبديل الحساب (صلاحية المطور فقط):</span>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">مطور النظام</span>
                    </div>
                    <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
                      {users.slice(0, 8).map((u, idx) => (
                        <button
                          key={`${u.User_ID}-${idx}`}
                          onClick={() => {
                            switchUser(u);
                            setShowRoleDropdown(false);
                            showNavbarToast(`تم التبديل إلى: ${u.FullName} (${u.RoleArabic})`);
                          }}
                          className={`w-full text-right p-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                            currentUser?.User_ID === u.User_ID
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span className="truncate">{u.FullName}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 font-normal mr-1">
                            [{u.Role === 'reception' ? 'الاستعلامات' : u.Role === 'admin' ? 'الإدارة' : u.Role === 'interviews_officer' ? 'المقابلات' : u.Role === 'organization' ? 'التنظيم' : u.Role === 'machine' ? 'المكنة' : u.Role === 'audit' ? 'الرقابة' : u.RoleArabic.slice(0, 10)}]
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-1 space-y-1.5">
                  {currentUser?.Role === 'developer' && (
                    <button
                      onClick={() => {
                        setIsSystemWipeModalOpen(true);
                        setShowRoleDropdown(false);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                      <span>تصفير وحذف جميع البيانات (خاص بالمطور فقط)</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      logout();
                      setShowRoleDropdown(false);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-red-200 dark:border-red-800 shadow-2xs"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Maintenance Mode Banner if active */}
      {systemSettings.maintenanceMode && (
        <div className="bg-red-600 text-white px-4 py-1 text-center text-xs font-bold flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4 text-white animate-pulse" />
          <span>وضع الصيانة مفعل حالياً من قبل الإدارة العليا (Maintenance Mode)</span>
        </div>
      )}
    </header>
  );
};

