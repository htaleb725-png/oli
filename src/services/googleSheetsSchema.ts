import { Citizen, OfficeRequest } from '../types';

/**
 * Unified, Strictly Isolated Google Sheets Column Schema
 * Guarantees EVERY single field (Name, Phone, Ministry, Subject, OutgoingNumber, OutgoingDate,
 * ProcessingStatus, DeliveryStatus, Address, Notes, etc.) lands in its OWN dedicated column
 * identically for BOTH normal registration AND Excel filter/import uploads — with ZERO column shifts,
 * ZERO line-breaks inside cells, and ZERO raw JSON dumps.
 */

export function cleanSheetCell(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'object') return '';
  const str = String(value);
  if (!str) return '';
  // Never dump base64 images or serialized JSON objects/arrays into spreadsheet cells
  if (str.startsWith('data:image/') || str.startsWith('data:application/')) return '';
  const trimmed = str.trim();
  if (
    (trimmed.startsWith('[{') && trimmed.endsWith('}]')) ||
    (trimmed.startsWith('{"') && trimmed.endsWith('}'))
  ) {
    return '';
  }
  // Keep every cell strictly single-line so rows never break or visually overlap in Google Sheets
  return trimmed.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').slice(0, 1500);
}

export const CITIZENS_SHEET_NAME = 'سجل_المراجعين_Citizens';
export const CITIZENS_SHEET_RANGE = `${CITIZENS_SHEET_NAME}!A1:R`;
export const CITIZENS_SHEET_APPEND_RANGE = `${CITIZENS_SHEET_NAME}!A:R`;

export const CITIZENS_SHEET_HEADERS: string[] = [
  'الرقم التعريفي',
  'الاسم الكامل',
  'الاسم الأول',
  'اسم الأب',
  'اسم الجد',
  'اللقب / العشيرة',
  'رقم الهاتف',
  'الهاتف البديل',
  'القضاء',
  'الناحية / المنطقة',
  'الجنس',
  'المهنة / العمل',
  'التحصيل الدراسي',
  'التقييم',
  'المعرف / التزكية',
  'مصدر التسجيل',
  'تاريخ التسجيل',
  'الموظف المسؤول'
];

export const REQUESTS_SHEET_NAME = 'طلبات_المواطنين_Requests';
export const REQUESTS_SHEET_RANGE = `${REQUESTS_SHEET_NAME}!A1:T`;
export const REQUESTS_SHEET_APPEND_RANGE = `${REQUESTS_SHEET_NAME}!A:T`;

export const REQUESTS_SHEET_HEADERS: string[] = [
  'رقم الطلب',
  'الرقم التعريفي للمواطن',
  'اسم صاحب الطلب',
  'رقم الهاتف',
  'الوزارة / الجهة',
  'الموضوع / تفاصيل الطلب',
  'العدد / الصادر',
  'تاريخ الصادر',
  'حالة الإنجاز',
  'حالة الاستلام',
  'الأسبقية',
  'العنوان / السكن',
  'التحصيل الدراسي',
  'المهنة',
  'المعرف / التزكية',
  'الهامش / التوجيه',
  'القسم المختص',
  'الملاحظات',
  'تاريخ التسجيل',
  'الموظف المسؤول'
];

function resolveDepartmentArabicLabel(raw?: string): string {
  const v = cleanSheetCell(raw);
  if (!v) return 'قسم الإدارة';
  const low = v.toLowerCase();
  if (low === 'admin' || low === 'إدارة') return 'قسم الإدارة';
  if (low === 'reception' || low === 'استعلامات') return 'قسم الاستعلامات';
  if (low === 'social_care') return 'قسم الرعاية الاجتماعية';
  if (low === 'interviews') return 'قسم المقابلات';
  if (low === 'organization') return 'قسم التنظيم';
  if (low === 'director') return 'مكتب المدير التنفيذي';
  return v;
}

