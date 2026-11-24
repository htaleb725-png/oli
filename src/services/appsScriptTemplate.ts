/**
 * Google Apps Script Production Engine (محرك مزامنة Google Sheets و Google Drive الرسمي)
 * -----------------------------------------------------------------------------------
 * نظام "ورقة واحدة فقط لكل قسم" بأعمدة عربية مرتبة ومعزولة 100%
 * هذا الكود الجاهز يقوم المستخدم بنسخه ولصقه في Google Sheets:
 * الإضافات (Extensions) -> Apps Script -> لصق الكود -> نشر (Deploy) -> إدارة عمليات النشر -> إصدار جديد
 */

export const GOOGLE_APPS_SCRIPT_SOURCE = `/**
 * =========================================================================
 * منظومة مكتب النائب المهندسة علا عودة الناشي - الإصدار السحابي الموحد 2026
 * نظام "كل قسم له ورقة واحدة فقط" بأعمدة عربية مرتبة وجميلة ومعزولة 100%
 * يدمج الأوراق القديمة تلقائياً ويحذف الأوراق المكررة والزائدة دون فقدان أي سجل
 * متوافق 100% مع Vercel والربط اللحظي المباشر
 * =========================================================================
 */

// أوراق الأقسام الثمانية الرسمية (ورقة واحدة مستقلة لكل قسم بأعمدة عربية مرتبة)
var CORE_SCHEMAS = {
  'قسم_الاستعلامات_والمراجعين': {
    idKey: 'Citizen_ID',
    headerBg: '#064e3b',
    headerFg: '#ffffff',
    legacyNames: ['سجل_المراجعين_Citizens', 'المراجعين_Citizens', 'سجل_المراجعين', 'المواطنين', 'citizens'],
    columns: [
      { header: 'الرقم التعريفي', key: 'Citizen_ID', aliases: ['Citizen_ID', 'id', 'الرقم التعريفي', 'الرقم التعريفي (Citizen_ID)'] },
      { header: 'الاسم الكامل', key: 'FullName', aliases: ['FullName', 'CitizenName', 'الاسم الكامل', 'الاسم الكامل الرباعي', 'الاسم الرباعي واللقب', 'اسم المواطن'] },
      { header: 'الاسم الأول', key: 'FirstName', aliases: ['FirstName', 'الاسم الأول'] },
      { header: 'اسم الأب', key: 'FatherName', aliases: ['FatherName', 'اسم الأب'] },
      { header: 'اسم الجد', key: 'GrandFatherName', aliases: ['GrandFatherName', 'اسم الجد'] },
      { header: 'اللقب / العشيرة', key: 'Surname', aliases: ['Surname', 'اللقب / العشيرة', 'اللقب', 'العشيرة'] },
      { header: 'رقم الهاتف', key: 'Phone1', aliases: ['Phone1', 'Phone', 'رقم الهاتف', 'الهاتف الرئيسي', 'الهاتف 1'] },
      { header: 'الهاتف البديل', key: 'Phone2', aliases: ['Phone2', 'الهاتف البديل', 'الهاتف الثانوي', 'الهاتف 2'] },
      { header: 'القضاء', key: 'District', aliases: ['District', 'القضاء'] },
      { header: 'الناحية / المنطقة', key: 'SubDistrict', aliases: ['SubDistrict', 'ResidentialArea', 'الناحية / المنطقة', 'الناحية / الحي', 'الناحية'] },
      { header: 'الجنس', key: 'Gender', aliases: ['Gender', 'الجنس'] },
      { header: 'المهنة / العمل', key: 'Job', aliases: ['Job', 'المهنة / العمل', 'المهنة'] },
      { header: 'التحصيل الدراسي', key: 'Education', aliases: ['Education', 'التحصيل الدراسي', 'التحصيل'] },
      { header: 'التقييم', key: 'Rating', aliases: ['Rating', 'التقييم', 'التقييم الجماهيري'] },
      { header: 'المعرف / التزكية', key: 'ReferralSource', aliases: ['ReferralSource', 'المعرف / التزكية', 'جهة التزكية / المعرف', 'المعرّف'] },
      { header: 'حالة الحظر', key: 'IsBlocked', aliases: ['IsBlocked', 'حالة الحظر', 'BlockReason'] },
      { header: 'تاريخ التسجيل', key: 'CreatedAt', aliases: ['CreatedAt', 'تاريخ التسجيل'] },
      { header: 'الموظف المسؤول', key: 'CreatedBy', aliases: ['CreatedBy', 'الموظف المسؤول', 'مسؤول الإدخال', 'الموظف المسجل'] }
    ]
  },
  'قسم_الإدارة_والمعاملات': {
    idKey: 'Request_ID',
    headerBg: '#78350f',
    headerFg: '#ffffff',
    legacyNames: ['طلبات_المواطنين_Requests', 'طلبات_الإدارة_Requests', 'المعاملات_Requests', 'طلبات_المواطنين', 'requests'],
    columns: [
      { header: 'رقم الطلب', key: 'Request_ID', aliases: ['Request_ID', 'id', 'رقم الطلب', 'رقم المعاملة', 'رقم الطلب (Request_ID)'] },
      { header: 'الرقم التعريفي للمواطن', key: 'Citizen_ID', aliases: ['Citizen_ID', 'الرقم التعريفي للمواطن', 'الرقم التعريفي'] },
      { header: 'اسم صاحب الطلب', key: 'CitizenName', aliases: ['CitizenName', 'FullName', 'اسم صاحب الطلب', 'اسم المواطن'] },
      { header: 'رقم الهاتف', key: 'CitizenPhone', aliases: ['CitizenPhone', 'Phone1', 'رقم الهاتف', 'الهاتف'] },
      { header: 'الوزارة / الجهة', key: 'Entity', aliases: ['Entity', 'الوزارة / الجهة', 'الجهة المعنية'] },
      { header: 'الموضوع / تفاصيل الطلب', key: 'Details', aliases: ['Details', 'الموضوع / تفاصيل الطلب', 'تفاصيل الطلب', 'الموضوع', 'التفاصيل'] },
      { header: 'العدد / الصادر', key: 'OutgoingNumber', aliases: ['OutgoingNumber', 'العدد / الصادر', 'رقم الصادر'] },
      { header: 'تاريخ الصادر', key: 'OutgoingDate', aliases: ['OutgoingDate', 'تاريخ الصادر', 'تاريخ الكتاب'] },
      { header: 'حالة الإنجاز', key: 'ProcessingStatus', aliases: ['ProcessingStatus', 'حالة الإنجاز', 'المرحلة الإجرائية', 'حالة الطلب', 'المسار الإداري'] },
      { header: 'حالة الاستلام', key: 'DeliveryStatus', aliases: ['DeliveryStatus', 'RequestStatus', 'حالة الاستلام', 'حالة المعاملة'] },
      { header: 'الأسبقية', key: 'Priority', aliases: ['Priority', 'الأسبقية', 'درجة الأسبقية', 'الأولوية'] },
      { header: 'العنوان / السكن', key: 'Address', aliases: ['Address', 'ResidentialArea', 'العنوان / السكن', 'العنوان'] },
      { header: 'التحصيل الدراسي', key: 'Education', aliases: ['Education', 'التحصيل الدراسي'] },
      { header: 'المهنة', key: 'Job', aliases: ['Job', 'المهنة'] },
      { header: 'المعرف / التزكية', key: 'ReferralSource', aliases: ['ReferralSource', 'المعرف / التزكية'] },
      { header: 'الهامش / التوجيه', key: 'Margin', aliases: ['Margin', 'DeputyNotes', 'DirectorNotes', 'الهامش / التوجيه', 'توجيهات وملاحظات النائب', 'توجيه النائب'] },
      { header: 'القسم المختص', key: 'TargetDepartment', aliases: ['TargetDepartment', 'RegisteredVia', 'القسم المختص'] },
      { header: 'الملاحظات', key: 'OtherNotes', aliases: ['OtherNotes', 'ReceptionNotes', 'الملاحظات'] },
      { header: 'تاريخ التسجيل', key: 'CreatedAt', aliases: ['CreatedAt', 'تاريخ التسجيل', 'تاريخ المعاملة'] },
      { header: 'الموظف المسؤول', key: 'CreatedBy', aliases: ['CreatedBy', 'الموظف المسؤول'] }
    ]
  },
  'قسم_مقابلات_النائب': {
    idKey: 'Interview_ID',
    headerBg: '#1e3a8a',
    headerFg: '#ffffff',
    legacyNames: ['مقابلات_النائب_Interviews', 'المقابلات_Interviews', 'مقابلات_النائب', 'interviews'],
    columns: [
      { header: 'رمز المقابلة', key: 'Interview_ID', aliases: ['Interview_ID', 'id', 'رمز المقابلة', 'رقم المقابلة', 'معرف المقابلة'] },
      { header: 'الرقم التعريفي للمواطن', key: 'Citizen_ID', aliases: ['Citizen_ID', 'الرقم التعريفي للمواطن', 'الرقم التعريفي', 'معرف المواطن'] },
      { header: 'اسم المواطن', key: 'FullName', aliases: ['FullName', 'CitizenName', 'اسم المواطن'] },
      { header: 'رقم الهاتف', key: 'Phone1', aliases: ['Phone1', 'رقم الهاتف', 'الهاتف 1', 'الهاتف'] },
      { header: 'العنوان / السكن', key: 'Address', aliases: ['Address', 'العنوان / السكن', 'السكن / العنوان', 'السكن'] },
      { header: 'موضوع المقابلة', key: 'Subject', aliases: ['Subject', 'موضوع المقابلة', 'الموضوع'] },
      { header: 'تاريخ المقابلة', key: 'InterviewDate', aliases: ['InterviewDate', 'Date', 'تاريخ المقابلة', 'التاريخ'] },
      { header: 'الأسبقية', key: 'Priority', aliases: ['Priority', 'الأسبقية', 'الأولوية'] },
      { header: 'حالة المقابلة', key: 'Status', aliases: ['Status', 'حالة المقابلة', 'الموقف'] },
      { header: 'توجيه النائب', key: 'DeputyNotes', aliases: ['DeputyNotes', 'توجيه النائب'] },
      { header: 'النتيجة والإجراء', key: 'Outcome', aliases: ['Outcome', 'النتيجة والإجراء', 'النتيجة', 'النتيجة والإجراء المتخذ'] },
      { header: 'المعرف / التزكية', key: 'Referrer', aliases: ['Referrer', 'المعرف / التزكية', 'جهة التزكية'] }
    ]
  },
  'قسم_التنظيم_والجماهير': {
    idKey: 'Citizen_ID',
    headerBg: '#4c1d95',
    headerFg: '#ffffff',
    legacyNames: ['السجل_التنظيمي_Org', 'الموقف_الجماهيري_Organization', 'السجل_التنظيمي_الجماهيري_Org', 'التنظيم_Organization', 'organization', 'organizationRecords'],
    columns: [
      { header: 'الرقم التعريفي', key: 'Citizen_ID', aliases: ['Citizen_ID', 'Org_ID', 'الرقم التعريفي', 'المعرف'] },
      { header: 'الاسم الكامل', key: 'FullName', aliases: ['FullName', 'الاسم الكامل', 'الاسم'] },
      { header: 'رقم الهاتف', key: 'Phone1', aliases: ['Phone1', 'رقم الهاتف'] },
      { header: 'القضاء', key: 'District', aliases: ['District', 'القضاء'] },
      { header: 'الناحية / المنطقة', key: 'SubDistrict', aliases: ['SubDistrict', 'الناحية / المنطقة', 'الناحية'] },
      { header: 'التقييم التنظيمي', key: 'OrgRating', aliases: ['OrgRating', 'Rating', 'التقييم التنظيمي', 'التقييم الجماهيري', 'الموقف التنظيمي'] },
      { header: 'الصفة / التأثير الاجتماعي', key: 'InfluenceType', aliases: ['InfluenceType', 'الصفة / التأثير الاجتماعي', 'نوع التأثير والشخصية', 'الثقل الاجتماعي'] },
      { header: 'المركز الانتخابي', key: 'ElectionCenter', aliases: ['ElectionCenter', 'المركز الانتخابي'] },
      { header: 'الملاحظات', key: 'Notes', aliases: ['Notes', 'الملاحظات', 'ملاحظات المنسق', 'ملاحظات'] },
      { header: 'تاريخ التحديث', key: 'LastUpdated', aliases: ['LastUpdated', 'UpdatedAt', 'تاريخ التحديث', 'آخر تحديث'] }
    ]
  },
  'قسم_المكنة_والكتب_الرسمية': {
    idKey: 'Letter_ID',
    headerBg: '#1e40af',
    headerFg: '#ffffff',
    legacyNames: ['الكتب_الرسمية_Letters', 'الكتب_الرسمية_OfficialLetters', 'الكتب_الرسمية', 'letters', 'officialLetters'],
    columns: [
      { header: 'رمز الكتاب', key: 'Letter_ID', aliases: ['Letter_ID', 'id', 'رمز الكتاب', 'معرف الكتاب'] },
      { header: 'العدد / الصادر', key: 'LetterNumber', aliases: ['LetterNumber', 'Letter_Number', 'العدد / الصادر', 'العدد / الرقم الإداري', 'العدد الصادر', 'الرقم الإشاري'] },
      { header: 'تاريخ الكتاب', key: 'LetterDate', aliases: ['LetterDate', 'Letter_Date', 'تاريخ الكتاب', 'التاريخ', 'تاريخ الصادر'] },
      { header: 'الجهة الموجه إليها', key: 'Recipient', aliases: ['Recipient', 'To_Entity', 'الجهة الموجه إليها', 'الجهة الصادر إليها'] },
      { header: 'الموضوع', key: 'Subject', aliases: ['Subject', 'الموضوع'] },
      { header: 'نص الكتاب', key: 'Body', aliases: ['Body', 'نص الكتاب', 'نص الكتاب والتوجيه'] },
      { header: 'اسم المواطن', key: 'CitizenName', aliases: ['CitizenName', 'Citizen_Name', 'اسم المواطن', 'المراجع المعني'] },
      { header: 'حالة الكتاب', key: 'Status', aliases: ['Status', 'حالة الكتاب', 'الحالة'] },
      { header: 'الموظف المنشئ', key: 'ClerkName', aliases: ['ClerkName', 'الموظف المنشئ', 'المنشئ', 'الطباع / المنشئ', 'الموظف المسؤول'] }
    ]
  },
  'قسم_المساعدات_والصكوك': {
    idKey: 'id',
    headerBg: '#115e59',
    headerFg: '#ffffff',
    legacyNames: ['صكوك_المساعدات_Cheques', 'صكوك_المساعدات_المالية_Cheques', 'صكوك_المساعدات', 'cheques'],
    columns: [
      { header: 'معرف الصك', key: 'id', aliases: ['id', 'Cheque_ID', 'معرف الصك', 'معرف القيد', 'المعرف'] },
      { header: 'رقم الصك', key: 'ChequeNumber', aliases: ['ChequeNumber', 'رقم الصك'] },
      { header: 'الرقم التعريفي للمواطن', key: 'Citizen_ID', aliases: ['Citizen_ID', 'الرقم التعريفي للمواطن', 'الرقم التعريفي', 'معرف المواطن'] },
      { header: 'اسم المستفيد', key: 'CitizenName', aliases: ['CitizenName', 'اسم المستفيد'] },
      { header: 'رقم الهاتف', key: 'CitizenPhone', aliases: ['CitizenPhone', 'رقم الهاتف'] },
      { header: 'المبلغ (د.ع)', key: 'Amount', aliases: ['Amount', 'المبلغ (د.ع)', 'المبلغ'] },
      { header: 'المصرف / الصندوق', key: 'BankName', aliases: ['BankName', 'المصرف / الصندوق', 'المصرف', 'اسم المصرف / الصندوق'] },
      { header: 'الغرض من الصرف', key: 'Purpose', aliases: ['Purpose', 'الغرض من الصرف', 'الغرض'] },
      { header: 'حالة الصرف', key: 'Status', aliases: ['Status', 'حالة الصرف', 'الحالة'] },
      { header: 'تاريخ التحرير', key: 'IssueDate', aliases: ['IssueDate', 'CreatedAt', 'تاريخ التحرير'] }
    ]
  },
  'قسم_الرعاية_الاجتماعية': {
    idKey: 'id',
    headerBg: '#047857',
    headerFg: '#ffffff',
    legacyNames: ['سجلات_الأقسام_Records', 'قسم_قسم_الرعاية_الاجتماعية_وشبكة_الحماية', 'قسم_الرعاية_الاجتماعية_وشبكة_الحماية', 'سجلات_قسم الرعاية الاجتماعية وشبكة الحماية', 'custom_records'],
    columns: [
      { header: 'معرف القيد', key: 'id', aliases: ['id', 'معرف القيد', 'معرف_السجل_ID', 'المعرف'] },
      { header: 'اسم المواطن الرباعي', key: 'f_welf_name', aliases: ['f_welf_name', 'citizen_name', 'اسم المواطن الرباعي', 'اسم المواطن / صاحب القيد الرباعي', 'CitizenName'] },
      { header: 'رقم الهاتف', key: 'f_welf_phone', aliases: ['f_welf_phone', 'phone', 'رقم الهاتف', 'رقم هاتف المراجع للتواصل'] },
      { header: 'رقم القيد / المعاملة الوزارية', key: 'f_welf_code', aliases: ['f_welf_code', 'welfare_code', 'رقم القيد / المعاملة الوزارية', 'رقم القيد / رقم المعاملة الوزارية'] },
      { header: 'نوع الإعانة / الفئة', key: 'f_welf_type', aliases: ['f_welf_type', 'case_type', 'نوع الإعانة / الفئة', 'نوع الإعانة أو الفئة المشمولة'] },
      { header: 'حالة الباحث الاجتماعي', key: 'f_welf_researcher', aliases: ['f_welf_researcher', 'researcher_status', 'حالة الباحث الاجتماعي', 'حالة المسح الميداني والباحث الاجتماعي'] },
      { header: 'القضاء / الناحية', key: 'f_welf_district', aliases: ['f_welf_district', 'district', 'القضاء / الناحية', 'القضاء / الناحية التابعة لقسم الرعاية'] },
      { header: 'تاريخ المراجعة', key: 'f_welf_date', aliases: ['f_welf_date', 'submission_date', 'createdAt', 'تاريخ المراجعة', 'تاريخ استلام ومتابعة المعاملة', 'تاريخ_الإنشاء'] },
      { header: 'الملاحظات والتوجيهات', key: 'f_welf_notes', aliases: ['f_welf_notes', 'notes', 'الملاحظات والتوجيهات', 'ملاحظات وتوجيهات متابعة المعاملة'] },
      { header: 'الموظف المسؤول', key: 'createdBy', aliases: ['createdBy', 'الموظف المسؤول', 'المسؤول'] }
    ]
  },
  'قسم_الرقابة_والمستخدمين': {
    idKey: 'User_ID',
    headerBg: '#334155',
    headerFg: '#ffffff',
    legacyNames: ['المستخدمين_Users', 'إدارة_المستخدمين', 'users'],
    columns: [
      { header: 'معرف المستخدم', key: 'User_ID', aliases: ['User_ID', 'id', 'معرف المستخدم'] },
      { header: 'الاسم الكامل للموظف', key: 'FullName', aliases: ['FullName', 'الاسم الكامل للموظف', 'الاسم الكامل'] },
      { header: 'اسم الدخول', key: 'Username', aliases: ['Username', 'اسم الدخول'] },
      { header: 'رمز الدخول / كلمة المرور', key: 'Password', aliases: ['Password', 'رمز الدخول / كلمة المرور'] },
      { header: 'الصفة الوظيفية', key: 'RoleArabic', aliases: ['RoleArabic', 'Role', 'الصفة الوظيفية'] },
      { header: 'القسم', key: 'Department', aliases: ['Department', 'القسم'] },
      { header: 'رقم الهاتف', key: 'Phone', aliases: ['Phone', 'رقم الهاتف'] },
      { header: 'حالة الحساب', key: 'Status', aliases: ['Status', 'حالة الحساب'] },
      { header: 'تاريخ التحديث', key: 'UpdatedAt', aliases: ['UpdatedAt', 'CreatedAt', 'تاريخ التحديث'] }
    ]
  }
};

// الأوراق الزائدة والمكررة التي يتم حذفها بعد الترتيب ليبقى لكل قسم ورقة واحدة فقط
var OBSOLETE_CLUTTER_SHEETS = [
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

// تنظيف كل خلية لضمان عدم تداخل الأسطر أو إدخال كائنات JSON أو صور Base64
function cleanCellVal(val) {
  if (val === undefined || val === null) return '';
  if (typeof val === 'boolean') return val ? 'نعم' : 'لا';
  if (typeof val === 'object') return '';
  var str = String(val).trim();
  if (!str) return '';
  if (str.indexOf('data:image/') === 0 || str.indexOf('data:application/') === 0) return '';
  if ((str.indexOf('[{') === 0 && str.slice(-2) === '}]') || (str.indexOf('{"') === 0 && str.slice(-1) === '}')) {
    return '';
  }
  return str.replace(/[\\r\\n\\t]+/g, ' ').replace(/\\s{2,}/g, ' ').slice(0, 1500);
}

// تحويل اسم القسم أو الجدول إلى اسم الورقة الرسمية الموحدة
function resolveSheetName(table) {
  var clean = String(table || '').trim();
  if (CORE_SCHEMAS[clean]) return clean;

  var schemaNames = Object.keys(CORE_SCHEMAS);
  for (var i = 0; i < schemaNames.length; i++) {
    var sName = schemaNames[i];
    var legacies = CORE_SCHEMAS[sName].legacyNames || [];
    if (legacies.indexOf(clean) !== -1) {
      return sName;
    }
  }

  switch (clean) {
    case 'citizens': return 'قسم_الاستعلامات_والمراجعين';
    case 'requests': return 'قسم_الإدارة_والمعاملات';
    case 'interviews': return 'قسم_مقابلات_النائب';
    case 'organization':
    case 'organizations':
    case 'organizationRecords': return 'قسم_التنظيم_والجماهير';
    case 'letters':
    case 'officialLetters': return 'قسم_المكنة_والكتب_الرسمية';
    case 'cheques': return 'قسم_المساعدات_والصكوك';
    case 'custom_records':
    case 'social_care':
    case 'sec_social_welfare': return 'قسم_الرعاية_الاجتماعية';
    case 'users': return 'قسم_الرقابة_والمستخدمين';
    default:
      return 'قسم_الاستعلامات_والمراجعين';
  }
}

// تهيئة وتنسيق أوراق الأقسام الثمانية الرسمية (يمين إلى يسار)
function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(CORE_SCHEMAS).forEach(function(sheetName) {
    var schema = CORE_SCHEMAS[sheetName];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    try { sheet.setRightToLeft(true); } catch (e) {}
    var headers = schema.columns.map(function(c) { return c.header; });
    ensureCleanStructuredHeaders(sheet, headers, schema.headerBg, schema.headerFg);
  });
  return { status: 'success', message: 'تم تجهيز أوراق الأقسام الثمانية بأعمدة عربية مرتبة ومعزولة بنجاح' };
}

function styleSheetProfessionally(sheet, headersCount, totalRows, headerBg, headerFg) {
  try { sheet.setRightToLeft(true); } catch (e) {}
  var headerRange = sheet.getRange(1, 1, 1, headersCount);
  headerRange.setBackground(headerBg || '#0f172a');
  headerRange.setFontColor(headerFg || '#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(11);
  headerRange.setHorizontalAlignment('center');
  headerRange.setVerticalAlignment('middle');
  try { sheet.setRowHeight(1, 38); } catch (e) {}
  sheet.setFrozenRows(1);

  if (totalRows > 1) {
    var bodyRange = sheet.getRange(2, 1, totalRows - 1, headersCount);
    bodyRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    bodyRange.setVerticalAlignment('middle');
    bodyRange.setHorizontalAlignment('right');
  }

  for (var colIdx = 1; colIdx <= headersCount; colIdx++) {
    try { sheet.setColumnWidth(colIdx, 175); } catch (e) {}
  }
  // حماية غير تدميرية: لا يتم حذف أي أعمدة إضافية موجودة مسبقاً في الورقة حفاظاً على البيانات
}

// =========================================================================
// مخزن المخططات الديناميكي للأقسام والأيقونات المخصصة (Auto-Sheet Engine)
// ينشئ ورقة مخصصة مرتبة الأعمدة فور إضافة أي قسم أو أيقونة جديدة دون المساس بالأوراق القديمة
// =========================================================================
var DYNAMIC_SECTIONS_PROP_KEY = 'AL_NASHI_DYNAMIC_SECTIONS_V2';

function loadDynamicSectionRegistry() {
  try {
    var raw = PropertiesService.getDocumentProperties().getProperty(DYNAMIC_SECTIONS_PROP_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {}
  return {};
}

function saveDynamicSectionRegistry(registry) {
  try {
    PropertiesService.getDocumentProperties().setProperty(DYNAMIC_SECTIONS_PROP_KEY, JSON.stringify(registry || {}));
  } catch (e) {}
}

function sanitizeCustomSheetName(rawTitle, subTitle) {
  var clean = function(v) {
    return String(v || '')
      .trim()
      .replace(/[:\\\\\\/?*\\[\\]'"]+/g, '')
      .replace(/\\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  };
  var base = clean(rawTitle) || 'قسم_مخصص';
  if (base.indexOf('قسم_') !== 0) base = 'قسم_' + base;
  if (subTitle) {
    var sub = clean(subTitle);
    if (sub) return (base + '_' + sub).slice(0, 90);
  }
  return base.slice(0, 90);
}

/**
 * ضمان وجود الأعمدة المطلوبة دون مسح الأعمدة القديمة أو البيانات الموجودة مسبقاً (Non-Destructive)
 */
function ensureNonDestructiveHeaders(sheet, requiredHeaders, headerBg, headerFg) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    styleSheetProfessionally(sheet, requiredHeaders.length, 1, headerBg, headerFg);
    return requiredHeaders.slice();
  }

  var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h || '').trim();
  });

  var mergedHeaders = currentHeaders.slice();
  var addedCount = 0;
  for (var i = 0; i < requiredHeaders.length; i++) {
    var reqH = String(requiredHeaders[i] || '').trim();
    if (!reqH) continue;
    if (mergedHeaders.indexOf(reqH) === -1) {
      mergedHeaders.push(reqH);
      addedCount++;
    }
  }

  if (addedCount > 0) {
    sheet.getRange(1, 1, 1, mergedHeaders.length).setValues([mergedHeaders]);
    styleSheetProfessionally(sheet, mergedHeaders.length, lastRow, headerBg, headerFg);
  }
  return mergedHeaders;
}

function ensureCleanStructuredHeaders(sheet, headers, headerBg, headerFg) {
  return ensureNonDestructiveHeaders(sheet, headers, headerBg, headerFg);
}

/**
 * تسجيل وتجهيز ورقة عمل مخصصة لأي قسم جديد أو أيقونة أو قسم فرعي تلقائياً
 */
function registerDynamicCustomSection(ss, secDef) {
  if (!secDef || typeof secDef !== 'object') return null;
  var secId = String(secDef.id || secDef.sectionId || '').trim();
  if (!secId || secId === 'sec_social_welfare') return null;

  var registry = loadDynamicSectionRegistry();
  var results = [];

  var registerSingle = function(idKey, title, sheetNameCandidate, fieldsArr) {
    var finalSheetName = sheetNameCandidate ? sanitizeCustomSheetName(sheetNameCandidate) : sanitizeCustomSheetName(title);
    // منع التعارض مع الأوراق الثمانية الأساسية
    if (CORE_SCHEMAS[finalSheetName]) {
      finalSheetName = (finalSheetName + '_مخصص').slice(0, 90);
    }

    var columns = [{ key: 'id', header: 'معرف القيد' }];
    var seenHeaders = { 'معرف القيد': true, 'تاريخ الإنشاء': true, 'الموظف المسؤول': true };

    if (Array.isArray(fieldsArr)) {
      for (var i = 0; i < fieldsArr.length; i++) {
        var f = fieldsArr[i];
        if (!f) continue;
        var fKey = String(f.id || f.key || f.name || ('field_' + i)).trim();
        var fLabel = cleanCellVal(f.label || f.header || f.name || fKey);
        if (!fLabel || seenHeaders[fLabel]) continue;
        seenHeaders[fLabel] = true;
        columns.push({ key: fKey, header: fLabel });
      }
    }
    columns.push({ key: 'createdAt', header: 'تاريخ الإنشاء' });
    columns.push({ key: 'createdBy', header: 'الموظف المسؤول' });

    var sheet = ss.getSheetByName(finalSheetName);
    if (!sheet) {
      sheet = ss.insertSheet(finalSheetName);
      try { sheet.setRightToLeft(true); } catch (e) {}
    }

    var headers = columns.map(function(c) { return c.header; });
    ensureNonDestructiveHeaders(sheet, headers, '#1d4ed8', '#ffffff');

    var meta = {
      sectionId: idKey,
      title: String(title || finalSheetName),
      sheetName: finalSheetName,
      columns: columns,
      updatedAt: new Date().toISOString()
    };
    registry[idKey] = meta;
    results.push(meta);
  };

  if (secDef.isMultiSectionHub && Array.isArray(secDef.subSections) && secDef.subSections.length > 0) {
    for (var sIdx = 0; sIdx < secDef.subSections.length; sIdx++) {
      var sub = secDef.subSections[sIdx];
      if (!sub || sub.targetBuiltInSection) continue;
      var compositeId = secId + '__' + sub.id;
      var subSheetName = sanitizeCustomSheetName(secDef.title || secDef.name, sub.title);
      registerSingle(compositeId, (secDef.title || '') + ' - ' + sub.title, subSheetName, sub.fields || []);
    }
  } else {
    registerSingle(secId, secDef.title || secDef.name, secDef.sheetName || secDef.name, secDef.fields || secDef.columns || []);
  }

  saveDynamicSectionRegistry(registry);
  return results;
}

/**
 * إدخال وتحديث غير تدميري لسجلات الأقسام المخصصة داخل ورقة القسم الخاصة بها
 */
function handleDynamicCustomRecordUpsert(ss, contents, record) {
  if (!record || typeof record !== 'object') return null;
  var secId = String(contents.sectionId || record.sectionId || '').trim();
  if (!secId || secId === 'sec_social_welfare') {
    var socialSheet = ss.getSheetByName('قسم_الرعاية_الاجتماعية') || ss.insertSheet('قسم_الرعاية_الاجتماعية');
    handleStructuredUpsertBatch(socialSheet, CORE_SCHEMAS['قسم_الرعاية_الاجتماعية'], [record]);
    return 'قسم_الرعاية_الاجتماعية';
  }

  var registry = loadDynamicSectionRegistry();
  var meta = registry[secId];

  // في حال لم يُسجّل القسم مسبقاً، ننشئ ورقته وأعمدته تلقائياً من بيانات الحقول المرفقة
  if (!meta) {
    var autoColumns = Array.isArray(contents.sectionColumns) ? contents.sectionColumns : [];
    var sheetTitle = contents.sectionTitle || contents.sheetName || secId;
    registerDynamicCustomSection(ss, {
      id: secId,
      title: sheetTitle,
      sheetName: contents.sheetName || sheetTitle,
      fields: autoColumns
    });
    registry = loadDynamicSectionRegistry();
    meta = registry[secId];
  }

  var targetSheetName = (meta && meta.sheetName) ? meta.sheetName : sanitizeCustomSheetName(contents.sheetName || secId);
  var sheet = ss.getSheetByName(targetSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(targetSheetName);
    try { sheet.setRightToLeft(true); } catch (e) {}
  }

  var dynamicColumns = (meta && Array.isArray(meta.columns) && meta.columns.length > 0)
    ? meta.columns
    : [{ key: 'id', header: 'معرف القيد' }, { key: 'createdAt', header: 'تاريخ الإنشاء' }, { key: 'createdBy', header: 'الموظف المسؤول' }];

  // إذا وردت أعمدة جديدة في الطلب نضيفها غير تدميرياً
  if (Array.isArray(contents.sectionColumns)) {
    var existingHeaderSet = {};
    dynamicColumns.forEach(function(c) { existingHeaderSet[c.header] = true; });
    contents.sectionColumns.forEach(function(sc) {
      if (sc && sc.header && !existingHeaderSet[sc.header]) {
        dynamicColumns.splice(Math.max(1, dynamicColumns.length - 2), 0, { key: sc.key || sc.header, header: sc.header });
        existingHeaderSet[sc.header] = true;
      }
    });
  }

  var schemaObj = {
    idKey: 'id',
    headerBg: '#1d4ed8',
    headerFg: '#ffffff',
    columns: dynamicColumns.map(function(c) {
      return { header: c.header, key: c.key, aliases: [c.key, c.header] };
    })
  };

  handleStructuredUpsertBatch(sheet, schemaObj, [record]);
  return targetSheetName;
}

/**
 * أداة إعادة تنظيم وتوحيد جميع أوراق Google Sheets (غير تدميرية وتحافظ على جميع أوراق الأقسام المخصصة):
 */
function reorganizeAllSheetsCleanly() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var canonicalSheetNames = Object.keys(CORE_SCHEMAS);
  var dynamicRegistry = loadDynamicSectionRegistry();
  var protectedDynamicSheets = {};
  Object.keys(dynamicRegistry).forEach(function(secId) {
    if (dynamicRegistry[secId] && dynamicRegistry[secId].sheetName) {
      protectedDynamicSheets[dynamicRegistry[secId].sheetName] = true;
    }
  });

  // 1. دمج السجلات في أوراق الأقسام الثمانية مع الحفاظ الكامل على البيانات والأعمدة
  canonicalSheetNames.forEach(function(sheetName) {
    var schema = CORE_SCHEMAS[sheetName];
    var targetSheet = ss.getSheetByName(sheetName);
    if (!targetSheet) {
      targetSheet = ss.insertSheet(sheetName);
    }

    var combinedRecords = getDepartmentRecordsWithLegacies(ss, sheetName);
    var headers = schema.columns.map(function(c) { return c.header; });
    var existingHeaders = ensureNonDestructiveHeaders(targetSheet, headers, schema.headerBg, schema.headerFg);

    if (combinedRecords.length > 0) {
      handleStructuredUpsertBatch(targetSheet, schema, combinedRecords);
    } else {
      styleSheetProfessionally(targetSheet, existingHeaders.length, targetSheet.getLastRow(), schema.headerBg, schema.headerFg);
    }
  });

  // 2. تنظيف الأوراق القديمة المكررة فقط (دون المساس بأي ورقة قسم مخصص!)
  var allSheets = ss.getSheets();
  for (var sIdx = 0; sIdx < allSheets.length; sIdx++) {
    var sh = allSheets[sIdx];
    var shName = sh.getName();
    if (canonicalSheetNames.indexOf(shName) !== -1 || protectedDynamicSheets[shName]) {
      continue;
    }
    var shouldDelete = OBSOLETE_CLUTTER_SHEETS.indexOf(shName) !== -1;
    if (!shouldDelete) {
      for (var k = 0; k < canonicalSheetNames.length; k++) {
        var legList = CORE_SCHEMAS[canonicalSheetNames[k]].legacyNames || [];
        if (legList.indexOf(shName) !== -1) {
          shouldDelete = true;
          break;
        }
      }
    }
    if (shouldDelete && ss.getSheets().length > 1) {
      try { ss.deleteSheet(sh); } catch (e) {}
    }
  }

  return {
    success: true,
    sheetsCount: ss.getSheets().length,
    departments: canonicalSheetNames,
    customSheets: Object.keys(protectedDynamicSheets)
  };
}

function extractFieldBySchemaColumn(item, col) {
  if (!item || typeof item !== 'object') return '';
  var source = (item.data && typeof item.data === 'object') ? Object.assign({}, item, item.data) : item;

  if (source[col.key] !== undefined && source[col.key] !== null && String(source[col.key]).trim() !== '') {
    if (col.key === 'IsBlocked') {
      if (source.IsBlocked === true || source.IsBlocked === 'نعم' || String(source.IsBlocked).indexOf('محظور') === 0) {
        return source.BlockReason ? ('محظور - ' + source.BlockReason) : 'محظور';
      }
      return 'نشط';
    }
    return source[col.key];
  }
  if (source[col.header] !== undefined && source[col.header] !== null && String(source[col.header]).trim() !== '') {
    return source[col.header];
  }
  for (var i = 0; i < col.aliases.length; i++) {
    var a = col.aliases[i];
    if (source[a] !== undefined && source[a] !== null && String(source[a]).trim() !== '') {
      return source[a];
    }
  }
  return '';
}

function getSingleSheetRawRecords(ss, sheetName, schema) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function(h) { return String(h || '').trim(); });
  var records = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (!row) continue;
    var firstCell = String(row[0] || '').trim();
    if (!firstCell || firstCell.indexOf('[محذوف') === 0 || firstCell.indexOf('[deleted') === 0) continue;

    var item = {};
    for (var j = 0; j < headers.length; j++) {
      var h = headers[j];
      if (!h) continue;
      var cell = row[j] !== undefined && row[j] !== null ? row[j] : '';
      item[h] = cell;
      if (schema) {
        for (var c = 0; c < schema.columns.length; c++) {
          var col = schema.columns[c];
          if (h === col.header || h === col.key || (col.aliases && col.aliases.indexOf(h) !== -1)) {
            if (item[col.key] === undefined || item[col.key] === '') {
              item[col.key] = cell;
            }
          }
        }
      }
    }
    if (item.FullName && !item.CitizenName) item.CitizenName = item.FullName;
    if (item.Phone1 && !item.CitizenPhone) item.CitizenPhone = item.Phone1;
    records.push(item);
  }
  return records;
}

// قراءة سجلات القسم من الورقة الرسمية + أي ورقة قديمة لم تُدمج بعد (دون تكرار)
function getDepartmentRecordsWithLegacies(ss, canonicalSheetName) {
  var schema = CORE_SCHEMAS[canonicalSheetName];
  if (!schema) return getSingleSheetRawRecords(ss, canonicalSheetName, null);

  var idCol = schema.columns[0];
  var seenMap = {};
  var orderedIds = [];

  var candidateNames = [canonicalSheetName].concat(schema.legacyNames || []);
  for (var nIdx = 0; nIdx < candidateNames.length; nIdx++) {
    var sName = candidateNames[nIdx];
    var list = getSingleSheetRawRecords(ss, sName, schema);
    for (var rIdx = 0; rIdx < list.length; rIdx++) {
      var rec = list[rIdx];
      var idVal = String(extractFieldBySchemaColumn(rec, idCol) || '').trim();
      if (!idVal) continue;
      if (!seenMap[idVal]) {
        seenMap[idVal] = rec;
        orderedIds.push(idVal);
      } else {
        var existing = seenMap[idVal];
        Object.keys(rec).forEach(function(k) {
          if ((existing[k] === undefined || existing[k] === '') && rec[k] !== undefined && rec[k] !== '') {
            existing[k] = rec[k];
          }
        });
      }
    }
  }

  return orderedIds.map(function(id) { return seenMap[id]; });
}

function buildAllDepartmentsPayload(ss) {
  var citizens = getDepartmentRecordsWithLegacies(ss, 'قسم_الاستعلامات_والمراجعين');
  var requests = getDepartmentRecordsWithLegacies(ss, 'قسم_الإدارة_والمعاملات');
  var interviews = getDepartmentRecordsWithLegacies(ss, 'قسم_مقابلات_النائب');
  var organizationRecords = getDepartmentRecordsWithLegacies(ss, 'قسم_التنظيم_والجماهير');
  var officialLetters = getDepartmentRecordsWithLegacies(ss, 'قسم_المكنة_والكتب_الرسمية');
  var cheques = getDepartmentRecordsWithLegacies(ss, 'قسم_المساعدات_والصكوك');
  var socialCareRaw = getDepartmentRecordsWithLegacies(ss, 'قسم_الرعاية_الاجتماعية');
  var users = getDepartmentRecordsWithLegacies(ss, 'قسم_الرقابة_والمستخدمين');

  var customRecords = socialCareRaw.map(function(r) {
    return {
      id: String(r.id || r['معرف القيد'] || ''),
      sectionId: 'sec_social_welfare',
      createdAt: String(r.f_welf_date || r['تاريخ المراجعة'] || ''),
      createdBy: String(r.createdBy || r['الموظف المسؤول'] || 'قسم الرعاية الاجتماعية'),
      data: {
        f_welf_name: String(r.f_welf_name || r['اسم المواطن الرباعي'] || ''),
        f_welf_phone: String(r.f_welf_phone || r['رقم الهاتف'] || ''),
        f_welf_code: String(r.f_welf_code || r['رقم القيد / المعاملة الوزارية'] || ''),
        f_welf_type: String(r.f_welf_type || r['نوع الإعانة / الفئة'] || ''),
        f_welf_researcher: String(r.f_welf_researcher || r['حالة الباحث الاجتماعي'] || ''),
        f_welf_district: String(r.f_welf_district || r['القضاء / الناحية'] || ''),
        f_welf_date: String(r.f_welf_date || r['تاريخ المراجعة'] || ''),
        f_welf_notes: String(r.f_welf_notes || r['الملاحظات والتوجيهات'] || '')
      }
    };
  });

  // قراءة سجلات جميع الأقسام المخصصة المسجلة ديناميكياً من أوراقها المستقلة
  var dynamicRegistry = loadDynamicSectionRegistry();
  Object.keys(dynamicRegistry).forEach(function(secId) {
    var meta = dynamicRegistry[secId];
    if (!meta || !meta.sheetName) return;
    var dynSchema = {
      columns: (meta.columns || []).map(function(c) {
        return { key: c.key, header: c.header, aliases: [c.key, c.header] };
      })
    };
    var rows = getSingleSheetRawRecords(ss, meta.sheetName, dynSchema);
    rows.forEach(function(rowObj) {
      var recId = String(rowObj.id || rowObj['معرف القيد'] || '').trim();
      if (!recId) return;
      var dataMap = {};
      (meta.columns || []).forEach(function(col) {
        if (col.key === 'id' || col.key === 'createdAt' || col.key === 'createdBy') return;
        dataMap[col.key] = String(rowObj[col.key] || rowObj[col.header] || '');
      });
      customRecords.push({
        id: recId,
        sectionId: secId,
        createdAt: String(rowObj.createdAt || rowObj['تاريخ الإنشاء'] || ''),
        createdBy: String(rowObj.createdBy || rowObj['الموظف المسؤول'] || meta.title || ''),
        data: dataMap
      });
    });
  });

  return {
    status: 'online',
    success: true,
    schemaVersion: '2026-DYNAMIC-ONE-SHEET-PER-DEPARTMENT',
    appName: 'منظومة مكتب النائب علا الناشي',
    spreadsheetName: ss.getName(),
    sheetsCount: ss.getSheets().length,
    departmentSheets: Object.keys(CORE_SCHEMAS),
    customSectionSheets: Object.keys(dynamicRegistry).map(function(k) { return dynamicRegistry[k].sheetName; }),
    message: 'تم جلب كافة بيانات الأقسام الأساسية والمخصصة بنجاح من Google Sheets',
    data: {
      citizens: citizens,
      requests: requests,
      interviews: interviews,
      officialLetters: officialLetters,
      cheques: cheques,
      organizationRecords: organizationRecords,
      customRecords: customRecords,
      users: users
    },
    citizens: citizens,
    requests: requests,
    interviews: interviews,
    officialLetters: officialLetters,
    cheques: cheques,
    organizationRecords: organizationRecords,
    customRecords: customRecords,
    users: users,
    timestamp: new Date().toISOString()
  };
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getAllData';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping' || action === 'health') {
      return jsonResponse({
        success: true,
        status: 'online',
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheetsCount: ss.getSheets().length,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'reorganizeSheets') {
      var reorgInfo = reorganizeAllSheetsCleanly();
      return jsonResponse({
        success: true,
        message: 'تم ترتيب وتوحيد جميع أوراق Google Sheets بنجاح مع الحفاظ الكامل على الأقسام المخصصة',
        details: reorgInfo
      });
    }

    if (action === 'getCitizens') return jsonResponse({ success: true, data: getDepartmentRecordsWithLegacies(ss, 'قسم_الاستعلامات_والمراجعين') });
    if (action === 'getRequests') return jsonResponse({ success: true, data: getDepartmentRecordsWithLegacies(ss, 'قسم_الإدارة_والمعاملات') });
    if (action === 'getInterviews') return jsonResponse({ success: true, data: getDepartmentRecordsWithLegacies(ss, 'قسم_مقابلات_النائب') });

    if (action === 'listDriveFiles' || action === 'searchDriveFiles') {
      var targetFolderId = (e && e.parameter && e.parameter.folderId) ? e.parameter.folderId : '';
      var qText = (e && e.parameter && (e.parameter.query || e.parameter.q)) ? (e.parameter.query || e.parameter.q) : '';
      var lim = (e && e.parameter && e.parameter.limit) ? Number(e.parameter.limit) : 5000;
      var driveFiles = handleDriveList(targetFolderId, qText, lim);
      return jsonResponse({
        success: true,
        folderId: targetFolderId,
        totalInFolder: driveFiles.length,
        files: driveFiles
      });
    }

    return jsonResponse(buildAllDepartmentsPayload(ss));
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    var contents = {};
    if (e && e.postData && e.postData.contents) {
      try { contents = JSON.parse(e.postData.contents); } catch (parseErr) { contents = {}; }
    }

    var action = contents.action || 'appendRow';
    var table = contents.table || contents.sheetType || 'citizens';
    var data = contents.data || contents.record || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ping' || action === 'health') {
      return jsonResponse({
        success: true,
        status: 'online',
        spreadsheetId: ss.getId(),
        spreadsheetName: ss.getName(),
        sheetsCount: ss.getSheets().length,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'getAllData') {
      return jsonResponse(buildAllDepartmentsPayload(ss));
    }

    if (action === 'wipeAll') {
      // تصفير الصفوف فقط (A2:AZ) مع الحفاظ الكامل على الأوراق وترويساتها - محصور بصلاحية المطور
      var allWipeSheets = ss.getSheets();
      var clearedCount = 0;
      for (var w = 0; w < allWipeSheets.length; w++) {
        var wsh = allWipeSheets[w];
        var lastR = wsh.getLastRow();
        var lastC = wsh.getLastColumn();
        if (lastR > 1 && lastC > 0) {
          wsh.getRange(2, 1, lastR - 1, lastC).clearContent();
          clearedCount++;
        }
      }
      return jsonResponse({
        success: true,
        message: 'تم تصفير بيانات كافة الأوراق مع الحفاظ على الترويسات',
        clearedSheets: clearedCount,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'reorganizeSheets') {
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        setupSpreadsheet();
        handleBulkSync(ss, data);
      }
      var reorgRes = reorganizeAllSheetsCleanly();
      return jsonResponse({
        success: true,
        message: 'تم توحيد وترتيب كافة أوراق الأقسام في Google Sheets مع الحفاظ على الأقسام المخصصة بنجاح',
        details: reorgRes
      });
    }

    setupSpreadsheet();

    // إنشاء وترتيب ورقة مخصصة تلقائياً فور إضافة أي قسم أو أيقونة جديدة
    if (action === 'registerSection' || table === 'custom_sections') {
      if (action === 'delete') {
        return jsonResponse({ success: true, message: 'تم الحفاظ على ورقة القسم في الأرشيف دون حذف بياناتها' });
      }
      var createdMeta = registerDynamicCustomSection(ss, contents.section || data);
      return jsonResponse({
        success: true,
        message: 'تم إنشاء وتنظيم ورقة القسم المخصص وأعمدتها تلقائياً في Google Sheets بنجاح',
        registered: createdMeta,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'syncSchema') {
      var list = Array.isArray(contents.sections) ? contents.sections : (Array.isArray(data) ? data : []);
      var allRegistered = [];
      list.forEach(function(sec) {
        if (sec && (sec.isCustom || sec.fields || sec.subSections)) {
          var res = registerDynamicCustomSection(ss, sec);
          if (Array.isArray(res)) allRegistered = allRegistered.concat(res);
        }
      });
      return jsonResponse({
        success: true,
        message: 'تمت مزامنة وتنظيم كافة أوراق الأقسام الأساسية والمخصصة تلقائياً',
        registeredCount: allRegistered.length,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'bulk_sync' || action === 'syncAll') {
      if (Array.isArray(contents.customSections)) {
        contents.customSections.forEach(function(sec) {
          registerDynamicCustomSection(ss, sec);
        });
      }
      handleBulkSync(ss, data);
      if (contents.cleanupDuplicates) {
        reorganizeAllSheetsCleanly();
      }
      return jsonResponse({
        success: true,
        message: 'تم بنجاح حفظ وتحديث كافة البيانات بشكل غير تدميري في Google Sheets',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'uploadFile') {
      return jsonResponse(handleDriveUpload(contents));
    }

    if (action === 'listDriveFiles') {
      var targetFolderId = contents.folderId || '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc';
      var searchQuery = contents.query || contents.queryText || '';
      var reqLimit = Number(contents.limit) || 2500;
      var listRes = handleDriveList(targetFolderId, searchQuery, reqLimit);
      return jsonResponse({ success: true, totalInFolder: listRes.length, files: listRes });
    }

    if (action === 'deleteDriveFile') {
      return jsonResponse(handleDriveDelete(contents.fileId));
    }

    if (table === 'dropdowns' || table === 'settings' || table === 'drive_archive') {
      return jsonResponse({
        success: true,
        message: 'تم الحفاظ على هيكل الأوراق المنظم',
        timestamp: new Date().toISOString()
      });
    }

    // توجيه سجلات الأقسام المخصصة تلقائياً إلى ورقة القسم المخصصة لها
    if (table === 'custom_records') {
      var targetCustomId = contents.id || data.id;
      if (action === 'delete') {
        var reg = loadDynamicSectionRegistry();
        var secIdDel = String(contents.sectionId || data.sectionId || '').trim();
        var delSheetName = (secIdDel && reg[secIdDel]) ? reg[secIdDel].sheetName : (contents.sheetName || 'قسم_الرعاية_الاجتماعية');
        var delSheet = ss.getSheetByName(delSheetName);
        if (delSheet) handleDelete(delSheet, targetCustomId);
        return jsonResponse({ success: true, message: 'تم حذف السجل من ورقة القسم المخصص', sheet: delSheetName });
      }
      var writtenSheet = handleDynamicCustomRecordUpsert(ss, contents, data);
      return jsonResponse({
        success: true,
        message: 'تم حفظ سجل القسم المخصص في ورقته المستقلة بنجاح',
        sheet: writtenSheet,
        timestamp: new Date().toISOString()
      });
    }

    var targetSheetName = resolveSheetName(table);
    var schema = CORE_SCHEMAS[targetSheetName];
    var sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) {
      sheet = ss.insertSheet(targetSheetName);
      try { sheet.setRightToLeft(true); } catch (e) {}
    }

    var targetId = contents.id || data.Citizen_ID || data.Request_ID || data.Interview_ID || data.Letter_ID || data.User_ID || data.id;

    if (action === 'delete') {
      handleDelete(sheet, targetId);
      if (schema && schema.legacyNames) {
        schema.legacyNames.forEach(function(legName) {
          var legSheet = ss.getSheetByName(legName);
          if (legSheet) handleDelete(legSheet, targetId);
        });
      }
    } else if (schema) {
      handleStructuredUpsertBatch(sheet, schema, [data]);
    }

    return jsonResponse({
      success: true,
      message: 'تم حفظ السجل في ورقة القسم المخصصة وبعموده المرتب بنجاح',
      sheet: targetSheetName,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * إدخال وتحديث منظم غير تدميري (ID-Based Upsert) يحافظ على جميع القيم والأعمدة الموجودة مسبقاً
 */
function handleStructuredUpsertBatch(sheet, schema, items) {
  if (!Array.isArray(items) || items.length === 0) return;

  var standardHeaders = schema.columns.map(function(c) { return c.header; });
  var existingHeaders = ensureNonDestructiveHeaders(sheet, standardHeaders, schema.headerBg, schema.headerFg);

  var colToSchema = existingHeaders.map(function(h) {
    for (var cIdx = 0; cIdx < schema.columns.length; cIdx++) {
      var col = schema.columns[cIdx];
      if (h === col.header || h === col.key || (col.aliases && col.aliases.indexOf(h) !== -1)) {
        return col;
      }
    }
    return null;
  });

  var lastRow = sheet.getLastRow();
  var idRowMap = {};
  if (lastRow > 1) {
    var existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var r = 0; r < existingIds.length; r++) {
      var key = String(existingIds[r][0] || '').trim();
      if (key) idRowMap[key] = r + 2;
    }
  }

  var rowsToAppend = [];

  items.forEach(function(item) {
    if (!item || typeof item !== 'object') return;
    var idCol = schema.columns[0];
    var idVal = cleanCellVal(extractFieldBySchemaColumn(item, idCol));
    if (!idVal) return;

    var rowVals = existingHeaders.map(function(h, colIdx) {
      var matchedCol = colToSchema[colIdx];
      if (matchedCol) {
        return cleanCellVal(extractFieldBySchemaColumn(item, matchedCol));
      }
      // الحفاظ على أي حقل يطابق اسم عمود مضاف يدوياً في الورقة
      var rawDirect = item[h] !== undefined ? item[h] : (item.data && item.data[h]);
      return cleanCellVal(rawDirect);
    });

    var existingRowNum = idRowMap[idVal];
    if (existingRowNum) {
      var prevRow = sheet.getRange(existingRowNum, 1, 1, existingHeaders.length).getValues()[0];
      var merged = rowVals.map(function(v, idx) {
        return v !== '' ? v : (prevRow[idx] !== undefined ? prevRow[idx] : '');
      });
      sheet.getRange(existingRowNum, 1, 1, merged.length).setValues([merged]);
    } else {
      idRowMap[idVal] = lastRow + rowsToAppend.length + 1;
      rowsToAppend.push(rowVals);
    }
  });

  if (rowsToAppend.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rowsToAppend.length, existingHeaders.length).setValues(rowsToAppend);
    try {
      var addedRange = sheet.getRange(startRow, 1, rowsToAppend.length, existingHeaders.length);
      addedRange.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
      addedRange.setVerticalAlignment('middle');
    } catch (e) {}
  }
}

function handleDelete(sheet, id) {
  if (!id) return;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 2);
      break;
    }
  }
}

function handleBulkSync(ss, allData) {
  if (!allData || typeof allData !== 'object') return;

  // 1. تسجيل أي أقسام مخصصة أولاً لضمان إنشاء أوراقها وأعمدتها قبل إدراج السجلات
  if (Array.isArray(allData.customSections) && allData.customSections.length > 0) {
    allData.customSections.forEach(function(sec) {
      if (sec) registerDynamicCustomSection(ss, sec);
    });
  }

  var mapping = [
    { key: 'citizens', name: 'قسم_الاستعلامات_والمراجعين' },
    { key: 'requests', name: 'قسم_الإدارة_والمعاملات' },
    { key: 'interviews', name: 'قسم_مقابلات_النائب' },
    { key: 'organizationRecords', name: 'قسم_التنظيم_والجماهير' },
    { key: 'officialLetters', name: 'قسم_المكنة_والكتب_الرسمية' },
    { key: 'cheques', name: 'قسم_المساعدات_والصكوك' },
    { key: 'users', name: 'قسم_الرقابة_والمستخدمين' }
  ];
  mapping.forEach(function(m) {
    var items = allData[m.key];
    if (Array.isArray(items) && items.length > 0) {
      var sheet = ss.getSheetByName(m.name);
      if (!sheet) {
        sheet = ss.insertSheet(m.name);
        try { sheet.setRightToLeft(true); } catch (e) {}
      }
      handleStructuredUpsertBatch(sheet, CORE_SCHEMAS[m.name], items);
    }
  });

  // 2. توجيه سجلات الأقسام المخصصة حسب sectionId (الرعاية الاجتماعية أو ورقة كل قسم مخصص)
  if (Array.isArray(allData.customRecords) && allData.customRecords.length > 0) {
    var socialItems = [];
    var dynamicItems = [];
    allData.customRecords.forEach(function(rec) {
      if (!rec) return;
      var secId = String(rec.sectionId || '').trim();
      if (!secId || secId === 'sec_social_welfare') {
        socialItems.push(rec);
      } else {
        dynamicItems.push(rec);
      }
    });

    if (socialItems.length > 0) {
      var socialSheet = ss.getSheetByName('قسم_الرعاية_الاجتماعية');
      if (!socialSheet) {
        socialSheet = ss.insertSheet('قسم_الرعاية_الاجتماعية');
        try { socialSheet.setRightToLeft(true); } catch (e) {}
      }
      handleStructuredUpsertBatch(socialSheet, CORE_SCHEMAS['قسم_الرعاية_الاجتماعية'], socialItems);
    }

    dynamicItems.forEach(function(dRec) {
      handleDynamicCustomRecordUpsert(ss, {
        sectionId: dRec.sectionId,
        sheetName: dRec.sheetName,
        sectionTitle: dRec.sectionTitle,
        sectionColumns: dRec.sectionColumns
      }, dRec.payload || dRec);
    });
  }
}

function handleDriveUpload(contents) {
  var folderId = contents.folderId;
  var fileName = contents.fileName || ('document_' + Date.now() + '.jpg');
  var base64Data = contents.fileData || contents.data;
  if (!base64Data) return { success: false, error: 'لم يتم إرسال بيانات الملف' };

  var folder;
  if (folderId) {
    try { folder = DriveApp.getFolderById(folderId); } catch (e) { folder = DriveApp.getRootFolder(); }
  } else {
    folder = DriveApp.getRootFolder();
  }

  var cleanBase64 = base64Data;
  var contentType = 'image/jpeg';
  if (base64Data.indexOf('data:') === 0) {
    var parts = base64Data.split(',');
    var match = parts[0].match(/:(.*?);/);
    if (match) contentType = match[1];
    cleanBase64 = parts[1];
  }

  var decodedBytes = Utilities.base64Decode(cleanBase64);
  var blob = Utilities.newBlob(decodedBytes, contentType, fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    fileId: file.getId(),
    webViewLink: file.getUrl(),
    directUrl: 'https://drive.google.com/uc?export=view&id=' + file.getId()
  };
}

function normalizeArabicForDrive(str) {
  return String(str || '')
    .replace(/[\\u064B-\\u065F\\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, function(d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
    .replace(/\\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function handleDriveList(folderId, query, maxLimit) {
  var results = [];
  var limit = Math.min(Math.max(Number(maxLimit) || 2500, 1), 2500);
  try {
    var folder;
    if (folderId) {
      var cleanFolderId = String(folderId).trim();
      var m = cleanFolderId.match(/folders\\/([a-zA-Z0-9_-]+)/);
      if (m && m[1]) cleanFolderId = m[1];
      try { folder = DriveApp.getFolderById(cleanFolderId); } catch(e) { folder = DriveApp.getRootFolder(); }
    } else {
      folder = DriveApp.getRootFolder();
    }
    var normQ = normalizeArabicForDrive(query || '');
    var qTokens = normQ ? normQ.split(' ').filter(function(t) { return t.length > 0; }) : [];
    var files = folder.getFiles();
    var count = 0;
    while (files.hasNext() && count < limit) {
      var f = files.next();
      if (f.isTrashed()) continue;
      var name = f.getName();
      var mime = f.getMimeType();
      var normName = normalizeArabicForDrive(name);
      var matched = true;
      if (qTokens.length > 0) {
        for (var i = 0; i < qTokens.length; i++) {
          if (normName.indexOf(qTokens[i]) === -1) {
            matched = false;
            break;
          }
        }
      }
      if (matched) {
        var fid = f.getId();
        results.push({
          id: fid,
          name: name,
          mimeType: mime,
          size: String(f.getSize()),
          thumbnailLink: 'https://drive.google.com/thumbnail?id=' + fid + '&sz=w1200',
          webViewLink: 'https://drive.google.com/file/d/' + fid + '/view',
          webContentLink: 'https://drive.google.com/uc?export=download&id=' + fid,
          url: 'https://drive.google.com/thumbnail?id=' + fid + '&sz=w1600',
          viewUrl: f.getUrl(),
          createdTime: f.getDateCreated().toISOString(),
          modifiedTime: f.getLastUpdated().toISOString()
        });
        count++;
      }
    }
    results.sort(function(a, b) {
      return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
    });
  } catch (err) {}
  return results;
}

function handleDriveDelete(fileId) {
  try {
    if (!fileId) return { success: false, error: 'معرف الملف غير محدد' };
    var f = DriveApp.getFileById(fileId);
    f.setTrashed(true);
    return { success: true, message: 'تم نقل الملف إلى سلة محذوفات Google Drive' };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
`;

export const APPS_SCRIPT_PRODUCTION_CODE = GOOGLE_APPS_SCRIPT_SOURCE;

export const APPS_SCRIPT_SETUP_GUIDE = [
  'افتح ملف Google Sheets المخصص لمنظومة مكتب النائب',
  'من القائمة العلوية اضغط على Extensions (الإضافات) ثم اختر Apps Script',
  'احذف الكود القديم في نافذة Code.gs والصق هذا الكود المحدث كاملاً ثم اضغط حفظ (Ctrl + S)',
  'لترتيب الجدول فوراً وتوحيد كل قسم في ورقة واحدة فقط مع دمج وحذف الأوراق المكررة: اختر الدالة reorganizeAllSheetsCleanly من الشريط العلوي واضغط Run',
  'اضغط على زر Deploy (نشر) بالأعلى ← Manage deployments (إدارة عمليات النشر) ← اضغط أيقونة القلم (Edit) ← اختر Version: New version (إصدار جديد) ثم اضغط Deploy'
];
