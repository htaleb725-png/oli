import { getAccessToken, pushSingleRecordToSheetsRealtime, deleteRecordFromSheetsRealtime, syncAllDataToGoogleSheets } from './googleSheetsService';
import {
  CITIZENS_SHEET_NAME,
  REQUESTS_SHEET_NAME,
  USERS_SHEET_NAME,
  citizenToSheetRow,
  requestToSheetRow,
  toCleanSheetCitizenPayload,
  toCleanSheetRequestPayload,
  toCleanSheetInterviewPayload,
  toCleanSheetOrganizationPayload,
  toCleanSheetLetterPayload,
  toCleanSheetChequePayload,
  toCleanSheetSocialCarePayload,
  toCleanSheetUserPayload,
  toCleanCustomSectionRecordPayload,
  buildCustomSectionSheetName,
  buildCustomSectionHeaders,
  cleanSheetCell,
  mapSheetRowByHeaders
} from './googleSheetsSchema';
import { normalizeUserRole, normalizeUserRecord } from '../utils/permissions';
import {
  Citizen,
  OfficeRequest,
  Interview,
  OfficialLetter,
  OrganizationRecord,
  ChequeRecord,
  CustomSection,
  CustomSectionRecord,
  User
} from '../types';
import { updateSheetsHealth, pushCloudSyncAlert } from './cloudSyncAlerts';

/**
 * Realtime Google Sheets and Google Drive Auto-Sync Service
 * ---------------------------------------------------------
 * - Never fakes `{ success: true }` when Apps Script / server proxy fails.
 * - Detects CORS, HTML rewrite misconfigurations, and missing env variables explicitly.
 * - Automatically registers new Custom Sections / Icons as dedicated Sheet tabs.
 * - Routes every CustomSectionRecord strictly to its own section's Sheet tab.
 */

export type RealtimeEntityType =
  | 'citizens'
  | 'requests'
  | 'interviews'
  | 'organization'
  | 'letters'
  | 'cheques'
  | 'users'
  | 'drive_archive'
  | 'dropdowns'
  | 'custom_sections'
  | 'custom_records'
  | 'settings'
  | (string & {});

export type RealtimeActionType = 'insert' | 'update' | 'upsert' | 'delete';

export interface RealtimePushResult {
  success: boolean;
  via?: 'proxy' | 'direct' | 'oauth_rest' | 'skipped';
  sheet?: string;
  error?: string;
  corsBlocked?: boolean;
}

export interface AppsScriptPingResult {
  ok: boolean;
  via: 'proxy' | 'direct' | 'none';
  status?: string;
  spreadsheetName?: string;
  sheetsCount?: number;
  version?: string;
  needsScriptUpdate?: boolean;
  corsError?: boolean;
  error?: string;
}

const stripQuotes = (val?: string) => (val || '').replace(/^["']|["']$/g, '').trim();

// Runtime cloud config hydrated directly from Firestore settings/general (never relies on Chrome business storage)
let _runtimeCloudConfig: {
  appsScriptUrl?: string;
  googleSheetId?: string;
  googleDriveFolderId?: string;
} = {};

// Live registry of custom sections hydrated by AppContext so custom_records always know their exact Sheet & Columns
let _runtimeCustomSections: CustomSection[] = [];

export function setRuntimeCustomSections(sections: CustomSection[]): void {
  if (Array.isArray(sections)) {
    _runtimeCustomSections = sections;
  }
}

export function setRuntimeCloudConfig(cfg: {
  appsScriptUrl?: string;
  googleSheetId?: string;
  googleDriveFolderId?: string;
}): void {
  if (cfg.appsScriptUrl && cfg.appsScriptUrl.trim()) {
    _runtimeCloudConfig.appsScriptUrl = stripQuotes(cfg.appsScriptUrl);
  }
  if (cfg.googleSheetId && cfg.googleSheetId.trim()) {
    _runtimeCloudConfig.googleSheetId = stripQuotes(cfg.googleSheetId);
  }
  if (cfg.googleDriveFolderId && cfg.googleDriveFolderId.trim()) {
    _runtimeCloudConfig.googleDriveFolderId = stripQuotes(cfg.googleDriveFolderId);
  }
}

export function getRuntimeCloudConfig() {
  return { ..._runtimeCloudConfig };
}

export const LEGACY_OLD_SHEET_ID = '1wqPXKzzrMJJqfGIyAwEZC1tvWXf28JFS8lUN1YGiFVQ';
export const LEGACY_OLD_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxvsACdMiERlpp03F6zeuBpwU6OE6bJ2u8FA2QsZgcp4n4p38UkIMyIcvwBs37L6rZd/exec';

// Authoritative Pinned Manual Backup / Import-Export Google Sheet Configuration
export const PINNED_GOOGLE_SHEET_ID = '1deoTjgvDflnJBh4B4EGuHN2h_1UiD1VEhssiSS7pDfM';
export const PINNED_GOOGLE_SHEET_GID = '1677268204';
export const LEGACY_DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzZjjn-nyfPa8GYC17GphCV2v5CJSsB-f-YsCFebkLtMWpnxi-0eUq_vTUYXvRkxD_4/exec';
export const PINNED_APPS_SCRIPT_URL = LEGACY_DEFAULT_APPS_SCRIPT_URL;

export function resolveTargetSheetId(customSheetId?: string): string {
  const isUsable = (val?: string | null) => {
    const cleaned = stripQuotes(val || '');
    return (
      Boolean(cleaned) &&
      !cleaned.startsWith('(') &&
      !cleaned.includes('معرف') &&
      !cleaned.includes('الشيت') &&
      cleaned !== LEGACY_OLD_SHEET_ID &&
      cleaned !== '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
    );
  };

  if (isUsable(customSheetId)) return stripQuotes(customSheetId);
  if (isUsable(_runtimeCloudConfig.googleSheetId)) return stripQuotes(_runtimeCloudConfig.googleSheetId);
  return PINNED_GOOGLE_SHEET_ID;
}

export function isValidExecAppsScriptUrl(url?: string | null): boolean {
  if (!url) return false;
  const cleaned = stripQuotes(String(url));
  if (!cleaned || cleaned.startsWith('(') || cleaned.includes('الرابط') || cleaned.includes('ضع')) return false;
  return cleaned.startsWith('https://script.google.com/macros/s/') && cleaned.includes('/exec');
}

export function resolveAppsScriptUrl(customUrl?: string): string {
  const isFreshExecUrl = (url?: string | null) =>
    isValidExecAppsScriptUrl(url) && stripQuotes(url || '') !== LEGACY_OLD_APPS_SCRIPT_URL;

  if (isFreshExecUrl(customUrl)) {
    return stripQuotes(customUrl);
  }
  if (isFreshExecUrl(_runtimeCloudConfig.appsScriptUrl)) {
    return stripQuotes(_runtimeCloudConfig.appsScriptUrl);
  }
  return PINNED_APPS_SCRIPT_URL;
}

/**
 * Reliable, honest Google Apps Script dispatcher:
 * 1) Sends via Vercel/Node server proxy (`/api/sync/state?mode=sheets_proxy`) so CORS & 302 redirects are handled server-side.
 * 2) Verifies the response is genuinely JSON (catches misconfigured SPA rewrites returning HTML).
 * 3) Falls back to direct readable browser fetch (text/plain CORS-simple POST) ONLY if proxy is unavailable.
 * 4) NEVER returns fake `{ success: true }` when both routes fail!
 */
async function postToAppsScriptWithServerProxy(
  resolvedUrl: string,
  payload: Record<string, any>
): Promise<{
  success: boolean;
  via?: 'proxy' | 'direct';
  data?: any;
  error?: string;
  corsBlocked?: boolean;
}> {
  if (!resolvedUrl || !resolvedUrl.startsWith('http')) {
    const errMsg = 'رابط Google Apps Script غير مضبوط. يرجى تعيين VITE_GOOGLE_APPS_SCRIPT_URL في إعدادات Vercel.';
    updateSheetsHealth('error', errMsg);
    return { success: false, error: errMsg };
  }

  let proxyFailureReason = '';

  // Route 1: Server-side proxy (zero CORS issues on Vercel / Node)
  try {
    const proxyRes = await fetch('/api/sync/state?mode=sheets_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'sheets_proxy',
        appsScriptUrl: resolvedUrl,
        method: 'POST',
        payload
      })
    });

    const contentType = proxyRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await proxyRes.json().catch(() => null);
      if (proxyRes.ok && json && json.success !== false) {
        updateSheetsHealth('connected', null);
        return { success: true, via: 'proxy', data: json };
      }
      proxyFailureReason = json?.error || `رفض وكيل المزامنة الطلب (HTTP ${proxyRes.status})`;
    } else {
      proxyFailureReason = `وكيل الخادم (/api/sync/state) أعاد استجابة غير صالحة (${contentType || proxyRes.status}) — تأكد من vercel.json`;
    }
  } catch (err: any) {
    proxyFailureReason = err?.message || 'تعذر الوصول إلى وكيل المزامنة (/api/sync/state)';
  }

  // Route 2: Direct CORS-simple POST (text/plain avoids preflight OPTIONS; Apps Script with "Anyone" returns readable JSON)
  try {
    const directRes = await fetch(resolvedUrl, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const rawText = await directRes.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    if (directRes.ok && parsed && parsed.success !== false) {
      updateSheetsHealth('connected', null);
      return { success: true, via: 'direct', data: parsed };
    }

    const directErr =
      parsed?.error ||
      (rawText.includes('<!DOCTYPE') || rawText.includes('<html')
        ? 'رابط Google Apps Script أعاد صفحة HTML (تحقق من صلاحية النشر: Anyone - أي شخص لديه الرابط، وأعد النشر كإصدار جديد).'
        : `استجابة غير متوقعة من Apps Script (HTTP ${directRes.status})`);

    updateSheetsHealth('error', directErr);
    return { success: false, via: 'direct', error: directErr };
  } catch (directErr: any) {
    const errText = String(directErr?.message || directErr || '');
    const isCors =
      errText.includes('Failed to fetch') ||
      errText.includes('CORS') ||
      errText.includes('NetworkError') ||
      errText.includes('Load failed');

    const fullErr = isCors
      ? `حظر CORS أو انقطاع الشبكة أثناء الاتصال بـ Google Apps Script. (${proxyFailureReason || 'تأكد من نشر السكربت بصلاحية Anyone وتحديث vercel.json'})`
      : `فشل الترحيل إلى Google Sheets: ${errText} (${proxyFailureReason})`;

    updateSheetsHealth('error', fullErr);
    return { success: false, corsBlocked: isCors, error: fullErr };
  }
}

