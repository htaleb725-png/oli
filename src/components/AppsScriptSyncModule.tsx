import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import * as XLSX from 'xlsx';
import { APPS_SCRIPT_PRODUCTION_CODE } from '../services/appsScriptTemplate';
import { extractDriveFolderId } from '../services/driveArchiveService';
import { reorganizeGoogleSheetsNow } from '../services/realtimeGoogleSync';
import {
  DEPARTMENT_SHEETS_OVERVIEW,
  CITIZENS_SHEET_NAME,
  REQUESTS_SHEET_NAME,
  INTERVIEWS_SHEET_NAME,
  ORGANIZATION_SHEET_NAME,
  LETTERS_SHEET_NAME,
  CHEQUES_SHEET_NAME,
  SOCIAL_CARE_SHEET_NAME,
  USERS_SHEET_NAME,
  toCleanSheetCitizenPayload,
  toCleanSheetRequestPayload,
  toCleanSheetInterviewPayload,
  toCleanSheetOrganizationPayload,
  toCleanSheetLetterPayload,
  toCleanSheetChequePayload,
  toCleanSheetSocialCarePayload,
  toCleanSheetUserPayload
} from '../services/googleSheetsSchema';
import { 
  FileSpreadsheet, 
  Copy, 
  Check, 
  FileCode, 
  Database,
  ExternalLink,
  RefreshCw,
  PlusCircle,
  FolderOpen,
  AlertTriangle,
  LogOut,
  Sparkles,
  CloudCheck,
  CheckCircle2,
  XCircle,
  TableProperties,
  Upload,
  Download,
  Settings,
  Link,
  Save,
  CheckCircle,
  Layers
} from 'lucide-react';

