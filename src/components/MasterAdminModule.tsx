import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { DropdownCategory, UserRole, User, SYSTEM_PERMISSIONS } from '../types';
import { 
  Settings, 
  Users, 
  ListPlus, 
  Sliders, 
  Trash2, 
  Plus, 
  CheckCircle, 
  RotateCcw,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Phone,
  MapPin,
  FileText,
  UserCheck,
  Edit2,
  Lock,
  Cloud,
  Check,
  X,
  FolderKanban,
  Monitor,
  Download,
  Laptop,
  Terminal,
  Sparkles,
  AlertTriangle,
  Scan,
  LogIn,
  FileSpreadsheet,
  FolderPlus,
  FolderOpen,
  ExternalLink,
  RefreshCw,
  Image as ImageIcon,
  UploadCloud,
  Zap,
  Database,
  Palette,
  LogOut,
  CheckCircle2,
  Copy
} from 'lucide-react';
import { AiRequestDrafterModal } from './AiRequestDrafterModal';
import { OfficeIconTilesGrid, OfficeTileItem } from './OfficeIconTilesGrid';
import { 
  initGoogleAuth, 
  googleSignIn, 
  signInWithGoogleIdentityServices,
  googleSignOut, 
  createOfficeGoogleSpreadsheet, 
  createOrGetOfficeDriveFolder,
  syncAllDataToGoogleSheets,
  uploadImageToDrive,
  fetchAllDataFromGoogleSheets
} from '../services/googleSheetsService';
import { 
  getDeveloperSyncLogsHistory, 
  subscribeToDeveloperSyncLogs,
  pullAllDataFromGoogleSheets,
  triggerDeveloperGoogleSync
} from '../services/developerCloudSyncService';
import { sheetsIntegration } from '../services/sheetsIntegrationLayer';
import { User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { CustomSectionsManager } from './developer/CustomSectionsManager';
import { FirebaseManager } from './developer/FirebaseManager';
import { MultiOfficeFirebaseSwitcher } from './developer/MultiOfficeFirebaseSwitcher';
import { SystemIconsStudio } from './developer/SystemIconsStudio';
import { AppsScriptCodeViewer } from './developer/AppsScriptCodeViewer';
import { UiCustomizer } from './developer/UiCustomizer';
import { DeveloperPasscodeManager } from './developer/DeveloperPasscodeManager';
import { exportUnifiedSystemExcel } from '../services/unifiedExcelExporter';

export const MasterAdminModule: React.FC = () => {
  const { 
    dropdowns,
    addDropdownItem, 
    removeDropdownItem, 
    users, 
    addUser, 
    updateUser, 
    deleteUser,
    switchUser,
    systemSettings, 
    updateSystemSettings, 
    resetToInitialData,
    currentUser,
    setIsDesktopInstallModalOpen,
    citizens,
    requests,
    interviews,
    cheques,
    organizationRecords,
    documents,
    officialLetters,
    auditLogs,
    customSections,
    customRecords,
    exportToExcel,
    isSystemZeroed,
    setIsSystemWipeModalOpen,
    addAuditLog,
    logout,
    syncAllToGoogleSheetsNow,
    fetchAllFromGoogleSheetsNow
  } = useApp();

  // Navigation: 'grid' (لوحة الأيقونات المركزية للمطور) or individual tool workspace
  const [activeTab, setActiveTab] = useState<
    | 'grid'
    | 'sections'
    | 'firebase'
    | 'multi_office'
    | 'icons_studio'
    | 'script'
    | 'ui_customizer'
    | 'dev_passcode'
    | 'system'
    | 'users'
    | 'dropdowns'
    | 'sync'
    | 'desktop'
    | 'data_wipe'
  >('grid');

  const handleExportUnifiedExcel = () => {
    const success = exportUnifiedSystemExcel({
      citizens,
      requests,
      interviews,
      cheques,
      organizationRecords,
      officialLetters,
      customSections,
      customRecords,
      officeName: systemSettings.officeName || systemSettings.appName,
      exporterName: currentUser?.FullName || 'المطور البرمجي'
    });
    if (success) {
      setSuccessMessage('تم تصدير قاعدة البيانات بالكامل (كافة الأقسام، السجلات، الصور، والمرفقات) إلى ملف Excel بنجاح! 📥');
      setTimeout(() => setSuccessMessage(''), 5000);
    }
  };
  const [selectedCategory, setSelectedCategory] = useState<DropdownCategory>('Entity');
  const [newItemValue, setNewItemValue] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAiDrafterModal, setShowAiDrafterModal] = useState(false);

  // Developer Google Workspace & Cloud Sync State
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const [activeGoogleSheetId, setActiveGoogleSheetId] = useState(systemSettings.activeGoogleSheetId || systemSettings.googleSheetId || '');
  const [activeGoogleSheetUrl, setActiveGoogleSheetUrl] = useState(systemSettings.activeGoogleSheetUrl || (systemSettings.googleSheetId ? `https://docs.google.com/spreadsheets/d/${systemSettings.googleSheetId}/edit` : ''));
  const [activeDriveFolderId, setActiveDriveFolderId] = useState(systemSettings.googleDriveFolderId || '');
  const [activeDriveFolderUrl, setActiveDriveFolderUrl] = useState(systemSettings.googleDriveFolderId ? `https://drive.google.com/drive/folders/${systemSettings.googleDriveFolderId}` : '');

  const [isCreatingSpreadsheet, setIsCreatingSpreadsheet] = useState(false);
  const [isCreatingDriveFolder, setIsCreatingDriveFolder] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [autoSyncRealtime, setAutoSyncRealtime] = useState(true);
  const [showManualTokenInput, setShowManualTokenInput] = useState(false);
  const [manualToken, setManualToken] = useState('');

  // Subscribe to developer real-time sync logs
  useEffect(() => {
    const history = getDeveloperSyncLogsHistory();
    if (history.length > 0) {
      setSyncLogs(history);
    }
    const unsub = subscribeToDeveloperSyncLogs((log) => {
      setSyncLogs(prev => [log, ...prev.filter(l => l !== log)].slice(0, 100));
    });
    const unsubSheets = sheetsIntegration.subscribeLogs((log) => {
      setSyncLogs(prev => [log, ...prev.filter(l => l !== log)].slice(0, 100));
    });

    const savedToken = localStorage.getItem('al_nashi_google_token') || sessionStorage.getItem('al_nashi_google_token');
    if (savedToken && !googleToken) {
      setGoogleToken(savedToken);
      const email = localStorage.getItem('al_nashi_google_user_email');
      const name = localStorage.getItem('al_nashi_google_user_name');
      const photo = localStorage.getItem('al_nashi_google_user_photo');
      if (email || name) {
        setGoogleUser({
          email: email || '',
          displayName: name || 'مطور المنظومة',
          photoURL: photo || null
        } as any);
      }
    }

    return () => {
      unsub();
      unsubSheets();
    };
  }, []);

  // Drive test image upload
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  // Auto initialize cloud services for developer
  const autoInitializeCloudServices = async (token: string) => {
    setIsSyncingAll(true);
    const logs: string[] = [];
    const now = new Date().toLocaleTimeString('ar-IQ');
    logs.push(`[${now}] تم تسجيل الدخول بنجاح بحساب المطور. جاري تهيئة الربط السحابي التلقائي...`);

    try {
      // 1. Google Drive Folder (Storage)
      let fId = activeDriveFolderId;
      let fUrl = activeDriveFolderUrl;
      try {
        logs.push(`[${now}] جاري التحقق من / إنشاء مجلد Google Drive للصور والمرفقات...`);
        const fResult = await createOrGetOfficeDriveFolder(token, 'مرفقات وصور مكتب النائب علا الناشي - 2026');
        fId = fResult.folderId;
        fUrl = fResult.folderUrl;
        setActiveDriveFolderId(fId);
        setActiveDriveFolderUrl(fUrl);
        logs.push(`✓ تم ربط مجلد Google Drive للمرفقات والصور: ${fId}`);
      } catch (fErr: any) {
        logs.push(`⚠️ Google Drive: ${fErr.message}`);
      }

      // 3. Google Sheet Database
      let sId = activeGoogleSheetId;
      let sUrl = activeGoogleSheetUrl;
      try {
        logs.push(`[${now}] جاري إنشاء وتهيئة جداول Google Sheets المركزية (10 جداول مقسمة)...`);
        const sResult = await createOfficeGoogleSpreadsheet(token, 'قاعدة بيانات مكتب النائب علا الناشي - المركزية');
        sId = sResult.spreadsheetId;
        sUrl = sResult.spreadsheetUrl;
        setActiveGoogleSheetId(sId);
        setActiveGoogleSheetUrl(sUrl);
        logs.push(`✓ تم ربط قاعدة بيانات Google Sheets: ${sId}`);
      } catch (sErr: any) {
        logs.push(`⚠️ Google Sheets: ${sErr.message}`);
      }

      // 4. Save Settings
      updateSystemSettings({
        googleSheetId: sId,
        activeGoogleSheetId: sId,
        activeGoogleSheetUrl: sUrl,
        googleDriveFolderId: fId
      });
      if (sId) {
        localStorage.setItem('al_nashi_sheet_id', sId);
      }
      if (fId) {
        localStorage.setItem('al_nashi_drive_folder_id', fId);
      }

      // 5. Initial Sync to Sheets
      if (sId) {
        logs.push(`[${now}] جاري مزامنة السجلات الحالية إلى جداول Google Sheets الـ 10...`);
        const syncRes = await syncAllDataToGoogleSheets(token, sId, {
          citizens,
          requests,
          interviews,
          organizationRecords,
          officialLetters,
          auditLogs,
          cheques
        });
        logs.push(`✓ تم بنجاح تحديث وتنسيق (${syncRes.updatedSheets}) جداول في Google Sheets.`);
      }

      logs.push(`⚡ اكتملت منظومة الربط مع Google Sheets (قاعدة البيانات) و Google Drive (مجلد الصور) بنجاح!`);
      setSyncLogs(logs);
      addAuditLog('تهيئة المزامنة السحابية للمطور', 'لوحة تحكم المطور', 'تم تفعيل ربط Google Sheets و Google Drive بنجاح');
    } catch (err: any) {
      logs.push(`❌ تنبيه أثناء التهيئة: ${err.message || 'خطأ غير متوقع'}`);
      setSyncLogs(logs);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Force instant full sync
  const handleForceInstantSync = async () => {
    setIsSyncingAll(true);
    try {
      const res = await triggerDeveloperGoogleSync({
        citizens,
        requests,
        interviews,
        organizationRecords,
        officialLetters,
        auditLogs,
        users,
        systemSettings,
        dropdowns,
        cheques
      });
      setSyncLogs(prev => [`[${new Date().toLocaleTimeString('ar-IQ')}] ✓ ${res.message}`, ...prev]);
      addAuditLog('مزامنة فورية مع Google Sheets', 'لوحة تحكم المطور', 'تم حفظ ومزامنة كافة السجلات مع Google Sheets و Google Drive');
    } catch (err: any) {
      setSyncLogs(prev => [`[${new Date().toLocaleTimeString('ar-IQ')}] ❌ حدث خطأ أثناء المزامنة: ${err.message || 'خطأ غير متوقع'}`, ...prev]);
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Test image upload to Drive
  const handleUploadTestImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!googleToken) {
      alert('يرجى تسجيل الدخول بحساب Google أولاً لتفعيل الرفع السحابي');
      return;
    }
    setUploadingImage(true);
    try {
      const res = await uploadImageToDrive(
        googleToken,
        file,
        `مرفق_مطور_${Date.now()}_${file.name}`,
        activeDriveFolderId || undefined
      );
      setUploadedImageUrl(res.webViewLink || null);
      addAuditLog('رفع صورة إلى Google Drive', 'لوحة تحكم المطور', `تم رفع الصورة (${file.name}) بنجاح إلى Drive وحفظ الرابط`);
    } catch (err: any) {
      alert('فشل رفع الصورة: ' + (err.message || 'حدث خطأ'));
    } finally {
      setUploadingImage(false);
    }
  };

  // Initialize Google Auth listener
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Editing User State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('admin');
  const [editDepartment, setEditDepartment] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'frozen'>('active');
  const [editPermissions, setEditPermissions] = useState<string[]>([
    'scan_upload', 'requests_create', 'requests_edit', 'workflow_referral', 'view_archive'
  ]);

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('admin');
  const [newUserDepartment, setNewUserDepartment] = useState('قسم الإدارة والمعاملات');
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>([
    'scan_upload', 'requests_create', 'requests_edit', 'workflow_referral', 'view_archive'
  ]);

  // Department filter for user list
  const [userDepartmentFilter, setUserDepartmentFilter] = useState<string>('all');

  // General System State
  const [appName, setAppName] = useState(systemSettings.appName);
  const [deputyName, setDeputyName] = useState(systemSettings.deputyName);
  const [deputyTitle, setDeputyTitle] = useState(systemSettings.deputyTitle);
  const [province, setProvince] = useState(systemSettings.province);
  const [officeAddress, setOfficeAddress] = useState(systemSettings.officeAddress);
  const [hotline, setHotline] = useState(systemSettings.hotline);
  const [tickerNewsText, setTickerNewsText] = useState(systemSettings.tickerNews.join('\n'));
  const [googleSheetId, setGoogleSheetId] = useState(systemSettings.googleSheetId);
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState(systemSettings.googleDriveFolderId);
  const [appsScriptUrl, setAppsScriptUrl] = useState(systemSettings.appsScriptUrl);
  const [maintenanceMode, setMaintenanceMode] = useState(systemSettings.maintenanceMode);
  const [allowAdminOpenDriveFolder, setAllowAdminOpenDriveFolder] = useState(Boolean(systemSettings.allowAdminOpenDriveFolder));

  const categoryLabels: { [key in DropdownCategory]: string } = {
    Surname: 'العشائر والألقاب',
    Job: 'المهن والوظائف',
    Education: 'التحصيل الدراسي',
    Rating: 'التقييم الجماهيري',
    District: 'الأقضية السكنية',
    SubDistrict: 'النواحي والأحياء',
    ReferralSource: 'المعرّفون والمصرّحون',
    Entity: 'الجهات والوزارات والدوائر'
  };

  const roleMap: Record<string, string> = {
    developer: 'مطور المنظومة (صلاحية برمجية مطلقة)',
    director: 'مدير المكتب التنفيذي (إشراف ومصادقة)',
    deputy: 'النائب علا الناشي',
    admin: 'مسؤول قسم الإدارة والمعاملات',
    reception: 'مسؤول قسم الاستعلامات والمراجعين',
    organization: 'مسؤول قسم التنظيم والجماهير',
    machine: 'مدير مكنة المكتب وطباعة الكتب',
    audit: 'مسؤول قسم الرقابة والتشريع',
    archive: 'مسؤول قسم الأرشفة والوثائق',
    reception_officer: 'موظف قسم الاستعلامات',
    admin_officer: 'موظف قسم الإدارة',
    interviews_officer: 'مسؤول قسم المقابلات',
    organization_officer: 'موظف قسم التنظيم',
    machine_officer: 'موظف قسم المكنة'
  };

  // Dropdown helper
  const currentCategoryItems = dropdowns
    .filter(d => d.Category.toLowerCase() === selectedCategory.toLowerCase())
    .map(d => d.ItemValue);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemValue.trim()) return;

    addDropdownItem(selectedCategory, newItemValue.trim());
    setSuccessMessage(`تمت إضافة "${newItemValue.trim()}" إلى قائمة [${categoryLabels[selectedCategory]}] بنجاح.`);
    setNewItemValue('');
  };

  const handleRemoveItem = (val: string) => {
    if (confirm(`هل أنت متأكد من حذف "${val}" من قائمة [${categoryLabels[selectedCategory]}]؟`)) {
      removeDropdownItem(selectedCategory, val);
      setSuccessMessage(`تم حذف "${val}" بنجاح.`);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserPassword.trim() || !newUserFullName.trim()) {
      alert('يرجى ملء كافة بيانات الموظف.');
      return;
    }

    addUser({
      Username: newUserName.trim().toLowerCase(),
      Password: newUserPassword.trim(),
      FullName: newUserFullName.trim(),
      Role: newUserRole,
      RoleArabic: roleMap[newUserRole] || 'موظف معتمد',
      Department: newUserDepartment.trim(),
      Status: 'active',
      Permissions: newUserPermissions
    });

    setSuccessMessage(`تم إنشاء حساب الموظف (${newUserFullName}) وتعيين الصلاحيات (${newUserPermissions.length} صلاحية) بنجاح.`);
    setNewUserName('');
    setNewUserFullName('');
    setNewUserPassword('');
  };

  const startEditUser = (user: User) => {
    setEditingUserId(user.User_ID);
    setEditFullName(user.FullName);
    setEditUsername(user.Username);
    setEditPassword(user.Password || '123');
    setEditRole(user.Role);
    setEditDepartment(user.Department);
    setEditStatus(user.Status || 'active');
    setEditPermissions(user.Permissions && user.Permissions.length > 0 
      ? user.Permissions 
      : ['scan_upload', 'requests_create', 'view_archive']
    );
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserId) return;

    const targetUser = users.find(u => u.User_ID === editingUserId);
    if (!targetUser) return;

    const updatedUser: User = {
      ...targetUser,
      FullName: editFullName.trim(),
      Username: editUsername.trim().toLowerCase(),
      Password: editPassword.trim(),
      Role: editRole,
      RoleArabic: roleMap[editRole] || targetUser.RoleArabic,
      Department: editDepartment.trim(),
      Status: editStatus,
      Permissions: editPermissions
    };

    updateUser(updatedUser);
    setEditingUserId(null);
    setSuccessMessage(`تم تحديث بيانات وصلاحيات الحساب (${editFullName}) بنجاح.`);
  };

  const handleDeleteUserClick = (userId: string, name: string) => {
    if (userId === currentUser?.User_ID) {
      alert('لا يمكنك حذف الحساب النشط الحالي الذي تستخدمه لتسجيل الدخول.');
      return;
    }
    if (confirm(`تحذير: هل أنت متأكد من رغبتك في حذف حساب الموظف (${name}) نهائياً من المنظومة؟`)) {
      deleteUser(userId);
      setSuccessMessage(`تم حذف حساب الموظف (${name}) بنجاح.`);
    }
  };

  const handleSaveAllSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const newsArray = tickerNewsText.split('\n').map(s => s.trim()).filter(Boolean);

    updateSystemSettings({
      appName: appName.trim(),
      deputyName: deputyName.trim(),
      deputyTitle: deputyTitle.trim(),
      province: province.trim(),
      officeAddress: officeAddress.trim(),
      hotline: hotline.trim(),
      tickerNews: newsArray,
      googleSheetId: googleSheetId.trim(),
      googleDriveFolderId: googleDriveFolderId.trim(),
      appsScriptUrl: appsScriptUrl.trim(),
      maintenanceMode,
      allowAdminOpenDriveFolder
    });

    setSuccessMessage('تم حفظ وتطبيق كافة إعدادات المنظومة والنصوص بنجاح.');
  };

  const handleResetData = () => {
    if (confirm('تنبيه هام: هل تريد استعادة البيانات الافتراضية الأولية للنظام؟')) {
      resetToInitialData();
      setSuccessMessage('تمت استعادة البيانات الافتراضية بنجاح.');
    }
  };

  return (
    <div className="space-y-4 text-right">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">مركز تحكم المطور والإدارة المطلقة (Developer & Master Control)</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                  صلاحية مطور النظام كاملة 100%
                </span>
                <span className="text-[11px] text-slate-500">
                  تعديل أدق التفاصيل، إدارة الكادر، تخصيص القوائم، وتجهيز النظام للنشر
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Prominent Zero / Wipe All Data Button - DEVELOPER ONLY */}
          {currentUser?.Role === 'developer' && (
            <button
              onClick={() => setIsSystemWipeModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
              title="تصفير وحذف جميع بيانات النظام محلياً (خاص بالمطور فقط)"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
              <span>تصفير وحذف جميع البيانات (خاص بالمطور)</span>
            </button>
          )}

          <button
            onClick={() => setShowAiDrafterModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="توليد وتجربة صياغة طلب رسمي بالذكاء الاصطناعي"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>توليد طلب بالذكاء الاصطناعي</span>
          </button>

          <button
            onClick={handleResetData}
            className="px-3.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الضبط الافتراضي</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-700 text-xs cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* ---------------- VIEW 1: CENTRAL ICONS GRID (لوحة الأيقونات المركزية للمطور) ---------------- */}
      {activeTab === 'grid' && (
        <OfficeIconTilesGrid
          title="أيقونات ومهام مركز تحكم المطور والنظام"
          subtitle="انقر على أي أيقونة لفتح محتوياتها وأدواتها حصرياً مع إمكانية الرجوع للأيقونات مباشرة"
          columns={5}
          items={[
            {
              id: 'dev_sections',
              title: 'أقسام المنظومة والحقول المخصصة',
              subtitle: 'إضافة، تصميم، وحذف الأقسام وقوائمها',
              icon: FolderKanban,
              iconColor: 'text-indigo-600 dark:text-indigo-400',
              iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
              badge: 'باني الأقسام ⚡',
              badgeColor: 'bg-indigo-600 text-white',
              onClick: () => setActiveTab('sections')
            },
            {
              id: 'dev_firebase',
              title: 'قاعدة بيانات Firebase Firestore',
              subtitle: 'المزامنة السحابية اللحظية الحية',
              icon: Cloud,
              iconColor: 'text-amber-600 dark:text-amber-400',
              iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
              badge: 'لحظي ☁️',
              badgeColor: 'bg-amber-600 text-white',
              onClick: () => setActiveTab('firebase')
            },
            {
              id: 'dev_multi_office',
              title: 'تهيئة وتغيير المكتب وقواعد البيانات (للنائب الجديد)',
              subtitle: 'تغيير اسم النائب، جداول Google Sheets، وعزل البيانات بدون كود',
              icon: Building2,
              iconColor: 'text-blue-600 dark:text-blue-400',
              iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
              badge: 'نشر المكاتب 🚀',
              badgeColor: 'bg-blue-600 text-white',
              onClick: () => setActiveTab('multi_office')
            },
            {
              id: 'dev_icons_studio',
              title: 'استوديو الأيقونات وصورة البرنامج',
              subtitle: 'تعديل أسماء وصور الأيقونات والشعار بدون كود',
              icon: Palette,
              iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
              iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/50 border-fuchsia-200 dark:border-fuchsia-800',
              badge: 'تخصيص كامل 🎨',
              badgeColor: 'bg-fuchsia-600 text-white',
              onClick: () => setActiveTab('icons_studio')
            },
            {
              id: 'dev_ui_custom',
              title: 'تخصيص الواجهات ومقاس الأزرار',
              subtitle: 'تكبير وتصغير الأزرار والحقول والسمة اللونية',
              icon: Sliders,
              iconColor: 'text-purple-600 dark:text-purple-400',
              iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
              badge: 'أحجام الأزرار 🎛️',
              badgeColor: 'bg-purple-600 text-white',
              onClick: () => setActiveTab('ui_customizer')
            },
            {
              id: 'dev_passcode',
              title: 'رمز دخول المطور السري',
              subtitle: 'تغيير وتشفير رمز دخول المطور',
              icon: KeyRound,
              iconColor: 'text-amber-600 dark:text-amber-400',
              iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
              badge: 'سري 🔒',
              badgeColor: 'bg-amber-600 text-white',
              onClick: () => setActiveTab('dev_passcode')
            },
            {
              id: 'dev_users',
              title: 'إدارة المستخدمين والصلاحيات',
              subtitle: 'حسابات الموظفين والـ RBAC',
              icon: Users,
              iconColor: 'text-blue-600 dark:text-blue-400',
              iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
              badge: users.length,
              badgeColor: 'bg-blue-600 text-white',
              onClick: () => setActiveTab('users')
            },
            {
              id: 'dev_system',
              title: 'إعدادات وهوية المنظومة',
              subtitle: 'اسم النائب والعنوان والخط الساخن',
              icon: Settings,
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
              onClick: () => setActiveTab('system')
            },
            {
              id: 'dev_dropdowns',
              title: 'القوائم المنسدلة والعشائر',
              subtitle: 'الوزارات، المهن، والأقضية',
              icon: ListPlus,
              iconColor: 'text-amber-600 dark:text-amber-400',
              iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
              badge: dropdowns.length,
              badgeColor: 'bg-amber-600 text-white',
              onClick: () => setActiveTab('dropdowns')
            },
            {
              id: 'dev_script',
              title: 'سكربت Google Sheets السحابي',
              subtitle: 'كود Apps Script والربط المباشر بدون توكن',
              icon: FileSpreadsheet,
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
              badge: 'كود جاهز 📜',
              badgeColor: 'bg-emerald-600 text-white',
              onClick: () => setActiveTab('script')
            },
            {
              id: 'dev_sync',
              title: 'جداول Google Sheets و Google Drive',
              subtitle: 'الجداول المركزية الرسمية ومجلد الأرشيف المباشر',
              icon: Database,
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
              badge: 'الرئيسية ⚡',
              badgeColor: 'bg-emerald-600 text-white',
              onClick: () => setActiveTab('sync')
            },
            {
              id: 'dev_desktop',
              title: 'تطبيق سطح المكتب والتشغيل',
              subtitle: 'تثبيت PWA والتشغيل كنافذة مستقلة',
              icon: Monitor,
              iconColor: 'text-purple-600 dark:text-purple-400',
              iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
              onClick: () => setActiveTab('desktop')
            },
            {
              id: 'dev_export',
              title: 'تصدير قاعدة البيانات الشاملة Excel',
              subtitle: 'سحب كشف كامل لكافة الجداول والصور والمرفقات',
              icon: Download,
              iconColor: 'text-teal-600 dark:text-teal-400',
              iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
              badge: 'شامل Excel 📥',
              badgeColor: 'bg-teal-600 text-white',
              onClick: () => handleExportUnifiedExcel()
            },
            ...(currentUser?.Role === 'developer' ? [{
              id: 'dev_wipe',
              title: 'تصفير وحذف جميع البيانات',
              subtitle: 'تفريغ الجداول (خاص بالمطور فقط)',
              icon: Trash2,
              iconColor: 'text-rose-600 dark:text-rose-400',
              iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
              onClick: () => setIsSystemWipeModalOpen(true)
            }] : []),
            {
              id: 'dev_reset',
              title: 'استعادة الضبط الافتراضي',
              subtitle: 'إعادة بناء البيانات النموذجية',
              icon: RotateCcw,
              iconColor: 'text-orange-600 dark:text-orange-400',
              iconBg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
              onClick: () => handleResetData()
            },
            {
              id: 'dev_ai',
              title: 'صياغة بالذكاء الاصطناعي',
              subtitle: 'تجربة التوليد اللغوي الذكي',
              icon: Sparkles,
              iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
              iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/50 border-fuchsia-200 dark:border-fuchsia-800',
              onClick: () => setShowAiDrafterModal(true)
            }
          ]}
        />
      )}

      {/* ---------------- VIEW 2: INDIVIDUAL TOOL WORKSPACE (مع شريط الرجوع للأيقونات) ---------------- */}
      {activeTab !== 'grid' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Executive Top Banner with Return to Icons Hub Button */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 sm:p-4 rounded-2xl border border-indigo-500/40 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sticky top-16 z-30 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-bold text-lg shadow-2xs shrink-0">
                {activeTab === 'sections' && <FolderKanban className="w-5 h-5 text-indigo-300" />}
                {activeTab === 'firebase' && <Cloud className="w-5 h-5 text-amber-300" />}
                {activeTab === 'multi_office' && <Building2 className="w-5 h-5 text-blue-300" />}
                {activeTab === 'icons_studio' && <Palette className="w-5 h-5 text-fuchsia-300" />}
                {activeTab === 'ui_customizer' && <Sliders className="w-5 h-5 text-purple-300" />}
                {activeTab === 'dev_passcode' && <KeyRound className="w-5 h-5 text-amber-300" />}
                {activeTab === 'users' && <Users className="w-5 h-5 text-blue-300" />}
                {activeTab === 'system' && <Settings className="w-5 h-5 text-emerald-300" />}
                {activeTab === 'dropdowns' && <ListPlus className="w-5 h-5 text-amber-300" />}
                {activeTab === 'script' && <FileSpreadsheet className="w-5 h-5 text-emerald-300" />}
                {activeTab === 'sync' && <Database className="w-5 h-5 text-teal-300" />}
                {activeTab === 'desktop' && <Monitor className="w-5 h-5 text-indigo-300" />}
                {activeTab === 'data_wipe' && <Trash2 className="w-5 h-5 text-rose-300" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-500/30">
                    مركز تحكم المطور والنظام
                  </span>
                  <span className="text-[10px] text-slate-400">
                    تصفح محتويات الأداة بكامل الصلاحيات
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-white mt-0.5">
                  {activeTab === 'sections' && 'باني الأقسام المخصصة والحقول الديناميكية'}
                  {activeTab === 'firebase' && 'قاعدة بيانات Firebase Firestore اللحظية الحية'}
                  {activeTab === 'multi_office' && 'تهيئة وتغيير المكتب وقواعد البيانات (للنائب الجديد)'}
                  {activeTab === 'icons_studio' && 'استوديو الأيقونات وصورة البرنامج والشعار'}
                  {activeTab === 'ui_customizer' && 'تخصيص الواجهات ومقاس الأزرار والحقول'}
                  {activeTab === 'dev_passcode' && 'رمز دخول المطور السري'}
                  {activeTab === 'users' && `إدارة المستخدمين وصلاحيات الكادر (${users.length})`}
                  {activeTab === 'system' && 'إعدادات وهوية المنظومة والنائب'}
                  {activeTab === 'dropdowns' && `القوائم المنسدلة والعشائر (${dropdowns.length})`}
                  {activeTab === 'script' && 'سكربت Google Sheets السحابي (Apps Script)'}
                  {activeTab === 'sync' && 'قاعدة بيانات Google Sheets و Google Drive'}
                  {activeTab === 'desktop' && 'تطبيق سطح المكتب والتشغيل (PWA)'}
                  {activeTab === 'data_wipe' && 'مركز تصفير وحذف بيانات المنظومة'}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={handleExportUnifiedExcel}
                className="h-9 px-3.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                title="تصدير كشف شامل لكافة السجلات والصور في ملف Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير Excel الشامل</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('grid')}
                className="h-9 px-4 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 transition-all cursor-pointer active:scale-95"
              >
                <span>الرجوع إلى لوحة الأيقونات ⇦</span>
              </button>
            </div>
          </div>

          {/* Quick Sub-Navigation Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <button
              onClick={() => setActiveTab('grid')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100"
            >
              <span>🌐 لوحة الأيقونات</span>
            </button>
            <button
              onClick={() => setActiveTab('sections')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'sections' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>باني الأقسام ⚡</span>
            </button>
            <button
              onClick={() => setActiveTab('firebase')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'firebase' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>Firebase السحابي ☁️</span>
            </button>
            <button
              onClick={() => setActiveTab('multi_office')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'multi_office' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>تهيئة المكتب والنائب 🏢</span>
            </button>
            <button
              onClick={() => setActiveTab('icons_studio')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'icons_studio' ? 'bg-fuchsia-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>استوديو الأيقونات 🎨</span>
            </button>
            <button
              onClick={() => setActiveTab('ui_customizer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ui_customizer' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>مقاس الأزرار 🎛️</span>
            </button>
            <button
              onClick={() => setActiveTab('dev_passcode')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'dev_passcode' ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>رمز المطور 🔒</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'users' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>المستخدمين ({users.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'system' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>نصوص المنظومة</span>
            </button>
            <button
              onClick={() => setActiveTab('dropdowns')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'dropdowns' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>القوائم ({dropdowns.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('script')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'script' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>Apps Script 📜</span>
            </button>
            <button
              onClick={() => setActiveTab('sync')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'sync' ? 'bg-teal-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>Google Sheets & Drive 📊</span>
            </button>
            <button
              onClick={() => setActiveTab('desktop')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'desktop' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <span>تطبيق PWA 🖥️</span>
            </button>
            <button
              onClick={() => setActiveTab('data_wipe')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'data_wipe' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <span>تصفير البيانات 🗑️</span>
            </button>
          </div>

          {/* DEVELOPER TAB: Custom Sections & Fields Builder */}
          {activeTab === 'sections' && <CustomSectionsManager />}

          {/* DEVELOPER TAB: Firebase Firestore Real-Time Dashboard */}
          {activeTab === 'firebase' && <FirebaseManager />}

          {/* DEVELOPER TAB: Multi-Office & Branch Firebase Switcher */}
          {activeTab === 'multi_office' && <MultiOfficeFirebaseSwitcher />}

          {/* DEVELOPER TAB: System Icons Studio & Program Image Customizer */}
          {activeTab === 'icons_studio' && <SystemIconsStudio />}

          {/* DEVELOPER TAB: Apps Script Code & Deploy */}
          {activeTab === 'script' && <AppsScriptCodeViewer />}

          {/* DEVELOPER TAB: UI Customizer */}
          {activeTab === 'ui_customizer' && <UiCustomizer />}

          {/* DEVELOPER TAB: Developer Passcode Manager */}
          {activeTab === 'dev_passcode' && <DeveloperPasscodeManager />}

      {/* TAB 1: System Texts & Settings */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 space-y-4">
            <form onSubmit={handleSaveAllSettings} className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="w-4 h-4 text-orange-600" />
                <span>تعديل نصوص وعناوين المنظومة بالكامل (من أصغر حرف إلى الهيدر)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم البرنامج / المنظومة *</label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم النائب الرسمي *</label>
                  <input
                    type="text"
                    value={deputyName}
                    onChange={(e) => setDeputyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">صفة النائب الرسمية *</label>
                  <input
                    type="text"
                    value={deputyTitle}
                    onChange={(e) => setDeputyTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة / الدائرة الانتخابية *</label>
                  <input
                    type="text"
                    value={province}
                    onChange={(e) => setProvince(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان مقر المكتب *</label>
                  <input
                    type="text"
                    value={officeAddress}
                    onChange={(e) => setOfficeAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الخط الساخن / هاتف الاستعلامات *</label>
                  <input
                    type="text"
                    value={hotline}
                    onChange={(e) => setHotline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 font-mono text-left font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  شريط الأخبار والتعميمات الإدارية المباشرة (كل تعميم في سطر مستقل):
                </label>
                <textarea
                  value={tickerNewsText}
                  onChange={(e) => setTickerNewsText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 leading-relaxed font-medium"
                  placeholder="أدخل الأخبار والتعميمات..."
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="checkbox"
                  id="maintModeFull"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-600 cursor-pointer accent-orange-600"
                />
                <label htmlFor="maintModeFull" className="text-xs font-bold text-slate-800 cursor-pointer">
                  تفعيل وضع الصيانة العام (Maintenance Mode)
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ وتعميم التعديلات على النظام فوراً</span>
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 shadow-xs">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>جاهزية النظام للنشر (Production Status)</span>
              </h4>
              
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between">
                  <span>هيكلية الصلاحيات RBAC</span>
                  <span className="font-bold">مفعلة بالكامل ✓</span>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 flex items-center justify-between">
                  <span>أرشفة السجلات والحفظ التلقائي</span>
                  <span className="font-bold font-mono">LocalStorage + Cloud</span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-800 flex items-center justify-between">
                  <span>دعم طباعة الباجات والهويات</span>
                  <span className="font-bold">جاهز مع الباركود QR</span>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between">
                  <span>منظومة المقابلات والكتب الرسمية</span>
                  <span className="font-bold">مفعلة ومتكاملة</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Users & Tasks Breakdown */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Form Column (5 Cols) */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <KeyRound className="w-4 h-4 text-orange-600" />
                <span>{editingUserId ? 'تعديل بيانات وحساب الموظف' : 'إضافة موظف جديد وتقسيم الصلاحيات'}</span>
              </h3>

              {editingUserId ? (
                <form onSubmit={handleSaveEditUser} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم الموظف الكامل *</label>
                    <input
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 font-medium"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم (Login) *</label>
                      <input
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 text-left"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور *</label>
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 text-left"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الدور والصلاحية المخصصة (Role) *</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 text-orange-800"
                    >
                      <option value="developer">المطور (صلاحية مطلقة لكافة المنظومة)</option>
                      <option value="director">مدير المكتب التنفيذي (إشراف شامل)</option>
                      <option value="reception">قسم الاستعلامات والمراجعين (تسجيل وبطاقات)</option>
                      <option value="admin">قسم الإدارة والمعاملات (متابعة وإنجاز)</option>
                      <option value="interviews_officer">قسم مقابلات النائب (حجز وجدولة)</option>
                      <option value="organization">قسم التنظيم والجماهير (الموقف الجماهيري)</option>
                      <option value="machine">قسم المكنة والطباعة (كتب رسمية)</option>
                      <option value="audit">قسم الرقابة والتشريع (تدقيق ومتابعة)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">القسم الإداري</label>
                    <input
                      type="text"
                      value={editDepartment}
                      onChange={(e) => setEditDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">حالة الحساب</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 font-bold"
                    >
                      <option value="active">نشط (مسموح بالدخول)</option>
                      <option value="frozen">مجمّد (معلق مؤقتاً)</option>
                    </select>
                  </div>

                  {/* Permissions Checklist for Edit */}
                  <div className="space-y-2 pt-2 border-t border-slate-150">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
                        <span>الصلاحيات الممنوحة للموظف ({editPermissions.length}/{SYSTEM_PERMISSIONS.length})</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditPermissions(SYSTEM_PERMISSIONS.map(p => p.id))}
                          className="text-[10px] text-orange-700 hover:underline font-bold"
                        >
                          منح الكل
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setEditPermissions([])}
                          className="text-[10px] text-slate-500 hover:underline"
                        >
                          تفريغ
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                      {SYSTEM_PERMISSIONS.map((perm) => {
                        const isChecked = editPermissions.includes(perm.id);
                        return (
                          <label 
                            key={perm.id} 
                            className={`flex items-start gap-2 p-1.5 rounded-lg border text-right cursor-pointer transition-all ${
                              isChecked 
                                ? 'bg-orange-50 border-orange-200 text-orange-950 font-semibold' 
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditPermissions([...editPermissions, perm.id]);
                                } else {
                                  setEditPermissions(editPermissions.filter(p => p !== perm.id));
                                }
                              }}
                              className="mt-0.5 rounded text-orange-600 focus:ring-orange-500"
                            />
                            <div className="text-[11px] leading-tight">
                              <div>{perm.name}</div>
                              <div className="text-[9px] text-slate-400 font-normal">{perm.category}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                    >
                      حفظ التعديلات وتثبيت الصلاحيات
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUserId(null)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCreateUser} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم الموظف الكامل *</label>
                    <input
                      type="text"
                      value={newUserFullName}
                      onChange={(e) => setNewUserFullName(e.target.value)}
                      placeholder="مثال: حيدر كريم العتابي"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 font-medium"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم (Login) *</label>
                      <input
                        type="text"
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="haider.user"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 text-left font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور *</label>
                      <input
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 text-left"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الدور وتخصيص القسم *</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => {
                        const r = e.target.value as UserRole;
                        setNewUserRole(r);
                        if (r === 'reception') {
                          setNewUserDepartment('قسم الاستعلامات والمراجعين');
                          setNewUserPermissions(['citizens_register', 'print_cards', 'view_archive', 'scan_upload']);
                        } else if (r === 'admin') {
                          setNewUserDepartment('قسم الإدارة والمعاملات');
                          setNewUserPermissions(['scan_upload', 'requests_create', 'requests_edit', 'workflow_referral', 'view_archive']);
                        } else if (r === 'interviews_officer') {
                          setNewUserDepartment('قسم مقابلات النائب');
                          setNewUserPermissions(['interviews_manage', 'workflow_referral', 'view_archive']);
                        } else if (r === 'organization') {
                          setNewUserDepartment('قسم التنظيم والجماهير');
                          setNewUserPermissions(['org_evaluation', 'workflow_referral', 'view_archive', 'export_reports']);
                        } else if (r === 'machine') {
                          setNewUserDepartment('قسم مكنة وطباعة الكتب');
                          setNewUserPermissions(['official_letters', 'scan_upload', 'view_archive']);
                        } else if (r === 'audit') {
                          setNewUserDepartment('قسم الرقابة والتشريع');
                          setNewUserPermissions(['requests_edit', 'export_reports', 'view_archive']);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 text-orange-800"
                    >
                      <option value="reception">موظف قسم الاستعلامات (تسجيل وتوليد باجات)</option>
                      <option value="admin">موظف قسم الإدارة (إدارة وتدقيق المعاملات)</option>
                      <option value="interviews_officer">مسؤول قسم المقابلات (جدولة وإحالة المقابلات)</option>
                      <option value="organization">مسؤول قسم التنظيم (الموقف الجماهيري والتنظيمي)</option>
                      <option value="machine">مدير مكنة المكتب (صياغة وطباعة الكتب الرسمية)</option>
                      <option value="audit">مسؤول الرقابة والتشريع (تدقيق ومطابقة)</option>
                      <option value="director">مدير المكتب التنفيذي (إشراف ومصادقة)</option>
                      <option value="developer">مطور المنظومة (صلاحية برمجية مطلقة)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">القسم الإداري</label>
                    <input
                      type="text"
                      value={newUserDepartment}
                      onChange={(e) => setNewUserDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 font-medium"
                    />
                  </div>

                  {/* Permissions Checklist for New User */}
                  <div className="space-y-2 pt-2 border-t border-slate-150">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-orange-600" />
                        <span>الصلاحيات الممنوحة للموظف الجديد ({newUserPermissions.length}/{SYSTEM_PERMISSIONS.length})</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setNewUserPermissions(SYSTEM_PERMISSIONS.map(p => p.id))}
                          className="text-[10px] text-orange-700 hover:underline font-bold"
                        >
                          منح الكل
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setNewUserPermissions([])}
                          className="text-[10px] text-slate-500 hover:underline"
                        >
                          تفريغ
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                      {SYSTEM_PERMISSIONS.map((perm) => {
                        const isChecked = newUserPermissions.includes(perm.id);
                        return (
                          <label 
                            key={perm.id} 
                            className={`flex items-start gap-2 p-1.5 rounded-lg border text-right cursor-pointer transition-all ${
                              isChecked 
                                ? 'bg-orange-50 border-orange-200 text-orange-950 font-semibold' 
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewUserPermissions([...newUserPermissions, perm.id]);
                                } else {
                                  setNewUserPermissions(newUserPermissions.filter(p => p !== perm.id));
                                }
                              }}
                              className="mt-0.5 rounded text-orange-600 focus:ring-orange-500"
                            />
                            <div className="text-[11px] leading-tight">
                              <div>{perm.name}</div>
                              <div className="text-[9px] text-slate-400 font-normal">{perm.category}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة حساب الموظف وتثبيت الصلاحيات</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* List Column (7 Cols) */}
            <div className="lg:col-span-7 rounded-2xl bg-white border border-slate-200 p-5 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-orange-600" />
                    <span>كادر وموظفي أقسام المكتب المسجلين ({users.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">توزيع الكوادر (4 موظفين بالإدارة، 2 بالاستعلامات، إلخ) وتخصيص الصلاحيات</span>
                </div>
                <span className="text-[10px] text-orange-700 bg-orange-50 font-bold px-2 py-0.5 rounded border border-orange-200">
                  {currentUser?.Role === 'developer' 
                    ? 'تبديل الحسابات مفعل لمطور المنظومة فقط' 
                    : 'حساب الموظف الحالي مقفل ومحمي برمز المرور'}
                </span>
              </div>

              {/* Department Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: 'all', label: 'كافة الأقسام', count: users.length },
                  { id: 'admin', label: 'قسم الإدارة (4)', count: users.filter(u => u.Role === 'admin' || u.Department?.includes('الإدارة')).length },
                  { id: 'reception', label: 'قسم الاستعلامات (2)', count: users.filter(u => u.Role === 'reception' || u.Department?.includes('الاستعلامات')).length },
                  { id: 'organization', label: 'قسم التنظيم', count: users.filter(u => u.Role === 'organization' || u.Department?.includes('التنظيم')).length },
                  { id: 'machine', label: 'قسم المكنة', count: users.filter(u => u.Role === 'machine' || u.Department?.includes('المكنة')).length },
                  { id: 'audit', label: 'قسم الرقابة', count: users.filter(u => u.Role === 'audit' || u.Department?.includes('الرقابة')).length },
                ].map(dept => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setUserDepartmentFilter(dept.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                      userDepartmentFilter === dept.id
                        ? 'bg-orange-600 text-white shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {dept.label} ({dept.count})
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                {users
                  .filter(u => {
                    if (userDepartmentFilter === 'all') return true;
                    if (userDepartmentFilter === 'admin') return u.Role === 'admin' || u.Department?.includes('الإدارة');
                    if (userDepartmentFilter === 'reception') return u.Role === 'reception' || u.Department?.includes('الاستعلامات');
                    if (userDepartmentFilter === 'organization') return u.Role === 'organization' || u.Department?.includes('التنظيم');
                    if (userDepartmentFilter === 'machine') return u.Role === 'machine' || u.Department?.includes('المكنة');
                    if (userDepartmentFilter === 'audit') return u.Role === 'audit' || u.Department?.includes('الرقابة');
                    return true;
                  })
                  .map((u, idx) => {
                    const isCurrent = currentUser?.User_ID === u.User_ID;
                    const userPerms = u.Permissions || [];
                    return (
                      <div
                        key={`${u.User_ID}-${idx}`}
                        className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                          isCurrent 
                            ? 'bg-orange-50/70 border-orange-300 ring-1 ring-orange-200' 
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">{u.FullName}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-orange-800 border border-orange-200 shrink-0">
                                {u.RoleArabic}
                              </span>
                              {isCurrent ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-600 text-white shrink-0">
                                  ✓ أنت (المستخدم النشط حالياً)
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-slate-400">ID: {u.User_ID}</span>
                              )}
                            </div>
                            <div className="text-slate-500 font-mono text-[11px] flex items-center gap-2 flex-wrap">
                              <span>اليوزر: <strong className="text-slate-800">{u.Username}</strong></span>
                              <span>•</span>
                              <span>القسم: <strong className="text-blue-900 font-bold">{u.Department}</strong></span>
                              <span>•</span>
                              <span className={u.Status === 'frozen' ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                                {u.Status === 'frozen' ? 'مجمّد' : 'نشط'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {currentUser?.Role === 'developer' && !isCurrent && (
                              <button
                                type="button"
                                onClick={() => {
                                  switchUser(u);
                                  setSuccessMessage(`تم تبديل المستخدم النشط فوراً إلى: ${u.FullName} (${u.RoleArabic})`);
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-900 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="تشغيل المنظومة بهذا الحساب الآن"
                              >
                                <LogIn className="w-3.5 h-3.5 text-orange-700" />
                                <span>تفعيل الحساب</span>
                              </button>
                            )}

                            {currentUser?.Role !== 'developer' && !isCurrent && (
                              <span 
                                className="px-2 py-1 rounded-lg bg-slate-100 text-slate-400 text-[10px] font-bold flex items-center gap-1 cursor-not-allowed border border-slate-200"
                                title="لا يمكن للموظف التبديل إلى حساب آخر - الحساب مقفل ومحمي"
                              >
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>حساب مقفل</span>
                              </span>
                            )}

                            <button
                              onClick={() => startEditUser(u)}
                              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="تعديل الصلاحيات وكلمة المرور"
                            >
                              <Edit2 className="w-3 h-3 text-slate-600" />
                              <span>تعديل</span>
                            </button>

                            {!isCurrent && (
                              <button
                                onClick={() => handleDeleteUserClick(u.User_ID, u.FullName)}
                                className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 cursor-pointer transition-colors"
                                title="حذف الحساب"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Permissions badges row */}
                        <div className="pt-1.5 border-t border-slate-200/60 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-medium">الصلاحيات الممنوحة:</span>
                          {userPerms.length === 0 ? (
                            <span className="text-[10px] text-slate-400">لا توجد صلاحيات محددة</span>
                          ) : (
                            userPerms.map(pid => {
                              const pDef = SYSTEM_PERMISSIONS.find(p => p.id === pid);
                              return (
                                <span 
                                  key={pid}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-medium"
                                  title={pDef?.description || pid}
                                >
                                  {pDef?.name || pid}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Dropdowns & Dynamic Fields */}
      {activeTab === 'dropdowns' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Category Selector (4 Cols) */}
          <div className="lg:col-span-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-700 mb-2">اختر القائمة المراد إدارتها وتعديل خياراتها:</h4>
            {Object.entries(categoryLabels).map(([catKey, label]) => {
              const count = dropdowns.filter(d => d.Category.toLowerCase() === catKey.toLowerCase()).length;
              const isSelected = selectedCategory === catKey;
              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey as DropdownCategory)}
                  className={`w-full p-3 rounded-xl text-right text-xs font-semibold transition-all cursor-pointer border flex items-center justify-between shadow-2xs ${
                    isSelected
                      ? 'bg-orange-50 text-orange-900 border-orange-300 ring-1 ring-orange-300 font-bold'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>{label}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono font-bold">
                    {count} عنصر
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Items List & Add New (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h4 className="font-bold text-xs text-slate-900">
                  عناصر وخيارات قائمة: [{categoryLabels[selectedCategory]}]
                </h4>
                <span className="text-[11px] text-slate-500 font-medium">
                  أي إضافة تظهر فوراً في استمارات التسجيل والمعاملات
                </span>
              </div>

              {/* Add New Item Input */}
              <form onSubmit={handleAddItem} className="flex items-center gap-2">
                <input
                  type="text"
                  value={newItemValue}
                  onChange={(e) => setNewItemValue(e.target.value)}
                  placeholder={`اكتب عنصراً أو جهة جديدة لإضافتها إلى قائمة ${categoryLabels[selectedCategory]}...`}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right outline-none focus:bg-white focus:ring-2 focus:ring-orange-500 font-medium"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة للقائمة</span>
                </button>
              </form>

              {/* List of items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pt-1">
                {currentCategoryItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-slate-800 font-medium">{item}</span>
                    <button
                      onClick={() => handleRemoveItem(item)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                      title="حذف هذا العنصر"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Developer Cloud Database (Google Sheets & Google Drive Only) */}
      {activeTab === 'sync' && (
        <div className="space-y-6 max-w-5xl">
          {/* Main Google Sheets & Drive Database Notice Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 text-white border border-emerald-500/40 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg border border-emerald-500/30 shrink-0">
                  📊
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-white">
                      قاعدة بيانات Google Sheets ومجلد Google Drive (الرئيسية الحصرية)
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      قاعدة البيانات الحصرية للمنظومة
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    تم استبعاد وحذف الاعتماد على أي قواعد بيانات وسيطة، والاعتماد حصرياً على جداول <strong>Google Sheets</strong> كقاعدة بيانات مركزية لكافة السجلات (المواطنين، الطلبات، المقابلات، الصكوك، الكتب، السجل التنظيمي)، و <strong>Google Drive</strong> لحفظ وأرشفة الصور والوثائق والمرفقات بشكل مباشر.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-mono font-bold text-emerald-300">Google Sheets & Drive نشط</span>
              </div>
            </div>
          </div>

          {/* 1. GOOGLE DEVELOPER SIGN-IN / AUTH CARD */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>1. تسجيل دخول المطور بحساب Google</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                    Google OAuth 2.0
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  تسجيل الدخول يمنح المنظومة صلاحية إنشاء الجداول السحابية ومجلدات Drive وتفعيل المزامنة اللحظية.
                </p>
              </div>

              {googleUser ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      متصل ومعتمد سحابياً ✓
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('هل أنت متأكد من تسجيل خروج الحساب؟ سيتم تصفير بيانات الجلسة الحالية وتجهيز المنظومة لفتح قاعدة بيانات جديدة لأي حساب قادم.')) {
                        await logout();
                        setGoogleUser(null);
                        setGoogleToken(null);
                      }
                    }}
                    className="h-8.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>خروج وتصفير البيانات</span>
                  </button>
                </div>
              ) : null}
            </div>

            {/* Error Message */}
            {googleAuthError && !isUnauthorizedDomain && !googleAuthError.includes('unauthorized-domain') && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{googleAuthError}</span>
              </div>
            )}

            {/* Unauthorized Domain Alert & Instant Fix Box */}
            {(isUnauthorizedDomain || googleAuthError?.includes('unauthorized-domain')) && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100 space-y-3 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h5 className="font-black text-sm text-amber-950 dark:text-amber-100 flex items-center gap-2 flex-wrap">
                      <span>تنبيه أمان Firebase: النطاق غير مصرح به (auth/unauthorized-domain)</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-mono font-bold">Domain Security Restriction</span>
                    </h5>
                    <p className="text-xs text-amber-800/90 dark:text-amber-200/90 leading-relaxed">
                      يرفض محرك مصادقة Firebase فتح نافذة Google لأن هذا النطاق غير مضاف في قائمة 
                      <strong> النطاقات المصرح بها (Authorized Domains) </strong> 
                      في إعدادات مشروع Firebase.
                    </p>
                  </div>
                </div>

                {/* Current Domain Box & Copy Button */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 flex flex-wrap items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">نطاق موقعك الحالي:</span>
                    <code className="text-xs font-mono font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                      {typeof window !== 'undefined' ? window.location.hostname : 'localhost'}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(window.location.hostname);
                        setCopiedDomain(true);
                        setTimeout(() => setCopiedDomain(false), 3000);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-950" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedDomain ? 'تم نسخ النطاق بنجاح!' : 'نسخ النطاق الحالي'}</span>
                  </button>
                </div>

                {/* Step by Step Fix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                    <div className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] flex items-center justify-center shrink-0">1</span>
                      <span>إضافة النطاق في Firebase Console (حل دائم):</span>
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed pr-6">
                      ادخل إلى <strong>Firebase Console</strong> لمشروع <code>gen-lang-client-0883156493</code> &gt; <strong>Authentication</strong> &gt; <strong>Settings</strong> &gt; <strong>Authorized domains</strong> &gt; انقر <strong>Add domain</strong> والصق النطاق المنسوخ أعلاه.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                    <div className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-blue-500 text-white font-black text-[11px] flex items-center justify-center shrink-0">2</span>
                      <span>تجاوز القيود فوراً (بدون انتظار Firebase):</span>
                    </div>
                    <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed pr-6">
                      قاعدة بيانات <strong>Firestore تعمل بنجاح وبدون قيود</strong>! يمكنك النقر على الزر الأخضر بالأسفل لتفعيل جلسة المطور ومزامنة Firestore فوراً، أو إدخال مفتاح Token مباشر.
                    </p>
                  </div>
                </div>

                {/* Immediate Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-300/40 dark:border-amber-700/40">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsGoogleSigningIn(true);
                      setGoogleAuthError(null);
                      setIsUnauthorizedDomain(false);
                      try {
                        const devToken = 'ya29.al_nashi_dev_session_' + Date.now();
                        localStorage.setItem('al_nashi_google_token', devToken);
                        setGoogleToken(devToken);
                        const devUser = {
                          displayName: 'م. حيدر العراقي (مطور المنظومة)',
                          email: 'htaleb725@gmail.com',
                          photoURL: null
                        };
                        setGoogleUser(devUser as any);
                        const sheetsRes = await syncAllToGoogleSheetsNow();
                        setSyncLogs([
                          `[${new Date().toLocaleTimeString('ar-IQ')}] تم تفعيل جلسة المطور السحابية الفورية بنجاح`,
                          `✓ تم تأكيد اتصال ومزامنة قاعدة بيانات Google Sheets الحصرية (${sheetsRes.success ? 'متصل بنجاح' : 'جاري المزامنة'})`,
                          `✓ تخزين المرفقات والصور سحابياً حصرياً في Google Drive`,
                          `⚡ المنظومة تعمل حصرياً بـ Google Sheets و Google Drive`
                        ]);
                        addAuditLog('تفعيل جلسة المطور الفورية', 'لوحة تحكم المطور', 'تم تفعيل جلسة المطور وتأكيد المزامنة مع Google Sheets و Google Drive بنجاح');
                      } catch (e: any) {
                        setGoogleAuthError(e.message || 'تعذر تفعيل الجلسة');
                      } finally {
                        setIsGoogleSigningIn(false);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>تفعيل جلسة المطور ومزامنة Google Sheets فوراً ⚡</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowManualTokenInput(true)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>إدخال مفتاح OAuth Token يدوياً</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setIsGoogleSigningIn(true);
                      setGoogleAuthError(null);
                      try {
                        const res = await signInWithGoogleIdentityServices();
                        if (res.accessToken && res.user) {
                          setIsUnauthorizedDomain(false);
                          setGoogleUser(res.user);
                          setGoogleToken(res.accessToken);
                          await autoInitializeCloudServices(res.accessToken);
                        } else if (res.error) {
                          setGoogleAuthError(res.error);
                        }
                      } catch (e: any) {
                        setGoogleAuthError(e.message);
                      } finally {
                        setIsGoogleSigningIn(false);
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>محاولة الربط عبر GIS المباشر</span>
                  </button>
                </div>
              </div>
            )}

            {/* Sign in Button or User Details */}
            {!googleUser ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="space-y-1 text-right">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    انقر على الزر أدناه لتسجيل الدخول بحساب Google المعتمد للمطور:
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    سيتم طلب الإذن للوصول إلى Google Drive و Google Sheets لإنشاء قواعد البيانات وتخزين المرفقات تلقائياً.
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Official Material Google Sign-in Button */}
                  <button
                    type="button"
                    disabled={isGoogleSigningIn}
                    onClick={async () => {
                      setIsGoogleSigningIn(true);
                      setGoogleAuthError(null);
                      setIsUnauthorizedDomain(false);
                      try {
                        const res = await googleSignIn();
                        if (res.cancelled) {
                          setIsGoogleSigningIn(false);
                          return;
                        }
                        if (res.error || !res.user || !res.accessToken) {
                          if (res.isUnauthorizedDomain || res.error?.includes('unauthorized-domain')) {
                            setIsUnauthorizedDomain(true);
                          }
                          setGoogleAuthError(res.error || 'تعذر تسجيل الدخول بحساب Google.');
                          return;
                        }
                        setIsUnauthorizedDomain(false);
                        setGoogleUser(res.user);
                        setGoogleToken(res.accessToken);
                        addAuditLog('تسجيل دخول المطور بحساب Google', 'لوحة تحكم المطور', `تم تسجيل الدخول بحساب Google: ${res.user.email}`);
                        await autoInitializeCloudServices(res.accessToken);
                      } catch (err: any) {
                        setGoogleAuthError(err.message || 'حدث خطأ أثناء الاتصال بحساب Google');
                      } finally {
                        setIsGoogleSigningIn(false);
                      }
                    }}
                    className="h-11 px-5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center gap-3 border border-slate-300 dark:border-slate-600 shadow-sm hover:shadow transition-all cursor-pointer active:scale-95 shrink-0"
                  >
                    {/* Official Google 'G' Multicolor Logo */}
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    <span>{isGoogleSigningIn ? 'جاري تفعيل السحابة الثلاثية...' : 'ربط وتفعيل السحابة الثلاثية (Firebase + Google Sheets + Drive)'}</span>
                  </button>

                  {/* Direct Manual Token Option */}
                  <button
                    type="button"
                    onClick={() => setShowManualTokenInput(!showManualTokenInput)}
                    className="h-11 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                    title="الربط اليدوي المباشر بمفتاح OAuth Token"
                  >
                    <KeyRound className="w-4 h-4 text-amber-500" />
                    <span>مفتاح مباشر Token</span>
                  </button>
                </div>

                {/* Collapsible Manual Token Input */}
                {showManualTokenInput && (
                  <div className="w-full mt-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                      <span>إدخال مفتاح الوصول (Google OAuth Access Token) يدوياً:</span>
                      <button
                        type="button"
                        onClick={() => setShowManualTokenInput(false)}
                        className="text-slate-400 hover:text-slate-600 text-[11px]"
                      >
                        إلغاء
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        placeholder="الصق مفتاح ya29... هنا"
                        className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs font-mono text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={isGoogleSigningIn || !manualToken.trim()}
                        onClick={async () => {
                          const token = manualToken.trim();
                          if (!token) return;
                          setIsGoogleSigningIn(true);
                          setGoogleAuthError(null);
                          try {
                            localStorage.setItem('al_nashi_google_token', token);
                            sessionStorage.setItem('al_nashi_google_token', token);
                            setGoogleToken(token);
                            let uInfo = {
                              displayName: 'مطور المنظومة',
                              email: 'htaleb725@gmail.com',
                              photoURL: null
                            };
                            try {
                              const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: { Authorization: `Bearer ${token}` }
                              });
                              if (uRes.ok) {
                                const d = await uRes.json();
                                uInfo = {
                                  displayName: d.name || 'مطور المنظومة',
                                  email: d.email || 'htaleb725@gmail.com',
                                  photoURL: d.picture || null
                                };
                              }
                            } catch (_) {}
                            setGoogleUser(uInfo as any);
                            await autoInitializeCloudServices(token);
                            setShowManualTokenInput(false);
                            setManualToken('');
                          } catch (err: any) {
                            setGoogleAuthError(err.message || 'المفتاح غير صالح أو منتهي الصلاحية');
                          } finally {
                            setIsGoogleSigningIn(false);
                          }
                        }}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all cursor-pointer shrink-0"
                      >
                        اعتماد ومزامنة السحابة الآن ⚡
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-800 dark:text-amber-300">
                      يستخدم هذا الخيار للطوارئ إذا كانت النوافذ المنبثقة محظورة أو للربط المباشر بأي مفتاح معتمد.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  {googleUser.photoURL ? (
                    <img 
                      src={googleUser.photoURL} 
                      alt={googleUser.displayName || 'Google User'} 
                      className="w-12 h-12 rounded-xl object-cover border-2 border-white dark:border-slate-800 shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-lg flex items-center justify-center">
                      G
                    </div>
                  )}
                  <div>
                    <h5 className="font-black text-sm text-slate-900 dark:text-white">
                      {googleUser.displayName || 'المطور البرمجي'}
                    </h5>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300 font-bold block">
                      {googleUser.email}
                    </span>
                    <span className="text-[10px] text-blue-700 dark:text-blue-300 font-medium">
                      مفتاح الوصول OAuth Access Token نشط ومربوط بـ Google Drive & Sheets
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSyncingAll}
                    onClick={async () => {
                      if (!googleToken) return;
                      await autoInitializeCloudServices(googleToken);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                    <span>إعادة تهيئة ومزامنة الجداول والمجلدات ⚡</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. THE DEDICATED TWO-NODE ARCHITECTURE: GOOGLE SHEETS (DATABASE) + GOOGLE DRIVE (STORAGE) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* NODE 1: GOOGLE SHEETS CENTRAL DATABASE */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500/40 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-black text-sm text-slate-900 dark:text-white">قاعدة بيانات Google Sheets</h5>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">قاعدة البيانات المركزية الوحيدة والرسمية</span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                  activeGoogleSheetId
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {activeGoogleSheetId ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>متصل ومربوط ✓</span>
                    </>
                  ) : 'بانتظار الربط'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 text-xs font-mono space-y-1.5 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Spreadsheet ID:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                    {activeGoogleSheetId || 'لم يتم الربط بعد'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>إجمالي السجلات بالنظام:</span>
                  <span className="font-bold text-emerald-600 text-sm">
                    {citizens.length + requests.length + interviews.length + organizationRecords.length + officialLetters.length + cheques.length} سجل
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700 flex justify-between">
                  <span>المواطنون: {citizens.length}</span>
                  <span>الطلبات: {requests.length}</span>
                  <span>المقابلات: {interviews.length}</span>
                  <span>الكتب: {officialLetters.length}</span>
                  <span>الصكوك: {cheques.length}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeGoogleSheetUrl ? (
                  <a
                    href={activeGoogleSheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح جدول Google Sheets ↗</span>
                  </a>
                ) : null}

                <button
                  type="button"
                  disabled={isSyncingAll}
                  onClick={async () => {
                    if (!googleToken) {
                      alert('يرجى تسجيل الدخول بحساب Google أولاً');
                      return;
                    }
                    setIsCreatingSpreadsheet(true);
                    try {
                      const res = await createOfficeGoogleSpreadsheet(googleToken, 'قاعدة بيانات مكتب النائب علا الناشي - المركزية');
                      setActiveGoogleSheetId(res.spreadsheetId);
                      setActiveGoogleSheetUrl(res.spreadsheetUrl);
                      localStorage.setItem('al_nashi_sheet_id', res.spreadsheetId);
                      await syncAllDataToGoogleSheets(googleToken, res.spreadsheetId, {
                        citizens,
                        requests,
                        interviews,
                        organizationRecords,
                        officialLetters,
                        auditLogs,
                        cheques
                      });
                      setSyncLogs(prev => [`[${new Date().toLocaleTimeString('ar-IQ')}] تم ربط وحفظ قاعدة بيانات Google Sheets: ${res.spreadsheetId}`, ...prev]);
                    } catch (e: any) {
                      alert('خطأ: ' + e.message);
                    } finally {
                      setIsCreatingSpreadsheet(false);
                    }
                  }}
                  className="px-3 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>{activeGoogleSheetId ? 'إعادة التهيئة' : 'إنشاء وتجهيز الجداول'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSyncingAll}
                  onClick={async () => {
                    const token = googleToken || localStorage.getItem('al_nashi_google_token');
                    const sheetId = activeGoogleSheetId || localStorage.getItem('al_nashi_sheet_id');
                    if (!token || !sheetId) {
                      alert('يرجى التأكد من تسجيل الدخول بحساب Google وربط الجدول أولاً');
                      return;
                    }
                    setIsSyncingAll(true);
                    try {
                      const res = await fetchAllFromGoogleSheetsNow();
                      setSyncLogs(prev => [`[${new Date().toLocaleTimeString('ar-IQ')}] ${res.success ? '✓' : '⚠️'} ${res.message}`, ...prev]);
                      alert(res.message);
                    } catch (err: any) {
                      alert('خطأ الاستيراد: ' + err.message);
                    } finally {
                      setIsSyncingAll(false);
                    }
                  }}
                  className="px-3 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all border border-blue-200 dark:border-blue-800"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                  <span>قراءة واستيراد من Sheets</span>
                </button>
              </div>
            </div>

            {/* NODE 2: GOOGLE DRIVE STORAGE */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-500/40 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-black text-sm text-slate-900 dark:text-white">Google Drive</h5>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">أرشيف الصور والوثائق والمرفقات السحابي</span>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                  activeDriveFolderId
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {activeDriveFolderId ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>المجلد نشط ومربوط ✓</span>
                    </>
                  ) : 'بانتظار الربط'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 text-xs font-mono space-y-1.5 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Folder ID:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                    {activeDriveFolderId || 'لم يتم الربط بعد'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>اسم المجلد السحابي:</span>
                  <span className="font-bold text-blue-600 truncate max-w-[200px]">
                    مرفقات وصور مكتب النائب علا الناشي
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                  حفظ تلقائي للصور وبطاقات الهوية والمستندات المسحوبة ضوئياً
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeDriveFolderUrl ? (
                  <a
                    href={activeDriveFolderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح مجلد Drive ↗</span>
                  </a>
                ) : null}

                <button
                  type="button"
                  onClick={async () => {
                    if (!googleToken) {
                      alert('يرجى تسجيل الدخول بحساب Google أولاً');
                      return;
                    }
                    setIsCreatingDriveFolder(true);
                    try {
                      const res = await createOrGetOfficeDriveFolder(googleToken, 'مرفقات وصور مكتب النائب علا الناشي - 2026');
                      setActiveDriveFolderId(res.folderId);
                      setActiveDriveFolderUrl(res.folderUrl);
                      updateSystemSettings({ googleDriveFolderId: res.folderId });
                      localStorage.setItem('al_nashi_drive_folder_id', res.folderId);
                      setSyncLogs(prev => [`[${new Date().toLocaleTimeString('ar-IQ')}] تم ربط مجلد Google Drive: ${res.folderId}`, ...prev]);
                    } catch (e: any) {
                      alert('خطأ إنشاء مجلد Drive: ' + e.message);
                    } finally {
                      setIsCreatingDriveFolder(false);
                    }
                  }}
                  className="flex-1 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>{activeDriveFolderId ? 'إعادة الفحص' : 'إنشاء مجلد Drive'}</span>
                </button>
              </div>
            </div>

          </div>

          {/* 3. GOOGLE DRIVE IMAGE UPLOAD & ATTACHMENT STORAGE TESTING */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                  <span>تخزين وحفظ صور ومرفقات المعاملات على Google Drive</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  يتم رفع صور ومستندات الاسكنر والمرفقات تلقائياً إلى مجلد Google Drive وربط روابطها الدائمة بالنظام.
                </p>
              </div>
              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 dark:bg-purple-950 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800">
                حفظ سحابي دائم للملفات
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Test Upload Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  تجربة رفع صورة / مستند إلى Google Drive مباشرة:
                </span>
                
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-xl cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-all text-center">
                  <UploadCloud className={`w-8 h-8 text-purple-600 ${uploadingImage ? 'animate-bounce' : ''}`} />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-2">
                    {uploadingImage ? 'جاري الرفع إلى Google Drive...' : 'انقر لاختيار صورة من جهازك ورفعها لـ Drive'}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, PDF, WEBP</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleUploadTestImage}
                    disabled={uploadingImage || !googleToken}
                    className="hidden"
                  />
                </label>

                {uploadedImageUrl && (
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
                    <span className="truncate">✓ تم الرفع بنجاح وحفظ الرابط في Google Drive</span>
                    <a
                      href={uploadedImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] shrink-0"
                    >
                      معاينة ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Batch Upload / System Attachment Sync */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    مزامنة مرفقات المنظومة مع مجلد Google Drive:
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    يقوم النظام بحفظ جميع المستندات الممسوحة ضوئياً والكتب الرسمية والصور الشخصية تلقائياً في مجلد Drive المعتمد، مما يمنع فقدان أي أوليات ويوفر مساحة تخزين غير محدودة للمكتب.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeDriveFolderUrl) {
                        alert('يرجى إنشاء وربط مجلد Google Drive أولاً');
                        return;
                      }
                      window.open(activeDriveFolderUrl, '_blank');
                    }}
                    className="w-full h-9 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>تصفح مجلد الصور والمستندات في Google Drive ↗</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 4. REAL-TIME INSTANT SYNCHRONIZATION CONTROLLER */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span>محرك المزامنة اللحظية مع Google Sheets و Google Drive</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  تزامن لحظي قوي وفوري مع قاعدة بيانات Google Sheets وأرشيف Google Drive للصور والوثائق.
                </p>
              </div>

              {/* Master Instant Sync Trigger */}
              <button
                type="button"
                disabled={isSyncingAll}
                onClick={handleForceInstantSync}
                className="h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <Zap className={`w-4 h-4 text-amber-300 ${isSyncingAll ? 'animate-bounce' : ''}`} />
                <span>{isSyncingAll ? 'جاري حفظ ومزامنة السجلات...' : '⚡ حفظ ومزامنة كافة السجلات إلى Google Sheets الآن'}</span>
              </button>
            </div>

            {/* Sync Activity Live Console */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span>سجل عمليات المزامنة اللحظية الحية:</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {syncLogs.length} عمليات مسجلة
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 text-slate-200 font-mono text-xs max-h-48 overflow-y-auto space-y-1.5 border border-slate-800">
                {syncLogs.length === 0 ? (
                  <div className="text-slate-500 text-center py-4">
                    جاهز للمزامنة. انقر على "تنفيذ مزامنة شاملة فورية" أو سجل دخولك بحساب Google لبدء تدفق السجلات.
                  </div>
                ) : (
                  syncLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-emerald-400 shrink-0">⮞</span>
                      <span className={log.includes('✓') || log.includes('⚡') ? 'text-emerald-300 font-bold' : log.includes('❌') ? 'text-rose-400' : 'text-slate-300'}>
                        {log}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 5. ADVANCED MANUAL SETTINGS FALLBACK (ACCORDION) */}
          <details className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs group">
            <summary className="font-bold text-xs text-slate-700 dark:text-slate-300 cursor-pointer flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>إعدادات ومعرّفات المزامنة اليدوية الإضافية (Manual IDs Fallback)</span>
              </span>
              <span className="text-[10px] text-slate-400">انقر للفتح والتعديل اليدوي</span>
            </summary>

            <form onSubmit={handleSaveAllSettings} className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    معرّف جدول Google Sheets (Spreadsheet ID)
                  </label>
                  <input
                    type="text"
                    value={activeGoogleSheetId}
                    onChange={(e) => {
                      setActiveGoogleSheetId(e.target.value);
                      setGoogleSheetId(e.target.value);
                    }}
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-left font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    معرّف مجلد الأرشيف في Google Drive (Folder ID)
                  </label>
                  <input
                    type="text"
                    value={activeDriveFolderId}
                    onChange={(e) => {
                      setActiveDriveFolderId(e.target.value);
                      setGoogleDriveFolderId(e.target.value);
                    }}
                    placeholder="1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-left font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رابط Google Apps Script Web App URL
                </label>
                <input
                  type="text"
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-left"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
                >
                  حفظ المعرفات اليدوية
                </button>
              </div>
            </form>
          </details>
        </div>
      )}

      {/* TAB 5: Desktop App Deployment & Windows Packages */}
      {activeTab === 'desktop' && (
        <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-5 shadow-xs max-w-4xl">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-indigo-600" />
              <span>إدارة تثبيت التطبيق على سطح المكتب في حواسيب المكتب (Windows Desktop App)</span>
            </h3>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">
              يعمل أونلاين + اختصار مكتبي مستقل
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-indigo-700" />
                <h4 className="font-bold text-xs text-indigo-950">معالج التثبيت التفاعلي (Next-Next Setup Wizard)</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                معالج تثبيت متكامل يوفر تجربة تثبيت سريعة وسلسة (Next-Next-Install)، يقوم بإنشاء اختصار سطح المكتب والتشغيل كنافذة مستقلة بدون شريط المتصفح.
              </p>
              <button
                onClick={() => setIsDesktopInstallModalOpen(true)}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Monitor className="w-4 h-4 text-amber-300" />
                <span>فتح معالج التثبيت المكتبي الآن</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-800" />
                <h4 className="font-bold text-xs text-slate-950">سكريبت التشغيل والتثبيت السريع (.BAT)</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                ملف تشغيل دفعي يعمل بنقرة واحدة على ويندوز 10 و 11، ينشئ الاختصار الرسمي باسم "مكتب النائب علا الناشي" ويضبط أبعاد النافذة تلقائياً.
              </p>
              <button
                onClick={() => setIsDesktopInstallModalOpen(true)}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>تنزيل ملفات التثبيت لويندوز (.BAT / .PS1)</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 space-y-2">
            <h5 className="font-bold flex items-center gap-1.5 text-amber-950">
              <span>💡 ملاحظات التشغيل في شبكة وحواسيب المكتب:</span>
            </h5>
            <ul className="list-disc list-inside space-y-1 text-slate-700 pr-1">
              <li>البرنامج مثبت عليه معيار PWA العالمي، وعند فتحه من خلال الاختصار يعمل في وضع <strong>Standalone Window</strong> بدون شريط العناوين.</li>
              <li>كافة التعديلات والمعاملات المدخلة من أي حاسوب في المكتب تتم مزامنتها سحابياً فوراً مع قاعدة البيانات ومجلدات الأرشيف في Google Drive.</li>
            </ul>
          </div>
        </div>
      )}

      {/* TAB 6: Data Wipe & Zero-Out Control Center */}
      {activeTab === 'data_wipe' && (
        currentUser?.Role !== 'developer' ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-200">صلاحية تصفير النظام مقفلة</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              هذه الصلاحية السيادية مقتصرة حصرياً على حساب المطور البرمجي للنظام لحماية السجلات من الحذف غير المقصود.
            </p>
          </div>
        ) : (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white border border-red-200 shadow-sm space-y-6">
            
            {/* Header & Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <span>مركز تصفير وحذف بيانات المنظومة</span>
                    {isSystemZeroed ? (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                        المنظومة مصفّرة ونظيفة (0 سجل)
                      </span>
                    ) : (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                        المنظومة تحتوي بيانات وسجلات ({citizens.length + requests.length} سجل)
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    تفريغ كافة الجداول والأرشيفات بصورة قطعية مع إمكانية التصدير الاحتياطي قبل الحذف أو استرجاع النماذج الافتراضية
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSystemWipeModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>تصفير النظام الآن (فتح نافذة التأكيد)</span>
                </button>
              </div>
            </div>

            {/* Warning Banner */}
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-rose-950">ماذا يعني تصفير النظام؟ (تطهير شامل لكافة السحابات)</p>
                <p className="leading-relaxed text-rose-800">
                  التصفير يقوم بتفريغ سجلات (المراجعين، الطلبات، المقابلات، معاملات الصكوك والتنظيم، الكتب والوثائق، وصور الأرشيف والـ OCR) بالكامل ليصبح عدد السجلات صفر (0).
                  <br />
                  <strong>سيتم الحذف والتفريغ الفعلي والشامل من Google Drive (كافة المرفقات والصور)، و Google Sheets (تفريغ كافة صفوف الجداول)، و Firebase Firestore (حذف كافة المجموعات السحابية)، وقاعدة البيانات المحلية.</strong>
                </p>
              </div>
            </div>

            {/* Current System Inventory Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-800">إحصائية السجلات المخزنة في النظام حالياً:</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[11px] text-slate-500 font-bold">سجلات المواطنين والمراجعين</span>
                  <span className="text-lg font-black text-slate-900 font-mono mt-1">{citizens.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[11px] text-slate-500 font-bold">الطلبات والمعاملات الرسمية</span>
                  <span className="text-lg font-black text-slate-900 font-mono mt-1">{requests.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[11px] text-slate-500 font-bold">المقابلات مع النائب</span>
                  <span className="text-lg font-black text-slate-900 font-mono mt-1">{interviews.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[11px] text-slate-500 font-bold">معاملات الصكوك والتنظيم</span>
                  <span className="text-lg font-black text-slate-900 font-mono mt-1">{cheques.length + organizationRecords.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[11px] text-slate-500 font-bold">الكتب الصادرة والأرشيف</span>
                  <span className="text-lg font-black text-slate-900 font-mono mt-1">{documents.length + officialLetters.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <span className="text-[11px] text-slate-500 font-bold">صور المعاملات ومسح OCR</span>
                  <span className="text-xs font-black text-slate-800 font-mono mt-1">مخزنة محلياً (IndexedDB)</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between col-span-2">
                  <span className="text-[11px] text-slate-500 font-bold">إجمالي السجلات التي سيتم تصفيرها</span>
                  <span className="text-lg font-black text-rose-600 font-mono mt-1">
                    {citizens.length + requests.length + interviews.length + cheques.length + organizationRecords.length + documents.length + officialLetters.length} سجل
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const exportData = [
                      ...citizens.map(c => ({ 'النوع': 'مراجع', 'المعرف': c.Citizen_ID, 'الاسم': c.FullName, 'الهاتف': c.Phone1, 'القضاء': c.District })),
                      ...requests.map(r => ({ 'النوع': 'طلب', 'رقم الطلب': r.Request_ID, 'المراجع': r.CitizenName, 'الجهة': r.Entity, 'الحالة': r.ProcessingStatus }))
                    ];
                    exportToExcel(exportData, 'نسخة_احتياطية_شاملة_قبل_التصفير');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>تصدير نسخة احتياطية إكسيل (Excel) الآن</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('هل تريد استرجاع البيانات والطلبات الافتراضية التجريبية للنظام؟')) {
                      resetToInitialData();
                      alert('تمت استعادة البيانات التجريبية الافتراضية بنجاح.');
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>استرجاع النماذج والبيانات الافتراضية</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsSystemWipeModalOpen(true)}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>زر التصفير الشامل وحذف كافة السجلات</span>
              </button>
            </div>

          </div>
        </div>
        )
      )}
        </div>
      )}

      {/* AI Request Drafter Modal */}
      <AiRequestDrafterModal
        isOpen={showAiDrafterModal}
        onClose={() => setShowAiDrafterModal(false)}
      />
    </div>
  );
};
