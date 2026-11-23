import {
  DriveFileItem,
  getAccessToken,
  searchDriveFiles,
  deleteDriveFile,
  deleteDriveFileViaAppsScript
} from './googleSheetsService';
import { resolveAppsScriptUrl, getRuntimeCloudConfig } from './realtimeGoogleSync';
import { printImageIsolated, printHtmlSafely } from '../utils/printReceiptHelper';

export const DEFAULT_DRIVE_FOLDER_ID = '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc';

export type DriveFileCategory = 'image' | 'pdf' | 'doc' | 'sheet' | 'other';

export interface UnifiedDriveFile extends DriveFileItem {
  category: DriveFileCategory;
  previewImageUrl: string;
  fallbackImageUrl: string;
  proxyImageUrl: string;
  embedPreviewUrl: string;
  directDownloadUrl: string;
}

export function extractDriveFolderId(raw?: string): string {
  const candidate = (raw || '').trim();
  if (!candidate) {
    const runtimeFolder = getRuntimeCloudConfig().googleDriveFolderId;
    if (runtimeFolder) return extractDriveFolderId(runtimeFolder);
    return DEFAULT_DRIVE_FOLDER_ID;
  }
  const match = candidate.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  const idMatch = candidate.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  return candidate.split('?')[0].split('&')[0].trim() || DEFAULT_DRIVE_FOLDER_ID;
}

