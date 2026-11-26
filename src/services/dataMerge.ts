/**
 * High-Integrity Data Merging and Reconciliation Layer
 * ----------------------------------------------------
 * Enforces zero-duplicate semantic matching (by ID, normalized Arabic name,
 * and outgoing/request number) and strict gap-filling merge logic:
 * - If a record already exists and all fields are complete -> keep untouched (no duplicates, no erasure).
 * - If a record already exists with missing/placeholder fields -> fill ONLY missing fields, preserving valid data.
 * - If a record does not exist -> add cleanly as a new record.
 */

import {
  Citizen,
  OfficeRequest,
  Interview,
  OfficialLetter,
  OrganizationRecord,
  ChequeRecord,
  CustomSection,
  CustomSectionRecord,
  User
} from '../types';
import { normalizeUserRecord } from '../utils/permissions';

const PLACEHOLDER_STRINGS = new Set([
  '',
  '-',
  '--',
  '---',
  '—',
  '–',
  'غير محدد',
  'غير مسجل',
  'غير متوفر',
  'لا يوجد',
  'بدون',
  'لايوجد',
  'غير معروف',
  'null',
  'undefined',
  'n/a',
  'na'
]);

/**
 * Normalizes Arabic text for accurate semantic deduplication across Google Sheets,
 * Firebase Firestore, and imported Excel files.
 */
export function normalizeArabicForMatch(raw: any): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // Strip diacritics & tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Normalizes reference / outgoing / phone numbers (converts Arabic-Indic digits).
 */
export function normalizeNumberForMatch(raw: any): string {
  if (raw === null || raw === undefined) return '';
  return String(raw)
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-_/\\]+/g, '')
    .toLowerCase();
}

/**
 * Returns true if a string/primitive value is considered empty or a generic placeholder.
 */
export function isMissingOrPlaceholder(val: any): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === 'string') {
    const cleaned = val.trim().toLowerCase();
    return PLACEHOLDER_STRINGS.has(cleaned);
  }
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

/**
 * Gap-Filling Merger (تكملة النواقص فقط دون مسح البيانات الصحيحة)
 * ------------------------------------------------------------------
 * Keeps every valid, non-placeholder field from `base` intact and fills ONLY
 * missing/placeholder fields from `supplement`.
 */
export function fillMissingFieldsOnly<T extends Record<string, any>>(base: T, supplement: T): T {
  const result: any = { ...base };

  for (const [key, suppVal] of Object.entries(supplement || {})) {
    if (suppVal === undefined || suppVal === null) continue;

    // Never change primary IDs during gap-fill merge
    if (
      key === 'Citizen_ID' ||
      key === 'Request_ID' ||
      key === 'Interview_ID' ||
      key === 'Letter_ID' ||
      key === 'User_ID' ||
      key === 'id'
    ) {
      if (isMissingOrPlaceholder(result[key]) && !isMissingOrPlaceholder(suppVal)) {
        result[key] = suppVal;
      }
      continue;
    }

    const baseVal = result[key];

    if (
      key === 'data' &&
      typeof suppVal === 'object' &&
      !Array.isArray(suppVal) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = fillMissingFieldsOnly(baseVal, suppVal);
      continue;
    }

    if (typeof suppVal === 'string') {
      if (isMissingOrPlaceholder(baseVal) && !isMissingOrPlaceholder(suppVal)) {
        result[key] = suppVal;
      }
      continue;
    }

    if (Array.isArray(suppVal)) {
      if ((!Array.isArray(baseVal) || baseVal.length === 0) && suppVal.length > 0) {
        result[key] = suppVal;
      }
      continue;
    }

    if (typeof suppVal === 'number') {
      if ((baseVal === undefined || baseVal === null || baseVal === 0 || Number.isNaN(baseVal)) && suppVal !== 0) {
        result[key] = suppVal;
      }
      continue;
    }

    if (baseVal === undefined || baseVal === null) {
      result[key] = suppVal;
    }
  }

  return result as T;
}

