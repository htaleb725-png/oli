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
import { 
  initGoogleAuth, 
  googleSignIn, 
  googleSignOut, 
  listGoogleDriveSpreadsheets, 
  createOfficeGoogleSpreadsheet, 
  syncAllDataToGoogleSheets,
  DriveSpreadsheetItem
} from '../services/googleSheetsService';
import { User } from 'firebase/auth';

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

  // Auth State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Sheets & Drive State
  const [driveSheets, setDriveSheets] = useState<DriveSpreadsheetItem[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>(systemSettings.activeGoogleSheetId || systemSettings.googleSheetId || '');
  const [selectedSheetUrl, setSelectedSheetUrl] = useState<string>(systemSettings.activeGoogleSheetUrl || (systemSettings.googleSheetId ? `https://docs.google.com/spreadsheets/d/${systemSettings.googleSheetId}/edit` : ''));
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [newSheetTitle, setNewSheetTitle] = useState('قاعدة بيانات مكتب النائب علا الناشي - المركزية');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Direct Link Settings State
  const [customSheetId, setCustomSheetId] = useState(systemSettings.googleSheetId || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  const [customDriveFolderId, setCustomDriveFolderId] = useState(systemSettings.googleDriveFolderId || '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc');
  const [customAppsScriptUrl, setCustomAppsScriptUrl] = useState(systemSettings.appsScriptUrl || systemSettings.googleAppsScriptUrl || '');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const [showConfirmSyncModal, setShowConfirmSyncModal] = useState(false);

  // Apps Script Legacy / Webhook
  const [copied, setCopied] = useState(false);

  // Active Tab inside module
  const [activeSubTab, setActiveSubTab] = useState<'excel_link_config' | 'direct_sheets' | 'excel_import_export' | 'apps_script'>('excel_link_config');

  // Excel Import state
  const [importTarget, setImportTarget] = useState<'citizens' | 'requests'>('citizens');
  const [importStatus, setImportStatus] = useState<string>('');

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        fetchSpreadsheets(token);
      },
      () => {
        setGoogleUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const { user, accessToken: token, cancelled, error } = await googleSignIn();
      if (cancelled) {
        // User closed or cancelled the popup without completing - normal behavior
        setAuthError(null);
        return;
      }
      if (error || !user || !token) {
        setAuthError(error || 'تعذر تسجيل الدخول بحساب Google. يرجى التحقق من الأذونات.');
        return;
      }
      setGoogleUser(user);
      setAccessToken(token);
      await fetchSpreadsheets(token);
      addAuditLog('تسجيل دخول Google Workspace', 'تكامل البيانات', `تم ربط حساب Google (${user.email}) بنجاح`);
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('auth/popup-closed-by-user')
      ) {
        setAuthError(null);
      } else {
        console.warn('Google login notice:', err?.message || err);
        setAuthError(err.message || 'تعذر تسجيل الدخول بحساب Google. يرجى التحقق من الأذونات.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await googleSignOut();
    setGoogleUser(null);
    setAccessToken(null);
    setDriveSheets([]);
  };

  const fetchSpreadsheets = async (token: string) => {
    setIsLoadingSheets(true);
    try {
      const files = await listGoogleDriveSpreadsheets(token);
      setDriveSheets(files);
    } catch (err: any) {
      console.warn('Failed to list sheets:', err?.message || err);
    } finally {
      setIsLoadingSheets(false);
    }
  };

  const handleCreateNewSpreadsheet = async () => {
    if (!accessToken) return;
    setIsCreatingSheet(true);
    try {
      const result = await createOfficeGoogleSpreadsheet(accessToken, newSheetTitle.trim() || undefined);
      setSelectedSheetId(result.spreadsheetId);
      setSelectedSheetUrl(result.spreadsheetUrl);
      setCustomSheetId(result.spreadsheetId);
      updateSystemSettings({
        googleSheetId: result.spreadsheetId,
        activeGoogleSheetId: result.spreadsheetId,
        activeGoogleSheetUrl: result.spreadsheetUrl
      });
      setShowCreateModal(false);
      await fetchSpreadsheets(accessToken);
      
      // Auto initial sync
      await handleSyncToSheets(result.spreadsheetId);
      addAuditLog('إنشاء جدول Google Sheets', 'تكامل السحاب', `تم إنشاء الجدول المركزي ${newSheetTitle} وتهيئته`);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إنشاء الجدول');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleSelectExistingSheet = (sheetId: string) => {
    setSelectedSheetId(sheetId);
    setCustomSheetId(sheetId);
    const selected = driveSheets.find(s => s.id === sheetId);
    const url = selected?.webViewLink || `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    setSelectedSheetUrl(url);
    updateSystemSettings({
      googleSheetId: sheetId,
      activeGoogleSheetId: sheetId,
      activeGoogleSheetUrl: url
    });
  };

  // Safe sync execution with confirmation
  const handleSyncToSheets = async (targetId?: string) => {
    const sheetId = targetId || selectedSheetId || customSheetId;
    if (!sheetId || !accessToken) return;
    
    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('جاري نقل وتحديث البيانات في Google Sheets...');
    setShowConfirmSyncModal(false);

    try {
      await syncAllDataToGoogleSheets(accessToken, sheetId, {
        citizens,
        requests,
        interviews,
        organizationRecords,
        officialLetters,
        auditLogs
      });
      setSyncStatus('success');
      setSyncMessage(`تمت المزامنة بنجاح! تم تحديث ${citizens.length} مراجع، ${requests.length} معاملة، ${interviews.length} مقابلة.`);
      addAuditLog('مزامنة سحابية كاملة', 'Google Sheets', `تحديث كافة جداول Google Sheets بنجاح (${citizens.length} مراجع)`);
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setSyncMessage(err.message || 'فشلت عملية المزامنة السحابية.');
    } finally {
      setIsSyncing(false);
    }
  };

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
            onClick={() => setActiveSubTab('direct_sheets')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'direct_sheets'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>المزامنة السحابية الحية (API)</span>
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

      {/* TAB 3: Direct Live Google Sheets API */}
      {activeSubTab === 'direct_sheets' && (
        <div className="space-y-4">
          {/* Google Account Authentication Section */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {googleUser ? (
                  <div className="w-10 h-10 rounded-full border-2 border-emerald-500 overflow-hidden bg-slate-100 shrink-0">
                    {googleUser.photoURL ? (
                      <img src={googleUser.photoURL} alt={googleUser.displayName || 'Google User'} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-emerald-700">
                        {googleUser.displayName?.[0] || 'G'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900">
                      {googleUser ? `الحساب المتصل: ${googleUser.displayName || googleUser.email}` : 'ربط الحساب عبر Google Sign-In'}
                    </h3>
                    {googleUser && (
                      <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200">
                        متصل ومفعل
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {googleUser 
                      ? `البريد الإلكتروني: ${googleUser.email} (أذونات Google Drive & Sheets نشطة)` 
                      : 'سجل دخولك بحساب Google للسماح للمنظومة بمزامنة وتحديث جداول Google Sheets في حسابك.'}
                  </p>
                </div>
              </div>

              <div>
                {googleUser ? (
                  <button
                    onClick={handleGoogleLogout}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>فصل الحساب</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoggingIn}
                    className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{isLoggingIn ? 'جاري الاتصال بـ Google...' : 'تسجيل الدخول بحساب Google'}</span>
                  </button>
                )}
              </div>
            </div>

            {authError && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{authError}</span>
                </div>
                {authError.includes('unauthorized-domain') && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-white border border-amber-200">
                    <span className="text-[11px] font-bold text-slate-700">النطاق الحالي: <code className="font-mono text-amber-700 font-black">{typeof window !== 'undefined' ? window.location.hostname : 'localhost'}</code></span>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(window.location.hostname);
                          setCopiedDomain(true);
                          setTimeout(() => setCopiedDomain(false), 3000);
                        }
                      }}
                      className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      {copiedDomain ? <Check className="w-3 h-3 text-emerald-950" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedDomain ? 'تم النسخ!' : 'نسخ النطاق'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Spreadsheet & Management */}
          {googleUser ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Main Sync Controls */}
              <div className="lg:col-span-2 space-y-4">
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TableProperties className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-bold text-slate-900">جدول Google Sheets النشط للربط</h3>
                    </div>
                    {selectedSheetUrl && (
                      <a
                        href={selectedSheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <span>فتح الجدول في Google Sheets</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {selectedSheetId ? (
                    <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>الجدول متصل وجاهز للمزامنة الفورية</span>
                        </div>
                        <div className="text-[11px] font-mono text-emerald-700 break-all" dir="ltr">
                          ID: {selectedSheetId}
                        </div>
                      </div>

                      <button
                        onClick={() => setShowConfirmSyncModal(true)}
                        disabled={isSyncing}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'جاري المزامنة...' : 'مزامنة وتحديث البيانات الآن'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-center space-y-2">
                      <p className="text-xs text-amber-800 font-bold">لم تقم بتحديد جدول Google Sheets حتى الآن</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                      >
                        + إنشاء جدول جديد في Drive
                      </button>
                    </div>
                  )}

                  {syncStatus !== 'idle' && (
                    <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                      syncStatus === 'success' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                      {syncStatus === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span>{syncMessage}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Spreadsheets List from Google Drive */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-900">جداولك في Google Drive</h3>
                  </div>
                  <button
                    onClick={() => accessToken && fetchSpreadsheets(accessToken)}
                    disabled={isLoadingSheets}
                    className="text-slate-400 hover:text-slate-600 p-1"
                    title="تحديث القائمة"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSheets ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <button
                  onClick={() => setShowCreateModal(true)}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>إنشاء جدول مركزي جديد</span>
                </button>

                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {isLoadingSheets ? (
                    <div className="text-center py-6 text-xs text-slate-400">جاري تحميل الجداول من Drive...</div>
                  ) : driveSheets.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">لا توجد جداول في الحساب.</div>
                  ) : (
                    driveSheets.map((file) => {
                      const isSelected = file.id === selectedSheetId;
                      return (
                        <button
                          key={file.id}
                          onClick={() => handleSelectExistingSheet(file.id)}
                          className={`w-full p-2.5 rounded-lg border text-right transition-all cursor-pointer text-xs ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300 font-bold text-emerald-950'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <div className="truncate font-semibold">{file.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">{file.id.slice(0, 16)}...</div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
              <Database className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">سجل الدخول للمزامنة الحية مع جداول Google Sheets</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                يتيح لك التكامل المباشر تحديث سجلات المواطنين والمعاملات لحظة بلحظة على جداول Google Sheets في حسابك الشخصي.
              </p>
              <button
                onClick={handleGoogleLogin}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg cursor-pointer"
              >
                تسجيل الدخول وربط الحساب
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Google Apps Script Webhook */}
      {activeSubTab === 'apps_script' && (
        <div className="space-y-4 text-right">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
            <h3 className="text-xs font-bold text-slate-900">كود Google Apps Script للنشر السحابي المستقل</h3>
            <p className="text-xs text-slate-500">
              يمكنك نسخ الكود التالي ولصقه في محرر Apps Script التابع لجدول Google Sheets لديك لنشره كـ Web App.
            </p>
          </div>

          <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">Code.gs</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(appsScriptCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-md flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ!' : 'نسخ الكود'}</span>
              </button>
            </div>

            <pre className="p-4 text-xs text-sky-300 font-mono overflow-x-auto max-h-[400px] leading-relaxed text-left" dir="ltr">
              {appsScriptCode}
            </pre>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmSyncModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">تأكيد المزامنة والتحديث في Google Sheets</h3>
                <p className="text-xs text-slate-500">يرجى تأكيد رغبتك في تحديث بيانات جدول Google Sheets.</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="font-bold text-slate-700">سيتم تحديث الأوراق الآتية:</div>
              <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                <li>سجل المراجعين ({citizens.length} سجل)</li>
                <li>طلبات الإدارة والمعاملات ({requests.length} معاملة)</li>
                <li>مقابلات النائب ({interviews.length} مقابلة)</li>
                <li>الموقف الجماهيري والتنظيمي ({organizationRecords.length} سجل)</li>
                <li>المكاتبات والكتب الرسمية ({officialLetters.length} كتاب)</li>
                <li>سجل الرقابة والحوكمة ({auditLogs.length} حركة)</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmSyncModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleSyncToSheets()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs transition-colors"
              >
                تأكيد المزامنة والتحديث
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Creating New Spreadsheet */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 border border-slate-200 shadow-xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">إنشاء جدول مركزي جديد في Google Drive</h3>
                <p className="text-xs text-slate-500">سيتم إنشاء جدول Google Sheets جديد مقسم ومبوب بالكامل.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">عنوان جدول Google Sheets:</label>
              <input
                type="text"
                value={newSheetTitle}
                onChange={(e) => setNewSheetTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                placeholder="اسم الملف في Google Drive"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateNewSpreadsheet}
                disabled={isCreatingSheet}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs transition-colors disabled:opacity-50"
              >
                {isCreatingSheet ? 'جاري الإنشاء والتهيئة...' : 'إنشاء وتهيئة الجدول'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
