// Native Vercel Serverless Function: Public Google Drive Folder Listing & Live Search Proxy
// Works automatically on Vercel with ZERO Google Sign-In & ZERO CORS issues for public Drive folders.

const DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{10,80}$/;

// In-memory warm-lambda cache (short TTL, bypassed completely when refresh=1)
const folderCache = new Map();

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

const CP720_REVERSE_MAP = new Map();
CP720_HIGH_CHARS.forEach((cp, idx) => {
  CP720_REVERSE_MAP.set(cp, 0x80 + idx);
});

const CP1252_EXTRA_MAP = new Map([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87],
  [0x02c6, 0x88], [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c], [0x017d, 0x8e], [0x2018, 0x91],
  [0x2019, 0x92], [0x201c, 0x93], [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02dc, 0x98],
  [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b], [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f]
]);

export function repairArabicMojibake(input) {
  const s = String(input || '');
  if (!s) return s;

  // Case 1: CP720 mojibake (contains '╪' \u256A or '┘' \u2518 representing UTF-8 Arabic lead bytes 0xD8/0xD9)
  if (s.includes('\u256a') || s.includes('\u2518')) {
    try {
      const bytes = [];
      for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code < 0x80) {
          bytes.push(code);
        } else if (CP720_REVERSE_MAP.has(code)) {
          bytes.push(CP720_REVERSE_MAP.get(code));
        } else {
          bytes.push(code & 0xff);
        }
      }
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
      if (!decoded.includes('\ufffd') && /[\u0600-\u06FF]/.test(decoded)) {
        return decoded;
      }
    } catch {}
  }

  // Case 2: Windows-1252 / ISO-8859-1 mojibake (contains 'Ø' \u00D8 or 'Ù' \u00D9)
  if (s.includes('\u00d8') || s.includes('\u00d9')) {
    try {
      const bytes = [];
      for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code <= 0xff) {
          bytes.push(code);
        } else if (CP1252_EXTRA_MAP.has(code)) {
          bytes.push(CP1252_EXTRA_MAP.get(code));
        } else {
          bytes.push(code & 0xff);
        }
      }
      const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
      if (!decoded.includes('\ufffd') && /[\u0600-\u06FF]/.test(decoded)) {
        return decoded;
      }
    } catch {}
  }

  return s;
}

function decodeHtmlEntities(str) {
  const decoded = String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
  return repairArabicMojibake(decoded);
}

function normalizeArabicText(val) {
  return repairArabicMojibake(String(val || ''))
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

function matchesArabicQuery(fileName, query) {
  const normQ = normalizeArabicText(query);
  if (!normQ) return true;
  const normH = normalizeArabicText(fileName);
  if (!normH) return false;
  if (normH.includes(normQ)) return true;

  // Match spaceless normalized string (handles compound names like "عبدالرضا" vs "عبد الرضا" or "ابر اهيم" vs "ابراهيم")
  const compactQ = normQ.replace(/\s+/g, '');
  const compactH = normH.replace(/\s+/g, '');
  if (compactQ.length >= 2 && compactH.includes(compactQ)) return true;

  // Match all tokens (both normal and spaceless)
  const tokens = normQ.split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => normH.includes(t) || compactH.includes(t));
}

function isArabicCitizenNamedFile(name) {
  const clean = repairArabicMojibake(String(name || ''))
    .replace(/\.[a-zA-Z0-9]{2,5}$/, '')
    .replace(/CamScanner[\s\S]*/i, '')
    .replace(/(?:نسخة من|نسخه من|صورة|صور)/gi, '')
    .trim();
  return /[\u0621-\u064A]{2,}/.test(clean);
}

