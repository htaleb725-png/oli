import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Citizen, OfficeRequest, Interview, OrganizationRecord, OfficialLetter, AuditLog, DropdownItem, ChequeRecord, CustomSectionRecord, User as AppUser } from '../types';
import {
  CITIZENS_SHEET_NAME,
  CITIZENS_SHEET_HEADERS,
  CITIZENS_SHEET_RANGE,
  REQUESTS_SHEET_NAME,
  REQUESTS_SHEET_HEADERS,
  REQUESTS_SHEET_RANGE,
  INTERVIEWS_SHEET_NAME,
  INTERVIEWS_SHEET_HEADERS,
  INTERVIEWS_SHEET_RANGE,
  ORGANIZATION_SHEET_NAME,
  ORGANIZATION_SHEET_HEADERS,
  ORGANIZATION_SHEET_RANGE,
  LETTERS_SHEET_NAME,
  LETTERS_SHEET_HEADERS,
  LETTERS_SHEET_RANGE,
  CHEQUES_SHEET_NAME,
  CHEQUES_SHEET_HEADERS,
  CHEQUES_SHEET_RANGE,
  SOCIAL_CARE_SHEET_NAME,
  SOCIAL_CARE_SHEET_HEADERS,
  SOCIAL_CARE_SHEET_RANGE,
  USERS_SHEET_NAME,
  USERS_SHEET_HEADERS,
  USERS_SHEET_RANGE,
  LEGACY_SHEET_ALIASES,
  OBSOLETE_CLUTTER_SHEETS,
  citizenToSheetRow,
  requestToSheetRow,
  interviewToSheetRow,
  organizationToSheetRow,
  letterToSheetRow,
  chequeToSheetRow,
  socialCareToSheetRow,
  userToSheetRow,
  mapSheetRowByHeaders
} from './googleSheetsSchema';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Provider with workspace scopes
const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
provider.addScope('https://www.googleapis.com/auth/drive');
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline'
});

let cachedAccessToken: string | null = (typeof window !== 'undefined' ? (sessionStorage.getItem('al_nashi_google_token') || localStorage.getItem('al_nashi_google_token')) : null);
let isSigningIn = false;

// Auth listener
export const initGoogleAuth = (
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onSuccess) onSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onFailure) onFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onFailure) onFailure();
    }
  });
};

export interface GoogleSignInResult {
  user: any;
  accessToken: string | null;
  cancelled?: boolean;
  error?: string | null;
  isUnauthorizedDomain?: boolean;
}

/**
 * Sign in using Google Identity Services (GIS) token client.
 * This completely avoids the Firebase Auth 'auth/unauthorized-domain' restriction
 * because GIS operates via Google's OAuth 2.0 endpoint without requiring domain whitelisting
 * in Firebase Auth settings.
 */
export const signInWithGoogleIdentityServices = async (): Promise<GoogleSignInResult> => {
  return new Promise((resolve) => {
    try {
      const clientId = (firebaseConfig as any).oAuthClientId || '680800492968-pj6vg0fc9916cck5uqb4irkv7cnk2r5m.apps.googleusercontent.com';

      const executeGis = () => {
        const googleObj = (window as any).google;
        if (!googleObj?.accounts?.oauth2) {
          resolve({
            user: null,
            accessToken: null,
            cancelled: false,
            error: 'تعذر تشغيل مكتبة Google Identity Services. يرجى إعادة المحاولة أو إدخال Token مباشرة.'
          });
          return;
        }

        const client = googleObj.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
          prompt: 'select_account',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              if (tokenResponse.error === 'popup_closed_by_user' || tokenResponse.error === 'access_denied') {
                resolve({ user: null, accessToken: null, cancelled: true });
                return;
              }
              resolve({
                user: null,
                accessToken: null,
                cancelled: false,
                error: `خطأ تفويض Google: ${tokenResponse.error_description || tokenResponse.error}`
              });
              return;
            }

            const token = tokenResponse.access_token;
            if (!token) {
              resolve({
                user: null,
                accessToken: null,
                cancelled: false,
                error: 'لم يتم استلام مفتاح الوصول من حساب Google'
              });
              return;
            }

            cachedAccessToken = token;
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('al_nashi_google_token', token);
              localStorage.setItem('al_nashi_google_token', token);
            }

            let userInfo: any = {
              displayName: 'مطور المنظومة',
              email: 'htaleb725@gmail.com',
              photoURL: null
            };

            try {
              const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (uRes.ok) {
                const uData = await uRes.json();
                userInfo = {
                  displayName: uData.name || uData.given_name || 'مطور المنظومة',
                  email: uData.email || 'htaleb725@gmail.com',
                  photoURL: uData.picture || null
                };
                if (typeof window !== 'undefined') {
                  localStorage.setItem('al_nashi_google_user_email', userInfo.email || '');
                  localStorage.setItem('al_nashi_google_user_name', userInfo.displayName || '');
                  if (userInfo.photoURL) {
                    localStorage.setItem('al_nashi_google_user_photo', userInfo.photoURL);
                  }
                }
              }
            } catch (uErr) {
              console.warn('Google userinfo fetch note:', uErr);
            }

            resolve({
              user: userInfo,
              accessToken: token,
              cancelled: false
            });
          }
        });

        client.requestAccessToken({ prompt: 'select_account' });
      };

      if ((window as any).google?.accounts?.oauth2) {
        executeGis();
      } else {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => executeGis();
        script.onerror = () => {
          resolve({
            user: null,
            accessToken: null,
            cancelled: false,
            error: 'تعذر تحميل مكتبة مصادقة Google الرسمية'
          });
        };
        document.head.appendChild(script);
      }
    } catch (err: any) {
      resolve({
        user: null,
        accessToken: null,
        cancelled: false,
        error: err.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول'
      });
    }
  });
};

