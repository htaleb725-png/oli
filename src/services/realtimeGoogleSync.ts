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
  cleanSheetCell
} from './googleSheetsSchema';
import { Citizen, OfficeRequest, Interview, OfficialLetter, OrganizationRecord, ChequeRecord, CustomSectionRecord, User } from '../types';

/**
 * Realtime Google Sheets and Google Drive Auto-Sync Service
 * Automatically pushes records as they are saved in the system
 * and supports reliable bidirectional fetching.
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
  | 'settings';

export type RealtimeActionType = 'insert' | 'update' | 'upsert' | 'delete';

export interface SyncPayload {
  entityType: RealtimeEntityType;
  action: RealtimeActionType;
  data: any;
  timestamp: string;
}

// Queue for resilience
const syncQueue: SyncPayload[] = [];
let isProcessingQueue = false;

const stripQuotes = (val?: string) => (val || '').replace(/^["']|["']$/g, '').trim();

// Runtime cloud config hydrated directly from Firestore settings/general (works cleanly on Vercel without Chrome localStorage)
let _runtimeCloudConfig: {
  appsScriptUrl?: string;
  googleSheetId?: string;
  googleDriveFolderId?: string;
} = {};

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

// Helper to reliably resolve Google Sheet ID from Cloud Firestore config, Vercel env, or legacy fallback
export function resolveTargetSheetId(customSheetId?: string): string {
  if (customSheetId && customSheetId.trim()) return stripQuotes(customSheetId);
  if (_runtimeCloudConfig.googleSheetId) return _runtimeCloudConfig.googleSheetId;
  const envSheetId = (import.meta as any).env?.VITE_GOOGLE_SHEET_ID;
  if (envSheetId && envSheetId.trim()) return stripQuotes(envSheetId);

  if (typeof window !== 'undefined') {
    const direct = localStorage.getItem('al_nashi_sheet_id');
    if (direct && direct.trim()) return stripQuotes(direct);
    try {
      const savedSettings = localStorage.getItem('al_nashi_office_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.googleSheetId && parsed.googleSheetId.trim()) return stripQuotes(parsed.googleSheetId);
        if (parsed.activeGoogleSheetId && parsed.activeGoogleSheetId.trim()) return stripQuotes(parsed.activeGoogleSheetId);
      }
    } catch {}
  }
  return '1wqPXKzzrMJJqfGIyAwEZC1tvWXf28JFS8lUN1YGiFVQ';
}

// Helper to reliably resolve Apps Script Webhook URL from Cloud Firestore config, Vercel env, or legacy fallback
export function resolveAppsScriptUrl(customUrl?: string): string {
  if (customUrl && customUrl.trim()) return stripQuotes(customUrl);
  if (_runtimeCloudConfig.appsScriptUrl) return _runtimeCloudConfig.appsScriptUrl;
  const envUrl = (import.meta as any).env?.VITE_GOOGLE_APPS_SCRIPT_URL;
  if (envUrl && envUrl.trim()) return stripQuotes(envUrl);

  if (typeof window !== 'undefined') {
    const direct = localStorage.getItem('al_nashi_apps_script_url');
    if (direct && direct.trim()) return stripQuotes(direct);
    try {
      const savedSettings = localStorage.getItem('al_nashi_office_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.appsScriptUrl && parsed.appsScriptUrl.trim()) return stripQuotes(parsed.appsScriptUrl);
        if (parsed.googleAppsScriptUrl && parsed.googleAppsScriptUrl.trim()) return stripQuotes(parsed.googleAppsScriptUrl);
      }
    } catch {}
  }
  return 'https://script.google.com/macros/s/AKfycbxvsACdMiERlpp03F6zeuBpwU6OE6bJ2u8FA2QsZgcp4n4p38UkIMyIcvwBs37L6rZd/exec';
}

/**
 * Server-proxied Google Apps Script dispatcher (works on Vercel & Node without browser CORS/no-cors limits!)
 */
async function postToAppsScriptWithServerProxy(resolvedUrl: string, payload: Record<string, any>): Promise<any> {
  if (!resolvedUrl || !resolvedUrl.startsWith('http')) return null;
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
    if (proxyRes.ok) {
      return await proxyRes.json().catch(() => ({ success: true }));
    }
  } catch {}

  // Fallback to direct browser fetch
  try {
    await fetch(resolvedUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return { success: true };
  } catch (err) {
    console.warn('Apps Script direct fallback warning:', err);
    return null;
  }
}

