import { OfficeRequest } from '../types';

/**
 * Strict Zero-Chrome-Persistence Policy (سياسة منع التخزين الدائم للسجلات والجلسات في Chrome)
 * ------------------------------------------------------------------------------------------
 * Strictly prohibits storing ANY office business records (citizens, requests,
 * interviews, letters, cheques, organization records, custom sections/records,
 * users, dropdowns, archive documents) OR user sessions/passcodes/tokens inside
 * Chrome localStorage or sessionStorage.
 * All business records & active sessions live strictly in live React memory
 * and the unified Cloud Databases (Firebase Firestore + Google Sheets).
 * ONLY lightweight cosmetic UI flags (theme / dark mode / sound / sidebar) are permitted.
 */

const ALLOWED_COSMETIC_UI_KEYS = [
  'theme',
  'dark',
  'sidebar',
  'sound'
];

export function isAllowedCosmeticUiKey(key: string): boolean {
  const lower = String(key || '').toLowerCase();
  if (!lower) return false;
  // Never allow settings, sessions, tokens, passcodes, or data collections
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
  const lower = String(key || '').toLowerCase();
  if (!lower) return false;
  if (isAllowedCosmeticUiKey(lower)) return false;
  return true;
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
 * All business records, settings, and user sessions are strictly blocked from Chrome storage.
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
 * Debounced writer for cosmetic UI preferences only (blocks all records & sessions).
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
 * Purges ALL business records, user sessions, passcodes, and cached settings
 * from Chrome localStorage AND sessionStorage on startup.
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
        if (k && !isAllowedCosmeticUiKey(k)) {
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
