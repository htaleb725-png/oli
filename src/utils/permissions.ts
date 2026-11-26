import { User, UserRole, CustomSection } from '../types';

/**
 * Single Source of Truth for Strict RBAC, Canonical Role Resolution & Section Access Control
 * - قسم الرعاية الاجتماعية ('social_care' / 'custom_section_sec_social_welfare') قسم مستقل تماماً
 *   ولا يظهر لأي قسم آخر إلا إذا قام المطور أو المدير التنفيذي بمنح الصلاحية صراحةً.
 */

export const SOCIAL_CARE_SECTION_ID = 'social_care';
export const SOCIAL_CARE_LEGACY_CUSTOM_ID = 'sec_social_welfare';

export function isSocialCareSectionKey(sectionKey: string): boolean {
  return (
    sectionKey === SOCIAL_CARE_SECTION_ID ||
    sectionKey === `custom_section_${SOCIAL_CARE_LEGACY_CUSTOM_ID}` ||
    sectionKey === SOCIAL_CARE_LEGACY_CUSTOM_ID ||
    sectionKey === 'tile_social_care' ||
    sectionKey === `tile_custom_${SOCIAL_CARE_LEGACY_CUSTOM_ID}`
  );
}

const VALID_ENGLISH_ROLES = new Set<string>([
  'developer',
  'director',
  'deputy',
  'admin',
  'admin_officer',
  'reception',
  'reception_officer',
  'social_care',
  'social_care_officer',
  'interviews_officer',
  'organization',
  'organization_officer',
  'machine',
  'machine_officer',
  'audit',
  'archive'
]);

