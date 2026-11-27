import * as XLSX from 'xlsx';
import {
  supabase,
  SUPABASE_TABLES,
  testSupabaseConnection
} from '../lib/supabase';
import { updateFirebaseHealth, pushCloudSyncAlert } from './cloudSyncAlerts';
import { resolveCanonicalUserRole, normalizeUserRecord } from '../utils/permissions';
import { cleanReferrerLabel, normalizeReferrerGroupKey } from '../utils/referrerHelper';
import {
  pullDataFromGoogleAppsScript,
  PINNED_APPS_SCRIPT_URL,
  PINNED_GOOGLE_SHEET_ID,
  PINNED_GOOGLE_SHEET_GID
} from './realtimeGoogleSync';
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

export const DEFAULT_GOOGLE_SHEET_GID = PINNED_GOOGLE_SHEET_GID;

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

export const FS_COLLECTIONS = {
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

export const FIRESTORE_SHEET_ALIGNMENT = {
  [FS_COLLECTIONS.VISITORS]: { sheetTab: 'قسم_الاستعلامات_والمراجعين', label: 'سجل المراجعين النشطين (citizens)' },
  [FS_COLLECTIONS.ARCHIVES]: { sheetTab: 'الأرشيف_المستقل', label: 'الأرشيف المستقل لكل قسم (archives)' },
  [FS_COLLECTIONS.DEPARTMENTS]: { sheetTab: 'الأقسام_واللجان', label: 'الأقسام واللجان والصلاحيات (departments)' },
  [FS_COLLECTIONS.USERS]: { sheetTab: 'قسم_الرقابة_والمستخدمين', label: 'حسابات الموظفين والأدوار (users)' },
  [FS_COLLECTIONS.REFERRERS]: { sheetTab: 'المعرفون_الموحدون', label: 'المعرّفون الموحدون (referrers)' },
  [FS_COLLECTIONS.BLACKLIST]: { sheetTab: 'قائمة_المحظورين', label: 'قائمة المحظورين والمرفوضين (blacklist)' },
  [FS_COLLECTIONS.AUDIT_LOGS]: { sheetTab: 'سجل_الحركات', label: 'سجل الحركات والتدقيق (audit_logs)' },
  [FS_COLLECTIONS.SYSTEM_SETTINGS]: { sheetTab: 'الإعدادات', label: 'إعدادات النظام وحالة النسخ الاحتياطي (system_settings)' },
  [FS_COLLECTIONS.REQUESTS]: { sheetTab: 'قسم_الإدارة_والمعاملات', label: 'قسم الإدارة والمعاملات (requests)' },
  [FS_COLLECTIONS.INTERVIEWS]: { sheetTab: 'قسم_مقابلات_النائب', label: 'قسم مقابلات النائب' },
  [FS_COLLECTIONS.ORGANIZATIONS]: { sheetTab: 'قسم_التنظيم_والجماهير', label: 'قسم التنظيم والجماهير' },
  [FS_COLLECTIONS.CHEQUES]: { sheetTab: 'قسم_المساعدات_والصكوك', label: 'قسم المساعدات والصكوك' },
  [FS_COLLECTIONS.CUSTOM_RECORDS]: { sheetTab: 'قسم_الرعاية_الاجتماعية', label: 'قسم الرعاية الاجتماعية والأقسام المخصصة' }
} as const;

export const FS_SETTINGS_DOCS = {
  GENERAL: 'general',
  DEVELOPER_AUTH: 'developer_auth',
  OUTGOING_COUNTER: 'outgoing_counter',
  SCHEMA_ALIGNMENT: 'schema_alignment',
  BACKUP_STATUS: 'backup_status'
} as const;

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

// Circuit-breaker compatibility helpers (Supabase never hard-blocks single writes)
let _supabaseBlockedUntil = 0;

export function isFirestoreTemporarilyBlocked(): boolean {
  return Date.now() < _supabaseBlockedUntil;
}

export function resetFirestoreCircuitBreaker(): void {
  _supabaseBlockedUntil = 0;
}

// Partition compatibility helpers
let _activeOfficePartition = 'office_alnashi_main';

export function setActiveOfficePartition(partition: string): void {
  const clean = (partition || '').trim();
  _activeOfficePartition = clean || 'office_alnashi_main';
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('al_nashi_office_partition', _activeOfficePartition);
    }
  } catch {
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
  } catch {
    // Ignore storage errors
  }
  return _activeOfficePartition || 'office_alnashi_main';
}

export function getFSCol(baseName: string): string {
  return baseName;
}

// Local immediate refresh pub-sub (supplements Supabase Realtime postgres_changes)
type LocalRefreshListener = () => void;
const localTableListeners = new Map<string, Set<LocalRefreshListener>>();

