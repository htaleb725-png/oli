import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Building2, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  RefreshCw, 
  Layers, 
  ExternalLink,
  ShieldCheck,
  Copy,
  Check,
  Database,
  Zap,
  Info,
  FileSpreadsheet,
  FolderLock,
  User,
  MapPin,
  Flame,
  ArrowDownCircle,
  UploadCloud
} from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';
import { setActiveOfficePartition } from '../../services/firebaseFirestoreService';
import { sheetsIntegration } from '../../services/sheetsIntegrationLayer';

interface PresetOffice {
  id: string;
  name: string;
  deputyName: string;
  deputyTitle: string;
  partitionKey: string;
  province: string;
  sheetId?: string;
  folderId?: string;
  appsScriptUrl?: string;
}

const PRESET_OFFICES: PresetOffice[] = [
  { 
    id: 'office_main', 
    name: 'مكتب النائب المهندسة علا الناشي (المقر الرئيسي - ذي قار)', 
    deputyName: 'علا الناشي', 
    deputyTitle: 'النائب المهندسة', 
    partitionKey: 'office_alnashi_main', 
    province: 'ذي قار' 
  },
  { 
    id: 'office_baghdad', 
    name: 'مكتب بغداد التشريعي - الكرخ والرصافة', 
    deputyName: 'علا الناشي', 
    deputyTitle: 'النائب', 
    partitionKey: 'office_baghdad_branch', 
    province: 'بغداد' 
  },
  { 
    id: 'office_basra', 
    name: 'مكتب الجنوب والفرات الأوسط', 
    deputyName: 'علا الناشي', 
    deputyTitle: 'النائب', 
    partitionKey: 'office_south_branch', 
    province: 'البصرة' 
  },
  { 
    id: 'office_new_deputy', 
    name: 'مكتب النائب (مكتب جديد مخصص)', 
    deputyName: 'اسم النائب الجديد', 
    deputyTitle: 'النائب', 
    partitionKey: 'office_custom_new', 
    province: 'بغداد' 
  },
];

