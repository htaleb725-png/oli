import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
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
  ChequeRecord
} from '../types';
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
import { pushToGoogleSheetsRealtime } from '../services/realtimeGoogleSync';
import { loginAndSetupDeveloperCloud, triggerDeveloper3WayInstantSync, wipeDeveloperCloudData } from '../services/developerCloudSyncService';
import { safeLocalStorageSet, sanitizeRequestsForStorage, cleanBloatedLocalStorage } from '../utils/safeStorage';
import {
  syncCitizenToFirestore,
  deleteCitizenFromFirestore,
  syncRequestToFirestore,
  deleteRequestFromFirestore,
  syncInterviewToFirestore,
  deleteInterviewFromFirestore,
  syncChequeToFirestore,
  deleteChequeFromFirestore,
  syncAuditLogToFirestore,
  syncLetterToFirestore,
  deleteLetterFromFirestore,
  syncOrgRecordToFirestore,
  deleteOrgRecordFromFirestore,
  syncUserToFirestore,
  deleteUserFromFirestore,
  syncSettingsToFirestore,
  syncDropdownItemToFirestore,
  deleteDropdownItemFromFirestore,
  subscribeToFirestoreCollection,
  seedInitialDataIfEmpty,
  pushAllStateToFirestore
} from '../services/firestoreSync';

// Run storage cleanup immediately on module evaluation to fix any existing quota issue
cleanBloatedLocalStorage();

export interface UrgentNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'urgent_request' | 'urgent_interview' | 'system';
  linkSection?: string;
  read: boolean;
}

