/**
 * Google Sheets & Google Drive Direct Integration Layer (هيكل ربط قاعدة البيانات السحابية)
 * -------------------------------------------------------------------------------------
 * A dedicated integration layer that connects the application directly to Google Sheets
 * and Google Drive via their official REST APIs.
 * 
 * Capabilities:
 * 1. Direct CRUD operations (Read, Write, Update, Delete) on Citizens and Requests in Google Sheets.
 * 2. Precise row indexing & mapping: finds records by primary key (Citizen_ID, Request_ID) and updates in-place.
 * 3. Direct Google Drive file storage: uploads citizen photos and scanner attachments to Drive and links them.
 * 4. Automatic table schema provisioning: creates all required tabs and styled headers if missing.
 * 5. Full replacement for any external database engine (No Firebase, No Supabase).
 */

import { Citizen, OfficeRequest, Interview, OfficialLetter, OrganizationRecord, ChequeRecord, AuditLog } from '../types';
import { 
  getAccessToken, 
  createOfficeGoogleSpreadsheet, 
  createOrGetOfficeDriveFolder, 
  syncAllDataToGoogleSheets 
} from './googleSheetsService';

export interface IntegrationStatus {
  isConnected: boolean;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  driveFolderId: string | null;
  userEmail: string | null;
  lastSyncTime: string | null;
  syncState: 'idle' | 'reading' | 'writing' | 'syncing' | 'error';
  errorMessage: string | null;
}

export type IntegrationLogListener = (log: string) => void;

class SheetsIntegrationLayer {
  private listeners: Set<IntegrationLogListener> = new Set();
  private statusListeners: Set<(status: IntegrationStatus) => void> = new Set();
  
  private status: IntegrationStatus = {
    isConnected: false,
    spreadsheetId: null,
    spreadsheetUrl: null,
    driveFolderId: null,
    userEmail: null,
    lastSyncTime: null,
    syncState: 'idle',
    errorMessage: null
  };

  // Sheet Tab Names (Arabic formal convention)
  public readonly TABS = {
    DASHBOARD: 'لوحة_المعلومات_والإحصائيات',
    CITIZENS: 'سجل_المراجعين_Citizens',
    REQUESTS: 'طلبات_المواطنين_Requests',
    INTERVIEWS: 'مقابلات_النائب_Interviews',
    LETTERS: 'الكتب_الرسمية_OfficialLetters',
    CHEQUES: 'صكوك_المساعدات_المالية_Cheques',
    ORGANIZATION: 'السجل_التنظيمي_الجماهيري_Org',
    AUDIT_LOGS: 'سجل_الرقابة_والتدقيق_AuditLogs'
  };

  // Citizens Column Headers (A to R)
  public readonly CITIZENS_HEADERS = [
    'الرقم التعريفي (Citizen_ID)',
    'الاسم الأول',
    'اسم الأب',
    'اسم الجد',
    'اسم والد الجد',
    'اللقب / العشيرة',
    'الاسم الكامل الرباعي',
    'الهاتف الرئيسي',
    'الهاتف الثانوي',
    'الجنس',
    'المهنة / العمل',
    'التحصيل الدراسي',
    'التقييم الجماهيري',
    'القضاء',
    'الناحية / الحي',
    'جهة التزكية / المعرف',
    'تاريخ التسجيل',
    'مسؤول الإدخال',
    'رابط الصورة في Google Drive'
  ];

  // Requests Column Headers (A to N)
  public readonly REQUESTS_HEADERS = [
    'رقم الطلب (Request_ID)',
    'الرقم التعريفي للمواطن',
    'اسم المواطن',
    'رقم الهاتف',
    'الجهة المعنية',
    'حالة المعاملة',
    'المرحلة الإجرائية',
    'درجة الأسبقية',
    'تفاصيل الطلب',
    'رابط كتاب الطلب (Drive)',
    'رابط كتاب الإجابة (Drive)',
    'توجيهات وملاحظات النائب',
    'تاريخ المعاملة',
    'الموظف المسؤول'
  ];

  constructor() {
    this.refreshLocalConfig();
  }

  // Refresh credentials & IDs from storage
  public refreshLocalConfig() {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('al_nashi_google_token') || sessionStorage.getItem('al_nashi_google_token');
    const sheetId = localStorage.getItem('al_nashi_sheet_id');
    const folderId = localStorage.getItem('al_nashi_drive_folder_id');
    const email = localStorage.getItem('al_nashi_google_user_email') || 'htaleb725@gmail.com';

    this.status = {
      ...this.status,
      isConnected: !!token && !!sheetId,
      spreadsheetId: sheetId,
      spreadsheetUrl: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null,
      driveFolderId: folderId,
      userEmail: email
    };
    this.notifyStatus();
  }

