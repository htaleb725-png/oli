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
  AlertCircle,
  FileSpreadsheet
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
    fetchAllFromFirestoreNow,
    isImportingFromGoogleSheet,
    importFromGoogleSheetToSupabase
  } = useApp();

  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImportFromGoogleSheet = async () => {
    setIsProcessing(true);
    setSyncStatusMsg({
      type: 'info',
      text: 'جاري جلب السجلات السابقة من Google Sheet وحفظها في Supabase دون تكرار...'
    });
    try {
      const res = await importFromGoogleSheetToSupabase();
      setSyncStatusMsg({
        type: res.success ? 'success' : 'error',
        text: res.message
      });
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: `فشل الجلب من Google Sheet: ${err?.message || 'خطأ غير متوقع'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePushAll = async () => {
    setIsProcessing(true);
    setSyncStatusMsg({ type: 'info', text: 'جاري رفع ومزامنة كافة السجلات والبيانات مع Supabase...' });
    try {
      const res = await syncAllToFirestoreNow();
      if (res.error) {
        setSyncStatusMsg({ type: 'error', text: `تنبيه: ${res.error}` });
      } else {
        setSyncStatusMsg({
          type: 'success',
          text: `تمت المزامنة بنجاح! تم رفع (${res.successCount} من إجمالي ${res.total}) عنصر إلى قاعدة بيانات Supabase السحابية.`
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
    setSyncStatusMsg({ type: 'info', text: 'جاري استيراد وتحديث كافة البيانات المخزنة من Supabase إلى المنظومة...' });
    try {
      const res = await fetchAllFromFirestoreNow();
      if (res.success) {
        setSyncStatusMsg({ type: 'success', text: 'تم تحديث كافة السجلات بنجاح من قاعدة بيانات Supabase ⚡' });
      } else {
        setSyncStatusMsg({ type: 'error', text: `فشل التحديث: ${res.error || 'تعذر جلب السجلات'}` });
      }
    } catch (err: any) {
      setSyncStatusMsg({ type: 'error', text: `خطأ أثناء التحديث: ${err.message || 'خطأ غير متوقع'}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const collections = [
    { name: 'citizens', label: 'سجلات المراجعين والمواطنين', count: citizens.length, icon: '👥' },
    { name: 'requests', label: 'الطلبات والمعاملات الرسمية', count: requests.length, icon: '📋' },
    { name: 'blacklist', label: 'قائمة المحظورين والمرفوضين', count: citizens.filter(c => c.IsBlocked).length, icon: '🚫' },
    { name: 'users', label: 'حسابات وصلاحيات الموظفين', count: users.length, icon: '🔑' },
    { name: 'departments', label: 'الأقسام المخصصة والحقول الديناميكية', count: customSections.length, icon: '📁' },
    { name: 'system_settings', label: 'الإعدادات، المقابلات، التنظيم والصكوك', count: interviews.length + organizationRecords.length + officialLetters.length + cheques.length + customRecords.length, icon: '⚙️' }
  ];

  const totalRecords = citizens.length + requests.length + interviews.length + organizationRecords.length + officialLetters.length + cheques.length + customRecords.length + users.length;

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 border border-emerald-500/30 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
            <CloudLightning className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                مركز إدارة قاعدة بيانات Supabase السحابية + شريك Google Sheet
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                Supabase Realtime + Google Sheet مزدوج
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              قاعدة بيانات Supabase الأساسية (6 جداول + اشتراك لحظي) مع استمرار المزامنة والنسخ الاحتياطي التلقائي مع Google Sheet.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleImportFromGoogleSheet}
            disabled={isProcessing || isImportingFromGoogleSheet || isFirestoreSyncing}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>
              {isImportingFromGoogleSheet
                ? 'جاري الجلب من Google Sheet...'
                : 'جلب البيانات السابقة من Google Sheet إلى Supabase'}
            </span>
          </button>
          <button
            type="button"
            onClick={handlePushAll}
            disabled={isProcessing || isFirestoreSyncing || isImportingFromGoogleSheet}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>رفع كافة البيانات الآن (Push)</span>
          </button>
          <button
            type="button"
            onClick={handleFetchAll}
            disabled={isProcessing || isFirestoreSyncing || isImportingFromGoogleSheet}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
            <span>تحديث مباشر من Supabase</span>
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
            <Server className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">خادم القاعدة الأساسية</span>
            <span className="text-xs font-black text-slate-900 dark:text-white font-mono">Supabase PostgreSQL</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-mono text-sm font-bold">
            <Database className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">نمط المزامنة المزدوجة</span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">Supabase Realtime + Google Sheet</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-mono text-sm font-bold">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">الجداول النشطة (6 جداول)</span>
            <span className="text-xs font-black text-slate-900 dark:text-white">citizens · requests · blacklist · users · departments · system_settings</span>
          </div>
        </div>
      </div>

      {/* Collections Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>جداول قاعدة بيانات Supabase الستة - إجمالي السجلات: ({totalRecords})</span>
          </h4>
          <span className="text-[11px] text-slate-400">
            حفظ مزدوج تلقائي وفوري في Supabase و Google Sheet
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
                  <span className="text-[10px] text-slate-400 font-mono">table('{col.name}')</span>
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
