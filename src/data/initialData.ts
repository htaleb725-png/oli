import {
  User,
  Citizen,
  OfficeRequest,
  ChequeRecord,
  Interview,
  OrganizationRecord,
  DropdownItem,
  AuditLog,
  DynamicField,
  DocumentArchiveItem,
  WhatsAppTemplate,
  SystemSettings
} from '../types';

export const INITIAL_SETTINGS: SystemSettings = {
  appName: 'برنامج مكتب النائب علا الناشي',
  deputyName: 'النائب المهندسة علا عودة الناشي',
  deputyTitle: 'عضو مجلس النواب العراقي - الدورة الخامسة',
  province: 'محافظة ذي قار',
  officeAddress: 'الناصرية - شارع المحافظة القديم - مقابل ديوان المحافظة',
  hotline: '07801234567',
  logoUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=200&auto=format&fit=crop&q=80',
  parliamentEmblemUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Coat_of_arms_of_Iraq_%282008%E2%80%93present%29.svg/200px-Coat_of_arms_of_Iraq_%282008%E2%80%93present%29.svg.png',
  maintenanceMode: false,
  tickerNews: [
    'المكتب يستقبل المراجعين يومياً من الساعة 9 صباحاً وحتى 2 ظهراً',
    'تم تفعيل الربط السحابي المباشر وقاعدة بيانات Firebase بنجاح',
    'نظام الأرشفة الإلكتروني والمزامنة اللحظية قيد التشغيل المباشر لخدمة أهالي ذي قار'
  ],
  googleSheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
  googleDriveFolderId: '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc',
  appsScriptUrl: '',
  primaryThemeColor: 'amber',
  developerPasscode: '2026',
  allowAdminOpenDriveFolder: true,
  uiCustomizations: {
    buttonSize: 'standard',
    inputFieldSize: 'standard',
    borderRadius: 'standard',
    showSecondaryPhone: true,
    showClanSurname: true,
    showAcademicEducation: true,
    showCitizenRating: true,
    showDependencyStatus: true,
    tableDensity: 'standard'
  }
};

export const INITIAL_USERS: User[] = [
  {
    User_ID: 'USR-001',
    Username: 'developer',
    Password: '123',
    Role: 'developer',
    RoleArabic: 'مطور النظام (صلاحية مطلقة)',
    Status: 'active',
    FullName: 'مطور المنظومة البرمجي',
    Department: 'قسم تكنولوجيا المعلومات والبرمجة',
    CreatedAt: '2026-01-01',
    Permissions: [
      'scan_upload', 'requests_create', 'requests_edit', 'requests_delete', 
      'workflow_referral', 'citizens_register', 'print_cards', 'org_evaluation', 
      'official_letters', 'export_reports', 'view_archive'
    ]
  }
];