function registerLocalTableListener(topic: string, fn: LocalRefreshListener): () => void {
  let set = localTableListeners.get(topic);
  if (!set) {
    set = new Set();
    localTableListeners.set(topic, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
  };
}

function notifyLocalTableChange(topic: string): void {
  const set = localTableListeners.get(topic);
  if (!set) return;
  set.forEach(fn => {
    try {
      fn();
    } catch {
      // Ignore listener errors
    }
  });
}

// ============================================================================
// Normalization, Timestamptz & Safe ID Helpers
// ============================================================================

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

function normalizeArabicDigits(val: string): string {
  return String(val || '')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .trim();
}

/**
 * Safely converts any date string (ISO, YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, Arabic digits)
 * into a valid ISO-8601 string for Postgres `timestamptz` columns, or null if empty/unparseable.
 */
function toIsoTimestamptz(raw: any, fallbackToNow = false): string | null {
  if (raw === undefined || raw === null || raw === '') {
    return fallbackToNow ? new Date().toISOString() : null;
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString();
  }
  const s = normalizeArabicDigits(String(raw));
  if (!s) return fallbackToNow ? new Date().toISOString() : null;

  // Already ISO or standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  // YYYY/MM/DD or YYYY-MM-DD HH:mm:ss
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ymd) {
    const [, y, m, day, hh = '00', mm = '00', ss = '00'] = ymd;
    const iso = `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${ss.padStart(2, '0')}Z`;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, day, m, y] = dmy;
    const d = new Date(`${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return fallbackToNow ? new Date().toISOString() : null;
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

const stripUndefinedAndOversizedDeep = (input: any): any => {
  if (input === null || input === undefined) return null;
  if (typeof input === 'string') {
    if (input.length > 220000 && input.startsWith('data:image/')) {
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {},
    operationType,
    path
  };
  console.warn('Supabase Notice:', errInfo.error, path);
  throw new Error(JSON.stringify(errInfo));
}

// ============================================================================
// Row Mappers for the 6 Exact Supabase Tables
// ============================================================================

export function sanitizeCitizenForFirestore(citizen: Citizen): Citizen & { updatedAt: string; UpdatedAt: string } {
  const safeId = sanitizeFirestoreDocId(citizen.Citizen_ID, 'ONA');
  const fullName = clipStr(citizen.FullName, 250) || 'مراجع';
  const nowIso = new Date().toISOString();
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
    Phone1: resolvedPhone,
    Phone2: clipStr(citizen.Phone2, 50) || undefined,
    Rating: clipStr(citizen.Rating, 50) || 'مؤيد',
    District: clipStr(citizen.District, 100) || 'الناصرية',
    SubDistrict: clipStr(citizen.SubDistrict, 100) || 'المركز',
    ReferralSource: resolvedReferrer,
    CreatedAt: resolvedCreatedAt,
    CreatedBy: resolvedCreatedBy,
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
  if (typeof citizen.IsArchived === 'boolean') {
    copy.IsArchived = citizen.IsArchived;
  }
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
  if (citizen.IsBlocked === false) {
    copy.IsBlocked = false;
    copy.BlockReason = '';
    copy.BlockedAt = '';
    copy.BlockedBy = '';
  }
  if (typeof copy.PhotoUrl === 'string' && copy.PhotoUrl.length > 250000) {
    delete copy.PhotoUrl;
  }
  return stripUndefinedProps(copy) as Citizen & { updatedAt: string; UpdatedAt: string };
}

function citizenToSupabaseRow(citizen: Citizen): Record<string, any> {
  const clean = sanitizeCitizenForFirestore(citizen);
  return {
    id: clean.Citizen_ID,
    citizen_id: clean.Citizen_ID,
    full_name: clean.FullName,
    phone1: clean.Phone1 || '',
    phone2: clean.Phone2 || null,
    district: clean.District || null,
    sub_district: clean.SubDistrict || null,
    surname: clean.Surname || null,
    job: clean.Job || null,
    education: clean.Education || null,
    gender: clean.Gender || 'ذكر',
    rating: clean.Rating || 'مؤيد',
    referral_source: clean.ReferralSource || null,
    is_blocked: Boolean(clean.IsBlocked),
    block_reason: clean.BlockReason || null,
    extra: clean,
    created_at: toIsoTimestamptz(clean.CreatedAt, true),
    created_by: clean.CreatedBy || 'موظف الاستعلامات'
  };
}

function supabaseRowToCitizen(row: any): Citizen {
  const extra = row?.extra && typeof row.extra === 'object' ? row.extra : {};
  const id = String(row?.citizen_id || row?.id || extra.Citizen_ID || '').trim();
  const createdAt =
    extra.CreatedAt ||
    (typeof row?.created_at === 'string' ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
  return {
    ...extra,
    Citizen_ID: id,
    FullName: String(row?.full_name || extra.FullName || 'مراجع').trim(),
    Phone1: String(row?.phone1 ?? extra.Phone1 ?? '').trim(),
    ...(row?.phone2 || extra.Phone2 ? { Phone2: String(row?.phone2 || extra.Phone2).trim() } : {}),
    District: String(row?.district || extra.District || 'الناصرية').trim(),
    SubDistrict: String(row?.sub_district || extra.SubDistrict || 'المركز').trim(),
    ...(row?.surname || extra.Surname ? { Surname: String(row?.surname || extra.Surname).trim() } : {}),
    Job: String(row?.job || extra.Job || '').trim(),
    Education: String(row?.education || extra.Education || '').trim(),
    Gender: (row?.gender || extra.Gender) === 'أنثى' ? 'أنثى' : 'ذكر',
    Rating: String(row?.rating || extra.Rating || 'مؤيد').trim(),
    ...(row?.referral_source || extra.ReferralSource
      ? { ReferralSource: String(row?.referral_source || extra.ReferralSource).trim() }
      : {}),
    IsBlocked: typeof row?.is_blocked === 'boolean' ? row.is_blocked : Boolean(extra.IsBlocked),
    ...(row?.block_reason || extra.BlockReason
      ? { BlockReason: String(row?.block_reason || extra.BlockReason).trim() }
      : {}),
    CreatedAt: createdAt,
    CreatedBy: String(row?.created_by || extra.CreatedBy || 'النظام').trim()
  } as Citizen;
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
    CitizenPhone: resolvedPhone,
    Entity: resolvedEntity,
    RequestStatus: resolvedRequestStatus,
    DeliveryStatus: resolvedDeliveryStatus,
    ProcessingStatus: resolvedStatus,
    CurrentStage: resolvedStage,
    RegisteredVia: resolvedRegisteredVia,
    DirectorDecision: rawDecision || undefined,
    Priority: clipStr(req.Priority, 50) || 'عام',
    Details: resolvedDetails,
    ReceptionNotes: resolvedReceptionNotes,
    department: resolvedDepartment,
    TargetDepartment: clipStr(req.TargetDepartment, 120) || resolvedDepartment,
    IsArchived: resolvedIsArchived,
    IsHistoricalImported: Boolean(req.IsHistoricalImported),
    IsDirectInstantRequest: Boolean(req.IsDirectInstantRequest),
    referredToOrganization: Boolean(req.referredToOrganization),
    CreatedAt: resolvedCreatedAt,
    CreatedBy: resolvedCreatedBy,
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

function requestToSupabaseRow(req: OfficeRequest): Record<string, any> {
  const clean = sanitizeRequestForFirestore(req);
  const nowIso = new Date().toISOString();
  return {
    id: clean.Request_ID,
    request_id: clean.Request_ID,
    citizen_id: clean.Citizen_ID,
    citizen_name: clean.CitizenName || 'مراجع',
    citizen_phone: clean.CitizenPhone || '',
    address: clean.Address || null,
    job: clean.Job || null,
    education: clean.Education || null,
    referral_source: clean.ReferralSource || null,
    entity: clean.Entity || 'غير محدد',
    details: clean.Details || '',
    reception_notes: clean.ReceptionNotes || null,
    director_notes: clean.DirectorNotes || null,
    other_notes: clean.OtherNotes || null,
    outgoing_number: clean.OutgoingNumber || null,
    outgoing_date: clean.OutgoingDate || null,
    processing_status: clean.ProcessingStatus || 'قيد الإجراء',
    delivery_status: clean.DeliveryStatus || clean.RequestStatus || 'غير مستلم',
    priority: clean.Priority || 'عام',
    stage: clean.CurrentStage || 'مدير المكتب',
    path_type: clean.pathType || clean.route || null,
    target_department: clean.TargetDepartment || clean.department || null,
    is_blocked: Boolean((clean as any).IsBlocked || clean.DirectorDecision === 'حظر' || clean.pathType === 'blocked'),
    is_archived: Boolean(clean.IsArchived),
    archived_at: toIsoTimestamptz(clean.ArchivedAt || clean.archivedAt, false),
    archived_by: clean.ArchivedBy || clean.archivedBy || null,
    referred_to_org: Boolean(clean.referredToOrganization),
    extra: clean,
    created_at: toIsoTimestamptz(clean.CreatedAt, true),
    updated_at: toIsoTimestamptz(clean.UpdatedAt, true) || nowIso,
    created_by: clean.CreatedBy || 'موظف النظام'
  };
}

function supabaseRowToRequest(row: any): OfficeRequest {
  const extra = row?.extra && typeof row.extra === 'object' ? row.extra : {};
  const id = String(row?.request_id || row?.id || extra.Request_ID || '').trim();
  const citizenId = String(row?.citizen_id || extra.Citizen_ID || '').trim();
  const pathType = row?.path_type || extra.pathType || extra.route || undefined;
  const directorDecision =
    extra.DirectorDecision ||
    (pathType === 'blocked'
      ? 'حظر'
      : pathType === 'private'
      ? 'خاص'
      : pathType === 'public'
      ? 'عام'
      : pathType === 'rejected'
      ? 'رفض'
      : undefined);
  const currentStage =
    row?.stage ||
    extra.CurrentStage ||
    (!directorDecision && !pathType ? 'مدير المكتب' : 'مدير الإدارة');
  const deliveryStatus = row?.delivery_status || extra.DeliveryStatus || extra.RequestStatus || 'غير مستلم';
  const createdAt =
    extra.CreatedAt ||
    (typeof row?.created_at === 'string' ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);

  return {
    ...extra,
    Request_ID: id,
    Citizen_ID: citizenId,
    CitizenName: String(row?.citizen_name || extra.CitizenName || 'مراجع').trim(),
    CitizenPhone: String(row?.citizen_phone ?? extra.CitizenPhone ?? '').trim(),
    ...(row?.address || extra.Address ? { Address: String(row?.address || extra.Address).trim() } : {}),
    ...(row?.job || extra.Job ? { Job: String(row?.job || extra.Job).trim() } : {}),
    ...(row?.education || extra.Education ? { Education: String(row?.education || extra.Education).trim() } : {}),
    ...(row?.referral_source || extra.ReferralSource
      ? { ReferralSource: String(row?.referral_source || extra.ReferralSource).trim() }
      : {}),
    Entity: String(row?.entity || extra.Entity || 'غير محدد').trim(),
    Details: String(row?.details ?? extra.Details ?? '').trim(),
    ...(row?.reception_notes || extra.ReceptionNotes
      ? { ReceptionNotes: String(row?.reception_notes || extra.ReceptionNotes) }
      : {}),
    ...(row?.director_notes || extra.DirectorNotes
      ? { DirectorNotes: String(row?.director_notes || extra.DirectorNotes) }
      : {}),
    ...(row?.other_notes || extra.OtherNotes
      ? { OtherNotes: String(row?.other_notes || extra.OtherNotes) }
      : {}),
    ...(row?.outgoing_number || extra.OutgoingNumber
      ? { OutgoingNumber: String(row?.outgoing_number || extra.OutgoingNumber).trim() }
      : {}),
    ...(row?.outgoing_date || extra.OutgoingDate
      ? { OutgoingDate: String(row?.outgoing_date || extra.OutgoingDate).trim() }
      : {}),
    ProcessingStatus: (row?.processing_status || extra.ProcessingStatus || 'قيد الإجراء') as any,
    DeliveryStatus: deliveryStatus as any,
    RequestStatus: (extra.RequestStatus || deliveryStatus) as any,
    Priority: (row?.priority || extra.Priority || 'عام') as any,
    CurrentStage: currentStage as any,
    ...(pathType ? { pathType, route: pathType } : {}),
    ...(directorDecision ? { DirectorDecision: directorDecision as any } : {}),
    ...(row?.target_department || extra.TargetDepartment
      ? { TargetDepartment: String(row?.target_department || extra.TargetDepartment) }
      : {}),
    IsArchived: typeof row?.is_archived === 'boolean' ? row.is_archived : Boolean(extra.IsArchived),
    ...(row?.archived_at || extra.ArchivedAt
      ? { ArchivedAt: String(extra.ArchivedAt || row.archived_at) }
      : {}),
    ...(row?.archived_by || extra.ArchivedBy
      ? { ArchivedBy: String(row?.archived_by || extra.ArchivedBy) }
      : {}),
    referredToOrganization:
      typeof row?.referred_to_org === 'boolean' ? row.referred_to_org : Boolean(extra.referredToOrganization),
    CreatedAt: createdAt,
    CreatedBy: String(row?.created_by || extra.CreatedBy || 'موظف النظام').trim(),
    UpdatedAt: String(row?.updated_at || extra.UpdatedAt || new Date().toISOString())
  } as OfficeRequest;
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

function userToSupabaseRow(user: User): Record<string, any> {
  const clean = sanitizeUserPayload(user);
  return {
    id: clean.User_ID,
    user_id: clean.User_ID,
    full_name: clean.FullName,
    phone: clean.Phone || null,
    status: clean.Status || 'active',
    department: clean.Department || null,
    username: clean.Username,
    password: clean.Password || '',
    role_arabic: clean.RoleArabic || '',
    // Store full permissions + role metadata inside `permissions` JSONB so zero fields are ever lost
    permissions: {
      list: clean.Permissions || [],
      role: clean.Role,
      jobTitle: clean.JobTitle || '',
      allowedSections: clean.AllowedSections || [],
      createdAt: clean.CreatedAt || new Date().toISOString().split('T')[0]
    },
    updated_at: new Date().toISOString()
  };
}

function supabaseRowToUser(row: any): User {
  const rawPerm = row?.permissions;
  const isObj = rawPerm && typeof rawPerm === 'object' && !Array.isArray(rawPerm);
  const permList: string[] = Array.isArray(rawPerm)
    ? rawPerm
    : isObj && Array.isArray(rawPerm.list)
    ? rawPerm.list
    : [];
  const allowedSections: string[] = isObj && Array.isArray(rawPerm.allowedSections)
    ? rawPerm.allowedSections
    : [];
  const rawUser: Partial<User> = {
    User_ID: String(row?.user_id || row?.id || '').trim(),
    Username: String(row?.username || row?.user_id || row?.id || '').trim(),
    Password: String(row?.password ?? '').trim(),
    FullName: String(row?.full_name || row?.username || 'موظف').trim(),
    Phone: row?.phone ? String(row.phone).trim() : undefined,
    Status: row?.status === 'frozen' ? 'frozen' : 'active',
    Department: String(row?.department || '').trim(),
    RoleArabic: String(row?.role_arabic || '').trim(),
    Role: (isObj && rawPerm.role ? rawPerm.role : undefined) as any,
    JobTitle: isObj && rawPerm.jobTitle ? String(rawPerm.jobTitle) : '',
    Permissions: permList,
    AllowedSections: allowedSections,
    CreatedAt: (isObj && rawPerm.createdAt) || new Date().toISOString().split('T')[0],
    UpdatedAt: row?.updated_at ? String(row.updated_at) : new Date().toISOString()
  };
  return normalizeUserRecord(rawUser as User);
}

function blacklistEntryToSupabaseRow(entry: FirestoreBlacklistEntry): Record<string, any> {
  const safeId = sanitizeFirestoreDocId(entry.Citizen_ID, 'BLK');
  return {
    id: safeId,
    citizen_id: safeId,
    full_name: clipStr(entry.FullName, 250) || 'مراجع محظور',
    phone1: clipStr(entry.Phone1, 50) || '',
    phone2: clipStr(entry.Phone2, 50) || null,
    blocked_by: clipStr(entry.BlockedBy, 150) || 'الإدارة',
    blocked_at: toIsoTimestamptz(entry.BlockedAt, true),
    reason: clipStr(entry.BlockReason, 1000) || 'محظور من قبل الإدارة'
  };
}

function supabaseRowToBlacklistEntry(row: any): FirestoreBlacklistEntry {
  const cid = String(row?.citizen_id || row?.id || '').trim();
  const fullName = String(row?.full_name || 'مراجع محظور').trim();
  const blockedAt = typeof row?.blocked_at === 'string' ? row.blocked_at : new Date().toISOString();
  return {
    Citizen_ID: cid,
    FullName: fullName,
    normalizedName: normalizeArabicEntityKey(fullName),
    Phone1: String(row?.phone1 || '').trim(),
    Phone2: row?.phone2 ? String(row.phone2).trim() : undefined,
    BlockReason: String(row?.reason || 'محظور من قبل الإدارة').trim(),
    BlockedAt: blockedAt,
    BlockedBy: String(row?.blocked_by || 'الإدارة').trim(),
    IsBlocked: true,
    UpdatedAt: blockedAt
  };
}

function customSectionToDepartmentRow(section: CustomSection): Record<string, any> {
  const safeId = sanitizeFirestoreDocId(section.id, 'SEC');
  const cleanSec = stripUndefinedProps({ ...section, id: safeId });
  return {
    id: safeId,
    title: clipStr(section.title, 200) || safeId,
    fields: {
      _kind: 'custom_section',
      section: cleanSec,
      fields: Array.isArray(section.fields) ? section.fields : []
    },
    created_at: toIsoTimestamptz((section as any).createdAt, true)
  };
}

function departmentRowToCustomSection(row: any): CustomSection | null {
  if (!row || !row.id) return null;
  const f = row.fields;
  if (f && typeof f === 'object' && !Array.isArray(f)) {
    if (f._kind === 'department_registry') return null;
    if (f._kind === 'custom_section' && f.section && typeof f.section === 'object') {
      return {
        ...f.section,
        id: String(f.section.id || row.id),
        title: String(row.title || f.section.title || row.id)
      } as CustomSection;
    }
  }
  if (String(row.id).startsWith('dept_registry_')) return null;
  // Support rows inserted directly into `departments` table from Supabase Table Editor
  return {
    id: String(row.id),
    title: String(row.title || row.id),
    description: '',
    icon: 'Layers',
    color: 'indigo',
    fields: Array.isArray(f) ? f : Array.isArray(f?.fields) ? f.fields : [],
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString()
  } as CustomSection;
}

// ============================================================================
// Paginated Select Helper (avoids PostgREST default 1000-row ceiling)
// ============================================================================

async function fetchAllRowsFromTable(
  table: string,
  options?: { keyLike?: string; orderCol?: string }
): Promise<{ rows: any[]; error: string | null }> {
  const PAGE = 1000;
  const allRows: any[] = [];
  let from = 0;

  while (true) {
    let q = supabase.from(table).select('*');
    if (options?.keyLike) {
      q = q.like('key', options.keyLike);
    }
    if (options?.orderCol) {
      q = q.order(options.orderCol, { ascending: false });
    }
    q = q.range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) {
      return { rows: allRows, error: error.message };
    }
    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
    if (from > 50000) break;
  }

  return { rows: allRows, error: null };
}

// ============================================================================
// Namespaced `system_settings` Helpers for Auxiliary Collections
// ============================================================================

function makeCollectionKey(colName: string, docId: string): string {
  return `col:${colName}:${docId}`;
}

function collectionKeyPrefix(colName: string): string {
  return `col:${colName}:`;
}

async function upsertSettingRow(key: string, value: any): Promise<void> {
  const { error } = await supabase
    .from(SUPABASE_TABLES.SYSTEM_SETTINGS)
    .upsert(
      {
        key,
        value: stripUndefinedAndOversizedDeep(value),
        updated_at: new Date().toISOString()
      },
      { onConflict: 'key' }
    );
  if (error) {
    throw new Error(error.message);
  }
}

async function deleteSettingRow(key: string): Promise<void> {
  const { error } = await supabase
    .from(SUPABASE_TABLES.SYSTEM_SETTINGS)
    .delete()
    .eq('key', key);
  if (error) {
    throw new Error(error.message);
  }
}

async function getSettingRow<T = any>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.SYSTEM_SETTINGS)
    .select('key, value, updated_at')
    .eq('key', key)
    .maybeSingle();
  if (error || !data) return null;
  return (data.value ?? null) as T | null;
}

async function fetchAuxiliaryCollection<T>(colName: string): Promise<T[]> {
  const prefix = collectionKeyPrefix(colName);
  const { rows, error } = await fetchAllRowsFromTable(SUPABASE_TABLES.SYSTEM_SETTINGS, {
    keyLike: `${prefix}%`
  });
  if (error) return [];
  return rows
    .map(r => r?.value)
    .filter(v => v && typeof v === 'object') as T[];
}

// ============================================================================
// Deleted Records Tombstone Registry (`col:deleted_records:<id>`)
// ============================================================================

export async function fsRegisterDeletedRecord(id: string, entityType: string): Promise<void> {
  if (!id || isFirestoreTemporarilyBlocked()) return;
  const safeId = sanitizeFirestoreDocId(id, 'DEL');
  try {
    await upsertSettingRow(makeCollectionKey(FS_COLLECTIONS.DELETED_RECORDS, safeId), {
      id: safeId,
      entityType,
      deletedAt: new Date().toISOString()
    });
    notifyLocalTableChange(FS_COLLECTIONS.DELETED_RECORDS);
  } catch (e) {
    console.warn('Supabase tombstone register notice:', e);
  }
}

export async function fsGetDeletedRecordIds(): Promise<string[]> {
  try {
    const items = await fetchAuxiliaryCollection<{ id?: string }>(FS_COLLECTIONS.DELETED_RECORDS);
    return items.map(x => String(x?.id || '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// ============================================================================
// 1. Citizen Operations (`citizens` table)
// ============================================================================

export async function fsSaveCitizen(citizen: Citizen): Promise<void> {
  const row = citizenToSupabaseRow(citizen);
  const path = `${SUPABASE_TABLES.CITIZENS}/${row.id}`;
  try {
    const { error } = await supabase
      .from(SUPABASE_TABLES.CITIZENS)
      .upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);

    // Clear stale tombstone if re-saving same ID
    void deleteSettingRow(makeCollectionKey(FS_COLLECTIONS.DELETED_RECORDS, row.id)).catch(() => {});
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.CITIZENS);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteArchivesForRecord(recordId: string): Promise<void> {
  if (!recordId) return;
  const safeId = sanitizeFirestoreDocId(recordId, 'REC');
  try {
    const prefix = collectionKeyPrefix(FS_COLLECTIONS.ARCHIVES);
    const { rows } = await fetchAllRowsFromTable(SUPABASE_TABLES.SYSTEM_SETTINGS, {
      keyLike: `${prefix}%`
    });
    const keysToDelete = rows
      .filter(r => r?.value?.recordId === safeId || r?.value?.citizenId === safeId || r?.value?.requestId === safeId)
      .map(r => r.key);
    if (keysToDelete.length > 0) {
      await supabase.from(SUPABASE_TABLES.SYSTEM_SETTINGS).delete().in('key', keysToDelete);
    }
  } catch (err) {
    console.warn('Supabase archive cascade delete notice:', err);
  }
}

async function deleteAuxByField(colName: string, fieldName: string, fieldValue: string): Promise<void> {
  if (!fieldValue) return;
  try {
    const prefix = collectionKeyPrefix(colName);
    const { rows } = await fetchAllRowsFromTable(SUPABASE_TABLES.SYSTEM_SETTINGS, {
      keyLike: `${prefix}%`
    });
    const keysToDelete = rows
      .filter(r => r?.value && String(r.value[fieldName] || '').trim() === fieldValue)
      .map(r => r.key);
    if (keysToDelete.length > 0) {
      for (let i = 0; i < keysToDelete.length; i += 200) {
        await supabase.from(SUPABASE_TABLES.SYSTEM_SETTINGS).delete().in('key', keysToDelete.slice(i, i + 200));
      }
      notifyLocalTableChange(colName);
    }
  } catch (err) {
    console.warn(`Supabase aux cascade delete (${colName}.${fieldName}) notice:`, err);
  }
}

export async function fsDeleteCitizen(citizenId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(citizenId, 'ONA');
  const path = `${SUPABASE_TABLES.CITIZENS}/${safeId}`;
  try {
    // Delete dependent requests & blacklist first (clean even if DB enforces FK constraints)
    await supabase.from(SUPABASE_TABLES.REQUESTS).delete().eq('citizen_id', safeId);
    await supabase.from(SUPABASE_TABLES.BLACKLIST).delete().or(`id.eq.${safeId},citizen_id.eq.${safeId}`);

    const { error } = await supabase
      .from(SUPABASE_TABLES.CITIZENS)
      .delete()
      .or(`id.eq.${safeId},citizen_id.eq.${safeId}`);
    if (error) throw new Error(error.message);

    await Promise.all([
      fsDeleteArchivesForRecord(safeId),
      deleteAuxByField(FS_COLLECTIONS.INTERVIEWS, 'Citizen_ID', safeId),
      deleteAuxByField(FS_COLLECTIONS.LETTERS, 'Citizen_ID', safeId),
      deleteAuxByField(FS_COLLECTIONS.CHEQUES, 'Citizen_ID', safeId),
      deleteAuxByField(FS_COLLECTIONS.ORGANIZATIONS, 'Citizen_ID', safeId),
      deleteAuxByField(FS_COLLECTIONS.DOCUMENTS, 'Citizen_ID', safeId),
      deleteAuxByField(FS_COLLECTIONS.NOTIFICATIONS, 'entityId', safeId),
      fsRegisterDeletedRecord(safeId, 'citizens')
    ]);

    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.CITIZENS);
    notifyLocalTableChange(FS_COLLECTIONS.REQUESTS);
    notifyLocalTableChange(FS_COLLECTIONS.BLACKLIST);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 2. Request Operations (`requests` table)
// ============================================================================

export async function fsSaveRequest(req: OfficeRequest): Promise<void> {
  const row = requestToSupabaseRow(req);
  const path = `${SUPABASE_TABLES.REQUESTS}/${row.id}`;
  try {
    let { error } = await supabase
      .from(SUPABASE_TABLES.REQUESTS)
      .upsert(row, { onConflict: 'id' });

    // If a DB foreign key requires parent citizen row first, auto-ensure minimal citizen row and retry
    if (error && (error.code === '23503' || String(error.message || '').toLowerCase().includes('foreign key'))) {
      const stubCitizen: Citizen = {
        Citizen_ID: row.citizen_id,
        FullName: row.citizen_name || 'مراجع',
        Phone1: row.citizen_phone || '',
        Gender: 'ذكر',
        District: 'الناصرية',
        SubDistrict: 'المركز',
        Job: row.job || '',
        Education: row.education || '',
        Rating: 'مؤيد',
        ReferralSource: row.referral_source || '',
        CreatedAt: req.CreatedAt || new Date().toISOString().split('T')[0],
        CreatedBy: row.created_by || 'النظام'
      };
      await supabase
        .from(SUPABASE_TABLES.CITIZENS)
        .upsert(citizenToSupabaseRow(stubCitizen), { onConflict: 'id', ignoreDuplicates: true });
      const retry = await supabase
        .from(SUPABASE_TABLES.REQUESTS)
        .upsert(row, { onConflict: 'id' });
      error = retry.error;
    }

    if (error) throw new Error(error.message);

    void deleteSettingRow(makeCollectionKey(FS_COLLECTIONS.DELETED_RECORDS, row.id)).catch(() => {});
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.REQUESTS);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteRequest(requestId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(requestId, 'REQ');
  const path = `${SUPABASE_TABLES.REQUESTS}/${safeId}`;
  try {
    const { error } = await supabase
      .from(SUPABASE_TABLES.REQUESTS)
      .delete()
      .or(`id.eq.${safeId},request_id.eq.${safeId}`);
    if (error) throw new Error(error.message);

    await Promise.all([
      fsDeleteArchivesForRecord(safeId),
      deleteAuxByField(FS_COLLECTIONS.NOTIFICATIONS, 'entityId', safeId),
      fsRegisterDeletedRecord(safeId, 'requests')
    ]);

    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.REQUESTS);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// 2b. High-Speed Chunked Upsert for Excel / Google Sheet Import
export async function fsBulkSaveCitizensAndRequests(
  citizensList: Citizen[],
  requestsList: OfficeRequest[]
): Promise<{ success: boolean; savedCitizens: number; savedRequests: number; error?: string }> {
  const citMap = new Map<string, Record<string, any>>();
  for (const c of citizensList || []) {
    if (!c || !c.Citizen_ID) continue;
    const row = citizenToSupabaseRow(c);
    citMap.set(row.id, row);
  }

  const reqMap = new Map<string, Record<string, any>>();
  for (const r of requestsList || []) {
    if (!r || !r.Request_ID || !r.Citizen_ID) continue;
    const row = requestToSupabaseRow(r);
    reqMap.set(row.id, row);
    // Ensure parent citizen exists in batch if missing
    if (row.citizen_id && !citMap.has(row.citizen_id)) {
      citMap.set(
        row.citizen_id,
        citizenToSupabaseRow({
          Citizen_ID: row.citizen_id,
          FullName: row.citizen_name || 'مراجع',
          Phone1: row.citizen_phone || '',
          Gender: 'ذكر',
          District: 'الناصرية',
          SubDistrict: 'المركز',
          Job: row.job || '',
          Education: row.education || '',
          Rating: 'مؤيد',
          ReferralSource: row.referral_source || '',
          CreatedAt: r.CreatedAt || new Date().toISOString().split('T')[0],
          CreatedBy: row.created_by || 'استيراد البيانات'
        })
      );
    }
  }

  const citRows = Array.from(citMap.values());
  const reqRows = Array.from(reqMap.values());
  let savedCitizens = 0;
  let savedRequests = 0;
  let lastError: string | undefined;
  const CHUNK = 200;

  // 1. Upsert citizens FIRST
  for (let i = 0; i < citRows.length; i += CHUNK) {
    const slice = citRows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(SUPABASE_TABLES.CITIZENS)
      .upsert(slice, { onConflict: 'id' });
    if (!error) {
      savedCitizens += slice.length;
    } else {
      lastError = error.message;
      // Fallback row-by-row so 1 bad row never drops the chunk
      for (const row of slice) {
        const single = await supabase
          .from(SUPABASE_TABLES.CITIZENS)
          .upsert(row, { onConflict: 'id' });
        if (!single.error) savedCitizens++;
        else lastError = single.error.message;
      }
    }
  }

  // 2. Upsert requests SECOND
  for (let i = 0; i < reqRows.length; i += CHUNK) {
    const slice = reqRows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from(SUPABASE_TABLES.REQUESTS)
      .upsert(slice, { onConflict: 'id' });
    if (!error) {
      savedRequests += slice.length;
    } else {
      lastError = error.message;
      for (const row of slice) {
        const single = await supabase
          .from(SUPABASE_TABLES.REQUESTS)
          .upsert(row, { onConflict: 'id' });
        if (!single.error) savedRequests++;
        else lastError = single.error.message;
      }
    }
  }

  const ok = savedCitizens + savedRequests > 0 || (citRows.length === 0 && reqRows.length === 0);
  if (ok && savedCitizens + savedRequests > 0) {
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.CITIZENS);
    notifyLocalTableChange(FS_COLLECTIONS.REQUESTS);
  }
  return {
    success: ok,
    savedCitizens,
    savedRequests,
    error: lastError
  };
}

// ============================================================================
// 3-6b. Auxiliary Operational Collections (`system_settings` namespaced rows)
// ============================================================================

export async function fsSaveInterview(interview: Interview): Promise<void> {
  const safeId = sanitizeFirestoreDocId(interview.Interview_ID, 'INT');
  const nowIso = new Date().toISOString();
  try {
    await upsertSettingRow(makeCollectionKey(FS_COLLECTIONS.INTERVIEWS, safeId), {
      ...interview,
      Interview_ID: safeId,
      UpdatedAt: nowIso,
      updatedAt: nowIso
    });
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.INTERVIEWS);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${FS_COLLECTIONS.INTERVIEWS}/${safeId}`);
  }
}

