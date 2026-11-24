import { OfficeRequest } from '../types';

/**
 * Chrome Browser Storage Policy (سياسة التخزين الصارمة)
 * -----------------------------------------------------
 * Strictly prohibits storing office business records (citizens, requests,
 * interviews, letters, cheques, organization records, custom sections/records,
 * users, dropdowns, archive documents) inside Chrome localStorage.
 * ONLY login session metadata and UI appearance/theme preferences are allowed.
 */

const BLOCKED_BUSINESS_KEY_PATTERNS = [
  'citizens',
  'requests',
  'cheques',
  'interviews',
  'org',
  'documents',
  'letters',
  'users',
  'dropdowns',
  'audit',
  'custom_sections',
  'custom_records',
  'drive_requests_cache',
  'dynamic_fields',
  'has_real_data'
];

export function isBusinessRecordStorageKey(key: string): boolean {
  const lower = String(key || '').toLowerCase();
  if (!lower) return false;
  // Allow explicitly permitted session & UI keys
  if (
    lower.includes('assigned_workstation_user') ||
    lower.includes('theme') ||
    lower.includes('dark') ||
    lower.includes('sidebar') ||
    lower.includes('sound') ||
    lower.includes('google_token') ||
    lower.includes('google_user_email') ||
    lower.includes('office_partition') ||
    lower.includes('dev_passcode')
  ) {
    return false;
  }
  return BLOCKED_BUSINESS_KEY_PATTERNS.some(pattern => lower.includes(pattern));
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
 * Writes ONLY whitelisted session/UI preference keys to localStorage.
 * Business data keys are strictly blocked so Chrome never acts as a fake database.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  if (isBusinessRecordStorageKey(key)) {
    // Strictly block persisting office records in Chrome localStorage
    return false;
  }

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[SafeStorage] Unable to save UI/session preference "${key}":`, err);
    return false;
  }
}

/**
 * Debounced writer for UI preferences only (blocks all business record keys).
 */
const _pendingStorageTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleSafeLocalStorageSet(
  key: string,
  serialize: () => string,
  delayMs: number = 350
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (isBusinessRecordStorageKey(key)) return;

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
 * Purges any legacy business records previously cached in Chrome localStorage
 * so stale browser data can never shadow or overwrite Cloud DB records.
 */
export function purgeLegacyBrowserBusinessData(): number {
  if (typeof window === 'undefined' || !window.localStorage) return 0;
  let removedCount = 0;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isBusinessRecordStorageKey(k)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      try {
        localStorage.removeItem(k);
        removedCount++;
      } catch {}
    }
  } catch {}
  return removedCount;
}

/**
 * Startup cleanup helper called by ErrorBoundary and App bootstrap
 */
export function cleanBloatedLocalStorage(): void {
  purgeLegacyBrowserBusinessData();
}
