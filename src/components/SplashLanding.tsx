import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Building2, 
  ShieldCheck, 
  Award,
  Lock,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Eye,
  EyeOff,
  Fingerprint,
  AlertCircle,
  Laptop,
  CheckCircle2,
  Sparkles,
  Shield,
  KeyRound,
  Database,
  Film,
  Maximize2,
  Minimize2,
  Loader2,
  Menu,
  X
} from 'lucide-react';
import { DesktopInstallModal } from './DesktopInstallModal';
import { Parliament4KVideoPlayer } from './Parliament4KVideoPlayer';
import { SessionLoadingOverlay } from './SessionLoadingOverlay';
import { playWelcomeChime, playParliamentGavelStrikeSound } from '../utils/audio';

export const SplashLanding: React.FC = () => {
  const { 
    systemSettings, 
    login, 
    isDesktopInstallModalOpen, 
    setIsDesktopInstallModalOpen,
    assignedWorkstationUser,
    directLoginAsAssigned,
    assignWorkstationUser,
    isSessionLoading,
    sessionLoadingMessage
  } = useApp();

  const [loginMode, setLoginMode] = useState<'passcode' | 'credentials'>('passcode');
  const [passcode, setPasscode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [matchingStatus, setMatchingStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [gavelNotification, setGavelNotification] = useState<string | null>(null);

  // Gavel Strike notification trigger
  const handleGavelStrikeEvent = () => {
    setGavelNotification('⚖️ تم طرق مطرقة مجلس النواب العراقي - افتتاح الجلسة الرسمية');
    setTimeout(() => {
      setGavelNotification(null);
    }, 3800);
  };

  // Live Time and Date ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setCurrentDate(now.toLocaleDateString('ar-IQ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Multi-tier authentication with Firebase & Google Sheets live verification
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    let targetUserOrCode = '';
    let targetPass = '';

    if (loginMode === 'passcode') {
      const cleanCode = passcode.trim();
      if (!cleanCode) {
        setErrorMsg('يرجى إدخال رمز الدخول السري المعتمد.');
        return;
      }
      targetUserOrCode = cleanCode;
      targetPass = cleanCode;
    } else {
      const cleanUser = username.trim();
      const cleanPass = password.trim();

      if (!cleanUser && !cleanPass) {
        setErrorMsg('يرجى إدخال اسم المستخدم أو كلمة المرور.');
        return;
      }

      if (cleanUser && !cleanPass) {
        targetUserOrCode = cleanUser;
        targetPass = cleanUser;
      } else if (!cleanUser && cleanPass) {
        targetUserOrCode = cleanPass;
        targetPass = cleanPass;
      } else {
        targetUserOrCode = cleanUser;
        targetPass = cleanPass;
      }
    }

    setIsSubmitting(true);
    setMatchingStatus('جاري التحقق ومطابقة الرمز وفتح المنظومة...');

    try {
      const success = await login(targetUserOrCode, targetPass);

      if (success) {
        setMatchingStatus('✓ تمت المطابقة بنجاح! جاري فتح المنظومة...');
        playWelcomeChime();
      } else {
        setErrorMsg('بيانات الدخول أو الرمز غير صحيح. يرجى التأكد من الرمز والمحاولة مجدداً.');
        setIsSubmitting(false);
        setMatchingStatus('');
      }
    } catch (err: any) {
      console.error('Login match error:', err);
      setErrorMsg('تعذر تسجيل الدخول في الوقت الحالي. يرجى إعادة المحاولة.');
      setIsSubmitting(false);
      setMatchingStatus('');
    }
  };

  const handleDirectAssigned = () => {
    if (directLoginAsAssigned()) {
      playWelcomeChime();
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#050912] text-slate-100 flex flex-col font-['Tajawal',sans-serif] selection:bg-amber-500 selection:text-slate-950" dir="rtl">
      
      {/* Real-time Gavel Strike Alert Notification Banner */}
      {gavelNotification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-amber-200 border-2 border-amber-400 px-6 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-md">
          <span className="text-xl">⚖️</span>
          <span className="text-xs sm:text-sm font-black text-amber-300 tracking-wide">{gavelNotification}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="relative z-30 w-full bg-[#080d1a]/95 backdrop-blur-xl border-b border-slate-800/80 px-3 sm:px-6 py-2.5 flex items-center justify-between shrink-0 shadow-xl">
        {/* Brand & Parliamentary Identity */}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 border border-amber-300/40">
              <Building2 className="w-5 h-5 text-slate-950" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Award className="w-2.5 h-2.5 text-amber-400" />
                مجلس النواب العراقي
              </span>
              <span className="text-[11px] text-slate-400 font-bold hidden md:inline">
                محافظة {systemSettings.province}
              </span>
            </div>
            <h1 className="text-xs sm:text-sm font-black text-white mt-0.5 tracking-tight flex items-center gap-2">
              <span>{systemSettings.appName}</span>
              <span className="text-[9px] font-mono text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-950/70 border border-emerald-500/30 hidden sm:inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                سحابي مؤمن
              </span>
            </h1>
          </div>
        </div>

        {/* Top Header Controls: Time, Gavel Trigger, Mobile Drawer Toggle */}
        <div className="flex items-center gap-2">
          {/* Quick Gavel Strike Trigger */}
          <button
            type="button"
            onClick={() => {
              playParliamentGavelStrikeSound();
              handleGavelStrikeEvent();
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/35 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm"
            title="طرق مطرقة رئاسة مجلس النواب العراقي وسماع الصوت الرسمي"
          >
            <span>⚖️ طرق المطرقة</span>
          </button>

          {/* Time & Date Ticker */}
          <div className="hidden lg:flex flex-col text-left pl-3 border-l border-slate-800">
            <span className="text-xs font-mono font-bold text-amber-300" dir="ltr">{currentTime}</span>
            <span className="text-[10px] text-slate-400 font-medium">{currentDate}</span>
          </div>

          {/* Desktop App Install Button */}
          <button
            onClick={() => setIsDesktopInstallModalOpen(true)}
            className="hidden sm:flex px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-bold items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <Laptop className="w-3.5 h-3.5 text-amber-400" />
            <span>تثبيت التطبيق</span>
          </button>

          {/* Mobile Toggle Button for Side Login Drawer */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="lg:hidden px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            {isSidebarCollapsed ? (
              <>
                <KeyRound className="w-3.5 h-3.5" />
                <span>فتح بوابة الدخول</span>
              </>
            ) : (
              <>
                <Film className="w-3.5 h-3.5" />
                <span>مشاهدة الفيديو 4K</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Split Layout: 4K Video Section + Lateral Side Login Portal ("بوابة الدخول في الجانب") */}
      <div className="relative flex-1 w-full flex flex-col lg:flex-row overflow-hidden">
        
        {/* 1. The 4K Video Canvas Area (Takes full view on desktop when expanded, or main view) */}
        <div className={`relative flex-1 h-full overflow-hidden transition-all duration-300 ${
          isSidebarCollapsed ? 'w-full' : ''
        }`}>
          <Parliament4KVideoPlayer
            onStrikeGavel={handleGavelStrikeEvent}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </div>

        {/* 2. The Lateral Side Login Portal ("البوابة في الجانب") */}
        <aside className={`relative z-20 w-full lg:w-[440px] xl:w-[480px] shrink-0 h-auto lg:h-full bg-gradient-to-b from-[#0b1220]/98 via-[#080d19]/98 to-[#050811]/98 backdrop-blur-2xl border-t lg:border-t-0 lg:border-r border-amber-500/30 shadow-[-15px_0_35px_rgba(0,0,0,0.6)] flex flex-col justify-between overflow-y-auto transition-all duration-300 ${
          isSidebarCollapsed ? 'hidden lg:hidden' : 'flex'
        }`}>
          
          {/* Side Panel Header with Golden Iraqi Emblem */}
          <div className="p-5 sm:p-7 border-b border-slate-800/80 bg-slate-950/40 relative">
            
            {/* Top Accent Gold Bar */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-300 border border-amber-400/30">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                <span>بوابة الدخول الرسمية المعتمدة</span>
              </div>

              {/* Collapse Sidebar Button (Desktop) */}
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                className="hidden lg:flex p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 text-xs transition-colors cursor-pointer"
                title="إخفاء الجانب ومشاهدة الفيديو 4K بالكامل"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/25 via-amber-600/15 to-transparent border border-amber-400/40 flex items-center justify-center text-amber-300 text-3xl shadow-lg shrink-0">
                ⚖️
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  منظومة إدارة مكتب النائب
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  مجلس النواب العراقي • نظام إداري مشفر ومؤمن
                </p>
              </div>
            </div>
          </div>

          {/* Side Panel Body: Form & Modes */}
          <div className="p-5 sm:p-7 flex-1 flex flex-col justify-center">
            
            {/* Assigned Workstation Banner (If configured) */}
            {assignedWorkstationUser && (
              <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-blue-950/70 via-slate-900/80 to-blue-950/70 border border-blue-500/40 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5 text-right">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 font-bold shrink-0">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-blue-300 font-bold">محطة عمل مخصصة للموظف:</div>
                    <div className="text-xs font-black text-white">{assignedWorkstationUser.FullName}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleDirectAssigned}
                    className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    دخول مباشر
                  </button>
                  <button
                    type="button"
                    onClick={() => assignWorkstationUser(null)}
                    title="إلغاء التخصيص والدخول بحساب آخر"
                    className="p-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Login Mode Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/90 rounded-2xl border border-slate-800 mb-4">
              <button
                type="button"
                onClick={() => {
                  setLoginMode('passcode');
                  setErrorMsg('');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  loginMode === 'passcode'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>الرمز السري المعتمد</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLoginMode('credentials');
                  setErrorMsg('');
                }}
                className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  loginMode === 'credentials'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>اسم المستخدم وكلمة السر</span>
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-bold text-center flex items-center justify-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Matching Live Status Feedback */}
            {matchingStatus && (
              <div className="mb-4 p-3 rounded-2xl bg-amber-950/50 border border-amber-500/50 text-amber-200 text-xs font-bold text-center flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                <span>{matchingStatus}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {loginMode === 'passcode' ? (
                /* Passcode Single Mode */
                <div className="space-y-1.5 text-right">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-300">
                      الرمز السري المعتمد للدخول
                    </label>
                    <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      مطابقة فورية
                    </span>
                  </div>
                  <div className="relative group">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passcode}
                      onChange={(e) => {
                        setPasscode(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      placeholder="أدخل الرمز السري (مثال: 2026 أو رمز الموظف)..."
                      className="w-full px-4 py-3.5 pr-11 pl-11 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 text-right text-sm font-mono tracking-wider transition-all shadow-inner"
                      required
                      autoFocus
                      autoComplete="current-password"
                    />
                    <KeyRound className="w-4 h-4 text-slate-500 group-focus-within:text-amber-400 absolute right-4 top-4 pointer-events-none transition-colors" />
                    
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-4 top-3.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title={showPassword ? 'إخفاء الرمز' : 'إظهار الرمز'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    يقبل الرمز السري للمطور، رموز الموظفين المعتمدة، أو رمز الطوارئ العام.
                  </p>
                </div>
              ) : (
                /* Username & Password Mode */
                <>
                  <div className="space-y-1.5 text-right">
                    <label className="block text-xs font-bold text-slate-300">
                      اسم المستخدم أو معرف الموظف
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          if (errorMsg) setErrorMsg('');
                        }}
                        placeholder="أدخل اسم المستخدم أو المعرف..."
                        className="w-full px-4 py-3 pr-11 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 text-right text-xs transition-all shadow-inner"
                        autoComplete="username"
                      />
                      <UserCheck className="w-4 h-4 text-slate-500 group-focus-within:text-amber-400 absolute right-4 top-3.5 pointer-events-none transition-colors" />
                    </div>
                  </div>

                  <div className="space-y-1.5 text-right">
                    <label className="block text-xs font-bold text-slate-300">
                      كلمة المرور أو الرمز السري
                    </label>
                    <div className="relative group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errorMsg) setErrorMsg('');
                        }}
                        placeholder="أدخل كلمة المرور..."
                        className="w-full px-4 py-3 pr-11 pl-11 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 text-right text-xs transition-all shadow-inner font-mono"
                        autoComplete="current-password"
                      />
                      <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-amber-400 absolute right-4 top-3.5 pointer-events-none transition-colors" />
                      
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-4 top-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-2xl font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm mt-3 disabled:opacity-75"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 text-slate-950 animate-spin" />
                    <span>جاري مطابقة البيانات وفتح المنظومة...</span>
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5 text-slate-950" />
                    <span>تسجيل الدخول وفتح المنظومة</span>
                    <ChevronLeft className="w-4 h-4" />
                  </>
                )}
              </button>

            </form>

          </div>

          {/* Side Panel Footer with Security Badges */}
          <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>نظام إداري إلكتروني مشفر</span>
            </span>
            <span className="font-mono text-slate-500 text-[10px]">
              مجلس النواب • ذي قار
            </span>
          </div>

        </aside>

        {/* Floating Expand Tab when sidebar is collapsed on desktop */}
        {isSidebarCollapsed && (
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(false)}
            className="hidden lg:flex fixed top-20 right-6 z-40 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs items-center gap-2 shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>إظهار بوابة تسجيل الدخول</span>
          </button>
        )}

      </div>

      {/* Modern High-End Executive Navigation Footer */}
      <footer className="relative z-30 w-full bg-[#080d1a]/95 backdrop-blur-xl border-t border-slate-800/80 py-2.5 px-4 text-xs text-slate-400 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-right">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">مكتب النائب المهندسة علا عودة الناشي</span>
            <span>•</span>
            <span className="text-slate-400">{systemSettings.officeAddress}</span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="font-mono text-slate-300">الخط الساخن: {systemSettings.hotline}</span>
            <span>•</span>
            <span className="text-slate-500">الحقوق محفوظة © 2026</span>
          </div>
        </div>
      </footer>

      {/* Desktop App Install Modal */}
      <DesktopInstallModal
        isOpen={isDesktopInstallModalOpen}
        onClose={() => setIsDesktopInstallModalOpen(false)}
      />

      {/* 2-Second Employee Entry Loading Message Overlay */}
      <SessionLoadingOverlay 
        isLoading={isSessionLoading} 
        message={sessionLoadingMessage}
        userName={assignedWorkstationUser?.FullName}
        officeName={systemSettings?.officeName || systemSettings?.appName}
      />
    </div>
  );
};
