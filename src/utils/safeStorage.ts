import { OfficeRequest } from '../types';
import { saveImageToDB } from './imageDb';

/**
 * Strips heavy base64 strings from requests before storing in localStorage,
 * preserving all metadata and offloading images to IndexedDB.
 */
export function sanitizeRequestsForStorage(requests: OfficeRequest[]): OfficeRequest[] {
  if (!Array.isArray(requests)) return [];

  return requests.map(req => {
    let hasHeavyData = false;
    const sanitized: OfficeRequest = { ...req };

    // Offload AttachedRequestImage to IndexedDB if large base64
    if (req.AttachedRequestImage && req.AttachedRequestImage.startsWith('data:') && req.AttachedRequestImage.length > 500) {
      hasHeavyData = true;
      saveImageToDB({
        id: `REQ_IMG_${req.Request_ID}`,
        citizenName: req.CitizenName,
        citizenId: req.Citizen_ID,
        dataUrl: req.AttachedRequestImage,
        fileName: `طلب-${req.Request_ID}.jpg`,
        fileSize: `${Math.round(req.AttachedRequestImage.length / 1024)} KB`,
        mimeType: 'image/jpeg',
        uploadedAt: req.CreatedAt || new Date().toISOString()
      }).catch(() => {});
      sanitized.AttachedRequestImage = '';
    }

    // Offload AttachmentRequest if large
    if (req.AttachmentRequest && req.AttachmentRequest.startsWith('data:') && req.AttachmentRequest.length > 500) {
      hasHeavyData = true;
      sanitized.AttachmentRequest = '';
    }

    // Offload AttachmentResponse if large
    if (req.AttachmentResponse && req.AttachmentResponse.startsWith('data:') && req.AttachmentResponse.length > 500) {
      hasHeavyData = true;
      sanitized.AttachmentResponse = '';
    }

    // Offload ScanAttachments if large
    if (Array.isArray(req.ScanAttachments) && req.ScanAttachments.length > 0) {
      sanitized.ScanAttachments = req.ScanAttachments.map((att, idx) => {
        if (att.url && att.url.startsWith('data:') && att.url.length > 500) {
          saveImageToDB({
            id: `SCAN_${req.Request_ID}_${att.id || idx}`,
            citizenName: req.CitizenName,
            citizenId: req.Citizen_ID,
            dataUrl: att.url,
            fileName: att.fileName || `مرفق-${idx + 1}.jpg`,
            fileSize: `${Math.round(att.url.length / 1024)} KB`,
            mimeType: 'image/jpeg',
            uploadedAt: att.uploadedAt || req.CreatedAt || new Date().toISOString()
          }).catch(() => {});
          return { ...att, url: '' };
        }
        return att;
      });
    }

    return sanitized;
  });
}

/**
 * Safely writes to localStorage with automatic QuotaExceeded recovery
 * and non-essential cache eviction so React never crashes.
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[SafeStorage] Quota exceeded or error saving key "${key}". Initiating recovery...`, err);

    try {
      // 1. Evict non-essential items
      const dispensableKeys = [
        'ola_alnashi_office_audit',
        'sidebar_collapsed',
        'ola_alnashi_office_dynamic_fields',
        'ola_alnashi_office_assigned_workstation_user'
      ];

      for (const k of dispensableKeys) {
        if (k !== key) {
          try {
            localStorage.removeItem(k);
          } catch {}
        }
      }

      // 2. If the failing key is requests, sanitize even more aggressively
      if (key.includes('requests')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            const stripped = sanitizeRequestsForStorage(parsed);
            localStorage.setItem(key, JSON.stringify(stripped));
            return true;
          }
        } catch {}
      }

      // 3. Try setItem again
      localStorage.setItem(key, value);
      return true;
    } catch (secondErr) {
      console.error(`[SafeStorage] Secondary recovery failed for key "${key}":`, secondErr);
      // Suppress error so React ErrorBoundary doesn't crash the application
      return false;
    }
  }
}

/**
 * One-time cleanup of existing bloated localStorage data on app startup
 */
export function cleanBloatedLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const rawReqs = localStorage.getItem('ola_alnashi_office_requests');
    if (rawReqs && rawReqs.length > 2000000) { // > 2MB
      const parsed = JSON.parse(rawReqs);
      if (Array.isArray(parsed)) {
        const sanitized = sanitizeRequestsForStorage(parsed);
        localStorage.setItem('ola_alnashi_office_requests', JSON.stringify(sanitized));
        console.log('[SafeStorage] Cleaned oversized requests payload in localStorage.');
      }
    }
  } catch (e) {
    console.warn('[SafeStorage] Error during initial storage cleaning:', e);
  }
}
