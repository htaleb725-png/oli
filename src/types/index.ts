export type UserRole = 
  | 'developer'          // مطور النظام
  | 'director'           // مدير المكتب
  | 'admin'              // موظف الإدارة
  | 'reception'          // موظف الاستعلامات
  | 'social_care'        // مسؤول قسم الرعاية الاجتماعية (مستقل)
  | 'social_care_officer'
  | 'deputy'             // النائب
  | 'organization'       // موظف التنظيم
  | 'machine'            // مدير مكنة المكتب
  | 'archive'            // مسؤول الأرشيف
  | 'audit'              // مسؤول الرقابة والتشريع
  | 'reception_officer'
  | 'admin_officer'
  | 'interviews_officer'
  | 'organization_officer'
  | 'machine_officer';

export interface PermissionDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  { id: 'scan_upload', name: 'أرشفة وإرفاق صور المستندات', category: 'الأرشفة والوثائق', description: 'رفع صور المستندات وحفظها في سجل الطلبات' },
  { id: 'requests_create', name: 'تسجيل وإنشاء طلبات المواطنين', category: 'المعاملات', description: 'إضافة كتب وطلبات جديدة للمراجعين' },
  { id: 'requests_edit', name: 'تعديل المعاملات وتحديث الحالة', category: 'المعاملات', description: 'تعديل الجهة، الحالة، الأولوية وهامش المعاملة' },
  { id: 'requests_delete', name: 'حذف المعاملات والطلبات', category: 'المعاملات', description: 'صلاحية حذف المعاملة من السجلات' },
  { id: 'workflow_referral', name: 'إحالة مسار المعاملة بين الأقسام', category: 'المسار الإداري', description: 'إحالة المعاملة للمكتب، الإدارة، أو التنظيم' },
  { id: 'citizens_register', name: 'تسجيل وتعديل بيانات المراجعين', category: 'الاستعلامات', description: 'إدخال مراجع جديد بالاستعلامات وتحديث بياناته' },
  { id: 'print_cards', name: 'طباعة الباجات والباركودات', category: 'الطباعة', description: 'طباعة باجات المراجعين والباركود الذكي' },
  { id: 'org_evaluation', name: 'التقييم التنظيمي والنتيجة النهائية', category: 'التنظيم', description: 'تثبيت النتائج الـ 4، استبيان الرضا، والمفاتيح' },
  { id: 'official_letters', name: 'تحرير وطباعة الكتب والمخاطبات', category: 'المكنة والطباعة', description: 'إصدار الكتب الرسمية وإدراج الهوامش' },
  { id: 'export_reports', name: 'تصدير التقارير وسجلات الإكسل', category: 'التقارير', description: 'تصدير إحصائيات الأداء وسجلات المراجعين' },
  { id: 'view_archive', name: 'الاطلاع على الأرشيف والسجل العام', category: 'الأرشيف', description: 'معاينة أرشيف الصور والملفات والسجل التاريخي' },
  { id: 'access_social_care', name: 'الدخول وإدارة قسم الرعاية الاجتماعية', category: 'قسم الرعاية المستقل', description: 'صلاحية فتح والعمل على قسم الرعاية الاجتماعية وشبكة الحماية' },
  { id: 'manage_permissions', name: 'إدارة الموظفين ومنح الصلاحيات', category: 'الإدارة العليا', description: 'إضافة وتعديل الموظفين ومنح صلاحيات الأقسام' }
];

export interface SystemSectionOption {
  id: string;
  label: string;
  description: string;
  restrictedByDefault?: boolean;
  developerOnly?: boolean;
}

