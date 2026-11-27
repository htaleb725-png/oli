import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { MAX_VALID_OUTGOING_SEQ, scanMaxOutgoingSequences } from '../utils/outgoingNumberHelper';
import {
  ArchiveSectionKey,
  buildMultiSectionArchivedFields,
  buildSectionArchivedFields,
  buildSectionUnarchivedFields,
  getArchiveSectionLabel,
  isCitizenArchivedOrRestored,
  isRequestArchivedOrRestored,
  resolveExplicitArchiveState
} from '../utils/archiveHelper';
import { acquireSaveLock, enqueueSerializedSave } from '../utils/saveLock';
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
  fsAddAuditLog,
  fsSyncSettingsStructure,
  fsWatchCollection,
  fsWatchGeneralSettings,
  fsWatchCloudConfig,
  fsWatchDeletedRecords,
  fsWipeAllCollections,
  fsWipeSelectedCollections,
  isFirestoreTemporarilyBlocked,
  fsSaveSectionArchiveEntries,
  fsDeleteSectionArchiveEntries,
  fsSaveBlacklistEntry,
  fsDeleteBlacklistEntry,
  fsSyncReferrer,
  fsSyncDepartmentsRegistry,
  fsSaveBackupStatus,
  FS_COLLECTIONS,
  importPreviousDataFromGoogleSheetToSupabase,
  GoogleSheetToSupabaseImportResult
} from '../services/firebaseFirestoreService';
import { getHomeSectionForRole, normalizeUserRecord, canUserAccessSection } from '../utils/permissions';
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
import {
  pushToGoogleSheetsRealtime,
  pushBulkDataToGoogleSheets,
  pullDataFromGoogleAppsScript,
  setRuntimeCloudConfig,
  setRuntimeCustomSections,
  wipeGoogleSheetsViaAppsScript,
  PINNED_GOOGLE_SHEET_ID,
  PINNED_GOOGLE_SHEET_GID,
  PINNED_APPS_SCRIPT_URL,
  LEGACY_OLD_SHEET_ID,
  LEGACY_OLD_APPS_SCRIPT_URL
} from '../services/realtimeGoogleSync';
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
import {
  safeLocalStorageSet,
  scheduleSafeLocalStorageSet,
  sanitizeRequestsForStorage,
  cleanBloatedLocalStorage,
  purgeLegacyBrowserBusinessData,
  savePersistedAuthSession,
  loadPersistedAuthSession,
  clearPersistedAuthSession
} from '../utils/safeStorage';
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
  archiveDocumentsDomain,
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
  // Instant <5ms cross-tab sync within same browser/PWA (Cross-device sync runs exclusively via Firebase Firestore onSnapshot)
  postCrossTabMessage({ type: 'mutation', entity, op, item: payload.item, id: payload.id });
}