export const INITIAL_DROPDOWNS: DropdownItem[] = [
  // Surnames / Clans (العشائر والألقاب)
  { Category: 'Surname', ItemValue: 'الناشي' },
  { Category: 'Surname', ItemValue: 'الخفاجي' },
  { Category: 'Surname', ItemValue: 'الحسيني' },
  { Category: 'Surname', ItemValue: 'السعدون' },
  { Category: 'Surname', ItemValue: 'الإبراهيمي' },
  { Category: 'Surname', ItemValue: 'الجابري' },
  { Category: 'Surname', ItemValue: 'التميمي' },
  { Category: 'Surname', ItemValue: 'الزيدي' },
  { Category: 'Surname', ItemValue: 'الساعدي' },
  { Category: 'Surname', ItemValue: 'العبادي' },
  { Category: 'Surname', ItemValue: 'الأسدي' },
  { Category: 'Surname', ItemValue: 'الشمري' },
  { Category: 'Surname', ItemValue: 'الكعبي' },
  { Category: 'Surname', ItemValue: 'المالكي' },
  { Category: 'Surname', ItemValue: 'البدري' },
  { Category: 'Surname', ItemValue: 'الموسوي' },
  { Category: 'Surname', ItemValue: 'الغزي' },
  { Category: 'Surname', ItemValue: 'العسكري' },

  // Entities (الجهات والوزارات المعنية)
  { Category: 'Entity', ItemValue: 'وزارة الداخلية' },
  { Category: 'Entity', ItemValue: 'هيئة الحشد الشعبي' },
  { Category: 'Entity', ItemValue: 'مدير ماء ذي قار' },
  { Category: 'Entity', ItemValue: 'محافظ ذي قار' },
  { Category: 'Entity', ItemValue: 'وزارة التربية' },
  { Category: 'Entity', ItemValue: 'وزارة الصحة / دائرة صحة ذي قار' },
  { Category: 'Entity', ItemValue: 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)' },
  { Category: 'Entity', ItemValue: 'وزارة النفط / شركة نفط ذي قار' },
  { Category: 'Entity', ItemValue: 'مؤسسة الشهداء' },
  { Category: 'Entity', ItemValue: 'مؤسسة السجناء السياسيين' },
  { Category: 'Entity', ItemValue: 'وزارة الدفاع' },
  { Category: 'Entity', ItemValue: 'مديرية مجاري ذي قار' },
  { Category: 'Entity', ItemValue: 'مديرية توزيع كهرباء ذي قار' },
  { Category: 'Entity', ItemValue: 'مديرية بلدية الناصرية' },
  { Category: 'Entity', ItemValue: 'مديرية زراعة ذي قار' },
  { Category: 'Entity', ItemValue: 'دائرة الرعاية الاجتماعية' },
  { Category: 'Entity', ItemValue: 'وزارة التعليم العالي / جامعة ذي قار' },

  // Ratings
  { Category: 'Rating', ItemValue: 'لائق' },
  { Category: 'Rating', ItemValue: 'غير لائق' },
  { Category: 'Rating', ItemValue: 'قلق' },
  { Category: 'Rating', ItemValue: 'غير محترم' },

  // Education
  { Category: 'Education', ItemValue: 'أمي / يقرأ ويكتب' },
  { Category: 'Education', ItemValue: 'ابتدائية' },
  { Category: 'Education', ItemValue: 'متوسطة' },
  { Category: 'Education', ItemValue: 'إعدادية' },
  { Category: 'Education', ItemValue: 'دبلوم فني' },
  { Category: 'Education', ItemValue: 'بكالوريوس' },
  { Category: 'Education', ItemValue: 'دبلوم عالي / ماجستير' },
  { Category: 'Education', ItemValue: 'دكتوراه' },

  // Jobs / Social segments
  { Category: 'Job', ItemValue: 'عاطل عن العمل' },
  { Category: 'Job', ItemValue: 'كاسب' },
  { Category: 'Job', ItemValue: 'موظف حكومي' },
  { Category: 'Job', ItemValue: 'متقاعد' },
  { Category: 'Job', ItemValue: 'طالب' },
  { Category: 'Job', ItemValue: 'كوادر طبية / صحية' },
  { Category: 'Job', ItemValue: 'معلم / تدريسي' },
  { Category: 'Job', ItemValue: 'مهندس' },
  { Category: 'Job', ItemValue: 'منتسب أمني / عسكري' },
  { Category: 'Job', ItemValue: 'ربة بيت' },
  { Category: 'Job', ItemValue: 'فلاح / مزارع' },

  // Districts (الأقضية)
  { Category: 'District', ItemValue: 'قضاء الناصرية' },
  { Category: 'District', ItemValue: 'قضاء الشطرة' },
  { Category: 'District', ItemValue: 'قضاء الرفاعي' },
  { Category: 'District', ItemValue: 'قضاء سوق الشيوخ' },
  { Category: 'District', ItemValue: 'قضاء الجبايش' },
  { Category: 'District', ItemValue: 'قضاء قلعة سكر' },
  { Category: 'District', ItemValue: 'قضاء الغراف' },
  { Category: 'District', ItemValue: 'قضاء الدواية' },
  { Category: 'District', ItemValue: 'قضاء الفهود' },
  { Category: 'District', ItemValue: 'قضاء الإصلاح' },
  { Category: 'District', ItemValue: 'قضاء البطحاء' },
  { Category: 'District', ItemValue: 'قضاء النصر' },
  { Category: 'District', ItemValue: 'قضاء سيد دخيل' },

  // Sub-Districts (النواحي والأحياء)
  { Category: 'SubDistrict', ItemValue: 'حي أور' },
  { Category: 'SubDistrict', ItemValue: 'حي الحسين' },
  { Category: 'SubDistrict', ItemValue: 'حي سومر' },
  { Category: 'SubDistrict', ItemValue: 'حي الشهداء' },
  { Category: 'SubDistrict', ItemValue: 'ناحية أور' },
  { Category: 'SubDistrict', ItemValue: 'ناحية الفضلية' },
  { Category: 'SubDistrict', ItemValue: 'ناحية المنار' },
  { Category: 'SubDistrict', ItemValue: 'ناحية كرمة بني سعيد' },
  { Category: 'SubDistrict', ItemValue: 'ناحية العكيكة' },
  { Category: 'SubDistrict', ItemValue: 'ناحية الطار' },
  { Category: 'SubDistrict', ItemValue: 'مركز القضاء' },
  { Category: 'SubDistrict', ItemValue: 'المنطقة الزراعية' },

  // Referral Sources (المصرح / المعرف)
  { Category: 'ReferralSource', ItemValue: 'مباشر بدون معرف' },
  { Category: 'ReferralSource', ItemValue: 'أم زكريا' },
  { Category: 'ReferralSource', ItemValue: 'أم غسان' },
  { Category: 'ReferralSource', ItemValue: 'أبو عباس فاضل' },
  { Category: 'ReferralSource', ItemValue: 'الشيخ أبو أحمد الخفاجي' },
  { Category: 'ReferralSource', ItemValue: 'الحاج أبو علي الناشي' },
  { Category: 'ReferralSource', ItemValue: 'الأستاذة مروة الموسوي' },
  { Category: 'ReferralSource', ItemValue: 'أم حسين الناشئ' },
  { Category: 'ReferralSource', ItemValue: 'أبو باقر الدراجي' },
  { Category: 'ReferralSource', ItemValue: 'الناشط الإعلامي حيدر السعدي' },
  { Category: 'ReferralSource', ItemValue: 'مكتب الشطرة الفرعي' },
  { Category: 'ReferralSource', ItemValue: 'رابطة شباب سوق الشيوخ' }
];