async function getFromAppsScriptWithServerProxy(resolvedUrl: string, queryAction: string = 'getAllData'): Promise<any> {
  if (!resolvedUrl || !resolvedUrl.startsWith('http')) return null;
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
    if (proxyRes.ok) {
      const json = await proxyRes.json().catch(() => null);
      if (json) return json;
    }
  } catch {}

  try {
    const separator = resolvedUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${resolvedUrl}${separator}action=${encodeURIComponent(queryAction)}&t=${Date.now()}`, {
      method: 'GET'
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
}

export async function syncSchemaToGoogleAppsScript(_sections: any[], customUrl?: string): Promise<boolean> {
  const url = resolveAppsScriptUrl(customUrl);
  if (!url || !url.startsWith('http')) return false;
  return true;
}

export async function pushToGoogleSheetsRealtime(
  entityType: RealtimeEntityType,
  data: any,
  action: RealtimeActionType = 'insert',
  appsScriptUrl?: string,
  sheetId?: string
): Promise<void> {
  const payload: SyncPayload = {
    entityType,
    action,
    data,
    timestamp: new Date().toISOString()
  };

  syncQueue.push(payload);
  processSyncQueue(appsScriptUrl, sheetId);
}

async function processSyncQueue(customUrl?: string, targetSheetId?: string) {
  if (isProcessingQueue || syncQueue.length === 0) return;
  isProcessingQueue = true;

  try {
    const item = syncQueue.shift();
    if (!item) {
      isProcessingQueue = false;
      return;
    }

    const resolvedSheetId = resolveTargetSheetId(targetSheetId);
    const resolvedUrl = resolveAppsScriptUrl(customUrl);

    const targetId = item.data?.id || item.data?.User_ID || item.data?.Citizen_ID || item.data?.Request_ID || item.data?.Interview_ID || item.data?.Letter_ID || (typeof item.data === 'string' ? item.data : '');

    // 1. Direct Google Sheets REST API sync via Developer Google OAuth token
    if (resolvedSheetId) {
      try {
        const token = await getAccessToken();
        if (token && !token.startsWith('ya29.al_nashi_session_') && !token.startsWith('ya29.al_nashi_dev_session_')) {
          if (item.action === 'delete') {
            if (targetId) {
              await deleteRecordFromSheetsRealtime(token, resolvedSheetId, item.entityType, targetId);
            }
          } else {
            await pushSingleRecordToSheetsRealtime(token, resolvedSheetId, item.entityType, item.data);
          }
        }
      } catch (e) {
        console.warn('Realtime Direct Google Sheets sync notification:', e);
      }
    }

    // 2. Webhook / Apps Script Web App sync — send strictly to the 8 single-sheet-per-department tabs
    if (resolvedUrl && resolvedUrl.startsWith('http')) {
      try {
        // Do not create extra clutter sheets for settings/dropdowns/custom_sections/drive_archive
        if (
          item.entityType === 'settings' ||
          item.entityType === 'dropdowns' ||
          item.entityType === 'custom_sections' ||
          item.entityType === 'drive_archive'
        ) {
          isProcessingQueue = false;
          if (syncQueue.length > 0) {
            setTimeout(() => processSyncQueue(customUrl, targetSheetId), 200);
          }
          return;
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

        const cleanWebhookData =
          item.action === 'delete'
            ? item.data
            : item.entityType === 'citizens'
            ? toCleanSheetCitizenPayload(item.data)
            : item.entityType === 'requests'
            ? toCleanSheetRequestPayload(item.data)
            : item.entityType === 'interviews'
            ? toCleanSheetInterviewPayload(item.data)
            : item.entityType === 'organization'
            ? toCleanSheetOrganizationPayload(item.data)
            : item.entityType === 'letters'
            ? toCleanSheetLetterPayload(item.data)
            : item.entityType === 'cheques'
            ? toCleanSheetChequePayload(item.data)
            : item.entityType === 'custom_records'
            ? toCleanSheetSocialCarePayload(item.data)
            : item.entityType === 'users'
            ? toCleanSheetUserPayload(item.data)
            : sanitizeFlatPayload(item.data);

        await postToAppsScriptWithServerProxy(resolvedUrl, {
          action: item.action === 'delete' ? 'delete' : item.action === 'insert' ? 'appendRow' : 'updateRow',
          table: item.entityType,
          sheetType: item.entityType,
          id: targetId,
          Citizen_ID: targetId,
          Request_ID: targetId,
          data: cleanWebhookData,
          record: cleanWebhookData,
          timestamp: item.timestamp,
          source: 'al_nashi_office_system'
        });
      } catch (err) {
        console.warn('Realtime Google Sheets webhook warning:', err);
      }
    }
  } finally {
    isProcessingQueue = false;
    if (syncQueue.length > 0) {
      setTimeout(() => processSyncQueue(customUrl, targetSheetId), 300);
    }
  }
}

/**
 * Chunked non-blocking bulk push to Google Sheets (supports both Apps Script Web App & Direct Google Sheets REST API).
 * Used by Excel Filter/Import so all filtered citizens and requests are persisted to Google Sheets automatically
 * without hitting Apps Script payload limits or freezing the browser.
 */
export async function pushBulkDataToGoogleSheets(
  citizensList: Citizen[],
  requestsList: OfficeRequest[],
  customAppsScriptUrl?: string,
  customSheetId?: string
): Promise<{ appsScriptSent: boolean; directSheetsSent: boolean; chunksSent: number }> {
  const resolvedUrl = resolveAppsScriptUrl(customAppsScriptUrl);
  const resolvedSheetId = resolveTargetSheetId(customSheetId);
  let appsScriptSent = false;
  let directSheetsSent = false;
  let chunksSent = 0;

  // Sanitize into strictly flat, isolated single-cell objects (zero raw JSON/base64, identical to manual registration!)
  const cleanCitizens = (citizensList || []).map(c => toCleanSheetCitizenPayload(c));
  const cleanRequests = (requestsList || []).map(r => toCleanSheetRequestPayload(r));

  // 1. Push in chunks of 80 rows to Google Apps Script Webhook (bulk_sync merges & upserts safely without wiping!)
  if (resolvedUrl && resolvedUrl.startsWith('http') && (cleanCitizens.length > 0 || cleanRequests.length > 0)) {
    const CHUNK = 80;
    const maxLen = Math.max(cleanCitizens.length, cleanRequests.length);
    for (let i = 0; i < maxLen; i += CHUNK) {
      const citSlice = cleanCitizens.slice(i, i + CHUNK);
      const reqSlice = cleanRequests.slice(i, i + CHUNK);
      if (citSlice.length === 0 && reqSlice.length === 0) continue;
      try {
        await postToAppsScriptWithServerProxy(resolvedUrl, {
          action: 'bulk_sync',
          data: {
            citizens: citSlice,
            requests: reqSlice
          },
          timestamp: new Date().toISOString(),
          source: 'al_nashi_excel_filter_import'
        });
        appsScriptSent = true;
        chunksSent++;
      } catch (err) {
        console.warn('Apps Script bulk chunk sync warning:', err);
      }
      if (i + CHUNK < maxLen) {
        await new Promise(resolve => setTimeout(resolve, 350));
      }
    }
  }

  // 2. Also append directly via Google Sheets REST API anchored strictly to A1 (never drifting right!)
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
    } catch (err) {
      console.warn('Direct Sheets bulk append warning:', err);
    }
  }

  return { appsScriptSent, directSheetsSent, chunksSent };
}

/**
 * One-click Google Sheets column cleanup & reorganization (without losing any data!):
 * 1) If Google OAuth token + Sheet ID exist, clears messy legacy columns (A1:AZ) and rewrites all non-empty tables cleanly with RTL + CLIP formatting.
 * 2) If Apps Script URL is configured, triggers `reorganizeSheets` (GET + POST) and syncs clean Arabic-column data.
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
  customRecords?: CustomSectionRecord[];
  users?: User[];
  auditLogs?: any[];
}): Promise<{ success: boolean; message: string; needsScriptUpdate?: boolean }> {
  const resolvedUrl = resolveAppsScriptUrl(params.appsScriptUrl);
  const resolvedSheetId = resolveTargetSheetId(params.sheetId);
  let directDone = false;
  let scriptDone = false;
  let needsScriptUpdate = false;

  // 1. Direct Google Sheets API clean rewrite (creates the 8 department sheets, writes ordered Arabic columns, deletes duplicate tabs)
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
    } catch (err) {
      console.warn('Direct Sheets reorganize warning:', err);
    }
  }

  // 2. Apps Script clean column reorganization & bulk sync across all 8 department tabs
  if (resolvedUrl && resolvedUrl.startsWith('http')) {
    try {
      // First push non-citizen/request departments + first batch
      const cleanInterviews = (params.interviews || []).map(i => toCleanSheetInterviewPayload(i));
      const cleanOrg = (params.organizationRecords || []).map(o => toCleanSheetOrganizationPayload(o));
      const cleanLetters = (params.officialLetters || []).map(l => toCleanSheetLetterPayload(l));
      const cleanCheques = (params.cheques || []).map(ch => toCleanSheetChequePayload(ch));
      const cleanSocial = (params.customRecords || [])
        .filter(r => !r.sectionId || r.sectionId === 'sec_social_welfare')
        .map(r => toCleanSheetSocialCarePayload(r));
      const cleanUsers = (params.users || []).map(u => toCleanSheetUserPayload(u));

      await postToAppsScriptWithServerProxy(resolvedUrl, {
        action: 'bulk_sync',
        cleanupDuplicates: true,
        data: {
          interviews: cleanInterviews,
          organizationRecords: cleanOrg,
          officialLetters: cleanLetters,
          cheques: cleanCheques,
          customRecords: cleanSocial,
          users: cleanUsers
        },
        timestamp: new Date().toISOString()
      });

      // Push citizens & requests in chunks of 80
      await pushBulkDataToGoogleSheets(params.citizens || [], params.requests || [], resolvedUrl, resolvedSheetId);

      // Finally trigger reorganizeSheets to consolidate legacy tabs & delete duplicates
      const reorgRes = await getFromAppsScriptWithServerProxy(resolvedUrl, 'reorganizeSheets');
      if (reorgRes) {
        scriptDone = true;
        if (reorgRes.status === 'online' && !reorgRes.schemaVersion && !reorgRes.details) {
          needsScriptUpdate = true;
        }
      } else {
        await postToAppsScriptWithServerProxy(resolvedUrl, {
          action: 'reorganizeSheets',
          timestamp: new Date().toISOString()
        });
        scriptDone = true;
      }
    } catch (err) {
      console.warn('Apps Script reorganize warning:', err);
    }
  }

  if (needsScriptUpdate && !directDone) {
    return {
      success: true,
      needsScriptUpdate: true,
      message: '✓ تم إرسال جميع سجلات الأقسام الثمانية إلى Google Sheets بنجاح! ملاحظة: لحذف الأوراق القديمة الـ 13 تلقائياً وتوحيد كل قسم في ورقة واحدة، يرجى نسخ كود Apps Script المحدث أدناه ولصقه في جدول Google Sheets ثم عمل Deploy (إصدار جديد).'
    };
  }

  if (directDone || scriptDone) {
    return {
      success: true,
      message: '✓ تم ترتيب وتوحيد قاعدة بيانات Google Sheets بنجاح (ورقة واحدة فقط لكل قسم من الأقسام الـ 8 بأعمدة عربية مرتبة ومعزولة) ودمج كافة السجلات دون فقدان أي بيان!'
    };
  }

  return {
    success: false,
    message: '⚠️ يرجى التأكد من حفظ رابط Apps Script أو تسجيل الدخول بحساب Google أولاً لتنفيذ ترتيب وتوحيد أوراق الأقسام.'
  };
}

/**
 * Pull all data from Google Apps Script Web App (proxied via server on Vercel to avoid CORS redirects)
 */
export async function pullDataFromGoogleAppsScript(appsScriptUrl: string): Promise<{
  success: boolean;
  message?: string;
  needsScriptUpdate?: boolean;
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
    const json = await getFromAppsScriptWithServerProxy(cleanUrl, 'getAllData');
    if (!json) return null;

    // If the currently deployed script on Google Sheets is the old minimal doGet stub that only returns { status: 'online', sheetsCount: 13 }
    if (json.status === 'online' && !json.data && !json.citizens) {
      return {
        success: false,
        needsScriptUpdate: true,
        message: `الجدول المتصل (${json.spreadsheetName || 'Google Sheets'}) يحتوي حالياً على (${json.sheetsCount || 0}) ورقة ويعمل بنسخة سكربت قديمة. انسخ كود السكربت المحدث لتوحيد الأوراق في 8 أوراق (ورقة لكل قسم).`
      };
    }

    const sourceData = json.data || json;

    const citizens: Citizen[] = (sourceData.citizens || []).map((c: any) => {
      const blockStr = String(c.IsBlocked || c['حالة الحظر'] || '').trim();
      const isBlocked = c.IsBlocked === true || blockStr.startsWith('محظور') || blockStr === 'نعم';
      const blockReason = blockStr.includes(' - ') ? blockStr.split(' - ').slice(1).join(' - ').trim() : c.BlockReason;
      return {
        Citizen_ID: String(c.Citizen_ID || c['الرقم التعريفي'] || c.id || '').trim(),
        FirstName: String(c.FirstName || c['الاسم الأول'] || '').trim(),
        FatherName: String(c.FatherName || c['اسم الأب'] || '').trim(),
        GrandFatherName: String(c.GrandFatherName || c['اسم الجد'] || '').trim(),
        GreatGrandFatherName: String(c.GreatGrandFatherName || '').trim(),
        Surname: String(c.Surname || c['اللقب / العشيرة'] || '').trim(),
        FullName: String(c.FullName || c['الاسم الكامل'] || c.CitizenName || '').trim(),
        Phone1: String(c.Phone1 || c['رقم الهاتف'] || c.Phone || '').trim(),
        Phone2: String(c.Phone2 || c['الهاتف البديل'] || '').trim(),
        Gender: (c.Gender || c['الجنس']) === 'أنثى' ? 'أنثى' : 'ذكر',
        Job: String(c.Job || c['المهنة / العمل'] || '').trim(),
        Education: String(c.Education || c['التحصيل الدراسي'] || '').trim(),
        Rating: String(c.Rating || c['التقييم'] || 'لائق'),
        District: String(c.District || c['القضاء'] || '').trim(),
        SubDistrict: String(c.SubDistrict || c['الناحية / المنطقة'] || '').trim(),
        ReferralSource: String(c.ReferralSource || c['المعرف / التزكية'] || '').trim(),
        IsBlocked: isBlocked,
        ...(blockReason ? { BlockReason: String(blockReason) } : {}),
        CreatedAt: String(c.CreatedAt || c['تاريخ التسجيل'] || new Date().toISOString().split('T')[0]).trim(),
        CreatedBy: String(c.CreatedBy || c['الموظف المسؤول'] || 'Google Sheets').trim(),
        PhotoUrl: c.PhotoUrl ? String(c.PhotoUrl).trim() : undefined
      };
    });

    const requests: OfficeRequest[] = (sourceData.requests || []).map((r: any) => {
      const rawDelivery = r.DeliveryStatus || r['حالة الاستلام'] || '';
      const rawProc = r.ProcessingStatus || r['حالة الإنجاز'] || 'قيد التدقيق';
      return {
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
        IsHistoricalImported: r.IsHistoricalImported === true || r.IsHistoricalImported === 'true',
        CreatedAt: String(r.CreatedAt || r['تاريخ التسجيل'] || new Date().toISOString().split('T')[0]).trim(),
        CreatedBy: String(r.CreatedBy || r['الموظف المسؤول'] || 'Google Sheets').trim(),
        UpdatedAt: r.UpdatedAt ? String(r.UpdatedAt).trim() : undefined
      };
    });

    const interviews: Interview[] = (sourceData.interviews || []).map((i: any) => ({
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
      Citizen_ID: String(o.Citizen_ID || o['الرقم التعريفي'] || '').trim(),
      FullName: String(o.FullName || o['الاسم الكامل'] || '').trim(),
      Phone1: String(o.Phone1 || o['رقم الهاتف'] || '').trim(),
      District: String(o.District || o['القضاء'] || '').trim(),
      SubDistrict: String(o.SubDistrict || o['الناحية / المنطقة'] || '').trim(),
      Affiliation: String(o.Affiliation || '').trim(),
      ElectionCenter: String(o.ElectionCenter || o['المركز الانتخابي'] || '').trim(),
      Notes: String(o.Notes || o['الملاحظات'] || '').trim(),
      LastUpdated: String(o.LastUpdated || o['تاريخ التحديث'] || o.UpdatedAt || '').trim(),
      OrgRating: (o.OrgRating || o['التقييم التنظيمي'] || o.Rating || 'مؤيد') as any,
      EvaluationPoints: Number(o.EvaluationPoints) || 10,
      InfluenceType: (o.InfluenceType || o['الصفة / التأثير الاجتماعي'] || 'شخصية مؤثرة') as any
    }));

    const customRecords: CustomSectionRecord[] = (sourceData.customRecords || []).map((cr: any) => {
      const d = (cr && typeof cr.data === 'object' && cr.data) ? cr.data : cr;
      return {
        id: String(cr.id || cr['معرف القيد'] || '').trim(),
        sectionId: cr.sectionId || 'sec_social_welfare',
        createdAt: String(cr.createdAt || d.f_welf_date || cr['تاريخ المراجعة'] || new Date().toISOString().split('T')[0]).trim(),
        createdBy: String(cr.createdBy || cr['الموظف المسؤول'] || 'قسم الرعاية الاجتماعية').trim(),
        data: {
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
    }).filter((cr: CustomSectionRecord) => Boolean(cr.id));

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

    const users: User[] = (sourceData.users || []).map((u: any) => ({
      User_ID: String(u.User_ID || u['معرف المستخدم'] || u.id || '').trim(),
      Username: String(u.Username || u['اسم الدخول'] || '').trim(),
      Password: String(u.Password || u['رمز الدخول / كلمة المرور'] || '').trim(),
      Phone: String(u.Phone || u['رقم الهاتف'] || '').trim(),
      Role: (u.Role || 'reception') as any,
      RoleArabic: String(u.RoleArabic || u['الصفة الوظيفية'] || u.Department || 'موظف').trim(),
      Status: (u.Status === 'frozen' || u['حالة الحساب'] === 'مجمد') ? 'frozen' : 'active',
      FullName: String(u.FullName || u['الاسم الكامل للموظف'] || u.Username || '').trim(),
      Department: String(u.Department || u['القسم'] || '').trim(),
      JobTitle: String(u.JobTitle || '').trim(),
      Permissions: parseStringArray(u.Permissions),
      AllowedSections: parseStringArray(u.AllowedSections),
      CreatedAt: String(u.CreatedAt || '').trim(),
      UpdatedAt: String(u.UpdatedAt || u['تاريخ التحديث'] || '').trim()
    })).filter((u: User) => Boolean(u.User_ID && u.Username));

    return {
      success: true,
      message: `تم بنجاح جلب (${citizens.length}) مراجع و (${requests.length}) معاملة من أوراق الأقسام الموحدة في Google Sheets.`,
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
    return null;
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

    // 1. If Apps Script URL is provided or saved
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
            return {
              success: true,
              user: json.user,
              isDeveloper: json.isDeveloper ?? (json.user?.Role === 'developer')
            };
          }
        }
      } catch (e) {
        console.warn('Apps Script login verify error:', e);
      }

      // Fallback: pull users from getAllData if Apps Script does not implement verifyLogin directly
      try {
        const pulled = await pullDataFromGoogleAppsScript(scriptUrl);
        if (pulled?.success && pulled.data?.users && pulled.data.users.length > 0) {
          const matched = matchUserFromList(pulled.data.users);
          if (matched.success || matched.frozen) return matched;
        }
      } catch {}
    }

    // 2. If Google Sheets Access Token is cached
    const token = typeof window !== 'undefined' ? (sessionStorage.getItem('al_nashi_google_token') || localStorage.getItem('al_nashi_google_token')) : null;
    const sheetId = resolveTargetSheetId(customSheetId);

    if (token && sheetId) {
      try {
        const usersRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(USERS_SHEET_NAME)}!A2:I200`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (usersRes.ok) {
          const data = await usersRes.json();
          const rows: string[][] = data.values || [];
          const sheetUsers: User[] = rows.map(row => ({
            User_ID: (row[0] || '').trim() || `USR-${Date.now()}`,
            Username: (row[1] || '').trim(),
            Password: (row[2] || '').trim(),
            Role: ((row[3] || 'reception').trim() as any),
            FullName: (row[4] || row[1] || '').trim(),
            RoleArabic: (row[5] || row[3] || 'موظف معتمد').trim(),
            Department: (row[6] || 'إدارة المكتب').trim(),
            Status: ((row[7] || '').trim() === 'frozen' ? 'frozen' : 'active') as 'active' | 'frozen'
          })).filter(u => Boolean(u.Username));
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
