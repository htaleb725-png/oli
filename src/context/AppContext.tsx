import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { MAX_VALID_OUTGOING_SEQ, scanMaxOutgoingSequences } from '../utils/outgoingNumberHelper';
import { toCleanSheetCitizenPayload, toCleanSheetRequestPayload } from '../services/googleSheetsSchema';
import { extractDriveFolderId } from '../services/driveArchiveService';
import {
  User,
  Citizen,
  OfficeRequest,
  ProcessingStatus,
  Interview,
  OrganizationRecord,
  OfficialLetter,
  DropdownItem,
  AuditLog,
  DynamicField,
  DocumentArchiveItem,
  WhatsAppTemplate,
  SystemSettings,
  WorkflowStage,
  WorkflowAction,
  ChequeRecord,
  CustomSection,
  CustomSectionRecord,
  CustomFieldDefinition,
  UiCustomizationSettings,
  SmartArchiveDossierData,
  UrgentNotification
} from '../types';
import {
  fsSaveCitizen,
  fsDeleteCitizen,
  fsSaveRequest,
  fsDeleteRequest,
  fsSaveInterview,
  fsDeleteInterview,
  fsSaveOfficialLetter,
  fsDeleteOfficialLetter,
  fsSaveCheque,
  fsDeleteCheque,
  fsSaveOrgRecord,
  fsSaveUser,
  fsDeleteUser,
  fsSyncAllUsers,
  fsCheckConnection,
  fsSaveSettings,
  fsGetSettings,
  fsSaveDropdown,
  fsDeleteDropdown,
  buildSafeDropdownDocId,
  fsSaveCustomSection,
  fsDeleteCustomSection,
  fsSaveCustomRecord,
  fsDeleteCustomRecord,
  fsSaveDeveloperPasscode,
  fsGetDeveloperPasscode,
  fsVerifyLogin,
  fsBulkPushAll,
  fsBulkPullAll,
  fsBulkSaveCitizensAndRequests,
  fsSaveNotification,
  fsMarkNotificationRead,
  fsDeleteNotification,
  fsWatchCollection,
  fsWatchCloudConfig,
  fsWatchDeletedRecords,
  fsReconcileDeletedDocs,
  fsWipeAllCollections,
  fsWipeSelectedCollections,
  isFirestoreTemporarilyBlocked,
  FS_COLLECTIONS
} from '../services/firebaseFirestoreService';
import { getHomeSectionForRole } from '../utils/permissions';
import {
  INITIAL_SETTINGS,
  INITIAL_USERS,
  INITIAL_DROPDOWNS,
  INITIAL_CITIZENS,
  INITIAL_REQUESTS,
  INITIAL_CHEQUES,
  INITIAL_INTERVIEWS,
  INITIAL_ORGANIZATION,
  INITIAL_AUDIT_LOGS,
  INITIAL_DYNAMIC_FIELDS,
  INITIAL_DOCUMENTS,
  INITIAL_WHATSAPP_TEMPLATES
} from '../data/initialData';
import { findBestArabicMatch } from '../utils/arabicNameMatcher';
import { clearAllImagesFromDB } from '../utils/imageDb';
import { pushToGoogleSheetsRealtime, pushBulkDataToGoogleSheets, pullDataFromGoogleAppsScript, verifyLoginWithGoogleSheets, setRuntimeCloudConfig, setRuntimeCustomSections, wipeGoogleSheetsViaAppsScript } from '../services/realtimeGoogleSync';
import { pushCloudSyncAlert } from '../services/cloudSyncAlerts';
import { sheetsIntegration } from '../services/sheetsIntegrationLayer';
import { 
  loginAndSetupDeveloperCloud, 
  triggerDeveloperGoogleSync, 
  pullAllDataFromGoogleSheets, 
  wipeDeveloperCloudData 
} from '../services/developerCloudSyncService';
import { 
  autoUploadImageToDriveIfConnected,
  googleSignOut,
  deleteRecordFromSheetsRealtime,
  ensureSheetTabExists
} from '../services/googleSheetsService';
import { safeLocalStorageSet, scheduleSafeLocalStorageSet, sanitizeRequestsForStorage, cleanBloatedLocalStorage, purgeLegacyBrowserBusinessData } from '../utils/safeStorage';
import { clearBusinessRecordsFromIDB, idbSetJSON } from '../utils/persistentStorage';
import {
  mergeCitizens,
  mergeRequests,
  mergeInterviews,
  mergeOfficialLetters,
  mergeCheques,
  mergeOrganizationRecords,
  mergeCustomSections,
  mergeCustomRecords,
  mergeUsers,
  fillMissingFieldsOnly,
  getRecordTimestamp
} from '../services/dataMerge';
import { autoSyncAllSchemas } from '../services/schemaAutoDiscovery';
import {
  receptionDomain,
  adminRequestsDomain,
  interviewsDomain,
  organizationDomain,
  lettersDomain,
  chequesDomain,
  customSectionsDomain
} from '../services/domainControllers';

// Purge any legacy business records from Chrome localStorage immediately on module load
// (only login session & UI appearance/theme preferences remain allowed in browser storage)
cleanBloatedLocalStorage();
purgeLegacyBrowserBusinessData();

