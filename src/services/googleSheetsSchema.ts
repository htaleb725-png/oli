import {
  Citizen,
  OfficeRequest,
  Interview,
  OfficialLetter,
  ChequeRecord,
  OrganizationRecord,
  CustomSectionRecord,
  User
} from '../types';

/**
 * ============================================================================
 * هيكل قاعدة بيانات Google Sheets الموحد - (كل قسم له ورقة واحدة فقط بأعمدة مرتبة)
 * Unified 1-Sheet-Per-Department Schema for Vercel, Direct Sheets API & Apps Script
 * ============================================================================
 * يضمن هذا الملف:
 * 1. تخصيص ورقة واحدة فقط (Single Sheet Tab) لكل قسم من أقسام المنظومة.
 * 2. أعمدة عربية مرتبة ومعزولة 100% (كل معلومة في عمودها المخصص بدون تداخل أو JSON).
 * 3. توافق تام مع الأوراق القديمة ودمجها تلقائياً في الورقة الرسمية لكل قسم دون ضياع أي سجل.
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

// ============================================================================
// أسماء الأوراق الرسمية الموحدة (ورقة واحدة فقط لكل قسم)
// ============================================================================

export const CITIZENS_SHEET_NAME = 'قسم_الاستعلامات_والمراجعين';
export const REQUESTS_SHEET_NAME = 'قسم_الإدارة_والمعاملات';
export const INTERVIEWS_SHEET_NAME = 'قسم_مقابلات_النائب';
export const ORGANIZATION_SHEET_NAME = 'قسم_التنظيم_والجماهير';
export const LETTERS_SHEET_NAME = 'قسم_المكنة_والكتب_الرسمية';
export const CHEQUES_SHEET_NAME = 'قسم_المساعدات_والصكوك';
export const SOCIAL_CARE_SHEET_NAME = 'قسم_الرعاية_الاجتماعية';
export const USERS_SHEET_NAME = 'قسم_الرقابة_والمستخدمين';

// خريطة الأوراق القديمة ليتم سحب بياناتها ودمجها وحذف المكرر منها تلقائياً
export const LEGACY_SHEET_ALIASES: Record<string, string[]> = {
  [CITIZENS_SHEET_NAME]: [
    'سجل_المراجعين_Citizens',
    'المراجعين_Citizens',
    'سجل_المراجعين',
    'المواطنين',
    'citizens'
  ],
  [REQUESTS_SHEET_NAME]: [
    'طلبات_المواطنين_Requests',
    'طلبات_الإدارة_Requests',
    'المعاملات_Requests',
    'طلبات_المواطنين',
    'requests'
  ],
  [INTERVIEWS_SHEET_NAME]: [
    'مقابلات_النائب_Interviews',
    'المقابلات_Interviews',
    'مقابلات_النائب',
    'interviews'
  ],
  [ORGANIZATION_SHEET_NAME]: [
    'السجل_التنظيمي_Org',
    'الموقف_الجماهيري_Organization',
    'السجل_التنظيمي_الجماهيري_Org',
    'التنظيم_Organization',
    'organization',
    'organizationRecords'
  ],
  [LETTERS_SHEET_NAME]: [
    'الكتب_الرسمية_Letters',
    'الكتب_الرسمية_OfficialLetters',
    'الكتب_الرسمية',
    'letters',
    'officialLetters'
  ],
  [CHEQUES_SHEET_NAME]: [
    'صكوك_المساعدات_Cheques',
    'صكوك_المساعدات_المالية_Cheques',
    'صكوك_المساعدات',
    'cheques'
  ],
  [SOCIAL_CARE_SHEET_NAME]: [
    'سجلات_الأقسام_Records',
    'قسم_قسم_الرعاية_الاجتماعية_وشبكة_الحماية',
    'قسم_الرعاية_الاجتماعية_وشبكة_الحماية',
    'سجلات_قسم الرعاية الاجتماعية وشبكة الحماية',
    'custom_records'
  ],
  [USERS_SHEET_NAME]: [
    'المستخدمين_Users',
    'إدارة_المستخدمين',
    'users'
  ]
};

// الأوراق الزائدة القديمة التي يتم حذفها بعد الترتيب حتى يبقى لكل قسم ورقة واحدة فقط
export const OBSOLETE_CLUTTER_SHEETS: string[] = [
  'لوحة_المعلومات_والإحصائيات',
  'أرشيف_الصور_والمستندات_درايف',
  'سجل_الرقابة_والأمان_AuditLogs',
  'سجل_الرقابة_AuditLogs',
  'سجل_الرقابة_والتدقيق_AuditLogs',
  'سجل_الرقابة_Audit',
  'إعدادات_القوائم_Dropdowns',
  'إعدادات_النظام_Settings',
  'الأقسام_المخصصة_Sections',
  'أقسام_مخصصة_Sections',
  'سجلات_مخصصة',
  'Sheet1',
  'الورقة1',
  'الورقة 1'
];

// ============================================================================
// 1. قسم الاستعلامات والمراجعين (18 عمود مرتب)
// ============================================================================
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
  'حالة الحظر',
  'تاريخ التسجيل',
  'الموظف المسؤول'
];

// ============================================================================
// 2. قسم الإدارة والمعاملات (20 عمود مرتب)
// ============================================================================
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

// ============================================================================
// 3. قسم مقابلات النائب (12 عمود مرتب)
// ============================================================================
export const INTERVIEWS_SHEET_RANGE = `${INTERVIEWS_SHEET_NAME}!A1:L`;
export const INTERVIEWS_SHEET_HEADERS: string[] = [
  'رمز المقابلة',
  'الرقم التعريفي للمواطن',
  'اسم المواطن',
  'رقم الهاتف',
  'العنوان / السكن',
  'موضوع المقابلة',
  'تاريخ المقابلة',
  'الأسبقية',
  'حالة المقابلة',
  'توجيه النائب',
  'النتيجة والإجراء',
  'المعرف / التزكية'
];

// ============================================================================
// 4. قسم التنظيم والجماهير (10 أعمدة مرتبة)
// ============================================================================
export const ORGANIZATION_SHEET_RANGE = `${ORGANIZATION_SHEET_NAME}!A1:J`;
export const ORGANIZATION_SHEET_HEADERS: string[] = [
  'الرقم التعريفي',
  'الاسم الكامل',
  'رقم الهاتف',
  'القضاء',
  'الناحية / المنطقة',
  'التقييم التنظيمي',
  'الصفة / التأثير الاجتماعي',
  'المركز الانتخابي',
  'الملاحظات',
  'تاريخ التحديث'
];

// ============================================================================
// 5. قسم المكنة والكتب الرسمية (9 أعمدة مرتبة)
// ============================================================================
export const LETTERS_SHEET_RANGE = `${LETTERS_SHEET_NAME}!A1:I`;
export const LETTERS_SHEET_HEADERS: string[] = [
  'رمز الكتاب',
  'العدد / الصادر',
  'تاريخ الكتاب',
  'الجهة الموجه إليها',
  'الموضوع',
  'نص الكتاب',
  'اسم المواطن',
  'حالة الكتاب',
  'الموظف المنشئ'
];

// ============================================================================
// 6. قسم المساعدات والصكوك (10 أعمدة مرتبة)
// ============================================================================
export const CHEQUES_SHEET_RANGE = `${CHEQUES_SHEET_NAME}!A1:J`;
export const CHEQUES_SHEET_HEADERS: string[] = [
  'معرف الصك',
  'رقم الصك',
  'الرقم التعريفي للمواطن',
  'اسم المستفيد',
  'رقم الهاتف',
  'المبلغ (د.ع)',
  'المصرف / الصندوق',
  'الغرض من الصرف',
  'حالة الصرف',
  'تاريخ التحرير'
];

// ============================================================================
// 7. قسم الرعاية الاجتماعية (10 أعمدة مرتبة)
// ============================================================================
export const SOCIAL_CARE_SHEET_RANGE = `${SOCIAL_CARE_SHEET_NAME}!A1:J`;
export const SOCIAL_CARE_SHEET_HEADERS: string[] = [
  'معرف القيد',
  'اسم المواطن الرباعي',
  'رقم الهاتف',
  'رقم القيد / المعاملة الوزارية',
  'نوع الإعانة / الفئة',
  'حالة الباحث الاجتماعي',
  'القضاء / الناحية',
  'تاريخ المراجعة',
  'الملاحظات والتوجيهات',
  'الموظف المسؤول'
];

// ============================================================================
// 8. قسم الرقابة والمستخدمين (9 أعمدة مرتبة)
// ============================================================================
export const USERS_SHEET_RANGE = `${USERS_SHEET_NAME}!A1:I`;
export const USERS_SHEET_HEADERS: string[] = [
  'معرف المستخدم',
  'الاسم الكامل للموظف',
  'اسم الدخول',
  'رمز الدخول / كلمة المرور',
  'الصفة الوظيفية',
  'القسم',
  'رقم الهاتف',
  'حالة الحساب',
  'تاريخ التحديث'
];

// قائمة ملخص جميع أوراق الأقسام الثمانية لعرضها في الواجهة
export const DEPARTMENT_SHEETS_OVERVIEW = [
  { id: 'citizens', key: 'citizens', sheetName: CITIZENS_SHEET_NAME, title: 'قسم الاستعلامات والمراجعين', departmentTitle: 'قسم الاستعلامات والمراجعين', columns: CITIZENS_SHEET_HEADERS, headers: CITIZENS_SHEET_HEADERS },
  { id: 'requests', key: 'requests', sheetName: REQUESTS_SHEET_NAME, title: 'قسم الإدارة والمعاملات', departmentTitle: 'قسم الإدارة والمعاملات', columns: REQUESTS_SHEET_HEADERS, headers: REQUESTS_SHEET_HEADERS },
  { id: 'interviews', key: 'interviews', sheetName: INTERVIEWS_SHEET_NAME, title: 'قسم مقابلات النائب', departmentTitle: 'قسم مقابلات النائب', columns: INTERVIEWS_SHEET_HEADERS, headers: INTERVIEWS_SHEET_HEADERS },
  { id: 'organization', key: 'organization', sheetName: ORGANIZATION_SHEET_NAME, title: 'قسم التنظيم والجماهير', departmentTitle: 'قسم التنظيم والجماهير', columns: ORGANIZATION_SHEET_HEADERS, headers: ORGANIZATION_SHEET_HEADERS },
  { id: 'letters', key: 'letters', sheetName: LETTERS_SHEET_NAME, title: 'قسم المكنة والكتب الرسمية', departmentTitle: 'قسم المكنة والكتب الرسمية', columns: LETTERS_SHEET_HEADERS, headers: LETTERS_SHEET_HEADERS },
  { id: 'cheques', key: 'cheques', sheetName: CHEQUES_SHEET_NAME, title: 'قسم المساعدات والصكوك', departmentTitle: 'قسم المساعدات والصكوك', columns: CHEQUES_SHEET_HEADERS, headers: CHEQUES_SHEET_HEADERS },
  { id: 'social_care', key: 'social_care', sheetName: SOCIAL_CARE_SHEET_NAME, title: 'قسم الرعاية الاجتماعية', departmentTitle: 'قسم الرعاية الاجتماعية', columns: SOCIAL_CARE_SHEET_HEADERS, headers: SOCIAL_CARE_SHEET_HEADERS },
  { id: 'users', key: 'users', sheetName: USERS_SHEET_NAME, title: 'قسم الرقابة والمستخدمين', departmentTitle: 'قسم الرقابة والمستخدمين', columns: USERS_SHEET_HEADERS, headers: USERS_SHEET_HEADERS }
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
  const blockStatus = c.IsBlocked
    ? `محظور${c.BlockReason ? ' - ' + cleanSheetCell(c.BlockReason) : ''}`
    : 'نشط';

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
    blockStatus,
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

export function interviewToSheetRow(i: Partial<Interview>): string[] {
  return [
    cleanSheetCell(i.Interview_ID),
    cleanSheetCell(i.Citizen_ID),
    cleanSheetCell(i.FullName),
    cleanSheetCell(i.Phone1),
    cleanSheetCell(i.Address),
    cleanSheetCell(i.Subject),
    cleanSheetCell(i.InterviewDate),
    cleanSheetCell(i.Priority || 'متوسط'),
    cleanSheetCell(i.Status || 'مكتملة'),
    cleanSheetCell(i.DeputyNotes),
    cleanSheetCell(i.Outcome),
    cleanSheetCell(i.Referrer)
  ];
}

export function organizationToSheetRow(o: Partial<OrganizationRecord>): string[] {
  return [
    cleanSheetCell(o.Citizen_ID || o.Org_ID),
    cleanSheetCell(o.FullName),
    cleanSheetCell(o.Phone1),
    cleanSheetCell(o.District),
    cleanSheetCell(o.SubDistrict),
    cleanSheetCell(o.OrgRating || 'مؤيد'),
    cleanSheetCell(o.InfluenceType || 'شخصية مؤثرة'),
    cleanSheetCell(o.ElectionCenter),
    cleanSheetCell(o.Notes),
    cleanSheetCell(o.UpdatedAt || (o as any).LastUpdated || new Date().toISOString().split('T')[0])
  ];
}

export function letterToSheetRow(l: Partial<OfficialLetter>): string[] {
  return [
    cleanSheetCell(l.Letter_ID),
    cleanSheetCell(l.LetterNumber || l.Letter_Number),
    cleanSheetCell(l.LetterDate || l.Letter_Date),
    cleanSheetCell(l.Recipient || l.To_Entity),
    cleanSheetCell(l.Subject),
    cleanSheetCell(l.Body),
    cleanSheetCell(l.CitizenName || l.Citizen_Name),
    cleanSheetCell(l.Status || 'صادر'),
    cleanSheetCell(l.ClerkName || 'قسم المكنة')
  ];
}

export function chequeToSheetRow(ch: Partial<ChequeRecord>): string[] {
  return [
    cleanSheetCell(ch.id),
    cleanSheetCell(ch.ChequeNumber),
    cleanSheetCell(ch.Citizen_ID),
    cleanSheetCell(ch.CitizenName),
    cleanSheetCell(ch.CitizenPhone),
    cleanSheetCell(ch.Amount ?? 0),
    cleanSheetCell(ch.BankName),
    cleanSheetCell(ch.Purpose),
    cleanSheetCell(ch.Status || 'مصروف'),
    cleanSheetCell(ch.IssueDate || ch.CreatedAt || new Date().toISOString().split('T')[0])
  ];
}

export function socialCareToSheetRow(rec: Partial<CustomSectionRecord> & Record<string, any>): string[] {
  const d = (rec && typeof rec.data === 'object' && rec.data) ? rec.data : (rec || {});
  return [
    cleanSheetCell(rec.id || d.id),
    cleanSheetCell(d.f_welf_name || d.citizen_name || d['اسم المواطن الرباعي'] || rec.CitizenName),
    cleanSheetCell(d.f_welf_phone || d.phone || d['رقم الهاتف']),
    cleanSheetCell(d.f_welf_code || d.welfare_code || d['رقم القيد / المعاملة الوزارية']),
    cleanSheetCell(d.f_welf_type || d.case_type || d['نوع الإعانة / الفئة']),
    cleanSheetCell(d.f_welf_researcher || d.researcher_status || d['حالة الباحث الاجتماعي']),
    cleanSheetCell(d.f_welf_district || d.district || d['القضاء / الناحية']),
    cleanSheetCell(d.f_welf_date || d.submission_date || d['تاريخ المراجعة'] || rec.createdAt),
    cleanSheetCell(d.f_welf_notes || d.notes || d['الملاحظات والتوجيهات']),
    cleanSheetCell(rec.createdBy || d['الموظف المسؤول'] || 'قسم الرعاية الاجتماعية')
  ];
}

export function userToSheetRow(u: Partial<User>): string[] {
  return [
    cleanSheetCell(u.User_ID),
    cleanSheetCell(u.FullName || u.Username),
    cleanSheetCell(u.Username),
    cleanSheetCell(u.Password),
    cleanSheetCell(u.RoleArabic || u.Role),
    cleanSheetCell(u.Department || u.RoleArabic),
    cleanSheetCell(u.Phone),
    cleanSheetCell(u.Status === 'frozen' ? 'مجمد' : 'نشط'),
    cleanSheetCell(u.UpdatedAt || u.CreatedAt || new Date().toISOString().split('T')[0])
  ];
}

function buildRowMap(headers: string[], row: string[]): Record<string, string> {
  const payload: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    payload[headers[i]] = row[i] ?? '';
  }
  return payload;
}

export function toCleanSheetCitizenPayload(c: Partial<Citizen>): Record<string, string> {
  const row = citizenToSheetRow(c);
  const map = buildRowMap(CITIZENS_SHEET_HEADERS, row);
  return {
    ...map,
    Citizen_ID: cleanSheetCell(c.Citizen_ID),
    FullName: cleanSheetCell(c.FullName),
    Phone1: cleanSheetCell(c.Phone1),
    Phone2: cleanSheetCell(c.Phone2),
    District: cleanSheetCell(c.District),
    SubDistrict: cleanSheetCell(c.SubDistrict),
    Gender: cleanSheetCell(c.Gender),
    Job: cleanSheetCell(c.Job),
    Education: cleanSheetCell(c.Education),
    Rating: cleanSheetCell(c.Rating),
    ReferralSource: cleanSheetCell(c.ReferralSource),
    CreatedAt: cleanSheetCell(c.CreatedAt),
    CreatedBy: cleanSheetCell(c.CreatedBy)
  };
}

export function toCleanSheetRequestPayload(r: Partial<OfficeRequest>): Record<string, string> {
  const row = requestToSheetRow(r);
  const map = buildRowMap(REQUESTS_SHEET_HEADERS, row);
  return {
    ...map,
    Request_ID: cleanSheetCell(r.Request_ID),
    Citizen_ID: cleanSheetCell(r.Citizen_ID),
    CitizenName: cleanSheetCell(r.CitizenName),
    CitizenPhone: cleanSheetCell(r.CitizenPhone),
    Entity: cleanSheetCell(r.Entity),
    Details: cleanSheetCell(r.Details),
    OutgoingNumber: cleanSheetCell(r.OutgoingNumber),
    OutgoingDate: cleanSheetCell(r.OutgoingDate),
    ProcessingStatus: cleanSheetCell(r.ProcessingStatus),
    DeliveryStatus: cleanSheetCell(r.DeliveryStatus || r.RequestStatus),
    Priority: cleanSheetCell(r.Priority),
    Address: cleanSheetCell(r.Address || r.ResidentialArea),
    ReferralSource: cleanSheetCell(r.ReferralSource),
    Margin: cleanSheetCell(r.Margin || r.DeputyNotes),
    TargetDepartment: cleanSheetCell(r.TargetDepartment),
    CreatedAt: cleanSheetCell(r.CreatedAt),
    CreatedBy: cleanSheetCell(r.CreatedBy)
  };
}

export function toCleanSheetInterviewPayload(i: Partial<Interview>): Record<string, string> {
  const row = interviewToSheetRow(i);
  const map = buildRowMap(INTERVIEWS_SHEET_HEADERS, row);
  return {
    ...map,
    Interview_ID: cleanSheetCell(i.Interview_ID),
    Citizen_ID: cleanSheetCell(i.Citizen_ID),
    FullName: cleanSheetCell(i.FullName),
    Phone1: cleanSheetCell(i.Phone1),
    Subject: cleanSheetCell(i.Subject),
    InterviewDate: cleanSheetCell(i.InterviewDate),
    Status: cleanSheetCell(i.Status),
    Priority: cleanSheetCell(i.Priority),
    DeputyNotes: cleanSheetCell(i.DeputyNotes),
    Outcome: cleanSheetCell(i.Outcome)
  };
}

export function toCleanSheetOrganizationPayload(o: Partial<OrganizationRecord>): Record<string, string> {
  const row = organizationToSheetRow(o);
  const map = buildRowMap(ORGANIZATION_SHEET_HEADERS, row);
  return {
    ...map,
    Citizen_ID: cleanSheetCell(o.Citizen_ID || o.Org_ID),
    FullName: cleanSheetCell(o.FullName),
    Phone1: cleanSheetCell(o.Phone1),
    District: cleanSheetCell(o.District),
    OrgRating: cleanSheetCell(o.OrgRating),
    InfluenceType: cleanSheetCell(o.InfluenceType)
  };
}

export function toCleanSheetLetterPayload(l: Partial<OfficialLetter>): Record<string, string> {
  const row = letterToSheetRow(l);
  const map = buildRowMap(LETTERS_SHEET_HEADERS, row);
  return {
    ...map,
    Letter_ID: cleanSheetCell(l.Letter_ID),
    LetterNumber: cleanSheetCell(l.LetterNumber || l.Letter_Number),
    LetterDate: cleanSheetCell(l.LetterDate || l.Letter_Date),
    Recipient: cleanSheetCell(l.Recipient || l.To_Entity),
    Subject: cleanSheetCell(l.Subject),
    Body: cleanSheetCell(l.Body),
    CitizenName: cleanSheetCell(l.CitizenName),
    Status: cleanSheetCell(l.Status)
  };
}

export function toCleanSheetChequePayload(ch: Partial<ChequeRecord>): Record<string, string> {
  const row = chequeToSheetRow(ch);
  const map = buildRowMap(CHEQUES_SHEET_HEADERS, row);
  return {
    ...map,
    id: cleanSheetCell(ch.id),
    ChequeNumber: cleanSheetCell(ch.ChequeNumber),
    Citizen_ID: cleanSheetCell(ch.Citizen_ID),
    CitizenName: cleanSheetCell(ch.CitizenName),
    Amount: cleanSheetCell(ch.Amount),
    BankName: cleanSheetCell(ch.BankName),
    Purpose: cleanSheetCell(ch.Purpose),
    Status: cleanSheetCell(ch.Status)
  };
}

export function toCleanSheetSocialCarePayload(rec: any): Record<string, string> {
  const row = socialCareToSheetRow(rec);
  const map = buildRowMap(SOCIAL_CARE_SHEET_HEADERS, row);
  const d = (rec && typeof rec.data === 'object' && rec.data) ? rec.data : (rec || {});
  return {
    ...map,
    id: cleanSheetCell(rec.id || d.id),
    f_welf_name: cleanSheetCell(d.f_welf_name || d.citizen_name || rec.CitizenName),
    f_welf_phone: cleanSheetCell(d.f_welf_phone || d.phone),
    f_welf_code: cleanSheetCell(d.f_welf_code || d.welfare_code),
    f_welf_type: cleanSheetCell(d.f_welf_type || d.case_type),
    f_welf_researcher: cleanSheetCell(d.f_welf_researcher || d.researcher_status)
  };
}

export function toCleanSheetUserPayload(u: Partial<User>): Record<string, string> {
  const row = userToSheetRow(u);
  const map = buildRowMap(USERS_SHEET_HEADERS, row);
  return {
    ...map,
    User_ID: cleanSheetCell(u.User_ID),
    Username: cleanSheetCell(u.Username),
    FullName: cleanSheetCell(u.FullName),
    Role: cleanSheetCell(u.Role),
    Department: cleanSheetCell(u.Department)
  };
}

export function mapSheetRowByHeaders(headers: string[], row: any[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').trim();
    if (!h) continue;
    out[h] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : '';
  }
  return out;
}