/**
 * Non-Destructive Field-Preserving Object Merger
 * ----------------------------------------------
 * Merges two versions of the same record (keyed by unique ID) where `incoming` is newer:
 * - Never overwrites an existing populated string with an empty string "" or placeholder from a partial payload
 * - Never overwrites an existing populated array with an empty array [] from a partial payload
 * - Recursively preserves nested `data` fields (for CustomSectionRecord)
 * - Explicitly honors `IsBlocked === false` to clear block metadata when unblocking a citizen
 */
export function smartMergeObject<T extends Record<string, any>>(existing: T, incoming: T): T {
  const result: any = { ...existing };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value === undefined || value === null) continue;

    const prevVal = result[key];

    // Preserve populated existing strings against accidental blank or placeholder overwrites
    if (typeof value === 'string') {
      if (isMissingOrPlaceholder(value) && !isMissingOrPlaceholder(prevVal)) {
        continue;
      }
      result[key] = value;
      continue;
    }

    // Preserve populated arrays against accidental empty array overwrites,
    // EXCEPT for explicit per-section archive arrays where [] intentionally means unarchived.
    if (Array.isArray(value)) {
      const isSectionArchiveArray = key === 'archivedInSections' || key === 'unarchivedInSections';
      if (!isSectionArchiveArray && value.length === 0 && Array.isArray(prevVal) && prevVal.length > 0) {
        continue;
      }
      result[key] = value;
      continue;
    }

    // Deep non-destructive merge for nested record maps (e.g. CustomSectionRecord.data)
    if (
      key === 'data' &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prevVal &&
      typeof prevVal === 'object' &&
      !Array.isArray(prevVal)
    ) {
      result[key] = smartMergeObject(prevVal, value);
      continue;
    }

    result[key] = value;
  }

  if (incoming?.IsBlocked === false) {
    result.IsBlocked = false;
    result.BlockReason = '';
    result.BlockedAt = '';
    result.BlockedBy = '';
  }
  return result as T;
}