async function getFromAppsScriptWithServerProxy(
  resolvedUrl: string,
  queryAction: string = 'getAllData'
): Promise<{ ok: boolean; via: 'proxy' | 'direct' | 'none'; data?: any; error?: string; corsError?: boolean }> {
  if (!resolvedUrl || !resolvedUrl.startsWith('http')) {
    return { ok: false, via: 'none', error: 'رابط Google Apps Script غير مضبوط.' };
  }

  let proxyErr = '';
  try {
    const proxyRes = await fetch('/api/sync/state?mode=sheets_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'sheets_proxy',
        appsScriptUrl: resolvedUrl,
        method: 'GET',
        queryAction
      })
    });
    const contentType = proxyRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await proxyRes.json().catch(() => null);
      if (proxyRes.ok && json && json.success !== false) {
        updateSheetsHealth('connected', null);
        return { ok: true, via: 'proxy', data: json };
      }
      proxyErr = json?.error || `رفض وكيل المزامنة الطلب (HTTP ${proxyRes.status})`;
    } else {
      proxyErr = `استجابة غير صالحة من وكيل الخادم (${proxyRes.status})`;
    }
  } catch (e: any) {
    proxyErr = e?.message || 'فشل الاتصال بوكيل الخادم';
  }

  try {
    const separator = resolvedUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${resolvedUrl}${separator}action=${encodeURIComponent(queryAction)}&t=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow'
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (res.ok && json) {
      updateSheetsHealth('connected', null);
      return { ok: true, via: 'direct', data: json };
    }
    const errMsg = text.includes('<html')
      ? 'السكربت أعاد صفحة HTML بدل JSON — تأكد من ضبط صلاحية النشر على Anyone.'
      : `فشل قراءة Apps Script (HTTP ${res.status})`;
    updateSheetsHealth('error', errMsg);
    return { ok: false, via: 'direct', error: errMsg };
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    const isCors = msg.includes('Failed to fetch') || msg.includes('CORS') || msg.includes('NetworkError');
    const errMsg = isCors
      ? `حظر CORS عند القراءة المباشرة وفشل وكيل الخادم (${proxyErr})`
      : `${msg} (${proxyErr})`;
    updateSheetsHealth('error', errMsg);
    return { ok: false, via: 'none', corsError: isCors, error: errMsg };
  }
}

/**
 * Live diagnostic check for Apps Script + CORS + Sheet ID
 */
export async function testAppsScriptConnection(customUrl?: string): Promise<AppsScriptPingResult> {
  const url = resolveAppsScriptUrl(customUrl);
  if (!url || !url.startsWith('http')) {
    const err = 'لم يتم تعيين رابط Google Apps Script (VITE_GOOGLE_APPS_SCRIPT_URL).';
    updateSheetsHealth('error', err);
    return { ok: false, via: 'none', error: err };
  }

  const res = await getFromAppsScriptWithServerProxy(url, 'ping');
  if (!res.ok || !res.data) {
    return {
      ok: false,
      via: res.via,
      corsError: res.corsError,
      error: res.error || 'تعذر الاتصال بخادم Google Apps Script.'
    };
  }

  const d = res.data;
  const needsScriptUpdate = !d.version || (!String(d.version).includes('2026.5') && !d.spreadsheetId);
  return {
    ok: true,
    via: res.via,
    status: d.status || 'online',
    spreadsheetName: d.spreadsheetName,
    sheetsCount: d.sheetsCount,
    version: d.version,
    needsScriptUpdate
  };
}

/**
 * Immediately creates & organizes a dedicated Sheet tab and ordered Arabic columns
 * for a newly created or updated Custom Section / Icon (and its Sub-Sections).
 */
export async function registerCustomSectionInGoogleSheets(
  section: CustomSection,
  customUrl?: string,
  _customSheetId?: string
): Promise<{ success: boolean; sheets?: any[]; error?: string }> {
  const url = resolveAppsScriptUrl(customUrl);
  if (!url || !url.startsWith('http')) {
    return { success: false, error: 'رابط Google Apps Script غير مضبوط لإنشاء ورقة القسم الجديد.' };
  }

  const sheetName = buildCustomSectionSheetName(section.title);
  const headers = buildCustomSectionHeaders(section.fields || []);

  const sectionPayload = {
    id: section.id,
    title: section.title,
    sheetName,
    headers,
    isMultiSectionHub: Boolean(section.isMultiSectionHub),
    fields: (section.fields || []).map(f => ({
      id: f.id,
      name: f.name || f.id,
      label: f.label,
      type: f.type
    })),
    subSections: (section.subSections || []).map(sub => ({
      id: sub.id,
      title: sub.title,
      targetBuiltInSection: sub.targetBuiltInSection,
      sheetName: buildCustomSectionSheetName(section.title, sub.title),
      fields: (sub.fields || []).map(f => ({
        id: f.id,
        name: f.name || f.id,
        label: f.label,
        type: f.type
      }))
    }))
  };

  const res = await postToAppsScriptWithServerProxy(url, {
    action: 'registerSection',
    table: 'custom_sections',
    section: sectionPayload,
    timestamp: new Date().toISOString(),
    source: 'al_nashi_custom_section_auto_sheet'
  });

  if (!res.success) {
    return { success: false, error: res.error || 'تعذر إنشاء ورقة القسم الجديد في Google Sheets.' };
  }

  return {
    success: true,
    sheets: res.data?.sheets || [{ sectionId: section.id, sheetName, headers }]
  };
}

/**
 * Syncs ALL custom section schemas with Apps Script so every custom section / icon
 * has an organized, non-destructive Sheet tab in Google Sheets.
 */
export async function syncSchemaToGoogleAppsScript(
  sections: CustomSection[],
  customUrl?: string
): Promise<{ success: boolean; count?: number; error?: string }> {
  const url = resolveAppsScriptUrl(customUrl);
  if (!url || !url.startsWith('http')) {
    return { success: false, error: 'رابط Google Apps Script غير مضبوط.' };
  }

  const normalizedSections = (sections || [])
    .filter(s => s && s.id && s.id !== 'sec_social_welfare')
    .map(section => ({
      id: section.id,
      title: section.title,
      sheetName: buildCustomSectionSheetName(section.title),
      isMultiSectionHub: Boolean(section.isMultiSectionHub),
      fields: (section.fields || []).map(f => ({
        id: f.id,
        name: f.name || f.id,
        label: f.label,
        type: f.type
      })),
      subSections: (section.subSections || []).map(sub => ({
        id: sub.id,
        title: sub.title,
        targetBuiltInSection: sub.targetBuiltInSection,
        sheetName: buildCustomSectionSheetName(section.title, sub.title),
        fields: (sub.fields || []).map(f => ({
          id: f.id,
          name: f.name || f.id,
          label: f.label,
          type: f.type
        }))
      }))
    }));

  if (normalizedSections.length === 0) {
    return { success: true, count: 0 };
  }

  const res = await postToAppsScriptWithServerProxy(url, {
    action: 'syncSchema',
    table: 'custom_sections',
    sections: normalizedSections,
    timestamp: new Date().toISOString(),
    source: 'al_nashi_schema_auto_discovery'
  });

  if (!res.success) {
    return { success: false, error: res.error };
  }
  return { success: true, count: normalizedSections.length };
}