export async function fsDeleteInterview(interviewId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(interviewId, 'INT');
  try {
    await deleteSettingRow(makeCollectionKey(FS_COLLECTIONS.INTERVIEWS, safeId));
    await fsRegisterDeletedRecord(safeId, 'interviews');
    notifyLocalTableChange(FS_COLLECTIONS.INTERVIEWS);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${FS_COLLECTIONS.INTERVIEWS}/${safeId}`);
  }
}

export async function fsSaveOfficialLetter(letter: OfficialLetter): Promise<void> {
  const safeId = sanitizeFirestoreDocId(letter.Letter_ID, 'LET');
  const nowIso = new Date().toISOString();
  try {
    await upsertSettingRow(makeCollectionKey(FS_COLLECTIONS.LETTERS, safeId), {
      ...letter,
      Letter_ID: safeId,
      UpdatedAt: nowIso,
      updatedAt: nowIso
    });
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.LETTERS);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${FS_COLLECTIONS.LETTERS}/${safeId}`);
  }
}

export async function fsDeleteOfficialLetter(letterId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(letterId, 'LET');
  try {
    await deleteSettingRow(makeCollectionKey(FS_COLLECTIONS.LETTERS, safeId));
    await fsRegisterDeletedRecord(safeId, 'letters');
    notifyLocalTableChange(FS_COLLECTIONS.LETTERS);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${FS_COLLECTIONS.LETTERS}/${safeId}`);
  }
}

export async function fsSaveCheque(cheque: ChequeRecord): Promise<void> {
  const safeId = sanitizeFirestoreDocId(cheque.id, 'CHQ');
  const nowIso = new Date().toISOString();
  try {
    await upsertSettingRow(makeCollectionKey(FS_COLLECTIONS.CHEQUES, safeId), {
      ...cheque,
      id: safeId,
      UpdatedAt: nowIso,
      updatedAt: nowIso
    });
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.CHEQUES);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${FS_COLLECTIONS.CHEQUES}/${safeId}`);
  }
}

