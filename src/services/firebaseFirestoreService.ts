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
import { updateFirebaseHealth, pushCloudSyncAlert } from './cloudSyncAlerts';
import { resolveCanonicalUserRole, normalizeUserRecord } from '../utils/permissions';
import { cleanReferrerLabel, normalizeReferrerGroupKey } from '../utils/referrerHelper';
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
  DocumentArchiveItem,
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
  const resolvedDepartment =
    clipStr((citizen as any).department, 100) ||
    clipStr(citizen.CurrentStage, 100) ||
    'الاستعلامات';
  const resolvedStatus =
    clipStr((citizen as any).status, 60) ||
    (citizen.IsBlocked ? 'محظور' : citizen.IsArchived ? 'مؤرشف' : 'نشط');
  const resolvedPhone = clipStr(citizen.Phone1, 50) ?? '';
  const resolvedCreatedAt = clipStr(citizen.CreatedAt, 100) || nowIso.split('T')[0];
  const resolvedCreatedBy = clipStr(citizen.CreatedBy, 120) || 'موظف الاستعلامات';
  const resolvedReferrer = clipStr(citizen.ReferralSource, 200) || '';
  const resolvedArchivedAt = clipStr(citizen.ArchivedAt || citizen.archivedAt, 100) || '';
  const resolvedArchivedBy = clipStr(citizen.ArchivedBy || citizen.archivedBy, 150) || '';

  const copy: any = {
    ...citizen,
    Citizen_ID: safeId,
    FullName: fullName,
    fullName,
    Phone1: resolvedPhone,
    phone: resolvedPhone,
    Rating: clipStr(citizen.Rating, 50) || 'مؤيد',
    District: clipStr(citizen.District, 100) || 'الناصرية',
    SubDistrict: clipStr(citizen.SubDistrict, 100) || 'المركز',
    department: resolvedDepartment,
    status: resolvedStatus,
    referrer: resolvedReferrer,
    notes: clipStr(citizen.ArchiveNotes || citizen.ReferralSource, 1000) || '',
    CreatedAt: resolvedCreatedAt,
    createdAt: resolvedCreatedAt,
    CreatedBy: resolvedCreatedBy,
    responsibleEmployee: resolvedCreatedBy,
    UpdatedAt: nowIso,
    updatedAt: nowIso
  };
  if (resolvedArchivedAt) {
    copy.ArchivedAt = resolvedArchivedAt;
    copy.archivedAt = resolvedArchivedAt;
  }
  if (resolvedArchivedBy) {
    copy.ArchivedBy = resolvedArchivedBy;
    copy.archivedBy = resolvedArchivedBy;
  }
  if (typeof citizen.referredToOrganization === 'boolean') {
    copy.referredToOrganization = citizen.referredToOrganization;
  }
  // Keep IsArchived, archived, and الأرشفة flags synchronized in Firestore (never deleting or wiping audit metadata)
  if (typeof citizen.IsArchived === 'boolean') {
    copy.IsArchived = citizen.IsArchived;
    copy.archived = citizen.IsArchived;
    copy['الأرشفة'] = citizen.IsArchived ? 'نعم' : 'لا';
  }
  // Persist independent per-section archive arrays faithfully (including empty [] after unarchiving)
  if (Array.isArray(citizen.archivedInSections)) {
    copy.archivedInSections = Array.from(
      new Set(citizen.archivedInSections.map(s => String(s || '').trim().toLowerCase()).filter(Boolean))
    ).slice(0, 20);
  }
  if (Array.isArray(citizen.unarchivedInSections)) {
    copy.unarchivedInSections = Array.from(
      new Set(citizen.unarchivedInSections.map(s => String(s || '').trim().toLowerCase()).filter(Boolean))
    ).slice(0, 20);
  }
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
  const resolvedFullName = clipStr(req.CitizenName || (req as any).fullName, 250) || 'مراجع';
  const resolvedPhone = clipStr(req.CitizenPhone || (req as any).phone, 50) ?? '';
  const resolvedEntity = clipStr(req.Entity || (req as any).entity, 200) || 'غير محدد';
  const resolvedDetails = clipStr(req.Details || (req as any).subject, 10000) ?? '';
  const rawDecision = clipStr(req.DirectorDecision, 40) || '';
  const resolvedPathType =
    clipStr(req.pathType || req.route, 40) ||
    (rawDecision === 'حظر'
      ? 'blocked'
      : rawDecision === 'خاص'
      ? 'private'
      : rawDecision === 'عام'
      ? 'public'
      : rawDecision === 'رفض'
      ? 'rejected'
      : '');
  const isPendingForDirector =
    !resolvedPathType &&
    !rawDecision &&
    (req.CurrentStage === 'مدير المكتب' || req.RegisteredVia === 'استعلامات' || !req.CurrentStage);
  const resolvedStage =
    clipStr(req.CurrentStage || (req as any).stage, 80) ||
    (isPendingForDirector ? 'مدير المكتب' : 'مدير الإدارة');
  const resolvedRegisteredVia =
    clipStr(req.RegisteredVia || (req as any).source, 60) ||
    (resolvedStage === 'مدير المكتب' ? 'استعلامات' : 'الإدارة');
  const resolvedDepartment =
    clipStr(req.department || req.TargetDepartment, 120) ||
    (resolvedPathType === 'private'
      ? 'قسم المعتمد الخاص'
      : resolvedPathType === 'public'
      ? 'قسم المعتمد العام'
      : resolvedStage === 'مدير المكتب' && !resolvedPathType
      ? 'مدير المكتب'
      : 'قسم الإدارة');
  const resolvedStatus = clipStr(req.ProcessingStatus, 50) || (isPendingForDirector ? 'قيد الإجراء' : 'قيد التدقيق');
  const resolvedRequestStatus =
    clipStr(req.RequestStatus, 50) || (isPendingForDirector ? 'غير مستلم' : 'مستلم');
  const resolvedDeliveryStatus =
    clipStr(req.DeliveryStatus, 50) || (resolvedRequestStatus === 'مستلم' ? 'مستلم' : 'غير مستلم');
  const resolvedReceptionNotes = clipStr(req.ReceptionNotes, 2000) || '';
  const resolvedNotes =
    clipStr(req.DirectorNotes || req.DeputyNotes || resolvedReceptionNotes || req.OtherNotes, 2000) || '';
  const resolvedCreatedAt = clipStr(req.CreatedAt, 100) || nowIso.split('T')[0];
  const resolvedCreatedBy = clipStr(req.CreatedBy, 120) || (resolvedRegisteredVia === 'استعلامات' ? 'موظف الاستعلامات' : 'موظف النظام');
  const resolvedArchivedAt = clipStr(req.ArchivedAt || req.archivedAt, 100) || '';
  const resolvedArchivedBy = clipStr(req.ArchivedBy || req.archivedBy, 150) || '';
  const resolvedIsArchived = req.IsArchived === true;

  const copy: any = {
    ...req,
    Request_ID: safeReqId,
    Citizen_ID: safeCitId,
    CitizenName: resolvedFullName,
    fullName: resolvedFullName,
    CitizenPhone: resolvedPhone,
    phone: resolvedPhone,
    Entity: resolvedEntity,
    entity: resolvedEntity,
    referrer: clipStr(req.ReferralSource, 200) || '',
    RequestStatus: resolvedRequestStatus,
    DeliveryStatus: resolvedDeliveryStatus,
    ProcessingStatus: resolvedStatus,
    status: resolvedStatus,
    CurrentStage: resolvedStage,
    stage: resolvedStage,
    RegisteredVia: resolvedRegisteredVia,
    DirectorDecision: rawDecision,
    Priority: clipStr(req.Priority, 50) || 'عام',
    Details: resolvedDetails,
    subject: resolvedDetails,
    ReceptionNotes: resolvedReceptionNotes,
    department: resolvedDepartment,
    TargetDepartment: clipStr(req.TargetDepartment, 120) || resolvedDepartment,
    notes: resolvedNotes,
    IsArchived: resolvedIsArchived,
    archived: resolvedIsArchived,
    'الأرشفة': resolvedIsArchived ? 'نعم' : 'لا',
    IsHistoricalImported: Boolean(req.IsHistoricalImported),
    IsDirectInstantRequest: Boolean(req.IsDirectInstantRequest),
    referredToOrganization: Boolean(req.referredToOrganization),
    CreatedAt: resolvedCreatedAt,
    createdAt: resolvedCreatedAt,
    CreatedBy: resolvedCreatedBy,
    responsibleEmployee: resolvedCreatedBy,
    UpdatedAt: nowIso,
    updatedAt: nowIso
  };
  if (resolvedPathType) {
    copy.pathType = resolvedPathType;
    copy.route = resolvedPathType;
  }
  if (resolvedArchivedAt) {
    copy.ArchivedAt = resolvedArchivedAt;
    copy.archivedAt = resolvedArchivedAt;
  }
  if (resolvedArchivedBy) {
    copy.ArchivedBy = resolvedArchivedBy;
    copy.archivedBy = resolvedArchivedBy;
  }
  // Persist independent per-section archive arrays faithfully (including empty [] after unarchiving)
  if (Array.isArray(req.archivedInSections)) {
    copy.archivedInSections = Array.from(
      new Set(req.archivedInSections.map(s => String(s || '').trim().toLowerCase()).filter(Boolean))
    ).slice(0, 20);
  }
  if (Array.isArray(req.unarchivedInSections)) {
    copy.unarchivedInSections = Array.from(
      new Set(req.unarchivedInSections.map(s => String(s || '').trim().toLowerCase()).filter(Boolean))
    ).slice(0, 20);
  }
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

