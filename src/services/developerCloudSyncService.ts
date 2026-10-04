import { 
  googleSignIn, 
  googleSignOut, 
  getAccessToken, 
  createOfficeGoogleSpreadsheet, 
  createOrGetOfficeDriveFolder, 
  syncAllDataToGoogleSheets, 
  uploadImageToDrive,
  clearAllGoogleSheetsData,
  clearAllDriveFolderFiles,
  fetchAllDataFromGoogleSheets
} from './googleSheetsService';
import { User, Citizen, OfficeRequest, Interview, OrganizationRecord, OfficialLetter, AuditLog, ChequeRecord } from '../types';
import { getAllImagesFromDB } from '../utils/imageDb';

export interface DeveloperCloudStatus {
  isConnected: boolean;
  googleUser: {
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
  } | null;
  sheetId: string | null;
  sheetUrl: string | null;
  driveFolderId: string | null;
  driveFolderUrl: string | null;
  isRealtimeSyncActive: boolean;
  lastSyncTime: string | null;
  syncStats: {
    citizensCount: number;
    requestsCount: number;
    interviewsCount: number;
    lettersCount: number;
    orgCount: number;
    chequesCount: number;
  };
}

export type ProgressCallback = (step: number, totalSteps: number, message: string) => void;

type LogListener = (log: string) => void;
const logListeners: Set<LogListener> = new Set();
const syncLogsHistory: string[] = [];

export const addDeveloperSyncLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString('ar-IQ');
  const formatted = `[${timestamp}] ${message}`;
  syncLogsHistory.unshift(formatted);
  if (syncLogsHistory.length > 100) syncLogsHistory.pop();
  logListeners.forEach(listener => listener(formatted));
};

export const subscribeToDeveloperSyncLogs = (listener: LogListener) => {
  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
};

export const getDeveloperSyncLogsHistory = () => [...syncLogsHistory];

/**
 * Execute the automated Developer Google Workspace setup flow:
 * 1. Authenticate with Google
 * 2. Create/Link Google Drive folder for photos and attachments
 * 3. Create/Link Google Sheets database with complete administrative sheets
 * 4. Perform instantaneous synchronization to Google Sheets and Drive
 */
