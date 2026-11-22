import { getAccessToken, pushSingleRecordToSheetsRealtime, deleteRecordFromSheetsRealtime } from './googleSheetsService';
import { Citizen, OfficeRequest, Interview, OfficialLetter, OrganizationRecord, ChequeRecord, User } from '../types';

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

// Helper to reliably resolve Google Sheet ID from multiple fallbacks
export function resolveTargetSheetId(customSheetId?: string): string {
  if (customSheetId && customSheetId.trim()) return stripQuotes(customSheetId);
  // 1. Check environment variable (Vercel)
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
  return '';
}

// Helper to reliably resolve Apps Script Webhook URL from multiple fallbacks
export function resolveAppsScriptUrl(customUrl?: string): string {
  if (customUrl && customUrl.trim()) return stripQuotes(customUrl);
  // 1. Check environment variable (Vercel)
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
  return '';
}

/**
 * Proactively notifies Google Apps Script to auto-create tabs and column headers
 * for newly introduced sections or custom fields without manual spreadsheet editing.
 */
export async function syncSchemaToGoogleAppsScript(sections: any[], customUrl?: string): Promise<boolean> {
  const url = resolveAppsScriptUrl(customUrl);
  if (!url || !url.startsWith('http')) return false;

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'syncSchema',
        sections: sections,
        timestamp: new Date().toISOString()
      })
    });
    return true;
  } catch (err) {
    console.warn('syncSchemaToGoogleAppsScript warning:', err);
    return false;
  }
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

    // 2. Webhook / Apps Script Web App sync (if configured)
    if (resolvedUrl && resolvedUrl.startsWith('http')) {
      try {
        await fetch(resolvedUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify({
            action: item.action === 'delete' ? 'delete' : item.action === 'insert' ? 'appendRow' : 'updateRow',
            table: item.entityType,
            sheetType: item.entityType,
            id: targetId,
            Citizen_ID: targetId,
            Request_ID: targetId,
            data: item.data,
            record: item.data,
            timestamp: item.timestamp,
            source: 'al_nashi_office_system'
          })
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

  // Strip heavy base64 images before sending over webhook/REST
  const cleanCitizens = (citizensList || []).map(c => {
    const copy: any = { ...c };
    if (typeof copy.PhotoUrl === 'string' && copy.PhotoUrl.startsWith('data:')) delete copy.PhotoUrl;
    return copy;
  });
  const cleanRequests = (requestsList || []).map(r => {
    const copy: any = { ...r };
    if (typeof copy.AttachedRequestImage === 'string' && copy.AttachedRequestImage.startsWith('data:')) {
      delete copy.AttachedRequestImage;
    }
    if (Array.isArray(copy.ScanAttachments)) {
      copy.ScanAttachments = [];
    }
    return copy;
  });

  // 1. Push in chunks of 80 rows to Google Apps Script Webhook (bulk_sync merges & upserts safely without wiping!)
  if (resolvedUrl && resolvedUrl.startsWith('http') && (cleanCitizens.length > 0 || cleanRequests.length > 0)) {
    const CHUNK = 80;
    const maxLen = Math.max(cleanCitizens.length, cleanRequests.length);
    for (let i = 0; i < maxLen; i += CHUNK) {
      const citSlice = cleanCitizens.slice(i, i + CHUNK);
      const reqSlice = cleanRequests.slice(i, i + CHUNK);
      if (citSlice.length === 0 && reqSlice.length === 0) continue;
      try {
        await fetch(resolvedUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'bulk_sync',
            data: {
              citizens: citSlice,
              requests: reqSlice
            },
            timestamp: new Date().toISOString(),
            source: 'al_nashi_excel_filter_import'
          })
        });
        appsScriptSent = true;
        chunksSent++;
      } catch (err) {
        console.warn('Apps Script bulk chunk sync warning:', err);
      }
      // Small breathing delay between chunks so Apps Script lock releases cleanly
      if (i + CHUNK < maxLen) {
        await new Promise(resolve => setTimeout(resolve, 450));
      }
    }
  }

  // 2. Also append directly via Google Sheets REST API if OAuth access token is active
  if (resolvedSheetId && (cleanCitizens.length > 0 || cleanRequests.length > 0)) {
    try {
      const token = await getAccessToken();
      if (token && !token.startsWith('ya29.al_nashi_session_') && !token.startsWith('ya29.al_nashi_dev_session_')) {
        if (cleanCitizens.length > 0) {
          const citRows = cleanCitizens.map(c => [
            c.Citizen_ID || '',
            c.FullName || '',
            c.Phone1 || '',
            c.Phone2 || '',
            c.Gender || 'ذكر',
            c.Surname || '',
            c.District || '',
            c.SubDistrict || '',
            c.ResidentialArea || '',
            c.Job || '',
            c.Education || '',
            c.Rating || '',
            c.ReferralSource || '',
            c.CreatedAt || '',
            c.CreatedBy || ''
          ]);
          const encCitRange = encodeURIComponent('سجل_المراجعين_Citizens!A:O');
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
        if (cleanRequests.length > 0) {
          const reqRows = cleanRequests.map(r => [
            r.Request_ID || '',
            r.Citizen_ID || '',
            r.CitizenName || '',
            r.CitizenPhone || '',
            r.Entity || '',
            r.Details || '',
            r.OutgoingNumber || '',
            r.OutgoingDate || '',
            r.RequestStatus || 'مستلم',
            r.ProcessingStatus || 'منجز',
            r.Priority || 'عام',
            r.DirectorDecision || 'مؤرشف',
            r.CreatedAt || '',
            r.CreatedBy || '',
            r.OtherNotes || ''
          ]);
          const encReqRange = encodeURIComponent('طلبات_المواطنين_Requests!A:O');
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
 * Pull all data from Google Apps Script Web App (if configured with doGet)
 */
export async function pullDataFromGoogleAppsScript(appsScriptUrl: string): Promise<{
  success: boolean;
  message?: string;
  data?: {
    citizens: Citizen[];
    requests: OfficeRequest[];
    interviews: Interview[];
    officialLetters: OfficialLetter[];
    organizationRecords: OrganizationRecord[];
    cheques: ChequeRecord[];
    users?: User[];
  };
} | null> {
  const cleanUrl = resolveAppsScriptUrl(appsScriptUrl);
  if (!cleanUrl || !cleanUrl.startsWith('http')) return null;

  try {
    const separator = cleanUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${cleanUrl}${separator}action=getAllData`, {
      method: 'GET'
    });

    if (!response.ok) return null;
    const json = await response.json();
    if (!json) return null;

    const sourceData = json.data || json;

    const citizens: Citizen[] = (sourceData.citizens || []).map((c: any) => ({
      Citizen_ID: String(c.Citizen_ID || c.id || '').trim(),
      FirstName: String(c.FirstName || '').trim(),
      FatherName: String(c.FatherName || '').trim(),
      GrandFatherName: String(c.GrandFatherName || '').trim(),
      GreatGrandFatherName: String(c.GreatGrandFatherName || '').trim(),
      Surname: String(c.Surname || '').trim(),
      FullName: String(c.FullName || c.CitizenName || '').trim(),
      Phone1: String(c.Phone1 || c.Phone || '').trim(),
      Phone2: String(c.Phone2 || '').trim(),
      Gender: c.Gender === 'أنثى' ? 'أنثى' : 'ذكر',
      Job: String(c.Job || '').trim(),
      Education: String(c.Education || '').trim(),
      Rating: String(c.Rating || 'لائق'),
      District: String(c.District || '').trim(),
      SubDistrict: String(c.SubDistrict || '').trim(),
      ReferralSource: String(c.ReferralSource || '').trim(),
      CreatedAt: String(c.CreatedAt || new Date().toISOString().split('T')[0]).trim(),
      CreatedBy: String(c.CreatedBy || 'Google Sheets').trim(),
      PhotoUrl: c.PhotoUrl ? String(c.PhotoUrl).trim() : undefined
    }));

    const requests: OfficeRequest[] = (sourceData.requests || []).map((r: any) => ({
      Request_ID: String(r.Request_ID || r.id || '').trim(),
      Citizen_ID: String(r.Citizen_ID || '').trim(),
      CitizenName: String(r.CitizenName || r.FullName || '').trim(),
      CitizenPhone: String(r.CitizenPhone || r.Phone1 || '').trim(),
      Entity: String(r.Entity || '').trim(),
      RequestStatus: (r.RequestStatus as any) || 'مستلم',
      ProcessingStatus: (r.ProcessingStatus as any) || 'قيد التدقيق',
      Priority: (r.Priority as any) || 'عادي',
      Details: String(r.Details || '').trim(),
      AttachmentRequest: r.AttachmentRequest || undefined,
      AttachmentResponse: r.AttachmentResponse || undefined,
      DeputyNotes: String(r.DeputyNotes || '').trim(),
      CreatedAt: String(r.CreatedAt || new Date().toISOString().split('T')[0]).trim(),
      CreatedBy: String(r.CreatedBy || 'Google Sheets').trim()
    }));

    const interviews: Interview[] = (sourceData.interviews || []).map((i: any) => ({
      Interview_ID: String(i.Interview_ID || i.id || '').trim(),
      Citizen_ID: String(i.Citizen_ID || '').trim(),
      FullName: String(i.FullName || i.CitizenName || '').trim(),
      Subject: String(i.Subject || '').trim(),
      Phone1: String(i.Phone1 || '').trim(),
      Phone2: String(i.Phone2 || '').trim(),
      Address: String(i.Address || '').trim(),
      Referrer: String(i.Referrer || '').trim(),
      InterviewDate: String(i.InterviewDate || i.Date || '').trim(),
      InterviewTime: String(i.InterviewTime || '').trim(),
      Priority: (i.Priority as any) || 'متوسط',
      Status: (i.Status as any) || 'مكتملة',
      DeputyNotes: String(i.DeputyNotes || '').trim(),
      Outcome: String(i.Outcome || '').trim(),
      ConvertedToRequest: i.ConvertedToRequest === true || i.ConvertedToRequest === 'نعم'
    }));

    const officialLetters: OfficialLetter[] = (sourceData.officialLetters || sourceData.letters || []).map((l: any) => ({
      Letter_ID: String(l.Letter_ID || l.id || '').trim(),
      LetterNumber: String(l.LetterNumber || l.Letter_Number || '').trim(),
      LetterDate: String(l.LetterDate || l.Letter_Date || '').trim(),
      Recipient: String(l.Recipient || l.To_Entity || '').trim(),
      Subject: String(l.Subject || '').trim(),
      Body: String(l.Body || '').trim(),
      Citizen_ID: l.Citizen_ID ? String(l.Citizen_ID).trim() : undefined,
      CitizenName: l.CitizenName ? String(l.CitizenName).trim() : undefined,
      Status: (l.Status as any) || 'صادر',
      ClerkName: String(l.ClerkName || '').trim()
    }));

    const cheques: ChequeRecord[] = (sourceData.cheques || []).map((ch: any) => ({
      id: String(ch.id || ch.Cheque_ID || '').trim(),
      ChequeNumber: String(ch.ChequeNumber || '').trim(),
      Citizen_ID: String(ch.Citizen_ID || '').trim(),
      CitizenName: String(ch.CitizenName || '').trim(),
      CitizenPhone: String(ch.CitizenPhone || '').trim(),
      Amount: Number(ch.Amount) || 0,
      AmountInWords: String(ch.AmountInWords || '').trim(),
      BankName: String(ch.BankName || '').trim(),
      Purpose: String(ch.Purpose || '').trim(),
      IssueDate: String(ch.IssueDate || '').trim(),
      Status: (ch.Status as any) || 'مصروف',
      BeneficiaryGender: 'ذكر',
      DependencyStatus: 'مستقل',
      AttendanceType: 'شخصياً',
      CreatedAt: String(ch.CreatedAt || new Date().toISOString().split('T')[0]).trim(),
      CreatedBy: String(ch.CreatedBy || 'Google Sheets').trim()
    }));

    const organizationRecords: OrganizationRecord[] = (sourceData.organizationRecords || sourceData.organizations || []).map((o: any) => ({
      Citizen_ID: String(o.Citizen_ID || '').trim(),
      FullName: String(o.FullName || '').trim(),
      District: String(o.District || '').trim(),
      SubDistrict: String(o.SubDistrict || '').trim(),
      Affiliation: String(o.Affiliation || '').trim(),
      Notes: String(o.Notes || '').trim(),
      LastUpdated: String(o.LastUpdated || o.UpdatedAt || '').trim(),
      OrgRating: (o.OrgRating || o.Rating || 'مؤيد') as any,
      EvaluationPoints: Number(o.EvaluationPoints) || 10,
      InfluenceType: (o.InfluenceType || 'شخصية مؤثرة') as any
    }));

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
      User_ID: String(u.User_ID || u.id || '').trim(),
      Username: String(u.Username || '').trim(),
      Password: String(u.Password || '').trim(),
      Phone: String(u.Phone || '').trim(),
      Role: (u.Role || 'reception') as any,
      RoleArabic: String(u.RoleArabic || u.Department || 'موظف').trim(),
      Status: u.Status === 'frozen' ? 'frozen' : 'active',
      FullName: String(u.FullName || u.Username || '').trim(),
      Department: String(u.Department || '').trim(),
      JobTitle: String(u.JobTitle || '').trim(),
      Permissions: parseStringArray(u.Permissions),
      AllowedSections: parseStringArray(u.AllowedSections),
      CreatedAt: String(u.CreatedAt || '').trim(),
      UpdatedAt: String(u.UpdatedAt || '').trim()
    })).filter((u: User) => Boolean(u.User_ID && u.Username));

    return {
      success: true,
      message: `تم بنجاح جلب (${citizens.length}) مراجع و (${requests.length}) معاملة عبر رابط Apps Script Webhook.`,
      data: {
        citizens,
        requests,
        interviews,
        officialLetters,
        cheques,
        organizationRecords,
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
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent('المستخدمين_Users')}!A2:L200`,
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
