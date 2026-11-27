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
import { RealtimeActionType } from './realtimeGoogleSync';
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
  silentSuccess?: boolean;
  actionType?: 'save' | 'delete';
}): Promise<DualWriteOutcome> {
  const { entityLabel, firestoreOp, silentSuccess = true, actionType = 'save' } = params;

  let firebaseOk = false;
  let firebaseError: string | undefined;

  try {
    await firestoreOp();
    firebaseOk = true;
  } catch (err) {
    firebaseOk = false;
    firebaseError = extractReadableError(err);
  }

  const retryFn = async () => {
    await executeFirestoreOperation({ entityLabel, firestoreOp, silentSuccess: false, actionType });
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
    _action: RealtimeActionType,
    _ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `المراجع: ${citizen.FullName || citizen.Citizen_ID}`,
      firestoreOp: () => fsSaveCitizen(citizen)
    });
  },

  async deleteCitizen(citizenId: string, _ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `المراجع: ${citizenId}`,
      firestoreOp: () => fsDeleteCitizen(citizenId),
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
    _action: RealtimeActionType,
    _ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `المعاملة: ${request.Request_ID}`,
      firestoreOp: () => fsSaveRequest(request)
    });
  },

  async deleteRequest(requestId: string, _ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `المعاملة: ${requestId}`,
      firestoreOp: () => fsDeleteRequest(requestId),
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
    _action: RealtimeActionType,
    _ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `مقابلة: ${interview.FullName || interview.Interview_ID}`,
      firestoreOp: () => fsSaveInterview(interview)
    });
  },

  async deleteInterview(interviewId: string, _ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `المقابلة: ${interviewId}`,
      firestoreOp: () => fsDeleteInterview(interviewId),
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
    _action: RealtimeActionType,
    _ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `تنظيم وجماهير: ${record.FullName || record.Citizen_ID}`,
      firestoreOp: () => fsSaveOrgRecord(record)
    });
  },

  async deleteRecord(orgIdOrCitizenId: string, _ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `سجل التنظيم: ${orgIdOrCitizenId}`,
      firestoreOp: () => fsDeleteOrgRecord(orgIdOrCitizenId),
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
    _action: RealtimeActionType,
    _ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `كتاب رسمي: ${letter.LetterNumber || letter.Letter_ID}`,
      firestoreOp: () => fsSaveOfficialLetter(letter)
    });
  },

  async deleteLetter(letterId: string, _ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `الكتاب الرسمي: ${letterId}`,
      firestoreOp: () => fsDeleteOfficialLetter(letterId),
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
    _action: RealtimeActionType,
    _ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `صك مساعدة: ${cheque.CitizenName || cheque.ChequeNumber}`,
      firestoreOp: () => fsSaveCheque(cheque)
    });
  },

  async deleteCheque(chequeId: string, _ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `الصك: ${chequeId}`,
      firestoreOp: () => fsDeleteCheque(chequeId),
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
    _ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `قسم مخصص: ${section.title}`,
      firestoreOp: () => fsSaveCustomSection(section),
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
    _action: RealtimeActionType,
    _ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `قيد قسم مخصص (${record.id})`,
      firestoreOp: () => fsSaveCustomRecord(record)
    });
  },

  async deleteRecord(
    record: CustomSectionRecord | string,
    _ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    const recordId = typeof record === 'string' ? record : record.id;
    return executeFirestoreOperation({
      entityLabel: `القيد المخصص: ${recordId}`,
      firestoreOp: () => fsDeleteCustomRecord(recordId),
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
    _action: RealtimeActionType,
    _ctx: CloudConnectionContext
  ): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `مستخدم: ${user.FullName || user.Username}`,
      firestoreOp: () => fsSaveUser(user),
      silentSuccess: false
    });
  },

  async deleteUser(userId: string, _ctx: CloudConnectionContext, userName?: string): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `المستخدم: ${userName || userId}`,
      firestoreOp: () => fsDeleteUser(userId),
      silentSuccess: false,
      actionType: 'delete'
    });
  }
};