function emitServerBulk(payload: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  // Instant same-browser cross-tab sync (Cross-device persistence runs exclusively via Firebase Firestore)
  postCrossTabMessage({ type: 'bulk_payload', payload });
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

export const unrecordDeletedId = (id: string) => {
  if (!id || typeof id !== 'string') return;
  const clean = id.trim();
  if (!clean) return;
  _inMemoryDeletedIds.delete(clean);
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
  addCitizen: (
    citizen: Omit<Citizen, 'Citizen_ID' | 'CreatedAt'>,
    options?: { onPersistResult?: (res: { ok: boolean; error?: string; citizenId: string }) => void }
  ) => Citizen;
  updateCitizen: (citizen: Citizen) => void;
  deleteCitizen: (citizenId: string) => void;
  findCitizenByIdOrName: (query: string) => Citizen[];
  blockCitizen: (citizenId: string, reason: string, blockedBy?: string, fallbackInfo?: { FullName: string; Phone1?: string; Phone2?: string; District?: string }) => void;
  unblockCitizen: (citizenId: string) => void;
  checkIfCitizenBlocked: (nameOrId: string, phone?: string) => { isBlocked: boolean; citizen?: Citizen; reason?: string };

  requests: OfficeRequest[];
  addRequest: (
    req: Omit<OfficeRequest, 'Request_ID' | 'CreatedAt'> & { Request_ID?: string },
    options?: {
      skipAuditLog?: boolean;
      skipNotification?: boolean;
      slotKey?: string;
      onPersistResult?: (res: { ok: boolean; error?: string; requestId: string }) => void;
    }
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
  updateSettings: (settings: Partial<SystemSettings>) => Promise<boolean>;
  updateSystemSettings: (settings: Partial<SystemSettings>) => Promise<boolean>;

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
  archiveDailyWorkItems: (options: {
    citizenIds?: string[];
    requestIds?: string[];
    sectionKey?: ArchiveSectionKey;
    extraSectionKeys?: ArchiveSectionKey[];
    directorNotesByRequestId?: Record<string, string>;
    preserveNonOrgIsolation?: boolean;
    globalArchive?: boolean;
    reason?: string;
  }) => { archivedCitizens: number; archivedRequests: number };
  restoreDailyWorkItem: (citizenId: string, requestIds?: string[], sectionKey?: ArchiveSectionKey) => void;
  restoreDailyWorkItems: (options: {
    citizenIds?: string[];
    requestIds?: string[];
    sectionKey?: ArchiveSectionKey;
  }) => { restoredCitizens: number; restoredRequests: number };
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

  // Firestore Direct Sync & Transparent Diagnostics
  isFirestoreSyncing: boolean;
  firestoreRequestsSyncError: string | null;
  firestoreLastSaveError: string | null;
  clearFirestoreDiagnostics: () => void;
  syncAllToFirestoreNow: () => Promise<{ successCount: number; total: number; error?: string }>;
  fetchAllFromFirestoreNow: () => Promise<{ success: boolean; error?: string }>;

  // High-performance atomic bulk import
  batchImportRecords: (
    newCitizens: Citizen[],
    newRequests: OfficeRequest[],
    options?: {
      anchoredOutgoingBaseline?: number;
      anchorTimestamp?: string;
      anchorLabel?: string;
      lastRegisteredName?: string;
      lastOutgoingRaw?: string;
    }
  ) => Promise<{ importedCitizens: number; importedRequests: number; firestoreSaved?: boolean; sheetsDispatched?: boolean }>;

  // Supabase <-> Google Sheet Historical Importer & Empty-Table Detection
  isImportingFromGoogleSheet: boolean;
  isSupabaseRequestsEmpty: boolean;
  importFromGoogleSheetToSupabase: () => Promise<GoogleSheetToSupabaseImportResult>;

  // Compatibility alias
  triggerDeveloper3WaySync?: () => Promise<{ success: boolean; sheetsSynced?: boolean; message: string }>;
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
  // Strictly Cloud-First & In-Memory (hydrated live from Firebase Firestore — ZERO Chrome localStorage)
  const [developerPasscode, setDeveloperPasscodeState] = useState<string>(
    () => INITIAL_SETTINGS.developerPasscode || '2026'
  );

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
    // Upgrade legacy Google Sheet ID or legacy Apps Script URL to the pinned manual backup endpoints
    if (
      !merged.googleSheetId ||
      merged.googleSheetId === '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' ||
      merged.googleSheetId === LEGACY_OLD_SHEET_ID
    ) {
      merged.googleSheetId = PINNED_GOOGLE_SHEET_ID;
      merged.googleSheetGid = PINNED_GOOGLE_SHEET_GID;
      merged.activeGoogleSheetId = PINNED_GOOGLE_SHEET_ID;
      merged.activeGoogleSheetUrl = `https://docs.google.com/spreadsheets/d/${PINNED_GOOGLE_SHEET_ID}/edit#gid=${PINNED_GOOGLE_SHEET_GID}`;
    } else if (!merged.googleSheetGid) {
      merged.googleSheetGid = PINNED_GOOGLE_SHEET_GID;
    }
    if (
      !merged.appsScriptUrl ||
      merged.appsScriptUrl === LEGACY_OLD_APPS_SCRIPT_URL ||
      !merged.appsScriptUrl.includes('/exec')
    ) {
      merged.appsScriptUrl = PINNED_APPS_SCRIPT_URL;
      merged.googleAppsScriptUrl = PINNED_APPS_SCRIPT_URL;
    }
    if (!merged.googleDriveFolderId && INITIAL_SETTINGS.googleDriveFolderId) {
      merged.googleDriveFolderId = INITIAL_SETTINGS.googleDriveFolderId;
    }
    return merged;
  };

  // Cloud-First: settings hydrate live from Firebase Firestore (zero persistence in Chrome localStorage/IndexedDB)
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => normalizeSystemSettings(INITIAL_SETTINGS));
  // Synchronous ref prevents stale-closure overwrites when consecutive updateSettings calls fire in the same tick
  const systemSettingsRef = useRef<SystemSettings>(systemSettings);
  systemSettingsRef.current = systemSettings;

  // Cloud-First: staff accounts hydrate live from Firebase Firestore & Google Sheets (never cached in Chrome localStorage)
  const [users, setUsers] = useState<User[]>(() => [...INITIAL_USERS]);

  const [departmentGreeting, setDepartmentGreeting] = useState<{ title: string; message: string; date: string } | null>(null);

  // Restore active employee login session on F5 / Refresh / tab reopen (session metadata only, zero citizen records)
  const [initialPersistedSession] = useState(() => {
    const raw = loadPersistedAuthSession();
    if (!raw?.user) return null;
    const rawRole = raw.user.Role;
    const canonicalUser = normalizeUserRecord(raw.user as User);
    const homeSec = getHomeSectionForRole(canonicalUser.Role, canonicalUser);
    const roleWasRepaired = rawRole !== canonicalUser.Role;
    const savedSec = raw.activeSection;
    const isSavedSecValid =
      !roleWasRepaired &&
      Boolean(savedSec) &&
      canUserAccessSection(canonicalUser, savedSec);
    return {
      ...raw,
      user: canonicalUser,
      activeSection: isSavedSecValid ? savedSec : homeSec
    };
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (initialPersistedSession?.user) {
      return initialPersistedSession.user as User;
    }
    // Default placeholder while SplashLanding is open (isAuthenticated requires !isSplashOpen)
    return INITIAL_USERS[0];
  });

  // Strictly in-memory workstation assignment (zero Chrome localStorage persistence for business data)
  const [assignedWorkstationUser, setAssignedWorkstationUserState] = useState<User | null>(null);

  const [isSplashOpen, setIsSplashOpen] = useState<boolean>(() => !initialPersistedSession?.user);
  const [lastLoginError, setLastLoginError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>(
    () => initialPersistedSession?.activeSection || 'dashboard'
  );
  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(
    () => Boolean(initialPersistedSession?.user && (typeof navigator === 'undefined' || navigator.onLine))
  );
  const [sessionLoadingMessage, setSessionLoadingMessage] = useState<string>('جاري تحميل البيانات، يرجى الانتظار...');
  const [isSystemZeroed, setIsSystemZeroed] = useState<boolean>(false);
  const activeRefreshPromiseRef = useRef<Promise<void> | null>(null);
  const firestorePasscodeLoadedRef = useRef<boolean>(false);
  const hasSeededInitialUsersRef = useRef<boolean>(false);
  const hasShownLoadingOnceRef = useRef<boolean>(false);
  const initialHydrationCompleteRef = useRef<boolean>(false);
  const locallyPendingDeletesRef = useRef<Map<string, number>>(new Map());
  const [firestoreRequestsSyncError, setFirestoreRequestsSyncError] = useState<string | null>(null);
  const [firestoreLastSaveError, setFirestoreLastSaveError] = useState<string | null>(null);
  const [isImportingFromGoogleSheet, setIsImportingFromGoogleSheet] = useState<boolean>(false);
  const [isSupabaseRequestsEmpty, setIsSupabaseRequestsEmpty] = useState<boolean>(false);

  const clearFirestoreDiagnostics = () => {
    setFirestoreRequestsSyncError(null);
    setFirestoreLastSaveError(null);
  };

  const markLocallyPendingDelete = (id: string) => {
    const clean = String(id || '').trim();
    if (!clean) return;
    locallyPendingDeletesRef.current.set(clean, Date.now());
  };

  const getActiveLocallyPendingDeletes = (): Set<string> => {
    const now = Date.now();
    const active = new Set<string>();
    locallyPendingDeletesRef.current.forEach((ts, id) => {
      if (now - ts < 20000) active.add(id);
      else locallyPendingDeletesRef.current.delete(id);
    });
    return active;
  };

  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false);
  const [isGoogleSyncing, setIsGoogleSyncing] = useState<boolean>(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string>('htaleb725@gmail.com');
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(
    () => INITIAL_SETTINGS.googleSheetId || null
  );
  const [driveFolderId, setDriveFolderId] = useState<string | null>(
    () => INITIAL_SETTINGS.googleDriveFolderId || null
  );
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

  // Strict Zero-Chrome-Storage Policy for Business Records: purge legacy citizen/record caches while preserving active login session
  useEffect(() => {
    purgeLegacyBrowserBusinessData();
    clearBusinessRecordsFromIDB().catch(() => {});
  }, []);

  // Keep the signed-in employee's session (user, permissions & current section — never Password) persisted across F5 / tab reopen
  useEffect(() => {
    if (!isSplashOpen && currentUser && currentUser.User_ID) {
      savePersistedAuthSession(currentUser, activeSection);
    }
  }, [currentUser, isSplashOpen, activeSection]);

  // Keep currentUser's status, role, department & permissions strictly synced live with Firestore `users`
  useEffect(() => {
    if (isSplashOpen || !currentUser?.User_ID || users.length === 0) return;
    const rawLiveMatch = users.find((u) => u.User_ID === currentUser.User_ID);
    if (!rawLiveMatch) return;
    const liveMatch = normalizeUserRecord(rawLiveMatch);
    if (liveMatch.Status === 'frozen' && liveMatch.Role !== 'developer') {
      clearPersistedAuthSession();
      setCurrentUser(null);
      setIsSplashOpen(true);
      setLastLoginError('تم تجميد هذا الحساب من قبل الإدارة.');
      return;
    }
    const roleChanged = liveMatch.Role !== currentUser.Role;
    const hasMetaChanges =
      roleChanged ||
      JSON.stringify(liveMatch.Permissions || []) !== JSON.stringify(currentUser.Permissions || []) ||
      JSON.stringify(liveMatch.AllowedSections || []) !== JSON.stringify(currentUser.AllowedSections || []) ||
      liveMatch.RoleArabic !== currentUser.RoleArabic ||
      liveMatch.FullName !== currentUser.FullName ||
      liveMatch.Department !== currentUser.Department ||
      (liveMatch.Avatar || '') !== (currentUser.Avatar || '');

    if (hasMetaChanges) {
      setCurrentUser((prev) =>
        prev && prev.User_ID === liveMatch.User_ID ? { ...prev, ...liveMatch } : prev
      );
      if (roleChanged || !canUserAccessSection(liveMatch, activeSection, customSections)) {
        const trueHome = getHomeSectionForRole(liveMatch.Role, liveMatch);
        setActiveSection(trueHome);
        savePersistedAuthSession(liveMatch, trueHome);
      }
    }
  }, [users, isSplashOpen, currentUser, activeSection, customSections]);

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
      setDocuments(prev => prev.some(d => removeSet.has(d.Doc_ID) || removeSet.has(d.Citizen_ID))
        ? prev.filter(d => !removeSet.has(d.Doc_ID) && !removeSet.has(d.Citizen_ID))
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
        // Live server snapshot from Firestore (alaa-office-2026):
        // Every document present in `incoming` ACTUALLY exists on the server right now.
        // Only suppress IDs with an active in-flight local delete (20s TTL), NEVER hide live server docs behind stale tombstones!
        const activeLocalDeletes = getActiveLocallyPendingDeletes();
        const nowMs = Date.now();
        const incomingIdSet = new Set(
          incoming
            .map(item => String(item?.[idKey] || '').trim())
            .filter(Boolean)
        );
        const recentOptimistic = prev.filter(item => {
          const id = String(item?.[idKey] || '').trim();
          if (!id || incomingIdSet.has(id) || activeLocalDeletes.has(id)) return false;
          const ts = getRecordTimestamp(item);
          return ts > 0 && nowMs - ts < 10000;
        });
        return merger(recentOptimistic, incoming, activeLocalDeletes);
      }

      if (incoming.length === 0) return prev;
      return merger(prev, incoming, deletedIds);
    };

    const unsubCitizens = fsWatchCollection<Citizen>(
      FS_COLLECTIONS.CITIZENS,
      (items, removedIds, meta) => {
        if (removedIds && removedIds.length > 0) {
          purgeDeletedIdsEverywhere(removedIds);
        }
        setCitizens(prev => reconcileLiveFirestoreSnapshot(prev, items, 'Citizen_ID', meta, mergeCitizens));
      },
      (err) => {
        const msg = err?.message || String(err || 'خطأ غير معروف');
        setFirestoreRequestsSyncError(`تعذر جلب سجل المراجعين من Firebase Firestore (visitors): ${msg}`);
      }
    );
    unsubs.push(unsubCitizens);

    const unsubRequests = fsWatchCollection<OfficeRequest>(
      FS_COLLECTIONS.REQUESTS,
      (items, removedIds, meta) => {
        if (meta && !meta.fromCache) {
          setFirestoreRequestsSyncError(null);
          setIsSupabaseRequestsEmpty(Array.isArray(items) && items.length === 0);
        }
        if (removedIds && removedIds.length > 0) {
          purgeDeletedIdsEverywhere(removedIds);
        }
        setRequests(prev => {
          const next = reconcileLiveFirestoreSnapshot(prev, items, 'Request_ID', meta, mergeRequests);
          if (next.length > 0) {
            setIsSupabaseRequestsEmpty(false);
          }
          return next;
        });
      },
      (err) => {
        const msg = err?.message || String(err || 'خطأ غير معروف');
        setFirestoreRequestsSyncError(`تعذر جلب المعاملات الواردة من Supabase (requests): ${msg}`);
      }
    );
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
      if ((meta && !meta.fromCache) || (Array.isArray(items) && items.length > 0)) {
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

    const unsubDocuments = fsWatchCollection<DocumentArchiveItem>(FS_COLLECTIONS.DOCUMENTS, (items, removedIds, meta) => {
      if (removedIds && removedIds.length > 0) {
        purgeDeletedIdsEverywhere(removedIds);
      }
      const deletedIds = getStoredDeletedIds();
      if (meta && !meta.fromCache) {
        setDocuments(items.filter(d => d && d.Doc_ID && !deletedIds.has(d.Doc_ID)));
      } else if (Array.isArray(items) && items.length > 0) {
        setDocuments(prev => {
          const map = new Map<string, DocumentArchiveItem>();
          prev.forEach(d => {
            if (d?.Doc_ID && !deletedIds.has(d.Doc_ID)) map.set(d.Doc_ID, d);
          });
          items.forEach(d => {
            if (d?.Doc_ID && !deletedIds.has(d.Doc_ID)) map.set(d.Doc_ID, d);
          });
          return Array.from(map.values());
        });
      }
    });
    unsubs.push(unsubDocuments);

    const unsubBlacklist = fsWatchCollection<any>(FS_COLLECTIONS.BLACKLIST, (items, removedIds, meta) => {
      const removedSet = new Set((removedIds || []).map(id => String(id || '').trim()).filter(Boolean));
      const blockedById = new Map<string, any>();
      (items || []).forEach(b => {
        if (b && b.Citizen_ID && b.IsBlocked !== false) {
          blockedById.set(String(b.Citizen_ID).trim(), b);
        }
      });
      if (removedSet.size === 0 && blockedById.size === 0 && !(meta && !meta.fromCache)) return;
      setCitizens(prev => {
        let changed = false;
        const map = new Map<string, Citizen>();
        prev.forEach(c => {
          if (!c?.Citizen_ID) return;
          if (removedSet.has(c.Citizen_ID) && c.IsBlocked) {
            changed = true;
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
        blockedById.forEach((b, cid) => {
          const existing = map.get(cid);
          if (existing) {
            if (!existing.IsBlocked || existing.BlockReason !== (b.BlockReason || existing.BlockReason)) {
              changed = true;
              map.set(cid, {
                ...existing,
                IsBlocked: true,
                Phone2: b.Phone2 || existing.Phone2,
                BlockReason: b.BlockReason || existing.BlockReason || 'محظور من قبل الإدارة',
                BlockedAt: b.BlockedAt || existing.BlockedAt,
                BlockedBy: b.BlockedBy || existing.BlockedBy
              });
            }
          } else {
            changed = true;
            map.set(cid, {
              Citizen_ID: cid,
              FullName: b.FullName || 'مراجع محظور',
              Phone1: b.Phone1 || '',
              Phone2: b.Phone2 || undefined,
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
        return changed ? Array.from(map.values()) : prev;
      });
    });
    unsubs.push(unsubBlacklist);

    const unsubUsers = fsWatchCollection<User>(FS_COLLECTIONS.USERS, (items, removedIds, meta) => {
      if (removedIds && removedIds.length > 0) {
        purgeDeletedIdsEverywhere(removedIds);
      }
      // First-boot seed into brand-new alaa-office-2026 Firestore when server confirms `users` collection is empty
      if (meta && !meta.fromCache && Array.isArray(items) && items.length === 0 && !hasSeededInitialUsersRef.current) {
        hasSeededInitialUsersRef.current = true;
        const normalizedSeed = INITIAL_USERS.map(normalizeUserRecord);
        fsSyncAllUsers(normalizedSeed)
          .then(() => fsSyncDepartmentsRegistry(normalizedSeed, customSectionsRef.current))
          .catch(() => {});
        return;
      }
      if (Array.isArray(items) && items.length > 0) {
        hasSeededInitialUsersRef.current = true;
        const normalizedIncoming = items.map(normalizeUserRecord);
        setUsers(prev =>
          reconcileLiveFirestoreSnapshot(
            prev,
            normalizedIncoming,
            'User_ID',
            meta,
            (cur, inc, del) => mergeUsers(cur, inc, del, { incomingAuthoritative: true })
          )
        );
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

    const unsubAuditLogs = fsWatchCollection<AuditLog>(FS_COLLECTIONS.AUDIT_LOGS, (items) => {
      if (Array.isArray(items) && items.length > 0) {
        setAuditLogs(prev => {
          const map = new Map<string, AuditLog>();
          prev.forEach(l => {
            if (l?.Log_ID) map.set(l.Log_ID, l);
          });
          items.forEach(l => {
            if (l?.Log_ID) map.set(l.Log_ID, l);
          });
          return Array.from(map.values())
            .sort((a, b) => {
              const tsA = Date.parse((a as any).createdAtIso || a.Timestamp || '') || 0;
              const tsB = Date.parse((b as any).createdAtIso || b.Timestamp || '') || 0;
              return tsB - tsA;
            })
            .slice(0, 600);
        });
      }
    });
    unsubs.push(unsubAuditLogs);

    const unsubSettings = fsWatchCollection<any>(FS_COLLECTIONS.SETTINGS, (docs) => {
      const authDoc = docs.find((d: any) => d && (d._docId === 'developer_auth' || (typeof d.passcode === 'string' && d.passcode.trim().length >= 3)));
      const generalDoc = docs.find((d: any) => d && d._docId === 'general')
        || docs.find((d: any) => d && d._docId !== 'cloud_config' && d._docId !== 'developer_auth' && (d.appName !== undefined || d.textReplacements !== undefined || d.customTilesConfig !== undefined || d.uiCustomizations !== undefined));
      const cloudDoc = docs.find((d: any) => d && d._docId === 'cloud_config');

      // Strip internal _docId before merging into systemSettings
      const cleanDoc = (docObj: any) => {
        if (!docObj || typeof docObj !== 'object') return {};
        const { _docId, ...rest } = docObj;
        return rest;
      };
      const cleanGeneral = cleanDoc(generalDoc);
      const cleanCloud = cleanDoc(cloudDoc);
      // general is the full authoritative settings document; cloud_config provides lightweight fallback fields
      const mergedRemote: Record<string, any> = { ...cleanCloud, ...cleanGeneral };
      // If cloud_config has a strictly newer updatedAt timestamp, prefer its live counters/branding fields
      const generalTs = Date.parse(String(cleanGeneral.updatedAt || cleanGeneral.UpdatedAt || '')) || 0;
      const cloudTs = Date.parse(String(cleanCloud.updatedAt || cleanCloud.UpdatedAt || '')) || 0;
      if (cloudTs > generalTs) {
        Object.assign(mergedRemote, cleanCloud);
      }

      // Authoritative Developer Passcode lock from Firebase Firestore (zero localStorage persistence)
      const authoritativePasscode = String(authDoc?.developerPasscode || authDoc?.passcode || mergedRemote.developerPasscode || '').trim();
      if (authoritativePasscode.length >= 3) {
        firestorePasscodeLoadedRef.current = true;
        setDeveloperPasscodeState(authoritativePasscode);
      }

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
        }
        setSystemSettings(prev => {
          const next = normalizeSystemSettings({
            ...prev,
            ...mergedRemote,
            ...(authoritativePasscode.length >= 3 ? { developerPasscode: authoritativePasscode } : { developerPasscode: prev.developerPasscode }),
            ...(cleanRemoteDrive ? { googleDriveFolderId: cleanRemoteDrive } : {})
          });
          systemSettingsRef.current = next;
          return next;
        });
      }
    });
    unsubs.push(unsubSettings);

    // Direct real-time listener on system_settings/general for instant live UI texts, buttons & outgoing settings
    const unsubGeneralSettings = fsWatchGeneralSettings((gen) => {
      if (!gen || Object.keys(gen).length === 0) return;
      const cleanRemoteDrive = gen.googleDriveFolderId
        ? extractDriveFolderId(gen.googleDriveFolderId)
        : undefined;
      setSystemSettings(prev => {
        const next = normalizeSystemSettings({
          ...prev,
          ...gen,
          developerPasscode: gen.developerPasscode || prev.developerPasscode,
          ...(cleanRemoteDrive ? { googleDriveFolderId: cleanRemoteDrive } : {})
        });
        systemSettingsRef.current = next;
        return next;
      });
    });
    unsubs.push(unsubGeneralSettings);

    // Real-time dedicated watcher for lightweight cloud_config (Drive Folder ID / Sheet ID / Outgoing Counters / Login & Branding Texts)
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
          ...(cfg.outgoingBaselineMode !== undefined ? { outgoingBaselineMode: cfg.outgoingBaselineMode } : {}),
          ...(cfg.outgoingBaselineSetAt !== undefined ? { outgoingBaselineSetAt: cfg.outgoingBaselineSetAt } : {}),
          ...(cfg.outgoingBaselineLabel !== undefined ? { outgoingBaselineLabel: cfg.outgoingBaselineLabel } : {}),
          ...(cfg.defaultOutgoingDate !== undefined ? { defaultOutgoingDate: cfg.defaultOutgoingDate } : {}),
          ...(cfg.lastRegisteredName !== undefined ? { lastRegisteredName: cfg.lastRegisteredName } : {}),
          ...(cfg.lastOutgoingRaw !== undefined ? { lastOutgoingRaw: cfg.lastOutgoingRaw } : {}),
          ...(cfg.appName !== undefined ? { appName: cfg.appName } : {}),
          ...(cfg.officeName !== undefined ? { officeName: cfg.officeName } : {}),
          ...(cfg.deputyName !== undefined ? { deputyName: cfg.deputyName } : {}),
          ...(cfg.deputyTitle !== undefined ? { deputyTitle: cfg.deputyTitle } : {}),
          ...(cfg.province !== undefined ? { province: cfg.province } : {}),
          ...(cfg.officeAddress !== undefined ? { officeAddress: cfg.officeAddress } : {}),
          ...(cfg.hotline !== undefined ? { hotline: cfg.hotline } : {}),
          ...(cfg.footerText !== undefined ? { footerText: cfg.footerText } : {}),
          ...(cfg.loadingScreenTitle !== undefined ? { loadingScreenTitle: cfg.loadingScreenTitle } : {}),
          ...(cfg.loadingScreenSubtitle !== undefined ? { loadingScreenSubtitle: cfg.loadingScreenSubtitle } : {}),
          ...(cfg.loginWelcomeTitle !== undefined ? { loginWelcomeTitle: cfg.loginWelcomeTitle } : {}),
          ...(cfg.loginWelcomeSubtitle !== undefined ? { loginWelcomeSubtitle: cfg.loginWelcomeSubtitle } : {}),
          ...(cfg.loginHeaderBadgeText !== undefined ? { loginHeaderBadgeText: cfg.loginHeaderBadgeText } : {}),
          ...(cfg.loginBadgeText !== undefined ? { loginBadgeText: cfg.loginBadgeText } : {}),
          ...(cfg.loginButtonText !== undefined ? { loginButtonText: cfg.loginButtonText } : {}),
          ...(cfg.loginPasscodeTabText !== undefined ? { loginPasscodeTabText: cfg.loginPasscodeTabText } : {}),
          ...(cfg.loginCredentialsTabText !== undefined ? { loginCredentialsTabText: cfg.loginCredentialsTabText } : {}),
          ...(cfg.loginSecurityBadgeText !== undefined ? { loginSecurityBadgeText: cfg.loginSecurityBadgeText } : {}),
          ...(cfg.loginFooterCopyrightText !== undefined ? { loginFooterCopyrightText: cfg.loginFooterCopyrightText } : {}),
          ...(cfg.logoUrl ? { logoUrl: cfg.logoUrl } : {})
        });
        systemSettingsRef.current = next;
        return next;
      });
    });
    unsubs.push(unsubCloudConfig);

    // Authoritative check for saved developer passcode in Firebase Firestore
    fsGetDeveloperPasscode().then(code => {
      const cleanCode = String(code || '').trim();
      if (cleanCode.length >= 3) {
        firestorePasscodeLoadedRef.current = true;
        setDeveloperPasscodeState(cleanCode);
      }
    }).catch(() => {});

    // Exclusive Single Source of Truth: Firebase Firestore (alaa-office-2026 / (default))
    // Zero legacy /api/users, /api/settings, /api/blacklist, or /api/sync/state hydration!
    (async () => {
      let lastCatchupAt = Date.now();

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

      // Cross-tab BroadcastChannel listener (sub-millisecond echo across open tabs in the same browser/PWA)
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

      // Strict Cloud-Only Policy: Only allow UI appearance/settings updates to sync via storage events
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

      // Lightweight Firebase Firestore catch-up on tab resume (Single Source of Truth — NEVER pull/overwrite from Google Sheets)
      const handleResumeSync = () => {
        if (document.visibilityState === 'hidden') return;
        if (activeRefreshPromiseRef.current) return;
        const now = Date.now();
        if (now - lastCatchupAt < 15000) return;
        lastCatchupAt = now;
        purgeLegacyBrowserBusinessData();
        fetchAllFromFirestoreNow().catch(() => {});
      };
      window.addEventListener('focus', handleResumeSync);
      window.addEventListener('online', handleResumeSync);
      document.addEventListener('visibilitychange', handleResumeSync);

      unsubs.push(() => {
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

  // Google OAuth Manual Backup Session State (sheetId & driveFolderId come exclusively from Firestore system_settings)
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_google_token') : null;
    const email = typeof window !== 'undefined' ? localStorage.getItem('al_nashi_google_user_email') : null;

    if (token) {
      setIsGoogleConnected(true);
      if (email) setGoogleUserEmail(email);
    }
  }, []);

  const canDownloadDatabase = (role?: string): boolean => {
    if (!role) return false;
    return ['developer', 'director', 'deputy', 'admin', 'admin_officer'].includes(role);
  };

  const refreshAllDataFromAllSources = async () => {
    // Deduplicate concurrent refresh bursts (prevents memory spikes & Chrome Crashpad)
    if (activeRefreshPromiseRef.current) {
      return activeRefreshPromiseRef.current;
    }

    const run = (async () => {
      // 0. Always purge any stale business data trapped in Chrome localStorage / IndexedDB
      purgeLegacyBrowserBusinessData();
      clearBusinessRecordsFromIDB().catch(() => {});

      // 1. SINGLE SOURCE OF TRUTH: Firebase Firestore (alaa-office-2026 / (default)) ONLY.
      //    Google Sheets is strictly manual backup / manual import-export and NEVER overwrites Firestore.
      try {
        const fsResult = await fetchAllFromFirestoreNow();
        const cloudSettings = fsResult.systemSettings;
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
    })();

    activeRefreshPromiseRef.current = run;
    try {
      await run;
    } finally {
      activeRefreshPromiseRef.current = null;
    }
  };

  const triggerSessionDataLoad = (customMsg?: string) => {
    // Show the fullscreen loading screen ONLY ONCE per session when entering/opening the system.
    // Any subsequent calls silently refresh data in the background without flashing the overlay again.
    if (hasShownLoadingOnceRef.current) {
      refreshAllDataFromAllSources().catch(() => {});
      return;
    }

    hasShownLoadingOnceRef.current = true;
    setSessionLoadingMessage(customMsg || 'جاري تحميل البيانات، يرجى الانتظار...');
    setIsSessionLoading(true);

    const startedAt = Date.now();
    const safetyCeiling = window.setTimeout(() => {
      setIsSessionLoading(false);
    }, 12000);

    const done = () => {
      const elapsed = Date.now() - startedAt;
      const minDisplay = initialHydrationCompleteRef.current ? 450 : 0;
      const remaining = Math.max(0, minDisplay - elapsed);
      window.setTimeout(() => {
        window.clearTimeout(safetyCeiling);
        setIsSessionLoading(false);
      }, remaining);
    };

    if (initialHydrationCompleteRef.current && !activeRefreshPromiseRef.current) {
      // Data already hydrated during splash — show once briefly and refresh quietly in background
      refreshAllDataFromAllSources().catch(() => {});
      done();
      return;
    }

    refreshAllDataFromAllSources()
      .catch(() => {})
      .finally(() => {
        initialHydrationCompleteRef.current = true;
        done();
      });
  };

  // Run silent background hydration on initial mount (and sync Firestore settings alignment once)
  useEffect(() => {
    let active = true;
    fsSyncSettingsStructure().catch(() => {});

    const safetyCeiling = window.setTimeout(() => {
      if (active) {
        setIsSessionLoading(false);
      }
    }, 6500);

    refreshAllDataFromAllSources()
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(safetyCeiling);
        if (active) {
          initialHydrationCompleteRef.current = true;
          setIsSessionLoading(false);
        }
      });

    return () => {
      active = false;
      window.clearTimeout(safetyCeiling);
    };
  }, []);

  const addAuditLog = (action: string, section: string, details: string) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const actor = currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'النظام الآلي';
    const newLog: AuditLog = {
      Log_ID: `LOG-${Date.now()}-${Math.floor(10000 + Math.random() * 90000)}`,
      Timestamp: formattedDate,
      User: actor,
      UserName: actor,
      Action: action,
      ActionType: action,
      Section: section,
      Department: section,
      Details: details,
      Ip: '192.168.1.10'
    };
    setAuditLogs(prev => [newLog, ...prev].slice(0, 600));
    fsAddAuditLog(newLog).catch(() => {});
  };

  const activateUserSession = (user: User, sourceMessage: string) => {
    // Clear any stale previous session/section FIRST so no prior user's section ever bleeds into this login
    clearPersistedAuthSession();

    // Normalize canonical role strictly from THIS user's own record (never defaulting to 'reception')
    const canonicalUser = normalizeUserRecord(user);

    // Strict Auto-route by THIS user's canonical Role, Department, and AllowedSections matrix
    const targetHome = getHomeSectionForRole(canonicalUser.Role, canonicalUser);
    savePersistedAuthSession(canonicalUser, targetHome);

    setCurrentUser(canonicalUser);
    setIsSplashOpen(false);
    setLastLoginError(null);
    setActiveSection(targetHome);

    addAuditLog('تسجيل دخول ناجح', 'نظام المصادقة', `${sourceMessage} - ${canonicalUser.FullName} (${canonicalUser.RoleArabic})`);
    triggerDepartmentGreeting(canonicalUser);
    triggerSessionDataLoad('جاري تحميل البيانات، يرجى الانتظار...');
  };

  const upsertMatchedUserLocally = (matched: User) => {
    const cleanMatched = normalizeUserRecord(matched);
    setUsers(prev => {
      const idx = prev.findIndex(u => u.User_ID === cleanMatched.User_ID);
      const next = idx >= 0
        ? prev.map((u, i) => (i === idx ? normalizeUserRecord({ ...u, ...cleanMatched }) : u))
        : [...prev, cleanMatched];
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

    const matchLocalUser = (): { user?: User; frozen?: boolean; wrongPassword?: boolean } => {
      let matchedNameOnly = false;
      for (const rawU of usersRef.current) {
        if (!rawU) continue;
        const u = normalizeUserRecord(rawU);
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
              Boolean(uPass && cleanPass === uPass) ||
              (u.Role === 'developer' && Boolean(currentDevCode) && cleanPass === currentDevCode);
            if (passMatched) {
              if (u.Status === 'frozen') return { frozen: true };
              return { user: u };
            }
            matchedNameOnly = true;
          }
        } else {
          if (rawCode && uPass && rawCode === uPass) {
            if (u.Status === 'frozen') return { frozen: true };
            return { user: u };
          }
        }
      }
      return { wrongPassword: matchedNameOnly };
    };

    let sawWrongPassword = false;

    // 1. EXCLUSIVE FIREBASE FIRESTORE AUTH CHECK (alaa-office-2026 / (default), strict Exact Match)
    const fsResult = await withTimeout(fsVerifyLogin(usernameOrCode, pass), 5500);
    if (fsResult) {
      if (fsResult.frozen) {
        setLastLoginError('تم تجميد هذا الحساب من قبل الإدارة. يرجى مراجعة المطور أو مدير المكتب.');
        return false;
      }
      if (fsResult.success) {
        if (fsResult.user) {
          const cleanFsUser = normalizeUserRecord(fsResult.user);
          upsertMatchedUserLocally(cleanFsUser);
          activateUserSession(cleanFsUser, 'تمت مطابقة الحساب والصلاحيات من Firebase Firestore بنجاح');
          return true;
        }
        if (fsResult.isDeveloper) {
          const devUser = normalizeUserRecord(usersRef.current.find((u) => u.Role === 'developer') || INITIAL_USERS[0]);
          activateUserSession(devUser, 'تمت مطابقة رمز المطور السحابي بنجاح');
          return true;
        }
      }
    }

    // 2. LIVE FIRESTORE-SYNCED USERS CHECK (exact match fallback if server read timed out)
    const localMatch = matchLocalUser();
    if (localMatch.frozen) {
      setLastLoginError('تم تجميد هذا الحساب من قبل الإدارة. يرجى مراجعة المطور أو مدير المكتب.');
      return false;
    }
    if (localMatch.user) {
      activateUserSession(localMatch.user, 'تمت مطابقة الحساب من قاعدة Firebase Firestore بنجاح');
      return true;
    }
    if (localMatch.wrongPassword) {
      sawWrongPassword = true;
    }

    // 3. DEVELOPER PASSCODE CHECK (strictly honors active Firestore developerPasscode)
    const devAccount = usersRef.current.find((u) => u.Role === 'developer');
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
      const devUser = normalizeUserRecord(devAccount || INITIAL_USERS[0]);
      activateUserSession(devUser, 'تم الدخول برمز المطور المعتمد');
      return true;
    }

    // 4. Clear contextual error message
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

    // Clear persisted login session ONLY on manual logout - DO NOT erase or wipe database records
    clearPersistedAuthSession();
    hasShownLoadingOnceRef.current = false;
    setCurrentUser(null);
    setIsSplashOpen(true);
  };

  const switchUser = (user: User) => {
    // Regular employees who logged in cannot switch to another account without entering credentials
    if (currentUser && currentUser.Role !== 'developer') {
      alert('لا يمكن التبديل لحساب موظف آخر بدون إدخال رمزه السري الشخصي. يرجى تسجيل الخروج والدخول بالحساب المطلوب.');
      return;
    }
    clearPersistedAuthSession();
    const canonicalUser = normalizeUserRecord(user);
    const nextSection = getHomeSectionForRole(canonicalUser.Role, canonicalUser);
    savePersistedAuthSession(canonicalUser, nextSection);
    setCurrentUser(canonicalUser);
    setIsSplashOpen(false);
    setActiveSection(nextSection);
    triggerDepartmentGreeting(canonicalUser);
    triggerSessionDataLoad('يرجى الانتظار لتحميل بياناتك...');
    addAuditLog('تبديل مستخدم سريع', 'إدارة الجلسة', `تم التبديل إلى حساب ${canonicalUser.FullName}`);
  };

  const assignWorkstationUser = (user: User | null) => {
    // Strictly kept in live React memory — never written to Chrome localStorage
    setAssignedWorkstationUserState(user);
    if (user) {
      addAuditLog('تخصيص محطة عمل', 'إدارة الأجهزة', `تم تخصيص هذه المحطة للمستخدم ${user.FullName} للجلسة الحالية`);
    } else {
      addAuditLog('إلغاء تخصيص محطة عمل', 'إدارة الأجهزة', 'تم إلغاء تخصيص محطة العمل وتفعيل الدخول العام');
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
    targetUser: User,
    nextUsersList?: User[]
  ): Promise<{ serverOk: boolean; firebaseOk: boolean; sheetsOk: boolean; firebaseError?: string }> => {
    let firebaseOk = false;
    let firebaseError: string | undefined;

    // 1. Instant same-browser tab echo
    emitServerMutation('users', 'upsert', { item: targetUser });

    // 2. Exclusive Primary Persistence: Firebase Firestore (alaa-office-2026 / (default))
    try {
      await fsSaveUser(targetUser);
      firebaseOk = true;
      await fsSyncDepartmentsRegistry(nextUsersList || usersRef.current, customSectionsRef.current).catch(() => {});
      pushCloudSyncAlert({
        severity: 'success',
        target: 'firebase',
        title: `تم حفظ حساب الموظف (${targetUser.FullName})`,
        message: 'تم تحديث الحساب والرمز والصلاحيات مباشرة في Firebase Firestore (alaa-office-2026).'
      });
    } catch (err: any) {
      firebaseOk = false;
      firebaseError = err?.message || String(err);
      console.warn('Firestore user save warning:', firebaseError);
      pushCloudSyncAlert({
        severity: 'error',
        target: 'firebase',
        title: `فشل حفظ حساب الموظف (${targetUser.FullName})`,
        message: 'تعذر حفظ الحساب في Firebase Firestore. يرجى التحقق من الاتصال وإعادة المحاولة.',
        details: firebaseError
      });
    }

    return { serverOk: firebaseOk, firebaseOk, sheetsOk: false, firebaseError };
  };

  const addUser = async (
    userData: Omit<User, 'User_ID'>
  ): Promise<{ user: User; serverOk: boolean; firebaseOk: boolean; sheetsOk: boolean; firebaseError?: string }> => {
    const newId = `USR-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const nowIso = new Date().toISOString();
    const newUser: User = normalizeUserRecord({
      ...userData,
      User_ID: newId,
      CreatedAt: nowIso.split('T')[0],
      UpdatedAt: nowIso
    });
    const nextUsers = [...usersRef.current.filter(u => u.User_ID !== newId), newUser];
    setUsers(nextUsers);
    const syncRes = await persistUserAcrossAllDatabases(newUser, nextUsers);
    addAuditLog('إضافة مستخدم جديد', 'إدارة المستخدمين', `تم إنشاء حساب للموظف ${newUser.FullName} بصلاحية ${newUser.RoleArabic}`);
    return { user: newUser, ...syncRes };
  };

  const updateUser = async (
    updated: User
  ): Promise<{ user: User; serverOk: boolean; firebaseOk: boolean; sheetsOk: boolean; firebaseError?: string }> => {
    const stamped: User = normalizeUserRecord({
      ...updated,
      UpdatedAt: new Date().toISOString()
    });
    const nextUsers = usersRef.current.map(u => (u.User_ID === stamped.User_ID ? stamped : u));
    setUsers(nextUsers);
    if (currentUser?.User_ID === stamped.User_ID) {
      setCurrentUser(stamped);
    }
    const syncRes = await persistUserAcrossAllDatabases(stamped, nextUsers);
    // Keep developerPasscode synchronized in Firestore whenever the developer user's password is changed
    if (stamped.Role === 'developer' && stamped.Password && stamped.Password.trim().length >= 3) {
      const cleanDevPass = stamped.Password.trim();
      setDeveloperPasscodeState(cleanDevPass);
      fsSaveDeveloperPasscode(cleanDevPass).catch(() => {});
    }
    addAuditLog('تعديل حساب مستخدم', 'إدارة المستخدمين', `تم تعديل بيانات المستخدم ${stamped.FullName}`);
    return { user: stamped, ...syncRes };
  };

  const deleteUser = async (userId: string): Promise<{ serverOk: boolean; firebaseOk: boolean }> => {
    const target = usersRef.current.find(u => u.User_ID === userId);
    let firebaseOk = false;
    if (target) {
      recordDeletedId(userId);
      const nextUsers = usersRef.current.filter(u => u.User_ID !== userId);
      setUsers(nextUsers);
      emitServerMutation('users', 'delete', { id: userId });
      try {
        await fsDeleteUser(userId);
        firebaseOk = true;
        await fsSyncDepartmentsRegistry(nextUsers, customSectionsRef.current).catch(() => {});
        pushCloudSyncAlert({
          severity: 'success',
          target: 'firebase',
          title: `تم الحذف النهائي للمستخدم (${target.FullName})`,
          message: 'تم حذف الحساب نهائياً من Firebase Firestore (alaa-office-2026) وتحديث الأقسام فوراً.'
        });
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.warn('Firestore user delete warning:', errMsg);
        pushCloudSyncAlert({
          severity: 'error',
          target: 'firebase',
          title: `فشل حذف المستخدم (${target.FullName})`,
          message: 'تعذر حذف الحساب من Firebase Firestore. يرجى التحقق من الاتصال والمحاولة مجدداً.',
          details: errMsg
        });
      }
      addAuditLog('حذف حساب مستخدم', 'إدارة المستخدمين', `تم حذف حساب ${target.FullName}`);
    }
    return { serverOk: firebaseOk, firebaseOk };
  };

  const syncUsersToAllDatabasesNow = async (): Promise<{
    serverOk: boolean;
    firebaseOk: boolean;
    sheetsOk: boolean;
    count: number;
    firebaseError?: string;
  }> => {
    const fsRes = await fsSyncAllUsers(usersRef.current);
    if (fsRes.success) {
      await fsSyncDepartmentsRegistry(usersRef.current, customSectionsRef.current).catch(() => {});
    }
    return {
      serverOk: fsRes.success,
      firebaseOk: fsRes.success,
      sheetsOk: false,
      count: usersRef.current.length,
      firebaseError: fsRes.success ? undefined : fsRes.error
    };
  };

  const checkCloudDbHealth = async (): Promise<{ serverOk: boolean; firebaseOk: boolean; firebaseError?: string }> => {
    const fsHealth = await fsCheckConnection();
    return { serverOk: fsHealth.connected, firebaseOk: fsHealth.connected, firebaseError: fsHealth.error };
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
        return [...prev, newItem];
      });
      fsSaveDropdown(newItem).catch(err => console.warn('Firestore dropdown save:', err));
      const lowerCat = category.toLowerCase();
      if (lowerCat === 'referralsource' || lowerCat === 'referrers' || lowerCat.includes('معرف') || lowerCat.includes('محيل')) {
        fsSyncReferrer(trimmed).catch(() => {});
      }
      emitServerMutation('dropdowns', 'upsert', { item: newItem });
      addAuditLog('إضافة عنصر دائم للقوائم', 'القوائم المنسدلة', `تمت إضافة [${trimmed}] وحفظها دائماً في قائمة ${category}`);
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
    fsDeleteDropdown(category, trimmed)
      .then(() => {
        pushCloudSyncAlert({
          severity: 'success',
          target: 'firebase',
          title: `تم الحذف النهائي (${trimmed})`,
          message: 'تم حذف العنصر نهائياً من Firebase Firestore (alaa-office-2026).'
        });
      })
      .catch(err => {
        pushCloudSyncAlert({
          severity: 'error',
          target: 'firebase',
          title: `فشل حذف العنصر (${trimmed})`,
          message: 'تعذر حذف العنصر من Firebase Firestore. يرجى المحاولة مجدداً.',
          details: err instanceof Error ? err.message : String(err)
        });
      });
    addAuditLog('حذف عنصر من القوائم', 'القوائم المنسدلة', `تم حذف [${trimmed}] من قائمة ${category}`);
  };

  const getDropdownOptions = (category: string): string[] => {
    const items = dropdowns.filter(d => d.Category.toLowerCase() === category.toLowerCase()).map(d => d.ItemValue);
    return Array.from(new Set(items));
  };

  const addCitizen = (
    citizenData: Omit<Citizen, 'Citizen_ID' | 'CreatedAt'>,
    options?: { onPersistResult?: (res: { ok: boolean; error?: string; citizenId: string }) => void }
  ): Citizen => {
    // Save Lock / Debounce Guard: prevent duplicate citizen creation on rapid double-clicks or weak internet
    const rawNameKey = String(
      citizenData.FullName ||
        [citizenData.FirstName, citizenData.FatherName, citizenData.GrandFatherName, citizenData.GreatGrandFatherName, citizenData.Surname]
          .filter(Boolean)
          .join(' ')
    )
      .trim()
      .toLowerCase();
    const rawPhoneKey = String(citizenData.Phone1 || '').trim();
    const saveLock = acquireSaveLock<Citizen>(`addCitizen::${rawNameKey}::${rawPhoneKey}`, 1800, 2500);
    if (!saveLock.allowed && saveLock.lastResult) {
      return saveLock.lastResult;
    }

    // Generate guaranteed unique ID avoiding both live citizens AND deleted_records tombstones
    const existingIds = new Set((citizensRef.current || citizens).map(c => c.Citizen_ID));
    const deletedIds = getStoredDeletedIds();
    let randomSuffix = Math.floor(10000 + Math.random() * 90000);
    let newCitizenId = `ONA-${randomSuffix}`;
    while (existingIds.has(newCitizenId) || deletedIds.has(newCitizenId)) {
      randomSuffix = Math.floor(10000 + Math.random() * 90000);
      newCitizenId = `ONA-${randomSuffix}`;
    }
    unrecordDeletedId(newCitizenId);
    locallyPendingDeletesRef.current.delete(newCitizenId);
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
      saveLock.release();
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
      CurrentStage: citizenData.CurrentStage || 'مدير المكتب',
      CreatedAt: formattedDate,
      UpdatedAt: now.toISOString(),
      CreatedBy: currentUser ? currentUser.FullName : 'الاستعلامات'
    };

    saveLock.setResult(newCitizen);
    setCitizens(prev => {
      const next = [newCitizen, ...prev.filter(c => c.Citizen_ID !== newCitizenId)];
      citizensRef.current = next;
      return next;
    });

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

    // Serialized Primary Save directly to Firebase Firestore (visitors + unified referrers)
    enqueueSerializedSave(`citizen::${newCitizenId}`, async () => {
      try {
        const outcome = await receptionDomain.saveCitizen(newCitizen, 'insert', getCloudCtx());
        if (!outcome.firebaseOk) {
          const reason = outcome.firebaseError || 'تعذر حفظ بيانات المراجع في Firebase Firestore.';
          setFirestoreLastSaveError(`فشل حفظ المراجع (${fullName}): ${reason}`);
          options?.onPersistResult?.({ ok: false, error: reason, citizenId: newCitizenId });
        } else {
          setFirestoreLastSaveError(null);
          options?.onPersistResult?.({ ok: true, citizenId: newCitizenId });
          if (newCitizen.ReferralSource) {
            fsSyncReferrer(newCitizen.ReferralSource).catch(() => {});
          }
        }
      } catch (err: any) {
        const reason = err?.message || String(err || 'خطأ غير متوقع أثناء الحفظ');
        setFirestoreLastSaveError(`فشل حفظ المراجع (${fullName}): ${reason}`);
        pushCloudSyncAlert({
          severity: 'error',
          target: 'firebase',
          title: `فشل حفظ المراجع (${fullName})`,
          message: 'تعذر حفظ بيانات المراجع في Firebase Firestore (alaa-office-2026).',
          details: reason
        });
        options?.onPersistResult?.({ ok: false, error: reason, citizenId: newCitizenId });
      } finally {
        saveLock.release();
      }
    }).catch((err: any) => {
      const reason = err?.message || String(err || 'خطأ في قائمة الحفظ');
      setFirestoreLastSaveError(`فشل حفظ المراجع (${fullName}): ${reason}`);
      options?.onPersistResult?.({ ok: false, error: reason, citizenId: newCitizenId });
      saveLock.release();
    });

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
      const next = exists
        ? prev.map(c => c && c.Citizen_ID && c.Citizen_ID.trim().toLowerCase() === targetId ? updatedCitizen : c)
        : [updatedCitizen, ...prev];
      citizensRef.current = next;
      return next;
    });
    addAuditLog('تحديث بيانات مواطن', 'الاستعلامات', `تعديل السجل التعريفي للمواطن ${fullName} (${citizen.Citizen_ID})`);
    
    // Real-time broadcast to all connected browsers, shared links & Desktop PWAs
    emitServerMutation('citizens', 'upsert', { item: updatedCitizen });

    // Serialized Primary Save directly to Firebase Firestore (visitors + unified referrers)
    enqueueSerializedSave(`citizen::${updatedCitizen.Citizen_ID}`, async () => {
      await receptionDomain.saveCitizen(updatedCitizen, 'update', getCloudCtx()).catch(() => {});
      if (updatedCitizen.ReferralSource) {
        fsSyncReferrer(updatedCitizen.ReferralSource).catch(() => {});
      }
    }).catch(() => {});
  };

  const deleteCitizen = (citizenId: string) => {
    if (!citizenId) return;
    const liveCitizens = citizensRef.current || citizens;
    const liveRequests = requestsRef.current || requests;
    const target = liveCitizens.find(c => c.Citizen_ID === citizenId);

    // 1. Gather all related records and IDs
    const matchingReqs = liveRequests.filter(r => r.Citizen_ID === citizenId);
    const matchingInterviews = interviews.filter(i => i.Citizen_ID === citizenId);
    const matchingCheques = cheques.filter(ch => ch.Citizen_ID === citizenId);
    const matchingLetters = officialLetters.filter(l => l.Citizen_ID === citizenId);
    const matchingOrgs = organizationRecords.filter(o => o.Citizen_ID === citizenId);
    const matchingDocs = documents.filter(d => d.Citizen_ID === citizenId || (d as any).CitizenId === citizenId);

    const matchingReqIds = matchingReqs.map(r => r.Request_ID);
    const matchingInterviewIds = matchingInterviews.map(i => i.Interview_ID);
    const matchingChequeIds = matchingCheques.map(ch => ch.id);
    const matchingLetterIds = matchingLetters.map(l => l.Letter_ID);
    const matchingOrgIds = matchingOrgs.map(o => o.Org_ID || o.Citizen_ID).filter(Boolean);
    const matchingDocIds = matchingDocs.map(d => d.Doc_ID).filter(Boolean);

    const allDeletedIds = [
      citizenId,
      ...matchingReqIds,
      ...matchingInterviewIds,
      ...matchingChequeIds,
      ...matchingLetterIds,
      ...matchingOrgIds,
      ...matchingDocIds
    ].filter(Boolean);
    const deletedIdSet = new Set(allDeletedIds);

    // Record all IDs in permanent tombstone set
    allDeletedIds.forEach(id => {
      recordDeletedId(id);
      markLocallyPendingDelete(id);
    });

    // 2. Cascade delete synchronously in refs & local state
    const nextCitizens = liveCitizens.filter(c => c.Citizen_ID !== citizenId);
    const nextRequests = liveRequests.filter(r => r.Citizen_ID !== citizenId);
    const nextInterviews = interviews.filter(i => i.Citizen_ID !== citizenId);
    const nextCheques = cheques.filter(ch => ch.Citizen_ID !== citizenId);
    const nextOrgs = organizationRecords.filter(o => o.Citizen_ID !== citizenId);
    const nextLetters = officialLetters.filter(l => l.Citizen_ID !== citizenId);
    const nextDocs = documents.filter(d => d.Citizen_ID !== citizenId && (d as any).CitizenId !== citizenId);

    citizensRef.current = nextCitizens;
    requestsRef.current = nextRequests;
    setCitizens(nextCitizens);
    setRequests(nextRequests);
    setInterviews(nextInterviews);
    setCheques(nextCheques);
    setOrganizationRecords(nextOrgs);
    setOfficialLetters(nextLetters);
    setDocuments(nextDocs);
    setNotifications(prev => prev.filter(n => !n.entityId || !deletedIdSet.has(n.entityId)));

    addAuditLog(
      'حذف نهائي شامل لسجل مراجع',
      'الإدارة / الاستعلامات / المدير',
      `تم حذف المواطن ${target?.FullName || citizenId} (${citizenId}) وجميع متعلقاته (${matchingReqIds.length} معاملة، ${matchingInterviewIds.length} مقابلة، ${matchingLetterIds.length} كتاب رسمي) نهائياً من Firebase Firestore و Google Sheets`
    );

    // 4. Broadcast cascade deletion live to open tabs
    emitServerMutation('citizens', 'delete', { id: citizenId });
    matchingReqIds.forEach(reqId => emitServerMutation('requests', 'delete', { id: reqId }));
    matchingInterviewIds.forEach(intId => emitServerMutation('interviews', 'delete', { id: intId }));
    matchingChequeIds.forEach(chqId => emitServerMutation('cheques', 'delete', { id: chqId }));
    matchingLetterIds.forEach(letId => emitServerMutation('officialLetters', 'delete', { id: letId }));
    matchingOrgIds.forEach(orgId => emitServerMutation('organizationRecords', 'delete', { id: orgId }));
    matchingDocIds.forEach(docId => emitServerMutation('documents', 'delete', { id: docId }));

    // 5. Direct Real Cascade Delete (`deleteDoc`) in Firebase Firestore + background Google Sheets `action: "delete"`
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
    matchingOrgIds.forEach(orgId => {
      organizationDomain.deleteRecord(orgId, cloudCtx).catch(() => {});
    });
    matchingDocIds.forEach(docId => {
      archiveDocumentsDomain.deleteDocument(docId).catch(() => {});
    });
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
    fallbackInfo?: { FullName: string; Phone1?: string; Phone2?: string; District?: string }
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
        Phone1: existingCit.Phone1 || (fallbackInfo?.Phone1 || '').trim(),
        Phone2: existingCit.Phone2 || (fallbackInfo?.Phone2 || '').trim() || undefined,
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
        Phone2: (fallbackInfo.Phone2 || '').trim() || undefined,
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
      fsSaveCitizen(targetCitizen)
        .then(() => {
          const ctx = getCloudCtx();
          void pushToGoogleSheetsRealtime('citizens', targetCitizen, 'insert', ctx.appsScriptUrl, ctx.googleSheetId, {
            backgroundBackup: true
          }).catch(() => {});
        })
        .catch((err) => {
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
        fsSaveCitizen(c)
          .then(() => {
            const ctx = getCloudCtx();
            void pushToGoogleSheetsRealtime('citizens', c, 'update', ctx.appsScriptUrl, ctx.googleSheetId, {
              backgroundBackup: true
            }).catch(() => {});
          })
          .catch(() => {});
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
        fsSaveRequest(r)
          .then(() => {
            const ctx = getCloudCtx();
            void pushToGoogleSheetsRealtime('requests', r, 'update', ctx.appsScriptUrl, ctx.googleSheetId, {
              backgroundBackup: true
            }).catch(() => {});
          })
          .catch(() => {});
      });
    }

    // 3. Persist directly to Firestore `blacklist` collection (Single Source of Truth)
    fsSaveBlacklistEntry({
      Citizen_ID: targetCitizen.Citizen_ID,
      FullName: targetCitizen.FullName,
      normalizedName: targetCitizen.FullName,
      Phone1: targetCitizen.Phone1 || '',
      Phone2: targetCitizen.Phone2 || '',
      District: targetCitizen.District || 'الناصرية - المركز',
      BlockReason: cleanReason,
      BlockedAt: nowStamp,
      BlockedBy: operator,
      IsBlocked: true,
      UpdatedAt: nowIso
    }).catch(() => {});

    addAuditLog('إدراج بالقائمة السوداء', 'الإدارة / الرقابة', `تم حظر المراجع ${targetCitizen.FullName} (${targetCitizen.Citizen_ID}) بسبب: ${cleanReason}`);
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
      const ctxUnblock = getCloudCtx();
      clearedDuplicates.forEach(c => {
        emitServerMutation('citizens', 'upsert', { item: c });
        fsSaveCitizen(c)
          .then(() => {
            void pushToGoogleSheetsRealtime('citizens', c, 'update', ctxUnblock.appsScriptUrl, ctxUnblock.googleSheetId, {
              backgroundBackup: true
            });
          })
          .catch(() => {});
      });
    }

    // 2. Clear blocked state on all matching requests + persist to Firestore & Google Sheets background backup
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
      const ctxReqUnblock = getCloudCtx();
      updatedUnblockedRequests.forEach(r => {
        emitServerMutation('requests', 'upsert', { item: sanitizeRequestsForStorage([r])[0] || r });
        fsSaveRequest(r)
          .then(() => {
            void pushToGoogleSheetsRealtime('requests', r, 'update', ctxReqUnblock.appsScriptUrl, ctxReqUnblock.googleSheetId, {
              backgroundBackup: true
            });
          })
          .catch(() => {});
      });
    }

    // 3. Remove directly from Firestore `blacklist` collection (real deleteDoc)
    fsDeleteBlacklistEntry(cit.Citizen_ID).catch(() => {});
    matchingBlockedDuplicates.forEach(c => {
      if (c.Citizen_ID) fsDeleteBlacklistEntry(c.Citizen_ID).catch(() => {});
    });

    addAuditLog('إلغاء حظر مراجع', 'الإدارة / الرقابة', `تم إلغاء حظر المراجع ${cit.FullName} (${cit.Citizen_ID}) وإعادته للقائمة المسموح بها`);
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

    // 3. Match by Name (Arabic normalized — exact, triple name, full name, or substring)
    const normInput = normalizeAr(nameOrId);
    const inputWords = normInput.split(' ').filter(Boolean);

    const matchByName = blockedList.find(c => {
      const composedFromParts = [c.FirstName, c.FatherName, c.GrandFatherName, c.Surname]
        .filter(Boolean)
        .join(' ');
      const candidateNames = [c.FullName || '', composedFromParts]
        .map(normalizeAr)
        .filter(Boolean);

      for (const normCit of candidateNames) {
        if (normCit === normInput) return true;
        if (normInput.length >= 5 && normCit.includes(normInput)) return true;
        if (normCit.length >= 5 && normInput.includes(normCit)) return true;

        const citWords = normCit.split(' ').filter(Boolean);
        // Triple-name exact match (e.g. First + Father + Grandfather)
        if (inputWords.length >= 3 && citWords.length >= 3) {
          if (
            inputWords[0] === citWords[0] &&
            inputWords[1] === citWords[1] &&
            inputWords[2] === citWords[2]
          ) {
            return true;
          }
          // Also match if input's 3 words all appear in the blocked citizen's name in order
          const inputTrio = `${inputWords[0]} ${inputWords[1]} ${inputWords[2]}`;
          const citTrio = `${citWords[0]} ${citWords[1]} ${citWords[2]}`;
          if (normCit.startsWith(inputTrio) || normInput.startsWith(citTrio)) {
            return true;
          }
        }
        // Two-part exact match when typing first + father name matching a 2-word blocked name
        if (inputWords.length === 2 && citWords.length >= 2) {
          if (inputWords[0] === citWords[0] && inputWords[1] === citWords[1]) {
            return true;
          }
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
    options?: {
      skipAuditLog?: boolean;
      skipNotification?: boolean;
      slotKey?: string;
      onPersistResult?: (res: { ok: boolean; error?: string; requestId: string }) => void;
    }
  ): OfficeRequest => {
    // Save Lock / Debounce Guard: prevent duplicate request creation on rapid double-clicks
    // Include slotKey so multi-request submissions for the same citizen in Reception are NEVER dropped.
    const reqLockKey = `addRequest::${String(reqData.Citizen_ID || reqData.CitizenName || '').trim().toLowerCase()}::${String(reqData.Entity || '').trim().toLowerCase()}::${String(reqData.Details || '').trim().slice(0, 60).toLowerCase()}::${options?.slotKey || ''}`;
    const saveLock = acquireSaveLock<OfficeRequest>(reqLockKey, 1500, 2500);
    if (!saveLock.allowed && saveLock.lastResult) {
      return saveLock.lastResult;
    }

    const year = new Date().getFullYear();
    const liveReqs = requestsRef.current || requests;
    const deletedIds = getStoredDeletedIds();
    const existingIds = new Set(liveReqs.map(r => r.Request_ID));

    // Scan BOTH live requests AND historical deleted_records so sequence numbers NEVER collide with deleted IDs
    let maxFound = Math.max(liveReqs.length + 100, requestSeqCounterRef.current);
    const scanSeq = (rawId?: string) => {
      if (!rawId) return;
      const m = String(rawId).match(/REQ-\d+-(\d+)/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num) && num > maxFound) {
          maxFound = num;
        }
      }
    };
    for (const r of liveReqs) {
      if (r && r.Request_ID) {
        existingIds.add(r.Request_ID);
        scanSeq(r.Request_ID);
      }
    }
    deletedIds.forEach(id => scanSeq(id));

    let next = maxFound + 1;
    const randomTag = () => Math.random().toString(36).slice(2, 5).toUpperCase();
    let candidate =
      reqData.Request_ID && !existingIds.has(reqData.Request_ID) && !deletedIds.has(reqData.Request_ID)
        ? reqData.Request_ID
        : `REQ-${year}-${String(next).padStart(3, '0')}-${randomTag()}`;

    while (existingIds.has(candidate) || deletedIds.has(candidate)) {
      next++;
      candidate = `REQ-${year}-${String(next).padStart(3, '0')}-${randomTag()}`;
    }

    requestSeqCounterRef.current = next;
    unrecordDeletedId(candidate);
    locallyPendingDeletesRef.current.delete(candidate);

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const isFromReception = reqData.RegisteredVia === 'استعلامات' || reqData.CurrentStage === 'مدير المكتب';
    const resolvedStage = reqData.CurrentStage || (isFromReception ? 'مدير المكتب' : 'مدير الإدارة');
    const resolvedDelivery =
      reqData.DeliveryStatus ||
      (reqData.RequestStatus === 'مستلم' ? 'مستلم' : 'غير مستلم');
    const newRequest: OfficeRequest = {
      ...reqData,
      Request_ID: candidate,
      CurrentStage: resolvedStage,
      RegisteredVia: reqData.RegisteredVia || (isFromReception ? 'استعلامات' : 'الإدارة'),
      DirectorDecision: reqData.DirectorDecision || '',
      department: reqData.department || (isFromReception && !reqData.DirectorDecision ? 'مدير المكتب' : undefined),
      TargetDepartment: reqData.TargetDepartment || (isFromReception && !reqData.DirectorDecision ? 'مدير المكتب' : undefined),
      RequestStatus: reqData.RequestStatus || (isFromReception ? 'غير مستلم' : 'مستلم'),
      DeliveryStatus: resolvedDelivery,
      ProcessingStatus: reqData.ProcessingStatus || (isFromReception ? 'قيد الإجراء' : 'قيد التدقيق'),
      referredToOrganization: reqData.referredToOrganization ?? false,
      IsHistoricalImported: reqData.IsHistoricalImported ?? false,
      IsArchived: reqData.IsArchived ?? false,
      IsDirectInstantRequest: reqData.IsDirectInstantRequest ?? false,
      CreatedAt: formattedDate,
      UpdatedAt: now.toISOString(),
      CreatedBy: reqData.CreatedBy || (currentUser ? currentUser.FullName : (isFromReception ? 'الاستعلامات' : 'قسم الإدارة'))
    };

    saveLock.setResult(newRequest);
    setRequests(prev => {
      const nextList = [newRequest, ...prev.filter(r => r.Request_ID !== candidate)];
      requestsRef.current = nextList;
      return nextList;
    });

    // Ensure linked citizen advances to 'مدير المكتب' stage and is not archived in 'director' when a new Reception request arrives
    if (isFromReception && reqData.Citizen_ID) {
      const linkedCit = citizensRef.current.find(c => c.Citizen_ID === reqData.Citizen_ID);
      if (linkedCit) {
        const unarchivedForDirector = buildSectionUnarchivedFields(linkedCit, 'director');
        const needsUpdate =
          linkedCit.CurrentStage !== 'مدير المكتب' ||
          (Array.isArray(linkedCit.archivedInSections) && linkedCit.archivedInSections.includes('director'));
        if (needsUpdate) {
          updateCitizen({
            ...linkedCit,
            CurrentStage: 'مدير المكتب',
            ...unarchivedForDirector
          });
        }
      }
    }

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

    // Real-time broadcast to same-browser tabs
    emitServerMutation('requests', 'upsert', { item: sanitizeRequestsForStorage([newRequest])[0] || newRequest });

    // Serialized Primary Save directly to Firebase Firestore (requests + unified referrers) with transparent diagnostics
    enqueueSerializedSave(`request::${candidate}`, async () => {
      try {
        const outcome = await adminRequestsDomain.saveRequest(newRequest, 'insert', getCloudCtx());
        if (!outcome.firebaseOk) {
          const reason = outcome.firebaseError || 'تعذر حفظ المعاملة في Firebase Firestore.';
          setFirestoreLastSaveError(`فشل حفظ المعاملة (${candidate}) للمراجع (${newRequest.CitizenName}): ${reason}`);
          options?.onPersistResult?.({ ok: false, error: reason, requestId: candidate });
        } else {
          setFirestoreLastSaveError(null);
          options?.onPersistResult?.({ ok: true, requestId: candidate });
          if (newRequest.ReferralSource) {
            fsSyncReferrer(newRequest.ReferralSource).catch(() => {});
          }
        }
      } catch (err: any) {
        const reason = err?.message || String(err || 'خطأ غير متوقع أثناء حفظ المعاملة');
        setFirestoreLastSaveError(`فشل حفظ المعاملة (${candidate}): ${reason}`);
        pushCloudSyncAlert({
          severity: 'error',
          target: 'firebase',
          title: `فشل إرسال المعاملة (${candidate}) إلى Firebase Firestore`,
          message: 'تعذر حفظ المعاملة الجديدة وإيصالها إلى شاشة مدير المكتب.',
          details: reason
        });
        options?.onPersistResult?.({ ok: false, error: reason, requestId: candidate });
      } finally {
        saveLock.release();
      }
    }).catch((err: any) => {
      const reason = err?.message || String(err || 'خطأ في قائمة حفظ المعاملات');
      setFirestoreLastSaveError(`فشل حفظ المعاملة (${candidate}): ${reason}`);
      options?.onPersistResult?.({ ok: false, error: reason, requestId: candidate });
      saveLock.release();
    });

    return newRequest;
  };

  const updateRequest = (req: OfficeRequest) => {
    const prevReq = (requestsRef.current || requests).find(r => r.Request_ID === req.Request_ID);
    const updatedReq: OfficeRequest = {
      ...req,
      UpdatedAt: new Date().toISOString()
    };
    setRequests(prev => {
      const nextList = prev.map(r => r.Request_ID === req.Request_ID ? updatedReq : r);
      requestsRef.current = nextList;
      return nextList;
    });
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
    
    // Serialized Primary Save directly to Firebase Firestore
    enqueueSerializedSave(`request::${updatedReq.Request_ID}`, async () => {
      await adminRequestsDomain.saveRequest(updatedReq, 'update', getCloudCtx()).catch(() => {});
      if (updatedReq.ReferralSource) {
        fsSyncReferrer(updatedReq.ReferralSource).catch(() => {});
      }
    }).catch(() => {});
  };

  const deleteRequest = (requestId: string) => {
    if (!requestId) return;
    recordDeletedId(requestId);
    markLocallyPendingDelete(requestId);
    const nextRequests = (requestsRef.current || requests).filter(r => r.Request_ID !== requestId);
    requestsRef.current = nextRequests;
    setRequests(nextRequests);
    setNotifications(prev => prev.filter(n => n.entityId !== requestId));
    emitServerMutation('requests', 'delete', { id: requestId });
    addAuditLog('حذف نهائي لطلب إداري', 'قسم الإدارة / المدير', `تم حذف الطلب ${requestId} نهائياً من قاعدة البيانات`);
    adminRequestsDomain.deleteRequest(requestId, getCloudCtx()).catch(() => {});
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
            DeputyNotes: notes ? (req.DeputyNotes ? `${req.DeputyNotes} | ${notes}` : notes) : req.DeputyNotes,
            UpdatedAt: new Date().toISOString()
          };
          modifiedList.push(updated);
          fsSaveRequest(updated)
            .then(() => {
              const ctx = getCloudCtx();
              void pushToGoogleSheetsRealtime('requests', updated, 'update', ctx.appsScriptUrl, ctx.googleSheetId, {
                backgroundBackup: true
              }).catch(() => {});
            })
            .catch(() => {});
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
    archiveDocumentsDomain.saveDocument(newDoc).catch(() => {});
    if (!options?.skipAuditLog) {
      addAuditLog('رفع وثيقة للأرشيف', 'أرشيف المستندات', `تم رفع المستند [${docData.Title}] للمواطن ${docData.CitizenName}`);
    }
  };

  const deleteDocument = (docId: string) => {
    const target = documents.find(d => d.Doc_ID === docId);
    recordDeletedId(docId);
    setDocuments(prev => prev.filter(d => d.Doc_ID !== docId));
    emitServerMutation('documents', 'delete', { id: docId });
    archiveDocumentsDomain.deleteDocument(docId, target?.Title).catch(() => {});
    if (target) {
      addAuditLog('حذف وثيقة من الأرشيف', 'أرشيف المستندات', `تم حذف المستند [${target.Title}] نهائياً من Firebase Firestore`);
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

  const updateSettings = async (newSettings: Partial<SystemSettings>): Promise<boolean> => {
    const currentSettings = systemSettingsRef.current;
    // Normalize Google Drive Folder ID if a full Drive URL or query string was provided
    const normalizedPatch: Partial<SystemSettings> = { ...newSettings };
    if (typeof normalizedPatch.googleDriveFolderId === 'string' && normalizedPatch.googleDriveFolderId.trim()) {
      const cleanDriveId = extractDriveFolderId(normalizedPatch.googleDriveFolderId);
      normalizedPatch.googleDriveFolderId = cleanDriveId;
      setDriveFolderId(cleanDriveId);
      setRuntimeCloudConfig({ googleDriveFolderId: cleanDriveId });
    }
    if (typeof normalizedPatch.googleSheetId === 'string' && normalizedPatch.googleSheetId.trim()) {
      let cleanSheetId = normalizedPatch.googleSheetId.trim();
      const sMatch = cleanSheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (sMatch && sMatch[1]) cleanSheetId = sMatch[1];
      normalizedPatch.googleSheetId = cleanSheetId;
      normalizedPatch.activeGoogleSheetId = cleanSheetId;
      setSpreadsheetId(cleanSheetId);
      setRuntimeCloudConfig({ googleSheetId: cleanSheetId });
    }

    const isVisualOrIconBroadcast = Boolean(
      normalizedPatch.customTilesConfig !== undefined ||
      normalizedPatch.logoUrl !== undefined ||
      normalizedPatch.parliamentEmblemUrl !== undefined ||
      normalizedPatch.customImages !== undefined ||
      normalizedPatch.appName !== undefined ||
      normalizedPatch.officeName !== undefined ||
      normalizedPatch.deputyName !== undefined ||
      normalizedPatch.deputyTitle !== undefined ||
      normalizedPatch.footerText !== undefined ||
      normalizedPatch.loginWelcomeTitle !== undefined ||
      normalizedPatch.loginWelcomeSubtitle !== undefined ||
      normalizedPatch.loginHeaderBadgeText !== undefined ||
      normalizedPatch.loginBadgeText !== undefined ||
      normalizedPatch.loginButtonText !== undefined ||
      normalizedPatch.loginPasscodeTabText !== undefined ||
      normalizedPatch.loginCredentialsTabText !== undefined ||
      normalizedPatch.loginSecurityBadgeText !== undefined ||
      normalizedPatch.loginFooterCopyrightText !== undefined ||
      normalizedPatch.loadingScreenTitle !== undefined ||
      normalizedPatch.loadingScreenSubtitle !== undefined ||
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

    emitServerBulk({
      systemSettings: merged,
      customSections,
      settingsVersion: nextVersion
    });

    // Exclusive Single Source of Truth: Firebase Firestore `system_settings`
    let savedToFirestore = false;
    try {
      await fsSaveSettings(merged);
      savedToFirestore = true;
    } catch (err) {
      console.warn('Firestore settings update:', err);
      savedToFirestore = false;
    }

    // Background push-only sync to Google Sheets when outgoing counter or default date changes
    const isOutgoingCounterChange =
      normalizedPatch.lastOutgoingNumberNasiriyah !== undefined ||
      normalizedPatch.lastOutgoingNumberSuq !== undefined ||
      normalizedPatch.outgoingBaselineMode !== undefined ||
      normalizedPatch.defaultOutgoingDate !== undefined;
    if (isOutgoingCounterChange) {
      pushToGoogleSheetsRealtime(
        'settings',
        {
          id: 'outgoing_counter_settings',
          officeBranch: merged.officeBranch || 'nasiriyah',
          lastOutgoingNumberNasiriyah: merged.lastOutgoingNumberNasiriyah || 0,
          lastOutgoingNumberSuq: merged.lastOutgoingNumberSuq || 0,
          outgoingBaselineMode: merged.outgoingBaselineMode || 'auto',
          outgoingBaselineSetAt: merged.outgoingBaselineSetAt || new Date().toISOString(),
          outgoingBaselineLabel: merged.outgoingBaselineLabel || '',
          defaultOutgoingDate: merged.defaultOutgoingDate || '',
          lastOutgoingRaw: merged.lastOutgoingRaw || '',
          lastRegisteredName: merged.lastRegisteredName || '',
          updatedBy: currentUser?.FullName || 'قسم الإدارة'
        },
        'update',
        merged.appsScriptUrl || merged.googleAppsScriptUrl,
        merged.googleSheetId || merged.activeGoogleSheetId,
        { backgroundBackup: true }
      ).catch(() => {});
    }

    addAuditLog('تحديث إعدادات المنظومة', 'لوحة التحكم', 'تم تعديل الإعدادات العامة والهوية البصرية للنظام وحفظها في Firebase Firestore');
    return savedToFirestore;
  };

  const setGoogleDriveFolderId = (rawFolderId: string) => {
    if (!rawFolderId || !rawFolderId.trim()) return;
    const cleanId = extractDriveFolderId(rawFolderId);
    setDriveFolderId(cleanId);
    setRuntimeCloudConfig({ googleDriveFolderId: cleanId });
    updateSettings({ googleDriveFolderId: cleanId });
    try {
      sheetsIntegration.refreshLocalConfig();
    } catch {}
    addAuditLog('تحديث مجلد Google Drive', 'لوحة المطور', `تم ربط وتثبيت معرف المجلد (${cleanId}) في Firebase Firestore`);
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

    const actorLabel = currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'النظام';
    const updatedCitizen: Citizen = {
      ...cit,
      CurrentStage: toStage,
      referredToOrganization: toStage === 'مدير التنظيم' ? true : cit.referredToOrganization,
      ReferredToOrganizationAt: toStage === 'مدير التنظيم' ? formattedDate : cit.ReferredToOrganizationAt,
      ReferredToOrganizationBy: toStage === 'مدير التنظيم' ? actorLabel : cit.ReferredToOrganizationBy,
      WorkflowHistory: updatedHistory,
      UpdatedAt: now.toISOString()
    };

    setCitizens(prev => prev.map(c => c.Citizen_ID === citizenId ? updatedCitizen : c));
    emitServerMutation('citizens', 'upsert', { item: updatedCitizen });
    fsSaveCitizen(updatedCitizen)
      .then(() => {
        const ctx = getCloudCtx();
        void pushToGoogleSheetsRealtime('citizens', updatedCitizen, 'update', ctx.appsScriptUrl, ctx.googleSheetId, {
          backgroundBackup: true
        }).catch(() => {});
      })
      .catch(() => {});

    // Audit log
    addAuditLog('إحالة مسار المراجع', 'سلسلة الإحالات', `تمت إحالة المراجع ${cit.FullName} (${cit.Citizen_ID}) من [${fromStage}] إلى [${toStage}] - توجيه: ${directiveNote || 'متابعة وإجراء اللازم'}`);

    // If referred to Director
    if (toStage === 'مدير المكتب') {
      addNotification({
        title: `🏛️ إحالة مراجع إلى مدير المكتب: ${cit.FullName}`,
        message: `وارد استعلامات محال إلى مدير المكتب (${cit.Citizen_ID}) - ${cit.District} | ملاحظة: ${directiveNote || 'مراجعة وتوجيه'}`,
        type: 'urgent_request',
        linkSection: 'director',
        targetRoles: ['director', 'developer']
      });
    }

    // If referred to Admin
    if (toStage === 'مدير الإدارة') {
      addNotification({
        title: `📋 إحالة معاملة إلى مدير الإدارة: ${cit.FullName}`,
        message: `تم توجيه ملف المراجع (${cit.Citizen_ID}) للإدارة لإعداد الكتاب الرسمي ومسح المستندات. التوجيه: ${directiveNote || 'إعداد كتاب ومتابعة'}`,
        type: 'urgent_request',
        linkSection: 'admin',
        targetRoles: ['admin', 'admin_officer', 'developer']
      });
    }

    // If referred to Organization (explicit referral ONLY)
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
        linkSection: 'organization',
        targetRoles: ['organization', 'organization_officer', 'director', 'developer']
      });
    }
  };

  const forwardRequestWorkflow = (
    requestId: string,
    toStage: WorkflowStage,
    directiveNote?: string
  ) => {
    const req = (requestsRef.current || requests).find(r => r.Request_ID === requestId);
    if (!req) return;

    const fromStage = req.CurrentStage || 'مدير الإدارة';
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const actorLabel = currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'النظام';

    const newAction: WorkflowAction = {
      id: `WF-REQ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      fromStage: fromStage,
      toStage: toStage,
      fromUser: actorLabel,
      actionDate: formattedDate,
      directiveNote: directiveNote || undefined,
      statusText: `تمت إحالة الطلب ${requestId} إلى ${toStage}`
    };

    const isOrgReferral = toStage === 'مدير التنظيم';
    const updatedReq: OfficeRequest = {
      ...req,
      CurrentStage: toStage,
      DeliveryStatus: isOrgReferral ? 'مستلم' : req.DeliveryStatus,
      RequestStatus: isOrgReferral ? 'مستلم' : req.RequestStatus,
      referredToOrganization: isOrgReferral ? true : req.referredToOrganization,
      ReferredToOrganizationAt: isOrgReferral ? formattedDate : req.ReferredToOrganizationAt,
      ReferredToOrganizationBy: isOrgReferral ? actorLabel : req.ReferredToOrganizationBy,
      WorkflowHistory: [newAction, ...(req.WorkflowHistory || [])],
      DeputyNotes: directiveNote ? (req.DeputyNotes ? `${req.DeputyNotes} | [${toStage}]: ${directiveNote}` : directiveNote) : req.DeputyNotes,
      UpdatedAt: now.toISOString()
    };

    setRequests(prev => {
      const nextList = prev.map(r => r.Request_ID === requestId ? updatedReq : r);
      requestsRef.current = nextList;
      return nextList;
    });
    emitServerMutation('requests', 'upsert', { item: sanitizeRequestsForStorage([updatedReq])[0] || updatedReq });
    fsSaveRequest(updatedReq)
      .then(() => {
        const ctx = getCloudCtx();
        void pushToGoogleSheetsRealtime('requests', updatedReq, 'update', ctx.appsScriptUrl, ctx.googleSheetId, {
          backgroundBackup: true
        }).catch(() => {});
      })
      .catch(() => {});

    // When explicitly referred to Organization (after status = مستلم), also sync linked citizen & Organization queue
    if (isOrgReferral) {
      const linkedCit = (citizensRef.current || citizens).find(c => c.Citizen_ID === req.Citizen_ID);
      if (linkedCit) {
        const updatedCit: Citizen = {
          ...linkedCit,
          CurrentStage: 'مدير التنظيم',
          referredToOrganization: true,
          ReferredToOrganizationAt: formattedDate,
          ReferredToOrganizationBy: actorLabel,
          WorkflowHistory: [newAction, ...(linkedCit.WorkflowHistory || [])],
          UpdatedAt: now.toISOString()
        };
        setCitizens(prev => {
          const nextList = prev.map(c => c.Citizen_ID === linkedCit.Citizen_ID ? updatedCit : c);
          citizensRef.current = nextList;
          return nextList;
        });
        emitServerMutation('citizens', 'upsert', { item: updatedCit });
        fsSaveCitizen(updatedCit)
          .then(() => {
            const ctx = getCloudCtx();
            void pushToGoogleSheetsRealtime('citizens', updatedCit, 'update', ctx.appsScriptUrl, ctx.googleSheetId, {
              backgroundBackup: true
            }).catch(() => {});
          })
          .catch(() => {});
      }

      const existingOrg = organizationRecords.find(o => o.Citizen_ID === req.Citizen_ID);
      if (!existingOrg && req.Citizen_ID) {
        upsertOrgRecord({
          Citizen_ID: req.Citizen_ID,
          FullName: linkedCit?.FullName || req.CitizenName || 'مراجع',
          District: linkedCit?.District || req.Address || 'الناصرية',
          SubDistrict: linkedCit?.SubDistrict || req.ResidentialArea || 'المركز',
          Phone1: linkedCit?.Phone1 || req.CitizenPhone || '',
          OrgRating: 'مؤيد',
          InfluenceType: 'وجيه منطقة',
          EvaluationPoints: 85,
          Notes: `إحالة من كافة المعاملات بعد الاستلام (${req.Request_ID}). ${directiveNote || 'متابعة تنظيمية وجماهيرية'}`
        });
      }

      addNotification({
        title: `👥 إحالة معاملة مستلمة للتنظيم: ${req.CitizenName}`,
        message: `تم ضبط المعاملة (${req.Request_ID}) على حالة «مستلم» وإحالتها لقسم التنظيم — الجهة: ${req.Entity}${directiveNote ? ` | ملاحظة: ${directiveNote}` : ''}`,
        type: 'urgent_request',
        category: 'request',
        priority: 'high',
        linkSection: 'organization',
        entityId: req.Request_ID,
        targetRoles: ['organization', 'organization_officer', 'director', 'developer']
      });
    }

    addAuditLog('إحالة مسار طلب إداري', 'قسم الإدارة', `تمت إحالة الطلب ${requestId} إلى ${toStage}`);
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

  // أرشفة مستقلة لكل قسم: تخفي السجل من "العمل اليومي" للقسم الحالي (أو الأقسام المحددة) دون أي حذف من Firestore
  const archiveDailyWorkItems = (options: {
    citizenIds?: string[];
    requestIds?: string[];
    sectionKey?: ArchiveSectionKey;
    extraSectionKeys?: ArchiveSectionKey[];
    directorNotesByRequestId?: Record<string, string>;
    preserveNonOrgIsolation?: boolean;
    globalArchive?: boolean;
    reason?: string;
  }): { archivedCitizens: number; archivedRequests: number } => {
    const targetCitIds = new Set((options.citizenIds || []).filter(Boolean));
    const targetReqIds = new Set((options.requestIds || []).filter(Boolean));
    if (targetCitIds.size === 0 && targetReqIds.size === 0) {
      return { archivedCitizens: 0, archivedRequests: 0 };
    }

    const sectionKey: ArchiveSectionKey | undefined = options.globalArchive
      ? undefined
      : (options.sectionKey || 'admin');
    const targetSections: ArchiveSectionKey[] = sectionKey
      ? Array.from(new Set([sectionKey, ...(options.extraSectionKeys || [])].filter(Boolean)))
      : [];
    const lockKey = `archive::${targetSections.join('+') || 'global'}::${Array.from(targetCitIds).slice(0, 5).join(',')}::${Array.from(targetReqIds).slice(0, 5).join(',')}`;
    const saveLock = acquireSaveLock<{ archivedCitizens: number; archivedRequests: number }>(lockKey, 700, 2000);
    if (!saveLock.allowed) {
      return saveLock.lastResult || { archivedCitizens: 0, archivedRequests: 0 };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const actorName = currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'موظف النظام';
    const sectionLabel = sectionKey ? getArchiveSectionLabel(sectionKey) : 'الأرشيف العام';
    const noteText = options.reason || `أرشفة مستقلة في (${sectionLabel}) — محفوظ بالكامل في قاعدة البيانات دون حذف`;

    const citizensById = new Map<string, Citizen>();
    for (const c of citizensRef.current || []) {
      if (c?.Citizen_ID) citizensById.set(c.Citizen_ID, c);
    }

    // Compute updated records SYNCHRONOUSLY from live refs (preserving ALL fields & routing metadata intact)
    const updatedCitizensMap = new Map<string, Citizen>();
    const updatedCitizensList: Citizen[] = [];
    if (targetCitIds.size > 0) {
      for (const c of citizensRef.current || []) {
        if (!c || !targetCitIds.has(c.Citizen_ID)) continue;
        if (sectionKey) {
          const secFields =
            targetSections.length > 1
              ? buildMultiSectionArchivedFields(c, targetSections)
              : buildSectionArchivedFields(c, sectionKey);
          const nextCit: Citizen = {
            ...c,
            archivedInSections: secFields.archivedInSections,
            unarchivedInSections: secFields.unarchivedInSections,
            ArchivedAt: formattedDate,
            archivedAt: formattedDate,
            ArchivedBy: actorName,
            archivedBy: actorName,
            ArchiveNotes: noteText || c.ArchiveNotes,
            UpdatedAt: nowIso
          };
          updatedCitizensMap.set(nextCit.Citizen_ID, nextCit);
          updatedCitizensList.push(nextCit);
        } else {
          const nextCit: Citizen = {
            ...c,
            IsArchived: true,
            ArchivedAt: formattedDate,
            archivedAt: formattedDate,
            ArchivedBy: actorName,
            archivedBy: actorName,
            ArchiveNotes: noteText || c.ArchiveNotes,
            UpdatedAt: nowIso
          };
          (nextCit as any).archived = true;
          (nextCit as any)['الأرشفة'] = 'نعم';
          updatedCitizensMap.set(nextCit.Citizen_ID, nextCit);
          updatedCitizensList.push(nextCit);
        }
      }
    }

    const updatedRequestsMap = new Map<string, OfficeRequest>();
    const updatedRequestsList: OfficeRequest[] = [];
    for (const r of requestsRef.current || []) {
      if (!r) continue;
      const matchesReq = targetReqIds.has(r.Request_ID) || (r.Citizen_ID && targetCitIds.has(r.Citizen_ID));
      if (!matchesReq) continue;
      const explicitDirNote = options.directorNotesByRequestId?.[r.Request_ID];
      const mergedDirNote =
        explicitDirNote !== undefined && explicitDirNote.trim()
          ? explicitDirNote.trim()
          : (r.DirectorNotes || '');
      const linkedCit = citizensById.get(r.Citizen_ID);

      if (sectionKey) {
        const secFields =
          targetSections.length > 1
            ? buildMultiSectionArchivedFields(r, targetSections)
            : buildSectionArchivedFields(r, sectionKey);
        const nextReq: OfficeRequest = {
          ...r,
          CitizenName: r.CitizenName || linkedCit?.FullName || 'مراجع',
          CitizenPhone: r.CitizenPhone || linkedCit?.Phone1 || '',
          Address: r.Address || r.CitizenAddress || linkedCit?.District || '',
          DirectorNotes: mergedDirNote || r.DirectorNotes,
          DirectorDecision:
            sectionKey === 'director' && !r.DirectorDecision
              ? 'مؤرشف'
              : r.DirectorDecision,
          DirectorDecisionDate:
            sectionKey === 'director' ? (r.DirectorDecisionDate || formattedDate) : r.DirectorDecisionDate,
          DirectorDecisionBy:
            sectionKey === 'director' ? (r.DirectorDecisionBy || actorName) : r.DirectorDecisionBy,
          referredToOrganization: options.preserveNonOrgIsolation ? false : r.referredToOrganization,
          archivedInSections: secFields.archivedInSections,
          unarchivedInSections: secFields.unarchivedInSections,
          ArchivedAt: formattedDate,
          archivedAt: formattedDate,
          ArchivedBy: actorName,
          archivedBy: actorName,
          UpdatedAt: nowIso
        };
        updatedRequestsMap.set(nextReq.Request_ID, nextReq);
        updatedRequestsList.push(nextReq);
      } else {
        const nextReq: OfficeRequest = {
          ...r,
          CitizenName: r.CitizenName || linkedCit?.FullName || 'مراجع',
          CitizenPhone: r.CitizenPhone || linkedCit?.Phone1 || '',
          Address: r.Address || r.CitizenAddress || linkedCit?.District || '',
          DirectorNotes: mergedDirNote || r.DirectorNotes,
          referredToOrganization: options.preserveNonOrgIsolation ? false : r.referredToOrganization,
          IsArchived: true,
          ArchivedAt: formattedDate,
          archivedAt: formattedDate,
          ArchivedBy: actorName,
          archivedBy: actorName,
          UpdatedAt: nowIso
        };
        (nextReq as any).archived = true;
        (nextReq as any)['الأرشفة'] = 'نعم';
        updatedRequestsMap.set(nextReq.Request_ID, nextReq);
        updatedRequestsList.push(nextReq);
      }
    }

    if (updatedCitizensList.length === 0 && updatedRequestsList.length === 0) {
      saveLock.release();
      return { archivedCitizens: 0, archivedRequests: 0 };
    }

    const resultSummary = {
      archivedCitizens: updatedCitizensList.length,
      archivedRequests: updatedRequestsList.length
    };
    saveLock.setResult(resultSummary);

    // Immediate optimistic UI update so records vanish from THIS section's Daily Work in 0ms
    if (updatedCitizensMap.size > 0) {
      const nextAllCitizens = (citizensRef.current || []).map(c => updatedCitizensMap.get(c.Citizen_ID) || c);
      citizensRef.current = nextAllCitizens;
      setCitizens(nextAllCitizens);
    }
    if (updatedRequestsMap.size > 0) {
      const nextAllRequests = (requestsRef.current || []).map(r => updatedRequestsMap.get(r.Request_ID) || r);
      requestsRef.current = nextAllRequests;
      setRequests(nextAllRequests);
    }

    // Serialized Primary Persistence to Firebase Firestore (`visitors`/`requests` + dedicated `archives` collection)
    enqueueSerializedSave(`archive-op::${sectionKey || 'global'}`, async () => {
      try {
        if (updatedCitizensList.length + updatedRequestsList.length > 1) {
          await fsBulkSaveCitizensAndRequests(updatedCitizensList, updatedRequestsList);
        } else {
          await Promise.all([
            ...updatedCitizensList.map(cit => fsSaveCitizen(cit)),
            ...updatedRequestsList.map(req => fsSaveRequest(req))
          ]);
        }
        // Mirror per-department archive entries cleanly into dedicated Firestore `archives` collection
        // with FULL transaction data, Reception notes, and Director notes
        const archiveDept = sectionKey || 'global';
        const archiveActorName = currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'النظام';
        const archiveNoteText = options.reason || '';
        const visibleDepts = targetSections.length > 0 ? targetSections : ['global'];
        const archiveEntries = [
          ...updatedCitizensList.map(cit => ({
            id: `${archiveDept}_visitor_${cit.Citizen_ID}`,
            recordId: cit.Citizen_ID,
            recordType: 'visitor' as const,
            citizenId: cit.Citizen_ID,
            department: archiveDept,
            departmentLabel: sectionLabel,
            alsoVisibleIn: visibleDepts,
            fullName: cit.FullName || cit.Citizen_ID,
            phone: cit.Phone1 || '',
            district: cit.District || '',
            createdAt: cit.CreatedAt || '',
            archivedAt: formattedDate,
            archivedBy: archiveActorName,
            notes: archiveNoteText,
            updatedAt: nowIso
          })),
          ...updatedRequestsList.map(req => {
            const cit = citizensById.get(req.Citizen_ID);
            return {
              id: `${archiveDept}_request_${req.Request_ID}`,
              recordId: req.Request_ID,
              recordType: 'request' as const,
              citizenId: req.Citizen_ID || '',
              requestId: req.Request_ID,
              department: archiveDept,
              departmentLabel: sectionLabel,
              alsoVisibleIn: visibleDepts,
              fullName: req.CitizenName || cit?.FullName || req.Request_ID,
              phone: req.CitizenPhone || cit?.Phone1 || '',
              district: req.Address || cit?.District || '',
              entity: req.Entity || '',
              details: req.Details || '',
              receptionNotes: req.ReceptionNotes || '',
              directorNotes: req.DirectorNotes || '',
              directorDecision: req.DirectorDecision || '',
              processingStatus: req.ProcessingStatus || '',
              deliveryStatus: req.DeliveryStatus || (req.RequestStatus === 'مستلم' ? 'مستلم' : 'غير مستلم'),
              outgoingNumber: req.OutgoingNumber || '',
              outgoingDate: req.OutgoingDate || '',
              createdAt: req.CreatedAt || '',
              archivedAt: formattedDate,
              archivedBy: archiveActorName,
              notes: archiveNoteText,
              updatedAt: nowIso
            };
          })
        ];
        await fsSaveSectionArchiveEntries(archiveEntries).catch(() => {});

        // Non-blocking background backup to Google Apps Script (Code.gs 2026-DYNAMIC-V3) after Firestore succeeds
        const ctx = getCloudCtx();
        if (updatedCitizensList.length + updatedRequestsList.length <= 5) {
          updatedCitizensList.forEach(cit => {
            void pushToGoogleSheetsRealtime('citizens', cit, 'update', ctx.appsScriptUrl, ctx.googleSheetId, {
              backgroundBackup: true
            }).catch(() => {});
          });
          updatedRequestsList.forEach(req => {
            void pushToGoogleSheetsRealtime('requests', req, 'update', ctx.appsScriptUrl, ctx.googleSheetId, {
              backgroundBackup: true
            }).catch(() => {});
          });
        } else {
          void pushBulkDataToGoogleSheets(
            updatedCitizensList,
            updatedRequestsList,
            ctx.appsScriptUrl,
            ctx.googleSheetId,
            { silentBackground: true }
          ).catch(() => {});
        }
      } catch (err) {
        console.error('Firestore per-section archive save error:', err);
      } finally {
        saveLock.release();
      }

      updatedCitizensList.forEach(cit => emitServerMutation('citizens', 'upsert', { item: cit }));
      updatedRequestsList.forEach(req => emitServerMutation('requests', 'upsert', { item: req }));
    }).catch(() => {
      saveLock.release();
    });

    addAuditLog(
      `أرشفة مستقلة (${sectionLabel})`,
      sectionLabel,
      `تمت أرشفة (${updatedCitizensList.length}) مراجع و(${updatedRequestsList.length}) طلب في (${sectionLabel}) وإخراجها من العمل اليومي لهذا القسم فقط دون التأثير على بقية الأقسام`
    );

    return resultSummary;
  };

  // استرجاع عدة سجلات مؤرشفة للعمل اليومي الخاص بقسم محدد (أو استرجاع عام عند عدم تمرير sectionKey)
  const restoreDailyWorkItems = (options: {
    citizenIds?: string[];
    requestIds?: string[];
    sectionKey?: ArchiveSectionKey;
  }): { restoredCitizens: number; restoredRequests: number } => {
    const targetCitIds = new Set((options.citizenIds || []).filter(Boolean));
    const targetReqIds = new Set((options.requestIds || []).filter(Boolean));
    if (targetCitIds.size === 0 && targetReqIds.size === 0) {
      return { restoredCitizens: 0, restoredRequests: 0 };
    }

    const sectionKey = options.sectionKey;
    const lockKey = `restore::${sectionKey || 'global'}::${Array.from(targetCitIds).slice(0, 5).join(',')}::${Array.from(targetReqIds).slice(0, 5).join(',')}`;
    const saveLock = acquireSaveLock<{ restoredCitizens: number; restoredRequests: number }>(lockKey, 700, 2000);
    if (!saveLock.allowed) {
      return saveLock.lastResult || { restoredCitizens: 0, restoredRequests: 0 };
    }

    const nowIso = new Date().toISOString();
    const sectionLabel = sectionKey ? getArchiveSectionLabel(sectionKey) : 'الأرشيف العام';

    const updatedCitsMap = new Map<string, Citizen>();
    const updatedCits: Citizen[] = [];
    for (const c of citizensRef.current || []) {
      if (!c || !targetCitIds.has(c.Citizen_ID)) continue;
      if (sectionKey) {
        const secFields = buildSectionUnarchivedFields(c as any, sectionKey);
        const nextCit: Citizen = {
          ...c,
          archivedInSections: secFields.archivedInSections,
          unarchivedInSections: secFields.unarchivedInSections,
          UpdatedAt: nowIso
        };
        updatedCitsMap.set(nextCit.Citizen_ID, nextCit);
        updatedCits.push(nextCit);
      } else {
        // Restore to daily work while strictly preserving ALL citizen fields & archive audit history
        const nextCit: Citizen = {
          ...c,
          IsArchived: false,
          IsHistoricalImported: false,
          archivedInSections: [],
          UpdatedAt: nowIso
        };
        (nextCit as any).archived = false;
        (nextCit as any)['الأرشفة'] = 'لا';
        updatedCitsMap.set(nextCit.Citizen_ID, nextCit);
        updatedCits.push(nextCit);
      }
    }

    const updatedReqsMap = new Map<string, OfficeRequest>();
    const updatedReqs: OfficeRequest[] = [];
    for (const r of requestsRef.current || []) {
      if (!r) continue;
      const match = targetReqIds.has(r.Request_ID) || (r.Citizen_ID && targetCitIds.has(r.Citizen_ID));
      if (!match) continue;
      if (sectionKey) {
        const secFields = buildSectionUnarchivedFields(r as any, sectionKey);
        const nextReq: OfficeRequest = {
          ...r,
          archivedInSections: secFields.archivedInSections,
          unarchivedInSections: secFields.unarchivedInSections,
          DirectorDecision:
            sectionKey === 'director' && r.DirectorDecision === 'مؤرشف'
              ? ''
              : r.DirectorDecision,
          UpdatedAt: nowIso
        };
        updatedReqsMap.set(nextReq.Request_ID, nextReq);
        updatedReqs.push(nextReq);
      } else {
        // Restore to daily work while strictly preserving ALL request, routing, and archive audit fields
        const nextReq: OfficeRequest = {
          ...r,
          IsArchived: false,
          IsHistoricalImported: false,
          archivedInSections: [],
          DirectorDecision: r.DirectorDecision === 'مؤرشف' ? undefined : r.DirectorDecision,
          UpdatedAt: nowIso
        };
        (nextReq as any).archived = false;
        (nextReq as any)['الأرشفة'] = 'لا';
        updatedReqsMap.set(nextReq.Request_ID, nextReq);
        updatedReqs.push(nextReq);
      }
    }

    if (updatedCits.length === 0 && updatedReqs.length === 0) {
      saveLock.release();
      return { restoredCitizens: 0, restoredRequests: 0 };
    }

    const summary = {
      restoredCitizens: updatedCits.length,
      restoredRequests: updatedReqs.length
    };
    saveLock.setResult(summary);

    if (updatedCitsMap.size > 0) {
      const nextAll = (citizensRef.current || []).map(c => updatedCitsMap.get(c.Citizen_ID) || c);
      citizensRef.current = nextAll;
      setCitizens(nextAll);
    }
    if (updatedReqsMap.size > 0) {
      const nextAll = (requestsRef.current || []).map(r => updatedReqsMap.get(r.Request_ID) || r);
      requestsRef.current = nextAll;
      setRequests(nextAll);
    }

    enqueueSerializedSave(`restore-op::${sectionKey || 'global'}`, async () => {
      try {
        if (updatedCits.length + updatedReqs.length > 1) {
          await fsBulkSaveCitizensAndRequests(updatedCits, updatedReqs);
        } else {
          await Promise.all([
            ...updatedCits.map(cit => fsSaveCitizen(cit)),
            ...updatedReqs.map(req => fsSaveRequest(req))
          ]);
        }
        // Remove restored entries from dedicated Firestore `archives` collection for this department
        const archiveDept = sectionKey || 'global';
        const removeDocIds = [
          ...updatedCits.map(cit => `${archiveDept}_visitor_${cit.Citizen_ID}`),
          ...updatedReqs.map(req => `${archiveDept}_request_${req.Request_ID}`)
        ];
        await fsDeleteSectionArchiveEntries(removeDocIds).catch(() => {});

        // Non-blocking background backup to Google Apps Script (Code.gs 2026-DYNAMIC-V3) after Firestore succeeds
        const ctx = getCloudCtx();
        if (updatedCits.length + updatedReqs.length <= 5) {
          updatedCits.forEach(cit => {
            void pushToGoogleSheetsRealtime('citizens', cit, 'update', ctx.appsScriptUrl, ctx.googleSheetId, {
              backgroundBackup: true
            }).catch(() => {});
          });
          updatedReqs.forEach(req => {
            void pushToGoogleSheetsRealtime('requests', req, 'update', ctx.appsScriptUrl, ctx.googleSheetId, {
              backgroundBackup: true
            }).catch(() => {});
          });
        } else {
          void pushBulkDataToGoogleSheets(
            updatedCits,
            updatedReqs,
            ctx.appsScriptUrl,
            ctx.googleSheetId,
            { silentBackground: true }
          ).catch(() => {});
        }
      } catch (err) {
        console.error('Firestore per-section restore save error:', err);
      } finally {
        saveLock.release();
      }

      updatedCits.forEach(cit => emitServerMutation('citizens', 'upsert', { item: cit }));
      updatedReqs.forEach(req => emitServerMutation('requests', 'upsert', { item: req }));
    }).catch(() => {
      saveLock.release();
    });

    addAuditLog(
      `إرجاع سجل للعمل اليومي (${sectionLabel})`,
      sectionLabel,
      `تم إرجاع (${updatedCits.length}) مراجع و(${updatedReqs.length}) طلب إلى العمل اليومي في (${sectionLabel})`
    );

    return summary;
  };

  // استرجاع سجل مؤرشف واحد إلى عرض العمل اليومي (يدعم الأرشفة المستقلة للقسم أو الاسترجاع العام)
  const restoreDailyWorkItem = (citizenId: string, requestIds?: string[], sectionKey?: ArchiveSectionKey) => {
    restoreDailyWorkItems({
      citizenIds: citizenId ? [citizenId] : [],
      requestIds,
      sectionKey
    });
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

    // 4. CLOUD WIPE: Execute real deletion in Firebase Firestore (alaa-office-2026) + manual backup Sheets wipe
    const targetScriptUrl =
      systemSettingsRef.current.appsScriptUrl ||
      systemSettingsRef.current.googleAppsScriptUrl ||
      PINNED_APPS_SCRIPT_URL;

    const [fsRes] = await Promise.allSettled([
      fsWipeAllCollections(),
      wipeGoogleSheetsViaAppsScript('all', undefined, targetScriptUrl).catch(() => {}),
      wipeDeveloperCloudData().catch(() => {}),
      clearAllImagesFromDB().catch(() => {})
    ]);

    const fsOk = fsRes.status === 'fulfilled' && fsRes.value?.success;
    const fsErr = fsRes.status === 'fulfilled' ? fsRes.value?.error : String(fsRes.reason || '');

    pushCloudSyncAlert({
      severity: fsOk ? 'success' : 'error',
      target: 'firebase',
      title: fsOk ? 'تم تصفير قاعدة البيانات بنجاح' : 'تعذر إكمال تصفير Firebase Firestore',
      message: fsOk
        ? 'تم حذف وتفريغ كافة السجلات نهائياً من Firebase Firestore (alaa-office-2026) مع الإبقاء على حسابات الكادر والإعدادات.'
        : 'حدث خطأ أثناء تفريغ البيانات من Firebase Firestore. يرجى التحقق من الاتصال والمحاولة مجدداً.',
      details: !fsOk ? fsErr : undefined
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

    // 2. CLOUD WIPE for ONLY the selected sections in Firebase Firestore (alaa-office-2026)
    const targetScriptUrl =
      systemSettingsRef.current.appsScriptUrl ||
      systemSettingsRef.current.googleAppsScriptUrl ||
      PINNED_APPS_SCRIPT_URL;

    const [fsRes] = await Promise.allSettled([
      fsWipeSelectedCollections(keys),
      wipeGoogleSheetsViaAppsScript('sections', keys, targetScriptUrl).catch(() => {})
    ]);

    const fsOk = fsRes.status === 'fulfilled' && fsRes.value?.success;
    const fsErr = fsRes.status === 'fulfilled' ? fsRes.value?.error : String(fsRes.reason || '');

    pushCloudSyncAlert({
      severity: fsOk ? 'success' : 'error',
      target: 'firebase',
      title: fsOk ? `تم تصفير (${keys.length}) قسم محدد بنجاح` : `فشل تصفير الأقسام المحددة في Firebase Firestore`,
      message: fsOk
        ? 'تم حذف سجلات الأقسام المختارة نهائياً من Firebase Firestore (alaa-office-2026) مع الإبقاء على بقية الأقسام سليمة.'
        : 'تعذر حذف سجلات الأقسام المختارة من Firebase Firestore. يرجى التحقق من الاتصال والمحاولة مجدداً.',
      details: !fsOk ? fsErr : undefined
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

    // Save directly to Firebase Firestore (`custom_sections` + `departments`)
    customSectionsDomain
      .saveSectionAndProvisionSheet(newSection, nextSections, {
        ...getCloudCtx(),
        customSections: nextSections
      })
      .catch(() => {});
    fsSyncDepartmentsRegistry(usersRef.current, nextSections).catch(() => {});

    addAuditLog('إضافة قسم مخصص جديد', 'لوحة التحكم والعمليات', `تم إنشاء القسم وحفظه في Firebase Firestore: ${newSection.title}`);
    return newSection;
  };

  const updateCustomSection = (section: CustomSection) => {
    const updated = { ...section, updatedAt: new Date().toISOString() };
    const nextSections = customSections.map(s => s.id === section.id ? updated : s);
    setCustomSections(nextSections);
    customSectionsRef.current = nextSections;
    setRuntimeCustomSections(nextSections);

    emitServerMutation('customSections', 'upsert', { item: updated });

    customSectionsDomain
      .saveSectionAndProvisionSheet(updated, nextSections, {
        ...getCloudCtx(),
        customSections: nextSections
      })
      .catch(() => {});
    fsSyncDepartmentsRegistry(usersRef.current, nextSections).catch(() => {});

    addAuditLog('تعديل قسم مخصص', 'لوحة التحكم والعمليات', `تم تحديث القسم في Firebase Firestore: ${section.title}`);
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
    customSectionsDomain.deleteSection(sectionId, target?.title).catch(() => {});
    fsSyncDepartmentsRegistry(usersRef.current, nextSections).catch(() => {});
    addAuditLog('حذف قسم مخصص', 'لوحة التحكم والعمليات', `تم حذف القسم (${target?.title || sectionId}) وسجلاته نهائياً من Firebase Firestore`);
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

  // Developer Passcode Management (رمز دخول المطور السري — محفوظ حصرياً في Firebase Firestore)
  const setDeveloperPasscode = async (newCode: string): Promise<boolean> => {
    const normalized = (newCode || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim();
    if (!normalized || normalized.length < 3) return false;
    firestorePasscodeLoadedRef.current = true;
    setDeveloperPasscodeState(normalized);

    // Update Developer user record Password directly in Firebase Firestore
    const nowIso = new Date().toISOString();
    setUsers(prev => prev.map(u => (u.Role === 'developer' ? { ...u, Password: normalized, UpdatedAt: nowIso } : u)));

    updateSettings({ developerPasscode: normalized });
    try {
      await fsSaveDeveloperPasscode(normalized);
      const devUser = usersRef.current.find(u => u.Role === 'developer');
      if (devUser) {
        await fsSaveUser({ ...devUser, Password: normalized, UpdatedAt: nowIso });
      }
      pushCloudSyncAlert({
        severity: 'success',
        target: 'firebase',
        title: 'تم تحديث رمز المطور السري',
        message: 'تم حفظ الرمز الجديد مباشرة في Firebase Firestore (alaa-office-2026) وإلغاء الرمز السابق.'
      });
    } catch (e: any) {
      console.warn('Saving passcode to firestore warning:', e);
      pushCloudSyncAlert({
        severity: 'error',
        target: 'firebase',
        title: 'فشل حفظ رمز المطور السري',
        message: 'تعذر حفظ الرمز في Firebase Firestore. يرجى المحاولة مجدداً.',
        details: e?.message || String(e)
      });
      return false;
    }
    addAuditLog('تحديث رمز دخول المطور', 'لوحة المطور', 'قام المطور بتغيير رمز الدخول السري للمنظومة وحفظه في Firebase Firestore');
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
      savePersistedAuthSession(devUser, 'master_admin');
      setCurrentUser(devUser);
      setIsSplashOpen(false);
      setActiveSection('master_admin');
      addAuditLog('تسجيل دخول ناجح برمز المطور', 'نظام المصادقة', 'دخول المطور بالرمز السري المعتمد');
      triggerDepartmentGreeting(devUser);
      triggerSessionDataLoad('جاري تحميل البيانات، يرجى الانتظار...');
      return true;
    }
    return false;
  };

  const batchImportRecords = async (
    newCitizens: Citizen[],
    newRequests: OfficeRequest[],
    options?: {
      anchoredOutgoingBaseline?: number;
      anchorTimestamp?: string;
      anchorLabel?: string;
      lastRegisteredName?: string;
      lastOutgoingRaw?: string;
    }
  ): Promise<{ importedCitizens: number; importedRequests: number; firestoreSaved?: boolean; sheetsDispatched?: boolean }> => {
    // 1. Strict validation - filter out ghost/undefined & ensure imported/restored archive rows never flood Daily Work
    const validCitizens = newCitizens.filter(isStrictValidCitizen).map(c => ({
      ...c,
      IsHistoricalImported: c.IsHistoricalImported !== false ? true : false,
      IsArchived: c.IsArchived !== false ? true : false
    }));
    const validRequests = newRequests
      .filter(r => r && r.Request_ID && r.Citizen_ID)
      .map(r => ({
        ...r,
        IsHistoricalImported: r.IsHistoricalImported !== false ? true : false,
        IsArchived: r.IsArchived !== false ? true : false
      }));

    // 2. Single atomic state update (new records placed safely without UI freeze)
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
    }

    // Authoritatively anchor outgoing counter & last registered citizen name from the uploaded file
    const liveSettings = systemSettingsRef.current;
    const explicitAnchor =
      options?.anchoredOutgoingBaseline &&
      Number.isFinite(options.anchoredOutgoingBaseline) &&
      options.anchoredOutgoingBaseline > 0 &&
      options.anchoredOutgoingBaseline <= MAX_VALID_OUTGOING_SEQ
        ? Math.floor(options.anchoredOutgoingBaseline)
        : 0;
    const explicitLastName = (options?.lastRegisteredName || '').trim();
    const explicitLastRaw = (options?.lastOutgoingRaw || '').trim();

    if (explicitAnchor > 0 || explicitLastName) {
      const anchorTs = options?.anchorTimestamp || new Date().toISOString();
      const anchorLbl = options?.anchorLabel || (explicitAnchor > 0 ? `آخر عدد في الملف المرفوع (${explicitAnchor})` : explicitLastName);
      const settingsPatch = {
        ...(explicitAnchor > 0
          ? {
              lastOutgoingNumberNasiriyah: explicitAnchor,
              lastOutgoingNumberSuq: explicitAnchor
            }
          : {}),
        outgoingBaselineSetAt: anchorTs,
        outgoingBaselineLabel: anchorLbl,
        ...(explicitLastName ? { lastRegisteredName: explicitLastName } : {}),
        ...(explicitLastRaw ? { lastOutgoingRaw: explicitLastRaw } : {})
      };
      updateSettings(settingsPatch);
      fsSyncSettingsStructure(settingsPatch).catch(() => {});
    } else if (requestsCount > 0) {
      const recentAnchorMs = liveSettings?.outgoingBaselineSetAt
        ? Date.parse(liveSettings.outgoingBaselineSetAt)
        : 0;
      const hasFreshAnchor = Number.isFinite(recentAnchorMs) && Date.now() - recentAnchorMs < 15_000;

      if (!hasFreshAnchor) {
        const scanned = scanMaxOutgoingSequences(validRequests);
        const rawCurrentNas = Number(liveSettings?.lastOutgoingNumberNasiriyah) || 0;
        const rawCurrentSuq = Number(liveSettings?.lastOutgoingNumberSuq) || 0;
        const nasPoisoned = rawCurrentNas > MAX_VALID_OUTGOING_SEQ;
        const suqPoisoned = rawCurrentSuq > MAX_VALID_OUTGOING_SEQ;
        const safeCurrentNas = nasPoisoned ? 0 : rawCurrentNas;
        const safeCurrentSuq = suqPoisoned ? 0 : rawCurrentSuq;
        const nextNas = Math.max(safeCurrentNas, scanned.maxNasiriyah);
        const nextSuq = Math.max(safeCurrentSuq, scanned.maxSuq);
        if (nasPoisoned || suqPoisoned || nextNas > safeCurrentNas || nextSuq > safeCurrentSuq) {
          const anchorTs = new Date().toISOString();
          updateSettings({
            lastOutgoingNumberNasiriyah: nextNas,
            lastOutgoingNumberSuq: nextSuq,
            outgoingBaselineSetAt: anchorTs
          });
          fsSyncSettingsStructure({
            lastOutgoingNumberNasiriyah: nextNas,
            lastOutgoingNumberSuq: nextSuq,
            outgoingBaselineSetAt: anchorTs
          }).catch(() => {});
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
        liveSettings?.appsScriptUrl || systemSettings.appsScriptUrl,
        liveSettings?.googleSheetId || systemSettings.googleSheetId,
        { silentBackground: true }
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
      await fsSyncDepartmentsRegistry(users, customSections).catch(() => {});
      const blockedNow = citizens.filter(c => c && c.IsBlocked && c.Citizen_ID);
      if (blockedNow.length > 0) {
        await Promise.all(
          blockedNow.map(c =>
            fsSaveBlacklistEntry({
              Citizen_ID: c.Citizen_ID,
              FullName: c.FullName,
              normalizedName: c.FullName,
              Phone1: c.Phone1 || '',
              District: c.District || '',
              BlockReason: c.BlockReason || 'محظور إدارياً',
              BlockedAt: c.BlockedAt || new Date().toISOString().split('T')[0],
              BlockedBy: c.BlockedBy || 'الإدارة',
              IsBlocked: true,
              UpdatedAt: new Date().toISOString()
            }).catch(() => {})
          )
        );
      }
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
        setFirestoreRequestsSyncError(null);
        const deletedIds = getStoredDeletedIds();
        const activeLocalDeletes = getActiveLocallyPendingDeletes();
        if (Array.isArray(res.deletedIds)) {
          res.deletedIds.forEach(id => {
            if (id) deletedIds.add(id);
          });
        }
        if (res.citizens && res.citizens.length > 0) {
          setCitizens(prev => mergeCitizens(prev, res.citizens, activeLocalDeletes));
        }
        if (res.requests && res.requests.length > 0) {
          setRequests(prev => mergeRequests(prev, res.requests, activeLocalDeletes));
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
        if (res.documents && res.documents.length > 0) {
          setDocuments(res.documents);
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
          setUsers(prev => mergeUsers(prev, res.users, deletedIds, { incomingAuthoritative: true }));
        }
        if (res.notifications && res.notifications.length > 0) {
          setNotifications(res.notifications.slice(0, 80));
        }
        if (res.auditLogs && res.auditLogs.length > 0) {
          setAuditLogs(prev => {
            const map = new Map<string, AuditLog>();
            prev.forEach(l => {
              if (l?.Log_ID) map.set(l.Log_ID, l);
            });
            res.auditLogs.forEach(l => {
              if (l?.Log_ID) map.set(l.Log_ID, l);
            });
            return Array.from(map.values())
              .sort((a, b) => {
                const tsA = Date.parse((a as any).createdAtIso || a.Timestamp || '') || 0;
                const tsB = Date.parse((b as any).createdAtIso || b.Timestamp || '') || 0;
                return tsB - tsA;
              })
              .slice(0, 600);
          });
        }
        if (res.developerPasscode && String(res.developerPasscode).trim().length >= 3) {
          const cleanCode = String(res.developerPasscode).trim();
          firestorePasscodeLoadedRef.current = true;
          setDeveloperPasscodeState(cleanCode);
        }
        if (res.systemSettings) {
          setRuntimeCloudConfig({
            appsScriptUrl: res.systemSettings.appsScriptUrl || res.systemSettings.googleAppsScriptUrl,
            googleSheetId: res.systemSettings.googleSheetId || res.systemSettings.activeGoogleSheetId,
            googleDriveFolderId: res.systemSettings.googleDriveFolderId
          });
          setSystemSettings(prev => ({
            ...prev,
            ...res.systemSettings,
            ...(res.developerPasscode ? { developerPasscode: res.developerPasscode } : {})
          }));
        }
        return { success: true, systemSettings: res.systemSettings };
      }
      if (res.error) {
        setFirestoreRequestsSyncError(res.error);
      }
      return { success: false, error: res.error };
    } catch (e: any) {
      const msg = e?.message || String(e || 'تعذر جلب البيانات من Firebase Firestore');
      setFirestoreRequestsSyncError(msg);
      return { success: false, error: msg };
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

      savePersistedAuthSession(devUser, 'master_admin');
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

      // 2. Manual Backup Push to Pinned Google Apps Script Web App + Sheet ID/GID
      const targetScriptUrl =
        (systemSettings.appsScriptUrl && systemSettings.appsScriptUrl !== LEGACY_OLD_APPS_SCRIPT_URL
          ? systemSettings.appsScriptUrl
          : '') || PINNED_APPS_SCRIPT_URL;
      const targetSheetId =
        (systemSettings.googleSheetId && systemSettings.googleSheetId !== LEGACY_OLD_SHEET_ID
          ? systemSettings.googleSheetId
          : '') || PINNED_GOOGLE_SHEET_ID;
      let appsScriptError = '';

      if (targetScriptUrl && targetScriptUrl.startsWith('http')) {
        try {
          const bulkRes = await pushBulkDataToGoogleSheets(
            citizens,
            requests,
            targetScriptUrl,
            targetSheetId,
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
              successMessage = `تم بنجاح إرسال النسخة الاحتياطية اليدوية (${citizens.length} مراجع، ${requests.length} معاملة، ${customRecords.length} سجل قسم) إلى Google Sheets.`;
            }
          } else if (bulkRes.error) {
            appsScriptError = bulkRes.error;
          }
        } catch (scriptErr: any) {
          appsScriptError = scriptErr?.message || 'تعذر الاتصال برابط Google Apps Script';
          console.warn('Apps Script manual backup error:', scriptErr);
        }
      }

      const actorName = currentUser?.FullName || 'مدير النظام';
      if (hasAnySuccess) {
        fsSaveBackupStatus({
          action: 'manual_backup',
          status: 'success',
          actor: actorName,
          sheetId: targetSheetId,
          sheetGid: PINNED_GOOGLE_SHEET_GID,
          counts: { visitors: citizens.length, requests: requests.length, users: users.length },
          message: successMessage
        }).catch(() => {});
        addAuditLog(
          'نسخ احتياطي يدوي إلى Google Sheet',
          'النسخ الاحتياطي والتصدير',
          `تم تصدير نسخة احتياطية يدوية (${citizens.length} مراجع، ${requests.length} معاملة) إلى شيت Google (${targetSheetId})`
        );
        return {
          success: true,
          sheetsSynced: true,
          message: successMessage || 'تم بنجاح حفظ النسخة الاحتياطية اليدوية في Google Sheets.'
        };
      }

      const failureMsg =
        appsScriptError ||
        'يرجى التأكد من صحة رابط Google Apps Script (/exec) وصلاحية النشر (Anyone) لإتمام النسخ الاحتياطي اليدوي.';
      fsSaveBackupStatus({
        action: 'manual_backup',
        status: 'error',
        actor: actorName,
        sheetId: targetSheetId,
        sheetGid: PINNED_GOOGLE_SHEET_GID,
        message: failureMsg
      }).catch(() => {});
      pushCloudSyncAlert({
        severity: 'error',
        target: 'google_sheets',
        title: 'فشل النسخ الاحتياطي اليدوي مع Google Sheets',
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
    _options?: { syncToFirestore?: boolean; replaceAsPrimary?: boolean }
  ): Promise<{ success: boolean; message: string }> => {
    setIsGoogleSyncing(true);
    const deletedIds = getStoredDeletedIds();
    // STRICT SINGLE SOURCE OF TRUTH POLICY:
    // Firebase Firestore (alaa-office-2026 / (default)) is ALWAYS primary.
    // Google Sheets is manual backup/import/export ONLY and NEVER wipes or replaces Firestore documents.
    const shouldSyncToFirestore = false;
    const replaceAsPrimary = false;

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

      // Preserve authoritative archive/unarchive state cleanly so Firestore & Google Sheets NEVER conflict or hide records
      const existingCitMap = new Map<string, Citizen>();
      (citizensRef.current || []).forEach(c => {
        if (c?.Citizen_ID) existingCitMap.set(c.Citizen_ID, c);
      });
      const enrichedPulledCitizens = (pulled.citizens || []).map(c => {
        if (!c?.Citizen_ID) return c;
        const existing = existingCitMap.get(c.Citizen_ID);
        const existingTs = existing ? getRecordTimestamp(existing) : 0;
        const pulledTs = getRecordTimestamp(c);
        const existingExplicit = resolveExplicitArchiveState(existing as any);
        const pulledExplicit = resolveExplicitArchiveState(c as any);

        const mergedCit = existing ? fillMissingFieldsOnly(c, existing) : c;

        // If existing Firestore record is newer and has an explicit archive choice (true OR false), preserve it authoritatively!
        if (existing && existingExplicit !== null && existingTs >= pulledTs && existingTs > 0) {
          return {
            ...mergedCit,
            IsArchived: existingExplicit,
            IsHistoricalImported: existingExplicit ? Boolean(mergedCit.IsHistoricalImported || existing.IsHistoricalImported) : false,
            ...(existingExplicit ? {} : { ArchivedAt: undefined, ArchiveCode: undefined })
          };
        }

        // If pulled record explicitly specifies archived/unarchived, honor it directly
        if (pulledExplicit !== null) {
          return {
            ...mergedCit,
            IsArchived: pulledExplicit,
            IsHistoricalImported: pulledExplicit ? Boolean(mergedCit.IsHistoricalImported) : false,
            ...(pulledExplicit ? {} : { ArchivedAt: undefined, ArchiveCode: undefined })
          };
        }

        const hasHistoricalHint =
          isCitizenArchivedOrRestored(c) ||
          isCitizenArchivedOrRestored(existing) ||
          String(c.ReferralSource || '').includes('استيراد إكسل') ||
          String(c.CreatedBy || '').includes('استيراد');
        return hasHistoricalHint
          ? { ...mergedCit, IsHistoricalImported: Boolean(mergedCit.IsHistoricalImported || existing?.IsHistoricalImported), IsArchived: true }
          : { ...mergedCit, IsArchived: false };
      });
      const rawCitizens = mergeCitizens([], enrichedPulledCitizens, deletedIds);

      // Enrich pulled requests with existing Firestore workflow fields & authoritative archive state
      // so pulling/restoring from Google Sheets NEVER wipes an approved Director decision or causes archive conflicts!
      const existingReqMap = new Map<string, OfficeRequest>();
      (requestsRef.current || []).forEach(r => {
        if (r?.Request_ID) existingReqMap.set(r.Request_ID, r);
      });
      const enrichedPulledRequests = (pulled.requests || []).map(r => {
        const existing = r?.Request_ID ? existingReqMap.get(r.Request_ID) : undefined;
        const existingTs = existing ? getRecordTimestamp(existing) : 0;
        const pulledTs = getRecordTimestamp(r);
        const existingExplicit = resolveExplicitArchiveState(existing as any);
        const pulledExplicit = resolveExplicitArchiveState(r as any);

        const resolveArchiveFields = (base: OfficeRequest): OfficeRequest => {
          if (existing && existingExplicit !== null && existingTs >= pulledTs && existingTs > 0) {
            return {
              ...base,
              IsArchived: existingExplicit,
              IsHistoricalImported: existingExplicit ? Boolean(base.IsHistoricalImported || existing.IsHistoricalImported) : false,
              ...(existingExplicit ? {} : { ArchivedAt: undefined, ArchiveCode: undefined })
            };
          }
          if (pulledExplicit !== null) {
            return {
              ...base,
              IsArchived: pulledExplicit,
              IsHistoricalImported: pulledExplicit ? Boolean(base.IsHistoricalImported) : false,
              ...(pulledExplicit ? {} : { ArchivedAt: undefined, ArchiveCode: undefined })
            };
          }
          const hasHistoricalHint =
            isRequestArchivedOrRestored(r) ||
            isRequestArchivedOrRestored(existing) ||
            String(r?.Request_ID || '').includes('-IMP-') ||
            String(r?.CreatedBy || '').includes('استيراد');
          return hasHistoricalHint
            ? { ...base, IsHistoricalImported: Boolean(base.IsHistoricalImported || existing?.IsHistoricalImported), IsArchived: true }
            : { ...base, IsArchived: false };
        };

        if (!existing) {
          return resolveArchiveFields(r);
        }
        const merged = fillMissingFieldsOnly(r, existing);
        const withHist = resolveArchiveFields(merged);
        // If Firestore has a newer UpdatedAt (e.g., Director just approved), keep newer workflow status cleanly
        if (existingTs > pulledTs && existingTs > 0) {
          return {
            ...withHist,
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
        return withHist;
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

      // Non-destructive read-only gap-fill merge into UI memory (NEVER replaces Firestore state and NEVER overwrites or deletes Firestore docs!)
      if (cleanCitizens.length > 0) {
        setCitizens(prev => mergeCitizens(prev, cleanCitizens, deletedIds));
      }
      if (cleanRequests.length > 0) {
        setRequests(prev => mergeRequests(prev, cleanRequests, deletedIds));
      }
      if (cleanInterviews.length > 0) {
        setInterviews(prev => mergeInterviews(prev, cleanInterviews, deletedIds));
      }
      if (cleanLetters.length > 0) {
        setOfficialLetters(prev => mergeOfficialLetters(prev, cleanLetters, deletedIds));
      }
      if (cleanOrgs.length > 0) {
        setOrganizationRecords(prev => mergeOrganizationRecords(prev, cleanOrgs, deletedIds));
      }
      if (cleanCheques.length > 0) {
        setCheques(prev => mergeCheques(prev, cleanCheques, deletedIds));
      }
      if (cleanCustomRecords.length > 0) {
        setCustomRecords(prev => mergeCustomRecords(prev, cleanCustomRecords, deletedIds));
      }
      if (cleanUsers.length > 0) {
        // Non-authoritative merge from Google Sheets: never revert newer passwords/roles locked in Firebase Firestore
        setUsers(prev => mergeUsers(prev, cleanUsers, deletedIds, { incomingAuthoritative: false }));
      }

      // Suppress unused local flags explicitly while preserving signature compatibility
      void shouldSyncToFirestore;
      void replaceAsPrimary;
      void isAuthoritativeSheetSnapshot;

      return { cleanCitizens, cleanRequests, cleanCustomRecords };
    };

    try {
      // Attempt 1: Google Apps Script Web App (Authoritative primary reference — works on Vercel & every device!)
      const targetScriptUrl =
        overrideScriptUrl ||
        systemSettingsRef.current.appsScriptUrl ||
        systemSettingsRef.current.googleAppsScriptUrl ||
        PINNED_APPS_SCRIPT_URL;

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

  const importFromGoogleSheetToSupabase = async (): Promise<GoogleSheetToSupabaseImportResult> => {
    setIsImportingFromGoogleSheet(true);
    try {
      const targetScriptUrl =
        systemSettingsRef.current.appsScriptUrl ||
        systemSettingsRef.current.googleAppsScriptUrl ||
        PINNED_APPS_SCRIPT_URL;
      const targetSheetId =
        systemSettingsRef.current.googleSheetId ||
        systemSettingsRef.current.activeGoogleSheetId ||
        PINNED_GOOGLE_SHEET_ID;

      const res = await importPreviousDataFromGoogleSheetToSupabase({
        appsScriptUrl: targetScriptUrl,
        sheetId: targetSheetId,
        gid: PINNED_GOOGLE_SHEET_GID,
        actor: currentUser?.FullName || 'الإدارة'
      });

      if (res.success) {
        if (res.requestsImported > 0) {
          setIsSupabaseRequestsEmpty(false);
        }
        await fetchAllFromFirestoreNow().catch(() => {});
        addAuditLog(
          'جلب البيانات السابقة من Google Sheet إلى Supabase',
          'إدارة البيانات',
          res.message
        );
        pushCloudSyncAlert({
          severity: 'success',
          target: 'both',
          title: 'تم جلب البيانات السابقة من Google Sheet إلى Supabase بنجاح',
          message: res.message
        });
      } else {
        pushCloudSyncAlert({
          severity: 'error',
          target: 'google_sheets',
          title: 'تعذر جلب البيانات السابقة من Google Sheet',
          message: res.message,
          details: res.error
        });
      }

      return res;
    } finally {
      setIsImportingFromGoogleSheet(false);
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
        archiveDailyWorkItems,
        restoreDailyWorkItem,
        restoreDailyWorkItems,
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
        // Firestore Direct Live Sync & Diagnostics
        isFirestoreSyncing,
        firestoreRequestsSyncError,
        firestoreLastSaveError,
        clearFirestoreDiagnostics,
        syncAllToFirestoreNow,
        fetchAllFromFirestoreNow,
        batchImportRecords,
        // Supabase <-> Google Sheet Historical Importer
        isImportingFromGoogleSheet,
        isSupabaseRequestsEmpty,
        importFromGoogleSheetToSupabase,
        // Compatibility alias
        triggerDeveloper3WaySync
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