function normalizeArabicTextForRole(val?: string): string {
  return String(val || '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function inferRoleFromText(rawText?: string): UserRole | '' {
  const norm = normalizeArabicTextForRole(rawText);
  if (!norm) return '';

  // Exact English aliases first
  if (VALID_ENGLISH_ROLES.has(norm)) return norm as UserRole;
  if (norm === 'dev' || norm === 'superadmin' || norm === 'master_admin') return 'developer';
  if (norm === 'office_director' || norm === 'office_manager' || norm === 'executive_director' || norm === 'manager') return 'director';
  if (norm === 'mp' || norm === 'representative') return 'deputy';
  if (norm === 'administration') return 'admin';
  if (norm === 'interviews') return 'interviews_officer';
  if (norm === 'social_welfare') return 'social_care';
  if (norm === 'auditor') return 'audit';
  if (norm === 'archivist' || norm === 'search_archive') return 'archive';

  // Arabic role / title / department matching (strict priority order)
  if (norm.includes('مطور') || norm.includes('برمج') || norm.includes('تكنولوجيا المعلومات')) return 'developer';
  if (norm.includes('مدير المكتب') || norm.includes('مدير مكتب') || norm.includes('المدير التنفيذي') || norm.includes('مكتب المدير')) return 'director';
  if (norm.includes('النائب')) return 'deputy';
  if (norm.includes('الرعايه الاجتماعيه') || norm.includes('رعايه اجتماعيه')) {
    return norm.includes('موظف') ? 'social_care_officer' : 'social_care';
  }
  if (norm.includes('المقابلات') || norm.includes('مقابلات')) return 'interviews_officer';
  if (norm.includes('التنظيم') || norm.includes('تنظيم') || norm.includes('الجماهير')) {
    return norm.includes('موظف') ? 'organization_officer' : 'organization';
  }
  if (norm.includes('الرقابه') || norm.includes('التدقيق') || norm.includes('التشريع')) return 'audit';
  if (norm.includes('الارشيف') || norm.includes('الارشفه') || norm.includes('الوثائق')) return 'archive';
  if (norm.includes('المكنه') || norm.includes('طباعه الكتب')) {
    return norm.includes('موظف') ? 'machine_officer' : 'machine';
  }
  if (norm.includes('الاستعلامات') || norm.includes('استعلامات')) {
    return norm.includes('موظف') ? 'reception_officer' : 'reception';
  }
  if (norm.includes('الاداره') || norm.includes('اداره') || norm.includes('المعاملات')) {
    return norm.includes('موظف') ? 'admin_officer' : 'admin';
  }

  return '';
}

/**
 * Resolves the authoritative canonical UserRole from Role, RoleArabic, and Department.
 * - Never blindly defaults unknown roles to 'reception'.
 * - Self-heals records whose Role was accidentally set to 'reception' by legacy Sheet pulls
 *   while their RoleArabic explicitly identifies another role (e.g. "مدير المكتب التنفيذي").
 */
export function normalizeUserRole(
  rawRole?: string,
  roleArabic?: string,
  department?: string
): UserRole {
  const cleanRole = normalizeArabicTextForRole(rawRole);
  const fromRawRole = inferRoleFromText(rawRole);
  const fromRoleArabic = inferRoleFromText(roleArabic);
  const fromDepartment = inferRoleFromText(department);

  // Self-heal legacy Sheet corruption where Role defaulted to 'reception' while RoleArabic clearly specifies another role
  if (
    (cleanRole === 'reception' || cleanRole === '') &&
    fromRoleArabic &&
    fromRoleArabic !== 'reception' &&
    fromRoleArabic !== 'reception_officer'
  ) {
    return fromRoleArabic;
  }

  if (fromRawRole) return fromRawRole;
  if (fromRoleArabic) return fromRoleArabic;
  if (fromDepartment) return fromDepartment;

  // Safe neutral fallback — NEVER coerce an unknown user into 'reception'
  return (cleanRole as UserRole) || ('admin' as UserRole);
}

export function resolveCanonicalUserRole(user?: Partial<User> | null): UserRole {
  if (!user) return 'admin';
  return normalizeUserRole(user.Role, user.RoleArabic, user.Department);
}

/**
 * Returns a clean User object with its canonical Role accurately bound to its own record.
 */
export function normalizeUserRecord(user: User): User {
  if (!user) return user;
  const resolvedRole = resolveCanonicalUserRole(user);
  if (resolvedRole === user.Role) return user;
  return {
    ...user,
    Role: resolvedRole
  };
}

export function getHomeSectionForRole(role?: string, user?: User | null): string {
  const effectiveRole: string = user
    ? resolveCanonicalUserRole({ ...user, Role: (user.Role || role) as UserRole })
    : normalizeUserRole(role);

  const defaultByRole = ((): string => {
    switch (effectiveRole) {
      case 'reception':
      case 'reception_officer':
        return 'reception';
      case 'admin':
      case 'admin_officer':
        return 'admin';
      case 'social_care':
      case 'social_care_officer':
        return 'social_care';
      case 'interviews_officer':
        return 'interviews';
      case 'organization':
      case 'organization_officer':
        return 'organization';
      case 'machine':
      case 'machine_officer':
        return 'dashboard';
      case 'audit':
        return 'audit';
      case 'archive':
        return 'search_archive';
      case 'director':
        return 'director';
      case 'deputy':
        return 'interviews';
      case 'developer':
        return 'master_admin';
      default:
        return 'dashboard';
    }
  })();

  if (
    user &&
    effectiveRole !== 'developer' &&
    effectiveRole !== 'director' &&
    effectiveRole !== 'deputy' &&
    Array.isArray(user.AllowedSections) &&
    user.AllowedSections.length > 0
  ) {
    if (user.AllowedSections.includes(defaultByRole)) {
      return defaultByRole;
    }
    const firstNonDashboard = user.AllowedSections.find((s) => s && s !== 'dashboard');
    return firstNonDashboard || user.AllowedSections[0];
  }

  return defaultByRole;
}

export function canUserAccessSocialCare(user?: User | null): boolean {
  if (!user) return false;
  const role = user.Role;
  // المطور، المدير التنفيذي، والنائب، وموظف قسم الرعاية الاجتماعية المستقل
  if (
    role === 'developer' ||
    role === 'director' ||
    role === 'deputy' ||
    role === 'social_care' ||
    role === 'social_care_officer'
  ) {
    return true;
  }
  // صلاحية صريحة من المطور أو المدير التنفيذي
  if (user.AllowedSections?.includes(SOCIAL_CARE_SECTION_ID)) return true;
  if (user.AllowedSections?.includes(`custom_section_${SOCIAL_CARE_LEGACY_CUSTOM_ID}`)) return true;
  if (user.Permissions?.includes('access_social_care')) return true;
  return false;
}

export function canUserAccessSection(
  user: User | null | undefined,
  section: string,
  customSections: CustomSection[] = []
): boolean {
  if (!user) return false;
  const role = user.Role;

  // Developer has absolute unrestricted access to everything in the system
  if (role === 'developer') return true;

  // Developer-only panels
  if (section === 'master_admin' || section === 'apps_script') {
    return user.AllowedSections?.includes(section) || false;
  }

  // Director & Deputy have full operational access to all sections (except developer-only above)
  if (role === 'director' || role === 'deputy') return true;

  // Standalone Social Care Isolation — NEVER shown to other departments unless explicitly granted
  if (isSocialCareSectionKey(section)) {
    return canUserAccessSocialCare(user);
  }

  // Dashboard is always accessible to authenticated staff
  if (section === 'dashboard') return true;

  // If the Developer or Director explicitly configured AllowedSections for this user, honor it directly
  if (Array.isArray(user.AllowedSections) && user.AllowedSections.length > 0) {
    if (user.AllowedSections.includes(section)) {
      return true;
    }
    if (section.startsWith('custom_section_')) {
      const secId = section.replace('custom_section_', '');
      const targetSec = customSections.find(s => s.id === secId);
      if (targetSec?.allowedUserIds?.includes(user.User_ID)) return true;
    }
    return false;
  }

  // Custom dynamic sections created by the developer (when user has no explicit AllowedSections matrix)
  if (section.startsWith('custom_section_')) {
    const secId = section.replace('custom_section_', '');
    if (secId === SOCIAL_CARE_LEGACY_CUSTOM_ID) {
      return canUserAccessSocialCare(user);
    }
    const targetSec = customSections.find(s => s.id === secId);
    if (!targetSec) return false;

    if (targetSec.allowedUserIds && targetSec.allowedUserIds.includes(user.User_ID)) {
      return true;
    }

    const hasRoleRestriction =
      targetSec.isStandaloneRestricted ||
      (Array.isArray(targetSec.allowedRoles) && targetSec.allowedRoles.length > 0);

    if (hasRoleRestriction) {
      return Array.isArray(targetSec.allowedRoles) && targetSec.allowedRoles.includes(role);
    }

    return true;
  }

  // Role-based default built-in sections (fallback for legacy accounts without AllowedSections)
  switch (role) {
    case 'reception':
    case 'reception_officer':
      return ['dashboard', 'reception', 'search_archive'].includes(section);
    case 'admin':
    case 'admin_officer':
      return ['dashboard', 'admin', 'drive_requests', 'search_archive', 'reports', 'whatsapp', 'blacklist'].includes(section);
    case 'social_care':
    case 'social_care_officer':
      return ['dashboard', 'social_care', 'search_archive'].includes(section);
    case 'interviews_officer':
      return ['dashboard', 'interviews', 'search_archive', 'reports', 'whatsapp'].includes(section);
    case 'organization':
    case 'organization_officer':
      return ['dashboard', 'organization', 'search_archive', 'reports', 'whatsapp'].includes(section);
    case 'machine':
    case 'machine_officer':
      return ['dashboard', 'search_archive', 'reports'].includes(section);
    case 'audit':
      return ['dashboard', 'audit', 'search_archive', 'reports', 'blacklist'].includes(section);
    case 'archive':
      return ['dashboard', 'search_archive', 'reports'].includes(section);
    default:
      return ['dashboard', 'search_archive', 'reports'].includes(section);
  }
}

/**
 * Map a dashboard/home tile ID to its underlying section ID so RBAC checks work identically everywhere.
 */
export function mapTileIdToSectionId(tileId: string): string {
  if (tileId.startsWith('tile_custom_')) {
    const secId = tileId.replace('tile_custom_', '');
    if (secId === SOCIAL_CARE_LEGACY_CUSTOM_ID) return SOCIAL_CARE_SECTION_ID;
    return `custom_section_${secId}`;
  }
  const map: Record<string, string> = {
    tile_director: 'director',
    tile_reception: 'reception',
    tile_admin: 'admin',
    tile_social_care: 'social_care',
    tile_interviews: 'interviews',
    tile_organization: 'organization',
    tile_drive_requests: 'drive_requests',
    tile_search_archive: 'search_archive',
    tile_reports: 'reports',
    tile_whatsapp: 'whatsapp',
    tile_audit: 'audit',
    tile_blacklist: 'blacklist',
    tile_master_admin: 'master_admin',
    tile_apps_script: 'apps_script'
  };
  return map[tileId] || tileId.replace(/^tile_/, '');
}

export function canManageUsersAndPermissions(user?: User | null): boolean {
  if (!user) return false;
  if (user.Role === 'developer' || user.Role === 'director') return true;
  return Boolean(user.Permissions?.includes('manage_permissions'));
}
