import fs from 'fs';
import path from 'path';

let memoryBlacklistStore = null;

function loadBlacklistStore() {
  if (memoryBlacklistStore) return memoryBlacklistStore;
  try {
    const filePath = path.join(process.cwd(), 'data', 'blacklist-store.json');
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (parsed && Array.isArray(parsed.records)) {
        memoryBlacklistStore = {
          records: parsed.records,
          deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
          updatedAt: parsed.updatedAt || new Date().toISOString()
        };
        return memoryBlacklistStore;
      }
    }
  } catch {
    // Fallback
  }
  memoryBlacklistStore = {
    records: [],
    deletedIds: [],
    updatedAt: new Date().toISOString()
  };
  return memoryBlacklistStore;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const current = loadBlacklistStore();
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, ...current });
  }

  if (req.method === 'POST') {
    const { records, deletedIds, replaceAll } = req.body || {};
    const deletedSet = new Set([
      ...(current.deletedIds || []),
      ...(Array.isArray(deletedIds) ? deletedIds : [])
    ]);
    let finalRecords = [];
    if (replaceAll && Array.isArray(records)) {
      finalRecords = records.filter((r) => r && r.id && !deletedSet.has(r.id));
    } else {
      const recordMap = new Map();
      (current.records || []).forEach((r) => {
        if (r && r.id && !deletedSet.has(r.id)) recordMap.set(r.id, r);
      });
      if (Array.isArray(records)) {
        records.forEach((r) => {
          if (r && r.id && !deletedSet.has(r.id)) {
            recordMap.set(r.id, { ...(recordMap.get(r.id) || {}), ...r });
          }
        });
      }
      finalRecords = Array.from(recordMap.values());
    }
    memoryBlacklistStore = {
      records: finalRecords,
      deletedIds: Array.from(deletedSet),
      updatedAt: new Date().toISOString()
    };
    try {
      const filePath = path.join(process.cwd(), 'data', 'blacklist-store.json');
      fs.writeFileSync(filePath, JSON.stringify(memoryBlacklistStore, null, 2), 'utf-8');
    } catch {
      // Read-only serverless filesystem fallback
    }
    return res.status(200).json({ success: true, ...memoryBlacklistStore });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
