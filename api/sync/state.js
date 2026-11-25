import fs from 'fs';
import path from 'path';

const TMP_STORE_PATH = '/tmp/al-nashi-unified-store.json';

const ENTITY_ID_FIELDS = {
  citizens: 'Citizen_ID',
  requests: 'Request_ID',
  interviews: 'Interview_ID',
  officialLetters: 'Letter_ID',
  cheques: 'id',
  organizationRecords: 'Citizen_ID',
  dropdowns: 'id',
  customSections: 'id',
  customRecords: 'id',
  documents: 'Doc_ID',
  notifications: 'id',
  users: 'User_ID'
};

let memoryUnifiedStore = null;

function getRecordId(entity, item) {
  if (!item || typeof item !== 'object') return '';
  if (entity === 'dropdowns') {
    const rawId = item.id || `${String(item.Category || '').trim()}::${String(item.ItemValue || '').trim()}`;
    return String(rawId).trim();
  }
  if (entity === 'cheques') {
    return String(item.id || item.Cheque_ID || '').trim();
  }
  if (entity === 'organizationRecords') {
    return String(item.Citizen_ID || item.Org_ID || '').trim();
  }
  if (entity === 'documents') {
    return String(item.Doc_ID || item.id || '').trim();
  }
  const field = ENTITY_ID_FIELDS[entity] || 'id';
  return String(item[field] || item.id || '').trim();
}

