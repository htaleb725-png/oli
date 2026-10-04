import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Database, 
  CloudLightning, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  CheckCircle2, 
  RefreshCw, 
  Server, 
  Layers, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';

export const FirebaseManager: React.FC = () => {
  const {
    citizens,
    requests,
    interviews,
    officialLetters,
    organizationRecords,
    cheques,
    customSections,
    customRecords,
    users,
    isFirestoreSyncing,
    syncAllToFirestoreNow,
    fetchAllFromFirestoreNow
  } = useApp();

  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePushAll = async () => {
    setIsProcessing(true);
    setSyncStatusMsg({ type: 'info', text: 'جاري رفع ومزامنة كافة السجلات والبيانات مع Firebase Firestore...' });
    try {
      const res = await syncAllToFirestoreNow();
      if (res.error) {
        setSyncStatusMsg({ type: 'error', text: `تنبيه: ${res.error}` });
      } else {
        setSyncStatusMsg({ 
          type: 'success', 
          text: `تمت المزامنة بنجاح! تم رفع (${res.successCount} من إجمالي ${res.total}) عنصر إلى قاعدة بيانات Firebase Firestore السحابية.` 
        });
      }
    } catch (err: any) {
      setSyncStatusMsg({ type: 'error', text: `فشلت المزامنة: ${err.message || 'خطأ غير متوقع'}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFetchAll = async () => {
    setIsProcessing(true);
    setSyncStatusMsg({ type: 'info', text: 'جاري استيراد وسحب البيانات المخزنة من Firebase Firestore إلى المنظومة...' });
    try {
      const res = await fetchAllFromFirestoreNow();
      if (res.success) {
        setSyncStatusMsg({ type: 'success', text: 'تم استيراد وتحديث كافة السجلات بنجاح من Firebase Firestore ☁️' });
      } else {
        setSyncStatusMsg({ type: 'error', text: `فشل السحب: ${res.error || 'تعذر جلب المستندات'}` });
      }
    } catch (err: any) {
      setSyncStatusMsg({ type: 'error', text: `خطأ أثناء السحب: ${err.message || 'خطأ غير متوقع'}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const collections = [
    { name: 'citizens', label: 'سجلات المراجعين والمواطنين', count: citizens.length, icon: '👥' },
    { name: 'requests', label: 'الطلبات والمعاملات الرسمية', count: requests.length, icon: '📋' },
    { name: 'interviews', label: 'مقابلات ومحاضر النائب', count: interviews.length, icon: '🤝' },
    { name: 'organization', label: 'الموقف الجماهيري وشؤون العشائر', count: organizationRecords.length, icon: '🏛️' },
    { name: 'letters', label: 'الكتب الرسمية والصادر والوارد', count: officialLetters.length, icon: '📜' },
    { name: 'cheques', label: 'صكوك المساعدات والمنح', count: cheques.length, icon: '💳' },
    { name: 'custom_sections', label: 'الأقسام المخصصة للمطور', count: customSections.length, icon: '📁' },
    { name: 'custom_records', label: 'سجلات الأقسام المخصصة', count: customRecords.length, icon: '📑' },
    { name: 'users', label: 'حسابات وصلاحيات الموظفين', count: users.length, icon: '🔑' },
  ];

  const totalRecords = collections.reduce((acc, c) => acc + c.count, 0);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
            <CloudLightning className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                مركز إدارة قاعدة بيانات Firebase Firestore السحابية
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                مفعلة وتتصل لحظياً (Real-Time Live)
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              قاعدة البيانات المعتمدة لحفظ ومزامنة كافة السجلات لحظياً عبر أجهزة المكتب بدون انقطاع أو فقدان.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePushAll}
            disabled={isProcessing || isFirestoreSyncing}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>رفع كافة البيانات الآن (Push All)</span>
          </button>
          <button
            type="button"
            onClick={handleFetchAll}
            disabled={isProcessing || isFirestoreSyncing}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <ArrowDownCircle className="w-4 h-4 text-amber-400" />
            <span>سحب واستيراد البيانات (Fetch)</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {syncStatusMsg && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs ${
          syncStatusMsg.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
            : syncStatusMsg.type === 'error'
            ? 'bg-rose-50 border border-rose-200 text-rose-900'
            : 'bg-blue-50 border border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-2">
            {syncStatusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : syncStatusMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 animate-spin" />
            )}
            <span>{syncStatusMsg.text}</span>
          </div>
          <button onClick={() => setSyncStatusMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Cloud Project Specs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-mono text-sm font-bold">
            <Server className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">إقليم السحابة (Cloud Region)</span>
            <span className="text-xs font-black text-slate-900 dark:text-white font-mono">europe-west2 (لندن)</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-mono text-sm font-bold">
            <Database className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">نمط المزامنة (Sync Engine)</span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">Real-Time Snapshots (لحظي)</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-mono text-sm font-bold">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">قواعد الأمان (Firestore Rules)</span>
            <span className="text-xs font-black text-slate-900 dark:text-white">مشفرة ومحمية بـ RBAC</span>
          </div>
        </div>
      </div>

      {/* Collections Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <span>مجموعات البيانات السحابية (Firestore Collections) - إجمالي السجلات: ({totalRecords})</span>
          </h4>
          <span className="text-[11px] text-slate-400">
            تحديث تلقائي وفوري عند أي حفظ أو تعديل في النظام
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {collections.map((col) => (
            <div 
              key={col.name}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{col.icon}</span>
                <div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white">{col.label}</h5>
                  <span className="text-[10px] text-slate-400 font-mono">collection('{col.name}')</span>
                </div>
              </div>
              <div className="text-left">
                <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                  {col.count}
                </span>
                <span className="text-[10px] text-slate-400 block font-medium">سجل</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