/**
 * Pushes a single record (or custom section definition) immediately to Google Sheets
 * and returns a genuine `RealtimePushResult` reflecting real cloud delivery status.
 */
export async function pushToGoogleSheetsRealtime(
  entityType: RealtimeEntityType,
  data: any,
  action: RealtimeActionType = 'insert',
  appsScriptUrl?: string,
  sheetId?: string,
  options?: { customSections?: CustomSection[]; manual?: boolean }
): Promise<RealtimePushResult> {
  // Architecture Policy: Firebase Firestore (alaa-office-2026) is the SOLE live database.
  // Google Sheets is strictly reserved for explicit manual backup & manual import/export actions.
  if (!options?.manual) {
    return { success: true, via: 'skipped' };
  }

  const resolvedSheetId = resolveTargetSheetId(sheetId);
  const resolvedUrl = resolveAppsScriptUrl(appsScriptUrl);
  const timestamp = new Date().toISOString();

  // Skip purely local/non-sheet metadata entities
  if (entityType === 'settings' || entityType === 'dropdowns' || entityType === 'drive_archive') {
    return { success: true, via: 'skipped' };
  }

  // Handle Custom Section creation/update -> auto-create dedicated Google Sheet tab!
  if (entityType === 'custom_sections') {
    if (action === 'delete') {
      // Non-destructive policy: deleting a UI section tile NEVER deletes its historical Google Sheet data
      return { success: true, via: 'skipped' };
    }
    const reg = await registerCustomSectionInGoogleSheets(data as CustomSection, resolvedUrl, resolvedSheetId);
    return {
      success: reg.success,
      via: reg.success ? 'proxy' : undefined,
      sheet: reg.sheets?.[0]?.sheetName,
      error: reg.error
    };
  }

  const targetId =
    data?.id ||
    data?.User_ID ||
    data?.Citizen_ID ||
    data?.Request_ID ||
    data?.Interview_ID ||
    data?.Letter_ID ||
    (typeof data === 'string' ? data : '');

  let oauthRestOk = false;

  // 1. Optional Direct Google Sheets REST API sync if OAuth token is active
  const isCoreRestEntity =
    entityType === 'citizens' ||
    entityType === 'requests' ||
    entityType === 'interviews' ||
    entityType === 'organization' ||
    entityType === 'letters' ||
    entityType === 'cheques' ||
    entityType === 'users';
  if (resolvedSheetId && isCoreRestEntity) {
    const coreEntityType = entityType as 'citizens' | 'requests' | 'interviews' | 'organization' | 'letters' | 'cheques' | 'users';
    try {
      const token = await getAccessToken();
      if (token && !token.startsWith('ya29.al_nashi_session_') && !token.startsWith('ya29.al_nashi_dev_session_')) {
        if (action === 'delete') {
          if (targetId) {
            oauthRestOk = await deleteRecordFromSheetsRealtime(token, resolvedSheetId, coreEntityType, targetId);
          }
        } else {
          oauthRestOk = await pushSingleRecordToSheetsRealtime(token, resolvedSheetId, coreEntityType, data);
        }
      }
    } catch {
      oauthRestOk = false;
    }
  }

  // 2. Primary Webhook / Apps Script Web App sync
  if (!resolvedUrl || !resolvedUrl.startsWith('http')) {
    if (oauthRestOk) {
      updateSheetsHealth('connected', null);
      return { success: true, via: 'oauth_rest' };
    }
    const errMsg = 'رابط Google Apps Script غير مضبوط (VITE_GOOGLE_APPS_SCRIPT_URL).';
    updateSheetsHealth('error', errMsg);
    return { success: false, error: errMsg };
  }

  const sanitizeFlatPayload = (obj: any): Record<string, string> => {
    if (!obj || typeof obj !== 'object') return {};
    const out: Record<string, string> = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === null || v === undefined || typeof v === 'object') continue;
      const cleaned = cleanSheetCell(v);
      if (cleaned !== '' || k === 'id') {
        out[k] = cleaned;
      }
    }
    return out;
  };

  let extraWebhookMeta: Record<string, any> = {};
  let cleanWebhookData: any;

  if (action === 'delete') {
    cleanWebhookData = data;
    if (entityType === 'custom_records' && data && typeof data === 'object') {
      const activeSections = options?.customSections || _runtimeCustomSections;
      const resolvedCustom = toCleanCustomSectionRecordPayload(data, activeSections);
      extraWebhookMeta = {
        sectionId: resolvedCustom.sectionId,
        sheetName: resolvedCustom.sheetName,
        sectionTitle: resolvedCustom.title
      };
    }
  } else if (entityType === 'custom_records') {
    const activeSections = options?.customSections || _runtimeCustomSections;
    const resolvedCustom = toCleanCustomSectionRecordPayload(data, activeSections);
    cleanWebhookData = resolvedCustom.payload;
    extraWebhookMeta = {
      sectionId: resolvedCustom.sectionId,
      sheetName: resolvedCustom.sheetName,
      sectionTitle: resolvedCustom.title,
      sectionColumns: resolvedCustom.columns
    };
  } else {
    cleanWebhookData =
      entityType === 'citizens'
        ? toCleanSheetCitizenPayload(data)
        : entityType === 'requests'
        ? toCleanSheetRequestPayload(data)
        : entityType === 'interviews'
        ? toCleanSheetInterviewPayload(data)
        : entityType === 'organization'
        ? toCleanSheetOrganizationPayload(data)
        : entityType === 'letters'
        ? toCleanSheetLetterPayload(data)
        : entityType === 'cheques'
        ? toCleanSheetChequePayload(data)
        : entityType === 'users'
        ? toCleanSheetUserPayload(data)
        : sanitizeFlatPayload(data);
  }

  const res = await postToAppsScriptWithServerProxy(resolvedUrl, {
    action: action === 'delete' ? 'delete' : action === 'insert' ? 'appendRow' : 'updateRow',
    table: entityType,
    sheetType: entityType,
    id: targetId,
    Citizen_ID: targetId,
    Request_ID: targetId,
    ...extraWebhookMeta,
    data: cleanWebhookData,
    record: cleanWebhookData,
    timestamp,
    source: 'al_nashi_office_system'
  });

  if (res.success) {
    return {
      success: true,
      via: res.via,
      sheet: res.data?.sheet || extraWebhookMeta.sheetName
    };
  }

  if (oauthRestOk) {
    updateSheetsHealth('connected', null);
    return { success: true, via: 'oauth_rest' };
  }

  return {
    success: false,
    corsBlocked: res.corsBlocked,
    error: res.error || 'فشل إرسال السجل إلى Google Sheets عبر Apps Script.'
  };
}

/**
 * Chunked non-destructive bulk push to Google Sheets (supports Apps Script Web App & Direct Google Sheets REST API).
 */
