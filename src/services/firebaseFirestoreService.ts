import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDocsFromServer,
  getDoc,
  getDocFromServer,
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

// Session circuit-breaker: prevents flooding 1,000+ failing Firestore requests during bulk imports
// when the Firestore backend rejects writes with PERMISSION_DENIED / CONSUMER_INVALID.
let _firestoreBlockedUntil = 0;

export function isFirestoreTemporarilyBlocked(): boolean {
  return Date.now() < _firestoreBlockedUntil;
}

export function resetFirestoreCircuitBreaker(): void {
  _firestoreBlockedUntil = 0;
}

function noteFirestoreFailure(error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error || '');
  if (
    msg.includes('permission-denied') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('CONSUMER_INVALID') ||
    msg.includes('unauthenticated') ||
    msg.includes('Failed to get document because the client is offline')
  ) {
    _firestoreBlockedUntil = Date.now() + 5 * 60 * 1000; // 5 minutes cooldown
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  noteFirestoreFailure(error);
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
  console.warn('Firestore Notice:', errInfo.error, path);
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
  if (!id || isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.DELETED_RECORDS);
  try {
    await setDoc(doc(db, col, id), {
      id,
      entityType,
      deletedAt: new Date().toISOString()
    });
  } catch (e) {
    noteFirestoreFailure(e);
  }
}

export async function fsGetDeletedRecordIds(): Promise<string[]> {
  if (isFirestoreTemporarilyBlocked()) return [];
  try {
    const col = getFSCol(FS_COLLECTIONS.DELETED_RECORDS);
    const snap = await getDocs(collection(db, col));
    return snap.docs.map(d => d.id);
  } catch (e) {
    noteFirestoreFailure(e);
    return [];
  }
}

// 1. Citizen Operations
export async function fsSaveCitizen(citizen: Citizen): Promise<void> {
  if (isFirestoreTemporarilyBlocked()) return;
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
  if (isFirestoreTemporarilyBlocked()) return;
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
  if (isFirestoreTemporarilyBlocked()) return;
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
  if (isFirestoreTemporarilyBlocked()) return;
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
  ]);
}

function sanitizeUserPayload(user: User): User {
  const safeId = /^[a-zA-Z0-9_.-]+$/.test(String(user.User_ID || '').trim())
    ? String(user.User_ID).trim()
    : `USR-${Date.now().toString(36).toUpperCase()}`;
  return {
    ...user,
    User_ID: safeId,
    Username: String(user.Username || safeId).trim(),
    Password: user.Password !== undefined ? String(user.Password).trim() : '',
    FullName: String(user.FullName || user.Username || 'موظف').trim(),
    Role: (user.Role || 'reception') as User['Role'],
    RoleArabic: String(user.RoleArabic || user.Department || 'موظف').trim(),
    Department: String(user.Department || '').trim(),
    JobTitle: String(user.JobTitle || '').trim(),
    Status: user.Status === 'frozen' ? 'frozen' : 'active',
    Permissions: Array.isArray(user.Permissions) ? user.Permissions.map(p => String(p).trim()).filter(Boolean) : [],
    AllowedSections: Array.isArray(user.AllowedSections) ? user.AllowedSections.map(s => String(s).trim()).filter(Boolean) : [],
    CreatedAt: user.CreatedAt || new Date().toISOString().split('T')[0],
    UpdatedAt: user.UpdatedAt || new Date().toISOString()
  };
}

// 7. Users / Staff Operations
export async function fsSaveUser(user: User): Promise<void> {
  const cleanUser = sanitizeUserPayload(user);
  const col = getFSCol(FS_COLLECTIONS.USERS);
  const path = `${col}/${cleanUser.User_ID}`;
  try {
    await withTimeout(
      setDoc(doc(db, col, cleanUser.User_ID), cleanUser, { merge: true }),
      6000,
      'Firestore user save'
    );
    // Also mirror to root 'users' collection if partitioned so shared links always resolve the account
    if (col !== 'users') {
      await withTimeout(
        setDoc(doc(db, 'users', cleanUser.User_ID), cleanUser, { merge: true }),
        4000,
        'Firestore root user mirror'
      ).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsSyncAllUsers(usersList: User[]): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const col = getFSCol(FS_COLLECTIONS.USERS);
    const validUsers = (usersList || []).filter(u => u && u.User_ID && u.Username).map(sanitizeUserPayload);
    if (validUsers.length === 0) return { success: true, count: 0 };
    const batch = writeBatch(db);
    validUsers.forEach(u => {
      batch.set(doc(db, col, u.User_ID), u, { merge: true });
      if (col !== 'users') {
        batch.set(doc(db, 'users', u.User_ID), u, { merge: true });
      }
    });
    await withTimeout(batch.commit(), 8000, 'Firestore users batch sync');
    return { success: true, count: validUsers.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || String(err) };
  }
}

export async function fsCheckConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    await withTimeout(getDocFromServer(doc(db, 'test', 'connection')), 4000, 'Firestore connection test');
    return { connected: true };
  } catch (err: any) {
    const msg = err?.message || String(err);
    return { connected: false, error: msg };
  }
}