export function normalizeArabicQuery(val: string): string {
  return (val || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function matchesArabicPartial(haystack: string, query: string): boolean {
  const normQ = normalizeArabicQuery(query);
  if (!normQ) return true;
  const normH = normalizeArabicQuery(haystack);
  if (!normH) return false;
  if (normH.includes(normQ)) return true;
  const tokens = normQ.split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => normH.includes(t));
}

export function detectDriveFileCategory(mimeType?: string, fileName?: string): DriveFileCategory {
  const m = (mimeType || '').toLowerCase();
  const n = (fileName || '').toLowerCase();

  if (m.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
  if (
    m.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|bmp|svg|heic|tif|tiff)$/i.test(n)
  ) {
    return 'image';
  }
  if (
    m.includes('spreadsheet') ||
    m.includes('excel') ||
    /\.(xlsx|xls|csv)$/i.test(n)
  ) {
    return 'sheet';
  }
  if (
    m.includes('word') ||
    m.includes('document') ||
    m.includes('text/') ||
    /\.(doc|docx|rtf|txt|odt)$/i.test(n)
  ) {
    return 'doc';
  }
  return 'other';
}

export function toUnifiedDriveFile(raw: DriveFileItem & { url?: string; viewUrl?: string }): UnifiedDriveFile {
  const id = String(raw.id || '').trim();
  const name = String(raw.name || 'ملف_مؤرشف').trim();
  const mimeType = String(raw.mimeType || '').trim();
  const category = detectDriveFileCategory(mimeType, name);

  return {
    ...raw,
    id,
    name,
    mimeType:
      mimeType ||
      (category === 'pdf'
        ? 'application/pdf'
        : category === 'image'
        ? 'image/jpeg'
        : 'application/octet-stream'),
    category,
    previewImageUrl: `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1200`,
    fallbackImageUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`,
    proxyImageUrl: `/api/drive/image/${encodeURIComponent(id)}?sz=w600`,
    embedPreviewUrl: `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`,
    directDownloadUrl: raw.webContentLink || `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`,
    webViewLink: raw.webViewLink || raw.viewUrl || `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`,
    thumbnailLink: `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`
  };
}

let _expressDriveProxyAvailable: boolean | null = null;

/**
 * Fetches ALL files (images, PDFs, Word, Excel, etc.) from the Developer's configured Google Drive folder.
 * Works identically on BOTH Vercel (via Apps Script Web App & Google Drive API v3) AND AI Studio (also via Express proxy).
 */
export async function fetchLiveDriveFolderFiles(options: {
  folderId?: string;
  appsScriptUrl?: string;
  query?: string;
  forceRefresh?: boolean;
  limit?: number;
}): Promise<{
  files: UnifiedDriveFile[];
  totalInFolder: number;
  source: 'apps_script' | 'server_proxy' | 'oauth_api' | 'none';
  error?: string;
  isPrivate?: boolean;
}> {
  const rawInput = (options.folderId || '').trim();
  const folderId = extractDriveFolderId(rawInput);
  const rkMatch = rawInput.match(/[?&]resourcekey=([a-zA-Z0-9_-]+)/i);
  const resourceKey = rkMatch && rkMatch[1] ? rkMatch[1] : '';
  const query = (options.query || '').trim();
  const limit = options.limit || 5000;
  const resolvedScriptUrl = resolveAppsScriptUrl(options.appsScriptUrl);

  let rawFiles: DriveFileItem[] = [];
  let totalInFolder = 0;
  let source: 'apps_script' | 'server_proxy' | 'oauth_api' | 'none' = 'none';
  let lastError: string | undefined;
  let isPrivate = false;

  // Strategy 1: Native Cloud Proxy (/api/drive/folder-files — runs natively on BOTH Vercel Serverless AND AI Studio Express with ZERO Google Sign-In!)
  if (_expressDriveProxyAvailable !== false) {
    try {
      const params = new URLSearchParams({
        folderId,
        limit: String(limit)
      });
      if (resourceKey) params.set('resourcekey', resourceKey);
      if (query) params.set('q', query);
      if (options.forceRefresh) params.set('refresh', '1');
      const res = await fetch(`/api/drive/folder-files?${params.toString()}`, {
        cache: 'no-store'
      });
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (res.status === 404 || !contentType.includes('application/json')) {
        // Pure static host without /api serverless functions (returned HTML SPA rewrite or 404)
        _expressDriveProxyAvailable = false;
      } else if (res.ok) {
        _expressDriveProxyAvailable = true;
        const json = await res.json();
        if (json?.success && Array.isArray(json.files)) {
          rawFiles = json.files;
          totalInFolder = Number(json.totalInFolder || json.files.length);
          source = 'server_proxy';
        } else if (json?.isPrivate) {
          isPrivate = true;
          lastError = json.error;
        } else if (json?.error) {
          lastError = json.error;
        }
      } else {
        const errJson = await res.json().catch(() => null);
        if (errJson?.error) lastError = errJson.error;
      }
    } catch {
      // Fall through cleanly to Apps Script / OAuth
    }
  }

  // Strategy 2: Google Apps Script Web App (works seamlessly on Vercel & private folders!)
  if (rawFiles.length === 0 && resolvedScriptUrl && resolvedScriptUrl.startsWith('http')) {
    try {
      // Try GET first (CORS-friendly without preflight on Vercel)
      const sep = resolvedScriptUrl.includes('?') ? '&' : '?';
      const qPart = query ? `&query=${encodeURIComponent(query)}` : '';
      const getUrl = `${resolvedScriptUrl}${sep}action=listDriveFiles&folderId=${encodeURIComponent(folderId)}${qPart}&limit=${encodeURIComponent(String(limit))}&t=${Date.now()}`;
      const getRes = await fetch(getUrl, { method: 'GET' });
      if (getRes.ok) {
        const json = await getRes.json();
        if (json && Array.isArray(json.files) && json.files.length > 0) {
          rawFiles = json.files;
          totalInFolder = Number(json.totalInFolder || json.files.length);
          source = 'apps_script';
        }
      }
    } catch {
      // Continue to POST fallback below
    }

    // Fallback to POST if GET did not return files (supports older Apps Script deployments)
    if (rawFiles.length === 0) {
      try {
        const postRes = await fetch(resolvedScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'listDriveFiles',
            folderId,
            query,
            limit
          })
        });
        if (postRes.ok) {
          const json = await postRes.json();
          if (json && Array.isArray(json.files) && json.files.length > 0) {
            rawFiles = json.files;
            totalInFolder = Number(json.totalInFolder || json.files.length);
            source = 'apps_script';
          }
        }
      } catch (err: any) {
        lastError = err?.message || lastError;
      }
    }
  }

  // Strategy 3: Google Drive REST API v3 via OAuth Access Token (works on Vercel & private folders)
  if (rawFiles.length === 0) {
    try {
      const token = await getAccessToken();
      if (token && !token.startsWith('ya29.al_nashi_')) {
        const oauthFiles = await searchDriveFiles(token, folderId, query);
        if (oauthFiles.length > 0) {
          rawFiles = oauthFiles;
          totalInFolder = oauthFiles.length;
          source = 'oauth_api';
        }
      }
    } catch (err: any) {
      lastError = err?.message || lastError;
    }
  }

  // Deduplicate, enrich, and apply client-side Arabic-normalized partial search
  const seen = new Set<string>();
  const unified: UnifiedDriveFile[] = [];
  for (const item of rawFiles) {
    if (!item || !item.id || seen.has(item.id)) continue;
    seen.add(item.id);
    unified.push(toUnifiedDriveFile(item));
  }

  const filtered = query
    ? unified.filter((f) => matchesArabicPartial(f.name, query) || f.id.toLowerCase().includes(query.toLowerCase()))
    : unified;

  return {
    files: filtered,
    totalInFolder: totalInFolder || unified.length,
    source,
    isPrivate,
    error: unified.length === 0 ? lastError : undefined
  };
}

/**
 * Deletes a file from Google Drive using OAuth token or Apps Script fallback.
 */
export async function deleteLiveDriveFile(
  fileId: string,
  appsScriptUrl?: string
): Promise<{ success: boolean; error?: string }> {
  if (!fileId) return { success: false, error: 'معرف الملف غير متوفر' };
  try {
    const token = await getAccessToken();
    if (token && !token.startsWith('ya29.al_nashi_')) {
      const ok = await deleteDriveFile(token, fileId);
      if (ok) return { success: true };
    }
  } catch {}

  const scriptUrl = resolveAppsScriptUrl(appsScriptUrl);
  if (scriptUrl && scriptUrl.startsWith('http')) {
    const ok = await deleteDriveFileViaAppsScript(scriptUrl, fileId);
    if (ok) return { success: true };
  }

  return {
    success: false,
    error: 'يتطلب الحذف المباشر من Google Drive ربط رابط Google Apps Script أو تسجيل الدخول بحساب Google المطور.'
  };
}

/**
 * Downloads a Google Drive file cleanly as an image or original file without window.open popups.
 */
export async function downloadDriveFileAsAsset(file: UnifiedDriveFile): Promise<void> {
  const safeName = file.name || `document_${file.id}`;
  const candidates =
    file.category === 'image'
      ? [
          _expressDriveProxyAvailable !== false ? `/api/drive/image/${encodeURIComponent(file.id)}?sz=w2000` : '',
          `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w2000`,
          file.directDownloadUrl
        ].filter(Boolean)
      : [file.directDownloadUrl];

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob.size > 0 && !blob.type.includes('text/html')) {
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
        return;
      }
    } catch {
      // Try next URL or anchor fallback
    }
  }

  // Universal direct download anchor fallback (works cross-origin on Vercel for PDFs & images)
  const a = document.createElement('a');
  a.href = file.directDownloadUrl;
  a.download = safeName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Prints a Google Drive file directly:
 * - Images: prints full-page isolated crisp document image.
 * - PDFs / Office documents: prints official preview page with document details & embedded view.
 */
export function printDriveFileDirectly(file: UnifiedDriveFile): void {
  if (file.category === 'image') {
    const imgUrl =
      _expressDriveProxyAvailable === true
        ? file.proxyImageUrl
        : file.previewImageUrl;
    printImageIsolated(imgUrl, file.name);
    return;
  }

  const safeTitle = file.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  printHtmlSafely(
    `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طباعة وثيقة - ${safeTitle}</title></head><body style="margin:0;padding:12px;background:#fff;font-family:'Cairo',sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:12px;">
        <div>
          <h2 style="margin:0;font-size:16px;font-weight:900;color:#0f172a;">مكتب النائب المهندسة علا عودة الناشي — أرشيف الوثائق</h2>
          <p style="margin:4px 0 0;font-size:12px;color:#475569;">اسم الملف: ${safeTitle}</p>
        </div>
        <span style="font-size:11px;color:#64748b;">${new Date().toLocaleDateString('ar-IQ')}</span>
      </div>
      <iframe src="${file.embedPreviewUrl}" style="width:100%;height:960px;border:1px solid #cbd5e1;border-radius:8px;"></iframe>
    </body></html>`
  );
}
