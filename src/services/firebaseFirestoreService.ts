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
  CustomSectionRecord,
  UrgentNotification
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

// Hard project-level block detector (ONLY for fatal API-disabled / CONSUMER_INVALID errors during bulk loops;
// NEVER blocks normal single-record user writes like adding a citizen or request!)
let _firestoreHardBlockedUntil = 0;

export function isFirestoreTemporarilyBlocked(): boolean {
  return Date.now() < _firestoreHardBlockedUntil;
}

export function resetFirestoreCircuitBreaker(): void {
  _firestoreHardBlockedUntil = 0;
}

function noteFirestoreFailure(error: unknown): void {
  const msg = error instanceof Error ? error.message : String(error || '');
  // Only trip cooldown on project-disabled / consumer-invalid errors, NOT on transient offline or single-doc validation errors
  if (msg.includes('CONSUMER_INVALID') || msg.includes('SERVICE_DISABLED')) {
    _firestoreHardBlockedUntil = Date.now() + 2 * 60 * 1000;
  }
}

export function sanitizeFirestoreDocId(rawId: string, prefix = 'DOC'): string {
  const trimmed = String(rawId || '').trim();
  if (/^[a-zA-Z0-9_.-]{1,128}$/.test(trimmed)) return trimmed;
  const cleaned = trimmed.replace(/[^a-zA-Z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 96);
  if (cleaned.length >= 2) return cleaned;
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) - hash) + trimmed.charCodeAt(i);
    hash |= 0;
  }
  return `${prefix}_${(hash >>> 0).toString(36)}_${Date.now().toString(36)}`;
}