export async function fsDeleteUser(userId: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.USERS);
  const path = `${col}/${userId}`;
  try {
    await withTimeout(deleteDoc(doc(db, col, userId)), 6000, 'Firestore user delete');
    if (col !== 'users') {
      await deleteDoc(doc(db, 'users', userId)).catch(() => {});
    }
    await fsRegisterDeletedRecord(userId, 'users');
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

/**
 * Realtime verification of login credentials against Firebase Firestore.
 * Uses server-first reads (getDocsFromServer) with cache fallback, supports Arabic normalization,
 * strictly distinguishes dual credentials (username + password) from single passcode mode,
 * and enforces frozen account status.
 */
export async function fsVerifyLogin(
  usernameOrCode: string,
  passwordOrPin?: string
): Promise<{ success: boolean; user?: User; isDeveloper?: boolean; frozen?: boolean; matchedSource?: 'firebase_passcode' | 'firebase_user' }> {
  try {
    const normalizeDigits = (val: string) =>
      (val || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim();
    const normalizeName = (val: string) =>
      normalizeDigits(val)
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .toLowerCase();

    const rawCode = normalizeDigits(passwordOrPin || usernameOrCode || '');
    const cleanUser = normalizeName(usernameOrCode || '');
    const cleanPass = normalizeDigits(passwordOrPin || '');
    const isDualMode = Boolean(cleanUser && cleanPass && cleanUser !== normalizeName(cleanPass));

    const fetchUsersCollectionFresh = async (colName: string): Promise<User[]> => {
      try {
        const snap = await withTimeout(getDocsFromServer(collection(db, colName)), 4500, `getDocsFromServer(${colName})`);
        return snap.docs.map(d => d.data() as User);
      } catch {
        try {
          const snap = await withTimeout(getDocs(collection(db, colName)), 3000, `getDocs(${colName})`);
          return snap.docs.map(d => d.data() as User);
        } catch {
          return [];
        }
      }
    };

    const matchInUserList = (list: User[]): { success: boolean; user?: User; isDeveloper?: boolean; frozen?: boolean; matchedSource?: 'firebase_user' } => {
      for (const u of list) {
        if (!u) continue;
        const uName = normalizeName(u.Username || '');
        const uId = normalizeName(u.User_ID || '');
        const uFull = normalizeName(u.FullName || '');
        const uPhone = normalizeDigits(u.Phone || '');
        const uPass = normalizeDigits(u.Password || '');

        if (isDualMode) {
          const userMatched =
            cleanUser === uName ||
            cleanUser === uId ||
            cleanUser === uFull ||
            (uPhone && cleanUser === uPhone);
          const passMatched = Boolean(cleanPass && uPass && cleanPass === uPass);
          if (userMatched && passMatched) {
            if (u.Status === 'frozen') return { success: false, frozen: true };
            return { success: true, user: u, isDeveloper: u.Role === 'developer', matchedSource: 'firebase_user' };
          }
        } else {
          if (rawCode && ((uPass && rawCode === uPass) || (uId && rawCode.toLowerCase() === uId))) {
            if (u.Status === 'frozen') return { success: false, frozen: true };
            return { success: true, user: u, isDeveloper: u.Role === 'developer', matchedSource: 'firebase_user' };
          }
        }
      }
      return { success: false };
    };

    // 1. Check Firestore users collection FIRST (so employee username+password always resolves accurately)
    const colUsers = getFSCol(FS_COLLECTIONS.USERS);
    const primaryUsers = await fetchUsersCollectionFresh(colUsers);
    const primaryMatch = matchInUserList(primaryUsers);
    if (primaryMatch.success || primaryMatch.frozen) return primaryMatch;

    // Also check root 'users' collection if partitioned
    if (colUsers !== 'users') {
      const baseUsers = await fetchUsersCollectionFresh('users');
      const baseMatch = matchInUserList(baseUsers);
      if (baseMatch.success || baseMatch.frozen) return baseMatch;
    }

    // 2. In single-passcode mode (or developer username), check developer passcode in settings
    if (!isDualMode || cleanUser === 'developer' || cleanUser === 'admin') {
      const colSettings = getFSCol(FS_COLLECTIONS.SETTINGS);
      try {
        const authSnap = await withTimeout(getDocFromServer(doc(db, colSettings, 'developer_auth')), 3500, 'developer_auth')
          .catch(() => getDoc(doc(db, colSettings, 'developer_auth')));
        if (authSnap.exists()) {
          const storedCode = normalizeDigits(String(authSnap.data()?.developerPasscode || ''));
          if (storedCode && (rawCode === storedCode || cleanPass === storedCode)) {
            return { success: true, isDeveloper: true, matchedSource: 'firebase_passcode' };
          }
        }
      } catch (e) {
        console.warn('fsVerifyLogin developer_auth check error:', e);
      }

      try {
        const genSnap = await withTimeout(getDocFromServer(doc(db, colSettings, 'general')), 3500, 'settings/general')
          .catch(() => getDoc(doc(db, colSettings, 'general')));
        if (genSnap.exists()) {
          const data = genSnap.data();
          const storedPass = normalizeDigits(String(data?.developerPasscode || data?.passcode || ''));
          if (storedPass && (rawCode === storedPass || cleanPass === storedPass)) {
            return { success: true, isDeveloper: true, matchedSource: 'firebase_passcode' };
          }
        }
      } catch (e) {
        console.warn('fsVerifyLogin general settings check error:', e);
      }
    }

    return { success: false };
  } catch (err) {
    console.warn('fsVerifyLogin general error:', err);
    return { success: false };
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

// Helper to build a deterministic ASCII-safe Firestore document ID for Arabic dropdown values
export function buildSafeDropdownDocId(category: string, value: string, existingId?: string): string {
  if (existingId && /^[a-zA-Z0-9_\-\.]+$/.test(existingId)) {
    return existingId;
  }
  const cleanCat = (category || 'cat').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'cat';
  let hash = 0;
  const raw = `${category}::${(value || '').trim().toLowerCase()}`;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  const unsignedHex = (hash >>> 0).toString(36);
  return `DD_${cleanCat}_${unsignedHex}_${raw.length}`;
}

// 11. Dropdown items
export async function fsSaveDropdown(dropdown: DropdownItem): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.DROPDOWNS);
  const docId = buildSafeDropdownDocId(dropdown.Category, dropdown.ItemValue, dropdown.id);
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

export async function fsDeleteDropdown(category: string, value: string, existingId?: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.DROPDOWNS);
  const docId = buildSafeDropdownDocId(category, value, existingId);
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
    const colDropdowns = getFSCol(FS_COLLECTIONS.DROPDOWNS);

    data.citizens.forEach(c => items.push({ col: colCitizens, id: c.Citizen_ID, docData: c }));
    data.requests.forEach(r => items.push({ col: colRequests, id: r.Request_ID, docData: r }));
    data.interviews.forEach(i => items.push({ col: colInterviews, id: i.Interview_ID, docData: i }));
    data.officialLetters.forEach(l => items.push({ col: colLetters, id: l.Letter_ID, docData: l }));
    data.cheques.forEach(ch => items.push({ col: colCheques, id: ch.id, docData: ch }));
    data.organizationRecords.forEach(o => items.push({ col: colOrgs, id: o.Org_ID || o.Citizen_ID, docData: o }));
    data.users.forEach(u => items.push({ col: colUsers, id: u.User_ID, docData: u }));
    data.customSections.forEach(s => items.push({ col: colSections, id: s.id, docData: s }));
    data.customRecords.forEach(cr => items.push({ col: colRecords, id: cr.id, docData: cr }));
    data.dropdowns.forEach(dd => {
      const safeId = buildSafeDropdownDocId(dd.Category, dd.ItemValue, dd.id);
      items.push({ col: colDropdowns, id: safeId, docData: { id: safeId, Category: dd.Category, ItemValue: dd.ItemValue } });
    });
    
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
  dropdowns: DropdownItem[];
  systemSettings?: Partial<SystemSettings>;
  developerPasscode?: string;
  error?: string;
}> {
  try {
    const fetchCol = async <T>(colName: string, preferServer = false): Promise<T[]> => {
      try {
        if (preferServer) {
          try {
            const snap = await withTimeout(getDocsFromServer(collection(db, colName)), 5000, `pull(${colName})`);
            return snap.docs.map(d => d.data() as T);
          } catch {}
        }
        const snap = await withTimeout(getDocs(collection(db, colName)), 4000, `getDocs(${colName})`);
        return snap.docs.map(d => d.data() as T);
      } catch {
        return [];
      }
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
    const colDropdowns = getFSCol(FS_COLLECTIONS.DROPDOWNS);
    const colSettings = getFSCol(FS_COLLECTIONS.SETTINGS);
    const colDeleted = getFSCol(FS_COLLECTIONS.DELETED_RECORDS);

    const [
      rawCitizens,
      rawRequests,
      rawInterviews,
      rawOfficialLetters,
      rawCheques,
      rawOrganizationRecords,
      rawUsers,
      rawCustomSections,
      rawCustomRecords,
      dropdowns,
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
      fetchCol<User>(colUsers, true),
      fetchCol<CustomSection>(colSections),
      fetchCol<CustomSectionRecord>(colRecords),
      fetchCol<DropdownItem>(colDropdowns),
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
    const users = rawUsers.filter(u => u && u.User_ID && !deletedIds.has(u.User_ID));
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
      dropdowns,
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
      dropdowns: [],
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
  try {
    return onSnapshot(
      collection(db, dynamicCol),
      (snapshot) => {
        const list = snapshot.docs.map(d => d.data() as T);
        onData(list);
      },
      (err) => {
        if (err.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.GET, dynamicCol);
        } else {
          if (onError) onError(err);
        }
      }
    );
  } catch (setupErr: any) {
    if (onError) onError(setupErr);
    return () => {};
  }
}
