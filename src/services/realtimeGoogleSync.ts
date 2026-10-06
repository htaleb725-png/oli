import { getAccessToken, pushSingleRecordToSheetsRealtime } from './googleSheetsService';

/**
 * Realtime Google Sheets and Google Drive Auto-Sync Service
 * Automatically pushes records as they are saved in the system
 * without requiring the user to manually click any sync button.
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

    // 1. Direct Google Sheets REST API sync via Developer Google OAuth token
    if (resolvedSheetId) {
      try {
        const token = await getAccessToken();
        if (token) {
          await pushSingleRecordToSheetsRealtime(token, resolvedSheetId, item.entityType, item.data);
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
            action: item.action === 'insert' ? 'appendRow' : 'updateRow',
            sheetType: item.entityType,
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
export async function pullDataFromGoogleAppsScript(appsScriptUrl: string): Promise<any> {
  if (!appsScriptUrl || !appsScriptUrl.startsWith('http')) return null;
  try {
    const separator = appsScriptUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${appsScriptUrl}${separator}action=getAllData`, {
      method: 'GET'
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data;
  } catch (err) {
    console.warn('pullDataFromGoogleAppsScript error:', err);
    return null;
  }
}
