/**
 * Modular Department Domain Controllers (عزل منطق وحفظ كل قسم بشكل مستقل)
 * ----------------------------------------------------------------------
 * Single Source of Truth: Firebase Firestore (alaa-office-2026 / (default)).
 * All live CRUD operations execute directly against Firestore and surface
 * real persistence errors clearly with instant retry support.
 * Google Sheets is reserved strictly for explicit manual backup/import/export.
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
  DocumentArchiveItem,
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
  fsDeleteOrgRecord,
  fsSaveDocument,
  fsDeleteDocument,
  fsSaveCustomSection,
  fsDeleteCustomSection,
  fsSaveCustomRecord,
  fsDeleteCustomRecord,
  fsSaveUser,
  fsDeleteUser
} from './firebaseFirestoreService';
import {
  RealtimeActionType,
  pushToGoogleSheetsRealtime,
  registerCustomSectionInGoogleSheets
} from './realtimeGoogleSync';
import { reportDualCloudWriteResult } from './cloudSyncAlerts';

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

async function executeFirestoreOperation(params: {
  entityLabel: string;
  firestoreOp: () => Promise<void>;
  backgroundSheetsOp?: () => Promise<any>;
  silentSuccess?: boolean;
  actionType?: 'save' | 'delete';
}): Promise<DualWriteOutcome> {
  const { entityLabel, firestoreOp, backgroundSheetsOp, silentSuccess = true, actionType = 'save' } = params;

  let firebaseOk = false;
  let firebaseError: string | undefined;

  try {
    await firestoreOp();
    firebaseOk = true;
  } catch (err) {
    firebaseOk = false;
    firebaseError = extractReadableError(err);
  }

  // Fire non-blocking background backup to Google Apps Script (Code.gs 2026-DYNAMIC-V3) ONLY after Firestore succeeds
  if (firebaseOk && backgroundSheetsOp) {
    void Promise.resolve()
      .then(() => backgroundSheetsOp())
      .catch(() => {
        // Silent background backup failure never blocks or slows down live Firestore UI
      });
  }

  const retryFn = async () => {
    await executeFirestoreOperation({ entityLabel, firestoreOp, backgroundSheetsOp, silentSuccess: false, actionType });
  };

  if (!silentSuccess || !firebaseOk) {
    reportDualCloudWriteResult({
      entityLabel,
      firebaseOk,
      firebaseError,
      sheetsOk: true,
      actionType,
      retry: !firebaseOk ? retryFn : undefined
    });
  }

  return { firebaseOk, firebaseError, sheetsOk: true };
}

// ============================================================================
// 1. قسم الاستعلامات والمراجعين (Reception / Visitors Domain Controller)
// ============================================================================
export const receptionDomain = {
  async saveCitizen(
    citizen: Citizen,
    action: RealtimeActionType,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `المراجع: ${citizen.FullName || citizen.Citizen_ID}`,
      firestoreOp: () => fsSaveCitizen(citizen),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime('citizens', citizen, action, ctx.appsScriptUrl, ctx.googleSheetId, {
          backgroundBackup: true
        })
    });
  },

  async deleteCitizen(citizenId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `المراجع: ${citizenId}`,
      firestoreOp: () => fsDeleteCitizen(citizenId),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime(
          'citizens',
          { Citizen_ID: citizenId, id: citizenId },
          'delete',
          ctx.appsScriptUrl,
          ctx.googleSheetId,
          { backgroundBackup: true }
        ),
      silentSuccess: false,
      actionType: 'delete'
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
    return executeFirestoreOperation({
      entityLabel: `المعاملة: ${request.Request_ID}`,
      firestoreOp: () => fsSaveRequest(request),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime('requests', request, action, ctx.appsScriptUrl, ctx.googleSheetId, {
          backgroundBackup: true
        })
    });
  },

  async deleteRequest(requestId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `المعاملة: ${requestId}`,
      firestoreOp: () => fsDeleteRequest(requestId),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime(
          'requests',
          { Request_ID: requestId, id: requestId },
          'delete',
          ctx.appsScriptUrl,
          ctx.googleSheetId,
          { backgroundBackup: true }
        ),
      silentSuccess: false,
      actionType: 'delete'
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
    return executeFirestoreOperation({
      entityLabel: `مقابلة: ${interview.FullName || interview.Interview_ID}`,
      firestoreOp: () => fsSaveInterview(interview),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime('interviews', interview, action, ctx.appsScriptUrl, ctx.googleSheetId, {
          backgroundBackup: true
        })
    });
  },

  async deleteInterview(interviewId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `المقابلة: ${interviewId}`,
      firestoreOp: () => fsDeleteInterview(interviewId),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime(
          'interviews',
          { Interview_ID: interviewId, id: interviewId },
          'delete',
          ctx.appsScriptUrl,
          ctx.googleSheetId,
          { backgroundBackup: true }
        ),
      silentSuccess: false,
      actionType: 'delete'
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
    return executeFirestoreOperation({
      entityLabel: `تنظيم وجماهير: ${record.FullName || record.Citizen_ID}`,
      firestoreOp: () => fsSaveOrgRecord(record),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime('organization', record, action, ctx.appsScriptUrl, ctx.googleSheetId, {
          backgroundBackup: true
        })
    });
  },

  async deleteRecord(orgIdOrCitizenId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `سجل التنظيم: ${orgIdOrCitizenId}`,
      firestoreOp: () => fsDeleteOrgRecord(orgIdOrCitizenId),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime(
          'organization',
          { Citizen_ID: orgIdOrCitizenId, id: orgIdOrCitizenId },
          'delete',
          ctx.appsScriptUrl,
          ctx.googleSheetId,
          { backgroundBackup: true }
        ),
      silentSuccess: false,
      actionType: 'delete'
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
    return executeFirestoreOperation({
      entityLabel: `كتاب رسمي: ${letter.LetterNumber || letter.Letter_ID}`,
      firestoreOp: () => fsSaveOfficialLetter(letter),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime('letters', letter, action, ctx.appsScriptUrl, ctx.googleSheetId, {
          backgroundBackup: true
        })
    });
  },

  async deleteLetter(letterId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `الكتاب الرسمي: ${letterId}`,
      firestoreOp: () => fsDeleteOfficialLetter(letterId),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime(
          'letters',
          { Letter_ID: letterId, id: letterId },
          'delete',
          ctx.appsScriptUrl,
          ctx.googleSheetId,
          { backgroundBackup: true }
        ),
      silentSuccess: false,
      actionType: 'delete'
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
    return executeFirestoreOperation({
      entityLabel: `صك مساعدة: ${cheque.CitizenName || cheque.ChequeNumber}`,
      firestoreOp: () => fsSaveCheque(cheque),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime('cheques', cheque, action, ctx.appsScriptUrl, ctx.googleSheetId, {
          backgroundBackup: true
        })
    });
  },

  async deleteCheque(chequeId: string, ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `الصك: ${chequeId}`,
      firestoreOp: () => fsDeleteCheque(chequeId),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime(
          'cheques',
          { id: chequeId },
          'delete',
          ctx.appsScriptUrl,
          ctx.googleSheetId,
          { backgroundBackup: true }
        ),
      silentSuccess: false,
      actionType: 'delete'
    });
  }
};

// ============================================================================
// 6b. قسم أرشيف المستندات (Archive Documents Domain Controller)
// ============================================================================
export const archiveDocumentsDomain = {
  async saveDocument(docItem: DocumentArchiveItem): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `وثيقة أرشيف: ${docItem.Title || docItem.Doc_ID}`,
      firestoreOp: () => fsSaveDocument(docItem)
    });
  },

  async deleteDocument(docId: string, docTitle?: string): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `الوثيقة: ${docTitle || docId}`,
      firestoreOp: () => fsDeleteDocument(docId),
      silentSuccess: false,
      actionType: 'delete'
    });
  }
};

// ============================================================================
// 7. الأقسام المخصصة والأيقونات الديناميكية (Custom Sections & Departments)
// ============================================================================
export const customSectionsDomain = {
  async saveSectionAndProvisionSheet(
    section: CustomSection,
    _allUpdatedSections: CustomSection[],
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `قسم مخصص: ${section.title}`,
      firestoreOp: () => fsSaveCustomSection(section),
      backgroundSheetsOp: () =>
        registerCustomSectionInGoogleSheets(section, ctx.appsScriptUrl, ctx.googleSheetId, {
          silentBackground: true
        }),
      silentSuccess: false
    });
  },

  async deleteSection(sectionId: string, sectionTitle?: string): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `القسم المخصص: ${sectionTitle || sectionId}`,
      firestoreOp: () => fsDeleteCustomSection(sectionId),
      silentSuccess: false,
      actionType: 'delete'
    });
  },

  async saveRecord(
    record: CustomSectionRecord,
    action: RealtimeActionType,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `قيد قسم مخصص (${record.id})`,
      firestoreOp: () => fsSaveCustomRecord(record),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime('custom_records', record, action, ctx.appsScriptUrl, ctx.googleSheetId, {
          customSections: ctx.customSections,
          backgroundBackup: true
        })
    });
  },

  async deleteRecord(
    record: CustomSectionRecord | string,
    ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    const recordId = typeof record === 'string' ? record : record.id;
    return executeFirestoreOperation({
      entityLabel: `القيد المخصص: ${recordId}`,
      firestoreOp: () => fsDeleteCustomRecord(recordId),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime(
          'custom_records',
          typeof record === 'string' ? { id: record } : record,
          'delete',
          ctx.appsScriptUrl,
          ctx.googleSheetId,
          { customSections: ctx.customSections, backgroundBackup: true }
        ),
      silentSuccess: false,
      actionType: 'delete'
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
    return executeFirestoreOperation({
      entityLabel: `مستخدم: ${user.FullName || user.Username}`,
      firestoreOp: () => fsSaveUser(user),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime('users', user, action, ctx.appsScriptUrl, ctx.googleSheetId, {
          backgroundBackup: true
        }),
      silentSuccess: false
    });
  },

  async deleteUser(userId: string, ctx: CloudConnectionContext, userName?: string): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `المستخدم: ${userName || userId}`,
      firestoreOp: () => fsDeleteUser(userId),
      backgroundSheetsOp: () =>
        pushToGoogleSheetsRealtime(
          'users',
          { User_ID: userId, id: userId },
          'delete',
          ctx.appsScriptUrl,
          ctx.googleSheetId,
          { backgroundBackup: true }
        ),
      silentSuccess: false,
      actionType: 'delete'
    });
  }
};