export async function fsDeleteCheque(chequeId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(chequeId, 'CHQ');
  try {
    await deleteSettingRow(makeCollectionKey(FS_COLLECTIONS.CHEQUES, safeId));
    await fsRegisterDeletedRecord(safeId, 'cheques');
    notifyLocalTableChange(FS_COLLECTIONS.CHEQUES);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${FS_COLLECTIONS.CHEQUES}/${safeId}`);
  }
}

export async function fsSaveOrgRecord(record: OrganizationRecord): Promise<void> {
  const safeId = sanitizeFirestoreDocId(record.Org_ID || record.Citizen_ID, 'ORG');
  const nowIso = new Date().toISOString();
  try {
    await upsertSettingRow(makeCollectionKey(FS_COLLECTIONS.ORGANIZATIONS, safeId), {
      ...record,
      Org_ID: safeId,
      UpdatedAt: nowIso,
      updatedAt: nowIso
    });
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.ORGANIZATIONS);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${FS_COLLECTIONS.ORGANIZATIONS}/${safeId}`);
  }
}

export async function fsDeleteOrgRecord(orgIdOrCitizenId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(orgIdOrCitizenId, 'ORG');
  try {
    await deleteSettingRow(makeCollectionKey(FS_COLLECTIONS.ORGANIZATIONS, safeId));
    await deleteAuxByField(FS_COLLECTIONS.ORGANIZATIONS, 'Citizen_ID', safeId);
    await fsRegisterDeletedRecord(safeId, 'organizations');
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.ORGANIZATIONS);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${FS_COLLECTIONS.ORGANIZATIONS}/${safeId}`);
  }
}

export async function fsSaveDocument(docItem: DocumentArchiveItem): Promise<void> {
  const safeId = sanitizeFirestoreDocId(docItem.Doc_ID, 'DOC');
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
    await upsertSettingRow(makeCollectionKey(FS_COLLECTIONS.DOCUMENTS, safeId), payload);
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.DOCUMENTS);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${FS_COLLECTIONS.DOCUMENTS}/${safeId}`);
  }
}

export async function fsDeleteDocument(docId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(docId, 'DOC');
  try {
    await deleteSettingRow(makeCollectionKey(FS_COLLECTIONS.DOCUMENTS, safeId));
    await fsRegisterDeletedRecord(safeId, 'documents');
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.DOCUMENTS);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${FS_COLLECTIONS.DOCUMENTS}/${safeId}`);
  }
}

// ============================================================================
// 7. Users / Staff Operations (`users` table)
// ============================================================================

export async function fsSaveUser(user: User): Promise<void> {
  const row = userToSupabaseRow(user);
  const path = `${SUPABASE_TABLES.USERS}/${row.id}`;
  try {
    const { error } = await supabase
      .from(SUPABASE_TABLES.USERS)
      .upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.USERS);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsSyncAllUsers(usersList: User[]): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const rows = (usersList || [])
      .filter(u => u && u.User_ID && u.Username)
      .map(userToSupabaseRow);
    if (rows.length === 0) return { success: true, count: 0 };
    const { error } = await supabase
      .from(SUPABASE_TABLES.USERS)
      .upsert(rows, { onConflict: 'id' });
    if (error) return { success: false, count: 0, error: error.message };
    notifyLocalTableChange(FS_COLLECTIONS.USERS);
    return { success: true, count: rows.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || String(err) };
  }
}

export async function fsCheckConnection(): Promise<{ connected: boolean; error?: string }> {
  const res = await testSupabaseConnection();
  return { connected: res.ok, error: res.error };
}

export async function fsDeleteUser(userId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(userId, 'USR');
  const path = `${SUPABASE_TABLES.USERS}/${safeId}`;
  try {
    const { error } = await supabase
      .from(SUPABASE_TABLES.USERS)
      .delete()
      .or(`id.eq.${safeId},user_id.eq.${safeId}`);
    if (error) throw new Error(error.message);
    await fsRegisterDeletedRecord(safeId, 'users');
    notifyLocalTableChange(FS_COLLECTIONS.USERS);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 8. System Settings & Developer Passcode (`system_settings` table)
// ============================================================================

export async function fsSaveSettings(settings: Partial<SystemSettings>): Promise<void> {
  const nowIso = new Date().toISOString();

  // Merge with existing settings so partial updates never wipe other keys
  const existingGeneral = (await getSettingRow<Partial<SystemSettings>>(FS_SETTINGS_DOCS.GENERAL)) || {};
  const mergedGeneral = stripUndefinedAndOversizedDeep({
    ...existingGeneral,
    ...settings,
    UpdatedAt: nowIso,
    updatedAt: nowIso
  });

  const existingCloud = (await getSettingRow<Record<string, any>>('cloud_config')) || {};
  const cloudPatch: Record<string, any> = { ...existingCloud, updatedAt: nowIso, UpdatedAt: nowIso };
  const cloudKeys: (keyof SystemSettings)[] = [
    'googleDriveFolderId',
    'googleSheetId',
    'activeGoogleSheetId',
    'appsScriptUrl',
    'googleAppsScriptUrl',
    'allowAdminOpenDriveFolder',
    'lastOutgoingNumberNasiriyah',
    'lastOutgoingNumberSuq',
    'outgoingBaselineMode',
    'outgoingBaselineSetAt',
    'outgoingBaselineLabel',
    'defaultOutgoingDate',
    'lastRegisteredName',
    'lastOutgoingRaw',
    'appName',
    'officeName',
    'deputyName',
    'deputyTitle',
    'province',
    'officeAddress',
    'hotline',
    'footerText',
    'loadingScreenTitle',
    'loadingScreenSubtitle',
    'loginWelcomeTitle',
    'loginWelcomeSubtitle',
    'loginHeaderBadgeText',
    'loginBadgeText',
    'loginButtonText',
    'loginPasscodeTabText',
    'loginCredentialsTabText',
    'loginSecurityBadgeText',
    'loginFooterCopyrightText'
  ];

  let hasCloudPatch = false;
  for (const k of cloudKeys) {
    if (settings[k] !== undefined) {
      cloudPatch[k] = settings[k];
      hasCloudPatch = true;
    }
  }
  if (settings.logoUrl && settings.logoUrl.length < 200000) {
    cloudPatch.logoUrl = settings.logoUrl;
    hasCloudPatch = true;
  }

  try {
    if (hasCloudPatch) {
      await upsertSettingRow('cloud_config', cloudPatch);
    }
    await upsertSettingRow(FS_SETTINGS_DOCS.GENERAL, mergedGeneral);
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.SETTINGS);
    notifyLocalTableChange('settings:general');
    notifyLocalTableChange('settings:cloud_config');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SUPABASE_TABLES.SYSTEM_SETTINGS}/general`);
  }
}

export async function fsGetSettings(): Promise<Partial<SystemSettings> | null> {
  try {
    const [generalData, cloudData] = await Promise.all([
      getSettingRow<Partial<SystemSettings>>(FS_SETTINGS_DOCS.GENERAL),
      getSettingRow<Partial<SystemSettings>>('cloud_config')
    ]);
    const merged = { ...(cloudData || {}), ...(generalData || {}) };
    return Object.keys(merged).length > 0 ? merged : null;
  } catch (error) {
    console.warn('Supabase getSettings warn:', error);
    return null;
  }
}

export async function fsSaveDeveloperPasscode(passcode: string): Promise<void> {
  try {
    await upsertSettingRow(FS_SETTINGS_DOCS.DEVELOPER_AUTH, {
      developerPasscode: passcode,
      updatedAt: new Date().toISOString()
    });
    notifyLocalTableChange(FS_COLLECTIONS.SETTINGS);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SUPABASE_TABLES.SYSTEM_SETTINGS}/developer_auth`);
  }
}

export async function fsGetDeveloperPasscode(): Promise<string | null> {
  try {
    const data = await getSettingRow<{ developerPasscode?: string }>(FS_SETTINGS_DOCS.DEVELOPER_AUTH);
    if (data?.developerPasscode) return String(data.developerPasscode);
    return null;
  } catch {
    return null;
  }
}

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

    const { rows: userRows } = await fetchAllRowsFromTable(SUPABASE_TABLES.USERS);
    const list = userRows.map(supabaseRowToUser);

    for (const u of list) {
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

    if (!isDualMode || cleanUser === 'developer' || cleanUser === 'admin') {
      const authDoc = await getSettingRow<any>(FS_SETTINGS_DOCS.DEVELOPER_AUTH);
      const storedCode = normalizeDigits(String(authDoc?.developerPasscode || ''));
      if (storedCode && (rawCode === storedCode || cleanPass === storedCode)) {
        return { success: true, isDeveloper: true, matchedSource: 'firebase_passcode' };
      }

      const genDoc = await getSettingRow<any>(FS_SETTINGS_DOCS.GENERAL);
      const storedPass = normalizeDigits(String(genDoc?.developerPasscode || genDoc?.passcode || ''));
      if (storedPass && (rawCode === storedPass || cleanPass === storedPass)) {
        return { success: true, isDeveloper: true, matchedSource: 'firebase_passcode' };
      }
    }

    return { success: false };
  } catch (err) {
    console.warn('Supabase fsVerifyLogin error:', err);
    return { success: false };
  }
}

// ============================================================================
// 9. Custom Dynamic Sections (`departments` table)
// ============================================================================

export async function fsSaveCustomSection(section: CustomSection): Promise<void> {
  const row = customSectionToDepartmentRow(section);
  const path = `${SUPABASE_TABLES.DEPARTMENTS}/${row.id}`;
  try {
    const { error } = await supabase
      .from(SUPABASE_TABLES.DEPARTMENTS)
      .upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.CUSTOM_SECTIONS);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteCustomSection(sectionId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(sectionId, 'SEC');
  const path = `${SUPABASE_TABLES.DEPARTMENTS}/${safeId}`;
  try {
    const { error } = await supabase
      .from(SUPABASE_TABLES.DEPARTMENTS)
      .delete()
      .eq('id', safeId);
    if (error) throw new Error(error.message);

    await fsRegisterDeletedRecord(safeId, 'custom_sections');
    await deleteAuxByField(FS_COLLECTIONS.CUSTOM_RECORDS, 'sectionId', safeId);
    notifyLocalTableChange(FS_COLLECTIONS.CUSTOM_SECTIONS);
    notifyLocalTableChange(FS_COLLECTIONS.CUSTOM_RECORDS);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// 10. Custom Dynamic Records (`system_settings` -> `col:custom_records:<id>`)
// ============================================================================

export async function fsSaveCustomRecord(record: CustomSectionRecord): Promise<void> {
  const safeId = sanitizeFirestoreDocId(record.id, 'REC');
  try {
    await upsertSettingRow(makeCollectionKey(FS_COLLECTIONS.CUSTOM_RECORDS, safeId), {
      ...record,
      id: safeId,
      updatedAt: new Date().toISOString()
    });
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.CUSTOM_RECORDS);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${FS_COLLECTIONS.CUSTOM_RECORDS}/${safeId}`);
  }
}

export async function fsDeleteCustomRecord(recordId: string): Promise<void> {
  const safeId = sanitizeFirestoreDocId(recordId, 'REC');
  try {
    await deleteSettingRow(makeCollectionKey(FS_COLLECTIONS.CUSTOM_RECORDS, safeId));
    await fsRegisterDeletedRecord(safeId, 'custom_records');
    notifyLocalTableChange(FS_COLLECTIONS.CUSTOM_RECORDS);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${FS_COLLECTIONS.CUSTOM_RECORDS}/${safeId}`);
  }
}

// ============================================================================
// 11. Dropdown Items (`system_settings` -> `col:dropdowns:<id>`)
// ============================================================================

export async function fsSaveDropdown(dropdown: DropdownItem): Promise<void> {
  const docId = buildSafeDropdownDocId(dropdown.Category, dropdown.ItemValue, dropdown.id);
  try {
    await upsertSettingRow(makeCollectionKey(FS_COLLECTIONS.DROPDOWNS, docId), {
      id: docId,
      Category: dropdown.Category,
      ItemValue: dropdown.ItemValue
    });
    notifyLocalTableChange(FS_COLLECTIONS.DROPDOWNS);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${FS_COLLECTIONS.DROPDOWNS}/${docId}`);
  }
}