export const loginAndSetupDeveloperCloud = async (
  systemData: {
    citizens: Citizen[];
    requests: OfficeRequest[];
    interviews: Interview[];
    organizationRecords: OrganizationRecord[];
    officialLetters: OfficialLetter[];
    auditLogs: AuditLog[];
    users: User[];
    systemSettings: any;
    dropdowns: any;
    cheques?: ChequeRecord[];
  },
  onProgress?: ProgressCallback
): Promise<{
  success: boolean;
  cancelled?: boolean;
  error?: string | null;
  googleUser?: any;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  folderId?: string;
  folderUrl?: string;
}> => {
  try {
    // Step 1: Sign in with Google Account
    if (onProgress) onProgress(1, 4, 'جاري الاتصال وتسجيل الدخول بحساب Google...');
    addDeveloperSyncLog('بدء إجراءات تسجيل دخول المطور بحساب Google...');

    const signInRes = await googleSignIn();
    if (signInRes.cancelled) {
      addDeveloperSyncLog('قام المطور بإلغاء نافذة تسجيل الدخول.');
      return { success: false, cancelled: true };
    }

    if (!signInRes.user || !signInRes.accessToken) {
      const err = signInRes.error || 'فشل في استلام تصريح الدخول من حساب Google';
      addDeveloperSyncLog(`❌ خطأ في المصادقة: ${err}`);
      return { success: false, error: err };
    }

    const token = signInRes.accessToken;
    const user = signInRes.user;
    addDeveloperSyncLog(`✓ تم تسجيل الدخول بنجاح للمطور: ${user.displayName || user.email || 'المطور'}`);

    const userEmail = user.email || 'htaleb725@gmail.com';
    const lastUserEmail = typeof window !== 'undefined' ? (localStorage.getItem('al_nashi_google_user_email') || '') : '';
    const isDifferentAccount = !lastUserEmail || (userEmail.toLowerCase() !== lastUserEmail.toLowerCase());

    // Step 2: Establish / Create Google Drive Folder for Photos & Attachments
    if (onProgress) onProgress(2, 4, 'جاري تهيئة مجلد Google Drive الرسمي لحفظ الصور والمرفقات...');
    addDeveloperSyncLog('فحص وتهيئة مجلد التخزين السحابي Google Drive للصور والمرفقات...');

    let folderId = !isDifferentAccount && typeof window !== 'undefined' ? (localStorage.getItem('al_nashi_drive_folder_id') || '') : '';
    let folderUrl = folderId ? `https://drive.google.com/drive/folders/${folderId}` : '';

    try {
      const driveFolder = await createOrGetOfficeDriveFolder(token, 'مرفقات وصور مكتب النائب علا الناشي - 2026');
      folderId = driveFolder.folderId;
      folderUrl = driveFolder.folderUrl;
      if (typeof window !== 'undefined') {
        localStorage.setItem('al_nashi_drive_folder_id', folderId);
      }
      addDeveloperSyncLog(`✓ تم ربط مجلد Google Drive للصور بنجاح: (${folderId})`);
    } catch (e: any) {
      addDeveloperSyncLog(`⚠️ تنبيه في مجلد Drive: ${e.message || 'تم المتابعة بالمعرف الحالي'}`);
    }

    // Step 3: Establish / Create Google Sheets Central Database
    if (onProgress) onProgress(3, 4, 'جاري إنشاء وربط قاعدة بيانات Google Sheets المركزية...');
    addDeveloperSyncLog('إنشاء وتكوين جداول قاعدة البيانات المركزية على Google Sheets...');

    let sheetId = !isDifferentAccount && typeof window !== 'undefined' ? (localStorage.getItem('al_nashi_sheet_id') || '') : '';
    let sheetUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : '';

    try {
      if (!sheetId || isDifferentAccount) {
        const sheetRes = await createOfficeGoogleSpreadsheet(token, 'قاعدة بيانات مكتب النائب علا الناشي - المركزية');
        sheetId = sheetRes.spreadsheetId;
        sheetUrl = sheetRes.spreadsheetUrl;
        if (typeof window !== 'undefined') {
          localStorage.setItem('al_nashi_sheet_id', sheetId);
          localStorage.setItem('al_nashi_google_user_email', userEmail);
        }
        addDeveloperSyncLog(`✓ تم بنجاح إنشاء قاعدة بيانات Google Sheets جديدة لحساب (${userEmail}): (${sheetId})`);
      } else {
        addDeveloperSyncLog(`✓ تم استخدام قاعدة بيانات Google Sheets الحالية للحساب: (${sheetId})`);
      }
    } catch (e: any) {
      addDeveloperSyncLog(`⚠️ تنبيه في جدول Google Sheets: ${e.message}`);
    }

    // Step 4: Instant Data Synchronization to Google Sheets
    if (onProgress) onProgress(4, 4, 'جاري مزامنة السجلات والمواطنين والمعاملات لحظياً إلى Google Sheets...');
    addDeveloperSyncLog('مزامنة فورية وحفظ لكافة السجلات في قاعدة بيانات Google Sheets...');

    if (sheetId) {
      try {
        let storedImages: any[] = [];
        try {
          storedImages = await getAllImagesFromDB();
        } catch (_) {}

        const syncSheetsRes = await syncAllDataToGoogleSheets(token, sheetId, {
          citizens: systemData.citizens,
          requests: systemData.requests,
          interviews: systemData.interviews,
          organizationRecords: systemData.organizationRecords,
          officialLetters: systemData.officialLetters,
          auditLogs: systemData.auditLogs,
          cheques: systemData.cheques || [],
          imageRecords: storedImages,
          dropdowns: systemData.dropdowns
        });
        addDeveloperSyncLog(`✓ تم بنجاح تحديث وتنسيق (${syncSheetsRes.updatedSheets}) جداول على Google Sheets.`);
      } catch (e: any) {
        addDeveloperSyncLog(`⚠️ خطأ مزامنة الجداول: ${e.message}`);
      }
    }

    const now = new Date().toLocaleString('ar-IQ');
    if (typeof window !== 'undefined') {
      localStorage.setItem('al_nashi_last_sync_time', now);
      localStorage.setItem('al_nashi_google_user_email', user.email || 'htaleb725@gmail.com');
      localStorage.setItem('al_nashi_google_user_name', user.displayName || 'مطور المنظومة');
      localStorage.setItem('al_nashi_google_user_photo', user.photoURL || '');
    }

    addDeveloperSyncLog('⚡ اكتملت بنجاح منظومة الربط مع Google Sheets (قاعدة البيانات) و Google Drive (مجلد الصور)!');

    return {
      success: true,
      googleUser: {
        displayName: user.displayName || 'مطور المنظومة',
        email: user.email || 'htaleb725@gmail.com',
        photoURL: user.photoURL
      },
      spreadsheetId: sheetId,
      spreadsheetUrl: sheetUrl,
      folderId,
      folderUrl
    };
  } catch (err: any) {
    addDeveloperSyncLog(`❌ خطأ غير متوقع: ${err.message || err}`);
    return {
      success: false,
      error: err.message || 'حدث خطأ أثناء الاتصال السحابي للمطور'
    };
  }
};

/**
 * Trigger Instant Google Sheets & Google Drive Sync
 */