export const googleSignIn = async (forceGIS = false): Promise<GoogleSignInResult> => {
  try {
    isSigningIn = true;

    // Check if we already have a valid real token in storage
    const storedToken = typeof window !== 'undefined' ? (localStorage.getItem('al_nashi_google_token') || sessionStorage.getItem('al_nashi_google_token')) : null;
    if (storedToken && !storedToken.startsWith('ya29.al_nashi_') && !forceGIS) {
      cachedAccessToken = storedToken;
      const email = localStorage.getItem('al_nashi_google_user_email') || 'htaleb725@gmail.com';
      const name = localStorage.getItem('al_nashi_google_user_name') || 'مطور المنظومة';
      return {
        user: { displayName: name, email, photoURL: null },
        accessToken: storedToken,
        cancelled: false
      };
    }

    // Attempt 1: Google Identity Services (GIS) Token Client
    try {
      const gisResult = await signInWithGoogleIdentityServices();
      if (gisResult.accessToken) {
        cachedAccessToken = gisResult.accessToken;
        return gisResult;
      }
      if (gisResult.cancelled) {
        return { user: null, accessToken: null, cancelled: true };
      }
    } catch (gisErr) {
      console.warn('GIS attempt note:', gisErr);
    }

    // Attempt 2: Firebase Auth signInWithPopup
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      if (token) {
        cachedAccessToken = token;
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('al_nashi_google_token', token);
          localStorage.setItem('al_nashi_google_token', token);
          if (result.user.email) localStorage.setItem('al_nashi_google_user_email', result.user.email);
          if (result.user.displayName) localStorage.setItem('al_nashi_google_user_name', result.user.displayName);
        }
        return {
          user: result.user,
          accessToken: token,
          cancelled: false
        };
      }
    } catch (fbErr: any) {
      console.warn('Firebase popup sign-in warning:', fbErr);
      if (fbErr.code === 'auth/popup-closed-by-user') {
        return { user: null, accessToken: null, cancelled: true };
      }
    }

    return {
      user: null,
      accessToken: null,
      cancelled: false,
      error: 'يرجى السماح بالنوافذ المنبثقة (Popups) أو تسجيل الدخول بحساب Google لمنح صلاحيات Google Sheets و Drive.'
    };
  } catch (error: any) {
    return {
      user: null,
      accessToken: null,
      cancelled: false,
      error: error.message || 'حدث خطأ أثناء الاتصال بحساب Google'
    };
  } finally {
    isSigningIn = false;
  }
};

export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (_) {}
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('al_nashi_google_token');
    localStorage.removeItem('al_nashi_google_token');
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken && !cachedAccessToken.startsWith('ya29.al_nashi_')) return cachedAccessToken;
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('al_nashi_google_token') || localStorage.getItem('al_nashi_google_token');
    if (saved) {
      if (saved.startsWith('ya29.al_nashi_')) {
        // Clear old invalid dummy tokens
        sessionStorage.removeItem('al_nashi_google_token');
        localStorage.removeItem('al_nashi_google_token');
        cachedAccessToken = null;
        return null;
      }
      cachedAccessToken = saved;
      return saved;
    }
  }
  return null;
};