export async function fsDeleteDropdown(category: string, value: string, existingId?: string): Promise<void> {
  const docId = buildSafeDropdownDocId(category, value, existingId);
  try {
    await deleteSettingRow(makeCollectionKey(FS_COLLECTIONS.DROPDOWNS, docId));
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
    notifyLocalTableChange(FS_COLLECTIONS.DROPDOWNS);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${FS_COLLECTIONS.DROPDOWNS}/${docId}`);
  }
}

// ============================================================================
// 12. Audit Logs & Notifications (`system_settings`)
// ============================================================================

export async function fsAddAuditLog(log: AuditLog): Promise<void> {
  if (!log || !log.Log_ID) return;
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
    await upsertSettingRow(makeCollectionKey(FS_COLLECTIONS.AUDIT_LOGS, safeId), payload);
    notifyLocalTableChange(FS_COLLECTIONS.AUDIT_LOGS);
  } catch (error) {
    console.warn('Supabase audit log notice:', error);
  }
}

export async function fsSyncSettingsStructure(outgoingMeta?: {
  lastOutgoingNumberNasiriyah?: number;
  lastOutgoingNumberSuq?: number;
  outgoingBaselineSetAt?: string;
  outgoingBaselineLabel?: string;
}): Promise<void> {
  try {
    await upsertSettingRow(FS_SETTINGS_DOCS.SCHEMA_ALIGNMENT, {
      alignedWithGoogleSheets: true,
      primaryDatabase: 'supabase',
      collections: FIRESTORE_SHEET_ALIGNMENT,
      updatedAt: new Date().toISOString()
    });
    if (outgoingMeta) {
      await upsertSettingRow(FS_SETTINGS_DOCS.OUTGOING_COUNTER, {
        ...outgoingMeta,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn('Supabase settings structure sync notice:', e);
  }
}

export async function fsSaveNotification(notif: UrgentNotification): Promise<void> {
  if (!notif || !notif.id) return;
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
    await upsertSettingRow(makeCollectionKey(FS_COLLECTIONS.NOTIFICATIONS, safeId), payload);
    notifyLocalTableChange(FS_COLLECTIONS.NOTIFICATIONS);
  } catch (error) {
    console.warn('Supabase save notification notice:', error);
  }
}

export async function fsMarkNotificationRead(id: string, read = true): Promise<void> {
  if (!id) return;
  const safeId = sanitizeFirestoreDocId(id, 'NOTIF');
  const key = makeCollectionKey(FS_COLLECTIONS.NOTIFICATIONS, safeId);
  try {
    const existing = await getSettingRow<any>(key);
    if (existing) {
      await upsertSettingRow(key, { ...existing, id: safeId, read: Boolean(read) });
      notifyLocalTableChange(FS_COLLECTIONS.NOTIFICATIONS);
    }
  } catch (error) {
    console.warn('Supabase mark notification read notice:', error);
  }
}

export async function fsDeleteNotification(id: string): Promise<void> {
  if (!id) return;
  const safeId = sanitizeFirestoreDocId(id, 'NOTIF');
  try {
    await deleteSettingRow(makeCollectionKey(FS_COLLECTIONS.NOTIFICATIONS, safeId));
    notifyLocalTableChange(FS_COLLECTIONS.NOTIFICATIONS);
  } catch (error) {
    console.warn('Supabase delete notification notice:', error);
  }
}

// ============================================================================
// 13. Bulk Push & Bulk Pull
// ============================================================================

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

    // 1. Citizens & Requests
    const crRes = await fsBulkSaveCitizensAndRequests(data.citizens || [], data.requests || []);
    total += crRes.savedCitizens + crRes.savedRequests;

    // 2. Users
    if (Array.isArray(data.users) && data.users.length > 0) {
      const uRes = await fsSyncAllUsers(data.users);
      total += uRes.count;
    }

    // 3. Custom Sections -> `departments`
    if (Array.isArray(data.customSections) && data.customSections.length > 0) {
      const secRows = data.customSections.filter(s => s && s.id && s.title).map(customSectionToDepartmentRow);
      if (secRows.length > 0) {
        const { error } = await supabase
          .from(SUPABASE_TABLES.DEPARTMENTS)
          .upsert(secRows, { onConflict: 'id' });
        if (!error) total += secRows.length;
      }
    }

    // 4. Auxiliary collections -> `system_settings` batch upsert
    const nowIso = new Date().toISOString();
    const settingRows: Array<{ key: string; value: any; updated_at: string }> = [];

    (data.interviews || []).forEach(i => {
      if (!i?.Interview_ID) return;
      const safeId = sanitizeFirestoreDocId(i.Interview_ID, 'INT');
      settingRows.push({
        key: makeCollectionKey(FS_COLLECTIONS.INTERVIEWS, safeId),
        value: stripUndefinedAndOversizedDeep({ ...i, Interview_ID: safeId }),
        updated_at: nowIso
      });
    });
    (data.officialLetters || []).forEach(l => {
      if (!l?.Letter_ID) return;
      const safeId = sanitizeFirestoreDocId(l.Letter_ID, 'LET');
      settingRows.push({
        key: makeCollectionKey(FS_COLLECTIONS.LETTERS, safeId),
        value: stripUndefinedAndOversizedDeep({ ...l, Letter_ID: safeId }),
        updated_at: nowIso
      });
    });
    (data.cheques || []).forEach(ch => {
      if (!ch?.id) return;
      const safeId = sanitizeFirestoreDocId(ch.id, 'CHQ');
      settingRows.push({
        key: makeCollectionKey(FS_COLLECTIONS.CHEQUES, safeId),
        value: stripUndefinedAndOversizedDeep({ ...ch, id: safeId }),
        updated_at: nowIso
      });
    });
    (data.organizationRecords || []).forEach(o => {
      if (!o?.Citizen_ID) return;
      const safeId = sanitizeFirestoreDocId(o.Org_ID || o.Citizen_ID, 'ORG');
      settingRows.push({
        key: makeCollectionKey(FS_COLLECTIONS.ORGANIZATIONS, safeId),
        value: stripUndefinedAndOversizedDeep({ ...o, Org_ID: safeId }),
        updated_at: nowIso
      });
    });
    (data.customRecords || []).forEach(cr => {
      if (!cr?.id || !cr?.sectionId) return;
      const safeId = sanitizeFirestoreDocId(cr.id, 'REC');
      settingRows.push({
        key: makeCollectionKey(FS_COLLECTIONS.CUSTOM_RECORDS, safeId),
        value: stripUndefinedAndOversizedDeep({ ...cr, id: safeId }),
        updated_at: nowIso
      });
    });
    (data.dropdowns || []).forEach(dd => {
      if (!dd?.Category || !dd?.ItemValue) return;
      const safeId = buildSafeDropdownDocId(dd.Category, dd.ItemValue, dd.id);
      settingRows.push({
        key: makeCollectionKey(FS_COLLECTIONS.DROPDOWNS, safeId),
        value: { id: safeId, Category: dd.Category, ItemValue: dd.ItemValue },
        updated_at: nowIso
      });
    });

    if (data.systemSettings) {
      settingRows.push({
        key: FS_SETTINGS_DOCS.GENERAL,
        value: stripUndefinedAndOversizedDeep(data.systemSettings),
        updated_at: nowIso
      });
      if (data.systemSettings.developerPasscode) {
        settingRows.push({
          key: FS_SETTINGS_DOCS.DEVELOPER_AUTH,
          value: { developerPasscode: data.systemSettings.developerPasscode, updatedAt: nowIso },
          updated_at: nowIso
        });
      }
    }

    const CHUNK = 200;
    for (let i = 0; i < settingRows.length; i += CHUNK) {
      const slice = settingRows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from(SUPABASE_TABLES.SYSTEM_SETTINGS)
        .upsert(slice, { onConflict: 'key' });
      if (!error) total += slice.length;
    }

    if (total > 0) {
      updateFirebaseHealth('connected', null);
    }
    return { success: true, count: total };
  } catch (err: any) {
    console.error('Supabase fsBulkPushAll error:', err);
    return { success: false, count: 0, error: err?.message || String(err) };
  }
}

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
    const [
      citRes,
      reqRes,
      blkRes,
      usrRes,
      deptRes,
      settingsRes
    ] = await Promise.all([
      fetchAllRowsFromTable(SUPABASE_TABLES.CITIZENS),
      fetchAllRowsFromTable(SUPABASE_TABLES.REQUESTS),
      fetchAllRowsFromTable(SUPABASE_TABLES.BLACKLIST),
      fetchAllRowsFromTable(SUPABASE_TABLES.USERS),
      fetchAllRowsFromTable(SUPABASE_TABLES.DEPARTMENTS),
      fetchAllRowsFromTable(SUPABASE_TABLES.SYSTEM_SETTINGS)
    ]);

    const criticalErrors: string[] = [];
    if (citRes.error) criticalErrors.push(`citizens: ${citRes.error}`);
    if (reqRes.error) criticalErrors.push(`requests: ${reqRes.error}`);

    if (criticalErrors.length > 0) {
      const errMsg = `فشل جلب البيانات من Supabase (${criticalErrors.join(' | ')})`;
      updateFirebaseHealth('error', errMsg);
      pushCloudSyncAlert({
        severity: 'error',
        target: 'firebase',
        title: 'تعذر جلب المعاملات من Supabase',
        message: 'حدث خطأ أثناء تحميل المراجعين والمعاملات من قاعدة البيانات.',
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

    const citizensMap = new Map<string, Citizen>();
    citRes.rows.map(supabaseRowToCitizen).forEach(c => {
      if (c.Citizen_ID) citizensMap.set(c.Citizen_ID, c);
    });
    // Merge blacklist flags onto citizens cleanly
    blkRes.rows.map(supabaseRowToBlacklistEntry).forEach(b => {
      const existing = citizensMap.get(b.Citizen_ID);
      if (existing) {
        citizensMap.set(b.Citizen_ID, {
          ...existing,
          IsBlocked: true,
          BlockReason: b.BlockReason || existing.BlockReason,
          BlockedAt: b.BlockedAt || existing.BlockedAt,
          BlockedBy: b.BlockedBy || existing.BlockedBy
        });
      }
    });

    const citizens = Array.from(citizensMap.values());
    const requests = reqRes.rows.map(supabaseRowToRequest).filter(r => r.Request_ID);
    const users = usrRes.rows.map(supabaseRowToUser).filter(u => u.User_ID);
    const customSections = deptRes.rows
      .map(departmentRowToCustomSection)
      .filter((s): s is CustomSection => Boolean(s && s.id));

    // Unpack auxiliary collections & settings from `system_settings`
    const interviews: Interview[] = [];
    const officialLetters: OfficialLetter[] = [];
    const cheques: ChequeRecord[] = [];
    const organizationRecords: OrganizationRecord[] = [];
    const customRecords: CustomSectionRecord[] = [];
    const documents: DocumentArchiveItem[] = [];
    const dropdowns: DropdownItem[] = [];
    const notifications: UrgentNotification[] = [];
    const auditLogs: AuditLog[] = [];
    const deletedIdsSet = new Set<string>();
    let generalSettings: Partial<SystemSettings> | undefined;
    let cloudSettings: Partial<SystemSettings> | undefined;
    let developerPasscode: string | undefined;

    for (const row of settingsRes.rows) {
      const key = String(row?.key || '');
      const val = row?.value;
      if (!val || typeof val !== 'object') continue;

      if (key === FS_SETTINGS_DOCS.GENERAL) {
        generalSettings = val as Partial<SystemSettings>;
      } else if (key === 'cloud_config') {
        cloudSettings = val as Partial<SystemSettings>;
      } else if (key === FS_SETTINGS_DOCS.DEVELOPER_AUTH) {
        if (val.developerPasscode) developerPasscode = String(val.developerPasscode);
      } else if (key.startsWith('col:interviews:')) {
        if (val.Interview_ID) interviews.push(val as Interview);
      } else if (key.startsWith('col:letters:')) {
        if (val.Letter_ID) officialLetters.push(val as OfficialLetter);
      } else if (key.startsWith('col:cheques:')) {
        if (val.id) cheques.push(val as ChequeRecord);
      } else if (key.startsWith('col:organizations:')) {
        if (val.Citizen_ID || val.Org_ID) organizationRecords.push(val as OrganizationRecord);
      } else if (key.startsWith('col:custom_records:')) {
        if (val.id) customRecords.push(val as CustomSectionRecord);
      } else if (key.startsWith('col:documents:')) {
        if (val.Doc_ID) documents.push(val as DocumentArchiveItem);
      } else if (key.startsWith('col:dropdowns:')) {
        if (val.Category && val.ItemValue) dropdowns.push(val as DropdownItem);
      } else if (key.startsWith('col:notifications:')) {
        if (val.id && val.title) notifications.push(val as UrgentNotification);
      } else if (key.startsWith('col:audit_logs:')) {
        if (val.Log_ID) auditLogs.push(val as AuditLog);
      } else if (key.startsWith('col:deleted_records:')) {
        if (val.id) deletedIdsSet.add(String(val.id));
      }
    }

    const mergedSettings =
      generalSettings || cloudSettings
        ? { ...(cloudSettings || {}), ...(generalSettings || {}) }
        : undefined;

    notifications.sort((a, b) => (Date.parse(b.createdAtIso || '') || 0) - (Date.parse(a.createdAtIso || '') || 0));
    auditLogs.sort((a, b) => {
      const tsA = Date.parse((a as any).createdAtIso || a.Timestamp || '') || 0;
      const tsB = Date.parse((b as any).createdAtIso || b.Timestamp || '') || 0;
      return tsB - tsA;
    });

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
      notifications: notifications.slice(0, 80),
      auditLogs: auditLogs.slice(0, 600),
      deletedIds: Array.from(deletedIdsSet),
      systemSettings: mergedSettings,
      developerPasscode
    };
  } catch (err: any) {
    console.error('Supabase fsBulkPullAll error:', err);
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
      error: err?.message || String(err)
    };
  }
}

// ============================================================================
// 14. Wipe Helpers (Preserve Users, Settings, Dropdowns, Custom Sections)
// ============================================================================

async function wipeAllRowsByNotNullId(table: string): Promise<number> {
  const { rows } = await fetchAllRowsFromTable(table);
  if (rows.length === 0) return 0;
  const ids = rows.map(r => r.id).filter(Boolean);
  for (let i = 0; i < ids.length; i += 200) {
    await supabase.from(table).delete().in('id', ids.slice(i, i + 200));
  }
  return ids.length;
}

async function wipeAuxiliaryPrefix(colName: string): Promise<number> {
  const prefix = collectionKeyPrefix(colName);
  const { rows } = await fetchAllRowsFromTable(SUPABASE_TABLES.SYSTEM_SETTINGS, {
    keyLike: `${prefix}%`
  });
  if (rows.length === 0) return 0;
  const keys = rows.map(r => r.key).filter(Boolean);
  for (let i = 0; i < keys.length; i += 200) {
    await supabase.from(SUPABASE_TABLES.SYSTEM_SETTINGS).delete().in('key', keys.slice(i, i + 200));
  }
  return keys.length;
}

export async function fsWipeAllCollections(): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    // Delete requests & blacklist before citizens to respect any FK constraints
    const reqCount = await wipeAllRowsByNotNullId(SUPABASE_TABLES.REQUESTS);
    const blkCount = await wipeAllRowsByNotNullId(SUPABASE_TABLES.BLACKLIST);
    const citCount = await wipeAllRowsByNotNullId(SUPABASE_TABLES.CITIZENS);

    const auxCols = [
      FS_COLLECTIONS.ARCHIVES,
      FS_COLLECTIONS.DOCUMENTS,
      FS_COLLECTIONS.INTERVIEWS,
      FS_COLLECTIONS.LETTERS,
      FS_COLLECTIONS.CHEQUES,
      FS_COLLECTIONS.ORGANIZATIONS,
      FS_COLLECTIONS.CUSTOM_RECORDS,
      FS_COLLECTIONS.AUDIT_LOGS,
      FS_COLLECTIONS.NOTIFICATIONS,
      FS_COLLECTIONS.DELETED_RECORDS
    ];
    const auxCounts = await Promise.all(auxCols.map(wipeAuxiliaryPrefix));
    const deletedCount = reqCount + blkCount + citCount + auxCounts.reduce((a, b) => a + b, 0);

    await fsSaveSettings({
      lastOutgoingNumberNasiriyah: 0,
      lastOutgoingNumberSuq: 0
    }).catch(() => {});

    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.CITIZENS);
    notifyLocalTableChange(FS_COLLECTIONS.REQUESTS);
    notifyLocalTableChange(FS_COLLECTIONS.BLACKLIST);
    auxCols.forEach(notifyLocalTableChange);
    return { success: true, deletedCount };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function fsWipeSelectedCollections(
  sectionKeys: string[]
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const keys = Array.from(new Set((sectionKeys || []).map(k => String(k || '').trim()).filter(Boolean)));
    if (keys.length === 0) return { success: true, deletedCount: 0 };

    let deletedCount = 0;
    const customSectionIdsToWipe: string[] = [];

    for (const k of keys) {
      if (k === 'requests') {
        deletedCount += await wipeAllRowsByNotNullId(SUPABASE_TABLES.REQUESTS);
        notifyLocalTableChange(FS_COLLECTIONS.REQUESTS);
      } else if (k === 'citizens') {
        deletedCount += await wipeAllRowsByNotNullId(SUPABASE_TABLES.REQUESTS);
        deletedCount += await wipeAllRowsByNotNullId(SUPABASE_TABLES.BLACKLIST);
        deletedCount += await wipeAllRowsByNotNullId(SUPABASE_TABLES.CITIZENS);
        notifyLocalTableChange(FS_COLLECTIONS.CITIZENS);
        notifyLocalTableChange(FS_COLLECTIONS.REQUESTS);
      } else if (k === 'interviews') {
        deletedCount += await wipeAuxiliaryPrefix(FS_COLLECTIONS.INTERVIEWS);
        notifyLocalTableChange(FS_COLLECTIONS.INTERVIEWS);
      } else if (k === 'letters' || k === 'officialLetters') {
        deletedCount += await wipeAuxiliaryPrefix(FS_COLLECTIONS.LETTERS);
        notifyLocalTableChange(FS_COLLECTIONS.LETTERS);
      } else if (k === 'cheques') {
        deletedCount += await wipeAuxiliaryPrefix(FS_COLLECTIONS.CHEQUES);
        notifyLocalTableChange(FS_COLLECTIONS.CHEQUES);
      } else if (k === 'organization' || k === 'organizations' || k === 'organizationRecords') {
        deletedCount += await wipeAuxiliaryPrefix(FS_COLLECTIONS.ORGANIZATIONS);
        notifyLocalTableChange(FS_COLLECTIONS.ORGANIZATIONS);
      } else if (k === 'notifications') {
        deletedCount += await wipeAuxiliaryPrefix(FS_COLLECTIONS.NOTIFICATIONS);
        notifyLocalTableChange(FS_COLLECTIONS.NOTIFICATIONS);
      } else if (k === 'audit_logs') {
        deletedCount += await wipeAuxiliaryPrefix(FS_COLLECTIONS.AUDIT_LOGS);
        notifyLocalTableChange(FS_COLLECTIONS.AUDIT_LOGS);
      } else {
        customSectionIdsToWipe.push(k);
      }
    }

    if (customSectionIdsToWipe.length > 0) {
      const targetSet = new Set(customSectionIdsToWipe);
      const prefix = collectionKeyPrefix(FS_COLLECTIONS.CUSTOM_RECORDS);
      const { rows } = await fetchAllRowsFromTable(SUPABASE_TABLES.SYSTEM_SETTINGS, {
        keyLike: `${prefix}%`
      });
      const delKeys = rows
        .filter(r => targetSet.has(String(r?.value?.sectionId || 'sec_social_welfare').trim()))
        .map(r => r.key);
      if (delKeys.length > 0) {
        for (let i = 0; i < delKeys.length; i += 200) {
          await supabase.from(SUPABASE_TABLES.SYSTEM_SETTINGS).delete().in('key', delKeys.slice(i, i + 200));
        }
        deletedCount += delKeys.length;
        notifyLocalTableChange(FS_COLLECTIONS.CUSTOM_RECORDS);
      }
    }

    if (keys.includes('requests')) {
      await fsSaveSettings({
        lastOutgoingNumberNasiriyah: 0,
        lastOutgoingNumberSuq: 0
      }).catch(() => {});
    }

    updateFirebaseHealth('connected', null);
    return { success: true, deletedCount };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

// ============================================================================
// 15. Realtime Watchers (Supabase Realtime `postgres_changes` + Initial Load)
// ============================================================================

let watcherCounter = 0;

function resolveSupabaseTableForCollection(colName: string): {
  table: string;
  keyLike?: string;
} {
  if (colName === FS_COLLECTIONS.CITIZENS || colName === 'citizens') {
    return { table: SUPABASE_TABLES.CITIZENS };
  }
  if (colName === FS_COLLECTIONS.REQUESTS) {
    return { table: SUPABASE_TABLES.REQUESTS };
  }
  if (colName === FS_COLLECTIONS.BLACKLIST) {
    return { table: SUPABASE_TABLES.BLACKLIST };
  }
  if (colName === FS_COLLECTIONS.USERS) {
    return { table: SUPABASE_TABLES.USERS };
  }
  if (colName === FS_COLLECTIONS.CUSTOM_SECTIONS || colName === FS_COLLECTIONS.DEPARTMENTS) {
    return { table: SUPABASE_TABLES.DEPARTMENTS };
  }
  if (colName === FS_COLLECTIONS.SETTINGS || colName === FS_COLLECTIONS.SYSTEM_SETTINGS) {
    return { table: SUPABASE_TABLES.SYSTEM_SETTINGS };
  }
  return {
    table: SUPABASE_TABLES.SYSTEM_SETTINGS,
    keyLike: `${collectionKeyPrefix(colName)}%`
  };
}

function mapTableRowsForCollection<T>(colName: string, rows: any[]): T[] {
  if (colName === FS_COLLECTIONS.CITIZENS || colName === 'citizens') {
    return rows.map(supabaseRowToCitizen).filter(c => Boolean(c.Citizen_ID)) as unknown as T[];
  }
  if (colName === FS_COLLECTIONS.REQUESTS) {
    return rows.map(supabaseRowToRequest).filter(r => Boolean(r.Request_ID)) as unknown as T[];
  }
  if (colName === FS_COLLECTIONS.BLACKLIST) {
    return rows.map(supabaseRowToBlacklistEntry).filter(b => Boolean(b.Citizen_ID)) as unknown as T[];
  }
  if (colName === FS_COLLECTIONS.USERS) {
    return rows.map(supabaseRowToUser).filter(u => Boolean(u.User_ID)) as unknown as T[];
  }
  if (colName === FS_COLLECTIONS.CUSTOM_SECTIONS || colName === FS_COLLECTIONS.DEPARTMENTS) {
    return rows
      .map(departmentRowToCustomSection)
      .filter((s): s is CustomSection => Boolean(s && s.id)) as unknown as T[];
  }
  if (colName === FS_COLLECTIONS.SETTINGS || colName === FS_COLLECTIONS.SYSTEM_SETTINGS) {
    return rows
      .filter(r => r?.key && !String(r.key).startsWith('col:') && r?.value && typeof r.value === 'object')
      .map(r => ({ ...r.value, _docId: r.key })) as unknown as T[];
  }
  return rows
    .map(r => r?.value)
    .filter(v => v && typeof v === 'object') as T[];
}

export function fsWatchCollection<T>(
  colName: string,
  onData: (items: T[], removedIds: string[], meta?: { fromCache: boolean; hasPendingWrites: boolean }) => void,
  onError?: (err: Error) => void
): () => void {
  let cancelled = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingRemovedIds: string[] = [];
  const { table, keyLike } = resolveSupabaseTableForCollection(colName);

  const loadSnapshot = async () => {
    if (cancelled) return;
    const { rows, error } = await fetchAllRowsFromTable(table, keyLike ? { keyLike } : undefined);
    if (cancelled) return;
    if (error) {
      const arMsg = `تعذر جلب البيانات اللحظية (${colName}) من Supabase: ${error}`;
      updateFirebaseHealth('error', arMsg);
      if (colName === FS_COLLECTIONS.REQUESTS || colName === FS_COLLECTIONS.CITIZENS) {
        pushCloudSyncAlert({
          severity: 'error',
          target: 'firebase',
          title: `تعذر جلب بيانات (${table}) من Supabase`,
          message: arMsg,
          details: error
        });
      }
      if (onError) onError(new Error(error));
      return;
    }

    updateFirebaseHealth('connected', null);
    const mapped = mapTableRowsForCollection<T>(colName, rows);
    const removed = pendingRemovedIds.splice(0, pendingRemovedIds.length);
    onData(mapped, removed, { fromCache: false, hasPendingWrites: false });
  };

  const scheduleRefresh = (removedId?: string) => {
    if (removedId) pendingRemovedIds.push(removedId);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void loadSnapshot();
    }, 180);
  };

  // 1. Initial load immediately
  void loadSnapshot();

  // 2. Supabase Realtime postgres_changes subscription
  const channelName = `rt_${colName}_${++watcherCounter}_${Math.random().toString(36).slice(2, 7)}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload: any) => {
        if (cancelled) return;

        // Filter irrelevant `system_settings` keys so changes to e.g. audit_logs don't re-fetch interviews
        if (table === SUPABASE_TABLES.SYSTEM_SETTINGS) {
          const changedKey = String(payload?.new?.key || payload?.old?.key || '');
          if (keyLike) {
            const prefix = keyLike.replace(/%$/, '');
            if (changedKey && !changedKey.startsWith(prefix)) return;
          } else if (colName === FS_COLLECTIONS.SETTINGS || colName === FS_COLLECTIONS.SYSTEM_SETTINGS) {
            if (changedKey.startsWith('col:')) return;
          }
        }

        let removedId: string | undefined;
        if (payload?.eventType === 'DELETE') {
          const oldRow = payload.old || {};
          if (table === SUPABASE_TABLES.SYSTEM_SETTINGS && typeof oldRow.key === 'string') {
            const parts = oldRow.key.split(':');
            removedId = parts.length >= 3 ? parts.slice(2).join(':') : oldRow.key;
          } else {
            removedId = String(oldRow.id || oldRow.citizen_id || oldRow.request_id || oldRow.user_id || '').trim() || undefined;
          }
        }
        scheduleRefresh(removedId);
      }
    )
    .subscribe();

  // 3. In-tab instant refresh listener
  const unsubLocal = registerLocalTableListener(colName, () => scheduleRefresh());

  return () => {
    cancelled = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    unsubLocal();
    void supabase.removeChannel(channel);
  };
}