function guessMimeFromName(name, entryBlockHtml = '') {
  const n = String(name || '').toLowerCase();
  const b = String(entryBlockHtml || '').toLowerCase();

  // 1. Check Google Drive's explicit MIME icon / alt attribute inside embeddedfolderview HTML
  if (b.includes('type/application/pdf') || b.includes('alt="pdf"')) return 'application/pdf';
  if (b.includes('type/image/png') || b.includes('alt="png image"')) return 'image/png';
  if (b.includes('type/image/webp')) return 'image/webp';
  if (b.includes('type/image/gif')) return 'image/gif';
  if (b.includes('type/image/') || b.includes('alt="jpeg image"') || b.includes('alt="image"')) {
    return 'image/jpeg';
  }

  // 2. Check filename extension
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.bmp')) return 'image/bmp';
  if (n.endsWith('.svg')) return 'image/svg+xml';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.heic') || n.endsWith('.tif') || n.endsWith('.tiff')) {
    return 'image/jpeg';
  }
  if (n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  if (n.endsWith('.docx') || n.endsWith('.doc')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (n.endsWith('.txt')) return 'text/plain';

  // 3. Extensionless citizen archive files in Drive photo folders are scanned JPEG images
  if (!/\.[a-z0-9]{2,5}$/i.test(n)) {
    return 'image/jpeg';
  }

  return 'application/octet-stream';
}

function extractFolderAndKey(rawFolder, explicitResourceKey) {
  const raw = String(rawFolder || '').trim();
  let folderId = raw;
  let resourceKey = String(explicitResourceKey || '').trim();

  const urlMatch = raw.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch && urlMatch[1]) {
    folderId = urlMatch[1];
  } else {
    const idParamMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch && idParamMatch[1]) {
      folderId = idParamMatch[1];
    }
  }

  if (!resourceKey) {
    const rkMatch = raw.match(/[?&]resourcekey=([a-zA-Z0-9_-]+)/i);
    if (rkMatch && rkMatch[1]) {
      resourceKey = rkMatch[1];
    }
  }

  folderId = folderId.split('?')[0].split('&')[0].split('#')[0].trim();
  return { folderId, resourceKey };
}

