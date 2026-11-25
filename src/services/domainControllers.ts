/**
 * Modular Department Domain Controllers (عزل منطق وحفظ كل قسم بشكل مستقل)
 * ----------------------------------------------------------------------
 * Isolates cloud persistence, error reporting, and dual-sync retry logic
 * per office department so modifying or troubleshooting one section
 * (e.g. Reception, Admin, Interviews, Organization, Letters, Cheques, Custom Sections)
 * cannot disrupt or corrupt any other module.
 */

import {
  Citizen,
  OfficeRequest,
  Interview,
  OfficialLetter,
  ChequeRecord,
  OrganizationRecord,
  CustomSection,
  CustomSectionRecord,
  User
} from '../types';
import {
  fsSaveCitizen,
  fsDeleteCitizen,
  fsSaveRequest,
  fsDeleteRequest,
  fsSaveInterview,
  fsDeleteInterview,
  fsSaveOfficialLetter,
  fsDeleteOfficialLetter,
  fsSaveCheque,
  fsDeleteCheque,
  fsSaveOrgRecord,
  fsSaveCustomSection,
  fsDeleteCustomSection,
  fsSaveCustomRecord,
  fsDeleteCustomRecord,
  fsSaveUser,
  fsDeleteUser
} from './firebaseFirestoreService';
import {
  pushToGoogleSheetsRealtime,
  registerCustomSectionInGoogleSheets,
  RealtimeActionType
} from './realtimeGoogleSync';
import { reportDualCloudWriteResult, pushCloudSyncAlert } from './cloudSyncAlerts';
import { autoSyncAllSchemas } from './schemaAutoDiscovery';

export interface CloudConnectionContext {
  appsScriptUrl?: string;
  googleSheetId?: string;
  customSections?: CustomSection[];
}

export interface DualWriteOutcome {
  firebaseOk: boolean;
  firebaseError?: string;
  sheetsOk: boolean;
  sheetsError?: string;
  sheetName?: string;
}

function extractReadableError(err: unknown): string {
  if (!err) return 'خطأ غير معروف';
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') {
      const code = parsed.error;
      if (code.includes('permission-denied') || code.includes('PERMISSION_DENIED')) {
        return `رفض صلاحيات Firestore للمسار (${parsed.path || 'غير محدد'}).`;
      }
      return `${code} (${parsed.path || ''})`.trim();
    }
  } catch {
    // Plain string message
  }
  if (raw.includes('permission-denied') || raw.includes('PERMISSION_DENIED')) {
    return 'رفض صلاحيات الكتابة في Firestore.';
  }
  return raw;
}

async function executeDualCloudOperation(params: {
  entityLabel: string;
  firestoreOp: () => Promise<void>;
  sheetsOp: () => Promise<{ success: boolean; error?: string; sheet?: string }>;
  silentSuccess?: boolean;
}): Promise<DualWriteOutcome> {
  const { entityLabel, firestoreOp, sheetsOp, silentSuccess = false } = params;

  const [fsResult, sheetsResult] = await Promise.allSettled([firestoreOp(), sheetsOp()]);

  const firebaseOk = fsResult.status === 'fulfilled';
  const firebaseError =
    fsResult.status === 'rejected' ? extractReadableError(fsResult.reason) : undefined;

  let sheetsOk = false;
  let sheetsError: string | undefined;
  let sheetName: string | undefined;

  if (sheetsResult.status === 'fulfilled') {
    sheetsOk = Boolean(sheetsResult.value?.success);
    sheetsError = sheetsResult.value?.error;
    sheetName = sheetsResult.value?.sheet;
  } else {
    sheetsOk = false;
    sheetsError = extractReadableError(sheetsResult.reason);
  }

  const retryFn = async () => {
    await executeDualCloudOperation({ entityLabel, firestoreOp, sheetsOp, silentSuccess: false });
  };

  if (!silentSuccess || !firebaseOk || !sheetsOk) {
    reportDualCloudWriteResult({
      entityLabel,
      firebaseOk,
      firebaseError,
      sheetsOk,
      sheetsError,
      retry: (!firebaseOk || !sheetsOk) ? retryFn : undefined
    });
  }

  return { firebaseOk, firebaseError, sheetsOk, sheetsError, sheetName };
}

