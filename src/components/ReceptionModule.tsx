import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Citizen, Gender, OfficeRequest, Priority } from '../types';
import * as XLSX from 'xlsx';
import { 
  UserPlus, 
  Search, 
  Printer, 
  Clock, 
  Trash2, 
  Edit, 
  Save, 
  X, 
  Handshake, 
  Phone, 
  MapPin, 
  Calendar, 
  Briefcase, 
  Eye, 
  Users, 
  Layers, 
  AlertCircle, 
  FileText, 
  UserCheck, 
  CheckCircle2, 
  Share2, 
  FolderKanban, 
  Plus, 
  ArrowRight, 
  ArrowLeft, 
  Building2, 
  FileSpreadsheet,
  Download,
  Filter,
  FilePlus,
  CalendarCheck,
  CreditCard,
  BarChart3,
  LayoutDashboard,
  Send
} from 'lucide-react';
import { UnifiedCitizenCardModal } from './UnifiedCitizenCardModal';
import { SearchableSelect } from './SearchableSelect';
import { OfficeIconTilesGrid, OfficeTileItem } from './OfficeIconTilesGrid';

export const DHI_QAR_DISTRICTS = [
  'قضاء الناصرية (المركز)',
  'قضاء الشطرة',
  'قضاء الرفاعي',
  'قضاء سوق الشيوخ',
  'قضاء الجبايش',
  'قضاء قلعة سكر',
  'قضاء النصر',
  'قضاء الدواية',
  'قضاء الفهود',
  'قضاء كرمة بني سعيد',
  'قضاء الغراف',
  'قضاء الإصلاح',
  'قضاء البطحاء',
  'قضاء سيد دخيل',
  'قضاء الطار',
  'قضاء المنار',
  'أخرى'
];

export const DEFAULT_CLANS = [
  'الخفاجي',
  'العبودي',
  'السعدون',
  'الإبراهيمي',
  'الجابري',
  'الغزي',
  'الحجامي',
  'الشامي',
  'التميمي',
  'الزيدي',
  'الساعدي',
  'العبادي',
  'الأسدي',
  'الشمري',
  'الكعبي',
  'المالكي',
  'البدري',
  'الموسوي',
  'العسكري',
  'العتابي',
  'بني ركاب',
  'الشطري',
  'الدراجي',
  'الناشي',
  'الخيكاني',
  'الحسيني',
  'عام / بدون لقب'
];

export const IRAQI_MINISTRIES = [
  'وزارة العمل والشؤون الاجتماعية',
  'وزارة الصحة والبيئة',
  'وزارة التربية',
  'وزارة التعليم العالي والبحث العلمي',
  'وزارة الداخلية',
  'وزارة الدفاع',
  'وزارة الإعمار والإسكان والبلديات',
  'وزارة النفط',
  'وزارة الكهرباء',
  'وزارة التجارة',
  'وزارة المالية',
  'وزارة الموارد المائية',
  'وزارة الزراعة',
  'وزارة العدل',
  'وزارة الشباب والرياضة',
  'وزارة النقل',
  'وزارة التخطيط',
  'وزارة الاتصالات',
  'ديوان محافظة ذي قار',
  'مجلس محافظة ذي قار',
  'مؤسسة الشهداء وجرحى الحشد',
  'مؤسسة السجناء السياسيين',
  'هيئة الحشد الشعبي',
  'هيئة التقاعد الوطنية',
  'هيئة رعاية ذوي الإعاقة والاحتياجات الخاصة',
  'أخرى (تحديد يدوي)'
];

export const DEFAULT_JOBS = [
  'دكتوراة / تدريسي جامعي',
  'دكتور / طبيب',
  'دكتوراه',
  'مهندس',
  'معلم / مدرس',
  'محامي / حقوقي',
  'موظف حكومي',
  'منتسب أمني / عسكري',
  'ضابط',
  'كاسب',
  'أعمال حرة',
  'متقاعد',
  'طالب جامعي',
  'طالب مدرسة',
  'ربة بيت',
  'خريج باحث عن عمل',
  'فلاح / مزارع',
  'تاجر / صاحب محل',
  'سائق',
  'حرفي / مهني',
  'صيدلاني',
  'ممرض / كوادر صحية',
  'إعلامي / صحفي',
  'أخرى'
];

export const DEFAULT_EDUCATIONS = [
  'دكتوراة / دكتوراه',
  'ماجستير',
  'دبلوم عالي',
  'بكالوريوس',
  'دبلوم',
  'إعدادية',
  'متوسطة',
  'ابتدائية',
  'يقرأ ويكتب / بدون شهادة'
];

interface RequestDraftItem {
  id: string;
  entity: string;
  customEntity?: string;
  subject: string;
  priority: Priority;
  notes?: string;
}