async function fetchAndParseEmbeddedFolder(targetId, rk) {
  const rkPart = rk ? `&resourcekey=${encodeURIComponent(rk)}` : '';
  const candidateViews = [
    `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(targetId)}${rkPart}#grid`,
    `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(targetId)}${rkPart}#list`
  ];

  for (const embedUrl of candidateViews) {
    const driveRes = await fetch(embedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
      },
      redirect: 'follow'
    });

    if (!driveRes.ok) {
      return {
        ok: false,
        isPrivate: driveRes.status === 401 || driveRes.status === 403,
        error:
          'تعذر الوصول إلى مجلد Google Drive. تأكد من أن مشاركة المجلد مضبوطة على (أي شخص لديه الرابط — عارض).',
        files: [],
        subfolderIds: []
      };
    }

    const html = await driveRes.text();
    const isLoginGate =
      html.includes('accounts.google.com/ServiceLogin') ||
      html.includes('ServiceLogin') ||
      html.includes('You need access') ||
      html.includes('تحتاج إلى إذن وصول');

    if (isLoginGate) {
      return {
        ok: false,
        isPrivate: true,
        error:
          'مجلد Google Drive مقيد (خاص). يرجى فتح المجلد في Drive -> مشاركة (Share) -> تغيير الوصول العام إلى "أي شخص لديه الرابط (عارض)".',
        files: [],
        subfolderIds: []
      };
    }

    const seen = new Set();
    const files = [];
    const subfolderIds = [];

    // Primary pattern: standard embeddedfolderview entries (works for both #grid and #list)
    const entryBlockRegex =
      /id="entry-([a-zA-Z0-9_-]{10,80})"([\s\S]{0,2400}?)class="flip-entry-title">([^<]+)</g;
    let m;
    while ((m = entryBlockRegex.exec(html)) !== null) {
      const fid = m[1];
      const block = m[2] || '';
      const fname = decodeHtmlEntities(m[3].trim());
      if (!fid || seen.has(fid) || fid === targetId) continue;
      seen.add(fid);

      if (block.includes('/drive/folders/') || block.includes('/folders/')) {
        subfolderIds.push(fid);
        continue;
      }

      files.push({
        id: fid,
        name: fname,
        mimeType: guessMimeFromName(fname, block),
        webViewLink: `https://drive.google.com/file/d/${fid}/view`,
        webContentLink: `https://drive.google.com/uc?export=download&id=${fid}`,
        thumbnailLink: `https://drive.google.com/thumbnail?id=${fid}&sz=w1200`
      });
    }

    // Secondary pattern: anchor links to /file/d/<ID> if markup slightly differs
    if (files.length === 0) {
      const linkRegex =
        /href="https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,80})\/view[^"]*"[^>]*>([\s\S]{0,600}?)class="flip-entry-title">([^<]+)</g;
      while ((m = linkRegex.exec(html)) !== null) {
        const fid = m[1];
        const block = m[2] || '';
        const fname = decodeHtmlEntities(m[3].trim());
        if (!fid || seen.has(fid) || fid === targetId) continue;
        seen.add(fid);
        files.push({
          id: fid,
          name: fname,
          mimeType: guessMimeFromName(fname, block),
          webViewLink: `https://drive.google.com/file/d/${fid}/view`,
          webContentLink: `https://drive.google.com/uc?export=download&id=${fid}`,
          thumbnailLink: `https://drive.google.com/thumbnail?id=${fid}&sz=w1200`
        });
      }
    }

    if (files.length > 0 || subfolderIds.length > 0) {
      return { ok: true, files, subfolderIds };
    }
  }

  return { ok: true, files: [], subfolderIds: [] };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const rawFolder = req.query?.folderId || '';
    const query = String(req.query?.q || '').trim();
    const forceRefresh = req.query?.refresh === '1' || req.query?.refresh === 'true';

    const { folderId, resourceKey } = extractFolderAndKey(rawFolder, req.query?.resourcekey);

    if (!DRIVE_ID_REGEX.test(folderId)) {
      res.status(400).json({
        success: false,
        files: [],
        totalInFolder: 0,
        error: 'معرف مجلد Google Drive غير صالح. تأكد من لصق المعرف أو الرابط الصحيح.'
      });
      return;
    }

    if (forceRefresh) {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, s-maxage=25, stale-while-revalidate=60');
    }

    const cacheKey = resourceKey ? `${folderId}:${resourceKey}` : folderId;
    const cached = folderCache.get(cacheKey);
    let allFiles =
      cached && !forceRefresh && Date.now() - cached.fetchedAt < 35_000 ? cached.files : null;

    if (!allFiles) {
      const rootParsed = await fetchAndParseEmbeddedFolder(folderId, resourceKey);
      if (!rootParsed.ok) {
        res.status(200).json({
          success: false,
          files: [],
          totalInFolder: 0,
          isPrivate: Boolean(rootParsed.isPrivate),
          error: rootParsed.error
        });
        return;
      }

      const combined = [...rootParsed.files];
      const seenAll = new Set(combined.map((f) => f.id));

      // Traverse 1 level of subfolders automatically (up to 15 subfolders in parallel)
      if (rootParsed.subfolderIds.length > 0) {
        const subIdsToScan = rootParsed.subfolderIds.slice(0, 15);
        const subResults = await Promise.all(
          subIdsToScan.map((subId) =>
            fetchAndParseEmbeddedFolder(subId).catch(() => ({
              ok: false,
              files: [],
              subfolderIds: []
            }))
          )
        );
        for (const sub of subResults) {
          if (!sub.ok) continue;
          for (const f of sub.files) {
            if (!seenAll.has(f.id)) {
              seenAll.add(f.id);
              combined.push(f);
            }
          }
        }
      }

      // Sort Arabic citizen-named files first so named citizen documents appear immediately ahead of generic 0001.png/CamScanner files
      const arabicNamed = [];
      const otherFiles = [];
      for (const f of combined) {
        if (isArabicCitizenNamedFile(f.name)) arabicNamed.push(f);
        else otherFiles.push(f);
      }

      allFiles = [...arabicNamed, ...otherFiles];
      folderCache.set(cacheKey, { fetchedAt: Date.now(), files: allFiles });
    }

    let filtered = allFiles;
    if (query) {
      const normQ = normalizeArabicText(query);
      filtered = allFiles.filter(
        (f) => matchesArabicQuery(f.name, query) || f.id.toLowerCase().includes(normQ)
      );
    }

    const limit = Math.min(Math.max(parseInt(String(req.query?.limit || '5000'), 10) || 5000, 1), 5000);
    const offset = Math.max(parseInt(String(req.query?.offset || '0'), 10) || 0, 0);

    res.status(200).json({
      success: true,
      folderId,
      totalInFolder: allFiles.length,
      matchedCount: filtered.length,
      files: filtered.slice(offset, offset + limit)
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      files: [],
      totalInFolder: 0,
      error: (err && err.message) || 'حدث خطأ أثناء الاتصال بمجلد Google Drive'
    });
  }
}
