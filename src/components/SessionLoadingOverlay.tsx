import React, { useEffect, useState } from 'react';
import {
  Landmark,
  CheckCircle2,
  ShieldCheck,
  Database,
  Layers,
  Lock
} from 'lucide-react';

interface Props {
  isLoading: boolean;
  message?: string;
  userName?: string;
  userRole?: string;
  officeName?: string;
  emblemUrl?: string;
  customTitle?: string;
  customSubtitle?: string;
}

export const SessionLoadingOverlay: React.FC<Props> = ({
  isLoading,
  message = 'جاري تهيئة ومزامنة بيانات المنظومة...',
  userName,
  userRole,
  officeName = 'مكتب النائب المهندسة علا عودة الناشي',
  emblemUrl,
  customTitle,
  customSubtitle
}) => {
  const [progress, setProgress] = useState(12);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (!isLoading) {
      setProgress(12);
      setCurrentStep(1);
      return;
    }

    const t1 = setTimeout(() => {
      setProgress(38);
      setCurrentStep(1);
    }, 220);

    const t2 = setTimeout(() => {
      setProgress(72);
      setCurrentStep(2);
    }, 780);

    const t3 = setTimeout(() => {
      setProgress(96);
      setCurrentStep(3);
    }, 1450);

    const t4 = setTimeout(() => {
      setProgress(100);
      setCurrentStep(4);
    }, 1900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  const displayTitle = customTitle?.trim() || message;
  const displaySubtitle =
    customSubtitle?.trim() || 'مجلس النواب العراقي — المنظومة الإدارية التنفيذية المتكاملة';

  const stages = [
    {
      step: 1,
      icon: Database,
      label: 'تأكيد الاتصال المشفّر بقاعدة البيانات السحابية'
    },
    {
      step: 2,
      icon: Layers,
      label: 'مزامنة السجلات، الأقسام المستقلة، والقوائم المعتمدة'
    },
    {
      step: 3,
      icon: ShieldCheck,
      label: 'تطبيق صلاحيات الحساب وتجهيز واجهة العمل'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-[#050914] select-none overflow-hidden font-['Tajawal',sans-serif]"
      dir="rtl"
      role="status"
      aria-live="polite"
    >
      {/* Inline scoped keyframes for GPU-composited ceremonial rings & sheen */}
      <style>{`
        @keyframes crest-orbit-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes crest-orbit-ccw {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes crest-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-4px) scale(1.015); }
        }
        @keyframes sheen-sweep {
          0% { transform: translateX(120%); opacity: 0; }
          35% { opacity: 0.7; }
          100% { transform: translateX(-140%); opacity: 0; }
        }
        @keyframes stage-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .motion-crest-cw, .motion-crest-ccw, .motion-crest-float, .motion-sheen {
            animation: none !important;
          }
        }
      `}</style>

      {/* Deep Architectural Radial Backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 30%, rgba(212, 175, 55, 0.13) 0%, rgba(15, 31, 66, 0.45) 45%, rgba(5, 9, 20, 0.98) 100%)'
        }}
      />

      {/* Subtle Geometric Architectural Grid */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(212, 175, 55, 0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(212, 175, 55, 0.45) 1px, transparent 1px)',
          backgroundSize: '56px 56px'
        }}
      />

      {/* Corner Ceremonial Hairline Accents */}
      <div className="absolute top-6 right-6 w-12 h-12 border-t border-r border-amber-400/25 pointer-events-none" />
      <div className="absolute top-6 left-6 w-12 h-12 border-t border-l border-amber-400/25 pointer-events-none" />
      <div className="absolute bottom-6 right-6 w-12 h-12 border-b border-r border-amber-400/25 pointer-events-none" />
      <div className="absolute bottom-6 left-6 w-12 h-12 border-b border-l border-amber-400/25 pointer-events-none" />

      {/* Central Ceremonial Monolith Card */}
      <div
        className="relative w-full max-w-lg rounded-[2rem] bg-gradient-to-b from-[#0C172E]/95 via-[#091224]/95 to-[#060C1A]/98 border border-amber-500/25 shadow-[0_32px_90px_-12px_rgba(0,0,0,0.85)] px-6 py-8 sm:px-10 sm:py-10 text-center space-y-6 overflow-hidden"
        style={{ animation: 'stage-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        {/* Top Hairline Gold Crown Bar */}
        <div className="absolute top-0 inset-x-12 h-[2px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent pointer-events-none" />

        {/* Dual-Orbit Ceremonial Crest */}
        <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
          {/* Outer hairline dashed orbit */}
          <div
            className="motion-crest-cw absolute inset-0 rounded-full border border-dashed border-amber-400/35"
            style={{ animation: 'crest-orbit-cw 24s linear infinite' }}
          />
          {/* Middle precision arc orbit */}
          <div
            className="motion-crest-ccw absolute inset-2.5 rounded-full border-2 border-transparent border-t-amber-400/80 border-b-amber-500/30"
            style={{ animation: 'crest-orbit-ccw 8s linear infinite' }}
          />
          {/* Inner subtle glow halo */}
          <div className="absolute inset-5 rounded-full bg-amber-500/10 blur-md pointer-events-none" />

          {/* Embossed Emblem Container */}
          <div
            className="motion-crest-float relative w-20 h-20 rounded-full bg-gradient-to-br from-[#17284A] via-[#0E1A33] to-[#081022] border border-amber-400/50 shadow-[inset_0_1px_14px_rgba(245,158,11,0.22),0_12px_30px_rgba(0,0,0,0.6)] flex items-center justify-center overflow-hidden p-2"
            style={{ animation: 'crest-float 3.6s ease-in-out infinite' }}
          >
            {emblemUrl ? (
              <img
                src={emblemUrl}
                alt={officeName}
                className="w-full h-full object-contain rounded-full"
              />
            ) : (
              <Landmark className="w-9 h-9 text-amber-400" strokeWidth={1.7} />
            )}
          </div>
        </div>

        {/* Official Office Identity & Headline */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-[11px] font-bold tracking-wide text-amber-300/90">
            <span className="h-[1px] w-6 bg-gradient-to-r from-transparent to-amber-400/60" />
            <span>{officeName}</span>
            <span className="h-[1px] w-6 bg-gradient-to-l from-transparent to-amber-400/60" />
          </div>

          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
            {displayTitle}
          </h2>

          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            {displaySubtitle}
          </p>
        </div>

        {/* Personalized Authenticated Welcome Strip */}
        {userName && (
          <div className="mx-auto max-w-sm px-4 py-2.5 rounded-2xl bg-slate-900/80 border border-slate-800/90 flex items-center justify-between gap-3 text-right">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-400/35 text-amber-300 font-black text-xs flex items-center justify-center shrink-0">
                {userName.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-white truncate">
                  مرحباً بك، {userName}
                </div>
                {userRole && (
                  <div className="text-[11px] text-amber-300/85 font-semibold truncate">
                    {userRole}
                  </div>
                )}
              </div>
            </div>
            <Lock className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
          </div>
        )}

        {/* Precision Linear Progress Bar with Tabular Numerals */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] px-0.5">
            <span className="text-slate-300 font-bold">
              {progress >= 100 ? 'اكتملت تهيئة المنظومة بنجاح' : 'جاري تحميل ومزامنة مساحة العمل...'}
            </span>
            <span className="font-mono tabular-nums font-black text-amber-400 text-xs">
              {progress}%
            </span>
          </div>

          <div className="relative w-full h-2 bg-slate-800/90 rounded-full overflow-hidden border border-slate-700/70">
            <div
              className="relative h-full rounded-full bg-gradient-to-l from-amber-300 via-amber-500 to-emerald-400 transition-[width] duration-500 ease-out overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div
                className="motion-sheen absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                style={{ animation: 'sheen-sweep 1.8s ease-in-out infinite' }}
              />
            </div>
          </div>
        </div>

        {/* Clean 3-Stage Verification Timeline */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2 text-right">
          {stages.map((st) => {
            const Icon = st.icon;
            const isDone = currentStep > st.step || progress >= 100;
            const isActive = currentStep === st.step && progress < 100;
            return (
              <div
                key={st.step}
                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border text-[11px] transition-colors duration-300 ${
                  isDone
                    ? 'bg-emerald-950/30 border-emerald-500/25 text-emerald-300'
                    : isActive
                      ? 'bg-amber-950/25 border-amber-500/30 text-amber-200'
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isDone
                        ? 'text-emerald-400'
                        : isActive
                          ? 'text-amber-400'
                          : 'text-slate-600'
                    }`}
                  />
                  <span className={`truncate ${isDone || isActive ? 'font-bold' : 'font-medium'}`}>
                    {st.label}
                  </span>
                </div>

                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : isActive ? (
                  <span className="text-[10px] font-mono tabular-nums text-amber-400 shrink-0">
                    جاري...
                  </span>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full border border-slate-700 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
