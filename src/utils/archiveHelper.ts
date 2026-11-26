import { Citizen, OfficeRequest } from '../types';

export type ArchiveSectionKey =
  | 'reception'
  | 'director'
  | 'admin'
  | 'organization'
  | 'interviews'
  | (string & {});

export const ARCHIVE_SECTION_LABELS: Record<string, string> = {
  reception: 'قسم الاستعلامات',
  director: 'قسم مدير المكتب',
  admin: 'قسم الإدارة',
  organization: 'قسم التنظيم',
  interviews: 'قسم المقابلات'
};

export function getArchiveSectionLabel(sectionKey?: string): string {
  if (!sectionKey) return 'القسم';
  return ARCHIVE_SECTION_LABELS[sectionKey] || sectionKey;
}

/**
 * Normalizes a section-list field into a deduplicated array of lowercase trimmed keys.
 */
export function normalizeSectionList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim()) {
      return Array.from(
        new Set(
          value
            .split(/[,;|]/)
            .map(s => s.trim().toLowerCase())
            .filter(Boolean)
        )
      );
    }
    return [];
  }
  return Array.from(
    new Set(
      value
        .map(v => String(v || '').trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

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
 * Resolves explicit global archive state on any record:
 * - Returns `true` if explicitly archived globally
 * - Returns `false` if explicitly unarchived (`IsArchived === false` / `archived === false` / `الأرشفة === 'لا'`)
 * - Returns `null` if no explicit global archive flag is present
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
 * Returns true if an OfficeRequest is globally archived or imported from historical Excel/DB.
 * Used for global archive summaries and historical import exclusion.
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
 * Returns true if a Citizen record is globally archived or imported from historical Excel/DB.
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

/**
 * Per-Section Independent Archive Check (OfficeRequest):
 * 1. If `sectionKey` is explicitly in `req.archivedInSections` -> TRUE (archived in THIS section).
 * 2. If `sectionKey` is explicitly in `req.unarchivedInSections` -> FALSE (restored to THIS section's Daily Work).
 * 3. Otherwise, falls back to legacy global archive / historical import check (`isRequestArchivedOrRestored`).
 *
 * Archiving in section A only adds 'A' to `archivedInSections` (never sets global `IsArchived = true`),
 * so section B continues seeing the record normally!
 */
export function isRequestArchivedInSection(
  req?: OfficeRequest | null,
  sectionKey?: ArchiveSectionKey
): boolean {
  if (!req) return false;
  const sec = String(sectionKey || '').trim().toLowerCase();
  if (!sec) return isRequestArchivedOrRestored(req);

  const archivedSecs = normalizeSectionList((req as any).archivedInSections);
  if (archivedSecs.includes(sec)) return true;

  const unarchivedSecs = normalizeSectionList((req as any).unarchivedInSections);
  if (unarchivedSecs.includes(sec)) return false;

  // Fallback for legacy globally-archived / Excel-imported records
  return isRequestArchivedOrRestored(req);
}

/**
 * Per-Section Independent Archive Check (Citizen):
 * 1. If `sectionKey` is explicitly in `cit.archivedInSections` -> TRUE.
 * 2. If `sectionKey` is explicitly in `cit.unarchivedInSections` -> FALSE.
 * 3. If the citizen itself is legacy-globally archived/imported -> TRUE.
 * 4. If `citizenRequests` is non-empty and ALL requests are archived in `sectionKey` -> TRUE.
 * 5. Otherwise -> FALSE.
 */
export function isCitizenArchivedInSection(
  cit?: Citizen | null,
  sectionKey?: ArchiveSectionKey,
  citizenRequests?: OfficeRequest[]
): boolean {
  if (!cit) return false;
  const sec = String(sectionKey || '').trim().toLowerCase();
  if (!sec) return isCitizenArchivedOrRestored(cit, citizenRequests);

  const archivedSecs = normalizeSectionList((cit as any).archivedInSections);
  if (archivedSecs.includes(sec)) return true;

  const unarchivedSecs = normalizeSectionList((cit as any).unarchivedInSections);
  if (unarchivedSecs.includes(sec)) return false;

  // Check citizen-level legacy global archive flag
  if (isCitizenArchivedOrRestored(cit)) return true;

  // Check if all associated requests are archived in this exact section
  if (citizenRequests && citizenRequests.length > 0) {
    const allReqsArchivedInSec = citizenRequests.every((r) => isRequestArchivedInSection(r, sec));
    if (allReqsArchivedInSec) return true;
  }

  return false;
}

/**
 * Computes updated per-section archive arrays when archiving a record in `sectionKey`.
 * Does NOT touch global `IsArchived` so other departments remain 100% unaffected.
 */
export function buildSectionArchivedFields(
  record: { archivedInSections?: string[]; unarchivedInSections?: string[] } | null | undefined,
  sectionKey: ArchiveSectionKey
): { archivedInSections: string[]; unarchivedInSections: string[] } {
  const sec = String(sectionKey || '').trim().toLowerCase();
  const prevArchived = normalizeSectionList(record?.archivedInSections);
  const prevUnarchived = normalizeSectionList(record?.unarchivedInSections);

  const nextArchived = sec && !prevArchived.includes(sec) ? [...prevArchived, sec] : prevArchived;
  const nextUnarchived = sec ? prevUnarchived.filter(s => s !== sec) : prevUnarchived;

  return {
    archivedInSections: nextArchived,
    unarchivedInSections: nextUnarchived
  };
}

/**
 * Computes updated per-section archive arrays when restoring a record to Daily Work in `sectionKey`.
 * - Removes `sectionKey` from `archivedInSections`.
 * - If the record also had legacy global archive/historical flags, adds `sectionKey` to `unarchivedInSections`
 *   so it immediately reappears in THIS section's Daily Work without polluting other sections.
 */
export function buildSectionUnarchivedFields(
  record: Record<string, any> | null | undefined,
  sectionKey: ArchiveSectionKey
): { archivedInSections: string[]; unarchivedInSections: string[] } {
  const sec = String(sectionKey || '').trim().toLowerCase();
  const prevArchived = normalizeSectionList(record?.archivedInSections);
  const prevUnarchived = normalizeSectionList(record?.unarchivedInSections);

  const nextArchived = sec ? prevArchived.filter(s => s !== sec) : prevArchived;

  const hasLegacyGlobalArchive = Boolean(
    record &&
      (resolveExplicitArchiveState(record) === true ||
        parseArchivedFlag(record.IsHistoricalImported) ||
        record.DirectorDecision === 'مؤرشف' ||
        (typeof record.ArchiveCode === 'string' && record.ArchiveCode.trim().length > 0) ||
        (typeof record.ArchivedAt === 'string' && record.ArchivedAt.trim().length > 0))
  );

  const nextUnarchived =
    sec && hasLegacyGlobalArchive && !prevUnarchived.includes(sec)
      ? [...prevUnarchived, sec]
      : prevUnarchived;

  return {
    archivedInSections: nextArchived,
    unarchivedInSections: nextUnarchived
  };
}