// ============================================================================
// 1. قسم الاستعلامات والمراجعين (Reception / Citizens Domain Controller)
// ============================================================================
export const receptionDomain = {
  async saveCitizen(
    citizen: Citizen,
    action: RealtimeActionType,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `المراجع: ${citizen.FullName || citizen.Citizen_ID}`,
      firestoreOp: () => fsSaveCitizen(citizen),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('citizens', citizen, action, ctx.appsScriptUrl, ctx.googleSheetId)
    });
  },

  async deleteCitizen(citizenId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `حذف مراجع: ${citizenId}`,
      firestoreOp: () => fsDeleteCitizen(citizenId),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('citizens', citizenId, 'delete', ctx.appsScriptUrl, ctx.googleSheetId)
    });
  }
};

// ============================================================================
// 2. قسم الإدارة والمعاملات (Admin / Requests Domain Controller)
// ============================================================================
export const adminRequestsDomain = {
  async saveRequest(
    request: OfficeRequest,
    action: RealtimeActionType,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `المعاملة: ${request.Request_ID}`,
      firestoreOp: () => fsSaveRequest(request),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('requests', request, action, ctx.appsScriptUrl, ctx.googleSheetId)
    });
  },

  async deleteRequest(requestId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `حذف معاملة: ${requestId}`,
      firestoreOp: () => fsDeleteRequest(requestId),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('requests', requestId, 'delete', ctx.appsScriptUrl, ctx.googleSheetId)
    });
  }
};

// ============================================================================
// 3. قسم مقابلات النائب (Interviews Domain Controller)
// ============================================================================
export const interviewsDomain = {
  async saveInterview(
    interview: Interview,
    action: RealtimeActionType,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `مقابلة: ${interview.FullName || interview.Interview_ID}`,
      firestoreOp: () => fsSaveInterview(interview),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('interviews', interview, action, ctx.appsScriptUrl, ctx.googleSheetId)
    });
  },

  async deleteInterview(interviewId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `حذف مقابلة: ${interviewId}`,
      firestoreOp: () => fsDeleteInterview(interviewId),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('interviews', interviewId, 'delete', ctx.appsScriptUrl, ctx.googleSheetId)
    });
  }
};

// ============================================================================
// 4. قسم التنظيم والجماهير (Organization Domain Controller)
// ============================================================================
export const organizationDomain = {
  async saveRecord(
    record: OrganizationRecord,
    action: RealtimeActionType,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `تنظيم وجماهير: ${record.FullName || record.Citizen_ID}`,
      firestoreOp: () => fsSaveOrgRecord(record),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('organization', record, action, ctx.appsScriptUrl, ctx.googleSheetId)
    });
  }
};

// ============================================================================
// 5. قسم المكنة والكتب الرسمية (Official Letters Domain Controller)
// ============================================================================
export const lettersDomain = {
  async saveLetter(
    letter: OfficialLetter,
    action: RealtimeActionType,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `كتاب رسمي: ${letter.LetterNumber || letter.Letter_ID}`,
      firestoreOp: () => fsSaveOfficialLetter(letter),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('letters', letter, action, ctx.appsScriptUrl, ctx.googleSheetId)
    });
  },

  async deleteLetter(letterId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `حذف كتاب رسمي: ${letterId}`,
      firestoreOp: () => fsDeleteOfficialLetter(letterId),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('letters', letterId, 'delete', ctx.appsScriptUrl, ctx.googleSheetId)
    });
  }
};