export function citizenToSheetRow(c: Partial<Citizen>): string[] {
  const fullName = cleanSheetCell(
    c.FullName ||
      [c.FirstName, c.FatherName, c.GrandFatherName, c.GreatGrandFatherName, c.Surname]
        .filter(Boolean)
        .join(' ')
  );
  const area = cleanSheetCell(c.ResidentialArea || c.SubDistrict || '');
  return [
    cleanSheetCell(c.Citizen_ID),
    fullName,
    cleanSheetCell(c.FirstName || fullName.split(' ')[0] || ''),
    cleanSheetCell(c.FatherName),
    cleanSheetCell(c.GrandFatherName),
    cleanSheetCell(c.Surname),
    cleanSheetCell(c.Phone1),
    cleanSheetCell(c.Phone2),
    cleanSheetCell(c.District),
    area,
    cleanSheetCell(c.Gender || 'ذكر'),
    cleanSheetCell(c.Job),
    cleanSheetCell(c.Education),
    cleanSheetCell(c.Rating || 'لائق'),
    cleanSheetCell(c.ReferralSource),
    cleanSheetCell(c.RegisteredVia || 'الاستعلامات'),
    cleanSheetCell(c.CreatedAt || new Date().toISOString().split('T')[0]),
    cleanSheetCell(c.CreatedBy || 'الاستعلامات')
  ];
}

export function requestToSheetRow(r: Partial<OfficeRequest>): string[] {
  const deliveryStatus =
    r.DeliveryStatus === 'مستلم' || r.RequestStatus === 'مستلم'
      ? 'مستلم'
      : 'غير مستلم';
  const processingStatus = cleanSheetCell(r.ProcessingStatus || 'قيد التدقيق');
  const marginText = cleanSheetCell(r.Margin || r.DeputyNotes || r.DirectorNotes || '');
  const addressText = cleanSheetCell(r.Address || r.ResidentialArea || '');
  const deptLabel = resolveDepartmentArabicLabel(r.TargetDepartment || r.RegisteredVia);

  return [
    cleanSheetCell(r.Request_ID),
    cleanSheetCell(r.Citizen_ID),
    cleanSheetCell(r.CitizenName),
    cleanSheetCell(r.CitizenPhone),
    cleanSheetCell(r.Entity),
    cleanSheetCell(r.Details),
    cleanSheetCell(r.OutgoingNumber),
    cleanSheetCell(r.OutgoingDate),
    processingStatus,
    deliveryStatus,
    cleanSheetCell(r.Priority || 'عام'),
    addressText,
    cleanSheetCell(r.Education),
    cleanSheetCell(r.Job),
    cleanSheetCell(r.ReferralSource),
    marginText,
    deptLabel,
    cleanSheetCell(r.OtherNotes || r.ReceptionNotes || ''),
    cleanSheetCell(r.CreatedAt || new Date().toISOString().split('T')[0]),
    cleanSheetCell(r.CreatedBy || 'الإدارة')
  ];
}

/**
 * Builds a strictly clean, flat object (ONLY isolated scalar fields, zero nested JSON/base64)
 * for Google Apps Script webhook payloads so Apps Script NEVER creates chaotic extra columns.
 */
export function toCleanSheetCitizenPayload(c: Partial<Citizen>): Record<string, string> {
  const row = citizenToSheetRow(c);
  return {
    Citizen_ID: row[0],
    FullName: row[1],
    FirstName: row[2],
    FatherName: row[3],
    GrandFatherName: row[4],
    Surname: row[5],
    Phone1: row[6],
    Phone2: row[7],
    District: row[8],
    SubDistrict: row[9],
    Gender: row[10],
    Job: row[11],
    Education: row[12],
    Rating: row[13],
    ReferralSource: row[14],
    RegisteredVia: row[15],
    CreatedAt: row[16],
    CreatedBy: row[17]
  };
}

export function toCleanSheetRequestPayload(r: Partial<OfficeRequest>): Record<string, string> {
  const row = requestToSheetRow(r);
  return {
    Request_ID: row[0],
    Citizen_ID: row[1],
    CitizenName: row[2],
    CitizenPhone: row[3],
    Entity: row[4],
    Details: row[5],
    OutgoingNumber: row[6],
    OutgoingDate: row[7],
    ProcessingStatus: row[8],
    DeliveryStatus: row[9],
    Priority: row[10],
    Address: row[11],
    Education: row[12],
    Job: row[13],
    ReferralSource: row[14],
    Margin: row[15],
    TargetDepartment: row[16],
    OtherNotes: row[17],
    CreatedAt: row[18],
    CreatedBy: row[19]
  };
}

/**
 * Header-aware row reader: accurately maps a row from EITHER the new unified Arabic columns
 * OR legacy English/Arabic column orders back into a typed Citizen or OfficeRequest.
 */
export function mapSheetRowByHeaders(headers: string[], row: any[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim();
    if (!h) continue;
    out[h] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
  }
  return out;
}