export const SYSTEM_SECTIONS_REGISTRY: SystemSectionOption[] = [
  { id: 'reception', label: 'قسم الاستعلامات والمراجعين', description: 'تسجيل المراجعين والبطاقات والاستعلام' },
  { id: 'admin', label: 'قسم الإدارة والمعاملات', description: 'متابعة الطلبات والصادر والوارد الحكومي' },
  { id: 'social_care', label: 'قسم الرعاية الاجتماعية (مستقل)', description: 'شبكة الحماية، المعين المتفرغ، والماستر كارد — يتطلب صلاحية صريحة', restrictedByDefault: true },
  { id: 'director', label: 'قسم مدير المكتب التنفيذي', description: 'اعتماد وتوجيه وارد الاستعلامات والإشراف' },
  { id: 'interviews', label: 'قسم مقابلات النائب', description: 'جدول المواعيد والمقابلات المباشرة' },
  { id: 'organization', label: 'قسم التنظيم والجماهير', description: 'شؤون العشائر والموقف الجماهيري' },
  { id: 'search_archive', label: 'قسم البحث الشامل والأرشيف', description: 'البحث العام واستخراج الهويات والملفات' },
  { id: 'drive_requests', label: 'أرشيف بريد Google Drive', description: 'عرض وبحث وطباعة وحذف ملفات Drive' },
  { id: 'reports', label: 'قسم التقارير والإحصائيات', description: 'مؤشرات الأداء وتصدير Excel' },
  { id: 'audit', label: 'قسم الرقابة والتدقيق والمتابعة', description: 'سجل الحوكمة والرقابة والمتابعة' },
  { id: 'whatsapp', label: 'مراسلات الواتساب التلقائية', description: 'إشعار وتحديث المراجعين عبر الواتساب' },
  { id: 'blacklist', label: 'القائمة السوداء والمحظورين', description: 'سجل المحظورين والرقابة الأمنية' }
];

export interface User {
  User_ID: string;
  Username: string;
  Password?: string;
  Phone?: string;
  Role: UserRole;
  RoleArabic: string;
  Status?: 'active' | 'frozen';
  Active?: boolean;
  FullName: string;
  Department: string;
  JobTitle?: string;
  Avatar?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  Permissions?: string[]; // الصلاحيات الممنوحة للموظف
  AllowedSections?: string[]; // الأقسام المسموح للموظف برؤيتها والدخول إليها (يحددها المطور أو المدير التنفيذي)
}

export type CitizenRating = 'لائق' | 'غير لائق' | 'قلق' | 'غير محترم' | string;
export type Gender = 'ذكر' | 'أنثى';
export type OrgRating = 'مؤيد' | 'محايد' | 'ضعيف' | 'متردد' | 'معارض' | 'كادر قيادي' | 'شخصية مؤثرة' | string;

export type WorkflowStage = 'الاستعلامات' | 'مدير المكتب' | 'مدير الإدارة' | 'مدير التنظيم' | 'مكتمل';

export interface WorkflowAction {
  id: string;
  fromStage: WorkflowStage | string;
  toStage: WorkflowStage | string;
  fromUser: string;
  actionDate: string;
  directiveNote?: string;
  statusText?: string;
  targetEntity?: string;
  FromStage?: WorkflowStage | string;
  ToStage?: WorkflowStage | string;
  ActionBy?: string;
  Timestamp?: string;
  DirectiveNotes?: string;
}

