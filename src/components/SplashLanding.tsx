import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Building2, 
  ShieldCheck, 
  Award,
  Lock,
  ChevronLeft,
  UserCheck,
  Eye,
  EyeOff,
  Fingerprint,
  AlertCircle,
  Laptop,
  CheckCircle2,
  Sparkles,
  Shield,
  KeyRound
} from 'lucide-react';
import { DesktopInstallModal } from './DesktopInstallModal';
import { Interactive3DBackground } from './Interactive3DBackground';
import { SessionLoadingOverlay } from './SessionLoadingOverlay';
import { playWelcomeChime } from '../utils/audio';

export const SplashLanding: React.FC = () => {
  const { 
    systemSettings, 
    login, 
    isDesktopInstallModalOpen, 
    setIsDesktopInstallModalOpen,
    assignedWorkstationUser,
    assignWorkstationUser,
    isSessionLoading,
    sessionLoadingMessage
  } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // 3D Card Tilt Effect
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, glareX: 50, glareY: 50 });

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rx = ((y - centerY) / centerY) * -6;
    const ry = ((x - centerX) / centerX) * 6;
    const glareX = Math.round((x / rect.width) * 100);
    const glareY = Math.round((y / rect.height) * 100);

    setTilt({ rx, ry, glareX, glareY });
  };

  const handleCardMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, glareX: 50, glareY: 50 });
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

  // Standard Staff Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const success = login(username.trim(), password);
      if (!success) {
        setErrorMsg('بيانات الدخول غير صحيحة أو غير مصرح لها. يرجى مراجعة إدارة المكتب.');
        setIsSubmitting(false);
      } else {
        setErrorMsg('');
        playWelcomeChime();
      }
    }, 300);
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#060a12] text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 font-['Tajawal',sans-serif]" dir="rtl">
      
      {/* 3D Background Engine */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <Interactive3DBackground />

        {/* Ambient 3D Volumetric Lighting */}
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-gradient-to-br from-amber-500/15 via-amber-600/5 to-transparent rounded-full blur-[130px]" />
        <div className="absolute top-1/3 -left-32 w-[650px] h-[650px] bg-gradient-to-tr from-blue-600/15 via-indigo-600/8 to-transparent rounded-full blur-[140px]" />
        <div className="absolute -bottom-32 right-1/4 w-[550px] h-[550px] bg-gradient-to-tl from-emerald-600/12 via-teal-600/5 to-transparent rounded-full blur-[120px]" />
      </div>

      {/* Top Parliament Header */}
      <header className="relative z-20 w-full bg-[#080d1a]/85 backdrop-blur-2xl border-b border-slate-800/80 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          
          {/* Identity & Seal */}
          <div className="flex items-center gap-3.5">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-amber-700 rounded-2xl blur-xs opacity-60 group-hover:opacity-90 transition duration-300" />
              <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-xl shadow-amber-500/20 border border-amber-300/40">
                <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-slate-950" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Award className="w-3 h-3 text-amber-400" />
                  مجلس النواب العراقي
                </span>
                <span className="text-xs text-slate-400 font-bold hidden sm:inline">
                  محافظة {systemSettings.province}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-black text-white mt-0.5 tracking-tight flex items-center gap-2">
                <span>{systemSettings.appName}</span>
                <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-500/30">
                  سحابي مؤمن
                </span>
              </h1>
            </div>
          </div>

          {/* Clock & Install */}
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex flex-col text-left pl-3 border-l border-slate-800">
              <span className="text-xs font-mono font-bold text-amber-300" dir="ltr">{currentTime}</span>
              <span className="text-[10px] text-slate-400 font-medium">{currentDate}</span>
            </div>

            <button
              onClick={() => setIsDesktopInstallModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <Laptop className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">تثبيت التطبيق (PWA / APK)</span>
              <span className="sm:hidden">تثبيت</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main 3D Login Body */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-3 sm:p-6 my-auto">
        <div className="w-full max-w-md sm:max-w-lg perspective-1000">
          
          <div
            ref={cardRef}
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
            style={{
              transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
              transition: 'transform 0.15s ease-out'
            }}
            className="relative rounded-3xl p-6 sm:p-9 bg-gradient-to-b from-[#0e1628]/95 via-[#0b1220]/95 to-[#070c18]/95 backdrop-blur-2xl border border-amber-500/30 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_40px_rgba(245,158,11,0.08)] overflow-hidden"
          >
            {/* Top Light Accent */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />

            {/* Subtle Glare reflection */}
            <div
              className="absolute inset-0 pointer-events-none opacity-25 transition-opacity"
              style={{
                background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(251, 191, 36, 0.25) 0%, transparent 60%)`
              }}
            />

            {/* Header of the Card */}
            <div className="text-center space-y-2.5 mb-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 via-blue-600/15 to-transparent border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
                <ShieldCheck className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  بوابة الدخول الرسمية المعتمدة
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  أدخل اسم المستخدم وكلمة المرور المسجلة رسمياً للدخول
                </p>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-bold text-center flex items-center justify-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Username Input */}
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
                    placeholder="أدخل اسم المستخدم..."
                    className="w-full px-4 py-3.5 pr-11 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 text-right text-xs transition-all shadow-inner"
                    required
                    autoComplete="username"
                  />
                  <UserCheck className="w-4 h-4 text-slate-500 group-focus-within:text-amber-400 absolute right-4 top-4 pointer-events-none transition-colors" />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5 text-right">
                <label className="block text-xs font-bold text-slate-300">
                  كلمة المرور
                </label>
                <div className="relative group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="أدخل كلمة المرور الرسمية..."
                    className="w-full px-4 py-3.5 pr-11 pl-11 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 text-right text-xs transition-all shadow-inner font-mono"
                    required
                    autoComplete="current-password"
                  />
                  <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-amber-400 absolute right-4 top-4 pointer-events-none transition-colors" />
                  
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-3.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 sm:py-4 px-4 rounded-2xl font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm mt-2 disabled:opacity-75"
              >
                <Fingerprint className="w-5 h-5 text-slate-950" />
                <span>{isSubmitting ? 'جاري التحقق من الصلاحيات وفتح النظام...' : 'تسجيل الدخول إلى المنظومة'}</span>
                <ChevronLeft className="w-4 h-4" />
              </button>

            </form>

            {/* Footer Trust Indicator */}
            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-slate-400">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>اتصال سحابي مشفر وآمن</span>
              </span>
              <span className="font-mono text-slate-500 text-[10px]">
                مجلس النواب • ذي قار
              </span>
            </div>

          </div>

        </div>
      </main>

      {/* Modern High-End Executive Navigation Footer */}
      <footer className="relative z-20 w-full bg-[#080d1a]/85 backdrop-blur-2xl border-t border-slate-800/80 py-3.5 px-4 text-xs text-slate-400">
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
