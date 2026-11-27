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

// CP720 (DOS Arabic OEM) table for bytes 0x80..0xFF to reverse mojibake like "CamScanner ┘ب┘د-┘ب┘د-┘ت┘ب┘ت┘خ ┘ة┘ة.┘ث┘ر-╪╡┘ê╪▒-1.jpg"
const CP720_HIGH_CHARS = [
  0x00c7, 0x00fc, 0x00e9, 0x00e2, 0x00e4, 0x00e0, 0x00e5, 0x00e7, 0x00ea, 0x00eb, 0x00e8, 0x00ef, 0x00ee, 0x00ec, 0x00c4, 0x00c5,
  0x00c9, 0x0651, 0x0652, 0x00f4, 0x00a4, 0x0640, 0x00fb, 0x00f9, 0x0621, 0x0622, 0x0623, 0x0624, 0x00a3, 0x0625, 0x0626, 0x0627,
  0x0628, 0x0629, 0x062a, 0x062b, 0x062c, 0x062d, 0x062e, 0x062f, 0x0630, 0x0631, 0x0632, 0x0633, 0x0634, 0x0635, 0x0636, 0x00ab,
  0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556, 0x2555, 0x2563, 0x2551, 0x2557, 0x255d, 0x255c, 0x255b, 0x2510,
  0x2514, 0x2534, 0x252c, 0x251c, 0x2500, 0x253c, 0x255e, 0x255f, 0x255a, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256c, 0x2567,
  0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256b, 0x256a, 0x2518, 0x250c, 0x2588, 0x2584, 0x258c, 0x2590, 0x2580,
  0x0637, 0x0638, 0x0639, 0x063a, 0x0641, 0x0642, 0x0643, 0x0644, 0x0645, 0x0646, 0x0647, 0x0648, 0x0649, 0x064a, 0x064b, 0x064c,
  0x064d, 0x064e, 0x064f, 0x0650, 0x0670, 0x00bb, 0x067e, 0x0686, 0x0698, 0x06af, 0x00b7, 0x221a, 0x207f, 0x00b2, 0x25a0, 0x00a0
];

const CP720_REVERSE_MAP = new Map<number, number>();
CP720_HIGH_CHARS.forEach((cp, idx) => {
  CP720_REVERSE_MAP.set(cp, 0x80 + idx);
});

export function repairArabicMojibake(input: string): string {
  const s = String(input || '');
  if (!s) return s;

  // CP720 mojibake ('╪' \u256A or '┘' \u2518)
  if (s.includes('\u256a') || s.includes('\u2518')) {
    try {
      const bytes: number[] = [];
      for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code < 0x80) bytes.push(code);
        else if (CP720_REVERSE_MAP.has(code)) bytes.push(CP720_REVERSE_MAP.get(code)!);
        else bytes.push(code & 0xff);
      }
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
      if (!decoded.includes('\ufffd') && /[\u0600-\u06FF]/.test(decoded)) {
        return decoded;
      }
    } catch {}
  }

  // Windows-1252 / Latin-1 mojibake ('Ø' \u00D8 or 'Ù' \u00D9)
  if (s.includes('\u00d8') || s.includes('\u00d9')) {
    try {
      const bytes: number[] = [];
      for (let i = 0; i < s.length; i++) {
        bytes.push(s.charCodeAt(i) & 0xff);
      }
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
      if (!decoded.includes('\ufffd') && /[\u0600-\u06FF]/.test(decoded)) {
        return decoded;
      }
    } catch {}
  }

  return s;
}

export function normalizeArabicQuery(val: string): string {
  return repairArabicMojibake(val || '')
    .replace(/\.[a-zA-Z0-9]{2,5}$/, '')
    .replace(/^(?:نسخة من|نسخه من)\s+/i, '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[._\-()/\\]+/g, ' ')
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

  // Match spaceless normalized string (handles compound names like "عبدالرضا" vs "عبد الرضا" and "ابر اهيم" vs "ابراهيم")
  const compactQ = normQ.replace(/\s+/g, '');
  const compactH = normH.replace(/\s+/g, '');
  if (compactQ.length >= 2 && compactH.includes(compactQ)) return true;

  const tokens = normQ.split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => normH.includes(t) || compactH.includes(t));
}

export function detectDriveFileCategory(mimeType?: string, fileName?: string): DriveFileCategory {
  const m = (mimeType || '').toLowerCase();
  const n = repairArabicMojibake(fileName || '').toLowerCase().trim();

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
  // Extensionless files in the Drive photo archive (e.g. "احمد جبار عبد ثامر") are scanned citizen images
  if (!/\.[a-z0-9]{2,5}$/i.test(n)) {
    return 'image';
  }
  return 'other';
}

export function toUnifiedDriveFile(raw: DriveFileItem & { url?: string; viewUrl?: string }): UnifiedDriveFile {
  const id = String(raw.id || '').trim();
  const name = repairArabicMojibake(String(raw.name || 'ملف_مؤرشف').trim());
  const rawMime = String(raw.mimeType || '').trim();
  const category = detectDriveFileCategory(rawMime, name);
  const mimeType =
    rawMime && rawMime !== 'application/octet-stream'
      ? rawMime
      : category === 'pdf'
      ? 'application/pdf'
      : category === 'image'
      ? 'image/jpeg'
      : 'application/octet-stream';

  return {
    ...raw,
    id,
    name,
    mimeType,
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
    error: 'يتطلب الحذف المباشر من مجلد المرفقات السحابي تفعيل إعدادات الربط السحابي أو تسجيل الدخول من لوحة المطور.'
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