export interface Citizen {
  Citizen_ID: string;
  FirstName?: string;
  FatherName?: string;
  GrandFatherName?: string;
  GreatGrandFatherName?: string;
  Surname?: string;
  FullName: string;
  Phone1: string;
  Phone2?: string;
  National_ID?: string;
  Job?: string;
  Education?: string;
  Gender: Gender;
  Rating: CitizenRating;
  District: string;
  SubDistrict: string;
  ResidentialArea?: string; // منطقة السكن / الحي / المحلة (الشهداء، أريدو، الإسكان القديم...)
  NearestLandmark?: string; // أقرب نقطة دالة (اختياري)
  ReferralSource?: string;
  CreatedAt: string;
  CreatedBy?: string;
  CurrentStage?: WorkflowStage;
  WorkflowHistory?: WorkflowAction[];
  CustomFields?: Record<string, string | number | boolean>;
  PhotoUrl?: string;
  RegisteredVia?: 'استعلامات' | 'إدارة' | 'بوابة_المواطن' | 'قارئ OCR الذكي' | 'مسح OCR ذكي' | 'مسح OCR فردي' | 'أرشفة صور' | string;
  AttendanceType?: 'شخصياً' | 'بيد شخص آخر (معتمد)' | 'عبر معتمد' | 'وكيل' | string; // شخصياً أو عبر وسيط/معتمد
  ProxyName?: string;     // اسم الشخص الذي جلب الطلب
  ProxyPhone?: string;    // رقم هاتف الشخص الذي جلب الطلب
  ProxyAddress?: string;  // عنوان سكن الشخص الذي جلب الطلب
  ProxyRelation?: string; // صلة القرابة أو الصفة
  DependencyStatus?: 'مستقل' | 'غير مستقل'; // المستفيدين المستقلين أو غير المستقلين
  IsBlocked?: boolean;    // حالة الحظر في القائمة السوداء
  BlockReason?: string;   // سبب الحظر
  BlockedAt?: string;     // تاريخ الحظر
  BlockedBy?: string;     // الموظف القائم بالحظر
  IsArchived?: boolean;   // هل تم نقله إلى الأرشيف طويل الأمد
  IsHistoricalImported?: boolean; // مستورد من شيت إكسل تاريخي (لا يزاحم العمل اليومي المباشر)
  ArchivedAt?: string;   // تاريخ الأرشفة الذكية
  ArchivedBy?: string;   // الموظف الذي قام بالأرشفة
  ArchiveNotes?: string; // ملاحظات الأرشفة
  ArchiveCode?: string;  // كود الحفظ الأرشيفي
  archivedInSections?: string[];   // أرشفة مستقلة لكل قسم (مثل: reception, director, admin, organization)
  unarchivedInSections?: string[]; // استرجاع مستقل لكل قسم لسجلات الأرشيف/المسترد
  UpdatedAt?: string;
}

export type RequestStatus = 'مستلم' | 'غير مستلم' | 'معاد' | 'غير مستوفي للشروط' | 'خاص' | (string & {});
export type ProcessingStatus = 'منجز' | 'قيد الإجراء' | 'قيد التدقيق' | 'مرفوض' | 'تم الطباعة' | 'مرسل إلى الوزارة/الهيئة' | 'بانتظار الموافقة' | 'مسودة' | (string & {});
export type Priority = 'عاجل' | 'عام' | 'خاص جداً' | (string & {});

export interface RequestScanAttachment {
  id: string;
  url: string;               // صورة الاسكنر كما هي
  fileName?: string;         // اسم الملف
  uploadedBy: string;        // اسم الموظف القائم بالرفع
  uploadedAt: string;        // تاريخ ووقت الرفع
  notes?: string;            // ملاحظات
}

