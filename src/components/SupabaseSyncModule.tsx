import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  Code,
  ExternalLink,
  ShieldCheck,
  Table,
  Zap,
  Key,
  Globe,
  GitBranch,
  ArrowUpRight
} from 'lucide-react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  checkSupabaseHealth,
  generateSupabaseFullSchemaSQL,
  syncAllLocalDataToSupabase,
  fetchAllDataFromSupabase,
  autoSyncNewCodeDataToSupabase,
  TableStatus
} from '../services/supabaseService';
import {
  INITIAL_USERS,
  INITIAL_DROPDOWNS,
  INITIAL_DYNAMIC_FIELDS,
  INITIAL_SETTINGS
} from '../data/initialData';
import { useAppContext } from '../context/AppContext';

export const SupabaseSyncModule: React.FC = () => {
  const {
    citizens,
    requests,
    interviews,
    officialLetters,
    organizationRecords,
    cheques,
    auditLogs,
    users,
    systemSettings,
    setCitizens,
    setRequests,
    setInterviews,
    setOfficialLetters,
    setOrganizationRecords,
    setCheques,
    setUsers,
    setDropdowns,
    setDynamicFields
  } = useAppContext() as any;

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => prev?.message === message ? null : prev);
    }, 4000);
  };

  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [projectHost, setProjectHost] = useState('');
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlViewer, setShowSqlViewer] = useState(false);

  // Sync state
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ step: number; total: number; message: string } | null>(null);

  // Load existing config on mount
  useEffect(() => {
    const config = getSupabaseConfig();
    setUrl(config.url);
    setAnonKey(config.anonKey);
    if (config.url && config.anonKey) {
      runHealthCheck();
    }
  }, []);

  const runHealthCheck = async () => {
    setIsChecking(true);
    setStatusMessage(null);
    try {
      const result = await checkSupabaseHealth();
      setIsConnected(result.connected);
      setStatusMessage(result.message);
      if (result.projectHost) setProjectHost(result.projectHost);
      setTables(result.tables);
    } catch (err: any) {
      setIsConnected(false);
      setStatusMessage(err?.message || 'فشل الاتصال بقاعدة بيانات Supabase.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveAndConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      showToast('يرجى إدخال رابط المشروع ومفتاح API لـ Supabase', 'warning');
      return;
    }

    saveSupabaseConfig(url.trim(), anonKey.trim());
    showToast('تم حفظ بيانات الاتصال، جاري فحص قاعدة البيانات...', 'info');
    await runHealthCheck();
  };

  const handleDisconnect = () => {
    clearSupabaseConfig();
    setUrl('');
    setAnonKey('');
    setIsConnected(false);
    setProjectHost('');
    setTables([]);
    setStatusMessage('تم فصل الاتصال بقاعدة بيانات Supabase.');
    showToast('تم إزالة بيانات الربط بقاعدة البيانات بنجاح', 'info');
  };

  const handleCopySql = () => {
    const sql = generateSupabaseFullSchemaSQL();
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    showToast('تم نسخ كود SQL الشامل لإنشاء الأعمدة والجداول بنجاح', 'success');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSyncAllToSupabase = async () => {
    if (!isConnected) {
      showToast('يرجى الاتصال بقاعدة بيانات Supabase أولاً', 'error');
      return;
    }

    setIsSaving(true);
    setSyncProgress({ step: 1, total: 9, message: 'بدء تصدير البيانات إلى Supabase...' });

    try {
      const res = await syncAllLocalDataToSupabase(
        {
          citizens,
          requests,
          interviews,
          officialLetters,
          organizationRecords,
          cheques,
          auditLogs,
          users,
          settings: systemSettings,
        },
        (step, total, message) => {
          setSyncProgress({ step, total, message });
        }
      );

      if (res.success) {
        showToast(res.message, 'success');
        // Refresh table counts
        await runHealthCheck();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(`حدث خطأ أثناء الحفظ: ${err?.message || err}`, 'error');
    } finally {
      setIsSaving(false);
      setSyncProgress(null);
    }
  };

  const handleFetchAllFromSupabase = async () => {
    if (!isConnected) {
      showToast('يرجى الاتصال بقاعدة بيانات Supabase أولاً', 'error');
      return;
    }

    if (!window.confirm('هل تريد جلب كافة البيانات وتحديث سجلات النظام من Supabase؟')) {
      return;
    }

    setIsFetching(true);
    try {
      const res = await fetchAllDataFromSupabase();
      if (res.success) {
        if (res.data.citizens.length > 0) setCitizens(res.data.citizens);
        if (res.data.requests.length > 0) setRequests(res.data.requests);
        if (res.data.interviews.length > 0) setInterviews(res.data.interviews);
        if (res.data.officialLetters.length > 0) setOfficialLetters(res.data.officialLetters);
        if (res.data.organizationRecords.length > 0) setOrganizationRecords(res.data.organizationRecords);
        if (res.data.cheques.length > 0) setCheques(res.data.cheques);

        showToast(res.message, 'success');
        await runHealthCheck();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(`تعذر جلب البيانات: ${err?.message || err}`, 'error');
    } finally {
      setIsFetching(false);
    }
  };

  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  const handleRunAutoMigration = async () => {
    if (!isConnected) {
      showToast('يرجى الاتصال بقاعدة بيانات Supabase أولاً', 'error');
      return;
    }

    setIsAutoSyncing(true);
    try {
      const result = await autoSyncNewCodeDataToSupabase({
        codeUsers: INITIAL_USERS,
        codeDropdowns: INITIAL_DROPDOWNS,
        codeDynamicFields: INITIAL_DYNAMIC_FIELDS,
        codeSettings: INITIAL_SETTINGS
      });

      if (result.isSupabaseActive && result.restoredData) {
        const { restoredData } = result;
        if (restoredData.citizens.length > 0) setCitizens(restoredData.citizens);
        if (restoredData.requests.length > 0) setRequests(restoredData.requests);
        if (restoredData.interviews.length > 0) setInterviews(restoredData.interviews);
        if (restoredData.officialLetters.length > 0) setOfficialLetters(restoredData.officialLetters);
        if (restoredData.organizationRecords.length > 0) setOrganizationRecords(restoredData.organizationRecords);
        if (restoredData.cheques.length > 0) setCheques(restoredData.cheques);
        if (restoredData.users.length > 0) setUsers(restoredData.users);
        if (restoredData.dropdowns.length > 0) setDropdowns(restoredData.dropdowns);
        if (restoredData.dynamicFields.length > 0) setDynamicFields(restoredData.dynamicFields);

        showToast(
          `اكتملت المزامنة الذكية: تم إدراج ${result.newItemsAddedToSupabase.usersCount} حساب وقسم جديد، واسترجاع ${restoredData.citizens.length} مواطن من السحابة بنجاح!`,
          'success'
        );
        await runHealthCheck();
      } else {
        showToast(result.message, 'warning');
      }
    } catch (err: any) {
      showToast(`خطأ في المزامنة التلقائية: ${err?.message || err}`, 'error');
    } finally {
      setIsAutoSyncing(false);
    }
  };

  const allTablesReady = tables.length > 0 && tables.every(t => t.exists);

  return (
    <div className="space-y-6 relative" dir="rtl">
      {/* Toast Alert */}
      {toast && (
        <div className={`p-4 rounded-xl shadow-lg border text-sm font-bold flex items-center justify-between transition-all duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-500 text-white border-emerald-600'
            : toast.type === 'error'
            ? 'bg-red-500 text-white border-red-600'
            : toast.type === 'warning'
            ? 'bg-amber-500 text-white border-amber-600'
            : 'bg-slate-800 text-white border-slate-700'
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <Check className="w-5 h-5" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5" />}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-white/80 hover:text-white text-xs mr-4">
            ✕
          </button>
        </div>
      )}
      {/* Primary Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shadow-inner">
              <Database className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">قاعدة بيانات Supabase السحابية (الرئيسية)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400" /> قاعدة البيانات النشطة
                </span>
              </div>
              <p className="text-sm text-emerald-100/70 mt-1">
                الربط المباشر بقاعدة بيانات PostgreSQL السحابية للاستعلام والحفظ اللحظي لكافة جداول وأعمدة النظام.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              isConnected && allTablesReady
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm'
                : isConnected
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-red-500/20 border-red-400 text-red-300'
            }`}>
              {isConnected && allTablesReady ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  متصل - الجداول جاهزة للعمل
                </>
              ) : isConnected ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  متصل - بعض الجداول تحتاج تجهيز
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                  غير متصل
                </>
              )}
            </div>

            <button
              onClick={runHealthCheck}
              disabled={isChecking || !url}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold"
              title="إعادة فحص الاتصال"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-emerald-400' : ''}`} />
              <span>فحص</span>
            </button>
          </div>
        </div>

        {/* Notice of Decoupling Google Sheets/Drive */}
        <div className="mt-4 p-3 rounded-xl bg-emerald-900/40 border border-emerald-500/30 flex items-start gap-3 text-xs text-emerald-100">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white">استقلالية وسرعة فائقة: </span>
            تم تحويل الاعتماد بالكامل إلى قاعدة بيانات Supabase. لن تواجه بعد الآن مشاكل توثيق Google Sheets أو انتهاء تصاريح النطاق (unauthorized-domain)، وتعمل كافة العمليات (استعلام وحفظ) بسلاسة فائقة وسرعة فورية.
          </div>
        </div>
      </div>

      {/* Connection Settings Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-slate-800 dark:text-white">إعدادات الربط المباشر بـ Supabase</h3>
          </div>
          {isConnected && (
            <button
              onClick={handleDisconnect}
              className="text-xs text-red-600 hover:text-red-700 font-semibold transition"
            >
              قطع الاتصال
            </button>
          )}
        </div>

        <form onSubmit={handleSaveAndConnect} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                رابط مشروع Supabase (Project URL)
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                dir="ltr"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                تجد الرابط في لوحة تحكم Supabase تحت: Project Settings {'>'} API
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-500" />
                  مفتاح API الخاص بقاعدة البيانات (Anon / Service Role Key)
                </span>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {showKey ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
                </button>
              </label>
              <input
                type={showKey ? 'text' : 'password'}
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                dir="ltr"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition font-mono"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                مفتاح API العام (anon public key) أو مفتاح الخدمة الكامل (service_role)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {projectHost && (
                <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-mono">
                  المشروع: {projectHost}
                </span>
              )}
              {statusMessage && (
                <span className={`font-semibold ${isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {statusMessage}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isChecking || !url.trim() || !anonKey.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm transition shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isConnected ? 'تحديث والتحقق من الاتصال' : 'حفظ والربط بقاعدة البيانات'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Auto-Creation of Tables & Columns (Schema Provisioning) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Table className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-slate-800 dark:text-white">تجهيز وهيكلة الأعمدة والجداول في Supabase</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              مخطط PostgreSQL المتكامل الذي يُنشئ كافة الأعمدة والجداول مع صلاحيات القراءة والحفظ السريعة.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySql}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm ${
                copiedSql
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
              }`}
            >
              {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSql ? 'تم نسخ كود SQL بنجاح!' : 'نسخ كود SQL لإنشاء الجداول'}</span>
            </button>

            <button
              onClick={() => setShowSqlViewer(!showSqlViewer)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
            >
              <Code className="w-4 h-4" />
              <span>{showSqlViewer ? 'إخفاء الكود' : 'معاينة كود SQL'}</span>
            </button>

            {projectHost && (
              <a
                href={`https://supabase.com/dashboard/project/_/sql`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                title="فتح محرر SQL في Supabase"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح SQL Editor</span>
              </a>
            )}
          </div>
        </div>

        {/* Quick Instructions on Table Creation */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mb-5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          <span className="font-bold text-emerald-600 dark:text-emerald-400">طريقة إنشاء وتجهيز الجداول والأعمدة بضغطة زر: </span>
          اضغط على زر <strong className="text-slate-900 dark:text-white">"نسخ كود SQL لإنشاء الجداول"</strong> أعلاه، ثم الصقه في صفحة <strong className="text-slate-900 dark:text-white">SQL Editor</strong> بمشروعك في Supabase واضغط <strong className="text-emerald-600">Run</strong>. سيقوم فوراً بإنشاء كافة الجداول (المواطنون، الطلبات، المقابلات، الكتب، الصكوك، النشاطات) مع كافة أعمدتها وفهارسها.
        </div>

        {/* SQL Viewer Accordion */}
        {showSqlViewer && (
          <div className="mb-5 rounded-xl border border-slate-700 bg-slate-950 p-4 text-left font-mono text-xs text-slate-200 overflow-x-auto max-h-80" dir="ltr">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400 text-[11px]">
              <span>PostgreSQL Schema DDL for Supabase</span>
              <button
                onClick={handleCopySql}
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-sans"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? 'تم النسخ' : 'نسخ الكود'}
              </button>
            </div>
            <pre className="whitespace-pre">{generateSupabaseFullSchemaSQL()}</pre>
          </div>
        )}

        {/* Tables Health Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tables.length > 0 ? (
            tables.map((t) => (
              <div
                key={t.tableName}
                className={`p-3.5 rounded-xl border transition flex items-center justify-between ${
                  t.exists
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {t.exists ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-white">
                      {t.titleArabic}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {t.tableName}
                    </div>
                  </div>
                </div>

                <div className="text-left">
                  {t.exists ? (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                      {t.count} سجل
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                      غير منشأ بعد
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-xs text-slate-400">
              {isConnected
                ? 'جاري فحص حالة الجداول...'
                : 'أدخل رابط ومفتاح Supabase أعلاه لعرض وفحص حالة الجداول والأعمدة.'}
            </div>
          )}
        </div>
      </div>

      {/* Save & Query Operations Hub */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-slate-800 dark:text-white">عمليات الحفظ والاستعلام الشاملة (Save & Query)</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          يمكنك تصدير كافة بيانات النظام الحالية وحفظها في Supabase بضغطة واحدة، أو جلب وتحديث النظام من قاعدة البيانات السحابية.
        </p>

        {syncProgress && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                {syncProgress.message}
              </span>
              <span>خطوة {syncProgress.step} من {syncProgress.total}</span>
            </div>
            <div className="w-full bg-emerald-200 dark:bg-emerald-900 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-600 h-2 transition-all duration-300 rounded-full"
                style={{ width: `${(syncProgress.step / syncProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-white mb-1">
                <UploadCloud className="w-4 h-4 text-emerald-600" />
                تصدير وحفظ كافة بيانات النظام الحالية إلى Supabase
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                يقوم بحفظ كافة السجلات الموجودة في النظام (المواطنين: {citizens.length}، المعاملات: {requests.length}، المقابلات: {interviews.length}، الصكوك: {cheques.length}، الكتب الرسمية: {officialLetters.length}) في جداول Supabase السحابية.
              </p>
            </div>
            <button
              onClick={handleSyncAllToSupabase}
              disabled={isSaving || !isConnected}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs transition shadow disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <UploadCloud className={`w-4 h-4 ${isSaving ? 'animate-bounce' : ''}`} />
              <span>{isSaving ? 'جاري الحفظ في Supabase...' : 'حفظ ومزامنة كافة السجلات في Supabase الآن'}</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-white mb-1">
                <DownloadCloud className="w-4 h-4 text-blue-600" />
                استيراد وتحديث النظام من قاعدة بيانات Supabase
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                يقوم بالاستعلام عن كافة السجلات من قاعدة بيانات Supabase السحابية وتحديث بيانات النظام والشاشات فوراً.
              </p>
            </div>
            <button
              onClick={handleFetchAllFromSupabase}
              disabled={isFetching || !isConnected}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs transition shadow disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <DownloadCloud className={`w-4 h-4 ${isFetching ? 'animate-bounce' : ''}`} />
              <span>{isFetching ? 'جاري الاستعلام والجلب...' : 'جلب وتحديث كافة البيانات من Supabase'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* GitHub & Hosting Deployment (Vercel / Hostinger) Guide Card */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-sm text-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-indigo-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">دليل النشر على GitHub واستضافات Vercel و Hostinger</h3>
              <p className="text-xs text-indigo-200/70 mt-0.5">
                ضمان بقاء بياناتك السحابية آمنة وإدراج أي أقسام أو حقول جديدة تلقائياً عند التحديث البرمجي
              </p>
            </div>
          </div>

          <button
            onClick={handleRunAutoMigration}
            disabled={isAutoSyncing || !isConnected}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAutoSyncing ? 'animate-spin' : ''}`} />
            <span>{isAutoSyncing ? 'جاري الفحص والمزامنة...' : 'فحص ومزامنة الأقسام والبيانات الجديدة الآن'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
              <CheckCircle2 className="w-4 h-4" />
              1. الحفاظ على البيانات السحابية (Zero Data Loss)
            </div>
            <p className="text-slate-300 leading-relaxed">
              عند رفع كودك إلى GitHub ونشره على Vercel أو Hostinger، لن تُمس بيانات المواطنين أو المعاملات أو الصكوك المخزنة في Supabase على الإطلاق، بل ستبقى محفوظة ومؤمنة في السحابة.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div className="font-bold text-blue-400 flex items-center gap-1.5 text-sm">
              <Zap className="w-4 h-4" />
              2. إدراج الأقسام والبيانات الجديدة تلقائياً
            </div>
            <p className="text-slate-300 leading-relaxed">
              إذا قمت بإضافة قسم جديد، أو موظف جديد، أو حقل ديناميكي في الكود وعملت Push إلى GitHub، بمجرد تشغيل الموقع على الاستضافة سيتعرف النظام فوراً ويضيف السجلات الجديدة في Supabase تلقائياً!
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div className="font-bold text-amber-400 flex items-center gap-1.5 text-sm">
              <Key className="w-4 h-4" />
              3. متغيرات البيئة على Vercel / Hostinger
            </div>
            <p className="text-slate-300 leading-relaxed">
              في لوحة تحكم Vercel أو ملف <code className="text-amber-300">.env</code> على Hostinger، ضع المتغيرين التاليين ليعمل الربط تلقائياً للجميع:
              <br />
              <code className="text-[10px] text-emerald-300 font-mono block mt-1">VITE_SUPABASE_URL=...</code>
              <code className="text-[10px] text-emerald-300 font-mono block">VITE_SUPABASE_ANON_KEY=...</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
