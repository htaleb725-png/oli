import { User, CustomSection } from '../types';

/**
 * Single Source of Truth for Strict RBAC & Section Access Control
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

export function getHomeSectionForRole(role?: string, user?: User | null): string {
  const defaultByRole = ((): string => {
    switch (role) {
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
        return 'machine';
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
    role !== 'developer' &&
    role !== 'director' &&
    role !== 'deputy' &&
    Array.isArray(user.AllowedSections) &&
    user.AllowedSections.length > 0
  ) {
    if (user.AllowedSections.includes(defaultByRole)) {
      return defaultByRole;
    }
    return user.AllowedSections[0];
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
      return ['dashboard', 'machine', 'search_archive', 'reports'].includes(section);
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
    tile_machine: 'machine',
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