export interface OfficeRequest {
  Request_ID: string;
  Citizen_ID: string;
  CitizenName: string;
  CitizenPhone?: string;
  CitizenAddress?: string;
  Entity: string; // الجهة المعنية
  RequestStatus: RequestStatus;
  ProcessingStatus: ProcessingStatus;
  Priority: Priority;
  Details: string;
  AttachmentRequest?: string;  // الطلب المقدم
  AttachmentResponse?: string; // الطلب المستلم / كتاب الإجابة
  AttachedRequestImage?: string; // صورة أو مسح الطلب المرفق كما هي
  ScanUploadedBy?: string;     // اسم الموظف الذي قام برفع الاسكنر
  ScanUploadedAt?: string;     // تاريخ ووقت رفع الاسكنر
  ScanAttachments?: RequestScanAttachment[]; // سجل بكافة صور الاسكنر المرفقة مع اسم الموظف والتاريخ
  CreatedAt: string;
  CreatedDate?: string;
  CreatedBy: string;
  CurrentStage?: WorkflowStage;
  WorkflowHistory?: WorkflowAction[];
  DeputyNotes?: string;
  ExecutiveAction?: string;
  OutgoingNumber?: string; // العدد الصادر أو رقم الكتاب الرسمي
  OutgoingDate?: string;   // تاريخ الصادر
  IsKhadamatAlliance?: boolean; // خاص بتحالف خدمات
  RegisteredVia?: 'استعلامات' | 'إدارة' | 'بوابة_المواطن' | string;
  AttendanceType?: 'شخصياً' | 'بيد شخص آخر (معتمد)' | 'عبر معتمد' | 'وكيل' | string;
  ProxyName?: string;
  ProxyPhone?: string;
  ProxyAddress?: string;
  ProxyRelation?: string;
  DependencyStatus?: 'مستقل' | 'غير مستقل' | (string & {});
  GeneratedAiDraft?: string; // الطلب المولد بالذكاء الاصطناعي
  CustomFields?: Record<string, string | number | boolean>;
  DirectorDecision?: 'خاص' | 'عام' | 'رفض' | string; // قرار المدير: خاص، عام، أو رفض
  DirectorNotes?: string; // ملاحظات وتوجيهات المدير التنفيذي
  RejectionReason?: string; // سبب الرفض المعتمد من قبل المدير
  DirectorDecisionDate?: string; // تاريخ قرار المدير
  DirectorDecisionBy?: string; // اسم المدير الذي اتخذ القرار
  ReceptionNotes?: string; // الملاحظات الأصلية التي أدلى بها قسم الاستعلامات
  Education?: string;      // التحصيل الدراسي
  Job?: string;            // نوع العمل
  ReferralSource?: string; // المعرف
  Address?: string;        // عنوان السكن
  ResidentialArea?: string;// منطقة السكن
  NearestLandmark?: string;// أقرب نقطة دالة
  Margin?: string;         // الهامش الرسمي
  OtherNotes?: string;     // ملاحظات أخرى
  IsHistoricalImported?: boolean; // مستورد من شيت إكسل تاريخي (لا يزاحم العمل اليومي المباشر)
  IsBlocked?: boolean;     // هل المراجع محظور
  BlockReason?: string;    // سبب الحظر
  IsArchived?: boolean;    // هل تم نقل الطلب إلى الأرشيف طويل الأمد
  ArchivedAt?: string;    // تاريخ ووقت الأرشفة
  ArchiveCode?: string;   // كود الحفظ الأرشيفي
  DeliveryStatus?: 'مستلم' | 'غير مستلم'; // هل قام المراجع باستلام الطلب المنجز أم لا
  DeliveredAt?: string;   // تاريخ استلام الطلب من قبل المراجع
  DeliveredBy?: string;   // الموظف الذي وثّق تسليم الطلب
  TargetDepartment?: string; // القسم المخصص الذي تنزل فيه المعاملة (admin, social_care, interviews, reception, organization, أو معرف قسم مخصص)
  SerialNumber?: string;  // التسلسل الأصلي في ملف الإكسل
  IsDirectInstantRequest?: boolean; // طلب إداري فوري مباشر (بدون إشعارات ودون تسجيل في القسم الرقابي)
  archivedInSections?: string[];    // أرشفة مستقلة لكل قسم (مثل: reception, director, admin, organization)
  unarchivedInSections?: string[];  // استرجاع مستقل لكل قسم لسجلات الأرشيف/المسترد
  UpdatedAt?: string;
}

export interface SmartArchiveDossierData {
  citizen: Citizen;
  requests: OfficeRequest[];
  archiveTimestamp: string;
  archiveCode: string;
  archivedBy: string;
  notes?: string;
}