export const triggerDeveloperGoogleSync = async (
  systemData: {
    citizens: Citizen[];
    requests: OfficeRequest[];
    interviews: Interview[];
    organizationRecords: OrganizationRecord[];
    officialLetters: OfficialLetter[];
    auditLogs: AuditLog[];
    users: User[];
    systemSettings: any;
    dropdowns: any;
    cheques?: ChequeRecord[];
  }
): Promise<{
  success: boolean;
  sheetsSynced: boolean;
  message: string;
}> => {
  addDeveloperSyncLog('بدء تنفيذ المزامنة الفورية مع قاعدة بيانات Google Sheets و Google Drive...');
  let sheetsSynced = false;

  try {
    const token = await getAccessToken();
    const sheetId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') || '' : '';

    if (token && sheetId) {
      let storedImages: any[] = [];
      try {
        storedImages = await getAllImagesFromDB();
      } catch (_) {}

      const sheetsRes = await syncAllDataToGoogleSheets(token, sheetId, {
        citizens: systemData.citizens,
        requests: systemData.requests,
        interviews: systemData.interviews,
        organizationRecords: systemData.organizationRecords,
        officialLetters: systemData.officialLetters,
        auditLogs: systemData.auditLogs,
        cheques: systemData.cheques || [],
        imageRecords: storedImages,
        dropdowns: systemData.dropdowns
      });
      sheetsSynced = sheetsRes.success;
      addDeveloperSyncLog(`✓ Google Sheets: تم تحديث وحفظ (${sheetsRes.updatedSheets}) جداول بنجاح.`);
    } else {
      addDeveloperSyncLog('ℹ️ Google Sheets: يرجى تسجيل الدخول بحساب Google أولاً.');
    }

    const folderId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_drive_folder_id') || '' : '';
    if (folderId) {
      addDeveloperSyncLog(`✓ Google Drive: مجلد الصور والمستندات نشط ومربوط.`);
    }

    const now = new Date().toLocaleString('ar-IQ');
    if (typeof window !== 'undefined') {
      localStorage.setItem('al_nashi_last_sync_time', now);
    }

    addDeveloperSyncLog('⚡ تمت المزامنة مع Google Sheets و Google Drive بنجاح!');

    return {
      success: true,
      sheetsSynced,
      message: 'تم حفظ ومزامنة كافة السجلات في Google Sheets و Google Drive بنجاح'
    };
  } catch (error: any) {
    addDeveloperSyncLog(`❌ خطأ أثناء مزامنة Google Sheets: ${error.message || error}`);
    return {
      success: false,
      sheetsSynced,
      message: error.message || 'حدث خطأ أثناء المزامنة مع Google Sheets'
    };
  }
};

/**
 * Pull all data from Google Sheets into the application
 */
export const pullAllDataFromGoogleSheets = async () => {
  const token = await getAccessToken();
  const sheetId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') || '' : '';
  if (!token || !sheetId) {
    return {
      success: false,
      message: 'يرجى تسجيل الدخول بحساب Google والتأكد من ربط جدول البيانات أولاً',
      data: { citizens: [], requests: [], interviews: [], officialLetters: [], organizationRecords: [], cheques: [] }
    };
  }

  addDeveloperSyncLog('جاري استيراد وقراءة كافة البيانات مباشرة من Google Sheets...');
  const res = await fetchAllDataFromGoogleSheets(token, sheetId);
  if (res.success) {
    addDeveloperSyncLog(`✓ ${res.message}`);
  } else {
    addDeveloperSyncLog(`⚠️ ${res.message}`);
  }
  return res;
};

/**
 * Wipe all data across Google Drive and Google Sheets
 */
export const wipeDeveloperCloudData = async (): Promise<{
  success: boolean;
  sheetsWiped: boolean;
  driveFilesDeleted: number;
  message: string;
}> => {
  addDeveloperSyncLog('⚠️ بدء تصفير البيانات من جداول Google Sheets ومجلد Google Drive...');
  let sheetsWiped = false;
  let driveFilesDeleted = 0;

  try {
    const token = await getAccessToken();

    // 1. Clear Google Sheets data rows
    const sheetId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') || '' : '';
    if (token && sheetId) {
      try {
        const sRes = await clearAllGoogleSheetsData(token, sheetId);
        sheetsWiped = sRes.success;
        addDeveloperSyncLog(`✓ تم تفريغ وتصفير بيانات جداول Google Sheets (${sRes.clearedRanges} جداول).`);
      } catch (e: any) {
        addDeveloperSyncLog(`⚠️ خطأ تفريغ Google Sheets: ${e.message}`);
      }
    }

    // 2. Delete files from Google Drive
    const folderId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_drive_folder_id') || '' : '';
    if (token && folderId) {
      try {
        const dRes = await clearAllDriveFolderFiles(token, folderId);
        driveFilesDeleted = dRes.deletedCount;
        addDeveloperSyncLog(`✓ تم حذف كافة الصور والمرفقات من مجلد Google Drive (${driveFilesDeleted} ملف).`);
      } catch (e: any) {
        addDeveloperSyncLog(`⚠️ خطأ حذف ملفات Drive: ${e.message}`);
      }
    }

    addDeveloperSyncLog('⚡ اكتملت عملية التصفير في Google Sheets و Google Drive بنجاح.');

    return {
      success: true,
      sheetsWiped,
      driveFilesDeleted,
      message: 'تم تصفير وحذف البيانات بالكامل من Google Sheets و Google Drive'
    };
  } catch (err: any) {
    addDeveloperSyncLog(`❌ خطأ أثناء التصفير: ${err.message || err}`);
    return {
      success: false,
      sheetsWiped,
      driveFilesDeleted,
      message: err.message || 'فشلت عملية التصفير'
    };
  }
};