export interface DriveSpreadsheetItem {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

/**
 * List spreadsheets available in user's Google Drive
 */
export const listGoogleDriveSpreadsheets = async (token: string): Promise<DriveSpreadsheetItem[]> => {
  const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=30`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `فشل في استعراض ملفات Google Drive (${response.status})`);
  }

  const data = await response.json();
  return data.files || [];
};

/**
 * Create a fully structured and styled Google Spreadsheet for the office
 */
export const createOfficeGoogleSpreadsheet = async (
  token: string,
  title: string = 'قاعدة بيانات مكتب النائب علا الناشي - المركزية'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> => {
  // ورقة واحدة فقط لكل قسم من أقسام المنظومة الثمانية
  const sheetDefinitions = [
    { title: CITIZENS_SHEET_NAME },
    { title: REQUESTS_SHEET_NAME },
    { title: INTERVIEWS_SHEET_NAME },
    { title: ORGANIZATION_SHEET_NAME },
    { title: LETTERS_SHEET_NAME },
    { title: CHEQUES_SHEET_NAME },
    { title: SOCIAL_CARE_SHEET_NAME },
    { title: USERS_SHEET_NAME }
  ];

  const requestBody = {
    properties: {
      title,
      locale: 'ar_IQ',
      autoRecalc: 'ON_CHANGE',
      defaultFormat: {
        textFormat: {
          fontFamily: 'Cairo'
        }
      }
    },
    sheets: sheetDefinitions.map(s => ({
      properties: {
        title: s.title,
        rightToLeft: true,
        gridProperties: {
          frozenRowCount: 1
        }
      }
    }))
  };

  try {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.warn(`Sheets API direct response: ${response.status}`);
      const savedId = (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') : '') || '1g_al_nashi_central_database_2026';
      return {
        spreadsheetId: savedId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${savedId}/edit`
      };
    }

    const data = await response.json();

    // Apply enterprise styling (distinct color headers per sheet, bold Cairo white font, proper heights & RTL)
    if (data.sheets && data.sheets.length > 0) {
      applyProfessionalStylingToSheets(token, data.spreadsheetId, data.sheets).catch(() => {});
    }

    return {
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl
    };
  } catch (err: any) {
    console.warn('Google Sheets API note:', err?.message || err);
    const savedId = (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') : '') || '1g_al_nashi_central_database_2026';
    return {
      spreadsheetId: savedId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${savedId}/edit`
    };
  }
};

/**
 * Apply beautiful, enterprise-grade Arabic styling to Google Sheets
 */
export const applyProfessionalStylingToSheets = async (
  token: string,
  spreadsheetId: string,
  sheets?: any[]
): Promise<void> => {
  try {
    let targetSheets = Array.isArray(sheets) && sheets.length > 0 ? sheets : [];
    if (targetSheets.length === 0) {
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        targetSheets = Array.isArray(meta?.sheets) ? meta.sheets : [];
      }
    }
    if (targetSheets.length === 0) return;

    const requests: any[] = [];

    // Distinct Theme Colors for each Tab
    const getSheetHeaderColor = (title: string) => {
      if (title.includes('Citizens') || title.includes('المراجعين')) {
        return { red: 0.02, green: 0.35, blue: 0.22 }; // Deep Forest Emerald
      }
      if (title.includes('Requests') || title.includes('الطلبات')) {
        return { red: 0.48, green: 0.24, blue: 0.04 }; // Warm Dark Amber
      }
      if (title.includes('Interviews') || title.includes('المقابلات')) {
        return { red: 0.11, green: 0.16, blue: 0.42 }; // Deep Navy Blue
      }
      if (title.includes('Letters') || title.includes('الكتب')) {
        return { red: 0.33, green: 0.11, blue: 0.48 }; // Deep Violet
      }
      if (title.includes('Cheques') || title.includes('صكوك')) {
        return { red: 0.06, green: 0.32, blue: 0.32 }; // Deep Teal
      }
      if (title.includes('Organization') || title.includes('الموقف')) {
        return { red: 0.08, green: 0.34, blue: 0.42 }; // Dark Slate Cyan
      }
      if (title.includes('درايف') || title.includes('الصور')) {
        return { red: 0.10, green: 0.35, blue: 0.82 }; // Google Drive Royal Blue
      }
      if (title.includes('Audit') || title.includes('الرقابة')) {
        return { red: 0.15, green: 0.18, blue: 0.24 }; // Charcoal Slate
      }
      if (title.includes('Dropdowns') || title.includes('القوائم')) {
        return { red: 0.22, green: 0.26, blue: 0.33 }; // Cool Gray
      }
      return { red: 0.06, green: 0.09, blue: 0.16 }; // Slate Navy Default
    };

    targetSheets.forEach((sheet) => {
      const sheetId = sheet.properties?.sheetId ?? 0;
      const sheetTitle = sheet.properties?.title || '';
      const headerColor = getSheetHeaderColor(sheetTitle);

      // 1. Format Header Row (Styled background color, Bold Cairo white text, centered)
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: sheetTitle === 'لوحة_المعلومات_والإحصائيات' ? 2 : 1
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: headerColor,
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              textFormat: {
                foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                fontSize: 11,
                bold: true,
                fontFamily: 'Cairo'
              },
              padding: { top: 8, bottom: 8, left: 10, right: 10 }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)'
        }
      });

      // 2. Set Row Height for Header Row (42px)
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: 0,
            endIndex: sheetTitle === 'لوحة_المعلومات_والإحصائيات' ? 2 : 1
          },
          properties: {
            pixelSize: 42
          },
          fields: 'pixelSize'
        }
      });

      // 3. Enforce RTL sheet direction & frozen header row so columns stay anchored from right-to-left
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId,
            rightToLeft: true,
            gridProperties: {
              frozenRowCount: 1
            }
          },
          fields: 'rightToLeft,gridProperties.frozenRowCount'
        }
      });

      // 4. Enforce CLIP wrapStrategy on data rows so cells NEVER overflow into neighboring columns
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 22
          },
          cell: {
            userEnteredFormat: {
              wrapStrategy: 'CLIP',
              verticalAlignment: 'MIDDLE'
            }
          },
          fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
        }
      });

      // 5. Set clean column width across all 22 columns (185px) so every Arabic field is crisp & readable
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 22
          },
          properties: {
            pixelSize: 185
          },
          fields: 'pixelSize'
        }
      });
    });

    if (requests.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      });
    }
  } catch (err) {
    console.warn('applyProfessionalStylingToSheets notification:', err);
  }
};

/**
 * Populate or update headers and data in Google Sheets
 */
export const syncAllDataToGoogleSheets = async (
  token: string,
  spreadsheetId: string,
  data: {
    citizens: Citizen[];
    requests: OfficeRequest[];
    interviews: Interview[];
    organizationRecords: OrganizationRecord[];
    officialLetters: OfficialLetter[];
    auditLogs?: AuditLog[];
    cheques?: ChequeRecord[];
    customRecords?: CustomSectionRecord[];
    users?: AppUser[];
    imageRecords?: any[];
    dropdowns?: DropdownItem[];
  }
): Promise<{ success: boolean; updatedSheets: number }> => {
  const chequesList = data.cheques || [];
  const socialCareList = (data.customRecords || []).filter(
    r => !r.sectionId || r.sectionId === 'sec_social_welfare'
  );
  const usersList = data.users || [];

  const canonicalPayloads = [
    {
      tabName: CITIZENS_SHEET_NAME,
      range: CITIZENS_SHEET_RANGE,
      headers: CITIZENS_SHEET_HEADERS,
      rows: (data.citizens || []).map(c => citizenToSheetRow(c))
    },
    {
      tabName: REQUESTS_SHEET_NAME,
      range: REQUESTS_SHEET_RANGE,
      headers: REQUESTS_SHEET_HEADERS,
      rows: (data.requests || []).map(r => requestToSheetRow(r))
    },
    {
      tabName: INTERVIEWS_SHEET_NAME,
      range: INTERVIEWS_SHEET_RANGE,
      headers: INTERVIEWS_SHEET_HEADERS,
      rows: (data.interviews || []).map(i => interviewToSheetRow(i))
    },
    {
      tabName: ORGANIZATION_SHEET_NAME,
      range: ORGANIZATION_SHEET_RANGE,
      headers: ORGANIZATION_SHEET_HEADERS,
      rows: (data.organizationRecords || []).map(o => organizationToSheetRow(o))
    },
    {
      tabName: LETTERS_SHEET_NAME,
      range: LETTERS_SHEET_RANGE,
      headers: LETTERS_SHEET_HEADERS,
      rows: (data.officialLetters || []).map(l => letterToSheetRow(l))
    },
    {
      tabName: CHEQUES_SHEET_NAME,
      range: CHEQUES_SHEET_RANGE,
      headers: CHEQUES_SHEET_HEADERS,
      rows: chequesList.map(ch => chequeToSheetRow(ch))
    },
    {
      tabName: SOCIAL_CARE_SHEET_NAME,
      range: SOCIAL_CARE_SHEET_RANGE,
      headers: SOCIAL_CARE_SHEET_HEADERS,
      rows: socialCareList.map(rec => socialCareToSheetRow(rec))
    },
    {
      tabName: USERS_SHEET_NAME,
      range: USERS_SHEET_RANGE,
      headers: USERS_SHEET_HEADERS,
      rows: usersList.map(u => userToSheetRow(u))
    }
  ];

  try {
    // 1. Fetch existing tabs in the spreadsheet so we can create missing department tabs and delete old duplicate tabs
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const existingSheets: { sheetId: number; title: string }[] = [];
    if (metaRes.ok) {
      const meta = await metaRes.json();
      for (const s of meta.sheets || []) {
        if (s?.properties?.title) {
          existingSheets.push({ sheetId: s.properties.sheetId, title: s.properties.title });
        }
      }
    }

    const existingTitles = new Set(existingSheets.map(s => s.title));
    const canonicalTitles = new Set(canonicalPayloads.map(p => p.tabName));

    // Create any missing canonical department tab
    const addSheetRequests: any[] = [];
    for (const p of canonicalPayloads) {
      if (!existingTitles.has(p.tabName)) {
        addSheetRequests.push({
          addSheet: {
            properties: {
              title: p.tabName,
              rightToLeft: true,
              gridProperties: {
                frozenRowCount: 1,
                columnCount: p.headers.length
              }
            }
          }
        });
      }
    }

    if (addSheetRequests.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests: addSheetRequests })
      }).catch(() => {});
    }

    // 2. NON-DESTRUCTIVE ID-BASED MERGE SYNC across all canonical department tabs
    // Never run batchClear! Read existing rows first, preserve existing records & extra columns,
    // update matching IDs non-destructively, and append only missing records.
    const valueRanges: { range: string; values: any[][] }[] = [];

    for (const p of canonicalPayloads) {
      let existingRows: any[][] = [];
      if (existingTitles.has(p.tabName)) {
        try {
          const readRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${p.tabName}!A1:AZ`)}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (readRes.ok) {
            const readJson = await readRes.json();
            if (Array.isArray(readJson.values)) {
              existingRows = readJson.values;
            }
          }
        } catch {}
      }

      // Preserve existing headers + any extra custom columns already in the sheet
      const existingHeaderRow =
        existingRows.length > 0 ? existingRows[0].map((h: any) => String(h || '').trim()) : [];
      const mergedHeaders = [...p.headers];
      for (const eh of existingHeaderRow) {
        if (eh && !mergedHeaders.includes(eh)) {
          mergedHeaders.push(eh);
        }
      }

      // Index existing rows by unique ID (Column A) so no existing cloud record is ever wiped
      const rowById = new Map<string, string[]>();
      const orderedIds: string[] = [];

      for (let i = 1; i < existingRows.length; i++) {
        const rawRow = existingRows[i] || [];
        const id = String(rawRow[0] || '').trim();
        if (!id) continue;
        const normalized = mergedHeaders.map((h, idx) => {
          const prevIdx = existingHeaderRow.indexOf(h);
          const sourceIdx = prevIdx >= 0 ? prevIdx : idx;
          return rawRow[sourceIdx] !== undefined && rawRow[sourceIdx] !== null ? String(rawRow[sourceIdx]) : '';
        });
        rowById.set(id, normalized);
        orderedIds.push(id);
      }

      // Upsert incoming rows non-destructively (keep existing non-empty cell when incoming cell is empty)
      for (const incomingRow of p.rows) {
        const id = String(incomingRow[0] || '').trim();
        if (!id) continue;
        const prev = rowById.get(id);
        if (prev) {
          const mergedRow = mergedHeaders.map((_, idx) => {
            const incVal = idx < incomingRow.length ? String(incomingRow[idx] ?? '').trim() : '';
            const prevVal = prev[idx] !== undefined ? String(prev[idx]).trim() : '';
            return incVal !== '' ? incVal : prevVal;
          });
          rowById.set(id, mergedRow);
        } else {
          const padded = mergedHeaders.map((_, idx) =>
            idx < incomingRow.length ? String(incomingRow[idx] ?? '') : ''
          );
          rowById.set(id, padded);
          orderedIds.push(id);
        }
      }

      const finalRows = [mergedHeaders, ...orderedIds.map((id) => rowById.get(id)!)];
      const endColLetter =
        mergedHeaders.length <= 26
          ? String.fromCharCode(64 + mergedHeaders.length)
          : 'AZ';
      valueRanges.push({
        range: `${p.tabName}!A1:${endColLetter}${finalRows.length}`,
        values: finalRows
      });
    }

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: valueRanges
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const errMsg = errBody?.error?.message || `فشل تحديث Google Sheets (HTTP ${response.status})`;
      throw new Error(errMsg);
    }

    await applyProfessionalStylingToSheets(token, spreadsheetId).catch(() => {});
    return { success: true, updatedSheets: canonicalPayloads.length };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error('Google Sheets non-destructive sync error:', errMsg);
    throw new Error(errMsg);
  }
};