export const INITIAL_CITIZENS: Citizen[] = [];
export const INITIAL_REQUESTS: OfficeRequest[] = [];
export const INITIAL_INTERVIEWS: Interview[] = [];
export const INITIAL_ORGANIZATION: OrganizationRecord[] = [];
export const INITIAL_CHEQUES: ChequeRecord[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
export const INITIAL_DYNAMIC_FIELDS: DynamicField[] = [];
export const INITIAL_DOCUMENTS: DocumentArchiveItem[] = [];

export const INITIAL_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'TMP-01',
    title: 'إشعار استلام الطلب وتسجيل الرقم التعريفي',
    category: 'استلام طلب',
    text: 'الأخ/الأخت العزيز/ة {name}، تحية طيبة.\nتم بعون الله استلام وتوثيق طلبكم لدى مكتب النائب المهندسة علا عودة الناشي.\nرقمكم التعريفي الثابت: {citizen_id}\nرقم الطلب الإداري: {request_id}\nنحن في خدمتكم وستتم متابعة الإجراءات وموافاتكم بالنتائج أولاً بأول.'
  },
  {
    id: 'TMP-02',
    title: 'إشعار إنجاز المعاملة وصدور الكتاب الرسمي',
    category: 'إنجاز معاملة',
    text: 'الأخ/الأخت {name} المحترم/ة،\nيسر مكتب النائب المهندسة علا عودة الناشي إعلامكم بأنه تم إنجاز طلبكم ومفاتحة الجهة المعنية ({entity}) بنجاح.\nيرجى مراجعة المكتب أو مراجعة الجهة المعنية لاستلام النتيجة مع التقدير.'
  },
  {
    id: 'TMP-03',
    title: 'تحديد موعد مقابلة مباشرة مع النائب',
    category: 'تحديد مقابلة',
    text: 'الأخ/الأخت {name} المحترم/ة،\nنود إعلامكم بأنه تم تحديد موعد مقابلتكم المباشرة مع النائب المهندسة علا عودة الناشي.\nالموعد: {date} في تمام الساعة {time}.\nالمكان: مقر مكتب النائب - الناصرية.\nيرجى الحضور في الموعد المحدد مع جلب كافة الأوليات.'
  },
  {
    id: 'TMP-04',
    title: 'تحديث موقف المعاملة وقيد التدقيق',
    category: 'تحديث موقف',
    text: 'الأخ/الأخت {name}،\nنفيدكم علماً بأن معاملتكم المسجلة بالرقم {request_id} قيد المتابعة والتدقيق الإداري حالياً لدى الجهات الرسمية، وسنوافيكم فور صدور أي توجيه رسمي.'
  }
];
