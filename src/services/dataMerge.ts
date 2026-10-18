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
 * Merges two objects by keeping existing non-empty values unless incoming has a newer/non-empty value.
 */
export function smartMergeObject<T extends Record<string, any>>(existing: T, incoming: T): T {
  const result: any = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined && value !== null && value !== '') {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Extracts a numeric timestamp from any record to determine recency.
 */
export function getRecordTimestamp(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  const raw = 
    item.UpdatedAt || 
    item.updatedAt || 
    item.CreatedAt || 
    item.createdAt || 
    item.Timestamp || 
    item.LetterDate || 
    item.InterviewDate || 
    item.Date;
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return isNaN(parsed) ? 0 : parsed;
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
  if (Array.isArray(incomingRecords)) {
    for (const item of incomingRecords) {
      if (!item) continue;
      const id = String(item[idKey] || '').trim();
      if (!id || (deletedIds && deletedIds.has(id))) continue;

      if (!map.has(id)) {
        map.set(id, { ...item });
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

  return Array.from(map.values());
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
 * Specialized Users merger.
 */
export function mergeUsers(
  currentList: User[],
  incomingList: User[]
): User[] {
  return mergeEntityRecords(currentList, incomingList, 'User_ID', new Set());
}
