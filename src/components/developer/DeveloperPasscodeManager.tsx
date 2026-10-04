import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Lock
} from 'lucide-react';

export const DeveloperPasscodeManager: React.FC = () => {
  const { developerPasscode, setDeveloperPasscode } = useApp();

  const [currentCode, setCurrentCode] = useState(developerPasscode || '2026');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) {
      setStatusMsg({ type: 'error', text: 'يرجى إدخال رمز دخول المطور الجديد.' });
      return;
    }
    if (newCode.trim().length < 3) {
      setStatusMsg({ type: 'error', text: 'يجب أن يتكون رمز المطور من 3 خانات أو أرقام على الأقل.' });
      return;
    }
    if (newCode !== confirmCode) {
      setStatusMsg({ type: 'error', text: 'الرمز وتأكيد الرمز غير متطابقين.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      const success = await setDeveloperPasscode(newCode.trim());
      if (success) {
        setCurrentCode(newCode.trim());
        setNewCode('');
        setConfirmCode('');
        setStatusMsg({ 
          type: 'success', 
          text: `تم تحديث وحفظ رمز دخول المطور بنجاح! الرمز الجديد هو (${newCode.trim()}) وتمت مزامنته فورياً مع Firebase Firestore.` 
        });
      } else {
        setStatusMsg({ type: 'error', text: 'تعذر حفظ الرمز. تأكد من صحة المدخلات.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `فشل الحفظ: ${err.message || 'خطأ غير متوقع'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-yellow-500/5 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>إدارة وتغيير رمز دخول المطور السري</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                مشفر ومحمي 🔒
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              هذا الرمز مخصص للمطور حصراً للدخول للمنظومة بدون الحاجة لأي حساب آخر. يمكنك تغييره هنا في أي وقت ويحفظ في Firebase Firestore.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/40 shadow-xs">
          <Lock className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">الرمز المعتمد حالياً:</span>
          <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400 mr-1">
            {showCode ? currentCode : '••••••'}
          </span>
          <button
            type="button"
            onClick={() => setShowCode(!showCode)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
            title={showCode ? 'إخفاء' : 'إظهار'}
          >
            {showCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Change Passcode Form */}
      <form onSubmit={handleUpdatePasscode} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs max-w-xl">
        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <span>تعيين رمز دخول جديد للمطور:</span>
        </h4>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            رمز المطور الجديد (كلمة مرور أو أرقام سرية) *
          </label>
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="مثال: Dev2026# أو 9988..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            تأكيد رمز المطور الجديد *
          </label>
          <input
            type="text"
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value)}
            placeholder="أعد إدخال الرمز الجديد للتأكيد..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            required
            autoComplete="new-password"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-slate-950" />
            <span>{isSubmitting ? 'جاري الحفظ والمزامنة السحابية...' : 'حفظ وتحديث رمز المطور الآن'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