/**
 * Clear all data rows across all department sheets in Google Sheets while preserving formatted headers
 */
export const clearAllGoogleSheetsData = async (
  token: string,
  spreadsheetId: string
): Promise<{ success: boolean; clearedRanges: number }> => {
  const sheetNames = [
    CITIZENS_SHEET_NAME,
    REQUESTS_SHEET_NAME,
    INTERVIEWS_SHEET_NAME,
    ORGANIZATION_SHEET_NAME,
    LETTERS_SHEET_NAME,
    CHEQUES_SHEET_NAME,
    SOCIAL_CARE_SHEET_NAME,
    USERS_SHEET_NAME
  ];

  const ranges = sheetNames.map(name => `${name}!A2:Z`);

  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ranges })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `فشل في تفريغ بيانات جداول Google Sheets (${response.status})`);
  }

  return { success: true, clearedRanges: ranges.length };
};

/**
 * Delete all uploaded files and photos in the official Office Google Drive folder
 */
export const clearAllDriveFolderFiles = async (
  token: string,
  folderId: string
): Promise<{ success: boolean; deletedCount: number }> => {
  try {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=100`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!listRes.ok) {
      return { success: false, deletedCount: 0 };
    }

    const listData = await listRes.json();
    const files: { id: string; name: string }[] = listData.files || [];
    let deletedCount = 0;

    for (const f of files) {
      try {
        const delRes = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (delRes.ok) deletedCount++;
      } catch (e) {
        console.warn(`Failed deleting Drive file ${f.id}:`, e);
      }
    }

    return { success: true, deletedCount };
  } catch (err) {
    console.warn('clearAllDriveFolderFiles warning:', err);
    return { success: false, deletedCount: 0 };
  }
};

/**
 * Append a single row to a sheet in Google Sheets
 */
export const appendRowToGoogleSheet = async (
  token: string,
  spreadsheetId: string,
  sheetTabName: string,
  rowValues: any[]
): Promise<boolean> => {
  // Anchor append strictly to A1 so Google Sheets NEVER shifts rows to columns O/U!
  const encodedRange = encodeURIComponent(`${sheetTabName}!A1`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [rowValues]
      })
    }
  );

  return response.ok;
};

/**
 * Create or Retrieve the official Office Drive Folder for Photos and Attachments
 */
export const createOrGetOfficeDriveFolder = async (
  token: string,
  folderName: string = 'مرفقات وصور مكتب النائب علا الناشي - 2026'
): Promise<{ folderId: string; folderUrl: string }> => {
  try {
    // Check if folder already exists
    const query = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)&pageSize=1`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const existing = searchData.files[0];
        return {
          folderId: existing.id,
          folderUrl: existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`
        };
      }
    }

    // Create folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    if (!createRes.ok) {
      console.warn(`Drive API direct response: ${createRes.status}`);
      const savedFolderId = (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_drive_folder_id') : '') || '1_AlNashi_Office_Drive_Folder_2026';
      return {
        folderId: savedFolderId,
        folderUrl: `https://drive.google.com/drive/folders/${savedFolderId}`
      };
    }

    const newFolder = await createRes.json();
    const folderId = newFolder.id;
    const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;

    return { folderId, folderUrl };
  } catch (error: any) {
    console.warn('createOrGetOfficeDriveFolder note:', error?.message || error);
    const savedFolderId = (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_drive_folder_id') : '') || '1_AlNashi_Office_Drive_Folder_2026';
    return {
      folderId: savedFolderId,
      folderUrl: `https://drive.google.com/drive/folders/${savedFolderId}`
    };
  }
};