// Clean Firestore Collections Architecture for alaa-office-2026 / (default)
export const FS_COLLECTIONS = {
  // 8 Core Organized Collections
  VISITORS: 'visitors',
  CITIZENS: 'visitors',
  ARCHIVES: 'archives',
  DEPARTMENTS: 'departments',
  USERS: 'users',
  REFERRERS: 'referrers',
  BLACKLIST: 'blacklist',
  AUDIT_LOGS: 'audit_logs',
  SYSTEM_SETTINGS: 'system_settings',
  SETTINGS: 'system_settings',
  // Operational Sub-Collections
  REQUESTS: 'requests',
  INTERVIEWS: 'interviews',
  LETTERS: 'letters',
  CHEQUES: 'cheques',
  ORGANIZATIONS: 'organizations',
  DROPDOWNS: 'dropdowns',
  CUSTOM_SECTIONS: 'custom_sections',
  CUSTOM_RECORDS: 'custom_records',
  DOCUMENTS: 'documents',
  DELETED_RECORDS: 'deleted_records',
  NOTIFICATIONS: 'notifications'
} as const;

// Canonical alignment map between Firebase Firestore collections & manual Google Sheets backup tabs
export const FIRESTORE_SHEET_ALIGNMENT = {
  [FS_COLLECTIONS.VISITORS]: { sheetTab: 'قسم_الاستعلامات_والمراجعين', label: 'سجل المراجعين النشطين (visitors)' },
  [FS_COLLECTIONS.ARCHIVES]: { sheetTab: 'الأرشيف_المستقل', label: 'الأرشيف المستقل لكل قسم (archives)' },
  [FS_COLLECTIONS.DEPARTMENTS]: { sheetTab: 'الأقسام_واللجان', label: 'الأقسام واللجان والصلاحيات (departments)' },
  [FS_COLLECTIONS.USERS]: { sheetTab: 'قسم_الرقابة_والمستخدمين', label: 'حسابات الموظفين والأدوار (users)' },
  [FS_COLLECTIONS.REFERRERS]: { sheetTab: 'المعرفون_الموحدون', label: 'المعرّفون الموحدون (referrers)' },
  [FS_COLLECTIONS.BLACKLIST]: { sheetTab: 'قائمة_المحظورين', label: 'قائمة المحظورين والمرفوضين (blacklist)' },
  [FS_COLLECTIONS.AUDIT_LOGS]: { sheetTab: 'سجل_الحركات', label: 'سجل الحركات والتدقيق (audit_logs)' },
  [FS_COLLECTIONS.SYSTEM_SETTINGS]: { sheetTab: 'الإعدادات', label: 'إعدادات النظام وحالة النسخ الاحتياطي (system_settings)' },
  [FS_COLLECTIONS.REQUESTS]: { sheetTab: 'قسم_الإدارة_والمعاملات', label: 'قسم الإدارة والمعاملات' },
  [FS_COLLECTIONS.INTERVIEWS]: { sheetTab: 'قسم_مقابلات_النائب', label: 'قسم مقابلات النائب' },
  [FS_COLLECTIONS.ORGANIZATIONS]: { sheetTab: 'قسم_التنظيم_والجماهير', label: 'قسم التنظيم والجماهير' },
  [FS_COLLECTIONS.CHEQUES]: { sheetTab: 'قسم_المساعدات_والصكوك', label: 'قسم المساعدات والصكوك' },
  [FS_COLLECTIONS.CUSTOM_RECORDS]: { sheetTab: 'قسم_الرعاية_الاجتماعية', label: 'قسم الرعاية الاجتماعية والأقسام المخصصة' }
} as const;