export async function pushBulkDataToGoogleSheets(
  citizensList: Citizen[],
  requestsList: OfficeRequest[],
  customAppsScriptUrl?: string,
  customSheetId?: string,
  extraCollections?: {
    interviews?: Interview[];
    officialLetters?: OfficialLetter[];
    cheques?: ChequeRecord[];
    organizationRecords?: OrganizationRecord[];
    customSections?: CustomSection[];
    customRecords?: CustomSectionRecord[];
    users?: User[];
  }
): Promise<{ appsScriptSent: boolean; directSheetsSent: boolean; chunksSent: number; error?: string }> {
  const resolvedUrl = resolveAppsScriptUrl(customAppsScriptUrl);
  const resolvedSheetId = resolveTargetSheetId(customSheetId);
  let appsScriptSent = false;
  let directSheetsSent = false;
  let chunksSent = 0;
  let lastError: string | undefined;

  const cleanCitizens = (citizensList || []).map(c => toCleanSheetCitizenPayload(c));
  const cleanRequests = (requestsList || []).map(r => toCleanSheetRequestPayload(r));
  const cleanInterviews = (extraCollections?.interviews || []).map(i => toCleanSheetInterviewPayload(i));
  const cleanLetters = (extraCollections?.officialLetters || []).map(l => toCleanSheetLetterPayload(l));
  const cleanCheques = (extraCollections?.cheques || []).map(ch => toCleanSheetChequePayload(ch));
  const cleanOrgs = (extraCollections?.organizationRecords || []).map(o => toCleanSheetOrganizationPayload(o));
  const cleanUsers = (extraCollections?.users || []).map(u => toCleanSheetUserPayload(u));
  const activeSections = extraCollections?.customSections || _runtimeCustomSections;
  const cleanCustomRecords = (extraCollections?.customRecords || []).map(rec => {
    const resolved = toCleanCustomSectionRecordPayload(rec, activeSections);
    return {
      sectionId: resolved.sectionId,
      sheetName: resolved.sheetName,
      sectionTitle: resolved.title,
      sectionColumns: resolved.columns,
      payload: resolved.payload,
      ...resolved.payload
    };
  });

  const hasAnyPayload =
    cleanCitizens.length > 0 ||
    cleanRequests.length > 0 ||
    cleanInterviews.length > 0 ||
    cleanLetters.length > 0 ||
    cleanCheques.length > 0 ||
    cleanOrgs.length > 0 ||
    cleanCustomRecords.length > 0 ||
    cleanUsers.length > 0;

  // 1. Push in chunks of 80 rows to Google Apps Script Web App (non-destructive gap-filling bulk_sync!)
  if (resolvedUrl && resolvedUrl.startsWith('http') && hasAnyPayload) {
    const CHUNK = 80;
    const maxLen = Math.max(
      cleanCitizens.length,
      cleanRequests.length,
      cleanInterviews.length,
      cleanLetters.length,
      cleanCheques.length,
      cleanOrgs.length,
      cleanCustomRecords.length,
      cleanUsers.length
    );
    for (let i = 0; i < maxLen; i += CHUNK) {
      const citSlice = cleanCitizens.slice(i, i + CHUNK);
      const reqSlice = cleanRequests.slice(i, i + CHUNK);
      const intSlice = cleanInterviews.slice(i, i + CHUNK);
      const letSlice = cleanLetters.slice(i, i + CHUNK);
      const chqSlice = cleanCheques.slice(i, i + CHUNK);
      const orgSlice = cleanOrgs.slice(i, i + CHUNK);
      const cusSlice = cleanCustomRecords.slice(i, i + CHUNK);
      const usrSlice = cleanUsers.slice(i, i + CHUNK);
      if (
        citSlice.length === 0 &&
        reqSlice.length === 0 &&
        intSlice.length === 0 &&
        letSlice.length === 0 &&
        chqSlice.length === 0 &&
        orgSlice.length === 0 &&
        cusSlice.length === 0 &&
        usrSlice.length === 0
      ) {
        continue;
      }
      const res = await postToAppsScriptWithServerProxy(resolvedUrl, {
        action: 'bulk_sync',
        spreadsheetId: resolvedSheetId,
        sheetGid: PINNED_GOOGLE_SHEET_GID,
        customSections: i === 0 ? activeSections : undefined,
        data: {
          citizens: citSlice,
          requests: reqSlice,
          interviews: intSlice,
          officialLetters: letSlice,
          cheques: chqSlice,
          organizationRecords: orgSlice,
          customRecords: cusSlice,
          users: usrSlice
        },
        timestamp: new Date().toISOString(),
        source: 'al_nashi_manual_backup'
      });
      if (res.success) {
        appsScriptSent = true;
        chunksSent++;
      } else {
        lastError = res.error;
      }
      if (i + CHUNK < maxLen) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    if (!appsScriptSent && lastError) {
      pushCloudSyncAlert({
        severity: 'error',
        target: 'google_sheets',
        title: 'فشل إرسال البيانات إلى Google Sheets',
        message: 'تعذر ترحيل الدفعة إلى رابط Google Apps Script (/exec).',
        details: lastError
      });
    }
  }

  // 2. Optional direct Google Sheets REST API append
  if (resolvedSheetId && (citizensList.length > 0 || requestsList.length > 0)) {
    try {
      const token = await getAccessToken();
      if (token && !token.startsWith('ya29.al_nashi_session_') && !token.startsWith('ya29.al_nashi_dev_session_')) {
        if (citizensList.length > 0) {
          const citRows = citizensList.map(c => citizenToSheetRow(c));
          const encCitRange = encodeURIComponent(`${CITIZENS_SHEET_NAME}!A1`);
          const resCit = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSheetId}/values/${encCitRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ values: citRows })
            }
          );
          if (resCit.ok) directSheetsSent = true;
        }
        if (requestsList.length > 0) {
          const reqRows = requestsList.map(r => requestToSheetRow(r));
          const encReqRange = encodeURIComponent(`${REQUESTS_SHEET_NAME}!A1`);
          const resReq = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${resolvedSheetId}/values/${encReqRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ values: reqRows })
            }
          );
          if (resReq.ok) directSheetsSent = true;
        }
      }
    } catch (err: any) {
      lastError = lastError || err?.message;
    }
  }

  return { appsScriptSent, directSheetsSent, chunksSent, error: lastError };
}

/**
 * One-click NON-DESTRUCTIVE Google Sheets column cleanup & reorganization (preserves all records & custom section sheets!).
 */
export async function reorganizeGoogleSheetsNow(params: {
  appsScriptUrl?: string;
  sheetId?: string;
  citizens: Citizen[];
  requests: OfficeRequest[];
  interviews?: Interview[];
  organizationRecords?: OrganizationRecord[];
  officialLetters?: OfficialLetter[];
  cheques?: ChequeRecord[];
  customSections?: CustomSection[];
  customRecords?: CustomSectionRecord[];
  users?: User[];
  auditLogs?: any[];
}): Promise<{ success: boolean; message: string; needsScriptUpdate?: boolean }> {
  const resolvedUrl = resolveAppsScriptUrl(params.appsScriptUrl);
  const resolvedSheetId = resolveTargetSheetId(params.sheetId);
  let directDone = false;
  let scriptDone = false;
  let needsScriptUpdate = false;
  let lastErr = '';

  const activeSections = params.customSections || _runtimeCustomSections;

  // 1. Direct Google Sheets API non-destructive merge (if Google OAuth token is active)
  if (resolvedSheetId) {
    try {
      const token = await getAccessToken();
      if (token && !token.startsWith('ya29.al_nashi_session_') && !token.startsWith('ya29.al_nashi_dev_session_')) {
        const res = await syncAllDataToGoogleSheets(token, resolvedSheetId, {
          citizens: params.citizens || [],
          requests: params.requests || [],
          interviews: params.interviews || [],
          organizationRecords: params.organizationRecords || [],
          officialLetters: params.officialLetters || [],
          cheques: params.cheques || [],
          customRecords: params.customRecords || [],
          users: params.users || [],
          auditLogs: params.auditLogs || []
        });
        if (res.success) directDone = true;
      }
    } catch (err: any) {
      lastErr = err?.message || 'فشل الترتيب عبر واجهة Google Sheets المباشرة';
    }
  }

  // 2. Apps Script non-destructive organization + dynamic custom sections registration & sync
  if (resolvedUrl && resolvedUrl.startsWith('http')) {
    const cleanInterviews = (params.interviews || []).map(i => toCleanSheetInterviewPayload(i));
    const cleanOrg = (params.organizationRecords || []).map(o => toCleanSheetOrganizationPayload(o));
    const cleanLetters = (params.officialLetters || []).map(l => toCleanSheetLetterPayload(l));
    const cleanCheques = (params.cheques || []).map(ch => toCleanSheetChequePayload(ch));
    const cleanUsers = (params.users || []).map(u => toCleanSheetUserPayload(u));

    // Prepare both built-in Social Care records and dynamic Custom Section records
    const preparedCustomRecords = (params.customRecords || []).map(r => {
      if (!r.sectionId || r.sectionId === 'sec_social_welfare') {
        return { ...toCleanSheetSocialCarePayload(r), sectionId: 'sec_social_welfare' };
      }
      const resolved = toCleanCustomSectionRecordPayload(r, activeSections);
      return {
        sectionId: resolved.sectionId,
        sheetName: resolved.sheetName,
        sectionTitle: resolved.title,
        sectionColumns: resolved.columns,
        payload: resolved.payload
      };
    });

    const bulkRes = await postToAppsScriptWithServerProxy(resolvedUrl, {
      action: 'bulk_sync',
      cleanupDuplicates: true,
      data: {
        customSections: activeSections.filter(s => s.id !== 'sec_social_welfare'),
        interviews: cleanInterviews,
        organizationRecords: cleanOrg,
        officialLetters: cleanLetters,
        cheques: cleanCheques,
        customRecords: preparedCustomRecords,
        users: cleanUsers
      },
      timestamp: new Date().toISOString()
    });

    if (!bulkRes.success) {
      lastErr = bulkRes.error || lastErr;
    } else {
      scriptDone = true;
    }

    // Push citizens & requests in chunks of 80
    const bulkCitReq = await pushBulkDataToGoogleSheets(
      params.citizens || [],
      params.requests || [],
      resolvedUrl,
      resolvedSheetId
    );
    if (bulkCitReq.error) {
      lastErr = bulkCitReq.error;
    }

    // Trigger reorganizeSheets
    const reorgRes = await getFromAppsScriptWithServerProxy(resolvedUrl, 'reorganizeSheets');
    if (reorgRes.ok && reorgRes.data) {
      scriptDone = true;
      if (reorgRes.data.status === 'online' && !reorgRes.data.schemaVersion && !reorgRes.data.details) {
        needsScriptUpdate = true;
      }
    } else {
      const postReorg = await postToAppsScriptWithServerProxy(resolvedUrl, {
        action: 'reorganizeSheets',
        timestamp: new Date().toISOString()
      });
      if (postReorg.success) {
        scriptDone = true;
      } else {
        lastErr = postReorg.error || lastErr;
      }
    }
  }

  if (needsScriptUpdate && !directDone) {
    return {
      success: true,
      needsScriptUpdate: true,
      message: 'تم إرسال السجلات إلى Google Sheets، لكن نسخة كود Apps Script قديمة. يرجى نسخ الكود المحدث أدناه ولصقه في Apps Script ثم النشر كإصدار جديد (New Version).'
    };
  }

  if (directDone || scriptDone) {
    return {
      success: true,
      message: 'تم ترتيب وتوحيد قاعدة بيانات Google Sheets غير تدميرياً بنجاح (أوراق الأقسام الرئيسية + أوراق الأقسام المخصصة بأعمدة عربية مرتبة) دون حذف أو مسح أي سجل!'
    };
  }

  return {
    success: false,
    message: lastErr || 'تعذر الاتصال بـ Google Sheets لتنفيذ الترتيب. يرجى فحص رابط Apps Script ومتغيرات البيئة في Vercel.'
  };
}

