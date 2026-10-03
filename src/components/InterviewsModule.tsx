import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Interview, InterviewStatus, Citizen, Gender } from '../types';
import { 
  Handshake, 
  Plus, 
  Search, 
  CheckCircle, 
  Send, 
  Edit,
  BarChart2,
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Briefcase,
  Share2,
  Layers,
  AlertCircle,
  Eye,
  CheckCircle2,
  Trash2,
  X,
  UserCheck,
  Building2,
  Sparkles
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import { UnifiedCitizenCardModal } from './UnifiedCitizenCardModal';
import { OfficeIconTilesGrid } from './OfficeIconTilesGrid';

const DHI_QAR_DISTRICTS = [
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

const DEFAULT_CLANS = [
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

export const InterviewsModule: React.FC = () => {
  const { 
    interviews, 
    addInterview, 
    updateInterview, 
    convertInterviewToRequest, 
    citizens,
    updateCitizen,
    requests,
    dropdowns,
    addDropdownItem
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedCitizenForCardModal, setSelectedCitizenForCardModal] = useState<Citizen | null>(null);

  // Available clans
  const allClansList = useMemo(() => {
    const customClans = dropdowns
      .filter(d => d.Category.toLowerCase() === 'surname')
      .map(d => d.ItemValue.trim());
    return Array.from(new Set([...DEFAULT_CLANS, ...customClans]));
  }, [dropdowns]);

  // ---------------- NEW INTERVIEW FORM STATE ----------------
  const [citizenSearchInput, setCitizenSearchInput] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // Form Fields
  const [subject, setSubject] = useState('');
  const [interviewDate, setInterviewDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [interviewTime, setInterviewTime] = useState('10:30 صباحاً');
  const [priority, setPriority] = useState<'عادي' | 'عاجل' | 'خاص جداً'>('عادي');
  const [status, setStatus] = useState<InterviewStatus>('مجدولة');
  const [deputyNotes, setDeputyNotes] = useState('إحالة للإدارة');
  const [outcome, setOutcome] = useState('');

  // ---------------- EDIT INTERVIEW FORM STATE (All Registration Info Divided Identical to New Registration) ----------------
  const [editFirstName, setEditFirstName] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editGrandFatherName, setEditGrandFatherName] = useState('');
  const [editGreatGrandFatherName, setEditGreatGrandFatherName] = useState('');
  const [editSurname, setEditSurname] = useState(DEFAULT_CLANS[0]);
  const [editPhone1, setEditPhone1] = useState('');
  const [editPhone2, setEditPhone2] = useState('');
  const [editDistrict, setEditDistrict] = useState(DHI_QAR_DISTRICTS[0]);
  const [editJob, setEditJob] = useState('كاسب');
  const [editEducation, setEditEducation] = useState('إعدادية فما دون');
  const [editAttendanceType, setEditAttendanceType] = useState<'شخصياً' | 'بيد شخص آخر (معتمد)'>('شخصياً');
  const [editProxyName, setEditProxyName] = useState('');
  const [editProxyPhone, setEditProxyPhone] = useState('');
  const [editProxyAddress, setEditProxyAddress] = useState('');
  const [editProxyRelation, setEditProxyRelation] = useState('معتمد');

  // Close citizen dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered citizens matching live search (مثلاً: حسن طالب)
  const matchedCitizens = useMemo(() => {
    if (!citizenSearchInput.trim()) return [];
    const q = citizenSearchInput.toLowerCase().trim();
    return citizens.filter(c => {
      return (
        c.FullName.toLowerCase().includes(q) ||
        c.Citizen_ID.toLowerCase().includes(q) ||
        (c.Phone1 && c.Phone1.includes(q)) ||
        (c.District && c.District.toLowerCase().includes(q)) ||
        (c.Surname && c.Surname.toLowerCase().includes(q))
      );
    }).slice(0, 10);
  }, [citizens, citizenSearchInput]);

  // Statistics Calculation
  const totalInterviews = interviews.length;
  const scheduledCount = interviews.filter(i => i.Status === 'مجدولة').length;
  const completedOrReferredCount = interviews.filter(i => i.Status === 'تمت المقابلة' || i.Status === 'تمت الإحالة').length;
  const urgentCount = interviews.filter(i => i.Priority === 'عاجل' || i.Priority === 'خاص جداً').length;
  const totalCitizensCount = citizens.length;

  // Filtered interviews list
  const filteredInterviews = useMemo(() => {
    return interviews.filter(intv => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        intv.FullName.toLowerCase().includes(q) ||
        intv.Interview_ID.toLowerCase().includes(q) ||
        intv.Subject.toLowerCase().includes(q) ||
        intv.Address.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || intv.Status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || intv.Priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [interviews, searchQuery, statusFilter, priorityFilter]);

  // Select Citizen from Search Dropdown
  const handleSelectCitizenFromSearch = (citizen: Citizen) => {
    setSelectedCitizen(citizen);
    setCitizenSearchInput(citizen.FullName);
    setIsDropdownOpen(false);
  };

  // Reset form
  const resetAddForm = () => {
    setSelectedCitizen(null);
    setCitizenSearchInput('');
    setSubject('');
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setInterviewDate(d.toISOString().split('T')[0]);
    setInterviewTime('10:30 صباحاً');
    setPriority('عادي');
    setStatus('مجدولة');
    setDeputyNotes('إحالة للإدارة');
    setOutcome('');
  };

  // Save New Interview
  const handleSaveNewInterview = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCitizen) {
      alert('يرجى اختيار مراجع مسجل بالنظام أولاً عبر حقل البحث.');
      return;
    }

    if (!subject.trim() || !interviewDate) {
      alert('يرجى كتابة موضوع المقابلة وتحديد التاريخ.');
      return;
    }

    addInterview({
      Citizen_ID: selectedCitizen.Citizen_ID,
      FullName: selectedCitizen.FullName,
      Subject: subject.trim(),
      Phone1: selectedCitizen.Phone1,
      Phone2: selectedCitizen.Phone2 || undefined,
      Address: `${selectedCitizen.District}${selectedCitizen.SubDistrict ? ` - ${selectedCitizen.SubDistrict}` : ''}`,
      Referrer: selectedCitizen.ReferralSource || (selectedCitizen.AttendanceType === 'بيد شخص آخر (معتمد)' ? `بيد المعتمد: ${selectedCitizen.ProxyName}` : 'مباشر'),
      InterviewDate: interviewDate,
      InterviewTime: interviewTime,
      Priority: priority,
      Status: status,
      DeputyNotes: deputyNotes || undefined,
      Outcome: outcome || undefined,
      ConvertedToRequest: false
    });

    setShowAddModal(false);
    resetAddForm();
    setSuccessMessage(`تم بنجاح تثبيت وجدولة موعد مقابلة مع النائب للمراجع (${selectedCitizen.FullName}).`);
  };

  // Open Edit Mode
  const openEditInterview = (intv: Interview) => {
    setEditingInterview(intv);
    
    // Find linked citizen record
    const cit = citizens.find(c => c.Citizen_ID === intv.Citizen_ID);

    if (cit) {
      setEditFirstName(cit.FirstName || '');
      setEditFatherName(cit.FatherName || '');
      setEditGrandFatherName(cit.GrandFatherName || '');
      setEditGreatGrandFatherName(cit.GreatGrandFatherName || '');
      setEditSurname(cit.Surname || DEFAULT_CLANS[0]);
      setEditPhone1(cit.Phone1 || intv.Phone1 || '');
      setEditPhone2(cit.Phone2 || intv.Phone2 || '');
      setEditDistrict(cit.District || DHI_QAR_DISTRICTS[0]);
      setEditJob(cit.Job || 'كاسب');
      setEditEducation(cit.Education || 'إعدادية فما دون');
      setEditAttendanceType((cit.AttendanceType as any) || 'شخصياً');
      setEditProxyName(cit.ProxyName || '');
      setEditProxyPhone(cit.ProxyPhone || '');
      setEditProxyAddress(cit.ProxyAddress || '');
      setEditProxyRelation(cit.ProxyRelation || 'معتمد');
    } else {
      // Split full name into parts as fallback
      const parts = intv.FullName.trim().split(/\s+/);
      setEditFirstName(parts[0] || '');
      setEditFatherName(parts[1] || '');
      setEditGrandFatherName(parts[2] || '');
      setEditGreatGrandFatherName(parts[3] || '');
      setEditSurname(DEFAULT_CLANS[0]);
      setEditPhone1(intv.Phone1 || '');
      setEditPhone2(intv.Phone2 || '');
      setEditDistrict(DHI_QAR_DISTRICTS[0]);
      setEditJob('كاسب');
      setEditEducation('إعدادية فما دون');
      setEditAttendanceType('شخصياً');
      setEditProxyName('');
      setEditProxyPhone('');
      setEditProxyAddress('');
      setEditProxyRelation('معتمد');
    }

    setSubject(intv.Subject || '');
    setInterviewDate(intv.InterviewDate || '');
    setInterviewTime(intv.InterviewTime || '10:30 صباحاً');
    setPriority(intv.Priority || 'عادي');
    setStatus(intv.Status || 'مجدولة');
    setDeputyNotes(intv.DeputyNotes || 'إحالة للإدارة');
    setOutcome(intv.Outcome || '');
  };

  // Save Edit Interview & Citizen
  const handleSaveEditInterview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInterview) return;

    const computedFull = [editFirstName.trim(), editFatherName.trim(), editGrandFatherName.trim(), editGreatGrandFatherName.trim(), editSurname.trim()]
      .filter(Boolean)
      .join(' ')
      .trim();

    const finalFullName = computedFull || editingInterview.FullName;

    // 1. Update Interview
    updateInterview({
      ...editingInterview,
      FullName: finalFullName,
      Phone1: editPhone1.trim(),
      Phone2: editPhone2.trim() || undefined,
      Address: editDistrict,
      Subject: subject.trim(),
      InterviewDate: interviewDate,
      InterviewTime: interviewTime,
      Priority: priority,
      Status: status,
      DeputyNotes: deputyNotes,
      Outcome: outcome || undefined
    });

    // 2. Update Citizen Record across all departments
    const cit = citizens.find(c => c.Citizen_ID === editingInterview.Citizen_ID);
    if (cit) {
      updateCitizen({
        ...cit,
        FirstName: editFirstName.trim(),
        FatherName: editFatherName.trim(),
        GrandFatherName: editGrandFatherName.trim(),
        GreatGrandFatherName: editGreatGrandFatherName.trim(),
        Surname: editSurname.trim(),
        FullName: finalFullName,
        Phone1: editPhone1.trim(),
        Phone2: editPhone2.trim() || undefined,
        District: editDistrict,
        Job: editJob.trim(),
        Education: editEducation,
        AttendanceType: editAttendanceType,
        ProxyName: editAttendanceType === 'بيد شخص آخر (معتمد)' ? editProxyName.trim() : undefined,
        ProxyPhone: editAttendanceType === 'بيد شخص آخر (معتمد)' ? editProxyPhone.trim() : undefined,
        ProxyAddress: editAttendanceType === 'بيد شخص آخر (معتمد)' ? editProxyAddress.trim() : undefined,
        ProxyRelation: editAttendanceType === 'بيد شخص آخر (معتمد)' ? editProxyRelation.trim() : undefined
      });
    }

    setEditingInterview(null);
    setSuccessMessage(`تم بنجاح تحديث وتعديل كافة بيانات المقابلة والمراجع (${finalFullName}) ومزامنتها في جميع الأقسام.`);
  };

  const handleConvert = (intv: Interview) => {
    const res = convertInterviewToRequest(intv.Interview_ID, 'ديوان محافظة ذي قار');
    if (res) {
      setSuccessMessage(`تم بنجاح تحويل المقابلة (${intv.Interview_ID}) إلى طلب إداري برقم (${res.Request_ID}) وترحيله لقسم الإدارة.`);
    }
  };

  return (
    <div className="space-y-4 text-right font-['Tajawal',sans-serif] select-none" dir="rtl">
      
      {/* Header Bar (حجم مصغر ومرتب) */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
              <Handshake className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  قسم مقابلات النائب
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  المقابلات المباشرة والتوجيهات
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                جدولة مواعيد المقابلات مع النائب، توثيق توجيهات النائب، وتحويل المقابلات المنجزة إلى معاملات إدارية.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            resetAddForm();
            setShowAddModal(true);
          }}
          className="w-full md:w-auto px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ جدولة موعد مقابلة جديدة</span>
        </button>
      </div>

      {/* 5-Column Desktop Icon Grid for Interviews */}
      <OfficeIconTilesGrid
        title="أيقونات ومهام قسم مقابلات النائب"
        subtitle="انقر على أي أيقونة للاستعراض المباشر أو جدولة وإحالة المقابلات"
        columns={5}
        items={[
          {
            id: 'int_all',
            title: 'كل المقابلات الموثقة',
            subtitle: 'السجل العام للمقابلات',
            icon: Handshake,
            iconColor: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
            badge: totalInterviews,
            badgeColor: 'bg-amber-600 text-white',
            isActive: statusFilter === 'all' && priorityFilter === 'all',
            onClick: () => {
              setStatusFilter('all');
              setPriorityFilter('all');
            }
          },
          {
            id: 'int_scheduled',
            title: 'المقابلات المجدولة',
            subtitle: 'بانتظار الموعد الرسمي',
            icon: Clock,
            iconColor: 'text-teal-600 dark:text-teal-400',
            iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
            badge: scheduledCount,
            badgeColor: 'bg-teal-600 text-white',
            isActive: statusFilter === 'مجدولة',
            onClick: () => {
              setStatusFilter('مجدولة');
              setPriorityFilter('all');
            }
          },
          {
            id: 'int_completed',
            title: 'المقابلات المنجزة والمحققة',
            subtitle: 'تمت المقابلة أو إحالتها',
            icon: CheckCircle2,
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
            badge: completedOrReferredCount,
            badgeColor: 'bg-emerald-600 text-white',
            isActive: statusFilter === 'تمت المقابلة',
            onClick: () => {
              setStatusFilter('تمت المقابلة');
              setPriorityFilter('all');
            }
          },
          {
            id: 'int_urgent',
            title: 'المقابلات العاجلة والحرجة',
            subtitle: 'أولوية قصوى وخاص جداً',
            icon: AlertCircle,
            iconColor: 'text-rose-600 dark:text-rose-400',
            iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
            badge: urgentCount,
            badgeColor: 'bg-rose-600 text-white',
            isActive: priorityFilter === 'عاجل',
            onClick: () => {
              setPriorityFilter('عاجل');
            }
          },
          {
            id: 'int_add_new',
            title: 'جدولة موعد مقابلة جديدة',
            subtitle: 'تسجيل موعد مراجع مع النائب',
            icon: Plus,
            iconColor: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
            onClick: () => {
              resetAddForm();
              setShowAddModal(true);
            }
          }
        ]}
      />

      {/* Simple Clean KPI Counters (حجم مصغر وأنيق) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs text-right">
          <span className="text-[10px] font-bold text-slate-500 block mb-0.5">إجمالي المقابلات</span>
          <div className="text-xl font-black text-slate-900">{totalInterviews} <span className="text-[10px] font-normal text-slate-400">مقابلة</span></div>
          <div className="text-[9px] text-amber-700 font-bold mt-0.5">سجل اللقاءات الموثقة</div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs text-right">
          <span className="text-[10px] font-bold text-slate-500 block mb-0.5">المقابلات المجدولة</span>
          <div className="text-xl font-black text-teal-600">{scheduledCount} <span className="text-[10px] font-normal text-slate-400">بانتظار الموعد</span></div>
          <div className="text-[9px] text-teal-700 font-bold mt-0.5">جلسات قادمة</div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs text-right">
          <span className="text-[10px] font-bold text-slate-500 block mb-0.5">تمت المقابلة أو الإحالة</span>
          <div className="text-xl font-black text-emerald-600">{completedOrReferredCount} <span className="text-[10px] font-normal text-slate-400">منجزة</span></div>
          <div className="text-[9px] text-emerald-700 font-bold mt-0.5">معالجة ومحالة للإدارة</div>
        </div>

        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-2xs text-right">
          <span className="text-[10px] font-bold text-slate-500 block mb-0.5">إجمالي المراجعين</span>
          <div className="text-xl font-black text-blue-600">{totalCitizensCount} <span className="text-[10px] font-normal text-slate-400">مواطن</span></div>
          <div className="text-[9px] text-blue-700 font-bold mt-0.5">قاعدة بيانات المكتب</div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer p-1">
            ✕
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم، موضوع المقابلة، القضاء..."
              className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs text-right focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-semibold"
            >
              <option value="all">-- حالة وموقف المقابلة (الكل) --</option>
              <option value="مجدولة">مجدولة (بانتظار الموعد)</option>
              <option value="تمت المقابلة">تمت المقابلة</option>
              <option value="تمت الإحالة">تمت الإحالة للإدارة</option>
              <option value="مؤجلة">مؤجلة</option>
              <option value="ملغاة">ملغاة</option>
            </select>
          </div>

          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none font-semibold"
            >
              <option value="all">-- درجة الأهمية (الكل) --</option>
              <option value="عادي">عادي</option>
              <option value="عاجل">عاجل</option>
              <option value="خاص جداً">خاص جداً</option>
            </select>
          </div>
        </div>
      </div>

      {/* Interviews Table & Mobile Cards */}
      <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-slate-50/70">
          <span className="text-xs font-bold text-slate-800">
            جدول ومواعيد مقابلات النائب ({filteredInterviews.length})
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            تعديل بيانات المراجع والمقابلة وإحالتها للإدارة بنقرة واحدة
          </span>
        </div>

        {/* 1. Mobile Adaptive Card List (Visible on mobile/tablet, hidden on md+) */}
        <div className="block md:hidden p-2.5 sm:p-3 space-y-2.5 bg-slate-50/50">
          {filteredInterviews.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs bg-white rounded-xl border border-slate-200">
              لا توجد مواعيد مقابلات مسجلة مطابقة للبحث حالياً.
            </div>
          ) : (
            filteredInterviews.map((intv) => {
              const cit = citizens.find(c => c.Citizen_ID === intv.Citizen_ID);

              return (
                <div key={intv.Interview_ID} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 text-right text-xs">
                  {/* Card Header: ID, Badges */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded text-[11px] border border-amber-200">
                      {intv.Interview_ID}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        intv.Priority === 'خاص جداً'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : intv.Priority === 'عاجل'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {intv.Priority}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        intv.Status === 'تمت الإحالة'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : intv.Status === 'تمت المقابلة'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : intv.Status === 'مؤجلة'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : intv.Status === 'ملغاة'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-teal-50 text-teal-700 border-teal-200'
                      }`}>
                        {intv.Status}
                      </span>
                    </div>
                  </div>

                  {/* Citizen Info */}
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-bold text-slate-900 text-sm">{intv.FullName}</span>
                      {cit?.Citizen_ID && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                          {cit.Citizen_ID}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                      <a href={`tel:${intv.Phone1}`} className="font-mono font-bold text-blue-700" dir="ltr">📞 {intv.Phone1}</a>
                      <span>•</span>
                      <span>📍 {intv.Address}</span>
                    </div>
                  </div>

                  {/* Interview Date & Subject */}
                  <div className="bg-slate-50 p-2.5 rounded-lg space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="text-slate-400">موعد المقابلة:</span>
                      <span className="font-mono font-bold text-slate-900">{intv.InterviewDate} ({intv.InterviewTime || '10:30 صباحاً'})</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">موضوع المقابلة:</span>
                      <span className="font-semibold text-slate-800">{intv.Subject}</span>
                    </div>
                    {intv.Outcome && (
                      <div className="pt-1 border-t border-slate-200 text-slate-600">
                        <span className="text-slate-400">النتيجة: </span>{intv.Outcome}
                      </div>
                    )}
                  </div>

                  {/* Directive / Deputy Notes */}
                  {intv.DeputyNotes && (
                    <div className="text-[11px] text-amber-900 bg-amber-50/80 p-2 rounded-lg border border-amber-200">
                      <span className="font-bold">توجيه وقرار النائب: </span>
                      <span>{intv.DeputyNotes}</span>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {/* View Citizen Card */}
                    {cit ? (
                      <button
                        onClick={() => setSelectedCitizenForCardModal(cit)}
                        className="h-8.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>البطاقة</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    {/* Convert to Request */}
                    {!intv.ConvertedToRequest ? (
                      <button
                        onClick={() => handleConvert(intv)}
                        className="h-8.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>إحالة للإدارة</span>
                      </button>
                    ) : (
                      <div className="h-8.5 px-2 rounded-lg bg-slate-50 text-slate-400 border border-slate-200 text-[10px] font-bold flex items-center justify-center">
                        تمت الإحالة
                      </div>
                    )}

                    {/* Edit */}
                    <button
                      onClick={() => openEditInterview(intv)}
                      className="h-8.5 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors active:scale-95"
                    >
                      <Edit className="w-3.5 h-3.5 text-amber-600" />
                      <span>تعديل</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 2. Desktop Full Table (Hidden on mobile, visible on md+) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="p-3">رقم المقابلة</th>
                <th className="p-3">اسم المراجع</th>
                <th className="p-3">موضوع المقابلة</th>
                <th className="p-3">الموعد والتوقيت</th>
                <th className="p-3">الأهمية</th>
                <th className="p-3">توجيه وقرار النائب</th>
                <th className="p-3">الموقف</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredInterviews.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 text-xs">
                    لا توجد مواعيد مقابلات مسجلة مطابقة للبحث حالياً.
                  </td>
                </tr>
              ) : (
                filteredInterviews.map((intv) => {
                  const cit = citizens.find(c => c.Citizen_ID === intv.Citizen_ID);

                  return (
                    <tr key={intv.Interview_ID} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-amber-700 text-[11px] whitespace-nowrap">
                        {intv.Interview_ID}
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{intv.FullName}</span>
                          {cit?.Citizen_ID && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded border border-blue-200">
                              {cit.Citizen_ID}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="font-mono" dir="ltr">📞 {intv.Phone1}</span>
                          <span>•</span>
                          <span>📍 {intv.Address}</span>
                        </div>
                      </td>

                      <td className="p-3 max-w-xs">
                        <div className="font-semibold text-slate-800 line-clamp-1">{intv.Subject}</div>
                        {intv.Outcome && (
                          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                            النتيجة: {intv.Outcome}
                          </div>
                        )}
                      </td>

                      <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                        <div className="font-bold text-slate-900">{intv.InterviewDate}</div>
                        <div className="text-[10px] text-slate-400">{intv.InterviewTime || '10:30 صباحاً'}</div>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          intv.Priority === 'خاص جداً'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : intv.Priority === 'عاجل'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {intv.Priority}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className="font-bold text-amber-900 text-[11px] bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200 block truncate max-w-[150px]">
                          {intv.DeputyNotes || 'إحالة للإدارة'}
                        </span>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          intv.Status === 'تمت الإحالة'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : intv.Status === 'تمت المقابلة'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : intv.Status === 'مؤجلة'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : intv.Status === 'ملغاة'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-teal-50 text-teal-700 border-teal-200'
                        }`}>
                          {intv.Status}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* View Citizen Card */}
                          {cit && (
                            <button
                              onClick={() => setSelectedCitizenForCardModal(cit)}
                              className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="معاينة بطاقة المراجع الشاملة"
                            >
                              <Eye className="w-3 h-3" />
                              <span>البطاقة</span>
                            </button>
                          )}

                          {/* Convert to Request */}
                          {!intv.ConvertedToRequest && (
                            <button
                              onClick={() => handleConvert(intv)}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="إحالة وتحويل المقابلة فوراً إلى طلب إداري"
                            >
                              <Send className="w-3 h-3" />
                              <span>إحالة للإدارة</span>
                            </button>
                          )}

                          {/* Edit / Modify ("والتعديل يضهر جميع المعلومات نفس ما تسجيل جديد") */}
                          <button
                            onClick={() => openEditInterview(intv)}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="تعديل كافة بيانات المقابلة والمراجع"
                          >
                            <Edit className="w-3 h-3 text-amber-600" />
                            <span>تعديل</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------- MODAL 1: SCHEDULE NEW INTERVIEW WITH SMART LIVE SEARCH & CARD ---------------- */}
      {/* "في قسم مقابلات النائب من اريد اختار اسم بس ابحث عن الاسم يضهر في القائمة المنسدلة بس اكتب مثلا حسن طالب يضهر جميع معلوماته بطاقة المعلومات اريدها سلسة واحترافية وجميلة وسهلة وواضحة للموضف" */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 md:p-6 space-y-4 max-h-[94vh] overflow-y-auto text-right my-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Handshake className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    جدولة وتوثيق مقابلة جديدة مع النائب
                  </h3>
                  <p className="text-xs text-slate-500">
                    ابحث بالاسم لتحديد المراجع وظهور بطاقة معلوماته فورياً
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetAddForm();
                }}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewInterview} className="space-y-4 text-xs">
              
              {/* LIVE SEARCHABLE DROPDOWN (اكتب مثلا: حسن طالب) */}
              <div ref={searchDropdownRef} className="relative space-y-1">
                <label className="block text-slate-700 font-bold text-xs">
                  بحث واختيار اسم المراجع من النظام (اكتب الاسم، مثال: حسن طالب) *
                </label>
                
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={citizenSearchInput}
                    onChange={(e) => {
                      setCitizenSearchInput(e.target.value);
                      setIsDropdownOpen(true);
                      if (!e.target.value.trim()) {
                        setSelectedCitizen(null);
                      }
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="اكتب اسم المراجع للبحث المباشر (مثال: حسن طالب، أو رقم الهاتف، أو الرمز)..."
                    className="w-full h-11 pr-10 pl-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-right transition-all shadow-2xs"
                    required={!selectedCitizen}
                  />
                  {citizenSearchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setCitizenSearchInput('');
                        setSelectedCitizen(null);
                        setIsDropdownOpen(false);
                      }}
                      className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-[11px] cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Dropdown Results */}
                {isDropdownOpen && citizenSearchInput.trim() && (
                  <div className="absolute top-full right-0 left-0 z-30 mt-1 max-h-56 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-xl divide-y divide-slate-100">
                    {matchedCitizens.length === 0 ? (
                      <div className="p-4 text-center text-slate-500 text-xs">
                        لا يوجد مراجع بهذا الاسم مطابِق في النظام.
                      </div>
                    ) : (
                      matchedCitizens.map(cit => (
                        <div
                          key={cit.Citizen_ID}
                          onClick={() => handleSelectCitizenFromSearch(cit)}
                          className="p-3 hover:bg-amber-50/70 transition-colors cursor-pointer flex items-center justify-between gap-3 text-right"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-xs">{cit.FullName}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>{cit.District}</span>
                                {cit.Surname && <span>• عشيرة: {cit.Surname}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="text-left font-mono text-[11px] text-slate-600 shrink-0">
                            <div className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                              {cit.Citizen_ID}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5" dir="ltr">{cit.Phone1}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* SMOOTH, PROFESSIONAL, BEAUTIFUL INFORMATION CARD ("بطاقة المعلومات اريدها سلسة واحترافية وجميلة وسهلة وواضحة للموضف") */}
              {selectedCitizen && (
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/80 via-white to-blue-50/50 border-2 border-amber-300 shadow-sm space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-amber-200/70">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-sm text-slate-900">{selectedCitizen.FullName}</h4>
                          <span className="font-mono font-bold text-xs text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200 shadow-2xs">
                            {selectedCitizen.Citizen_ID}
                          </span>
                          {selectedCitizen.Surname && (
                            <span className="text-[10px] font-bold bg-amber-100/80 text-amber-900 px-2 py-0.5 rounded-lg border border-amber-200">
                              عشيرة: {selectedCitizen.Surname}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 mt-0.5 block">
                          مواطن معتمد وموثق في المنظومة المركزية
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCitizenForCardModal(selectedCitizen)}
                      className="px-2.5 py-1 rounded-xl bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>عرض البطاقة الشاملة</span>
                    </button>
                  </div>

                  {/* 4 Details Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white/90 p-2 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] text-slate-400 block">رقم الهاتف</span>
                      <strong className="font-mono text-slate-900 font-bold" dir="ltr">{selectedCitizen.Phone1}</strong>
                    </div>

                    <div className="bg-white/90 p-2 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] text-slate-400 block">القضاء والسكن</span>
                      <strong className="text-slate-900">{selectedCitizen.District}</strong>
                    </div>

                    <div className="bg-white/90 p-2 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] text-slate-400 block">المهنة</span>
                      <strong className="text-slate-900">{selectedCitizen.Job || 'كاسب'}</strong>
                    </div>

                    <div className="bg-white/90 p-2 rounded-xl border border-slate-200/80">
                      <span className="text-[10px] text-slate-400 block">طريقة الحضور</span>
                      <strong className="text-purple-700 font-bold">{selectedCitizen.AttendanceType || 'شخصياً'}</strong>
                    </div>
                  </div>

                  {/* Proxy Info Bar if attendance is via another person */}
                  {selectedCitizen.AttendanceType === 'بيد شخص آخر (معتمد)' && selectedCitizen.ProxyName && (
                    <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200 text-xs text-purple-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Share2 className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        <span>جلب المعاملة بيد المعتمد: <strong>{selectedCitizen.ProxyName}</strong> ({selectedCitizen.ProxyRelation || 'معتمد'})</span>
                      </div>
                      <div className="font-mono text-[11px] text-purple-800" dir="ltr">
                        📞 {selectedCitizen.ProxyPhone} {selectedCitizen.ProxyAddress ? `| 📍 ${selectedCitizen.ProxyAddress}` : ''}
                      </div>
                    </div>
                  )}

                  {/* Sync Counters: Requests & Prior Interviews */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-white/90 p-2 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">إجمالي الطلبات في النظام:</span>
                      <strong className="font-bold text-blue-700">
                        {requests.filter(r => r.Citizen_ID === selectedCitizen.Citizen_ID).length} طلبات
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">المقابلات السابقة مع النائب:</span>
                      <strong className="font-bold text-teal-700">
                        {interviews.filter(i => i.Citizen_ID === selectedCitizen.Citizen_ID).length} مقابلات
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Interview Form Details */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">موضوع وقضية المقابلة مع النائب *</label>
                  <textarea
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    rows={2}
                    placeholder="شرح موجز لموضوع الطلب أو الشكوى المعروضة أمام النائب..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">تاريخ المقابلة *</label>
                    <input
                      type="date"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">التوقيت المحدد</label>
                    <input
                      type="text"
                      value={interviewTime}
                      onChange={(e) => setInterviewTime(e.target.value)}
                      placeholder="10:30 صباحاً"
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">درجة الأهمية</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right text-amber-800"
                    >
                      <option value="عادي">عادي</option>
                      <option value="عاجل">عاجل</option>
                      <option value="خاص جداً">خاص جداً</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">توجيه وقرار النائب المبدئي</label>
                    <select
                      value={deputyNotes}
                      onChange={(e) => setDeputyNotes(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-amber-50/60 border border-amber-300 text-amber-950 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    >
                      <option value="إحالة للإدارة">إحالة للإدارة ومفاتحة الدائرة المعنية</option>
                      <option value="هامش مباشر">هامش مباشر وتأييد</option>
                      <option value="متابعة شخصية">متابعة شخصية من قبل النائب</option>
                      <option value="توجيه للمكنة">توجيه للمكنة للطباعة والتوثيق</option>
                      <option value="غير مستوفي للشروط">غير مستوفي للشروط والتعليمات</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">موقف المقابلة</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    >
                      <option value="مجدولة">مجدولة (بانتظار الموعد)</option>
                      <option value="تمت المقابلة">تمت المقابلة</option>
                      <option value="تمت الإحالة">تمت الإحالة للإدارة</option>
                      <option value="مؤجلة">مؤجلة</option>
                      <option value="ملغاة">ملغاة</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    resetAddForm();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <Handshake className="w-4 h-4" />
                  <span>تثبيت وجدولة المقابلة</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 2: EDIT INTERVIEW WITH COMPLETE REGISTRATION FIELDS IDENTICAL TO NEW REGISTRATION ---------------- */}
      {/* "والتعديل يضهر جميع المعلومات نفس ما تسجيل جديد" */}
      {editingInterview && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 md:p-6 space-y-4 max-h-[94vh] overflow-y-auto text-right my-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    تعديل بيانات المراجع والمقابلة ({editingInterview.Interview_ID})
                  </h3>
                  <p className="text-xs text-slate-500">
                    عرض وتعديل كافة البيانات الأساسية للمواطن نفس شاشة التسجيل الجديد مع بيانات المقابلة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingInterview(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditInterview} className="space-y-4 text-xs">
              
              {/* 1. SEPARATED NAME PARTS IDENTICAL TO REGISTRATION */}
              <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-1 border-b border-slate-200">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>1. الاسم بالتقسيم الرباعي واللقب (نفس التسجيل الجديد):</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">الاسم الأول *</label>
                    <input
                      type="text"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:ring-2 focus:ring-amber-500 outline-none text-right"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">اسم الأب *</label>
                    <input
                      type="text"
                      value={editFatherName}
                      onChange={(e) => setEditFatherName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:ring-2 focus:ring-amber-500 outline-none text-right"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">اسم الجد</label>
                    <input
                      type="text"
                      value={editGrandFatherName}
                      onChange={(e) => setEditGrandFatherName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">الاسم الرابع</label>
                    <input
                      type="text"
                      value={editGreatGrandFatherName}
                      onChange={(e) => setEditGreatGrandFatherName(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    />
                  </div>
                </div>

                {/* Clan / Surname Searchable Dropdown */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اللقب / العشيرة (قائمة منسدلة)</label>
                  <SearchableSelect
                    options={allClansList}
                    value={editSurname}
                    onChange={(val) => setEditSurname(val)}
                    placeholder="اختر العشيرة أو اللقب..."
                    className="w-full"
                    allowCustom={true}
                  />
                </div>
              </div>

              {/* 2. CONTACT AND LOCATION IDENTICAL TO REGISTRATION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رقم الهاتف الأساسي *</label>
                  <input
                    type="tel"
                    value={editPhone1}
                    onChange={(e) => setEditPhone1(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رقم هاتف بديل (اختياري)</label>
                  <input
                    type="tel"
                    value={editPhone2}
                    onChange={(e) => setEditPhone2(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">القضاء / السكن *</label>
                  <select
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                  >
                    {DHI_QAR_DISTRICTS.map((d, i) => (
                      <option key={i} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">المهنة</label>
                  <input
                    type="text"
                    value={editJob}
                    onChange={(e) => setEditJob(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">التحصيل الدراسي</label>
                  <select
                    value={editEducation}
                    onChange={(e) => setEditEducation(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                  >
                    <option value="بكالوريوس">بكالوريوس</option>
                    <option value="دبلوم">دبلوم</option>
                    <option value="إعدادية فما دون">إعدادية فما دون</option>
                    <option value="ماجستير / دكتوراه">ماجستير / دكتوراه</option>
                  </select>
                </div>
              </div>

              {/* 3. ATTENDANCE & PROXY DELIVERY METHOD */}
              <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-3">
                <div className="font-bold text-purple-950 text-xs flex items-center gap-1.5 pb-1 border-b border-purple-200">
                  <Share2 className="w-4 h-4 text-purple-700" />
                  <span>طريقة حضور المراجع والمقابلة:</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    editAttendanceType === 'شخصياً'
                      ? 'bg-white border-blue-400 text-blue-950 font-bold shadow-2xs'
                      : 'bg-white/60 border-slate-200 text-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="editAttendanceType"
                      checked={editAttendanceType === 'شخصياً'}
                      onChange={() => setEditAttendanceType('شخصياً')}
                      className="w-4 h-4 text-blue-600 cursor-pointer"
                    />
                    <span>المراجع حضر شخصياً</span>
                  </label>

                  <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                    editAttendanceType === 'بيد شخص آخر (معتمد)'
                      ? 'bg-white border-purple-400 text-purple-950 font-bold shadow-2xs'
                      : 'bg-white/60 border-slate-200 text-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="editAttendanceType"
                      checked={editAttendanceType === 'بيد شخص آخر (معتمد)'}
                      onChange={() => setEditAttendanceType('بيد شخص آخر (معتمد)')}
                      className="w-4 h-4 text-purple-600 cursor-pointer"
                    />
                    <span>بيد شخص آخر (معتمد / وكيل)</span>
                  </label>
                </div>

                {editAttendanceType === 'بيد شخص آخر (معتمد)' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-purple-950 mb-0.5">اسم حامل الطلب</label>
                      <input
                        type="text"
                        value={editProxyName}
                        onChange={(e) => setEditProxyName(e.target.value)}
                        placeholder="اسم الشخص حامل الطلب"
                        className="w-full h-9 px-3 rounded-lg bg-white border border-purple-300 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500 text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-purple-950 mb-0.5">هاتف حامل الطلب</label>
                      <input
                        type="tel"
                        value={editProxyPhone}
                        onChange={(e) => setEditProxyPhone(e.target.value)}
                        placeholder="078XXXXXXXX"
                        className="w-full h-9 px-3 rounded-lg bg-white border border-purple-300 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-purple-500 text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-purple-950 mb-0.5">عنوان السكن والصلة</label>
                      <input
                        type="text"
                        value={editProxyAddress}
                        onChange={(e) => setEditProxyAddress(e.target.value)}
                        placeholder="السكن أو صلة القرابة..."
                        className="w-full h-9 px-3 rounded-lg bg-white border border-purple-300 text-xs outline-none focus:ring-2 focus:ring-purple-500 text-right"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 4. INTERVIEW DETAILS */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">موضوع وقضية المقابلة *</label>
                  <textarea
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">تاريخ المقابلة *</label>
                    <input
                      type="date"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">التوقيت</label>
                    <input
                      type="text"
                      value={interviewTime}
                      onChange={(e) => setInterviewTime(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">درجة الأهمية</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right text-amber-800"
                    >
                      <option value="عادي">عادي</option>
                      <option value="عاجل">عاجل</option>
                      <option value="خاص جداً">خاص جداً</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">توجيه وقرار النائب</label>
                    <select
                      value={deputyNotes}
                      onChange={(e) => setDeputyNotes(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-amber-50/60 border border-amber-300 text-amber-950 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    >
                      <option value="إحالة للإدارة">إحالة للإدارة ومفاتحة الدائرة المعنية</option>
                      <option value="هامش مباشر">هامش مباشر وتأييد</option>
                      <option value="متابعة شخصية">متابعة شخصية من قبل النائب</option>
                      <option value="توجيه للمكنة">توجيه للمكنة للطباعة والتوثيق</option>
                      <option value="غير مستوفي للشروط">غير مستوفي للشروط والتعليمات</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">موقف المقابلة</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                    >
                      <option value="مجدولة">مجدولة (بانتظار الموعد)</option>
                      <option value="تمت المقابلة">تمت المقابلة</option>
                      <option value="تمت الإحالة">تمت الإحالة للإدارة</option>
                      <option value="مؤجلة">مؤجلة</option>
                      <option value="ملغاة">ملغاة</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">النتيجة والملاحظات الختامية (اختياري)</label>
                  <input
                    type="text"
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    placeholder="توثيق نتيجة المقابلة أو الإجراء المتخذ..."
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none text-right"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingInterview(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ ومزامنة كافة التعديلات</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Unified Master Citizen Card Modal */}
      {selectedCitizenForCardModal && (
        <UnifiedCitizenCardModal
          citizen={selectedCitizenForCardModal}
          onClose={() => setSelectedCitizenForCardModal(null)}
        />
      )}

    </div>
  );
};