export const ReceptionModule: React.FC = () => {
  const { 
    citizens, 
    addCitizen, 
    updateCitizen, 
    deleteCitizen,
    requests, 
    addRequest,
    interviews, 
    addInterview, 
    currentUser, 
    dropdowns,
    addDropdownItem,
    setActiveSection,
    convertInterviewToRequest
  } = useApp();

  // Navigation mode within Reception:
  // 'hub' = The 4 Primary Squares requested by the user:
  //   1. 'register' = تسجيل مراجع (مع باقة طلبات متعددة بالوزارات)
  //   2. 'search' = البحث والاستعلام الشامل
  //   3. 'interviews' = جدولة وتوثيق مقابلة مع النائب (نفس معلومات وتفاصيل تسجيل المراجع)
  //   4. 'reports' = طباعة التقارير وسحب الإحصائيات (بدلاً من لوحة التحكم)
  const [activeSquare, setActiveSquare] = useState<'hub' | 'register' | 'search' | 'interviews' | 'reports'>('hub');

  // General Filter / Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCitizenForCard, setSelectedCitizenForCard] = useState<Citizen | null>(null);
  const [savedSuccessCitizen, setSavedSuccessCitizen] = useState<{ citizen: Citizen; requestsCount: number; ministries: string[] } | null>(null);
  const [newClanInput, setNewClanInput] = useState('');
  const [showNewClanModal, setShowNewClanModal] = useState(false);

  // Search Action Modals States (تعديل، حذف، إضافة طلب، طباعة معلوماته)
  const [editingCitizenForSearch, setEditingCitizenForSearch] = useState<Citizen | null>(null);
  const [citizenToDelete, setCitizenToDelete] = useState<Citizen | null>(null);
  const [citizenForNewRequest, setCitizenForNewRequest] = useState<Citizen | null>(null);
  const [citizenForPrintInfo, setCitizenForPrintInfo] = useState<Citizen | null>(null);
  const [newReqEntity, setNewReqEntity] = useState(IRAQI_MINISTRIES[0]);
  const [newReqSubject, setNewReqSubject] = useState('');
  const [newReqPriority, setNewReqPriority] = useState<Priority>('عام');
  const [newReqNotes, setNewReqNotes] = useState('');

  // Edit citizen sub-states
  const [editCitFirst, setEditCitFirst] = useState('');
  const [editCitFather, setEditCitFather] = useState('');
  const [editCitGrand, setEditCitGrand] = useState('');
  const [editCitGreat, setEditCitGreat] = useState('');
  const [editCitSurname, setEditCitSurname] = useState(DEFAULT_CLANS[0]);
  const [editCitPhone1, setEditCitPhone1] = useState('');
  const [editCitPhone2, setEditCitPhone2] = useState('');
  const [editCitDistrict, setEditCitDistrict] = useState(DHI_QAR_DISTRICTS[0]);
  const [editCitJob, setEditCitJob] = useState('كاسب');
  const [editCitEducation, setEditCitEducation] = useState('إعدادية فما دون');
  const [editCitAttendanceType, setEditCitAttendanceType] = useState<'شخصياً' | 'بيد شخص آخر (معتمد)'>('شخصياً');
  const [editCitProxyName, setEditCitProxyName] = useState('');
  const [editCitProxyPhone, setEditCitProxyPhone] = useState('');
  const [editCitProxyAddress, setEditCitProxyAddress] = useState('');

  const handleOpenEditCitizen = (cit: Citizen) => {
    setEditingCitizenForSearch(cit);
    const parts = cit.FullName.trim().split(/\s+/);
    setEditCitFirst(cit.FirstName || parts[0] || '');
    setEditCitFather(cit.FatherName || parts[1] || '');
    setEditCitGrand(cit.GrandFatherName || parts[2] || '');
    setEditCitGreat(cit.GreatGrandFatherName || parts[3] || '');
    setEditCitSurname(cit.Surname || DEFAULT_CLANS[0]);
    setEditCitPhone1(cit.Phone1 || '');
    setEditCitPhone2(cit.Phone2 || '');
    setEditCitDistrict(cit.District || DHI_QAR_DISTRICTS[0]);
    setEditCitJob(cit.Job || 'كاسب');
    setEditCitEducation(cit.Education || 'إعدادية فما دون');
    setEditCitAttendanceType((cit.AttendanceType as any) || 'شخصياً');
    setEditCitProxyName(cit.ProxyName || '');
    setEditCitProxyPhone(cit.ProxyPhone || '');
    setEditCitProxyAddress(cit.ProxyAddress || '');
  };

  const handleSaveEditCitizen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCitizenForSearch) return;
    const nameParts = [editCitFirst.trim(), editCitFather.trim()];
    if (editCitGrand.trim()) nameParts.push(editCitGrand.trim());
    if (editCitGreat.trim()) nameParts.push(editCitGreat.trim());
    if (editCitSurname.trim() && editCitSurname.trim() !== 'عام / بدون لقب') nameParts.push(editCitSurname.trim());
    const finalFullName = nameParts.join(' ') || editingCitizenForSearch.FullName;

    updateCitizen({
      ...editingCitizenForSearch,
      FirstName: editCitFirst.trim(),
      FatherName: editCitFather.trim(),
      GrandFatherName: editCitGrand.trim(),
      GreatGrandFatherName: editCitGreat.trim(),
      Surname: editCitSurname.trim() !== 'عام / بدون لقب' ? editCitSurname.trim() : undefined,
      FullName: finalFullName,
      Phone1: editCitPhone1.trim(),
      Phone2: editCitPhone2.trim() || undefined,
      District: editCitDistrict,
      Job: editCitJob.trim() || 'كاسب',
      Education: editCitEducation,
      AttendanceType: editCitAttendanceType,
      ProxyName: editCitAttendanceType === 'بيد شخص آخر (معتمد)' ? editCitProxyName.trim() : undefined,
      ProxyPhone: editCitAttendanceType === 'بيد شخص آخر (معتمد)' ? editCitProxyPhone.trim() : undefined,
      ProxyAddress: editCitAttendanceType === 'بيد شخص آخر (معتمد)' ? editCitProxyAddress.trim() : undefined
    });
    setEditingCitizenForSearch(null);
  };

  const handleConfirmDeleteCitizen = () => {
    if (!citizenToDelete) return;
    deleteCitizen(citizenToDelete.Citizen_ID);
    setCitizenToDelete(null);
  };

  const handleSaveNewRequestForCitizen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!citizenForNewRequest || !newReqSubject.trim()) return;
    addRequest({
      Citizen_ID: citizenForNewRequest.Citizen_ID,
      CitizenName: citizenForNewRequest.FullName,
      CitizenPhone: citizenForNewRequest.Phone1,
      Entity: newReqEntity,
      Details: newReqSubject.trim() + (newReqNotes ? ` [ملاحظات: ${newReqNotes.trim()}]` : ''),
      Priority: newReqPriority,
      RequestStatus: 'مستلم',
      ProcessingStatus: 'قيد الإجراء',
      RegisteredVia: 'استعلامات',
      CreatedBy: currentUser?.FullName || 'موظف الاستعلامات',
      AttendanceType: citizenForNewRequest.AttendanceType,
      ProxyName: citizenForNewRequest.ProxyName,
      ProxyPhone: citizenForNewRequest.ProxyPhone,
      ProxyAddress: citizenForNewRequest.ProxyAddress
    });
    setCitizenForNewRequest(null);
    setNewReqSubject('');
    setNewReqNotes('');
  };

  // ---------------- 1. NEW CITIZEN FORM STATES ----------------
  const [firstName, setFirstName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [grandFatherName, setGrandFatherName] = useState('');
  const [greatGrandFatherName, setGreatGrandFatherName] = useState('');
  const [surname, setSurname] = useState(DEFAULT_CLANS[0]);
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  const [district, setDistrict] = useState(DHI_QAR_DISTRICTS[0]);
  const [customDistrict, setCustomDistrict] = useState('');
  const [job, setJob] = useState('كاسب');
  const [education, setEducation] = useState('إعدادية فما دون');
  const [notes, setNotes] = useState('');
  const [attendanceType, setAttendanceType] = useState<'شخصياً' | 'بيد شخص آخر (معتمد)'>('شخصياً');
  const [proxyName, setProxyName] = useState('');
  const [proxyPhone, setProxyPhone] = useState('');
  const [proxyAddress, setProxyAddress] = useState('');
  const [proxyRelation, setProxyRelation] = useState('معتمد');

  // Multi-Requests list builder for new registration
  const [requestsList, setRequestsList] = useState<RequestDraftItem[]>([
    {
      id: 'req_1',
      entity: IRAQI_MINISTRIES[0],
      subject: '',
      priority: 'عام',
      notes: ''
    }
  ]);

  // ---------------- 2. INTERVIEW SCHEDULING FORM STATES (نفس معلومات وتفاصيل تسجيل المراجع) ----------------
  // Lookup / Auto-fill search state
  const [interviewSearchQuery, setInterviewSearchQuery] = useState('');
  const [isInterviewSearchDropdownOpen, setIsInterviewSearchDropdownOpen] = useState(false);
  const [selectedCitizenForInterview, setSelectedCitizenForInterview] = useState<Citizen | null>(null);
  const interviewSearchRef = useRef<HTMLDivElement>(null);

  // Interview citizen full registration fields
  const [intvFirstName, setIntvFirstName] = useState('');
  const [intvFatherName, setIntvFatherName] = useState('');
  const [intvGrandFatherName, setIntvGrandFatherName] = useState('');
  const [intvGreatGrandFatherName, setIntvGreatGrandFatherName] = useState('');
  const [intvSurname, setIntvSurname] = useState(DEFAULT_CLANS[0]);
  const [intvPhone1, setIntvPhone1] = useState('');
  const [intvPhone2, setIntvPhone2] = useState('');
  const [intvDistrict, setIntvDistrict] = useState(DHI_QAR_DISTRICTS[0]);
  const [intvJob, setIntvJob] = useState('كاسب');
  const [intvEducation, setIntvEducation] = useState('إعدادية فما دون');
  const [intvAttendanceType, setIntvAttendanceType] = useState<'شخصياً' | 'بيد شخص آخر (معتمد)'>('شخصياً');
  const [intvProxyName, setIntvProxyName] = useState('');
  const [intvProxyPhone, setIntvProxyPhone] = useState('');
  const [intvProxyAddress, setIntvProxyAddress] = useState('');
  const [intvProxyRelation, setIntvProxyRelation] = useState('معتمد');

  // Interview specifics
  const [intvSubject, setIntvSubject] = useState('');
  const [intvDate, setIntvDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [intvTime, setIntvTime] = useState('10:30 صباحاً');
  const [intvPriority, setIntvPriority] = useState<'عادي' | 'عاجل' | 'خاص جداً'>('عادي');
  const [intvDeputyNotes, setIntvDeputyNotes] = useState('إحالة للإدارة');
  const [interviewSuccessMessage, setInterviewSuccessMessage] = useState('');
  const [interviewSubTab, setInterviewSubTab] = useState<'schedule' | 'records_reports'>('schedule');
  const [intvRecordSearch, setIntvRecordSearch] = useState('');
  const [intvRecordStatusFilter, setIntvRecordStatusFilter] = useState('all');

  // ---------------- 3. REPORTS MODULE STATES ----------------
  // حصر التقارير الخاصة بقسم الاستعلامات فقط في: قسم الاستعلامات ومقابلات النائب (دون التدخل مع قسم الإدارة)
  const [reportDateFilter, setReportDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [reportDepartment, setReportDepartment] = useState<'reception' | 'interviews'>('reception');
  const [reportDistrictFilter, setReportDistrictFilter] = useState<string>('all');

  // Today string YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // Clans list from dropdowns + default list
  const allClansList = useMemo(() => {
    const customClans = dropdowns
      .filter(d => d.Category.toLowerCase() === 'surname')
      .map(d => d.ItemValue.trim());
    return Array.from(new Set([...DEFAULT_CLANS, ...customClans]));
  }, [dropdowns]);

  // Jobs list from dropdowns + default list
  const allJobsList = useMemo(() => {
    const customJobs = dropdowns
      .filter(d => d.Category.toLowerCase() === 'job')
      .map(d => d.ItemValue.trim());
    return Array.from(new Set([...DEFAULT_JOBS, ...customJobs]));
  }, [dropdowns]);

  // Educations list from dropdowns + default list
  const allEducationsList = useMemo(() => {
    const customEdu = dropdowns
      .filter(d => d.Category.toLowerCase() === 'education')
      .map(d => d.ItemValue.trim());
    return Array.from(new Set([...DEFAULT_EDUCATIONS, ...customEdu]));
  }, [dropdowns]);

  // Click outside to close interview search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (interviewSearchRef.current && !interviewSearchRef.current.contains(e.target as Node)) {
        setIsInterviewSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time lookup of existing citizen while typing in registration form (فحص الازدواجية الفوري)
  // لا يظهر التحذير أبداً عند كتابة الاسم الأول فقط أو الأب فقط، بل يظهر حصراً عند كتابة (الاسم الأول واسم الأب واسم الجد)
  const existingMatchedCitizen = useMemo(() => {
    const normalizeAr = (s: string) => {
      return (s || '')
        .toLowerCase()
        .replace(/[إأآا]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[\u064B-\u065F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const cleanFirst = normalizeAr(firstName);
    const cleanFather = normalizeAr(fatherName);
    const cleanGrand = normalizeAr(grandFatherName);
    const cleanGreat = normalizeAr(greatGrandFatherName);
    const cleanSurname = surname && surname !== 'عام / بدون لقب' ? normalizeAr(surname) : '';
    const cleanPhone = phone1.replace(/[\s\-_]/g, '').trim();

    // 1. Match by complete phone number (10 digits or more)
    if (cleanPhone.length >= 10) {
      const matchByPhone = citizens.find(c => {
        const p1 = (c.Phone1 || '').replace(/[\s\-_]/g, '');
        const p2 = (c.Phone2 || '').replace(/[\s\-_]/g, '');
        return (p1 && p1 === cleanPhone) || (p2 && p2 === cleanPhone);
      });
      if (matchByPhone) return matchByPhone;
    }

    // 2. إذا قام المستخدم بكتابة الاسم الثلاثي كاملاً في حقل الاسم الأول
    const firstFieldWords = cleanFirst.split(/\s+/).filter(Boolean);
    if (firstFieldWords.length >= 3) {
      const trio = firstFieldWords.slice(0, 3).join(' ');
      const matchTrio = citizens.find(c => {
        const normC = normalizeAr(c.FullName);
        return normC.includes(trio);
      });
      if (matchTrio) return matchTrio;
    }

    // 3. الشرط الصريح: لا يظهر التحذير إلا عند كتابة (الاسم الأول + اسم الأب + اسم الجد) معاً
    const hasTrio = cleanFirst.length >= 2 && cleanFather.length >= 2 && cleanGrand.length >= 2;
    if (!hasTrio) {
      return null;
    }

    // التحقق عند اكتمال الاسم الثلاثي
    const trio = `${cleanFirst} ${cleanFather} ${cleanGrand}`;
    const composedParts = [cleanFirst, cleanFather, cleanGrand, cleanGreat, cleanSurname].filter(Boolean);
    const fullComposed = composedParts.join(' ');

    const matchCitizen = citizens.find(c => {
      const normC = normalizeAr(c.FullName);
      if (composedParts.length > 3) {
        if (normC === fullComposed || normC.includes(fullComposed)) {
          return true;
        }
      }
      return normC.includes(trio);
    });

    return matchCitizen || null;
  }, [firstName, fatherName, grandFatherName, greatGrandFatherName, surname, phone1, citizens]);

  // Filtered citizens matching interview search query (e.g. حسن طالب)
  const matchedInterviewCitizens = useMemo(() => {
    if (!interviewSearchQuery.trim()) return [];
    const q = interviewSearchQuery.toLowerCase().trim();
    return citizens.filter(c => {
      return (
        c.FullName.toLowerCase().includes(q) ||
        c.Citizen_ID.toLowerCase().includes(q) ||
        (c.Phone1 && c.Phone1.includes(q)) ||
        (c.District && c.District.toLowerCase().includes(q)) ||
        (c.Surname && c.Surname.toLowerCase().includes(q))
      );
    }).slice(0, 8);
  }, [citizens, interviewSearchQuery]);

  // Select citizen from interview search -> populate all detailed registration fields!
  const handleSelectCitizenForInterview = (cit: Citizen) => {
    setSelectedCitizenForInterview(cit);
    setInterviewSearchQuery(cit.FullName);
    setIsInterviewSearchDropdownOpen(false);

    // Parse name parts
    const parts = cit.FullName.trim().split(/\s+/);
    setIntvFirstName(parts[0] || '');
    setIntvFatherName(parts[1] || '');
    setIntvGrandFatherName(parts[2] || '');
    setIntvGreatGrandFatherName(parts[3] || '');
    setIntvSurname(cit.Surname || DEFAULT_CLANS[0]);

    setIntvPhone1(cit.Phone1 || '');
    setIntvPhone2(cit.Phone2 || '');
    setIntvDistrict(cit.District || DHI_QAR_DISTRICTS[0]);
    setIntvJob(cit.Job || 'كاسب');
    setIntvEducation(cit.Education || 'إعدادية فما دون');

    setIntvAttendanceType((cit.AttendanceType as any) || 'شخصياً');
    setIntvProxyName(cit.ProxyName || '');
    setIntvProxyPhone(cit.ProxyPhone || '');
    setIntvProxyAddress(cit.ProxyAddress || '');
    setIntvProxyRelation(cit.ProxyRelation || 'معتمد');
  };

  // Reset interview form
  const resetInterviewForm = () => {
    setSelectedCitizenForInterview(null);
    setInterviewSearchQuery('');
    setIntvFirstName('');
    setIntvFatherName('');
    setIntvGrandFatherName('');
    setIntvGreatGrandFatherName('');
    setIntvSurname(DEFAULT_CLANS[0]);
    setIntvPhone1('');
    setIntvPhone2('');
    setIntvDistrict(DHI_QAR_DISTRICTS[0]);
    setIntvJob('كاسب');
    setIntvEducation('إعدادية فما دون');
    setIntvAttendanceType('شخصياً');
    setIntvProxyName('');
    setIntvProxyPhone('');
    setIntvProxyAddress('');
    setIntvProxyRelation('معتمد');
    setIntvSubject('');
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setIntvDate(d.toISOString().split('T')[0]);
    setIntvTime('10:30 صباحاً');
    setIntvPriority('عادي');
    setIntvDeputyNotes('إحالة للإدارة');
  };

  // Save Interview with full registration information
  const handleSaveInterviewWithFullDetails = (e: React.FormEvent) => {
    e.preventDefault();

    if (!intvFirstName.trim() || !intvFatherName.trim()) {
      alert('يرجى إدخال الاسم الأول واسم الأب للمراجع.');
      return;
    }

    if (!intvPhone1.trim()) {
      alert('يرجى إدخال رقم الهاتف للتواصل.');
      return;
    }

    if (!intvSubject.trim() || !intvDate) {
      alert('يرجى كتابة موضوع المقابلة مع النائب وتحديد التاريخ.');
      return;
    }

    if (intvAttendanceType === 'بيد شخص آخر (معتمد)' && (!intvProxyName.trim() || !intvProxyPhone.trim())) {
      alert('يرجى إدخال اسم ورقم هاتف الشخص حامل الطلب (المعتمد).');
      return;
    }

    const nameParts = [intvFirstName.trim(), intvFatherName.trim()];
    if (intvGrandFatherName.trim()) nameParts.push(intvGrandFatherName.trim());
    if (intvGreatGrandFatherName.trim()) nameParts.push(intvGreatGrandFatherName.trim());
    if (intvSurname.trim() && intvSurname.trim() !== 'عام / بدون لقب') nameParts.push(intvSurname.trim());
    const finalFullName = nameParts.join(' ');

    let targetCitizenId = selectedCitizenForInterview?.Citizen_ID;

    if (selectedCitizenForInterview) {
      // Update existing citizen record with the full details
      updateCitizen({
        ...selectedCitizenForInterview,
        FirstName: intvFirstName.trim(),
        FatherName: intvFatherName.trim(),
        GrandFatherName: intvGrandFatherName.trim(),
        GreatGrandFatherName: intvGreatGrandFatherName.trim(),
        FullName: finalFullName,
        Surname: intvSurname.trim() !== 'عام / بدون لقب' ? intvSurname.trim() : undefined,
        Phone1: intvPhone1.trim(),
        Phone2: intvPhone2.trim() || undefined,
        District: intvDistrict,
        Job: intvJob.trim() || 'كاسب',
        Education: intvEducation,
        AttendanceType: intvAttendanceType,
        ProxyName: intvAttendanceType === 'بيد شخص آخر (معتمد)' ? intvProxyName.trim() : undefined,
        ProxyPhone: intvAttendanceType === 'بيد شخص آخر (معتمد)' ? intvProxyPhone.trim() : undefined,
        ProxyAddress: intvAttendanceType === 'بيد شخص آخر (معتمد)' ? intvProxyAddress.trim() : undefined,
        ProxyRelation: intvAttendanceType === 'بيد شخص آخر (معتمد)' ? intvProxyRelation.trim() : undefined
      });
    } else {
      // Add as a new citizen first
      const newCit = addCitizen({
        FirstName: intvFirstName.trim(),
        FatherName: intvFatherName.trim(),
        GrandFatherName: intvGrandFatherName.trim(),
        GreatGrandFatherName: intvGreatGrandFatherName.trim(),
        FullName: finalFullName,
        Surname: intvSurname.trim() !== 'عام / بدون لقب' ? intvSurname.trim() : undefined,
        Phone1: intvPhone1.trim(),
        Phone2: intvPhone2.trim() || undefined,
        Gender: 'ذكر' as Gender,
        District: intvDistrict,
        SubDistrict: 'المركز',
        Job: intvJob.trim() || 'كاسب',
        Education: intvEducation,
        Rating: 'لائق',
        AttendanceType: intvAttendanceType,
        ProxyName: intvAttendanceType === 'بيد شخص آخر (معتمد)' ? intvProxyName.trim() : undefined,
        ProxyPhone: intvAttendanceType === 'بيد شخص آخر (معتمد)' ? intvProxyPhone.trim() : undefined,
        ProxyAddress: intvAttendanceType === 'بيد شخص آخر (معتمد)' ? intvProxyAddress.trim() : undefined,
        ProxyRelation: intvAttendanceType === 'بيد شخص آخر (معتمد)' ? intvProxyRelation.trim() : undefined,
        ReferralSource: intvAttendanceType === 'بيد شخص آخر (معتمد)' ? `بيد المعتمد: ${intvProxyName.trim()}` : 'مباشر - قسم الاستعلامات'
      });
      targetCitizenId = newCit.Citizen_ID;
    }

    // Add the interview
    addInterview({
      Citizen_ID: targetCitizenId!,
      FullName: finalFullName,
      Subject: intvSubject.trim(),
      Phone1: intvPhone1.trim(),
      Phone2: intvPhone2.trim() || undefined,
      Address: intvDistrict,
      Referrer: intvAttendanceType === 'بيد شخص آخر (معتمد)' ? `بيد المعتمد: ${intvProxyName.trim()}` : 'حضور مباشر',
      InterviewDate: intvDate,
      InterviewTime: intvTime,
      Priority: intvPriority,
      Status: 'مجدولة',
      DeputyNotes: intvDeputyNotes || undefined,
      ConvertedToRequest: false
    });

    setInterviewSuccessMessage(`تم بنجاح تثبيت وجدولة موعد مقابلة مع النائب للمراجع (${finalFullName}) بتاريخ (${intvDate}).`);
    resetInterviewForm();
  };

  // Handle adding a new request slot in multi-request draft
  const handleAddRequestSlot = () => {
    setRequestsList(prev => [
      ...prev,
      {
        id: `req_${Date.now()}_${prev.length + 1}`,
        entity: IRAQI_MINISTRIES[0],
        subject: '',
        priority: 'عام',
        notes: ''
      }
    ]);
  };

  const handleRemoveRequestSlot = (id: string) => {
    if (requestsList.length <= 1) return;
    setRequestsList(prev => prev.filter(r => r.id !== id));
  };

  const handleRequestSlotChange = (id: string, field: keyof RequestDraftItem, value: any) => {
    setRequestsList(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // Reset Registration Form
  const resetCitizenForm = () => {
    setFirstName('');
    setFatherName('');
    setGrandFatherName('');
    setGreatGrandFatherName('');
    setSurname(DEFAULT_CLANS[0]);
    setPhone1('');
    setPhone2('');
    setDistrict(DHI_QAR_DISTRICTS[0]);
    setCustomDistrict('');
    setJob('كاسب');
    setEducation('إعدادية فما دون');
    setNotes('');
    setAttendanceType('شخصياً');
    setProxyName('');
    setProxyPhone('');
    setProxyAddress('');
    setProxyRelation('معتمد');
    setRequestsList([
      {
        id: 'req_1',
        entity: IRAQI_MINISTRIES[0],
        subject: '',
        priority: 'عام',
        notes: ''
      }
    ]);
  };

  // Submit New Citizen + Multi-Requests
  const handleSaveCitizen = (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !fatherName.trim()) {
      alert('يرجى إدخال الاسم الأول واسم الأب على الأقل.');
      return;
    }

    if (!phone1.trim()) {
      alert('يرجى إدخال رقم الهاتف للتواصل.');
      return;
    }

    if (attendanceType === 'بيد شخص آخر (معتمد)' && (!proxyName.trim() || !proxyPhone.trim())) {
      alert('يرجى إدخال اسم ورقم هاتف الشخص الحامل للطلب (المعتمد/الوكيل).');
      return;
    }

    const nameParts = [firstName.trim(), fatherName.trim()];
    if (grandFatherName.trim()) nameParts.push(grandFatherName.trim());
    if (greatGrandFatherName.trim()) nameParts.push(greatGrandFatherName.trim());
    if (surname.trim() && surname.trim() !== 'عام / بدون لقب') nameParts.push(surname.trim());
    const finalFullName = nameParts.join(' ');

    const finalDistrict = district === 'أخرى' && customDistrict.trim() ? customDistrict.trim() : district;

    // 1. Add Citizen with all separated and combined fields
    const newCitizen = addCitizen({
      FirstName: firstName.trim(),
      FatherName: fatherName.trim(),
      GrandFatherName: grandFatherName.trim(),
      GreatGrandFatherName: greatGrandFatherName.trim(),
      FullName: finalFullName,
      Surname: surname.trim() !== 'عام / بدون لقب' ? surname.trim() : undefined,
      Phone1: phone1.trim(),
      Phone2: phone2.trim() || undefined,
      Gender: 'ذكر' as Gender,
      District: finalDistrict,
      SubDistrict: 'المركز',
      Job: job.trim() || 'كاسب',
      Education: education,
      Rating: 'لائق',
      AttendanceType: attendanceType,
      ProxyName: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyName.trim() : undefined,
      ProxyPhone: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyPhone.trim() : undefined,
      ProxyAddress: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyAddress.trim() : undefined,
      ProxyRelation: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyRelation.trim() : undefined,
      ReferralSource: notes.trim() ? `الاستعلامات - ${notes.trim()}` : (attendanceType === 'بيد شخص آخر (معتمد)' ? `بيد المعتمد: ${proxyName.trim()}` : 'مباشر - قسم الاستعلامات')
    });

    // 2. Add Multi-Requests under the SAME permanent Citizen Code
    const addedMinistries: string[] = [];
    let addedRequestsCount = 0;

    requestsList.forEach(req => {
      const entityName = req.entity === 'أخرى (تحديد يدوي)' && req.customEntity ? req.customEntity.trim() : req.entity;
      const details = req.subject.trim() 
        ? (req.subject.trim() + (req.notes?.trim() ? ` [ملاحظات: ${req.notes.trim()}]` : ''))
        : (req.notes?.trim() || `طلب مراجعة ومتابعة رسمية لدى ${entityName}`);

      addRequest({
        Citizen_ID: newCitizen.Citizen_ID,
        CitizenName: newCitizen.FullName,
        CitizenPhone: newCitizen.Phone1,
        Entity: entityName,
        Details: details,
        Priority: req.priority,
        RequestStatus: 'مستلم',
        ProcessingStatus: 'قيد الإجراء',
        RegisteredVia: 'استعلامات',
        CreatedBy: currentUser?.FullName || 'موظف الاستعلامات',
        AttendanceType: attendanceType,
        ProxyName: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyName.trim() : undefined,
        ProxyPhone: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyPhone.trim() : undefined,
        ProxyAddress: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyAddress.trim() : undefined,
        ProxyRelation: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyRelation.trim() : undefined,
        ReceptionNotes: req.notes?.trim() || notes.trim() || undefined
      });
      addedMinistries.push(entityName);
      addedRequestsCount++;
    });

    // If no request was in list, add a default reception entry
    if (addedRequestsCount === 0) {
      const defaultEntity = IRAQI_MINISTRIES[0];
      const details = notes.trim() || 'تسجيل مراجعة أولية وتثبيت طلب في الاستعلامات';
      addRequest({
        Citizen_ID: newCitizen.Citizen_ID,
        CitizenName: newCitizen.FullName,
        CitizenPhone: newCitizen.Phone1,
        Entity: defaultEntity,
        Details: details,
        Priority: 'عام',
        RequestStatus: 'مستلم',
        ProcessingStatus: 'قيد الإجراء',
        RegisteredVia: 'استعلامات',
        CreatedBy: currentUser?.FullName || 'موظف الاستعلامات',
        AttendanceType: attendanceType,
        ProxyName: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyName.trim() : undefined,
        ProxyPhone: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyPhone.trim() : undefined,
        ProxyAddress: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyAddress.trim() : undefined,
        ProxyRelation: attendanceType === 'بيد شخص آخر (معتمد)' ? proxyRelation.trim() : undefined,
        ReceptionNotes: notes.trim() || undefined
      });
      addedMinistries.push(defaultEntity);
      addedRequestsCount = 1;
    }

    resetCitizenForm();

    setSavedSuccessCitizen({
      citizen: newCitizen,
      requestsCount: addedRequestsCount,
      ministries: addedMinistries
    });
  };

  const handleAddNewClan = () => {
    if (!newClanInput.trim()) return;
    addDropdownItem('Surname', newClanInput.trim());
    setSurname(newClanInput.trim());
    setIntvSurname(newClanInput.trim());
    setNewClanInput('');
    setShowNewClanModal(false);
  };

  // Filtered citizens for Search view
  const filteredCitizens = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return citizens.slice(0, 50);
    return citizens.filter(c => {
      return (
        c.FullName.toLowerCase().includes(q) ||
        c.Citizen_ID.toLowerCase().includes(q) ||
        (c.Phone1 && c.Phone1.includes(q)) ||
        (c.District && c.District.toLowerCase().includes(q)) ||
        (c.Surname && c.Surname.toLowerCase().includes(q)) ||
        (c.ProxyName && c.ProxyName.toLowerCase().includes(q))
      );
    });
  }, [citizens, searchQuery]);

  // Filtered data for Reports View (الاستعلامات: فقط قسم الاستعلامات ومقابلات النائب لا يتدخل مع قسم الإدارة)
  const reportCitizens = useMemo(() => {
    return citizens.filter(c => {
      // Date filter
      if (reportDateFilter === 'today') {
        const created = (c.CreatedAt || '').split('T')[0];
        if (created !== todayStr) return false;
      } else if (reportDateFilter === 'week') {
        if (!c.CreatedAt) return false;
        const diffDays = (new Date().getTime() - new Date(c.CreatedAt).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (reportDateFilter === 'month') {
        if (!c.CreatedAt) return false;
        const diffDays = (new Date().getTime() - new Date(c.CreatedAt).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30) return false;
      }

      // District filter
      if (reportDistrictFilter !== 'all' && c.District !== reportDistrictFilter) {
        return false;
      }

      return true;
    });
  }, [citizens, reportDateFilter, reportDistrictFilter, todayStr]);

  // Filtered interviews for Reports View (عند اختيار قسم مقابلات النائب)
  const reportInterviews = useMemo(() => {
    return interviews.filter(inv => {
      // Date filter
      if (reportDateFilter === 'today') {
        const invDate = (inv.InterviewDate || '').split('T')[0];
        if (invDate !== todayStr) return false;
      } else if (reportDateFilter === 'week') {
        if (!inv.InterviewDate) return false;
        const diffDays = (new Date().getTime() - new Date(inv.InterviewDate).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7 || diffDays < -1) return false;
      } else if (reportDateFilter === 'month') {
        if (!inv.InterviewDate) return false;
        const diffDays = (new Date().getTime() - new Date(inv.InterviewDate).getTime()) / (1000 * 3600 * 24);
        if (diffDays > 30 || diffDays < -1) return false;
      }

      // District filter
      if (reportDistrictFilter !== 'all' && inv.Address && !inv.Address.includes(reportDistrictFilter)) {
        return false;
      }

      return true;
    });
  }, [interviews, reportDateFilter, reportDistrictFilter, todayStr]);

  // Export report to Excel (استعلامات أو مقابلات النائب فقط)
  const handleExportReportToExcel = () => {
    if (reportDepartment === 'interviews') {
      const interviewData = reportInterviews.map((inv, i) => ({
        'ت': i + 1,
        'رقم المقابلة': inv.Interview_ID,
        'كود المراجع ONA': inv.Citizen_ID || '-',
        'اسم المراجع': inv.FullName,
        'رقم الهاتف': inv.Phone1,
        'السكن / العنوان': inv.Address,
        'موضوع المقابلة': inv.Subject,
        'تاريخ المقابلة': inv.InterviewDate,
        'الوقت': inv.InterviewTime || '10:30 ص',
        'الأهمية': inv.Priority,
        'الحالة': inv.Status,
        'توجيه النائب': inv.DeputyNotes || 'إحالة للإدارة'
      }));

      const worksheet = XLSX.utils.json_to_sheet(interviewData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير مقابلات النائب');
      XLSX.writeFile(workbook, `تقرير_مقابلات_النائب_${todayStr}.xlsx`);
      return;
    }

    // Default: قسم الاستعلامات
    const reportData = reportCitizens.map((c, i) => {
      const citReqs = requests.filter(r => r.Citizen_ID === c.Citizen_ID);
      const citIntvs = interviews.filter(inv => inv.Citizen_ID === c.Citizen_ID);
      return {
        'ت': i + 1,
        'الرقم التعريفي (ONA)': c.Citizen_ID,
        'الاسم الكامل': c.FullName,
        'العشيرة / اللقب': c.Surname || '-',
        'رقم الهاتف': c.Phone1,
        'القضاء والسكن': c.District,
        'المهنة': c.Job || 'كاسب',
        'طريقة الحضور': c.AttendanceType || 'شخصياً',
        'اسم المعتمد / الحامل': c.ProxyName || '-',
        'هاتف المعتمد': c.ProxyPhone || '-',
        'عدد الطلبات': citReqs.length,
        'مقابلات النائب': citIntvs.length,
        'تاريخ التسجيل': (c.CreatedAt || '').split('T')[0]
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تقرير أعمال الاستعلامات');
    XLSX.writeFile(workbook, `تقرير_الاستعلامات_${todayStr}.xlsx`);
  };

  // Filtered interviews for the dedicated records & reports table in interviews section
  const filteredInterviewRecords = useMemo(() => {
    return interviews.filter(inv => {
      const q = intvRecordSearch.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        (inv.FullName && inv.FullName.toLowerCase().includes(q)) ||
        (inv.Interview_ID && inv.Interview_ID.toLowerCase().includes(q)) ||
        (inv.Subject && inv.Subject.toLowerCase().includes(q)) ||
        (inv.Phone1 && inv.Phone1.includes(q)) ||
        (inv.Address && inv.Address.toLowerCase().includes(q));

      const matchesStatus = intvRecordStatusFilter === 'all' || inv.Status === intvRecordStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [interviews, intvRecordSearch, intvRecordStatusFilter]);

  // Export All Interviews from the dedicated Interviews section
  const handleExportInterviewsList = () => {
    try {
      const interviewData = filteredInterviewRecords.map((inv, i) => ({
        'ت': i + 1,
        'رقم المقابلة': inv.Interview_ID,
        'كود المراجع ONA': inv.Citizen_ID || '-',
        'اسم المراجع': inv.FullName,
        'رقم الهاتف': inv.Phone1,
        'السكن / العنوان': inv.Address || '-',
        'موضوع وقضية المقابلة': inv.Subject,
        'تاريخ المقابلة': inv.InterviewDate,
        'الوقت': inv.InterviewTime || '10:30 صباحاً',
        'الأهمية': inv.Priority,
        'الحالة': inv.Status,
        'توجيهات وهامش النائب': inv.DeputyNotes || 'إحالة للإدارة',
        'النتيجة والمخرجات': inv.Outcome || '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(interviewData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'سجل وإحصائيات المقابلات');
      XLSX.writeFile(workbook, `سجل_مقابلات_النائب_${todayStr}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء تصدير المقابلات');
    }
  };

  return (
    <div className="space-y-4 text-right font-['Tajawal',sans-serif] select-none" dir="rtl">
      
      {/* ---------------- TOP RECEPTION BAR: TITLE & BACK BUTTON ---------------- */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/30 shrink-0">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900">
                منظومة قسم الاستعلامات والاستقبال
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                تسجيل جديد • بحث وتعديل • مقابلات النائب • التقارير
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              الواجهة المباشرة: تسجيل جديد للمراجعين، البحث وتعديل السجلات، مقابلات النائب وإحصائياتها، والتقارير.
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {currentUser?.Role && currentUser.Role !== 'reception' && currentUser.Role !== 'reception_officer' && (
            <button
              onClick={() => setActiveSection('dashboard')}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="الانتقال إلى لوحة التحكم وأقسام المنظومة الأخرى"
            >
              <LayoutDashboard className="w-4 h-4 text-blue-600" />
              <span>لوحة التحكم الرئيسية</span>
            </button>
          )}

          {/* Back to Hub button when in a subview */}
          {activeSquare !== 'hub' && (
            <button
              onClick={() => {
                setActiveSquare('hub');
                setInterviewSuccessMessage('');
              }}
              className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400 rotate-180" />
              <span>الرجوع إلى أيقونات الاستعلامات الرئيسية</span>
            </button>
          )}
        </div>
      </div>

      {/* ---------------- THE 4 PRIMARY SQUARES (الواجهة الرئيسية على شكل مربعات) ---------------- */}
      {/* "خلي البحث والاستعلام تسجيل مراجع جدول وتوثيق مقابلة نفس معلومات وتفاصيل تسجيل المراجع اكثر من مرة طلبتها منك و ايقونه بدال لوحة التحكم خليلي بدالا طباعة التقارير" */}
      {activeSquare === 'hub' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs text-right">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">إجمالي المراجعين المسجلين</span>
              <div className="text-2xl font-black text-slate-900">{citizens.length} <span className="text-xs font-normal text-slate-400">مواطن</span></div>
              <div className="text-[10px] text-blue-700 font-bold mt-1">كود ONA موحد وثابت</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs text-right">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">المسجلون اليوم</span>
              <div className="text-2xl font-black text-emerald-600">
                {citizens.filter(c => (c.CreatedAt || '').startsWith(todayStr)).length}{' '}
                <span className="text-xs font-normal text-slate-400">مراجع اليوم</span>
              </div>
              <div className="text-[10px] text-emerald-700 font-bold mt-1">نشاط الاستقبال اليومي</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs text-right">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">مقابلات النائب المجدولة</span>
              <div className="text-2xl font-black text-teal-600">
                {interviews.filter(i => i.Status === 'مجدولة').length}{' '}
                <span className="text-xs font-normal text-slate-400">موعد</span>
              </div>
              <div className="text-[10px] text-teal-700 font-bold mt-1">جلسات المقابلة المباشرة</div>
            </div>
          </div>

          {/* RECEPTION 4-ICON TILES GRID */}
          <OfficeIconTilesGrid
            title="أيقونات قسم الاستعلامات"
            subtitle="اختر الإجراء المطلوب: تسجيل جديد، البحث والتعديل الشامل، مقابلات النائب، أو طباعة وسحب التقارير"
            columns={4}
            items={[
              {
                id: 'rec_register',
                title: 'تسجيل جديد',
                subtitle: 'إدخال بيانات المراجع وباقة الطلبات بالوزارات',
                icon: UserPlus,
                iconColor: 'text-blue-600 dark:text-blue-400',
                iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
                onClick: () => {
                  resetCitizenForm();
                  setActiveSquare('register');
                }
              },
              {
                id: 'rec_search_edit',
                title: 'بحث وتعديل',
                subtitle: 'الاستعلام وتعديل سجلات المراجعين والطلبات',
                icon: Search,
                iconColor: 'text-cyan-600 dark:text-cyan-400',
                iconBg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800',
                badge: citizens.length,
                badgeColor: 'bg-cyan-600 text-white',
                onClick: () => setActiveSquare('search')
              },
              {
                id: 'rec_interviews',
                title: 'مقابلات النائب',
                subtitle: 'جدولة المقابلات (نفس تفاصيل التسجيل) وتقاريرها',
                icon: Handshake,
                iconColor: 'text-amber-600 dark:text-amber-400',
                iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
                badge: interviews.filter(i => i.Status === 'مجدولة').length || null,
                badgeColor: 'bg-amber-500 text-white',
                onClick: () => {
                  resetInterviewForm();
                  setActiveSquare('interviews');
                }
              },
              {
                id: 'rec_reports',
                title: 'التقارير',
                subtitle: 'طباعة وسحب التقارير الرسمية والإحصائيات',
                icon: BarChart3,
                iconColor: 'text-purple-600 dark:text-purple-400',
                iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
                onClick: () => setActiveSquare('reports')
              }
            ]}
          />
        </div>
      )}

      {/* ---------------- VIEW 1: NEW CITIZEN REGISTRATION + MULTI-REQUESTS ---------------- */}
      {activeSquare === 'register' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs p-3.5 sm:p-6 space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold shadow-2xs shrink-0">
                <UserPlus className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  تسجيل مراجع جديد وإضافة باقة طلبات ومعاملات
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  الاسم الرباعي واللقب، نوع الحضور، وإضافة أكثر من طلب لعدة وزارات ومواضيع تحت كود ONA ثابت
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSquare('hub')}
              className="w-full sm:w-auto px-4 py-2 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              <span>رجوع للمربعات</span>
            </button>
          </div>

          <form onSubmit={handleSaveCitizen} className="space-y-3.5 text-xs">
            
            {/* Live Duplicate Alert - نص المطلوب: الاسم مسجل في النظام يرجى الدخول للبحث وكتابة الاسم واضافة طلب او تعديل */}
            {existingMatchedCitizen && (
              <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 space-y-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0 text-base shadow-xs">
                    ⚠️
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-xs font-black text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                        تحذير: الاسم مسجل في النظام مسبقاً!
                      </strong>
                      <span className="font-mono font-bold text-blue-800 text-xs bg-white px-2 py-0.5 rounded border border-amber-200">
                        كود ONA: {existingMatchedCitizen.Citizen_ID}
                      </span>
                    </div>
                    <p className="text-xs text-amber-950 font-bold mt-1 break-words">
                      المواطن: <span className="underline text-slate-900 font-black">{existingMatchedCitizen.FullName}</span>
                      {existingMatchedCitizen.Phone1 ? ` • الهاتف: ${existingMatchedCitizen.Phone1}` : ''}
                      {existingMatchedCitizen.District ? ` • القضاء: ${existingMatchedCitizen.District}` : ''}
                      {existingMatchedCitizen.Job ? ` • المهنة: ${existingMatchedCitizen.Job}` : ''}
                    </p>
                    <p className="text-[11px] text-amber-900 font-semibold mt-0.5">
                      الاسم مسجل في النظام، يرجى الدخول للبحث وكتابة الاسم لإضافة طلب جديد أو تعديل بياناته بدلاً من تكرار التسجيل.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-amber-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(existingMatchedCitizen.FullName);
                      setActiveSquare('search');
                      setCitizenForNewRequest(existingMatchedCitizen);
                      setNewReqSubject('');
                      setNewReqNotes('');
                    }}
                    className="flex-1 px-3.5 py-2.5 sm:py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>الدخول للبحث وكتابة الاسم وإضافة طلب</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(existingMatchedCitizen.FullName);
                      setActiveSquare('search');
                      handleOpenEditCitizen(existingMatchedCitizen);
                    }}
                    className="flex-1 px-3.5 py-2.5 sm:py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>الدخول للبحث وتعديل بيانات المراجع</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCitizenForCard(existingMatchedCitizen)}
                    className="px-3.5 py-2.5 sm:py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>معاينة الملف</span>
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 1: SEPARATED 4-PART NAME + CLAN DROPDOWN */}
            <div className="space-y-2.5 p-3 sm:p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between pb-1 border-b border-slate-200 gap-1">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>1. الاسم بالتقسيم الرباعي واللقب (العشيرة) *</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  كشف لحظي مباشر بدون الحاجة للحفظ
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">الاسم الأول *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="مثال: حسن"
                    className="w-full h-10 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-900 font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none text-right shadow-2xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">اسم الأب *</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="مثال: طالب"
                    className="w-full h-10 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-900 font-bold text-xs focus:ring-2 focus:ring-blue-500 outline-none text-right shadow-2xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">اسم الجد</label>
                  <input
                    type="text"
                    value={grandFatherName}
                    onChange={(e) => setGrandFatherName(e.target.value)}
                    placeholder="مثال: كاظم"
                    className="w-full h-10 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-900 font-semibold text-xs focus:ring-2 focus:ring-blue-500 outline-none text-right shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">الاسم الرابع</label>
                  <input
                    type="text"
                    value={greatGrandFatherName}
                    onChange={(e) => setGreatGrandFatherName(e.target.value)}
                    placeholder="مثال: جبر"
                    className="w-full h-10 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-900 font-semibold text-xs focus:ring-2 focus:ring-blue-500 outline-none text-right shadow-2xs"
                  />
                </div>
              </div>

              {/* Clan / Surname Dropdown with Add Option */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">
                    اللقب / العشيرة *
                  </label>
                  <SearchableSelect
                    options={allClansList}
                    value={surname}
                    onChange={(val) => setSurname(val)}
                    placeholder="اختر العشيرة أو اللقب..."
                    className="w-full shadow-2xs"
                    allowCustom={true}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setShowNewClanModal(true)}
                    className="w-full h-10 sm:h-9 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-600" />
                    <span>+ إضافة عشيرة جديدة للقائمة</span>
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 2: ATTENDANCE & PROXY DELIVERY METHOD */}
            <div className="p-3 sm:p-4 rounded-xl bg-purple-50/70 border border-purple-200 space-y-2.5">
              <div className="font-bold text-purple-950 text-xs flex items-center gap-1.5 pb-1 border-b border-purple-200">
                <Share2 className="w-3.5 h-3.5 text-purple-700" />
                <span>2. طريقة الحضور: هل حضر المراجع نفسه أم بيد شخص آخر؟ *</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className={`p-2.5 sm:p-3 rounded-lg border-2 flex items-center gap-2 cursor-pointer transition-all ${
                  attendanceType === 'شخصياً'
                    ? 'bg-white border-blue-500 text-blue-950 font-bold shadow-xs'
                    : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                }`}>
                  <input
                    type="radio"
                    name="attendanceType"
                    checked={attendanceType === 'شخصياً'}
                    onChange={() => setAttendanceType('شخصياً')}
                    className="w-4 h-4 text-blue-600 cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-black">حضر المراجع شخصياً</span>
                    <span className="text-[10px] text-slate-500">لا يتطلب إدخال بيانات حامل الطلب</span>
                  </div>
                </label>

                <label className={`p-2.5 sm:p-3 rounded-lg border-2 flex items-center gap-2 cursor-pointer transition-all ${
                  attendanceType === 'بيد شخص آخر (معتمد)'
                    ? 'bg-white border-purple-500 text-purple-950 font-bold shadow-xs'
                    : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                }`}>
                  <input
                    type="radio"
                    name="attendanceType"
                    checked={attendanceType === 'بيد شخص آخر (معتمد)'}
                    onChange={() => setAttendanceType('بيد شخص آخر (معتمد)')}
                    className="w-4 h-4 text-purple-600 cursor-pointer"
                  />
                  <div>
                    <span className="block text-xs font-black">جلب الطلب بيد شخص آخر (معتمد / وكيل)</span>
                    <span className="text-[10px] text-purple-700">تفتح حقول بيانات الحامل</span>
                  </div>
                </label>
              </div>

              {/* Dynamic Proxy Fields */}
              {attendanceType === 'بيد شخص آخر (معتمد)' && (
                <div className="p-3 rounded-xl bg-white border border-purple-200 space-y-2 animate-in fade-in duration-200">
                  <div className="text-[11px] font-bold text-purple-900 pb-1 border-b border-purple-100 flex items-center gap-1.5">
                    <span>بيانات الشخص الذي جلب الطلب:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-[11px]">اسم الشخص حامل الطلب *</label>
                      <input
                        type="text"
                        value={proxyName}
                        onChange={(e) => setProxyName(e.target.value)}
                        placeholder="اسم المعتمد / حامل الطلب..."
                        className="w-full h-10 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-right"
                        required={attendanceType === 'بيد شخص آخر (معتمد)'}
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-[11px]">رقم هاتف حامل الطلب *</label>
                      <input
                        type="tel"
                        value={proxyPhone}
                        onChange={(e) => setProxyPhone(e.target.value)}
                        placeholder="07XXXXXXXXX"
                        className="w-full h-10 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-right"
                        dir="ltr"
                        required={attendanceType === 'بيد شخص آخر (معتمد)'}
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1 text-[11px]">عنوان سكن حامل الطلب</label>
                      <input
                        type="text"
                        value={proxyAddress}
                        onChange={(e) => setProxyAddress(e.target.value)}
                        placeholder="المنطقة أو القضاء..."
                        className="w-full h-10 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-right"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: CONTACT AND LOCATION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-[11px]">رقم هاتف المواطن الأساسي *</label>
                <input
                  type="tel"
                  value={phone1}
                  onChange={(e) => setPhone1(e.target.value)}
                  placeholder="07XXXXXXXXX"
                  className="w-full h-10 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right shadow-2xs"
                  dir="ltr"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1 text-[11px]">رقم هاتف بديل (اختياري)</label>
                <input
                  type="tel"
                  value={phone2}
                  onChange={(e) => setPhone2(e.target.value)}
                  placeholder="07XXXXXXXXX"
                  className="w-full h-10 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right shadow-2xs"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-[11px]">القضاء / منطقة السكن *</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full h-10 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right shadow-2xs"
                >
                  {DHI_QAR_DISTRICTS.map((d, i) => (
                    <option key={i} value={d}>{d}</option>
                  ))}
                </select>
                {district === 'أخرى' && (
                  <input
                    type="text"
                    value={customDistrict}
                    onChange={(e) => setCustomDistrict(e.target.value)}
                    placeholder="اكتب اسم القضاء أو المنطقة..."
                    className="w-full h-9 px-3 mt-1.5 rounded-lg bg-white border border-blue-300 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none text-right text-xs"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1 text-[11px]">المهنة (قائمة وبحث ذكي) *</label>
                <SearchableSelect
                  options={allJobsList}
                  value={job}
                  onChange={(val) => setJob(val)}
                  placeholder="ابحث أو اختر المهنة (مثال: د ك)..."
                  className="w-full shadow-2xs"
                  allowCustom={true}
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1 text-[11px]">التحصيل الدراسي *</label>
                <SearchableSelect
                  options={allEducationsList}
                  value={education}
                  onChange={(val) => setEducation(val)}
                  placeholder="اختر التحصيل الدراسي..."
                  className="w-full shadow-2xs"
                  allowCustom={true}
                />
              </div>
            </div>

            {/* Optional Citizen Notes & Referral Source */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <label className="block text-slate-700 font-bold mb-1 text-[11px]">ملاحظات المراجع أو جهة التزكية / المعرف (اختياري)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="اكتب ملاحظات الاستعلامات أو اسم المعرف والتزكية إن وجدت..."
                className="w-full h-10 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-right shadow-2xs"
              />
            </div>

            {/* SECTION 4: MULTI-REQUESTS BUILDER BY MINISTRIES */}
            <div className="p-3 sm:p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-blue-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-xs text-blue-950">
                      باقة طلبات المراجع (إضافة أكثر من طلب لوزارات ومواضيع مختلفة)
                    </h3>
                    <p className="text-[10px] text-blue-800">
                      تنحفظ جميع الطلبات تحت نفس الكود الثابت للمراجع
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddRequestSlot}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ إضافة طلب آخر</span>
                </button>
              </div>

              {/* List of Requests in builder */}
              <div className="space-y-2.5">
                {requestsList.map((reqItem, index) => (
                  <div key={reqItem.id} className="p-3 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-md font-bold text-[11px] bg-blue-100 text-blue-900 border border-blue-300">
                        الطلب رقم ({index + 1})
                      </span>
                      {requestsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRequestSlot(reqItem.id)}
                          className="text-rose-500 hover:text-rose-700 font-bold text-xs flex items-center gap-1 cursor-pointer p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف الطلب</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1 text-[11px]">الوزارة / الجهة *</label>
                        <select
                          value={reqItem.entity}
                          onChange={(e) => handleRequestSlotChange(reqItem.id, 'entity', e.target.value)}
                          className="w-full h-10 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right text-xs"
                        >
                          {IRAQI_MINISTRIES.map((m, idx) => (
                            <option key={idx} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      {reqItem.entity === 'أخرى (تحديد يدوي)' && (
                        <div>
                          <label className="block text-slate-700 font-bold mb-1 text-[11px]">اسم الجهة *</label>
                          <input
                            type="text"
                            value={reqItem.customEntity || ''}
                            onChange={(e) => handleRequestSlotChange(reqItem.id, 'customEntity', e.target.value)}
                            placeholder="اسم الدائرة..."
                            className="w-full h-10 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right text-xs"
                            required
                          />
                        </div>
                      )}

                      <div className={reqItem.entity === 'أخرى (تحديد يدوي)' ? 'sm:col-span-1' : 'sm:col-span-2'}>
                        <label className="block text-slate-700 font-bold mb-1 text-[11px]">موضوع الطلب وتفاصيل المعاملة *</label>
                        <input
                          type="text"
                          value={reqItem.subject}
                          onChange={(e) => handleRequestSlotChange(reqItem.id, 'subject', e.target.value)}
                          placeholder="مثال: شمول بالرعاية، تعيين، علاج، قطعة أرض، نقل..."
                          className="w-full h-10 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1 text-[11px]">درجة الأهمية</label>
                        <select
                          value={reqItem.priority}
                          onChange={(e) => handleRequestSlotChange(reqItem.id, 'priority', e.target.value)}
                          className="w-full h-10 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white outline-none text-right font-medium text-xs"
                        >
                          <option value="عام">عام</option>
                          <option value="عاجل">عاجل</option>
                          <option value="خاص جداً">خاص جداً</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1 text-[11px]">ملاحظات إضافية (اختياري)</label>
                        <input
                          type="text"
                          value={reqItem.notes || ''}
                          onChange={(e) => handleRequestSlotChange(reqItem.id, 'notes', e.target.value)}
                          placeholder="ملاحظة حول الطلب أو المرفقات..."
                          className="w-full h-10 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white outline-none text-right text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Action Buttons */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                onClick={resetCitizenForm}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer text-center"
              >
                إفراغ الحقول
              </button>

              <button
                type="submit"
                className="w-full sm:flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer active:scale-98"
              >
                <Save className="w-4 h-4 text-amber-300" />
                <span>حفظ المراجع وباقة الطلبات وتوليد الكود الثابت ONA</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------- VIEW 2: SEARCH & CITIZEN DOSSIER ---------------- */}
      {activeSquare === 'search' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs p-3.5 sm:p-6 space-y-4 animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold shadow-2xs shrink-0">
                <Search className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  البحث والاستعلام الشامل عن المراجعين
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  ابحث بالاسم (مثال: حسن طالب)، رقم الهاتف، أو الرمز ONA-ID لمعاينة ملف المواطن وتعديل بياناته
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSquare('hub')}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              <span>رجوع للمربعات</span>
            </button>
          </div>

          {/* Search Input Bar */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب اسم المراجع (مثال: حسن طالب)، رقم الهاتف، العشيرة، أو الكود الثابت..."
              className="w-full h-11 sm:h-12 pr-11 pl-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs sm:text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-right transition-all shadow-2xs"
            />
          </div>

          {/* Results Container */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-xs font-bold text-slate-700">
              <span>نتائج الاستعلام ({filteredCitizens.length} مراجع)</span>
              <span className="text-[11px] text-slate-500 font-normal">عرض كافة تفاصيل المراجع والطلبات المرتبطة</span>
            </div>

            {/* Empty State */}
            {filteredCitizens.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                لا توجد نتائج مطابقة لبحثك الحالي.
              </div>
            )}

            {/* MOBILE PRESENTATION: Interactive Citizen Cards (Mobile First) */}
            <div className="block md:hidden divide-y divide-slate-100 bg-white">
              {filteredCitizens.map(cit => {
                const citRequestsCount = requests.filter(r => r.Citizen_ID === cit.Citizen_ID).length;
                return (
                  <div key={`m-cit-${cit.Citizen_ID}`} className="p-3.5 space-y-3 hover:bg-emerald-50/20 transition-colors">
                    {/* Header Row: Name & ONA ID */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-black text-sm text-slate-900 break-words">{cit.FullName}</h4>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap mt-0.5">
                          {cit.Surname && <span>عشيرة: <strong className="text-slate-700">{cit.Surname}</strong></span>}
                          <span>•</span>
                          <span>📍 {cit.District}</span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                        {cit.Citizen_ID}
                      </span>
                    </div>

                    {/* Metadata Badges */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                      <div>
                        <span className="text-slate-400 block text-[10px]">رقم الهاتف:</span>
                        <a 
                          href={`tel:${cit.Phone1}`} 
                          className="font-mono font-bold text-emerald-700 hover:underline flex items-center gap-1"
                          dir="ltr"
                        >
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>{cit.Phone1}</span>
                        </a>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">المهنة والطلبات:</span>
                        <span className="text-slate-800 font-semibold">{cit.Job || 'كاسب'} • {citRequestsCount} طلبات</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-slate-500 text-[10px]">طريقة الحضور:</span>
                        {cit.AttendanceType === 'بيد شخص آخر (معتمد)' ? (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 truncate max-w-[200px]">
                            بيد: {cit.ProxyName || 'معتمد'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            حضر شخصياً
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mobile Action Buttons (Touch Friendly >= 40px) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                      <button
                        onClick={() => setSelectedCitizenForCard(cit)}
                        className="h-9 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer border border-blue-200 active:scale-95"
                        title="عرض السجل والملف الشامل"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>السجل</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditCitizen(cit)}
                        className="h-9 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer border border-amber-200 active:scale-95"
                        title="تعديل بيانات المواطن"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>

                      <button
                        onClick={() => {
                          setCitizenForNewRequest(cit);
                          setNewReqSubject('');
                          setNewReqNotes('');
                        }}
                        className="h-9 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer border border-emerald-200 active:scale-95"
                        title="إضافة طلب ومعاملة لهذا المراجع"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>طلب</span>
                      </button>

                      <button
                        onClick={() => {
                          setCitizenForPrintInfo(cit);
                          setTimeout(() => window.print(), 300);
                        }}
                        className="h-9 px-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer border border-purple-200 active:scale-95"
                        title="طباعة بطاقة ومعلومات المراجع الرسمية"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>طباعة</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP PRESENTATION: Full Spreadsheet Table */}
            <div className="hidden md:block overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-right text-xs min-w-[750px]">
                <thead className="bg-slate-100/80 sticky top-0 z-10 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">الكود الثابت</th>
                    <th className="py-2.5 px-3">اسم المراجع الكامل</th>
                    <th className="py-2.5 px-3">العشيرة / اللقب</th>
                    <th className="py-2.5 px-3">رقم الهاتف</th>
                    <th className="py-2.5 px-3">السكن</th>
                    <th className="py-2.5 px-3">طريقة الحضور</th>
                    <th className="py-2.5 px-3 text-center">الطلبات</th>
                    <th className="py-2.5 px-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCitizens.map(cit => {
                    const citRequestsCount = requests.filter(r => r.Citizen_ID === cit.Citizen_ID).length;
                    return (
                      <tr key={cit.Citizen_ID} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                          {cit.Citizen_ID}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {cit.FullName}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {cit.Surname || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap" dir="ltr">
                          {cit.Phone1}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {cit.District}
                        </td>
                        <td className="py-2.5 px-3">
                          {cit.AttendanceType === 'بيد شخص آخر (معتمد)' ? (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 block truncate max-w-[140px]" title={`بيد: ${cit.ProxyName || 'وكيل'}`}>
                              بيد: {cit.ProxyName || 'وكيل'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              حضر شخصياً
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-800">
                            {citRequestsCount} طلبات
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {/* 1. السجل الشامل */}
                            <button
                              onClick={() => setSelectedCitizenForCard(cit)}
                              className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="عرض السجل والملف الشامل"
                            >
                              <Eye className="w-3 h-3" />
                              <span>السجل</span>
                            </button>

                            {/* 2. تعديل */}
                            <button
                              onClick={() => handleOpenEditCitizen(cit)}
                              className="px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="تعديل بيانات المواطن"
                            >
                              <Edit className="w-3 h-3" />
                              <span>تعديل</span>
                            </button>

                            {/* 3. إضافة طلب */}
                            <button
                              onClick={() => {
                                setCitizenForNewRequest(cit);
                                setNewReqSubject('');
                                setNewReqNotes('');
                              }}
                              className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="إضافة طلب ومعاملة لهذا المراجع"
                            >
                              <Plus className="w-3 h-3" />
                              <span>طلب</span>
                            </button>

                            {/* 4. طباعة معلوماته */}
                            <button
                              onClick={() => {
                                setCitizenForPrintInfo(cit);
                                setTimeout(() => window.print(), 300);
                              }}
                              className="px-2 py-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer"
                              title="طباعة بطاقة ومعلومات المراجع الرسمية"
                            >
                              <Printer className="w-3 h-3" />
                              <span>طباعة</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- VIEW 3: SCHEDULE & DOCUMENT MP INTERVIEW (نفس معلومات وتفاصيل تسجيل المراجع) ---------------- */}
      {/* "جدول وتوثيق مقابلة نفس معلومات وتفاصيل تسجيل المراجع اكثر من مرة طلبتها منك" */}
      {activeSquare === 'interviews' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs p-3.5 sm:p-6 space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold shadow-2xs shrink-0">
                <Handshake className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  جدولة وتوثيق مقابلة مع النائب (نفس تفاصيل وبيانات تسجيل المراجع)
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  تتضمن الاسم بالتقسيم الرباعي واللقب، الهاتف، السكن، العمل، والتحصيل، وطريقة الحضور، مع توثيق قضية المقابلة وتحديد موعدها
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveSquare('hub');
                setInterviewSuccessMessage('');
              }}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              <span>رجوع للمربعات</span>
            </button>
          </div>

          {/* Quick Metrics Bar for Interviews (إحصائيات مقابلات النائب الخاصة) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-amber-50/70 p-2.5 sm:p-3 rounded-2xl border border-amber-200 text-right shadow-2xs">
              <span className="text-[10px] font-bold text-amber-800 block mb-0.5">إجمالي المقابلات</span>
              <div className="text-lg sm:text-xl font-black text-amber-950">{interviews.length} <span className="text-[10px] font-normal text-slate-500">مقابلة</span></div>
              <div className="text-[9px] text-amber-700 font-bold mt-0.5">سجل لقاءات النائب</div>
            </div>

            <div className="bg-teal-50/70 p-2.5 sm:p-3 rounded-2xl border border-teal-200 text-right shadow-2xs">
              <span className="text-[10px] font-bold text-teal-800 block mb-0.5">المقابلات المجدولة</span>
              <div className="text-lg sm:text-xl font-black text-teal-900">{interviews.filter(i => i.Status === 'مجدولة').length} <span className="text-[10px] font-normal text-slate-500">قادمة</span></div>
              <div className="text-[9px] text-teal-700 font-bold mt-0.5">بانتظار الموعد الرسمي</div>
            </div>

            <div className="bg-emerald-50/70 p-2.5 sm:p-3 rounded-2xl border border-emerald-200 text-right shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-800 block mb-0.5">تمت المقابلة أو الإحالة</span>
              <div className="text-lg sm:text-xl font-black text-emerald-900">{interviews.filter(i => i.Status === 'تمت المقابلة' || i.Status === 'تمت الإحالة').length} <span className="text-[10px] font-normal text-slate-500">منجزة</span></div>
              <div className="text-[9px] text-emerald-700 font-bold mt-0.5">معالجة إدارياً</div>
            </div>

            <div className="bg-blue-50/70 p-2.5 sm:p-3 rounded-2xl border border-blue-200 text-right shadow-2xs">
              <span className="text-[10px] font-bold text-blue-800 block mb-0.5">مقابلات اليوم</span>
              <div className="text-lg sm:text-xl font-black text-blue-900">{interviews.filter(i => (i.InterviewDate || '').startsWith(todayStr)).length} <span className="text-[10px] font-normal text-slate-500">اليوم</span></div>
              <div className="text-[9px] text-blue-700 font-bold mt-0.5">جدول اليوم الحالي</div>
            </div>
          </div>

          {/* Sub-tab Navigation for Interviews: Schedule vs Records & Reports */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200 pb-2.5 gap-2.5">
            <div className="flex flex-col xs:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={() => setInterviewSubTab('schedule')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  interviewSubTab === 'schedule'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>جدولة موعد مقابلة جديدة</span>
              </button>

              <button
                type="button"
                onClick={() => setInterviewSubTab('records_reports')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  interviewSubTab === 'records_reports'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>سجل المقابلات ({interviews.length})</span>
              </button>
            </div>

            {interviewSubTab === 'records_reports' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleExportInterviewsList}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="تصدير كشف المقابلات المباشرة إلى إكسل"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="طباعة جدول المقابلات A4"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الكشف</span>
                </button>
              </div>
            )}
          </div>

          {/* Success Banner if interview was saved */}
          {interviewSuccessMessage && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between text-xs font-bold shadow-2xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="break-words">{interviewSuccessMessage}</span>
              </div>
              <button 
                onClick={() => setInterviewSuccessMessage('')} 
                className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: SCHEDULE INTERVIEW FORM */}
          {interviewSubTab === 'schedule' && (
            <div className="space-y-4">
              {/* AUTO-FILL SEARCH BAR (بحث واستدعاء مراجع مسجل) */}
              <div ref={interviewSearchRef} className="relative p-3.5 sm:p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                <label className="block text-amber-950 font-bold text-xs">
                  🔍 بحث واستدعاء مراجع مسجل في النظام لتعبئة كافة بياناته تلقائياً (مثال: اكتب حسن طالب أو رقم الهاتف):
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={interviewSearchQuery}
                    onChange={(e) => {
                      setInterviewSearchQuery(e.target.value);
                      setIsInterviewSearchDropdownOpen(true);
                      if (!e.target.value.trim()) setSelectedCitizenForInterview(null);
                    }}
                    onFocus={() => setIsInterviewSearchDropdownOpen(true)}
                    placeholder="اكتب اسم المراجع للبحث المباشر (مثال: حسن طالب)..."
                    className="w-full h-11 pr-10 pl-10 rounded-xl bg-white border border-amber-300 text-slate-900 font-bold text-xs sm:text-sm focus:ring-2 focus:ring-amber-500 outline-none text-right shadow-2xs"
                  />
                  {interviewSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setInterviewSearchQuery('');
                        setSelectedCitizenForInterview(null);
                        setIsInterviewSearchDropdownOpen(false);
                      }}
                      className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Results Dropdown */}
                {isInterviewSearchDropdownOpen && interviewSearchQuery.trim() && (
                  <div className="absolute top-full right-4 left-4 z-30 mt-1 max-h-56 overflow-y-auto bg-white rounded-2xl border border-amber-300 shadow-xl divide-y divide-slate-100">
                    {matchedInterviewCitizens.length === 0 ? (
                      <div className="p-3.5 text-center text-slate-500 text-xs">
                        لم يتم العثور على مراجع مطابق. يمكنك تعبئة الحقول أدناه مباشرة لتسجيله مع المقابلة.
                      </div>
                    ) : (
                      matchedInterviewCitizens.map(cit => (
                        <div
                          key={cit.Citizen_ID}
                          onClick={() => handleSelectCitizenForInterview(cit)}
                          className="p-3 hover:bg-amber-50/80 transition-colors cursor-pointer flex items-center justify-between text-right"
                        >
                          <div>
                            <strong className="text-xs text-slate-900 block">{cit.FullName}</strong>
                            <span className="text-[10px] text-slate-500">{cit.District} {cit.Surname ? `• عشيرة: ${cit.Surname}` : ''}</span>
                          </div>
                          <div className="text-left font-mono text-[11px] text-blue-700 font-bold">
                            {cit.Citizen_ID}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveInterviewWithFullDetails} className="space-y-4 sm:space-y-5 text-xs">
                
                {/* 1. SEPARATED NAME PARTS IDENTICAL TO REGISTRATION */}
                <div className="space-y-3 p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-1 border-b border-slate-200">
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    <span>1. الاسم بالتقسيم الرباعي واللقب (نفس شاشة تسجيل المراجع تماماً):</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">الاسم الأول *</label>
                      <input
                        type="text"
                        value={intvFirstName}
                        onChange={(e) => setIntvFirstName(e.target.value)}
                        placeholder="مثال: حسن"
                        className="w-full h-10 sm:h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold text-xs focus:ring-2 focus:ring-amber-500 outline-none text-right shadow-2xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">اسم الأب *</label>
                      <input
                        type="text"
                        value={intvFatherName}
                        onChange={(e) => setIntvFatherName(e.target.value)}
                        placeholder="مثال: طالب"
                        className="w-full h-10 sm:h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold text-xs focus:ring-2 focus:ring-amber-500 outline-none text-right shadow-2xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">اسم الجد</label>
                      <input
                        type="text"
                        value={intvGrandFatherName}
                        onChange={(e) => setIntvGrandFatherName(e.target.value)}
                        placeholder="اسم الجد..."
                        className="w-full h-10 sm:h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold text-xs focus:ring-2 focus:ring-amber-500 outline-none text-right shadow-2xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">الاسم الرابع</label>
                      <input
                        type="text"
                        value={intvGreatGrandFatherName}
                        onChange={(e) => setIntvGreatGrandFatherName(e.target.value)}
                        placeholder="الاسم الرابع..."
                        className="w-full h-10 sm:h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold text-xs focus:ring-2 focus:ring-amber-500 outline-none text-right shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Clan Dropdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">اللقب / العشيرة (قائمة منسدلة) *</label>
                      <SearchableSelect
                        options={allClansList}
                        value={intvSurname}
                        onChange={(val) => setIntvSurname(val)}
                        placeholder="اختر العشيرة أو اللقب..."
                        className="w-full shadow-2xs"
                        allowCustom={true}
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setShowNewClanModal(true)}
                        className="w-full h-10 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4 text-amber-600" />
                        <span>+ إضافة عشيرة جديدة للقائمة</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. ATTENDANCE & PROXY INFO IDENTICAL TO REGISTRATION */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2.5">
                  <div className="font-bold text-purple-950 text-xs flex items-center gap-1.5 pb-1 border-b border-purple-200">
                    <Share2 className="w-4 h-4 text-purple-700" />
                    <span>2. طريقة الحضور للمقابلة: هل يحضر المواطن نفسه أم بيد شخص آخر (معتمد/وكيل)؟ *</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className={`p-2.5 sm:p-3 rounded-xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                      intvAttendanceType === 'شخصياً'
                        ? 'bg-white border-blue-500 text-blue-950 font-bold shadow-xs'
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="intvAttendanceType"
                        checked={intvAttendanceType === 'شخصياً'}
                        onChange={() => setIntvAttendanceType('شخصياً')}
                        className="w-4 h-4 text-blue-600 cursor-pointer"
                      />
                      <div>
                        <span className="block text-xs font-black">حضر المراجع شخصياً</span>
                        <span className="text-[10px] text-slate-500">لا يتطلب إدخال بيانات حامل الطلب</span>
                      </div>
                    </label>

                    <label className={`p-2.5 sm:p-3 rounded-xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                      intvAttendanceType === 'بيد شخص آخر (معتمد)'
                        ? 'bg-white border-purple-500 text-purple-950 font-bold shadow-xs'
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="intvAttendanceType"
                        checked={intvAttendanceType === 'بيد شخص آخر (معتمد)'}
                        onChange={() => setIntvAttendanceType('بيد شخص آخر (معتمد)')}
                        className="w-4 h-4 text-purple-600 cursor-pointer"
                      />
                      <div>
                        <span className="block text-xs font-black">جلب الطلب بيد شخص آخر (معتمد / وكيل)</span>
                        <span className="text-[10px] text-purple-700">تفتح حقول بيانات الحامل (الاسم، الهاتف، والسكن)</span>
                      </div>
                    </label>
                  </div>

                  {intvAttendanceType === 'بيد شخص آخر (معتمد)' && (
                    <div className="p-3 sm:p-3.5 rounded-xl bg-white border border-purple-200 space-y-2.5 animate-in fade-in duration-200">
                      <div className="text-[11px] font-bold text-purple-900 pb-1 border-b border-purple-100 flex items-center gap-1.5">
                        <span>بيانات الشخص الحامل للطلب:</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-slate-700 font-bold mb-1">اسم الشخص حامل الطلب *</label>
                          <input
                            type="text"
                            value={intvProxyName}
                            onChange={(e) => setIntvProxyName(e.target.value)}
                            placeholder="اسم المعتمد / حامل الطلب..."
                            className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-right"
                            required={intvAttendanceType === 'بيد شخص آخر (معتمد)'}
                          />
                        </div>

                        <div>
                          <label className="block text-slate-700 font-bold mb-1">رقم هاتف حامل الطلب *</label>
                          <input
                            type="tel"
                            value={intvProxyPhone}
                            onChange={(e) => setIntvProxyPhone(e.target.value)}
                            placeholder="07XXXXXXXXX"
                            className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-semibold focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-right"
                            dir="ltr"
                            required={intvAttendanceType === 'بيد شخص آخر (معتمد)'}
                          />
                        </div>

                        <div>
                          <label className="block text-slate-700 font-bold mb-1">عنوان سكن حامل الطلب</label>
                          <input
                            type="text"
                            value={intvProxyAddress}
                            onChange={(e) => setIntvProxyAddress(e.target.value)}
                            placeholder="المنطقة أو القضاء..."
                            className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none text-right"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. CONTACT, LOCATION, JOB, EDUCATION IDENTICAL TO REGISTRATION */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">رقم هاتف المواطن الأساسي *</label>
                    <input
                      type="tel"
                      value={intvPhone1}
                      onChange={(e) => setIntvPhone1(e.target.value)}
                      placeholder="07XXXXXXXXX"
                      className="w-full h-10 sm:h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right shadow-2xs"
                      dir="ltr"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">رقم هاتف بديل (اختياري)</label>
                    <input
                      type="tel"
                      value={intvPhone2}
                      onChange={(e) => setIntvPhone2(e.target.value)}
                      placeholder="07XXXXXXXXX"
                      className="w-full h-10 sm:h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right shadow-2xs"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">القضاء / منطقة السكن *</label>
                    <select
                      value={intvDistrict}
                      onChange={(e) => setIntvDistrict(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right shadow-2xs"
                    >
                      {DHI_QAR_DISTRICTS.map((d, i) => (
                        <option key={i} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">المهنة (قائمة وبحث ذكي) *</label>
                    <SearchableSelect
                      options={allJobsList}
                      value={intvJob}
                      onChange={(val) => setIntvJob(val)}
                      placeholder="ابحث أو اختر المهنة (مثال: د ك)..."
                      className="w-full shadow-2xs"
                      allowCustom={true}
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">التحصيل الدراسي *</label>
                    <SearchableSelect
                      options={allEducationsList}
                      value={intvEducation}
                      onChange={(val) => setIntvEducation(val)}
                      placeholder="اختر التحصيل الدراسي..."
                      className="w-full shadow-2xs"
                      allowCustom={true}
                    />
                  </div>
                </div>

                {/* 4. INTERVIEW SPECIFIC DETAILS */}
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 border-2 border-amber-300 space-y-3">
                  <div className="font-bold text-amber-950 text-xs flex items-center gap-1.5 pb-1 border-b border-amber-200">
                    <Handshake className="w-4 h-4 text-amber-700" />
                    <span>3. تفاصيل وموعد المقابلة المباشرة مع النائب *</span>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">موضوع وقضية المقابلة مع النائب *</label>
                    <textarea
                      value={intvSubject}
                      onChange={(e) => setIntvSubject(e.target.value)}
                      placeholder="اكتب شرحاً وافياً لموضوع المقابلة، والطلب أو المظلمة المراد عرضها على النائب..."
                      rows={3}
                      className="w-full p-3 rounded-xl bg-white border border-amber-300 text-slate-900 font-semibold focus:ring-2 focus:ring-amber-500 outline-none text-right shadow-2xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">تاريخ المقابلة *</label>
                      <input
                        type="date"
                        value={intvDate}
                        onChange={(e) => setIntvDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono focus:ring-2 focus:ring-amber-500 outline-none text-right"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">وقت المقابلة</label>
                      <input
                        type="text"
                        value={intvTime}
                        onChange={(e) => setIntvTime(e.target.value)}
                        placeholder="10:30 صباحاً"
                        className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">درجة الأهمية</label>
                      <select
                        value={intvPriority}
                        onChange={(e) => setIntvPriority(e.target.value as any)}
                        className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none text-right"
                      >
                        <option value="عادي">عادي</option>
                        <option value="عاجل">عاجل</option>
                        <option value="خاص جداً">خاص جداً</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5">
                  <button
                    type="button"
                    onClick={resetInterviewForm}
                    className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer text-center"
                  >
                    إفراغ الحقول
                  </button>

                  <button
                    type="submit"
                    className="w-full sm:flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 transition-all cursor-pointer active:scale-98"
                  >
                    <Handshake className="w-5 h-5" />
                    <span>حفظ وتثبيت المقابلة مع النائب وتوثيق بيانات المراجع</span>
                  </button>
                </div>

              </form>
            </div>
          )}

          {/* TAB 2: DEDICATED INTERVIEWS RECORDS & REPORTS (احصائيات وتقارير وحده) */}
          {interviewSubTab === 'records_reports' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Filter & Search Bar */}
              <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={intvRecordSearch}
                    onChange={(e) => setIntvRecordSearch(e.target.value)}
                    placeholder="ابحث باسم المراجع، الهاتف، أو رقم المقابلة..."
                    className="w-full pr-9 pl-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1 max-w-full">
                  <span className="text-xs font-bold text-slate-600 ml-1 shrink-0">تصفية الحالة:</span>
                  {[
                    { id: 'all', label: `الكل (${interviews.length})` },
                    { id: 'مجدولة', label: `مجدولة (${interviews.filter(i => i.Status === 'مجدولة').length})` },
                    { id: 'تمت المقابلة', label: `تمت المقابلة (${interviews.filter(i => i.Status === 'تمت المقابلة').length})` },
                    { id: 'تمت الإحالة', label: `تمت الإحالة (${interviews.filter(i => i.Status === 'تمت الإحالة').length})` }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setIntvRecordStatusFilter(st.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        intvRecordStatusFilter === st.id
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interviews Presentation */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                {filteredInterviewRecords.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 font-medium text-xs bg-white">
                    لا توجد مقابلات تطابق معايير البحث الحالية.
                  </div>
                ) : (
                  <>
                    {/* MOBILE CARDS PRESENTATION (Mobile First) */}
                    <div className="block md:hidden divide-y divide-slate-100 bg-white">
                      {filteredInterviewRecords.map((intv) => (
                        <div key={`m-intv-${intv.Interview_ID}`} className="p-3.5 space-y-2.5 hover:bg-amber-50/30 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-amber-700 text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  {intv.Interview_ID}
                                </span>
                                <h4 className="font-black text-sm text-slate-900">{intv.FullName}</h4>
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                                <span>📍 {intv.Address || 'ذي قار'}</span>
                                <span>•</span>
                                <a href={`tel:${intv.Phone1}`} className="font-mono text-emerald-700 font-bold" dir="ltr">📞 {intv.Phone1}</a>
                              </div>
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                              intv.Status === 'تمت المقابلة' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              intv.Status === 'تمت الإحالة' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              intv.Status === 'مجدولة' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {intv.Status}
                            </span>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                            <div className="text-slate-800 font-semibold">
                              <span className="text-slate-500 font-normal">الموضوع: </span>
                              {intv.Subject}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                              <span>الموعد: <strong>{intv.InterviewDate}</strong> ({intv.InterviewTime || '10:30 ص'})</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                intv.Priority === 'خاص جداً' ? 'bg-red-100 text-red-700' :
                                intv.Priority === 'عاجل' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {intv.Priority}
                              </span>
                            </div>
                            {intv.DeputyNotes && (
                              <div className="text-[11px] text-amber-900 bg-amber-50/80 p-1.5 rounded border border-amber-200">
                                توجيه النائب: <strong>{intv.DeputyNotes}</strong>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const res = convertInterviewToRequest(intv.Interview_ID, 'ديوان محافظة ذي قار');
                              if (res) {
                                setInterviewSuccessMessage(`تم بنجاح تحويل المقابلة (${intv.Interview_ID}) إلى معاملة إدارية رسمية رقم (${res.Request_ID}) وإحالتها للإدارة.`);
                              }
                            }}
                            className="w-full h-10 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors cursor-pointer border border-blue-200 flex items-center justify-center gap-1.5 active:scale-95"
                            title="تحويل المقابلة إلى معاملة إدارية رسمية وإحالتها للإدارة"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>إحالة وتحويل للإدارة</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* DESKTOP TABLE PRESENTATION */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs min-w-[850px]">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                            <th className="p-3">رقم المقابلة</th>
                            <th className="p-3">اسم المراجع الكامل</th>
                            <th className="p-3">رقم الهاتف</th>
                            <th className="p-3">القضاء / السكن</th>
                            <th className="p-3">موعد المقابلة</th>
                            <th className="p-3">قضية وموضوع المقابلة</th>
                            <th className="p-3">الأسبقية</th>
                            <th className="p-3">الحالة</th>
                            <th className="p-3">توجيهات النائب</th>
                            <th className="p-3 text-center">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredInterviewRecords.map((intv) => (
                            <tr key={intv.Interview_ID} className="hover:bg-amber-50/40 transition-colors">
                              <td className="p-3 font-mono font-bold text-amber-700 whitespace-nowrap">{intv.Interview_ID}</td>
                              <td className="p-3 font-bold text-slate-900">{intv.FullName}</td>
                              <td className="p-3 font-mono text-slate-600 whitespace-nowrap" dir="ltr">{intv.Phone1}</td>
                              <td className="p-3 text-slate-600">{intv.Address || '-'}</td>
                              <td className="p-3 whitespace-nowrap">
                                <span className="font-mono font-bold text-slate-800">{intv.InterviewDate}</span>
                                <span className="text-[10px] text-slate-500 mr-1.5">{intv.InterviewTime || '10:30 ص'}</span>
                              </td>
                              <td className="p-3 max-w-xs truncate text-slate-700" title={intv.Subject}>{intv.Subject}</td>
                              <td className="p-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  intv.Priority === 'خاص جداً' ? 'bg-red-100 text-red-700' :
                                  intv.Priority === 'عاجل' ? 'bg-amber-100 text-amber-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {intv.Priority}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  intv.Status === 'تمت المقابلة' ? 'bg-emerald-100 text-emerald-800' :
                                  intv.Status === 'تمت الإحالة' ? 'bg-blue-100 text-blue-800' :
                                  intv.Status === 'مجدولة' ? 'bg-amber-100 text-amber-800' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {intv.Status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600 text-[11px] max-w-xs truncate" title={intv.DeputyNotes}>
                                {intv.DeputyNotes || 'إحالة للإدارة'}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = convertInterviewToRequest(intv.Interview_ID, 'ديوان محافظة ذي قار');
                                    if (res) {
                                      setInterviewSuccessMessage(`تم بنجاح تحويل المقابلة (${intv.Interview_ID}) إلى معاملة إدارية رسمية رقم (${res.Request_ID}) وإحالتها للإدارة.`);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] transition-colors cursor-pointer border border-blue-200"
                                  title="تحويل المقابلة إلى معاملة إدارية رسمية وإحالتها للإدارة"
                                >
                                  إحالة للإدارة
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- VIEW 4: REPORTS & STATISTICS (بدلاً من لوحة التحكم) ---------------- */}
      {/* "و ايقونه بدال لوحة التحكم خليلي بدالا طباعة التقارير" */}
      {activeSquare === 'reports' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs p-3.5 sm:p-6 space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold shadow-2xs shrink-0">
                <Printer className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                  طباعة التقارير (قسم الاستعلامات ومقابلات النائب فقط)
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  سحب وطباعة تقارير المراجعين ومقابلات النائب دون تداخل مع قسم الإدارة
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={handleExportReportToExcel}
                className="flex-1 sm:flex-none h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors active:scale-95"
                title="تصدير ملف إكسل"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>تصدير Excel</span>
              </button>

              <button
                onClick={() => window.print()}
                className="flex-1 sm:flex-none h-9 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-colors active:scale-95"
                title="طباعة التقرير"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>طباعة التقرير</span>
              </button>

              <button
                onClick={() => setActiveSquare('hub')}
                className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
              >
                <ArrowLeft className="w-4 h-4 rotate-180 shrink-0" />
                <span className="hidden xs:inline">رجوع</span>
              </button>
            </div>
          </div>

          {/* Report Filters: تحديد القسم المطلوب (فقط قسم الاستعلامات ومقابلات النائب - لا يتدخل مع قسم الإدارة) والفترة الزمنية */}
          <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200 space-y-3">
            {/* 1. تحديد القسم المطلوب (حصراً: الاستعلامات ومقابلات النائب) */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1.5">
                <label className="block text-slate-800 font-bold text-xs">
                  تحديد القسم المطلوب للتقرير:
                </label>
                <span className="text-[10px] text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-full font-bold self-start sm:self-auto">
                  مستقل تماماً ولا يتدخل مع قسم الإدارة
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                {[
                  { id: 'reception', label: 'قسم الاستعلامات والمراجعين' },
                  { id: 'interviews', label: 'قسم مقابلات النائب' }
                ].map(dept => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => setReportDepartment(dept.id as any)}
                    className={`py-2 px-2.5 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      reportDepartment === dept.id
                        ? 'bg-purple-700 text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {dept.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. الفترة الزمنية والقضاء */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">الفترة الزمنية للتقرير:</label>
                <div className="grid grid-cols-2 xs:flex xs:items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setReportDateFilter('today')}
                    className={`h-8 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                      reportDateFilter === 'today'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    يومي ({todayStr})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportDateFilter('week')}
                    className={`h-8 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                      reportDateFilter === 'week'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    أسبوعي (7 أيام)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportDateFilter('month')}
                    className={`h-8 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                      reportDateFilter === 'month'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    شهري (30 يوم)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportDateFilter('all')}
                    className={`h-8 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                      reportDateFilter === 'all'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    شامل تراكمي
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1 text-xs">تصفية حسب القضاء:</label>
                <select
                  value={reportDistrictFilter}
                  onChange={(e) => setReportDistrictFilter(e.target.value)}
                  className="w-full h-8.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-purple-500 outline-none text-right text-xs"
                >
                  <option value="all">-- جميع الأقضية والمناطق --</option>
                  {DHI_QAR_DISTRICTS.map((d, idx) => (
                    <option key={idx} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Stats in Report */}
          {reportDepartment === 'interviews' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
              <div className="bg-amber-50/70 p-2.5 sm:p-3.5 rounded-2xl border border-amber-200 text-right">
                <span className="text-[10px] font-bold text-amber-700 block">إجمالي المقابلات</span>
                <div className="text-xl sm:text-2xl font-black text-amber-950 mt-1">{reportInterviews.length} <span className="text-[11px] font-normal">مقابلة</span></div>
              </div>

              <div className="bg-teal-50/70 p-2.5 sm:p-3.5 rounded-2xl border border-teal-200 text-right">
                <span className="text-[10px] font-bold text-teal-700 block">مقابلات مجدولة</span>
                <div className="text-xl sm:text-2xl font-black text-teal-950 mt-1">
                  {reportInterviews.filter(i => i.Status === 'مجدولة').length}{' '}
                  <span className="text-[11px] font-normal">مجدولة</span>
                </div>
              </div>

              <div className="bg-emerald-50/70 p-2.5 sm:p-3.5 rounded-2xl border border-emerald-200 text-right">
                <span className="text-[10px] font-bold text-emerald-700 block">منجزة / محالة</span>
                <div className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">
                  {reportInterviews.filter(i => i.Status === 'تمت المقابلة' || i.Status === 'تمت الإحالة').length}{' '}
                  <span className="text-[11px] font-normal">منجزة</span>
                </div>
              </div>

              <div className="bg-purple-50/70 p-2.5 sm:p-3.5 rounded-2xl border border-purple-200 text-right">
                <span className="text-[10px] font-bold text-purple-700 block">عاجل وخاص جداً</span>
                <div className="text-xl sm:text-2xl font-black text-purple-950 mt-1">
                  {reportInterviews.filter(i => i.Priority === 'عاجل' || i.Priority === 'خاص جداً').length}{' '}
                  <span className="text-[11px] font-normal">أهمية</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
              <div className="bg-purple-50/60 p-2.5 sm:p-3.5 rounded-2xl border border-purple-200 text-right">
                <span className="text-[10px] font-bold text-purple-700 block">إجمالي مراجعي التقرير</span>
                <div className="text-xl sm:text-2xl font-black text-purple-950 mt-1">{reportCitizens.length} <span className="text-[11px] font-normal">مواطن</span></div>
              </div>

              <div className="bg-blue-50/60 p-2.5 sm:p-3.5 rounded-2xl border border-blue-200 text-right">
                <span className="text-[10px] font-bold text-blue-700 block">حضروا شخصياً</span>
                <div className="text-xl sm:text-2xl font-black text-blue-950 mt-1">
                  {reportCitizens.filter(c => c.AttendanceType !== 'بيد شخص آخر (معتمد)').length}{' '}
                  <span className="text-[11px] font-normal">مواطن</span>
                </div>
              </div>

              <div className="bg-amber-50/60 p-2.5 sm:p-3.5 rounded-2xl border border-amber-200 text-right">
                <span className="text-[10px] font-bold text-amber-700 block">بيد معتمد / وكيل</span>
                <div className="text-xl sm:text-2xl font-black text-amber-950 mt-1">
                  {reportCitizens.filter(c => c.AttendanceType === 'بيد شخص آخر (معتمد)').length}{' '}
                  <span className="text-[11px] font-normal">معاملة</span>
                </div>
              </div>

              <div className="bg-teal-50/60 p-2.5 sm:p-3.5 rounded-2xl border border-teal-200 text-right">
                <span className="text-[10px] font-bold text-teal-700 block">المقابلات المرتبطة</span>
                <div className="text-xl sm:text-2xl font-black text-teal-950 mt-1">
                  {interviews.filter(inv => reportCitizens.some(c => c.Citizen_ID === inv.Citizen_ID)).length}{' '}
                  <span className="text-[11px] font-normal">مقابلة</span>
                </div>
              </div>
            </div>
          )}

          {/* Report Data Table and Mobile Cards */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs" id="receptionOfficialPrintArea">
            
            {/* Header visible only on print */}
            <div className="hidden print:block p-4 border-b-2 border-slate-900 bg-white mb-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-300">
                <div className="text-right">
                  <h2 className="text-lg font-black text-slate-900">جمهورية العراق - مجلس النواب</h2>
                  <h3 className="text-sm font-bold text-slate-700">مكتب النائب علا عودة الناشي</h3>
                  <div className="text-xs text-purple-900 font-bold mt-1">
                    {reportDepartment === 'interviews' ? 'تقرير قسم مقابلات النائب' : 'تقرير قسم الاستعلامات والمراجعين'}
                  </div>
                </div>
                <div className="text-left text-xs font-mono">
                  <div>التاريخ: {todayStr}</div>
                  <div>الفترة: {reportDateFilter === 'today' ? 'يومي' : reportDateFilter === 'week' ? 'أسبوعي' : reportDateFilter === 'month' ? 'شهري' : 'شامل'}</div>
                  <div>العدد المشمول: {reportDepartment === 'interviews' ? reportInterviews.length : reportCitizens.length}</div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs font-bold text-slate-700 print:hidden">
              <span>
                {reportDepartment === 'interviews' 
                  ? `سجل مقابلات النائب المشمولة بالتقرير (${reportInterviews.length})` 
                  : `سجل مراجعي الاستعلامات المشمولين بالتقرير (${reportCitizens.length})`}
              </span>
              <span className="text-[11px] text-purple-700 font-semibold">
                {reportDepartment === 'interviews' ? 'قسم مقابلات النائب' : 'قسم الاستعلامات'}
              </span>
            </div>

            {/* A. Mobile Adaptive Cards (Visible on mobile/tablet, hidden on md+ and print) */}
            <div className="block md:hidden print:hidden p-2.5 space-y-2.5 bg-slate-50/50 max-h-[550px] overflow-y-auto">
              {reportDepartment === 'interviews' ? (
                reportInterviews.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    لا توجد مقابلات مسجلة ضمن الفترة المحددة.
                  </div>
                ) : (
                  reportInterviews.map(inv => (
                    <div key={inv.Interview_ID} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2 text-right text-xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                          {inv.Interview_ID}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.Priority === 'خاص جداً'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : inv.Priority === 'عاجل'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {inv.Priority}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            {inv.Status}
                          </span>
                        </div>
                      </div>

                      <div className="font-bold text-slate-900 text-sm">{inv.FullName}</div>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                        <div>
                          <span className="text-slate-400">الهاتف: </span>
                          <a href={`tel:${inv.Phone1}`} className="font-mono font-bold text-blue-700" dir="ltr">{inv.Phone1}</a>
                        </div>
                        <div>
                          <span className="text-slate-400">السكن: </span>
                          <span className="font-medium text-slate-800">{inv.Address}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400">الموعد: </span>
                          <span className="font-mono font-semibold text-slate-800">{inv.InterviewDate} ({inv.InterviewTime || '10:30 ص'})</span>
                        </div>
                      </div>

                      <div className="text-[11px] bg-amber-50/50 p-2 rounded-lg border border-amber-100/60">
                        <span className="font-bold text-amber-900">موضوع المقابلة: </span>
                        <span className="text-slate-800">{inv.Subject}</span>
                      </div>

                      {inv.DeputyNotes && (
                        <div className="text-[10px] text-teal-900 bg-teal-50/70 p-1.5 rounded border border-teal-100">
                          <strong>توجيه النائب: </strong> {inv.DeputyNotes}
                        </div>
                      )}
                    </div>
                  ))
                )
              ) : (
                reportCitizens.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    لا يوجد مراجعون مسجلون ضمن الفترة المحددة.
                  </div>
                ) : (
                  reportCitizens.map(c => (
                    <div key={c.Citizen_ID} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2 text-right text-xs">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-200">
                          {c.Citizen_ID}
                        </span>
                        {c.AttendanceType === 'بيد شخص آخر (معتمد)' ? (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            بيد معتمد: {c.ProxyName || 'وكيل'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            شخصياً
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between">
                        <div className="font-bold text-slate-900 text-sm">{c.FullName}</div>
                        {c.Surname && <span className="text-xs text-slate-500 font-semibold">{c.Surname}</span>}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                        <div>
                          <span className="text-slate-400">الهاتف: </span>
                          <a href={`tel:${c.Phone1}`} className="font-mono font-bold text-blue-700" dir="ltr">{c.Phone1}</a>
                        </div>
                        <div>
                          <span className="text-slate-400">السكن: </span>
                          <span className="font-medium text-slate-800">{c.District}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">المهنة: </span>
                          <span className="font-medium text-slate-800">{c.Job || 'كاسب'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">التاريخ: </span>
                          <span className="font-mono text-slate-700">{(c.CreatedAt || '').split('T')[0]}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

            {/* B. Desktop Table & Print View (hidden on mobile, visible on md+ and print) */}
            <div className="hidden md:block print:block overflow-x-auto max-h-[500px] overflow-y-auto">
              {reportDepartment === 'interviews' ? (
                <table className="w-full text-right text-xs">
                  <thead className="bg-amber-50/80 sticky top-0 z-10 text-slate-800 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">رقم المقابلة</th>
                      <th className="py-2.5 px-3">اسم المراجع</th>
                      <th className="py-2.5 px-3">رقم الهاتف</th>
                      <th className="py-2.5 px-3">السكن</th>
                      <th className="py-2.5 px-3">موضوع المقابلة</th>
                      <th className="py-2.5 px-3">تاريخ المقابلة</th>
                      <th className="py-2.5 px-3">الأهمية</th>
                      <th className="py-2.5 px-3">الحالة</th>
                      <th className="py-2.5 px-3">توجيه النائب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportInterviews.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                          لا توجد مقابلات مسجلة ضمن الفترة المحددة.
                        </td>
                      </tr>
                    ) : (
                      reportInterviews.map(inv => (
                        <tr key={inv.Interview_ID} className="hover:bg-amber-50/30 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-700">{inv.Interview_ID}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{inv.FullName}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700" dir="ltr">{inv.Phone1}</td>
                          <td className="py-2.5 px-3 text-slate-700">{inv.Address}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800 max-w-xs truncate">{inv.Subject}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">{inv.InterviewDate} ({inv.InterviewTime || '10:30 ص'})</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.Priority === 'خاص جداً'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : inv.Priority === 'عاجل'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {inv.Priority}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                              {inv.Status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 text-[11px]">{inv.DeputyNotes || 'إحالة للإدارة'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/90 sticky top-0 z-10 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">الرقم التعريفي ONA</th>
                      <th className="py-2.5 px-3">اسم المراجع الكامل</th>
                      <th className="py-2.5 px-3">العشيرة / اللقب</th>
                      <th className="py-2.5 px-3">رقم الهاتف</th>
                      <th className="py-2.5 px-3">القضاء والسكن</th>
                      <th className="py-2.5 px-3">المهنة</th>
                      <th className="py-2.5 px-3">طريقة الحضور</th>
                      <th className="py-2.5 px-3">تاريخ التسجيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportCitizens.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                          لا يوجد مراجعون مسجلون ضمن الفترة المحددة.
                        </td>
                      </tr>
                    ) : (
                      reportCitizens.map(c => (
                        <tr key={c.Citizen_ID} className="hover:bg-purple-50/30 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{c.Citizen_ID}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{c.FullName}</td>
                          <td className="py-2.5 px-3 text-slate-600">{c.Surname || '-'}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700" dir="ltr">{c.Phone1}</td>
                          <td className="py-2.5 px-3 text-slate-700">{c.District}</td>
                          <td className="py-2.5 px-3 text-slate-600">{c.Job || 'كاسب'}</td>
                          <td className="py-2.5 px-3">
                            {c.AttendanceType === 'بيد شخص آخر (معتمد)' ? (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                بيد: {c.ProxyName || 'معتمد'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                شخصياً
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">{(c.CreatedAt || '').split('T')[0]}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Official Footer stamp visible only in print */}
            <div className="hidden print:flex justify-between items-center p-6 border-t-2 border-slate-800 text-xs font-bold text-slate-800 mt-4 bg-white">
              <div className="text-center">
                <div>منظم التقرير</div>
                <div className="text-[10px] text-slate-500 mt-1">موظف الاستعلامات والمقابلات</div>
                <div className="mt-6 border-t border-dotted border-slate-400 pt-1 w-32 mx-auto">التوقيع</div>
              </div>
              <div className="text-center">
                <div>ختم قسم الاستعلامات والمقابلات</div>
                <div className="w-24 h-24 border-2 border-dashed border-slate-400 rounded-full mx-auto my-1 flex items-center justify-center text-[10px] text-slate-400">
                  الختم الرسمي
                </div>
              </div>
              <div className="text-center">
                <div>مدير المكتب التنفيذي</div>
                <div className="text-[10px] text-slate-500 mt-1">مصادقة وتوجيه</div>
                <div className="mt-6 border-t border-dotted border-slate-400 pt-1 w-32 mx-auto">التوقيع</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SUCCESS MODAL (WITHOUT BARCODE PRINT BUTTON) ---------------- */}
      {/* "من قسم الاستعلامات شيل طباعة الباركود بشكل نهائي" */}
      {savedSuccessCitizen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4 text-right">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">تم الحفظ الفعال بنجاح في المنظومة!</h3>
                <span className="text-xs text-slate-500">تم تسجيل المراجع وكافة الطلبات تحت الكود الثابت</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">اسم المراجع:</span>
                <strong className="text-slate-900 font-bold text-sm">{savedSuccessCitizen.citizen.FullName}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">الرقم التعريفي الموحد (الكود الثابت):</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {savedSuccessCitizen.citizen.Citizen_ID}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">عدد الطلبات المحفوظة:</span>
                <strong className="text-indigo-700 font-bold">{savedSuccessCitizen.requestsCount} طلبات</strong>
              </div>
              {savedSuccessCitizen.ministries.length > 0 && (
                <div className="pt-1 border-t border-slate-200 text-[11px] text-slate-600">
                  الوزارات: <strong>{savedSuccessCitizen.ministries.join(' ، ')}</strong>
                </div>
              )}
            </div>

            {/* Direct Action Buttons without barcode */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setSelectedCitizenForCard(savedSuccessCitizen.citizen);
                  setSavedSuccessCitizen(null);
                }}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>معاينة البطاقة الشاملة للمراجع</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setSavedSuccessCitizen(null);
                    resetCitizenForm();
                  }}
                  className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>تسجيل مراجع آخر</span>
                </button>

                <button
                  onClick={() => {
                    setSavedSuccessCitizen(null);
                    setActiveSquare('hub');
                  }}
                  className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>العودة للمربعات</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: ADD NEW CLAN ---------------- */}
      {showNewClanModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 max-w-sm w-full space-y-3 text-right">
            <h4 className="font-bold text-sm text-slate-900">إضافة عشيرة أو لقب جديد</h4>
            <p className="text-xs text-slate-500">سيتم حفظها في القائمة المنسدلة لاختيارها لاحقاً بكل سهولة</p>
            <input
              type="text"
              value={newClanInput}
              onChange={(e) => setNewClanInput(e.target.value)}
              placeholder="مثال: البصري، الحاتمي..."
              className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold"
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleAddNewClan}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer"
              >
                إضافة واختيار
              </button>
              <button
                type="button"
                onClick={() => setShowNewClanModal(false)}
                className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- UNIFIED CITIZEN CARD MODAL ---------------- */}
      {selectedCitizenForCard && (
        <UnifiedCitizenCardModal
          citizen={selectedCitizenForCard}
          onClose={() => setSelectedCitizenForCard(null)}
          receptionMode={true}
          onAddNewRequest={(cit) => {
            setSelectedCitizenForCard(null);
            setCitizenForNewRequest(cit);
            setNewReqSubject('');
            setNewReqNotes('');
          }}
        />
      )}

      {/* ---------------- MODAL: EDIT CITIZEN (تعديل) ---------------- */}
      {editingCitizenForSearch && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 sm:p-5 max-w-2xl w-full space-y-3.5 max-h-[92vh] overflow-y-auto text-right my-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">تعديل وتحديث بيانات المراجع</h3>
                  <span className="text-[11px] text-slate-500 font-mono">الكود الثابت: {editingCitizenForSearch.Citizen_ID}</span>
                </div>
              </div>
              <button
                onClick={() => setEditingCitizenForSearch(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditCitizen} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">الاسم الأول *</label>
                  <input
                    type="text"
                    value={editCitFirst}
                    onChange={(e) => setEditCitFirst(e.target.value)}
                    className="w-full h-8.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">اسم الأب *</label>
                  <input
                    type="text"
                    value={editCitFather}
                    onChange={(e) => setEditCitFather(e.target.value)}
                    className="w-full h-8.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">اسم الجد</label>
                  <input
                    type="text"
                    value={editCitGrand}
                    onChange={(e) => setEditCitGrand(e.target.value)}
                    className="w-full h-8.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">الاسم الرابع</label>
                  <input
                    type="text"
                    value={editCitGreat}
                    onChange={(e) => setEditCitGreat(e.target.value)}
                    className="w-full h-8.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">اللقب / العشيرة</label>
                  <SearchableSelect
                    options={allClansList}
                    value={editCitSurname}
                    onChange={(val) => setEditCitSurname(val)}
                    placeholder="العشيرة..."
                    allowCustom={true}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">رقم الهاتف 1 *</label>
                  <input
                    type="tel"
                    value={editCitPhone1}
                    onChange={(e) => setEditCitPhone1(e.target.value)}
                    className="w-full h-8.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    dir="ltr"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">رقم الهاتف 2</label>
                  <input
                    type="tel"
                    value={editCitPhone2}
                    onChange={(e) => setEditCitPhone2(e.target.value)}
                    className="w-full h-8.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">القضاء / السكن</label>
                  <select
                    value={editCitDistrict}
                    onChange={(e) => setEditCitDistrict(e.target.value)}
                    className="w-full h-8.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white outline-none text-right"
                  >
                    {DHI_QAR_DISTRICTS.map((d, i) => (
                      <option key={i} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">المهنة</label>
                  <SearchableSelect
                    options={allJobsList}
                    value={editCitJob}
                    onChange={(val) => setEditCitJob(val)}
                    placeholder="المهنة..."
                    allowCustom={true}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">التحصيل الدراسي</label>
                  <SearchableSelect
                    options={allEducationsList}
                    value={editCitEducation}
                    onChange={(val) => setEditCitEducation(val)}
                    placeholder="التحصيل الدراسي..."
                    allowCustom={true}
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-2">
                <div className="text-[11px] font-bold text-purple-900">طريقة الحضور:</div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="editAttendance"
                      checked={editCitAttendanceType === 'شخصياً'}
                      onChange={() => setEditCitAttendanceType('شخصياً')}
                    />
                    <span>حضر شخصياً</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="editAttendance"
                      checked={editCitAttendanceType === 'بيد شخص آخر (معتمد)'}
                      onChange={() => setEditCitAttendanceType('بيد شخص آخر (معتمد)')}
                    />
                    <span>بيد معتمد / وكيل</span>
                  </label>
                </div>
                {editCitAttendanceType === 'بيد شخص آخر (معتمد)' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <input
                      type="text"
                      value={editCitProxyName}
                      onChange={(e) => setEditCitProxyName(e.target.value)}
                      placeholder="اسم المعتمد..."
                      className="w-full h-8 px-2 rounded-lg bg-white border border-purple-200 text-xs text-right"
                    />
                    <input
                      type="tel"
                      value={editCitProxyPhone}
                      onChange={(e) => setEditCitProxyPhone(e.target.value)}
                      placeholder="هاتف المعتمد..."
                      className="w-full h-8 px-2 rounded-lg bg-white border border-purple-200 text-xs text-right font-mono"
                      dir="ltr"
                    />
                    <input
                      type="text"
                      value={editCitProxyAddress}
                      onChange={(e) => setEditCitProxyAddress(e.target.value)}
                      placeholder="سكن المعتمد..."
                      className="w-full h-8 px-2 rounded-lg bg-white border border-purple-200 text-xs text-right"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ التعديلات في النظام</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCitizenForSearch(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: CONFIRM DELETE CITIZEN (حذف) ---------------- */}
      {citizenToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-sm w-full space-y-3.5 text-right">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-black text-sm text-slate-900">تأكيد حذف المراجع من المنظومة</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                هل أنت متأكد من رغبتك بحذف ملف المراجع (<strong>{citizenToDelete.FullName}</strong>) صاحب الكود (<strong>{citizenToDelete.Citizen_ID}</strong>)؟
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleConfirmDeleteCitizen}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-xs"
              >
                تأكيد الحذف نهائياً
              </button>
              <button
                onClick={() => setCitizenToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: ADD REQUEST FOR CITIZEN (إضافة طلب) ---------------- */}
      {citizenForNewRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 sm:p-5 max-w-lg w-full space-y-3 text-right my-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">إضافة طلب جديد للمراجع</h3>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {citizenForNewRequest.FullName} • {citizenForNewRequest.Citizen_ID}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCitizenForNewRequest(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewRequestForCitizen} className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1 text-[11px]">الوزارة / الجهة المعنية *</label>
                <select
                  value={newReqEntity}
                  onChange={(e) => setNewReqEntity(e.target.value)}
                  className="w-full h-8.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white outline-none text-right"
                >
                  {IRAQI_MINISTRIES.map((m, i) => (
                    <option key={i} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1 text-[11px]">موضوع الطلب وتفاصيل المعاملة *</label>
                <textarea
                  value={newReqSubject}
                  onChange={(e) => setNewReqSubject(e.target.value)}
                  placeholder="اكتب موضوع وتفاصيل الطلب الجديد..."
                  className="w-full h-20 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none text-right"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">درجة الأهمية</label>
                  <select
                    value={newReqPriority}
                    onChange={(e) => setNewReqPriority(e.target.value as Priority)}
                    className="w-full h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 outline-none text-right"
                  >
                    <option value="عام">عام</option>
                    <option value="عاجل">عاجل</option>
                    <option value="خاص جداً">خاص جداً</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1 text-[11px]">ملاحظات إضافية</label>
                  <input
                    type="text"
                    value={newReqNotes}
                    onChange={(e) => setNewReqNotes(e.target.value)}
                    placeholder="ملاحظات..."
                    className="w-full h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 outline-none text-right"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ وإدراج الطلب تحت الكود الثابت</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCitizenForNewRequest(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: PRINT CITIZEN INFORMATION (طباعة معلوماته) ---------------- */}
      {citizenForPrintInfo && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 max-w-xl w-full space-y-4 text-right my-auto">
            {/* Printable official layout */}
            <div className="border border-slate-300 p-4 rounded-xl space-y-3 bg-white" id="printableCitizenInfoCard">
              <div className="flex items-center justify-between pb-2 border-b-2 border-slate-800">
                <div>
                  <h3 className="font-black text-sm text-slate-900">جمهورية العراق - مجلس النواب</h3>
                  <h4 className="font-bold text-xs text-slate-700">مكتب النائب علا عودة الناشي • بطاقة مراجع رسمية</h4>
                </div>
                <div className="text-left font-mono font-black text-xs text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-300">
                  {citizenForPrintInfo.Citizen_ID}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">اسم المراجع:</span> <strong className="text-slate-900 font-bold">{citizenForPrintInfo.FullName}</strong></div>
                <div><span className="text-slate-500">العشيرة:</span> <strong>{citizenForPrintInfo.Surname || '-'}</strong></div>
                <div><span className="text-slate-500">رقم الهاتف:</span> <strong className="font-mono">{citizenForPrintInfo.Phone1}</strong></div>
                <div><span className="text-slate-500">القضاء والسكن:</span> <strong>{citizenForPrintInfo.District}</strong></div>
                <div><span className="text-slate-500">المهنة:</span> <strong>{citizenForPrintInfo.Job || 'كاسب'}</strong></div>
                <div><span className="text-slate-500">طريقة الحضور:</span> <strong>{citizenForPrintInfo.AttendanceType}</strong></div>
                {citizenForPrintInfo.AttendanceType === 'بيد شخص آخر (معتمد)' && (
                  <div className="col-span-2 text-[11px] bg-purple-50 p-1.5 rounded border border-purple-200">
                    حامل الطلب (المعتمد): <strong>{citizenForPrintInfo.ProxyName}</strong> • هاتف: <strong className="font-mono">{citizenForPrintInfo.ProxyPhone}</strong>
                  </div>
                )}
              </div>

              {/* Requests history for this citizen */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 block mb-1">الطلبات والمعاملات المسجلة:</span>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {requests.filter(r => r.Citizen_ID === citizenForPrintInfo.Citizen_ID).map((r, i) => (
                    <div key={r.Request_ID} className="p-1.5 rounded bg-slate-50 border border-slate-200 text-[10px] flex items-center justify-between">
                      <div>
                        <strong>{i + 1}. {r.Entity}:</strong> <span>{r.Details}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded font-bold text-blue-700 bg-blue-50 border border-blue-200 text-[9px]">
                        {r.ProcessingStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة البطاقة الرسمية</span>
              </button>
              <button
                onClick={() => setCitizenForPrintInfo(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