function parseTs(raw) {
  if (!raw) return 0;
  const str = String(raw).trim();
  if (!str) return 0;
  let parsed = Date.parse(str);
  if (Number.isNaN(parsed) && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
    parsed = Date.parse(str.replace(' ', 'T'));
  }
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getRecordTimestamp(item) {
  if (!item || typeof item !== 'object') return 0;
  const candidates = [
    item.UpdatedAt,
    item.updatedAt,
    item.BlockedAt,
    item.CreatedAt,
    item.createdAt,
    item. createdAtIso,
    item.Timestamp,
    item.LetterDate,
    item.InterviewDate,
    item.Date
  ];
  let maxTs = 0;
  for (const c of candidates) {
    const ts = parseTs(c);
    if (ts > maxTs) maxTs = ts;
  }
  return maxTs;
}

function mergeTwoRecords(older, newer) {
  const out = { ...older };
  for (const [k, v] of Object.entries(newer)) {
    if (v === undefined || v === null) continue;
    const prev = out[k];
    if (typeof v === 'string' && v.trim() === '' && typeof prev === 'string' && prev.trim() !== '') {
      continue;
    }
    if (Array.isArray(v) && v.length === 0 && Array.isArray(prev) && prev.length > 0) {
      continue;
    }
    if (k === 'data' && typeof v === 'object' && !Array.isArray(v) && prev && typeof prev === 'object' && !Array.isArray(prev)) {
      out[k] = mergeTwoRecords(prev, v);
      continue;
    }
    out[k] = v;
  }
  if (newer.IsBlocked === false) {
    out.IsBlocked = false;
    out.BlockReason = '';
    out.BlockedAt = '';
    out.BlockedBy = '';
  }
  return out;
}

function mergeEntityArray(existingList, incomingList, entity, deletedSet) {
  const map = new Map();
  if (Array.isArray(existingList)) {
    for (const item of existingList) {
      const id = getRecordId(entity, item);
      if (!id || deletedSet.has(id)) continue;
      if (item.Citizen_ID && deletedSet.has(String(item.Citizen_ID).trim())) continue;
      map.set(id, { ...item });
    }
  }
  if (Array.isArray(incomingList)) {
    for (const item of incomingList) {
      const id = getRecordId(entity, item);
      if (!id || deletedSet.has(id)) continue;
      if (item.Citizen_ID && deletedSet.has(String(item.Citizen_ID).trim())) continue;
      const normalized = entity === 'dropdowns' ? { ...item, id } : { ...item };
      if (!map.has(id)) {
        map.set(id, normalized);
      } else {
        const prev = map.get(id);
        const prevTs = getRecordTimestamp(prev);
        const nextTs = getRecordTimestamp(normalized);
        if (prevTs > nextTs && nextTs > 0) {
          map.set(id, mergeTwoRecords(normalized, prev));
        } else {
          map.set(id, mergeTwoRecords(prev, normalized));
        }
      }
    }
  }
  return Array.from(map.values());
}

function readJsonFileSafe(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {}
  return null;
}

function loadUnifiedStore() {
  if (memoryUnifiedStore) return memoryUnifiedStore;

  // 1. Check writable /tmp store first (survives warm invocations on Vercel)
  const tmpData = readJsonFileSafe(TMP_STORE_PATH);
  if (tmpData && typeof tmpData === 'object' && typeof tmpData.rev === 'number') {
    memoryUnifiedStore = tmpData;
    return memoryUnifiedStore;
  }

  // 2. Hydrate from repository /data/*.json seed files
  const dataDir = path.join(process.cwd(), 'data');
  const appData = readJsonFileSafe(path.join(dataDir, 'app-data-store.json')) || {};
  const settingsData = readJsonFileSafe(path.join(dataDir, 'settings-store.json')) || {};
  const usersData = readJsonFileSafe(path.join(dataDir, 'users-store.json')) || {};
  const blacklistData = readJsonFileSafe(path.join(dataDir, 'blacklist-store.json')) || {};

  memoryUnifiedStore = {
    rev: Number(appData.rev || 1),
    citizens: Array.isArray(appData.citizens) ? appData.citizens : [],
    requests: Array.isArray(appData.requests) ? appData.requests : [],
    interviews: Array.isArray(appData.interviews) ? appData.interviews : [],
    officialLetters: Array.isArray(appData.officialLetters) ? appData.officialLetters : [],
    cheques: Array.isArray(appData.cheques) ? appData.cheques : [],
    organizationRecords: Array.isArray(appData.organizationRecords) ? appData.organizationRecords : [],
    dropdowns: Array.isArray(appData.dropdowns) ? appData.dropdowns : [],
    customSections: Array.isArray(settingsData.customSections) ? settingsData.customSections : [],
    customRecords: Array.isArray(appData.customRecords) ? appData.customRecords : [],
    documents: Array.isArray(appData.documents) ? appData.documents : [],
    notifications: Array.isArray(appData.notifications) ? appData.notifications : [],
    users: Array.isArray(usersData.users) ? usersData.users : [],
    developerPasscode: String(usersData.developerPasscode || settingsData?.systemSettings?.developerPasscode || '2026'),
    systemSettings: settingsData.systemSettings || {},
    settingsVersion: Number(settingsData.settingsVersion || settingsData?.systemSettings?.settingsVersion || 0),
    blacklist: {
      items: Array.isArray(blacklistData.items) ? blacklistData.items : [],
      unblockedIds: Array.isArray(blacklistData.unblockedIds) ? blacklistData.unblockedIds : []
    },
    deletedIds: Array.from(
      new Set([
        ...(Array.isArray(appData.deletedIds) ? appData.deletedIds : []),
        ...(Array.isArray(usersData.deletedIds) ? usersData.deletedIds : [])
      ])
    ),
    updatedAt: appData.updatedAt || new Date().toISOString()
  };

  persistUnifiedStore();
  return memoryUnifiedStore;
}

function persistUnifiedStore() {
  if (!memoryUnifiedStore) return;
  memoryUnifiedStore.updatedAt = new Date().toISOString();
  try {
    fs.writeFileSync(TMP_STORE_PATH, JSON.stringify(memoryUnifiedStore), 'utf-8');
  } catch {}
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (fs.existsSync(dataDir)) {
      fs.writeFileSync(path.join(dataDir, 'app-data-store.json'), JSON.stringify(memoryUnifiedStore), 'utf-8');
    }
  } catch {}
}