/**
 * Wipe all sheets or specific selected sections in Google Sheets via Apps Script,
 * strictly preserving Row 1 headers and user accounts (unless explicitly included).
 */
export async function wipeGoogleSheetsViaAppsScript(
  mode: 'all' | 'sections',
  sections?: string[],
  customAppsScriptUrl?: string
): Promise<{ success: boolean; message: string; clearedSheets?: string[]; error?: string }> {
  const resolvedUrl = resolveAppsScriptUrl(customAppsScriptUrl);
  if (!resolvedUrl || !resolvedUrl.startsWith('http')) {
    return {
      success: false,
      message: 'رابط Google Apps Script غير مضبوط (VITE_GOOGLE_APPS_SCRIPT_URL).',
      error: 'missing_apps_script_url'
    };
  }

  const expandedTargets: string[] = [];
  if (mode === 'sections' && Array.isArray(sections)) {
    for (const rawKey of sections) {
      const key = String(rawKey || '').trim();
      if (!key) continue;
      expandedTargets.push(key);
      if (key === 'sec_social_welfare') {
        expandedTargets.push('قسم_الرعاية_الاجتماعية');
      } else {
        const matchedCustom = _runtimeCustomSections.find(
          s => s.id === key || s.title === key
        );
        if (matchedCustom) {
          expandedTargets.push(buildCustomSectionSheetName(matchedCustom.title));
          if (Array.isArray(matchedCustom.subSections)) {
            for (const sub of matchedCustom.subSections) {
              if (sub?.title) {
                expandedTargets.push(buildCustomSectionSheetName(matchedCustom.title, sub.title));
              }
            }
          }
        }
      }
    }
  }

  const uniqueTargets = Array.from(new Set(expandedTargets));
  const res = await postToAppsScriptWithServerProxy(resolvedUrl, {
    action: mode === 'all' ? 'wipeAll' : 'wipeSections',
    sections: mode === 'sections' ? uniqueTargets : undefined,
    includeUsers: false,
    timestamp: new Date().toISOString(),
    source: 'al_nashi_office_system'
  });

  if (res.success) {
    const clearedSheets = Array.isArray(res.data?.clearedSheets) ? res.data.clearedSheets : [];
    return {
      success: true,
      clearedSheets,
      message:
        res.data?.message ||
        (mode === 'all'
          ? 'تم تصفير أوراق Google Sheets بالكامل مع الإبقاء على صف العناوين.'
          : `تم تصفير (${uniqueTargets.length}) قسم محدد في Google Sheets مع الإبقاء على صف العناوين.`)
    };
  }

  return {
    success: false,
    message: res.error || 'تعذر تنفيذ التصفير التلقائي في Google Sheets.',
    error: res.error
  };
}

/**
 * Pull all data from Google Apps Script Web App (proxied via server on Vercel to avoid CORS redirects)
 */