export const AppsScriptSyncModule: React.FC = () => {
  const { 
    citizens, 
    addCitizen,
    requests, 
    addRequest,
    interviews, 
    organizationRecords, 
    officialLetters, 
    auditLogs, 
    systemSettings, 
    updateSystemSettings,
    setGoogleDriveFolderId,
    cheques,
    customRecords,
    users,
    addAuditLog 
  } = useApp();

  // Sheets & Drive State
  const [selectedSheetId, setSelectedSheetId] = useState<string>(systemSettings.activeGoogleSheetId || systemSettings.googleSheetId || '');
  const [selectedSheetUrl, setSelectedSheetUrl] = useState<string>(systemSettings.activeGoogleSheetUrl || (systemSettings.googleSheetId ? `https://docs.google.com/spreadsheets/d/${systemSettings.googleSheetId}/edit` : ''));

  // Direct Link Settings State
  const [customSheetId, setCustomSheetId] = useState(systemSettings.googleSheetId || '1wqPXKzzrMJJqfGIyAwEZC1tvWXf28JFS8lUN1YGiFVQ');
  const [customDriveFolderId, setCustomDriveFolderId] = useState(systemSettings.googleDriveFolderId || '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc');
  const [customAppsScriptUrl, setCustomAppsScriptUrl] = useState(systemSettings.appsScriptUrl || systemSettings.googleAppsScriptUrl || '');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Apps Script Legacy / Webhook
  const [copied, setCopied] = useState(false);
  const [isReorganizingSheets, setIsReorganizingSheets] = useState(false);
  const [reorganizeResult, setReorganizeResult] = useState<{ success: boolean; message: string } | null>(null);

  // Active Tab inside module
  const [activeSubTab, setActiveSubTab] = useState<'excel_link_config' | 'excel_import_export' | 'apps_script'>('excel_link_config');

  // Excel Import state
  const [importTarget, setImportTarget] = useState<'citizens' | 'requests'>('citizens');
  const [importStatus, setImportStatus] = useState<string>('');

  // Direct Sheets and Drive Sync (No direct email/token authentication required)
  useEffect(() => {
    // Keep link settings synchronized with system settings
    if (systemSettings.googleSheetId) {
      setCustomSheetId(systemSettings.googleSheetId);
      setSelectedSheetId(systemSettings.googleSheetId);
      setSelectedSheetUrl(`https://docs.google.com/spreadsheets/d/${systemSettings.googleSheetId}/edit`);
    }
    if (systemSettings.googleDriveFolderId) {
      setCustomDriveFolderId(systemSettings.googleDriveFolderId);
    }
    if (systemSettings.appsScriptUrl) {
      setCustomAppsScriptUrl(systemSettings.appsScriptUrl);
    }
  }, [systemSettings]);

  const handleSaveConnectionSettings = (e: React.FormEvent) => {
    e.preventDefault();
    let cleanSheetId = customSheetId.trim();
    // If user pasted a full URL, extract spreadsheet ID:
    if (cleanSheetId.includes('/spreadsheets/d/')) {
      const match = cleanSheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        cleanSheetId = match[1];
      }
    }

    const calculatedUrl = `https://docs.google.com/spreadsheets/d/${cleanSheetId}/edit`;
    const cleanDriveId = customDriveFolderId.trim() ? extractDriveFolderId(customDriveFolderId) : '';

    updateSystemSettings({
      googleSheetId: cleanSheetId,
      activeGoogleSheetId: cleanSheetId,
      activeGoogleSheetUrl: calculatedUrl,
      ...(cleanDriveId ? { googleDriveFolderId: cleanDriveId } : {}),
      appsScriptUrl: customAppsScriptUrl.trim(),
      googleAppsScriptUrl: customAppsScriptUrl.trim()
    });
    if (cleanDriveId) {
      setCustomDriveFolderId(cleanDriveId);
      setGoogleDriveFolderId(cleanDriveId);
    }

    setSelectedSheetId(cleanSheetId);
    setSelectedSheetUrl(calculatedUrl);
    setSaveSuccessMsg('تم حفظ وتحديث إعدادات ربط الإكسل و Google Sheets و Google Drive بنجاح!');
    addAuditLog('تحديث إعدادات الربط', 'إعدادات الإكسل', `تحديث معرّف جدول الإكسل: ${cleanSheetId}`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleReorganizeSheetsNow = async () => {
    setIsReorganizingSheets(true);
    setReorganizeResult(null);
    try {
      const res = await reorganizeGoogleSheetsNow({
        appsScriptUrl: customAppsScriptUrl || systemSettings.appsScriptUrl,
        sheetId: customSheetId || systemSettings.googleSheetId,
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
      setReorganizeResult(res);
      if (res.success) {
        addAuditLog('توحيد وتنظيم أوراق Google Sheets (8 أقسام)', 'إعدادات الإكسل', res.message);
      }
    } catch (err: any) {
      setReorganizeResult({ success: false, message: err?.message || 'تعذر إعادة ترتيب الأوراق والأعمدة حالياً.' });
    } finally {
      setIsReorganizingSheets(false);
    }
  };

  // Direct Multi-Sheet Full Excel Export (8 Single-Sheet-Per-Department Architecture)
  const handleExportFullWorkbook = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. قسم الاستعلامات والمراجعين
      const citizensData = citizens.map(c => toCleanSheetCitizenPayload(c));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(citizensData), CITIZENS_SHEET_NAME);

      // 2. قسم الإدارة والمعاملات
      const requestsData = requests.map(r => toCleanSheetRequestPayload(r));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(requestsData), REQUESTS_SHEET_NAME);

      // 3. قسم مقابلات النائب
      const interviewsData = interviews.map(i => toCleanSheetInterviewPayload(i));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(interviewsData), INTERVIEWS_SHEET_NAME);

      // 4. قسم التنظيم والجماهير
      const orgData = organizationRecords.map(o => toCleanSheetOrganizationPayload(o));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orgData), ORGANIZATION_SHEET_NAME);

      // 5. قسم المكنة والكتب الرسمية
      const lettersData = officialLetters.map(l => toCleanSheetLetterPayload(l));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lettersData), LETTERS_SHEET_NAME);

      // 6. قسم المساعدات والصكوك
      const chequesData = cheques.map(c => toCleanSheetChequePayload(c));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chequesData), CHEQUES_SHEET_NAME);

      // 7. قسم الرعاية الاجتماعية
      const socialCareRecords = (customRecords || []).filter(
        r => !r?.sectionId || r.sectionId === 'sec-social-care-2026' || String(r.sectionId).includes('social')
      );
      const socialCareData = socialCareRecords.map(s => toCleanSheetSocialCarePayload(s));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(socialCareData), SOCIAL_CARE_SHEET_NAME);

      // 8. قسم الرقابة والمستخدمين
      const usersData = (users || []).map(u => toCleanSheetUserPayload(u));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usersData), USERS_SHEET_NAME);

      const fileName = `قاعدة_بيانات_مكتب_النائب_8_أقسام_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      addAuditLog('تصدير إكسل شامل (8 أوراق رسمية للأقسام)', 'إدارة البيانات', `تصدير ملف ${fileName}`);
      setSaveSuccessMsg(`تم تصدير مصنف الإكسل الشامل (8 أوراق مرتبة لكل قسم) بنجاح: ${fileName}`);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      setImportStatus('حدث خطأ أثناء تصدير ملف الإكسل.');
    }
  };

  // Handle Excel File Upload & Import
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('جاري قراءة وتحليل ملف الإكسل...');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rawData || rawData.length === 0) {
          setImportStatus('الملف فارغ أو لا يحتوي على صفوف بيانات.');
          return;
        }

        let importedCount = 0;

        if (importTarget === 'citizens') {
          rawData.forEach((row) => {
            const fullName = row['الاسم الرباعي واللقب'] || row['الاسم'] || row['FullName'] || row['اسم المواطن'] || '';
            const phone = String(row['الهاتف 1'] || row['الهاتف'] || row['Phone1'] || row['Phone'] || '07800000000');
            const district = row['القضاء'] || row['District'] || 'الناصرية';
            const subDistrict = row['الناحية'] || row['SubDistrict'] || 'المركز';
            const job = row['المهنة'] || row['Job'] || 'كاسب';
            const education = row['التحصيل'] || row['التحصيل الدراسي'] || row['Education'] || 'إعدادية';
            const rating = row['التقييم'] || row['التقييم الجماهيري'] || row['Rating'] || 'مؤيد';
            const surname = row['العشيرة'] || row['اللقب'] || row['Surname'] || '';

            if (fullName.trim()) {
              addCitizen({
                FullName: fullName.trim(),
                Surname: surname.trim() || undefined,
                Phone1: phone,
                District: district,
                SubDistrict: subDistrict,
                Job: job,
                Education: education,
                Rating: rating,
                Gender: 'ذكر',
                ReferralSource: 'استيراد من ملف إكسل',
                CreatedBy: 'استيراد إكسل'
              });
              importedCount++;
            }
          });
          setImportStatus(`تم استيراد ${importedCount} مراجع بنجاح وإضافتهم لقاعدة البيانات!`);
          addAuditLog('استيراد إكسل', 'إدارة المراجعين', `تم استيراد ${importedCount} مراجع من ملف ${file.name}`);
        } else {
          rawData.forEach((row) => {
            const citName = row['اسم المواطن'] || row['الاسم'] || row['CitizenName'] || '';
            const entity = row['الجهة المعنية'] || row['الجهة'] || row['Entity'] || 'ديوان المحافظة';
            const details = row['تفاصيل المعاملة'] || row['التفاصيل'] || row['Details'] || 'طلب وارد عبر الإكسل';
            const priority = row['الأولوية'] || row['Priority'] || 'عادي';

            if (citName.trim()) {
              const matchedCit = citizens.find(c => c.FullName.includes(citName.trim()));
              const citId = matchedCit ? matchedCit.Citizen_ID : `ONA-${Math.floor(10000 + Math.random() * 90000)}`;

              addRequest({
                Citizen_ID: citId,
                CitizenName: citName.trim(),
                CitizenPhone: matchedCit ? matchedCit.Phone1 : '07800000000',
                Entity: entity,
                RequestStatus: 'مستلم',
                ProcessingStatus: 'قيد التدقيق',
                Priority: priority,
                Details: details,
                CreatedBy: 'استيراد إكسل'
              });
              importedCount++;
            }
          });
          setImportStatus(`تم استيراد ${importedCount} معاملة بنجاح وإضافتها للنظام!`);
          addAuditLog('استيراد إكسل', 'قسم الإدارة', `تم استيراد ${importedCount} معاملة من ملف ${file.name}`);
        }
      } catch (err: any) {
        console.error(err);
        setImportStatus(`فشل استيراد الملف: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const appsScriptCode = APPS_SCRIPT_PRODUCTION_CODE;

  return (
    <div className="space-y-4 text-right">
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">إدارة وتعديل ارتباط الإكسل و Google Sheets</h2>
              <p className="text-xs text-slate-500">
                تعديل معرفات الجداول، استيراد وتصدير ملفات Excel المباشرة، والمزامنة السحابية اللحظية مع Google Workspace.
              </p>
            </div>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0 flex-wrap gap-1">
          <button
            onClick={() => setActiveSubTab('excel_link_config')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'excel_link_config'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-emerald-600" />
            <span>تعديل الارتباط والمعرّفات</span>
          </button>

          <button
            onClick={() => setActiveSubTab('excel_import_export')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'excel_import_export'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>استيراد وتصدير Excel</span>
          </button>

          <button
            onClick={() => setActiveSubTab('apps_script')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'apps_script'
                ? 'bg-white text-sky-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-sky-600" />
            <span>Apps Script</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Edit Connection Settings */}
      {activeSubTab === 'excel_link_config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Link className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تعديل رابط ومعرف جدول Google Sheets</h3>
                  <p className="text-[11px] text-slate-500">يمكنك لصق رابط الجدول أو الـ Spreadsheet ID الخاص بك مباشرة للحفظ والربط</p>
                </div>
              </div>
              {selectedSheetUrl && (
                <a
                  href={selectedSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1"
                >
                  <span>فتح الجدول المتصل</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {saveSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveConnectionSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  معرّف أو رابط جدول Google Sheets (Spreadsheet ID or Full URL) *
                </label>
                <input
                  type="text"
                  value={customSheetId}
                  onChange={(e) => setCustomSheetId(e.target.value)}
                  placeholder="مثال: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms أو الرابط كاملاً..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono text-left outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 font-bold"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  يمكنك نسخ الرابط الكامل من شريط المتصفح ولصقه هنا وسيقوم النظام باستخراج الـ ID تلقائياً.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  معرّف مجلد الأرشيف والطباعة في Google Drive (Folder ID)
                </label>
                <input
                  type="text"
                  value={customDriveFolderId}
                  onChange={(e) => setCustomDriveFolderId(e.target.value)}
                  placeholder="1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono text-left outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  مجلد حفظ ومسح طلبات المواطنين من السكنر وطباعتها.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رابط Google Apps Script Webhook URL (اختياري)
                </label>
                <input
                  type="text"
                  value={customAppsScriptUrl}
                  onChange={(e) => setCustomAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono text-left outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-xs text-slate-500 font-medium">
                  حالة الربط: <strong className="text-emerald-700 font-bold">{customSheetId ? 'معرّف مسجل' : 'غير متصل'}</strong>
                </span>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ وتثبيت الارتباط</span>
                </button>
              </div>
            </form>
          </div>

          {/* Quick Actions & Status */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 text-right space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>إحصائيات البيانات الجاهزة للربط</span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between border-b border-emerald-100 pb-1">
                  <span>المراجعين المسجلين:</span>
                  <strong className="font-mono text-slate-900">{citizens.length}</strong>
                </div>
                <div className="flex justify-between border-b border-emerald-100 pb-1">
                  <span>المعاملات والطلبات:</span>
                  <strong className="font-mono text-slate-900">{requests.length}</strong>
                </div>
                <div className="flex justify-between border-b border-emerald-100 pb-1">
                  <span>المقابلات البرلمانية:</span>
                  <strong className="font-mono text-slate-900">{interviews.length}</strong>
                </div>
                <div className="flex justify-between border-b border-emerald-100 pb-1">
                  <span>سجلات التنظيم:</span>
                  <strong className="font-mono text-slate-900">{organizationRecords.length}</strong>
                </div>
                <div className="flex justify-between">
                  <span>الكتب الرسمية:</span>
                  <strong className="font-mono text-slate-900">{officialLetters.length}</strong>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 text-right space-y-2.5">
              <h4 className="font-bold text-xs text-slate-900">تصدير إكسل فوري كامل</h4>
              <p className="text-[11px] text-slate-500">تحميل كافة السجلات في ملف إكسل واحد مقسم لأوراق عمل متعددة.</p>
              <button
                type="button"
                onClick={handleExportFullWorkbook}
                className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>تحميل ملف الإكسل الكامل (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Excel Import / Export */}
      {activeSubTab === 'excel_import_export' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-right">
          {/* Import Card */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Upload className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">استيراد بيانات من ملف Excel خارجي</h3>
                <p className="text-[11px] text-slate-500">رفع ملف .xlsx أو .xls أو .csv لتغذية قاعدة بيانات المنظومة</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حدد نوع البيانات المراد استيرادها:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportTarget('citizens')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      importTarget === 'citizens'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    استيراد مراجعين جدد
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportTarget('requests')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      importTarget === 'requests'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    استيراد معاملات وطلبات
                  </button>
                </div>
              </div>

              <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/60 text-center space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-xs font-bold text-slate-700">اختر ملف Excel من جهازك</div>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleExcelImport}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
                />
              </div>

              {importStatus && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 font-bold">
                  {importStatus}
                </div>
              )}
            </div>
          </div>

          {/* Export Card */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Download className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">تصدير الجداول إلى Excel (.xlsx)</h3>
                <p className="text-[11px] text-slate-500">تصدير منفصل لكل قسم أو تصدير شامل بملف واحد</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={handleExportFullWorkbook}
                className="w-full p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-between cursor-pointer shadow-xs transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير المصنف الكامل (ورقة واحدة لكل قسم)</span>
                </div>
                <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded">شامل 8 أقسام</span>
              </button>

              <div className="pt-2 text-xs text-slate-500 space-y-1">
                <p>الملف المصدر متوافق 100% مع كافة برامج Microsoft Excel و Google Sheets و LibreOffice ويحتوي على 8 أوراق رسمية (ورقة واحدة لكل قسم).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Apps Script & One-Click Google Sheets 8-Department Reorganization */}
      {activeSubTab === 'apps_script' && (
        <div className="space-y-4 text-right">
          {/* One-Click Column Cleanup Banner */}
          <div className="p-5 bg-white rounded-xl border-2 border-emerald-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <TableProperties className="w-4 h-4 text-emerald-600" />
                  <span>توحيد وترتيب أوراق وأعمدة Google Sheets (ورقة واحدة لكل قسم - 8 أقسام فقط)</span>
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  يدمج هذا الإجراء كافة الأوراق القديمة والمكررة في <strong>8 أوراق رسمية فقط (ورقة واحدة مستقلة لكل قسم)</strong> بأعمدة عربية مرتبة ومرقمة، ويحذف الأوراق الزائدة دون فقدان أي سجل.
                </p>
              </div>
              <button
                type="button"
                disabled={isReorganizingSheets}
                onClick={handleReorganizeSheetsNow}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all shrink-0 disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${isReorganizingSheets ? 'animate-spin' : ''}`} />
                <span>{isReorganizingSheets ? 'جاري توحيد وترتيب الأوراق الـ 8...' : 'توحيد وترتيب أوراق Google Sheets الـ 8 الآن'}</span>
              </button>
            </div>

            {reorganizeResult && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  reorganizeResult.success
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border border-amber-200 text-amber-800'
                }`}
              >
                {reorganizeResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>{reorganizeResult.message}</span>
              </div>
            )}
          </div>

          {/* 8 Single-Sheet-Per-Department Schema Overview */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>هيكلة قاعدة البيانات المعتمدة في Google Sheets (8 أوراق - ورقة واحدة لكل قسم)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  كل قسم في المنظومة مرتبط بورقة عمل واحدة فقط تحمل اسمه الرسمي وأعمدته العربية المرتبة:
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-black">
                8 أوراق رسمية
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DEPARTMENT_SHEETS_OVERVIEW.map((dept, idx) => (
                <div key={dept.key} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-black text-slate-900">{dept.departmentTitle}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-emerald-800">
                      {dept.sheetName}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {dept.headers.map((h, hIdx) => (
                      <span
                        key={h}
                        className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-700"
                      >
                        {hIdx + 1}. {h}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Apps Script Production Code Card */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-sky-600" />
                  <span>كود Google Apps Script الموحد (إصدار 8 أوراق رسمية - ورقة واحدة لكل قسم)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  في Google Sheets: الإضافات (Extensions) ← Apps Script ← الصق الكود أدناه ← اختر الدالة <strong>reorganizeAllSheetsCleanly</strong> واضغط <strong>Run (تشغيل)</strong> لدمج الأوراق القديمة فوراً، ثم <strong>Deploy ← Manage deployments ← Edit ← New version</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(appsScriptCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 3000);
                }}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'تم نسخ الكود بنجاح ✓' : 'نسخ كود Apps Script الكامل'}</span>
              </button>
            </div>

            <pre
              dir="ltr"
              className="p-4 rounded-xl bg-slate-950 text-emerald-300 text-[11px] font-mono overflow-x-auto max-h-96 leading-relaxed border border-slate-800"
            >
              {appsScriptCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