export function fsWatchGeneralSettings(
  callback: (general: Partial<SystemSettings>) => void
): () => void {
  let cancelled = false;

  const load = async () => {
    const val = await getSettingRow<Partial<SystemSettings>>(FS_SETTINGS_DOCS.GENERAL);
    if (!cancelled && val && typeof val === 'object') {
      callback(val);
    }
  };

  void load();

  const channel = supabase
    .channel(`rt_settings_general_${++watcherCounter}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SUPABASE_TABLES.SYSTEM_SETTINGS },
      (payload: any) => {
        const k = String(payload?.new?.key || payload?.old?.key || '');
        if (k === FS_SETTINGS_DOCS.GENERAL) {
          void load();
        }
      }
    )
    .subscribe();

  const unsubLocal = registerLocalTableListener('settings:general', () => void load());

  return () => {
    cancelled = true;
    unsubLocal();
    void supabase.removeChannel(channel);
  };
}

export function fsWatchCloudConfig(
  callback: (cfg: Partial<SystemSettings>) => void
): () => void {
  let cancelled = false;

  const load = async () => {
    const val = await getSettingRow<Partial<SystemSettings>>('cloud_config');
    if (!cancelled && val && typeof val === 'object') {
      callback(val);
    }
  };

  void load();

  const channel = supabase
    .channel(`rt_settings_cloud_${++watcherCounter}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: SUPABASE_TABLES.SYSTEM_SETTINGS },
      (payload: any) => {
        const k = String(payload?.new?.key || payload?.old?.key || '');
        if (k === 'cloud_config') {
          void load();
        }
      }
    )
    .subscribe();

  const unsubLocal = registerLocalTableListener('settings:cloud_config', () => void load());

  return () => {
    cancelled = true;
    unsubLocal();
    void supabase.removeChannel(channel);
  };
}