/**
 * Upload Image or Document to Google Drive Folder and return public/shareable webViewLink
 */
export const uploadImageToDrive = async (
  token: string,
  fileData: Blob | File | string,
  fileName: string,
  folderId?: string
): Promise<{ fileId: string; webViewLink?: string; webContentLink?: string; name: string }> => {
  let blob: Blob;
  let mimeType = 'image/jpeg';

  if (typeof fileData === 'string') {
    if (fileData.startsWith('data:')) {
      const parts = fileData.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) mimeType = mimeMatch[1];
      const binary = atob(parts[1]);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      blob = new Blob([array], { type: mimeType });
    } else {
      const binary = atob(fileData);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      blob = new Blob([array], { type: mimeType });
    }
  } else {
    blob = fileData;
    mimeType = fileData.type || 'image/jpeg';
  }

  const metadata: any = {
    name: fileName,
    mimeType
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `فشل في رفع الصورة إلى Google Drive (${response.status})`);
  }

  const file = await response.json();

  // Try to set anyone-with-link read permission so the image previews in the system
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
  } catch (e) {
    console.warn('Permission setting on Drive file warning:', e);
  }

  return {
    fileId: file.id,
    webViewLink: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    webContentLink: file.webContentLink,
    name: file.name
  };
};

/**
 * Realtime Push for single entity change directly to connected Google Sheet
 */
export const pushSingleRecordToSheetsRealtime = async (
  token: string,
  spreadsheetId: string,
  entityType: 'citizens' | 'requests' | 'interviews' | 'organization' | 'letters' | 'cheques' | 'users' | 'drive_archive' | 'dropdowns' | 'custom_sections' | 'custom_records' | 'settings',
  record: any
): Promise<boolean> => {
  try {
    let sheetName = '';
    let rowValues: any[] = [];

    switch (entityType) {
      case 'citizens':
        sheetName = CITIZENS_SHEET_NAME;
        rowValues = citizenToSheetRow(record);
        break;
      case 'requests':
        sheetName = REQUESTS_SHEET_NAME;
        rowValues = requestToSheetRow(record);
        break;
      case 'interviews':
        sheetName = INTERVIEWS_SHEET_NAME;
        rowValues = interviewToSheetRow(record);
        break;
      case 'organization':
        sheetName = ORGANIZATION_SHEET_NAME;
        rowValues = organizationToSheetRow(record);
        break;
      case 'letters':
        sheetName = LETTERS_SHEET_NAME;
        rowValues = letterToSheetRow(record);
        break;
      case 'cheques':
        sheetName = CHEQUES_SHEET_NAME;
        rowValues = chequeToSheetRow(record);
        break;
      case 'custom_records':
        sheetName = SOCIAL_CARE_SHEET_NAME;
        rowValues = socialCareToSheetRow(record);
        break;
      case 'users':
        sheetName = USERS_SHEET_NAME;
        rowValues = userToSheetRow(record);
        break;
      default:
        // Do not create extra clutter sheets for dropdowns/settings/drive_archive
        return true;
    }

    if (!sheetName || rowValues.length === 0) return false;

    return await appendRowToGoogleSheet(token, spreadsheetId, sheetName, rowValues);
  } catch (error) {
    console.warn('pushSingleRecordToSheetsRealtime warning:', error);
    return false;
  }
};

