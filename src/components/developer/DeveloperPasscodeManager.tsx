import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  Users,
  RefreshCw
} from 'lucide-react';

export const DeveloperPasscodeManager: React.FC = () => {
  const { developerPasscode, setDeveloperPasscode, users, updateUser } = useApp();

  const [currentCode, setCurrentCode] = useState(developerPasscode || '2026');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Per-user quick passcode editor (ALL passcodes in the system are editable!)
  const [userPasswords, setUserPasswords] = useState<Record<string, string>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (developerPasscode) {
      setCurrentCode(developerPasscode);
    }
  }, [developerPasscode]);

  useEffect(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => {
      map[u.User_ID] = u.Password || '';
    });
    setUserPasswords(map);
  }, [users]);

  const handleUpdatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNew = newCode.trim();
    const cleanConfirm = confirmCode.trim();
    if (!cleanNew) {
      setStatusMsg({ type: 'error', text: 'يرجى إدخال رمز دخول المطور الجديد.' });
      return;
    }
    if (cleanNew.length < 3) {
      setStatusMsg({ type: 'error', text: 'يجب أن يتكون رمز المطور من 3 خانات أو أرقام على الأقل.' });
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setStatusMsg({ type: 'error', text: 'الرمز وتأكيد الرمز غير متطابقين.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    try {
      const success = await setDeveloperPasscode(cleanNew);
      if (success) {
        setCurrentCode(cleanNew);
        setNewCode('');
        setConfirmCode('');
        setStatusMsg({
          type: 'success',
          text: `تم تغيير وحفظ رمز دخول المطور بنجاح إلى (${cleanNew})، وتم إلغاء الرموز السابقة ومزامنته على جميع الأجهزة فوراً.`
        });
      } else {
        setStatusMsg({ type: 'error', text: 'تعذر حفظ الرمز. تأكد من صحة المدخلات.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `فشل الحفظ: ${err?.message || 'خطأ غير متوقع'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveUserPasscode = async (userId: string) => {
    const target = users.find((u) => u.User_ID === userId);
    if (!target) return;
    const nextPass = (userPasswords[userId] || '').trim();
    if (nextPass.length < 3) {
      setStatusMsg({ type: 'error', text: `يجب أن لا يقل رمز الحساب (${target.FullName}) عن 3 خانات.` });
      return;
    }

    setSavingUserId(userId);
    setStatusMsg(null);
    try {
      await updateUser({
        ...target,
        Password: nextPass
      });
      setStatusMsg({
        type: 'success',
        text: `تم تحديث رمز الحساب «${target.FullName}» (${target.RoleArabic}) بنجاح إلى (${nextPass}) ومزامنته فوراً في قاعدة البيانات.`
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `تعذر تحديث رمز الحساب: ${err?.message || 'خطأ غير متوقع'}` });
    } finally {
      setSavingUserId(null);
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
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <span>إدارة وتغيير رمز المطور وجميع رموز النظام</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                تغيير فوري ومزامنة كاملة 🔒
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              يمكنك هنا تغيير رمز المطور السري وتغيير رمز الدخول الخاص بأي حساب أو قسم في المنظومة. بمجرد الحفظ يُلغى الرمز القديم ويُعتمد الجديد فوراً على كل الأجهزة.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/40 shadow-xs shrink-0">
          <Lock className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">رمز المطور الحالي:</span>
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
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button type="button" onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 1. Change Developer Passcode Form */}
      <form onSubmit={handleUpdatePasscode} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs max-w-2xl">
        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <ShieldCheck className="w-4 h-4 text-amber-500" />
          <span>1. تغيير رمز دخول المطور السري (يُلغي الرمز السابق فوراً):</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              رمز المطور الجديد *
            </label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="مثال: Dev2027# أو 9988..."
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
        </div>

        <div className="pt-1">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-slate-950" />
            <span>{isSubmitting ? 'جاري الحفظ والمزامنة...' : 'حفظ وتغيير رمز المطور الآن'}</span>
          </button>
        </div>
      </form>

      {/* 2. Change ANY System Account / Role Passcode */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Users className="w-4 h-4 text-blue-600" />
          <span>2. تغيير جميع رموز الدخول لحسابات وأقسام المنظومة ({users.length} حساب):</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {users.map((u) => {
            const isVisible = Boolean(visiblePasswords[u.User_ID]);
            const isSaving = savingUserId === u.User_ID;
            return (
              <div
                key={u.User_ID}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-900 dark:text-white truncate">{u.FullName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                      <span>{u.RoleArabic || u.Department}</span>
                      <span>•</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400" dir="ltr">@{u.Username}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      u.Role === 'developer'
                        ? 'bg-amber-100 text-amber-800'
                        : u.Status === 'frozen'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {u.Role === 'developer' ? 'المطور' : u.Status === 'frozen' ? 'مجمد' : 'نشط'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={isVisible ? 'text' : 'password'}
                      value={userPasswords[u.User_ID] ?? ''}
                      onChange={(e) => setUserPasswords((prev) => ({ ...prev, [u.User_ID]: e.target.value }))}
                      placeholder="اكتب الرمز الجديد..."
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setVisiblePasswords((prev) => ({ ...prev, [u.User_ID]: !prev[u.User_ID] }))
                      }
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={isVisible ? 'إخفاء الرمز' : 'إظهار الرمز'}
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveUserPasscode(u.User_ID)}
                    disabled={isSaving}
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>تغيير</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