export const MultiOfficeFirebaseSwitcher: React.FC = () => {
  const { 
    systemSettings, 
    updateSettings, 
    syncAllToFirestoreNow, 
    fetchAllFromFirestoreNow,
    fetchAllFromGoogleSheetsNow,
    syncAllToGoogleSheetsNow
  } = useApp();

  const currentPartition = systemSettings.officeWorkspaceId || 'office_alnashi_main';
  const currentOfficeName = systemSettings.officeName || systemSettings.appName;

  // Identity Form State
  const [officeName, setOfficeName] = useState(currentOfficeName);
  const [deputyName, setDeputyName] = useState(systemSettings.deputyName || 'علا الناشي');
  const [deputyTitle, setDeputyTitle] = useState(systemSettings.deputyTitle || 'النائب المهندسة');
  const [province, setProvince] = useState(systemSettings.province || 'ذي قار');

  // Google Sheets & Drive Cloud Database State
  const [googleSheetId, setGoogleSheetId] = useState(
    systemSettings.googleSheetId || 
    (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') || '' : '')
  );
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState(
    systemSettings.googleDriveFolderId || 
    (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_drive_folder_id') || '' : '')
  );
  const [appsScriptUrl, setAppsScriptUrl] = useState(
    systemSettings.appsScriptUrl || 
    (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_apps_script_url') || '' : '')
  );

  // Firebase Partition Key & Custom Project State
  const [workspaceId, setWorkspaceId] = useState(currentPartition);
  const [customProjectId, setCustomProjectId] = useState(systemSettings.customFirebaseConfig?.projectId || firebaseConfig.projectId || '');
  const [customDatabaseId, setCustomDatabaseId] = useState(systemSettings.customFirebaseConfig?.firestoreDatabaseId || (firebaseConfig as any).firestoreDatabaseId || '(default)');
  const [customApiKey, setCustomApiKey] = useState(systemSettings.customFirebaseConfig?.apiKey || firebaseConfig.apiKey || '');
  
  const [copiedKey, setCopiedKey] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isPullingSheets, setIsPullingSheets] = useState(false);
  const [isPushingSheets, setIsPushingSheets] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setStatusMsg({ type: 'info', text: 'جاري فحص الاتصال بقواعد بيانات Firebase و Google Sheets للمكتب المحدد...' });
    try {
      const fsRes = await fetchAllFromFirestoreNow();
      let sheetsMsg = '';
      if (googleSheetId.trim()) {
        try {
          const sRes = await fetchAllFromGoogleSheetsNow();
          sheetsMsg = sRes.success ? '✓ وجدول Google Sheets متصل.' : '⚠️ تنبيه Google Sheets: ' + sRes.message;
        } catch {
          sheetsMsg = '⚠️ تعذر فحص Google Sheets.';
        }
      }

      if (fsRes.success) {
        setStatusMsg({
          type: 'success',
          text: `الاتصال السحابي بقاعدة البيانات ناجح 100%! تم التحقق من سلامة مستودع [${workspaceId}]. ${sheetsMsg}`
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: `فحص الاتصال بـ Firebase: ${fsRes.error || 'تعذر القراءة'}. ${sheetsMsg}`
        });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: `خطأ في الاتصال: ${e.message || 'حدث خطأ أثناء الفحص'}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePullGoogleSheetsNow = async () => {
    if (!googleSheetId.trim() && !appsScriptUrl.trim()) {
      setStatusMsg({ type: 'error', text: 'يرجى إدخال معرف جدول Google Sheets أو رابط Apps Script أولاً لجلب البيانات منه.' });
      return;
    }

    setIsPullingSheets(true);
    setStatusMsg({ type: 'info', text: 'جاري سحب واستيراد كافة بيانات هذا المكتب من جدول Google Sheets الآن...' });

    try {
      if (typeof window !== 'undefined') {
        if (googleSheetId.trim()) localStorage.setItem('al_nashi_sheet_id', googleSheetId.trim());
        if (googleDriveFolderId.trim()) localStorage.setItem('al_nashi_drive_folder_id', googleDriveFolderId.trim());
        if (appsScriptUrl.trim()) localStorage.setItem('al_nashi_apps_script_url', appsScriptUrl.trim());
      }
      sheetsIntegration.refreshLocalConfig();

      const res = await fetchAllFromGoogleSheetsNow();
      if (res.success) {
        setStatusMsg({
          type: 'success',
          text: `✓ ${res.message || 'تم بنجاح جلب كافة سجلات ومعاملات المكتب من جدول Google Sheets وتحديث واجهات النظام.'}`
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: `⚠️ لم نتمكن من سحب البيانات: ${res.message}`
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `خطأ أثناء جلب البيانات: ${err.message}` });
    } finally {
      setIsPullingSheets(false);
    }
  };

  const handlePushGoogleSheetsNow = async () => {
    if (!googleSheetId.trim() && !appsScriptUrl.trim()) {
      setStatusMsg({ type: 'error', text: 'يرجى إدخال معرف جدول Google Sheets أو رابط Apps Script أولاً لحفظ السجلات فيه.' });
      return;
    }

    setIsPushingSheets(true);
    setStatusMsg({ type: 'info', text: 'جاري إرسال وتحديث سجلات المنظومة في جدول Google Sheets ومجلد Drive الآن...' });

    try {
      if (typeof window !== 'undefined') {
        if (googleSheetId.trim()) localStorage.setItem('al_nashi_sheet_id', googleSheetId.trim());
        if (googleDriveFolderId.trim()) localStorage.setItem('al_nashi_drive_folder_id', googleDriveFolderId.trim());
        if (appsScriptUrl.trim()) localStorage.setItem('al_nashi_apps_script_url', appsScriptUrl.trim());
      }
      sheetsIntegration.refreshLocalConfig();

      const res = await syncAllToGoogleSheetsNow();
      if (res.success) {
        setStatusMsg({
          type: 'success',
          text: `✓ ${res.message || 'تم بنجاح إرسال وحفظ كافة السجلات في جدول Google Sheets ومجلد Drive.'}`
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: `⚠️ تنبيه الإرسال: ${res.message}`
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `خطأ أثناء إرسال البيانات: ${err.message}` });
    } finally {
      setIsPushingSheets(false);
    }
  };

  const handleSelectPreset = (preset: PresetOffice) => {
    setOfficeName(preset.name);
    setDeputyName(preset.deputyName);
    setDeputyTitle(preset.deputyTitle);
    setWorkspaceId(preset.partitionKey);
    setProvince(preset.province);
  };

  const handleApplySwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId.trim()) {
      setStatusMsg({ type: 'error', text: 'يرجى تحديد مفتاح عزل المكتب (Partition Key).' });
      return;
    }

    setIsSwitching(true);
    setStatusMsg({ type: 'info', text: 'جاري تطبيق إعدادات المكتب الجديد وربط قواعد البيانات...' });

    try {
      const cleanWorkspace = workspaceId.trim();
      const cleanSheetId = googleSheetId.trim();
      const cleanFolderId = googleDriveFolderId.trim();
      const cleanScriptUrl = appsScriptUrl.trim();

      setActiveOfficePartition(cleanWorkspace);

      // Save to localStorage directly for instant persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('al_nashi_office_partition', cleanWorkspace);
        if (cleanSheetId) localStorage.setItem('al_nashi_sheet_id', cleanSheetId);
        if (cleanFolderId) localStorage.setItem('al_nashi_drive_folder_id', cleanFolderId);
        if (cleanScriptUrl) localStorage.setItem('al_nashi_apps_script_url', cleanScriptUrl);
      }

      // Re-read configuration in Google Sheets Integration Layer
      sheetsIntegration.refreshLocalConfig();

      // Update SystemSettings in AppContext & Firestore
      updateSettings({
        appName: officeName.trim(),
        officeName: officeName.trim(),
        deputyName: deputyName.trim(),
        deputyTitle: deputyTitle.trim(),
        province: province.trim(),
        googleSheetId: cleanSheetId,
        googleDriveFolderId: cleanFolderId,
        appsScriptUrl: cleanScriptUrl,
        officeWorkspaceId: cleanWorkspace,
        customFirebaseConfig: {
          projectId: customProjectId.trim(),
          firestoreDatabaseId: customDatabaseId.trim(),
          apiKey: customApiKey.trim()
        }
      });

      // Attempt to load the new partition records from Firestore
      await fetchAllFromFirestoreNow();

      setStatusMsg({
        type: 'success',
        text: `تم بنجاح تغيير وتثبيت إعدادات (${officeName.trim()}) للنائب (${deputyName.trim()})! تم ربط جدول Google Sheets ومفتاح العزل السحابي [${cleanWorkspace}]. النظام مهيأ وجاهز للعمل للنائب الجديد دون الحاجة لأي تعديل برمجي.`
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `فشل الحفظ والتطبيق: ${err.message || 'حدث خطأ'}` });
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCopyPartitionKey = () => {
    navigator.clipboard.writeText(workspaceId);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Explanation Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-blue-500/5 border border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>مركز تهيئة وتغيير المكتب وقواعد البيانات للنائب الجديد (بدون تعديل الكود)</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                100% Zero-Code Multi-Office Deployment
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
              يمكنك نشر هذا البرنامج لأي نائب أو مكتب تشريعي جديد. من هذه الشاشة يمكنك تعديل اسم النائب، صفته، اسم المكتب، 
              وربط جدول Google Sheets ومجلد Drive ومفتاح قاعدة البيانات السحابية بالكامل بضغطة زر دون الرجوع للكود.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/40 shadow-xs shrink-0 text-center">
          <span className="text-[10px] text-slate-400 font-bold block">المكتب النشط حالياً:</span>
          <span className="text-xs font-black text-amber-600 dark:text-amber-400 block mt-0.5 font-mono">
            {currentPartition}
          </span>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xs ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
            : statusMsg.type === 'error'
            ? 'bg-rose-50 border border-rose-200 text-rose-900'
            : 'bg-blue-50 border border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <Server className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Preset Quick Selectors */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
        <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-500" />
          <span>نماذج مكاتب سريعة جاهزة للاختيار (Presets):</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {PRESET_OFFICES.map((p) => {
            const isSelected = workspaceId === p.partitionKey;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  isSelected 
                    ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 shadow-xs' 
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {p.province}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] text-amber-600 font-black flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>محدد</span>
                      </span>
                    )}
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white mt-1.5 leading-snug">
                    {p.name}
                  </h5>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium block mt-0.5">
                    {p.deputyTitle} {p.deputyName}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono block truncate">
                  مفتاح: {p.partitionKey}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Multi-Office & Database Form */}
      <form onSubmit={handleApplySwitch} className="space-y-5">
        
        {/* SECTION 1: Deputy & Office Identity */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <User className="w-4 h-4 text-blue-600" />
            <span>1. هوية النائب والمكتب الجديد (تظهر في الواجهات والطباعة والتقارير):</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                اسم النائب *
              </label>
              <input
                type="text"
                value={deputyName}
                onChange={(e) => setDeputyName(e.target.value)}
                placeholder="مثال: علا الناشي"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                الصفة / اللقب الرسمي للنائب *
              </label>
              <input
                type="text"
                value={deputyTitle}
                onChange={(e) => setDeputyTitle(e.target.value)}
                placeholder="مثال: النائب المهندسة أو عضو مجلس النواب"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                اسم المكتب المعتمد بالكامل (Office Title) *
              </label>
              <input
                type="text"
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                placeholder="مثال: مكتب النائب المهندسة علا الناشي - المقر الرئيسي"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                المحافظة / المدينة المعتمدة *
              </label>
              <input
                type="text"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="مثال: ذي قار، بغداد، البصرة..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Google Sheets & Drive Database for the New Office */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>2. قاعدة بيانات Google Sheets ومجلد Drive الخاصة بهذا المكتب:</span>
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Google Cloud Real-time Layer</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                معرّف جدول Google Sheets (Spreadsheet ID)
              </label>
              <input
                type="text"
                value={googleSheetId}
                onChange={(e) => setGoogleSheetId(e.target.value.trim())}
                placeholder="مثال: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-left"
                dir="ltr"
              />
              <span className="text-[10px] text-slate-400 block">
                المعرف المستخرج من رابط الجدول في المتصفح بين /d/ و /edit
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                معرّف مجلد صور ومرفقات Google Drive (Folder ID)
              </label>
              <input
                type="text"
                value={googleDriveFolderId}
                onChange={(e) => setGoogleDriveFolderId(e.target.value.trim())}
                placeholder="مثال: 1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-left"
                dir="ltr"
              />
              <span className="text-[10px] text-slate-400 block">
                مجلد Drive لحفظ المستمسكات وصور المراجعين المرفوعة عبر السكنر
              </span>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                رابط Google Apps Script Web App URL (للمزامنة الفورية التلقائية بدون الحاجة لتسجيل دخول Google)
              </label>
              <input
                type="text"
                value={appsScriptUrl}
                onChange={(e) => setAppsScriptUrl(e.target.value.trim())}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 text-left"
                dir="ltr"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] text-slate-500">
              💡 يمكنك جلب السجلات السابقة من الجدول أو إرسال وحفظ بيانات المنظومة الحالية إليه مباشرة.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePullGoogleSheetsNow}
                disabled={isPullingSheets || isPushingSheets}
                className="px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <ArrowDownCircle className={`w-3.5 h-3.5 ${isPullingSheets ? 'animate-bounce' : ''}`} />
                <span>{isPullingSheets ? 'جاري جلب البيانات...' : 'جلب وقراءة بيانات الجدول (استيراد)'}</span>
              </button>

              <button
                type="button"
                onClick={handlePushGoogleSheetsNow}
                disabled={isPullingSheets || isPushingSheets}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 shadow-sm"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isPushingSheets ? 'animate-spin' : ''}`} />
                <span>{isPushingSheets ? 'جاري إرسال السجلات...' : 'إرسال ومزامنة السجلات للجدول (تصدير)'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 3: Firebase Partitioning & Security */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <Flame className="w-4 h-4 text-amber-500" />
            <span>3. مفتاح عزل قاعدة البيانات السحابية (Firebase Partition Key):</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                مفتاح عزل المكتب بالإنجليزية (Partition Key) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="office_custom_branch"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-left"
                  dir="ltr"
                  required
                />
                <button
                  type="button"
                  onClick={handleCopyPartitionKey}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-1"
                  title="نسخ المفتاح"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400 block">
                مفتاح إنجليزي فريد يعزل كافة بيانات هذا المكتب في السحابة عن أي نائب أو مكتب آخر.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                مشروع Firebase السحابي (Project ID)
              </label>
              <input
                type="text"
                value={customProjectId}
                onChange={(e) => setCustomProjectId(e.target.value.trim())}
                placeholder={firebaseConfig.projectId}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-left"
                dir="ltr"
              />
              <span className="text-[10px] text-slate-400 block">
                المشروع الافتراضي: {firebaseConfig.projectId}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <p className="text-[11px] text-slate-500">
            🔒 عند النقر على الحفظ والتطبيق، تتغير هوية المنظومة وقواعد البيانات لكافة المستخدمين والأقسام فوراً.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Zap className={`w-3.5 h-3.5 text-amber-500 ${isTesting ? 'animate-bounce' : ''}`} />
              <span>{isTesting ? 'جاري الفحص...' : 'فحص الاتصال بقواعد البيانات'}</span>
            </button>

            <button
              type="submit"
              disabled={isSwitching}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-slate-950" />
              <span>{isSwitching ? 'جاري تطبيق الإعدادات السحابية...' : 'حفظ وتطبيق إعدادات المكتب الجديد فوراً 🚀'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Developer Guidance */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs space-y-3">
        <h4 className="font-black text-slate-900 dark:text-white flex items-center gap-2 text-xs">
          <Info className="w-4 h-4 text-blue-500" />
          <span>دليل المطور لنشر المنظومة لمكتب نائب جديد بدون تعديل الكود:</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-600 dark:text-slate-300">
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-750 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">1. هوية النائب</span>
            <p>أدخل اسم النائب وصفته واسم المكتب، وسيتم تحديث شريط الأخبار، الترويسات، والباجات فوراً.</p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-750 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">2. جدول Google Sheets</span>
            <p>ضع معرّف جدول البيانات الجديد الخاص بالنائب، وسيقوم النظام بتخزين واسترجاع بياناته حصراً من هذا الجدول.</p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-750 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">3. عزل البيانات التام</span>
            <p>مفتاح العزل يضمن عدم اختلاط سجلات أو مواطني أي نائب مع نائب آخر في قاعدة البيانات السحابية.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