export interface ChequeRecord {
  id: string;
  ChequeNumber: string;
  Citizen_ID: string;
  CitizenName: string;
  CitizenPhone?: string;
  Request_ID?: string;
  Amount: number; // المبلغ بالدينار العراقي
  AmountInWords?: string; // تفقيط المبلغ
  BankName: string; // اسم المصرف / الصندوق
  Purpose: string; // الغرض (مساعدة مالية، علاجية، إعمار، رعاية، تعويض...)
  IssueDate: string; // تاريخ التحرير
  DueDate?: string; // تاريخ الاستحقاق / الصرف
  Status: 'قيد الصرف' | 'تم الصرف' | 'مؤجل' | 'ملغى';
  BeneficiaryGender: Gender;
  DependencyStatus: 'مستقل' | 'غير مستقل';
  AttendanceType: 'شخصياً' | 'عبر معتمد' | 'وكيل';
  Notes?: string;
  CreatedBy: string;
  CreatedAt: string;
}

export type InterviewStatus = 'مجدولة' | 'تمت المقابلة' | 'مؤجلة' | 'ملغاة' | 'تمت الإحالة';
export type DeputyDirective = 'إحالة للإدارة' | 'هامش مباشر' | 'متابعة شخصية' | 'غير مستوفي للشروط' | 'توجيه للمكنة' | string;

export interface Interview {
  Interview_ID: string;
  Citizen_ID: string;
  FullName: string;
  CitizenName?: string;
  Subject: string;
  Phone1: string;
  Phone2?: string;
  Address: string;
  Referrer?: string;
  InterviewDate: string;
  InterviewTime?: string;
  Priority: 'عادي' | 'عاجل' | 'خاص جداً';
  Status: InterviewStatus;
  DeputyNotes?: string;
  DeputyDirective?: string;
  Directive?: string;
  Outcome?: string;
  ConvertedToRequest?: boolean;
  CreatedAt?: string;
}

export type OrgFinalResult = 
  | 'تم اكمال الطلب بالكامل' 
  | 'تم حل الطلب جزئيا' 
  | 'الطلب يحتاج متابعة' 
  | 'لم يتم حل الطلب';

export interface OrgFinalEvaluation {
  id?: string;
  evaluatedAt: string;
  evaluatedBy?: string;
  finalResult: OrgFinalResult;
  requestId?: string;
  requestSubject?: string;
  
  // الحالة الأولى: تم حل الطلب بالكامل
  case1_citizenObtainedGoal?: 'نعم بالكامل' | 'نعم مع اجراء بسيط';
  case1_citizenSatisfied?: 'نعم' | 'لا';
  case1_personalRating?: number; // 1 to 5 (تقييم شخصي بعد سؤال المواطن)
  case1_citizenReturnedForThanks?: 'نعم' | 'لا';
  case1_officerNotes?: string;

  // الحالة الثانية: حل الطلب جزئياً
  case2_completedPart?: string; // ما الجزء الذي تم إنجازه
  case2_uncompletedPart?: string; // ما الجزء الذي لم ينجز
  case2_incompleteReason?: 'عدم اختصاص الجهة المعنية' | 'نقص مستندات' | 'يحتاج عرضا اضافيا' | 'سبب اخر' | string;
  case2_customReason?: string;
  case2_citizenAcceptedPartial?: 'نعم' | 'لا';
  case2_officeNeedsExtraAction?: 'نعم' | 'لا';
  case2_officerNotes?: string;

  // الحالة الثالثة: الطلب يحتاج الى متابعة
  case3_followupTypes?: string[]; // أنواع المتابعة: متابعة مع الجهة نفسها، مخاطبة جهة اخرى، طلب مستند اضافي، اعادة مخاطبة
  case3_officerNotes?: string;
  // دور مسؤول التنظيم:
  case3_citizenSatisfiedWithService?: 'نعم' | 'لا';
  case3_needsFollowup?: 'نعم' | 'لا';
  case3_agreedFutureCommunication?: 'نعم' | 'لا';
  case3_participateInSeminarOrInitiative?: 'نعم' | 'لا';
  case3_officeVisitFrequency?: string; // عدد المرات التي يتردد بها على المكتب
  case3_wantsToJoinTeam?: 'نعم' | 'لا'; // هل ترغب بالانضمام الى فريقنا (كمفتاح نهائي)
  case3_teamMemberFileOpened?: boolean; // فتح ملف مستقل
  case3_teamRole?: string;