function parseSingleTimestamp(raw: any): number {
  if (!raw) return 0;
  const str = String(raw).trim();
  if (!str) return 0;
  let parsed = Date.parse(str);
  if (isNaN(parsed) && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
    parsed = Date.parse(str.replace(' ', 'T'));
  }
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extracts the latest numeric timestamp from any record across all timestamp fields
 * (handling both PascalCase UpdatedAt and camelCase updatedAt) to determine recency accurately.
 */
export function getRecordTimestamp(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  const candidates = [
    item.UpdatedAt,
    item.updatedAt,
    item.DirectorDecisionDate,
    item.BlockedAt,
    item.CreatedAt,
    item.createdAt,
    item.Timestamp,
    item.LetterDate,
    item.InterviewDate,
    item.Date
  ];
  let maxTs = 0;
  for (const c of candidates) {
    const ts = parseSingleTimestamp(c);
    if (ts > maxTs) maxTs = ts;
  }
  return maxTs;
}

/**
 * Universal merger for entities with a primary unique ID.
 * - Excludes any items present in deletedIds (tombstones).
 * - Avoids duplicate IDs.
 * - Compares timestamps: newer records win on overlapping fields while never wiping valid fields.
 * - Fills any missing non-empty fields from the other record to avoid data loss.
 */
export function mergeEntityRecords<T extends Record<string, any>>(
  currentRecords: T[],
  incomingRecords: T[],
  idKey: keyof T,
  deletedIds: Set<string>
): T[] {
  const map = new Map<string, T>();

  // 1. Process current records
  if (Array.isArray(currentRecords)) {
    for (const item of currentRecords) {
      if (!item) continue;
      const id = String(item[idKey] || '').trim();
      if (!id || (deletedIds && deletedIds.has(id))) continue;
      map.set(id, { ...item });
    }
  }

  // 2. Process incoming records
  const newlyArrived: T[] = [];
  if (Array.isArray(incomingRecords)) {
    for (const item of incomingRecords) {
      if (!item) continue;
      const id = String(item[idKey] || '').trim();
      if (!id || (deletedIds && deletedIds.has(id))) continue;

      if (!map.has(id)) {
        const clone = { ...item };
        map.set(id, clone);
        newlyArrived.push(clone);
      } else {
        const existing = map.get(id)!;
        const existingTime = getRecordTimestamp(existing);
        const incomingTime = getRecordTimestamp(item);

        let merged: T;
        if (existingTime > incomingTime && incomingTime > 0) {
          // Existing record is strictly newer: keep its valid fields and fill only missing fields from incoming
          merged = fillMissingFieldsOnly(existing, item);
        } else if (incomingTime > existingTime) {
          // Incoming record is strictly newer (including when existing had no timestamp): apply non-destructive update
          merged = smartMergeObject(existing, item);
        } else {
          // Equal/unknown timestamps: keep existing valid data intact and fill missing fields only
          merged = fillMissingFieldsOnly(existing, item);
        }
        map.set(id, merged);
      }
    }
  }

  // Place newly arrived records ahead of older existing ones, then sort newest-first by timestamp
  const newIdSet = new Set(newlyArrived.map(i => String(i[idKey] || '').trim()));
  const ordered: T[] = [];
  newlyArrived.forEach(item => {
    const id = String(item[idKey] || '').trim();
    const val = map.get(id);
    if (val) ordered.push(val);
  });
  map.forEach((val, id) => {
    if (!newIdSet.has(id)) ordered.push(val);
  });

  // Stable newest-first sort when timestamps exist
  return ordered.sort((a, b) => {
    const ta = getRecordTimestamp(a);
    const tb = getRecordTimestamp(b);
    if (ta === tb) return 0;
    return tb - ta;
  });
}

/**
 * Specialized Citizens merger with Semantic Deduplication by Normalized Arabic Name:
 * - Matches by Citizen_ID OR exact normalized FullName (so Google Sheet & Firestore never duplicate the same citizen).
 * - If existing citizen is complete, keeps untouched; if missing fields (Phone, Address, District, etc.), fills ONLY missing fields.
 */
export function mergeCitizens(
  currentList: Citizen[],
  incomingList: Citizen[],
  deletedIds: Set<string>
): Citizen[] {
  const byId = mergeEntityRecords(currentList, incomingList, 'Citizen_ID', deletedIds);

  const deduped: Citizen[] = [];
  const nameToIndex = new Map<string, number>();

  for (const citizen of byId) {
    const normName = normalizeArabicForMatch(citizen.FullName);
    if (normName && normName.length >= 3 && nameToIndex.has(normName)) {
      const idx = nameToIndex.get(normName)!;
      const existing = deduped[idx];
      // Keep the existing (primary / newer) record's valid data and fill ONLY its missing fields
      deduped[idx] = fillMissingFieldsOnly(existing, citizen);
    } else {
      if (normName && normName.length >= 3) {
        nameToIndex.set(normName, deduped.length);
      }
      deduped.push(citizen);
    }
  }

  return deduped;
}

/**
 * Specialized Requests merger with Semantic Deduplication by Outgoing Number & Citizen+Entity+Details:
 * - Matches by Request_ID, OR by (Citizen + OutgoingNumber), OR by (Citizen + TargetEntity + RequestDetails).
 * - Keeps complete records untouched, fills ONLY missing fields on partial matches, and cascades citizen deletions.
 */
export function mergeRequests(
  currentList: OfficeRequest[],
  incomingList: OfficeRequest[],
  deletedIds: Set<string>
): OfficeRequest[] {
  const byId = mergeEntityRecords(currentList, incomingList, 'Request_ID', deletedIds).filter(
    r => !r.Citizen_ID || !deletedIds.has(r.Citizen_ID)
  );

  const deduped: OfficeRequest[] = [];
  const outgoingKeyToIndex = new Map<string, number>();
  const semanticKeyToIndex = new Map<string, number>();

  for (const req of byId) {
    const citizenKey =
      normalizeArabicForMatch(req.CitizenName) ||
      normalizeNumberForMatch(req.Citizen_ID);
    const outNumKey = normalizeNumberForMatch(req.OutgoingNumber);
    const entityKey = normalizeArabicForMatch(req.Entity);
    const detailsKey = normalizeArabicForMatch(req.Details);

    const outComposite = outNumKey && outNumKey.length >= 2
      ? `${citizenKey || 'any'}::out::${outNumKey}`
      : '';
    const semComposite =
      citizenKey && citizenKey.length >= 3 && (entityKey || detailsKey)
        ? `${citizenKey}::${entityKey}::${detailsKey.slice(0, 80)}`
        : '';

    let matchedIdx: number | undefined;
    if (outComposite && outgoingKeyToIndex.has(outComposite)) {
      matchedIdx = outgoingKeyToIndex.get(outComposite);
    } else if (semComposite && semanticKeyToIndex.has(semComposite)) {
      matchedIdx = semanticKeyToIndex.get(semComposite);
    }

    if (matchedIdx !== undefined) {
      const existing = deduped[matchedIdx];
      const existingTime = getRecordTimestamp(existing);
      const itemTime = getRecordTimestamp(req);
      // Preserve valid existing data and fill ONLY missing fields
      deduped[matchedIdx] =
        itemTime > existingTime && existingTime > 0
          ? smartMergeObject(existing, req)
          : fillMissingFieldsOnly(existing, req);
      // Register alternate keys pointing to the same canonical record
      if (outComposite) outgoingKeyToIndex.set(outComposite, matchedIdx);
      if (semComposite) semanticKeyToIndex.set(semComposite, matchedIdx);
    } else {
      const newIdx = deduped.length;
      deduped.push(req);
      if (outComposite) outgoingKeyToIndex.set(outComposite, newIdx);
      if (semComposite) semanticKeyToIndex.set(semComposite, newIdx);
    }
  }

  return deduped;
}

/**
 * Specialized Interviews merger (cascades citizen deletions).
 */
export function mergeInterviews(
  currentList: Interview[],
  incomingList: Interview[],
  deletedIds: Set<string>
): Interview[] {
  const merged = mergeEntityRecords(currentList, incomingList, 'Interview_ID', deletedIds);
  return merged.filter(i => !i.Citizen_ID || !deletedIds.has(i.Citizen_ID));
}

/**
 * Specialized Official Letters merger.
 */
export function mergeOfficialLetters(
  currentList: OfficialLetter[],
  incomingList: OfficialLetter[],
  deletedIds: Set<string>
): OfficialLetter[] {
  const merged = mergeEntityRecords(currentList, incomingList, 'Letter_ID', deletedIds);
  return merged.filter(l => !l.Citizen_ID || !deletedIds.has(l.Citizen_ID));
}

/**
 * Specialized Cheques merger.
 */
export function mergeCheques(
  currentList: ChequeRecord[],
  incomingList: ChequeRecord[],
  deletedIds: Set<string>
): ChequeRecord[] {
  const merged = mergeEntityRecords(currentList, incomingList, 'id', deletedIds);
  return merged.filter(ch => !ch.Citizen_ID || !deletedIds.has(ch.Citizen_ID));
}

/**
 * Specialized Organization records merger.
 * Keyed by Citizen_ID.
 */
export function mergeOrganizationRecords(
  currentList: OrganizationRecord[],
  incomingList: OrganizationRecord[],
  deletedIds: Set<string>
): OrganizationRecord[] {
  const map = new Map<string, OrganizationRecord>();

  const process = (item: OrganizationRecord) => {
    if (!item) return;
    const cid = String(item.Citizen_ID || '').trim();
    if (!cid || deletedIds.has(cid)) return;
    if (item.Org_ID && deletedIds.has(item.Org_ID)) return;

    if (!map.has(cid)) {
      map.set(cid, { ...item });
    } else {
      const existing = map.get(cid)!;
      const existingTime = getRecordTimestamp(existing);
      const incomingTime = getRecordTimestamp(item);
      let merged: OrganizationRecord;
      if (existingTime > incomingTime && incomingTime > 0) {
        merged = fillMissingFieldsOnly(existing, item);
      } else if (incomingTime > existingTime && existingTime > 0) {
        merged = smartMergeObject(existing, item);
      } else {
        merged = fillMissingFieldsOnly(existing, item);
      }
      map.set(cid, merged);
    }
  };

  (currentList || []).forEach(process);
  (incomingList || []).forEach(process);

  return Array.from(map.values());
}

/**
 * Specialized Custom Sections merger.
 */
export function mergeCustomSections(
  currentList: CustomSection[],
  incomingList: CustomSection[],
  deletedIds: Set<string>
): CustomSection[] {
  return mergeEntityRecords(currentList, incomingList, 'id', deletedIds);
}

/**
 * Specialized Custom Records merger with Semantic Deduplication inside each section:
 * - Prevents duplicate rows when the same person/name or outgoing number exists across Sheet & Firestore.
 * - Fills ONLY missing fields inside `record.data` without erasing valid existing values.
 */
export function mergeCustomRecords(
  currentList: CustomSectionRecord[],
  incomingList: CustomSectionRecord[],
  deletedIds: Set<string>
): CustomSectionRecord[] {
  const byId = mergeEntityRecords(currentList, incomingList, 'id', deletedIds).filter(
    cr => !cr.sectionId || !deletedIds.has(cr.sectionId)
  );

  const deduped: CustomSectionRecord[] = [];
  const keyToIndex = new Map<string, number>();

  const extractPrimaryName = (rec: CustomSectionRecord): string => {
    const d = rec.data || {};
    const candidates = [
      d.FullName,
      d.CitizenName,
      d.fullName,
      d.name,
      d['الاسم'],
      d['الاسم الكامل'],
      d['الاسم الثلاثي'],
      d['الاسم الرباعي'],
      d['اسم المواطن'],
      d['اسم المراجع'],
      d['اسم المستفيد']
    ];
    for (const c of candidates) {
      const norm = normalizeArabicForMatch(c);
      if (norm && norm.length >= 3) return norm;
    }
    return '';
  };

  const extractRefNumber = (rec: CustomSectionRecord): string => {
    const d = rec.data || {};
    const candidates = [
      d.OutgoingNumber,
      d.Request_ID,
      d['رقم الصادر'],
      d['رقم الكتاب'],
      d['رقم المعاملة'],
      d['رقم البطاقة']
    ];
    for (const c of candidates) {
      const norm = normalizeNumberForMatch(c);
      if (norm && norm.length >= 2) return norm;
    }
    return '';
  };

  for (const rec of byId) {
    const secKey = String(rec.sectionId || '').trim();
    const nameKey = extractPrimaryName(rec);
    const numKey = extractRefNumber(rec);
    const compositeKey =
      secKey && nameKey
        ? `${secKey}::${nameKey}${numKey ? `::${numKey}` : ''}`
        : secKey && numKey
          ? `${secKey}::num::${numKey}`
          : '';

    if (compositeKey && keyToIndex.has(compositeKey)) {
      const idx = keyToIndex.get(compositeKey)!;
      deduped[idx] = fillMissingFieldsOnly(deduped[idx], rec);
    } else {
      if (compositeKey) keyToIndex.set(compositeKey, deduped.length);
      deduped.push(rec);
    }
  }

  return deduped;
}

/**
 * Specialized Users merger with Strict Password & Security Lock:
 * - Protects saved staff passwords, roles, permissions, and allowed sections so they
 *   can NEVER be silently reverted by stale seed users or un-timestamped Sheet rows.
 * - When `incomingAuthoritative` is true (Firebase Firestore), non-empty cloud passwords
 *   and permissions take precedence over local/seed defaults unless local has a strictly newer UpdatedAt.
 * - When `incomingAuthoritative` is false (e.g. Google Sheets or fallback), incoming rows
 *   can ONLY add missing users or update if they carry a strictly newer UpdatedAt timestamp.
 */
export function mergeUsers(
  currentList: User[],
  incomingList: User[],
  deletedIds?: Set<string>,
  options?: { incomingAuthoritative?: boolean }
): User[] {
  const deleted = deletedIds || new Set<string>();
  const incomingAuthoritative = Boolean(options?.incomingAuthoritative);
  const byId = new Map<string, User>();

  for (const raw of currentList || []) {
    if (!raw || !raw.User_ID) continue;
    const id = String(raw.User_ID).trim();
    if (!id || deleted.has(id)) continue;
    byId.set(id, normalizeUserRecord({ ...raw, User_ID: id }));
  }

  for (const rawItem of incomingList || []) {
    if (!rawItem || !rawItem.User_ID) continue;
    const rawId = String(rawItem.User_ID).trim();
    if (!rawId || deleted.has(rawId)) continue;

    // Strictly bind by exact User_ID so different staff accounts can NEVER cross-merge or swap roles/codes
    const raw = normalizeUserRecord({ ...rawItem, User_ID: rawId });
    const existing = byId.get(rawId);

    if (!existing) {
      byId.set(rawId, raw);
      continue;
    }

    const existingTs = getRecordTimestamp(existing);
    const incomingTs = getRecordTimestamp(raw);

    // Non-authoritative sources (e.g., Google Sheets rows lacking Permissions/AllowedSections/Role)
    // must NEVER overwrite an authoritative Firestore user's Role, Password, Permissions, or AllowedSections.
    const incomingWins =
      incomingAuthoritative
        ? (incomingTs >= existingTs || existingTs === 0)
        : (incomingTs > existingTs && incomingTs > 0 && Boolean(raw.Role) && !isMissingOrPlaceholder(raw.Password));

    if (incomingWins) {
      const resolvedRole = raw.Role || existing.Role;
      const roleChanged = Boolean(raw.Role && existing.Role && raw.Role !== existing.Role);

      const merged: User = {
        ...existing,
        ...raw,
        User_ID: rawId,
        Password: !isMissingOrPlaceholder(raw.Password) ? raw.Password : existing.Password,
        Username: !isMissingOrPlaceholder(raw.Username) ? raw.Username : existing.Username,
        FullName: !isMissingOrPlaceholder(raw.FullName) ? raw.FullName : existing.FullName,
        Role: resolvedRole,
        RoleArabic: !isMissingOrPlaceholder(raw.RoleArabic) ? raw.RoleArabic : existing.RoleArabic,
        Department: !isMissingOrPlaceholder(raw.Department) ? raw.Department : existing.Department,
        // If Role changed, never inherit stale AllowedSections from the previous role
        Permissions: Array.isArray(raw.Permissions) && raw.Permissions.length > 0
          ? raw.Permissions
          : (roleChanged ? [] : existing.Permissions),
        AllowedSections: Array.isArray(raw.AllowedSections) && raw.AllowedSections.length > 0
          ? raw.AllowedSections
          : (roleChanged ? [] : existing.AllowedSections),
        Status: raw.Status || existing.Status
      };
      byId.set(rawId, normalizeUserRecord(merged));
    } else {
      // Existing is authoritative or newer: only gap-fill missing non-security fields,
      // NEVER overwrite Password, Role, RoleArabic, Department, Permissions, or AllowedSections
      const gapFilled = fillMissingFieldsOnly(existing, raw);
      byId.set(rawId, normalizeUserRecord({
        ...gapFilled,
        User_ID: existing.User_ID,
        Username: existing.Username,
        FullName: existing.FullName,
        Password: existing.Password,
        Role: existing.Role,
        RoleArabic: existing.RoleArabic,
        Department: existing.Department,
        Permissions: existing.Permissions,
        AllowedSections: existing.AllowedSections,
        Status: existing.Status
      }));
    }
  }

  return Array.from(byId.values());
}

