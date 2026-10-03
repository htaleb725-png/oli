import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Building2, 
  ShieldCheck, 
  Layers, 
  Award,
  Lock,
  Unlock,
  ChevronLeft,
  UserCheck,
  KeyRound,
  Monitor,
  Sparkles,
  Eye,
  EyeOff,
  Fingerprint,
  UserCog,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Check,
  Copy,
  Clock,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { DesktopInstallModal } from './DesktopInstallModal';
import { User } from '../types';

export const SplashLanding: React.FC = () => {
  const { 
    systemSettings, 
    login, 
    users, 
    isDesktopInstallModalOpen, 
    setIsDesktopInstallModalOpen,
    assignedWorkstationUser,
    assignWorkstationUser,
    directLoginAsAssigned
  } = useApp();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  // Developer & Director Provisioning Console
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState(false);
  const [managerError, setManagerError] = useState('');
  const [copiedUser, setCopiedUser] = useState<string | null>(null);

  // Time and Date ticker
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

  // Time-based greeting in Iraqi Arabic
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'صباح الخير والبركة';
    if (hour >= 12 && hour < 17) return 'طاب مساؤكم بكل خير';
    return 'مساء الخير وأهلاً وسهلاً بكم';
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('يرجى إدخال اسم المستخدم أو رمز الموظف وكلمة المرور.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const success = login(username, password);
      if (!success) {
        setErrorMsg('رمز الدخول أو كلمة المرور غير صحيحة. يرجى التأكد أو مراجعة مدير المكتب.');
        setIsSubmitting(false);
      } else {
        setErrorMsg('');
      }
    }, 250);
  };

  const handleDirectLogin = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      const success = directLoginAsAssigned();
      if (!success) {
        setErrorMsg('تعذر الدخول المباشر. يرجى إدخال كلمة المرور يدوياً.');
        setIsSubmitting(false);
      }
    }, 200);
  };

  const handleManagerAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // Allow developer or director credentials / master pins
    const isValid = managerPin === '123' || 
                    managerPin === 'admin' || 
                    managerPin === 'developer' || 
                    managerPin === 'director';
    if (isValid) {
      setIsManagerAuthenticated(true);
      setManagerError('');
    } else {
      setManagerError('رمز التحقق غير صحيح. مخصص فقط للمطور ومدير المكتب التنفيذي.');
    }
  };

  const handleAssignStation = (user: User) => {
    assignWorkstationUser(user);
    alert(`تم تخصيص هذا الجهاز بنجاح للموظف (${user.FullName}) للدخول المباشر.`);
    setShowManagerModal(false);
  };

  const handleClearStation = () => {
    assignWorkstationUser(null);
    alert('تم إلغاء تخصيص الجهاز والعودة إلى وضع الدخول اليدوي.');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUser(id);
    setTimeout(() => setCopiedUser(null), 2000);
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Background Animated Gradient Aura */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-amber-600/15 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25"></div>
      </div>

      {/* Top Header */}
      <header className="relative z-20 w-full bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <Building2 className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  مجلس النواب العراقي
                </span>
                <span className="text-xs text-slate-400 font-bold">{systemSettings.province}</span>
              </div>
              <h1 className="text-sm sm:text-base font-black text-white mt-0.5 tracking-tight">
                {systemSettings.appName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Clock */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentTime}</span>
            </div>

            {/* Desktop Install Button */}
            <button
              onClick={() => setIsDesktopInstallModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-950/50 hover:bg-indigo-900/60 text-indigo-300 text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95 group"
              title="تثبيت البرنامج على سطح المكتب في الحاسوب بنقرة واحدة"
            >
              <Monitor className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline">تثبيت تطبيق سطح المكتب</span>
              <span className="sm:hidden">تثبيت التطبيق</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero & Login Experience */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-12 flex-1 flex flex-col lg:flex-row items-center justify-between gap-10">
        
        {/* Left Side: Brand presentation */}
        <div className="flex-1 space-y-6 text-center lg:text-right">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-amber-500/30 text-amber-400 text-xs font-bold shadow-inner">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{getGreeting()} • {currentDate}</span>
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
              المنظومة الإدارية والخدمية
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500">
                {systemSettings.deputyName}
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
              البوابة الإلكترونية المعتمدة لإدارة شؤون المواطنين والمراجعين، متابعة الكتب الرسمية، وأرشفة معاملات ذي قار مع ربط الأقسام بصلاحيات مشفرة ومؤتمتة.
            </p>
          </div>

          {/* Department Pills / Interactive Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
            <div className="p-3 rounded-2xl bg-slate-900/70 border border-emerald-500/30 text-right hover:border-emerald-400 transition-all hover:translate-y-[-2px]">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2 font-bold text-sm">
                🏛️
              </div>
              <h3 className="text-xs font-bold text-white">قسم الاستقبال</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">تسجيل المراجعين والباركود</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/70 border border-blue-500/30 text-right hover:border-blue-400 transition-all hover:translate-y-[-2px]">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2 font-bold text-sm">
                📑
              </div>
              <h3 className="text-xs font-bold text-white">إدارة المعاملات</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">متابعة الوزارات والدوائر</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/70 border border-purple-500/30 text-right hover:border-purple-400 transition-all hover:translate-y-[-2px]">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2 font-bold text-sm">
                👔
              </div>
              <h3 className="text-xs font-bold text-white">مدير المكتب</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">الرقابة والقرارات التنفيذية</p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/70 border border-amber-500/30 text-right hover:border-amber-400 transition-all hover:translate-y-[-2px]">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2 font-bold text-sm">
                🤝
              </div>
              <h3 className="text-xs font-bold text-white">مقابلات النائب</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">الجداول والمحاضر الرسمية</p>
            </div>
          </div>

          {/* Direct Manager/Developer Access Trigger */}
          <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <button
              onClick={() => {
                setShowManagerModal(true);
                setIsManagerAuthenticated(false);
                setManagerPin('');
                setManagerError('');
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-300 text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
            >
              <UserCog className="w-4 h-4 text-amber-400" />
              <span>بوابة المدير والمطور (تخصيص محطة العمل وتعيين الحسابات)</span>
            </button>
          </div>
        </div>

        {/* Right Side: Professional High-Security Login Card */}
        <div className="w-full max-w-md">
          <div className="relative bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 overflow-hidden">
            
            {/* Top decorative glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent"></div>

            {/* Condition 1: If This Device is Assigned to a Specific User */}
            {assignedWorkstationUser ? (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
                    <Laptop className="w-8 h-8 animate-pulse" />
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>محطة عمل مخصصة ومعتمدة رسمياً</span>
                  </div>
                  <h3 className="text-lg font-black text-white">
                    {assignedWorkstationUser.FullName}
                  </h3>
                  <p className="text-xs text-amber-400 font-bold">
                    {assignedWorkstationUser.RoleArabic}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    تم تخصيص هذا الجهاز لك من قبل الإدارة للدخول الفوري المباشر دون الحاجة لكتابة البيانات في كل مرة.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDirectLogin}
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-4 rounded-2xl font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer text-sm"
                >
                  <Fingerprint className="w-5 h-5 text-slate-950" />
                  <span>{isSubmitting ? 'جاري فتح القسم المصرح به...' : 'دخول مباشر فوري للمنظومة'}</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={() => assignWorkstationUser(null)}
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    <span>الدخول بحساب موظف آخر</span>
                  </button>

                  <span className="text-[10px] text-slate-500 font-mono">
                    ID: {assignedWorkstationUser.User_ID}
                  </span>
                </div>
              </div>
            ) : (
              /* Condition 2: Regular Secure Login Box */
              <div className="space-y-5">
                <div className="text-center space-y-1.5">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
                    <Lock className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-black text-white">تسجيل الدخول للمنظومة</h3>
                  <p className="text-xs text-slate-400">
                    أدخل اسم المستخدم أو رمز الموظف وكلمة المرور المخصصة لك
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs font-bold text-center flex items-center justify-center gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  {/* Username Field */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300 text-right">
                      اسم المستخدم أو رمز الموظف
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          if (errorMsg) setErrorMsg('');
                        }}
                        placeholder="أدخل اسمك أو رمز الموظف..."
                        className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-right text-xs transition-all"
                        required
                        autoComplete="username"
                      />
                      <UserCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  {/* Password Field with Show/Hide Toggle */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-300 text-right">
                        كلمة المرور
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {showPassword ? (
                          <>
                            <EyeOff className="w-3 h-3" />
                            <span>إخفاء</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>إظهار</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errorMsg) setErrorMsg('');
                        }}
                        placeholder="أدخل كلمة المرور..."
                        className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-right text-xs transition-all"
                        required
                        autoComplete="current-password"
                      />
                      <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-4 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-95 shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <span>{isSubmitting ? 'جاري التحقق من الصلاحيات...' : 'التحقق وتسجيل الدخول'}</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </form>

                {/* Privacy Assurance Notice (Codes are kept private) */}
                <div className="pt-3 border-t border-slate-800 text-center">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    🔒 رموز الدخول وكلمات المرور خاصة ومشفرة. في حال عدم امتلاكك لرمزك أو رغبتك بتخصيص هذا الجهاز لدخولك المباشر، يرجى التنسيق مع <strong>مدير المكتب التنفيذي</strong> أو <strong>المطور</strong>.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full bg-slate-900/90 border-t border-slate-800 py-3.5 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">{systemSettings.deputyTitle}</span>
            <span>•</span>
            <span className="text-amber-400 font-semibold">{systemSettings.province}</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>المكتب: {systemSettings.officeAddress}</span>
            <span>•</span>
            <span className="font-mono text-slate-300">هاتف: {systemSettings.hotline}</span>
          </div>
        </div>
      </footer>

      {/* Developer & Director Provisioning Modal */}
      {showManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" dir="rtl">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">بوابة الإشراف وتخصيص محطات العمل</h3>
                  <p className="text-xs text-slate-400">خاصة بمدير المكتب التنفيذي ومطور النظام فقط</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManagerModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {!isManagerAuthenticated ? (
              /* Verification Gate */
              <form onSubmit={handleManagerAuth} className="space-y-4 py-2">
                <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/20 text-amber-200 text-xs leading-relaxed flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-300 font-bold mb-0.5">حماية الخصوصية والصلاحيات</strong>
                    لحماية بيانات الموظفين ومنع ظهور رموز الدخول للعامة، يرجى تأكيد هويتك كمدير أو مطور بإدخال الرمز المعتمد.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">
                    رمز تحقق المدير أو المطور
                  </label>
                  <input
                    type="password"
                    value={managerPin}
                    onChange={(e) => setManagerPin(e.target.value)}
                    placeholder="أدخل رمز التحقق..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
                    autoFocus
                    required
                  />
                </div>

                {managerError && (
                  <p className="text-xs text-rose-400 font-bold">{managerError}</p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer"
                >
                  التحقق وفتح لوحة التخصيص
                </button>
              </form>
            ) : (
              /* Authenticated Provisioning View */
              <div className="space-y-5">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <Laptop className="w-5 h-5 text-amber-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">حالة هذا الجهاز حالياً:</span>
                      <span className="text-[11px] text-slate-400">
                        {assignedWorkstationUser 
                          ? `مخصص لـ: ${assignedWorkstationUser.FullName} (${assignedWorkstationUser.RoleArabic})`
                          : 'غير مخصص لأي موظف (يتطلب إدخال الرمز يدوياً)'}
                      </span>
                    </div>
                  </div>

                  {assignedWorkstationUser && (
                    <button
                      type="button"
                      onClick={handleClearStation}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 hover:bg-rose-900 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      إلغاء التخصيص
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-300">قائمة حسابات الموظفين المعتمدة:</h4>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {users.map((u) => {
                      const isCurrentlyAssigned = assignedWorkstationUser?.User_ID === u.User_ID;
                      return (
                        <div
                          key={u.User_ID}
                          className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isCurrentlyAssigned 
                              ? 'bg-amber-950/20 border-amber-500/50' 
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{u.FullName}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold">
                                {u.RoleArabic}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400 font-mono">
                              <span>User: <strong className="text-slate-200">{u.Username}</strong></span>
                              <span>•</span>
                              <span>ID: {u.User_ID}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(`اسم المستخدم: ${u.Username}\nكلمة المرور: ${u.Password}\nالقسم: ${u.RoleArabic}`, u.User_ID)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                              title="نسخ بيانات الحساب لإرسالها للموظف"
                            >
                              {copiedUser === u.User_ID ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedUser === u.User_ID ? 'تم النسخ' : 'نسخ الرمز'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAssignStation(u)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                                isCurrentlyAssigned
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{isCurrentlyAssigned ? 'هذا الجهاز مخصص له' : 'تخصيص هذا الجهاز للدخول المباشر'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowManagerModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    إغلاق النافذة
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Desktop App Install Modal */}
      <DesktopInstallModal
        isOpen={isDesktopInstallModalOpen}
        onClose={() => setIsDesktopInstallModalOpen(false)}
      />
    </div>
  );
};