  public getStatus(): IntegrationStatus {
    return { ...this.status };
  }

  public subscribeStatus(listener: (status: IntegrationStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  public subscribeLogs(listener: IntegrationLogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private log(message: string) {
    const time = new Date().toLocaleTimeString('ar-IQ');
    const formatted = `[${time}] ${message}`;
    this.listeners.forEach(l => l(formatted));
  }

  private notifyStatus() {
    this.statusListeners.forEach(l => l(this.getStatus()));
  }

  private async getToken(): Promise<string> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('لم يتم العثور على رمز تفويض Google OAuth صالح. يرجى تسجيل الدخول بحساب Google أولاً.');
    }
    return token;
  }

  private getSpreadsheetId(): string {
    const sheetId = this.status.spreadsheetId || (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_sheet_id') : null);
    if (!sheetId) {
      throw new Error('لم يتم تحديد معرف جدول Google Sheets (Spreadsheet ID). يرجى ربط أو إنشاء جدول أولاً من لوحة المطور.');
    }
    return sheetId;
  }

  /* =========================================================================
     LOW-LEVEL GOOGLE SHEETS REST API OPERATIONS
     ========================================================================= */

  /**
   * Fetch raw rows from a Google Sheet range
   */
  public async getRangeValues(range: string): Promise<any[][]> {
    const token = await this.getToken();
    const sheetId = this.getSpreadsheetId();
    const encodedRange = encodeURIComponent(range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `فشل قراءة نطاق ${range} من Google Sheets`);
    }

    const data = await res.json();
    return data.values || [];
  }

  /**
   * Append rows to a sheet
   */
  public async appendRow(range: string, values: any[]): Promise<boolean> {
    const token = await this.getToken();
    const sheetId = this.getSpreadsheetId();
    const encodedRange = encodeURIComponent(range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [values]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `فشل إضافة صف جديد إلى Google Sheets`);
    }

    return true;
  }