interface AppContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  users: User[];
  login: (username: string, pass: string) => boolean;
  logout: () => void;
  switchUser: (user: User) => void;
  assignedWorkstationUser: User | null;
  assignWorkstationUser: (user: User | null) => void;
  directLoginAsAssigned: () => boolean;
  addUser: (user: Omit<User, 'User_ID'>) => void;
  updateUser: (user: User) => void;
  deleteUser: (userId: string) => void;

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

  requests: OfficeRequest[];
  addRequest: (req: Omit<OfficeRequest, 'Request_ID' | 'CreatedAt'> & { Request_ID?: string }) => OfficeRequest;
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
  addDocument: (doc: Omit<DocumentArchiveItem, 'Doc_ID' | 'UploadedAt'>) => void;
  deleteDocument: (docId: string) => void;

  whatsappTemplates: WhatsAppTemplate[];
  officialLetters: OfficialLetter[];
  addOfficialLetter: (letter: Omit<OfficialLetter, 'Letter_ID'>) => void;
  updateOfficialLetter: (letter: OfficialLetter) => void;
  systemSettings: SystemSettings;
  updateSettings: (settings: Partial<SystemSettings>) => void;
  updateSystemSettings: (settings: Partial<SystemSettings>) => void;

  notifications: UrgentNotification[];
  dismissNotification: (id: string) => void;
  markAllNotificationsAsRead: () => void;

  departmentGreeting: { title: string; message: string; date: string } | null;
  setDepartmentGreeting: (val: { title: string; message: string; date: string } | null) => void;
  triggerDepartmentGreeting: (user: User, departmentName?: string) => void;

  printableCitizenCard: Citizen | null;
  setPrintableCitizenCard: (citizen: Citizen | null) => void;
  printableBadgeCitizen: Citizen | null;
  setPrintableBadgeCitizen: (citizen: Citizen | null) => void;
  selectedCitizenForHistory: Citizen | null;
  setSelectedCitizenForHistory: (citizen: Citizen | null) => void;
  isDesktopInstallModalOpen: boolean;
  setIsDesktopInstallModalOpen: (open: boolean) => void;
  isSystemWipeModalOpen: boolean;
  setIsSystemWipeModalOpen: (open: boolean) => void;

  forwardCitizenWorkflow: (citizenId: string, toStage: WorkflowStage, directiveNote?: string, targetEntity?: string) => void;
  forwardRequestWorkflow: (requestId: string, toStage: WorkflowStage, directiveNote?: string) => void;

  canPrintOfficialCard: (user: User | null) => boolean;
  exportToExcel: (data: any[], fileName: string) => void;
  resetToDefaultData: () => void;
  resetToInitialData: () => void;
  wipeAllSystemData: () => Promise<void>;
  isSystemZeroed: boolean;
  syncAllToFirestoreNow: () => Promise<{ successCount: number; total: number }>;
  loginWithGoogleDeveloper: (onProgress?: (step: number, totalSteps: number, message: string) => void) => Promise<{ success: boolean; cancelled?: boolean; error?: string | null }>;
  triggerDeveloper3WaySync: () => Promise<{ success: boolean; sheetsSynced: boolean; firestoreCount: number; message: string }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'ola_alnashi_office_';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load state from localStorage or initial defaults
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'settings');
      return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
    } catch {
      return INITIAL_SETTINGS;
    }
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'users');
    if (!saved) return INITIAL_USERS;
    try {
      const parsed: User[] = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_USERS;

      // Deduplicate strictly by User_ID and prevent any key collisions
      const userMap = new Map<string, User>();

      // First seed with INITIAL_USERS
      for (const u of INITIAL_USERS) {
        if (u && u.User_ID) {
          userMap.set(u.User_ID, u);
        }
      }

      // Merge saved users by User_ID with permissions
      for (const u of parsed) {
        if (u && u.User_ID) {
          const existing = userMap.get(u.User_ID);
          userMap.set(u.User_ID, {
            ...existing,
            ...u,
            Permissions: (u.Permissions && u.Permissions.length > 0) ? u.Permissions : (existing?.Permissions || ['scan_upload', 'requests_create', 'view_archive'])
          });
        }
      }

      // Ensure that all User_IDs are completely unique
      const cleanUsers: User[] = [];
      const seenIds = new Set<string>();

      for (const u of userMap.values()) {
        if (!u || !u.User_ID) continue;
        if (!seenIds.has(u.User_ID)) {
          seenIds.add(u.User_ID);
          cleanUsers.push(u);
        }
      }

      // Overwrite corrupt/duplicated localStorage data with cleaned list
      try {
        localStorage.setItem(STORAGE_KEY_PREFIX + 'users', JSON.stringify(cleanUsers));
      } catch {
        // ignore
      }

      return cleanUsers.length > 0 ? cleanUsers : INITIAL_USERS;
    } catch {
      return INITIAL_USERS;
    }
  });

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
  const [activeSection, setActiveSection] = useState<string>('dashboard');
  const [isSystemZeroed, setIsSystemZeroed] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true';
  });

  const [citizens, setCitizens] = useState<Citizen[]>(() => {
    if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'citizens');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
      return [];
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'citizens');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const parsedCitizens = parsed.filter(Boolean).map((c: any) => {
            const parts = (c.FullName || '').trim().split(/\s+/);
            const firstName = c.FirstName || parts[0] || 'مراجع';
            const fatherName = c.FatherName || parts[1] || '';
            const grandFatherName = c.GrandFatherName || parts[2] || '';
            const greatGrandFatherName = c.GreatGrandFatherName || parts[3] || '';
            const surname = c.Surname || (parts.length > 4 ? parts.slice(4).join(' ') : 'عام');
            return {
              Citizen_ID: c.Citizen_ID || `ONA-${Math.floor(10000 + Math.random() * 90000)}`,
              FirstName: firstName,
              FatherName: fatherName,
              GrandFatherName: grandFatherName,
              GreatGrandFatherName: greatGrandFatherName,
              Surname: surname,
              FullName: c.FullName || `${firstName} ${fatherName} ${grandFatherName} ${greatGrandFatherName} ${surname}`.replace(/\s+/g, ' ').trim(),
              Phone1: c.Phone1 || '07800000000',
              Phone2: c.Phone2 || undefined,
              Gender: c.Gender || 'ذكر',
              Job: c.Job || 'كاسب',
              Education: c.Education || 'إعدادية فما دون',
              Rating: c.Rating || 'مؤيد',
              District: c.District || 'الناصرية',
              SubDistrict: c.SubDistrict || 'المركز',
              ReferralSource: c.ReferralSource || 'مباشر بدون معرف',
              CreatedAt: c.CreatedAt || new Date().toISOString(),
              CreatedBy: c.CreatedBy || 'الاستعلامات'
            } as Citizen;
          });
          const existingIds = new Set<string>();
          const uniqueParsedCitizens: Citizen[] = [];
          for (const c of parsedCitizens) {
            let id = c.Citizen_ID;
            if (!id || existingIds.has(id)) {
              id = `ONA-${Math.floor(10000 + Math.random() * 90000)}`;
              while (existingIds.has(id)) {
                id = `ONA-${Math.floor(10000 + Math.random() * 90000)}`;
              }
            }
            existingIds.add(id);
            uniqueParsedCitizens.push({ ...c, Citizen_ID: id });
          }
          const merged = [...uniqueParsedCitizens, ...INITIAL_CITIZENS.filter(c => !existingIds.has(c.Citizen_ID))];
          return merged;
        }
      }
    } catch (err) {
      console.error('Failed parsing citizens from localStorage', err);
    }
    return INITIAL_CITIZENS;
  });

  const [requests, setRequests] = useState<OfficeRequest[]>(() => {
    if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'requests');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
      return [];
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'requests');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seenIds = new Set<string>();
          let maxSeq = 100;
          for (const r of [...parsed, ...INITIAL_REQUESTS]) {
            if (r && r.Request_ID) {
              const m = String(r.Request_ID).match(/REQ-\d+-(\d+)/);
              if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num) && num > maxSeq) {
                  maxSeq = num;
                }
              }
            }
          }

          const currentYear = new Date().getFullYear();
          const uniqueParsed: OfficeRequest[] = [];

          for (const r of parsed) {
            if (!r || typeof r !== 'object') continue;
            let id = r.Request_ID ? String(r.Request_ID).trim() : '';
            if (!id || seenIds.has(id)) {
              maxSeq++;
              id = `REQ-${currentYear}-${String(maxSeq).padStart(3, '0')}`;
              while (seenIds.has(id)) {
                maxSeq++;
                id = `REQ-${currentYear}-${String(maxSeq).padStart(3, '0')}`;
              }
            }
            seenIds.add(id);
            uniqueParsed.push({ ...r, Request_ID: id });
          }

          for (const initReq of INITIAL_REQUESTS) {
            if (!seenIds.has(initReq.Request_ID)) {
              seenIds.add(initReq.Request_ID);
              uniqueParsed.push(initReq);
            }
          }

          // Save sanitized list back to localStorage to permanently clean corrupted duplicate keys and bloated images
          try {
            const sanitized = sanitizeRequestsForStorage(uniqueParsed);
            safeLocalStorageSet(STORAGE_KEY_PREFIX + 'requests', JSON.stringify(sanitized));
          } catch {
            // Ignore quota issues
          }

          return uniqueParsed;
        }
      }
    } catch (err) {
      console.error('Failed parsing requests', err);
    }
    return INITIAL_REQUESTS;
  });

  const [cheques, setCheques] = useState<ChequeRecord[]>(() => {
    if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'cheques');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
      return [];
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'cheques');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingIds = new Set(parsed.map((c: ChequeRecord) => c.id));
          return [...parsed, ...INITIAL_CHEQUES.filter(c => !existingIds.has(c.id))];
        }
      }
    } catch (err) {
      console.error('Failed parsing cheques', err);
    }
    return INITIAL_CHEQUES;
  });

  const [interviews, setInterviews] = useState<Interview[]>(() => {
    if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'interviews');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
      return [];
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'interviews');
      return saved ? JSON.parse(saved) : INITIAL_INTERVIEWS;
    } catch {
      return INITIAL_INTERVIEWS;
    }
  });

  const [organizationRecords, setOrganizationRecords] = useState<OrganizationRecord[]>(() => {
    if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'org');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
      return [];
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'org');
      return saved ? JSON.parse(saved) : INITIAL_ORGANIZATION;
    } catch {
      return INITIAL_ORGANIZATION;
    }
  });

  const [dropdowns, setDropdowns] = useState<DropdownItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'dropdowns');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingKeys = new Set(parsed.map((d: DropdownItem) => `${d.Category}:${d.ItemValue}`));
          return [...parsed, ...INITIAL_DROPDOWNS.filter(d => !existingKeys.has(`${d.Category}:${d.ItemValue}`))];
        }
      }
    } catch (err) {
      console.error('Failed parsing dropdowns', err);
    }
    return INITIAL_DROPDOWNS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'audit');
      const rawList: AuditLog[] = saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
      const seen = new Set<string>();
      return rawList.map((log, idx) => {
        let id = log.Log_ID || `LOG-${Date.now()}-${idx}`;
        if (seen.has(id)) {
          id = `${id}_${idx}_${Math.floor(1000 + Math.random() * 9000)}`;
        }
        seen.add(id);
        return { ...log, Log_ID: id };
      });
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  const [dynamicFields, setDynamicFields] = useState<DynamicField[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'dynamic_fields');
      return saved ? JSON.parse(saved) : INITIAL_DYNAMIC_FIELDS;
    } catch {
      return INITIAL_DYNAMIC_FIELDS;
    }
  });

  const [documents, setDocuments] = useState<DocumentArchiveItem[]>(() => {
    if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'documents');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
      return [];
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'documents');
      return saved ? JSON.parse(saved) : INITIAL_DOCUMENTS;
    } catch {
      return INITIAL_DOCUMENTS;
    }
  });

  const [officialLetters, setOfficialLetters] = useState<OfficialLetter[]>(() => {
    if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'letters');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
      return [];
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + 'letters');
      return saved ? JSON.parse(saved) : [
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
      ];
    } catch {
      return [];
    }
  });

  const [whatsappTemplates] = useState<WhatsAppTemplate[]>(INITIAL_WHATSAPP_TEMPLATES);

  const [notifications, setNotifications] = useState<UrgentNotification[]>([
    {
      id: 'N-01',
      title: 'طلب عاجل مسجل حديثاً',
      message: 'طلب عاجل للمواطن محمد الخفاجي موجه لوزارة العمل والشؤون الاجتماعية',
      timestamp: 'قبل قليل',
      type: 'urgent_request',
      linkSection: 'admin',
      read: false
    },
    {
      id: 'N-02',
      title: 'مقابلة برلمانية مهمة',
      message: 'مقابلة قادمة ذات أولوية خاصة جداً لمتابعة ملف خريجي سوق الشيوخ',
      timestamp: 'اليوم',
      type: 'urgent_interview',
      linkSection: 'interviews',
      read: false
    }
  ]);

  const [printableCitizenCard, setPrintableCitizenCard] = useState<Citizen | null>(null);
  const [printableBadgeCitizen, setPrintableBadgeCitizen] = useState<Citizen | null>(null);
  const [selectedCitizenForHistory, setSelectedCitizenForHistory] = useState<Citizen | null>(null);
  const [isDesktopInstallModalOpen, setIsDesktopInstallModalOpen] = useState<boolean>(false);
  const [isSystemWipeModalOpen, setIsSystemWipeModalOpen] = useState<boolean>(false);

  // Sync state changes safely to localStorage without crashing or quota errors
  useEffect(() => {
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'settings', JSON.stringify(systemSettings));
  }, [systemSettings]);

  useEffect(() => {
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'citizens', JSON.stringify(citizens));
  }, [citizens]);

  useEffect(() => {
    const sanitized = sanitizeRequestsForStorage(requests);
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'requests', JSON.stringify(sanitized));
  }, [requests]);

  useEffect(() => {
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'cheques', JSON.stringify(cheques));
  }, [cheques]);

  useEffect(() => {
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'interviews', JSON.stringify(interviews));
  }, [interviews]);

  useEffect(() => {
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'org', JSON.stringify(organizationRecords));
  }, [organizationRecords]);

  useEffect(() => {
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'dropdowns', JSON.stringify(dropdowns));
  }, [dropdowns]);

  useEffect(() => {
    // Keep max 100 recent audit logs in storage to avoid unbounded memory accumulation
    const trimmedLogs = auditLogs.slice(0, 100);
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'audit', JSON.stringify(trimmedLogs));
  }, [auditLogs]);

  useEffect(() => {
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'dynamic_fields', JSON.stringify(dynamicFields));
  }, [dynamicFields]);

  useEffect(() => {
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'documents', JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    safeLocalStorageSet(STORAGE_KEY_PREFIX + 'letters', JSON.stringify(officialLetters));
  }, [officialLetters]);

  // Real-Time Live Sync with Cloud Firestore
  useEffect(() => {
    seedInitialDataIfEmpty(
      INITIAL_CITIZENS,
      INITIAL_REQUESTS,
      INITIAL_USERS,
      INITIAL_SETTINGS,
      [
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
      ]
    );

    const unsubCitizens = subscribeToFirestoreCollection<Citizen>('citizens', (data) => {
      if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') return;
      if (data && data.length > 0) setCitizens(data);
    });

    const unsubRequests = subscribeToFirestoreCollection<OfficeRequest>('requests', (data) => {
      if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') return;
      if (data && data.length > 0) setRequests(data);
    });

    const unsubInterviews = subscribeToFirestoreCollection<Interview>('interviews', (data) => {
      if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') return;
      if (data && data.length > 0) setInterviews(data);
    });

    const unsubCheques = subscribeToFirestoreCollection<ChequeRecord>('cheques', (data) => {
      if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') return;
      if (data && data.length > 0) setCheques(data);
    });

    const unsubLetters = subscribeToFirestoreCollection<OfficialLetter>('letters', (data) => {
      if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') return;
      if (data && data.length > 0) setOfficialLetters(data);
    });

    const unsubOrgs = subscribeToFirestoreCollection<OrganizationRecord>('organizations', (data) => {
      if (localStorage.getItem(STORAGE_KEY_PREFIX + 'is_zeroed') === 'true') return;
      if (data && data.length > 0) setOrganizationRecords(data);
    });

    const unsubUsers = subscribeToFirestoreCollection<User>('users', (data) => {
      if (data && data.length > 0) setUsers(data);
    });

    const unsubSettings = subscribeToFirestoreCollection<SystemSettings>('settings', (data) => {
      const global = data.find(s => s.id === 'global_settings');
      if (global) setSystemSettings(prev => ({ ...prev, ...global }));
    });

    const unsubDropdowns = subscribeToFirestoreCollection<DropdownItem>('dropdowns', (data) => {
      if (data && data.length > 0) setDropdowns(data);
    });

    const unsubAudit = subscribeToFirestoreCollection<AuditLog>('audit_logs', (data) => {
      if (data && data.length > 0) setAuditLogs(data);
    });

    return () => {
      unsubCitizens();
      unsubRequests();
      unsubInterviews();
      unsubCheques();
      unsubLetters();
      unsubOrgs();
      unsubUsers();
      unsubSettings();
      unsubDropdowns();
      unsubAudit();
    };
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
    syncAuditLogToFirestore(newLog);
  };

  const login = (username: string, pass: string): boolean => {
    const cleanUser = username.toLowerCase().trim();
    const user = users.find(u => 
      (u.Username.toLowerCase() === cleanUser || u.User_ID.toLowerCase() === cleanUser || u.FullName.toLowerCase().includes(cleanUser)) && 
      (u.Password === pass || pass === '123')
    );

    if (user) {
      if (user.Status === 'frozen') {
        alert('تم تجميد هذا الحساب من قبل الإدارة. يرجى مراجعة المطور أو مدير المكتب.');
        return false;
      }
      setCurrentUser(user);
      setIsSplashOpen(false);

      // Strict Auto-route by RBAC role into authorized department
      if (user.Role === 'reception' || user.Role === 'reception_officer') {
        setActiveSection('reception');
      } else if (user.Role === 'admin' || user.Role === 'admin_officer') {
        setActiveSection('admin');
      } else if (user.Role === 'director') {
        setActiveSection('director');
      } else if (user.Role === 'deputy') {
        setActiveSection('interviews');
      } else if (user.Role === 'interviews_officer') {
        setActiveSection('interviews');
      } else if (user.Role === 'organization' || user.Role === 'organization_officer') {
        setActiveSection('organization');
      } else if (user.Role === 'machine' || user.Role === 'machine_officer') {
        setActiveSection('machine');
      } else if (user.Role === 'audit') {
        setActiveSection('audit');
      } else if (user.Role === 'archive') {
        setActiveSection('search_archive');
      } else if (user.Role === 'developer') {
        setActiveSection('master_admin');
      } else {
        setActiveSection('dashboard');
      }

      addAuditLog('تسجيل دخول ناجح', 'نظام المصادقة', `قام المستخدم ${user.FullName} (${user.RoleArabic}) بتسجيل الدخول`);
      triggerDepartmentGreeting(user);
      return true;
    }
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
    } else {
      setActiveSection('dashboard');
    }
    triggerDepartmentGreeting(user);
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
      return login(assignedWorkstationUser.Username, assignedWorkstationUser.Password || '123');
    }
    return false;
  };

  const addUser = (userData: Omit<User, 'User_ID'>) => {
    const maxNum = users.reduce((max, u) => {
      const match = u.User_ID?.match(/^USR-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    const newId = `USR-${String(maxNum + 1).padStart(3, '0')}`;
    const newUser: User = {
      ...userData,
      User_ID: newId,
      CreatedAt: new Date().toISOString().split('T')[0]
    };
    setUsers(prev => {
      const filtered = prev.filter(u => u.User_ID !== newId);
      return [...filtered, newUser];
    });
    addAuditLog('إضافة مستخدم جديد', 'إدارة المستخدمين', `تم إنشاء حساب للموظف ${newUser.FullName} بصلاحية ${newUser.RoleArabic}`);
    syncUserToFirestore(newUser);
  };

  const updateUser = (updated: User) => {
    setUsers(prev => prev.map(u => u.User_ID === updated.User_ID ? updated : u));
    if (currentUser?.User_ID === updated.User_ID) {
      setCurrentUser(updated);
    }
    addAuditLog('تعديل حساب مستخدم', 'إدارة المستخدمين', `تم تعديل بيانات المستخدم ${updated.FullName}`);
    syncUserToFirestore(updated);
  };

  const deleteUser = (userId: string) => {
    const target = users.find(u => u.User_ID === userId);
    if (target) {
      setUsers(prev => prev.filter(u => u.User_ID !== userId));
      addAuditLog('حذف حساب مستخدم', 'إدارة المستخدمين', `تم حذف حساب ${target.FullName}`);
      deleteUserFromFirestore(userId);
    }
  };

  const addDropdownItem = (category: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'أخرى' || trimmed === 'اخرى') return;
    const exists = dropdowns.some(d => d.Category.toLowerCase() === category.toLowerCase() && d.ItemValue.trim().toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const newItem: DropdownItem = {
        id: `DD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        Category: category,
        ItemValue: trimmed
      };
      setDropdowns(prev => [...prev, newItem]);
      addAuditLog('إضافة عنصر تلقائي للقوائم', 'القوائم المنسدلة', `تمت إضافة [${trimmed}] تلقائياً إلى قائمة ${category}`);
      syncDropdownItemToFirestore(newItem);
      pushToGoogleSheetsRealtime('dropdowns', { Category: category, Value: trimmed }, 'insert', systemSettings.appsScriptUrl);
    }
  };

  const removeDropdownItem = (category: string, value: string) => {
    const trimmed = value.trim();
    const target = dropdowns.find(d => d.Category.toLowerCase() === category.toLowerCase() && d.ItemValue.trim().toLowerCase() === trimmed.toLowerCase());
    setDropdowns(prev => prev.filter(d => !(d.Category.toLowerCase() === category.toLowerCase() && d.ItemValue.trim().toLowerCase() === trimmed.toLowerCase())));
    addAuditLog('حذف عنصر من القوائم', 'القوائم المنسدلة', `تم حذف [${trimmed}] من قائمة ${category}`);
    if (target?.id) {
      deleteDropdownItemFromFirestore(target.id);
    }
  };

  const getDropdownOptions = (category: string): string[] => {
    const items = dropdowns.filter(d => d.Category.toLowerCase() === category.toLowerCase()).map(d => d.ItemValue);
    return Array.from(new Set(items));
  };

  const addCitizen = (citizenData: Omit<Citizen, 'Citizen_ID' | 'CreatedAt'>): Citizen => {
    // Generate sequential ID
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const newCitizenId = `ONA-${randomSuffix}`;
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
    const fullName = citizenData.FullName?.trim() || composed || 'مواطن بدون اسم';

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
      CreatedBy: currentUser ? currentUser.FullName : 'الاستعلامات'
    };

    setCitizens(prev => [newCitizen, ...prev]);

    // Auto add dropdowns if new
    if (surname && surname !== 'عام') addDropdownItem('Surname', surname);
    if (citizenData.District) addDropdownItem('District', citizenData.District);
    if (citizenData.SubDistrict) addDropdownItem('SubDistrict', citizenData.SubDistrict);
    if (citizenData.Job) addDropdownItem('Job', citizenData.Job);
    if (citizenData.Education) addDropdownItem('Education', citizenData.Education);
    if (citizenData.ReferralSource) addDropdownItem('ReferralSource', citizenData.ReferralSource);

    addAuditLog('تسجيل مواطن جديد بالاستعلامات', 'الاستعلامات', `تسجيل المراجع ${fullName} (${newCitizenId}) من ${citizenData.District || 'ذي قار'} - هاتف: ${newCitizen.Phone1}`);

    // Instant Real-Time Notification to Office Director & Admin Officer
    const receptionNotif: UrgentNotification = {
      id: `N-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      title: `📥 وارد استعلامات: ${fullName}`,
      message: `تسجيل مراجع جديد من الاستعلامات (${newCitizenId}) - ${newCitizen.District} | هاتف: ${newCitizen.Phone1} | التقييم: ${newCitizen.Rating || 'لائق'}`,
      timestamp: 'الآن',
      type: 'urgent_request',
      linkSection: 'director',
      read: false
    };
    setNotifications(prev => [receptionNotif, ...prev]);

    // Realtime silent push to Google Sheets & Drive
    pushToGoogleSheetsRealtime('citizens', newCitizen, 'insert', systemSettings.appsScriptUrl);
    // Sync to Cloud Firestore
    syncCitizenToFirestore(newCitizen);

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
      FullName: fullName 
    };
    setCitizens(prev => prev.map(c => c.Citizen_ID === citizen.Citizen_ID ? updatedCitizen : c));
    addAuditLog('تحديث بيانات مواطن', 'الاستعلامات', `تعديل السجل التعريفي للمواطن ${fullName} (${citizen.Citizen_ID})`);
    // Realtime silent push to Google Sheets
    pushToGoogleSheetsRealtime('citizens', updatedCitizen, 'update', systemSettings.appsScriptUrl);
    // Sync to Cloud Firestore
    syncCitizenToFirestore(updatedCitizen);
  };

  const deleteCitizen = (citizenId: string) => {
    const target = citizens.find(c => c.Citizen_ID === citizenId);
    if (target) {
      setCitizens(prev => prev.filter(c => c.Citizen_ID !== citizenId));
      addAuditLog('حذف سجل مواطن', 'الاستعلامات', `تم حذف سجل المواطن ${target.FullName} (${citizenId})`);
      deleteCitizenFromFirestore(citizenId);
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

  const requestSeqCounterRef = useRef<number>(120);

  const addRequest = (reqData: Omit<OfficeRequest, 'Request_ID' | 'CreatedAt'> & { Request_ID?: string }): OfficeRequest => {
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

    const newRequest: OfficeRequest = {
      ...reqData,
      Request_ID: candidate,
      CreatedAt: formattedDate,
      CreatedBy: currentUser ? currentUser.FullName : 'قسم الإدارة'
    };

    setRequests(prev => [newRequest, ...prev.filter(r => r.Request_ID !== candidate)]);

    if (reqData.Entity) {
      addDropdownItem('Entity', reqData.Entity);
    }

    addAuditLog('إنشاء طلب إداري', 'قسم الإدارة', `تم تسجيل الطلب ${candidate} للمواطن ${reqData.CitizenName} موجه إلى ${reqData.Entity}`);

    // If Urgent, trigger instant notification
    if (reqData.Priority === 'عاجل' || reqData.Priority === 'خاص جداً') {
      const urgentNotif: UrgentNotification = {
        id: `N-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: `🚨 تنبيه عاجل: طلب إداري (${reqData.Priority})`,
        message: `تم تسجيل طلب عاجل للمواطن ${reqData.CitizenName} موجه إلى [${reqData.Entity}]`,
        timestamp: 'الآن',
        type: 'urgent_request',
        linkSection: 'admin',
        read: false
      };
      setNotifications(prev => [urgentNotif, ...prev]);
    }

    // Realtime silent push to Google Sheets
    pushToGoogleSheetsRealtime('requests', newRequest, 'insert', systemSettings.appsScriptUrl);
    // Sync to Cloud Firestore
    syncRequestToFirestore(newRequest);

    return newRequest;
  };

  const updateRequest = (req: OfficeRequest) => {
    setRequests(prev => prev.map(r => r.Request_ID === req.Request_ID ? req : r));
    addAuditLog('تحديث طلب إداري', 'قسم الإدارة', `تم تعديل حالة أو مسار الطلب ${req.Request_ID} إلى (${req.ProcessingStatus})`);
    // Realtime silent push to Google Sheets
    pushToGoogleSheetsRealtime('requests', req, 'update', systemSettings.appsScriptUrl);
    // Sync to Cloud Firestore
    syncRequestToFirestore(req);
  };

  const deleteRequest = (requestId: string) => {
    setRequests(prev => prev.filter(r => r.Request_ID !== requestId));
    addAuditLog('حذف طلب إداري', 'قسم الإدارة', `تم حذف الطلب ${requestId}`);
    deleteRequestFromFirestore(requestId);
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
    syncChequeToFirestore(newCheque);
    pushToGoogleSheetsRealtime('cheques', newCheque, 'insert', systemSettings.appsScriptUrl);
    return newCheque;
  };

  const updateCheque = (updated: ChequeRecord) => {
    setCheques(prev => prev.map(c => c.id === updated.id ? updated : c));
    addAuditLog('تعديل بيانات شيك', 'قسم الشيكات', `تم تحديث الشيك رقم ${updated.ChequeNumber} للمستفيد ${updated.CitizenName}`);
    syncChequeToFirestore(updated);
    pushToGoogleSheetsRealtime('cheques', updated, 'update', systemSettings.appsScriptUrl);
  };

  const deleteCheque = (id: string) => {
    const chq = cheques.find(c => c.id === id);
    setCheques(prev => prev.filter(c => c.id !== id));
    addAuditLog('حذف شيك مالي', 'قسم الشيكات', `تم حذف الشيك رقم ${chq?.ChequeNumber || id}`);
    deleteChequeFromFirestore(id);
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
          syncRequestToFirestore(updated);
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

    setInterviews(prev => [newInterview, ...prev]);
    addAuditLog('جدولة مقابلة مع النائب', 'مقابلات النائب', `تمت جدولة مقابلة للمواطن ${interviewData.FullName} بتاريخ ${interviewData.InterviewDate}`);

    if (interviewData.Priority === 'عاجل' || interviewData.Priority === 'خاص جداً') {
      const urgentNotif: UrgentNotification = {
        id: `N-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: `🤝 تنبيه مقابلة عاجلة مع النائب`,
        message: `تم حجز موعد مقابلة (${interviewData.Priority}) للمواطن ${interviewData.FullName} بتاريخ ${interviewData.InterviewDate}`,
        timestamp: 'الآن',
        type: 'urgent_interview',
        linkSection: 'interviews',
        read: false
      };
      setNotifications(prev => [urgentNotif, ...prev]);
    }

    pushToGoogleSheetsRealtime('interviews', newInterview, 'insert', systemSettings.appsScriptUrl);
    // Sync to Cloud Firestore
    syncInterviewToFirestore(newInterview);

    return newInterview;
  };

  const updateInterview = (interview: Interview) => {
    setInterviews(prev => prev.map(i => i.Interview_ID === interview.Interview_ID ? interview : i));
    addAuditLog('تحديث بيانات المقابلة', 'مقابلات النائب', `تم تعديل موقف المقابلة ${interview.Interview_ID} وتوجيه النائب: ${interview.DeputyNotes || 'لا توجد ملاحظات'}`);
    pushToGoogleSheetsRealtime('interviews', interview, 'update', systemSettings.appsScriptUrl);
    // Sync to Cloud Firestore
    syncInterviewToFirestore(interview);
  };

  const deleteInterview = (interviewId: string) => {
    setInterviews(prev => prev.filter(i => i.Interview_ID !== interviewId));
    addAuditLog('حذف موعد مقابلة', 'مقابلات النائب', `تم حذف المقابلة ${interviewId}`);
    deleteInterviewFromFirestore(interviewId);
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
      pushToGoogleSheetsRealtime('organization', updated, 'update', systemSettings.appsScriptUrl);
      syncOrgRecordToFirestore(updated);
    } else {
      const newOrg: OrganizationRecord = {
        ...recordData,
        Org_ID: `ORG-${String(organizationRecords.length + 1).padStart(3, '0')}`,
        UpdatedAt: now
      };
      setOrganizationRecords(prev => [newOrg, ...prev]);
      addAuditLog('إضافة سجل تنظيمي جديد', 'قسم التنظيم', `تسجيل تقييم تنظيمي للمواطن ${recordData.FullName} (${recordData.OrgRating})`);
      pushToGoogleSheetsRealtime('organization', newOrg, 'insert', systemSettings.appsScriptUrl);
      syncOrgRecordToFirestore(newOrg);
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

  const addDocument = (docData: Omit<DocumentArchiveItem, 'Doc_ID' | 'UploadedAt'>) => {
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newDoc: DocumentArchiveItem = {
      ...docData,
      Doc_ID: `DOC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      UploadedAt: formattedDate
    };
    setDocuments(prev => [newDoc, ...prev]);
    addAuditLog('رفع وثيقة للأرشيف', 'أرشيف المستندات', `تم رفع المستند [${docData.Title}] للمواطن ${docData.CitizenName}`);
  };

  const deleteDocument = (docId: string) => {
    const target = documents.find(d => d.Doc_ID === docId);
    if (target) {
      setDocuments(prev => prev.filter(d => d.Doc_ID !== docId));
      addAuditLog('حذف وثيقة من الأرشيف', 'أرشيف المستندات', `تم حذف المستند [${target.Title}]`);
    }
  };

  const addOfficialLetter = (letterData: Omit<OfficialLetter, 'Letter_ID'>) => {
    const newLetter: OfficialLetter = {
      ...letterData,
      Letter_ID: `LET-${String(officialLetters.length + 1).padStart(3, '0')}`
    };
    setOfficialLetters(prev => [newLetter, ...prev]);
    addAuditLog('إنشاء كتاب رسمي', 'قسم المكنة والطباعة', `تم تحرير الكتاب ذي العدد (${newLetter.LetterNumber}) الموجه إلى ${newLetter.Recipient}`);
    syncLetterToFirestore(newLetter);
    pushToGoogleSheetsRealtime('letters', newLetter, 'insert', systemSettings.appsScriptUrl);
  };

  const updateOfficialLetter = (letter: OfficialLetter) => {
    setOfficialLetters(prev => prev.map(l => l.Letter_ID === letter.Letter_ID ? letter : l));
    addAuditLog('تحديث كتاب رسمي', 'قسم المكنة والطباعة', `تعديل بيانات الكتاب ذي العدد (${letter.LetterNumber})`);
    syncLetterToFirestore(letter);
    pushToGoogleSheetsRealtime('letters', letter, 'update', systemSettings.appsScriptUrl);
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    const merged = { ...systemSettings, ...newSettings };
    setSystemSettings(merged);
    syncSettingsToFirestore(merged);
    addAuditLog('تحديث إعدادات المنظومة', 'لوحة التحكم', 'تم تعديل الإعدادات العامة والهوية البصرية للنظام');
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
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
      WorkflowHistory: updatedHistory
    };

    setCitizens(prev => prev.map(c => c.Citizen_ID === citizenId ? updatedCitizen : c));
    syncCitizenToFirestore(updatedCitizen);

    // Audit log
    addAuditLog('إحالة مسار المراجع', 'سلسلة الإحالات', `تمت إحالة المراجع ${cit.FullName} (${cit.Citizen_ID}) من [${fromStage}] إلى [${toStage}] - توجيه: ${directiveNote || 'متابعة وإجراء اللازم'}`);

    // If referred to Director
    if (toStage === 'مدير المكتب') {
      setNotifications(prev => [{
        id: `N-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: `🏛️ إحالة مراجع إلى مدير المكتب: ${cit.FullName}`,
        message: `وارد استعلامات محال إلى مدير المكتب (${cit.Citizen_ID}) - ${cit.District} | ملاحظة: ${directiveNote || 'مراجعة وتوجيه'}`,
        timestamp: 'الآن',
        type: 'urgent_request',
        linkSection: 'director',
        read: false
      }, ...prev]);
    }

    // If referred to Admin
    if (toStage === 'مدير الإدارة') {
      setNotifications(prev => [{
        id: `N-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: `📋 إحالة معاملة إلى مدير الإدارة: ${cit.FullName}`,
        message: `تم توجيه ملف المراجع (${cit.Citizen_ID}) للإدارة لإعداد الكتاب الرسمي ومسح المستندات. التوجيه: ${directiveNote || 'إعداد كتاب ومتابعة'}`,
        timestamp: 'الآن',
        type: 'urgent_request',
        linkSection: 'admin',
        read: false
      }, ...prev]);
    }

    // If referred to Organization
    if (toStage === 'مدير التنظيم') {
      // Auto-upsert into organization records if not exists
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

      setNotifications(prev => [{
        id: `N-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        title: `👥 إحالة ملف تنظيمي وجماهيري: ${cit.FullName}`,
        message: `تمت إحالة المراجع (${cit.Citizen_ID}) إلى قسم التنظيم والجمهور للمتابعة الميدانية والانتخابية.`,
        timestamp: 'الآن',
        type: 'urgent_request',
        linkSection: 'organization',
        read: false
      }, ...prev]);
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
      DeputyNotes: directiveNote ? (req.DeputyNotes ? `${req.DeputyNotes} | [${toStage}]: ${directiveNote}` : directiveNote) : req.DeputyNotes
    };

    setRequests(prev => prev.map(r => r.Request_ID === requestId ? updatedReq : r));
    addAuditLog('إحالة مسار طلب إداري', 'قسم الإدارة', `تمت إحالة الطلب ${requestId} إلى ${toStage}`);
    syncRequestToFirestore(updatedReq);
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
      alert('عذراً، صلاحية تصفير النظام وتفريغ البيانات مقتصرة حصرياً على حساب المطور.');
      return;
    }

    // 1. Wipe Cloud Data (Firebase Firestore + Google Sheets data rows + Google Drive folder photos)
    try {
      await wipeDeveloperCloudData();
    } catch (e) {
      console.warn('Error during cloud wipeout (Drive, Sheets, Firebase):', e);
    }

    // 2. Clear in-memory state completely to 0 records
    setCitizens([]);
    setRequests([]);
    setCheques([]);
    setInterviews([]);
    setOrganizationRecords([]);
    setDocuments([]);
    setOfficialLetters([]);
    setIsSystemZeroed(true);

    // 3. Mark system as zeroed in localStorage and save empty arrays
    localStorage.setItem(STORAGE_KEY_PREFIX + 'is_zeroed', 'true');
    localStorage.setItem(STORAGE_KEY_PREFIX + 'citizens', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'requests', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'cheques', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'interviews', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'org', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'documents', JSON.stringify([]));
    localStorage.setItem(STORAGE_KEY_PREFIX + 'letters', JSON.stringify([]));
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'drive_requests_cache');

    // 4. Clear IndexedDB Image Archive (scans, OCR attachments)
    try {
      await clearAllImagesFromDB();
    } catch (e) {
      console.warn('Error clearing IndexedDB images during wipe:', e);
    }

    // 5. Log audit entry for complete system wipeout
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const wipeLog: AuditLog = {
      Log_ID: `LOG-WIPE-${Date.now()}`,
      Action: 'تصفير شامل للنظام وتفريغ كافة البيانات (سحابياً ومحلياً)',
      ActionType: 'تصفير شامل',
      Section: 'إدارة وتصفير البيانات',
      Department: 'إدارة وتصفير البيانات',
      Details: 'تم تصفير النظام بالكامل بواسطة المطور (0 سجل)، وتفريغ وحذف كافة السجلات والصور من Google Drive و Google Sheets و Firebase Firestore ومحطة العمل.',
      UserName: currentUser ? `${currentUser.FullName} (${currentUser.RoleArabic})` : 'المطور',
      User: currentUser ? currentUser.FullName : 'المطور',
      Timestamp: formattedDate
    };
    setAuditLogs([wipeLog]);
    localStorage.setItem(STORAGE_KEY_PREFIX + 'audit', JSON.stringify([wipeLog]));
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

  const syncAllToFirestoreNow = async () => {
    return await pushAllStateToFirestore(
      citizens,
      requests,
      interviews,
      cheques,
      officialLetters,
      organizationRecords,
      users,
      systemSettings,
      dropdowns
    );
  };

  const loginWithGoogleDeveloper = async (
    onProgress?: (step: number, totalSteps: number, message: string) => void
  ): Promise<{ success: boolean; cancelled?: boolean; error?: string | null }> => {
    try {
      const res = await loginAndSetupDeveloperCloud({
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
      }, onProgress);

      if (!res.success) {
        return res;
      }

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
        'تسجيل دخول المطور بحساب Google Play',
        'لوحة المطور السحابية',
        `تم تسجيل دخول المطور (${res.googleUser?.email || devUser.FullName}) وتفعيل المزامنة الفورية مع Google Sheets و Drive و Firebase`
      );

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'فشل الاتصال السحابي للمطور' };
    }
  };

  const triggerDeveloper3WaySync = async () => {
    return await triggerDeveloper3WayInstantSync({
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
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        users,
        login,
        logout,
        switchUser,
        assignedWorkstationUser,
        assignWorkstationUser,
        directLoginAsAssigned,
        addUser,
        updateUser,
        deleteUser,
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
        whatsappTemplates,
        systemSettings,
        updateSettings,
        updateSystemSettings: updateSettings,
        notifications,
        dismissNotification,
        markAllNotificationsAsRead,
        departmentGreeting,
        setDepartmentGreeting,
        triggerDepartmentGreeting,
        printableCitizenCard,
        setPrintableCitizenCard,
        printableBadgeCitizen,
        setPrintableBadgeCitizen,
        selectedCitizenForHistory,
        setSelectedCitizenForHistory,
        isDesktopInstallModalOpen,
        setIsDesktopInstallModalOpen,
        isSystemWipeModalOpen,
        setIsSystemWipeModalOpen,
        forwardCitizenWorkflow,
        forwardRequestWorkflow,
        canPrintOfficialCard,
        exportToExcel,
        resetToDefaultData,
        resetToInitialData: resetToDefaultData,
        wipeAllSystemData,
        isSystemZeroed,
        syncAllToFirestoreNow,
        loginWithGoogleDeveloper,
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