// Organized Firestore settings sub-documents inside `system_settings` collection
export const FS_SETTINGS_DOCS = {
  GENERAL: 'general',
  DEVELOPER_AUTH: 'developer_auth',
  OUTGOING_COUNTER: 'outgoing_counter',
  SCHEMA_ALIGNMENT: 'schema_alignment',
  BACKUP_STATUS: 'backup_status'
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
    // Clear any stale tombstone for this exact ID so freshly saved records are never shadowed
    deleteDoc(doc(db, getFSCol(FS_COLLECTIONS.DELETED_RECORDS), clean.Citizen_ID)).catch(() => {});
    updateFirebaseHealth('connected', null);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteArchivesForRecord(recordId: string): Promise<void> {
  if (!recordId || isFirestoreTemporarilyBlocked()) return;
  const safeId = sanitizeFirestoreDocId(recordId, 'REC');
  const col = getFSCol(FS_COLLECTIONS.ARCHIVES);
  try {
    const q = query(collection(db, col), where('recordId', '==', safeId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn('Firestore archive cascade delete notice:', err);
  }
}

async function fsDeleteByField(
  collectionKey: string,
  fieldName: string,
  fieldValue: string
): Promise<void> {
  if (!fieldValue || isFirestoreTemporarilyBlocked()) return;
  try {
    const col = getFSCol(collectionKey);
    const snap = await getDocs(query(collection(db, col), where(fieldName, '==', fieldValue)));
    if (snap.empty) return;
    const docs = snap.docs;
    const CHUNK = 250;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      docs.slice(i, i + CHUNK).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.warn(`Firestore cascade delete (${collectionKey}.${fieldName}) notice:`, err);
  }
}

export async function fsDeleteCitizen(citizenId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(citizenId, 'ONA');
  const col = getFSCol(FS_COLLECTIONS.CITIZENS);
  const path = `${col}/${safeId}`;
  try {
    await deleteDoc(doc(db, col, safeId));
    await Promise.all([
      deleteDoc(doc(db, getFSCol(FS_COLLECTIONS.BLACKLIST), safeId)).catch(() => {}),
      deleteDoc(doc(db, getFSCol(FS_COLLECTIONS.ORGANIZATIONS), safeId)).catch(() => {}),
      fsDeleteArchivesForRecord(safeId),
      fsDeleteByField(FS_COLLECTIONS.REQUESTS, 'Citizen_ID', safeId),
      fsDeleteByField(FS_COLLECTIONS.INTERVIEWS, 'Citizen_ID', safeId),
      fsDeleteByField(FS_COLLECTIONS.LETTERS, 'Citizen_ID', safeId),
      fsDeleteByField(FS_COLLECTIONS.CHEQUES, 'Citizen_ID', safeId),
      fsDeleteByField(FS_COLLECTIONS.ORGANIZATIONS, 'Citizen_ID', safeId),
      fsDeleteByField(FS_COLLECTIONS.DOCUMENTS, 'Citizen_ID', safeId),
      fsDeleteByField(FS_COLLECTIONS.BLACKLIST, 'Citizen_ID', safeId),
      fsDeleteByField(FS_COLLECTIONS.NOTIFICATIONS, 'entityId', safeId),
      fsRegisterDeletedRecord(safeId, 'citizens')
    ]);
    updateFirebaseHealth('connected', null);
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
    // Clear any stale tombstone for this exact ID so freshly saved requests are never shadowed
    deleteDoc(doc(db, getFSCol(FS_COLLECTIONS.DELETED_RECORDS), clean.Request_ID)).catch(() => {});
    updateFirebaseHealth('connected', null);
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
    await Promise.all([
      fsDeleteArchivesForRecord(safeId),
      fsDeleteByField(FS_COLLECTIONS.NOTIFICATIONS, 'entityId', safeId),
      fsRegisterDeletedRecord(safeId, 'requests')
    ]);
    updateFirebaseHealth('connected', null);
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

  const ok = savedCitizens + savedRequests > 0 || entries.length === 0;
  if (ok && savedCitizens + savedRequests > 0) {
    updateFirebaseHealth('connected', null);
  }
  return {
    success: ok,
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
    updateFirebaseHealth('connected', null);
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
    updateFirebaseHealth('connected', null);
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
    updateFirebaseHealth('connected', null);
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
    updateFirebaseHealth('connected', null);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteOrgRecord(orgIdOrCitizenId: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.ORGANIZATIONS);
  const safeId = sanitizeFirestoreDocId(orgIdOrCitizenId, 'ORG');
  const path = `${col}/${safeId}`;
  try {
    await deleteDoc(doc(db, col, safeId));
    await fsRegisterDeletedRecord(safeId, 'organizations');
    updateFirebaseHealth('connected', null);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 6b. Archive Documents Operations (`documents` collection)
export async function fsSaveDocument(docItem: DocumentArchiveItem): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.DOCUMENTS);
  const safeId = sanitizeFirestoreDocId(docItem.Doc_ID, 'DOC');
  const path = `${col}/${safeId}`;
  const nowIso = new Date().toISOString();
  const payload: any = {
    ...docItem,
    Doc_ID: safeId,
    UpdatedAt: nowIso,
    updatedAt: nowIso
  };
  if (typeof payload.FileUrl === 'string' && payload.FileUrl.length > 450000) {
    payload.FileUrl = '';
  }
  try {
    await setDoc(doc(db, col, safeId), stripUndefinedProps(payload), { merge: true });
    updateFirebaseHealth('connected', null);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteDocument(docId: string): Promise<void> {
  const col = getFSCol(FS_COLLECTIONS.DOCUMENTS);
  const safeId = sanitizeFirestoreDocId(docId, 'DOC');
  const path = `${col}/${safeId}`;
  try {
    await deleteDoc(doc(db, col, safeId));
    await fsRegisterDeletedRecord(safeId, 'documents');
    updateFirebaseHealth('connected', null);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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
  const canonicalRole = resolveCanonicalUserRole(user);
  return {
    ...user,
    User_ID: safeId,
    Username: String(user.Username || safeId).trim(),
    Password: user.Password !== undefined ? String(user.Password).trim() : '',
    FullName: String(user.FullName || user.Username || 'موظف').trim(),
    Role: canonicalRole,
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
    updateFirebaseHealth('connected', null);
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
    updateFirebaseHealth('connected', null);
    return { connected: true };
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes('not-found')) {
      updateFirebaseHealth('connected', null);
      return { connected: true };
    }
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
  if (settings.outgoingBaselineMode !== undefined) {
    cloudPatch.outgoingBaselineMode = settings.outgoingBaselineMode;
  }
  if (settings.outgoingBaselineSetAt !== undefined) {
    cloudPatch.outgoingBaselineSetAt = settings.outgoingBaselineSetAt;
  }
  if (settings.outgoingBaselineLabel !== undefined) {
    cloudPatch.outgoingBaselineLabel = settings.outgoingBaselineLabel;
  }
  if (settings.defaultOutgoingDate !== undefined) {
    cloudPatch.defaultOutgoingDate = settings.defaultOutgoingDate;
  }
  if (settings.lastRegisteredName !== undefined) {
    cloudPatch.lastRegisteredName = settings.lastRegisteredName;
  }
  if (settings.lastOutgoingRaw !== undefined) {
    cloudPatch.lastOutgoingRaw = settings.lastOutgoingRaw;
  }
  if (settings.appName !== undefined) cloudPatch.appName = settings.appName;
  if (settings.officeName !== undefined) cloudPatch.officeName = settings.officeName;
  if (settings.deputyName !== undefined) cloudPatch.deputyName = settings.deputyName;
  if (settings.deputyTitle !== undefined) cloudPatch.deputyTitle = settings.deputyTitle;
  if (settings.province !== undefined) cloudPatch.province = settings.province;
  if (settings.officeAddress !== undefined) cloudPatch.officeAddress = settings.officeAddress;
  if (settings.hotline !== undefined) cloudPatch.hotline = settings.hotline;
  if (settings.footerText !== undefined) cloudPatch.footerText = settings.footerText;
  if (settings.loadingScreenTitle !== undefined) cloudPatch.loadingScreenTitle = settings.loadingScreenTitle;
  if (settings.loadingScreenSubtitle !== undefined) cloudPatch.loadingScreenSubtitle = settings.loadingScreenSubtitle;
  if (settings.loginWelcomeTitle !== undefined) cloudPatch.loginWelcomeTitle = settings.loginWelcomeTitle;
  if (settings.loginWelcomeSubtitle !== undefined) cloudPatch.loginWelcomeSubtitle = settings.loginWelcomeSubtitle;
  if (settings.loginHeaderBadgeText !== undefined) cloudPatch.loginHeaderBadgeText = settings.loginHeaderBadgeText;
  if (settings.loginBadgeText !== undefined) cloudPatch.loginBadgeText = settings.loginBadgeText;
  if (settings.loginButtonText !== undefined) cloudPatch.loginButtonText = settings.loginButtonText;
  if (settings.loginPasscodeTabText !== undefined) cloudPatch.loginPasscodeTabText = settings.loginPasscodeTabText;
  if (settings.loginCredentialsTabText !== undefined) cloudPatch.loginCredentialsTabText = settings.loginCredentialsTabText;
  if (settings.loginSecurityBadgeText !== undefined) cloudPatch.loginSecurityBadgeText = settings.loginSecurityBadgeText;
  if (settings.loginFooterCopyrightText !== undefined) cloudPatch.loginFooterCopyrightText = settings.loginFooterCopyrightText;
  if (settings.logoUrl && settings.logoUrl.length < 180000) cloudPatch.logoUrl = settings.logoUrl;

  if (Object.keys(cloudPatch).length > 2) {
    try {
      await setDoc(doc(db, col, 'cloud_config'), stripUndefinedAndOversizedDeep(cloudPatch), { merge: true });
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
    updateFirebaseHealth('connected', null);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export function fsWatchGeneralSettings(
  callback: (general: Partial<SystemSettings>) => void
): () => void {
  if (isFirestoreTemporarilyBlocked()) return () => {};
  try {
    const col = getFSCol(FS_COLLECTIONS.SETTINGS);
    return onSnapshot(
      doc(db, col, 'general'),
      (snap) => {
        if (snap.exists()) {
          callback(snap.data() as Partial<SystemSettings>);
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

export function fsWatchCloudConfig(
  callback: (cfg: Partial<SystemSettings>) => void
): () => void {
  if (isFirestoreTemporarilyBlocked()) return () => {};
  try {
    const col = getFSCol(FS_COLLECTIONS.SETTINGS);
    return onSnapshot(
      doc(db, col, 'cloud_config'),
      (snap) => {
        if (snap.exists()) {
          callback(snap.data() as Partial<SystemSettings>);
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
      for (const rawUser of list) {
        if (!rawUser) continue;
        const u = normalizeUserRecord(rawUser);
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
          const passMatched = Boolean(cleanPass && uPass && cleanPass === uPass);
          if (userMatched && passMatched) {
            if (u.Status === 'frozen') return { success: false, frozen: true };
            return { success: true, user: u, isDeveloper: u.Role === 'developer', matchedSource: 'firebase_user' };
          }
        } else {
          if (rawCode && uPass && rawCode === uPass) {
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
    updateFirebaseHealth('connected', null);
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
    updateFirebaseHealth('connected', null);
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
    const lowerCat = String(category || '').toLowerCase();
    if (
      lowerCat === 'referralsource' ||
      lowerCat === 'referrers' ||
      lowerCat === 'referrer' ||
      lowerCat.includes('معرف') ||
      lowerCat.includes('محيل')
    ) {
      await fsDeleteReferrerByName(value);
    }
    updateFirebaseHealth('connected', null);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 12. Audit Logs (persisted reliably to Firestore for cross-session executive oversight)
export async function fsAddAuditLog(log: AuditLog): Promise<void> {
  if (!log || !log.Log_ID || isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.AUDIT_LOGS);
  const safeId = sanitizeFirestoreDocId(log.Log_ID, 'LOG');
  const payload = {
    Log_ID: safeId,
    Timestamp: clipStr(log.Timestamp, 64) || new Date().toISOString().replace('T', ' ').slice(0, 19),
    User: clipStr(log.User || log.UserName, 200) || 'النظام الآلي',
    UserName: clipStr(log.UserName || log.User, 200) || 'النظام الآلي',
    Action: clipStr(log.Action || log.ActionType, 200) || 'إجراء إداري',
    ActionType: clipStr(log.ActionType || log.Action, 200) || 'إجراء إداري',
    Section: clipStr(log.Section || log.Department, 200) || 'النظام',
    Department: clipStr(log.Department || log.Section, 200) || 'النظام',
    Details: clipStr(log.Details, 1500) || '',
    Ip: clipStr(log.Ip, 64) || 'local',
    createdAtIso: new Date().toISOString()
  };
  try {
    await setDoc(doc(db, col, safeId), payload, { merge: true });
  } catch (error) {
    console.warn('Firestore save audit log notice:', error);
  }
}

// Organize schema alignment metadata cleanly inside `settings/schema_alignment`
export async function fsSyncSettingsStructure(outgoingMeta?: {
  lastOutgoingNumberNasiriyah?: number;
  lastOutgoingNumberSuq?: number;
  outgoingBaselineSetAt?: string;
  outgoingBaselineLabel?: string;
}): Promise<void> {
  if (isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.SETTINGS);
  try {
    await setDoc(
      doc(db, col, FS_SETTINGS_DOCS.SCHEMA_ALIGNMENT),
      {
        alignedWithGoogleSheets: true,
        collections: FIRESTORE_SHEET_ALIGNMENT,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    if (outgoingMeta) {
      await setDoc(
        doc(db, col, FS_SETTINGS_DOCS.OUTGOING_COUNTER),
        {
          ...outgoingMeta,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    }
  } catch (e) {
    console.warn('Firestore settings structure sync notice:', e);
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

    if (total > 0) {
      updateFirebaseHealth('connected', null);
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
  documents: DocumentArchiveItem[];
  dropdowns: DropdownItem[];
  notifications: UrgentNotification[];
  auditLogs: AuditLog[];
  deletedIds: string[];
  systemSettings?: Partial<SystemSettings>;
  developerPasscode?: string;
  error?: string;
}> {
  try {
    const criticalErrors: string[] = [];
    const normalizePulledDoc = <T>(baseCol: string, docId: string, raw: any): T => {
      if (!raw || typeof raw !== 'object') return raw as T;
      if (baseCol === FS_COLLECTIONS.REQUESTS) {
        return {
          ...raw,
          Request_ID: String(raw.Request_ID || raw.id || docId).trim(),
          Citizen_ID: String(raw.Citizen_ID || raw.citizenId || '').trim(),
          CitizenName: String(raw.CitizenName || raw.fullName || raw.FullName || 'مراجع').trim(),
          CitizenPhone: String(raw.CitizenPhone || raw.phone || raw.Phone1 || '').trim(),
          Entity: String(raw.Entity || raw.entity || 'غير محدد').trim(),
          Details: String(raw.Details || raw.subject || '').trim(),
          CurrentStage: raw.CurrentStage || raw.stage || (!raw.DirectorDecision && !raw.pathType ? 'مدير المكتب' : 'مدير الإدارة')
        } as T;
      }
      if (baseCol === FS_COLLECTIONS.CITIZENS) {
        return {
          ...raw,
          Citizen_ID: String(raw.Citizen_ID || raw.id || docId).trim(),
          FullName: String(raw.FullName || raw.fullName || 'مراجع').trim(),
          Phone1: String(raw.Phone1 || raw.phone || '').trim()
        } as T;
      }
      return raw as T;
    };

    const fetchCol = async <T>(colName: string, baseCol: string, isCritical = false): Promise<T[]> => {
      try {
        try {
          const snap = await withTimeout(getDocsFromServer(collection(db, colName)), 12000, `serverPull(${colName})`);
          return snap.docs.map(d => normalizePulledDoc<T>(baseCol, d.id, d.data()));
        } catch (serverErr: any) {
          try {
            const snap = await withTimeout(getDocs(collection(db, colName)), 8000, `cachePull(${colName})`);
            return snap.docs.map(d => normalizePulledDoc<T>(baseCol, d.id, d.data()));
          } catch (cacheErr: any) {
            if (isCritical) {
              const reason = serverErr?.message || cacheErr?.message || 'تعذر الجلب من Firestore';
              criticalErrors.push(`${colName}: ${reason}`);
            }
            return [];
          }
        }
      } catch (err: any) {
        if (isCritical) {
          criticalErrors.push(`${colName}: ${err?.message || String(err)}`);
        }
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
    const colDocuments = getFSCol(FS_COLLECTIONS.DOCUMENTS);
    const colDropdowns = getFSCol(FS_COLLECTIONS.DROPDOWNS);
    const colSettings = getFSCol(FS_COLLECTIONS.SETTINGS);
    const colDeleted = getFSCol(FS_COLLECTIONS.DELETED_RECORDS);
    const colNotifications = getFSCol(FS_COLLECTIONS.NOTIFICATIONS);
    const colAuditLogs = getFSCol(FS_COLLECTIONS.AUDIT_LOGS);

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
      rawDocuments,
      dropdowns,
      rawNotifications,
      rawAuditLogs,
      rawDeletedDocs,
      settingsSnap,
      passcodeSnap
    ] = await Promise.all([
      fetchCol<Citizen>(colCitizens, FS_COLLECTIONS.CITIZENS, true),
      fetchCol<OfficeRequest>(colRequests, FS_COLLECTIONS.REQUESTS, true),
      fetchCol<Interview>(colInterviews, FS_COLLECTIONS.INTERVIEWS),
      fetchCol<OfficialLetter>(colLetters, FS_COLLECTIONS.LETTERS),
      fetchCol<ChequeRecord>(colCheques, FS_COLLECTIONS.CHEQUES),
      fetchCol<OrganizationRecord>(colOrgs, FS_COLLECTIONS.ORGANIZATIONS),
      fetchCol<User>(colUsers, FS_COLLECTIONS.USERS),
      fetchCol<CustomSection>(colSections, FS_COLLECTIONS.CUSTOM_SECTIONS),
      fetchCol<CustomSectionRecord>(colRecords, FS_COLLECTIONS.CUSTOM_RECORDS),
      fetchCol<DocumentArchiveItem>(colDocuments, FS_COLLECTIONS.DOCUMENTS),
      fetchCol<DropdownItem>(colDropdowns, FS_COLLECTIONS.DROPDOWNS),
      fetchCol<UrgentNotification>(colNotifications, FS_COLLECTIONS.NOTIFICATIONS),
      fetchCol<AuditLog>(colAuditLogs, FS_COLLECTIONS.AUDIT_LOGS),
      fetchCol<any>(colDeleted, FS_COLLECTIONS.DELETED_RECORDS),
      fetchDocSafe(colSettings, 'general'),
      fetchDocSafe(colSettings, 'developer_auth')
    ]);

    if (criticalErrors.length > 0) {
      const errMsg = `فشل جلب البيانات من Firebase Firestore (${criticalErrors.join(' | ')})`;
      updateFirebaseHealth('error', errMsg);
      pushCloudSyncAlert({
        severity: 'error',
        target: 'firebase',
        title: 'تعذر جلب المعاملات من Firebase Firestore',
        message: 'حدث خطأ أثناء تحميل المراجعين والمعاملات من قاعدة البيانات (alaa-office-2026).',
        details: errMsg
      });
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
        documents: [],
        dropdowns: [],
        notifications: [],
        auditLogs: [],
        deletedIds: [],
        error: errMsg
      };
    }

    const deletedIdsSet = new Set<string>();
    rawDeletedDocs.forEach(d => {
      if (d?.id) deletedIdsSet.add(String(d.id));
    });

    // Live documents actually present on Firestore server in `visitors` and `requests` MUST NEVER be hidden by stale tombstones
    const citizens = rawCitizens.filter(c => c && c.Citizen_ID);
    const requests = rawRequests.filter(r => r && r.Request_ID);
    const interviews = rawInterviews.filter(i => i && i.Interview_ID && !deletedIdsSet.has(i.Interview_ID) && !deletedIdsSet.has(i.Citizen_ID));
    const officialLetters = rawOfficialLetters.filter(l => l && l.Letter_ID && !deletedIdsSet.has(l.Letter_ID) && (!l.Citizen_ID || !deletedIdsSet.has(l.Citizen_ID)));
    const cheques = rawCheques.filter(ch => ch && ch.id && !deletedIdsSet.has(ch.id) && !deletedIdsSet.has(ch.Citizen_ID));
    const organizationRecords = rawOrganizationRecords.filter(o => o && (o.Org_ID || o.Citizen_ID) && !deletedIdsSet.has(o.Org_ID || '') && !deletedIdsSet.has(o.Citizen_ID));
    const users = rawUsers
      .filter(u => u && u.User_ID && !deletedIdsSet.has(u.User_ID))
      .map(u => normalizeUserRecord(u));
    const customSections = rawCustomSections.filter(s => s && s.id && !deletedIdsSet.has(s.id));
    const customRecords = rawCustomRecords.filter(cr => cr && cr.id && !deletedIdsSet.has(cr.id) && !deletedIdsSet.has(cr.sectionId));
    const documents = rawDocuments.filter(docItem => docItem && docItem.Doc_ID && !deletedIdsSet.has(docItem.Doc_ID));
    const notifications = rawNotifications
      .filter(n => n && n.id && n.title)
      .sort((a, b) => Date.parse(b.createdAtIso || '') - Date.parse(a.createdAtIso || ''));
    const auditLogs = rawAuditLogs
      .filter(a => a && a.Log_ID)
      .sort((a, b) => {
        const tsA = Date.parse((a as any).createdAtIso || a.Timestamp || '') || 0;
        const tsB = Date.parse((b as any).createdAtIso || b.Timestamp || '') || 0;
        return tsB - tsA;
      })
      .slice(0, 600);

    const systemSettings = settingsSnap && settingsSnap.exists() ? (settingsSnap.data() as Partial<SystemSettings>) : undefined;
    const developerPasscode = passcodeSnap && passcodeSnap.exists() ? (passcodeSnap.data()?.developerPasscode as string) : undefined;

    updateFirebaseHealth('connected', null);
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
      documents,
      dropdowns,
      notifications,
      auditLogs,
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
      documents: [],
      dropdowns: [],
      notifications: [],
      auditLogs: [],
      deletedIds: [],
      error: err.message
    };
  }
}

async function wipeSingleFirestoreCollection(colName: string): Promise<number> {
  let deleted = 0;
  try {
    const snap = await getDocs(collection(db, colName));
    if (snap.empty) return 0;

    let currentBatch = writeBatch(db);
    let count = 0;
    for (const d of snap.docs) {
      currentBatch.delete(d.ref);
      count++;
      deleted++;
      if (count >= 400) {
        await currentBatch.commit().catch(() => {});
        currentBatch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) {
      await currentBatch.commit().catch(() => {});
    }
  } catch (e) {
    console.warn(`Wipe collection notice (${colName}):`, e);
  }
  return deleted;
}

/**
 * Fast parallel wipe of ALL business data collections in Firebase Firestore
 * while preserving staff accounts (users), system settings/icons, dropdowns, and section definitions.
 */
export async function fsWipeAllCollections(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const businessCollections = [
      FS_COLLECTIONS.CITIZENS,
      FS_COLLECTIONS.ARCHIVES,
      FS_COLLECTIONS.BLACKLIST,
      FS_COLLECTIONS.DOCUMENTS,
      FS_COLLECTIONS.REQUESTS,
      FS_COLLECTIONS.INTERVIEWS,
      FS_COLLECTIONS.LETTERS,
      FS_COLLECTIONS.CHEQUES,
      FS_COLLECTIONS.ORGANIZATIONS,
      FS_COLLECTIONS.CUSTOM_RECORDS,
      FS_COLLECTIONS.AUDIT_LOGS,
      FS_COLLECTIONS.NOTIFICATIONS,
      FS_COLLECTIONS.DELETED_RECORDS
    ];

    const colNames = Array.from(
      new Set(businessCollections.flatMap(base => [getFSCol(base), base]))
    );

    const counts = await Promise.all(colNames.map(col => wipeSingleFirestoreCollection(col)));
    const deletedCount = counts.reduce((acc, n) => acc + n, 0);

    // Reset outgoing counters in settings without touching Firebase/Apps Script/UI icon configuration
    try {
      const settingsCol = getFSCol(FS_COLLECTIONS.SETTINGS);
      const resetPatch = {
        lastOutgoingNumberNasiriyah: 0,
        lastOutgoingNumberSuq: 0,
        updatedAt: new Date().toISOString()
      };
      await Promise.all([
        setDoc(doc(db, settingsCol, 'cloud_config'), resetPatch, { merge: true }).catch(() => {}),
        setDoc(doc(db, settingsCol, 'general'), resetPatch, { merge: true }).catch(() => {})
      ]);
    } catch {}

    updateFirebaseHealth('connected', null);
    return { success: true, deletedCount };
  } catch (err: any) {
    console.warn('fsWipeAllCollections warning:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Selective Section Wipe in Firebase Firestore:
 * Wipes ONLY the specified core collections or custom section records (`sectionId`) in parallel.
 */
export async function fsWipeSelectedCollections(
  sectionKeys: string[]
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const keys = Array.from(new Set((sectionKeys || []).map(k => String(k || '').trim()).filter(Boolean)));
    if (keys.length === 0) return { success: true, deletedCount: 0 };

    const coreMap: Record<string, string> = {
      citizens: FS_COLLECTIONS.CITIZENS,
      requests: FS_COLLECTIONS.REQUESTS,
      interviews: FS_COLLECTIONS.INTERVIEWS,
      letters: FS_COLLECTIONS.LETTERS,
      officialLetters: FS_COLLECTIONS.LETTERS,
      cheques: FS_COLLECTIONS.CHEQUES,
      organization: FS_COLLECTIONS.ORGANIZATIONS,
      organizations: FS_COLLECTIONS.ORGANIZATIONS,
      organizationRecords: FS_COLLECTIONS.ORGANIZATIONS,
      notifications: FS_COLLECTIONS.NOTIFICATIONS,
      audit_logs: FS_COLLECTIONS.AUDIT_LOGS
    };

    const coreColsToWipe: string[] = [];
    const customSectionIdsToWipe: string[] = [];

    for (const k of keys) {
      if (coreMap[k]) {
        coreColsToWipe.push(getFSCol(coreMap[k]), coreMap[k]);
      } else {
        customSectionIdsToWipe.push(k);
      }
    }

    let deletedCount = 0;

    // 1. Wipe selected core collections in parallel
    const uniqueCoreCols = Array.from(new Set(coreColsToWipe));
    if (uniqueCoreCols.length > 0) {
      const counts = await Promise.all(uniqueCoreCols.map(c => wipeSingleFirestoreCollection(c)));
      deletedCount += counts.reduce((a, b) => a + b, 0);
    }

    // 2. Wipe selected custom sections' records (e.g. sec_social_welfare or any dynamic sectionId)
    if (customSectionIdsToWipe.length > 0) {
      const targetSet = new Set(customSectionIdsToWipe);
      const customCols = Array.from(new Set([getFSCol(FS_COLLECTIONS.CUSTOM_RECORDS), FS_COLLECTIONS.CUSTOM_RECORDS]));
      for (const colName of customCols) {
        try {
          const snap = await getDocs(collection(db, colName));
          if (snap.empty) continue;
          let batch = writeBatch(db);
          let batchCount = 0;
          for (const d of snap.docs) {
            const data = d.data() as any;
            const secId = String(data?.sectionId || 'sec_social_welfare').trim();
            if (targetSet.has(secId)) {
              batch.delete(d.ref);
              batchCount++;
              deletedCount++;
              if (batchCount >= 400) {
                await batch.commit().catch(() => {});
                batch = writeBatch(db);
                batchCount = 0;
              }
            }
          }
          if (batchCount > 0) {
            await batch.commit().catch(() => {});
          }
        } catch (e) {
          console.warn(`Selective custom_records wipe notice (${colName}):`, e);
        }
      }
    }

    // Reset outgoing numbers if requests were wiped
    if (keys.includes('requests')) {
      const settingsCol = getFSCol(FS_COLLECTIONS.SETTINGS);
      const resetPatch = {
        lastOutgoingNumberNasiriyah: 0,
        lastOutgoingNumberSuq: 0,
        updatedAt: new Date().toISOString()
      };
      await Promise.all([
        setDoc(doc(db, settingsCol, 'cloud_config'), resetPatch, { merge: true }).catch(() => {}),
        setDoc(doc(db, settingsCol, 'general'), resetPatch, { merge: true }).catch(() => {})
      ]);
    }

    updateFirebaseHealth('connected', null);
    return { success: true, deletedCount };
  } catch (err: any) {
    console.warn('fsWipeSelectedCollections warning:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

// 15. Realtime Collection Watcher (emits full snapshot list, removed doc IDs, and server-vs-cache metadata for instant live sync)
export function fsWatchCollection<T>(
  colName: string,
  onData: (items: T[], removedIds: string[], meta?: { fromCache: boolean; hasPendingWrites: boolean }) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const dynamicCol = getFSCol(colName);
  const normalizeWatchedDoc = (docId: string, raw: any): T => {
    if (!raw || typeof raw !== 'object') return raw as T;
    if (colName === FS_COLLECTIONS.REQUESTS) {
      return {
        ...raw,
        Request_ID: String(raw.Request_ID || raw.id || docId).trim(),
        Citizen_ID: String(raw.Citizen_ID || raw.citizenId || '').trim(),
        CitizenName: String(raw.CitizenName || raw.fullName || raw.FullName || 'مراجع').trim(),
        CitizenPhone: String(raw.CitizenPhone || raw.phone || raw.Phone1 || '').trim(),
        Entity: String(raw.Entity || raw.entity || 'غير محدد').trim(),
        Details: String(raw.Details || raw.subject || '').trim(),
        CurrentStage: raw.CurrentStage || raw.stage || (!raw.DirectorDecision && !raw.pathType ? 'مدير المكتب' : 'مدير الإدارة')
      } as T;
    }
    if (colName === FS_COLLECTIONS.CITIZENS) {
      return {
        ...raw,
        Citizen_ID: String(raw.Citizen_ID || raw.id || docId).trim(),
        FullName: String(raw.FullName || raw.fullName || 'مراجع').trim(),
        Phone1: String(raw.Phone1 || raw.phone || '').trim()
      } as T;
    }
    if (colName === FS_COLLECTIONS.SETTINGS) {
      return { ...raw, _docId: docId } as T;
    }
    return raw as T;
  };

  try {
    return onSnapshot(
      collection(db, dynamicCol),
      (snapshot) => {
        const fromCache = snapshot.metadata.fromCache;
        const hasPendingWrites = snapshot.metadata.hasPendingWrites;
        if (!fromCache) {
          updateFirebaseHealth('connected', null);
        }
        const list = snapshot.docs.map(d => normalizeWatchedDoc(d.id, d.data()));
        const removedIds = snapshot
          .docChanges()
          .filter(change => change.type === 'removed')
          .map(change => change.doc.id)
          .filter(Boolean);
        onData(list, removedIds, { fromCache, hasPendingWrites });
      },
      (err) => {
        noteFirestoreFailure(err);
        const msg = err?.message || String(err || 'خطأ غير معروف');
        console.error(`Firestore watcher error (${dynamicCol}):`, err);
        const lower = msg.toLowerCase();
        let arMsg = `تعذر جلب البيانات اللحظية للمجموعة (${dynamicCol}) من Firebase Firestore (alaa-office-2026): ${msg}`;
        if (lower.includes('permission-denied') || lower.includes('permission_denied')) {
          arMsg = `رفض صلاحيات القراءة الحية للمجموعة (${dynamicCol}) في Firebase Firestore (alaa-office-2026).`;
        } else if (lower.includes('resource-exhausted') || lower.includes('quota')) {
          arMsg = `تم تجاوز الحصة اليومية لقراءة البيانات في Firebase Firestore للمجموعة (${dynamicCol}).`;
        } else if (lower.includes('unavailable') || lower.includes('offline')) {
          arMsg = `تعذر الاتصال بخادم Firebase Firestore لقراءة المجموعة (${dynamicCol}) — تحقق من الشبكة أو إعدادات قاعدة البيانات.`;
        } else if (lower.includes('failed-precondition') || lower.includes('index')) {
          arMsg = `خطأ في فهرسة أو تهيئة الاستعلام في Firebase Firestore للمجموعة (${dynamicCol}): ${msg}`;
        }
        updateFirebaseHealth('error', arMsg);
        if (colName === FS_COLLECTIONS.REQUESTS || colName === FS_COLLECTIONS.CITIZENS || lower.includes('permission')) {
          pushCloudSyncAlert({
            severity: 'error',
            target: 'firebase',
            title: `تعذر جلب بيانات (${dynamicCol}) من Firebase Firestore`,
            message: arMsg,
            details: msg
          });
        }
        if (onError) onError(err);
      }
    );
  } catch (setupErr: any) {
    const msg = setupErr?.message || String(setupErr || 'خطأ في تشغيل المستمع اللحظي');
    updateFirebaseHealth('error', `تعذر تشغيل المستمع اللحظي (${dynamicCol}): ${msg}`);
    if (onError) onError(setupErr);
    return () => {};
  }
}

// ============================================================================
// 18. Dedicated Organized Collections Helpers (alaa-office-2026)
//     archives | departments | referrers | blacklist | system_settings/backup_status
// ============================================================================

export function normalizeArabicEntityKey(raw: string): string {
  return String(raw || '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0640]/g, '')
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 18.1 Independent Per-Department Archives (`archives` collection)
export interface FirestoreArchiveEntry {
  id: string;
  recordId: string;
  recordType: 'visitor' | 'request';
  citizenId?: string;
  requestId?: string;
  department: string;
  departmentLabel: string;
  alsoVisibleIn?: string[];
  fullName: string;
  phone?: string;
  district?: string;
  entity?: string;
  details?: string;
  receptionNotes?: string;
  directorNotes?: string;
  directorDecision?: string;
  processingStatus?: string;
  deliveryStatus?: string;
  outgoingNumber?: string;
  outgoingDate?: string;
  createdAt?: string;
  archivedAt: string;
  archivedBy?: string;
  notes?: string;
  updatedAt: string;
}

export async function fsSaveSectionArchiveEntries(entries: FirestoreArchiveEntry[]): Promise<void> {
  if (!entries.length || isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.ARCHIVES);
  const CHUNK = 250;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const slice = entries.slice(i, i + CHUNK);
    try {
      const batch = writeBatch(db);
      for (const entry of slice) {
        const safeId = sanitizeFirestoreDocId(entry.id, 'ARC');
        batch.set(doc(db, col, safeId), stripUndefinedProps({ ...entry, id: safeId }), { merge: true });
      }
      await batch.commit();
    } catch (err) {
      noteFirestoreFailure(err);
    }
  }
}

export async function fsDeleteSectionArchiveEntries(docIds: string[]): Promise<void> {
  if (!docIds.length || isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.ARCHIVES);
  const CHUNK = 250;
  for (let i = 0; i < docIds.length; i += CHUNK) {
    const slice = docIds.slice(i, i + CHUNK);
    try {
      const batch = writeBatch(db);
      for (const rawId of slice) {
        const safeId = sanitizeFirestoreDocId(rawId, 'ARC');
        batch.delete(doc(db, col, safeId));
      }
      await batch.commit();
    } catch (err) {
      noteFirestoreFailure(err);
    }
  }
}

// 18.2 Dedicated Blacklist Collection (`blacklist`)
export interface FirestoreBlacklistEntry {
  Citizen_ID: string;
  FullName: string;
  normalizedName: string;
  Phone1?: string;
  Phone2?: string;
  District?: string;
  BlockReason: string;
  BlockedAt: string;
  BlockedBy: string;
  IsBlocked: boolean;
  UpdatedAt: string;
}

export async function fsSaveBlacklistEntry(entry: FirestoreBlacklistEntry): Promise<void> {
  if (!entry.Citizen_ID || isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.BLACKLIST);
  const safeId = sanitizeFirestoreDocId(entry.Citizen_ID, 'BLK');
  const path = `${col}/${safeId}`;
  try {
    await setDoc(
      doc(db, col, safeId),
      stripUndefinedProps({
        ...entry,
        Citizen_ID: safeId,
        Phone1: clipStr(entry.Phone1, 50) || '',
        Phone2: clipStr(entry.Phone2, 50) || '',
        normalizedName: normalizeArabicEntityKey(entry.FullName),
        IsBlocked: true,
        UpdatedAt: new Date().toISOString()
      }),
      { merge: true }
    );
    updateFirebaseHealth('connected', null);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteBlacklistEntry(citizenId: string): Promise<void> {
  if (!citizenId || isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.BLACKLIST);
  const safeId = sanitizeFirestoreDocId(citizenId, 'BLK');
  try {
    await deleteDoc(doc(db, col, safeId));
  } catch (error) {
    console.warn('Firestore blacklist delete notice:', error);
  }
}

// 18.3 Unified Referrers Collection (`referrers`) — cleans placeholders & merges similar spellings under one canonical document
export async function fsSyncReferrer(rawReferrerName?: string): Promise<void> {
  const cleanName = cleanReferrerLabel(rawReferrerName);
  if (!cleanName || cleanName.length < 2 || isFirestoreTemporarilyBlocked()) return;
  const normKey = normalizeReferrerGroupKey(cleanName) || normalizeArabicEntityKey(cleanName);
  if (!normKey) return;

  const col = getFSCol(FS_COLLECTIONS.REFERRERS);
  const docId = sanitizeFirestoreDocId(`ref_${normKey}`, 'REF');
  try {
    const ref = doc(db, col, docId);
    const existing = await getDoc(ref).catch(() => null);
    const prevData = existing?.exists() ? existing.data() : null;
    const prevAliases: string[] = Array.isArray(prevData?.aliases) ? prevData.aliases : [];
    const nextAliases = Array.from(new Set([...prevAliases, cleanName])).slice(0, 40);
    await setDoc(
      ref,
      {
        id: docId,
        canonicalName: prevData?.canonicalName || cleanName,
        normalizedKey: normKey,
        aliases: nextAliases,
        usageCount: Number(prevData?.usageCount || 0) + 1,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore referrer sync notice:', err);
  }
}

export async function fsDeleteReferrerByName(rawReferrerName: string): Promise<void> {
  const cleanName = cleanReferrerLabel(rawReferrerName);
  if (!cleanName || isFirestoreTemporarilyBlocked()) return;
  const normKey = normalizeReferrerGroupKey(cleanName) || normalizeArabicEntityKey(cleanName);
  if (!normKey) return;
  const col = getFSCol(FS_COLLECTIONS.REFERRERS);
  const docId = sanitizeFirestoreDocId(`ref_${normKey}`, 'REF');
  try {
    await deleteDoc(doc(db, col, docId));
  } catch (err) {
    console.warn('Firestore referrer delete notice:', err);
  }
}

// 18.4 Departments & Staff Permissions Registry (`departments`)
const CORE_OFFICE_DEPARTMENTS = [
  { id: 'reception', name: 'قسم الاستعلامات والمراجعين', type: 'core' },
  { id: 'admin', name: 'قسم الإدارة والمعاملات', type: 'core' },
  { id: 'director', name: 'مكتب المدير التنفيذي', type: 'core' },
  { id: 'interviews', name: 'قسم مقابلات النائب', type: 'core' },
  { id: 'organization', name: 'قسم التنظيم والجماهير', type: 'core' },
  { id: 'social_care', name: 'قسم الرعاية الاجتماعية', type: 'core' },
  { id: 'blacklist', name: 'قسم الرقابة والمحظورين', type: 'core' }
] as const;

export async function fsSyncDepartmentsRegistry(
  usersList: User[],
  customSectionsList: CustomSection[] = []
): Promise<void> {
  if (isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.DEPARTMENTS);
  const nowIso = new Date().toISOString();
  try {
    const batch = writeBatch(db);
    for (const dept of CORE_OFFICE_DEPARTMENTS) {
      const members = (usersList || [])
        .filter(u => {
          if (!u) return false;
          const allowed = Array.isArray(u.AllowedSections) ? u.AllowedSections : [];
          return u.Role === dept.id || allowed.includes(dept.id);
        })
        .map(u => ({
          userId: u.User_ID,
          fullName: u.FullName,
          role: u.Role,
          roleArabic: u.RoleArabic || '',
          status: u.Status || 'active',
          permissions: Array.isArray(u.Permissions) ? u.Permissions : []
        }));
      batch.set(
        doc(db, col, dept.id),
        {
          id: dept.id,
          name: dept.name,
          type: dept.type,
          membersCount: members.length,
          members,
          updatedAt: nowIso
        },
        { merge: true }
      );
    }

    for (const sec of customSectionsList || []) {
      if (!sec?.id) continue;
      const safeId = sanitizeFirestoreDocId(sec.id, 'DEPT');
      const members = (usersList || [])
        .filter(u => Array.isArray(u?.AllowedSections) && (u.AllowedSections.includes(sec.id) || u.AllowedSections.includes(`custom_section_${sec.id}`)))
        .map(u => ({
          userId: u.User_ID,
          fullName: u.FullName,
          role: u.Role,
          status: u.Status || 'active'
        }));
      batch.set(
        doc(db, col, safeId),
        {
          id: safeId,
          name: sec.title || safeId,
          type: 'custom',
          description: sec.description || '',
          membersCount: members.length,
          members,
          updatedAt: nowIso
        },
        { merge: true }
      );
    }

    await batch.commit();
  } catch (err) {
    console.warn('Firestore departments registry sync notice:', err);
  }
}

// 18.5 Manual Google Sheets Backup Status (`system_settings/backup_status`)
export async function fsSaveBackupStatus(meta: {
  action: 'manual_backup' | 'manual_import' | 'manual_export';
  status: 'success' | 'error';
  actor: string;
  sheetId: string;
  sheetGid: string;
  counts?: Record<string, number>;
  message?: string;
}): Promise<void> {
  if (isFirestoreTemporarilyBlocked()) return;
  const col = getFSCol(FS_COLLECTIONS.SYSTEM_SETTINGS);
  try {
    await setDoc(
      doc(db, col, FS_SETTINGS_DOCS.BACKUP_STATUS),
      stripUndefinedProps({
        ...meta,
        updatedAt: new Date().toISOString()
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore backup_status save notice:', err);
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
        onDeletedIds(ids);
      },
      (err) => {
        console.warn('Firestore deleted_records watcher notice:', err?.message || err);
      }
    );
  } catch {
    return () => {};
  }
}

// 17. Two-Way Google Sheets -> Firestore Deletion Reconciler
// Deletes Firestore docs that were removed directly from Google Sheets while preserving brand-new in-flight writes.
export async function fsReconcileDeletedDocs(
  colName: string,
  authoritativeKeepIds: Set<string>,
  idField: string,
  recentGraceMs: number = 30000
): Promise<number> {
  try {
    const dynamicCol = getFSCol(colName);
    const snap = await getDocs(collection(db, dynamicCol));
    if (snap.empty) return 0;

    const nowMs = Date.now();
    let removed = 0;
    let batch = writeBatch(db);
    let batchCount = 0;

    for (const d of snap.docs) {
      const data = d.data() as Record<string, any>;
      const recordId = String(data?.[idField] || d.id || '').trim();
      if (!recordId || authoritativeKeepIds.has(recordId)) continue;

      // Protect brand-new records created/edited in the last 30s that may still be in-flight to Google Sheets
      const rawTs = data?.UpdatedAt || data?.updatedAt || data?.CreatedAt || data?.createdAt || '';
      const tsMs = rawTs ? Date.parse(String(rawTs).replace(' ', 'T')) : 0;
      if (Number.isFinite(tsMs) && tsMs > 0 && nowMs - tsMs < recentGraceMs) {
        continue;
      }

      batch.delete(d.ref);
      batchCount++;
      removed++;
      if (batchCount >= 400) {
        await batch.commit().catch(() => {});
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit().catch(() => {});
    }
    return removed;
  } catch (err) {
    console.warn(`fsReconcileDeletedDocs notice (${colName}):`, err);
    return 0;
  }
}