function buildCounts(store) {
  return {
    citizens: Array.isArray(store.citizens) ? store.citizens.length : 0,
    requests: Array.isArray(store.requests) ? store.requests.length : 0,
    interviews: Array.isArray(store.interviews) ? store.interviews.length : 0,
    officialLetters: Array.isArray(store.officialLetters) ? store.officialLetters.length : 0,
    cheques: Array.isArray(store.cheques) ? store.cheques.length : 0,
    organizationRecords: Array.isArray(store.organizationRecords) ? store.organizationRecords.length : 0,
    customSections: Array.isArray(store.customSections) ? store.customSections.length : 0,
    customRecords: Array.isArray(store.customRecords) ? store.customRecords.length : 0,
    users: Array.isArray(store.users) ? store.users.length : 0,
    notifications: Array.isArray(store.notifications) ? store.notifications.length : 0,
    deletedIds: Array.isArray(store.deletedIds) ? store.deletedIds.length : 0
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const store = loadUnifiedStore();
  const mode = String(req.query?.mode || req.body?.mode || req.body?.action || '').trim();

  if (req.method === 'GET') {
    if (mode === 'rev') {
      return res.status(200).json({
        success: true,
        rev: store.rev,
        settingsVersion: store.settingsVersion || 0,
        counts: buildCounts(store),
        updatedAt: store.updatedAt
      });
    }
    return res.status(200).json({
      success: true,
      ...store,
      counts: buildCounts(store)
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const nowIso = new Date().toISOString();

    // 0. Server-to-Server Google Apps Script Proxy (mode=sheets_proxy)
    // Bypasses browser CORS/no-cors limitations on Vercel and desktop PWA
    if (mode === 'sheets_proxy') {
      const appsScriptUrl = String(body.appsScriptUrl || '').trim();
      if (
        !appsScriptUrl ||
        !appsScriptUrl.startsWith('https://script.google.com/macros/s/') ||
        !appsScriptUrl.includes('/exec')
      ) {
        return res.status(400).json({
          success: false,
          error: 'رابط Google Apps Script غير صالح — يجب أن يبدأ بـ https://script.google.com/macros/s/ وينتهي بـ /exec.'
        });
      }
      const method = String(body.method || 'POST').toUpperCase();
      try {
        if (method === 'GET') {
          const queryAction = String(body.queryAction || 'getAllData').trim();
          const sep = appsScriptUrl.includes('?') ? '&' : '?';
          const targetUrl = `${appsScriptUrl}${sep}action=${encodeURIComponent(queryAction)}&t=${Date.now()}`;
          const upstream = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: { Accept: 'application/json' }
          });
          const text = await upstream.text();
          try {
            const parsed = JSON.parse(text);
            return res.status(200).json(parsed);
          } catch {
            const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html');
            return res.status(502).json({
              success: false,
              error: isHtml
                ? `رابط Google Apps Script أعاد صفحة HTML بدلاً من JSON (HTTP ${upstream.status}) — تأكد من نشر السكربت كـ Web App بصلاحية (Anyone / أي شخص) وباستخدام أحدث رابط /exec.`
                : `استجابة Google Apps Script غير صالحة (HTTP ${upstream.status}).`,
              raw: text.slice(0, 300)
            });
          }
        } else {
          const payload = body.payload || {};
          const upstream = await fetch(appsScriptUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });
          const text = await upstream.text();
          try {
            const parsed = JSON.parse(text);
            return res.status(200).json(parsed);
          } catch {
            const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html');
            return res.status(502).json({
              success: false,
              error: isHtml
                ? `فشل تنفيذ العملية في Google Apps Script (أعاد صفحة HTML بدلاً من JSON - HTTP ${upstream.status}). تأكد من تفعيل صلاحية (Anyone / أي شخص) ونشر إصدار جديد (New Version).`
                : `استجابة غير صالحة من Google Apps Script أثناء الحفظ (HTTP ${upstream.status}).`,
              raw: text.slice(0, 300)
            });
          }
        }
      } catch (err) {
        return res.status(502).json({
          success: false,
          error: err?.message || 'تعذر الاتصال بخادم Google Apps Script'
        });
      }
    }

    // 1. Single-entity real-time mutation (mode=mutate)
    if (mode === 'mutate' || (body.entity && body.op)) {
      const entity = String(body.entity || '').trim();
      const op = String(body.op || '').trim();
      if (!ENTITY_ID_FIELDS[entity]) {
        return res.status(400).json({ success: false, error: `Unsupported entity: ${entity}` });
      }
      const list = Array.isArray(store[entity]) ? store[entity] : [];

      if (op === 'upsert' && body.item && typeof body.item === 'object') {
        const id = getRecordId(entity, body.item);
        if (!id) return res.status(400).json({ success: false, error: 'Missing item id' });
        const stamped = {
          ...body.item,
          ...(entity === 'dropdowns' ? { id } : {}),
          UpdatedAt: nowIso,
          updatedAt: nowIso
        };
        const idx = list.findIndex((existing) => getRecordId(entity, existing) === id);
        if (idx === -1) {
          list.unshift(stamped);
        } else {
          list[idx] = mergeTwoRecords(list[idx], stamped);
        }
        store[entity] = list;
        if (Array.isArray(store.deletedIds) && store.deletedIds.includes(id)) {
          store.deletedIds = store.deletedIds.filter((d) => d !== id);
        }

        // Keep blacklist store in sync whenever a citizen is blocked or unblocked
        if (entity === 'citizens') {
          if (stamped.IsBlocked === true) {
            store.blacklist.unblockedIds = (store.blacklist.unblockedIds || []).filter((uid) => uid !== id);
            const bIdx = (store.blacklist.items || []).findIndex((b) => b.Citizen_ID === id);
            const bEntry = {
              Citizen_ID: id,
              FullName: stamped.FullName,
              Phone1: stamped.Phone1 || '',
              District: stamped.District || '',
              BlockReason: stamped.BlockReason || 'محظور من قبل الإدارة',
              BlockedAt: stamped.BlockedAt || nowIso,
              BlockedBy: stamped.BlockedBy || 'الإدارة'
            };
            if (bIdx >= 0) store.blacklist.items[bIdx] = bEntry;
            else store.blacklist.items.unshift(bEntry);
          } else if (stamped.IsBlocked === false) {
            store.blacklist.items = (store.blacklist.items || []).filter((b) => b.Citizen_ID !== id);
            if (!store.blacklist.unblockedIds.includes(id)) {
              store.blacklist.unblockedIds.push(id);
            }
          }
        }

        store.rev = (Number(store.rev) || 0) + 1;
        persistUnifiedStore();
        return res.status(200).json({ success: true, rev: store.rev, id, counts: buildCounts(store) });
      }

      if (op === 'delete') {
        const targetId = String(body.id || '').trim();
        if (!targetId) return res.status(400).json({ success: false, error: 'Missing id' });
        store[entity] = list.filter((existing) => getRecordId(entity, existing) !== targetId);
        if (!store.deletedIds.includes(targetId)) {
          store.deletedIds.push(targetId);
          if (store.deletedIds.length > 5000) store.deletedIds = store.deletedIds.slice(-5000);
        }
        // Cascade citizen deletions across dependent collections
        if (entity === 'citizens') {
          store.requests = (store.requests || []).filter((r) => r.Citizen_ID !== targetId);
          store.interviews = (store.interviews || []).filter((i) => i.Citizen_ID !== targetId);
          store.officialLetters = (store.officialLetters || []).filter((l) => l.Citizen_ID !== targetId);
          store.cheques = (store.cheques || []).filter((c) => c.Citizen_ID !== targetId);
          store.organizationRecords = (store.organizationRecords || []).filter((o) => o.Citizen_ID !== targetId);
        }
        store.rev = (Number(store.rev) || 0) + 1;
        persistUnifiedStore();
        return res.status(200).json({ success: true, rev: store.rev, id: targetId, counts: buildCounts(store) });
      }

      return res.status(400).json({ success: false, error: 'Invalid mutation op' });
    }

    // 2. Wipe all data (developer wipe)
    if (mode === 'wipe' || body.replaceAll === true) {
      store.citizens = Array.isArray(body.citizens) ? body.citizens : [];
      store.requests = Array.isArray(body.requests) ? body.requests : [];
      store.interviews = Array.isArray(body.interviews) ? body.interviews : [];
      store.officialLetters = Array.isArray(body.officialLetters) ? body.officialLetters : [];
      store.cheques = Array.isArray(body.cheques) ? body.cheques : [];
      store.organizationRecords = Array.isArray(body.organizationRecords) ? body.organizationRecords : [];
      store.customRecords = Array.isArray(body.customRecords) ? body.customRecords : [];
      store.documents = Array.isArray(body.documents) ? body.documents : [];
      store.notifications = Array.isArray(body.notifications) ? body.notifications : [];
      store.deletedIds = Array.isArray(body.deletedIds) ? body.deletedIds : [];
      store.rev = (Number(store.rev) || 0) + 1;
      persistUnifiedStore();
      return res.status(200).json({ success: true, ...store, counts: buildCounts(store) });
    }

    // 3. Bulk merge across all entities + settings + users + blacklist
    const deletedSet = new Set([
      ...(Array.isArray(store.deletedIds) ? store.deletedIds : []),
      ...(Array.isArray(body.deletedIds) ? body.deletedIds.map((x) => String(x || '').trim()).filter(Boolean) : [])
    ]);

    for (const entity of Object.keys(ENTITY_ID_FIELDS)) {
      if (Array.isArray(body[entity]) && body[entity].length > 0) {
        store[entity] = mergeEntityArray(store[entity], body[entity], entity, deletedSet);
      } else if (deletedSet.size > 0 && Array.isArray(store[entity])) {
        store[entity] = store[entity].filter((item) => {
          const id = getRecordId(entity, item);
          if (!id || deletedSet.has(id)) return false;
          if (item.Citizen_ID && deletedSet.has(String(item.Citizen_ID).trim())) return false;
          return true;
        });
      }
    }

    if (body.systemSettings && typeof body.systemSettings === 'object') {
      store.systemSettings = {
        ...(store.systemSettings || {}),
        ...body.systemSettings
      };
      if (body.settingsVersion || body.systemSettings.settingsVersion) {
        store.settingsVersion = Math.max(
          Number(store.settingsVersion || 0),
          Number(body.settingsVersion || body.systemSettings.settingsVersion || 0)
        );
      }
    }

    if (body.developerPasscode) {
      store.developerPasscode = String(body.developerPasscode).trim();
    }

    if (body.blacklist && typeof body.blacklist === 'object') {
      if (Array.isArray(body.blacklist.items)) {
        const bMap = new Map();
        (store.blacklist?.items || []).forEach((i) => { if (i?.Citizen_ID) bMap.set(i.Citizen_ID, i); });
        body.blacklist.items.forEach((i) => { if (i?.Citizen_ID) bMap.set(i.Citizen_ID, i); });
        store.blacklist.items = Array.from(bMap.values());
      }
      if (Array.isArray(body.blacklist.unblockedIds)) {
        store.blacklist.unblockedIds = Array.from(
          new Set([...(store.blacklist?.unblockedIds || []), ...body.blacklist.unblockedIds])
        );
      }
    }

    store.deletedIds = Array.from(deletedSet).slice(-5000);
    store.rev = (Number(store.rev) || 0) + 1;
    persistUnifiedStore();

    return res.status(200).json({
      success: true,
      ...store,
      counts: buildCounts(store)
    });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