// Unique per-tab client ID to avoid echoing our own SSE/BroadcastChannel mutations back to ourselves
const LIVE_SYNC_CLIENT_ID = `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

// Same-browser cross-tab / multi-window / Desktop PWA instant channel (works even on static Vercel deployments & offline!)
const LIVE_SYNC_CHANNEL_NAME = 'al_nashi_office_live_sync_v1';
let _liveBroadcastChannel: BroadcastChannel | null = null;
function getLiveBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  if (!_liveBroadcastChannel) {
    try {
      _liveBroadcastChannel = new BroadcastChannel(LIVE_SYNC_CHANNEL_NAME);
    } catch {
      return null;
    }
  }
  return _liveBroadcastChannel;
}

function postCrossTabMessage(msg: Record<string, any>): void {
  try {
    const ch = getLiveBroadcastChannel();
    if (ch) ch.postMessage({ ...msg, clientId: LIVE_SYNC_CLIENT_ID });
  } catch {}
}

function emitServerMutation(
  entity:
    | 'citizens'
    | 'requests'
    | 'interviews'
    | 'officialLetters'
    | 'cheques'
    | 'organizationRecords'
    | 'dropdowns'
    | 'customSections'
    | 'customRecords'
    | 'documents'
    | 'notifications'
    | 'users',
  op: 'upsert' | 'delete',
  payload: { item?: any; id?: string }
): void {
  if (typeof window === 'undefined') return;
  // 1. Instant <5ms cross-tab sync across all open department tabs/windows in same browser/PWA
  postCrossTabMessage({ type: 'mutation', entity, op, item: payload.item, id: payload.id });
  // 2. Unified server-side live store + SSE broadcast (works identically on Vercel & Node!)
  try {
    fetch('/api/sync/state?mode=mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'mutate',
        entity,
        op,
        item: payload.item,
        id: payload.id,
        clientId: LIVE_SYNC_CLIENT_ID
      })
    }).catch(() => {});
  } catch {}
}

function emitServerBulk(payload: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  // 1. Instant cross-tab sync for bulk imports & settings
  postCrossTabMessage({ type: 'bulk_payload', payload });
  // 2. Unified server-side live store + SSE broadcast (works identically on Vercel & Node!)
  try {
    fetch('/api/sync/state?mode=bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'bulk',
        ...payload,
        clientId: LIVE_SYNC_CLIENT_ID
      })
    }).catch(() => {});
  } catch {}
}

// Strictly In-Memory Deleted IDs Registry (hydrated live from Firebase Firestore `deleted_records` — ZERO localStorage/sessionStorage!)
const _inMemoryDeletedIds = new Set<string>();

export const getStoredDeletedIds = (): Set<string> => {
  return new Set(_inMemoryDeletedIds);
};

export const recordDeletedId = (id: string) => {
  if (!id || typeof id !== 'string') return;
  const clean = id.trim();
  if (!clean || clean === 'undefined' || clean === 'null') return;
  _inMemoryDeletedIds.add(clean);
};

const syncInMemoryDeletedIdsFromCloud = (ids: string[]) => {
  _inMemoryDeletedIds.clear();
  for (const rawId of ids) {
    const clean = String(rawId || '').trim();
    if (clean && clean !== 'undefined' && clean !== 'null') {
      _inMemoryDeletedIds.add(clean);
    }
  }
};

const clearInMemoryDeletedIds = () => {
  _inMemoryDeletedIds.clear();
};

export type { UrgentNotification } from '../types';

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
  login: (usernameOrCode: string, pass?: string, mode?: 'passcode' | 'credentials') => Promise<boolean>;
  lastLoginError: string | null;
  logout: () => void;
  switchUser: (user: User) => void;
  assignedWorkstationUser: User | null;
  assignWorkstationUser: (user: User | null) => void;
  directLoginAsAssigned: () => boolean;
  addUser: (user: Omit<User, 'User_ID'>) => Promise<{ user: User; serverOk: boolean; firebaseOk: boolean; sheetsOk: boolean; firebaseError?: string }>;
  updateUser: (user: User) => Promise<{ user: User; serverOk: boolean; firebaseOk: boolean; sheetsOk: boolean; firebaseError?: string }>;
  deleteUser: (userId: string) => Promise<{ serverOk: boolean; firebaseOk: boolean }>;
  syncUsersToAllDatabasesNow: () => Promise<{ serverOk: boolean; firebaseOk: boolean; sheetsOk: boolean; count: number; firebaseError?: string }>;
  checkCloudDbHealth: () => Promise<{ serverOk: boolean; firebaseOk: boolean; firebaseError?: string }>;

  activeSection: string;
  setActiveSection: (section: string) => void;
  isSplashOpen: boolean;
  setIsSplashOpen: (open: boolean) => void;
  isAuthenticated: boolean;

  citizens: Citizen[];
  addCitizen: (citizen: Omit<Citizen, 'Citizen_ID' | 'CreatedAt'>) => Citizen;
  updateCitizen: (citizen: Citizen) => void;
  deleteCitizen: (citizenId: string) => void;
  findCitizenByIdOrName: (query: string) => Citizen[];
  blockCitizen: (citizenId: string, reason: string, blockedBy?: string, fallbackInfo?: { FullName: string; Phone1?: string; District?: string }) => void;
  unblockCitizen: (citizenId: string) => void;
  checkIfCitizenBlocked: (nameOrId: string, phone?: string) => { isBlocked: boolean; citizen?: Citizen; reason?: string };

  requests: OfficeRequest[];
  addRequest: (
    req: Omit<OfficeRequest, 'Request_ID' | 'CreatedAt'> & { Request_ID?: string },
    options?: { skipAuditLog?: boolean; skipNotification?: boolean }
  ) => OfficeRequest;
  updateRequest: (req: OfficeRequest) => void;
  deleteRequest: (requestId: string) => void;
  bulkUpdateRequestsStatus: (citizenNames: string[], newStatus: ProcessingStatus, notes?: string) => { updatedCount: number; updatedRequests: OfficeRequest[] };

  cheques: ChequeRecord[];
  addCheque: (cheque: Omit<ChequeRecord, 'id' | 'CreatedAt'>) => ChequeRecord;
  updateCheque: (cheque: ChequeRecord) => void;
  deleteCheque: (id: string) => void;

  interviews: Interview[];
  addInterview: (interview: Omit<Interview, 'Interview_ID' | 'CreatedAt'>) => Interview;
  updateInterview: (interview: Interview) => void;
  deleteInterview: (interviewId: string) => void;
  convertInterviewToRequest: (interviewId: string, targetEntity?: string) => OfficeRequest | null;

  organizationRecords: OrganizationRecord[];
  upsertOrgRecord: (record: Omit<OrganizationRecord, 'Org_ID' | 'UpdatedAt'>) => void;
  addOrganizationRecord: (record: Omit<OrganizationRecord, 'Org_ID' | 'UpdatedAt'>) => void;
  updateOrganizationRecord: (record: OrganizationRecord) => void;

  dropdowns: DropdownItem[];
  addDropdownItem: (category: string, value: string) => void;
  removeDropdownItem: (category: string, value: string) => void;
  getDropdownOptions: (category: string) => string[];

  auditLogs: AuditLog[];
  addAuditLog: (action: string, section: string, details: string) => void;

  dynamicFields: DynamicField[];
  addDynamicField: (field: Omit<DynamicField, 'id'>) => void;
  deleteDynamicField: (id: string) => void;

  documents: DocumentArchiveItem[];
  addDocument: (doc: Omit<DocumentArchiveItem, 'Doc_ID' | 'UploadedAt'>, options?: { skipAuditLog?: boolean }) => void;
  deleteDocument: (docId: string) => void;

  whatsappTemplates: WhatsAppTemplate[];
  officialLetters: OfficialLetter[];
  addOfficialLetter: (letter: Omit<OfficialLetter, 'Letter_ID'>) => void;
  updateOfficialLetter: (letter: OfficialLetter) => void;
  deleteOfficialLetter: (letterId: string) => void;
  systemSettings: SystemSettings;
  updateSettings: (settings: Partial<SystemSettings>) => void;
  updateSystemSettings: (settings: Partial<SystemSettings>) => void;

  notifications: UrgentNotification[];
  addNotification: (notif: Omit<UrgentNotification, 'id' | 'timestamp' | 'read'> & { id?: string; timestamp?: string; read?: boolean }) => void;
  markNotificationAsRead: (id: string) => void;
  dismissNotification: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearReadNotifications: () => void;

  departmentGreeting: { title: string; message: string; date: string } | null;
  setDepartmentGreeting: (val: { title: string; message: string; date: string } | null) => void;
  triggerDepartmentGreeting: (user: User, departmentName?: string) => void;

  printableCitizenCard: Citizen | null;
  setPrintableCitizenCard: (citizen: Citizen | null) => void;
  printableBadgeCitizen: Citizen | null;
  setPrintableBadgeCitizen: (citizen: Citizen | null) => void;
  printableArchiveCitizen: SmartArchiveDossierData | null;
  setPrintableArchiveCitizen: (data: SmartArchiveDossierData | null) => void;
  smartArchiveCitizen: (citizenId: string, notes?: string) => { success: boolean; citizen: Citizen | null; archivedRequestsCount: number; archiveCode: string };
  selectedCitizenForHistory: Citizen | null;
  setSelectedCitizenForHistory: (citizen: Citizen | null) => void;
  isDesktopInstallModalOpen: boolean;
  setIsDesktopInstallModalOpen: (open: boolean) => void;
  isSystemWipeModalOpen: boolean;
  setIsSystemWipeModalOpen: (open: boolean) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;

  forwardCitizenWorkflow: (citizenId: string, toStage: WorkflowStage, directiveNote?: string, targetEntity?: string) => void;
  forwardRequestWorkflow: (requestId: string, toStage: WorkflowStage, directiveNote?: string) => void;

  canPrintOfficialCard: (user: User | null) => boolean;
  exportToExcel: (data: any[], fileName: string) => void;
  resetToDefaultData: () => void;
  resetToInitialData: () => void;
  wipeAllSystemData: () => Promise<void>;
  wipeSelectedSections: (sectionKeys: string[]) => Promise<void>;
  isSystemZeroed: boolean;
  isGoogleConnected: boolean;
  isGoogleSyncing: boolean;
  googleUserEmail: string;
  spreadsheetId: string | null;
  driveFolderId: string | null;
  setGoogleDriveFolderId: (folderId: string) => void;
  syncAllToGoogleSheetsNow: () => Promise<{ success: boolean; sheetsSynced?: boolean; message: string }>;
  fetchAllFromGoogleSheetsNow: () => Promise<{ success: boolean; message: string }>;
  loginWithGoogleDeveloper: (onProgress?: (step: number, totalSteps: number, message: string) => void) => Promise<{ success: boolean; cancelled?: boolean; error?: string | null }>;
  triggerDeveloperGoogleSync: () => Promise<{ success: boolean; sheetsSynced?: boolean; message: string }>;
  sheetsIntegration: typeof sheetsIntegration;
  // Custom Dynamic Sections & Records
  customSections: CustomSection[];
  addCustomSection: (section: Omit<CustomSection, 'id' | 'createdAt'>) => CustomSection;
  updateCustomSection: (section: CustomSection) => void;
  deleteCustomSection: (sectionId: string) => void;
  customRecords: CustomSectionRecord[];
  addCustomRecord: (record: Omit<CustomSectionRecord, 'id' | 'createdAt'>) => CustomSectionRecord;
  updateCustomRecord: (record: CustomSectionRecord) => void;
  deleteCustomRecord: (recordId: string) => void;

  // Developer Passcode & Controls
  developerPasscode: string;
  setDeveloperPasscode: (code: string) => Promise<boolean>;
  loginWithDeveloperPasscode: (code: string) => boolean;

  // Reception Custom Fields (حقول الاستعلامات والمراجعين المخصصة)
  addReceptionCustomField: (field: Omit<CustomFieldDefinition, 'id' | 'name'>) => CustomFieldDefinition;
  deleteReceptionCustomField: (fieldId: string) => void;
  toggleReceptionDefaultField: (fieldKey: string) => void;

  // UI Customizations
  updateUiCustomizations: (customizations: Partial<UiCustomizationSettings>) => void;

  // 2-Second Employee Entry Loading Message & Data Hydration
  isSessionLoading: boolean;
  sessionLoadingMessage: string;
  triggerSessionDataLoad: (customMsg?: string) => void;
  canDownloadDatabase: (role?: string) => boolean;
  refreshAllDataFromAllSources: () => Promise<void>;

  // Firestore Direct Sync
  isFirestoreSyncing: boolean;
  syncAllToFirestoreNow: () => Promise<{ successCount: number; total: number; error?: string }>;
  fetchAllFromFirestoreNow: () => Promise<{ success: boolean; error?: string }>;

  // High-performance atomic bulk import
  batchImportRecords: (
    newCitizens: Citizen[],
    newRequests: OfficeRequest[]
  ) => Promise<{ importedCitizens: number; importedRequests: number; firestoreSaved?: boolean; sheetsDispatched?: boolean }>;

  // Compatibility aliases
  triggerDeveloper3WaySync?: () => Promise<{ success: boolean; sheetsSynced?: boolean; message: string }>;
  isSupabaseConnected?: boolean;
  isSupabaseSyncing?: boolean;
  syncAllDataToSupabase?: () => Promise<{ success: boolean; message: string; counts?: Record<string, number> }>;
  fetchAllDataFromSupabase?: () => Promise<{ success: boolean; message: string }>;
}

export const isStrictValidCitizen = (c: any): boolean => {
  if (!c || typeof c !== 'object') return false;
  const cid = String(c.Citizen_ID || '').trim();
  if (!cid) return false;
  const name = String(c.FullName || '').trim();
  if (name.length < 2) return false;
  const lower = name.toLowerCase();
  if (
    lower === 'undefined' ||
    lower === 'null' ||
    lower === 'مواطن بدون اسم' ||
    lower === '[object object]' ||
    lower === 'الاسم' ||
    lower === 'اسم المواطن' ||
    lower === 'ت' ||
    lower === 'name' ||
    lower === 'full name' ||
    lower === 'مراجع' ||
    lower === 'مراجع عام'
  ) {
    return false;
  }
  return true;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'ola_alnashi_office_';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load state from localStorage or initial defaults
  const [developerPasscode, setDeveloperPasscodeState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_PREFIX + 'dev_passcode') || INITIAL_SETTINGS.developerPasscode || '2026';
    } catch {
      return '2026';
    }
  });

  const [customSections, setCustomSections] = useState<CustomSection[]>(() => {
    const defaultSections: CustomSection[] = [
      {
        id: 'sec_social_welfare',
        title: 'قسم الرعاية الاجتماعية وشبكة الحماية',
        description: 'متابعة معاملات شبكة الحماية الاجتماعية، إصدار الماستر كارد، راتب المعين المتفرغ، والمسح الميداني للباحث الاجتماعي',
        badgeColor: 'emerald',
        icon: 'HeartHandshake',
        isStandaloneRestricted: true,
        allowedRoles: ['developer', 'director', 'deputy', 'social_care', 'social_care_officer'],
        createdAt: '2026-03-01',
        createdBy: 'مطور النظام',
        fields: [
          {
            id: 'f_welf_name',
            name: 'citizen_name',
            label: 'اسم المواطن / صاحب القيد الرباعي',
            type: 'text',
            required: true,
            placeholder: 'مثال: جاسم محمد خضير الركابي'
          },
          {
            id: 'f_welf_phone',
            name: 'phone',
            label: 'رقم هاتف المراجع للتواصل',
            type: 'text',
            required: true,
            placeholder: '07800000000'
          },
          {
            id: 'f_welf_code',
            name: 'welfare_code',
            label: 'رقم القيد / رقم المعاملة الوزارية',
            type: 'text',
            required: true,
            placeholder: 'مثال: رع/ذي/2026/894'
          },
          {
            id: 'f_welf_type',
            name: 'case_type',
            label: 'نوع الإعانة أو الفئة المشمولة',
            type: 'dropdown',
            required: true,
            options: [
              'شبكة الحماية الاجتماعية (رجال)',
              'شبكة الحماية الاجتماعية (نساء وأرامل ومطلقات)',
              'راتب المعين المتفرغ (هيئة رعاية ذوي الإعاقة)',
              'إصدار وتجديد الماستر كارد (كي كارد)',
              'اعتراض وتقارير اللجان الطبية',
              'تحديث البيانات والبيان السنوي'
            ]
          },
          {
            id: 'f_welf_researcher',
            name: 'researcher_status',
            label: 'موقف الباحث الاجتماعي والمسح الميداني',
            type: 'dropdown',
            required: false,
            options: [
              'تمت زيارة الباحث الاجتماعي بنجاح',
              'بانتظار وصول الباحث الميداني',
              'مرفوض من الباحث (فوق خط الفقر)',
              'ملف مدقق ومكتمل بانتظار التخصيص المالي'
            ]
          },
          {
            id: 'f_welf_district',
            name: 'district',
            label: 'القضاء / محل السكن',
            type: 'dropdown',
            required: true,
            options: [
              'الناصرية (المركز)',
              'الشطرة',
              'الرفاعي',
              'سوق الشيوخ',
              'الجبايش',
              'قلعة سكر',
              'الدواية',
              'الغراف',
              'البطحاء',
              'سيد دخيل',
              'الفهود',
              'الإصلاح',
              'الطار',
              'أخرى'
            ]
          },
          {
            id: 'f_welf_date',
            name: 'submission_date',
            label: 'تاريخ استلام ومتابعة المعاملة',
            type: 'date',
            required: false
          },
          {
            id: 'f_welf_doc',
            name: 'attachment',
            label: 'صورة الطلب أو القرار الطبي / كتاب الشمول',
            type: 'image',
            required: false,
            helpText: 'رفع صورة التقرير أو الوثيقة الرسمية'
          },
          {
            id: 'f_welf_notes',
            name: 'notes',
            label: 'ملاحظات وتوجيهات متابعة المعاملة',
            type: 'textarea',
            required: false,
            placeholder: 'اكتب التوجيهات أو الملاحظات الخاصة بوزارة العمل...'
          }
        ]
      }
    ];

    // Cloud-First: hydrate customSections exclusively from Firebase Firestore / Server API (never Chrome localStorage)
    return defaultSections;
  });

  // Cloud-First: business customRecords come strictly from Firebase Firestore & Google Sheets (zero Chrome caching)
  const [customRecords, setCustomRecords] = useState<CustomSectionRecord[]>([]);

  const [isFirestoreSyncing, setIsFirestoreSyncing] = useState<boolean>(false);

  const normalizeSystemSettings = (raw?: Partial<SystemSettings> | null): SystemSettings => {
    const merged: SystemSettings = {
      ...INITIAL_SETTINGS,
      ...(raw || {}),
      customImages: {
        ...(INITIAL_SETTINGS.customImages || {}),
        ...(raw?.customImages || {})
      }
    };
    // Upgrade legacy placeholder Unsplash / Wikimedia logo URLs to the real office logo
    if (
      !merged.logoUrl ||
      merged.logoUrl.includes('images.unsplash.com/photo-1589829545856') ||
      merged.logoUrl.includes('upload.wikimedia.org')
    ) {
      merged.logoUrl = '/office-logo.png';
    }
    if (
      !merged.parliamentEmblemUrl ||
      merged.parliamentEmblemUrl.includes('images.unsplash.com/photo-1589829545856') ||
      merged.parliamentEmblemUrl.includes('upload.wikimedia.org')
    ) {
      merged.parliamentEmblemUrl = '/office-logo.png';
    }
    if (!merged.customImages?.loadingEmblem || merged.customImages.loadingEmblem.includes('unsplash.com')) {
      merged.customImages = { ...(merged.customImages || {}), loadingEmblem: merged.logoUrl || '/office-logo.png' };
    }
    if (!merged.pwaIcon192 || merged.pwaIcon192.startsWith('data:image/')) {
      merged.pwaIcon192 = '/icon-192.png';
    }
    if (!merged.pwaIcon512 || merged.pwaIcon512.startsWith('data:image/')) {
      merged.pwaIcon512 = '/icon-512.png';
    }
    // Upgrade legacy Google sample sheet ID or empty Apps Script URL to the real office cloud endpoints
    if (!merged.googleSheetId || merged.googleSheetId === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms') {
      merged.googleSheetId = INITIAL_SETTINGS.googleSheetId;
      merged.activeGoogleSheetId = INITIAL_SETTINGS.activeGoogleSheetId;
      merged.activeGoogleSheetUrl = INITIAL_SETTINGS.activeGoogleSheetUrl;
    }
    const envScriptUrl = String((import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL || '').trim();
    if (envScriptUrl && envScriptUrl.startsWith('https://script.google.com/macros/s/') && envScriptUrl.includes('/exec')) {
      if (!merged.appsScriptUrl || merged.appsScriptUrl === INITIAL_SETTINGS.appsScriptUrl || !merged.appsScriptUrl.includes('/exec')) {
        merged.appsScriptUrl = envScriptUrl;
      }
      try {
        if (typeof window !== 'undefined') {
          const cached = localStorage.getItem('al_nashi_apps_script_url');
          if (!cached || cached === INITIAL_SETTINGS.appsScriptUrl || !cached.includes('/exec')) {
            localStorage.setItem('al_nashi_apps_script_url', envScriptUrl);
          }
        }
      } catch {}
    } else if (!merged.appsScriptUrl && INITIAL_SETTINGS.appsScriptUrl) {
      merged.appsScriptUrl = INITIAL_SETTINGS.appsScriptUrl;
    }
    if (!merged.googleDriveFolderId && INITIAL_SETTINGS.googleDriveFolderId) {
      merged.googleDriveFolderId = INITIAL_SETTINGS.googleDriveFolderId;
    }
    return merged;
  };

  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'settings');
      const parsed = saved ? JSON.parse(saved) : INITIAL_SETTINGS;
      const normalized = normalizeSystemSettings(parsed);
      safeLocalStorageSet(STORAGE_KEY_PREFIX + 'settings', JSON.stringify(normalized));
      return normalized;
    } catch {
      return INITIAL_SETTINGS;
    }
  });
  // Synchronous ref prevents stale-closure overwrites when consecutive updateSettings calls fire in the same tick
  const systemSettingsRef = useRef<SystemSettings>(systemSettings);
  systemSettingsRef.current = systemSettings;

  // Cloud-First: staff accounts hydrate live from Firebase Firestore & Google Sheets (never cached in Chrome localStorage)
  const [users, setUsers] = useState<User[]>(() => [...INITIAL_USERS]);

  const [departmentGreeting, setDepartmentGreeting] = useState<{ title: string; message: string; date: string } | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Default to developer or director for smooth initial experience
    return INITIAL_USERS[0];
  });

  const [assignedWorkstationUser, setAssignedWorkstationUserState] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'assigned_workstation_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isSplashOpen, setIsSplashOpen] = useState<boolean>(true);
  const [lastLoginError, setLastLoginError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(false);
  const [sessionLoadingMessage, setSessionLoadingMessage] = useState<string>('يرجى الانتظار لتحميل بياناتك...');
  const [isSystemZeroed, setIsSystemZeroed] = useState<boolean>(false);

  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(() => {
    return !!(typeof window !== 'undefined' && localStorage.getItem('al_nashi_google_token'));
  });
  const [isGoogleSyncing, setIsGoogleSyncing] = useState<boolean>(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('al_nashi_google_user_email')) || 'htaleb725@gmail.com';
  });
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('al_nashi_sheet_id')) || null;
  });
  const [driveFolderId, setDriveFolderId] = useState<string | null>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('al_nashi_drive_folder_id')) || null;
  });
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  // Strict Cloud-First State Initialization:
  // Zero office business records are read from or cached in Chrome localStorage/IndexedDB.
  // All collections hydrate live from Firebase Firestore + Google Sheets + Server API.
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [requests, setRequests] = useState<OfficeRequest[]>([]);
  const [cheques, setCheques] = useState<ChequeRecord[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [organizationRecords, setOrganizationRecords] = useState<OrganizationRecord[]>([]);
  const [dropdowns, setDropdowns] = useState<DropdownItem[]>(() => [...INITIAL_DROPDOWNS]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>(() => [...INITIAL_DYNAMIC_FIELDS]);
  const [documents, setDocuments] = useState<DocumentArchiveItem[]>([]);
  const [officialLetters, setOfficialLetters] = useState<OfficialLetter[]>([]);

  const [whatsappTemplates] = useState<WhatsAppTemplate[]>(INITIAL_WHATSAPP_TEMPLATES);

  const [notifications, setNotifications] = useState<UrgentNotification[]>([]);

  const [printableCitizenCard, setPrintableCitizenCard] = useState<Citizen | null>(null);
  const [printableBadgeCitizen, setPrintableBadgeCitizen] = useState<Citizen | null>(null);
  const [printableArchiveCitizen, setPrintableArchiveCitizen] = useState<SmartArchiveDossierData | null>(null);
  const [selectedCitizenForHistory, setSelectedCitizenForHistory] = useState<Citizen | null>(null);
  const [isDesktopInstallModalOpen, setIsDesktopInstallModalOpen] = useState<boolean>(false);
  const [isSystemWipeModalOpen, setIsSystemWipeModalOpen] = useState<boolean>(false);

  // Cloud-First Architecture: propagate Firestore settings (Apps Script URL, Google Sheet ID, Drive Folder ID)
  // straight into in-memory cloud config so Vercel & every browser uses Cloud DB (Firestore + Google Sheets + Drive)
  // rather than storing business data inside Chrome localStorage.
  useEffect(() => {
    const cleanDriveId = systemSettings.googleDriveFolderId
      ? extractDriveFolderId(systemSettings.googleDriveFolderId)
      : '';
    setRuntimeCloudConfig({
      appsScriptUrl: systemSettings.appsScriptUrl || systemSettings.googleAppsScriptUrl,
      googleSheetId: systemSettings.googleSheetId || systemSettings.activeGoogleSheetId,
      googleDriveFolderId: cleanDriveId || undefined
    });
    if (cleanDriveId && cleanDriveId !== driveFolderId) {
      setDriveFolderId(cleanDriveId);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('al_nashi_drive_folder_id', cleanDriveId);
        }
      } catch {}
    }
    if (systemSettings.googleSheetId && systemSettings.googleSheetId !== spreadsheetId) {
      setSpreadsheetId(systemSettings.googleSheetId);
    }
  }, [
    systemSettings.appsScriptUrl,
    systemSettings.googleAppsScriptUrl,
    systemSettings.googleSheetId,
    systemSettings.activeGoogleSheetId,
    systemSettings.googleDriveFolderId
  ]);

  // Live state refs so the real-time heartbeat can detect and push any unsynced local records at any moment
  const citizensRef = useRef<Citizen[]>(citizens);
  citizensRef.current = citizens;
  const requestsRef = useRef<OfficeRequest[]>(requests);
  requestsRef.current = requests;
  const interviewsRef = useRef<Interview[]>(interviews);
  interviewsRef.current = interviews;
  const officialLettersRef = useRef<OfficialLetter[]>(officialLetters);
  officialLettersRef.current = officialLetters;
  const chequesRef = useRef<ChequeRecord[]>(cheques);
  chequesRef.current = cheques;
  const organizationRecordsRef = useRef<OrganizationRecord[]>(organizationRecords);
  organizationRecordsRef.current = organizationRecords;
  const customSectionsRef = useRef<CustomSection[]>(customSections);
  customSectionsRef.current = customSections;
  const customRecordsRef = useRef<CustomSectionRecord[]>(customRecords);
  customRecordsRef.current = customRecords;
  const dropdownsRef = useRef<DropdownItem[]>(dropdowns);
  dropdownsRef.current = dropdowns;
  const usersRef = useRef<User[]>(users);
  usersRef.current = users;

  // Keep runtime customSections registry in sync so every custom_record knows its exact Google Sheet tab & columns
  useEffect(() => {
    setRuntimeCustomSections(customSections);
  }, [customSections]);

  // Strict Chrome Storage Policy: purge legacy business data from Chrome localStorage & IndexedDB on mount
  useEffect(() => {
    purgeLegacyBrowserBusinessData();
    clearBusinessRecordsFromIDB().catch(() => {});
  }, []);

  // Only UI appearance / theme / workstation preferences are persisted locally; NEVER office business records
  useEffect(() => {
    const normalized = normalizeSystemSettings(systemSettings);
    scheduleSafeLocalStorageSet(STORAGE_KEY_PREFIX + 'settings', () => JSON.stringify(normalized));
    idbSetJSON(STORAGE_KEY_PREFIX + 'settings', normalized).catch(() => {});
  }, [systemSettings]);

  const getCloudCtx = () => ({
    appsScriptUrl: systemSettingsRef.current.appsScriptUrl || systemSettingsRef.current.googleAppsScriptUrl,
    googleSheetId: systemSettingsRef.current.googleSheetId || systemSettingsRef.current.activeGoogleSheetId,
    customSections: customSectionsRef.current
  });

  // Real-Time Firestore & Shared Server Synchronization Listeners
  // Runs immediately on mount so Vercel, AI Studio, and Desktop PWA stay synced live (<100ms) across all computers & browsers
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    const purgeDeletedIdsEverywhere = (idsToRemove: string[]) => {
      if (!Array.isArray(idsToRemove) || idsToRemove.length === 0) return;
      const delSet = getStoredDeletedIds();
      let addedNew = false;
      for (const rawId of idsToRemove) {
        const clean = String(rawId || '').trim();
        if (!clean) continue;
        if (!delSet.has(clean)) {
          addedNew = true;
          delSet.add(clean);
        }
        recordDeletedId(clean);
      }
      if (!addedNew && idsToRemove.length === 0) return;
      const removeSet = new Set(idsToRemove.map(i => String(i || '').trim()).filter(Boolean));
      if (removeSet.size === 0) return;

      setCitizens(prev => prev.some(c => removeSet.has(c.Citizen_ID)) ? prev.filter(c => !removeSet.has(c.Citizen_ID)) : prev);
      setRequests(prev => prev.some(r => removeSet.has(r.Request_ID) || removeSet.has(r.Citizen_ID))
        ? prev.filter(r => !removeSet.has(r.Request_ID) && !removeSet.has(r.Citizen_ID))
        : prev
      );
      setInterviews(prev => prev.some(i => removeSet.has(i.Interview_ID) || removeSet.has(i.Citizen_ID))
        ? prev.filter(i => !removeSet.has(i.Interview_ID) && !removeSet.has(i.Citizen_ID))
        : prev
      );
      setOfficialLetters(prev => prev.some(l => removeSet.has(l.Letter_ID) || (l.Citizen_ID && removeSet.has(l.Citizen_ID)))
        ? prev.filter(l => !removeSet.has(l.Letter_ID) && (!l.Citizen_ID || !removeSet.has(l.Citizen_ID)))
        : prev
      );
      setCheques(prev => prev.some(ch => removeSet.has(ch.id) || removeSet.has(ch.Citizen_ID))
        ? prev.filter(ch => !removeSet.has(ch.id) && !removeSet.has(ch.Citizen_ID))
        : prev
      );
      setOrganizationRecords(prev => prev.some(o => removeSet.has(o.Citizen_ID) || (o.Org_ID && removeSet.has(o.Org_ID)))
        ? prev.filter(o => !removeSet.has(o.Citizen_ID) && (!o.Org_ID || !removeSet.has(o.Org_ID)))
        : prev
      );
      setCustomSections(prev => prev.some(s => removeSet.has(s.id)) ? prev.filter(s => !removeSet.has(s.id)) : prev);
      setCustomRecords(prev => prev.some(r => removeSet.has(r.id) || removeSet.has(r.sectionId))
        ? prev.filter(r => !removeSet.has(r.id) && !removeSet.has(r.sectionId))
        : prev
      );
      setUsers(prev => prev.some(u => removeSet.has(u.User_ID)) ? prev.filter(u => !removeSet.has(u.User_ID)) : prev);
    };

    const unsubDeletedRecords = fsWatchDeletedRecords((deletedIds) => {
      syncInMemoryDeletedIdsFromCloud(deletedIds);
      if (deletedIds.length > 0) {
        purgeDeletedIdsEverywhere(deletedIds);
      }
    });
    unsubs.push(unsubDeletedRecords);

    // Authoritative Real-Time Firestore Snapshot Reconciler:
    // - On live server snapshots (!fromCache), mirrors Firestore instantaneously (including edits, Director decisions, deletions, and empty/wiped collections)
    //   while protecting brand-new optimistic writes created in the last 8 seconds that haven't echoed from the server yet.
    const reconcileLiveFirestoreSnapshot = <T extends Record<string, any>>(
      prev: T[],
      incoming: T[],
      idKey: keyof T,
      meta: { fromCache: boolean; hasPendingWrites: boolean } | undefined,
      merger: (current: T[], next: T[], deleted: Set<string>) => T[]
    ): T[] => {
      const deletedIds = getStoredDeletedIds();
      if (!Array.isArray(incoming)) return prev;

      if (meta && !meta.fromCache) {
        const nowMs = Date.now();
        const incomingIdSet = new Set(
          incoming
            .map(item => String(item?.[idKey] || '').trim())
            .filter(Boolean)
        );
        const recentOptimistic = prev.filter(item => {
          const id = String(item?.[idKey] || '').trim();
          if (!id || incomingIdSet.has(id) || deletedIds.has(id)) return false;
          const ts = getRecordTimestamp(item);
          return ts > 0 && nowMs - ts < 8000;
        });
        return merger(recentOptimistic, incoming, deletedIds);
      }

      if (incoming.length === 0) return prev;
      return merger(prev, incoming, deletedIds);
    };

    const unsubCitizens = fsWatchCollection<Citizen>(FS_COLLECTIONS.CITIZENS, (items, removedIds, meta) => {
      if (removedIds && removedIds.length > 0) {
        purgeDeletedIdsEverywhere(removedIds);
      }
      setCitizens(prev => reconcileLiveFirestoreSnapshot(prev, items, 'Citizen_ID', meta, mergeCitizens));
    });
    unsubs.push(unsubCitizens);

    const unsubRequests = fsWatchCollection<OfficeRequest>(FS_COLLECTIONS.REQUESTS, (items, removedIds, meta) => {
      if (removedIds && removedIds.length > 0) {
        purgeDeletedIdsEverywhere(removedIds);
      }
      setRequests(prev => reconcileLiveFirestoreSnapshot(prev, items, 'Request_ID', meta, mergeRequests));
    });
    unsubs.push(unsubRequests);

    const unsubInterviews = fsWatchCollection<Interview>(FS_COLLECTIONS.INTERVIEWS, (items, removedIds, meta) => {
      if (removedIds && removedIds.length > 0) {
        purgeDeletedIdsEverywhere(removedIds);
      }
      setInterviews(prev => reconcileLiveFirestoreSnapshot(prev, items, 'Interview_ID', meta, mergeInterviews));
    });
    unsubs.push(unsubInterviews);

    const unsubLetters = fsWatchCollection<OfficialLetter>(FS_COLLECTIONS.LETTERS, (items, removedIds, meta) => {
      if (removedIds && removedIds.length > 0) {
        purgeDeletedIdsEverywhere(removedIds);
      }
      setOfficialLetters(prev => reconcileLiveFirestoreSnapshot(prev, items, 'Letter_ID', meta, mergeOfficialLetters));
    });
    unsubs.push(unsubLetters);

    const unsubCheques = fsWatchCollection<ChequeRecord>(FS_COLLECTIONS.CHEQUES, (items, removedIds, meta) => {
      if (removedIds && removedIds.length > 0) {
        purgeDeletedIdsEverywhere(removedIds);
      }
      setCheques(prev => reconcileLiveFirestoreSnapshot(prev, items, 'id', meta, mergeCheques));
    });
    unsubs.push(unsubCheques);

    const unsubOrgs = fsWatchCollection<OrganizationRecord>(FS_COLLECTIONS.ORGANIZATIONS, (items, removedIds, meta) => {
      if (removedIds && removedIds.length > 0) {
        purgeDeletedIdsEverywhere(removedIds);
      }
      setOrganizationRecords(prev => reconcileLiveFirestoreSnapshot(prev, items, 'Citizen_ID', meta, mergeOrganizationRecords));
    });
    unsubs.push(unsubOrgs);

    const unsubSections = fsWatchCollection<CustomSection>(FS_COLLECTIONS.CUSTOM_SECTIONS, (items, removedIds, meta) => {
      if (removedIds && removedIds.length > 0) {
        purgeDeletedIdsEverywhere(removedIds);
      }
      if (Array.isArray(items) && items.length > 0) {
        setCustomSections(prev => reconcileLiveFirestoreSnapshot(prev, items, 'id', meta, mergeCustomSections));
      }
    });
    unsubs.push(unsubSections);

    const unsubRecords = fsWatchCollection<CustomSectionRecord>(FS_COLLECTIONS.CUSTOM_RECORDS, (items, removedIds, meta) => {
      if (removedIds && removedIds.length > 0) {
        purgeDeletedIdsEverywhere(removedIds);
      }
      setCustomRecords(prev => reconcileLiveFirestoreSnapshot(prev, items, 'id', meta, mergeCustomRecords));
    });
    unsubs.push(unsubRecords);

    const unsubUsers = fsWatchCollection<User>(FS_COLLECTIONS.USERS, (items, removedIds, meta) => {
      if (removedIds && removedIds.length > 0) {
        purgeDeletedIdsEverywhere(removedIds);
      }
      if (Array.isArray(items) && items.length > 0) {
        setUsers(prev => reconcileLiveFirestoreSnapshot(prev, items, 'User_ID', meta, mergeUsers));
      }
    });
    unsubs.push(unsubUsers);

    const unsubDropdowns = fsWatchCollection<DropdownItem>(FS_COLLECTIONS.DROPDOWNS, (items, removedIds) => {
      if (removedIds && removedIds.length > 0) {
        const removeSet = new Set(removedIds);
        setDropdowns(prev => prev.filter(d => !d.id || !removeSet.has(d.id)));
      }
      if (Array.isArray(items) && items.length > 0) {
        setDropdowns(prev => {
          const seen = new Set(prev.map(d => `${d.Category.toLowerCase()}:${d.ItemValue.trim().toLowerCase()}`));
          const added = items.filter(d => d && d.Category && d.ItemValue && !seen.has(`${d.Category.toLowerCase()}:${d.ItemValue.trim().toLowerCase()}`));
          if (added.length === 0) return prev;
          return [...prev, ...added];
        });
      }
    });
    unsubs.push(unsubDropdowns);

    const unsubNotifications = fsWatchCollection<UrgentNotification>(FS_COLLECTIONS.NOTIFICATIONS, (items) => {
      if (Array.isArray(items)) {
        const sorted = items
          .filter(n => n && n.id && n.title)
          .sort((a, b) => (Date.parse(b.createdAtIso || '') || 0) - (Date.parse(a.createdAtIso || '') || 0))
          .slice(0, 80);
        setNotifications(sorted);
      }
    });
    unsubs.push(unsubNotifications);

    const unsubSettings = fsWatchCollection<any>(FS_COLLECTIONS.SETTINGS, (docs) => {
      const generalDoc = docs.find((d: any) => d && (d.appName || d.officeName || d.customTilesConfig || d.textReplacements || typeof d.lastOutgoingNumberNasiriyah === 'number'));
      const cloudDoc = docs.find((d: any) => d && (d.googleDriveFolderId || d.appsScriptUrl || typeof d.lastOutgoingNumberNasiriyah === 'number') && !d.appName);
      const mergedRemote = { ...(generalDoc || {}), ...(cloudDoc || {}) };
      if (Object.keys(mergedRemote).length > 0) {
        const cleanRemoteDrive = mergedRemote.googleDriveFolderId
          ? extractDriveFolderId(mergedRemote.googleDriveFolderId)
          : undefined;
        setRuntimeCloudConfig({
          appsScriptUrl: mergedRemote.appsScriptUrl || mergedRemote.googleAppsScriptUrl,
          googleSheetId: mergedRemote.googleSheetId || mergedRemote.activeGoogleSheetId,
          googleDriveFolderId: cleanRemoteDrive
        });
        if (cleanRemoteDrive) {
          setDriveFolderId(cleanRemoteDrive);
          try { localStorage.setItem('al_nashi_drive_folder_id', cleanRemoteDrive); } catch {}
        }
        setSystemSettings(prev => {
          const next = normalizeSystemSettings({
            ...prev,
            ...mergedRemote,
            ...(cleanRemoteDrive ? { googleDriveFolderId: cleanRemoteDrive } : {})
          });
          systemSettingsRef.current = next;
          return next;
        });
      }
    });
    unsubs.push(unsubSettings);

    // Real-time dedicated watcher for lightweight cloud_config (Drive Folder ID / Sheet ID / Outgoing Counters / Branding)
    const unsubCloudConfig = fsWatchCloudConfig((cfg) => {
      if (!cfg) return;
      const cleanRemoteDrive = cfg.googleDriveFolderId
        ? extractDriveFolderId(cfg.googleDriveFolderId)
        : undefined;
      setRuntimeCloudConfig({
        appsScriptUrl: cfg.appsScriptUrl || cfg.googleAppsScriptUrl,
        googleSheetId: cfg.googleSheetId || cfg.activeGoogleSheetId,
        googleDriveFolderId: cleanRemoteDrive
      });
      if (cleanRemoteDrive) {
        setDriveFolderId(cleanRemoteDrive);
        try { localStorage.setItem('al_nashi_drive_folder_id', cleanRemoteDrive); } catch {}
      }
      setSystemSettings(prev => {
        const next = normalizeSystemSettings({
          ...prev,
          ...(cleanRemoteDrive ? { googleDriveFolderId: cleanRemoteDrive } : {}),
          ...(cfg.googleSheetId ? { googleSheetId: cfg.googleSheetId, activeGoogleSheetId: cfg.googleSheetId } : {}),
          ...(cfg.appsScriptUrl ? { appsScriptUrl: cfg.appsScriptUrl, googleAppsScriptUrl: cfg.appsScriptUrl } : {}),
          ...(typeof cfg.allowAdminOpenDriveFolder === 'boolean' ? { allowAdminOpenDriveFolder: cfg.allowAdminOpenDriveFolder } : {}),
          ...(typeof cfg.lastOutgoingNumberNasiriyah === 'number' ? { lastOutgoingNumberNasiriyah: cfg.lastOutgoingNumberNasiriyah } : {}),
          ...(typeof cfg.lastOutgoingNumberSuq === 'number' ? { lastOutgoingNumberSuq: cfg.lastOutgoingNumberSuq } : {}),
          ...(cfg.outgoingBaselineSetAt ? { outgoingBaselineSetAt: cfg.outgoingBaselineSetAt } : {}),
          ...(cfg.outgoingBaselineLabel ? { outgoingBaselineLabel: cfg.outgoingBaselineLabel } : {}),
          ...(cfg.officeName ? { officeName: cfg.officeName } : {}),
          ...(cfg.deputyName ? { deputyName: cfg.deputyName } : {}),
          ...(cfg.logoUrl ? { logoUrl: cfg.logoUrl } : {})
        });
        systemSettingsRef.current = next;
        safeLocalStorageSet(STORAGE_KEY_PREFIX + 'settings', JSON.stringify(next));
        idbSetJSON(STORAGE_KEY_PREFIX + 'settings', next).catch(() => {});
        return next;
      });
    });
    unsubs.push(unsubCloudConfig);

    // Check remote developer passcode
    fsGetDeveloperPasscode().then(code => {
      if (code) {
        setDeveloperPasscodeState(code);
      }
    }).catch(() => {});

    // Hydrate & bi-directionally sync users with shared server API (/api/users) on startup
    (async () => {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          const serverUsers: User[] = Array.isArray(data?.users) ? data.users : [];
          const serverDeleted = new Set<string>(Array.isArray(data?.deletedIds) ? data.deletedIds : []);
          const localDeleted = getStoredDeletedIds();
          serverDeleted.forEach(id => localDeleted.add(id));

          if (serverUsers.length > 0) {
            setUsers(prev => mergeUsers(prev, serverUsers, localDeleted));
          }
          if (data?.developerPasscode) {
            setDeveloperPasscodeState(String(data.developerPasscode));
            try { localStorage.setItem(STORAGE_KEY_PREFIX + 'dev_passcode', String(data.developerPasscode)); } catch {}
          }
        }
      } catch {
        // Ignore if running without backend API (e.g., pure static host)
      }

      // Hydrate shared settings, icons, and custom sections from /api/settings
      try {
        const sRes = await fetch('/api/settings');
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData?.systemSettings && Object.keys(sData.systemSettings).length > 0) {
            const remoteVer = Number(sData.settingsVersion || sData.systemSettings.settingsVersion || 0);
            if (remoteVer > 0) {
              try {
                if (!sessionStorage.getItem('al_nashi_baseline_settings_ver')) {
                  sessionStorage.setItem('al_nashi_baseline_settings_ver', String(remoteVer));
                }
              } catch {}
            }
            if (sData.systemSettings.developerPasscode) {
              setDeveloperPasscodeState(String(sData.systemSettings.developerPasscode));
              try { localStorage.setItem(STORAGE_KEY_PREFIX + 'dev_passcode', String(sData.systemSettings.developerPasscode)); } catch {}
            }
            setSystemSettings(prev => {
              const merged = { ...prev, ...sData.systemSettings, settingsVersion: remoteVer || prev.settingsVersion };
              safeLocalStorageSet(STORAGE_KEY_PREFIX + 'settings', JSON.stringify(merged));
              return merged;
            });
          }
          if (Array.isArray(sData?.customSections) && sData.customSections.length > 0) {
            setCustomSections(prev => {
              const merged = mergeCustomSections(prev, sData.customSections, getStoredDeletedIds());
              safeLocalStorageSet(STORAGE_KEY_PREFIX + 'custom_sections', JSON.stringify(merged));
              return merged;
            });
          }
        }
      } catch {}

      // Hydrate shared blacklist from /api/blacklist so blocks persist across all devices
      try {
        const bRes = await fetch('/api/blacklist');
        if (bRes.ok) {
          const bData = await bRes.json();
          const remoteBlocked: any[] = Array.isArray(bData?.items) ? bData.items : [];
          const remoteUnblocked = new Set<string>(Array.isArray(bData?.unblockedIds) ? bData.unblockedIds : []);
          if (remoteBlocked.length > 0 || remoteUnblocked.size > 0) {
            setCitizens(prev => {
              const map = new Map<string, Citizen>();
              prev.forEach(c => {
                if (!c || !c.Citizen_ID) return;
                if (remoteUnblocked.has(c.Citizen_ID)) {
                  map.set(c.Citizen_ID, {
                    ...c,
                    IsBlocked: false,
                    BlockReason: undefined,
                    BlockedAt: undefined,
                    BlockedBy: undefined
                  });
                } else {
                  map.set(c.Citizen_ID, c);
                }
              });
              remoteBlocked.forEach(b => {
                if (!b || !b.Citizen_ID) return;
                const existing = map.get(b.Citizen_ID);
                if (existing) {
                  map.set(b.Citizen_ID, {
                    ...existing,
                    IsBlocked: true,
                    BlockReason: b.BlockReason || existing.BlockReason,
                    BlockedAt: b.BlockedAt || existing.BlockedAt,
                    BlockedBy: b.BlockedBy || existing.BlockedBy
                  });
                } else {
                  map.set(b.Citizen_ID, {
                    Citizen_ID: b.Citizen_ID,
                    FullName: b.FullName,
                    Phone1: b.Phone1 || '',
                    Gender: 'ذكر',
                    District: b.District || 'الناصرية - المركز',
                    SubDistrict: 'المركز',
                    Job: 'كاسب',
                    Education: 'إعدادية فما دون',
                    Rating: 'مراجعة أمنية / محظور',
                    CreatedAt: b.BlockedAt || new Date().toISOString().split('T')[0],
                    IsBlocked: true,
                    BlockReason: b.BlockReason || 'محظور من قبل الإدارة',
                    BlockedAt: b.BlockedAt,
                    BlockedBy: b.BlockedBy || 'الإدارة'
                  });
                }
              });
              const next = Array.from(map.values());
              safeLocalStorageSet(STORAGE_KEY_PREFIX + 'citizens', JSON.stringify(next));
              return next;
            });
          }
        }
      } catch {}

      // Track server revision & settingsVersion for lightning-fast 1.2s real-time synchronization
      let lastKnownServerRev = 0;
      let lastKnownSettingsVer = 0;
      let isPullingOrPushing = false;

      // Hydrate & bi-directionally reconcile ALL core records with authoritative live server store (/api/sync/state)
      const pullServerSyncState = async (allowLocalDeltaPush = true) => {
        if (isPullingOrPushing) return;
        isPullingOrPushing = true;
        try {
          const syncRes = await fetch('/api/sync/state', { cache: 'no-store' });
          if (!syncRes.ok) return;
          const s = await syncRes.json();
          if (!s?.success) return;

          if (typeof s.rev === 'number' && s.rev > lastKnownServerRev) {
            lastKnownServerRev = s.rev;
          }
          if (typeof s.settingsVersion === 'number' && s.settingsVersion > lastKnownSettingsVer) {
            lastKnownSettingsVer = s.settingsVersion;
          }

          const deletedSet = getStoredDeletedIds();
          if (Array.isArray(s.deletedIds) && s.deletedIds.length > 0) {
            const incomingDeleted: string[] = [];
            s.deletedIds.forEach((d: string) => {
              if (d) {
                const clean = String(d).trim();
                deletedSet.add(clean);
                incomingDeleted.push(clean);
              }
            });
            if (incomingDeleted.length > 0) {
              purgeDeletedIdsEverywhere(incomingDeleted);
            }
          }

          if (Array.isArray(s.citizens) && s.citizens.length > 0) {
            setCitizens(prev => mergeCitizens(prev, s.citizens, deletedSet));
          }
          if (Array.isArray(s.requests) && s.requests.length > 0) {
            setRequests(prev => mergeRequests(prev, s.requests, deletedSet));
          }
          if (Array.isArray(s.interviews) && s.interviews.length > 0) {
            setInterviews(prev => mergeInterviews(prev, s.interviews, deletedSet));
          }
          if (Array.isArray(s.officialLetters) && s.officialLetters.length > 0) {
            setOfficialLetters(prev => mergeOfficialLetters(prev, s.officialLetters, deletedSet));
          }
          if (Array.isArray(s.cheques) && s.cheques.length > 0) {
            setCheques(prev => mergeCheques(prev, s.cheques, deletedSet));
          }
          if (Array.isArray(s.organizationRecords) && s.organizationRecords.length > 0) {
            setOrganizationRecords(prev => mergeOrganizationRecords(prev, s.organizationRecords, deletedSet));
          }
          if (Array.isArray(s.customSections) && s.customSections.length > 0) {
            setCustomSections(prev => mergeCustomSections(prev, s.customSections, deletedSet));
          }
          if (Array.isArray(s.customRecords) && s.customRecords.length > 0) {
            setCustomRecords(prev => mergeCustomRecords(prev, s.customRecords, deletedSet));
          }
          if (Array.isArray(s.users) && s.users.length > 0) {
            setUsers(prev => mergeUsers(prev, s.users, deletedSet));
          }
          if (s.developerPasscode) {
            setDeveloperPasscodeState(String(s.developerPasscode));
          }
          if (s.systemSettings && typeof s.systemSettings === 'object' && Object.keys(s.systemSettings).length > 0) {
            setSystemSettings(prev => {
              const next = normalizeSystemSettings({ ...prev, ...s.systemSettings });
              systemSettingsRef.current = next;
              return next;
            });
          }
          if (Array.isArray(s.notifications) && s.notifications.length > 0) {
            setNotifications(prev => {
              const map = new Map<string, UrgentNotification>();
              prev.forEach(n => { if (n?.id && !deletedSet.has(n.id)) map.set(n.id, n); });
              s.notifications.forEach((n: UrgentNotification) => { if (n?.id && !deletedSet.has(n.id)) map.set(n.id, { ...(map.get(n.id) || {}), ...n }); });
              return Array.from(map.values())
                .sort((a, b) => (Date.parse(b.createdAtIso || '') || 0) - (Date.parse(a.createdAtIso || '') || 0))
                .slice(0, 80);
            });
          }
          if (s.blacklist && typeof s.blacklist === 'object') {
            const remoteBlocked: any[] = Array.isArray(s.blacklist.items) ? s.blacklist.items : [];
            const remoteUnblocked = new Set<string>(Array.isArray(s.blacklist.unblockedIds) ? s.blacklist.unblockedIds : []);
            if (remoteBlocked.length > 0 || remoteUnblocked.size > 0) {
              setCitizens(prev => {
                const map = new Map<string, Citizen>();
                prev.forEach(c => {
                  if (!c?.Citizen_ID) return;
                  if (remoteUnblocked.has(c.Citizen_ID)) {
                    map.set(c.Citizen_ID, { ...c, IsBlocked: false, BlockReason: '', BlockedAt: '', BlockedBy: '' });
                  } else {
                    map.set(c.Citizen_ID, c);
                  }
                });
                remoteBlocked.forEach(b => {
                  if (!b?.Citizen_ID) return;
                  const ex = map.get(b.Citizen_ID);
                  if (ex) {
                    map.set(b.Citizen_ID, {
                      ...ex,
                      IsBlocked: true,
                      BlockReason: b.BlockReason || ex.BlockReason,
                      BlockedAt: b.BlockedAt || ex.BlockedAt,
                      BlockedBy: b.BlockedBy || ex.BlockedBy
                    });
                  }
                });
                return Array.from(map.values());
              });
            }
          }
          if (Array.isArray(s.documents) && s.documents.length > 0) {
            setDocuments(prev => {
              const map = new Map<string, DocumentArchiveItem>();
              prev.forEach(d => { if (d?.Doc_ID && !deletedSet.has(d.Doc_ID)) map.set(d.Doc_ID, d); });
              s.documents.forEach((d: DocumentArchiveItem) => { if (d?.Doc_ID && !deletedSet.has(d.Doc_ID)) map.set(d.Doc_ID, d); });
              return Array.from(map.values());
            });
          }
          if (Array.isArray(s.dropdowns) && s.dropdowns.length > 0) {
            setDropdowns(prev => {
              const seen = new Set(prev.map(d => `${d.Category.toLowerCase()}:${d.ItemValue.trim().toLowerCase()}`));
              const added = s.dropdowns.filter((d: DropdownItem) =>
                d && d.Category && d.ItemValue && !seen.has(`${d.Category.toLowerCase()}:${d.ItemValue.trim().toLowerCase()}`)
              );
              return added.length > 0 ? [...prev, ...added] : prev;
            });
          }

          // BIDIRECTIONAL AUTOMATIC DATA RESCUE:
          // Whenever THIS browser has any local records (in React state, localStorage, or IndexedDB)
          // whose IDs are missing from the server response `s`, push them to `/api/sync/state?mode=bulk` immediately
          // so any other open browser or computer receives 100% of this browser's data without losing a single record!
          if (allowLocalDeltaPush) {
            try {
              const serverCitIds = new Set((Array.isArray(s.citizens) ? s.citizens : []).map((c: any) => c?.Citizen_ID).filter(Boolean));
              const serverReqIds = new Set((Array.isArray(s.requests) ? s.requests : []).map((r: any) => r?.Request_ID).filter(Boolean));
              const serverIntIds = new Set((Array.isArray(s.interviews) ? s.interviews : []).map((i: any) => i?.Interview_ID).filter(Boolean));
              const serverLetIds = new Set((Array.isArray(s.officialLetters) ? s.officialLetters : []).map((l: any) => l?.Letter_ID).filter(Boolean));
              const serverChqIds = new Set((Array.isArray(s.cheques) ? s.cheques : []).map((c: any) => c?.id).filter(Boolean));
              const serverOrgIds = new Set((Array.isArray(s.organizationRecords) ? s.organizationRecords : []).map((o: any) => o?.Citizen_ID).filter(Boolean));
              const serverRecIds = new Set((Array.isArray(s.customRecords) ? s.customRecords : []).map((r: any) => r?.id).filter(Boolean));

              const missingCitizens = citizensRef.current.filter(
                c => c && c.Citizen_ID && !deletedSet.has(c.Citizen_ID) && !String(c.Citizen_ID).startsWith('CIT-00') && !serverCitIds.has(c.Citizen_ID)
              );
              const missingRequests = requestsRef.current.filter(
                r => r && r.Request_ID && !deletedSet.has(r.Request_ID) && !serverReqIds.has(r.Request_ID)
              );
              const missingInterviews = interviewsRef.current.filter(
                i => i && i.Interview_ID && !deletedSet.has(i.Interview_ID) && !serverIntIds.has(i.Interview_ID)
              );
              const missingLetters = officialLettersRef.current.filter(
                l => l && l.Letter_ID && !deletedSet.has(l.Letter_ID) && !serverLetIds.has(l.Letter_ID)
              );
              const missingCheques = chequesRef.current.filter(
                c => c && c.id && !deletedSet.has(c.id) && !serverChqIds.has(c.id)
              );
              const missingOrgs = organizationRecordsRef.current.filter(
                o => o && o.Citizen_ID && !deletedSet.has(o.Citizen_ID) && !serverOrgIds.has(o.Citizen_ID)
              );
              const missingCustomRecs = customRecordsRef.current.filter(
                r => r && r.id && !deletedSet.has(r.id) && !serverRecIds.has(r.id)
              );

              if (
                missingCitizens.length > 0 ||
                missingRequests.length > 0 ||
                missingInterviews.length > 0 ||
                missingLetters.length > 0 ||
                missingCheques.length > 0 ||
                missingOrgs.length > 0 ||
                missingCustomRecs.length > 0
              ) {
                emitServerBulk({
                  ...(missingCitizens.length > 0 ? { citizens: missingCitizens } : {}),
                  ...(missingRequests.length > 0 ? { requests: sanitizeRequestsForStorage(missingRequests) } : {}),
                  ...(missingInterviews.length > 0 ? { interviews: missingInterviews } : {}),
                  ...(missingLetters.length > 0 ? { officialLetters: missingLetters } : {}),
                  ...(missingCheques.length > 0 ? { cheques: missingCheques } : {}),
                  ...(missingOrgs.length > 0 ? { organizationRecords: missingOrgs } : {}),
                  ...(missingCustomRecs.length > 0 ? { customRecords: missingCustomRecs } : {}),
                  dropdowns: dropdownsRef.current,
                  customSections: customSectionsRef.current,
                  users: usersRef.current,
                  systemSettings: systemSettingsRef.current,
                  deletedIds: Array.from(deletedSet)
                });
              }
            } catch {}
          }
        } catch {} finally {
          isPullingOrPushing = false;
        }
      };

      await pullServerSyncState(true);

      // Subscribe to real-time SSE stream + cross-tab BroadcastChannel + storage fallback
      let sse: EventSource | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let revPollTimer: ReturnType<typeof setInterval> | null = null;
      let lastCatchupAt = Date.now();
      let closed = false;

      const applyIncomingMutation = (payload: any) => {
        if (!payload || payload.clientId === LIVE_SYNC_CLIENT_ID) return;
        const { entity, op, item, id } = payload;
        if (!entity) return;

        if (op === 'upsert' && item) {
          switch (entity) {
            case 'citizens':
              setCitizens(prev => mergeCitizens(prev, [item], getStoredDeletedIds()));
              break;
            case 'requests':
              setRequests(prev => mergeRequests(prev, [item], getStoredDeletedIds()));
              break;
            case 'interviews':
              setInterviews(prev => mergeInterviews(prev, [item], getStoredDeletedIds()));
              break;
            case 'officialLetters':
              setOfficialLetters(prev => mergeOfficialLetters(prev, [item], getStoredDeletedIds()));
              break;
            case 'cheques':
              setCheques(prev => mergeCheques(prev, [item], getStoredDeletedIds()));
              break;
            case 'organizationRecords':
              setOrganizationRecords(prev => mergeOrganizationRecords(prev, [item], getStoredDeletedIds()));
              break;
            case 'customSections':
              setCustomSections(prev => mergeCustomSections(prev, [item], getStoredDeletedIds()));
              break;
            case 'customRecords':
              setCustomRecords(prev => mergeCustomRecords(prev, [item], getStoredDeletedIds()));
              break;
            case 'users':
              setUsers(prev => mergeUsers(prev, [item], getStoredDeletedIds()));
              break;
            case 'notifications':
              setNotifications(prev => {
                const exists = prev.some(n => n.id === item.id);
                const next = exists ? prev.map(n => n.id === item.id ? { ...n, ...item } : n) : [item, ...prev];
                return next
                  .sort((a, b) => (Date.parse(b.createdAtIso || '') || 0) - (Date.parse(a.createdAtIso || '') || 0))
                  .slice(0, 80);
              });
              break;
            case 'documents':
              setDocuments(prev => {
                const exists = prev.some(d => d.Doc_ID === item.Doc_ID);
                return exists ? prev.map(d => d.Doc_ID === item.Doc_ID ? { ...d, ...item } : d) : [item, ...prev];
              });
              break;
            case 'dropdowns':
              if (item.Category && item.ItemValue) {
                setDropdowns(prev => {
                  const exists = prev.some(d =>
                    d.Category.toLowerCase() === String(item.Category).toLowerCase() &&
                    d.ItemValue.trim().toLowerCase() === String(item.ItemValue).trim().toLowerCase()
                  );
                  return exists ? prev : [...prev, item];
                });
              }
              break;
          }
        } else if (op === 'delete' && id) {
          const delId = String(id);
          purgeDeletedIdsEverywhere([delId]);
          if (entity === 'notifications') {
            setNotifications(prev => prev.filter(n => n.id !== delId));
          } else if (entity === 'documents') {
            setDocuments(prev => prev.filter(d => d.Doc_ID !== delId));
          } else if (entity === 'dropdowns') {
            setDropdowns(prev => prev.filter(d => d.id !== delId && `${d.Category}::${d.ItemValue}` !== delId));
          }
        }
      };

      // Cross-tab BroadcastChannel listener (instant sync across multiple tabs/windows of the same browser/PWA, including Vercel)
      const handleBroadcastMessage = (ev: MessageEvent) => {
        const msg = ev.data;
        if (!msg || msg.clientId === LIVE_SYNC_CLIENT_ID) return;
        if (msg.type === 'mutation') {
          applyIncomingMutation(msg);
        } else if (msg.type === 'bulk_payload' && msg.payload) {
          const del = getStoredDeletedIds();
          if (Array.isArray(msg.payload.citizens) && msg.payload.citizens.length > 0) {
            setCitizens(prev => mergeCitizens(prev, msg.payload.citizens, del));
          }
          if (Array.isArray(msg.payload.requests) && msg.payload.requests.length > 0) {
            setRequests(prev => mergeRequests(prev, msg.payload.requests, del));
          }
          if (msg.payload.systemSettings && typeof msg.payload.systemSettings === 'object') {
            setSystemSettings(prev => {
              const next = normalizeSystemSettings({ ...prev, ...msg.payload.systemSettings });
              systemSettingsRef.current = next;
              return next;
            });
          }
          if (Array.isArray(msg.payload.customSections) && msg.payload.customSections.length > 0) {
            setCustomSections(prev => mergeCustomSections(prev, msg.payload.customSections, del));
          }
        }
      };
      const bc = getLiveBroadcastChannel();
      if (bc) {
        bc.addEventListener('message', handleBroadcastMessage);
      }

      // Strict Cloud-Only Policy: Ignore any legacy localStorage business record events
      // Only allow UI appearance/settings updates to sync across tabs via storage events
      const handleStorageEvent = (ev: StorageEvent) => {
        if (!ev.key || !ev.newValue) return;
        try {
          if (ev.key === STORAGE_KEY_PREFIX + 'settings') {
            const parsed = JSON.parse(ev.newValue);
            if (parsed && typeof parsed === 'object') {
              setSystemSettings(prev => {
                const next = normalizeSystemSettings({ ...prev, ...parsed });
                systemSettingsRef.current = next;
                return next;
              });
            }
          }
        } catch {}
      };
      window.addEventListener('storage', handleStorageEvent);

      const connectSse = () => {
        if (closed || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
        try {
          sse = new EventSource('/api/sync/stream');
          sse.addEventListener('mutation', (ev: MessageEvent) => {
            try {
              const data = JSON.parse(ev.data);
              if (typeof data?.rev === 'number' && data.rev > lastKnownServerRev) {
                lastKnownServerRev = data.rev;
              }
              applyIncomingMutation(data);
            } catch {}
          });
          sse.addEventListener('bulk_refresh', (ev: MessageEvent) => {
            try {
              const data = JSON.parse(ev.data);
              if (typeof data?.rev === 'number' && data.rev > lastKnownServerRev) {
                lastKnownServerRev = data.rev;
              }
              if (data?.clientId === LIVE_SYNC_CLIENT_ID) return;
              pullServerSyncState(false);
            } catch {}
          });
          sse.addEventListener('users_updated', () => {
            pullServerSyncState(false);
          });
          sse.addEventListener('blacklist_updated', () => {
            pullServerSyncState(false);
          });
          sse.addEventListener('settings_updated', () => {
            pullServerSyncState(false);
          });
          sse.onerror = () => {
            try { sse?.close(); } catch {}
            sse = null;
            if (!closed) {
              if (reconnectTimer) clearTimeout(reconnectTimer);
              reconnectTimer = setTimeout(connectSse, 4000);
            }
          };
        } catch {}
      };

      connectSse();

      // Lightning-fast 1.2-second unified heartbeat against /api/sync/state?mode=rev
      // Works on Vercel Serverless, AI Studio Dev/Shared URL, and Desktop PWA!
      revPollTimer = setInterval(async () => {
        if (closed || isPullingOrPushing || document.visibilityState === 'hidden') return;
        try {
          const r = await fetch('/api/sync/state?mode=rev', { cache: 'no-store' });
          if (!r.ok) return;
          const info = await r.json();
          if (!info?.success) return;

          const remoteRev = Number(info.rev || 0);
          const remoteSettingsVer = Number(info.settingsVersion || 0);
          const remoteCitCount = Number(info.counts?.citizens ?? -1);
          const remoteReqCount = Number(info.counts?.requests ?? -1);

          const revChanged = remoteRev !== lastKnownServerRev;
          const settingsChanged = remoteSettingsVer > lastKnownSettingsVer;
          const serverHasMoreData =
            (remoteCitCount > citizensRef.current.length) ||
            (remoteReqCount > requestsRef.current.length);
          const localHasMoreData =
            (remoteCitCount >= 0 && citizensRef.current.length > remoteCitCount) ||
            (remoteReqCount >= 0 && requestsRef.current.length > remoteReqCount);

          if (revChanged || settingsChanged || serverHasMoreData || localHasMoreData) {
            await pullServerSyncState(true);
          }
        } catch {}
      }, 1200);

      // Catch-up sync whenever Desktop PWA or browser tab regains focus/visibility or network comes back online
      const handleResumeSync = () => {
        if (document.visibilityState === 'hidden') return;
        const now = Date.now();
        if (now - lastCatchupAt < 1000) return;
        lastCatchupAt = now;
        pullServerSyncState(true);
        fetchAllFromFirestoreNow().catch(() => {});
        if (!sse || sse.readyState === EventSource.CLOSED) {
          connectSse();
        }
      };
      window.addEventListener('focus', handleResumeSync);
      window.addEventListener('online', handleResumeSync);
      document.addEventListener('visibilitychange', handleResumeSync);

      unsubs.push(() => {
        closed = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (revPollTimer) clearInterval(revPollTimer);
        try { sse?.close(); } catch {}
        if (bc) bc.removeEventListener('message', handleBroadcastMessage);
        window.removeEventListener('storage', handleStorageEvent);
        window.removeEventListener('focus', handleResumeSync);
        window.removeEventListener('online', handleResumeSync);
        document.removeEventListener('visibilitychange', handleResumeSync);
      });
    })();

    // Trigger dynamic schema auto-discovery and sync to Firebase & Google Sheets
    autoSyncAllSchemas(customSections).catch(e => console.warn('autoSyncAllSchemas error:', e));

    return () => {
      unsubs.forEach(u => {
        try { u(); } catch {}
      });
    };
  }, []);

  // Google Sheets & Drive Central Database Connection State
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_google_token') : null;
    const sheetId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') : null;
    const folderId = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_drive_folder_id') : null;
    const email = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_google_user_email') : null;

    if (token && sheetId) {
      setIsGoogleConnected(true);
      setSpreadsheetId(sheetId);
      if (folderId) setDriveFolderId(folderId);
      if (email) setGoogleUserEmail(email);
    }
  }, []);

  const canDownloadDatabase = (role?: string): boolean => {
    if (!role) return false;
    return ['developer', 'director', 'deputy', 'admin', 'admin_officer'].includes(role);
  };

  const refreshAllDataFromAllSources = async () => {
    // 0. Always purge any stale business data trapped in Chrome localStorage / IndexedDB
    purgeLegacyBrowserBusinessData();
    clearBusinessRecordsFromIDB().catch(() => {});

    // 1. ULTRA-FAST PARALLEL HYDRATION:
    //    Launch Firebase Firestore fast fetch AND Google Sheets authoritative pull IN PARALLEL
    //    so the UI renders live data in milliseconds with zero hang, while Google Sheets
    //    reconciles authoritatively and mirrors updates back to Firestore non-blockingly.
    const envScript = (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL || '';
    const envSheet = (import.meta as any).env?.VITE_GOOGLE_SHEET_ID || '';
    const cachedScript =
      envScript ||
      systemSettingsRef.current.appsScriptUrl ||
      systemSettingsRef.current.googleAppsScriptUrl ||
      (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_apps_script_url') || '' : '');
    const cachedSheet =
      envSheet ||
      systemSettingsRef.current.googleSheetId ||
      systemSettingsRef.current.activeGoogleSheetId ||
      (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') || '' : '');

    // Start Google Sheets pull immediately if script URL / sheet ID is already known
    let sheetsStartedEarly = false;
    let sheetsPromise: Promise<any> | null = null;
    if (cachedScript || cachedSheet) {
      sheetsStartedEarly = true;
      sheetsPromise = fetchAllFromGoogleSheetsNow(cachedScript, cachedSheet, {
        syncToFirestore: true,
        replaceAsPrimary: true
      }).catch(e => {
        console.warn('Primary Google Sheets hydration notice:', e);
        return null;
      });
    }

    // Simultaneously pull fast snapshot + metadata from Firebase Firestore (populates UI immediately!)
    let cloudSettings: Partial<SystemSettings> | undefined;
    try {
      const fsResult = await fetchAllFromFirestoreNow();
      cloudSettings = fsResult.systemSettings;
      if (cloudSettings) {
        setRuntimeCloudConfig({
          appsScriptUrl: cloudSettings.appsScriptUrl || cloudSettings.googleAppsScriptUrl,
          googleSheetId: cloudSettings.googleSheetId || cloudSettings.activeGoogleSheetId,
          googleDriveFolderId: cloudSettings.googleDriveFolderId
        });
      }
    } catch (e) {
      console.warn('Cloud Firestore hydration notice:', e);
    }

    // If Apps Script URL came from Firestore settings (not yet known on boot), trigger Google Sheets pull now
    if (!sheetsStartedEarly) {
      const resolvedScript =
        envScript ||
        cloudSettings?.appsScriptUrl ||
        cloudSettings?.googleAppsScriptUrl ||
        '';
      const resolvedSheet =
        envSheet ||
        cloudSettings?.googleSheetId ||
        cloudSettings?.activeGoogleSheetId ||
        '';
      if (resolvedScript || resolvedSheet) {
        sheetsPromise = fetchAllFromGoogleSheetsNow(resolvedScript, resolvedSheet, {
          syncToFirestore: true,
          replaceAsPrimary: true
        }).catch(e => {
          console.warn('Background Google Sheets hydration notice:', e);
          return null;
        });
      }
    }

    if (sheetsPromise) {
      await sheetsPromise;
    }
  };

  const triggerSessionDataLoad = (customMsg?: string) => {
    setIsSessionLoading(true);
    setSessionLoadingMessage(customMsg || 'جاري جلب أحدث البيانات...');

    // Dismiss loading curtain immediately once fast hydration finishes (max 650ms for crisp feel)
    const minHide = setTimeout(() => {
      setIsSessionLoading(false);
    }, 650);

    refreshAllDataFromAllSources()
      .catch(() => {})
      .finally(() => {
        clearTimeout(minHide);
        setIsSessionLoading(false);
      });
  };

  // Run initial hydration on mount
  useEffect(() => {
    refreshAllDataFromAllSources().catch(() => {});
  }, []);

  const addAuditLog = (action: string, section: string, details: string) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const newLog: AuditLog = {
      Log_ID: `LOG-${Date.now()}-${Math.floor(10000 + Math.random() * 90000)}`,
      Timestamp: formattedDate,
      User: currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'النظام الآلي',
      Action: action,
      Section: section,
      Details: details,
      Ip: '192.168.1.10'
    };
    setAuditLogs(prev => [newLog, ...prev]);
    pushToGoogleSheetsRealtime('drive_archive', newLog, 'insert', systemSettings.appsScriptUrl);
  };

  const activateUserSession = (user: User, sourceMessage: string) => {
    setCurrentUser(user);
    setIsSplashOpen(false);
    setLastLoginError(null);

    // Strict Auto-route by RBAC role AND explicit AllowedSections matrix
    const targetHome = getHomeSectionForRole(user.Role, user);
    setActiveSection(targetHome);

    addAuditLog('تسجيل دخول ناجح', 'نظام المصادقة', `${sourceMessage} - ${user.FullName} (${user.RoleArabic})`);
    triggerDepartmentGreeting(user);
    triggerSessionDataLoad('يرجى الانتظار لتحميل بياناتك...');
  };

  const upsertMatchedUserLocally = (matched: User) => {
    setUsers(prev => {
      const idx = prev.findIndex(u => u.User_ID === matched.User_ID);
      const next = idx >= 0
        ? prev.map((u, i) => (i === idx ? { ...u, ...matched } : u))
        : [...prev, matched];
      safeLocalStorageSet(STORAGE_KEY_PREFIX + 'users', JSON.stringify(next));
      return next;
    });
  };

  const login = async (
    usernameOrCode: string,
    pass?: string,
    mode?: 'passcode' | 'credentials'
  ): Promise<boolean> => {
    setLastLoginError(null);
    const normalizeDigits = (val: string) =>
      (val || '')
        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
        .trim();
    const normalizeName = (val: string) =>
      normalizeDigits(val)
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .toLowerCase();

    const cleanUser = normalizeName(usernameOrCode || '');
    const cleanPass = normalizeDigits(pass || '');
    const rawCode = normalizeDigits(pass || usernameOrCode || '');
    const currentDevCode = normalizeDigits(developerPasscode || systemSettings.developerPasscode || '2026');
    const isDualMode =
      mode === 'credentials'
        ? true
        : mode === 'passcode'
          ? false
          : Boolean(cleanUser && cleanPass && cleanUser !== normalizeName(cleanPass));

    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | null> =>
      Promise.race([
        promise.catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
      ]);

    const mirrorMatchedUserToServer = (matchedUser: User) => {
      try {
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(matchedUser)
        }).catch(() => {});
      } catch {
        // ignore background mirror errors
      }
    };

    const matchLocalUser = (): { user?: User; frozen?: boolean; wrongPassword?: boolean } => {
      let matchedNameOnly = false;
      for (const u of users) {
        if (!u) continue;
        const uName = normalizeName(u.Username || '');
        const uId = normalizeName(u.User_ID || '');
        const uFull = normalizeName(u.FullName || '');
        const uPhone = normalizeDigits(u.Phone || '');
        const uPass = normalizeDigits(u.Password || '');

        if (isDualMode) {
          const userMatched =
            (uName && cleanUser === uName) ||
            (uId && cleanUser === uId) ||
            (uFull && cleanUser === uFull) ||
            (uPhone && cleanUser === uPhone);
          if (userMatched) {
            const passMatched =
              (uPass && (cleanPass === uPass || cleanPass.toLowerCase() === uPass.toLowerCase())) ||
              (u.Role === 'developer' && currentDevCode && cleanPass === currentDevCode);
            if (passMatched) {
              if (u.Status === 'frozen') return { frozen: true };
              return { user: u };
            }
            matchedNameOnly = true;
          }
        } else {
          if (
            rawCode &&
            ((uPass && (rawCode === uPass || rawCode.toLowerCase() === uPass.toLowerCase())) ||
              (uId && rawCode.toLowerCase() === uId))
          ) {
            if (u.Status === 'frozen') return { frozen: true };
            return { user: u };
          }
        }
      }
      return { wrongPassword: matchedNameOnly };
    };

    let sawWrongPassword = false;

    // 1. LIVE SERVER DATABASE CHECK FIRST (/api/auth/login — authoritative, fast 4s timeout)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const serverRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrCode: usernameOrCode.trim(),
          password: (pass || '').trim(),
          mode: isDualMode ? 'credentials' : 'passcode'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData?.frozen) {
          setLastLoginError('تم تجميد هذا الحساب من قبل الإدارة. يرجى مراجعة المطور أو مدير المكتب.');
          return false;
        }
        if (serverData?.success) {
          if (serverData.isDeveloper && !serverData.user) {
            const devUser = users.find((u) => u.Role === 'developer') || INITIAL_USERS[0];
            activateUserSession(devUser, 'تمت مطابقة رمز المطور المعتمد');
            return true;
          }
          if (serverData.user) {
            upsertMatchedUserLocally(serverData.user);
            activateUserSession(serverData.user, 'تمت مطابقة الحساب والصلاحيات من قاعدة بيانات الخادم');
            return true;
          }
        } else if (serverData?.reason === 'wrong_password') {
          sawWrongPassword = true;
        }
      }
    } catch {
      // Server endpoint unavailable or timed out — continue seamlessly to local & cloud checks
    }

    // 2. DEVELOPER PASSCODE CHECK (strictly honors active custom developerPasscode)
    const devAccount = users.find((u) => u.Role === 'developer');
    const devAccountPass = normalizeDigits(devAccount?.Password || '');
    const activeDevPass = currentDevCode || devAccountPass || '2026';
    if (
      (!isDualMode && rawCode && (rawCode === activeDevPass || (devAccountPass && rawCode === devAccountPass))) ||
      (isDualMode &&
        (cleanUser === 'developer' ||
          cleanUser === 'المطور' ||
          (devAccount && cleanUser === normalizeName(devAccount.Username))) &&
        (cleanPass === activeDevPass || (devAccountPass && cleanPass === devAccountPass)))
    ) {
      const devUser = devAccount || INITIAL_USERS[0];
      activateUserSession(devUser, 'تم الدخول برمز المطور المعتمد');
      return true;
    }

    // 3. LOCAL USERS FAST CHECK (immediate success if user exists locally and isn't frozen)
    const localMatch = matchLocalUser();
    if (localMatch.frozen) {
      setLastLoginError('تم تجميد هذا الحساب من قبل الإدارة. يرجى مراجعة المطور أو مدير المكتب.');
      return false;
    }
    if (localMatch.user) {
      mirrorMatchedUserToServer(localMatch.user);
      activateUserSession(localMatch.user, 'تمت مطابقة الحساب بنجاح');
      return true;
    }
    if (localMatch.wrongPassword) {
      sawWrongPassword = true;
    }

    // 4. PARALLEL CLOUD CHECK (Firebase Firestore + Google Sheets in parallel with 5s cap so login never hangs!)
    const [fsResult, gsResult] = await Promise.all([
      withTimeout(fsVerifyLogin(usernameOrCode, pass), 5000),
      withTimeout(
        verifyLoginWithGoogleSheets(
          usernameOrCode,
          pass,
          systemSettings.appsScriptUrl,
          systemSettings.googleSheetId
        ),
        5000
      )
    ]);

    for (const cloudRes of [fsResult, gsResult]) {
      if (!cloudRes) continue;
      if (cloudRes.frozen) {
        setLastLoginError('تم تجميد هذا الحساب من قبل الإدارة. يرجى مراجعة المطور أو مدير المكتب.');
        return false;
      }
      if (cloudRes.success) {
        if (cloudRes.isDeveloper && !cloudRes.user) {
          const devUser = users.find((u) => u.Role === 'developer') || INITIAL_USERS[0];
          activateUserSession(devUser, 'تمت مطابقة رمز المطور السحابي بنجاح');
          return true;
        }
        if (cloudRes.user) {
          upsertMatchedUserLocally(cloudRes.user);
          mirrorMatchedUserToServer(cloudRes.user);
          activateUserSession(cloudRes.user, 'تمت مطابقة الحساب من القاعدة السحابية بنجاح');
          return true;
        }
      }
    }

    // 5. Clear contextual error message
    setLastLoginError(
      sawWrongPassword
        ? 'كلمة المرور أو الرمز السري غير صحيح لهذا الحساب. يرجى التأكد من الرمز والمحاولة مجدداً.'
        : isDualMode
          ? 'اسم المستخدم أو كلمة المرور غير صحيحة. تأكد من كتابتهما بدقة أو راجع المطور لتفعيل الحساب.'
          : 'الرمز السري غير صحيح. تأكد من إدخال الرمز المعتمد حالياً أو استخدم تبويب (اسم المستخدم وكلمة السر).'
    );
    return false;
  };

  const triggerDepartmentGreeting = (user: User, departmentName?: string) => {
    // Only display the welcome greeting once per session when entering the department
    try {
      const sessionKey = `greeting_shown_${user.User_ID}`;
      if (sessionStorage.getItem(sessionKey)) {
        return;
      }
      sessionStorage.setItem(sessionKey, 'true');
    } catch {
      // ignore storage errors
    }

    const hour = new Date().getHours();
    const timeWord = (hour >= 4 && hour < 12) ? 'صباح الخير' : 'مساء الخير';
    const cleanName = user.FullName.replace(/^(المهندس|المهندسة|أ\.|م\.|د\.|الحقوقي)\s*/i, '').trim();
    const firstName = cleanName.split(' ')[0] || cleanName;
    const title = `${timeWord} أستاذ ${firstName}`;
    const targetDept = departmentName || user.Department;
    const regDate = user.CreatedAt || new Date().toISOString().split('T')[0];
    const message = `أهلاً وسهلاً بك في ${targetDept}`;

    setDepartmentGreeting({
      title,
      message,
      date: regDate
    });
  };

  const logout = () => {
    if (currentUser) {
      addAuditLog('تسجيل خروج', 'نظام المصادقة', `تسجيل خروج المستخدم ${currentUser.FullName}`);
    }

    // Safely clear current session only - DO NOT erase or wipe database records
    setCurrentUser(null);
    setIsSplashOpen(true);
  };

  const switchUser = (user: User) => {
    // Regular employees who logged in cannot switch to another account without entering credentials
    if (currentUser && currentUser.Role !== 'developer') {
      alert('لا يمكن التبديل لحساب موظف آخر بدون إدخال رمزه السري الشخصي. يرجى تسجيل الخروج والدخول بالحساب المطلوب.');
      return;
    }
    setCurrentUser(user);
    setIsSplashOpen(false);
    if (user.Role === 'reception' || user.Role === 'reception_officer') {
      setActiveSection('reception');
    } else if (user.Role === 'social_care' || user.Role === 'social_care_officer') {
      setActiveSection('social_care');
    } else if (user.Role === 'admin' || user.Role === 'admin_officer') {
      setActiveSection('admin');
    } else {
      setActiveSection('dashboard');
    }
    triggerDepartmentGreeting(user);
    triggerSessionDataLoad('يرجى الانتظار لتحميل بياناتك...');
    addAuditLog('تبديل مستخدم سريع', 'إدارة الجلسة', `تم التبديل إلى حساب ${user.FullName}`);
  };

  const assignWorkstationUser = (user: User | null) => {
    setAssignedWorkstationUserState(user);
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY_PREFIX + 'assigned_workstation_user', JSON.stringify(user));
        addAuditLog('تخصيص محطة عمل', 'إدارة الأجهزة', `تم تخصيص هذه المحطة للمستخدم ${user.FullName} للدخول المباشر`);
      } else {
        localStorage.removeItem(STORAGE_KEY_PREFIX + 'assigned_workstation_user');
        addAuditLog('إلغاء تخصيص محطة عمل', 'إدارة الأجهزة', 'تم إلغاء تخصيص محطة العمل وتفعيل الدخول العام');
      }
    } catch (err) {
      console.warn('Failed to save assigned workstation user', err);
    }
  };

  const directLoginAsAssigned = (): boolean => {
    if (assignedWorkstationUser) {
      activateUserSession(assignedWorkstationUser, 'دخول مباشر لمحطة العمل المخصصة');
      return true;
    }
    return false;
  };

  const persistUserAcrossAllDatabases = async (
    targetUser: User
  ): Promise<{ serverOk: boolean; firebaseOk: boolean; sheetsOk: boolean; firebaseError?: string }> => {
    let serverOk = false;
    let firebaseOk = false;
    let sheetsOk = false;
    let firebaseError: string | undefined;

    // 1. Save to shared server DB (/api/users) AND unified sync hub (/api/sync/state?mode=mutate)
    emitServerMutation('users', 'upsert', { item: targetUser });
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetUser)
      });
      serverOk = res.ok;
    } catch {
      serverOk = true;
    }

    // 2. Save to Firebase Firestore
    try {
      await fsSaveUser(targetUser);
      firebaseOk = true;
    } catch (err: any) {
      firebaseOk = false;
      firebaseError = err?.message || String(err);
      console.warn('Firestore user save warning:', firebaseError);
    }

    // 3. Push to Google Sheets / Apps Script if configured
    try {
      const sheetPayload = {
        ...targetUser,
        Permissions: JSON.stringify(targetUser.Permissions || []),
        AllowedSections: JSON.stringify(targetUser.AllowedSections || [])
      };
      await pushToGoogleSheetsRealtime('users', sheetPayload, 'upsert', systemSettings.appsScriptUrl, systemSettings.googleSheetId);
      sheetsOk = Boolean(systemSettings.appsScriptUrl || systemSettings.googleSheetId);
    } catch {
      sheetsOk = false;
    }

    return { serverOk, firebaseOk, sheetsOk, firebaseError };
  };

  const addUser = async (
    userData: Omit<User, 'User_ID'>
  ): Promise<{ user: User; serverOk: boolean; firebaseOk: boolean; sheetsOk: boolean; firebaseError?: string }> => {
    const newId = `USR-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const nowIso = new Date().toISOString();
    const newUser: User = {
      ...userData,
      User_ID: newId,
      CreatedAt: nowIso.split('T')[0],
      UpdatedAt: nowIso
    };
    setUsers(prev => {
      const next = [...prev.filter(u => u.User_ID !== newId), newUser];
      safeLocalStorageSet(STORAGE_KEY_PREFIX + 'users', JSON.stringify(next));
      return next;
    });
    const syncRes = await persistUserAcrossAllDatabases(newUser);
    addAuditLog('إضافة مستخدم جديد', 'إدارة المستخدمين', `تم إنشاء حساب للموظف ${newUser.FullName} بصلاحية ${newUser.RoleArabic}`);
    return { user: newUser, ...syncRes };
  };

  const updateUser = async (
    updated: User
  ): Promise<{ user: User; serverOk: boolean; firebaseOk: boolean; sheetsOk: boolean; firebaseError?: string }> => {
    const stamped: User = {
      ...updated,
      UpdatedAt: new Date().toISOString()
    };
    setUsers(prev => {
      const next = prev.map(u => u.User_ID === stamped.User_ID ? stamped : u);
      safeLocalStorageSet(STORAGE_KEY_PREFIX + 'users', JSON.stringify(next));
      return next;
    });
    if (currentUser?.User_ID === stamped.User_ID) {
      setCurrentUser(stamped);
    }
    const syncRes = await persistUserAcrossAllDatabases(stamped);
    // Keep developerPasscode synchronized whenever the developer user's password is changed
    if (stamped.Role === 'developer' && stamped.Password && stamped.Password.trim().length >= 3) {
      const cleanDevPass = stamped.Password.trim();
      setDeveloperPasscodeState(cleanDevPass);
      try { localStorage.setItem(STORAGE_KEY_PREFIX + 'dev_passcode', cleanDevPass); } catch {}
      fetch('/api/auth/developer-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCode: cleanDevPass })
      }).catch(() => {});
      fsSaveDeveloperPasscode(cleanDevPass).catch(() => {});
    }
    addAuditLog('تعديل حساب مستخدم', 'إدارة المستخدمين', `تم تعديل بيانات المستخدم ${stamped.FullName}`);
    return { user: stamped, ...syncRes };
  };

  const deleteUser = async (userId: string): Promise<{ serverOk: boolean; firebaseOk: boolean }> => {
    const target = users.find(u => u.User_ID === userId);
    let serverOk = false;
    let firebaseOk = false;
    if (target) {
      recordDeletedId(userId);
      setUsers(prev => {
        const next = prev.filter(u => u.User_ID !== userId);
        safeLocalStorageSet(STORAGE_KEY_PREFIX + 'users', JSON.stringify(next));
        return next;
      });
      emitServerMutation('users', 'delete', { id: userId });
      try {
        const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
        serverOk = res.ok;
      } catch {
        serverOk = true;
      }
      try {
        await fsDeleteUser(userId);
        firebaseOk = true;
      } catch (err) {
        console.warn('Firestore user delete warning:', err);
      }
      pushToGoogleSheetsRealtime('users', { User_ID: userId, id: userId }, 'delete', systemSettings.appsScriptUrl, systemSettings.googleSheetId);
      addAuditLog('حذف حساب مستخدم', 'إدارة المستخدمين', `تم حذف حساب ${target.FullName}`);
    }
    return { serverOk, firebaseOk };
  };

  const syncUsersToAllDatabasesNow = async (): Promise<{
    serverOk: boolean;
    firebaseOk: boolean;
    sheetsOk: boolean;
    count: number;
    firebaseError?: string;
  }> => {
    let serverOk = false;
    let firebaseOk = false;
    let sheetsOk = false;
    let firebaseError: string | undefined;

    const deletedIds = Array.from(getStoredDeletedIds());
    try {
      const res = await fetch('/api/users/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users, deletedIds, developerPasscode })
      });
      if (res.ok) {
        const data = await res.json();
        serverOk = true;
        if (Array.isArray(data?.users) && data.users.length > 0) {
          setUsers(prev => {
            const merged = mergeUsers(prev, data.users, getStoredDeletedIds());
            safeLocalStorageSet(STORAGE_KEY_PREFIX + 'users', JSON.stringify(merged));
            return merged;
          });
        }
      }
    } catch {
      serverOk = false;
    }

    const fsRes = await fsSyncAllUsers(users);
    firebaseOk = fsRes.success;
    if (!fsRes.success) firebaseError = fsRes.error;

    if (systemSettings.appsScriptUrl || systemSettings.googleSheetId) {
      try {
        for (const u of users) {
          await pushToGoogleSheetsRealtime(
            'users',
            {
              ...u,
              Permissions: JSON.stringify(u.Permissions || []),
              AllowedSections: JSON.stringify(u.AllowedSections || [])
            },
            'upsert',
            systemSettings.appsScriptUrl,
            systemSettings.googleSheetId
          );
        }
        sheetsOk = true;
      } catch {
        sheetsOk = false;
      }
    }

    return { serverOk, firebaseOk, sheetsOk, count: users.length, firebaseError };
  };

  const checkCloudDbHealth = async (): Promise<{ serverOk: boolean; firebaseOk: boolean; firebaseError?: string }> => {
    let serverOk = false;
    try {
      const res = await fetch('/api/users');
      serverOk = res.ok;
    } catch {
      serverOk = false;
    }
    const fsHealth = await fsCheckConnection();
    return { serverOk, firebaseOk: fsHealth.connected, firebaseError: fsHealth.error };
  };

  const addDropdownItem = (category: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'أخرى' || trimmed === 'اخرى') return;
    const exists = dropdowns.some(d => d.Category.toLowerCase() === category.toLowerCase() && d.ItemValue.trim().toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const newItem: DropdownItem = {
        id: buildSafeDropdownDocId(category, trimmed),
        Category: category,
        ItemValue: trimmed
      };
      setDropdowns(prev => {
        const already = prev.some(d => d.Category.toLowerCase() === category.toLowerCase() && d.ItemValue.trim().toLowerCase() === trimmed.toLowerCase());
        if (already) return prev;
        const next = [...prev, newItem];
        safeLocalStorageSet(STORAGE_KEY_PREFIX + 'dropdowns', JSON.stringify(next));
        return next;
      });
      fsSaveDropdown(newItem).catch(err => console.warn('Firestore dropdown save:', err));
      emitServerMutation('dropdowns', 'upsert', { item: newItem });
      addAuditLog('إضافة عنصر دائم للقوائم', 'القوائم المنسدلة', `تمت إضافة [${trimmed}] وحفظها دائماً في قائمة ${category}`);
      pushToGoogleSheetsRealtime('dropdowns', { id: newItem.id, Category: category, ItemValue: trimmed, Value: trimmed }, 'upsert', systemSettings.appsScriptUrl);
    }

    // Keep systemSettings.receptionResidentialAreas synchronized automatically
    if (category.toLowerCase() === 'residentialarea') {
      const currentAreas = systemSettings.receptionResidentialAreas || [];
      if (!currentAreas.some(a => a.trim().toLowerCase() === trimmed.toLowerCase())) {
        updateSettings({ receptionResidentialAreas: [...currentAreas, trimmed] });
      }
    }
  };

  const removeDropdownItem = (category: string, value: string) => {
    const trimmed = value.trim();
    const dropId = buildSafeDropdownDocId(category, trimmed);
    setDropdowns(prev => prev.filter(d => !(d.Category.toLowerCase() === category.toLowerCase() && d.ItemValue.trim().toLowerCase() === trimmed.toLowerCase())));
    emitServerMutation('dropdowns', 'delete', { id: dropId });
    fsDeleteDropdown(category, trimmed).catch(err => console.warn('Firestore dropdown delete:', err));
    pushToGoogleSheetsRealtime('dropdowns', { id: dropId, Category: category, ItemValue: trimmed }, 'delete', systemSettings.appsScriptUrl);
    addAuditLog('حذف عنصر من القوائم', 'القوائم المنسدلة', `تم حذف [${trimmed}] من قائمة ${category}`);
  };

  const getDropdownOptions = (category: string): string[] => {
    const items = dropdowns.filter(d => d.Category.toLowerCase() === category.toLowerCase()).map(d => d.ItemValue);
    return Array.from(new Set(items));
  };

  const addCitizen = (citizenData: Omit<Citizen, 'Citizen_ID' | 'CreatedAt'>): Citizen => {
    // Generate guaranteed unique sequential ID
    const existingIds = new Set(citizens.map(c => c.Citizen_ID));
    let randomSuffix = Math.floor(10000 + Math.random() * 90000);
    let newCitizenId = `ONA-${randomSuffix}`;
    while (existingIds.has(newCitizenId)) {
      randomSuffix = Math.floor(10000 + Math.random() * 90000);
      newCitizenId = `ONA-${randomSuffix}`;
    }
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let firstName = (citizenData.FirstName || '').trim();
    let fatherName = (citizenData.FatherName || '').trim();
    let grandFatherName = (citizenData.GrandFatherName || '').trim();
    let greatGrandFatherName = (citizenData.GreatGrandFatherName || '').trim();
    const surname = (citizenData.Surname || '').trim();

    if (!firstName && citizenData.FullName) {
      const parts = citizenData.FullName.trim().split(/\s+/);
      firstName = parts[0] || '';
      fatherName = parts[1] || '';
      grandFatherName = parts[2] || '';
      greatGrandFatherName = parts.slice(3).join(' ') || '';
    }

    const composed = [firstName, fatherName, grandFatherName, greatGrandFatherName, surname].filter(Boolean).join(' ').trim();
    const candidateName = (citizenData.FullName?.trim() || composed).trim();

    if (
      !candidateName || 
      candidateName.length < 2 || 
      candidateName.toLowerCase() === 'undefined' || 
      candidateName.toLowerCase() === 'null' || 
      candidateName === 'مواطن بدون اسم' ||
      candidateName === 'الاسم' ||
      candidateName === 'اسم المواطن' ||
      candidateName === 'مراجع' ||
      candidateName === 'مراجع عام'
    ) {
      console.warn('Rejected adding ghost citizen with missing or invalid name:', citizenData);
      throw new Error('يرجى إدخال اسم المواطن الرباعي بشكل صحيح، لا يمكن حفظ سجل فارغ أو مجهول.');
    }

    const fullName = candidateName;

    const newCitizen: Citizen = {
      ...citizenData,
      FirstName: firstName,
      FatherName: fatherName,
      GrandFatherName: grandFatherName,
      GreatGrandFatherName: greatGrandFatherName,
      Surname: surname || citizenData.Surname,
      Citizen_ID: newCitizenId,
      FullName: fullName,
      CreatedAt: formattedDate,
      UpdatedAt: now.toISOString(),
      CreatedBy: currentUser ? currentUser.FullName : 'الاستعلامات'
    };

    setCitizens(prev => [newCitizen, ...prev.filter(c => c.Citizen_ID !== newCitizenId)]);

    // Auto add dropdowns if new
    if (surname && surname !== 'عام') addDropdownItem('Surname', surname);
    if (citizenData.District) addDropdownItem('District', citizenData.District);
    if (citizenData.SubDistrict) addDropdownItem('SubDistrict', citizenData.SubDistrict);
    if (citizenData.Job) addDropdownItem('Job', citizenData.Job);
    if (citizenData.Education) addDropdownItem('Education', citizenData.Education);
    if (citizenData.ReferralSource) addDropdownItem('ReferralSource', citizenData.ReferralSource);

    addAuditLog('تسجيل مواطن جديد بالاستعلامات', 'الاستعلامات', `تسجيل المراجع ${fullName} (${newCitizenId}) من ${citizenData.District || 'ذي قار'} - هاتف: ${newCitizen.Phone1}`);

    // Instant Real-Time Notification persisted to Cloud Firestore for Director & Admin
    addNotification({
      title: `وارد استعلامات جديد: ${fullName}`,
      message: `تم تسجيل المراجع (${newCitizenId}) من ${newCitizen.District} | هاتف: ${newCitizen.Phone1 || 'غير مسجل'}`,
      type: 'urgent_request',
      category: 'request',
      priority: 'high',
      linkSection: 'director',
      entityId: newCitizenId,
      targetRoles: ['director', 'admin', 'admin_officer', 'developer']
    });

    // Real-time broadcast to all connected browsers, shared links & Desktop PWAs
    emitServerMutation('citizens', 'upsert', { item: newCitizen });

    // Dual Cloud Save (Firebase Firestore + Google Sheets) with transparent failure reporting
    receptionDomain.saveCitizen(newCitizen, 'insert', getCloudCtx()).catch(() => {});
    sheetsIntegration.citizens.insert(newCitizen).catch(() => {});

    return newCitizen;
  };

  const updateCitizen = (citizen: Citizen) => {
    let firstName = (citizen.FirstName || '').trim();
    let fatherName = (citizen.FatherName || '').trim();
    let grandFatherName = (citizen.GrandFatherName || '').trim();
    let greatGrandFatherName = (citizen.GreatGrandFatherName || '').trim();
    const surname = (citizen.Surname || '').trim();

    if (!firstName && citizen.FullName) {
      const parts = citizen.FullName.trim().split(/\s+/);
      firstName = parts[0] || '';
      fatherName = parts[1] || '';
      grandFatherName = parts[2] || '';
      greatGrandFatherName = parts.slice(3).join(' ') || '';
    }

    const composed = [firstName, fatherName, grandFatherName, greatGrandFatherName, surname].filter(Boolean).join(' ').trim();
    const fullName = citizen.FullName?.trim() || composed || 'مواطن بدون اسم';

    const updatedCitizen: Citizen = { 
      ...citizen, 
      FirstName: firstName,
      FatherName: fatherName,
      GrandFatherName: grandFatherName,
      GreatGrandFatherName: greatGrandFatherName,
      Surname: surname || citizen.Surname,
      FullName: fullName,
      UpdatedAt: new Date().toISOString()
    };
    setCitizens(prev => {
      const targetId = (citizen.Citizen_ID || '').trim().toLowerCase();
      const exists = prev.some(c => c && c.Citizen_ID && c.Citizen_ID.trim().toLowerCase() === targetId);
      return exists
        ? prev.map(c => c && c.Citizen_ID && c.Citizen_ID.trim().toLowerCase() === targetId ? updatedCitizen : c)
        : [updatedCitizen, ...prev];
    });
    addAuditLog('تحديث بيانات مواطن', 'الاستعلامات', `تعديل السجل التعريفي للمواطن ${fullName} (${citizen.Citizen_ID})`);
    
    // Real-time broadcast to all connected browsers, shared links & Desktop PWAs
    emitServerMutation('citizens', 'upsert', { item: updatedCitizen });

    // Dual Cloud Save (Firebase Firestore + Google Sheets) with transparent failure reporting
    receptionDomain.saveCitizen(updatedCitizen, 'update', getCloudCtx()).catch(() => {});
    sheetsIntegration.citizens.update(updatedCitizen).catch(() => {});
  };

  const deleteCitizen = (citizenId: string) => {
    const target = citizens.find(c => c.Citizen_ID === citizenId);
    if (target) {
      // 1. Gather all related records and IDs
      const matchingReqs = requests.filter(r => r.Citizen_ID === citizenId);
      const matchingInterviews = interviews.filter(i => i.Citizen_ID === citizenId);
      const matchingCheques = cheques.filter(ch => ch.Citizen_ID === citizenId);
      const matchingLetters = officialLetters.filter(l => l.Citizen_ID === citizenId);

      const matchingReqIds = matchingReqs.map(r => r.Request_ID);
      const matchingInterviewIds = matchingInterviews.map(i => i.Interview_ID);
      const matchingChequeIds = matchingCheques.map(ch => ch.id);
      const matchingLetterIds = matchingLetters.map(l => l.Letter_ID);

      // Record all IDs in permanent tombstone set
      [citizenId, ...matchingReqIds, ...matchingInterviewIds, ...matchingChequeIds, ...matchingLetterIds].forEach(id => {
        if (id) recordDeletedId(id);
      });

      // 2. Cascade delete in local state
      const nextCitizens = citizens.filter(c => c.Citizen_ID !== citizenId);
      const nextRequests = requests.filter(r => r.Citizen_ID !== citizenId);
      const nextInterviews = interviews.filter(i => i.Citizen_ID !== citizenId);
      const nextCheques = cheques.filter(ch => ch.Citizen_ID !== citizenId);
      const nextOrgs = organizationRecords.filter(o => o.Citizen_ID !== citizenId);
      const nextLetters = officialLetters.filter(l => l.Citizen_ID !== citizenId);
      const nextDocs = documents.filter(d => d.Citizen_ID !== citizenId && (d as any).CitizenId !== citizenId);

      setCitizens(nextCitizens);
      setRequests(nextRequests);
      setInterviews(nextInterviews);
      setCheques(nextCheques);
      setOrganizationRecords(nextOrgs);
      setOfficialLetters(nextLetters);
      setDocuments(nextDocs);

      addAuditLog(
        'حذف نهائي شامل لسجل مراجع',
        'الإدارة / الاستعلامات',
        `تم حذف المواطن ${target.FullName} (${citizenId}) وجميع متعلقاته (${matchingReqIds.length} معاملة، ${matchingInterviewIds.length} مقابلة، ${matchingLetterIds.length} كتاب رسمي) نهائياً من كافة قواعد البيانات`
      );

      // 4. Broadcast cascade deletion live to all connected devices
      emitServerMutation('citizens', 'delete', { id: citizenId });
      matchingReqIds.forEach(reqId => emitServerMutation('requests', 'delete', { id: reqId }));
      matchingInterviewIds.forEach(intId => emitServerMutation('interviews', 'delete', { id: intId }));
      matchingChequeIds.forEach(chqId => emitServerMutation('cheques', 'delete', { id: chqId }));
      matchingLetterIds.forEach(letId => emitServerMutation('officialLetters', 'delete', { id: letId }));

      // 5. Dual Cloud Cascade Delete (Firebase Firestore + Google Sheets)
      const cloudCtx = getCloudCtx();
      receptionDomain.deleteCitizen(citizenId, cloudCtx).catch(() => {});
      matchingReqIds.forEach(reqId => {
        adminRequestsDomain.deleteRequest(reqId, cloudCtx).catch(() => {});
      });
      matchingInterviewIds.forEach(intId => {
        interviewsDomain.deleteInterview(intId, cloudCtx).catch(() => {});
      });
      matchingChequeIds.forEach(chId => {
        chequesDomain.deleteCheque(chId, cloudCtx).catch(() => {});
      });
      matchingLetterIds.forEach(letId => {
        lettersDomain.deleteLetter(letId, cloudCtx).catch(() => {});
      });

      sheetsIntegration.citizens.delete(citizenId).catch(() => {});
    }
  };

  const findCitizenByIdOrName = (query: string): Citizen[] => {
    const q = query.trim().toLowerCase();
    if (!q) return citizens;
    return citizens.filter(c => 
      c && (
        (c.FullName && c.FullName.toLowerCase().includes(q)) ||
        (c.Citizen_ID && c.Citizen_ID.toLowerCase().includes(q)) ||
        (c.Phone1 && c.Phone1.includes(q)) ||
        (c.Phone2 && c.Phone2.includes(q)) ||
        (c.Surname && c.Surname.toLowerCase().includes(q)) ||
        (c.District && c.District.toLowerCase().includes(q)) ||
        (c.Job && c.Job.toLowerCase().includes(q))
      )
    );
  };

  const blockCitizen = (
    citizenId: string,
    reason: string,
    blockedBy?: string,
    fallbackInfo?: { FullName: string; Phone1?: string; District?: string }
  ) => {
    const cleanId = (citizenId || '').trim().toLowerCase();
    const normStr = (s: string) =>
      (s || '')
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .trim()
        .toLowerCase()
        .replace(/[إأآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F\u0640]/g, '')
        .replace(/\s+/g, ' ');

    const existingCit = citizens.find(c => c && c.Citizen_ID && c.Citizen_ID.trim().toLowerCase() === cleanId);
    let nowStamp = '';
    try {
      nowStamp = new Date().toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      nowStamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    }
    const nowIso = new Date().toISOString();
    const operator = blockedBy || currentUser?.FullName || 'موظف الإدارة';
    const cleanReason = (reason || '').trim() || 'محظور من قبل الإدارة';

    let targetCitizen: Citizen;
    if (existingCit) {
      targetCitizen = {
        ...existingCit,
        IsBlocked: true,
        BlockReason: cleanReason,
        BlockedAt: nowStamp,
        BlockedBy: operator,
        UpdatedAt: nowIso
      };
      updateCitizen(targetCitizen);
    } else if (fallbackInfo && fallbackInfo.FullName && fallbackInfo.FullName.trim()) {
      const finalId = citizenId && citizenId.trim() ? citizenId.trim() : `BLK-${Date.now().toString(36).toUpperCase()}`;
      const nameParts = fallbackInfo.FullName.trim().split(/\s+/);
      targetCitizen = {
        Citizen_ID: finalId,
        FirstName: nameParts[0] || fallbackInfo.FullName.trim(),
        FatherName: nameParts[1] || '',
        GrandFatherName: nameParts[2] || '',
        GreatGrandFatherName: nameParts.slice(3).join(' ') || '',
        FullName: fallbackInfo.FullName.trim(),
        Phone1: (fallbackInfo.Phone1 || '').trim(),
        Gender: 'ذكر',
        District: (fallbackInfo.District || 'الناصرية - المركز').trim(),
        SubDistrict: 'المركز',
        Job: 'كاسب',
        Education: 'إعدادية فما دون',
        Rating: 'مراجعة أمنية / محظور',
        CreatedAt: nowIso.split('T')[0],
        UpdatedAt: nowIso,
        IsBlocked: true,
        BlockReason: cleanReason,
        BlockedAt: nowStamp,
        BlockedBy: operator
      };
      setCitizens(prev => {
        const next = [targetCitizen, ...prev.filter(c => c.Citizen_ID !== targetCitizen.Citizen_ID)];
        safeLocalStorageSet(STORAGE_KEY_PREFIX + 'citizens', JSON.stringify(next));
        return next;
      });
      emitServerMutation('citizens', 'upsert', { item: targetCitizen });
      fsSaveCitizen(targetCitizen).catch((err) => {
        console.warn('Firestore manual block save:', err);
      });
    } else {
      console.warn('Citizen not found for blocking and no fallbackInfo provided:', citizenId);
      return;
    }

    // 1b. Also mark any duplicate citizen records with identical normalized name or phone as blocked
    const normTargetName = normStr(targetCitizen.FullName || '');
    const targetPhoneDigits = normStr(targetCitizen.Phone1 || '').replace(/[^0-9]/g, '');
    const matchingOtherCitizens = citizens.filter(c => {
      if (!c || c.Citizen_ID === targetCitizen.Citizen_ID || c.IsBlocked) return false;
      const sameName = normTargetName && normStr(c.FullName || '') === normTargetName;
      const cPhone = normStr(c.Phone1 || '').replace(/[^0-9]/g, '');
      const samePhone = targetPhoneDigits.length >= 8 && cPhone.length >= 8 && cPhone.slice(-10) === targetPhoneDigits.slice(-10);
      return Boolean(sameName || samePhone);
    });
    if (matchingOtherCitizens.length > 0) {
      const updatedOthers = matchingOtherCitizens.map(c => ({
        ...c,
        IsBlocked: true,
        BlockReason: cleanReason,
        BlockedAt: nowStamp,
        BlockedBy: operator,
        UpdatedAt: nowIso
      }));
      const otherMap = new Map(updatedOthers.map(c => [c.Citizen_ID, c]));
      setCitizens(prev => {
        const next = prev.map(c => otherMap.get(c.Citizen_ID) || c);
        safeLocalStorageSet(STORAGE_KEY_PREFIX + 'citizens', JSON.stringify(next));
        return next;
      });
      updatedOthers.forEach(c => {
        emitServerMutation('citizens', 'upsert', { item: c });
        fsSaveCitizen(c).catch(() => {});
      });
    }

    // 2. Synchronize all matching requests (by ID or normalized Name) to blocked state + persist to Firestore
    const updatedBlockedRequests: OfficeRequest[] = requests
      .filter(r => {
        const matchId = r.Citizen_ID && r.Citizen_ID.trim().toLowerCase() === targetCitizen.Citizen_ID.toLowerCase();
        const matchName = normTargetName && normStr(r.CitizenName || '') === normTargetName;
        return Boolean(matchId || matchName);
      })
      .map(r => ({ ...r, IsBlocked: true, BlockReason: cleanReason, UpdatedAt: nowIso }));

    if (updatedBlockedRequests.length > 0) {
      const blockedReqMap = new Map(updatedBlockedRequests.map(r => [r.Request_ID, r]));
      setRequests(prev => {
        const next = prev.map(r => blockedReqMap.get(r.Request_ID) || r);
        safeLocalStorageSet(STORAGE_KEY_PREFIX + 'requests', JSON.stringify(sanitizeRequestsForStorage(next)));
        return next;
      });
      updatedBlockedRequests.forEach(r => {
        emitServerMutation('requests', 'upsert', { item: sanitizeRequestsForStorage([r])[0] || r });
        fsSaveRequest(r).catch(() => {});
      });
    }

    // 3. Persist to shared server blacklist DB (when running with local Express server)
    fetch('/api/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Citizen_ID: targetCitizen.Citizen_ID,
        FullName: targetCitizen.FullName,
        Phone1: targetCitizen.Phone1 || '',
        District: targetCitizen.District || 'الناصرية - المركز',
        BlockReason: cleanReason,
        BlockedAt: nowStamp,
        BlockedBy: operator,
        IsBlocked: true
      })
    }).catch(() => {});

    addAuditLog('إدراج بالقائمة السوداء', 'الإدارة / الرقابة', `تم حظر المراجع ${targetCitizen.FullName} (${targetCitizen.Citizen_ID}) بسبب: ${cleanReason}`);
    pushToGoogleSheetsRealtime('citizens', targetCitizen, 'upsert', systemSettings.appsScriptUrl);
  };

  const unblockCitizen = (citizenId: string) => {
    const cleanId = (citizenId || '').trim().toLowerCase();
    const cit = citizens.find(c => c && c.Citizen_ID && c.Citizen_ID.trim().toLowerCase() === cleanId);
    if (!cit) return;

    const normStr = (s: string) =>
      (s || '')
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .trim()
        .toLowerCase()
        .replace(/[إأآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u065F\u0640]/g, '')
        .replace(/\s+/g, ' ');

    const nowIso = new Date().toISOString();
    const updated: Citizen = {
      ...cit,
      IsBlocked: false,
      BlockReason: undefined,
      BlockedAt: undefined,
      BlockedBy: undefined,
      UpdatedAt: nowIso
    };

    // 1. Update citizen state and Firestore
    updateCitizen(updated);

    // 1b. Also unblock any duplicate blocked citizen records with identical normalized name
    const normTargetName = normStr(cit.FullName || '');
    const matchingBlockedDuplicates = citizens.filter(c =>
      c &&
      c.Citizen_ID !== cit.Citizen_ID &&
      c.IsBlocked &&
      normTargetName &&
      normStr(c.FullName || '') === normTargetName
    );
    if (matchingBlockedDuplicates.length > 0) {
      const clearedDuplicates = matchingBlockedDuplicates.map(c => ({
        ...c,
        IsBlocked: false,
        BlockReason: undefined,
        BlockedAt: undefined,
        BlockedBy: undefined,
        UpdatedAt: nowIso
      }));
      const dupMap = new Map(clearedDuplicates.map(c => [c.Citizen_ID, c]));
      setCitizens(prev => {
        const next = prev.map(c => dupMap.get(c.Citizen_ID) || c);
        safeLocalStorageSet(STORAGE_KEY_PREFIX + 'citizens', JSON.stringify(next));
        return next;
      });
      clearedDuplicates.forEach(c => {
        emitServerMutation('citizens', 'upsert', { item: c });
        fsSaveCitizen(c).catch(() => {});
      });
    }

    // 2. Clear blocked state on all matching requests + persist to Firestore
    const updatedUnblockedRequests: OfficeRequest[] = requests
      .filter(r => {
        const matchId = r.Citizen_ID && r.Citizen_ID.trim().toLowerCase() === cleanId;
        const matchName = normTargetName && normStr(r.CitizenName || '') === normTargetName;
        return Boolean(matchId || matchName);
      })
      .map(r => ({ ...r, IsBlocked: false, BlockReason: undefined, UpdatedAt: nowIso }));

    if (updatedUnblockedRequests.length > 0) {
      const unblockedReqMap = new Map(updatedUnblockedRequests.map(r => [r.Request_ID, r]));
      setRequests(prev => {
        const next = prev.map(r => unblockedReqMap.get(r.Request_ID) || r);
        safeLocalStorageSet(STORAGE_KEY_PREFIX + 'requests', JSON.stringify(sanitizeRequestsForStorage(next)));
        return next;
      });
      updatedUnblockedRequests.forEach(r => {
        emitServerMutation('requests', 'upsert', { item: sanitizeRequestsForStorage([r])[0] || r });
        fsSaveRequest(r).catch(() => {});
      });
    }

    // 3. Remove from shared server blacklist DB
    fetch(`/api/blacklist/${encodeURIComponent(cit.Citizen_ID)}`, { method: 'DELETE' }).catch(() => {});

    addAuditLog('إلغاء حظر مراجع', 'الإدارة / الرقابة', `تم إلغاء حظر المراجع ${cit.FullName} (${cit.Citizen_ID}) وإعادته للقائمة المسموح بها`);
    pushToGoogleSheetsRealtime('citizens', updated, 'update', systemSettings.appsScriptUrl);
  };

  const checkIfCitizenBlocked = (nameOrId: string, phone?: string): { isBlocked: boolean; citizen?: Citizen; reason?: string } => {
    const blockedList = citizens.filter(c => c && c.IsBlocked);
    if (blockedList.length === 0) return { isBlocked: false };

    const normalizeAr = (s: string) =>
      (s || '')
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .toLowerCase()
        .replace(/[إأآا]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[\u064B-\u065F\u0640]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const phonesMatch = (storedPhone: string | undefined, inputDigits: string) => {
      if (!storedPhone || inputDigits.length < 8) return false;
      const p = normalizeAr(storedPhone).replace(/[^0-9]/g, '');
      if (p.length < 8) return false;
      return p === inputDigits || p.slice(-10) === inputDigits.slice(-10);
    };

    // Check explicit phone argument first if provided
    if (phone && phone.trim().length >= 8) {
      const cleanPhone = normalizeAr(phone).replace(/[^0-9]/g, '');
      if (cleanPhone.length >= 8) {
        const matchPhoneArg = blockedList.find(c => phonesMatch(c.Phone1, cleanPhone) || phonesMatch(c.Phone2, cleanPhone));
        if (matchPhoneArg) {
          return { isBlocked: true, citizen: matchPhoneArg, reason: matchPhoneArg.BlockReason || 'مدرج في القائمة السوداء' };
        }
      }
    }

    if (!nameOrId || !nameOrId.trim()) return { isBlocked: false };
    const clean = nameOrId.trim().toLowerCase();

    // 1. Direct match by ID
    const matchById = blockedList.find(c => c.Citizen_ID.toLowerCase() === clean);
    if (matchById) {
      return { isBlocked: true, citizen: matchById, reason: matchById.BlockReason || 'مدرج في القائمة السوداء' };
    }

    // 2. Direct match by Phone
    const digitsOnly = normalizeAr(clean).replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 8) {
      const matchByPhone = blockedList.find(c => phonesMatch(c.Phone1, digitsOnly) || phonesMatch(c.Phone2, digitsOnly));
      if (matchByPhone) {
        return { isBlocked: true, citizen: matchByPhone, reason: matchByPhone.BlockReason || 'مدرج في القائمة السوداء' };
      }
    }

    // 3. Match by Name (Arabic normalized — exact, substring, or 2-3 matching tokens)
    const normInput = normalizeAr(nameOrId);
    const inputWords = normInput.split(' ').filter(Boolean);

    const matchByName = blockedList.find(c => {
      const normCit = normalizeAr(c.FullName || '');
      if (!normCit) return false;
      if (normCit === normInput) return true;
      if (normInput.length >= 5 && normCit.includes(normInput)) return true;
      if (normCit.length >= 5 && normInput.includes(normCit)) return true;

      const citWords = normCit.split(' ').filter(Boolean);
      if (inputWords.length >= 3 && citWords.length >= 3) {
        if (inputWords[0] === citWords[0] && inputWords[1] === citWords[1] && inputWords[2] === citWords[2]) {
          return true;
        }
      }
      if (inputWords.length === 2 && citWords.length >= 2) {
        if (inputWords[0] === citWords[0] && inputWords[1] === citWords[1]) {
          return true;
        }
      }
      return false;
    });

    if (matchByName) {
      return { isBlocked: true, citizen: matchByName, reason: matchByName.BlockReason || 'مدرج في القائمة السوداء' };
    }

    return { isBlocked: false };
  };

  const requestSeqCounterRef = useRef<number>(120);

  const addRequest = (
    reqData: Omit<OfficeRequest, 'Request_ID' | 'CreatedAt'> & { Request_ID?: string },
    options?: { skipAuditLog?: boolean; skipNotification?: boolean }
  ): OfficeRequest => {
    const year = new Date().getFullYear();
    const existingIds = new Set(requests.map(r => r.Request_ID));

    let maxFound = Math.max(requests.length + 100, requestSeqCounterRef.current);
    for (const r of requests) {
      if (r && r.Request_ID) {
        existingIds.add(r.Request_ID);
        const m = String(r.Request_ID).match(/REQ-\d+-(\d+)/);
        if (m) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maxFound) {
            maxFound = num;
          }
        }
      }
    }

    let next = maxFound + 1;
    let candidate = reqData.Request_ID && !existingIds.has(reqData.Request_ID)
      ? reqData.Request_ID
      : `REQ-${year}-${String(next).padStart(3, '0')}`;

    while (existingIds.has(candidate)) {
      next++;
      candidate = `REQ-${year}-${String(next).padStart(3, '0')}`;
    }

    requestSeqCounterRef.current = next;

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const isFromReception = reqData.RegisteredVia === 'استعلامات';
    const newRequest: OfficeRequest = {
      ...reqData,
      Request_ID: candidate,
      CurrentStage: reqData.CurrentStage || (isFromReception ? 'مدير المكتب' : 'مدير الإدارة'),
      IsHistoricalImported: reqData.IsHistoricalImported ?? false,
      IsArchived: reqData.IsArchived ?? false,
      IsDirectInstantRequest: reqData.IsDirectInstantRequest ?? false,
      CreatedAt: formattedDate,
      UpdatedAt: now.toISOString(),
      CreatedBy: currentUser ? currentUser.FullName : (isFromReception ? 'الاستعلامات' : 'قسم الإدارة')
    };

    setRequests(prev => [newRequest, ...prev.filter(r => r.Request_ID !== candidate)]);

    if (reqData.Entity) {
      addDropdownItem('Entity', reqData.Entity);
    }

    if (!options?.skipAuditLog) {
      addAuditLog('إنشاء طلب إداري', isFromReception ? 'الاستعلامات' : 'قسم الإدارة', `تم تسجيل الطلب ${candidate} للمواطن ${reqData.CitizenName} موجه إلى ${reqData.Entity}`);
    }

    // Trigger real-time cloud notification unless explicitly suppressed (e.g. direct instant administrative requests)
    if (!options?.skipNotification) {
      const isUrgentReq = reqData.Priority === 'عاجل' || reqData.Priority === 'خاص جداً';
      addNotification({
        title: isFromReception
          ? `طلب جديد من الاستعلامات بانتظار قرار المدير: ${reqData.CitizenName}`
          : isUrgentReq
            ? `طلب عاجل (${reqData.Priority}): ${reqData.CitizenName}`
            : `معاملة جديدة: ${reqData.CitizenName}`,
        message: `الجهة: ${reqData.Entity || 'غير محدد'} | رقم الطلب: ${candidate}`,
        type: 'urgent_request',
        category: isFromReception ? 'director' : 'request',
        priority: isFromReception || isUrgentReq ? 'urgent' : 'normal',
        linkSection: isFromReception ? 'director' : 'admin',
        entityId: candidate,
        targetRoles: ['director', 'admin', 'admin_officer', 'developer']
      });
    }

    // Real-time broadcast to all connected browsers, shared links & Desktop PWAs
    emitServerMutation('requests', 'upsert', { item: sanitizeRequestsForStorage([newRequest])[0] || newRequest });

    // Dual Cloud Save (Firebase Firestore + Google Sheets) with transparent failure reporting
    adminRequestsDomain.saveRequest(newRequest, 'insert', getCloudCtx()).catch(() => {});
    sheetsIntegration.requests.insert(newRequest).catch(() => {});

    return newRequest;
  };

  const updateRequest = (req: OfficeRequest) => {
    const prevReq = requests.find(r => r.Request_ID === req.Request_ID);
    const updatedReq: OfficeRequest = {
      ...req,
      UpdatedAt: new Date().toISOString()
    };
    setRequests(prev => prev.map(r => r.Request_ID === req.Request_ID ? updatedReq : r));
    addAuditLog('تحديث طلب إداري', 'قسم الإدارة', `تم تعديل حالة أو مسار الطلب ${req.Request_ID} إلى (${req.ProcessingStatus})`);

    // Smart real-time notifications on key workflow state transitions
    if (updatedReq.DirectorDecision && updatedReq.DirectorDecision !== prevReq?.DirectorDecision) {
      addNotification({
        title: `توجيه المدير التنفيذي (${updatedReq.DirectorDecision}): ${updatedReq.CitizenName}`,
        message: updatedReq.DirectorNotes || updatedReq.RejectionReason || `تم اعتماد قرار (${updatedReq.DirectorDecision}) للطلب ${updatedReq.Request_ID}`,
        type: 'director_decision',
        category: 'director',
        priority: updatedReq.DirectorDecision === 'رفض' ? 'high' : 'urgent',
        linkSection: 'admin',
        entityId: updatedReq.Request_ID,
        targetRoles: ['admin', 'admin_officer', 'reception', 'reception_officer', 'director', 'developer']
      });
    } else if (updatedReq.DeliveryStatus === 'مستلم' && prevReq?.DeliveryStatus !== 'مستلم') {
      addNotification({
        title: `تم تسليم المعاملة للمراجع: ${updatedReq.CitizenName}`,
        message: `الطلب (${updatedReq.Request_ID}) للجهة [${updatedReq.Entity}] تم توثيق استلامه من قبل المراجع`,
        type: 'delivery_update',
        category: 'delivery',
        priority: 'normal',
        linkSection: 'admin',
        entityId: updatedReq.Request_ID,
        targetRoles: ['director', 'admin', 'admin_officer', 'developer']
      });
    } else if (updatedReq.ProcessingStatus === 'منجز' && prevReq?.ProcessingStatus !== 'منجز') {
      addNotification({
        title: `إنجاز معاملة: ${updatedReq.CitizenName}`,
        message: `تم إنجاز الطلب (${updatedReq.Request_ID}) للجهة [${updatedReq.Entity}] وهو جاهز للتسليم`,
        type: 'delivery_update',
        category: 'delivery',
        priority: 'high',
        linkSection: 'reception',
        entityId: updatedReq.Request_ID,
        targetRoles: ['reception', 'reception_officer', 'director', 'admin', 'developer']
      });
    }

    emitServerMutation('requests', 'upsert', { item: sanitizeRequestsForStorage([updatedReq])[0] || updatedReq });
    
    // Dual Cloud Save (Firebase Firestore + Google Sheets) with transparent failure reporting
    adminRequestsDomain.saveRequest(updatedReq, 'update', getCloudCtx()).catch(() => {});
    sheetsIntegration.requests.update(updatedReq).catch(() => {});
  };

  const deleteRequest = (requestId: string) => {
    recordDeletedId(requestId);
    setRequests(prev => prev.filter(r => r.Request_ID !== requestId));
    emitServerMutation('requests', 'delete', { id: requestId });
    addAuditLog('حذف نهائي لطلب إداري', 'قسم الإدارة', `تم حذف الطلب ${requestId} نهائياً من قاعدة البيانات`);
    adminRequestsDomain.deleteRequest(requestId, getCloudCtx()).catch(() => {});
    sheetsIntegration.requests.delete(requestId).catch(() => {});
  };

  const addCheque = (newChequeData: Omit<ChequeRecord, 'id' | 'CreatedAt'>): ChequeRecord => {
    const nextNum = cheques.length + 1;
    const newId = `CHQ-2026-${String(nextNum).padStart(3, '0')}`;
    const newCheque: ChequeRecord = {
      ...newChequeData,
      id: newId,
      CreatedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
    setCheques(prev => [newCheque, ...prev]);
    addAuditLog('إصدار شيك مالي', 'قسم الشيكات', `تم إصدار الشيك رقم ${newCheque.ChequeNumber} للمستفيد ${newCheque.CitizenName} بمبلغ ${newCheque.Amount} د.ع`);
    emitServerMutation('cheques', 'upsert', { item: newCheque });
    chequesDomain.saveCheque(newCheque, 'insert', getCloudCtx()).catch(() => {});
    return newCheque;
  };

  const updateCheque = (updated: ChequeRecord) => {
    const updatedCheque = { ...updated, UpdatedAt: new Date().toISOString() };
    setCheques(prev => prev.map(c => c.id === updated.id ? updatedCheque : c));
    addAuditLog('تعديل بيانات شيك', 'قسم الشيكات', `تم تحديث الشيك رقم ${updated.ChequeNumber} للمستفيد ${updated.CitizenName}`);
    emitServerMutation('cheques', 'upsert', { item: updatedCheque });
    chequesDomain.saveCheque(updatedCheque, 'update', getCloudCtx()).catch(() => {});
  };

  const deleteCheque = (id: string) => {
    const chq = cheques.find(c => c.id === id);
    recordDeletedId(id);
    setCheques(prev => prev.filter(c => c.id !== id));
    emitServerMutation('cheques', 'delete', { id });
    chequesDomain.deleteCheque(id, getCloudCtx()).catch(() => {});
    addAuditLog('حذف شيك مالي', 'قسم الشيكات', `تم حذف الشيك رقم ${chq?.ChequeNumber || id}`);
  };

  const bulkUpdateRequestsStatus = (
    citizenNames: string[],
    newStatus: ProcessingStatus,
    notes?: string
  ): { updatedCount: number; updatedRequests: OfficeRequest[] } => {
    // Process up to 1000 names
    const cleanedNames = citizenNames
      .map(n => n.trim())
      .filter(n => n.length > 2)
      .slice(0, 1000);

    if (cleanedNames.length === 0) return { updatedCount: 0, updatedRequests: [] };

    const matchedRequestIds = new Set<string>();
    const modifiedList: OfficeRequest[] = [];

    // For each input name, find matching request using smart Iraqi/Arabic matcher (3-part in 4-part, quad, clan)
    for (const inputName of cleanedNames) {
      const matchResult = findBestArabicMatch<OfficeRequest>(
        inputName,
        requests,
        (r: OfficeRequest) => r.CitizenName || '',
        { allowTwoPart: true }
      );

      if (matchResult.match && matchResult.result.isMatch) {
        matchedRequestIds.add(matchResult.match.Request_ID);
      }
    }

    setRequests(prev => {
      return prev.map(req => {
        if (matchedRequestIds.has(req.Request_ID)) {
          const updated: OfficeRequest = {
            ...req,
            ProcessingStatus: newStatus,
            DeputyNotes: notes ? (req.DeputyNotes ? `${req.DeputyNotes} | ${notes}` : notes) : req.DeputyNotes
          };
          modifiedList.push(updated);
          pushToGoogleSheetsRealtime('requests', updated, 'update', systemSettings.appsScriptUrl);
          return updated;
        }
        return req;
      });
    });

    addAuditLog(
      'تحديث جماعي للحالة',
      'قسم التقارير والمعالجة الجماعية',
      `تحديث حالة ${modifiedList.length} طلب إلى (${newStatus}) بنجاح بمطابقة ذكية للأسماء`
    );

    return { updatedCount: modifiedList.length, updatedRequests: modifiedList };
  };

  const addInterview = (interviewData: Omit<Interview, 'Interview_ID' | 'CreatedAt'>): Interview => {
    const intSeq = String(interviews.length + 51).padStart(3, '0');
    const newIntId = `INT-${new Date().getFullYear()}-${intSeq}`;
    const now = new Date().toISOString().split('T')[0];

    const newInterview: Interview = {
      ...interviewData,
      Interview_ID: newIntId,
      CreatedAt: now
    };

    setInterviews(prev => {
      const next = [newInterview, ...prev.filter(i => i.Interview_ID !== newIntId)];
      safeLocalStorageSet(STORAGE_KEY_PREFIX + 'interviews', JSON.stringify(next));
      return next;
    });
    addAuditLog('جدولة مقابلة مع النائب', 'مقابلات النائب', `تمت جدولة مقابلة للمواطن ${interviewData.FullName} بتاريخ ${interviewData.InterviewDate}`);

    const isUrgentInt = interviewData.Priority === 'عاجل' || interviewData.Priority === 'خاص جداً';
    addNotification({
      title: isUrgentInt ? `مقابلة عاجلة مع النائب: ${interviewData.FullName}` : `حجز مقابلة جديدة: ${interviewData.FullName}`,
      message: `الموعد: ${interviewData.InterviewDate} | الموضوع: ${interviewData.Subject || 'مقابلة مباشرة'}`,
      type: 'urgent_interview',
      category: 'interview',
      priority: isUrgentInt ? 'urgent' : 'normal',
      linkSection: 'interviews',
      entityId: newIntId,
      targetRoles: ['director', 'deputy', 'interviews_officer', 'developer']
    });

    emitServerMutation('interviews', 'upsert', { item: newInterview });
    interviewsDomain.saveInterview(newInterview, 'insert', getCloudCtx()).catch(() => {});

    return newInterview;
  };

  const updateInterview = (interview: Interview) => {
    const updatedInt = { ...interview, UpdatedAt: new Date().toISOString() };
    setInterviews(prev => prev.map(i => i.Interview_ID === interview.Interview_ID ? updatedInt : i));
    addAuditLog('تحديث بيانات المقابلة', 'مقابلات النائب', `تم تعديل موقف المقابلة ${interview.Interview_ID} وتوجيه النائب: ${interview.DeputyNotes || 'لا توجد ملاحظات'}`);
    emitServerMutation('interviews', 'upsert', { item: updatedInt });
    interviewsDomain.saveInterview(updatedInt, 'update', getCloudCtx()).catch(() => {});
  };

  const deleteInterview = (interviewId: string) => {
    recordDeletedId(interviewId);
    setInterviews(prev => prev.filter(i => i.Interview_ID !== interviewId));
    emitServerMutation('interviews', 'delete', { id: interviewId });
    interviewsDomain.deleteInterview(interviewId, getCloudCtx()).catch(() => {});
    addAuditLog('حذف موعد مقابلة', 'مقابلات النائب', `تم حذف المقابلة ${interviewId} نهائياً`);
  };

  const convertInterviewToRequest = (interviewId: string, targetEntity?: string): OfficeRequest | null => {
    const interview = interviews.find(i => i.Interview_ID === interviewId);
    if (!interview) return null;

    const citizen = citizens.find(c => c.Citizen_ID === interview.Citizen_ID);

    const createdReq = addRequest({
      Citizen_ID: interview.Citizen_ID,
      CitizenName: interview.FullName,
      CitizenPhone: interview.Phone1,
      Entity: targetEntity || 'ديوان محافظة ذي قار',
      RequestStatus: 'مستلم',
      ProcessingStatus: 'قيد التدقيق',
      Priority: interview.Priority === 'خاص جداً' ? 'خاص جداً' : interview.Priority === 'عاجل' ? 'عاجل' : 'عام',
      Details: `[مُحوّل من مقابلة النائب ${interview.Interview_ID}] - موضوع المقابلة: ${interview.Subject}. توجيه النائب: ${interview.DeputyNotes || 'متابعة وإجراء اللازم'}.`,
      DeputyNotes: interview.DeputyNotes,
      CreatedBy: currentUser ? currentUser.FullName : 'تحويل آلي من مقابلة النائب'
    });

    // Mark interview as converted
    updateInterview({
      ...interview,
      ConvertedToRequest: true,
      Status: 'تمت الإحالة'
    });

    addAuditLog('تحويل نتيجة مقابلة إلى طلب إداري', 'مقابلات النائب / الإدارة', `تم ترحيل المقابلة ${interviewId} إلى الطلب الإداري ${createdReq.Request_ID}`);

    return createdReq;
  };

  const upsertOrgRecord = (recordData: Omit<OrganizationRecord, 'Org_ID' | 'UpdatedAt'>) => {
    const now = new Date().toISOString().split('T')[0];
    const existingIndex = organizationRecords.findIndex(o => o.Citizen_ID === recordData.Citizen_ID);

    if (existingIndex >= 0) {
      const updated = {
        ...organizationRecords[existingIndex],
        ...recordData,
        UpdatedAt: now
      };
      setOrganizationRecords(prev => prev.map((o, idx) => idx === existingIndex ? updated : o));
      addAuditLog('تحديث التقييم التنظيمي', 'قسم التنظيم', `تحديث تقييم المواطن ${recordData.FullName} إلى (${recordData.OrgRating})`);
      emitServerMutation('organizationRecords', 'upsert', { item: updated });
      organizationDomain.saveRecord(updated, 'update', getCloudCtx()).catch(() => {});
    } else {
      const newOrg: OrganizationRecord = {
        ...recordData,
        Org_ID: `ORG-${String(organizationRecords.length + 1).padStart(3, '0')}`,
        UpdatedAt: now
      };
      setOrganizationRecords(prev => [newOrg, ...prev]);
      addAuditLog('إضافة سجل تنظيمي جديد', 'قسم التنظيم', `تسجيل تقييم تنظيمي للمواطن ${recordData.FullName} (${recordData.OrgRating})`);
      emitServerMutation('organizationRecords', 'upsert', { item: newOrg });
      organizationDomain.saveRecord(newOrg, 'insert', getCloudCtx()).catch(() => {});
    }
  };

  const addDynamicField = (fieldData: Omit<DynamicField, 'id'>) => {
    const newField: DynamicField = {
      ...fieldData,
      id: `DF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
    };
    setDynamicFields(prev => [...prev, newField]);
    addAuditLog('إضافة حقل ديناميكي', 'لوحة التحكم', `تمت إضافة الحقل [${fieldData.fieldLabel}] إلى قسم ${fieldData.sectionArabic}`);
    // Directly add column header to Google Sheets without waiting for manual sync
    sheetsIntegration.addDynamicFieldColumn(fieldData.section, fieldData.fieldLabel).catch(err => {
      console.warn('Sheets direct addDynamicFieldColumn error:', err);
    });
  };

  const deleteDynamicField = (id: string) => {
    const target = dynamicFields.find(f => f.id === id);
    if (target) {
      setDynamicFields(prev => prev.filter(f => f.id !== id));
      addAuditLog('حذف حقل ديناميكي', 'لوحة التحكم', `تم حذف الحقل [${target.fieldLabel}] من قسم ${target.sectionArabic}`);
    }
  };

  const addDocument = (
    docData: Omit<DocumentArchiveItem, 'Doc_ID' | 'UploadedAt'>,
    options?: { skipAuditLog?: boolean }
  ) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newDoc: DocumentArchiveItem = {
      ...docData,
      Doc_ID: `DOC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      UploadedAt: formattedDate
    };
    setDocuments(prev => [newDoc, ...prev]);
    emitServerMutation('documents', 'upsert', { item: newDoc });
    if (!options?.skipAuditLog) {
      addAuditLog('رفع وثيقة للأرشيف', 'أرشيف المستندات', `تم رفع المستند [${docData.Title}] للمواطن ${docData.CitizenName}`);
    }
  };

  const deleteDocument = (docId: string) => {
    const target = documents.find(d => d.Doc_ID === docId);
    if (target) {
      setDocuments(prev => prev.filter(d => d.Doc_ID !== docId));
      emitServerMutation('documents', 'delete', { id: docId });
      addAuditLog('حذف وثيقة من الأرشيف', 'أرشيف المستندات', `تم حذف المستند [${target.Title}]`);
    }
  };

  const addOfficialLetter = (letterData: Omit<OfficialLetter, 'Letter_ID'>) => {
    const newLetter: OfficialLetter = {
      ...letterData,
      Letter_ID: `LET-${String(officialLetters.length + 1).padStart(3, '0')}`
    };
    setOfficialLetters(prev => [newLetter, ...prev]);
    emitServerMutation('officialLetters', 'upsert', { item: newLetter });
    addAuditLog('إنشاء كتاب رسمي', 'قسم المكنة والطباعة', `تم تحرير الكتاب ذي العدد (${newLetter.LetterNumber}) الموجه إلى ${newLetter.Recipient}`);
    lettersDomain.saveLetter(newLetter, 'insert', getCloudCtx()).catch(() => {});
  };

  const updateOfficialLetter = (letter: OfficialLetter) => {
    const updatedLetter = { ...letter, UpdatedAt: new Date().toISOString() };
    setOfficialLetters(prev => prev.map(l => l.Letter_ID === letter.Letter_ID ? updatedLetter : l));
    emitServerMutation('officialLetters', 'upsert', { item: updatedLetter });
    addAuditLog('تحديث كتاب رسمي', 'قسم المكنة والطباعة', `تعديل بيانات الكتاب ذي العدد (${letter.LetterNumber})`);
    lettersDomain.saveLetter(updatedLetter, 'update', getCloudCtx()).catch(() => {});
  };

  const deleteOfficialLetter = (letterId: string) => {
    recordDeletedId(letterId);
    setOfficialLetters(prev => prev.filter(l => l.Letter_ID !== letterId));
    emitServerMutation('officialLetters', 'delete', { id: letterId });
    addAuditLog('حذف كتاب رسمي', 'قسم المكنة والطباعة', `تم حذف الكتاب الرسمي ${letterId} نهائياً من المنظومة`);
    lettersDomain.deleteLetter(letterId, getCloudCtx()).catch(() => {});
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    const currentSettings = systemSettingsRef.current;
    // Normalize Google Drive Folder ID if a full Drive URL or query string was provided
    const normalizedPatch: Partial<SystemSettings> = { ...newSettings };
    if (typeof normalizedPatch.googleDriveFolderId === 'string' && normalizedPatch.googleDriveFolderId.trim()) {
      const cleanDriveId = extractDriveFolderId(normalizedPatch.googleDriveFolderId);
      normalizedPatch.googleDriveFolderId = cleanDriveId;
      setDriveFolderId(cleanDriveId);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('al_nashi_drive_folder_id', cleanDriveId);
        }
      } catch {}
      setRuntimeCloudConfig({ googleDriveFolderId: cleanDriveId });
    }
    if (typeof normalizedPatch.googleSheetId === 'string' && normalizedPatch.googleSheetId.trim()) {
      let cleanSheetId = normalizedPatch.googleSheetId.trim();
      const sMatch = cleanSheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (sMatch && sMatch[1]) cleanSheetId = sMatch[1];
      normalizedPatch.googleSheetId = cleanSheetId;
      normalizedPatch.activeGoogleSheetId = cleanSheetId;
      setSpreadsheetId(cleanSheetId);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('al_nashi_sheet_id', cleanSheetId);
        }
      } catch {}
      setRuntimeCloudConfig({ googleSheetId: cleanSheetId });
    }

    const isVisualOrIconBroadcast = Boolean(
      normalizedPatch.customTilesConfig !== undefined ||
      normalizedPatch.logoUrl !== undefined ||
      normalizedPatch.parliamentEmblemUrl !== undefined ||
      normalizedPatch.customImages !== undefined ||
      normalizedPatch.appName !== undefined ||
      normalizedPatch.deputyName !== undefined ||
      normalizedPatch.deputyTitle !== undefined ||
      normalizedPatch.hiddenBuiltInTiles !== undefined ||
      normalizedPatch.uiCustomizations !== undefined ||
      normalizedPatch.customTextOverrides !== undefined ||
      normalizedPatch.textReplacements !== undefined ||
      normalizedPatch.settingsVersion !== undefined
    );
    const nextVersion = isVisualOrIconBroadcast
      ? Math.max(Date.now(), (currentSettings.settingsVersion || 0) + 1)
      : (currentSettings.settingsVersion || 0);
    const updateSummary = normalizedPatch.lastUpdateNote || (
      normalizedPatch.customTilesConfig !== undefined
        ? 'تم تحديث أيقونات الأقسام وشكل النظام من قبل المطور'
        : normalizedPatch.logoUrl !== undefined || normalizedPatch.customImages !== undefined
        ? 'تم تحديث شعارات وهوية المنظومة من قبل المطور'
        : 'تم تحديث إعدادات وتصميم المنظومة'
    );
    const merged: SystemSettings = {
      ...currentSettings,
      ...normalizedPatch,
      ...(isVisualOrIconBroadcast ? {
        settingsVersion: nextVersion,
        lastUpdateNote: updateSummary,
        lastUpdatedBy: currentUser?.FullName || 'المطور'
      } : {})
    };
    systemSettingsRef.current = merged;
    setSystemSettings(merged);
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'settings', JSON.stringify(merged));

    if (isVisualOrIconBroadcast && nextVersion > 0) {
      try {
        sessionStorage.setItem('al_nashi_local_initiated_settings_ver', String(nextVersion));
        sessionStorage.setItem('al_nashi_baseline_settings_ver', String(nextVersion));
      } catch {}
    }

    // Push to shared server API AND unified sync hub so ALL connected users on Vercel & Node immediately receive settings updates
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemSettings: merged,
        customSections,
        broadcastUpdate: isVisualOrIconBroadcast,
        settingsVersion: nextVersion,
        updateSummary,
        updatedBy: currentUser?.FullName || 'المطور'
      })
    }).catch(() => {});
    emitServerBulk({
      systemSettings: merged,
      customSections,
      settingsVersion: nextVersion
    });

    fsSaveSettings(merged).catch(err => console.warn('Firestore settings update:', err));
    pushToGoogleSheetsRealtime('settings', { id: 'main_settings', ...merged }, 'upsert', merged.appsScriptUrl);
    addAuditLog('تحديث إعدادات المنظومة', 'لوحة التحكم', 'تم تعديل الإعدادات العامة والهوية البصرية للنظام ومزامنتها لجميع المستخدمين');
  };

  const setGoogleDriveFolderId = (rawFolderId: string) => {
    if (!rawFolderId || !rawFolderId.trim()) return;
    const cleanId = extractDriveFolderId(rawFolderId);
    setDriveFolderId(cleanId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('al_nashi_drive_folder_id', cleanId);
    }
    setRuntimeCloudConfig({ googleDriveFolderId: cleanId });
    updateSettings({ googleDriveFolderId: cleanId });
    try {
      sheetsIntegration.refreshLocalConfig();
    } catch {}
    addAuditLog('تحديث مجلد Google Drive', 'لوحة المطور', `تم ربط وتثبيت معرف المجلد (${cleanId}) في المنظومة`);
  };

  const addNotification = (
    notifInput: Omit<UrgentNotification, 'id' | 'timestamp' | 'read'> & { id?: string; timestamp?: string; read?: boolean }
  ) => {
    const nowIso = new Date().toISOString();
    const newNotif: UrgentNotification = {
      id: notifInput.id || `N-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      title: notifInput.title,
      message: notifInput.message,
      timestamp: notifInput.timestamp || 'الآن',
      createdAtIso: notifInput.createdAtIso || nowIso,
      type: notifInput.type || 'system',
      category: notifInput.category || 'system',
      priority: notifInput.priority || 'normal',
      linkSection: notifInput.linkSection || 'dashboard',
      entityId: notifInput.entityId,
      targetRoles: notifInput.targetRoles,
      createdBy: notifInput.createdBy || currentUser?.FullName || 'النظام',
      read: Boolean(notifInput.read)
    };
    setNotifications(prev => [newNotif, ...prev.filter(n => n.id !== newNotif.id)].slice(0, 80));
    emitServerMutation('notifications', 'upsert', { item: newNotif });
    fsSaveNotification(newNotif).catch(() => {});
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => {
      const target = prev.find(n => n.id === id);
      if (target) emitServerMutation('notifications', 'upsert', { item: { ...target, read: true } });
      return prev.map(n => (n.id === id ? { ...n, read: true } : n));
    });
    fsMarkNotificationRead(id, true).catch(() => {});
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    emitServerMutation('notifications', 'delete', { id });
    fsDeleteNotification(id).catch(() => {});
  };

  const markAllNotificationsAsRead = () => {
    const unread = notifications.filter(n => !n.read);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    unread.forEach(n => {
      emitServerMutation('notifications', 'upsert', { item: { ...n, read: true } });
      fsMarkNotificationRead(n.id, true).catch(() => {});
    });
  };

  const clearReadNotifications = () => {
    const readIds = notifications.filter(n => n.read).map(n => n.id);
    setNotifications(prev => prev.filter(n => !n.read));
    readIds.forEach(id => {
      emitServerMutation('notifications', 'delete', { id });
      fsDeleteNotification(id).catch(() => {});
    });
  };

  const forwardCitizenWorkflow = (
    citizenId: string,
    toStage: WorkflowStage,
    directiveNote?: string,
    targetEntity?: string
  ) => {
    const cit = citizens.find(c => c.Citizen_ID === citizenId);
    if (!cit) return;

    const fromStage = cit.CurrentStage || 'الاستعلامات';
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newAction: WorkflowAction = {
      id: `WF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      fromStage: fromStage,
      toStage: toStage,
      fromUser: currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'النظام',
      actionDate: formattedDate,
      directiveNote: directiveNote || undefined,
      statusText: `تمت الإحالة من ${fromStage} إلى ${toStage}`,
      targetEntity: targetEntity
    };

    const updatedHistory = [newAction, ...(cit.WorkflowHistory || [])];

    const updatedCitizen: Citizen = {
      ...cit,
      CurrentStage: toStage,
      WorkflowHistory: updatedHistory,
      UpdatedAt: now.toISOString()
    };

    setCitizens(prev => prev.map(c => c.Citizen_ID === citizenId ? updatedCitizen : c));
    emitServerMutation('citizens', 'upsert', { item: updatedCitizen });
    fsSaveCitizen(updatedCitizen).catch(() => {});
    pushToGoogleSheetsRealtime('citizens', updatedCitizen, 'update', systemSettings.appsScriptUrl);

    // Audit log
    addAuditLog('إحالة مسار المراجع', 'سلسلة الإحالات', `تمت إحالة المراجع ${cit.FullName} (${cit.Citizen_ID}) من [${fromStage}] إلى [${toStage}] - توجيه: ${directiveNote || 'متابعة وإجراء اللازم'}`);

    // If referred to Director
    if (toStage === 'مدير المكتب') {
      addNotification({
        title: `🏛️ إحالة مراجع إلى مدير المكتب: ${cit.FullName}`,
        message: `وارد استعلامات محال إلى مدير المكتب (${cit.Citizen_ID}) - ${cit.District} | ملاحظة: ${directiveNote || 'مراجعة وتوجيه'}`,
        type: 'urgent_request',
        linkSection: 'director'
      });
    }

    // If referred to Admin
    if (toStage === 'مدير الإدارة') {
      addNotification({
        title: `📋 إحالة معاملة إلى مدير الإدارة: ${cit.FullName}`,
        message: `تم توجيه ملف المراجع (${cit.Citizen_ID}) للإدارة لإعداد الكتاب الرسمي ومسح المستندات. التوجيه: ${directiveNote || 'إعداد كتاب ومتابعة'}`,
        type: 'urgent_request',
        linkSection: 'admin'
      });
    }

    // If referred to Organization
    if (toStage === 'مدير التنظيم') {
      const existingOrg = organizationRecords.find(o => o.Citizen_ID === citizenId);
      if (!existingOrg) {
        upsertOrgRecord({
          Citizen_ID: cit.Citizen_ID,
          FullName: cit.FullName,
          District: cit.District,
          SubDistrict: cit.SubDistrict,
          Phone1: cit.Phone1,
          OrgRating: 'مؤيد',
          InfluenceType: 'وجيه منطقة',
          EvaluationPoints: 85,
          Notes: `محال من ${fromStage}. توجيه: ${directiveNote || 'توثيق تنظيمي ومتابعة الثقل الجماهيري'}`
        });
      }

      addNotification({
        title: `👥 إحالة ملف تنظيمي وجماهيري: ${cit.FullName}`,
        message: `تمت إحالة المراجع (${cit.Citizen_ID}) إلى قسم التنظيم والجمهور للمتابعة الميدانية والانتخابية.`,
        type: 'urgent_request',
        linkSection: 'organization'
      });
    }
  };

  const forwardRequestWorkflow = (
    requestId: string,
    toStage: WorkflowStage,
    directiveNote?: string
  ) => {
    const req = requests.find(r => r.Request_ID === requestId);
    if (!req) return;

    const fromStage = req.CurrentStage || 'مدير الإدارة';
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newAction: WorkflowAction = {
      id: `WF-REQ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      fromStage: fromStage,
      toStage: toStage,
      fromUser: currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'النظام',
      actionDate: formattedDate,
      directiveNote: directiveNote || undefined,
      statusText: `تمت إحالة الطلب ${requestId} إلى ${toStage}`
    };

    const updatedReq: OfficeRequest = {
      ...req,
      CurrentStage: toStage,
      WorkflowHistory: [newAction, ...(req.WorkflowHistory || [])],
      DeputyNotes: directiveNote ? (req.DeputyNotes ? `${req.DeputyNotes} | [${toStage}]: ${directiveNote}` : directiveNote) : req.DeputyNotes,
      UpdatedAt: now.toISOString()
    };

    setRequests(prev => prev.map(r => r.Request_ID === requestId ? updatedReq : r));
    emitServerMutation('requests', 'upsert', { item: sanitizeRequestsForStorage([updatedReq])[0] || updatedReq });
    fsSaveRequest(updatedReq).catch(() => {});
    addAuditLog('إحالة مسار طلب إداري', 'قسم الإدارة', `تمت إحالة الطلب ${requestId} إلى ${toStage}`);
    pushToGoogleSheetsRealtime('requests', updatedReq, 'update', systemSettings.appsScriptUrl);
  };

  // الأرشفة الذكية الشاملة: نقل كافة بيانات المراجع والطلبات المكتملة تلقائياً إلى أرشيف طويل الأمد
  const smartArchiveCitizen = (
    citizenId: string,
    notes?: string
  ): { success: boolean; citizen: Citizen | null; archivedRequestsCount: number; archiveCode: string } => {
    const cit = citizens.find(c => c.Citizen_ID === citizenId);
    if (!cit) return { success: false, citizen: null, archivedRequestsCount: 0, archiveCode: '' };

    const archiveCode = `ARC-${Date.now().toString().slice(-6)}`;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const archiverName = currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'مسؤول الأرشفة الذكية';

    // 1. تحديث بيانات المراجع كـ "مؤرشف طويل الأمد"
    const updatedCitizen: Citizen = {
      ...cit,
      IsArchived: true,
      ArchivedAt: formattedDate,
      ArchivedBy: archiverName,
      ArchiveNotes: notes || 'أرشفة ذكية شاملة وطويلة الأمد مع إنشاء نسخة احتياطية PDF بنقرة واحدة',
      ArchiveCode: archiveCode,
      UpdatedAt: formattedDate
    };

    setCitizens(prev => prev.map(c => c.Citizen_ID === citizenId ? updatedCitizen : c));
    emitServerMutation('citizens', 'upsert', { item: updatedCitizen });
    fsSaveCitizen(updatedCitizen).catch(console.error);

    // 2. تحديث كافة المعاملات المنجزة للمراجع إلى أرشيف طويل الأمد
    let archivedCount = 0;
    const matchingReqs: OfficeRequest[] = [];

    setRequests(prev => prev.map(r => {
      const isMatch = (r.Citizen_ID && cit.Citizen_ID && r.Citizen_ID === cit.Citizen_ID) ||
                      (r.CitizenName && cit.FullName && r.CitizenName.trim() === cit.FullName.trim()) ||
                      (r.CitizenPhone && cit.Phone1 && r.CitizenPhone.trim() === cit.Phone1.trim());
      if (isMatch) {
        matchingReqs.push(r);
        if (r.ProcessingStatus === 'منجز') {
          archivedCount++;
          const updatedReq: OfficeRequest = {
            ...r,
            IsArchived: true,
            ArchivedAt: formattedDate,
            ArchiveCode: archiveCode,
            UpdatedAt: formattedDate
          };
          emitServerMutation('requests', 'upsert', { item: updatedReq });
          fsSaveRequest(updatedReq).catch(console.error);
          return updatedReq;
        }
      }
      return r;
    }));

    // 3. إضافة قيد في أرشيف الوثائق طويل الأمد
    addDocument({
      Citizen_ID: cit.Citizen_ID,
      CitizenName: cit.FullName,
      Title: `إضبارة أرشيفية طويلة الأمد (PDF): ${cit.FullName} [${archiveCode}]`,
      Category: 'أرشيف طويل الأمد',
      FileUrl: '',
      FileType: 'pdf',
      FileSize: '2.5 MB (نسخة رسمية رقمية كاملة)',
      UploadedBy: archiverName || 'قسم الأرشيف الذكي'
    });

    // 4. تسجيل في سجل التدقيق والرقابة
    addAuditLog(
      'أرشفة ذكية طويلة الأمد',
      'الأرشيف والرقابة',
      `تم نقل كافة بيانات المراجع ${cit.FullName} (${cit.Citizen_ID}) والطلبات المكتملة (${archivedCount} طلب منجز) إلى الأرشيف طويل الأمد برمز [${archiveCode}] مع إصدار نسخة احتياطية PDF بواسطة ${archiverName}`
    );

    // 5. إشعار فوري في المنظومة
    setNotifications(prev => [{
      id: `N-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      title: `📦 إنجاز أرشفة ذكية: ${cit.FullName}`,
      message: `تم نقل كافة سجلات المراجع والطلبات المكتملة (${archivedCount} طلب) إلى الأرشيف طويل الأمد بنجاح. رمز الأرشيف: ${archiveCode}`,
      timestamp: 'الآن',
      type: 'system',
      linkSection: 'smart_images',
      read: false
    }, ...prev]);

    return {
      success: true,
      citizen: updatedCitizen,
      archivedRequestsCount: archivedCount,
      archiveCode
    };
  };

  // Check RBAC permission for printing the official ID card:
  // "زر وميزة طباعة بطاقة المعلومات من البحث الشامل مقتصرة فقط حصرياً على: [المطور، المدير، موظف الإدارة]"
  const canPrintOfficialCard = (user: User | null): boolean => {
    if (!user) return false;
    return ['developer', 'director', 'admin'].includes(user.Role);
  };

  const exportToExcel = (data: any[], fileName: string) => {
    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'البيانات');
      XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
      addAuditLog('تصدير بيانات إلى إكسيل', 'التقارير والإحصائيات', `تصدير ملف ${fileName}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء التصدير.');
    }
  };

  const wipeAllSystemData = async () => {
    // 0. Security Guard: Only the developer can wipe data
    if (currentUser?.Role !== 'developer') {
      pushCloudSyncAlert({
        severity: 'warning',
        target: 'both',
        title: 'صلاحية التصفير مقفلة',
        message: 'عذراً، صلاحية تصفير النظام وتفريغ البيانات مقتصرة حصرياً على حساب المطور.'
      });
      return;
    }

    // 1. INSTANT UI ZEROING: Clear ALL in-memory collections immediately so records disappear with 0ms lag!
    setCitizens([]);
    setRequests([]);
    setCheques([]);
    setInterviews([]);
    setOrganizationRecords([]);
    setDocuments([]);
    setOfficialLetters([]);
    setCustomRecords([]);
    setNotifications([]);
    setIsSystemZeroed(true);

    // 2. Reset outgoing counters in systemSettings (preserving icons, sections & cloud config)
    updateSettings({
      lastOutgoingNumberNasiriyah: 0,
      lastOutgoingNumberSuq: 0
    });

    // 3. Purge browser storage, IndexedDB & in-memory tombstones immediately
    clearInMemoryDeletedIds();
    purgeLegacyBrowserBusinessData();
    clearBusinessRecordsFromIDB().catch(() => {});

    // 4. PARALLEL CLOUD WIPE: Execute Firebase Firestore + Google Sheets (keeping Row 1 headers!) + Drive + Server simultaneously
    const targetScriptUrl =
      (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
      systemSettingsRef.current.appsScriptUrl ||
      systemSettingsRef.current.googleAppsScriptUrl ||
      (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_apps_script_url') || '' : '');

    const [fsRes, sheetsRes] = await Promise.allSettled([
      fsWipeAllCollections(),
      wipeGoogleSheetsViaAppsScript('all', undefined, targetScriptUrl),
      wipeDeveloperCloudData().catch(() => {}),
      clearAllImagesFromDB().catch(() => {}),
      fetch('/api/sync/state?mode=wipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'wipe', clientId: LIVE_SYNC_CLIENT_ID })
      }).catch(() => {}),
      fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [], unblockedIds: [] })
      }).catch(() => {})
    ]);

    const sheetsOk = sheetsRes.status === 'fulfilled' && sheetsRes.value?.success;
    const sheetsErr =
      sheetsRes.status === 'fulfilled'
        ? sheetsRes.value?.error || sheetsRes.value?.message
        : String(sheetsRes.reason || '');
    const fsOk = fsRes.status === 'fulfilled' && fsRes.value?.success;

    pushCloudSyncAlert({
      severity: fsOk && sheetsOk ? 'success' : 'error',
      target: sheetsOk ? 'both' : 'google_sheets',
      title: sheetsOk ? 'تم تصفير النظام بالكامل بنجاح' : 'تم تصفير الواجهة وFirestore، وفشل تصفير Google Sheets',
      message: sheetsOk
        ? 'تم تفريغ جميع السجلات فوراً من الواجهة و Firebase Firestore و Google Sheets (مع الإبقاء على صف العناوين Headers وحسابات الكادر).'
        : 'تم تفريغ السجلات من الواجهة و Firebase Firestore، لكن تعذر تصفير Google Sheets عبر Apps Script.',
      details: !sheetsOk ? sheetsErr : undefined
    });

    // 5. Log audit entry
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const wipeLog: AuditLog = {
      Log_ID: `LOG-WIPE-${Date.now()}`,
      Action: 'تصفير شامل للنظام وتفريغ كافة البيانات (سحابياً ومحلياً)',
      ActionType: 'تصفير شامل',
      Section: 'إدارة وتصفير البيانات',
      Department: 'إدارة وتصفير البيانات',
      Details: 'تم تصفير النظام بالكامل بواسطة المطور (0 سجل) في الواجهة و Firebase Firestore و Google Sheets مع الحفاظ على صف العناوين.',
      UserName: currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'المطور',
      User: currentUser ? currentUser.FullName : 'المطور',
      Timestamp: formattedDate
    };
    setAuditLogs([wipeLog]);
  };

  const wipeSelectedSections = async (sectionKeys: string[]) => {
    if (currentUser?.Role !== 'developer') {
      pushCloudSyncAlert({
        severity: 'warning',
        target: 'both',
        title: 'صلاحية التصفير مقفلة',
        message: 'عذراً، صلاحية تصفير الأقسام مقتصرة حصرياً على حساب المطور.'
      });
      return;
    }

    const keys = Array.from(new Set((sectionKeys || []).map(k => String(k || '').trim()).filter(Boolean)));
    if (keys.length === 0) return;

    const keySet = new Set(keys);

    // 1. INSTANT UI ZEROING for selected sections only (other departments remain 100% untouched!)
    if (keySet.has('citizens')) setCitizens([]);
    if (keySet.has('requests')) {
      setRequests([]);
      updateSettings({ lastOutgoingNumberNasiriyah: 0, lastOutgoingNumberSuq: 0 });
    }
    if (keySet.has('interviews')) setInterviews([]);
    if (keySet.has('organization')) setOrganizationRecords([]);
    if (keySet.has('letters')) {
      setOfficialLetters([]);
      setDocuments([]);
    }
    if (keySet.has('cheques')) setCheques([]);

    const coreSet = new Set(['citizens', 'requests', 'interviews', 'organization', 'letters', 'cheques']);
    const customKeysToWipe = keys.filter(k => !coreSet.has(k));
    if (customKeysToWipe.length > 0) {
      const customKeySet = new Set(customKeysToWipe);
      setCustomRecords(prev => prev.filter(rec => !customKeySet.has(String(rec.sectionId || 'sec_social_welfare'))));
    }

    // 2. PARALLEL CLOUD WIPE for ONLY the selected sections in Firebase Firestore + Google Sheets (keeping Row 1 headers!)
    const targetScriptUrl =
      (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
      systemSettingsRef.current.appsScriptUrl ||
      systemSettingsRef.current.googleAppsScriptUrl ||
      (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_apps_script_url') || '' : '');

    const [fsRes, sheetsRes] = await Promise.allSettled([
      fsWipeSelectedCollections(keys),
      wipeGoogleSheetsViaAppsScript('sections', keys, targetScriptUrl)
    ]);

    const sheetsOk = sheetsRes.status === 'fulfilled' && sheetsRes.value?.success;
    const sheetsErr =
      sheetsRes.status === 'fulfilled'
        ? sheetsRes.value?.error || sheetsRes.value?.message
        : String(sheetsRes.reason || '');
    const fsOk = fsRes.status === 'fulfilled' && fsRes.value?.success;

    pushCloudSyncAlert({
      severity: fsOk && sheetsOk ? 'success' : 'error',
      target: sheetsOk ? 'both' : 'google_sheets',
      title: sheetsOk ? `تم تصفير (${keys.length}) قسم محدد بنجاح` : `تم تصفير (${keys.length}) قسم في الواجهة وFirestore، وفشل تصفير Google Sheets`,
      message: sheetsOk
        ? 'تم حذف سجلات الأقسام المختارة فوراً من الواجهة و Firebase Firestore و Google Sheets (مع الإبقاء على صف العناوين وبقية الأقسام سليمة).'
        : 'تم حذف سجلات الأقسام المختارة من الواجهة و Firebase Firestore، لكن تعذر تصفيرها في Google Sheets عبر Apps Script.',
      details: !sheetsOk ? sheetsErr : undefined
    });

    addAuditLog(
      'تصفير أقسام محددة',
      'إدارة وتصفير البيانات',
      `تم تصفير الأقسام التالية فقط: ${keys.join('، ')}`
    );
  };

  const resetToDefaultData = () => {
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'is_zeroed');
    setIsSystemZeroed(false);
    setSystemSettings(INITIAL_SETTINGS);
    setUsers(INITIAL_USERS);
    setCitizens(INITIAL_CITIZENS);
    setRequests(INITIAL_REQUESTS);
    setCheques(INITIAL_CHEQUES);
    setInterviews(INITIAL_INTERVIEWS);
    setOrganizationRecords(INITIAL_ORGANIZATION);
    setDropdowns(INITIAL_DROPDOWNS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setDynamicFields(INITIAL_DYNAMIC_FIELDS);
    setDocuments(INITIAL_DOCUMENTS);
    setOfficialLetters([
      {
        Letter_ID: 'LET-001',
        LetterNumber: '241/ن/2026',
        LetterDate: '2026-03-01',
        Recipient: 'معالي وزير النفط المحترم',
        Subject: 'طلب تعيين وتدوير كفاءات هندسية من أبناء ذي قار',
        Body: 'نرجو تفضل معاليكم بالموافقة الكريمة على شمول الأسماء المرفقة طياً بفرص التدريب والتطوير في شركة نفط ذي قار، نظراً لتميزهم الأكاديمي واحتياج المحافظة لدعم الكوادر الشابة. مع فائق التقدير والاحترام.',
        Citizen_ID: 'ONA-10001',
        CitizenName: 'أحمد جاسم محمد علي الخفاجي',
        Status: 'تمت الطباعة والتوقيع',
        ClerkName: 'حيدر الكعبي'
      }
    ]);
    localStorage.clear();
    addAuditLog('استعادة ضبط المصنع', 'لوحة التحكم', 'تمت استعادة كافة البيانات الافتراضية للنظام');
  };

  // Dynamic Custom Sections (الأقسام المخصصة وتطوير المنظومة ديناميكياً + إنشاء ورقة Google Sheet تلقائياً)
  const addCustomSection = (secData: Omit<CustomSection, 'id' | 'createdAt'>): CustomSection => {
    const newSection: CustomSection = {
      ...secData,
      id: `sec_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: currentUser?.FullName || 'مطور المنظومة'
    };
    const nextSections = [...customSections, newSection];
    setCustomSections(nextSections);
    customSectionsRef.current = nextSections;
    setRuntimeCustomSections(nextSections);

    emitServerMutation('customSections', 'upsert', { item: newSection });

    // Dual Cloud Save + Automatic Google Sheet Creation & Column Ordering via Apps Script!
    customSectionsDomain
      .saveSectionAndProvisionSheet(newSection, nextSections, {
        ...getCloudCtx(),
        customSections: nextSections
      })
      .catch(() => {});

    // Optional Direct Sheets API tab creation if Developer Google OAuth token is also active
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_google_token') : null;
      const sheetId = systemSettings.googleSheetId || (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') : '');
      if (token && sheetId) {
        const headerCols = ['معرف القيد', ...(newSection.fields || []).map(f => f.label), 'تاريخ الإنشاء', 'الموظف المسؤول'];
        ensureSheetTabExists(token, sheetId, `قسم_${newSection.title}`, headerCols).catch(() => {});
        if (newSection.isMultiSectionHub && Array.isArray(newSection.subSections)) {
          for (const sub of newSection.subSections) {
            if (!sub.targetBuiltInSection) {
              const subHeaders = ['معرف القيد', ...(sub.fields || []).map(f => f.label), 'تاريخ الإنشاء', 'الموظف المسؤول'];
              ensureSheetTabExists(token, sheetId, `قسم_${newSection.title}_${sub.title}`, subHeaders).catch(() => {});
            }
          }
        }
      }
    } catch {}

    addAuditLog('إضافة قسم مخصص جديد', 'لوحة التحكم والعمليات', `تم إنشاء القسم وتخصيص ورقة Google Sheet تلقائياً: ${newSection.title}`);
    const broadcastVer = Math.max(Date.now(), (systemSettings.settingsVersion || 0) + 1);
    try {
      sessionStorage.setItem('al_nashi_local_initiated_settings_ver', String(broadcastVer));
      sessionStorage.setItem('al_nashi_baseline_settings_ver', String(broadcastVer));
    } catch {}
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemSettings: { ...systemSettings, settingsVersion: broadcastVer, lastUpdateNote: `تم إضافة قسم وأيقونة جديدة: ${newSection.title}` },
        customSections: nextSections,
        broadcastUpdate: true,
        settingsVersion: broadcastVer,
        updateSummary: `تم إضافة قسم وأيقونة جديدة: ${newSection.title}`,
        updatedBy: currentUser?.FullName || 'المطور'
      })
    }).catch(() => {});
    return newSection;
  };

  const updateCustomSection = (section: CustomSection) => {
    const updated = { ...section, updatedAt: new Date().toISOString() };
    const nextSections = customSections.map(s => s.id === section.id ? updated : s);
    setCustomSections(nextSections);
    customSectionsRef.current = nextSections;
    setRuntimeCustomSections(nextSections);

    emitServerMutation('customSections', 'upsert', { item: updated });

    // Dual Cloud Save + Non-destructive column update in the section's dedicated Google Sheet tab!
    customSectionsDomain
      .saveSectionAndProvisionSheet(updated, nextSections, {
        ...getCloudCtx(),
        customSections: nextSections
      })
      .catch(() => {});

    const broadcastVer = Math.max(Date.now(), (systemSettings.settingsVersion || 0) + 1);
    try {
      sessionStorage.setItem('al_nashi_local_initiated_settings_ver', String(broadcastVer));
      sessionStorage.setItem('al_nashi_baseline_settings_ver', String(broadcastVer));
    } catch {}
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemSettings: { ...systemSettings, settingsVersion: broadcastVer, lastUpdateNote: `تم تحديث أيقونة وبيانات قسم: ${section.title}` },
        customSections: nextSections,
        broadcastUpdate: true,
        settingsVersion: broadcastVer,
        updateSummary: `تم تحديث أيقونة وبيانات قسم: ${section.title}`,
        updatedBy: currentUser?.FullName || 'المطور'
      })
    }).catch(() => {});
    addAuditLog('تعديل قسم مخصص', 'لوحة التحكم والعمليات', `تم تحديث القسم وتنظيم أعمدة ورقته تلقائياً: ${section.title}`);
  };

  const deleteCustomSection = (sectionId: string) => {
    const target = customSections.find(s => s.id === sectionId);
    recordDeletedId(sectionId);
    const nextSections = customSections.filter(s => s.id !== sectionId);
    const nextRecords = customRecords.filter(r => r.sectionId !== sectionId);
    setCustomSections(nextSections);
    customSectionsRef.current = nextSections;
    setRuntimeCustomSections(nextSections);
    setCustomRecords(nextRecords);
    emitServerMutation('customSections', 'delete', { id: sectionId });
    customSectionsDomain.deleteSection(sectionId).catch(() => {});
    const broadcastVer = Math.max(Date.now(), (systemSettings.settingsVersion || 0) + 1);
    try {
      sessionStorage.setItem('al_nashi_local_initiated_settings_ver', String(broadcastVer));
      sessionStorage.setItem('al_nashi_baseline_settings_ver', String(broadcastVer));
    } catch {}
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemSettings: { ...systemSettings, settingsVersion: broadcastVer, lastUpdateNote: `تم حذف قسم: ${target?.title || sectionId}` },
        customSections: nextSections,
        broadcastUpdate: true,
        settingsVersion: broadcastVer,
        updateSummary: `تم حذف قسم: ${target?.title || sectionId}`,
        updatedBy: currentUser?.FullName || 'المطور'
      })
    }).catch(() => {});
    addAuditLog('حذف قسم مخصص', 'لوحة التحكم والعمليات', `تم إزالة القسم (${target?.title || sectionId}) من الواجهة مع الحفاظ غير التدميري على أرشيف الورقة في Google Sheets`);
  };

  // Dynamic Custom Records (سجلات الأقسام المخصصة -> تُوجّه مباشرة إلى ورقة القسم الخاصة بها)
  const addCustomRecord = (recData: Omit<CustomSectionRecord, 'id' | 'createdAt'>): CustomSectionRecord => {
    const newRec: CustomSectionRecord = {
      ...recData,
      id: `rec_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toLocaleString('ar-IQ'),
      createdBy: currentUser?.FullName || 'موظف النظام'
    };
    setCustomRecords(prev => [newRec, ...prev]);
    emitServerMutation('customRecords', 'upsert', { item: newRec });
    customSectionsDomain.saveRecord(newRec, 'insert', getCloudCtx()).catch(() => {});
    return newRec;
  };

  const updateCustomRecord = (record: CustomSectionRecord) => {
    const updated = { ...record, updatedAt: new Date().toISOString() };
    setCustomRecords(prev => prev.map(r => r.id === record.id ? updated : r));
    emitServerMutation('customRecords', 'upsert', { item: updated });
    customSectionsDomain.saveRecord(updated, 'upsert', getCloudCtx()).catch(() => {});
  };

  const deleteCustomRecord = (recordId: string) => {
    const existing = customRecords.find(r => r.id === recordId);
    recordDeletedId(recordId);
    setCustomRecords(prev => prev.filter(r => r.id !== recordId));
    emitServerMutation('customRecords', 'delete', { id: recordId });
    customSectionsDomain.deleteRecord(existing || recordId, getCloudCtx()).catch(() => {});
  };

  // Dynamic Reception Fields (تخصيص وإدارة حقول قسم الاستعلامات والمراجعين)
  const addReceptionCustomField = (fieldData: Omit<CustomFieldDefinition, 'id' | 'name'>): CustomFieldDefinition => {
    const id = `rcf_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const newField: CustomFieldDefinition = {
      ...fieldData,
      id,
      name: id
    };
    const currentFields = systemSettings.receptionCustomFields || [];
    const updatedFields = [...currentFields, newField];
    updateSettings({ receptionCustomFields: updatedFields });
    addAuditLog('إضافة حقل بالاستعلامات', 'لوحة المطور', `تم إضافة الحقل المخصص الجديد (${newField.label}) في الاستعلامات`);
    return newField;
  };

  const deleteReceptionCustomField = (fieldId: string) => {
    const currentFields = systemSettings.receptionCustomFields || [];
    const target = currentFields.find(f => f.id === fieldId);
    const updatedFields = currentFields.filter(f => f.id !== fieldId);
    updateSettings({ receptionCustomFields: updatedFields });
    addAuditLog('حذف حقل بالاستعلامات', 'لوحة المطور', `تم حذف الحقل (${target?.label || fieldId}) من الاستعلامات`);
  };

  const toggleReceptionDefaultField = (fieldKey: string) => {
    const hidden = systemSettings.receptionHiddenDefaultFields || [];
    const updated = hidden.includes(fieldKey)
      ? hidden.filter(k => k !== fieldKey)
      : [...hidden, fieldKey];
    updateSettings({ receptionHiddenDefaultFields: updated });
    addAuditLog('تعديل ظهور حقول الاستعلامات', 'لوحة المطور', `تعديل حالة الحقل: ${fieldKey}`);
  };

  // Developer Passcode Management (رمز دخول المطور السري — قابل للتغيير بالكامل مع إلغاء الرموز القديمة)
  const setDeveloperPasscode = async (newCode: string): Promise<boolean> => {
    const normalized = (newCode || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim();
    if (!normalized || normalized.length < 3) return false;
    setDeveloperPasscodeState(normalized);
    try { localStorage.setItem(STORAGE_KEY_PREFIX + 'dev_passcode', normalized); } catch {}

    // Update Developer user record Password locally & across databases
    const nowIso = new Date().toISOString();
    setUsers(prev => {
      const next = prev.map(u => u.Role === 'developer' ? { ...u, Password: normalized, UpdatedAt: nowIso } : u);
      safeLocalStorageSet(STORAGE_KEY_PREFIX + 'users', JSON.stringify(next));
      return next;
    });

    // Save to shared server auth store immediately
    try {
      await fetch('/api/auth/developer-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCode: normalized })
      });
    } catch (e) {
      console.warn('Saving developer passcode to server warning:', e);
    }

    updateSettings({ developerPasscode: normalized });
    try {
      await fsSaveDeveloperPasscode(normalized);
      const devUser = users.find(u => u.Role === 'developer');
      if (devUser) {
        await fsSaveUser({ ...devUser, Password: normalized, UpdatedAt: nowIso });
      }
    } catch (e) {
      console.warn('Saving passcode to firestore warning:', e);
    }
    addAuditLog('تحديث رمز دخول المطور', 'لوحة المطور', 'قام المطور بتغيير رمز الدخول السري للمنظومة وإلغاء الرمز السابق');
    return true;
  };

  const loginWithDeveloperPasscode = (code: string): boolean => {
    const normalizeDigits = (val: string) =>
      (val || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim();
    const cleanInput = normalizeDigits(code);
    const devAccount = users.find(u => u.Role === 'developer');
    const currentCode = normalizeDigits(developerPasscode || systemSettings.developerPasscode || devAccount?.Password || '2026');
    if (cleanInput && cleanInput === currentCode) {
      const devUser = devAccount || INITIAL_USERS[0];
      setCurrentUser(devUser);
      setIsSplashOpen(false);
      setActiveSection('master_admin');
      addAuditLog('تسجيل دخول ناجح برمز المطور', 'نظام المصادقة', 'دخول المطور بالرمز السري المعتمد');
      triggerDepartmentGreeting(devUser);
      triggerSessionDataLoad('يرجى الانتظار لتحميل بياناتك...');
      return true;
    }
    return false;
  };

  const batchImportRecords = async (
    newCitizens: Citizen[],
    newRequests: OfficeRequest[]
  ): Promise<{ importedCitizens: number; importedRequests: number; firestoreSaved?: boolean; sheetsDispatched?: boolean }> => {
    // 1. Strict validation - filter out ghost/undefined
    const validCitizens = newCitizens.filter(isStrictValidCitizen);
    const validRequests = newRequests.filter(r => r && r.Request_ID && r.Citizen_ID);

    // 2. Single atomic state update (new records placed safely; localStorage persisted asynchronously without UI freeze!)
    const citizensCount = validCitizens.length;
    const requestsCount = validRequests.length;

    if (citizensCount > 0) {
      setCitizens(prev => {
        const existingMap = new Map<string, Citizen>();
        prev.forEach(c => existingMap.set(c.Citizen_ID, c));
        validCitizens.forEach(c => existingMap.set(c.Citizen_ID, c));
        return Array.from(existingMap.values());
      });
    }

    if (requestsCount > 0) {
      setRequests(prev => {
        const existingReqMap = new Map<string, OfficeRequest>();
        prev.forEach(r => existingReqMap.set(r.Request_ID, r));
        validRequests.forEach(r => existingReqMap.set(r.Request_ID, r));
        return Array.from(existingReqMap.values());
      });

      // Authoritatively advance (and self-heal if poisoned > MAX_VALID_OUTGOING_SEQ) office outgoing counters,
      // unless SmartExcelImporterModal just anchored the exact last outgoing number from the uploaded file.
      const recentAnchorMs = systemSettings?.outgoingBaselineSetAt
        ? Date.parse(systemSettings.outgoingBaselineSetAt)
        : 0;
      const hasFreshAnchor = Number.isFinite(recentAnchorMs) && Date.now() - recentAnchorMs < 15_000;

      if (!hasFreshAnchor) {
        const scanned = scanMaxOutgoingSequences(validRequests);
        const rawCurrentNas = Number(systemSettings?.lastOutgoingNumberNasiriyah) || 0;
        const rawCurrentSuq = Number(systemSettings?.lastOutgoingNumberSuq) || 0;
        const nasPoisoned = rawCurrentNas > MAX_VALID_OUTGOING_SEQ;
        const suqPoisoned = rawCurrentSuq > MAX_VALID_OUTGOING_SEQ;
        const safeCurrentNas = nasPoisoned ? 0 : rawCurrentNas;
        const safeCurrentSuq = suqPoisoned ? 0 : rawCurrentSuq;
        const nextNas = Math.max(safeCurrentNas, scanned.maxNasiriyah);
        const nextSuq = Math.max(safeCurrentSuq, scanned.maxSuq);
        if (nasPoisoned || suqPoisoned || nextNas > safeCurrentNas || nextSuq > safeCurrentSuq) {
          updateSettings({
            lastOutgoingNumberNasiriyah: nextNas,
            lastOutgoingNumberSuq: nextSuq
          });
        }
      }
    }

    // 3. Single live bulk sync broadcast to cross-tab BroadcastChannel & server SSE so all devices receive it immediately
    const sanitizedRequests = sanitizeRequestsForStorage(validRequests);
    if (citizensCount > 0 || requestsCount > 0) {
      emitServerBulk({
        citizens: validCitizens,
        requests: sanitizedRequests
      });
    }

    // 4. Dual Cloud Persistence (Firebase Firestore via fast writeBatch chunks + Google Sheets via chunked bulk_sync)
    // Runs asynchronously right after local commit so the UI never freezes while guaranteeing cloud DB & Sheets persistence!
    let firestoreSaved = false;
    let sheetsDispatched = false;

    if (validCitizens.length > 0 || validRequests.length > 0) {
      const firestorePromise = fsBulkSaveCitizensAndRequests(validCitizens, sanitizedRequests)
        .then(res => {
          firestoreSaved = Boolean(res.success && (res.savedCitizens > 0 || res.savedRequests > 0));
          return res;
        })
        .catch(err => {
          console.warn('Batch import Firestore sync warning:', err);
          return { success: false, savedCitizens: 0, savedRequests: 0 };
        });

      const sheetsPromise = pushBulkDataToGoogleSheets(
        validCitizens,
        sanitizedRequests,
        systemSettings.appsScriptUrl,
        systemSettings.googleSheetId
      )
        .then(res => {
          sheetsDispatched = Boolean(res.appsScriptSent || res.directSheetsSent);
          return res;
        })
        .catch(err => {
          console.warn('Batch import Google Sheets sync warning:', err);
          return { appsScriptSent: false, directSheetsSent: false, chunksSent: 0 };
        });

      // Wait up to 4 seconds for fast initial feedback without ever blocking the user on huge 2,000-row imports
      await Promise.race([
        Promise.allSettled([firestorePromise, sheetsPromise]),
        new Promise(resolve => setTimeout(resolve, 4000))
      ]);
    }

    // 5. Audit Log
    addAuditLog(
      'استيراد إكسل دفعي شامل',
      'قسم الإدارة',
      `تم استيراد ومعالجة (${validCitizens.length}) مراجع و (${validRequests.length}) معاملة وحفظها في قاعدة البيانات وجوجل شيت بنجاح`
    );

    return {
      importedCitizens: validCitizens.length,
      importedRequests: validRequests.length,
      firestoreSaved,
      sheetsDispatched
    };
  };

  // Auto-heal poisoned outgoing baselines (e.g. 23182436 stored from an older buggy import)
  useEffect(() => {
    const rawNas = Number(systemSettings?.lastOutgoingNumberNasiriyah) || 0;
    const rawSuq = Number(systemSettings?.lastOutgoingNumberSuq) || 0;
    const nasPoisoned = rawNas > MAX_VALID_OUTGOING_SEQ;
    const suqPoisoned = rawSuq > MAX_VALID_OUTGOING_SEQ;
    if (!nasPoisoned && !suqPoisoned) return;

    const scanned = scanMaxOutgoingSequences(requests, officialLetters);
    const patch: Partial<SystemSettings> = {};
    if (nasPoisoned) patch.lastOutgoingNumberNasiriyah = scanned.maxNasiriyah;
    if (suqPoisoned) patch.lastOutgoingNumberSuq = scanned.maxSuq;
    if (Object.keys(patch).length > 0) {
      updateSettings(patch);
    }
  }, [
    systemSettings?.lastOutgoingNumberNasiriyah,
    systemSettings?.lastOutgoingNumberSuq,
    requests.length,
    officialLetters.length
  ]);

  const updateUiCustomizations = (customizations: Partial<UiCustomizationSettings>) => {
    const current = systemSettings.uiCustomizations || {
      buttonSize: 'standard',
      inputFieldSize: 'standard',
      borderRadius: 'standard',
      showSecondaryPhone: true,
      showClanSurname: true,
      showAcademicEducation: true,
      showCitizenRating: true,
      showDependencyStatus: true,
      tableDensity: 'standard'
    };
    const updated = { ...current, ...customizations };
    updateSettings({ uiCustomizations: updated });
  };

  const syncAllToFirestoreNow = async (): Promise<{ successCount: number; total: number; error?: string }> => {
    setIsFirestoreSyncing(true);
    try {
      const res = await fsBulkPushAll({
        citizens,
        requests,
        interviews,
        officialLetters,
        cheques,
        organizationRecords,
        users,
        systemSettings,
        dropdowns,
        customSections,
        customRecords
      });
      return { successCount: res.count, total: citizens.length + requests.length + interviews.length };
    } catch (e: any) {
      return { successCount: 0, total: 0, error: e.message };
    } finally {
      setIsFirestoreSyncing(false);
    }
  };

  const fetchAllFromFirestoreNow = async (): Promise<{ success: boolean; systemSettings?: Partial<SystemSettings>; error?: string }> => {
    setIsFirestoreSyncing(true);
    try {
      const res = await fsBulkPullAll();
      if (res.success) {
        const deletedIds = getStoredDeletedIds();
        if (Array.isArray(res.deletedIds)) {
          res.deletedIds.forEach(id => {
            if (id) deletedIds.add(id);
          });
        }
        if (res.citizens && res.citizens.length > 0) {
          setCitizens(prev => mergeCitizens(prev, res.citizens, deletedIds));
        }
        if (res.requests && res.requests.length > 0) {
          setRequests(prev => mergeRequests(prev, res.requests, deletedIds));
        }
        if (res.interviews && res.interviews.length > 0) {
          setInterviews(prev => mergeInterviews(prev, res.interviews, deletedIds));
        }
        if (res.officialLetters && res.officialLetters.length > 0) {
          setOfficialLetters(prev => mergeOfficialLetters(prev, res.officialLetters, deletedIds));
        }
        if (res.cheques && res.cheques.length > 0) {
          setCheques(prev => mergeCheques(prev, res.cheques, deletedIds));
        }
        if (res.organizationRecords && res.organizationRecords.length > 0) {
          setOrganizationRecords(prev => mergeOrganizationRecords(prev, res.organizationRecords, deletedIds));
        }
        if (res.customSections && res.customSections.length > 0) {
          setCustomSections(prev => mergeCustomSections(prev, res.customSections, deletedIds));
        }
        if (res.customRecords && res.customRecords.length > 0) {
          setCustomRecords(prev => mergeCustomRecords(prev, res.customRecords, deletedIds));
        }
        if (res.dropdowns && res.dropdowns.length > 0) {
          setDropdowns(prev => {
            const seen = new Set(prev.map(d => `${d.Category.toLowerCase()}:${d.ItemValue.trim().toLowerCase()}`));
            const added = res.dropdowns.filter((d: DropdownItem) => d && d.Category && d.ItemValue && !seen.has(`${d.Category.toLowerCase()}:${d.ItemValue.trim().toLowerCase()}`));
            if (added.length === 0) return prev;
            return [...prev, ...added];
          });
        }
        if (res.users && res.users.length > 0) {
          setUsers(prev => mergeUsers(prev, res.users, deletedIds));
        }
        if (res.notifications && res.notifications.length > 0) {
          setNotifications(res.notifications.slice(0, 80));
        }
        if (res.developerPasscode) setDeveloperPasscodeState(res.developerPasscode);
        if (res.systemSettings) {
          setRuntimeCloudConfig({
            appsScriptUrl: res.systemSettings.appsScriptUrl || res.systemSettings.googleAppsScriptUrl,
            googleSheetId: res.systemSettings.googleSheetId || res.systemSettings.activeGoogleSheetId,
            googleDriveFolderId: res.systemSettings.googleDriveFolderId
          });
          setSystemSettings(prev => ({ ...prev, ...res.systemSettings }));
        }
        return { success: true, systemSettings: res.systemSettings };
      }
      return { success: false, error: res.error };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      setIsFirestoreSyncing(false);
    }
  };

  const loginWithGoogleDeveloper = async (
    onProgress?: (step: number, totalSteps: number, message: string) => void
  ): Promise<{ success: boolean; cancelled?: boolean; error?: string | null }> => {
    try {
      // If the system was zeroed or empty, restore baseline initial data for the new account
      let activeCitizens = citizens;
      let activeRequests = requests;
      let activeInterviews = interviews;
      let activeLetters = officialLetters;
      let activeOrgs = organizationRecords;
      let activeCheques = cheques;

      if (isSystemZeroed || activeCitizens.length === 0) {
        activeCitizens = INITIAL_CITIZENS;
        activeRequests = INITIAL_REQUESTS;
        activeInterviews = INITIAL_INTERVIEWS;
        activeLetters = [
          {
            Letter_ID: 'LET-001',
            LetterNumber: '2026/892',
            LetterDate: '2026-03-12',
            Recipient: 'وزارة الكهرباء - مكتب الوزير',
            Subject: 'نصب محولة كهربائية سعة 400 KVA لمنطقة الحصونة',
            Body: 'نهديكم أطيب التحيات... يرجى التفضل بالموافقة على تجهيز ونصب محولة كهربائية...',
            Citizen_ID: 'CIT-001',
            CitizenName: 'أحمد جاسم محمد علي الخفاجي',
            Status: 'تمت الطباعة والتوقيع',
            ClerkName: 'حيدر الكعبي'
          }
        ];
        activeOrgs = INITIAL_ORGANIZATION;
        activeCheques = INITIAL_CHEQUES;

        setCitizens(activeCitizens);
        setRequests(activeRequests);
        setInterviews(activeInterviews);
        setOfficialLetters(activeLetters);
        setOrganizationRecords(activeOrgs);
        setCheques(activeCheques);
        setIsSystemZeroed(false);
      }

      const res = await loginAndSetupDeveloperCloud({
        citizens: activeCitizens,
        requests: activeRequests,
        interviews: activeInterviews,
        organizationRecords: activeOrgs,
        officialLetters: activeLetters,
        auditLogs,
        users,
        systemSettings,
        dropdowns,
        cheques: activeCheques
      }, onProgress);

      if (!res.success) {
        return res;
      }

      // Update state for connected account
      setIsGoogleConnected(true);
      const email = res.googleUser?.email || 'htaleb725@gmail.com';
      setGoogleUserEmail(email);
      if (res.spreadsheetId) setSpreadsheetId(res.spreadsheetId);
      if (res.folderId) setDriveFolderId(res.folderId);
      sheetsIntegration.refreshLocalConfig();

      // Find or build developer user
      let devUser = users.find(u => u.Role === 'developer');
      if (!devUser) {
        devUser = {
          User_ID: 'USR-001',
          Username: 'developer',
          Role: 'developer',
          RoleArabic: 'مطور النظام (صلاحية مطلقة)',
          FullName: res.googleUser?.displayName || 'م. حيدر العراقي (مطور المنظومة)',
          Department: 'قسم تكنولوجيا المعلومات والبرمجة',
          Status: 'active',
          Avatar: res.googleUser?.photoURL
        };
      } else if (res.googleUser?.displayName || res.googleUser?.photoURL) {
        devUser = {
          ...devUser,
          FullName: devUser.FullName || res.googleUser.displayName || 'مطور المنظومة',
          Avatar: res.googleUser.photoURL || devUser.Avatar
        };
      }

      setCurrentUser(devUser);
      setIsSplashOpen(false);
      setActiveSection('master_admin');

      if (res.spreadsheetId || res.folderId) {
        updateSettings({
          activeGoogleSheetId: res.spreadsheetId || systemSettings.activeGoogleSheetId,
          activeGoogleSheetUrl: res.spreadsheetUrl || systemSettings.activeGoogleSheetUrl,
          googleSheetId: res.spreadsheetId || systemSettings.googleSheetId,
          googleDriveFolderId: res.folderId || systemSettings.googleDriveFolderId
        });
      }

      addAuditLog(
        'ربط حساب Google وإنشاء قاعدة البيانات',
        'لوحة المطور السحابية',
        `تم تسجيل دخول المطور (${email}) وإنشاء وتهيئة قاعدة بيانات Google Sheets ومجلد Google Drive بنجاح`
      );

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'فشل الاتصال السحابي للمطور' };
    }
  };

  const syncAllToGoogleSheetsNow = async (): Promise<{ success: boolean; sheetsSynced: boolean; message: string }> => {
    setIsGoogleSyncing(true);
    let sheetsSynced = false;
    let successMessage = '';
    let hasAnySuccess = false;

    try {
      // 1. Direct REST Sync (via Google OAuth token if available)
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
        if (res.success && res.sheetsSynced) {
          sheetsSynced = true;
          hasAnySuccess = true;
          successMessage = res.message;
        }
      } catch (directErr: any) {
        console.warn('Direct REST Sync note:', directErr);
      }

      // 2. Reliable Apps Script Web App Bulk Sync (uses server proxy + CORE_SCHEMAS clean payloads, NEVER silent no-cors!)
      const envScriptUrl = String((import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL || '').trim();
      const targetScriptUrl =
        envScriptUrl ||
        systemSettings.appsScriptUrl ||
        systemSettings.googleAppsScriptUrl ||
        (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_apps_script_url') || '' : '');
      let appsScriptError = '';

      if (targetScriptUrl && targetScriptUrl.startsWith('http')) {
        try {
          const bulkRes = await pushBulkDataToGoogleSheets(
            citizens,
            requests,
            targetScriptUrl,
            systemSettings.googleSheetId || systemSettings.activeGoogleSheetId,
            {
              interviews,
              officialLetters,
              cheques,
              organizationRecords,
              customSections,
              customRecords,
              users
            }
          );
          if (bulkRes.appsScriptSent || bulkRes.directSheetsSent) {
            sheetsSynced = true;
            hasAnySuccess = true;
            if (!successMessage) {
              successMessage = `تم بنجاح إرسال وتحديث (${citizens.length}) مراجع و (${requests.length}) معاملة و (${customRecords.length}) سجل قسم في Google Sheets عبر Apps Script.`;
            }
          } else if (bulkRes.error) {
            appsScriptError = bulkRes.error;
          }
        } catch (scriptErr: any) {
          appsScriptError = scriptErr?.message || 'تعذر الاتصال برابط Google Apps Script';
          console.warn('Apps Script bulk_sync error:', scriptErr);
        }
      }

      if (hasAnySuccess) {
        return {
          success: true,
          sheetsSynced: true,
          message: successMessage || 'تم بنجاح إرسال وحفظ كافة السجلات في Google Sheets و Google Drive.'
        };
      }

      const failureMsg =
        appsScriptError ||
        'يرجى التأكد من صحة رابط Google Apps Script (/exec) وصلاحية النشر (Anyone) لإتمام الإرسال.';
      pushCloudSyncAlert({
        severity: 'error',
        target: 'google_sheets',
        title: 'فشل مزامنة البيانات مع Google Sheets',
        message: 'تعذر إرسال البيانات إلى Google Apps Script.',
        details: failureMsg
      });
      return {
        success: false,
        sheetsSynced: false,
        message: failureMsg
      };
    } finally {
      setIsGoogleSyncing(false);
    }
  };

  const fetchAllFromGoogleSheetsNow = async (
    overrideScriptUrl?: string,
    overrideSheetId?: string,
    options?: { syncToFirestore?: boolean; replaceAsPrimary?: boolean }
  ): Promise<{ success: boolean; message: string }> => {
    setIsGoogleSyncing(true);
    const deletedIds = getStoredDeletedIds();
    const shouldSyncToFirestore = options?.syncToFirestore !== false;
    const replaceAsPrimary = options?.replaceAsPrimary === true;

    const applyAndMirrorToFirestore = async (
      pulled: {
        citizens?: Citizen[];
        requests?: OfficeRequest[];
        interviews?: Interview[];
        officialLetters?: OfficialLetter[];
        organizationRecords?: OrganizationRecord[];
        cheques?: ChequeRecord[];
        customRecords?: CustomSectionRecord[];
        users?: User[];
      },
      isAuthoritativeSheetSnapshot: boolean = false
    ) => {
      const nowMs = Date.now();
      const recentWindowMs = 30000;

      // Helper to preserve brand-new local/Firestore records (within 30s) that may still be in-flight to Google Sheets
      const keepRecentInFlight = <T extends Record<string, any>>(
        currentList: T[],
        incomingList: T[],
        idKey: keyof T
      ): T[] => {
        const incomingIds = new Set(incomingList.map(i => String(i?.[idKey] || '').trim()).filter(Boolean));
        return currentList.filter(item => {
          const id = String(item?.[idKey] || '').trim();
          if (!id || incomingIds.has(id) || deletedIds.has(id)) return false;
          const ts = getRecordTimestamp(item);
          return ts > 0 && nowMs - ts < recentWindowMs;
        });
      };

      const rawCitizens = mergeCitizens([], pulled.citizens || [], deletedIds);
      // Enrich pulled requests with existing Firestore workflow fields (DirectorDecision, DirectorNotes, CurrentStage, RegisteredVia, attachments)
      // so pulling from Google Sheets NEVER wipes an approved Director decision or Reception workflow state!
      const existingReqMap = new Map<string, OfficeRequest>();
      (requestsRef.current || []).forEach(r => {
        if (r?.Request_ID) existingReqMap.set(r.Request_ID, r);
      });
      const enrichedPulledRequests = (pulled.requests || []).map(r => {
        const existing = r?.Request_ID ? existingReqMap.get(r.Request_ID) : undefined;
        if (!existing) return r;
        const merged = fillMissingFieldsOnly(r, existing);
        // If Firestore has a newer UpdatedAt (e.g., Director just approved), keep newer workflow status cleanly
        const existingTs = getRecordTimestamp(existing);
        const pulledTs = getRecordTimestamp(r);
        if (existingTs > pulledTs && existingTs > 0) {
          return {
            ...merged,
            ...(existing.DirectorDecision ? { DirectorDecision: existing.DirectorDecision } : {}),
            ...(existing.DirectorNotes ? { DirectorNotes: existing.DirectorNotes } : {}),
            ...(existing.DirectorDecisionDate ? { DirectorDecisionDate: existing.DirectorDecisionDate } : {}),
            ...(existing.DirectorDecisionBy ? { DirectorDecisionBy: existing.DirectorDecisionBy } : {}),
            ...(existing.CurrentStage ? { CurrentStage: existing.CurrentStage } : {}),
            ...(existing.RegisteredVia ? { RegisteredVia: existing.RegisteredVia } : {}),
            ...(existing.ReceptionNotes ? { ReceptionNotes: existing.ReceptionNotes } : {}),
            ...(existing.ProcessingStatus ? { ProcessingStatus: existing.ProcessingStatus } : {}),
            ...(existing.DeliveryStatus ? { DeliveryStatus: existing.DeliveryStatus } : {}),
            ...(existing.TargetDepartment ? { TargetDepartment: existing.TargetDepartment } : {}),
            ...(existing.UpdatedAt ? { UpdatedAt: existing.UpdatedAt } : {})
          };
        }
        return merged;
      });

      const rawRequests = mergeRequests([], enrichedPulledRequests, deletedIds);
      const rawInterviews = mergeInterviews([], pulled.interviews || [], deletedIds);
      const rawLetters = mergeOfficialLetters([], pulled.officialLetters || [], deletedIds);
      const rawOrgs = mergeOrganizationRecords([], pulled.organizationRecords || [], deletedIds);
      const rawCheques = mergeCheques([], pulled.cheques || [], deletedIds);
      const rawCustomRecords = mergeCustomRecords([], pulled.customRecords || [], deletedIds);
      const cleanUsers = mergeUsers([], pulled.users || [], deletedIds);

      const cleanCitizens = mergeCitizens(
        keepRecentInFlight(citizensRef.current || [], rawCitizens, 'Citizen_ID'),
        rawCitizens,
        deletedIds
      );
      const cleanRequests = mergeRequests(
        keepRecentInFlight(requestsRef.current || [], rawRequests, 'Request_ID'),
        rawRequests,
        deletedIds
      );
      const cleanInterviews = mergeInterviews(
        keepRecentInFlight(interviewsRef.current || [], rawInterviews, 'Interview_ID'),
        rawInterviews,
        deletedIds
      );
      const cleanLetters = mergeOfficialLetters(
        keepRecentInFlight(officialLettersRef.current || [], rawLetters, 'Letter_ID'),
        rawLetters,
        deletedIds
      );
      const cleanOrgs = mergeOrganizationRecords(
        keepRecentInFlight(organizationRecordsRef.current || [], rawOrgs, 'Citizen_ID'),
        rawOrgs,
        deletedIds
      );
      const cleanCheques = mergeCheques(
        keepRecentInFlight(chequesRef.current || [], rawCheques, 'id'),
        rawCheques,
        deletedIds
      );
      const cleanCustomRecords = mergeCustomRecords(
        keepRecentInFlight(customRecordsRef.current || [], rawCustomRecords, 'id'),
        rawCustomRecords,
        deletedIds
      );

      // Update React UI immediately (including deletions when authoritative sheet snapshot succeeded)
      if (isAuthoritativeSheetSnapshot && replaceAsPrimary) {
        setCitizens(cleanCitizens);
        setRequests(cleanRequests);
        setInterviews(cleanInterviews);
        setOfficialLetters(cleanLetters);
        setOrganizationRecords(cleanOrgs);
        setCheques(cleanCheques);
        setCustomRecords(cleanCustomRecords);
      } else {
        if (cleanCitizens.length > 0) {
          setCitizens(prev => (replaceAsPrimary ? cleanCitizens : mergeCitizens(prev, cleanCitizens, deletedIds)));
        }
        if (cleanRequests.length > 0) {
          setRequests(prev => (replaceAsPrimary ? cleanRequests : mergeRequests(prev, cleanRequests, deletedIds)));
        }
        if (cleanInterviews.length > 0) {
          setInterviews(prev => (replaceAsPrimary ? cleanInterviews : mergeInterviews(prev, cleanInterviews, deletedIds)));
        }
        if (cleanLetters.length > 0) {
          setOfficialLetters(prev => (replaceAsPrimary ? cleanLetters : mergeOfficialLetters(prev, cleanLetters, deletedIds)));
        }
        if (cleanOrgs.length > 0) {
          setOrganizationRecords(prev => (replaceAsPrimary ? cleanOrgs : mergeOrganizationRecords(prev, cleanOrgs, deletedIds)));
        }
        if (cleanCheques.length > 0) {
          setCheques(prev => (replaceAsPrimary ? cleanCheques : mergeCheques(prev, cleanCheques, deletedIds)));
        }
        if (cleanCustomRecords.length > 0) {
          setCustomRecords(prev => (replaceAsPrimary ? cleanCustomRecords : mergeCustomRecords(prev, cleanCustomRecords, deletedIds)));
        }
      }
      if (cleanUsers.length > 0) {
        setUsers(prev => mergeUsers(prev, cleanUsers, deletedIds));
      }

      // Immediately mirror authoritative Google Sheet records & deletions directly into Firebase Firestore
      const totalPulled =
        cleanCitizens.length +
        cleanRequests.length +
        cleanInterviews.length +
        cleanLetters.length +
        cleanOrgs.length +
        cleanCheques.length +
        cleanCustomRecords.length;

      if (shouldSyncToFirestore) {
        if (totalPulled > 0) {
          void fsBulkPushAll({
            citizens: cleanCitizens,
            requests: cleanRequests,
            interviews: cleanInterviews,
            officialLetters: cleanLetters,
            cheques: cleanCheques,
            organizationRecords: cleanOrgs,
            users: cleanUsers,
            systemSettings: undefined as unknown as SystemSettings,
            dropdowns: [],
            customSections: [],
            customRecords: cleanCustomRecords
          }).catch(err => console.warn('Direct Google Sheet -> Firestore sync notice:', err));
        }

        // Two-way deletion reconciliation: if rows were deleted directly in Google Sheets, remove them from Firestore too
        if (isAuthoritativeSheetSnapshot && replaceAsPrimary) {
          void Promise.allSettled([
            fsReconcileDeletedDocs(FS_COLLECTIONS.CITIZENS, new Set(cleanCitizens.map(c => c.Citizen_ID)), 'Citizen_ID', recentWindowMs),
            fsReconcileDeletedDocs(FS_COLLECTIONS.REQUESTS, new Set(cleanRequests.map(r => r.Request_ID)), 'Request_ID', recentWindowMs),
            fsReconcileDeletedDocs(FS_COLLECTIONS.INTERVIEWS, new Set(cleanInterviews.map(i => i.Interview_ID)), 'Interview_ID', recentWindowMs),
            fsReconcileDeletedDocs(FS_COLLECTIONS.LETTERS, new Set(cleanLetters.map(l => l.Letter_ID)), 'Letter_ID', recentWindowMs),
            fsReconcileDeletedDocs(FS_COLLECTIONS.ORGANIZATIONS, new Set(cleanOrgs.map(o => o.Citizen_ID)), 'Citizen_ID', recentWindowMs),
            fsReconcileDeletedDocs(FS_COLLECTIONS.CHEQUES, new Set(cleanCheques.map(ch => ch.id)), 'id', recentWindowMs),
            fsReconcileDeletedDocs(FS_COLLECTIONS.CUSTOM_RECORDS, new Set(cleanCustomRecords.map(cr => cr.id)), 'id', recentWindowMs)
          ]).catch(() => {});
        }
      }

      return { cleanCitizens, cleanRequests, cleanCustomRecords };
    };

    try {
      // Attempt 1: Google Apps Script Web App (Authoritative primary reference — works on Vercel & every device!)
      const targetScriptUrl =
        overrideScriptUrl ||
        (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL ||
        systemSettingsRef.current.appsScriptUrl ||
        systemSettingsRef.current.googleAppsScriptUrl ||
        (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_apps_script_url') : '');

      let appsScriptPullError = '';
      if (targetScriptUrl && targetScriptUrl.startsWith('http')) {
        try {
          const scriptRes = await pullDataFromGoogleAppsScript(targetScriptUrl);
          if (scriptRes && scriptRes.success && scriptRes.data) {
            const { cleanCitizens, cleanRequests, cleanCustomRecords } = await applyAndMirrorToFirestore(scriptRes.data, true);
            return {
              success: true,
              message:
                scriptRes.message ||
                `✓ تم سحب (${cleanCitizens.length}) مراجع و (${cleanRequests.length}) معاملة و (${cleanCustomRecords.length}) سجل قسم من Google Sheets وتحديث Firebase Firestore مباشرة.`
            };
          }
          if (scriptRes && !scriptRes.success) {
            appsScriptPullError = scriptRes.error || scriptRes.message || '';
          }
        } catch (scriptErr: any) {
          appsScriptPullError = scriptErr?.message || 'تعذر سحب البيانات من Google Apps Script';
          console.warn('Apps Script fetch notice:', scriptErr);
        }
      }

      // Attempt 2: Direct Integration Layer (when OAuth token & sheetId are active)
      try {
        if (overrideSheetId) {
          setRuntimeCloudConfig({ googleSheetId: overrideSheetId });
        }
        const fullData = await sheetsIntegration.fetchAllData();
        if (fullData && ((fullData.citizens && fullData.citizens.length > 0) || (fullData.requests && fullData.requests.length > 0))) {
          const { cleanCitizens, cleanRequests } = await applyAndMirrorToFirestore(fullData);
          return {
            success: true,
            message: `✓ تم سحب (${cleanCitizens.length}) مراجع و (${cleanRequests.length}) معاملة من Google Sheets وتحديث Firebase Firestore مباشرة.`
          };
        }
      } catch (directErr) {
        console.warn('Direct Integration Layer fetch notice:', directErr);
      }

      // Attempt 3: Direct REST BatchGet
      try {
        const res = await pullAllDataFromGoogleSheets();
        if (res.success && res.data && (res.data.citizens.length > 0 || res.data.requests.length > 0)) {
          await applyAndMirrorToFirestore(res.data);
          return { success: true, message: `✓ ${res.message}` };
        }
      } catch (batchErr) {
        console.warn('pullAllDataFromGoogleSheets notice:', batchErr);
      }

      return {
        success: false,
        message: appsScriptPullError || 'لا تتوفر بيانات جديدة من Google Sheets أو تعذر الاتصال برابط Apps Script (/exec).'
      };
    } finally {
      setIsGoogleSyncing(false);
    }
  };

  const triggerDeveloper3WaySync = async () => {
    return await syncAllToGoogleSheetsNow();
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        login,
        lastLoginError,
        logout,
        switchUser,
        assignedWorkstationUser,
        assignWorkstationUser,
        directLoginAsAssigned,
        addUser,
        updateUser,
        deleteUser,
        syncUsersToAllDatabasesNow,
        checkCloudDbHealth,
        activeSection,
        setActiveSection,
        isSplashOpen,
        setIsSplashOpen,
        isAuthenticated: !isSplashOpen && currentUser !== null,
        citizens,
        addCitizen,
        updateCitizen,
        deleteCitizen,
        findCitizenByIdOrName,
        blockCitizen,
        unblockCitizen,
        checkIfCitizenBlocked,
        requests,
        addRequest,
        updateRequest,
        deleteRequest,
        bulkUpdateRequestsStatus,
        cheques,
        addCheque,
        updateCheque,
        deleteCheque,
        interviews,
        addInterview,
        updateInterview,
        deleteInterview,
        convertInterviewToRequest,
        organizationRecords,
        upsertOrgRecord,
        addOrganizationRecord: upsertOrgRecord,
        updateOrganizationRecord: (rec: OrganizationRecord) => upsertOrgRecord(rec),
        dropdowns,
        addDropdownItem,
        removeDropdownItem,
        getDropdownOptions,
        auditLogs,
        addAuditLog,
        dynamicFields,
        addDynamicField,
        deleteDynamicField,
        documents,
        addDocument,
        deleteDocument,
        officialLetters,
        addOfficialLetter,
        updateOfficialLetter,
        deleteOfficialLetter,
        whatsappTemplates,
        systemSettings,
        updateSettings,
        updateSystemSettings: updateSettings,
        notifications,
        addNotification,
        markNotificationAsRead,
        dismissNotification,
        markAllNotificationsAsRead,
        clearReadNotifications,
        departmentGreeting,
        setDepartmentGreeting,
        triggerDepartmentGreeting,
        printableCitizenCard,
        setPrintableCitizenCard,
        printableBadgeCitizen,
        setPrintableBadgeCitizen,
        printableArchiveCitizen,
        setPrintableArchiveCitizen,
        smartArchiveCitizen,
        selectedCitizenForHistory,
        setSelectedCitizenForHistory,
        isDesktopInstallModalOpen,
        setIsDesktopInstallModalOpen,
        isSystemWipeModalOpen,
        setIsSystemWipeModalOpen,
        globalSearchQuery,
        setGlobalSearchQuery,
        forwardCitizenWorkflow,
        forwardRequestWorkflow,
        canPrintOfficialCard,
        exportToExcel,
        resetToDefaultData,
        resetToInitialData: resetToDefaultData,
        wipeAllSystemData,
        wipeSelectedSections,
        isSystemZeroed,
        isGoogleConnected,
        isGoogleSyncing,
        googleUserEmail,
        spreadsheetId,
        driveFolderId,
        setGoogleDriveFolderId,
        syncAllToGoogleSheetsNow,
        fetchAllFromGoogleSheetsNow,
        loginWithGoogleDeveloper,
        triggerDeveloperGoogleSync: syncAllToGoogleSheetsNow,
        sheetsIntegration,
        // Custom Dynamic Sections & Records
        customSections,
        addCustomSection,
        updateCustomSection,
        deleteCustomSection,
        customRecords,
        addCustomRecord,
        updateCustomRecord,
        deleteCustomRecord,
        // Developer Passcode & Controls
        developerPasscode,
        setDeveloperPasscode,
        loginWithDeveloperPasscode,
        // Reception Custom Fields
        addReceptionCustomField,
        deleteReceptionCustomField,
        toggleReceptionDefaultField,
        // 2-Second Employee Entry Loading Message & Data Hydration
        isSessionLoading,
        sessionLoadingMessage,
        triggerSessionDataLoad,
        canDownloadDatabase,
        refreshAllDataFromAllSources,
        // UI Customizations
        updateUiCustomizations,
        // Firestore Direct Live Sync
        isFirestoreSyncing,
        syncAllToFirestoreNow,
        fetchAllFromFirestoreNow,
        batchImportRecords,
        // Compatibility aliases
        triggerDeveloper3WaySync,
        isSupabaseConnected: false,
        isSupabaseSyncing: isGoogleSyncing,
        syncAllDataToSupabase: syncAllToGoogleSheetsNow,
        fetchAllDataFromSupabase: fetchAllFromGoogleSheetsNow
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const useAppContext = useApp;

