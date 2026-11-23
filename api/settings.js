import fs from 'fs';
import path from 'path';

let memorySettingsStore = null;

function loadSettingsStore() {
  if (memorySettingsStore) return memorySettingsStore;
  try {
    const filePath = path.join(process.cwd(), 'data', 'settings-store.json');
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        memorySettingsStore = {
          settings: parsed.settings || {},
          customSections: Array.isArray(parsed.customSections) ? parsed.customSections : [],
          updatedAt: parsed.updatedAt || new Date().toISOString()
        };
        return memorySettingsStore;
      }
    }
  } catch {
    // Fallback
  }
  memorySettingsStore = {
    settings: {
      appName: 'برنامج مكتب النائب علا الناشي',
      deputyName: 'النائب علا عودة الناشي',
      deputyTitle: 'عضو مجلس النواب العراقي - الدورة الخامسة - مطور النظام - حسن طالب الوائلي',
      logoUrl: '/office-logo.png',
      parliamentEmblemUrl: '/office-logo.png',
      pwaIcon192: '/icon-192.png',
      pwaIcon512: '/icon-512.png',
      customImages: { loadingEmblem: '/office-logo.png' },
      googleSheetId: '1wqPXKzzrMJJqfGIyAwEZC1tvWXf28JFS8lUN1YGiFVQ',
      activeGoogleSheetId: '1wqPXKzzrMJJqfGIyAwEZC1tvWXf28JFS8lUN1YGiFVQ',
      googleDriveFolderId: '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc',
      appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxvsACdMiERlpp03F6zeuBpwU6OE6bJ2u8FA2QsZgcp4n4p38UkIMyIcvwBs37L6rZd/exec'
    },
    customSections: [],
    updatedAt: new Date().toISOString()
  };
  return memorySettingsStore;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const current = loadSettingsStore();
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      ...current,
      systemSettings: current.settings
    });
  }

  if (req.method === 'POST') {
    const { settings, systemSettings, customSections } = req.body || {};
    const incomingSettings = systemSettings || settings;
    const mergedSettings =
      incomingSettings && typeof incomingSettings === 'object'
        ? { ...current.settings, ...incomingSettings }
        : current.settings;
    const mergedSections = Array.isArray(customSections) ? customSections : current.customSections;
    memorySettingsStore = {
      settings: mergedSettings,
      customSections: mergedSections,
      updatedAt: new Date().toISOString()
    };
    try {
      const filePath = path.join(process.cwd(), 'data', 'settings-store.json');
      fs.writeFileSync(filePath, JSON.stringify(memorySettingsStore, null, 2), 'utf-8');
    } catch {
      // Read-only serverless filesystem fallback uses memorySettingsStore
    }
    return res.status(200).json({
      success: true,
      ...memorySettingsStore,
      systemSettings: memorySettingsStore.settings
    });
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