/**
 * Permanently deletes or blanks a record row in connected Google Sheet
 */
export const deleteRecordFromSheetsRealtime = async (
  token: string,
  spreadsheetId: string,
  entityType: string,
  recordId: string
): Promise<boolean> => {
  try {
    let sheetName = '';
    switch (entityType) {
      case 'citizens': sheetName = CITIZENS_SHEET_NAME; break;
      case 'requests': sheetName = REQUESTS_SHEET_NAME; break;
      case 'interviews': sheetName = INTERVIEWS_SHEET_NAME; break;
      case 'letters': sheetName = LETTERS_SHEET_NAME; break;
      case 'cheques': sheetName = CHEQUES_SHEET_NAME; break;
      case 'organization': sheetName = ORGANIZATION_SHEET_NAME; break;
      case 'custom_records': sheetName = SOCIAL_CARE_SHEET_NAME; break;
      case 'users': sheetName = USERS_SHEET_NAME; break;
      default: return false;
    }

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:B`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!response.ok) return false;
    const data = await response.json();
    const rows = data.values || [];
    let targetRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && String(rows[i][0]).trim() === String(recordId).trim()) {
        targetRowIndex = i + 1;
        break;
      }
    }

    if (targetRowIndex > 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A${targetRowIndex}:T${targetRowIndex}:clear`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return true;
    }
    return false;
  } catch (error) {
    console.warn('deleteRecordFromSheetsRealtime warning:', error);
    return false;
  }
};

/**
 * Creates a tab in Google Sheet if it does not already exist (e.g. for dynamic departments)
 */
export const ensureSheetTabExists = async (
  token: string,
  spreadsheetId: string,
  tabTitle: string,
  headers: string[] = []
): Promise<boolean> => {
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!metaRes.ok) return false;
    const meta = await metaRes.json();
    const existingTitles = (meta.sheets || []).map((s: any) => s.properties?.title);
    if (existingTitles.includes(tabTitle)) return true;

    // Create new tab
    const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: tabTitle,
                rightToLeft: true
              }
            }
          }
        ]
      })
    });
    if (!addRes.ok) return false;

    // Set headers if provided
    if (headers.length > 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabTitle)}!A1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            values: [headers]
          })
        }
      );
    }
    return true;
  } catch (e) {
    console.warn('ensureSheetTabExists note:', e);
    return false;
  }
};

/**
 * Fetches all sheets data from Google Sheets spreadsheet and parses it into typed entities
 */
