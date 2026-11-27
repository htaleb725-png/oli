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
    currentUser,
    isFirestoreSyncing,
    syncAllToFirestoreNow,
    fetchAllFromFirestoreNow,
    isImportingFromGoogleSheet,
    sheetImportProgress,
    importFromGoogleSheetToSupabase
  } = useApp();

  const isDeveloperRole = currentUser?.Role === 'developer';

  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImportFromGoogleSheet = async () => {
    setIsProcessing(true);
    setSyncStatusMsg({
      type: 'info',
      text: 'جاري استيراد ومزامنة الأرشيف الاحتياطي إلى قاعدة البيانات دون تكرار...'
    });
    try {
      const res = await importFromGoogleSheetToSupabase();
      setSyncStatusMsg({
        type: res.success ? 'success' : 'error',
        text: res.success ? 'تمت مزامنة البيانات بنجاح' : res.message
      });
    } catch (err: any) {
      setSyncStatusMsg({
        type: 'error',
        text: `تعذر استيراد الأرشيف الاحتياطي: ${err?.message || 'خطأ غير متوقع'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePushAll = async () => {
    setIsProcessing(true);
    setSyncStatusMsg({ type: 'info', text: 'جاري رفع ومزامنة كافة السجلات والبيانات مع قاعدة البيانات...' });
    try {
      const res = await syncAllToFirestoreNow();
      if (res.error) {
        setSyncStatusMsg({ type: 'error', text: `تنبيه: ${res.error}` });
      } else {
        setSyncStatusMsg({
          type: 'success',
          text: `تمت مزامنة البيانات بنجاح (${res.successCount} من إجمالي ${res.total} عنصر)`
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
    setSyncStatusMsg({ type: 'info', text: 'جاري تحديث كافة البيانات المخزنة من قاعدة البيانات إلى المنظومة...' });
    try {
      const res = await fetchAllFromFirestoreNow();
      if (res.success) {
        setSyncStatusMsg({ type: 'success', text: 'تم تحديث البيانات في قاعدة البيانات بنجاح' });
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
                مركز إدارة قاعدة البيانات السحابية والأرشيف الاحتياطي
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                مزامنة لحظية ومزدوجة
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
              قاعدة البيانات الأساسية (6 جداول + تحديث لحظي مباشر) مع استمرار المزامنة والنسخ الاحتياطي التلقائي.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {isDeveloperRole && (
            <button
              type="button"
              onClick={handleImportFromGoogleSheet}
              disabled={isProcessing || isImportingFromGoogleSheet || isFirestoreSyncing}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>
                {isImportingFromGoogleSheet
                  ? `جاري الاستيراد... (${sheetImportProgress?.percent ?? 0}%)`
                  : 'استيراد ومزامنة الأرشيف الاحتياطي إلى قاعدة البيانات'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={handlePushAll}
            disabled={isProcessing || isFirestoreSyncing || isImportingFromGoogleSheet}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>رفع كافة البيانات الآن</span>
          </button>
          <button
            type="button"
            onClick={handleFetchAll}
            disabled={isProcessing || isFirestoreSyncing || isImportingFromGoogleSheet}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
            <span>تحديث مباشر من قاعدة البيانات</span>
          </button>
        </div>
      </div>

      {/* Live Progress Counter for Backup Archive Import (Developer Only) */}
      {isDeveloperRole && sheetImportProgress && (isImportingFromGoogleSheet || sheetImportProgress.phase === 'done' || sheetImportProgress.phase === 'error') && (
        <div className={`p-4 rounded-2xl border space-y-2.5 shadow-xs ${
          sheetImportProgress.phase === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
            : sheetImportProgress.phase === 'done'
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
            : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
        }`}>
          <div className="flex items-center justify-between gap-2 text-xs font-black">
            <span className="text-slate-800 dark:text-slate-100">{sheetImportProgress.label}</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-300 shrink-0">
              {sheetImportProgress.percent}%
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                sheetImportProgress.phase === 'error'
                  ? 'bg-rose-500'
                  : sheetImportProgress.phase === 'done'
                  ? 'bg-emerald-600'
                  : 'bg-blue-600'
              }`}
              style={{ width: `${Math.max(3, Math.min(100, sheetImportProgress.percent))}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <span>
              المراجعون: <strong className="font-mono text-slate-900 dark:text-white">{sheetImportProgress.citizensDone} / {sheetImportProgress.citizensTotal}</strong>
            </span>
            <span>•</span>
            <span>
              المعاملات: <strong className="font-mono text-slate-900 dark:text-white">{sheetImportProgress.requestsDone} / {sheetImportProgress.requestsTotal}</strong>
            </span>
            {sheetImportProgress.otherTotal > 0 && (
              <>
                <span>•</span>
                <span>
                  الأقسام المساندة: <strong className="font-mono text-slate-900 dark:text-white">{sheetImportProgress.otherDone} / {sheetImportProgress.otherTotal}</strong>
                </span>
              </>
            )}
          </div>
        </div>
      )}

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
            <span className="text-xs font-black text-slate-900 dark:text-white">قاعدة البيانات الرئيسية</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-mono text-sm font-bold">
            <Database className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">نمط المزامنة المزدوجة</span>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">مزامنة لحظية + أرشيف احتياطي</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-mono text-sm font-bold">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 font-bold block">الجداول النشطة (6 جداول)</span>
            <span className="text-xs font-black text-slate-900 dark:text-white">المراجعون · المعاملات · الحظر · الحسابات · الأقسام · الإعدادات</span>
          </div>
        </div>
      </div>

      {/* Collections Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-500" />
            <span>جداول قاعدة البيانات الستة - إجمالي السجلات: ({totalRecords})</span>
          </h4>
          <span className="text-[11px] text-slate-400">
            حفظ مزدوج تلقائي وفوري في قاعدة البيانات والأرشيف الاحتياطي
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