export async function pullDataFromGoogleAppsScript(appsScriptUrl: string): Promise<{
  success: boolean;
  message?: string;
  needsScriptUpdate?: boolean;
  error?: string;
  data?: {
    citizens: Citizen[];
    requests: OfficeRequest[];
    interviews: Interview[];
    officialLetters: OfficialLetter[];
    organizationRecords: OrganizationRecord[];
    cheques: ChequeRecord[];
    customRecords?: CustomSectionRecord[];
    users?: User[];
  };
} | null> {
  const cleanUrl = resolveAppsScriptUrl(appsScriptUrl);
  if (!cleanUrl || !cleanUrl.startsWith('http')) return null;

  try {
    const fetchResult = await getFromAppsScriptWithServerProxy(cleanUrl, 'getAllData');
    if (!fetchResult.ok || !fetchResult.data) {
      const errMsg = fetchResult.error || 'تعذر جلب البيانات من Google Apps Script.';
      pushCloudSyncAlert({
        severity: 'error',
        target: 'google_sheets',
        title: 'فشل جلب البيانات من Google Sheets',
        message: 'حدث خطأ أثناء الاتصال برابط Google Apps Script (/exec).',
        details: errMsg
      });
      return {
        success: false,
        error: errMsg,
        message: errMsg
      };
    }

    const json = fetchResult.data;

    if (json.status === 'online' && !json.data && !json.citizens) {
      return {
        success: false,
        needsScriptUpdate: true,
        message: `الجدول المتصل (${json.spreadsheetName || 'Google Sheets'}) يحتوي حالياً على (${json.sheetsCount || 0}) ورقة ويعمل بنسخة سكربت قديمة. انسخ كود السكربت المحدث لتفعيل المزامنة الكاملة.`
      };
    }

    const sourceData = json.data || json;

    const isTruthyArchive = (val: any): boolean => {
      if (val === true || val === 1) return true;
      const s = String(val || '').trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes' || s === 'نعم' || s === 'مؤرشف' || s === 'مؤرشفة' || s === 'archived';
    };

    const citizens: Citizen[] = (sourceData.citizens || []).map((c: any) => {
      const blockStr = String(c.IsBlocked || c['حالة الحظر'] || '').trim();
      const isBlocked = c.IsBlocked === true || blockStr.startsWith('محظور') || blockStr === 'نعم';
      const blockReason = blockStr.includes(' - ') ? blockStr.split(' - ').slice(1).join(' - ').trim() : c.BlockReason;
      const dynamicExtras = c.CustomFields && typeof c.CustomFields === 'object' ? c.CustomFields : undefined;
      const firstName = String(c.FirstName || c['الاسم الأول'] || '').trim();
      const fatherName = String(c.FatherName || c['اسم الأب'] || '').trim();
      const grandFatherName = String(c.GrandFatherName || c['اسم الجد'] || '').trim();
      const surname = String(c.Surname || c['اللقب / العشيرة'] || '').trim();
      const rawFullName = String(c.FullName || c['الاسم الكامل'] || c.CitizenName || '').trim();
      const fullName = rawFullName || [firstName, fatherName, grandFatherName, surname].filter(Boolean).join(' ').trim();
      const isArchived =
        isTruthyArchive(c.IsArchived) ||
        isTruthyArchive(c.archived) ||
        isTruthyArchive(c['الأرشفة']) ||
        isTruthyArchive(c['حالة الأرشفة']) ||
        isTruthyArchive(dynamicExtras?.archived) ||
        isTruthyArchive(dynamicExtras?.['الأرشفة']) ||
        Boolean(c.ArchiveCode && String(c.ArchiveCode).trim());
      const isHistoricalImported = isTruthyArchive(c.IsHistoricalImported);
      return {
        ...(dynamicExtras ? { CustomFields: dynamicExtras } : {}),
        Citizen_ID: String(c.Citizen_ID || c['الرقم التعريفي'] || c.id || '').trim(),
        FirstName: firstName,
        FatherName: fatherName,
        GrandFatherName: grandFatherName,
        GreatGrandFatherName: String(c.GreatGrandFatherName || '').trim(),
        Surname: surname,
        FullName: fullName,
        Phone1: String(c.Phone1 || c.Phone || c['رقم الهاتف'] || '').trim(),
        Phone2: String(c.Phone2 || c['الهاتف البديل'] || '').trim(),
        Gender: (c.Gender || c['الجنس']) === 'أنثى' ? 'أنثى' : 'ذكر',
        Job: String(c.Job || c['المهنة / العمل'] || '').trim(),
        Education: String(c.Education || c['التحصيل الدراسي'] || '').trim(),
        Rating: String(c.Rating || c['التقييم'] || 'لائق'),
        District: String(c.District || c['القضاء'] || '').trim(),
        SubDistrict: String(c.SubDistrict || c.Subdistrict || c.ResidentialArea || c['الناحية / المنطقة'] || '').trim(),
        ReferralSource: String(c.ReferralSource || c['المعرف / التزكية'] || '').trim(),
        IsBlocked: isBlocked,
        ...(blockReason ? { BlockReason: String(blockReason) } : {}),
        ...(isArchived ? { IsArchived: true } : {}),
        ...(isHistoricalImported ? { IsHistoricalImported: true } : {}),
        ...(c.ArchivedAt ? { ArchivedAt: String(c.ArchivedAt).trim() } : {}),
        ...(c.ArchiveCode ? { ArchiveCode: String(c.ArchiveCode).trim() } : {}),
        CreatedAt: String(c.CreatedAt || c['تاريخ التسجيل'] || new Date().toISOString().split('T')[0]).trim(),
        CreatedBy: String(c.CreatedBy || c['الموظف المسؤول'] || 'Google Sheets').trim(),
        PhotoUrl: c.PhotoUrl ? String(c.PhotoUrl).trim() : undefined
      };
    });

    const requests: OfficeRequest[] = (sourceData.requests || []).map((r: any) => {
      const rawDelivery = r.DeliveryStatus || r['حالة الاستلام'] || '';
      const rawProc = r.ProcessingStatus || r['حالة الإنجاز'] || 'قيد التدقيق';
      const dynamicExtras = r.CustomFields && typeof r.CustomFields === 'object' ? r.CustomFields : undefined;
      const rawDecision = String(r.DirectorDecision || r['قرار المدير'] || r['توجيه المدير'] || '').trim();
      const directorDecision =
        rawDecision === 'خاص' || rawDecision === 'عام' || rawDecision === 'رفض' || rawDecision === 'مؤرشف'
          ? (rawDecision as OfficeRequest['DirectorDecision'])
          : undefined;
      const directorNotes = String(r.DirectorNotes || r['ملاحظات المدير'] || '').trim();
      const directorDecisionDate = String(r.DirectorDecisionDate || r['تاريخ قرار المدير'] || '').trim();
      const directorDecisionBy = String(r.DirectorDecisionBy || r['بواسطة المدير'] || '').trim();
      const currentStage = String(r.CurrentStage || r['المرحلة الحالية'] || '').trim();
      const registeredVia = String(r.RegisteredVia || r['مصدر التسجيل'] || '').trim();
      const receptionNotes = String(r.ReceptionNotes || r['ملاحظات الاستعلامات'] || '').trim();
      const rejectionReason = String(r.RejectionReason || r['سبب الرفض'] || '').trim();
      const isArchived =
        isTruthyArchive(r.IsArchived) ||
        isTruthyArchive(r.archived) ||
        isTruthyArchive(r['الأرشفة']) ||
        isTruthyArchive(r['حالة الأرشفة']) ||
        isTruthyArchive(dynamicExtras?.archived) ||
        isTruthyArchive(dynamicExtras?.['الأرشفة']) ||
        directorDecision === 'مؤرشف' ||
        Boolean(r.ArchiveCode && String(r.ArchiveCode).trim());
      const rawDirect = r.IsDirectInstantRequest;
      const isDirectInstant = rawDirect === true || rawDirect === 'true' || rawDirect === 'نعم';

      return {
        ...(dynamicExtras ? { CustomFields: dynamicExtras } : {}),
        Request_ID: String(r.Request_ID || r['رقم الطلب'] || r.id || '').trim(),
        Citizen_ID: String(r.Citizen_ID || r['الرقم التعريفي للمواطن'] || '').trim(),
        CitizenName: String(r.CitizenName || r['اسم صاحب الطلب'] || r.FullName || '').trim(),
        CitizenPhone: String(r.CitizenPhone || r['رقم الهاتف'] || r.Phone1 || '').trim(),
        Entity: String(r.Entity || r['الوزارة / الجهة'] || '').trim(),
        RequestStatus: (r.RequestStatus || rawDelivery || 'غير مستلم') as any,
        ProcessingStatus: (rawProc as any) || 'قيد التدقيق',
        DeliveryStatus: rawDelivery === 'مستلم' ? 'مستلم' : rawDelivery === 'غير مستلم' ? 'غير مستلم' : undefined,
        Priority: (r.Priority || r['الأسبقية'] || 'عام') as any,
        Details: String(r.Details || r['الموضوع / تفاصيل الطلب'] || '').trim(),
        OutgoingNumber: (r.OutgoingNumber || r['العدد / الصادر']) ? String(r.OutgoingNumber || r['العدد / الصادر']).trim() : undefined,
        OutgoingDate: (r.OutgoingDate || r['تاريخ الصادر']) ? String(r.OutgoingDate || r['تاريخ الصادر']).trim() : undefined,
        Address: (r.Address || r['العنوان / السكن']) ? String(r.Address || r['العنوان / السكن']).trim() : undefined,
        ResidentialArea: r.ResidentialArea ? String(r.ResidentialArea).trim() : undefined,
        ReferralSource: (r.ReferralSource || r['المعرف / التزكية']) ? String(r.ReferralSource || r['المعرف / التزكية']).trim() : undefined,
        Margin: (r.Margin || r['الهامش / التوجيه']) ? String(r.Margin || r['الهامش / التوجيه']).trim() : undefined,
        Education: (r.Education || r['التحصيل الدراسي']) ? String(r.Education || r['التحصيل الدراسي']).trim() : undefined,
        Job: (r.Job || r['المهنة']) ? String(r.Job || r['المهنة']).trim() : undefined,
        TargetDepartment: (r.TargetDepartment || r['القسم المختص']) ? String(r.TargetDepartment || r['القسم المختص']).trim() : undefined,
        SerialNumber: r.SerialNumber ? String(r.SerialNumber).trim() : undefined,
        OtherNotes: (r.OtherNotes || r['الملاحظات']) ? String(r.OtherNotes || r['الملاحظات']).trim() : undefined,
        AttachmentRequest: r.AttachmentRequest || undefined,
        AttachmentResponse: r.AttachmentResponse || undefined,
        DeputyNotes: String(r.DeputyNotes || r['الهامش / التوجيه'] || '').trim(),
        ...(directorDecision ? { DirectorDecision: directorDecision } : {}),
        ...(directorNotes ? { DirectorNotes: directorNotes } : {}),
        ...(directorDecisionDate ? { DirectorDecisionDate: directorDecisionDate } : {}),
        ...(directorDecisionBy ? { DirectorDecisionBy: directorDecisionBy } : {}),
        ...(currentStage ? { CurrentStage: currentStage as OfficeRequest['CurrentStage'] } : {}),
        ...(registeredVia ? { RegisteredVia: registeredVia as OfficeRequest['RegisteredVia'] } : {}),
        ...(receptionNotes ? { ReceptionNotes: receptionNotes } : {}),
        ...(rejectionReason ? { RejectionReason: rejectionReason } : {}),
        ...(isArchived ? { IsArchived: true } : {}),
        ...(r.ArchivedAt ? { ArchivedAt: String(r.ArchivedAt).trim() } : {}),
        ...(r.ArchiveCode ? { ArchiveCode: String(r.ArchiveCode).trim() } : {}),
        ...(isDirectInstant ? { IsDirectInstantRequest: true } : {}),
        ...(r.AttendanceType ? { AttendanceType: String(r.AttendanceType).trim() as OfficeRequest['AttendanceType'] } : {}),
        ...(r.DependencyStatus ? { DependencyStatus: String(r.DependencyStatus).trim() as OfficeRequest['DependencyStatus'] } : {}),
        ...(r.ProxyName ? { ProxyName: String(r.ProxyName).trim() } : {}),
        ...(r.ProxyPhone ? { ProxyPhone: String(r.ProxyPhone).trim() } : {}),
        ...(r.ProxyAddress ? { ProxyAddress: String(r.ProxyAddress).trim() } : {}),
        IsHistoricalImported: isTruthyArchive(r.IsHistoricalImported),
        CreatedAt: String(r.CreatedAt || r['تاريخ التسجيل'] || new Date().toISOString().split('T')[0]).trim(),
        CreatedBy: String(r.CreatedBy || r['الموظف المسؤول'] || 'Google Sheets').trim(),
        UpdatedAt: r.UpdatedAt ? String(r.UpdatedAt).trim() : undefined
      };
    });

    const interviews: Interview[] = (sourceData.interviews || []).map((i: any) => ({
      ...(i.CustomFields && typeof i.CustomFields === 'object' ? { CustomFields: i.CustomFields } : {}),
      Interview_ID: String(i.Interview_ID || i['رمز المقابلة'] || i.id || '').trim(),
      Citizen_ID: String(i.Citizen_ID || i['الرقم التعريفي للمواطن'] || '').trim(),
      FullName: String(i.FullName || i['اسم المواطن'] || i.CitizenName || '').trim(),
      Subject: String(i.Subject || i['موضوع المقابلة'] || '').trim(),
      Phone1: String(i.Phone1 || i['رقم الهاتف'] || '').trim(),
      Phone2: String(i.Phone2 || '').trim(),
      Address: String(i.Address || i['العنوان / السكن'] || '').trim(),
      Referrer: String(i.Referrer || i['المعرف / التزكية'] || '').trim(),
      InterviewDate: String(i.InterviewDate || i['تاريخ المقابلة'] || i.Date || '').trim(),
      InterviewTime: String(i.InterviewTime || '').trim(),
      Priority: (i.Priority || i['الأسبقية'] || 'متوسط') as any,
      Status: (i.Status || i['حالة المقابلة'] || 'مكتملة') as any,
      DeputyNotes: String(i.DeputyNotes || i['توجيه النائب'] || '').trim(),
      Outcome: String(i.Outcome || i['النتيجة والإجراء'] || '').trim(),
      ConvertedToRequest: i.ConvertedToRequest === true || i.ConvertedToRequest === 'نعم'
    }));

    const officialLetters: OfficialLetter[] = (sourceData.officialLetters || sourceData.letters || []).map((l: any) => ({
      ...(l.CustomFields && typeof l.CustomFields === 'object' ? { CustomFields: l.CustomFields } : {}),
      Letter_ID: String(l.Letter_ID || l['رمز الكتاب'] || l.id || '').trim(),
      LetterNumber: String(l.LetterNumber || l['العدد / الصادر'] || l.Letter_Number || '').trim(),
      LetterDate: String(l.LetterDate || l['تاريخ الكتاب'] || l.Letter_Date || '').trim(),
      Recipient: String(l.Recipient || l['الجهة الموجه إليها'] || l.To_Entity || '').trim(),
      Subject: String(l.Subject || l['الموضوع'] || '').trim(),
      Body: String(l.Body || l['نص الكتاب'] || '').trim(),
      Citizen_ID: l.Citizen_ID ? String(l.Citizen_ID).trim() : undefined,
      CitizenName: (l.CitizenName || l['اسم المواطن']) ? String(l.CitizenName || l['اسم المواطن']).trim() : undefined,
      Status: (l.Status || l['حالة الكتاب'] || 'صادر') as any,
      ClerkName: String(l.ClerkName || l['الموظف المنشئ'] || '').trim()
    }));

    const cheques: ChequeRecord[] = (sourceData.cheques || []).map((ch: any) => ({
      ...(ch.CustomFields && typeof ch.CustomFields === 'object' ? { CustomFields: ch.CustomFields } : {}),
      id: String(ch.id || ch['معرف الصك'] || ch.Cheque_ID || '').trim(),
      ChequeNumber: String(ch.ChequeNumber || ch['رقم الصك'] || '').trim(),
      Citizen_ID: String(ch.Citizen_ID || ch['الرقم التعريفي للمواطن'] || '').trim(),
      CitizenName: String(ch.CitizenName || ch['اسم المستفيد'] || '').trim(),
      CitizenPhone: String(ch.CitizenPhone || ch['رقم الهاتف'] || '').trim(),
      Amount: Number(ch.Amount || ch['المبلغ (د.ع)']) || 0,
      AmountInWords: String(ch.AmountInWords || '').trim(),
      BankName: String(ch.BankName || ch['المصرف / الصندوق'] || '').trim(),
      Purpose: String(ch.Purpose || ch['الغرض من الصرف'] || '').trim(),
      IssueDate: String(ch.IssueDate || ch['تاريخ التحرير'] || '').trim(),
      Status: (ch.Status || ch['حالة الصرف'] || 'مصروف') as any,
      BeneficiaryGender: 'ذكر',
      DependencyStatus: 'مستقل',
      AttendanceType: 'شخصياً',
      CreatedAt: String(ch.CreatedAt || ch['تاريخ التحرير'] || new Date().toISOString().split('T')[0]).trim(),
      CreatedBy: String(ch.CreatedBy || 'Google Sheets').trim()
    }));

    const organizationRecords: OrganizationRecord[] = (sourceData.organizationRecords || sourceData.organizations || []).map((o: any) => ({
      ...(o.CustomFields && typeof o.CustomFields === 'object' ? { CustomFields: o.CustomFields } : {}),
      Citizen_ID: String(o.Citizen_ID || o['الرقم التعريفي'] || '').trim(),
      FullName: String(o.FullName || o['الاسم الكامل'] || '').trim(),
      Phone1: String(o.Phone1 || o.Phone || o['رقم الهاتف'] || '').trim(),
      District: String(o.District || o['القضاء'] || '').trim(),
      SubDistrict: String(o.SubDistrict || o.Subdistrict || o['الناحية / المنطقة'] || '').trim(),
      Affiliation: String(o.Affiliation || '').trim(),
      ElectionCenter: String(o.ElectionCenter || o['المركز الانتخابي'] || '').trim(),
      Notes: String(o.Notes || o['الملاحظات'] || '').trim(),
      LastUpdated: String(o.LastUpdated || o['تاريخ التحديث'] || o.UpdatedAt || '').trim(),
      OrgRating: (o.OrgRating || o['التقييم التنظيمي'] || o.Rating || 'مؤيد') as any,
      EvaluationPoints: Number(o.EvaluationPoints) || 10,
      InfluenceType: (o.InfluenceType || o['الصفة / التأثير الاجتماعي'] || 'شخصية مؤثرة') as any
    }));

    // Preserve BOTH Social Care records (including ANY dynamically added future columns!) AND any dynamic Custom Section records!
    const customRecords: CustomSectionRecord[] = (sourceData.customRecords || [])
      .map((cr: any) => {
        const secId = String(cr.sectionId || 'sec_social_welfare').trim();
        const d = (cr && typeof cr.data === 'object' && cr.data) ? cr.data : cr;

        const preservedData: Record<string, any> = {};
        if (d && typeof d === 'object') {
          for (const [k, v] of Object.entries(d)) {
            if (k === 'id' || k === 'sectionId' || k === 'createdAt' || k === 'createdBy' || k === 'معرف القيد' || k === 'تاريخ الإنشاء' || k === 'الموظف المسؤول') {
              continue;
            }
            if (v !== undefined && v !== null) {
              preservedData[k] = typeof v === 'string' ? v.trim() : v;
            }
          }
        }

        if (secId === 'sec_social_welfare') {
          return {
            id: String(cr.id || cr['معرف القيد'] || '').trim(),
            sectionId: 'sec_social_welfare',
            createdAt: String(cr.createdAt || d.f_welf_date || cr['تاريخ المراجعة'] || new Date().toISOString().split('T')[0]).trim(),
            createdBy: String(cr.createdBy || cr['الموظف المسؤول'] || 'قسم الرعاية الاجتماعية').trim(),
            data: {
              ...preservedData,
              f_welf_name: String(d.f_welf_name || cr['اسم المواطن الرباعي'] || '').trim(),
              f_welf_phone: String(d.f_welf_phone || cr['رقم الهاتف'] || '').trim(),
              f_welf_code: String(d.f_welf_code || cr['رقم القيد / المعاملة الوزارية'] || '').trim(),
              f_welf_type: String(d.f_welf_type || cr['نوع الإعانة / الفئة'] || '').trim(),
              f_welf_researcher: String(d.f_welf_researcher || cr['حالة الباحث الاجتماعي'] || '').trim(),
              f_welf_district: String(d.f_welf_district || cr['القضاء / الناحية'] || '').trim(),
              f_welf_date: String(d.f_welf_date || cr['تاريخ المراجعة'] || '').trim(),
              f_welf_notes: String(d.f_welf_notes || cr['الملاحظات والتوجيهات'] || '').trim()
            }
          };
        }

        return {
          id: String(cr.id || cr['معرف القيد'] || '').trim(),
          sectionId: secId,
          createdAt: String(cr.createdAt || cr['تاريخ الإنشاء'] || new Date().toISOString().split('T')[0]).trim(),
          createdBy: String(cr.createdBy || cr['الموظف المسؤول'] || 'Google Sheets').trim(),
          data: preservedData
        };
      })
      .filter((cr: CustomSectionRecord) => Boolean(cr.id));

    const parseStringArray = (raw: any): string[] => {
      if (Array.isArray(raw)) return raw.map(v => String(v).trim()).filter(Boolean);
      if (typeof raw === 'string' && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
        } catch {}
        return raw.split(',').map(v => v.trim()).filter(Boolean);
      }
      return [];
    };

    const users: User[] = (sourceData.users || [])
      .map((u: any) => {
        const rawRole = String(u.Role || u.role || u['الدور'] || u['الصلاحية'] || '').trim();
        const roleArabic = String(u.RoleArabic || u['الصفة الوظيفية'] || u.Department || u['القسم'] || 'موظف').trim();
        const department = String(u.Department || u['القسم'] || '').trim();
        return normalizeUserRecord({
          User_ID: String(u.User_ID || u['معرف المستخدم'] || u.id || '').trim(),
          Username: String(u.Username || u['اسم الدخول'] || '').trim(),
          Password: String(u.Password || u['رمز الدخول / كلمة المرور'] || '').trim(),
          Phone: String(u.Phone || u['رقم الهاتف'] || '').trim(),
          Role: normalizeUserRole(rawRole, roleArabic, department),
          RoleArabic: roleArabic,
          Status: (u.Status === 'frozen' || u['حالة الحساب'] === 'مجمد') ? 'frozen' : 'active',
          FullName: String(u.FullName || u['الاسم الكامل للموظف'] || u.Username || '').trim(),
          Department: department,
          JobTitle: String(u.JobTitle || '').trim(),
          Permissions: parseStringArray(u.Permissions),
          AllowedSections: parseStringArray(u.AllowedSections),
          CreatedAt: String(u.CreatedAt || '').trim(),
          UpdatedAt: String(u.UpdatedAt || u['تاريخ التحديث'] || '').trim()
        });
      })
      .filter((u: User) => Boolean(u.User_ID && u.Username));

    return {
      success: true,
      message: `تم بنجاح جلب (${citizens.length}) مراجع و (${requests.length}) معاملة و (${customRecords.length}) سجل مخصص من Google Sheets.`,
      data: {
        citizens,
        requests,
        interviews,
        officialLetters,
        cheques,
        organizationRecords,
        customRecords,
        users
      }
    };
  } catch (err: any) {
    console.warn('pullDataFromGoogleAppsScript error:', err);
    updateSheetsHealth('error', err?.message || 'فشل سحب البيانات من Google Sheets');
    return { success: false, error: err?.message || 'فشل سحب البيانات من Google Sheets' };
  }
}

