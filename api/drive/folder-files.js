// Native Vercel Serverless Function: Public Google Drive Folder Listing & Live Search Proxy
// Works automatically on Vercel with ZERO Google Sign-In & ZERO CORS issues for public Drive folders.

const DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{10,80}$/;

// In-memory warm-lambda cache (short TTL, bypassed completely when refresh=1)
const folderCache = new Map();

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}

function normalizeArabicText(val) {
  return String(val || '')
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

function guessMimeFromName(name) {
  const n = String(name || '').toLowerCase();
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
        mimeType: guessMimeFromName(fname),
        webViewLink: `https://drive.google.com/file/d/${fid}/view`,
        webContentLink: `https://drive.google.com/uc?export=download&id=${fid}`,
        thumbnailLink: `https://drive.google.com/thumbnail?id=${fid}&sz=w1200`
      });
    }

    // Secondary pattern: anchor links to /file/d/<ID> if markup slightly differs
    if (files.length === 0) {
      const linkRegex =
        /href="https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,80})\/view[^"]*"[^>]*>[\s\S]{0,600}?class="flip-entry-title">([^<]+)</g;
      while ((m = linkRegex.exec(html)) !== null) {
        const fid = m[1];
        const fname = decodeHtmlEntities(m[2].trim());
        if (!fid || seen.has(fid) || fid === targetId) continue;
        seen.add(fid);
        files.push({
          id: fid,
          name: fname,
          mimeType: guessMimeFromName(fname),
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

      allFiles = combined;
      folderCache.set(cacheKey, { fetchedAt: Date.now(), files: allFiles });
    }

    let filtered = allFiles;
    if (query) {
      const normQ = normalizeArabicText(query);
      const tokens = normQ.split(' ').filter(Boolean);
      filtered = allFiles.filter((f) => {
        const normName = normalizeArabicText(f.name);
        return (
          tokens.every((t) => normName.includes(t)) ||
          f.id.toLowerCase().includes(normQ)
        );
      });
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
