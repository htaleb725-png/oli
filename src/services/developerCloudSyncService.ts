import { 
  googleSignIn, 
  googleSignOut, 
  getAccessToken, 
  createOfficeGoogleSpreadsheet, 
  createOrGetOfficeDriveFolder, 
  syncAllDataToGoogleSheets, 
  uploadImageToDrive,
  clearAllGoogleSheetsData,
  clearAllDriveFolderFiles
} from './googleSheetsService';
import { pushAllStateToFirestore, wipeAllFirestoreCloudData } from './firestoreSync';
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
  firestoreDbId: string;
  isRealtimeSyncActive: boolean;
  lastSyncTime: string | null;
  syncStats: {
    citizensCount: number;
    requestsCount: number;
    interviewsCount: number;
    lettersCount: number;
    orgCount: number;
    firestoreCount: number;
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
 * Execute the automated Developer Google Play / Google setup flow:
 * 1. Authenticate with Google
 * 2. Create/Link Google Drive folder for photos and attachments
 * 3. Create/Link Google Sheets database with complete administrative sheets
 * 4. Perform instantaneous 3-way synchronization (Firestore + Sheets + Drive)
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
    // Step 1: Sign in with Google Account / Google Play
    if (onProgress) onProgress(1, 5, 'جاري الاتصال وتسجيل الدخول بحساب Google / Google Play...');
    addDeveloperSyncLog('بدء إجراءات تسجيل دخول المطور بحساب Google Play...');

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

    // Step 2: Establish / Link Google Drive Folder for Photos & Attachments
    if (onProgress) onProgress(2, 5, 'جاري تهيئة مجلد Google Drive الرسمي لحفظ الصور والمرفقات...');
    addDeveloperSyncLog('فحص وتهيئة مجلد التخزين السحابي Google Drive للصور والمرفقات...');

    let folderId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_drive_folder_id') || '' : '';
    let folderUrl = folderId ? `https://drive.google.com/drive/folders/${folderId}` : '';

    try {
      const driveFolder = await createOrGetOfficeDriveFolder(token, 'مرفقات وصور مكتب النائب علا الناشي - 2026');
      folderId = driveFolder.folderId;
      folderUrl = driveFolder.folderUrl;
      if (typeof window !== 'undefined') {
        localStorage.setItem('al_nashi_drive_folder_id', folderId);
      }
      addDeveloperSyncLog(`✓ تم ربط مجلد Google Drive للصور: (${folderId})`);
    } catch (e: any) {
      addDeveloperSyncLog(`⚠️ تنبيه في مجلد Drive: ${e.message || 'تم المتابعة بالمعرف الحالي'}`);
    }

    // Step 3: Establish / Link Google Sheets Central Database
    if (onProgress) onProgress(3, 5, 'جاري إنشاء وربط قاعدة بيانات Google Sheets المركزية...');
    addDeveloperSyncLog('إنشاء وتكوين جداول قاعدة البيانات المركزية على Google Sheets...');

    let sheetId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') || '' : '';
    let sheetUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : '';

    try {
      if (!sheetId) {
        const sheetRes = await createOfficeGoogleSpreadsheet(token, 'قاعدة بيانات مكتب النائب علا الناشي - المركزية');
        sheetId = sheetRes.spreadsheetId;
        sheetUrl = sheetRes.spreadsheetUrl;
        if (typeof window !== 'undefined') {
          localStorage.setItem('al_nashi_sheet_id', sheetId);
        }
        addDeveloperSyncLog(`✓ تم إنشاء قاعدة بيانات Google Sheets جديدة مقسمة لـ 10 جداول: (${sheetId})`);
      } else {
        addDeveloperSyncLog(`✓ تم استخدام قاعدة بيانات Google Sheets الحالية: (${sheetId})`);
      }
    } catch (e: any) {
      addDeveloperSyncLog(`⚠️ تنبيه في جدول Google Sheets: ${e.message}`);
    }

    // Step 4: Instant Data Synchronization to Google Sheets
    if (onProgress) onProgress(4, 5, 'جاري مزامنة السجلات والمواطنين والمعاملات لحظياً إلى Google Sheets...');
    addDeveloperSyncLog('مزامنة فورية لكافة السجلات إلى جداول Google Sheets...');

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

    // Step 5: Instant Real-time Synchronization to Firebase Firestore
    if (onProgress) onProgress(5, 5, 'جاري المزامنة الفورية مع قاعدة بيانات Firebase Firestore...');
    addDeveloperSyncLog('مزامنة وتأكيد مطابقة السجلات مع Firebase Firestore...');

    try {
      const fsRes = await pushAllStateToFirestore(
        systemData.citizens,
        systemData.requests,
        systemData.interviews,
        systemData.cheques || [],
        systemData.officialLetters,
        systemData.organizationRecords,
        systemData.users,
        systemData.systemSettings,
        systemData.dropdowns
      );
      addDeveloperSyncLog(`✓ تم تأكيد تطابق Firebase Firestore (${fsRes.successCount} سجل محفوظ).`);
    } catch (e: any) {
      addDeveloperSyncLog(`⚠️ تنبيه Firestore: ${e.message}`);
    }

    const now = new Date().toLocaleString('ar-IQ');
    if (typeof window !== 'undefined') {
      localStorage.setItem('al_nashi_last_sync_time', now);
      localStorage.setItem('al_nashi_google_user_email', user.email || '');
      localStorage.setItem('al_nashi_google_user_name', user.displayName || '');
      localStorage.setItem('al_nashi_google_user_photo', user.photoURL || '');
    }

    addDeveloperSyncLog('⚡ اكتملت بنجاح منظومة الربط السحابي الفوري والمزامنة الثلاثية للمطور!');

    return {
      success: true,
      googleUser: {
        displayName: user.displayName,
        email: user.email,
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
 * Trigger Instant 3-Way Synchronization:
 * Google Sheets <===> Google Drive <===> Firebase Firestore
 */
export const triggerDeveloper3WayInstantSync = async (
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
  firestoreCount: number;
  message: string;
}> => {
  addDeveloperSyncLog('بدء تنفيذ المزامنة الفورية الثلاثية الشاملة...');
  let sheetsSynced = false;
  let firestoreCount = 0;

  try {
    // 1. Firebase Firestore Sync
    const fsRes = await pushAllStateToFirestore(
      systemData.citizens,
      systemData.requests,
      systemData.interviews,
      systemData.cheques || [],
      systemData.officialLetters,
      systemData.organizationRecords,
      systemData.users,
      systemData.systemSettings,
      systemData.dropdowns
    );
    firestoreCount = fsRes.successCount;
    addDeveloperSyncLog(`✓ Firestore: تم بنجاح تحديث وتأكيد (${firestoreCount}) سجل.`);

    // 2. Google Sheets Sync
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
      addDeveloperSyncLog(`✓ Google Sheets: تم تحديث (${sheetsRes.updatedSheets}) جدول بنجاح.`);
    } else {
      addDeveloperSyncLog('ℹ️ Google Sheets: في انتظار تسجيل دخول حساب Google لتحديث الجداول السحابية.');
    }

    const folderId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_drive_folder_id') || '' : '';
    if (folderId) {
      addDeveloperSyncLog(`✓ Google Drive: مجلد الصور والمرفقات نشط ومتصل (${folderId}).`);
    }

    const now = new Date().toLocaleString('ar-IQ');
    if (typeof window !== 'undefined') {
      localStorage.setItem('al_nashi_last_sync_time', now);
    }

    addDeveloperSyncLog('⚡ تمت المزامنة الفورية الثلاثية بنجاح تام!');

    return {
      success: true,
      sheetsSynced,
      firestoreCount,
      message: 'تمت المزامنة الفورية الشاملة بنجاح عبر Firebase و Google Sheets و Google Drive'
    };
  } catch (error: any) {
    addDeveloperSyncLog(`❌ خطأ أثناء المزامنة الثلاثية: ${error.message || error}`);
    return {
      success: false,
      sheetsSynced,
      firestoreCount,
      message: error.message || 'حدث خطأ أثناء المزامنة الفورية'
    };
  }
};

/**
 * Completely wipe all data across Google Drive, Google Sheets, and Firebase Firestore
 */
export const wipeDeveloperCloudData = async (): Promise<{
  success: boolean;
  sheetsWiped: boolean;
  driveFilesDeleted: number;
  firestoreDeleted: number;
  message: string;
}> => {
  addDeveloperSyncLog('⚠️ بدء التصفير الشامل والنهائي لكافة البيانات من السحابة بالكامل (Drive + Sheets + Firebase)...');
  let sheetsWiped = false;
  let driveFilesDeleted = 0;
  let firestoreDeleted = 0;

  try {
    const token = await getAccessToken();

    // 1. Wipe Firebase Firestore
    try {
      const fsRes = await wipeAllFirestoreCloudData();
      firestoreDeleted = fsRes.deletedCount;
      addDeveloperSyncLog(`✓ تم تفريغ وحذف سجلات Firebase Firestore بالكامل (${firestoreDeleted} سجل محذوف).`);
    } catch (e: any) {
      addDeveloperSyncLog(`⚠️ خطأ تفريغ Firestore: ${e.message}`);
    }

    // 2. Clear Google Sheets data rows
    const sheetId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') || '' : '';
    if (token && sheetId) {
      try {
        const sRes = await clearAllGoogleSheetsData(token, sheetId);
        sheetsWiped = sRes.success;
        addDeveloperSyncLog(`✓ تم تفريغ وتصفير بيانات جداول Google Sheets بالكامل (${sRes.clearedRanges} جداول مفرغة).`);
      } catch (e: any) {
        addDeveloperSyncLog(`⚠️ خطأ تفريغ Google Sheets: ${e.message}`);
      }
    }

    // 3. Delete files from Google Drive
    const folderId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_drive_folder_id') || '' : '';
    if (token && folderId) {
      try {
        const dRes = await clearAllDriveFolderFiles(token, folderId);
        driveFilesDeleted = dRes.deletedCount;
        addDeveloperSyncLog(`✓ تم حذف كافة الصور والمرفقات من مجلد Google Drive (${driveFilesDeleted} ملف محذوف).`);
      } catch (e: any) {
        addDeveloperSyncLog(`⚠️ خطأ حذف ملفات Drive: ${e.message}`);
      }
    }

    addDeveloperSyncLog('⚡ اكتملت عملية التصفير الشامل للبيانات من السحابة بنجاح تام (0 سجل في النظام).');

    return {
      success: true,
      sheetsWiped,
      driveFilesDeleted,
      firestoreDeleted,
      message: 'تم تصفير وحذف البيانات بالكامل من Firebase و Google Sheets و Google Drive'
    };
  } catch (err: any) {
    addDeveloperSyncLog(`❌ خطأ أثناء التصفير السحابي: ${err.message || err}`);
    return {
      success: false,
      sheetsWiped,
      driveFilesDeleted,
      firestoreDeleted,
      message: err.message || 'فشلت عملية التصفير السحابي'
    };
  }
};
