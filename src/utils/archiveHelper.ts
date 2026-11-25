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
 * Returns true if an OfficeRequest is archived or restored/imported from historical database/Excel.
 * Archived records remain 100% preserved in Firestore, Google Sheets, and Archive,
 * and are excluded from the default "العمل اليومي" queue unless explicitly toggled.
 */
export function isRequestArchivedOrRestored(req?: OfficeRequest | null): boolean {
  if (!req) return false;
  const anyReq = req as Record<string, any>;
  const custom = anyReq.CustomFields && typeof anyReq.CustomFields === 'object' ? anyReq.CustomFields : undefined;

  if (
    parseArchivedFlag(req.IsArchived) ||
    parseArchivedFlag(anyReq.archived) ||
    parseArchivedFlag(anyReq.Archived) ||
    parseArchivedFlag(anyReq['الأرشفة']) ||
    parseArchivedFlag(anyReq['حالة الأرشفة']) ||
    parseArchivedFlag(custom?.archived) ||
    parseArchivedFlag(custom?.IsArchived) ||
    parseArchivedFlag(custom?.['الأرشفة'])
  ) {
    return true;
  }

  if (parseArchivedFlag(req.IsHistoricalImported)) return true;
  if (req.DirectorDecision === 'مؤرشف') return true;
  if (typeof req.ArchiveCode === 'string' && req.ArchiveCode.trim().length > 0) return true;
  if (typeof req.ArchivedAt === 'string' && req.ArchivedAt.trim().length > 0) return true;

  return false;
}

/**
 * Returns true if a Citizen record is archived or restored/imported from historical database/Excel.
 * Optionally checks linked requests: if the citizen has requests and ALL of them are archived/restored,
 * the citizen is also treated as archived for Daily Work filtering.
 */
export function isCitizenArchivedOrRestored(
  cit?: Citizen | null,
  citizenRequests?: OfficeRequest[]
): boolean {
  if (!cit) return false;
  const anyCit = cit as Record<string, any>;
  const custom = anyCit.CustomFields && typeof anyCit.CustomFields === 'object' ? anyCit.CustomFields : undefined;

  if (
    parseArchivedFlag(cit.IsArchived) ||
    parseArchivedFlag(anyCit.archived) ||
    parseArchivedFlag(anyCit.Archived) ||
    parseArchivedFlag(anyCit['الأرشفة']) ||
    parseArchivedFlag(anyCit['حالة الأرشفة']) ||
    parseArchivedFlag(custom?.archived) ||
    parseArchivedFlag(custom?.IsArchived) ||
    parseArchivedFlag(custom?.['الأرشفة'])
  ) {
    return true;
  }

  if (parseArchivedFlag(cit.IsHistoricalImported)) return true;
  if (typeof cit.ArchiveCode === 'string' && cit.ArchiveCode.trim().length > 0) return true;
  if (typeof cit.ArchivedAt === 'string' && cit.ArchivedAt.trim().length > 0) return true;

  if (citizenRequests && citizenRequests.length > 0) {
    const allReqsArchived = citizenRequests.every((r) => isRequestArchivedOrRestored(r));
    if (allReqsArchived) return true;
  }

  return false;
}
