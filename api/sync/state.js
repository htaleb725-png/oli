import fs from 'fs';
import path from 'path';

let memoryAppDataStore = null;

function loadAppDataStore() {
  if (memoryAppDataStore) return memoryAppDataStore;
  try {
    const filePath = path.join(process.cwd(), 'data', 'app-data-store.json');
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        memoryAppDataStore = {
          rev: Number(parsed.rev || 1),
          citizens: Array.isArray(parsed.citizens) ? parsed.citizens : [],
          requests: Array.isArray(parsed.requests) ? parsed.requests : [],
          interviews: Array.isArray(parsed.interviews) ? parsed.interviews : [],
          officialLetters: Array.isArray(parsed.officialLetters) ? parsed.officialLetters : [],
          cheques: Array.isArray(parsed.cheques) ? parsed.cheques : [],
          organizationRecords: Array.isArray(parsed.organizationRecords) ? parsed.organizationRecords : [],
          dropdowns: Array.isArray(parsed.dropdowns) ? parsed.dropdowns : [],
          customRecords: Array.isArray(parsed.customRecords) ? parsed.customRecords : [],
          documents: Array.isArray(parsed.documents) ? parsed.documents : [],
          deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
          updatedAt: parsed.updatedAt || new Date().toISOString()
        };
        return memoryAppDataStore;
      }
    }
  } catch {
    // Fallback
  }
  memoryAppDataStore = {
    rev: 1,
    citizens: [],
    requests: [],
    interviews: [],
    officialLetters: [],
    cheques: [],
    organizationRecords: [],
    dropdowns: [],
    customRecords: [],
    documents: [],
    deletedIds: [],
    updatedAt: new Date().toISOString()
  };
  return memoryAppDataStore;
}

function mergeByKey(existing, incoming, keyFn, deletedSet) {
  const map = new Map();
  (Array.isArray(existing) ? existing : []).forEach((item) => {
    const k = keyFn(item);
    if (k && !deletedSet.has(k)) map.set(k, item);
  });
  (Array.isArray(incoming) ? incoming : []).forEach((item) => {
    const k = keyFn(item);
    if (k && !deletedSet.has(k)) {
      map.set(k, { ...(map.get(k) || {}), ...item });
    }
  });
  return Array.from(map.values());
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const current = loadAppDataStore();
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, ...current });
  }

  if (req.method === 'POST') {
    const incoming = req.body || {};
    const replaceAll = Boolean(incoming.replaceAll);
    const deletedSet = replaceAll
      ? new Set(Array.isArray(incoming.deletedIds) ? incoming.deletedIds : [])
      : new Set([
          ...(Array.isArray(current.deletedIds) ? current.deletedIds : []),
          ...(Array.isArray(incoming.deletedIds) ? incoming.deletedIds : [])
        ]);

    memoryAppDataStore = {
      rev: (Number(current.rev) || 0) + 1,
      citizens: replaceAll && Array.isArray(incoming.citizens)
        ? incoming.citizens
        : mergeByKey(current.citizens, incoming.citizens, (c) => c?.Citizen_ID, deletedSet),
      requests: replaceAll && Array.isArray(incoming.requests)
        ? incoming.requests
        : mergeByKey(current.requests, incoming.requests, (r) => r?.Request_ID, deletedSet),
      interviews: replaceAll && Array.isArray(incoming.interviews)
        ? incoming.interviews
        : mergeByKey(current.interviews, incoming.interviews, (i) => i?.Interview_ID, deletedSet),
      officialLetters: replaceAll && Array.isArray(incoming.officialLetters)
        ? incoming.officialLetters
        : mergeByKey(current.officialLetters, incoming.officialLetters, (l) => l?.Letter_ID, deletedSet),
      cheques: replaceAll && Array.isArray(incoming.cheques)
        ? incoming.cheques
        : mergeByKey(current.cheques, incoming.cheques, (c) => c?.Cheque_ID, deletedSet),
      organizationRecords: replaceAll && Array.isArray(incoming.organizationRecords)
        ? incoming.organizationRecords
        : mergeByKey(current.organizationRecords, incoming.organizationRecords, (o) => o?.Org_ID, deletedSet),
      dropdowns: replaceAll && Array.isArray(incoming.dropdowns)
        ? incoming.dropdowns
        : mergeByKey(current.dropdowns, incoming.dropdowns, (d) => d?.id || `${d?.Category || ''}::${d?.ItemValue || ''}`, deletedSet),
      customRecords: replaceAll && Array.isArray(incoming.customRecords)
        ? incoming.customRecords
        : mergeByKey(current.customRecords, incoming.customRecords, (r) => r?.id, deletedSet),
      documents: replaceAll && Array.isArray(incoming.documents)
        ? incoming.documents
        : mergeByKey(current.documents, incoming.documents, (d) => d?.id, deletedSet),
      deletedIds: Array.from(deletedSet),
      updatedAt: new Date().toISOString()
    };

    try {
      const filePath = path.join(process.cwd(), 'data', 'app-data-store.json');
      fs.writeFileSync(filePath, JSON.stringify(memoryAppDataStore), 'utf-8');
    } catch {
      // Read-only serverless filesystem fallback
    }
    return res.status(200).json({ success: true, ...memoryAppDataStore });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
