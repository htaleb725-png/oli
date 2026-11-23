import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { extractCitizenInfoFromFilename } from './src/utils/filenameNameExtractor';

interface StoredUser {
  User_ID: string;
  Username: string;
  Password?: string;
  Phone?: string;
  Role: string;
  RoleArabic: string;
  Status?: 'active' | 'frozen';
  Active?: boolean;
  FullName: string;
  Department: string;
  JobTitle?: string;
  Avatar?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  Permissions?: string[];
  AllowedSections?: string[];
}

interface UsersStoreState {
  users: StoredUser[];
  deletedIds: string[];
  developerPasscode?: string;
  updatedAt: string;
}

interface SettingsStoreState {
  systemSettings: Record<string, any>;
  customSections: any[];
  settingsVersion: number;
  updateSummary: string;
  updatedBy: string;
  updatedAt: string;
}

interface BlacklistRecord {
  Citizen_ID: string;
  FullName: string;
  Phone1?: string;
  District?: string;
  BlockReason: string;
  BlockedAt: string;
  BlockedBy: string;
  IsBlocked: boolean;
}

interface BlacklistStoreState {
  items: BlacklistRecord[];
  unblockedIds: string[];
  updatedAt: string;
}

interface AppDataStoreState {
  rev: number;
  citizens: any[];
  requests: any[];
  interviews: any[];
  officialLetters: any[];
  cheques: any[];
  organizationRecords: any[];
  dropdowns: any[];
  customRecords: any[];
  documents: any[];
  notifications: any[];
  deletedIds: string[];
  updatedAt: string;
}

type SyncEntityKey =
  | 'citizens'
  | 'requests'
  | 'interviews'
  | 'officialLetters'
  | 'cheques'
  | 'organizationRecords'
  | 'dropdowns'
  | 'customRecords'
  | 'documents'
  | 'notifications';

const SYNC_ENTITY_ID_FIELD: Record<SyncEntityKey, string> = {
  citizens: 'Citizen_ID',
  requests: 'Request_ID',
  interviews: 'Interview_ID',
  officialLetters: 'Letter_ID',
  cheques: 'id',
  organizationRecords: 'Citizen_ID',
  dropdowns: 'id',
  customRecords: 'id',
  documents: 'Doc_ID',
  notifications: 'id'
};

const ALLOWED_SYNC_ENTITIES = new Set<string>(Object.keys(SYNC_ENTITY_ID_FIELD));

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_STORE_PATH = path.join(DATA_DIR, 'users-store.json');
const SETTINGS_STORE_PATH = path.join(DATA_DIR, 'settings-store.json');
const BLACKLIST_STORE_PATH = path.join(DATA_DIR, 'blacklist-store.json');
const APP_DATA_STORE_PATH = path.join(DATA_DIR, 'app-data-store.json');

let memoryUsersStore: UsersStoreState = {
  users: [],
  deletedIds: [],
  updatedAt: new Date().toISOString()
};

let memorySettingsStore: SettingsStoreState = {
  systemSettings: {},
  customSections: [],
  settingsVersion: 0,
  updateSummary: '',
  updatedBy: '',
  updatedAt: new Date().toISOString()
};

let memoryBlacklistStore: BlacklistStoreState = {
  items: [],
  unblockedIds: [],
  updatedAt: new Date().toISOString()
};

let memoryAppDataStore: AppDataStoreState = {
  rev: 0,
  citizens: [],
  requests: [],
  interviews: [],
  officialLetters: [],
  cheques: [],
  organizationRecords: [],
  dropdowns: [],
  customRecords: [],
  documents: [],
  notifications: [],
  deletedIds: [],
  updatedAt: new Date().toISOString()
};

let appDataSaveTimer: ReturnType<typeof setTimeout> | null = null;

// Active SSE real-time connected clients (browsers, shared links, Desktop PWAs)
const sseClients = new Set<express.Response>();

function broadcastSseEvent(eventName: string, payload: Record<string, any>): void {
  if (sseClients.size === 0) return;
  const serialized = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const clientRes of Array.from(sseClients)) {
    try {
      clientRes.write(serialized);
    } catch {
      sseClients.delete(clientRes);
    }
  }
}

function getRecordSyncId(entity: SyncEntityKey, item: any): string {
  if (!item || typeof item !== 'object') return '';
  if (entity === 'dropdowns') {
    const rawId = item.id || `${String(item.Category || '').trim()}::${String(item.ItemValue || '').trim()}`;
    return String(rawId).trim();
  }
  const idField = SYNC_ENTITY_ID_FIELD[entity];
  return String(item[idField] || item.id || '').trim();
}

function loadAppDataStore(): AppDataStoreState {
  try {
    if (fs.existsSync(APP_DATA_STORE_PATH)) {
      const raw = fs.readFileSync(APP_DATA_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memoryAppDataStore = {
          rev: Number(parsed.rev) || 0,
          citizens: Array.isArray(parsed.citizens) ? parsed.citizens : [],
          requests: Array.isArray(parsed.requests) ? parsed.requests : [],
          interviews: Array.isArray(parsed.interviews) ? parsed.interviews : [],
          officialLetters: Array.isArray(parsed.officialLetters) ? parsed.officialLetters : [],
          cheques: Array.isArray(parsed.cheques) ? parsed.cheques : [],
          organizationRecords: Array.isArray(parsed.organizationRecords) ? parsed.organizationRecords : [],
          dropdowns: Array.isArray(parsed.dropdowns) ? parsed.dropdowns : [],
          customRecords: Array.isArray(parsed.customRecords) ? parsed.customRecords : [],
          documents: Array.isArray(parsed.documents) ? parsed.documents : [],
          notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
          deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
          updatedAt: parsed.updatedAt || new Date().toISOString()
        };
      }
    }
  } catch (err) {
    console.warn('App data store load warning:', err);
  }
  return memoryAppDataStore;
}

function flushAppDataStoreNow(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = `${APP_DATA_STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(memoryAppDataStore), 'utf8');
    fs.renameSync(tmpPath, APP_DATA_STORE_PATH);
  } catch (err) {
    console.warn('App data store write warning:', err);
  }
}

function scheduleAppDataSave(): void {
  memoryAppDataStore.updatedAt = new Date().toISOString();
  if (appDataSaveTimer) clearTimeout(appDataSaveTimer);
  appDataSaveTimer = setTimeout(() => {
    appDataSaveTimer = null;
    flushAppDataStoreNow();
  }, 150);
}

function upsertSyncRecord(entity: SyncEntityKey, item: any): { record: any; id: string } | null {
  const id = getRecordSyncId(entity, item);
  if (!id) return null;
  const nowIso = new Date().toISOString();
  const record: any = {
    ...(entity === 'dropdowns' ? { ...item, id } : item),
    UpdatedAt: nowIso,
    updatedAt: nowIso
  };
  if (record.IsBlocked === false) {
    record.IsBlocked = false;
    record.BlockReason = '';
    record.BlockedAt = '';
    record.BlockedBy = '';
  }
  const list = memoryAppDataStore[entity] as any[];
  const idx = list.findIndex((existing) => getRecordSyncId(entity, existing) === id);
  if (idx === -1) {
    list.unshift(record);
  } else {
    list[idx] = { ...list[idx], ...record };
  }
  // Remove from deletedIds if re-created
  if (memoryAppDataStore.deletedIds.length > 0) {
    memoryAppDataStore.deletedIds = memoryAppDataStore.deletedIds.filter((d) => d !== id);
  }
  return { record: idx === -1 ? record : list[idx], id };
}

function deleteSyncRecord(entity: SyncEntityKey, id: string): boolean {
  const cleanId = String(id || '').trim();
  if (!cleanId) return false;
  const list = memoryAppDataStore[entity] as any[];
  const before = list.length;
  memoryAppDataStore[entity] = list.filter((existing) => getRecordSyncId(entity, existing) !== cleanId);
  if (entity === 'citizens') {
    memoryAppDataStore.requests = memoryAppDataStore.requests.filter((r) => r?.Citizen_ID !== cleanId);
    memoryAppDataStore.interviews = memoryAppDataStore.interviews.filter((i) => i?.Citizen_ID !== cleanId);
    memoryAppDataStore.officialLetters = memoryAppDataStore.officialLetters.filter((l) => l?.Citizen_ID !== cleanId);
    memoryAppDataStore.cheques = memoryAppDataStore.cheques.filter((c) => c?.Citizen_ID !== cleanId);
    memoryAppDataStore.organizationRecords = memoryAppDataStore.organizationRecords.filter((o) => o?.Citizen_ID !== cleanId);
  }
  if (!memoryAppDataStore.deletedIds.includes(cleanId)) {
    memoryAppDataStore.deletedIds.push(cleanId);
    if (memoryAppDataStore.deletedIds.length > 5000) {
      memoryAppDataStore.deletedIds = memoryAppDataStore.deletedIds.slice(-5000);
    }
  }
  return memoryAppDataStore[entity].length !== before || true;
}

function buildSyncCounts(): Record<string, number> {
  return {
    citizens: memoryAppDataStore.citizens.length,
    requests: memoryAppDataStore.requests.length,
    interviews: memoryAppDataStore.interviews.length,
    officialLetters: memoryAppDataStore.officialLetters.length,
    cheques: memoryAppDataStore.cheques.length,
    organizationRecords: memoryAppDataStore.organizationRecords.length,
    customSections: (memorySettingsStore.customSections || []).length,
    customRecords: memoryAppDataStore.customRecords.length,
    users: (memoryUsersStore.users || []).length,
    notifications: memoryAppDataStore.notifications.length,
    deletedIds: memoryAppDataStore.deletedIds.length
  };
}

// In-memory cache for Google Drive public folder listings (60s TTL)
const driveFolderCache = new Map<string, { fetchedAt: number; files: Array<{ id: string; name: string; mimeType: string; webViewLink: string; thumbnailLink: string }> }>();

function loadSettingsStore(): SettingsStoreState {
  try {
    if (fs.existsSync(SETTINGS_STORE_PATH)) {
      const raw = fs.readFileSync(SETTINGS_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        memorySettingsStore = {
          systemSettings: parsed.systemSettings || {},
          customSections: Array.isArray(parsed.customSections) ? parsed.customSections : [],
          settingsVersion: Number(parsed.settingsVersion) || 0,
          updateSummary: String(parsed.updateSummary || ''),
          updatedBy: String(parsed.updatedBy || ''),
          updatedAt: parsed.updatedAt || new Date().toISOString()
        };
      }
    }
  } catch (err) {
    console.warn('Settings store load warning:', err);
  }
  return memorySettingsStore;
}

function saveSettingsStore(next: SettingsStoreState): void {
  memorySettingsStore = { ...next, updatedAt: new Date().toISOString() };
  memoryAppDataStore.rev += 1;
  scheduleAppDataSave();
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = `${SETTINGS_STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(memorySettingsStore, null, 2), 'utf8');
    fs.renameSync(tmpPath, SETTINGS_STORE_PATH);
  } catch (err) {
    console.warn('Settings store write warning:', err);
  }
}

