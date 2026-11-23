import fs from 'fs';
import path from 'path';

let memoryUsersStore = null;

function loadUsersStore() {
  if (memoryUsersStore) return memoryUsersStore;
  try {
    const filePath = path.join(process.cwd(), 'data', 'users-store.json');
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (parsed && Array.isArray(parsed.users)) {
        memoryUsersStore = {
          users: parsed.users,
          deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
          updatedAt: parsed.updatedAt || new Date().toISOString()
        };
        return memoryUsersStore;
      }
    }
  } catch {
    // Fallback
  }
  memoryUsersStore = {
    users: [],
    deletedIds: [],
    updatedAt: new Date().toISOString()
  };
  return memoryUsersStore;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const current = loadUsersStore();
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, ...current });
  }

  if (req.method === 'POST') {
    const { users, deletedIds, replaceAll } = req.body || {};
    const deletedSet = new Set([
      ...(current.deletedIds || []),
      ...(Array.isArray(deletedIds) ? deletedIds : [])
    ]);
    let finalUsers = [];
    if (replaceAll && Array.isArray(users)) {
      finalUsers = users.filter((u) => u && u.User_ID && !deletedSet.has(u.User_ID));
    } else {
      const userMap = new Map();
      (current.users || []).forEach((u) => {
        if (u && u.User_ID && !deletedSet.has(u.User_ID)) userMap.set(u.User_ID, u);
      });
      if (Array.isArray(users)) {
        users.forEach((u) => {
          if (u && u.User_ID && !deletedSet.has(u.User_ID)) {
            userMap.set(u.User_ID, { ...(userMap.get(u.User_ID) || {}), ...u });
          }
        });
      }
      finalUsers = Array.from(userMap.values());
    }
    memoryUsersStore = {
      users: finalUsers,
      deletedIds: Array.from(deletedSet),
      updatedAt: new Date().toISOString()
    };
    try {
      const filePath = path.join(process.cwd(), 'data', 'users-store.json');
      fs.writeFileSync(filePath, JSON.stringify(memoryUsersStore, null, 2), 'utf-8');
    } catch {
      // Read-only serverless filesystem fallback
    }
    return res.status(200).json({ success: true, ...memoryUsersStore });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