// ============================================================================
// 6. قسم المساعدات والصكوك (Cheques Domain Controller)
// ============================================================================
export const chequesDomain = {
  async saveCheque(
    cheque: ChequeRecord,
    action: RealtimeActionType,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `صك مساعدة: ${cheque.CitizenName || cheque.ChequeNumber}`,
      firestoreOp: () => fsSaveCheque(cheque),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('cheques', cheque, action, ctx.appsScriptUrl, ctx.googleSheetId)
    });
  },

  async deleteCheque(chequeId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `حذف صك: ${chequeId}`,
      firestoreOp: () => fsDeleteCheque(chequeId),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('cheques', chequeId, 'delete', ctx.appsScriptUrl, ctx.googleSheetId)
    });
  }
};

// ============================================================================
// 7. الأقسام المخصصة والأيقونات الديناميكية (Custom Sections & Dynamic Sheets)
// ============================================================================
export const customSectionsDomain = {
  async saveSectionAndProvisionSheet(
    section: CustomSection,
    allUpdatedSections: CustomSection[],
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    const outcome = await executeDualCloudOperation({
      entityLabel: `إنشاء/تنظيم ورقة قسم: ${section.title}`,
      firestoreOp: () => fsSaveCustomSection(section),
      sheetsOp: async () => {
        const res = await registerCustomSectionInGoogleSheets(
          section,
          ctx.appsScriptUrl,
          ctx.googleSheetId
        );
        return {
          success: res.success,
          sheet: res.sheets?.[0]?.sheetName,
          error: res.error
        };
      }
    });

    // Keep schema manifest in Firestore + Apps Script synchronized in background
    autoSyncAllSchemas(allUpdatedSections, ctx.appsScriptUrl).catch(() => {});

    if (outcome.sheetsOk && outcome.sheetName) {
      pushCloudSyncAlert({
        severity: 'success',
        target: 'google_sheets',
        title: `تم إنشاء وتنظيم ورقة Google Sheet تلقائياً (${section.title})`,
        message: `تم تخصيص الورقة "${outcome.sheetName}" وترتيب أعمدتها تلقائياً بدون التأثير على الأوراق القديمة.`
      });
    }

    return outcome;
  },

  async deleteSection(sectionId: string): Promise<void> {
    // Non-destructive on Google Sheets: removes UI section definition in Firestore while preserving historical spreadsheet tab
    try {
      await fsDeleteCustomSection(sectionId);
    } catch (err) {
      console.warn('Custom section delete notice:', extractReadableError(err));
    }
  },

  async saveRecord(
    record: CustomSectionRecord,
    action: RealtimeActionType,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `قيد قسم مخصص (${record.id})`,
      firestoreOp: () => fsSaveCustomRecord(record),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime(
          'custom_records',
          record,
          action,
          ctx.appsScriptUrl,
          ctx.googleSheetId,
          { customSections: ctx.customSections }
        )
    });
  },

  async deleteRecord(
    record: CustomSectionRecord | string,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    const recordId = typeof record === 'string' ? record : record.id;
    return executeDualCloudOperation({
      entityLabel: `حذف قيد مخصص (${recordId})`,
      firestoreOp: () => fsDeleteCustomRecord(recordId),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime(
          'custom_records',
          record,
          'delete',
          ctx.appsScriptUrl,
          ctx.googleSheetId,
          { customSections: ctx.customSections }
        )
    });
  }
};

// ============================================================================
// 8. قسم المستخدمين والصلاحيات (Users Domain Controller)
// ============================================================================
export const usersDomain = {
  async saveUser(
    user: User,
    action: RealtimeActionType,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `مستخدم: ${user.FullName || user.Username}`,
      firestoreOp: () => fsSaveUser(user),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('users', user, action, ctx.appsScriptUrl, ctx.googleSheetId)
    });
  },

  async deleteUser(userId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeDualCloudOperation({
      entityLabel: `حذف مستخدم: ${userId}`,
      firestoreOp: () => fsDeleteUser(userId),
      sheetsOp: () =>
        pushToGoogleSheetsRealtime('users', userId, 'delete', ctx.appsScriptUrl, ctx.googleSheetId)
    });
  }
};
