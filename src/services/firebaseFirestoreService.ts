import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  onSnapshot, 
  writeBatch,
  query,
  where,
  Unsubscribe 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  Citizen, 
  OfficeRequest, 
  Interview, 
  OfficialLetter, 
  ChequeRecord, 
  OrganizationRecord, 
  User, 
  SystemSettings, 
  DropdownItem, 
  AuditLog,
  CustomSection,
  CustomSectionRecord
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Collections mapping
export const FS_COLLECTIONS = {
  CITIZENS: 'citizens',
  REQUESTS: 'requests',
  INTERVIEWS: 'interviews',
  LETTERS: 'letters',
  CHEQUES: 'cheques',
  ORGANIZATIONS: 'organizations',
  SETTINGS: 'settings',
  USERS: 'users',
  DROPDOWNS: 'dropdowns',
  AUDIT_LOGS: 'audit_logs',
  CUSTOM_SECTIONS: 'custom_sections',
  CUSTOM_RECORDS: 'custom_records',
  DELETED_RECORDS: 'deleted_records'
} as const;

// Multi-Office Partition and Database Isolation Manager
let _activeOfficePartition = 'office_alnashi_main';

export function setActiveOfficePartition(partition: string): void {
  const clean = (partition || '').trim();
  _activeOfficePartition = clean || 'office_alnashi_main';
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('al_nashi_office_partition', _activeOfficePartition);
    }
  } catch (e) {
    // Ignore storage errors
  }
}

export function getActiveOfficePartition(): string {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('al_nashi_office_partition');
      if (stored && stored.trim()) {
        _activeOfficePartition = stored.trim();
      }
    }
  } catch (e) {
    // Ignore storage errors
  }
  return _activeOfficePartition || 'office_alnashi_main';
}

export function getFSCol(baseName: string): string {
  const part = getActiveOfficePartition();
  if (!part || part === 'default' || part === 'office_alnashi_main') {
    return baseName;
  }
  return `${part}_${baseName}`;
}

