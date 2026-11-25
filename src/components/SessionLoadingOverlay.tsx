import React, { useEffect, useState } from 'react';
import { Landmark, ShieldCheck } from 'lucide-react';

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
  message = 'جاري تحميل البيانات، يرجى الانتظار...',
  userName,
  userRole,
  officeName = 'مكتب النائب المهندسة علا عودة الناشي',
  emblemUrl,
  customTitle,
  customSubtitle
}) => {
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    if (!isLoading) {
      setProgress(100);
      return;
    }

    setProgress(18);
    const interval = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 92) return 92;
        const step = prev < 50 ? 10 : prev < 78 ? 5 : 2;
        return Math.min(92, prev + step);
      });
    }, 420);

    return () => {
      window.clearInterval(interval);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  const displayTitle = customTitle?.trim() || message || 'جاري تحميل البيانات، يرجى الانتظار...';
  const displaySubtitle =
    customSubtitle?.trim() || 'مجلس النواب العراقي — المنظومة الإدارية التنفيذية';

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-[#070D1A] select-none overflow-hidden font-['Tajawal',sans-serif]"
      dir="rtl"
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes serene-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes serene-fade-in {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes serene-sheen {
          0% { transform: translateX(130%); opacity: 0; }
          40% { opacity: 0.65; }
          100% { transform: translateX(-140%); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .serene-orbit, .serene-sheen {
            animation: none !important;
          }
        }
      `}</style>

      {/* Calm ambient radial lighting */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 65% 50% at 50% 35%, rgba(212, 175, 55, 0.11) 0%, rgba(16, 33, 66, 0.48) 48%, rgba(7, 13, 26, 0.99) 100%)'
        }}
      />

      {/* Refined Executive Card */}
      <div
        className="relative w-full max-w-md rounded-3xl bg-[#0C1629]/90 backdrop-blur-xl border border-slate-700/60 shadow-[0_28px_80px_-16px_rgba(0,0,0,0.78)] px-7 py-9 sm:px-9 sm:py-10 text-center space-y-6 overflow-hidden"
        style={{ animation: 'serene-fade-in 380ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        {/* Subtle Gold Hairline Accent */}
        <div className="absolute top-0 inset-x-16 h-[2px] bg-gradient-to-r from-transparent via-amber-400/75 to-transparent pointer-events-none" />

        {/* Single Precision Orbital Crest */}
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-slate-700/70" />
          <div
            className="serene-orbit absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400/90 border-r-emerald-400/40"
            style={{ animation: 'serene-orbit 2.8s linear infinite' }}
          />
          <div className="relative w-[76px] h-[76px] rounded-full bg-gradient-to-br from-[#162746] to-[#0B1426] border border-amber-400/35 shadow-inner flex items-center justify-center overflow-hidden p-2">
            {emblemUrl ? (
              <img
                src={emblemUrl}
                alt={officeName}
                className="w-full h-full object-contain rounded-full"
              />
            ) : (
              <Landmark className="w-8 h-8 text-amber-400" strokeWidth={1.65} />
            )}
          </div>
        </div>

        {/* Typography */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold tracking-wide text-amber-300/90">
            {officeName}
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight leading-snug">
            {displayTitle}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {displaySubtitle}
          </p>
        </div>

        {/* Optional Authenticated User Pill */}
        {userName && (
          <div className="mx-auto px-4 py-2 rounded-xl bg-slate-900/70 border border-slate-800/80 inline-flex items-center gap-2.5 text-right max-w-full">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-100 truncate block">
                {userName}
                {userRole ? <span className="text-amber-300/85 font-semibold"> — {userRole}</span> : null}
              </span>
            </div>
          </div>
        )}

        {/* Calm Linear Progress Indicator */}
        <div className="space-y-2 pt-1">
          <div className="relative w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden">
            <div
              className="relative h-full rounded-full bg-gradient-to-l from-amber-300 via-amber-400 to-emerald-400 transition-[width] duration-500 ease-out overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div
                className="serene-sheen absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                style={{ animation: 'serene-sheen 1.8s ease-in-out infinite' }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
            <span>تجهيز مساحة العمل والسجلات المعتمدة</span>
            <span className="font-mono tabular-nums font-bold text-amber-300/95">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