export function fsWatchDeletedRecords(
  onDeletedIds: (deletedIds: string[]) => void
): () => void {
  return fsWatchCollection<{ id?: string }>(
    FS_COLLECTIONS.DELETED_RECORDS,
    (items) => {
      const ids = (items || []).map(x => String(x?.id || '').trim()).filter(Boolean);
      onDeletedIds(ids);
    }
  );
}

// ============================================================================
// 16. Dedicated Archives, Blacklist, Referrers, Departments, Backup Status
// ============================================================================

export async function fsSaveSectionArchiveEntries(entries: FirestoreArchiveEntry[]): Promise<void> {
  if (!entries.length) return;
  const nowIso = new Date().toISOString();
  const rows = entries.map(entry => {
    const safeId = sanitizeFirestoreDocId(entry.id, 'ARC');
    return {
      key: makeCollectionKey(FS_COLLECTIONS.ARCHIVES, safeId),
      value: stripUndefinedProps({ ...entry, id: safeId }),
      updated_at: nowIso
    };
  });
  for (let i = 0; i < rows.length; i += 200) {
    await supabase
      .from(SUPABASE_TABLES.SYSTEM_SETTINGS)
      .upsert(rows.slice(i, i + 200), { onConflict: 'key' });
  }
}

export async function fsDeleteSectionArchiveEntries(docIds: string[]): Promise<void> {
  if (!docIds.length) return;
  const keys = docIds.map(id => makeCollectionKey(FS_COLLECTIONS.ARCHIVES, sanitizeFirestoreDocId(id, 'ARC')));
  for (let i = 0; i < keys.length; i += 200) {
    await supabase
      .from(SUPABASE_TABLES.SYSTEM_SETTINGS)
      .delete()
      .in('key', keys.slice(i, i + 200));
  }
}