// Registry of Permanently Deleted Records (لمنع استرجاع أو انبعاث السجلات المحذوفة)
export async function fsRegisterDeletedRecord(id: string, entityType: string): Promise<void> {
  if (!id) return;
  const col = getFSCol(FS_COLLECTIONS.DELETED_RECORDS);
  try {
    await setDoc(doc(db, col, id), {
      id,
      entityType,
      deletedAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn('fsRegisterDeletedRecord warning:', e);
  }
}

export async function fsGetDeletedRecordIds(): Promise<string[]> {
  try {
    const col = getFSCol(FS_COLLECTIONS.DELETED_RECORDS);
    const snap = await getDocs(collection(db, col));
    return snap.docs.map(d => d.id);
  } catch {
    return [];
  }
}

// 1. Citizen Operations
export async function fsSaveCitizen(citizen: Citizen): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.CITIZENS);
  const path = `${col}/${citizen.Citizen_ID}`;
  try {
    await setDoc(doc(db, col, citizen.Citizen_ID), {
      ...citizen,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteCitizen(citizenId: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.CITIZENS);
  const path = `${col}/${citizenId}`;
  try {
    await deleteDoc(doc(db, col, citizenId));
    await fsRegisterDeletedRecord(citizenId, 'citizens');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 2. Request Operations
export async function fsSaveRequest(req: OfficeRequest): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.REQUESTS);
  const path = `${col}/${req.Request_ID}`;
  try {
    await setDoc(doc(db, col, req.Request_ID), {
      ...req,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteRequest(requestId: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.REQUESTS);
  const path = `${col}/${requestId}`;
  try {
    await deleteDoc(doc(db, col, requestId));
    await fsRegisterDeletedRecord(requestId, 'requests');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 3. Interview Operations
export async function fsSaveInterview(interview: Interview): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.INTERVIEWS);
  const path = `${col}/${interview.Interview_ID}`;
  try {
    await setDoc(doc(db, col, interview.Interview_ID), {
      ...interview,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteInterview(interviewId: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.INTERVIEWS);
  const path = `${col}/${interviewId}`;
  try {
    await deleteDoc(doc(db, col, interviewId));
    await fsRegisterDeletedRecord(interviewId, 'interviews');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 4. Official Letters Operations
export async function fsSaveOfficialLetter(letter: OfficialLetter): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.LETTERS);
  const path = `${col}/${letter.Letter_ID}`;
  try {
    await setDoc(doc(db, col, letter.Letter_ID), {
      ...letter,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteOfficialLetter(letterId: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.LETTERS);
  const path = `${col}/${letterId}`;
  try {
    await deleteDoc(doc(db, col, letterId));
    await fsRegisterDeletedRecord(letterId, 'letters');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 5. Cheques Operations
export async function fsSaveCheque(cheque: ChequeRecord): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.CHEQUES);
  const path = `${col}/${cheque.id}`;
  try {
    await setDoc(doc(db, col, cheque.id), {
      ...cheque,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteCheque(chequeId: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.CHEQUES);
  const path = `${col}/${chequeId}`;
  try {
    await deleteDoc(doc(db, col, chequeId));
    await fsRegisterDeletedRecord(chequeId, 'cheques');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 6. Organization Records Operations
export async function fsSaveOrgRecord(record: OrganizationRecord): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.ORGANIZATIONS);
  const path = `${col}/${record.Org_ID}`;
  try {
    await setDoc(doc(db, col, record.Org_ID), {
      ...record,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// 7. Users / Staff Operations
export async function fsSaveUser(user: User): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.USERS);
  const path = `${col}/${user.User_ID}`;
  try {
    await setDoc(doc(db, col, user.User_ID), user, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteUser(userId: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.USERS);
  const path = `${col}/${userId}`;
  try {
    await deleteDoc(doc(db, col, userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 8. System Settings & Developer Passcode
export async function fsSaveSettings(settings: Partial<SystemSettings>): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.SETTINGS);
  const path = `${col}/general`;
  try {
    await setDoc(doc(db, col, 'general'), {
      ...settings,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsGetSettings(): Promise<Partial<SystemSettings> | null> {
  const col = getFSCol(FS_COLLECTIONS.SETTINGS);
  const path = `${col}/general`;
  try {
    const snap = await getDoc(doc(db, col, 'general'));
    return snap.exists() ? (snap.data() as Partial<SystemSettings>) : null;
  } catch (error) {
    console.warn('Firestore getSettings warn:', error);
    return null;
  }
}

export async function fsSaveDeveloperPasscode(passcode: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.SETTINGS);
  const path = `${col}/developer_auth`;
  try {
    await setDoc(doc(db, col, 'developer_auth'), {
      developerPasscode: passcode,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsGetDeveloperPasscode(): Promise<string | null> {
  const col = getFSCol(FS_COLLECTIONS.SETTINGS);
  const path = `${col}/developer_auth`;
  try {
    const snap = await getDoc(doc(db, col, 'developer_auth'));
    if (snap.exists() && snap.data()?.developerPasscode) {
      return String(snap.data()?.developerPasscode);
    }
    return null;
  } catch (error) {
    console.warn('Firestore getDeveloperPasscode error:', error);
    return null;
  }
}

// 9. Custom Dynamic Sections (إدارة الأقسام المخصصة)
export async function fsSaveCustomSection(section: CustomSection): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.CUSTOM_SECTIONS);
  const path = `${col}/${section.id}`;
  try {
    await setDoc(doc(db, col, section.id), {
      ...section,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteCustomSection(sectionId: string): Promise<void> {
  const colSec = getFSCol(FS_COLLECTIONS.CUSTOM_SECTIONS);
  const colRec = getFSCol(FS_COLLECTIONS.CUSTOM_RECORDS);
  const path = `${colSec}/${sectionId}`;
  try {
    // 1. Delete section document
    await deleteDoc(doc(db, colSec, sectionId));
    await fsRegisterDeletedRecord(sectionId, 'custom_sections');
    
    // 2. Cascade delete all records in this section
    const q = query(collection(db, colRec), where('sectionId', '==', sectionId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach((d) => {
      batch.delete(d.ref);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 10. Custom Dynamic Records (سجلات الأقسام المخصصة)
export async function fsSaveCustomRecord(record: CustomSectionRecord): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.CUSTOM_RECORDS);
  const path = `${col}/${record.id}`;
  try {
    await setDoc(doc(db, col, record.id), {
      ...record,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteCustomRecord(recordId: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.CUSTOM_RECORDS);
  const path = `${col}/${recordId}`;
  try {
    await deleteDoc(doc(db, col, recordId));
    await fsRegisterDeletedRecord(recordId, 'custom_records');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 11. Dropdown items
export async function fsSaveDropdown(dropdown: DropdownItem): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.DROPDOWNS);
  const docId = dropdown.id || `${dropdown.Category}_${dropdown.ItemValue}`.replace(/[\s/]/g, '_');
  const path = `${col}/${docId}`;
  try {
    await setDoc(doc(db, col, docId), {
      id: docId,
      Category: dropdown.Category,
      ItemValue: dropdown.ItemValue
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteDropdown(category: string, value: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.DROPDOWNS);
  const docId = `${category}_${value}`.replace(/[\s/]/g, '_');
  const path = `${col}/${docId}`;
  try {
    await deleteDoc(doc(db, col, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 12. Audit Logs
export async function fsAddAuditLog(log: AuditLog): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.AUDIT_LOGS);
  const path = `${col}/${log.Log_ID}`;
  try {
    await setDoc(doc(db, col, log.Log_ID), log);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// 13. Bulk Upload all System State to Firestore
export async function fsBulkPushAll(data: {
  citizens: Citizen[];
  requests: OfficeRequest[];
  interviews: Interview[];
  officialLetters: OfficialLetter[];
  cheques: ChequeRecord[];
  organizationRecords: OrganizationRecord[];
  users: User[];
  systemSettings: SystemSettings;
  dropdowns: DropdownItem[];
  customSections: CustomSection[];
  customRecords: CustomSectionRecord[];
}): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    let total = 0;
    // Process in batches of 400 (Firestore limit is 500)
    const BATCH_SIZE = 400;
    const items: Array<{ col: string; id: string; docData: any }> = [];

    const colCitizens = getFSCol(FS_COLLECTIONS.CITIZENS);
    const colRequests = getFSCol(FS_COLLECTIONS.REQUESTS);
    const colInterviews = getFSCol(FS_COLLECTIONS.INTERVIEWS);
    const colLetters = getFSCol(FS_COLLECTIONS.LETTERS);
    const colCheques = getFSCol(FS_COLLECTIONS.CHEQUES);
    const colOrgs = getFSCol(FS_COLLECTIONS.ORGANIZATIONS);
    const colUsers = getFSCol(FS_COLLECTIONS.USERS);
    const colSections = getFSCol(FS_COLLECTIONS.CUSTOM_SECTIONS);
    const colRecords = getFSCol(FS_COLLECTIONS.CUSTOM_RECORDS);
    const colSettings = getFSCol(FS_COLLECTIONS.SETTINGS);

    data.citizens.forEach(c => items.push({ col: colCitizens, id: c.Citizen_ID, docData: c }));
    data.requests.forEach(r => items.push({ col: colRequests, id: r.Request_ID, docData: r }));
    data.interviews.forEach(i => items.push({ col: colInterviews, id: i.Interview_ID, docData: i }));
    data.officialLetters.forEach(l => items.push({ col: colLetters, id: l.Letter_ID, docData: l }));
    data.cheques.forEach(ch => items.push({ col: colCheques, id: ch.id, docData: ch }));
    data.organizationRecords.forEach(o => items.push({ col: colOrgs, id: o.Org_ID, docData: o }));
    data.users.forEach(u => items.push({ col: colUsers, id: u.User_ID, docData: u }));
    data.customSections.forEach(s => items.push({ col: colSections, id: s.id, docData: s }));
    data.customRecords.forEach(cr => items.push({ col: colRecords, id: cr.id, docData: cr }));
    
    // Save settings
    items.push({ col: colSettings, id: 'general', docData: data.systemSettings });
    if (data.systemSettings.developerPasscode) {
      items.push({ 
        col: colSettings, 
        id: 'developer_auth', 
        docData: { developerPasscode: data.systemSettings.developerPasscode } 
      });
    }

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const slice = items.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      slice.forEach(item => {
        batch.set(doc(db, item.col, item.id), item.docData, { merge: true });
      });
      await batch.commit();
      total += slice.length;
    }

    return { success: true, count: total };
  } catch (err: any) {
    console.error('fsBulkPushAll error:', err);
    return { success: false, count: 0, error: err.message };
  }
}

// 14. Bulk Pull all Data from Firestore
export async function fsBulkPullAll(): Promise<{
  success: boolean;
  citizens: Citizen[];
  requests: OfficeRequest[];
  interviews: Interview[];
  officialLetters: OfficialLetter[];
  cheques: ChequeRecord[];
  organizationRecords: OrganizationRecord[];
  users: User[];
  customSections: CustomSection[];
  customRecords: CustomSectionRecord[];
  systemSettings?: Partial<SystemSettings>;
  developerPasscode?: string;
  error?: string;
}> {
  try {
    const fetchCol = async <T>(colName: string): Promise<T[]> => {
      const snap = await getDocs(collection(db, colName));
      return snap.docs.map(d => d.data() as T);
    };

    const colCitizens = getFSCol(FS_COLLECTIONS.CITIZENS);
    const colRequests = getFSCol(FS_COLLECTIONS.REQUESTS);
    const colInterviews = getFSCol(FS_COLLECTIONS.INTERVIEWS);
    const colLetters = getFSCol(FS_COLLECTIONS.LETTERS);
    const colCheques = getFSCol(FS_COLLECTIONS.CHEQUES);
    const colOrgs = getFSCol(FS_COLLECTIONS.ORGANIZATIONS);
    const colUsers = getFSCol(FS_COLLECTIONS.USERS);
    const colSections = getFSCol(FS_COLLECTIONS.CUSTOM_SECTIONS);
    const colRecords = getFSCol(FS_COLLECTIONS.CUSTOM_RECORDS);
    const colSettings = getFSCol(FS_COLLECTIONS.SETTINGS);
    const colDeleted = getFSCol(FS_COLLECTIONS.DELETED_RECORDS);

    const [
      rawCitizens,
      rawRequests,
      rawInterviews,
      rawOfficialLetters,
      rawCheques,
      rawOrganizationRecords,
      users,
      rawCustomSections,
      rawCustomRecords,
      deletedDocsSnap,
      settingsSnap,
      passcodeSnap
    ] = await Promise.all([
      fetchCol<Citizen>(colCitizens),
      fetchCol<OfficeRequest>(colRequests),
      fetchCol<Interview>(colInterviews),
      fetchCol<OfficialLetter>(colLetters),
      fetchCol<ChequeRecord>(colCheques),
      fetchCol<OrganizationRecord>(colOrgs),
      fetchCol<User>(colUsers),
      fetchCol<CustomSection>(colSections),
      fetchCol<CustomSectionRecord>(colRecords),
      getDocs(collection(db, colDeleted)).catch(() => null),
      getDoc(doc(db, colSettings, 'general')).catch(() => null),
      getDoc(doc(db, colSettings, 'developer_auth')).catch(() => null)
    ]);

    const deletedIds = new Set<string>();
    if (deletedDocsSnap && !deletedDocsSnap.empty) {
      deletedDocsSnap.docs.forEach(d => {
        deletedIds.add(d.id);
        const data = d.data();
        if (data?.id) deletedIds.add(String(data.id));
      });
    }

    // Strictly filter out any permanently deleted records
    const citizens = rawCitizens.filter(c => c && c.Citizen_ID && !deletedIds.has(c.Citizen_ID));
    const requests = rawRequests.filter(r => r && r.Request_ID && !deletedIds.has(r.Request_ID) && !deletedIds.has(r.Citizen_ID));
    const interviews = rawInterviews.filter(i => i && i.Interview_ID && !deletedIds.has(i.Interview_ID) && !deletedIds.has(i.Citizen_ID));
    const officialLetters = rawOfficialLetters.filter(l => l && l.Letter_ID && !deletedIds.has(l.Letter_ID) && (!l.Citizen_ID || !deletedIds.has(l.Citizen_ID)));
    const cheques = rawCheques.filter(ch => ch && ch.id && !deletedIds.has(ch.id) && !deletedIds.has(ch.Citizen_ID));
    const organizationRecords = rawOrganizationRecords.filter(o => o && o.Org_ID && !deletedIds.has(o.Org_ID) && !deletedIds.has(o.Citizen_ID));
    const customSections = rawCustomSections.filter(s => s && s.id && !deletedIds.has(s.id));
    const customRecords = rawCustomRecords.filter(cr => cr && cr.id && !deletedIds.has(cr.id) && !deletedIds.has(cr.sectionId));

    const systemSettings = settingsSnap && settingsSnap.exists() ? (settingsSnap.data() as Partial<SystemSettings>) : undefined;
    const developerPasscode = passcodeSnap && passcodeSnap.exists() ? (passcodeSnap.data()?.developerPasscode as string) : undefined;

    return {
      success: true,
      citizens,
      requests,
      interviews,
      officialLetters,
      cheques,
      organizationRecords,
      users,
      customSections,
      customRecords,
      systemSettings,
      developerPasscode
    };
  } catch (err: any) {
    console.error('fsBulkPullAll error:', err);
    return {
      success: false,
      citizens: [],
      requests: [],
      interviews: [],
      officialLetters: [],
      cheques: [],
      organizationRecords: [],
      users: [],
      customSections: [],
      customRecords: [],
      error: err.message
    };
  }
}

// 15. Realtime Collection Watcher
export function fsWatchCollection<T>(
  colName: string, 
  onData: (items: T[]) => void, 
  onError?: (err: Error) => void
): Unsubscribe {
  const dynamicCol = getFSCol(colName);
  return onSnapshot(
    collection(db, dynamicCol),
    (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as T);
      onData(list);
    },
    (err) => {
      console.warn(`Firestore onSnapshot warn [${dynamicCol}]:`, err.message);
      if (onError) onError(err);
    }
  );
}