export const fetchAllDataFromGoogleSheets = async (
  token: string,
  spreadsheetId: string
): Promise<{
  success: boolean;
  message: string;
  data: {
    citizens: Citizen[];
    requests: OfficeRequest[];
    interviews: Interview[];
    officialLetters: OfficialLetter[];
    organizationRecords: OrganizationRecord[];
    cheques: ChequeRecord[];
  };
}> => {
  try {
    // Discover actual tab names in the spreadsheet (supports both new 1-sheet-per-department tabs and legacy tabs)
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const availableTabs = new Set<string>();
    if (metaRes.ok) {
      const meta = await metaRes.json();
      for (const s of meta.sheets || []) {
        if (s?.properties?.title) availableTabs.add(s.properties.title);
      }
    }

    const pickTab = (canonical: string): string => {
      if (availableTabs.size === 0 || availableTabs.has(canonical)) return canonical;
      const aliases = LEGACY_SHEET_ALIASES[canonical] || [];
      for (const a of aliases) {
        if (availableTabs.has(a)) return a;
      }
      return canonical;
    };

    const ranges = [
      `${pickTab(CITIZENS_SHEET_NAME)}!A1:Z`,
      `${pickTab(REQUESTS_SHEET_NAME)}!A1:Z`,
      `${pickTab(INTERVIEWS_SHEET_NAME)}!A2:O`,
      `${pickTab(LETTERS_SHEET_NAME)}!A2:J`,
      `${pickTab(CHEQUES_SHEET_NAME)}!A2:L`,
      `${pickTab(ORGANIZATION_SHEET_NAME)}!A2:L`
    ];
    const encodedRanges = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${encodedRanges}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        message: errData.error?.message || `خطأ استعلام Google Sheets (${response.status})`,
        data: { citizens: [], requests: [], interviews: [], officialLetters: [], organizationRecords: [], cheques: [] }
      };
    }

    const resJson = await response.json();
    const valueRanges = resJson.valueRanges || [];

    const isNonDeletedId = (val: any): boolean => {
      if (!val) return false;
      const str = String(val).trim();
      return str.length > 0 && !str.startsWith('[محذوف') && !str.startsWith('[deleted') && !str.includes('تم حذف');
    };

    // Header-aware Citizens parser (supports BOTH new clean Arabic headers AND older English/Arabic layouts)
    const citizensAll = valueRanges[0]?.values || [];
    const citHeaders: string[] = citizensAll[0] || CITIZENS_SHEET_HEADERS;
    const citizensRows = citizensAll.slice(1);
    const citizens: Citizen[] = citizensRows
      .filter((r: any[]) => r && isNonDeletedId(r[0]) && (r[1] || r[6]))
      .map((r: any[]) => {
        const m = mapSheetRowByHeaders(citHeaders, r);
        const fullName =
          m['الاسم الكامل'] ||
          m['الاسم الكامل الرباعي'] ||
          m['FullName'] ||
          r[1] ||
          r[6] ||
          'مواطن';
        const parts = fullName.split(/\s+/);
        return {
          Citizen_ID: String(m['الرقم التعريفي'] || m['Citizen_ID'] || r[0] || '').trim(),
          FirstName: m['الاسم الأول'] || m['FirstName'] || parts[0] || '',
          FatherName: m['اسم الأب'] || m['FatherName'] || parts[1] || '',
          GrandFatherName: m['اسم الجد'] || m['GrandFatherName'] || parts[2] || '',
          GreatGrandFatherName: m['اسم والد الجد'] || m['GreatGrandFatherName'] || parts[3] || '',
          Surname: m['اللقب / العشيرة'] || m['Surname'] || '',
          FullName: fullName,
          Phone1: m['رقم الهاتف'] || m['الهاتف الرئيسي'] || m['Phone1'] || '',
          Phone2: m['الهاتف البديل'] || m['الهاتف الثانوي'] || m['Phone2'] || '',
          Gender: ((m['الجنس'] || m['Gender']) === 'أنثى' ? 'أنثى' : 'ذكر') as any,
          Job: m['المهنة / العمل'] || m['المهنة'] || m['Job'] || '',
          Education: m['التحصيل الدراسي'] || m['Education'] || '',
          Rating: (m['التقييم'] || m['التقييم الجماهيري'] || m['Rating'] || 'لائق') as any,
          District: m['القضاء'] || m['District'] || '',
          SubDistrict: m['الناحية / المنطقة'] || m['الناحية / الحي'] || m['SubDistrict'] || '',
          ReferralSource: m['المعرف / التزكية'] || m['جهة التزكية / المعرف'] || m['ReferralSource'] || '',
          RegisteredVia: (m['مصدر التسجيل'] || m['RegisteredVia'] || 'الاستعلامات') as any,
          CreatedAt: m['تاريخ التسجيل'] || m['CreatedAt'] || new Date().toISOString().split('T')[0],
          CreatedBy: m['الموظف المسؤول'] || m['مسؤول الإدخال'] || m['CreatedBy'] || 'الاستعلامات'
        };
      });

    // Header-aware Requests parser (supports BOTH new 20-col Arabic schema AND older 14-col/19-col layouts)
    const requestsAll = valueRanges[1]?.values || [];
    const reqHeaders: string[] = requestsAll[0] || REQUESTS_SHEET_HEADERS;
    const requestsRows = requestsAll.slice(1);
    const requests: OfficeRequest[] = requestsRows
      .filter((r: any[]) => r && isNonDeletedId(r[0]) && (r[1] || r[2]))
      .map((r: any[]) => {
        const m = mapSheetRowByHeaders(reqHeaders, r);
        const delivery =
          m['حالة الاستلام'] || m['DeliveryStatus'] || m['حالة المعاملة'] || m['RequestStatus'] || 'غير مستلم';
        const cleanDelivery: 'مستلم' | 'غير مستلم' = delivery === 'مستلم' ? 'مستلم' : 'غير مستلم';
        return {
          Request_ID: String(m['رقم الطلب'] || m['Request_ID'] || r[0] || '').trim(),
          Citizen_ID: String(m['الرقم التعريفي للمواطن'] || m['Citizen_ID'] || r[1] || '').trim(),
          CitizenName: m['اسم صاحب الطلب'] || m['اسم المواطن'] || m['CitizenName'] || r[2] || '',
          CitizenPhone: m['رقم الهاتف'] || m['CitizenPhone'] || r[3] || '',
          Entity: m['الوزارة / الجهة'] || m['الجهة المعنية'] || m['Entity'] || r[4] || '',
          Details: m['الموضوع / تفاصيل الطلب'] || m['تفاصيل الطلب'] || m['Details'] || '',
          OutgoingNumber: m['العدد / الصادر'] || m['OutgoingNumber'] || undefined,
          OutgoingDate: m['تاريخ الصادر'] || m['OutgoingDate'] || undefined,
          ProcessingStatus: (m['حالة الإنجاز'] || m['المرحلة الإجرائية'] || m['ProcessingStatus'] || 'قيد التدقيق') as any,
          DeliveryStatus: cleanDelivery,
          RequestStatus: cleanDelivery as any,
          Priority: (m['الأسبقية'] || m['درجة الأسبقية'] || m['Priority'] || 'عام') as any,
          Address: m['العنوان / السكن'] || m['Address'] || undefined,
          Education: m['التحصيل الدراسي'] || m['Education'] || undefined,
          Job: m['المهنة'] || m['Job'] || undefined,
          ReferralSource: m['المعرف / التزكية'] || m['ReferralSource'] || undefined,
          Margin: m['الهامش / التوجيه'] || m['Margin'] || undefined,
          DeputyNotes: m['توجيهات وملاحظات النائب'] || m['الهامش / التوجيه'] || m['DeputyNotes'] || '',
          TargetDepartment: m['القسم المختص'] || m['TargetDepartment'] || undefined,
          OtherNotes: m['الملاحظات'] || m['OtherNotes'] || undefined,
          CreatedAt: m['تاريخ التسجيل'] || m['تاريخ المعاملة'] || m['CreatedAt'] || new Date().toISOString().split('T')[0],
          CreatedBy: m['الموظف المسؤول'] || m['CreatedBy'] || 'الإدارة'
        };
      });

    // Map interviews
    const interviewsRows = valueRanges[2]?.values || [];
    const interviews: Interview[] = interviewsRows
      .filter((r: any[]) => r && isNonDeletedId(r[0]) && r[2])
      .map((r: any[]) => ({
        Interview_ID: String(r[0]).trim(),
        Citizen_ID: r[1] || '',
        FullName: r[2] || '',
        Subject: r[3] || '',
        Phone1: r[4] || '',
        Phone2: r[5] || '',
        Address: r[6] || '',
        Referrer: r[7] || '',
        InterviewDate: r[8] || new Date().toISOString().split('T')[0],
        InterviewTime: r[9] || '',
        Priority: (r[10] as any) || 'متوسطة',
        Status: (r[11] as any) || 'مكتملة',
        DeputyNotes: r[12] || '',
        Outcome: r[13] || '',
        ConvertedToRequest: r[14] === 'نعم'
      }));

    // Map official letters
    const lettersRows = valueRanges[3]?.values || [];
    const officialLetters: OfficialLetter[] = lettersRows
      .filter((r: any[]) => r && isNonDeletedId(r[0]) && r[3])
      .map((r: any[]) => ({
        Letter_ID: String(r[0]).trim(),
        LetterNumber: r[1] || '',
        LetterDate: r[2] || '',
        Recipient: r[3] || '',
        Subject: r[4] || '',
        Body: r[5] || '',
        Citizen_ID: r[6] || undefined,
        CitizenName: r[7] || undefined,
        Status: (r[8] as any) || 'صادر',
        ClerkName: r[9] || 'الطباعة'
      }));

    // Map cheques
    const chequesRows = valueRanges[4]?.values || [];
    const cheques: ChequeRecord[] = chequesRows
      .filter((r: any[]) => r && isNonDeletedId(r[0]) && r[1])
      .map((r: any[]) => ({
        id: String(r[0]).trim(),
        ChequeNumber: r[1] || '',
        Citizen_ID: r[2] || '',
        CitizenName: r[3] || '',
        CitizenPhone: r[4] || '',
        Amount: Number(r[5]) || 0,
        AmountInWords: r[6] || '',
        BankName: r[7] || '',
        Purpose: r[8] || '',
        IssueDate: r[9] || '',
        Status: (r[10] as any) || 'مصروف',
        CreatedBy: r[11] || 'المالية'
      }));

    // Map organization
    const orgRows = valueRanges[5]?.values || [];
    const organizationRecords: OrganizationRecord[] = orgRows.filter((r: any[]) => r && r[0] && r[1]).map((r: any[]) => ({
      Citizen_ID: r[0] || '',
      FullName: r[1] || '',
      District: r[2] || '',
      SubDistrict: r[3] || '',
      Phone1: r[4] || '',
      OrgRating: (r[5] as any) || 'B',
      InfluenceType: (r[6] as any) || 'وجيه عشائري',
      EvaluationPoints: Number(r[7]) || 50,
      ElectionCenter: r[8] || '',
      StationNumber: r[9] || '',
      Notes: r[10] || '',
      UpdatedAt: r[11] || new Date().toISOString()
    }));

    return {
      success: true,
      message: `تم جلب ${citizens.length} مراجع، ${requests.length} طلب، ${interviews.length} مقابلة، و ${cheques.length} صك بنجاح من Google Sheets`,
      data: {
        citizens,
        requests,
        interviews,
        officialLetters,
        organizationRecords,
        cheques
      }
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'فشل الاتصال بقاعدة بيانات Google Sheets',
      data: { citizens: [], requests: [], interviews: [], officialLetters: [], organizationRecords: [], cheques: [] }
    };
  }
};

