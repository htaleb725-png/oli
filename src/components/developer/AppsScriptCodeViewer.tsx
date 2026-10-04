import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { APPS_SCRIPT_PRODUCTION_CODE, APPS_SCRIPT_SETUP_GUIDE } from '../../services/appsScriptTemplate';
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
  Link2
} from 'lucide-react';

export const AppsScriptCodeViewer: React.FC = () => {
  const { systemSettings, updateSettings } = useApp();

  const [copied, setCopied] = useState(false);
  const [appsScriptUrl, setAppsScriptUrl] = useState(systemSettings.appsScriptUrl || '');
  const [sheetId, setSheetId] = useState(systemSettings.googleSheetId || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

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
      await fetch(appsScriptUrl.trim(), {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'appendRow',
          sheetType: 'dropdowns',
          record: {
            Category: 'فحص_الاتصال',
            Value: `اختبار المطور ${new Date().toLocaleTimeString('ar-IQ')}`
          },
          timestamp: new Date().toISOString(),
          source: 'developer_console_test'
        })
      });

      setTestResult({
        success: true,
        message: 'تم إرسال حزمة الاختبار بنجاح إلى سكربت Google Sheets! تفقد جدولك للتأكد من ظهور سطر الفحص.'
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
          </div>
        )}
      </div>
    </div>
  );
};