/**
 * Verify login credentials against Google Sheets / Google Excel
 */
export async function verifyLoginWithGoogleSheets(
  usernameOrCode: string,
  passwordOrPin?: string,
  customAppsScriptUrl?: string,
  customSheetId?: string
): Promise<{ success: boolean; user?: User; isDeveloper?: boolean; frozen?: boolean }> {
  try {
    const normalizeDigits = (val: string) =>
      (val || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString()).trim();
    const normalizeName = (val: string) =>
      normalizeDigits(val)
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .toLowerCase();

    const rawCode = normalizeDigits(passwordOrPin || usernameOrCode || '');
    const cleanUser = normalizeName(usernameOrCode || '');
    const cleanPass = normalizeDigits(passwordOrPin || '');
    const isDualMode = Boolean(cleanUser && cleanPass && cleanUser !== normalizeName(cleanPass));

    const matchUserFromList = (list: User[]): { success: boolean; user?: User; isDeveloper?: boolean; frozen?: boolean } => {
      for (const u of list) {
        if (!u) continue;
        const uName = normalizeName(u.Username || '');
        const uId = normalizeName(u.User_ID || '');
        const uFull = normalizeName(u.FullName || '');
        const uPhone = normalizeDigits(u.Phone || '');
        const uPass = normalizeDigits(u.Password || '');

        if (isDualMode) {
          const userMatched = cleanUser === uName || cleanUser === uId || cleanUser === uFull || (uPhone && cleanUser === uPhone);
          if (userMatched && uPass && cleanPass === uPass) {
            if (u.Status === 'frozen') return { success: false, frozen: true };
            return { success: true, user: u, isDeveloper: u.Role === 'developer' };
          }
        } else if (rawCode && ((uPass && rawCode === uPass) || (uId && rawCode.toLowerCase() === uId))) {
          if (u.Status === 'frozen') return { success: false, frozen: true };
          return { success: true, user: u, isDeveloper: u.Role === 'developer' };
        }
      }
      return { success: false };
    };

    const scriptUrl = resolveAppsScriptUrl(customAppsScriptUrl);
    if (scriptUrl && scriptUrl.startsWith('http')) {
      try {
        const separator = scriptUrl.includes('?') ? '&' : '?';
        const res = await fetch(`${scriptUrl}${separator}action=verifyLogin&user=${encodeURIComponent(cleanUser)}&code=${encodeURIComponent(rawCode)}`, {
          method: 'GET'
        });
        if (res.ok) {
          const json = await res.json();
          if (json && (json.success === true || json.matched === true)) {
            if (json.user?.Status === 'frozen') return { success: false, frozen: true };
            const normalizedJsonUser = json.user ? normalizeUserRecord(json.user) : undefined;
            return {
              success: true,
              user: normalizedJsonUser,
              isDeveloper: json.isDeveloper ?? (normalizedJsonUser?.Role === 'developer')
            };
          }
        }
      } catch (e) {
        console.warn('Apps Script login verify error:', e);
      }

      try {
        const pulled = await pullDataFromGoogleAppsScript(scriptUrl);
        if (pulled?.success && pulled.data?.users && pulled.data.users.length > 0) {
          const matched = matchUserFromList(pulled.data.users);
          if (matched.success || matched.frozen) return matched;
        }
      } catch {}
    }

    const token = typeof window !== 'undefined' ? (sessionStorage.getItem('al_nashi_google_token') || localStorage.getItem('al_nashi_google_token')) : null;
    const sheetId = resolveTargetSheetId(customSheetId);

    if (token && sheetId) {
      try {
        const usersRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(USERS_SHEET_NAME)}!A1:M200`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (usersRes.ok) {
          const data = await usersRes.json();
          const allRows: string[][] = data.values || [];
          const headerRow = allRows[0] || [];
          const dataRows = allRows.slice(1);
          const sheetUsers: User[] = dataRows.map((row, idx) => {
            const mapped = mapSheetRowByHeaders(headerRow, row);
            const userId = String(mapped['معرف المستخدم'] || mapped['User_ID'] || row[0] || '').trim() || `USR-SH-${idx + 1}`;
            const fullName = String(mapped['الاسم الكامل للموظف'] || mapped['FullName'] || row[1] || '').trim();
            const username = String(mapped['اسم الدخول'] || mapped['Username'] || row[2] || '').trim();
            const password = String(mapped['رمز الدخول / كلمة المرور'] || mapped['Password'] || row[3] || '').trim();
            const roleArabic = String(mapped['الصفة الوظيفية'] || mapped['RoleArabic'] || row[4] || '').trim();
            const department = String(mapped['القسم'] || mapped['Department'] || row[5] || '').trim();
            const rawRole = String(mapped['Role'] || mapped['الدور'] || mapped['الصلاحية'] || '').trim();
            const phone = String(mapped['رقم الهاتف'] || mapped['Phone'] || row[6] || '').trim();
            const statusRaw = String(mapped['حالة الحساب'] || mapped['Status'] || row[7] || '').trim();
            return normalizeUserRecord({
              User_ID: userId,
              Username: username,
              Password: password,
              Phone: phone,
              Role: normalizeUserRole(rawRole, roleArabic, department),
              FullName: fullName || username,
              RoleArabic: roleArabic || department || 'موظف معتمد',
              Department: department || 'إدارة المكتب',
              Status: (statusRaw === 'frozen' || statusRaw === 'مجمد' ? 'frozen' : 'active') as 'active' | 'frozen'
            });
          }).filter(u => Boolean(u.Username || u.Password));
          const matched = matchUserFromList(sheetUsers);
          if (matched.success || matched.frozen) return matched;
        }
      } catch (e) {
        console.warn('Google Sheets direct login check error:', e);
      }
    }

    return { success: false };
  } catch (err) {
    console.warn('verifyLoginWithGoogleSheets error:', err);
    return { success: false };
  }
}
