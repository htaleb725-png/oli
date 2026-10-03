import { getAccessToken, pushSingleRecordToSheetsRealtime } from './googleSheetsService';

/**
 * Realtime Google Sheets and Google Drive Auto-Sync Service
 * Automatically pushes records as they are saved in the system
 * without requiring the user to manually click any sync button.
 */

export interface SyncPayload {
  entityType: 'citizens' | 'requests' | 'interviews' | 'organization' | 'letters' | 'cheques' | 'drive_archive' | 'dropdowns';
  action: 'insert' | 'update';
  data: any;
  timestamp: string;
}

// Queue for resilience
const syncQueue: SyncPayload[] = [];
let isProcessingQueue = false;

export async function pushToGoogleSheetsRealtime(
  entityType: 'citizens' | 'requests' | 'interviews' | 'organization' | 'letters' | 'cheques' | 'drive_archive' | 'dropdowns',
  data: any,
  action: 'insert' | 'update' = 'insert',
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

    // 1. Direct Google Sheets REST API sync via Developer Google OAuth token
    try {
      const token = await getAccessToken();
      const sheetId = targetSheetId || (typeof window !== 'undefined' ? (localStorage.getItem('al_nashi_sheet_id') || '') : '');
      if (token && sheetId) {
        await pushSingleRecordToSheetsRealtime(token, sheetId, item.entityType, item.data);
      }
    } catch (e) {
      console.warn('Realtime Direct Google Sheets sync notification:', e);
    }

    // 2. Webhook / Apps Script Web App sync (if configured)
    const targetUrl = customUrl || (typeof window !== 'undefined' ? (localStorage.getItem('al_nashi_apps_script_url') || '') : '');

    if (targetUrl && targetUrl.startsWith('http')) {
      try {
        await fetch(targetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json'
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