  /**
   * Overwrite a specific range/row in Google Sheets
   */
  public async updateRangeValues(range: string, values: any[][]): Promise<boolean> {
    const token = await this.getToken();
    const sheetId = this.getSpreadsheetId();
    const encodedRange = encodeURIComponent(range);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `فشل تحديث البيانات في Google Sheets`);
    }

    return true;
  }

  /**
   * Find row index (1-based) by checking column A for the matching primary key ID
   */
  public async findRowIndexById(tabName: string, id: string): Promise<number | null> {
    try {
      const rows = await this.getRangeValues(`${tabName}!A:A`);
      for (let i = 0; i < rows.length; i++) {
        const cell = rows[i]?.[0];
        if (cell && String(cell).trim() === String(id).trim()) {
          return i + 1; // 1-based row index for Google Sheets API
        }
      }
      return null;
    } catch (e) {
      console.warn(`Could not find row index for ID ${id} in ${tabName}:`, e);
      return null;
    }
  }

  /**
   * Convert number index to column letter (A, B, ... Z, AA, AB...)
   */
  public getColumnLetter(colIndex: number): string {
    let temp = colIndex;
    let letter = '';
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  /**
   * Direct schema addition: Add a new dynamic field column directly into Google Sheets
   */
  public async addDynamicFieldColumn(section: string, fieldLabel: string): Promise<boolean> {
    try {
      const tabName = section === 'reception' 
        ? this.TABS.CITIZENS 
        : (section === 'admin' ? this.TABS.REQUESTS : (section === 'interviews' ? this.TABS.INTERVIEWS : this.TABS.ORGANIZATION));
      
      const headerRow = await this.getRangeValues(`${tabName}!1:1`);
      const existingHeaders = (headerRow[0] || []).map(h => String(h || '').trim());
      if (existingHeaders.includes(fieldLabel.trim())) {
        return true; // Already exists
      }

      const colIndex = existingHeaders.length;
      const colLetter = this.getColumnLetter(colIndex);
      await this.updateRangeValues(`${tabName}!${colLetter}1`, [[fieldLabel.trim()]]);
      this.log(`✓ تم إضافة عمود الحقل الجديد [${fieldLabel}] مباشرة في جدول Google Sheets (${tabName}) في العمود ${colLetter}.`);
      return true;
    } catch (e: any) {
      this.log(`⚠️ تعذر إضافة عمود الحقل الجديد في Sheets: ${e.message}`);
      return false;
    }
  }

  /**
   * Direct schema addition: Ensure a section tab exists in Google Sheets
   */
  public async ensureSectionTabExists(sectionName: string, headers?: string[]): Promise<boolean> {
    try {
      const token = await this.getToken();
      const sheetId = this.getSpreadsheetId();
      const cleanTitle = sectionName.trim().replace(/[:\\/?*[\]]/g, '_');

      // Check if sheet exists
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        const titles = (meta.sheets || []).map((s: any) => s.properties?.title);
        if (titles.includes(cleanTitle)) {
          return true; // Tab already exists
        }
      }

      // Add sheet
      const addRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
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
                  title: cleanTitle,
                  rightToLeft: true
                }
              }
            }
          ]
        })
      });

      if (addRes.ok) {
        const headerList = headers || ['الرقم التعريفي', 'الاسم', 'التفاصيل', 'تاريخ الإنشاء', 'الملاحظات'];
        await this.appendRow(`${cleanTitle}!1:1`, headerList);
        this.log(`✓ تم إنشاء تبويب القسم الجديد [${cleanTitle}] مباشرة في Google Sheets.`);
        return true;
      }
      return false;
    } catch (e: any) {
      this.log(`⚠️ تعذر إضافة تبويب القسم في Sheets: ${e.message}`);
      return false;
    }
  }

  /**
   * Create brand new Google Sheets & Google Drive database for a new user account
   */
  public async setupNewAccountWorkspace(
    token: string,
    userEmail: string,
    initialData: any
  ): Promise<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    folderId: string;
    folderUrl: string;
  }> {
    this.log(`جاري إنشاء وتهيئة قاعدة بيانات Google Sheets ومجلد Drive لحساب (${userEmail})...`);
    
    // 1. Create Google Drive folder for this user
    const folderRes = await createOrGetOfficeDriveFolder(token, 'مرفقات وصور مكتب النائب علا الناشي - 2026');
    const folderId = folderRes.folderId;
    const folderUrl = folderRes.folderUrl;
    
    // 2. Create brand new Google Sheets database for this user
    const sheetRes = await createOfficeGoogleSpreadsheet(token, 'قاعدة بيانات مكتب النائب علا الناشي - المركزية');
    const spreadsheetId = sheetRes.spreadsheetId;
    const spreadsheetUrl = sheetRes.spreadsheetUrl;

    // 3. Store in localStorage for this session
    if (typeof window !== 'undefined') {
      localStorage.setItem('al_nashi_google_token', token);
      localStorage.setItem('al_nashi_sheet_id', spreadsheetId);
      localStorage.setItem('al_nashi_drive_folder_id', folderId);
      localStorage.setItem('al_nashi_google_user_email', userEmail);
    }

    this.status = {
      ...this.status,
      isConnected: true,
      spreadsheetId,
      spreadsheetUrl,
      driveFolderId: folderId,
      userEmail,
      lastSyncTime: new Date().toLocaleTimeString('ar-IQ'),
      syncState: 'idle'
    };
    this.notifyStatus();

    // 4. Seed with initial system data directly
    try {
      await syncAllDataToGoogleSheets(token, spreadsheetId, initialData);
      this.log(`✓ تم بنجاح إنشاء وتجهيز قاعدة بيانات Google Sheets ومجلد Drive لحساب (${userEmail}).`);
    } catch (e: any) {
      this.log(`⚠️ تنبيه تعبئة البيانات في Sheets: ${e.message}`);
    }

    return { spreadsheetId, spreadsheetUrl, folderId, folderUrl };
  }

  /**
   * Zero / wipe all integration layer session data
   */
  public zeroLocalData() {
    this.status = {
      isConnected: false,
      spreadsheetId: null,
      spreadsheetUrl: null,
      driveFolderId: null,
      userEmail: null,
      lastSyncTime: null,
      syncState: 'idle',
      errorMessage: null
    };
    this.notifyStatus();
    this.log('تم تصفير وإنهاء جلسة الربط السحابي بالكامل.');
  }

  /**
   * Convert Citizen object to Google Sheets row array
   */
  private citizenToRow(c: Citizen): any[] {
    return [
      c.Citizen_ID || '',
      c.FirstName || '',
      c.FatherName || '',
      c.GrandFatherName || '',
      c.GreatGrandFatherName || '',
      c.Surname || '',
      c.FullName || '',
      c.Phone1 || '',
      c.Phone2 || '',
      c.Gender || 'ذكر',
      c.Job || '',
      c.Education || '',
      c.Rating || 'لائق',
      c.District || '',
      c.SubDistrict || '',
      c.ReferralSource || '',
      c.CreatedAt || new Date().toISOString().split('T')[0],
      c.CreatedBy || 'الاستعلامات',
      c.PhotoUrl || ''
    ];
  }

  /**
   * Parse Google Sheets row array into Citizen object
   */
  private rowToCitizen(row: any[]): Citizen {
    const fullName = String(row[6] || row[1] || '').trim();
    const names = fullName.split(' ');
    return {
      Citizen_ID: String(row[0] || '').trim(),
      FirstName: String(row[1] || names[0] || '').trim(),
      FatherName: String(row[2] || names[1] || '').trim(),
      GrandFatherName: String(row[3] || names[2] || '').trim(),
      GreatGrandFatherName: String(row[4] || names[3] || '').trim(),
      Surname: String(row[5] || names[names.length - 1] || '').trim(),
      FullName: fullName,
      Phone1: String(row[7] || '').trim(),
      Phone2: String(row[8] || '').trim(),
      Gender: (row[9] === 'أنثى' ? 'أنثى' : 'ذكر'),
      Job: String(row[10] || '').trim(),
      Education: String(row[11] || '').trim(),
      Rating: String(row[12] || 'لائق'),
      District: String(row[13] || '').trim(),
      SubDistrict: String(row[14] || '').trim(),
      ReferralSource: String(row[15] || '').trim(),
      CreatedAt: String(row[16] || new Date().toISOString().split('T')[0]).trim(),
      CreatedBy: String(row[17] || 'الاستعلامات').trim(),
      PhotoUrl: row[18] ? String(row[18]).trim() : undefined
    };
  }

  public readonly citizens = {
    /**
     * Read all citizens directly from Google Sheets
     */
    readAll: async (): Promise<Citizen[]> => {
      this.status.syncState = 'reading';
      this.notifyStatus();
      this.log('جاري قراءة سجلات المراجعين مباشرة من Google Sheets...');

      try {
        const rawRows = await this.getRangeValues(`${this.TABS.CITIZENS}!A2:S`);
        const citizens: Citizen[] = [];
        for (const row of rawRows) {
          if (row && row[0] && String(row[0]).trim()) {
            const firstCell = String(row[0]).trim();
            const secondCell = String(row[1] || '').trim();
            if (!firstCell.startsWith('[محذوف') && !firstCell.startsWith('[deleted') && !secondCell.includes('تم حذف')) {
              citizens.push(this.rowToCitizen(row));
            }
          }
        }
        this.status.lastSyncTime = new Date().toLocaleTimeString('ar-IQ');
        this.status.syncState = 'idle';
        this.notifyStatus();
        this.log(`✓ تم بنجاح قراءة (${citizens.length}) مراجع مباشرة من Google Sheets.`);
        return citizens;
      } catch (err: any) {
        this.status.syncState = 'error';
        this.status.errorMessage = err.message;
        this.notifyStatus();
        this.log(`⚠️ تعذر قراءة سجل المراجعين: ${err.message}`);
        throw err;
      }
    },

    /**
     * Read a single citizen by Citizen_ID directly from Google Sheets
     */
    readById: async (citizenId: string): Promise<Citizen | null> => {
      const all = await this.citizens.readAll();
      return all.find(c => c.Citizen_ID === citizenId) || null;
    },

    /**
     * Write / Insert a new citizen directly into Google Sheets
     */
    insert: async (citizen: Citizen): Promise<Citizen> => {
      this.status.syncState = 'writing';
      this.notifyStatus();
      this.log(`جاري حفظ بيانات المراجع [${citizen.FullName}] مباشرة في Google Sheets...`);

      try {
        const row = this.citizenToRow(citizen);
        await this.appendRow(`${this.TABS.CITIZENS}!A:S`, row);
        this.status.lastSyncTime = new Date().toLocaleTimeString('ar-IQ');
        this.status.syncState = 'idle';
        this.notifyStatus();
        this.log(`✓ تم حفظ المراجع [${citizen.FullName}] (${citizen.Citizen_ID}) في Google Sheets بنجاح.`);
        return citizen;
      } catch (err: any) {
        this.status.syncState = 'error';
        this.status.errorMessage = err.message;
        this.notifyStatus();
        this.log(`⚠️ خطأ كتابة مراجع في Google Sheets: ${err.message}`);
        throw err;
      }
    },

    /**
     * Update an existing citizen directly in-place in Google Sheets
     */
    update: async (citizen: Citizen): Promise<Citizen> => {
      this.status.syncState = 'writing';
      this.notifyStatus();
      this.log(`جاري تحديث بيانات المراجع [${citizen.FullName}] في Google Sheets...`);

      try {
        const rowIndex = await this.findRowIndexById(this.TABS.CITIZENS, citizen.Citizen_ID);
        const rowValues = this.citizenToRow(citizen);

        if (rowIndex !== null) {
          // Update the exact row
          await this.updateRangeValues(`${this.TABS.CITIZENS}!A${rowIndex}:S${rowIndex}`, [rowValues]);
          this.log(`✓ تم تحديث الصف (${rowIndex}) للمراجع [${citizen.FullName}] في Google Sheets.`);
        } else {
          // Fallback: If not found, append as new row
          await this.appendRow(`${this.TABS.CITIZENS}!A:S`, rowValues);
          this.log(`✓ لم يعثر على صف مسبق، تم إضافة المراجع [${citizen.FullName}] كصف جديد.`);
        }

        this.status.lastSyncTime = new Date().toLocaleTimeString('ar-IQ');
        this.status.syncState = 'idle';
        this.notifyStatus();
        return citizen;
      } catch (err: any) {
        this.status.syncState = 'error';
        this.status.errorMessage = err.message;
        this.notifyStatus();
        this.log(`⚠️ خطأ تحديث مراجع في Google Sheets: ${err.message}`);
        throw err;
      }
    },

    /**
     * Delete / mark citizen as deleted in Google Sheets
     */
    delete: async (citizenId: string): Promise<boolean> => {
      this.log(`جاري حذف / شطب المراجع (${citizenId}) من Google Sheets...`);
      try {
        const rowIndex = await this.findRowIndexById(this.TABS.CITIZENS, citizenId);
        if (rowIndex !== null) {
          // Mark deleted in the row
          const blankRow = new Array(19).fill('');
          blankRow[0] = `[محذوف-${citizenId}]`;
          blankRow[1] = 'تم حذف السجل من المنظومة';
          await this.updateRangeValues(`${this.TABS.CITIZENS}!A${rowIndex}:S${rowIndex}`, [blankRow]);
          this.log(`✓ تم شطب المراجع (${citizenId}) بنجاح.`);
          return true;
        }
        return false;
      } catch (e: any) {
        this.log(`⚠️ تعذر شطب المراجع من Sheets: ${e.message}`);
        return false;
      }
    }
  };

  /* =========================================================================
     REQUESTS ENTITY CRUD (مستودع بيانات الطلبات والمعاملات)
     ========================================================================= */

  /**
   * Convert OfficeRequest object to Google Sheets row array
   */
  private requestToRow(r: OfficeRequest): any[] {
    return [
      r.Request_ID || '',
      r.Citizen_ID || '',
      r.CitizenName || '',
      r.CitizenPhone || '',
      r.Entity || '',
      r.RequestStatus || 'مستلم',
      r.ProcessingStatus || 'قيد الإجراء',
      r.Priority || 'عام',
      r.Details || '',
      r.AttachmentRequest || '',
      r.AttachmentResponse || '',
      r.DeputyNotes || '',
      r.CreatedAt || new Date().toISOString().split('T')[0],
      r.CreatedBy || 'الإدارة'
    ];
  }

  /**
   * Parse Google Sheets row array into OfficeRequest object
   */
  private rowToRequest(row: any[]): OfficeRequest {
    return {
      Request_ID: String(row[0] || '').trim(),
      Citizen_ID: String(row[1] || '').trim(),
      CitizenName: String(row[2] || '').trim(),
      CitizenPhone: String(row[3] || '').trim(),
      Entity: String(row[4] || '').trim(),
      RequestStatus: (row[5] as any) || 'مستلم',
      ProcessingStatus: (row[6] as any) || 'قيد الإجراء',
      Priority: (row[7] as any) || 'عام',
      Details: String(row[8] || '').trim(),
      AttachmentRequest: row[9] ? String(row[9]).trim() : undefined,
      AttachmentResponse: row[10] ? String(row[10]).trim() : undefined,
      DeputyNotes: row[11] ? String(row[11]).trim() : undefined,
      CreatedAt: String(row[12] || new Date().toISOString().split('T')[0]).trim(),
      CreatedBy: String(row[13] || 'الإدارة').trim()
    };
  }

  public readonly requests = {
    /**
     * Read all requests directly from Google Sheets
     */
    readAll: async (): Promise<OfficeRequest[]> => {
      this.status.syncState = 'reading';
      this.notifyStatus();
      this.log('جاري قراءة سجلات الطلبات والمعاملات مباشرة من Google Sheets...');

      try {
        const rawRows = await this.getRangeValues(`${this.TABS.REQUESTS}!A2:N`);
        const requests: OfficeRequest[] = [];
        for (const row of rawRows) {
          if (row && row[0] && String(row[0]).trim()) {
            const firstCell = String(row[0]).trim();
            const thirdCell = String(row[2] || '').trim();
            if (!firstCell.startsWith('[محذوف') && !firstCell.startsWith('[deleted') && !thirdCell.includes('تم حذف')) {
              requests.push(this.rowToRequest(row));
            }
          }
        }
        this.status.lastSyncTime = new Date().toLocaleTimeString('ar-IQ');
        this.status.syncState = 'idle';
        this.notifyStatus();
        this.log(`✓ تم بنجاح قراءة (${requests.length}) طلب ومعاملة مباشرة من Google Sheets.`);
        return requests;
      } catch (err: any) {
        this.status.syncState = 'error';
        this.status.errorMessage = err.message;
        this.notifyStatus();
        this.log(`⚠️ تعذر قراءة سجل الطلبات: ${err.message}`);
        throw err;
      }
    },

    /**
     * Read a single request by Request_ID directly from Google Sheets
     */
    readById: async (requestId: string): Promise<OfficeRequest | null> => {
      const all = await this.requests.readAll();
      return all.find(r => r.Request_ID === requestId) || null;
    },

    /**
     * Read all requests for a specific citizen
     */
    readByCitizenId: async (citizenId: string): Promise<OfficeRequest[]> => {
      const all = await this.requests.readAll();
      return all.filter(r => r.Citizen_ID === citizenId);
    },

    /**
     * Write / Insert a new request directly into Google Sheets
     */
    insert: async (request: OfficeRequest): Promise<OfficeRequest> => {
      this.status.syncState = 'writing';
      this.notifyStatus();
      this.log(`جاري حفظ الطلب [${request.Request_ID}] للمواطن [${request.CitizenName}] في Google Sheets...`);

      try {
        const row = this.requestToRow(request);
        await this.appendRow(`${this.TABS.REQUESTS}!A:N`, row);
        this.status.lastSyncTime = new Date().toLocaleTimeString('ar-IQ');
        this.status.syncState = 'idle';
        this.notifyStatus();
        this.log(`✓ تم حفظ الطلب [${request.Request_ID}] في Google Sheets بنجاح.`);
        return request;
      } catch (err: any) {
        this.status.syncState = 'error';
        this.status.errorMessage = err.message;
        this.notifyStatus();
        this.log(`⚠️ خطأ كتابة طلب في Google Sheets: ${err.message}`);
        throw err;
      }
    },

    /**
     * Update an existing request in-place in Google Sheets
     */
    update: async (request: OfficeRequest): Promise<OfficeRequest> => {
      this.status.syncState = 'writing';
      this.notifyStatus();
      this.log(`جاري تحديث بيانات الطلب [${request.Request_ID}] في Google Sheets...`);

      try {
        const rowIndex = await this.findRowIndexById(this.TABS.REQUESTS, request.Request_ID);
        const rowValues = this.requestToRow(request);

        if (rowIndex !== null) {
          await this.updateRangeValues(`${this.TABS.REQUESTS}!A${rowIndex}:N${rowIndex}`, [rowValues]);
          this.log(`✓ تم تحديث الصف (${rowIndex}) للطلب [${request.Request_ID}] في Google Sheets.`);
        } else {
          await this.appendRow(`${this.TABS.REQUESTS}!A:N`, rowValues);
          this.log(`✓ تم حفظ الطلب [${request.Request_ID}] كصف جديد في Google Sheets.`);
        }

        this.status.lastSyncTime = new Date().toLocaleTimeString('ar-IQ');
        this.status.syncState = 'idle';
        this.notifyStatus();
        return request;
      } catch (err: any) {
        this.status.syncState = 'error';
        this.status.errorMessage = err.message;
        this.notifyStatus();
        this.log(`⚠️ خطأ تحديث طلب في Google Sheets: ${err.message}`);
        throw err;
      }
    },

    /**
     * Delete / mark request as deleted in Google Sheets
     */
    delete: async (requestId: string): Promise<boolean> => {
      this.log(`جاري حذف الطلب (${requestId}) من Google Sheets...`);
      try {
        const rowIndex = await this.findRowIndexById(this.TABS.REQUESTS, requestId);
        if (rowIndex !== null) {
          const blankRow = new Array(14).fill('');
          blankRow[0] = `[محذوف-${requestId}]`;
          blankRow[2] = 'تم حذف الطلب من المنظومة';
          await this.updateRangeValues(`${this.TABS.REQUESTS}!A${rowIndex}:N${rowIndex}`, [blankRow]);
          this.log(`✓ تم شطب الطلب (${requestId}) من Google Sheets.`);
          return true;
        }
        return false;
      } catch (e: any) {
        this.log(`⚠️ تعذر شطب الطلب من Sheets: ${e.message}`);
        return false;
      }
    }
  };

  /* =========================================================================
     GOOGLE DRIVE STORAGE LAYER (تخزين الصور والمستندات السحابي)
     ========================================================================= */

  public readonly drive = {
    /**
     * Upload an image or file (base64 data URL or Blob) directly to Google Drive
     */
    uploadFile: async (
      fileName: string,
      dataUrlOrBlob: string | Blob,
      mimeType: string = 'image/jpeg'
    ): Promise<{ fileId: string; webViewLink: string; directUrl: string }> => {
      const token = await this.getToken();
      const folderId = this.status.driveFolderId || (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_drive_folder_id') : null);

      this.log(`جاري رفع الملف [${fileName}] إلى Google Drive...`);

      let fileBlob: Blob;
      if (typeof dataUrlOrBlob === 'string') {
        if (dataUrlOrBlob.startsWith('data:')) {
          const arr = dataUrlOrBlob.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          if (mimeMatch) mimeType = mimeMatch[1];
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          fileBlob = new Blob([u8arr], { type: mimeType });
        } else {
          fileBlob = new Blob([dataUrlOrBlob], { type: mimeType });
        }
      } else {
        fileBlob = dataUrlOrBlob;
      }

      const metadata: any = {
        name: fileName,
        mimeType
      };

      if (folderId) {
        metadata.parents = [folderId];
      }

      const boundary = '-------314159265358979323846';
      const delimiter = '\r\n--' + boundary + '\r\n';
      const closeDelim = '\r\n--' + boundary + '--';

      const metadataBuffer = new TextEncoder().encode(
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n`
      );

      const closeBuffer = new TextEncoder().encode(closeDelim);
      const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());

      // Combine parts into a single Uint8Array
      const totalLength = metadataBuffer.length + fileBytes.length + closeBuffer.length;
      const combined = new Uint8Array(totalLength);
      combined.set(metadataBuffer, 0);
      combined.set(fileBytes, metadataBuffer.length);
      combined.set(closeBuffer, metadataBuffer.length + fileBytes.length);

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink';

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: combined
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'فشل رفع الملف إلى Google Drive');
      }

      const fileData = await res.json();
      const fileId = fileData.id;
      const webViewLink = fileData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
      const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

      // Set public permissions for direct viewing in the app
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            role: 'reader',
            type: 'anyone'
          })
        });
      } catch (permErr) {
        console.warn('Set Drive permissions warning:', permErr);
      }

      this.log(`✓ تم رفع الملف بنجاح إلى Google Drive: [${fileName}] (${fileId})`);
      return { fileId, webViewLink, directUrl };
    }
  };

  /* =========================================================================
     COMPREHENSIVE MULTI-ENTITY SYNC (مزامنة كافة الجداول بطلب واحد)
     ========================================================================= */

  /**
   * Fetch all records across all entities directly from Google Sheets
   */
  public async fetchAllData(): Promise<{
    citizens: Citizen[];
    requests: OfficeRequest[];
    interviews: Interview[];
    officialLetters: OfficialLetter[];
    organizationRecords: OrganizationRecord[];
    cheques: ChequeRecord[];
  }> {
    this.status.syncState = 'syncing';
    this.notifyStatus();
    this.log('بدء قراءة وجلب كافة البيانات المركزية من جداول Google Sheets...');

    const [citizens, requests] = await Promise.all([
      this.citizens.readAll(),
      this.requests.readAll()
    ]);

    // Read remaining tables if present
    let interviews: Interview[] = [];
    let officialLetters: OfficialLetter[] = [];
    let organizationRecords: OrganizationRecord[] = [];
    let cheques: ChequeRecord[] = [];

    try {
      const interviewRows = await this.getRangeValues(`${this.TABS.INTERVIEWS}!A2:O`).catch(() => []);
      interviews = interviewRows.filter(r => r?.[0]).map(r => ({
        Interview_ID: String(r[0] || '').trim(),
        Citizen_ID: String(r[1] || '').trim(),
        FullName: String(r[2] || '').trim(),
        Subject: String(r[3] || '').trim(),
        Phone1: String(r[4] || '').trim(),
        Phone2: String(r[5] || '').trim(),
        Address: String(r[6] || '').trim(),
        Referrer: String(r[7] || '').trim(),
        InterviewDate: String(r[8] || '').trim(),
        InterviewTime: String(r[9] || '').trim(),
        Priority: (r[10] as any) || 'متوسط',
        Status: (r[11] as any) || 'بانتظار المقابلة',
        DeputyNotes: String(r[12] || '').trim(),
        Outcome: String(r[13] || '').trim(),
        ConvertedToRequest: r[14] === 'نعم'
      }));
    } catch (_) {}

    try {
      const letterRows = await this.getRangeValues(`${this.TABS.LETTERS}!A2:J`).catch(() => []);
      officialLetters = letterRows.filter(r => r?.[0]).map(r => ({
        Letter_ID: String(r[0] || '').trim(),
        LetterNumber: String(r[1] || '').trim(),
        LetterDate: String(r[2] || '').trim(),
        Recipient: String(r[3] || '').trim(),
        Subject: String(r[4] || '').trim(),
        Body: String(r[5] || '').trim(),
        Citizen_ID: String(r[6] || '').trim(),
        CitizenName: String(r[7] || '').trim(),
        Status: (r[8] as any) || 'صادر',
        ClerkName: String(r[9] || '').trim()
      }));
    } catch (_) {}

    try {
      const chequeRows = await this.getRangeValues(`${this.TABS.CHEQUES}!A2:L`).catch(() => []);
      cheques = chequeRows.filter(r => r?.[0]).map(r => ({
        id: String(r[0] || '').trim(),
        ChequeNumber: String(r[1] || '').trim(),
        Citizen_ID: String(r[2] || '').trim(),
        CitizenName: String(r[3] || '').trim(),
        CitizenPhone: String(r[4] || '').trim(),
        Amount: Number(r[5]) || 0,
        AmountInWords: String(r[6] || '').trim(),
        BankName: String(r[7] || '').trim(),
        Purpose: String(r[8] || '').trim(),
        IssueDate: String(r[9] || '').trim(),
        Status: (r[10] as any) || 'قيد الصرف',
        BeneficiaryGender: 'ذكر',
        DependencyStatus: 'مستقل',
        AttendanceType: 'شخصياً',
        CreatedAt: String(r[9] || new Date().toISOString().split('T')[0]).trim(),
        CreatedBy: String(r[11] || 'القسم المالي').trim()
      }));
    } catch (_) {}

    try {
      const orgRows = await this.getRangeValues(`${this.TABS.ORGANIZATION}!A2:I`).catch(() => []);
      organizationRecords = orgRows.filter(r => r?.[0]).map(r => ({
        Citizen_ID: String(r[0] || '').trim(),
        FullName: String(r[1] || '').trim(),
        District: String(r[2] || '').trim(),
        SubDistrict: String(r[3] || '').trim(),
        Affiliation: String(r[4] || '').trim(),
        Notes: String(r[5] || '').trim(),
        LastUpdated: String(r[6] || '').trim(),
        OrgRating: (r[7] as any) || 'مؤيد',
        EvaluationPoints: 10,
        InfluenceType: (r[8] as any) || 'شخصية مؤثرة'
      }));
    } catch (_) {}

    this.status.lastSyncTime = new Date().toLocaleTimeString('ar-IQ');
    this.status.syncState = 'idle';
    this.notifyStatus();
    this.log(`✓ اكتملت قراءة كافة الجداول من Google Sheets (${citizens.length} مراجع، ${requests.length} طلب).`);

    return {
      citizens,
      requests,
      interviews,
      officialLetters,
      organizationRecords,
      cheques
    };
  }
}

// Export singleton instance of the Integration Layer
export const sheetsIntegration = new SheetsIntegrationLayer();
export default sheetsIntegration;
