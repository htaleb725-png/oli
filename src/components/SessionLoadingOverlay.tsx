import React, { useEffect, useState } from 'react';
import { Building2, Sparkles, Database, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';

interface Props {
  isLoading: boolean;
  message?: string;
  userName?: string;
  userRole?: string;
  officeName?: string;
}

export const SessionLoadingOverlay: React.FC<Props> = ({
  isLoading,
  message = 'يرجى الانتظار لتحميل بياناتك...',
  userName,
  userRole,
  officeName = 'نظام مكتب النائب'
}) => {
  const [progress, setProgress] = useState(15);
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (!isLoading) {
      setProgress(15);
      setCurrentStep(1);
      return;
    }

    const t1 = setTimeout(() => {
      setProgress(50);
      setCurrentStep(2);
    }, 450);

    const t2 = setTimeout(() => {
      setProgress(85);
      setCurrentStep(3);
    }, 1100);

    const t3 = setTimeout(() => {
      setProgress(100);
      setCurrentStep(4);
    }, 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/92 backdrop-blur-lg animate-in fade-in duration-200 select-none"
      dir="rtl"
    >
      <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/20 text-center space-y-6 relative overflow-hidden">
        {/* Subtle Ambient Light */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-44 h-44 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Central Emblem & Animated Ring */}
        <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-3xl border-2 border-amber-500/40 animate-ping opacity-25" />
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Building2 className="w-10 h-10 text-slate-950" />
          </div>
        </div>

        {/* Main Status Message */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{officeName}</span>
          </span>

          <h3 className="text-base sm:text-lg font-black text-white tracking-tight animate-pulse">
            {message}
          </h3>

          {userName && (
            <p className="text-xs text-slate-400">
              أهلاً وسهلاً بك، <strong className="text-amber-400">{userName}</strong> {userRole ? `(${userRole})` : ''}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/80">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              <span>جاري استرجاع وتحميل كافة البيانات...</span>
            </span>
            <span className="font-bold text-amber-400">{progress}%</span>
          </div>
        </div>

        {/* Live Loading Stages Checkmarks */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-right text-[11px]">
          <div className={`flex items-center justify-between transition-colors ${currentStep >= 1 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
            <span>1. تأكيد اتصال قاعدة البيانات السحابية المركزية</span>
            {currentStep >= 1 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-3 h-3 rounded-full border border-slate-600" />}
          </div>
          <div className={`flex items-center justify-between transition-colors ${currentStep >= 2 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
            <span>2. جلب وتحديث سجلات المراجعين والطلبات والمقابلات</span>
            {currentStep >= 2 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-3 h-3 rounded-full border border-slate-600" />}
          </div>
          <div className={`flex items-center justify-between transition-colors ${currentStep >= 3 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
            <span>3. تجهيز وعرض كافة بيانات المنظومة في الواجهة</span>
            {currentStep >= 3 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <span className="w-3 h-3 rounded-full border border-slate-600" />}
          </div>
        </div>
      </div>
    </div>
  );
};
