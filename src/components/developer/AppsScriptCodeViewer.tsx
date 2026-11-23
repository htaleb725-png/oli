import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { APPS_SCRIPT_PRODUCTION_CODE } from '../../services/appsScriptTemplate';
import { DEPARTMENT_SHEETS_OVERVIEW } from '../../services/googleSheetsSchema';
import { reorganizeGoogleSheetsNow } from '../../services/realtimeGoogleSync';
import { 
  Code2, 
  Copy, 
  Check, 
  ExternalLink, 
  FileSpreadsheet, 
  Play, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Save,
  Link2,
  Database,
  RefreshCw
} from 'lucide-react';

export const AppsScriptCodeViewer: React.FC = () => {
  const { 
    systemSettings, 
    updateSettings,
    syncAllToFirestoreNow,
    syncAllToGoogleSheetsNow,
    addCitizen,
    addRequest,
    citizens,
    requests,
    interviews,
    organizationRecords,
    officialLetters,
    cheques,
    customRecords,
    users,
    auditLogs
  } = useApp();

  const [copied, setCopied] = useState(false);
  const [appsScriptUrl, setAppsScriptUrl] = useState(systemSettings.appsScriptUrl || '');
  const [sheetId, setSheetId] = useState(systemSettings.googleSheetId || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [bulkSyncResult, setBulkSyncResult] = useState<string | null>(null);

  const handleFullCloudSync = async () => {
    setIsBulkSyncing(true);
    setBulkSyncResult(null);
    try {
      const fsRes = await syncAllToFirestoreNow();
      let sheetSuccess = false;
      try {
        await syncAllToGoogleSheetsNow();
        sheetSuccess = true;
      } catch (e) {
        console.warn('Sheets sync note:', e);
      }
      setBulkSyncResult(`✓ تمت المزامنة الشاملة بنجاح! تم تحديث ${fsRes.successCount} سجل في السحابة${sheetSuccess ? ' وإرسال الحزمة إلى أوراق Google Sheets الـ 8 (ورقة واحدة لكل قسم)' : ''}.`);
    } catch (err: any) {
      setBulkSyncResult(`تنبيه المزامنة: ${err.message || 'حدث خطأ أثناء المزامنة'}`);
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const handleReorganize8DepartmentsNow = async () => {
    setIsBulkSyncing(true);
    setBulkSyncResult(null);
    try {
      const res = await reorganizeGoogleSheetsNow({
        appsScriptUrl: appsScriptUrl.trim() || systemSettings.appsScriptUrl,
        sheetId: sheetId.trim() || systemSettings.googleSheetId,
        citizens,
        requests,
        interviews,
        organizationRecords,
        officialLetters,
        cheques,
        customRecords,
        users,
        auditLogs
      });
      setBulkSyncResult(res.message);
    } catch (err: any) {
      setBulkSyncResult(`تعذر تنظيم الأوراق: ${err?.message || 'حدث خطأ'}`);
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const handleSeedOfficialTestData = async () => {
    setIsBulkSyncing(true);
    try {
      const testCitizen = addCitizen({
        FullName: 'جاسم محمد علي الخفاجي',
        Phone1: '07801234567',
        District: 'الناصرية',
        SubDistrict: 'الإسكان القديم',
        Gender: 'ذكر',
        Job: 'كاسب',
        Rating: 'لائق',
        Education: 'إعدادية',
        ReferralSource: 'مكتب النائب'
      });
      addRequest({
        Citizen_ID: testCitizen.Citizen_ID,
        CitizenName: testCitizen.FullName,
        CitizenPhone: testCitizen.Phone1,
        CreatedBy: 'فحص المطور السحابي',
        Entity: 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
        RequestStatus: 'مستلم',
        ProcessingStatus: 'قيد التدقيق',
        Priority: 'عاجل',
        Details: 'طلب شمول رسمي براتب الحماية الاجتماعية - فحص سحابي تجريبي'
      });
      setBulkSyncResult(`✓ تم بنجاح إنشاء سجل مواطن وطلب رسمي وحفظهما فورياً في السحابة وجدول Google Sheets! تفقد Google Sheets الآن لرؤية البيانات.`);
    } catch (err: any) {
      setBulkSyncResult(`تعذر حقن البيانات: ${err.message}`);
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_PRODUCTION_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      appsScriptUrl: appsScriptUrl.trim(),
      googleSheetId: sheetId.trim()
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('al_nashi_apps_script_url', appsScriptUrl.trim());
      localStorage.setItem('al_nashi_sheet_id', sheetId.trim());
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestScript = async () => {
    if (!appsScriptUrl.trim()) {
      setTestResult({ success: false, message: 'يرجى إدخال رابط تطبيق الويب أولاً (Web App URL)' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await reorganizeGoogleSheetsNow({
        appsScriptUrl: appsScriptUrl.trim(),
        sheetId: sheetId.trim() || systemSettings.googleSheetId,
        citizens,
        requests,
        interviews,
        organizationRecords,
        officialLetters,
        cheques,
        customRecords,
        users,
        auditLogs
      });

      setTestResult({
        success: res.success,
        message: res.message
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `فشل الاختبار: ${err.message || 'تعذر الوصول إلى رابط السكربت'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/5 border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>سكربت المطور ومحرك الربط السحابي مع Google Sheets</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                جاهز للنسخ والنشر المباشر ⚡
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              هذا السكربت البرمجي المكتوب خصيصاً للمنظومة يتم وضعه في جدول Google Sheets ليتولى معالجة وتخزين البيانات لحظياً بدون وسيط خارجي.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyCode}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'تم نسخ السكربت كاملاً!' : 'نسخ كود السكربت البرمجي'}</span>
        </button>
      </div>

      {/* URL & Sheet Configuration Form */}
      <form onSubmit={handleSaveConfig} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Link2 className="w-4 h-4 text-emerald-600" />
          <span>إعدادات رابط السكربت المخصص ومعرف الجدول:</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              رابط تطبيق الويب المعتمد (Google Apps Script Web App URL)
            </label>
            <input
              type="url"
              value={appsScriptUrl}
              onChange={(e) => setAppsScriptUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-600 text-left"
              dir="ltr"
            />
            <span className="text-[10px] text-slate-400 block">
              تحصل على هذا الرابط بعد ضغط 'Deploy' ← 'New deployment' ← نوع 'Web App' في Google Sheets
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              معرف جدول بيانات جوجل (Google Spreadsheet ID)
            </label>
            <input
              type="text"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-600 text-left"
              dir="ltr"
            />
            <span className="text-[10px] text-slate-400 block">
              الرمز الموجود في رابط الجدول بين /d/ و /edit
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ إعدادات الربط</span>
            </button>
            {saveSuccess && (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم الحفظ بنجاح</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleTestScript}
            disabled={isTesting}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isTesting ? 'جاري الفحص...' : 'فحص الاتصال وإرسال سجل تجريبي ⚡'}</span>
          </button>
        </div>

        {testResult && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            testResult.success ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}>
            {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{testResult.message}</span>
          </div>
        )}
      </form>

      {/* Master Dual-Cloud Sync & Test Injection Toolbar */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-slate-900/40 border border-amber-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-amber-300 flex items-center gap-2">
            <span>🚀 التحكم المباشر بالمزامنة المزدوجة (Firebase Firestore + Google Sheets):</span>
          </h4>
          <span className="text-[11px] font-mono text-slate-400">
            عدد السجلات الحالية في المنظومة: {citizens.length} مواطن
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isBulkSyncing}
            onClick={handleReorganize8DepartmentsNow}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBulkSyncing ? 'animate-spin' : ''}`} />
            <span>{isBulkSyncing ? 'جاري التوحيد...' : 'توحيد وترتيب أوراق Google Sheets الـ 8 (ورقة واحدة لكل قسم)'}</span>
          </button>

          <button
            type="button"
            disabled={isBulkSyncing}
            onClick={handleFullCloudSync}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{isBulkSyncing ? 'جاري المزامنة السحابية...' : 'إرسال ومزامنة كافة البيانات السابقة إلى السحابة و Sheets الآن'}</span>
          </button>

          <button
            type="button"
            disabled={isBulkSyncing}
            onClick={handleSeedOfficialTestData}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-black text-xs flex items-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="إضافة مواطن ومعاملة تجريبية فورية للتأكد من نزول البيانات في Google Sheets"
          >
            <span>إضافة سجلات تجريبية فورية للتأكد من وصولها للشيت</span>
          </button>
        </div>

        {bulkSyncResult && (
          <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-400/50 text-amber-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{bulkSyncResult}</span>
          </div>
        )}
      </div>

      {/* 8 Single-Sheet-Per-Department Schema Overview */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-500" />
            <span>هيكلة قاعدة البيانات المعتمدة في Google Sheets (8 أوراق رسمية - ورقة واحدة لكل قسم):</span>
          </h4>
          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 text-[10px] font-black">
            8 أوراق فقط بدون تكرار
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DEPARTMENT_SHEETS_OVERVIEW.map((dept, idx) => (
            <div key={dept.key} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{dept.departmentTitle}</span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400">
                  {dept.sheetName}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {dept.headers.map((h, hIdx) => (
                  <span
                    key={h}
                    className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300"
                  >
                    {hIdx + 1}. {h}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Code2 className="w-4 h-4 text-indigo-500" />
            <span>كود السكربت البرمجي الكامل (Google Apps Script Code.gs):</span>
          </h4>
          <button
            type="button"
            onClick={handleCopyCode}
            className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
          </button>
        </div>

        <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
          <pre 
            className="p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-96 leading-relaxed text-left selection:bg-emerald-500 selection:text-slate-950" 
            dir="ltr"
          >
            {APPS_SCRIPT_PRODUCTION_CODE}
          </pre>
        </div>
      </div>

      {/* Step by Step Guide Accordion */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        <button
          type="button"
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between text-xs font-black text-slate-900 dark:text-white cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-500" />
            <span>دليل خطوات التشغيل والربط السحابي (خطوة بخطوة للمطور):</span>
          </div>
          <span className="text-slate-400 text-xs font-normal">
            {showInstructions ? 'إخفاء الدليل ▲' : 'إظهار الدليل ▼'}
          </span>
        </button>

        {showInstructions && (
          <div className="pt-2 text-xs space-y-2.5 text-slate-600 dark:text-slate-300 leading-relaxed">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
              <div>
                <strong>افتح جدول Google Sheets</strong> المخصص لبيانات مكتب النائب في متصفحك.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
              <div>
                من القائمة العلوية للجدول، اختر <strong>ملحقات (Extensions)</strong> ثم اضغط على <strong>Apps Script</strong>.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
              <div>
                احذف أي نص موجود في ملف <code>Code.gs</code>، ثم الصق كود السكربت المنسوخ أعلاه واضغط زر <strong>حفظ (Save 💾)</strong>.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">4</span>
              <div>
                اضغط على زر <strong>نشر (Deploy)</strong> باللون الأزرق أعلى اليمين &gt; <strong>نشر جديد (New deployment)</strong> &gt; اختر نوع <strong>Web app</strong>.
                <br />
                في خانة <strong>Who has access (من يمكنه الوصول)</strong> اختر: <strong>Anyone (أي شخص)</strong> لضمان عمل المزامنة اللحظية بدون حجب.
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">5</span>
              <div>
                انسخ رابط تطبيق الويب (Web App URL) الناتج، والصقه في حقل <strong>رابط تطبيق الويب</strong> أعلاه ثم اضغط حفظ.
              </div>
            </div>

            {/* Note on Apps Script 'Run' */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1.5 mt-3">
              <div className="font-black text-xs flex items-center gap-2">
                <span>⚠️ ملاحظة مهمة جداً عن زر "تنفيذ" (Run) داخل Google Apps Script:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-200">
                زر "تنفيذ" (Run) داخل محرر جوجل مخصص فقط لتهيئة الجداول الفارغة وتنسيق الألوان (<code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300">setupSpreadsheet</code>).
                السكربت لا يولد بيانات من نفسه عند الضغط على "تنفيذ"، بل يعمل كـ <strong>مستقبل ويب (Web App)</strong>، ويستقبل البيانات آلياً بمجرد قيامك بتسجيل مراجع أو معاملة، أو الضغط على زر <strong>"إضافة سجلات تجريبية فورية"</strong> أعلاه.
              </p>
            </div>

            {/* Note on Vercel Environment Variables */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 space-y-1.5">
              <div className="font-black text-xs flex items-center gap-2">
                <span>⚡ تنبيه إلزامي بعد وضع المتغيرات في Vercel:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-blue-200">
                في Vercel، عند إضافة المتغيرات في <span className="font-bold">Settings &gt; Environment Variables</span>، فإن الموقع لا يقرأها تلقائياً على النسخة القديمة المنشورة.
                يجب حتماً الدخول إلى قائمة <span className="font-bold">Deployments</span>، والضغط على الثلاث نقاط <span className="font-bold">(...)</span> بجانب آخر نشر واختيار <span className="font-bold text-white bg-blue-700 px-1.5 py-0.5 rounded">Redeploy</span> (أو عمل Push جديد من GitHub) ليقوم Vercel ببناء النسخة بالمتغيرات الجديدة.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
