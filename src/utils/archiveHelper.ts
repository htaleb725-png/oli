import { Citizen, OfficeRequest } from '../types';

/**
 * Normalizes any archive flag representation coming from Firestore, Google Sheets,
 * Excel imports, or Apps Script (`IsArchived`, `archived`, `الأرشفة: نعم`, etc.).
 */
export function parseArchivedFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value === null || value === undefined) return false;
  const clean = String(value)
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .toLowerCase();
  return (
    clean === 'true' ||
    clean === '1' ||
    clean === 'yes' ||
    clean === 'نعم' ||
    clean === 'مؤرشف' ||
    clean === 'مؤرشفة' ||
    clean === 'archived'
  );
}

/**
 * Returns true if a field explicitly declares the record as UNARCHIVED / ACTIVE
 * (e.g., `IsArchived: false`, `archived: false`, `الأرشفة: لا` / `غير مؤرشف`).
 * Explicit unarchive takes precedence over legacy historical hints so restored records
 * never silently disappear or conflict between counters and lists.
 */
export function parseExplicitUnarchivedFlag(value: unknown): boolean {
  if (value === false || value === 0) return true;
  if (value === null || value === undefined || value === true || value === 1) return false;
  const clean = String(value)
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .toLowerCase();
  return (
    clean === 'false' ||
    clean === '0' ||
    clean === 'no' ||
    clean === 'لا' ||
    clean === 'غير مؤرشف' ||
    clean === 'غير مؤرشفة' ||
    clean === 'نشط' ||
    clean === 'active'
  );
}

/**
 * Resolves explicit archive state on any record:
 * - Returns `true` if explicitly archived
 * - Returns `false` if explicitly unarchived (`IsArchived === false` / `archived === false` / `الأرشفة === 'لا'`)
 * - Returns `null` if no explicit archive flag is present (falls back to historical/legacy heuristics)
 */
export function resolveExplicitArchiveState(record?: Record<string, any> | null): boolean | null {
  if (!record || typeof record !== 'object') return null;
  const custom = record.CustomFields && typeof record.CustomFields === 'object' ? record.CustomFields : undefined;

  // 1. Primary canonical field (`IsArchived`) has highest authority
  if (record.IsArchived === true) return true;
  if (record.IsArchived === false) return false;

  const candidates = [
    record.IsArchived,
    record.archived,
    record.Archived,
    record['الأرشفة'],
    record['حالة الأرشفة'],
    custom?.IsArchived,
    custom?.archived,
    custom?.['الأرشفة']
  ];

  for (const val of candidates) {
    if (parseArchivedFlag(val)) return true;
    if (parseExplicitUnarchivedFlag(val)) return false;
  }

  return null;
}

/**
 * Returns true if an OfficeRequest is archived or restored/imported from historical database/Excel.
 * Unified logic guarantees 100% consistency between Firestore, Google Sheets, counters, and UI lists.
 */
export function isRequestArchivedOrRestored(req?: OfficeRequest | null): boolean {
  if (!req) return false;
  const explicit = resolveExplicitArchiveState(req as Record<string, any>);
  if (explicit !== null) return explicit;

  if (parseArchivedFlag(req.IsHistoricalImported)) return true;
  if (req.DirectorDecision === 'مؤرشف') return true;
  if (typeof req.ArchiveCode === 'string' && req.ArchiveCode.trim().length > 0) return true;
  if (typeof req.ArchivedAt === 'string' && req.ArchivedAt.trim().length > 0) return true;

  return false;
}

/**
 * Returns true if a Citizen record is archived or restored/imported from historical database/Excel.
 * Explicit `IsArchived: false` on the citizen (after restoring) takes immediate precedence
 * so restored records never get hidden by stale sub-request or historical import metadata.
 */
export function isCitizenArchivedOrRestored(
  cit?: Citizen | null,
  citizenRequests?: OfficeRequest[]
): boolean {
  if (!cit) return false;
  const explicit = resolveExplicitArchiveState(cit as Record<string, any>);
  if (explicit !== null) return explicit;

  if (parseArchivedFlag(cit.IsHistoricalImported)) return true;
  if (typeof cit.ArchiveCode === 'string' && cit.ArchiveCode.trim().length > 0) return true;
  if (typeof cit.ArchivedAt === 'string' && cit.ArchivedAt.trim().length > 0) return true;

  if (citizenRequests && citizenRequests.length > 0) {
    const allReqsArchived = citizenRequests.every((r) => isRequestArchivedOrRestored(r));
    if (allReqsArchived) return true;
  }

  return false;
}
