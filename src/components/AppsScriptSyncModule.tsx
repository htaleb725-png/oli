import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import * as XLSX from 'xlsx';
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
    addAuditLog 
  } = useApp();

  // Sheets & Drive State
  const [selectedSheetId, setSelectedSheetId] = useState<string>(systemSettings.activeGoogleSheetId || systemSettings.googleSheetId || '');
  const [selectedSheetUrl, setSelectedSheetUrl] = useState<string>(systemSettings.activeGoogleSheetUrl || (systemSettings.googleSheetId ? `https://docs.google.com/spreadsheets/d/${systemSettings.googleSheetId}/edit` : ''));

  // Direct Link Settings State
  const [customSheetId, setCustomSheetId] = useState(systemSettings.googleSheetId || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  const [customDriveFolderId, setCustomDriveFolderId] = useState(systemSettings.googleDriveFolderId || '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc');
  const [customAppsScriptUrl, setCustomAppsScriptUrl] = useState(systemSettings.appsScriptUrl || systemSettings.googleAppsScriptUrl || '');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Apps Script Legacy / Webhook
  const [copied, setCopied] = useState(false);

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

    updateSystemSettings({
      googleSheetId: cleanSheetId,
      activeGoogleSheetId: cleanSheetId,
      activeGoogleSheetUrl: calculatedUrl,
      googleDriveFolderId: customDriveFolderId.trim(),
      appsScriptUrl: customAppsScriptUrl.trim(),
      googleAppsScriptUrl: customAppsScriptUrl.trim()
    });

    setSelectedSheetId(cleanSheetId);
    setSelectedSheetUrl(calculatedUrl);
    setSaveSuccessMsg('تم حفظ وتحديث إعدادات ربط الإكسل و Google Sheets بنجاح!');
    addAuditLog('تحديث إعدادات الربط', 'إعدادات الإكسل', `تحديث معرّف جدول الإكسل: ${cleanSheetId}`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Direct Multi-Sheet Full Excel Export
  const handleExportFullWorkbook = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Citizens
      const citizensData = citizens.map(c => ({
        'الرقم التعريفي': c.Citizen_ID,
        'الاسم الرباعي واللقب': c.FullName,
        'الهاتف 1': c.Phone1,
        'الهاتف 2': c.Phone2 || '',
        'العشيرة': c.Surname || '',
        'القضاء': c.District,
        'الناحية': c.SubDistrict,
        'المهنة': c.Job || '',
        'التحصيل': c.Education || '',
        'التقييم الجماهيري': c.Rating || '',
        'المعرّف': c.ReferralSource || '',
        'تاريخ التسجيل': c.CreatedAt,
        'الموظف المسجل': c.CreatedBy || 'الاستعلامات'
      }));
      const wsCitizens = XLSX.utils.json_to_sheet(citizensData);
      XLSX.utils.book_append_sheet(wb, wsCitizens, 'المراجعين_Citizens');

      // Sheet 2: Requests
      const requestsData = requests.map(r => ({
        'رقم المعاملة': r.Request_ID,
        'الرقم التعريفي': r.Citizen_ID,
        'اسم المواطن': r.CitizenName,
        'الهاتف': r.CitizenPhone,
        'الجهة المعنية': r.Entity,
        'المسار الإداري': r.ProcessingStatus,
        'الأولوية': r.Priority,
        'التفاصيل': r.Details,
        'توجيه النائب': r.DeputyNotes || '',
        'المرحلة الحالية': r.CurrentStage || 'مدير الإدارة',
        'تاريخ التسجيل': r.CreatedAt
      }));
      const wsRequests = XLSX.utils.json_to_sheet(requestsData);
      XLSX.utils.book_append_sheet(wb, wsRequests, 'المعاملات_Requests');

      // Sheet 3: Interviews
      const interviewsData = interviews.map(i => ({
        'رقم المقابلة': i.Interview_ID,
        'اسم المواطن': i.FullName,
        'الموضوع': i.Subject,
        'الهاتف': i.Phone1,
        'السكن': i.Address,
        'التاريخ': i.InterviewDate,
        'الوقت': i.InterviewTime || '',
        'الموقف': i.Status,
        'الأولوية': i.Priority,
        'توجيه النائب': i.DeputyNotes || ''
      }));
      const wsInterviews = XLSX.utils.json_to_sheet(interviewsData);
      XLSX.utils.book_append_sheet(wb, wsInterviews, 'المقابلات_Interviews');

      // Sheet 4: Organization
      const orgData = organizationRecords.map(o => ({
        'الرقم التعريفي': o.Citizen_ID,
        'الاسم': o.FullName,
        'القضاء': o.District,
        'الموقف التنظيمي': o.OrgRating,
        'الثقل الاجتماعي': o.InfluenceType,
        'نقاط التقييم': o.EvaluationPoints,
        'المركز الانتخابي': o.ElectionCenter || '',
        'المحطة': o.StationNumber || '',
        'ملاحظات': o.Notes || ''
      }));
      const wsOrg = XLSX.utils.json_to_sheet(orgData);
      XLSX.utils.book_append_sheet(wb, wsOrg, 'التنظيم_Organization');

      // Sheet 5: Official Letters
      const lettersData = officialLetters.map(l => ({
        'الرقم الإشاري': l.Letter_Number,
        'التاريخ': l.Letter_Date,
        'الجهة الصادر إليها': l.To_Entity,
        'الموضوع': l.Subject,
        'المراجع المعني': l.Citizen_Name,
        'معرّف المراجع': l.Citizen_ID || '',
        'رقم المعاملة': l.Request_ID || '',
        'الحالة': l.Status
      }));
      const wsLetters = XLSX.utils.json_to_sheet(lettersData);
      XLSX.utils.book_append_sheet(wb, wsLetters, 'الكتب_الرسمية_Letters');

      // Sheet 6: Audit Logs
      const auditData = auditLogs.map(a => ({
        'معرف الحركة': a.Log_ID,
        'الوقت': a.Timestamp,
        'المستخدم': a.User,
        'القسم': a.Section,
        'الإجراء': a.Action,
        'التفاصيل': a.Details
      }));
      const wsAudit = XLSX.utils.json_to_sheet(auditData);
      XLSX.utils.book_append_sheet(wb, wsAudit, 'سجل_الرقابة_Audit');

      const fileName = `منظومة_مكتب_النائب_علا_الناشي_الكاملة_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      addAuditLog('تصدير إكسل شامل متعدد الأوراق', 'إدارة البيانات', `تصدير ملف ${fileName}`);
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء تصدير ملف الإكسل.');
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

  const appsScriptCode = `/**
 * =========================================================================
 * منظومة مكتب النائب المهندسة علا عودة الناشي - الإصدار السحابي
 * Google Apps Script Back-end & Google Sheets Database Engine
 * =========================================================================
 */
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getCitizens') return jsonResponse(getSheetData('المراجعين_Citizens'));
  if (action === 'getRequests') return jsonResponse(getSheetData('المعاملات_Requests'));
  if (action === 'getInterviews') return jsonResponse(getSheetData('المقابلات_Interviews'));
  return HtmlService.createHtmlOutput('<h3>منظومة مكتب النائب علا الناشي تعمل بكفاءة على Google Apps Script!</h3>');
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'addCitizen') return jsonResponse(insertCitizen(data.payload));
    if (data.action === 'addRequest') return jsonResponse(insertRequest(data.payload));
    return jsonResponse({ status: 'error', message: 'Action not found' });
  } catch (err) {
    return jsonResponse({ status: 'error', error: err.toString() });
  }
}

function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  const results = [];
  for (let i = 1; i < values.length; i++) {
    let row = values[i];
    let obj = {};
    for (let j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
    results.push(obj);
  }
  return results;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
`;

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
                  <span>تصدير المصنف الكامل (Multi-Sheet Workbook)</span>
                </div>
                <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded">شامل 6 أقسام</span>
              </button>

              <div className="pt-2 text-xs text-slate-500 space-y-1">
                <p>الملف المصدر متوافق 100% مع كافة برامج Microsoft Excel و Google Sheets و LibreOffice.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