function clipStr(val: any, maxLen: number): string | undefined {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function stripUndefinedProps(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? stripUndefinedProps(item)
          : item
      );
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      out[k] = stripUndefinedProps(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function sanitizeCitizenForFirestore(citizen: Citizen): Citizen & { updatedAt: string; UpdatedAt: string } {
  const safeId = sanitizeFirestoreDocId(citizen.Citizen_ID, 'ONA');
  const fullName = clipStr(citizen.FullName, 250) || 'مراجع';
  const nowIso = new Date().toISOString();
  const copy: any = {
    ...citizen,
    Citizen_ID: safeId,
    FullName: fullName,
    Phone1: clipStr(citizen.Phone1, 50) ?? '',
    Rating: clipStr(citizen.Rating, 50) || 'مؤيد',
    District: clipStr(citizen.District, 100) || 'الناصرية',
    SubDistrict: clipStr(citizen.SubDistrict, 100) || 'المركز',
    CreatedAt: clipStr(citizen.CreatedAt, 100) || nowIso.split('T')[0],
    UpdatedAt: nowIso,
    updatedAt: nowIso
  };
  // Explicitly clear block fields in Firestore when unblocked (instead of passing undefined which Firestore rejects)
  if (citizen.IsBlocked === false) {
    copy.IsBlocked = false;
    copy.BlockReason = '';
    copy.BlockedAt = '';
    copy.BlockedBy = '';
  }
  // Prevent oversized base64 images from exceeding Firestore's 1MB document limit
  if (typeof copy.PhotoUrl === 'string' && copy.PhotoUrl.length > 250000) {
    delete copy.PhotoUrl;
  }
  return stripUndefinedProps(copy) as Citizen & { updatedAt: string; UpdatedAt: string };
}

export function sanitizeRequestForFirestore(req: OfficeRequest): OfficeRequest & { updatedAt: string; UpdatedAt: string } {
  const safeReqId = sanitizeFirestoreDocId(req.Request_ID, 'REQ');
  const safeCitId = sanitizeFirestoreDocId(req.Citizen_ID, 'ONA');
  const nowIso = new Date().toISOString();
  const copy: any = {
    ...req,
    Request_ID: safeReqId,
    Citizen_ID: safeCitId,
    Entity: clipStr(req.Entity, 200) || 'غير محدد',
    RequestStatus: clipStr(req.RequestStatus, 50) || 'مستلم',
    ProcessingStatus: clipStr(req.ProcessingStatus, 50) || 'قيد التدقيق',
    Priority: clipStr(req.Priority, 50) || 'عام',
    Details: clipStr(req.Details, 10000) ?? '',
    UpdatedAt: nowIso,
    updatedAt: nowIso
  };
  // Strip large inline base64 attachments that exceed Firestore's 1MB document limit
  if (typeof copy.AttachedRequestImage === 'string' && copy.AttachedRequestImage.length > 250000) {
    delete copy.AttachedRequestImage;
  }
  if (Array.isArray(copy.ScanAttachments)) {
    copy.ScanAttachments = copy.ScanAttachments.map((att: any) => {
      if (att && typeof att.url === 'string' && att.url.length > 250000) {
        return { ...att, url: '' };
      }
      return att;
    });
  }
  return stripUndefinedProps(copy) as OfficeRequest & { updatedAt: string; UpdatedAt: string };
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
  DELETED_RECORDS: 'deleted_records',
  NOTIFICATIONS: 'notifications'
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
  const clean = sanitizeCitizenForFirestore(citizen);
  const col = getFSCol(FS_COLLECTIONS.CITIZENS);
  const path = `${col}/${clean.Citizen_ID}`;
  try {
    await setDoc(doc(db, col, clean.Citizen_ID), clean, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteCitizen(citizenId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(citizenId, 'ONA');
  const col = getFSCol(FS_COLLECTIONS.CITIZENS);
  const path = `${col}/${safeId}`;
  try {
    await deleteDoc(doc(db, col, safeId));
    await fsRegisterDeletedRecord(safeId, 'citizens');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 2. Request Operations
export async function fsSaveRequest(req: OfficeRequest): Promise<void> {
  const clean = sanitizeRequestForFirestore(req);
  const col = getFSCol(FS_COLLECTIONS.REQUESTS);
  const path = `${col}/${clean.Request_ID}`;
  try {
    await setDoc(doc(db, col, clean.Request_ID), clean, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteRequest(requestId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(requestId, 'REQ');
  const col = getFSCol(FS_COLLECTIONS.REQUESTS);
  const path = `${col}/${safeId}`;
  try {
    await deleteDoc(doc(db, col, safeId));
    await fsRegisterDeletedRecord(safeId, 'requests');
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 2b. High-Speed Batched Save for Excel Filter/Import (writeBatch chunks of 300 docs — fast & rules-safe)
export async function fsBulkSaveCitizensAndRequests(
  citizensList: Citizen[],
  requestsList: OfficeRequest[]
): Promise<{ success: boolean; savedCitizens: number; savedRequests: number; error?: string }> {
  if (isFirestoreTemporarilyBlocked()) {
    return { success: false, savedCitizens: 0, savedRequests: 0, error: 'Firestore temporarily unavailable' };
  }
  const colCitizens = getFSCol(FS_COLLECTIONS.CITIZENS);
  const colRequests = getFSCol(FS_COLLECTIONS.REQUESTS);
  const entries: Array<{ col: string; id: string; data: any; kind: 'citizen' | 'request' }> = [];

  for (const c of citizensList || []) {
    if (!c || !c.Citizen_ID) continue;
    const clean = sanitizeCitizenForFirestore(c);
    entries.push({ col: colCitizens, id: clean.Citizen_ID, data: clean, kind: 'citizen' });
  }
  for (const r of requestsList || []) {
    if (!r || !r.Request_ID || !r.Citizen_ID) continue;
    const clean = sanitizeRequestForFirestore(r);
    entries.push({ col: colRequests, id: clean.Request_ID, data: clean, kind: 'request' });
  }

  let savedCitizens = 0;
  let savedRequests = 0;
  let lastError: string | undefined;
  const CHUNK_SIZE = 300;

  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    if (isFirestoreTemporarilyBlocked()) break;
    const slice = entries.slice(i, i + CHUNK_SIZE);
    try {
      const batch = writeBatch(db);
      for (const entry of slice) {
        batch.set(doc(db, entry.col, entry.id), entry.data, { merge: true });
      }
      await withTimeout(batch.commit(), 15000, 'Firestore batch import commit');
      for (const entry of slice) {
        if (entry.kind === 'citizen') savedCitizens++;
        else savedRequests++;
      }
    } catch (batchErr: any) {
      noteFirestoreFailure(batchErr);
      lastError = batchErr?.message || String(batchErr);
      if (isFirestoreTemporarilyBlocked()) break;
      // Fallback: save chunk in smaller sub-batches of 25 so 1 problematic doc never drops 299 valid docs
      for (const entry of slice) {
        try {
          await setDoc(doc(db, entry.col, entry.id), entry.data, { merge: true });
          if (entry.kind === 'citizen') savedCitizens++;
          else savedRequests++;
        } catch (singleErr: any) {
          noteFirestoreFailure(singleErr);
          lastError = singleErr?.message || String(singleErr);
          if (isFirestoreTemporarilyBlocked()) break;
        }
      }
    }
  }

  return {
    success: savedCitizens + savedRequests > 0 || entries.length === 0,
    savedCitizens,
    savedRequests,
    error: lastError
  };
}

// 3. Interview Operations
export async function fsSaveInterview(interview: Interview): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.INTERVIEWS);
  const path = `${col}/${interview.Interview_ID}`;
  const nowIso = new Date().toISOString();
  try {
    await setDoc(doc(db, col, interview.Interview_ID), stripUndefinedProps({
      ...interview,
      UpdatedAt: nowIso,
      updatedAt: nowIso
    }), { merge: true });
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
  const nowIso = new Date().toISOString();
  try {
    await setDoc(doc(db, col, letter.Letter_ID), stripUndefinedProps({
      ...letter,
      UpdatedAt: nowIso,
      updatedAt: nowIso
    }), { merge: true });
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
  const nowIso = new Date().toISOString();
  try {
    await setDoc(doc(db, col, cheque.id), stripUndefinedProps({
      ...cheque,
      UpdatedAt: nowIso,
      updatedAt: nowIso
    }), { merge: true });
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
  const safeId = sanitizeFirestoreDocId(record.Org_ID || record.Citizen_ID, 'ORG');
  const path = `${col}/${safeId}`;
  const nowIso = new Date().toISOString();
  try {
    await setDoc(doc(db, col, safeId), stripUndefinedProps({
      ...record,
      Org_ID: safeId,
      UpdatedAt: nowIso,
      updatedAt: nowIso
    }), { merge: true });
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
const stripUndefinedAndOversizedDeep = (input: any): any => {
  if (input === null || input === undefined) return null;
  if (typeof input === 'string') {
    // Prevent huge inline base64 strings (>180KB) from breaking Firestore's 1MB doc limit on settings/general
    if (input.length > 180000 && input.startsWith('data:image/')) {
      return '/office-logo.png';
    }
    return input;
  }
  if (Array.isArray(input)) {
    return input.filter((v) => v !== undefined).map(stripUndefinedAndOversizedDeep);
  }
  if (typeof input === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedAndOversizedDeep(v);
    }
    return out;
  }
  return input;
};

export async function fsSaveSettings(settings: Partial<SystemSettings>): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.SETTINGS);
  const nowIso = new Date().toISOString();

  // Always save critical cloud linkage & live outgoing counter fields to a tiny dedicated document (<2 KB)
  // so Drive Folder ID / Sheet ID / Outgoing Counters / Logo NEVER fail Firestore's 1MB document limit!
  const cloudPatch: Record<string, any> = { updatedAt: nowIso, UpdatedAt: nowIso };
  if (settings.googleDriveFolderId) cloudPatch.googleDriveFolderId = settings.googleDriveFolderId;
  if (settings.googleSheetId) cloudPatch.googleSheetId = settings.googleSheetId;
  if (settings.activeGoogleSheetId) cloudPatch.activeGoogleSheetId = settings.activeGoogleSheetId;
  if (settings.appsScriptUrl) cloudPatch.appsScriptUrl = settings.appsScriptUrl;
  if (settings.googleAppsScriptUrl) cloudPatch.googleAppsScriptUrl = settings.googleAppsScriptUrl;
  if (typeof settings.allowAdminOpenDriveFolder === 'boolean') {
    cloudPatch.allowAdminOpenDriveFolder = settings.allowAdminOpenDriveFolder;
  }
  if (typeof settings.lastOutgoingNumberNasiriyah === 'number') {
    cloudPatch.lastOutgoingNumberNasiriyah = settings.lastOutgoingNumberNasiriyah;
  }
  if (typeof settings.lastOutgoingNumberSuq === 'number') {
    cloudPatch.lastOutgoingNumberSuq = settings.lastOutgoingNumberSuq;
  }
  if (settings.outgoingBaselineSetAt) {
    cloudPatch.outgoingBaselineSetAt = settings.outgoingBaselineSetAt;
  }
  if (settings.outgoingBaselineLabel) {
    cloudPatch.outgoingBaselineLabel = settings.outgoingBaselineLabel;
  }
  if (settings.officeName) cloudPatch.officeName = settings.officeName;
  if (settings.deputyName) cloudPatch.deputyName = settings.deputyName;
  if (settings.logoUrl && settings.logoUrl.length < 180000) cloudPatch.logoUrl = settings.logoUrl;

  if (Object.keys(cloudPatch).length > 2) {
    try {
      await setDoc(doc(db, col, 'cloud_config'), cloudPatch, { merge: true });
    } catch (cloudErr) {
      console.warn('Firestore cloud_config save warn:', cloudErr);
    }
  }

  const path = `${col}/general`;
  try {
    const cleanPayload = stripUndefinedAndOversizedDeep({
      ...settings,
      UpdatedAt: nowIso,
      updatedAt: nowIso
    });
    await setDoc(doc(db, col, 'general'), cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function fsWatchCloudConfig(
  callback: (cfg: {
    googleDriveFolderId?: string;
    googleSheetId?: string;
    activeGoogleSheetId?: string;
    appsScriptUrl?: string;
    googleAppsScriptUrl?: string;
    allowAdminOpenDriveFolder?: boolean;
    lastOutgoingNumberNasiriyah?: number;
    lastOutgoingNumberSuq?: number;
    outgoingBaselineSetAt?: string;
    outgoingBaselineLabel?: string;
    officeName?: string;
    deputyName?: string;
    logoUrl?: string;
  }) => void
): () => void {
  if (isFirestoreTemporarilyBlocked()) return () => {};
  try {
    const col = getFSCol(FS_COLLECTIONS.SETTINGS);
    return onSnapshot(
      doc(db, col, 'cloud_config'),
      (snap) => {
        if (snap.exists()) {
          callback(snap.data() as any);
        }
      },
      (err) => {
        noteFirestoreFailure(err);
      }
    );
  } catch {
    return () => {};
  }
}

export async function fsGetSettings(): Promise<Partial<SystemSettings> | null> {
  const col = getFSCol(FS_COLLECTIONS.SETTINGS);
  try {
    const [generalSnap, cloudSnap] = await Promise.all([
      getDoc(doc(db, col, 'general')),
      getDoc(doc(db, col, 'cloud_config'))
    ]);
    const generalData = generalSnap.exists() ? (generalSnap.data() as Partial<SystemSettings>) : {};
    const cloudData = cloudSnap.exists() ? (cloudSnap.data() as Partial<SystemSettings>) : {};
    const merged = { ...generalData, ...cloudData };
    return Object.keys(merged).length > 0 ? merged : null;
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

// 12.1 Notifications Operations (Real-Time Multi-Device Alerts)
export async function fsSaveNotification(notif: UrgentNotification): Promise<void> {
  if (!notif || !notif.id || isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.NOTIFICATIONS);
  const safeId = sanitizeFirestoreDocId(notif.id, 'NOTIF');
  const payload: UrgentNotification = {
    id: safeId,
    title: clipStr(notif.title, 300) || 'تنبيه إداري',
    message: clipStr(notif.message, 2000) || '',
    timestamp: clipStr(notif.timestamp, 100) || 'الآن',
    createdAtIso: clipStr(notif.createdAtIso, 60) || new Date().toISOString(),
    type: (clipStr(notif.type, 60) as UrgentNotification['type']) || 'system',
    category: (clipStr(notif.category, 60) as UrgentNotification['category']) || 'system',
    priority: (clipStr(notif.priority, 30) as UrgentNotification['priority']) || 'normal',
    linkSection: clipStr(notif.linkSection, 100) || 'dashboard',
    ...(notif.entityId ? { entityId: clipStr(notif.entityId, 128) } : {}),
    ...(notif.createdBy ? { createdBy: clipStr(notif.createdBy, 200) } : {}),
    ...(Array.isArray(notif.targetRoles) ? { targetRoles: notif.targetRoles.slice(0, 30) } : {}),
    read: Boolean(notif.read)
  };
  try {
    await setDoc(doc(db, col, safeId), payload, { merge: true });
  } catch (error) {
    console.warn('Firestore save notification notice:', error);
  }
}

export async function fsMarkNotificationRead(id: string, read = true): Promise<void> {
  if (!id || isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.NOTIFICATIONS);
  const safeId = sanitizeFirestoreDocId(id, 'NOTIF');
  try {
    await setDoc(doc(db, col, safeId), { id: safeId, read: Boolean(read) }, { merge: true });
  } catch (error) {
    console.warn('Firestore mark notification read notice:', error);
  }
}

export async function fsDeleteNotification(id: string): Promise<void> {
  if (!id || isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.NOTIFICATIONS);
  const safeId = sanitizeFirestoreDocId(id, 'NOTIF');
  try {
    await deleteDoc(doc(db, col, safeId));
  } catch (error) {
    console.warn('Firestore delete notification notice:', error);
  }
}

// 13. Bulk Upload all System State to Firestore (with strict per-record sanitization so 1 bad doc never breaks a batch)
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
    const BATCH_SIZE = 200;
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

    (data.citizens || []).forEach(c => {
      if (!c || !c.Citizen_ID || !c.FullName) return;
      const clean = sanitizeCitizenForFirestore(c);
      items.push({ col: colCitizens, id: clean.Citizen_ID, docData: clean });
    });
    (data.requests || []).forEach(r => {
      if (!r || !r.Request_ID || !r.Citizen_ID) return;
      const clean = sanitizeRequestForFirestore(r);
      items.push({ col: colRequests, id: clean.Request_ID, docData: clean });
    });
    (data.interviews || []).forEach(i => {
      if (!i || !i.Interview_ID || !i.Citizen_ID) return;
      const safeId = sanitizeFirestoreDocId(i.Interview_ID, 'INT');
      const safeCitId = sanitizeFirestoreDocId(i.Citizen_ID, 'ONA');
      items.push({ col: colInterviews, id: safeId, docData: { ...i, Interview_ID: safeId, Citizen_ID: safeCitId } });
    });
    (data.officialLetters || []).forEach(l => {
      if (!l || !l.Letter_ID) return;
      const safeId = sanitizeFirestoreDocId(l.Letter_ID, 'LET');
      items.push({ col: colLetters, id: safeId, docData: { ...l, Letter_ID: safeId } });
    });
    (data.cheques || []).forEach(ch => {
      if (!ch || !ch.id || !ch.Citizen_ID) return;
      const safeId = sanitizeFirestoreDocId(ch.id, 'CHQ');
      items.push({ col: colCheques, id: safeId, docData: { ...ch, id: safeId } });
    });
    (data.organizationRecords || []).forEach(o => {
      if (!o || !o.Citizen_ID) return;
      const safeId = sanitizeFirestoreDocId(o.Org_ID || o.Citizen_ID, 'ORG');
      items.push({ col: colOrgs, id: safeId, docData: { ...o, Org_ID: safeId } });
    });
    (data.users || []).forEach(u => {
      if (!u || !u.User_ID || !u.Username || !u.FullName) return;
      const safeId = sanitizeFirestoreDocId(u.User_ID, 'USR');
      items.push({ col: colUsers, id: safeId, docData: { ...u, User_ID: safeId } });
    });
    (data.customSections || []).forEach(s => {
      if (!s || !s.id || !s.title) return;
      const safeId = sanitizeFirestoreDocId(s.id, 'SEC');
      items.push({ col: colSections, id: safeId, docData: { ...s, id: safeId } });
    });
    (data.customRecords || []).forEach(cr => {
      if (!cr || !cr.id || !cr.sectionId) return;
      const safeId = sanitizeFirestoreDocId(cr.id, 'REC');
      items.push({ col: colRecords, id: safeId, docData: { ...cr, id: safeId } });
    });
    (data.dropdowns || []).forEach(dd => {
      if (!dd || !dd.Category || !dd.ItemValue) return;
      const safeId = buildSafeDropdownDocId(dd.Category, dd.ItemValue, dd.id);
      items.push({ col: colDropdowns, id: safeId, docData: { id: safeId, Category: dd.Category, ItemValue: dd.ItemValue } });
    });

    if (data.systemSettings) {
      items.push({ col: colSettings, id: 'general', docData: data.systemSettings });
      if (data.systemSettings.developerPasscode) {
        items.push({
          col: colSettings,
          id: 'developer_auth',
          docData: { developerPasscode: data.systemSettings.developerPasscode }
        });
      }
    }

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const slice = items.slice(i, i + BATCH_SIZE);
      try {
        const batch = writeBatch(db);
        slice.forEach(item => {
          batch.set(doc(db, item.col, item.id), item.docData, { merge: true });
        });
        await batch.commit();
        total += slice.length;
      } catch (batchErr) {
        // Fallback: commit individually so one rejected doc never blocks valid records
        for (const item of slice) {
          try {
            await setDoc(doc(db, item.col, item.id), item.docData, { merge: true });
            total++;
          } catch {}
        }
      }
    }

    return { success: true, count: total };
  } catch (err: any) {
    console.error('fsBulkPushAll error:', err);
    return { success: false, count: 0, error: err.message };
  }
}

// 14. Bulk Pull all Data from Firestore (Server-First so Vercel & fresh browsers ALWAYS see latest cloud data!)
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
  notifications: UrgentNotification[];
  deletedIds: string[];
  systemSettings?: Partial<SystemSettings>;
  developerPasscode?: string;
  error?: string;
}> {
  try {
    const fetchCol = async <T>(colName: string): Promise<T[]> => {
      try {
        try {
          const snap = await withTimeout(getDocsFromServer(collection(db, colName)), 12000, `serverPull(${colName})`);
          return snap.docs.map(d => d.data() as T);
        } catch {
          const snap = await withTimeout(getDocs(collection(db, colName)), 8000, `cachePull(${colName})`);
          return snap.docs.map(d => d.data() as T);
        }
      } catch {
        return [];
      }
    };

    const fetchDocSafe = async (colName: string, docId: string) => {
      try {
        try {
          return await withTimeout(getDocFromServer(doc(db, colName, docId)), 10000, `serverDoc(${colName}/${docId})`);
        } catch {
          return await withTimeout(getDoc(doc(db, colName, docId)), 6000, `cacheDoc(${colName}/${docId})`);
        }
      } catch {
        return null;
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
    const colNotifications = getFSCol(FS_COLLECTIONS.NOTIFICATIONS);

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
      rawNotifications,
      rawDeletedDocs,
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
      fetchCol<DropdownItem>(colDropdowns),
      fetchCol<UrgentNotification>(colNotifications),
      fetchCol<any>(colDeleted),
      fetchDocSafe(colSettings, 'general'),
      fetchDocSafe(colSettings, 'developer_auth')
    ]);

    const deletedIdsSet = new Set<string>();
    rawDeletedDocs.forEach(d => {
      if (d?.id) deletedIdsSet.add(String(d.id));
    });

    const citizens = rawCitizens.filter(c => c && c.Citizen_ID && !deletedIdsSet.has(c.Citizen_ID));
    const requests = rawRequests.filter(r => r && r.Request_ID && !deletedIdsSet.has(r.Request_ID) && !deletedIdsSet.has(r.Citizen_ID));
    const interviews = rawInterviews.filter(i => i && i.Interview_ID && !deletedIdsSet.has(i.Interview_ID) && !deletedIdsSet.has(i.Citizen_ID));
    const officialLetters = rawOfficialLetters.filter(l => l && l.Letter_ID && !deletedIdsSet.has(l.Letter_ID) && (!l.Citizen_ID || !deletedIdsSet.has(l.Citizen_ID)));
    const cheques = rawCheques.filter(ch => ch && ch.id && !deletedIdsSet.has(ch.id) && !deletedIdsSet.has(ch.Citizen_ID));
    const organizationRecords = rawOrganizationRecords.filter(o => o && (o.Org_ID || o.Citizen_ID) && !deletedIdsSet.has(o.Org_ID || '') && !deletedIdsSet.has(o.Citizen_ID));
    const users = rawUsers.filter(u => u && u.User_ID && !deletedIdsSet.has(u.User_ID));
    const customSections = rawCustomSections.filter(s => s && s.id && !deletedIdsSet.has(s.id));
    const customRecords = rawCustomRecords.filter(cr => cr && cr.id && !deletedIdsSet.has(cr.id) && !deletedIdsSet.has(cr.sectionId));
    const notifications = rawNotifications
      .filter(n => n && n.id && n.title)
      .sort((a, b) => Date.parse(b.createdAtIso || '') - Date.parse(a.createdAtIso || ''));

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
      notifications,
      deletedIds: Array.from(deletedIdsSet),
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
      notifications: [],
      deletedIds: [],
      error: err.message
    };
  }
}

// 15. Realtime Collection Watcher (emits full snapshot list AND explicitly removed doc IDs for instant deletion sync)
export function fsWatchCollection<T>(
  colName: string, 
  onData: (items: T[], removedIds: string[]) => void, 
  onError?: (err: Error) => void
): Unsubscribe {
  const dynamicCol = getFSCol(colName);
  try {
    return onSnapshot(
      collection(db, dynamicCol),
      (snapshot) => {
        const list = snapshot.docs.map(d => d.data() as T);
        const removedIds = snapshot
          .docChanges()
          .filter(change => change.type === 'removed')
          .map(change => change.doc.id)
          .filter(Boolean);
        onData(list, removedIds);
      },
      (err) => {
        // Never throw uncaught errors or trip global write circuit-breaker from a listener warning
        console.warn(`Firestore watcher notice (${dynamicCol}):`, err?.message || err);
        if (onError) onError(err);
      }
    );
  } catch (setupErr: any) {
    if (onError) onError(setupErr);
    return () => {};
  }
}

// 16. Realtime Tombstone Watcher (propagates deleted record IDs across all browsers/computers instantaneously)
export function fsWatchDeletedRecords(
  onDeletedIds: (deletedIds: string[]) => void
): Unsubscribe {
  const dynamicCol = getFSCol(FS_COLLECTIONS.DELETED_RECORDS);
  try {
    return onSnapshot(
      collection(db, dynamicCol),
      (snapshot) => {
        const ids: string[] = [];
        snapshot.docs.forEach(d => {
          const data = d.data();
          if (data?.id) ids.push(String(data.id).trim());
          else if (d.id) ids.push(String(d.id).trim());
        });
        if (ids.length > 0) {
          onDeletedIds(ids);
        }
      },
      (err) => {
        console.warn('Firestore deleted_records watcher notice:', err?.message || err);
      }
    );
  } catch {
    return () => {};
  }
}

