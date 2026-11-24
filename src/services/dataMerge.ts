/**
 * High-Integrity Data Merging and Reconciliation Layer
 * ----------------------------------------------------
 * Ensures zero data loss, zero conflicting records, and prevents disappearing
 * data when switching between tabs, sessions, or remote database sources.
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

/**
 * Non-Destructive Field-Preserving Object Merger
 * ----------------------------------------------
 * Merges two versions of the same record (keyed by unique ID) where `incoming` is newer:
 * - Never overwrites an existing populated string with an empty string "" or null from a partial payload
 * - Never overwrites an existing populated array with an empty array [] from a partial payload
 * - Recursively preserves nested `data` fields (for CustomSectionRecord)
 * - Explicitly honors `IsBlocked === false` to clear block metadata when unblocking a citizen
 */
export function smartMergeObject<T extends Record<string, any>>(existing: T, incoming: T): T {
  const result: any = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue;

    const prevVal = result[key];

    // Preserve populated existing strings against accidental blank overwrites from sparse sync payloads
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '' && typeof prevVal === 'string' && prevVal.trim() !== '') {
        continue;
      }
      result[key] = value;
      continue;
    }

    // Preserve populated arrays against accidental empty array overwrites
    if (Array.isArray(value)) {
      if (value.length === 0 && Array.isArray(prevVal) && prevVal.length > 0) {
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

  if (incoming.IsBlocked === false) {
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
 * - Compares timestamps: newer records win on overlapping fields.
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
          // Existing local record is strictly newer than incoming remote record:
          // Keep existing values, but fill in any missing fields from incoming
          merged = smartMergeObject(item, existing);
        } else {
          // Incoming record is newer or same age:
          // Incoming values win, but preserve any local fields not in incoming
          merged = smartMergeObject(existing, item);
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

  // Stable newest-first sort when timestamps exist (so live registrations from Reception always appear at top of Director & Admin)
  return ordered.sort((a, b) => {
    const ta = getRecordTimestamp(a);
    const tb = getRecordTimestamp(b);
    if (ta === tb) return 0;
    return tb - ta;
  });
}

/**
 * Specialized Citizens merger.
 */
export function mergeCitizens(
  currentList: Citizen[],
  incomingList: Citizen[],
  deletedIds: Set<string>
): Citizen[] {
  return mergeEntityRecords(currentList, incomingList, 'Citizen_ID', deletedIds);
}

/**
 * Specialized Requests merger (cascades citizen deletions).
 */
export function mergeRequests(
  currentList: OfficeRequest[],
  incomingList: OfficeRequest[],
  deletedIds: Set<string>
): OfficeRequest[] {
  const merged = mergeEntityRecords(currentList, incomingList, 'Request_ID', deletedIds);
  return merged.filter(r => !r.Citizen_ID || !deletedIds.has(r.Citizen_ID));
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
        merged = smartMergeObject(item, existing);
      } else {
        merged = smartMergeObject(existing, item);
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
 * Specialized Custom Records merger.
 */
export function mergeCustomRecords(
  currentList: CustomSectionRecord[],
  incomingList: CustomSectionRecord[],
  deletedIds: Set<string>
): CustomSectionRecord[] {
  const merged = mergeEntityRecords(currentList, incomingList, 'id', deletedIds);
  return merged.filter(cr => !cr.sectionId || !deletedIds.has(cr.sectionId));
}

/**
 * Specialized Users merger (respects tombstones and UpdatedAt timestamps).
 */
export function mergeUsers(
  currentList: User[],
  incomingList: User[],
  deletedIds?: Set<string>
): User[] {
  return mergeEntityRecords(currentList, incomingList, 'User_ID', deletedIds || new Set());
}