  // الحالة الرابعة: لم يحل الطلب
  case4_failureReason?: 
    | 'رفض الجهة المختصة'
    | 'خارج اختصاص المكتب'
    | 'نقص مستندات'
    | 'عدم مكانية قانونية'
    | 'عدم استجابة الطلب'
    | 'تعذر تنفيذ الطلب'
    | 'سبب اخر'
    | string;
  case4_customFailureReason?: string;
  case4_explainedReasonToCitizen?: 'نعم' | 'لا';
  case4_citizenStance?: 'متفهم' | 'غير متفهم' | 'غير راضي' | string;
  case4_specialNote?: string; // ملاحظة تظهر نتيجة الطلب غير منجز سبب عدم الانجاز خارج اختصاصات المكتب
  case4_officerNotes?: string;
}

export interface OrgTeamMember {
  id: string;
  Citizen_ID: string;
  FullName: string;
  Phone?: string;
  District?: string;
  SubDistrict?: string;
  ElectionCenter?: string;
  Role: string; // مفتاح نهائي، كادر تنظيمي، إلخ
  JoinedDate: string;
  OfficeVisitCount?: string;
  Notes?: string;
  Status: 'نشط' | 'قيد التواصل' | 'مرشح';
}

export interface OrganizationRecord {
  Org_ID?: string;
  Citizen_ID: string;
  FullName: string;
  District?: string;
  SubDistrict?: string;
  Phone1?: string;
  Phone?: string;
  OrgRating: OrgRating;
  Rating?: string;
  RoleType?: string;
  ReferralCount?: number;
  InfluenceType?: string;
  EvaluationPoints?: number;
  ElectionCenter?: string;
  StationNumber?: string;
  Notes?: string;
  Referrer?: string;
  finalEvaluation?: OrgFinalEvaluation;
  isTeamMember?: boolean;
  teamMemberRole?: string;
  CustomFields?: Record<string, string | number | boolean>;
  UpdatedAt?: string;
}

export type DropdownCategory = 
  | 'Surname' 
  | 'Entity' 
  | 'Rating' 
  | 'Job' 
  | 'Education' 
  | 'District' 
  | 'SubDistrict' 
  | 'ResidentialArea'
  | 'ReferralSource'
  | 'RequestStatus'
  | 'ProcessingStatus'
  | 'Priority'
  | 'AttendanceType'
  | 'DependencyStatus';

export interface DropdownItem {
  id?: string;
  Category: DropdownCategory | string;
  ItemValue: string;
}

export interface AuditLog {
  Log_ID: string;
  Timestamp: string;
  UserName?: string;
  User?: string;
  PerformedBy?: string;
  ActionType?: string;
  Action?: string;
  Department?: string;
  Section?: string;
  Details: string;
  Ip?: string;
}

export interface DynamicField {
  id: string;
  section: 'reception' | 'admin' | 'interviews' | 'organization' | 'general';
  sectionArabic: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'date' | 'select' | 'file';
  options?: string[];
  required: boolean;
}

export interface DocumentRecord {
  Doc_ID: string;
  Citizen_ID: string;
  CitizenName: string;
  Title: string;
  Category: 'طلب مقدم' | 'كتاب رسمي' | 'هوية وبطاقة وطنية' | 'مستمسكات' | 'مستمسكات ثبوتية' | 'كتاب رسمي صادر' | 'أخرى' | string;
  FileUrl: string;
  FileType: 'image' | 'pdf' | 'doc' | string;
  FileSize: string;
  UploadedAt: string;
  UploadedBy: string;
}