function loadBlacklistStore(): BlacklistStoreState {
  try {
    if (fs.existsSync(BLACKLIST_STORE_PATH)) {
      const raw = fs.readFileSync(BLACKLIST_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) {
        memoryBlacklistStore = {
          items: parsed.items,
          unblockedIds: Array.isArray(parsed.unblockedIds) ? parsed.unblockedIds : [],
          updatedAt: parsed.updatedAt || new Date().toISOString()
        };
      }
    }
  } catch (err) {
    console.warn('Blacklist store load warning:', err);
  }
  return memoryBlacklistStore;
}

function saveBlacklistStore(next: BlacklistStoreState): void {
  memoryBlacklistStore = { ...next, updatedAt: new Date().toISOString() };
  memoryAppDataStore.rev += 1;
  scheduleAppDataSave();
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = `${BLACKLIST_STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(memoryBlacklistStore, null, 2), 'utf8');
    fs.renameSync(tmpPath, BLACKLIST_STORE_PATH);
  } catch (err) {
    console.warn('Blacklist store write warning:', err);
  }
}

const CP720_HIGH_CHARS_SRV = [
  0x00c7, 0x00fc, 0x00e9, 0x00e2, 0x00e4, 0x00e0, 0x00e5, 0x00e7, 0x00ea, 0x00eb, 0x00e8, 0x00ef, 0x00ee, 0x00ec, 0x00c4, 0x00c5,
  0x00c9, 0x0651, 0x0652, 0x00f4, 0x00a4, 0x0640, 0x00fb, 0x00f9, 0x0621, 0x0622, 0x0623, 0x0624, 0x00a3, 0x0625, 0x0626, 0x0627,
  0x0628, 0x0629, 0x062a, 0x062b, 0x062c, 0x062d, 0x062e, 0x062f, 0x0630, 0x0631, 0x0632, 0x0633, 0x0634, 0x0635, 0x0636, 0x00ab,
  0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556, 0x2555, 0x2563, 0x2551, 0x2557, 0x255d, 0x255c, 0x255b, 0x2510,
  0x2514, 0x2534, 0x252c, 0x251c, 0x2500, 0x253c, 0x255e, 0x255f, 0x255a, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256c, 0x2567,
  0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256b, 0x256a, 0x2518, 0x250c, 0x2588, 0x2584, 0x258c, 0x2590, 0x2580,
  0x0637, 0x0638, 0x0639, 0x063a, 0x0641, 0x0642, 0x0643, 0x0644, 0x0645, 0x0646, 0x0647, 0x0648, 0x0649, 0x064a, 0x064b, 0x064c,
  0x064d, 0x064e, 0x064f, 0x0650, 0x0670, 0x00bb, 0x067e, 0x0686, 0x0698, 0x06af, 0x00b7, 0x221a, 0x207f, 0x00b2, 0x25a0, 0x00a0
];
const CP720_REVERSE_MAP_SRV = new Map<number, number>();
CP720_HIGH_CHARS_SRV.forEach((cp, idx) => CP720_REVERSE_MAP_SRV.set(cp, 0x80 + idx));

function repairArabicMojibakeServer(input: string): string {
  const s = String(input || '');
  if (!s) return s;
  if (s.includes('\u256a') || s.includes('\u2518')) {
    try {
      const bytes: number[] = [];
      for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code < 0x80) bytes.push(code);
        else if (CP720_REVERSE_MAP_SRV.has(code)) bytes.push(CP720_REVERSE_MAP_SRV.get(code)!);
        else bytes.push(code & 0xff);
      }
      const decoded = Buffer.from(bytes).toString('utf8');
      if (!decoded.includes('\ufffd') && /[\u0600-\u06FF]/.test(decoded)) return decoded;
    } catch {}
  }
  if (s.includes('\u00d8') || s.includes('\u00d9')) {
    try {
      const bytes: number[] = [];
      for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        bytes.push(code & 0xff);
      }
      const decoded = Buffer.from(bytes).toString('utf8');
      if (!decoded.includes('\ufffd') && /[\u0600-\u06FF]/.test(decoded)) return decoded;
    } catch {}
  }
  return s;
}

function decodeHtmlEntities(str: string): string {
  const decoded = str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  return repairArabicMojibakeServer(decoded);
}

function guessMimeFromName(name: string, entryBlockHtml = ''): string {
  const lower = (name || '').toLowerCase();
  const b = (entryBlockHtml || '').toLowerCase();
  if (b.includes('type/application/pdf') || b.includes('alt="pdf"')) return 'application/pdf';
  if (b.includes('type/image/png') || b.includes('alt="png image"')) return 'image/png';
  if (b.includes('type/image/webp')) return 'image/webp';
  if (b.includes('type/image/gif')) return 'image/gif';
  if (b.includes('type/image/') || b.includes('alt="jpeg image"') || b.includes('alt="image"')) return 'image/jpeg';

  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.zip') || lower.endsWith('.rar')) return 'application/zip';
  if (!/\.[a-z0-9]{2,5}$/i.test(lower)) return 'image/jpeg';
  return 'application/octet-stream';
}

function loadUsersStore(): UsersStoreState {
  try {
    if (fs.existsSync(USERS_STORE_PATH)) {
      const raw = fs.readFileSync(USERS_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.users)) {
        memoryUsersStore = {
          users: parsed.users,
          deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : [],
          developerPasscode: parsed.developerPasscode,
          updatedAt: parsed.updatedAt || new Date().toISOString()
        };
      }
    } else if (memoryUsersStore.users.length === 0) {
      // Safe first-boot seed only when no users-store.json exists yet (never overwrites existing users)
      memoryUsersStore = {
        users: [
          {
            User_ID: 'USR-001',
            Username: 'developer',
            Password: '123',
            Role: 'developer',
            RoleArabic: 'مطور النظام (صلاحية مطلقة)',
            Status: 'active',
            FullName: 'مطور المنظومة البرمجي',
            Department: 'قسم تكنولوجيا المعلومات والبرمجة',
            CreatedAt: '2026-01-01',
            Permissions: [
              'scan_upload', 'requests_create', 'requests_edit', 'requests_delete',
              'workflow_referral', 'citizens_register', 'print_cards', 'org_evaluation',
              'official_letters', 'export_reports', 'view_archive'
            ]
          }
        ],
        deletedIds: [],
        developerPasscode: '2026',
        updatedAt: new Date().toISOString()
      };
    }
  } catch (err) {
    console.warn('Users store load warning (using memory fallback):', err);
  }
  return memoryUsersStore;
}

function saveUsersStore(next: UsersStoreState): void {
  memoryUsersStore = { ...next, updatedAt: new Date().toISOString() };
  memoryAppDataStore.rev += 1;
  scheduleAppDataSave();
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${USERS_STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(memoryUsersStore, null, 2), 'utf8');
    fs.renameSync(tmpPath, USERS_STORE_PATH);
  } catch (err) {
    console.warn('Users store file write warning (memory store remains active):', err);
  }
}

function normalizeCredString(val: string): string {
  return (val || '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePassString(val: string): string {
  return (val || '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .trim();
}

function mergeUserIntoList(list: StoredUser[], incoming: StoredUser): StoredUser[] {
  const idx = list.findIndex((u) => u.User_ID === incoming.User_ID);
  if (idx === -1) return [...list, incoming];
  const existing = list[idx];
  const existingTs = Date.parse(existing.UpdatedAt || existing.CreatedAt || '') || 0;
  const incomingTs = Date.parse(incoming.UpdatedAt || incoming.CreatedAt || '') || 0;
  const winner = incomingTs >= existingTs ? { ...existing, ...incoming } : { ...incoming, ...existing };
  const next = [...list];
  next[idx] = winner;
  return next;
}

async function startServer() {
  loadUsersStore();
  loadSettingsStore();
  loadBlacklistStore();
  loadAppDataStore();

  const app = express();
  const PORT = 3000;

  // Support large base64 image payloads for OCR analysis
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Lazy initialize Gemini client
  let aiClient: GoogleGenAI | null = null;
  function getGemini(): GoogleGenAI | null {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not set in environment.');
      return null;
    }
    if (!aiClient) {
      aiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  /**
   * Resilient Gemini Vision OCR execution:
   * - Primary model: 'gemini-3.8-flash' (high throughput, low latency vision)
   * - Fallback models: 'gemini-3.1-flash-lite'
   * - Retries transient 503 (high demand) and 429 (rate limit) errors silently
   */
  async function callGeminiVisionOCRWithFallback(
    ai: GoogleGenAI,
    mimeType: string,
    base64Data: string,
    prompt: string
  ): Promise<{ text: string; modelUsed: string }> {
    const models = [
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite'
    ];

    let lastError: any = null;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
              prompt,
            ],
            config: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          });

          if (response && response.text) {
            return { text: response.text, modelUsed: model };
          }
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err);
          const isHighDemand =
            errMsg.includes('503') ||
            errMsg.includes('high demand') ||
            errMsg.includes('UNAVAILABLE') ||
            errMsg.includes('429') ||
            errMsg.includes('RESOURCE_EXHAUSTED') ||
            errMsg.includes('overloaded');

          if (isHighDemand) {
            await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 500));
          } else {
            // Try next model if current model fails
            break;
          }
        }
      }
    }

    throw lastError || new Error('All AI models temporarily busy');
  }

  // --- API Routes FIRST ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString()
    });
  });

  // Google Workspace Sheets & Drive status endpoint
  app.get('/api/workspace/status', (req, res) => {
    res.json({
      status: 'ok',
      configured: true,
      provider: 'Google Sheets & Google Drive',
      developerEmail: 'htaleb725@gmail.com',
      timestamp: new Date().toISOString()
    });
  });

  // --- Shared Users & Permissions Persistence API ---
  app.get('/api/users', (_req, res) => {
    const store = loadUsersStore();
    res.json({
      success: true,
      users: store.users,
      deletedIds: store.deletedIds,
      developerPasscode: store.developerPasscode,
      updatedAt: store.updatedAt
    });
  });

  app.post('/api/users', (req, res) => {
    const incoming = req.body as StoredUser;
    if (!incoming || typeof incoming !== 'object' || !incoming.User_ID || !incoming.Username || !incoming.FullName) {
      res.status(400).json({ success: false, error: 'بيانات المستخدم غير مكتملة' });
      return;
    }
    const cleanUser: StoredUser = {
      ...incoming,
      User_ID: String(incoming.User_ID).trim(),
      Username: String(incoming.Username).trim(),
      Password: incoming.Password !== undefined ? String(incoming.Password).trim() : '',
      FullName: String(incoming.FullName).trim(),
      Role: String(incoming.Role || 'reception').trim(),
      RoleArabic: String(incoming.RoleArabic || incoming.Department || 'موظف').trim(),
      Department: String(incoming.Department || '').trim(),
      Status: incoming.Status === 'frozen' ? 'frozen' : 'active',
      Permissions: Array.isArray(incoming.Permissions) ? incoming.Permissions : [],
      AllowedSections: Array.isArray(incoming.AllowedSections) ? incoming.AllowedSections : [],
      UpdatedAt: incoming.UpdatedAt || new Date().toISOString()
    };

    const store = loadUsersStore();
    const deletedSet = new Set(store.deletedIds);
    deletedSet.delete(cleanUser.User_ID);
    const nextUsers = mergeUserIntoList(store.users, cleanUser);
    saveUsersStore({
      ...store,
      users: nextUsers,
      deletedIds: Array.from(deletedSet)
    });
    broadcastSseEvent('users_updated', { userId: cleanUser.User_ID, updatedAt: new Date().toISOString() });
    res.json({ success: true, user: cleanUser, total: nextUsers.length });
  });

  app.post('/api/users/bulk-sync', (req, res) => {
    const { users: incomingUsers, deletedIds: incomingDeleted, developerPasscode } = req.body || {};
    if (!Array.isArray(incomingUsers)) {
      res.status(400).json({ success: false, error: 'users array required' });
      return;
    }
    const store = loadUsersStore();
    const deletedSet = new Set<string>([...store.deletedIds, ...(Array.isArray(incomingDeleted) ? incomingDeleted : [])]);
    let merged = store.users.filter((u) => !deletedSet.has(u.User_ID));
    for (const raw of incomingUsers) {
      if (!raw || !raw.User_ID || !raw.Username || deletedSet.has(String(raw.User_ID))) continue;
      merged = mergeUserIntoList(merged, {
        ...raw,
        User_ID: String(raw.User_ID).trim(),
        Username: String(raw.Username).trim(),
        Password: raw.Password !== undefined ? String(raw.Password).trim() : '',
        FullName: String(raw.FullName || raw.Username).trim(),
        UpdatedAt: raw.UpdatedAt || new Date().toISOString()
      });
    }
    saveUsersStore({
      users: merged,
      deletedIds: Array.from(deletedSet),
      developerPasscode: developerPasscode || store.developerPasscode,
      updatedAt: new Date().toISOString()
    });
    broadcastSseEvent('users_updated', { count: merged.length, updatedAt: new Date().toISOString() });
    res.json({ success: true, users: merged, count: merged.length });
  });

  app.delete('/api/users/:userId', (req, res) => {
    const userId = String(req.params.userId || '').trim();
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId required' });
      return;
    }
    const store = loadUsersStore();
    const deletedSet = new Set(store.deletedIds);
    deletedSet.add(userId);
    const nextUsers = store.users.filter((u) => u.User_ID !== userId);
    saveUsersStore({
      ...store,
      users: nextUsers,
      deletedIds: Array.from(deletedSet)
    });
    broadcastSseEvent('users_updated', { deletedId: userId, updatedAt: new Date().toISOString() });
    res.json({ success: true, deletedId: userId });
  });

  app.post('/api/auth/login', (req, res) => {
    const { usernameOrCode, password, mode } = req.body || {};
    const store = loadUsersStore();
    const settingsStore = loadSettingsStore();
    const cleanUser = normalizeCredString(String(usernameOrCode || '')).toLowerCase();
    const cleanPass = normalizePassString(String(password || ''));
    const rawCode = normalizePassString(String(password || usernameOrCode || ''));

    // Explicit mode support prevents false failures when username === password
    const isDualMode =
      mode === 'credentials'
        ? true
        : mode === 'passcode'
          ? false
          : Boolean(cleanUser && cleanPass && cleanUser !== normalizeCredString(cleanPass).toLowerCase());

    const activeDevCode = normalizePassString(
      String(store.developerPasscode || settingsStore.systemSettings?.developerPasscode || '2026')
    );

    if (isDualMode) {
      let usernameFoundButWrongPass = false;
      for (const u of store.users) {
        if (!u) continue;
        const uName = normalizeCredString(u.Username || '').toLowerCase();
        const uId = normalizeCredString(u.User_ID || '').toLowerCase();
        const uFull = normalizeCredString(u.FullName || '').toLowerCase();
        const uPhone = normalizePassString(u.Phone || '');
        const uPass = normalizePassString(u.Password || '');

        const userMatched =
          (uName && cleanUser === uName) ||
          (uId && cleanUser === uId) ||
          (uFull && cleanUser === uFull) ||
          (uPhone && cleanUser === uPhone);

        if (userMatched) {
          const passMatched =
            (uPass && (cleanPass === uPass || cleanPass.toLowerCase() === uPass.toLowerCase())) ||
            (u.Role === 'developer' && activeDevCode && cleanPass === activeDevCode);

          if (passMatched) {
            if (u.Status === 'frozen') {
              res.json({ success: false, frozen: true, error: 'تم تجميد هذا الحساب من قبل الإدارة.' });
              return;
            }
            res.json({ success: true, user: u, isDeveloper: u.Role === 'developer', matchedSource: 'server_db' });
            return;
          }
          usernameFoundButWrongPass = true;
        }
      }

      // Allow developer username + developerPasscode even if user record isn't synced yet
      if (
        (cleanUser === 'developer' || cleanUser === 'المطور' || cleanUser === 'usr-001') &&
        activeDevCode &&
        cleanPass === activeDevCode
      ) {
        const devAccount = store.users.find((u) => u.Role === 'developer');
        res.json({ success: true, user: devAccount, isDeveloper: true, matchedSource: 'server_passcode' });
        return;
      }

      res.json({
        success: false,
        reason: usernameFoundButWrongPass ? 'wrong_password' : 'not_found',
        error: usernameFoundButWrongPass
          ? 'كلمة المرور غير صحيحة لهذا الحساب. يرجى التأكد وإعادة المحاولة.'
          : undefined
      });
      return;
    }

    // Single passcode mode
    if (activeDevCode && rawCode && rawCode === activeDevCode) {
      const devAccount = store.users.find((u) => u.Role === 'developer');
      res.json({ success: true, user: devAccount, isDeveloper: true, matchedSource: 'server_passcode' });
      return;
    }
    for (const u of store.users) {
      if (!u) continue;
      const uPass = normalizePassString(u.Password || '');
      const uId = normalizePassString(u.User_ID || '').toLowerCase();
      if (
        rawCode &&
        ((uPass && (rawCode === uPass || rawCode.toLowerCase() === uPass.toLowerCase())) ||
          (uId && rawCode.toLowerCase() === uId))
      ) {
        if (u.Status === 'frozen') {
          res.json({ success: false, frozen: true, error: 'تم تجميد هذا الحساب من قبل الإدارة.' });
          return;
        }
        res.json({ success: true, user: u, isDeveloper: u.Role === 'developer', matchedSource: 'server_db' });
        return;
      }
    }
    res.json({ success: false, reason: 'not_found' });
  });

  // Update Developer Passcode & sync with developer user record
  app.post('/api/auth/developer-passcode', (req, res) => {
    const rawNewCode = String(req.body?.newCode || '').trim();
    const cleanCode = normalizePassString(rawNewCode);
    if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 64) {
      res.status(400).json({ success: false, error: 'يجب أن يتكون الرمز الجديد من 3 خانات على الأقل' });
      return;
    }
    const store = loadUsersStore();
    const nowIso = new Date().toISOString();
    const updatedUsers = store.users.map((u) =>
      u.Role === 'developer' ? { ...u, Password: cleanCode, UpdatedAt: nowIso } : u
    );
    saveUsersStore({
      ...store,
      users: updatedUsers,
      developerPasscode: cleanCode
    });

    // Also reflect in settings version so all clients stay in sync
    const settingsStore = loadSettingsStore();
    const nextSettings = { ...(settingsStore.systemSettings || {}), developerPasscode: cleanCode };
    saveSettingsStore({
      ...settingsStore,
      systemSettings: nextSettings,
      updatedAt: nowIso
    });

    res.json({ success: true, updatedAt: nowIso });
  });

  // --- Shared Settings, Icons & Custom Sections Broadcast API ---
  app.get('/api/settings', (_req, res) => {
    const store = loadSettingsStore();
    const usersStore = loadUsersStore();
    const mergedSettings = {
      ...(store.systemSettings || {}),
      ...(usersStore.developerPasscode ? { developerPasscode: usersStore.developerPasscode } : {})
    };
    res.json({
      success: true,
      systemSettings: mergedSettings,
      customSections: store.customSections || [],
      settingsVersion: store.settingsVersion || 0,
      updateSummary: store.updateSummary || '',
      updatedBy: store.updatedBy || '',
      updatedAt: store.updatedAt
    });
  });

  app.post('/api/settings', (req, res) => {
    const body = req.body || {};
    const store = loadSettingsStore();
    const incomingSettings = body.systemSettings && typeof body.systemSettings === 'object' ? body.systemSettings : null;
    const incomingSections = Array.isArray(body.customSections) ? body.customSections : null;
    const broadcastUpdate = Boolean(body.broadcastUpdate);
    const nextVersion = broadcastUpdate
      ? Math.max(Date.now(), (store.settingsVersion || 0) + 1)
      : (Number(body.settingsVersion) || store.settingsVersion || 0);

    const nextSettings = incomingSettings
      ? { ...(store.systemSettings || {}), ...incomingSettings, settingsVersion: nextVersion }
      : { ...(store.systemSettings || {}), settingsVersion: nextVersion };

    const nextState: SettingsStoreState = {
      systemSettings: nextSettings,
      customSections: incomingSections !== null ? incomingSections : store.customSections,
      settingsVersion: nextVersion,
      updateSummary: typeof body.updateSummary === 'string' && body.updateSummary.trim()
        ? body.updateSummary.trim()
        : store.updateSummary,
      updatedBy: typeof body.updatedBy === 'string' ? body.updatedBy.trim() : store.updatedBy,
      updatedAt: new Date().toISOString()
    };

    saveSettingsStore(nextState);

    // Sync developerPasscode to users-store if included
    if (incomingSettings?.developerPasscode) {
      const cleanDevCode = normalizePassString(String(incomingSettings.developerPasscode));
      if (cleanDevCode.length >= 3) {
        const uStore = loadUsersStore();
        saveUsersStore({
          ...uStore,
          developerPasscode: cleanDevCode,
          users: uStore.users.map((u) =>
            u.Role === 'developer' ? { ...u, Password: cleanDevCode, UpdatedAt: new Date().toISOString() } : u
          )
        });
      }
    }

    broadcastSseEvent('settings_updated', {
      settingsVersion: nextState.settingsVersion,
      updateSummary: nextState.updateSummary,
      updatedBy: nextState.updatedBy,
      broadcastUpdate,
      updatedAt: nextState.updatedAt
    });

    res.json({
      success: true,
      settingsVersion: nextState.settingsVersion,
      updateSummary: nextState.updateSummary,
      updatedAt: nextState.updatedAt
    });
  });

  // --- Shared Blacklist Persistence API ---
  app.get('/api/blacklist', (_req, res) => {
    const store = loadBlacklistStore();
    res.json({
      success: true,
      items: store.items,
      unblockedIds: store.unblockedIds,
      updatedAt: store.updatedAt
    });
  });

  app.post('/api/blacklist', (req, res) => {
    const incoming = req.body as Partial<BlacklistRecord>;
    if (!incoming || !incoming.Citizen_ID || !incoming.FullName) {
      res.status(400).json({ success: false, error: 'بيانات المواطن المحظور غير مكتملة' });
      return;
    }
    const cleanRecord: BlacklistRecord = {
      Citizen_ID: String(incoming.Citizen_ID).trim(),
      FullName: String(incoming.FullName).trim(),
      Phone1: incoming.Phone1 ? String(incoming.Phone1).trim() : '',
      District: incoming.District ? String(incoming.District).trim() : 'الناصرية - المركز',
      BlockReason: String(incoming.BlockReason || 'محظور من قبل الإدارة').trim(),
      BlockedAt: String(incoming.BlockedAt || new Date().toLocaleDateString('ar-IQ')),
      BlockedBy: String(incoming.BlockedBy || 'الإدارة').trim(),
      IsBlocked: true
    };
    const store = loadBlacklistStore();
    const unblockedSet = new Set(store.unblockedIds);
    unblockedSet.delete(cleanRecord.Citizen_ID);
    const filtered = store.items.filter((i) => i.Citizen_ID !== cleanRecord.Citizen_ID);
    saveBlacklistStore({
      items: [cleanRecord, ...filtered],
      unblockedIds: Array.from(unblockedSet),
      updatedAt: new Date().toISOString()
    });
    broadcastSseEvent('blacklist_updated', { action: 'block', citizenId: cleanRecord.Citizen_ID });
    res.json({ success: true, item: cleanRecord });
  });

  app.delete('/api/blacklist/:citizenId', (req, res) => {
    const citizenId = String(req.params.citizenId || '').trim();
    if (!citizenId) {
      res.status(400).json({ success: false, error: 'citizenId required' });
      return;
    }
    const store = loadBlacklistStore();
    const unblockedSet = new Set(store.unblockedIds);
    unblockedSet.add(citizenId);
    const nextItems = store.items.filter((i) => i.Citizen_ID !== citizenId);
    saveBlacklistStore({
      items: nextItems,
      unblockedIds: Array.from(unblockedSet),
      updatedAt: new Date().toISOString()
    });
    broadcastSseEvent('blacklist_updated', { action: 'unblock', citizenId });
    res.json({ success: true, unblockedId: citizenId });
  });

  // --- Real-Time Multi-User Live Sync API (SSE + Authoritative Store for Shared Links & Desktop PWA) ---
  app.get('/api/sync/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    sseClients.add(res);
    res.write(
      `event: connected\ndata: ${JSON.stringify({
        rev: memoryAppDataStore.rev,
        settingsVersion: memorySettingsStore.settingsVersion || 0,
        connectedClients: sseClients.size,
        timestamp: new Date().toISOString()
      })}\n\n`
    );

    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  app.get('/api/sync/rev', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      success: true,
      rev: memoryAppDataStore.rev,
      settingsVersion: memorySettingsStore.settingsVersion || 0,
      counts: buildSyncCounts(),
      updatedAt: memoryAppDataStore.updatedAt
    });
  });

  const handleMutateRequest = (req: express.Request, res: express.Response) => {
    const { entity, op, item, id, clientId } = req.body || {};
    if (!entity || !ALLOWED_SYNC_ENTITIES.has(String(entity))) {
      res.status(400).json({ success: false, error: 'Invalid entity' });
      return;
    }
    const entityKey = entity as SyncEntityKey;
    if (op === 'upsert') {
      if (!item || typeof item !== 'object') {
        res.status(400).json({ success: false, error: 'item required' });
        return;
      }
      const saved = upsertSyncRecord(entityKey, item);
      if (!saved) {
        res.status(400).json({ success: false, error: 'item missing identifier' });
        return;
      }
      memoryAppDataStore.rev += 1;
      scheduleAppDataSave();
      broadcastSseEvent('mutation', {
        rev: memoryAppDataStore.rev,
        entity: entityKey,
        op: 'upsert',
        id: saved.id,
        item: saved.record,
        clientId: String(clientId || '')
      });
      res.json({ success: true, rev: memoryAppDataStore.rev, id: saved.id, counts: buildSyncCounts() });
      return;
    }

    if (op === 'delete') {
      const targetId = String(id || '').trim();
      if (!targetId) {
        res.status(400).json({ success: false, error: 'id required' });
        return;
      }
      deleteSyncRecord(entityKey, targetId);
      memoryAppDataStore.rev += 1;
      scheduleAppDataSave();
      broadcastSseEvent('mutation', {
        rev: memoryAppDataStore.rev,
        entity: entityKey,
        op: 'delete',
        id: targetId,
        clientId: String(clientId || '')
      });
      res.json({ success: true, rev: memoryAppDataStore.rev, id: targetId, counts: buildSyncCounts() });
      return;
    }

    res.status(400).json({ success: false, error: 'Invalid op (expected upsert or delete)' });
  };

  const handleBulkRequest = (req: express.Request, res: express.Response) => {
    const body = req.body || {};
    const clientId = String(body.clientId || '');
    const changedEntities: string[] = [];

    if (body.replaceAll === true || body.mode === 'wipe' || body.action === 'wipe') {
      memoryAppDataStore.citizens = Array.isArray(body.citizens) ? body.citizens : [];
      memoryAppDataStore.requests = Array.isArray(body.requests) ? body.requests : [];
      memoryAppDataStore.interviews = Array.isArray(body.interviews) ? body.interviews : [];
      memoryAppDataStore.officialLetters = Array.isArray(body.officialLetters) ? body.officialLetters : [];
      memoryAppDataStore.cheques = Array.isArray(body.cheques) ? body.cheques : [];
      memoryAppDataStore.organizationRecords = Array.isArray(body.organizationRecords) ? body.organizationRecords : [];
      memoryAppDataStore.customRecords = Array.isArray(body.customRecords) ? body.customRecords : [];
      memoryAppDataStore.documents = Array.isArray(body.documents) ? body.documents : [];
      memoryAppDataStore.notifications = Array.isArray(body.notifications) ? body.notifications : [];
      memoryAppDataStore.deletedIds = Array.isArray(body.deletedIds) ? body.deletedIds : [];
      memoryAppDataStore.rev += 1;
      scheduleAppDataSave();
      broadcastSseEvent('bulk_refresh', {
        rev: memoryAppDataStore.rev,
        entities: ['citizens', 'requests', 'interviews', 'officialLetters', 'cheques', 'organizationRecords', 'customRecords'],
        clientId,
        updatedAt: new Date().toISOString()
      });
      res.json({ success: true, rev: memoryAppDataStore.rev, counts: buildSyncCounts() });
      return;
    }

    const deletedSet = new Set<string>([
      ...memoryAppDataStore.deletedIds,
      ...(Array.isArray(body.deletedIds) ? body.deletedIds.map((x: any) => String(x || '').trim()).filter(Boolean) : [])
    ]);

    for (const key of Array.from(ALLOWED_SYNC_ENTITIES) as SyncEntityKey[]) {
      const incoming = body[key];
      if (!Array.isArray(incoming) || incoming.length === 0) continue;
      const map = new Map<string, any>();
      for (const existing of memoryAppDataStore[key]) {
        const eid = getRecordSyncId(key, existing);
        if (eid && !deletedSet.has(eid)) map.set(eid, existing);
      }
      let addedOrUpdated = 0;
      for (const item of incoming) {
        const iid = getRecordSyncId(key, item);
        if (!iid || deletedSet.has(iid)) continue;
        const normalizedItem = key === 'dropdowns' ? { ...item, id: iid } : item;
        const prev = map.get(iid);
        map.set(iid, prev ? { ...prev, ...normalizedItem } : normalizedItem);
        addedOrUpdated++;
      }
      if (addedOrUpdated > 0) {
        memoryAppDataStore[key] = Array.from(map.values());
        changedEntities.push(key);
      }
    }

    if (body.systemSettings && typeof body.systemSettings === 'object') {
      const sStore = loadSettingsStore();
      saveSettingsStore({
        ...sStore,
        systemSettings: { ...(sStore.systemSettings || {}), ...body.systemSettings },
        ...(Array.isArray(body.customSections) ? { customSections: body.customSections } : {})
      });
      changedEntities.push('systemSettings');
    } else if (Array.isArray(body.customSections) && body.customSections.length > 0) {
      const sStore = loadSettingsStore();
      saveSettingsStore({
        ...sStore,
        customSections: body.customSections
      });
      changedEntities.push('customSections');
    }

    if (Array.isArray(body.users) && body.users.length > 0) {
      const uStore = loadUsersStore();
      const uMap = new Map<string, any>();
      uStore.users.forEach((u) => { if (u?.User_ID && !deletedSet.has(u.User_ID)) uMap.set(u.User_ID, u); });
      body.users.forEach((u: any) => { if (u?.User_ID && !deletedSet.has(u.User_ID)) uMap.set(u.User_ID, { ...(uMap.get(u.User_ID) || {}), ...u }); });
      saveUsersStore({
        ...uStore,
        users: Array.from(uMap.values()),
        ...(body.developerPasscode ? { developerPasscode: String(body.developerPasscode) } : {})
      });
      changedEntities.push('users');
    }

    memoryAppDataStore.deletedIds = Array.from(deletedSet).slice(-5000);
    if (changedEntities.length > 0) {
      memoryAppDataStore.rev += 1;
      scheduleAppDataSave();
      broadcastSseEvent('bulk_refresh', {
        rev: memoryAppDataStore.rev,
        entities: changedEntities,
        clientId,
        updatedAt: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      rev: memoryAppDataStore.rev,
      changedEntities,
      counts: buildSyncCounts()
    });
  };

  app.get('/api/sync/state', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const mode = String(req.query?.mode || '').trim();
    if (mode === 'rev') {
      res.json({
        success: true,
        rev: memoryAppDataStore.rev,
        settingsVersion: memorySettingsStore.settingsVersion || 0,
        counts: buildSyncCounts(),
        updatedAt: memoryAppDataStore.updatedAt
      });
      return;
    }
    const settingsStore = loadSettingsStore();
    const usersStore = loadUsersStore();
    const blacklistStore = loadBlacklistStore();
    res.json({
      success: true,
      rev: memoryAppDataStore.rev,
      citizens: memoryAppDataStore.citizens,
      requests: memoryAppDataStore.requests,
      interviews: memoryAppDataStore.interviews,
      officialLetters: memoryAppDataStore.officialLetters,
      cheques: memoryAppDataStore.cheques,
      organizationRecords: memoryAppDataStore.organizationRecords,
      dropdowns: memoryAppDataStore.dropdowns,
      customSections: settingsStore.customSections || [],
      customRecords: memoryAppDataStore.customRecords,
      documents: memoryAppDataStore.documents,
      notifications: memoryAppDataStore.notifications,
      users: usersStore.users || [],
      developerPasscode: usersStore.developerPasscode,
      systemSettings: settingsStore.systemSettings || {},
      settingsVersion: settingsStore.settingsVersion || 0,
      blacklist: {
        items: blacklistStore.items || [],
        unblockedIds: blacklistStore.unblockedIds || []
      },
      deletedIds: memoryAppDataStore.deletedIds,
      counts: buildSyncCounts(),
      updatedAt: memoryAppDataStore.updatedAt
    });
  });

  app.post('/api/sync/state', (req, res) => {
    const mode = String(req.query?.mode || req.body?.mode || req.body?.action || '').trim();
    if (mode === 'mutate' || (req.body?.entity && req.body?.op)) {
      handleMutateRequest(req, res);
      return;
    }
    handleBulkRequest(req, res);
  });

  app.post('/api/sync/mutate', handleMutateRequest);
  app.post('/api/sync/bulk', handleBulkRequest);

  // --- Google Drive Shared Folder Listing & Image Proxy API ---
  const DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{10,80}$/;

  app.get('/api/drive/folder-files', async (req, res) => {
    try {
      const rawFolder = String(req.query.folderId || '').trim();
      const query = String(req.query.q || '').trim();
      const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

      // Extract folderId & optional resourcekey if a full Google Drive URL was passed
      let folderId = rawFolder;
      let resourceKey = String(req.query.resourcekey || '').trim();
      const urlMatch = rawFolder.match(/folders\/([a-zA-Z0-9_-]+)/);
      if (urlMatch && urlMatch[1]) {
        folderId = urlMatch[1];
      } else {
        const idParamMatch = rawFolder.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idParamMatch && idParamMatch[1]) folderId = idParamMatch[1];
      }
      if (!resourceKey) {
        const rkMatch = rawFolder.match(/[?&]resourcekey=([a-zA-Z0-9_-]+)/i);
        if (rkMatch && rkMatch[1]) resourceKey = rkMatch[1];
      }
      folderId = folderId.split('?')[0].split('&')[0].trim();

      if (!DRIVE_ID_REGEX.test(folderId)) {
        res.status(400).json({ success: false, files: [], error: 'معرف مجلد Google Drive غير صالح' });
        return;
      }

      const fetchAndParseEmbeddedFolder = async (
        targetId: string,
        rk?: string
      ): Promise<{
        ok: boolean;
        isPrivate?: boolean;
        error?: string;
        files: Array<{
          id: string;
          name: string;
          mimeType: string;
          webViewLink: string;
          webContentLink: string;
          thumbnailLink: string;
        }>;
        subfolderIds: string[];
      }> => {
        const rkPart = rk ? `&resourcekey=${encodeURIComponent(rk)}` : '';
        const candidateViews = [
          `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(targetId)}${rkPart}#grid`,
          `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(targetId)}${rkPart}#list`
        ];

        for (const embedUrl of candidateViews) {
          const driveRes = await fetch(embedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
            },
            redirect: 'follow'
          });

          if (!driveRes.ok) {
            return {
              ok: false,
              isPrivate: driveRes.status === 401 || driveRes.status === 403,
              error: 'تعذر الوصول إلى مجلد Google Drive. تأكد من أن مشاركة المجلد مضبوطة على (أي شخص لديه الرابط — عارض).',
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
              error: 'مجلد Google Drive مقيد (خاص). يرجى فتح المجلد في Drive -> مشاركة -> تغيير الوصول العام إلى "أي شخص لديه الرابط (عارض)".',
              files: [],
              subfolderIds: []
            };
          }

          const seen = new Set<string>();
          const files: Array<{
            id: string;
            name: string;
            mimeType: string;
            webViewLink: string;
            webContentLink: string;
            thumbnailLink: string;
          }> = [];
          const subfolderIds: string[] = [];

          // Parse entries in embeddedfolderview (both #grid and #list share id="entry-..." + flip-entry-title)
          const entryBlockRegex = /id="entry-([a-zA-Z0-9_-]{10,80})"([\s\S]{0,2200}?)class="flip-entry-title">([^<]+)</g;
          let m: RegExpExecArray | null;
          while ((m = entryBlockRegex.exec(html)) !== null) {
            const fid = m[1];
            const block = m[2] || '';
            const fname = decodeHtmlEntities(m[3].trim());
            if (!fid || seen.has(fid) || fid === targetId) continue;
            seen.add(fid);

            // Detect nested subfolder links so we can inspect their files too!
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

          if (files.length > 0 || subfolderIds.length > 0) {
            return { ok: true, files, subfolderIds };
          }
        }

        return { ok: true, files: [], subfolderIds: [] };
      };

      const cacheKey = resourceKey ? `${folderId}:${resourceKey}` : folderId;
      const cached = driveFolderCache.get(cacheKey);
      let allFiles = cached && !forceRefresh && Date.now() - cached.fetchedAt < 45_000 ? cached.files : null;

      if (!allFiles) {
        const rootParsed = await fetchAndParseEmbeddedFolder(folderId, resourceKey);
        if (!rootParsed.ok) {
          res.json({
            success: false,
            files: [],
            totalInFolder: 0,
            isPrivate: Boolean(rootParsed.isPrivate),
            error: rootParsed.error
          });
          return;
        }

        const combined = [...rootParsed.files];
        const seenAll = new Set(combined.map(f => f.id));

        // If the folder contains subfolders, traverse 1 level deep (up to 15 subfolders in parallel batches)
        if (rootParsed.subfolderIds.length > 0) {
          const subIdsToScan = rootParsed.subfolderIds.slice(0, 15);
          const subResults = await Promise.all(
            subIdsToScan.map(subId =>
              fetchAndParseEmbeddedFolder(subId).catch(() => ({ ok: false, files: [], subfolderIds: [] }))
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

        const isArabicCitizenFile = (name: string) => {
          const clean = repairArabicMojibakeServer(name || '')
            .replace(/\.[a-zA-Z0-9]{2,5}$/, '')
            .replace(/CamScanner[\s\S]*/i, '')
            .replace(/(?:نسخة من|نسخه من|صورة|صور)/gi, '')
            .trim();
          return /[\u0621-\u064A]{2,}/.test(clean);
        };
        const arabicNamed = combined.filter(f => isArabicCitizenFile(f.name));
        const otherFiles = combined.filter(f => !isArabicCitizenFile(f.name));

        allFiles = [...arabicNamed, ...otherFiles];
        driveFolderCache.set(cacheKey, { fetchedAt: Date.now(), files: allFiles });
      }

      const normalizeDriveArabic = (val: string) =>
        repairArabicMojibakeServer(val || '')
          .replace(/\.[a-zA-Z0-9]{2,5}$/, '')
          .replace(/^(?:نسخة من|نسخه من)\s+/i, '')
          .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
          .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
          .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
          .replace(/[أإآٱ]/g, 'ا')
          .replace(/ة/g, 'ه')
          .replace(/ى/g, 'ي')
          .replace(/ؤ/g, 'و')
          .replace(/ئ/g, 'ي')
          .replace(/[._\-()/\\]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

      let filtered = allFiles;
      if (query) {
        const normQ = normalizeDriveArabic(query);
        const compactQ = normQ.replace(/\s+/g, '');
        const tokens = normQ.split(' ').filter(Boolean);
        filtered = allFiles.filter((f) => {
          const normName = normalizeDriveArabic(f.name);
          const compactName = normName.replace(/\s+/g, '');
          return (
            normName.includes(normQ) ||
            (compactQ.length >= 2 && compactName.includes(compactQ)) ||
            (tokens.length > 0 && tokens.every((t) => normName.includes(t) || compactName.includes(t))) ||
            f.id.toLowerCase().includes(normQ)
          );
        });
      }

      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '5000'), 10) || 5000, 1), 5000);
      const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);

      res.json({
        success: true,
        folderId,
        totalInFolder: allFiles.length,
        matchedCount: filtered.length,
        files: filtered.slice(offset, offset + limit)
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        files: [],
        error: err?.message || 'حدث خطأ أثناء الاتصال بمجلد Google Drive'
      });
    }
  });

  app.get('/api/drive/image/:fileId', async (req, res) => {
    try {
      const fileId = String(req.params.fileId || '').trim();
      if (!DRIVE_ID_REGEX.test(fileId)) {
        res.status(400).send('Invalid file ID');
        return;
      }

      const sizeParam = String(req.query.sz || 'w1200');
      const safeSize = /^w\d{3,4}$/.test(sizeParam) ? sizeParam : 'w1200';
      const candidateUrls = [
        `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=${safeSize}`,
        `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}=${safeSize}`
      ];

      for (const targetUrl of candidateUrls) {
        try {
          const upstream = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            redirect: 'follow'
          });
          const ct = upstream.headers.get('content-type') || '';
          if (upstream.ok && ct.startsWith('image/')) {
            const buf = Buffer.from(await upstream.arrayBuffer());
            res.setHeader('Content-Type', ct);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.send(buf);
            return;
          }
        } catch {
          // Try next fallback URL
        }
      }

      res.status(404).send('Image not accessible');
    } catch {
      res.status(500).send('Image proxy error');
    }
  });

  // OCR Document & Image Analysis Endpoint
  app.post('/api/ocr/analyze-image', async (req, res) => {
    const { image, filename } = req.body || {};
    try {
      if (!image || typeof image !== 'string') {
        res.status(400).json({
          success: false,
          error: 'صورة غير صالحة أو غير مرسلة (image data is required)'
        });
        return;
      }

      // Extract base64 and mime type
      let mimeType = 'image/jpeg';
      let base64Data = image;

      const dataUrlMatch = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (dataUrlMatch) {
        mimeType = dataUrlMatch[1];
        base64Data = dataUrlMatch[2];
      }

      const ai = getGemini();
      if (!ai) {
        // Safe fallback when key is not present
        const fallback = extractCitizenInfoFromFilename(filename || '');
        res.json({
          success: true,
          ocrUsed: false,
          citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
          entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
          details: fallback.details || 'طلب رسمي مرفق بالصورة',
          phone: '',
          priority: 'عام',
          requestType: 'عام',
          fullExtractedText: '',
          confidence: fallback.confidence || 60,
          originalFilename: filename || '',
          warning: 'مفتاح الذكاء الاصطناعي غير متوفر، تم استخراج الاسم من اسم الملف'
        });
        return;
      }

      const prompt = `
أنت خبير محترف في استخراج وتدقيق الوثائق والمعاملات الإدارية والعقارية والرسمية والعرائض الشعبية في العراق (كتب رسمية، عرائض مواطنين بخط اليد أو مطبوعة، طلبات موجهة إلى النائب علا الناشي أو الدوائر والوزارات، بطاقات موحدة وهويات).

المهمة:
قم بقراءة وتحليل صورة الوثيقة المرفقة بدقة فائقة عبر تقنية OCR واستخرج البيانات الآتية بصيغة JSON حصراً:

1. citizenName: الاسم الكامل للشخص مقدم الطلب أو صاحب المعاملة (ثلاثي أو رباعي). ابحث بدقة عن: (مقدمه / مقدم الطلب / الاسم / المواطن / السيد / الحاج / اسم المراجع / التوقيع في الأسفل). إذا كانت هوية أو بطاقة وطنية استخرج الاسم الكامل المذكور فيها. إذا لم تجد اسماً واضحاً اكتب "مواطن صاحب معاملة".
2. entity: الجهة أو الوزارة أو الدائرة الرسمية الموجه إليها الطلب (مثال: "وزارة العمل والشؤون الاجتماعية (شبكة الحماية)"، "دائرة صحة ذي قار / وزارة الصحة"، "مديرية تربية ذي قار / وزارة التربية"، "مديرية بلدية الناصرية / البلديات"، "ديوان محافظة ذي قار"، "مجلس النواب العراقي / مكتب النائب علا الناشي"، أو الجهة المذكورة في الترويسة).
3. details: ملخص واضح وموجز لموضوع الطلب وحاجة المواطن (مثال: "طلب شمول براتب شبكة الحماية الاجتماعية"، "طلب نقل ملاك وظيفي"، "طلب مساعدة علاجية وعملية جراحية"، "طلب تخصيص قطعة أرض").
4. phone: رقم هاتف المواطن إذا كان مكتوباً أو مسجلاً على الورقة (مثلاً: 0780... أو 0770...) أو فارغ "" إذا لم يوجد.
5. priority: درجة الأهمية ("عاجل" إذا كان علاجاً أو حالة حرجة أو طارئة أو مكتوب عليه عاجل، وإلا "عام").
6. requestType: نوع المعاملة ("رعاية اجتماعية"، "تعيين / تشغيل"، "نقل / تنسيب"، "علاج / صحة"، "خدمات / بلدية"، "شكوى"، "عام").
7. fullExtractedText: النص الكامل المقروء من الوثيقة (كل الكلمات المكتوبة والمطبوعة على الورقة لتمكين البحث السريع بأي كلمة داخل الوثيقة).
8. confidence: نسبة الثقة التقريبية في قراءة الاسم من 1 إلى 100.

يجب أن يكون الإخراج كائن JSON فقط بالصيغة التالية دون أي نص إضافي:
{
  "citizenName": "اسم المواطن",
  "entity": "الجهة المعنية",
  "details": "تفاصيل وموضوع الطلب",
  "phone": "رقم الهاتف أو فارغ",
  "priority": "عاجل" | "عام",
  "requestType": "رعاية اجتماعية" | "عام" | ...,
  "fullExtractedText": "النص الكامل للوثيقة",
  "confidence": 95
}
`;

      let responseText = '';
      let modelUsed = '';

      try {
        const ocrExecution = await callGeminiVisionOCRWithFallback(ai, mimeType, base64Data, prompt);
        responseText = ocrExecution.text;
        modelUsed = ocrExecution.modelUsed;
      } catch (_aiErr: any) {
        const fallback = extractCitizenInfoFromFilename(filename || '');
        res.json({
          success: true,
          ocrUsed: false,
          isTemporaryOverload: true,
          citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
          entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
          details: fallback.details || 'طلب رسمي مرفق بالصورة',
          phone: '',
          priority: 'عام',
          requestType: 'عام',
          fullExtractedText: '',
          confidence: fallback.confidence || 60,
          originalFilename: filename || '',
          warning: 'خدمة التعرف الضوئي تشهد ضغطاً مؤقتاً، تم حفظ المعاملة بنجاح ويمكن إعادة فحصها لاحقاً.'
        });
        return;
      }

      let parsedData: any = null;

      try {
        parsedData = JSON.parse(responseText.trim());
      } catch (e) {
        // Fallback extract JSON from markdown code blocks
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[1].trim());
        } else {
          throw new Error('فشل تفسير استجابة نموذج الذكاء الاصطناعي');
        }
      }

      // Clean and sanitize citizen name
      let cleanName = (parsedData.citizenName || '').trim();
      cleanName = cleanName.replace(/^(السيد|المواطن|الحاج|الشيخ|الدكتور|الأستاذ|السيدة|المواطنة|الحاجة|الشيخة)\s+/gi, '').trim();
      if (!cleanName || cleanName === 'غير متوفر' || cleanName === 'غير معروف') {
        const fallback = extractCitizenInfoFromFilename(filename || '');
        cleanName = fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة';
      }

      res.json({
        success: true,
        ocrUsed: true,
        citizenName: cleanName,
        entity: parsedData.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
        details: parsedData.details || 'طلب رسمي مستخرج من الوثيقة المرفقة',
        phone: parsedData.phone || '',
        priority: parsedData.priority === 'عاجل' ? 'عاجل' : 'عام',
        requestType: parsedData.requestType || 'عام',
        fullExtractedText: parsedData.fullExtractedText || '',
        confidence: parsedData.confidence || 90,
        originalFilename: filename || '',
        modelUsed
      });
    } catch (_error: any) {
      const fallback = extractCitizenInfoFromFilename(filename || '');
      res.json({
        success: true,
        ocrUsed: false,
        isTemporaryOverload: true,
        citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
        entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
        details: fallback.details || 'طلب رسمي مسجل بالصورة',
        phone: '',
        priority: 'عام',
        requestType: 'عام',
        fullExtractedText: '',
        confidence: fallback.confidence || 50,
        originalFilename: filename || ''
      });
    }
  });

  // Batch OCR endpoint for analyzing a small queue
  app.post('/api/ocr/analyze-batch', async (req, res) => {
    try {
      const { items } = req.body; // array of { id, image, filename }
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'قائمة الصور غير صحيحة' });
        return;
      }

      const results = [];
      const ai = getGemini();

      for (const item of items) {
        try {
          let mimeType = 'image/jpeg';
          let base64Data = item.image;
          const match = item.image?.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
          if (match) {
            mimeType = match[1];
            base64Data = match[2];
          }

          if (!ai) {
            const fallback = extractCitizenInfoFromFilename(item.filename || '');
            results.push({
              id: item.id,
              success: true,
              ocrUsed: false,
              citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
              entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
              details: fallback.details || 'طلب رسمي مستخرج',
              phone: '',
              fullExtractedText: '',
              priority: 'عام'
            });
            continue;
          }

          const prompt = `
استخرج اسم المواطن والجهة المعنية وتفاصيل الطلب ورقم الهاتف والنص الكامل من صورة المعاملة/الوثيقة العراقية المرفقة بصيغة JSON:
{
  "citizenName": "الاسم الكامل للمواطن فقط بدون لقب",
  "entity": "الجهة الرسمية الموجه إليها",
  "details": "موضوع ومطلب المعاملة",
  "phone": "رقم الهاتف إن وجد",
  "fullExtractedText": "نص الوثيقة الكامل للبحث",
  "priority": "عاجل" | "عام"
}
`;
          let responseText = '';
          try {
            const ocrExecution = await callGeminiVisionOCRWithFallback(ai, mimeType, base64Data, prompt);
            responseText = ocrExecution.text;
          } catch (batchErr) {
            const fallback = extractCitizenInfoFromFilename(item.filename || '');
            results.push({
              id: item.id,
              success: true,
              ocrUsed: false,
              citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
              entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
              details: fallback.details || 'طلب رسمي مستخرج',
              phone: '',
              fullExtractedText: '',
              priority: 'عام'
            });
            continue;
          }

          const data = JSON.parse(responseText.trim() || '{}');
          let cleanName = (data.citizenName || '').trim();
          cleanName = cleanName.replace(/^(السيد|المواطن|الحاج|الشيخ|الدكتور|الأستاذ|السيدة|المواطنة)\s+/gi, '').trim();
          if (!cleanName) {
            const fallback = extractCitizenInfoFromFilename(item.filename || '');
            cleanName = fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة';
          }

          results.push({
            id: item.id,
            success: true,
            ocrUsed: true,
            citizenName: cleanName,
            entity: data.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
            details: data.details || 'طلب رسمي مستخرج',
            phone: data.phone || '',
            fullExtractedText: data.fullExtractedText || '',
            priority: data.priority || 'عام'
          });
        } catch (err: any) {
          const fallback = extractCitizenInfoFromFilename(item.filename || '');
          results.push({
            id: item.id,
            success: true,
            ocrUsed: false,
            citizenName: fallback.cleanName && fallback.cleanName !== 'مواطن غير معروف' ? fallback.cleanName : 'مواطن صاحب معاملة',
            entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
            details: fallback.details || 'طلب رسمي مستخرج',
            phone: '',
            fullExtractedText: '',
            priority: 'عام'
          });
        }
      }

      res.json({ success: true, results });
    } catch (err: any) {
      res.json({ success: false, results: [] });
    }
  });

  // --- Dynamic Desktop PWA App Icon & Web App Manifest (Reflects Custom Replaced Icon Immediately) ---
  function getDynamicIconMeta(): {
    logoUrl: string;
    pwaIcon192: string;
    pwaIcon512: string;
    mimeType: string;
    hasGenuinePng: boolean;
    versionTag: string;
  } {
    const store = loadSettingsStore();
    const s = store.systemSettings || {};
    const pwaIcon192 = String(s.pwaIcon192 || '').trim();
    const pwaIcon512 = String(s.pwaIcon512 || '').trim();
    const logoUrl = String(s.logoUrl || s.customImages?.appIcon || s.parliamentEmblemUrl || '').trim();
    const hasGenuinePng =
      pwaIcon192.startsWith('data:image/png;base64,') ||
      pwaIcon512.startsWith('data:image/png;base64,');
    const versionTag = String(
      store.settingsVersion ||
        (pwaIcon192 ? pwaIcon192.length : 0) + (logoUrl ? logoUrl.length : 1) ||
        Date.parse(store.updatedAt || '') ||
        1
    );

    let mimeType = 'image/svg+xml';
    if (hasGenuinePng) {
      mimeType = 'image/png';
    } else if (logoUrl.startsWith('data:image/')) {
      const m = logoUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
      if (m && m[1]) mimeType = m[1];
    } else if (/\.png(\?|$)/i.test(logoUrl)) {
      mimeType = 'image/png';
    } else if (/\.(jpe?g)(\?|$)/i.test(logoUrl)) {
      mimeType = 'image/jpeg';
    } else if (/\.webp(\?|$)/i.test(logoUrl)) {
      mimeType = 'image/webp';
    } else if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      mimeType = 'image/png';
    }
    return { logoUrl, pwaIcon192, pwaIcon512, mimeType, hasGenuinePng, versionTag };
  }

  app.get('/api/pwa-icon/:size', async (req, res) => {
    try {
      const sizeParam = String(req.params.size || '192');
      const wantRaw = req.query.raw === '1';
      const { logoUrl, pwaIcon192, pwaIcon512 } = getDynamicIconMeta();
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');

      // 1. Prefer genuine pre-rendered square 192x192 / 512x512 PNG icons (guaranteed Chromium/Edge Desktop PWA compliance!)
      if (!wantRaw) {
        const preferredPng =
          sizeParam === '512'
            ? pwaIcon512 || pwaIcon192
            : pwaIcon192 || pwaIcon512;
        if (preferredPng && preferredPng.startsWith('data:image/')) {
          const match = preferredPng.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
          if (match) {
            const buf = Buffer.from(match[2], 'base64');
            res.setHeader('Content-Type', match[1]);
            res.send(buf);
            return;
          }
        }
      }

      // 2. Custom uploaded Data URL icon saved by Developer
      if (logoUrl.startsWith('data:image/')) {
        const match = logoUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (match) {
          const buf = Buffer.from(match[2], 'base64');
          res.setHeader('Content-Type', match[1]);
          res.send(buf);
          return;
        }
      }

      // 3. Custom external HTTP/HTTPS icon URL (proxy cleanly so Desktop PWA installer never hits CORS)
      if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          const upstream = await fetch(logoUrl, { signal: controller.signal, redirect: 'follow' });
          clearTimeout(timer);
          const ct = upstream.headers.get('content-type') || 'image/png';
          if (upstream.ok && ct.startsWith('image/')) {
            const buf = Buffer.from(await upstream.arrayBuffer());
            res.setHeader('Content-Type', ct);
            res.send(buf);
            return;
          }
        } catch {
          // Fall through to bundled SVG icon
        }
      }

      // 4. Fallback to bundled office emblem SVG
      const svgPath = path.join(process.cwd(), 'public', 'icon.svg');
      if (fs.existsSync(svgPath)) {
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.sendFile(svgPath);
        return;
      }

      res.status(404).send('Icon not found');
    } catch {
      res.status(500).send('Icon error');
    }
  });

  app.get('/manifest.json', (_req, res) => {
    const store = loadSettingsStore();
    const { mimeType, versionTag } = getDynamicIconMeta();
    const appName = String(store.systemSettings?.appName || 'نظام مكتب النائب علا الناشي').trim();
    const shortName = appName.length > 24 ? appName.slice(0, 24) : appName;
    const icon192 = `/api/pwa-icon/192?v=${encodeURIComponent(versionTag)}`;
    const icon512 = `/api/pwa-icon/512?v=${encodeURIComponent(versionTag)}`;
    const iconSizes192 = mimeType === 'image/svg+xml' ? 'any' : '192x192';
    const iconSizes512 = mimeType === 'image/svg+xml' ? 'any' : '512x512';

    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      id: '/',
      name: appName,
      short_name: shortName,
      description: 'النظام الإداري والمكتبي المتكامل لمكتب النائب علا الناشي لإدارة المراجعين، الطلبات، مقابلات النائب، الأرشيف، وبطاقات المعلومات الرسمية',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#0f172a',
      theme_color: '#0f172a',
      orientation: 'any',
      dir: 'rtl',
      lang: 'ar',
      icons: [
        { src: icon192, sizes: iconSizes192, type: mimeType, purpose: 'any' },
        { src: icon192, sizes: iconSizes192, type: mimeType, purpose: 'maskable' },
        { src: icon512, sizes: iconSizes512, type: mimeType, purpose: 'any' },
        { src: icon512, sizes: iconSizes512, type: mimeType, purpose: 'maskable' }
      ]
    });
  });

  // --- Vite & Static Handling ---

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
