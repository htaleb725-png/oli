import React, { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  Zap,
  Globe2,
  ScanLine,
  Terminal,
  Cpu,
  Key,
  Database,
  FileSpreadsheet,
  Boxes,
  HelpCircle,
  Hash
} from 'lucide-react';
import { DesktopInstallModal } from './DesktopInstallModal';
import { Interactive3DBackground } from './Interactive3DBackground';
import { D3InteractiveNetwork } from './D3InteractiveNetwork';
import { SessionLoadingOverlay } from './SessionLoadingOverlay';
import { playWelcomeChime } from '../utils/audio';
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
    directLoginAsAssigned,
    loginWithDeveloperPasscode,
    developerPasscode,
    isSessionLoading,
    sessionLoadingMessage
  } = useApp();

  // Primary Login state (Dedicated exclusively to Staff & Authorized Employees)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [visualMode, setVisualMode] = useState<'three' | 'd3' | 'cyber'>('three');

  // Executive Director & Developer Portal Modal State
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [portalActiveTab, setPortalActiveTab] = useState<'developer' | 'director'>('developer');
  const [devCodeInput, setDevCodeInput] = useState('');
  const [devErrorMsg, setDevErrorMsg] = useState('');
  const [isDevSubmitting, setIsDevSubmitting] = useState(false);
  const [showDevCode, setShowDevCode] = useState(false);

  // Director Workstation Provisioning State
  const [managerPin, setManagerPin] = useState('');
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState(false);
  const [managerError, setManagerError] = useState('');
  const [copiedUser, setCopiedUser] = useState<string | null>(null);

  // Interactive 3D Card Physics (True Gyroscopic / Mouse Perspective Tilt)
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; glareX: number; glareY: number }>({
    rx: 0,
    ry: 0,
    glareX: 50,
    glareY: 50
  });

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Smooth subtle 3D rotational tilt (-8 to +8 deg)
    const rx = ((y - centerY) / centerY) * -8;
    const ry = ((x - centerX) / centerX) * 8;
    const glareX = Math.round((x / rect.width) * 100);
    const glareY = Math.round((y / rect.height) * 100);

    setTilt({ rx, ry, glareX, glareY });
  };

  const handleCardMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, glareX: 50, glareY: 50 });
  };

  // Keyboard shortcut listener: Ctrl+Shift+D or Alt+D to discretely open Developer & Director portal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') || (e.altKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        setShowPortalModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Time-based greeting in Iraqi Arabic
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'صباح الخير والبركة';
    if (hour >= 12 && hour < 17) return 'طاب مساؤكم بكل خير';
    return 'مساء الخير وأهلاً وسهلاً بكم';
  };

  // Standard Staff / Employee Login
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
        setErrorMsg('رمز الدخول أو كلمة المرور غير صحيحة. يرجى التأكد أو مراجعة إدارة المكتب.');
        setIsSubmitting(false);
      } else {
        setErrorMsg('');
        playWelcomeChime();
      }
    }, 250);
  };

  // Direct Assigned Workstation Login
  const handleDirectLogin = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      const success = directLoginAsAssigned();
      if (!success) {
        setErrorMsg('تعذر الدخول المباشر. يرجى إدخال كلمة المرور يدوياً.');
        setIsSubmitting(false);
      } else {
        playWelcomeChime();
      }
    }, 200);
  };

  // Developer Fast Gate Login inside Portal Modal
  const handleDeveloperLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!devCodeInput.trim()) {
      setDevErrorMsg('يرجى إدخال رمز دخول المطور السري.');
      return;
    }
    setIsDevSubmitting(true);
    setTimeout(() => {
      const success = loginWithDeveloperPasscode(devCodeInput.trim());
      if (!success) {
        setDevErrorMsg('رمز دخول المطور غير صحيح. يرجى التحقق من الشيفرة المعتمدة.');
        setIsDevSubmitting(false);
      } else {
        setShowPortalModal(false);
        playWelcomeChime();
      }
    }, 200);
  };

  // Direct Keypad input for Developer
  const handleKeypadPress = (val: string) => {
    if (val === 'CLEAR') {
      setDevCodeInput('');
      setDevErrorMsg('');
    } else if (val === 'BACK') {
      setDevCodeInput(prev => prev.slice(0, -1));
    } else {
      setDevCodeInput(prev => (prev.length < 8 ? prev + val : prev));
      if (devErrorMsg) setDevErrorMsg('');
    }
  };

  // Director PIN Authentication for Workstation Provisioning
  const handleDirectorAuth = (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = managerPin === '123' || 
                    managerPin === 'admin' || 
                    managerPin === 'developer' || 
                    managerPin === 'director' ||
                    managerPin === '2026';
    if (isValid) {
      setIsManagerAuthenticated(true);
      setManagerError('');
    } else {
      setManagerError('رمز التحقق غير صحيح. مصرح به فقط لمدير المكتب التنفيذي أو المطور.');
    }
  };

  const handleAssignStation = (user: User) => {
    assignWorkstationUser(user);
    alert(`تم تخصيص هذا الجهاز بنجاح للموظف (${user.FullName}) للدخول المباشر المعتمد.`);
    setShowPortalModal(false);
  };

  const handleClearStation = () => {
    assignWorkstationUser(null);
    alert('تم إلغاء تخصيص الجهاز والعودة إلى شاشة تسجيل الدخول المعتادة.');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUser(id);
    setTimeout(() => setCopiedUser(null), 2000);
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#070b14] text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 font-sans" dir="rtl">
      
      {/* 3D Background Engine Visual Canvas */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {visualMode === 'three' && <Interactive3DBackground />}
        {visualMode === 'd3' && <D3InteractiveNetwork />}
        
        {/* Subtle Cyber Grid Mesh Layer */}
        {visualMode === 'cyber' && (
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)]">
            <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-transparent to-transparent"></div>
          </div>
        )}

        {/* Dynamic 3D Volumetric Ambient Glow Spheres */}
        <div className="absolute -top-32 -right-32 w-[550px] h-[550px] bg-gradient-to-br from-amber-500/12 via-amber-600/5 to-transparent rounded-full blur-[110px]"></div>
        <div className="absolute top-1/3 -left-32 w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/12 via-indigo-600/6 to-transparent rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-32 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-emerald-600/10 via-teal-600/4 to-transparent rounded-full blur-[110px]"></div>
      </div>

      {/* Modern High-End Executive Navigation Header */}
      <header className="relative z-20 w-full bg-[#0b1220]/80 backdrop-blur-2xl border-b border-slate-800/80 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          
          {/* Right Brand: Official Parliament Seal & Deputy Identity */}
          <div className="flex items-center gap-3.5">
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-amber-700 rounded-2xl blur-sm opacity-50 group-hover:opacity-80 transition duration-300"></div>
              <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-xl shadow-amber-500/20 border border-amber-300/40">
                <Building2 className="w-6 h-6 text-slate-950 transform group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-inner">
                  <Award className="w-2.5 h-2.5 text-amber-400" />
                  مجلس النواب العراقي
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  محافظة {systemSettings.province}
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-black text-white mt-0.5 tracking-tight flex items-center gap-2">
                <span>{systemSettings.appName}</span>
                <span className="text-[10px] font-mono font-normal text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
                  v3.8 3D
                </span>
              </h1>
            </div>
          </div>

          {/* Left Controls: 3D Visual Switcher, Live Clock, and PWA Desktop */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* 3D Visual Engine Selector */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setVisualMode('three')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                  visualMode === 'three'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="فضاء ثلاثي الأبعاد 3D بتقنية Three.js الحديثة"
              >
                <Boxes className="w-3 h-3" />
                <span className="hidden sm:inline">فضاء 3D</span>
              </button>

              <button
                type="button"
                onClick={() => setVisualMode('d3')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 ${
                  visualMode === 'd3'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="شبكة تفاعلية عصبية D3 لربط الأقسام والمحافظة"
              >
                <Globe2 className="w-3 h-3" />
                <span className="hidden sm:inline">شبكة D3</span>
              </button>

              <button
                type="button"
                onClick={() => setVisualMode('cyber')}
                className={`px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                  visualMode === 'cyber'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="الشبكة السيبرانية الهندسية"
              >
                <span>الشبكة</span>
              </button>
            </div>

            {/* Live Clock & Date */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 text-xs font-mono shadow-sm">
              <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{currentTime}</span>
            </div>

            {/* Desktop PWA App Install Button */}
            <button
              onClick={() => setIsDesktopInstallModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95 group"
              title="تثبيت التطبيق كبرنامج مستقل على سطح المكتب"
            >
              <Monitor className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-6 transition-transform" />
              <span className="hidden md:inline">تثبيت البرنامج</span>
            </button>

            {/* Discrete Executive & Developer Portal Trigger */}
            <button
              onClick={() => {
                setShowPortalModal(true);
                setDevErrorMsg('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 to-slate-900/80 hover:bg-amber-900/40 text-amber-300 hover:text-amber-200 text-xs font-black transition-all cursor-pointer shadow-lg shadow-amber-500/10 hover:border-amber-400 active:scale-95 group"
              title="بوابة الإشراف العليا، دخول المطور السري وتخصيص محطات العمل (Ctrl+Shift+D)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
              <span>بوابة المدير والمطور</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Experience Hero & 3D Interactive Login Perspective */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-10 flex-1 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14">
        
        {/* Right Side: Hero Brand & 3D Department Modules */}
        <div className="flex-1 space-y-6 text-right w-full">
          
          {/* Official Iraqi Parliament Ribbon */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/90 border border-amber-500/30 text-amber-400 text-xs font-bold shadow-lg backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>{getGreeting()}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300 font-mono text-[11px]">{currentDate}</span>
          </div>

          {/* Prestige Headline with 3D Depth Shimmer */}
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight drop-shadow-md">
              المنظومة الإدارية والخدمية
              <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-l from-amber-300 via-amber-100 to-amber-500 font-black">
                {systemSettings.deputyName}
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-300/90 max-w-2xl leading-relaxed">
              البوابة الإلكترونية الموحدة لإدارة شؤون المراجعين، متابعة الكتب الوزارية، وأرشفة معاملات ذي قار مع ربط الأقسام بقواعد بيانات مؤتمتة وتشفير أمني فائق.
            </p>
          </div>

          {/* 4 Isometric 3D Department Feature Tiles with Real Depth */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            
            {/* Tile 1: Reception */}
            <div className="group relative p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-emerald-500/30 hover:border-emerald-400/80 transition-all duration-300 shadow-xl hover:-translate-y-1 hover:shadow-emerald-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-lg shadow-inner">
                  🏛️
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300">
                  نشط ومؤتمت
                </span>
              </div>
              <h3 className="text-sm font-black text-white group-hover:text-emerald-300 transition-colors">
                قسم الاستعلامات والمراجعين
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                تسجيل طلبات المواطنين، طباعة كروت المراجعة بالباركود، وتوزيع البطاقات الرسمية.
              </p>
            </div>

            {/* Tile 2: Transactions & Ministerial Letters */}
            <div className="group relative p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-blue-500/30 hover:border-blue-400/80 transition-all duration-300 shadow-xl hover:-translate-y-1 hover:shadow-blue-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-lg shadow-inner">
                  📑
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-500/30 text-blue-300">
                  تتبع وزاري
                </span>
              </div>
              <h3 className="text-sm font-black text-white group-hover:text-blue-300 transition-colors">
                إدارة المعاملات والمخاطبات
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                متابعة توجيهات الوزارات والدوائر، قرارات الإحالة، وحالات الإنجاز المباشر.
              </p>
            </div>

            {/* Tile 3: Director Executive Module */}
            <div className="group relative p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-purple-500/30 hover:border-purple-400/80 transition-all duration-300 shadow-xl hover:-translate-y-1 hover:shadow-purple-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center text-lg shadow-inner">
                  👔
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-950/80 border border-purple-500/30 text-purple-300">
                  الرقابة العليا
                </span>
              </div>
              <h3 className="text-sm font-black text-white group-hover:text-purple-300 transition-colors">
                الإدارة التنفيذية والقرارات
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                الموافقة والتوجيه التنفيذي، إبداء أسباب الرفض المسجلة، وإحصائيات العمل الحية.
              </p>
            </div>

            {/* Tile 4: MP Official Interviews */}
            <div className="group relative p-4 rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-950/90 border border-amber-500/30 hover:border-amber-400/80 transition-all duration-300 shadow-xl hover:-translate-y-1 hover:shadow-amber-500/10">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-lg shadow-inner">
                  🤝
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-300">
                  مقابلات مباشرة
                </span>
              </div>
              <h3 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                مقابلات النائب والمحاضر
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                جدولة الجلسات الميدانية، محاضر الاستماع، وأوامر الصرف والمساعدة الفورية.
              </p>
            </div>

          </div>

          {/* System Security Badges & Direct Gate Access Link */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>تشفير 256-Bit</span>
              </span>
              <span className="text-slate-700">|</span>
              <span className="flex items-center gap-1.5 text-blue-400 font-bold">
                <Database className="w-4 h-4" />
                <span>مزامنة سحابية حية (Sheets & Firestore)</span>
              </span>
            </div>

            {/* Discreet Link to Director / Developer Portal */}
            <button
              type="button"
              onClick={() => {
                setShowPortalModal(true);
                setDevErrorMsg('');
              }}
              className="text-amber-400/90 hover:text-amber-300 text-xs font-bold underline underline-offset-4 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>دخول المطور والمدير التنفيذي</span>
              <KeyRound className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Left Side: 3D Holographic Interactive Login Card (Clean, Advanced, High-Security) */}
        <div 
          className="w-full max-w-md"
          style={{ perspective: '1200px' }}
        >
          <div
            ref={cardRef}
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
            style={{
              transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) translateZ(10px)`,
              transition: tilt.rx === 0 && tilt.ry === 0 ? 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
              transformStyle: 'preserve-3d'
            }}
            className="relative bg-gradient-to-b from-[#0f172a]/95 via-[#0b1222]/95 to-[#070d18]/95 backdrop-blur-3xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.8),0_0_50px_rgba(245,158,11,0.06)] space-y-6 overflow-hidden select-none"
          >
            {/* Dynamic Specular Light Glare that follows the cursor in 3D */}
            <div 
              className="absolute inset-0 pointer-events-none transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle 350px at ${tilt.glareX}% ${tilt.glareY}%, rgba(251, 191, 36, 0.12), transparent 75%)`
              }}
            />

            {/* Top 3D Golden Crest Horizon Bar */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>

            {/* Condition 1: If This Device is Officially Assigned to a Specific User */}
            {assignedWorkstationUser ? (
              <div className="space-y-5" style={{ transform: 'translateZ(25px)' }}>
                <div className="text-center space-y-2">
                  <div className="relative w-18 h-18 mx-auto rounded-3xl bg-gradient-to-br from-amber-500/25 to-amber-600/10 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-2xl shadow-amber-500/20">
                    <Laptop className="w-9 h-9 animate-pulse text-amber-400" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center border-2 border-slate-900 shadow">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-bold shadow-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>محطة عمل مخصصة رسمياً</span>
                  </div>

                  <h3 className="text-xl font-black text-white">
                    {assignedWorkstationUser.FullName}
                  </h3>

                  <p className="text-xs text-amber-300 font-bold px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 inline-block">
                    {assignedWorkstationUser.RoleArabic}
                  </p>

                  <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                    هذا الجهاز مخصص لمهامك الرسمية، يمكنك الدخول الفوري والمباشر دون إعادة كتابة البيانات.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleDirectLogin}
                  disabled={isSubmitting}
                  className="w-full py-4 px-4 rounded-2xl font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer text-sm"
                >
                  <Fingerprint className="w-5 h-5 text-slate-950" />
                  <span>{isSubmitting ? 'جاري فتح القسم المصرح به...' : 'دخول فوري مباشر للمنظومة'}</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
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
              /* Condition 2: High-End 3D Staff Login Interface (No Developer Code on front face!) */
              <div className="space-y-5" style={{ transform: 'translateZ(20px)' }}>
                
                {/* Header of the Card */}
                <div className="text-center space-y-2">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-600/25 to-indigo-600/10 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/10">
                    <Lock className="w-7 h-7 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight">
                    تسجيل دخول الموظفين المعتمدين
                  </h3>
                  <p className="text-xs text-slate-400">
                    أدخل اسم المستخدم أو رمز الموظف وكلمة المرور الرسمية
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-bold text-center flex items-center justify-center gap-2 animate-shake">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Primary Official Staff Login Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                  
                  {/* Username / Staff ID */}
                  <div className="space-y-1.5 text-right">
                    <label className="block text-xs font-bold text-slate-300">
                      اسم المستخدم أو رمز الموظف
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          if (errorMsg) setErrorMsg('');
                        }}
                        placeholder="أدخل اسمك أو معرفك الوظيفي..."
                        className="w-full px-4 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 text-right text-xs transition-all shadow-inner group-hover:border-slate-600"
                        required
                        autoComplete="username"
                        autoFocus
                      />
                      <UserCheck className="w-4 h-4 text-slate-500 group-focus-within:text-amber-400 absolute left-4 top-4 pointer-events-none transition-colors" />
                    </div>
                  </div>

                  {/* Password Field with Show/Hide Toggle */}
                  <div className="space-y-1.5 text-right">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-300">
                        كلمة المرور
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-[11px] text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {showPassword ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>إخفاء</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>إظهار</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="relative group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errorMsg) setErrorMsg('');
                        }}
                        placeholder="أدخل كلمة المرور المعتمدة..."
                        className="w-full px-4 py-3.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 text-right text-xs transition-all shadow-inner group-hover:border-slate-600 font-mono"
                        required
                        autoComplete="current-password"
                      />
                      <KeyRound className="w-4 h-4 text-slate-500 group-focus-within:text-amber-400 absolute left-4 top-4 pointer-events-none transition-colors" />
                    </div>
                  </div>

                  {/* Remember Device Option */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
                      <input 
                        type="checkbox" 
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500/30"
                      />
                      <span className="text-[11px]">حفظ تسجيل الدخول على هذا الجهاز</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setShowPortalModal(true);
                        setPortalActiveTab('director');
                      }}
                      className="text-[11px] text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      تخصيص محطة العمل؟
                    </button>
                  </div>

                  {/* 3D Action Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-4 rounded-2xl font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs group"
                  >
                    <span>{isSubmitting ? 'جاري التحقق من الصلاحيات والبيانات...' : 'التحقق وتسجيل الدخول للمنظومة'}</span>
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  </button>
                </form>

                {/* Privacy and Security Assurance Notice */}
                <div className="pt-3 border-t border-slate-800/80 text-center">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    🔒 المنظومة محمية بروتوكولياً. للحصول على رمز حسابك أو تخصيص حاسوبك، يرجى التنسيق مع <strong>مدير المكتب التنفيذي</strong> أو <strong>المطور</strong>.
                  </p>
                </div>

              </div>
            )}

          </div>
        </div>
      </main>

      {/* Footer Information */}
      <footer className="relative z-20 w-full bg-[#070b14]/90 backdrop-blur-md border-t border-slate-800/80 py-3.5 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">{systemSettings.deputyTitle}</span>
            <span>•</span>
            <span className="text-amber-400 font-semibold">{systemSettings.province}</span>
            <span>•</span>
            <span className="text-slate-500 font-mono text-[11px]">{systemSettings.officeAddress}</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="font-mono text-slate-300">هاتف الاستعلامات: {systemSettings.hotline}</span>
            <span>•</span>
            <span className="text-slate-500">الحقوق محفوظة © 2026</span>
          </div>
        </div>
      </footer>

      {/* 
        ========================================================================
        EXECUTIVE GATEWAY MODAL: "بوابة المدير والمطور" (Manager & Developer Portal)
        Exclusively hosts:
        1. 💻 رمز دخول المطور السري (Developer Passcode Gate with 3D Cyber Terminal)
        2. 👔 بوابة مدير المكتب وتخصيص محطات العمل (Director Workstation Provisioning)
        ========================================================================
      */}
      {showPortalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl animate-fadeIn" dir="rtl">
          <div className="w-full max-w-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto relative">
            
            {/* Top Amber Light Bar */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>بوابة المدير والمطور</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      بوابة الإدارة والبرمجة
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    الوصول السريع لمهندس ومطور المنظومة، وإدارة صلاحيات محطات عمل الموظفين
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowPortalModal(false);
                  setDevErrorMsg('');
                  setManagerError('');
                }}
                className="w-9 h-9 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
                title="إغلاق البوابة"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation: Developer Gate vs Director Provisioning */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setPortalActiveTab('developer');
                  setDevErrorMsg('');
                }}
                className={`py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  portalActiveTab === 'developer'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20 scale-[1.01]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                <span>رمز دخول المطور 🔑</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPortalActiveTab('director');
                  setManagerError('');
                }}
                className={`py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  portalActiveTab === 'director'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20 scale-[1.01]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCog className="w-4 h-4" />
                <span>تخصيص محطات العمل (المدير) 👔</span>
              </button>
            </div>

            {/* TAB 1: DEVELOPER PASSCODE FAST GATE */}
            {portalActiveTab === 'developer' && (
              <div className="space-y-5 animate-fadeIn">
                
                {/* 3D Cyber Terminal Info Box */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/30 text-amber-200 text-xs leading-relaxed flex items-start gap-3">
                  <Terminal className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-300 font-bold mb-0.5">
                      البوابة البرمجية المشفرة لمطور النظام (Master Developer Access)
                    </strong>
                    أدخل رمز دخول المطور السري لفتح لوحة التحكم المركزية (Master Admin)، إعدادات ربط Google Sheets، سحابة Firebase، وترحيل وتحديث البيانات بدون قيود.
                  </div>
                </div>

                {devErrorMsg && (
                  <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{devErrorMsg}</span>
                  </div>
                )}

                {/* Developer Passcode Input Form */}
                <form onSubmit={handleDeveloperLogin} className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-amber-300">
                        الرمز السري المعتمد للمطور
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowDevCode(!showDevCode)}
                        className="text-[11px] text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        {showDevCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showDevCode ? 'إخفاء الرمز' : 'إظهار الرمز'}</span>
                      </button>
                    </div>

                    <div className="relative">
                      <input
                        type={showDevCode ? 'text' : 'password'}
                        value={devCodeInput}
                        onChange={(e) => {
                          setDevCodeInput(e.target.value);
                          if (devErrorMsg) setDevErrorMsg('');
                        }}
                        placeholder="أدخل رمز دخول المطور السري..."
                        className="w-full px-4 py-4 bg-slate-950 border-2 border-amber-500/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20 text-center text-lg font-mono tracking-widest transition-all"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Quick Tactile 3D Keypad for Developer Ease */}
                  <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <Hash className="w-3 h-3 text-amber-400" />
                        لوحة الإدخال السريع
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setDevCodeInput('2026');
                          if (devErrorMsg) setDevErrorMsg('');
                        }}
                        className="text-[10px] font-bold text-amber-400 hover:underline cursor-pointer"
                      >
                        استخدام الرمز الافتراضي (2026)
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => handleKeypadPress(digit)}
                          className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-white font-mono font-bold text-base transition-all active:scale-95 cursor-pointer shadow-sm"
                        >
                          {digit}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('CLEAR')}
                        className="py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                      >
                        مسح
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('0')}
                        className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-white font-mono font-bold text-base transition-all active:scale-95 cursor-pointer shadow-sm"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('BACK')}
                        className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs transition-all active:scale-95 cursor-pointer"
                      >
                        ← حذف
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isDevSubmitting}
                    className="w-full py-4 px-4 rounded-2xl font-black text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <span>{isDevSubmitting ? 'جاري فتح لوحة المطور والتحقق...' : 'دخول فوري للمنظومة (المطور)'}</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </form>

              </div>
            )}

            {/* TAB 2: DIRECTOR EXECUTIVE & WORKSTATION PROVISIONING */}
            {portalActiveTab === 'director' && (
              <div className="space-y-5 animate-fadeIn">
                
                {!isManagerAuthenticated ? (
                  /* Verification Gate for Director */
                  <form onSubmit={handleDirectorAuth} className="space-y-4 py-2">
                    <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-blue-200 text-xs leading-relaxed flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-blue-300 font-bold mb-0.5">
                          بوابة إدارة محطات العمل لحسابات الموظفين
                        </strong>
                        لحماية بيانات الموظفين ومنع ظهور الحسابات للعامة، يرجى تأكيد هوية مدير المكتب التنفيذي أو المطور بإدخال رمز التحقق المعتمد.
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-300">
                        رمز تحقق المدير أو المطور
                      </label>
                      <input
                        type="password"
                        value={managerPin}
                        onChange={(e) => {
                          setManagerPin(e.target.value);
                          if (managerError) setManagerError('');
                        }}
                        placeholder="أدخل رمز التحقق (مثال: 123 أو admin)..."
                        className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs text-center font-mono"
                        autoFocus
                        required
                      />
                    </div>

                    {managerError && (
                      <p className="text-xs text-rose-400 font-bold text-center">{managerError}</p>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs transition-all cursor-pointer shadow-lg shadow-blue-600/20"
                    >
                      التحقق وفتح لوحة محطات العمل
                    </button>
                  </form>
                ) : (
                  /* Authenticated Provisioning View */
                  <div className="space-y-5">
                    
                    {/* Current Station Status */}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                          <Laptop className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">حالة هذا الجهاز حالياً:</span>
                          <span className="text-xs text-slate-400">
                            {assignedWorkstationUser 
                              ? `مخصص لـ: ${assignedWorkstationUser.FullName} (${assignedWorkstationUser.RoleArabic})`
                              : 'غير مخصص لأي موظف (يتطلب إدخال الحساب يدوياً)'}
                          </span>
                        </div>
                      </div>

                      {assignedWorkstationUser && (
                        <button
                          type="button"
                          onClick={handleClearStation}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:bg-rose-900 text-xs font-bold transition-colors cursor-pointer"
                        >
                          إلغاء التخصيص
                        </button>
                      )}
                    </div>

                    {/* Authorized Staff Accounts List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-300">
                          قائمة حسابات الموظفين المعتمدة ({users.length}):
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          انقر على (تخصيص) لجعل هذا الجهاز يفتح تلقائياً للموظف
                        </span>
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {users.map((u) => {
                          const isCurrentlyAssigned = assignedWorkstationUser?.User_ID === u.User_ID;
                          return (
                            <div
                              key={u.User_ID}
                              className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                isCurrentlyAssigned 
                                  ? 'bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-500/5' 
                                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-white">{u.FullName}</span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold border border-slate-700">
                                    {u.RoleArabic}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 font-mono">
                                  <span>مستخدم: <strong className="text-slate-200">{u.Username}</strong></span>
                                  <span>•</span>
                                  <span>رمز: <strong className="text-amber-400">{u.Password}</strong></span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(`اسم المستخدم: ${u.Username}\nكلمة المرور: ${u.Password}\nالقسم: ${u.RoleArabic}`, u.User_ID)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="نسخ بيانات الحساب"
                                >
                                  {copiedUser === u.User_ID ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedUser === u.User_ID ? 'تم النسخ' : 'نسخ'}</span>
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
                                  <span>{isCurrentlyAssigned ? 'هذا الجهاز مخصص له' : 'تخصيص هذا الجهاز له'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* Modal Bottom Close */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                اختصار لوحة المفاتيح لفتح هذه البوابة: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">Ctrl+Shift+D</kbd>
              </span>
              <button
                type="button"
                onClick={() => setShowPortalModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>

          </div>
        </div>
      )}

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
