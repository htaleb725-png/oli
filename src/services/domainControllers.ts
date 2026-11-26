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
}): Promise<DualWriteOutcome> {
  const { entityLabel, firestoreOp, silentSuccess = true } = params;

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
    await executeFirestoreOperation({ entityLabel, firestoreOp, silentSuccess: false });
  };

  if (!silentSuccess || !firebaseOk) {
    reportDualCloudWriteResult({
      entityLabel,
      firebaseOk,
      firebaseError,
      sheetsOk: true,
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
      entityLabel: `حذف مراجع: ${citizenId}`,
      firestoreOp: () => fsDeleteCitizen(citizenId)
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
      entityLabel: `حذف معاملة: ${requestId}`,
      firestoreOp: () => fsDeleteRequest(requestId)
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
      entityLabel: `حذف مقابلة: ${interviewId}`,
      firestoreOp: () => fsDeleteInterview(interviewId)
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
      entityLabel: `حذف كتاب رسمي: ${letterId}`,
      firestoreOp: () => fsDeleteOfficialLetter(letterId)
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
      entityLabel: `حذف صك: ${chequeId}`,
      firestoreOp: () => fsDeleteCheque(chequeId)
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

  async deleteSection(sectionId: string): Promise<void> {
    try {
      await fsDeleteCustomSection(sectionId);
    } catch (err) {
      console.warn('Custom section delete notice:', extractReadableError(err));
    }
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
      entityLabel: `حذف قيد مخصص (${recordId})`,
      firestoreOp: () => fsDeleteCustomRecord(recordId)
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

  async deleteUser(userId: string, _ctx: CloudConnectionContext): Promise<DualWriteOutcome> {
    return executeFirestoreOperation({
      entityLabel: `حذف مستخدم: ${userId}`,
      firestoreOp: () => fsDeleteUser(userId),
      silentSuccess: false
    });
  }
};