export type DocumentArchiveItem = DocumentRecord;

export interface OfficialLetter {
  Letter_ID: string;
  LetterNumber: string;
  LetterDate: string;
  Letter_Number?: string;
  Letter_Date?: string;
  To_Entity?: string;
  Recipient: string;
  Subject: string;
  Body: string;
  Citizen_ID?: string;
  CitizenName?: string;
  Citizen_Name?: string;
  Request_ID?: string;
  Status: string;
  ClerkName: string;
}

export interface WhatsAppTemplate {
  id: string;
  title: string;
  text: string;
  category: 'استلام طلب' | 'إنجاز معاملة' | 'تحديد مقابلة' | 'تحديث موقف' | 'تنويه عام';
}

export interface SystemSettings {
  id?: string;
  appName: string;
  deputyName: string;
  deputyTitle: string;
  province: string;
  officeAddress: string;
  hotline: string;
  logoUrl: string;
  pwaIcon192?: string;
  pwaIcon512?: string;
  parliamentEmblemUrl: string;
  maintenanceMode: boolean;
  tickerNews: string[];
  googleSheetId?: string;
  googleSheetGid?: string;
  activeGoogleSheetId?: string;
  activeGoogleSheetUrl?: string;
  googleDriveFolderId?: string;
  appsScriptUrl?: string;
  googleAppsScriptUrl?: string;
  lastManualBackupAt?: string;
  lastManualBackupBy?: string;
  lastManualBackupStatus?: string;
  primaryThemeColor?: string;
  allowAdminOpenDriveFolder?: boolean; // للمطور لتحديد هل يحق لمدير الإدارة فتح مجلد Google Drive المباشر
  developerPasscode?: string; // رمز دخول المطور السري القابل للتغيير
  uiCustomizations?: UiCustomizationSettings;
  officeWorkspaceId?: string; // معرف عزل قاعدة البيانات للمكتب (لتشغيل عدة مكاتب بدون تداخل بيانات)
  officeName?: string; // اسم المكتب الحالي
  customFirebaseConfig?: {
    apiKey?: string;
    projectId?: string;
    firestoreDatabaseId?: string;
    storageBucket?: string;
    appId?: string;
  };
  customTilesConfig?: Record<string, {
    title: string;
    subtitle?: string;
    iconUrl?: string;
    iconColor?: string;
    bgGradient?: string;
    hidden?: boolean;
  }>;
  hiddenBuiltInTiles?: string[]; // أيقونات الأقسام المخفية أو المحذوفة من لوحة التحكم من قبل المطور
  customTextOverrides?: Record<string, string>; // قاموس تعديل جميع نصوص النظام بالكامل للمطور
  textReplacements?: Array<{ id?: string; from: string; to: string }>; // استبدال فوري لأي نص في كامل النظام
  customImages?: Record<string, string>; // صور مخصصة لأي عنصر في النظام (خلفيات، شعارات، شاشة التحميل...)
  footerText?: string; // نص التذييل أسفل المنظومة
  loadingScreenTitle?: string; // عنوان شاشة تحميل البيانات بعد الدخول
  loadingScreenSubtitle?: string; // وصف شاشة تحميل البيانات بعد الدخول
  loginWelcomeTitle?: string; // عنوان الترحيب في واجهة الدخول
  loginWelcomeSubtitle?: string; // الوصف الفرعي في واجهة الدخول
  officeBranch?: 'nasiriyah' | 'suq_al_shuyoukh' | string; // فرع المكتب (الناصرية / سوق الشيوخ)
  requiredFieldsConfig?: Record<string, boolean>; // للمطور: تحديد أي حقل إلزامي أو اختياري في النظام
  receptionResidentialAreas?: string[]; // قائمة مناطق السكن المنسدلة
  lastOutgoingNumberNasiriyah?: number; // آخر عدد صادر مسجل لمكتب الناصرية
  lastOutgoingNumberSuq?: number; // آخر عدد صادر مسجل لمكتب سوق الشيوخ
  outgoingBaselineSetAt?: string; // توقيت تثبيت آخر رقم صادر من الملف المرفوع لمنع تداخل السجلات القديمة
  outgoingBaselineLabel?: string; // وصف مصدر آخر رقم صادر مثبت (مثل اسم ملف الإكسل المرفوع)
  receptionCustomFields?: CustomFieldDefinition[]; // الحقول المخصصة التي يضيفها المطور للاستعلامات
  receptionHiddenDefaultFields?: string[]; // الحقول الافتراضية التي يقرر المطور إخفاءها من الاستعلامات
  settingsVersion?: number; // إصدار التحديث الفوري للأيقونات والإعدادات لجميع المستخدمين
  lastUpdateNote?: string; // وصف آخر تحديث قام به المطور
  lastUpdatedBy?: string; // اسم المطور الذي أطلق التحديث
}