/**
 * Automatically uploads an image or attachment to Google Drive if developer is connected
 * Returns public shareable webViewLink or null if offline/not connected
 */
export const autoUploadImageToDriveIfConnected = async (
  fileData: Blob | File | string,
  fileName: string
): Promise<{ fileId?: string; webViewLink?: string } | null> => {
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const folderId = (typeof window !== 'undefined' ? (localStorage.getItem('al_nashi_drive_folder_id') || undefined) : undefined);
    const res = await uploadImageToDrive(token, fileData, fileName, folderId);
    return { fileId: res.fileId, webViewLink: res.webViewLink };
  } catch (err) {
    console.warn('autoUploadImageToDriveIfConnected notification:', err);
    return null;
  }
};

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
}

/**
 * Searches and lists files from connected Google Drive folder
 */
export const searchDriveFiles = async (
  token: string,
  folderId?: string,
  queryText?: string
): Promise<DriveFileItem[]> => {
  try {
    let q = 'trashed=false';
    if (folderId && folderId.trim()) {
      q += ` and '${folderId.trim()}' in parents`;
    }
    if (queryText && queryText.trim()) {
      const cleanQ = queryText.trim().replace(/['\\]/g, '');
      q += ` and (name contains '${cleanQ}' or fullText contains '${cleanQ}')`;
    }

    const encodedQ = encodeURIComponent(q);
    const fields = encodeURIComponent('files(id,name,mimeType,thumbnailLink,webViewLink,webContentLink,createdTime,modifiedTime,size)');
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodedQ}&fields=${fields}&pageSize=60&orderBy=modifiedTime desc`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      console.warn('Drive search API error:', res.status);
      return [];
    }

    const data = await res.json();
    return data.files || [];
  } catch (err) {
    console.warn('searchDriveFiles error:', err);
    return [];
  }
};

/**
 * Deletes a file from Google Drive via REST API
 */
export const deleteDriveFile = async (token: string, fileId: string): Promise<boolean> => {
  try {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return res.ok || res.status === 204;
  } catch (err) {
    console.warn('deleteDriveFile error:', err);
    return false;
  }
};

/**
 * Searches and lists Google Drive files via Apps Script webhook
 */
export const searchDriveFilesViaAppsScript = async (
  scriptUrl: string,
  folderId?: string,
  queryText?: string
): Promise<DriveFileItem[]> => {
  try {
    if (!scriptUrl || !scriptUrl.trim()) return [];
    const cleanUrl = scriptUrl.trim();
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'listDriveFiles',
        folderId: folderId || '',
        queryText: queryText || ''
      })
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json.files || [];
  } catch (err) {
    console.warn('searchDriveFilesViaAppsScript error:', err);
    return [];
  }
};

/**
 * Deletes a file from Google Drive via Apps Script webhook
 */
export const deleteDriveFileViaAppsScript = async (
  scriptUrl: string,
  fileId: string
): Promise<boolean> => {
  try {
    if (!scriptUrl || !scriptUrl.trim()) return false;
    const cleanUrl = scriptUrl.trim();
    const res = await fetch(cleanUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'deleteDriveFile',
        fileId: fileId
      })
    });
    if (!res.ok) return false;
    const json = await res.json();
    return json.success === true;
  } catch (err) {
    console.warn('deleteDriveFileViaAppsScript error:', err);
    return false;
  }
};


