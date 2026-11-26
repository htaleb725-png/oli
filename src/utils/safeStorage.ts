import { OfficeRequest, User } from '../types';

/**
 * Strict Zero-Chrome-Persistence Policy for Business Records
 * ----------------------------------------------------------
 * Strictly prohibits storing ANY office business records (citizens, requests,
 * interviews, letters, cheques, organization records, custom sections/records,
 * staff directory, dropdowns, archive documents) inside Chrome localStorage or
 * sessionStorage. All business records live strictly in live React memory and
 * the unified Cloud Databases (Firebase Firestore + Google Sheets).
 *
 * PERMITTED browser keys ONLY:
 * 1) Lightweight cosmetic UI flags (theme / dark mode / sound / sidebar)
 * 2) Dedicated employee login session key (`al_nashi_auth_session_v1`) storing
 *    ONLY the currently signed-in user profile/permissions (NEVER passwords) and
 *    active section so F5 / tab reopen keeps the employee signed in until manual logout.
 */

export const AUTH_SESSION_STORAGE_KEY = 'al_nashi_auth_session_v1';

const ALLOWED_COSMETIC_UI_KEYS = [
  'theme',
  'dark',
  'sidebar',
  'sound'
];

export interface PersistedAuthSession {
  user: Omit<User, 'Password'>;
  activeSection: string;
  savedAt: number;
}

export function isAuthSessionStorageKey(key: string): boolean {
  return key === AUTH_SESSION_STORAGE_KEY;
}

export function isAllowedCosmeticUiKey(key: string): boolean {
  const lower = String(key || '').toLowerCase();
  if (!lower) return false;
  // Never allow settings, sessions, tokens, passcodes, or data collections via generic writer
  if (
    lower.includes('user') ||
    lower.includes('session') ||
    lower.includes('token') ||
    lower.includes('passcode') ||
    lower.includes('settings') ||
    lower.includes('sheet') ||
    lower.includes('drive') ||
    lower.includes('script') ||
    lower.includes('citizen') ||
    lower.includes('request') ||
    lower.includes('record') ||
    lower.includes('audit')
  ) {
    return false;
  }
  return ALLOWED_COSMETIC_UI_KEYS.some(allowed => lower.includes(allowed));
}

export function isBusinessRecordStorageKey(key: string): boolean {
  if (!key) return false;
  if (isAuthSessionStorageKey(key)) return false;
  if (isAllowedCosmeticUiKey(key)) return false;
  return true;
}

/**
 * Safely persists ONLY the signed-in employee's session identity, role/permissions,
 * and active section in localStorage (explicitly strips Password/secrets).
 * Zero citizen or request records are ever stored.
 */
export function savePersistedAuthSession(user: User, activeSection: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  if (!user || !user.User_ID || !user.Role) return false;

  try {
    const { Password: _omittedPassword, ...safeUser } = user;
    const payload: PersistedAuthSession = {
      user: safeUser,
      activeSection: activeSection || 'dashboard',
      savedAt: Date.now()
    };
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the persisted employee login session on page load / F5 / tab reopen.
 * Returns null if no valid session exists (forcing login screen).
 */
export function loadPersistedAuthSession(): PersistedAuthSession | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.user ||
      typeof parsed.user !== 'object' ||
      !parsed.user.User_ID ||
      !parsed.user.Role
    ) {
      return null;
    }
    const { Password: _omittedPassword, ...safeUser } = parsed.user as User;
    return {
      user: safeUser,
      activeSection: typeof parsed.activeSection === 'string' && parsed.activeSection.trim()
        ? parsed.activeSection.trim()
        : 'dashboard',
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now()
    };
  } catch {
    return null;
  }
}

/**
 * Clears the persisted employee login session ONLY when the user manually logs out.
 */
export function clearPersistedAuthSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {}
  try {
    window.sessionStorage?.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {}
}

/**
 * Strips heavy base64 strings from requests before network transport
 * so payloads stay under Firestore / Apps Script size limits.
 */
export function sanitizeRequestsForStorage(requests: OfficeRequest[]): OfficeRequest[] {
  if (!Array.isArray(requests)) return [];

  return requests.map(req => {
    const sanitized: OfficeRequest = { ...req };

    if (req.AttachedRequestImage && req.AttachedRequestImage.startsWith('data:') && req.AttachedRequestImage.length > 500) {
      sanitized.AttachedRequestImage = '';
    }

    if (req.AttachmentRequest && req.AttachmentRequest.startsWith('data:') && req.AttachmentRequest.length > 500) {
      sanitized.AttachmentRequest = '';
    }

    if (req.AttachmentResponse && req.AttachmentResponse.startsWith('data:') && req.AttachmentResponse.length > 500) {
      sanitized.AttachmentResponse = '';
    }

    if (Array.isArray(req.ScanAttachments) && req.ScanAttachments.length > 0) {
      sanitized.ScanAttachments = req.ScanAttachments.map((att) => {
        if (att.url && att.url.startsWith('data:') && att.url.length > 500) {
          return { ...att, url: '' };
        }
        return att;
      });
    }

    return sanitized;
  });
}

/**
 * Writes ONLY cosmetic UI preference keys (e.g., dark mode).
 * All business records, settings, and citizen collections remain strictly blocked from Chrome storage.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  if (!isAllowedCosmeticUiKey(key)) {
    return false;
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Debounced writer for cosmetic UI preferences only (blocks all business records).
 */
const _pendingStorageTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleSafeLocalStorageSet(
  key: string,
  serialize: () => string,
  delayMs: number = 350
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (!isAllowedCosmeticUiKey(key)) return;

  const existing = _pendingStorageTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    _pendingStorageTimers.delete(key);
    try {
      safeLocalStorageSet(key, serialize());
    } catch {}
  }, delayMs);

  _pendingStorageTimers.set(key, timer);
}

/**
 * Purges ALL business records, citizen caches, passcodes, and cached settings
 * from Chrome localStorage AND sessionStorage on startup, while preserving ONLY
 * cosmetic UI preferences and the active employee login session key.
 */
export function purgeLegacyBrowserBusinessData(): number {
  if (typeof window === 'undefined') return 0;
  let removedCount = 0;

  const purgeStorage = (storage: Storage | undefined | null) => {
    if (!storage) return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && !isAllowedCosmeticUiKey(k) && !isAuthSessionStorageKey(k)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        try {
          storage.removeItem(k);
          removedCount++;
        } catch {}
      }
    } catch {}
  };

  purgeStorage(window.localStorage);
  purgeStorage(window.sessionStorage);

  return removedCount;
}

/**
 * Startup cleanup helper called by ErrorBoundary and App bootstrap
 */
export function cleanBloatedLocalStorage(): void {
  purgeLegacyBrowserBusinessData();
}