export type CustomFieldType = 'text' | 'number' | 'dropdown' | 'image' | 'date' | 'textarea' | 'status' | 'checkbox';

export interface CustomFieldDefinition {
  id: string;
  name: string;
  label: string;
  type: CustomFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[]; // لقوائم الاختيار المنسدلة
  helpText?: string;
  defaultValue?: any;
}

export interface CustomSubSection {
  id: string;
  title: string;
  description?: string;
  iconUrl?: string;
  badgeColor?: string;
  fields: CustomFieldDefinition[];
  targetBuiltInSection?: string; // اختياري: ربط القسم الفرعي بقسم داخلي موجود
}

export interface CustomSection {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  iconUrl?: string; // صورة مخصصة لأيقونة القسم
  badgeColor?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  fields: CustomFieldDefinition[];
  isMultiSectionHub?: boolean; // أيقونة مجمّعة تحتوي عدة أقسام فرعية داخلها
  subSections?: CustomSubSection[]; // الأقسام الفرعية داخل هذه الأيقونة
  allowedRoles?: string[]; // الأدوار المسموح لها برؤية هذا القسم (فارغ = للمطور والمدير فقط أو حسب الصلاحية)
  allowedUserIds?: string[]; // معرفات الموظفين الممنوحين صلاحية هذا القسم
  isStandaloneRestricted?: boolean; // قسم مستقل لا يظهر لبقية الأقسام إلا بصلاحية المطور
  enableDashboard?: boolean;
  enablePhotoGallery?: boolean;
  enableExcelExport?: boolean;
  enableCustomStats?: boolean;
}

export interface CustomSectionRecord {
  id: string;
  sectionId: string;
  data: Record<string, any>; // القيم المدخلة لكافة الحقول (نص، رقم، قائمة منسدلة، صور، الخ)
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface UiCustomizationSettings {
  buttonSize: 'compact' | 'standard' | 'large';
  inputFieldSize: 'compact' | 'standard' | 'large';
  borderRadius: 'sharp' | 'standard' | 'rounded';
  showSecondaryPhone: boolean;
  showClanSurname: boolean;
  showAcademicEducation: boolean;
  showCitizenRating: boolean;
  showDependencyStatus: boolean;
  tableDensity: 'compact' | 'standard' | 'spacious';
}

export interface CitizenInquiryLog {
  id: string;
  citizenName: string;
  phone: string;
  inquiryDate: string;
  matchedRequestsCount: number;
  ip?: string;
  device?: string;
}

export interface UrgentNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  createdAtIso?: string;
  type: 'urgent_request' | 'urgent_interview' | 'director_decision' | 'delivery_update' | 'drive_upload' | 'system';
  category?: 'request' | 'director' | 'interview' | 'delivery' | 'drive' | 'system';
  priority?: 'normal' | 'high' | 'urgent';
  linkSection?: string;
  entityId?: string;
  targetRoles?: string[];
  createdBy?: string;
  read: boolean;
}

