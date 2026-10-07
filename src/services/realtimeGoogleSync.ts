import { getAccessToken, pushSingleRecordToSheetsRealtime, deleteRecordFromSheetsRealtime } from './googleSheetsService';
import { Citizen, OfficeRequest, Interview, OfficialLetter, OrganizationRecord, ChequeRecord } from '../types';

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
  | 'drive_archive' 
  | 'dropdowns'
  | 'custom_sections'
  | 'custom_records';

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

// Helper to reliably resolve Google Sheet ID from multiple fallbacks
export function resolveTargetSheetId(customSheetId?: string): string {
  if (customSheetId && customSheetId.trim()) return customSheetId.trim();
  if (typeof window !== 'undefined') {
    const direct = localStorage.getItem('al_nashi_sheet_id');
    if (direct && direct.trim()) return direct.trim();
    try {
      const savedSettings = localStorage.getItem('al_nashi_office_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.googleSheetId && parsed.googleSheetId.trim()) return parsed.googleSheetId.trim();
        if (parsed.activeGoogleSheetId && parsed.activeGoogleSheetId.trim()) return parsed.activeGoogleSheetId.trim();
      }
    } catch {}
  }
  return '';
}

// Helper to reliably resolve Apps Script Webhook URL from multiple fallbacks
export function resolveAppsScriptUrl(customUrl?: string): string {
  if (customUrl && customUrl.trim()) return customUrl.trim();
  if (typeof window !== 'undefined') {
    const direct = localStorage.getItem('al_nashi_apps_script_url');
    if (direct && direct.trim()) return direct.trim();
    try {
      const savedSettings = localStorage.getItem('al_nashi_office_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.appsScriptUrl && parsed.appsScriptUrl.trim()) return parsed.appsScriptUrl.trim();
        if (parsed.googleAppsScriptUrl && parsed.googleAppsScriptUrl.trim()) return parsed.googleAppsScriptUrl.trim();
      }
    } catch {}
  }
  return '';
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

    const targetId = item.data?.id || item.data?.Citizen_ID || item.data?.Request_ID || item.data?.Interview_ID || item.data?.Letter_ID || (typeof item.data === 'string' ? item.data : '');

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

    return {
      success: true,
      message: `تم بنجاح جلب (${citizens.length}) مراجع و (${requests.length}) معاملة عبر رابط Apps Script Webhook.`,
      data: {
        citizens,
        requests,
        interviews,
        officialLetters,
        cheques,
        organizationRecords
      }
    };
  } catch (err: any) {
    console.warn('pullDataFromGoogleAppsScript error:', err);
    return null;
  }
}