export async function fsSaveBlacklistEntry(entry: FirestoreBlacklistEntry): Promise<void> {
  if (!entry.Citizen_ID) return;
  const row = blacklistEntryToSupabaseRow(entry);
  const path = `${SUPABASE_TABLES.BLACKLIST}/${row.id}`;
  try {
    const { error } = await supabase
      .from(SUPABASE_TABLES.BLACKLIST)
      .upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    updateFirebaseHealth('connected', null);
    notifyLocalTableChange(FS_COLLECTIONS.BLACKLIST);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fsDeleteBlacklistEntry(citizenId: string): Promise<void> {
  if (!citizenId) return;
  const safeId = sanitizeFirestoreDocId(citizenId, 'BLK');
  try {
    await supabase
      .from(SUPABASE_TABLES.BLACKLIST)
      .delete()
      .or(`id.eq.${safeId},citizen_id.eq.${safeId}`);
    notifyLocalTableChange(FS_COLLECTIONS.BLACKLIST);
  } catch (error) {
    console.warn('Supabase blacklist delete notice:', error);
  }
}

export async function fsSyncReferrer(rawReferrerName?: string): Promise<void> {
  const cleanName = cleanReferrerLabel(rawReferrerName);
  if (!cleanName || cleanName.length < 2) return;
  const normKey = normalizeReferrerGroupKey(cleanName) || normalizeArabicEntityKey(cleanName);
  if (!normKey) return;
  const docId = sanitizeFirestoreDocId(`ref_${normKey}`, 'REF');
  const key = makeCollectionKey(FS_COLLECTIONS.REFERRERS, docId);
  try {
    const prevData = await getSettingRow<any>(key);
    const prevAliases: string[] = Array.isArray(prevData?.aliases) ? prevData.aliases : [];
    const nextAliases = Array.from(new Set([...prevAliases, cleanName])).slice(0, 40);
    await upsertSettingRow(key, {
      id: docId,
      canonicalName: prevData?.canonicalName || cleanName,
      normalizedKey: normKey,
      aliases: nextAliases,
      usageCount: Number(prevData?.usageCount || 0) + 1,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Supabase referrer sync notice:', err);
  }
}

export async function fsDeleteReferrerByName(rawReferrerName: string): Promise<void> {
  const cleanName = cleanReferrerLabel(rawReferrerName);
  if (!cleanName) return;
  const normKey = normalizeReferrerGroupKey(cleanName) || normalizeArabicEntityKey(cleanName);
  if (!normKey) return;
  const docId = sanitizeFirestoreDocId(`ref_${normKey}`, 'REF');
  try {
    await deleteSettingRow(makeCollectionKey(FS_COLLECTIONS.REFERRERS, docId));
  } catch (err) {
    console.warn('Supabase referrer delete notice:', err);
  }
}

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
  const nowIso = new Date().toISOString();
  try {
    const rows: Record<string, any>[] = [];
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
      rows.push({
        id: `dept_registry_${dept.id}`,
        title: dept.name,
        fields: {
          _kind: 'department_registry',
          deptKey: dept.id,
          type: dept.type,
          membersCount: members.length,
          members,
          updatedAt: nowIso
        },
        created_at: nowIso
      });
    }

    for (const sec of customSectionsList || []) {
      if (!sec?.id) continue;
      rows.push(customSectionToDepartmentRow(sec));
    }

    if (rows.length > 0) {
      await supabase.from(SUPABASE_TABLES.DEPARTMENTS).upsert(rows, { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('Supabase departments registry sync notice:', err);
  }
}

export async function fsSaveBackupStatus(meta: {
  action: 'manual_backup' | 'manual_import' | 'manual_export';
  status: 'success' | 'error';
  actor: string;
  sheetId: string;
  sheetGid: string;
  counts?: Record<string, number>;
  message?: string;
}): Promise<void> {
  try {
    await upsertSettingRow(FS_SETTINGS_DOCS.BACKUP_STATUS, {
      ...meta,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Supabase backup_status save notice:', err);
  }
}

export async function fsReconcileDeletedDocs(
  colName: string,
  authoritativeKeepIds: Set<string>,
  idField: string,
  recentGraceMs: number = 30000
): Promise<number> {
  try {
    const { table, keyLike } = resolveSupabaseTableForCollection(colName);
    const { rows } = await fetchAllRowsFromTable(table, keyLike ? { keyLike } : undefined);
    if (rows.length === 0) return 0;

    const nowMs = Date.now();
    const toRemove: string[] = [];

    for (const row of rows) {
      const recordId =
        table === SUPABASE_TABLES.SYSTEM_SETTINGS
          ? String(row?.value?.[idField] || '').trim()
          : String(row?.[idField] || row?.id || '').trim();
      if (!recordId || authoritativeKeepIds.has(recordId)) continue;

      const rawTs = row?.updated_at || row?.created_at || row?.value?.UpdatedAt || row?.value?.CreatedAt || '';
      const tsMs = rawTs ? Date.parse(String(rawTs).replace(' ', 'T')) : 0;
      if (Number.isFinite(tsMs) && tsMs > 0 && nowMs - tsMs < recentGraceMs) {
        continue;
      }

      toRemove.push(table === SUPABASE_TABLES.SYSTEM_SETTINGS ? row.key : row.id);
    }

    if (toRemove.length > 0) {
      const pkCol = table === SUPABASE_TABLES.SYSTEM_SETTINGS ? 'key' : 'id';
      for (let i = 0; i < toRemove.length; i += 200) {
        await supabase.from(table).delete().in(pkCol, toRemove.slice(i, i + 200));
      }
      notifyLocalTableChange(colName);
    }
    return toRemove.length;
  } catch (err) {
    console.warn(`Supabase reconcile notice (${colName}):`, err);
    return 0;
  }
}

// ============================================================================
// 17. One-Click Importer: Pull Previous Data from Google Sheet -> Supabase
// ============================================================================

export interface GoogleSheetToSupabaseImportResult {
  success: boolean;
  source: 'apps_script' | 'csv_fallback' | 'none';
  citizensImported: number;
  requestsImported: number;
  otherImported: number;
  totalImported: number;
  message: string;
  error?: string;
}

function deterministicImportHash(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase();
}

function pickCell(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return String(row[k]).trim();
    }
  }
  // Fuzzy normalized match against headers
  const normalizedEntries = Object.entries(row).map(([k, v]) => [
    k.trim().toLowerCase().replace(/\s+/g, ' '),
    v
  ] as const);
  for (const target of keys) {
    const t = target.trim().toLowerCase();
    const hit = normalizedEntries.find(([hk, hv]) => hk.includes(t) && hv !== undefined && hv !== null && String(hv).trim() !== '');
    if (hit) return String(hit[1]).trim();
  }
  return '';
}

async function fetchAndParseCsvFallback(
  sheetId: string,
  gid: string
): Promise<{ citizens: Citizen[]; requests: OfficeRequest[]; error?: string }> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  try {
    const res = await fetch(csvUrl, { method: 'GET' });
    if (!res.ok) {
      return { citizens: [], requests: [], error: `HTTP ${res.status} أثناء قراءة CSV من Google Sheet` };
    }
    const csvText = await res.text();
    if (!csvText || csvText.trim().startsWith('<!DOCTYPE html') || csvText.trim().startsWith('<html')) {
      return { citizens: [], requests: [], error: 'تعذر قراءة CSV مباشرة — يرجى التأكد من أن الجدول قابل للقراءة أو استخدام رابط Apps Script.' };
    }

    const wb = XLSX.read(csvText, { type: 'string' });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) return { citizens: [], requests: [], error: 'ملف CSV فارغ' };

    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[firstSheetName], { defval: '' });
    const citizensMap = new Map<string, Citizen>();
    const requestsMap = new Map<string, OfficeRequest>();

    rawRows.forEach((row, idx) => {
      const fullName = pickCell(row, [
        'اسم صاحب الطلب',
        'الاسم الكامل',
        'الاسم الرباعي',
        'الاسم الثلاثي',
        'الاسم',
        'CitizenName',
        'FullName',
        'full_name'
      ]);
      const phone = pickCell(row, ['رقم الهاتف', 'الهاتف', 'الموبايل', 'CitizenPhone', 'Phone1', 'phone1', 'Phone']);
      const entity = pickCell(row, ['الوزارة / الجهة', 'الوزارة', 'الجهة', 'الدائرة', 'Entity', 'entity']);
      const details = pickCell(row, ['الموضوع / تفاصيل الطلب', 'التفاصيل', 'الموضوع', 'الطلب', 'Details', 'details']);
      const outgoingNumber = pickCell(row, ['العدد / الصادر', 'رقم الكتاب', 'العدد', 'الصادر', 'OutgoingNumber', 'outgoing_number']);

      // Skip blank/summary rows
      if (!fullName && !phone && !outgoingNumber && !details) return;
      const cleanName = fullName || 'مراجع مستورد';
      if (cleanName === 'الاسم' || cleanName === 'الاسم الكامل' || cleanName === 'اسم صاحب الطلب') return;

      const rawCitId = pickCell(row, ['الرقم التعريفي للمواطن', 'الرقم التعريفي', 'Citizen_ID', 'citizen_id']);
      const rawReqId = pickCell(row, ['رقم الطلب', 'Request_ID', 'request_id', 'id']);
      const district = pickCell(row, ['القضاء', 'District', 'district']) || 'الناصرية';
      const subDistrict = pickCell(row, ['الناحية / المنطقة', 'الناحية', 'المنطقة', 'العنوان / السكن', 'SubDistrict']) || 'المركز';
      const address = pickCell(row, ['العنوان / السكن', 'العنوان', 'السكن', 'Address', 'address']);
      const referrer = pickCell(row, ['المعرف / التزكية', 'المعرف', 'التزكية', 'ReferralSource', 'referral_source']);
      const job = pickCell(row, ['المهنة / العمل', 'المهنة', 'العمل', 'Job', 'job']);
      const education = pickCell(row, ['التحصيل الدراسي', 'التحصيل', 'Education', 'education']);
      const outgoingDate = pickCell(row, ['تاريخ الصادر', 'تاريخ الكتاب', 'OutgoingDate', 'outgoing_date']);
      const createdAt = pickCell(row, ['تاريخ التسجيل', 'التاريخ', 'CreatedAt', 'created_at']) || new Date().toISOString().split('T')[0];
      const deliveryStatus = pickCell(row, ['حالة الاستلام', 'DeliveryStatus', 'RequestStatus', 'delivery_status']);
      const processingStatus = pickCell(row, ['حالة الإنجاز', 'الحالة', 'ProcessingStatus', 'processing_status']) || 'قيد التدقيق';
      const notes = pickCell(row, ['الملاحظات', 'ملاحظات', 'OtherNotes', 'other_notes']);
      const receptionNotes = pickCell(row, ['ملاحظات الاستعلامات', 'ReceptionNotes', 'reception_notes']);
      const directorNotes = pickCell(row, ['ملاحظات المدير', 'الهامش / التوجيه', 'DirectorNotes', 'director_notes']);
      const directorDecision = pickCell(row, ['قرار المدير', 'توجيه المدير', 'DirectorDecision']);

      const nameKey = normalizeArabicEntityKey(cleanName);
      const citId = rawCitId
        ? sanitizeFirestoreDocId(rawCitId, 'ONA')
        : `GS-CIT-${deterministicImportHash(`${nameKey}|${normalizeArabicDigits(phone)}`)}`;
      const reqId = rawReqId
        ? sanitizeFirestoreDocId(rawReqId, 'REQ')
        : `GS-REQ-${deterministicImportHash(`${citId}|${outgoingNumber}|${entity}|${details.slice(0, 40)}|${idx}`)}`;

      if (!citizensMap.has(citId)) {
        citizensMap.set(citId, {
          Citizen_ID: citId,
          FullName: cleanName,
          Phone1: normalizeArabicDigits(phone),
          Gender: 'ذكر',
          District: district,
          SubDistrict: subDistrict,
          Job: job,
          Education: education,
          Rating: 'مؤيد',
          ReferralSource: referrer,
          IsHistoricalImported: true,
          CreatedAt: createdAt,
          CreatedBy: 'Google Sheet'
        });
      }

      requestsMap.set(reqId, {
        Request_ID: reqId,
        Citizen_ID: citId,
        CitizenName: cleanName,
        CitizenPhone: normalizeArabicDigits(phone),
        Entity: entity || 'غير محدد',
        Details: details || (outgoingNumber ? `معاملة صادرة برقم ${outgoingNumber}` : ''),
        OutgoingNumber: outgoingNumber || undefined,
        OutgoingDate: outgoingDate || undefined,
        Address: address || undefined,
        ReferralSource: referrer || undefined,
        Job: job || undefined,
        Education: education || undefined,
        DeliveryStatus: deliveryStatus === 'مستلم' ? 'مستلم' : 'غير مستلم',
        RequestStatus: deliveryStatus === 'مستلم' ? 'مستلم' : 'غير مستلم',
        ProcessingStatus: processingStatus as any,
        Priority: 'عام',
        CurrentStage: directorDecision ? 'مدير الإدارة' : 'مدير الإدارة',
        ...(directorDecision === 'خاص' || directorDecision === 'عام' || directorDecision === 'رفض' || directorDecision === 'مؤرشف'
          ? { DirectorDecision: directorDecision as any }
          : {}),
        OtherNotes: notes || undefined,
        ReceptionNotes: receptionNotes || undefined,
        DirectorNotes: directorNotes || undefined,
        DeputyNotes: directorNotes || '',
        IsHistoricalImported: true,
        CreatedAt: createdAt,
        CreatedBy: 'Google Sheet'
      });
    });

    return {
      citizens: Array.from(citizensMap.values()),
      requests: Array.from(requestsMap.values())
    };
  } catch (err: any) {
    return { citizens: [], requests: [], error: err?.message || String(err) };
  }
}

/**
 * Pulls all historical records from the partner Google Sheet (via Apps Script first,
 * with direct CSV export fallback) and upserts them cleanly into Supabase without duplicates.
 */
export async function importPreviousDataFromGoogleSheetToSupabase(options?: {
  appsScriptUrl?: string;
  sheetId?: string;
  gid?: string;
  actor?: string;
}): Promise<GoogleSheetToSupabaseImportResult> {
  const appsScriptUrl = (options?.appsScriptUrl || PINNED_APPS_SCRIPT_URL).trim();
  const sheetId = (options?.sheetId || PINNED_GOOGLE_SHEET_ID).trim();
  const gid = (options?.gid || DEFAULT_GOOGLE_SHEET_GID).trim();
  const actor = options?.actor || 'الإدارة';

  try {
    let source: 'apps_script' | 'csv_fallback' | 'none' = 'none';
    let citizens: Citizen[] = [];
    let requests: OfficeRequest[] = [];
    let interviews: Interview[] = [];
    let officialLetters: OfficialLetter[] = [];
    let organizationRecords: OrganizationRecord[] = [];
    let cheques: ChequeRecord[] = [];
    let customRecords: CustomSectionRecord[] = [];
    let scriptErr: string | undefined;

    // 1. Primary pull via Apps Script Web App
    if (appsScriptUrl) {
      const pullRes = await pullDataFromGoogleAppsScript(appsScriptUrl);
      if (pullRes && pullRes.success && pullRes.data) {
        citizens = (pullRes.data.citizens || []).filter(c => c && (c.Citizen_ID || c.FullName));
        requests = (pullRes.data.requests || []).filter(r => r && (r.Request_ID || r.CitizenName));
        interviews = pullRes.data.interviews || [];
        officialLetters = pullRes.data.officialLetters || [];
        organizationRecords = pullRes.data.organizationRecords || [];
        cheques = pullRes.data.cheques || [];
        customRecords = pullRes.data.customRecords || [];
        if (citizens.length > 0 || requests.length > 0 || interviews.length > 0 || organizationRecords.length > 0) {
          source = 'apps_script';
        }
      } else {
        scriptErr = pullRes?.error || pullRes?.message;
      }
    }

    // 2. Automatic CSV fallback if Apps Script returned 0 records or failed
    if (source === 'none') {
      const csvRes = await fetchAndParseCsvFallback(sheetId, gid);
      if (csvRes.citizens.length > 0 || csvRes.requests.length > 0) {
        citizens = csvRes.citizens;
        requests = csvRes.requests;
        source = 'csv_fallback';
      } else {
        const combinedError = [scriptErr, csvRes.error].filter(Boolean).join(' | ') || 'لم يتم العثور على سجلات في Google Sheet.';
        return {
          success: false,
          source: 'none',
          citizensImported: 0,
          requestsImported: 0,
          otherImported: 0,
          totalImported: 0,
          message: combinedError,
          error: combinedError
        };
      }
    }

    // Ensure every pulled citizen/request has deterministic non-empty IDs to prevent duplicates on re-import
    const normalizedCitizens = citizens.map((c, idx) => ({
      ...c,
      Citizen_ID:
        c.Citizen_ID && String(c.Citizen_ID).trim()
          ? sanitizeFirestoreDocId(c.Citizen_ID, 'ONA')
          : `GS-CIT-${deterministicImportHash(`${normalizeArabicEntityKey(c.FullName)}|${normalizeArabicDigits(c.Phone1)}|${idx}`)}`
    }));

    const citByName = new Map<string, string>();
    normalizedCitizens.forEach(c => {
      const k = normalizeArabicEntityKey(c.FullName);
      if (k && !citByName.has(k)) citByName.set(k, c.Citizen_ID);
    });

    const normalizedRequests = requests.map((r, idx) => {
      const resolvedCitId =
        (r.Citizen_ID && String(r.Citizen_ID).trim() ? sanitizeFirestoreDocId(r.Citizen_ID, 'ONA') : '') ||
        citByName.get(normalizeArabicEntityKey(r.CitizenName)) ||
        `GS-CIT-${deterministicImportHash(`${normalizeArabicEntityKey(r.CitizenName)}|${normalizeArabicDigits(r.CitizenPhone)}`)}`;
      const resolvedReqId =
        r.Request_ID && String(r.Request_ID).trim()
          ? sanitizeFirestoreDocId(r.Request_ID, 'REQ')
          : `GS-REQ-${deterministicImportHash(`${resolvedCitId}|${r.OutgoingNumber || ''}|${r.Entity || ''}|${idx}`)}`;
      return {
        ...r,
        Request_ID: resolvedReqId,
        Citizen_ID: resolvedCitId
      };
    });

    // 3. Upsert Citizens & Requests cleanly into Supabase
    const crRes = await fsBulkSaveCitizensAndRequests(normalizedCitizens, normalizedRequests);

    // 4. Upsert other sections pulled from Apps Script (interviews, letters, org, cheques, customRecords)
    const nowIso = new Date().toISOString();
    const auxRows: Array<{ key: string; value: any; updated_at: string }> = [];
    interviews.forEach(i => {
      if (!i?.Interview_ID) return;
      const id = sanitizeFirestoreDocId(i.Interview_ID, 'INT');
      auxRows.push({
        key: makeCollectionKey(FS_COLLECTIONS.INTERVIEWS, id),
        value: stripUndefinedAndOversizedDeep({ ...i, Interview_ID: id }),
        updated_at: nowIso
      });
    });
    officialLetters.forEach(l => {
      if (!l?.Letter_ID) return;
      const id = sanitizeFirestoreDocId(l.Letter_ID, 'LET');
      auxRows.push({
        key: makeCollectionKey(FS_COLLECTIONS.LETTERS, id),
        value: stripUndefinedAndOversizedDeep({ ...l, Letter_ID: id }),
        updated_at: nowIso
      });
    });
    organizationRecords.forEach(o => {
      if (!o?.Citizen_ID) return;
      const id = sanitizeFirestoreDocId(o.Org_ID || o.Citizen_ID, 'ORG');
      auxRows.push({
        key: makeCollectionKey(FS_COLLECTIONS.ORGANIZATIONS, id),
        value: stripUndefinedAndOversizedDeep({ ...o, Org_ID: id }),
        updated_at: nowIso
      });
    });
    cheques.forEach(ch => {
      if (!ch?.id) return;
      const id = sanitizeFirestoreDocId(ch.id, 'CHQ');
      auxRows.push({
        key: makeCollectionKey(FS_COLLECTIONS.CHEQUES, id),
        value: stripUndefinedAndOversizedDeep({ ...ch, id }),
        updated_at: nowIso
      });
    });
    customRecords.forEach(cr => {
      if (!cr?.id || !cr?.sectionId) return;
      const id = sanitizeFirestoreDocId(cr.id, 'REC');
      auxRows.push({
        key: makeCollectionKey(FS_COLLECTIONS.CUSTOM_RECORDS, id),
        value: stripUndefinedAndOversizedDeep({ ...cr, id }),
        updated_at: nowIso
      });
    });

    let otherImported = 0;
    for (let i = 0; i < auxRows.length; i += 200) {
      const slice = auxRows.slice(i, i + 200);
      const { error } = await supabase
        .from(SUPABASE_TABLES.SYSTEM_SETTINGS)
        .upsert(slice, { onConflict: 'key' });
      if (!error) otherImported += slice.length;
    }

    // Trigger immediate live refresh across all watchers
    notifyLocalTableChange(FS_COLLECTIONS.CITIZENS);
    notifyLocalTableChange(FS_COLLECTIONS.REQUESTS);
    if (interviews.length) notifyLocalTableChange(FS_COLLECTIONS.INTERVIEWS);
    if (officialLetters.length) notifyLocalTableChange(FS_COLLECTIONS.LETTERS);
    if (organizationRecords.length) notifyLocalTableChange(FS_COLLECTIONS.ORGANIZATIONS);
    if (cheques.length) notifyLocalTableChange(FS_COLLECTIONS.CHEQUES);
    if (customRecords.length) notifyLocalTableChange(FS_COLLECTIONS.CUSTOM_RECORDS);

    const totalImported = crRes.savedCitizens + crRes.savedRequests + otherImported;
    const msg = `تم جلب ومزامنة (${crRes.savedCitizens}) مراجع و(${crRes.savedRequests}) معاملة${otherImported > 0 ? ` و(${otherImported}) سجل إضافي` : ''} من Google Sheet إلى Supabase بنجاح دون تكرار.`;

    await fsSaveBackupStatus({
      action: 'manual_import',
      status: crRes.success ? 'success' : 'error',
      actor,
      sheetId,
      sheetGid: gid,
      counts: {
        citizens: crRes.savedCitizens,
        requests: crRes.savedRequests,
        other: otherImported
      },
      message: msg
    }).catch(() => {});

    return {
      success: crRes.success && totalImported > 0,
      source,
      citizensImported: crRes.savedCitizens,
      requestsImported: crRes.savedRequests,
      otherImported,
      totalImported,
      message: crRes.success ? msg : crRes.error || 'تعذر حفظ بعض السجلات في Supabase.',
      error: crRes.error
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    return {
      success: false,
      source: 'none',
      citizensImported: 0,
      requestsImported: 0,
      otherImported: 0,
      totalImported: 0,
      message: `تعذر جلب البيانات من Google Sheet إلى Supabase: ${errMsg}`,
      error: errMsg
    };
  }
}
