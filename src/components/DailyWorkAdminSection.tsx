import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Citizen, OfficeRequest, ProcessingStatus } from '../types';
import {
  Briefcase,
  Search,
  CheckCircle2,
  Edit,
  Trash2,
  ShieldAlert,
  XCircle,
  FileText,
  Phone,
  MapPin,
  Clock,
  Printer,
  Calendar,
  Building,
  User,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Send,
  AlertTriangle,
  Check,
  CheckCheck,
  Share2,
  Copy,
  Plus
} from 'lucide-react';

interface DailyWorkAdminSectionProps {
  onOpenScanner?: (citizenId: string) => void;
  onOpenSmartArchive?: () => void;
}

export const DailyWorkAdminSection: React.FC<DailyWorkAdminSectionProps> = ({
  onOpenScanner,
  onOpenSmartArchive
}) => {
  const {
    citizens,
    requests,
    updateCitizen,
    deleteCitizen,
    addRequest,
    updateRequest,
    deleteRequest,
    blockCitizen,
    currentUser,
    systemSettings,
    setSelectedCitizenForHistory,
    setPrintableBadgeCitizen
  } = useApp();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'special' | 'general' | 'rejected' | 'completed'>('all');
  const [districtFilter, setDistrictFilter] = useState('all');

  // Modals state
  const [completingTarget, setCompletingTarget] = useState<{ citizen: Citizen; request?: OfficeRequest } | null>(null);
  const [editingTarget, setEditingTarget] = useState<{ citizen: Citizen; request?: OfficeRequest } | null>(null);
  const [blockingTarget, setBlockingTarget] = useState<Citizen | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [deletingTarget, setDeletingTarget] = useState<{ citizen: Citizen; request?: OfficeRequest } | null>(null);
  const [rejectingTarget, setRejectingTarget] = useState<{ citizen: Citizen; request: OfficeRequest } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Official Card state after save
  const [savedOfficialCard, setSavedOfficialCard] = useState<{
    outgoingNumber: string;
    outgoingDate: string;
    citizenName: string;
    phone: string;
    entity: string;
    subject: string;
    address: string;
    education: string;
    job: string;
    referrer: string;
    status: string;
    requestId: string;
    notes?: string;
  } | null>(null);

  // Form fields for "إكمال الطلب"
  const [formApplicantName, setFormApplicantName] = useState('');
  const [formEntity, setFormEntity] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formOutgoingNumber, setFormOutgoingNumber] = useState('');
  const [formOutgoingDate, setFormOutgoingDate] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formReferrer, setFormReferrer] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formRequestStatus, setFormRequestStatus] = useState<ProcessingStatus>('منجز');
  const [formEducation, setFormEducation] = useState('');
  const [formJob, setFormJob] = useState('');
  const [formOtherNotes, setFormOtherNotes] = useState('');

  // Generate auto sequential outgoing number
  const generateOutgoingNumber = () => {
    const year = new Date().getFullYear();
    const existingOutgoings = requests
      .map(r => r.OutgoingNumber)
      .filter((n): n is string => Boolean(n));
    let nextNum = existingOutgoings.length + 101;
    for (const outg of existingOutgoings) {
      const match = String(outg).match(/(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val >= nextNum) nextNum = val + 1;
      }
    }
    return `ص/${year}/${nextNum}`;
  };

  // Open "إكمال الطلب"
  const handleOpenCompleteRequest = (citizen: Citizen, req?: OfficeRequest) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const initialOutgoing = req?.OutgoingNumber || generateOutgoingNumber();

    setCompletingTarget({ citizen, request: req });
    setFormApplicantName(citizen.FullName || req?.CitizenName || '');
    setFormEntity(req?.Entity || 'مجلس الوزراء / الدوائر ذات العلاقة');
    setFormSubject(req?.Details || '');
    setFormOutgoingNumber(initialOutgoing);
    setFormOutgoingDate(req?.OutgoingDate || todayStr);
    setFormPhone(citizen.Phone1 || req?.CitizenPhone || '');
    setFormReferrer(citizen.ReferralSource || req?.ReferralSource || 'مباشر - قسم الاستعلامات');
    setFormAddress(citizen.District ? `${citizen.District} ${citizen.SubDistrict || ''}`.trim() : (req?.Address || 'بغداد'));
    setFormRequestStatus((req?.ProcessingStatus as ProcessingStatus) || 'منجز');
    setFormEducation(citizen.Education || req?.Education || 'إعدادية');
    setFormJob(citizen.Job || req?.Job || 'كاسب');
    setFormOtherNotes(req?.OtherNotes || req?.DeputyNotes || req?.ReceptionNotes || '');
  };

  // Save "إكمال الطلب"
  const handleSaveCompletedRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTarget) return;

    const { citizen, request } = completingTarget;
    if (citizen.IsBlocked) {
      alert(`⛔ تنبيه فوري: لا يمكن إتمام العملية!\n\nالمواطن (${citizen.FullName}) مدرج في «القائمة السوداء» (الأشخاص المحظورين).\nسبب الحظر: ${citizen.BlockReason || 'غير محدد'}\nتاريخ الحظر: ${citizen.BlockedAt || 'سابقاً'}\nبواسطة: ${citizen.BlockedBy || 'الإدارة'}\n\nيمنع النظام استكمال المعاملة أو إصدار كتاب صادر رسمي لهذا الشخص قبل إلغاء الحظر من قسم الإدارة.`);
      return;
    }
    const finalOutgoingNumber = formOutgoingNumber.trim() || generateOutgoingNumber();
    const finalOutgoingDate = formOutgoingDate.trim() || new Date().toISOString().split('T')[0];

    // 1. Update citizen record
    const updatedCitizen: Citizen = {
      ...citizen,
      FullName: formApplicantName.trim() || citizen.FullName,
      Phone1: formPhone.trim() || citizen.Phone1,
      District: formAddress.trim() || citizen.District,
      Education: formEducation.trim() || citizen.Education,
      Job: formJob.trim() || citizen.Job,
      ReferralSource: formReferrer.trim() || citizen.ReferralSource,
      UpdatedAt: new Date().toISOString()
    };
    updateCitizen(updatedCitizen);

    let savedReqId = '';

    // 2. Update existing request or create new one
    if (request) {
      savedReqId = request.Request_ID;
      updateRequest({
        ...request,
        CitizenName: formApplicantName.trim(),
        CitizenPhone: formPhone.trim(),
        Entity: formEntity.trim(),
        Details: formSubject.trim(),
        OutgoingNumber: finalOutgoingNumber,
        OutgoingDate: finalOutgoingDate,
        ProcessingStatus: formRequestStatus,
        Education: formEducation.trim(),
        Job: formJob.trim(),
        ReferralSource: formReferrer.trim(),
        Address: formAddress.trim(),
        OtherNotes: formOtherNotes.trim(),
        ExecutiveAction: `تم إكمال وتدقيق المعاملة وتثبيت العدد الصادر (${finalOutgoingNumber}) بتاريخ (${finalOutgoingDate}) بواسطة ${currentUser?.FullName || 'موظف الإدارة'}`
      });
    } else {
      const newReq = addRequest({
        Citizen_ID: citizen.Citizen_ID,
        CitizenName: formApplicantName.trim(),
        CitizenPhone: formPhone.trim(),
        Entity: formEntity.trim(),
        Details: formSubject.trim() || 'طلب مراجعة ومتابعة رسمية مكتمل',
        OutgoingNumber: finalOutgoingNumber,
        OutgoingDate: finalOutgoingDate,
        RequestStatus: 'مستلم',
        ProcessingStatus: formRequestStatus,
        Priority: 'عام',
        RegisteredVia: 'إدارة',
        Education: formEducation.trim(),
        Job: formJob.trim(),
        ReferralSource: formReferrer.trim(),
        Address: formAddress.trim(),
        OtherNotes: formOtherNotes.trim(),
        CreatedBy: currentUser?.FullName || 'قسم الإدارة'
      });
      savedReqId = newReq.Request_ID;
    }

    // 3. Show Official Outgoing Certificate / Confirmation Card
    setSavedOfficialCard({
      outgoingNumber: finalOutgoingNumber,
      outgoingDate: finalOutgoingDate,
      citizenName: formApplicantName.trim(),
      phone: formPhone.trim(),
      entity: formEntity.trim(),
      subject: formSubject.trim(),
      address: formAddress.trim(),
      education: formEducation.trim(),
      job: formJob.trim(),
      referrer: formReferrer.trim(),
      status: formRequestStatus,
      requestId: savedReqId,
      notes: formOtherNotes.trim()
    });

    setCompletingTarget(null);
  };

  // Handle Blacklist / Block
  const handleConfirmBlock = () => {
    if (!blockingTarget) return;
    if (!blockReasonInput.trim()) {
      alert('يرجى كتابة سبب الحظر الإداري أو الأمني.');
      return;
    }
    blockCitizen(blockingTarget.Citizen_ID, blockReasonInput.trim(), currentUser?.FullName || 'موظف الإدارة');
    setBlockingTarget(null);
    setBlockReasonInput('');
  };

  // Handle Direct Rejection
  const handleConfirmRejection = () => {
    if (!rejectingTarget) return;
    const { request } = rejectingTarget;
    updateRequest({
      ...request,
      DirectorDecision: 'رفض',
      RejectionReason: rejectionReasonInput.trim() || 'تم الرفض لعدم استيفاء الشروط القانونية',
      DirectorDecisionDate: new Date().toLocaleDateString('ar-IQ'),
      DirectorDecisionBy: currentUser?.FullName || 'مدير الإدارة',
      ProcessingStatus: 'مرفوض'
    });
    setRejectingTarget(null);
    setRejectionReasonInput('');
  };

  // Handle Deletion
  const handleConfirmDelete = () => {
    if (!deletingTarget) return;
    const { citizen, request } = deletingTarget;
    if (request) {
      deleteRequest(request.Request_ID);
    } else {
      deleteCitizen(citizen.Citizen_ID);
    }
    setDeletingTarget(null);
  };

  // Edit citizen & request inline
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editJob, setEditJob] = useState('');
  const [editEducation, setEditEducation] = useState('');
  const [editEntity, setEditEntity] = useState('');
  const [editDetails, setEditDetails] = useState('');

  const handleOpenEdit = (citizen: Citizen, req?: OfficeRequest) => {
    setEditingTarget({ citizen, request: req });
    setEditFullName(citizen.FullName || '');
    setEditPhone(citizen.Phone1 || '');
    setEditDistrict(citizen.District || '');
    setEditJob(citizen.Job || '');
    setEditEducation(citizen.Education || '');
    setEditEntity(req?.Entity || '');
    setEditDetails(req?.Details || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget) return;
    const { citizen, request } = editingTarget;

    updateCitizen({
      ...citizen,
      FullName: editFullName.trim(),
      Phone1: editPhone.trim(),
      District: editDistrict.trim(),
      Job: editJob.trim(),
      Education: editEducation.trim()
    });

    if (request) {
      updateRequest({
        ...request,
        CitizenName: editFullName.trim(),
        CitizenPhone: editPhone.trim(),
        Entity: editEntity.trim(),
        Details: editDetails.trim()
      });
    }

    setEditingTarget(null);
  };

  // Map requests by Citizen_ID
  const citizenMap = useMemo(() => {
    const map = new Map<string, Citizen>();
    citizens.forEach(c => map.set(c.Citizen_ID, c));
    return map;
  }, [citizens]);

  // Aggregate daily records: Citizens with their requests
  const dailyRecords = useMemo(() => {
    return citizens.map(cit => {
      const citRequests = requests.filter(r => r.Citizen_ID === cit.Citizen_ID);
      // Determine overall director state
      const hasRejection = citRequests.some(r => r.DirectorDecision === 'رفض' || r.ProcessingStatus === 'مرفوض');
      const hasSpecial = citRequests.some(r => r.DirectorDecision === 'خاص');
      const hasGeneral = citRequests.some(r => r.DirectorDecision === 'عام');
      const hasPending = citRequests.some(r => !r.DirectorDecision && r.ProcessingStatus !== 'منجز');
      const hasCompleted = citRequests.some(r => r.ProcessingStatus === 'منجز' || Boolean(r.OutgoingNumber));

      return {
        citizen: cit,
        requests: citRequests,
        hasRejection,
        hasSpecial,
        hasGeneral,
        hasPending,
        hasCompleted
      };
    });
  }, [citizens, requests]);

  // Filter daily records
  const filteredDailyRecords = useMemo(() => {
    return dailyRecords.filter(item => {
      const cit = item.citizen;
      const q = searchTerm.toLowerCase().trim();

      const matchesSearch = !q || (
        (cit.FullName && cit.FullName.toLowerCase().includes(q)) ||
        (cit.Citizen_ID && cit.Citizen_ID.toLowerCase().includes(q)) ||
        (cit.Phone1 && cit.Phone1.includes(q)) ||
        (cit.District && cit.District.toLowerCase().includes(q)) ||
        (cit.Surname && cit.Surname.toLowerCase().includes(q)) ||
        item.requests.some(r => 
          r.Details.toLowerCase().includes(q) ||
          r.Entity.toLowerCase().includes(q) ||
          (r.OutgoingNumber && r.OutgoingNumber.toLowerCase().includes(q))
        )
      );

      let matchesStatus = true;
      if (statusFilter === 'rejected') matchesStatus = item.hasRejection;
      else if (statusFilter === 'special') matchesStatus = item.hasSpecial;
      else if (statusFilter === 'general') matchesStatus = item.hasGeneral;
      else if (statusFilter === 'pending') matchesStatus = item.hasPending;
      else if (statusFilter === 'completed') matchesStatus = item.hasCompleted;

      let matchesDistrict = true;
      if (districtFilter !== 'all') matchesDistrict = cit.District === districtFilter;

      return matchesSearch && matchesStatus && matchesDistrict;
    });
  }, [dailyRecords, searchTerm, statusFilter, districtFilter]);

  // Districts list for filter dropdown
  const allDistricts = useMemo(() => {
    const set = new Set<string>();
    citizens.forEach(c => { if (c.District) set.add(c.District); });
    return Array.from(set);
  }, [citizens]);

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Top Banner / Stats Header */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-md border border-blue-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                <Briefcase className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-black tracking-tight">سجل العمل اليومي - متابعة وتدقيق معاملات الإدارة</h2>
                <p className="text-xs text-blue-200/80">
                  معالجة طلبات المراجعين المحالة من الاستعلامات والمدير، استكمال البيانات، إصدار أرقام الصادر، والحظر المباشر
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 font-bold">
              إجمالي المراجعين اليومي: {filteredDailyRecords.length}
            </span>
            <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-xl border border-amber-400/30 font-bold">
              بانتظار المدير: {dailyRecords.filter(r => r.hasPending).length}
            </span>
            <span className="text-xs bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-xl border border-purple-400/30 font-bold">
              مسار خاص: {dailyRecords.filter(r => r.hasSpecial).length}
            </span>
            <span className="text-xs bg-rose-500/20 text-rose-300 px-3 py-1.5 rounded-xl border border-rose-400/30 font-bold">
              مرفوض: {dailyRecords.filter(r => r.hasRejection).length}
            </span>
          </div>
        </div>

        {/* Filter Badges Bar */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-blue-300 font-bold text-[11px] ml-1">تصفية حسب توجيه المدير:</span>
          
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-blue-950 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            الكل ({dailyRecords.length})
          </button>

          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'pending'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 border border-amber-400/30'
            }`}
          >
            <span>🟠 بانتظار المدير</span>
          </button>

          <button
            onClick={() => setStatusFilter('special')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'special'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 border border-purple-400/30'
            }`}
          >
            <span>🟣 مسار خاص</span>
          </button>

          <button
            onClick={() => setStatusFilter('general')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'general'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 border border-emerald-400/30'
            }`}
          >
            <span>🟢 مسار عام</span>
          </button>

          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'rejected'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 border border-rose-400/30'
            }`}
          >
            <span>🔴 مرفوض</span>
          </button>

          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'completed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 border border-blue-400/30'
            }`}
          >
            <span>🔵 مكتمل برقم صادر</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم، رقم الهوية ID، الهاتف، القضاء، رقم الصادر، أو تفاصيل الطلب..."
            className="w-full h-9 pr-9 pl-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
          />
        </div>

        {allDistricts.length > 0 && (
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">كافة الأقضية والمناطق</option>
            {allDistricts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
      </div>

      {/* Official Success Notification Card (ظهر رقم الصادر وتاريخ الكتاب بشكل رسمي وجميل) */}
      {savedOfficialCard && (
        <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-50 via-white to-amber-50/40 border-2 border-amber-400 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 dark:border-amber-500/60 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
          {/* Card Header with Iraqi Crest & Parliament Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-amber-300 dark:border-amber-500/40 pb-4 text-center sm:text-right gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl shadow-inner">
                🦅
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  جمهورية العراق - مجلس النواب
                </h3>
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400">
                  {systemSettings.officeName || 'مكتب النائب علاء الحيدري'} - قسم الإدارة والمتابعة
                </p>
              </div>
            </div>

            <div className="bg-amber-100 dark:bg-amber-950/80 px-4 py-2 rounded-xl border border-amber-400 dark:border-amber-600/60 text-center">
              <span className="block text-[10px] font-bold text-amber-900 dark:text-amber-300">العدد الصادر الرسمي</span>
              <span className="text-base font-black font-mono text-amber-950 dark:text-amber-100 tracking-wider">
                {savedOfficialCard.outgoingNumber}
              </span>
              <span className="block text-[10px] font-mono text-amber-800 dark:text-amber-400">
                التاريخ: {savedOfficialCard.outgoingDate}
              </span>
            </div>
          </div>

          {/* Details Body */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white/80 dark:bg-slate-800/80 p-4 rounded-xl border border-amber-200 dark:border-amber-500/20 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5 font-bold">اسم صاحب الطلب:</span>
              <span className="font-black text-slate-900 dark:text-white text-sm">{savedOfficialCard.citizenName}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5 font-bold">الجهة الموجه إليها الكتاب:</span>
              <span className="font-bold text-blue-700 dark:text-blue-400">{savedOfficialCard.entity}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5 font-bold">رقم الهاتف والتواصل:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">{savedOfficialCard.phone}</span>
            </div>
            <div className="md:col-span-2">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5 font-bold">موضوع المعاملة:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{savedOfficialCard.subject}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5 font-bold">عنوان السكن:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{savedOfficialCard.address}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5 font-bold">المعرف والتزكية:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{savedOfficialCard.referrer}</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5 font-bold">حالة الطلب:</span>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                {savedOfficialCard.status}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] mb-0.5 font-bold">كود المتابعة بالنظام:</span>
              <span className="font-mono font-bold text-slate-600 dark:text-slate-400">{savedOfficialCard.requestId}</span>
            </div>
          </div>

          {/* Official Stamp & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>تم توثيق وتثبيت كتاب الصادر وحفظ البيانات في السجل الرسمي بنجاح</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>طباعة وصل الصادر الرسمي</span>
              </button>

              <button
                onClick={() => setSavedOfficialCard(null)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md transition-transform active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>إكمال طلب آخر ⏎</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Citizens Cards Grid */}
      <div className="space-y-3">
        {filteredDailyRecords.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2 shadow-xs">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">لا توجد سجلات مطابقة للبحث أو التصفية</h4>
            <p className="text-xs text-slate-400">يرجى تغيير معايير البحث أو استعراض كافة السجلات.</p>
          </div>
        ) : (
          filteredDailyRecords.map((item) => {
            const cit = item.citizen;
            const citReqs = item.requests;
            const primaryReq = citReqs[0];

            // Color status styles based on director decision
            const isBlocked = cit.IsBlocked;
            const isRej = item.hasRejection;
            const isSpec = item.hasSpecial;
            const isGen = item.hasGeneral;
            const isPend = item.hasPending || (!isRej && !isSpec && !isGen && !item.hasCompleted);

            let cardBorder = 'border-slate-200 dark:border-slate-800';
            let cardBg = 'bg-white dark:bg-slate-900';

            if (isBlocked) {
              cardBorder = 'border-red-500 dark:border-red-600 ring-2 ring-red-400/30';
              cardBg = 'bg-red-50/50 dark:bg-red-950/20';
            } else if (isRej) {
              cardBorder = 'border-rose-400 dark:border-rose-700';
              cardBg = 'bg-rose-50/40 dark:bg-rose-950/20';
            } else if (isSpec) {
              cardBorder = 'border-purple-400 dark:border-purple-700';
              cardBg = 'bg-purple-50/40 dark:bg-purple-950/20';
            } else if (isGen) {
              cardBorder = 'border-emerald-400 dark:border-emerald-700';
              cardBg = 'bg-emerald-50/40 dark:bg-emerald-950/20';
            } else if (isPend) {
              cardBorder = 'border-amber-300 dark:border-amber-700';
              cardBg = 'bg-amber-50/30 dark:bg-amber-950/15';
            }

            return (
              <div
                key={cit.Citizen_ID}
                className={`p-4 rounded-2xl border ${cardBorder} ${cardBg} shadow-xs space-y-3 transition-all hover:shadow-md`}
              >
                {/* Header: Citizen ID, Full Name, Stage & Director Decision Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                      {cit.Citizen_ID}
                    </span>

                    <h3 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                      {cit.FullName}
                      {cit.Surname && (
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">({cit.Surname})</span>
                      )}
                    </h3>

                    {/* Blacklist Status if blocked */}
                    {isBlocked && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white flex items-center gap-1 animate-pulse">
                        <ShieldAlert className="w-3 h-3" />
                        <span>محظور بالقائمة السوداء ({cit.BlockReason})</span>
                      </span>
                    )}

                    {/* Director Decision Badge */}
                    {!isBlocked && isRej && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-2xs">
                        🔴 مرفوض من المدير
                      </span>
                    )}
                    {!isBlocked && isSpec && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-2xs">
                        🟣 مسار خاص
                      </span>
                    )}
                    {!isBlocked && isGen && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs">
                        🟢 مسار عام
                      </span>
                    )}
                    {!isBlocked && isPend && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 shadow-2xs animate-pulse">
                        🟠 بانتظار توجيه المدير
                      </span>
                    )}

                    {/* Outgoing Badge if completed */}
                    {primaryReq?.OutgoingNumber && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-700 font-mono">
                        صادر: {primaryReq.OutgoingNumber} ({primaryReq.OutgoingDate})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{cit.CreatedAt}</span>
                    </span>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-semibold text-slate-600 dark:text-slate-300">
                      بواسطة: {cit.CreatedBy || 'الاستعلامات'}
                    </span>
                  </div>
                </div>

                {/* Director Notes if available */}
                {primaryReq?.DirectorNotes && (
                  <div className="p-2.5 rounded-xl bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 text-xs font-bold flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-1.5">
                      <span>📝 توجيه وملاحظات مدير المكتب:</span>
                      <span className="font-normal">{primaryReq.DirectorNotes}</span>
                    </span>
                    {primaryReq.DirectorDecisionDate && (
                      <span className="text-[10px] font-mono text-amber-800 dark:text-amber-300">
                        بتاريخ: {primaryReq.DirectorDecisionDate}
                      </span>
                    )}
                  </div>
                )}

                {/* Details Grid: Phone, District, Job, Referral, Request details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50/70 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px] mb-0.5">رقم الهاتف:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1" dir="ltr">
                      <Phone className="w-3 h-3 text-emerald-600 inline shrink-0" />
                      {cit.Phone1 || 'غير مسجل'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px] mb-0.5">عنوان السكن:</span>
                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-blue-600 inline shrink-0" />
                      {cit.District} {cit.SubDistrict ? `(${cit.SubDistrict})` : ''}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px] mb-0.5">المهنة والتحصيل:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {cit.Job || 'كاسب'} - {cit.Education || 'إعدادية'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 dark:text-slate-500 block text-[10px] mb-0.5">المعرّف والتزكية:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {cit.ReferralSource || 'مباشر - الاستعلامات'}
                    </span>
                  </div>

                  {/* Primary Request Details if present */}
                  {primaryReq && (
                    <div className="col-span-2 sm:col-span-4 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900 dark:text-white text-xs">
                          الجهة المطلوبة: [{primaryReq.Entity}]
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          - {primaryReq.Details}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        الحالة: {primaryReq.ProcessingStatus}
                      </span>
                    </div>
                  )}
                </div>

                {/* Requested Action Buttons on the Card:
                    1. إكمال الطلب
                    2. التعديل
                    3. الحذف
                    4. الحظر أو الرفض
                */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-wrap">
                  {/* Complete Request Button (Button 1) */}
                  <button
                    onClick={() => handleOpenCompleteRequest(cit, primaryReq)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-95"
                    title="استكمال بيانات المعاملة وتوثيق رقم الصادر الرسمي"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>إكمال الطلب</span>
                  </button>

                  {/* Edit Button (Button 2) */}
                  <button
                    onClick={() => handleOpenEdit(cit, primaryReq)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="تعديل بيانات المراجع والمعاملة"
                  >
                    <Edit className="w-3.5 h-3.5 text-blue-600" />
                    <span>تعديل</span>
                  </button>

                  {/* Delete Button (Button 3) */}
                  <button
                    onClick={() => setDeletingTarget({ citizen: cit, request: primaryReq })}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-rose-200 dark:border-rose-800"
                    title="حذف هذا السجل"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>حذف</span>
                  </button>

                  {/* Block / Reject Button (Button 4) */}
                  <button
                    onClick={() => {
                      setBlockingTarget(cit);
                      setBlockReasonInput('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="حظر هذا الشخص وإدراجه بالقائمة السوداء مع كتابة السبب"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-red-200" />
                    <span>حظر (القائمة السوداء)</span>
                  </button>

                  {primaryReq && (
                    <button
                      onClick={() => {
                        setRejectingTarget({ citizen: cit, request: primaryReq });
                        setRejectionReasonInput('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-amber-300 dark:border-amber-800"
                      title="رفض الطلب مع ذكر السبب"
                    >
                      <XCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>رفض الطلب</span>
                    </button>
                  )}

                  {/* Extra Helper: Print badge or Archive */}
                  <button
                    onClick={() => setSelectedCitizenForHistory(cit)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                    title="الأرشيف والسجل الكامل"
                  >
                    <Clock className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: إكمال الطلب (Complete Request Form)             */}
      {/* ======================================================== */}
      {completingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    إكمال الطلب وتوثيق الصادر الرسمي
                  </h3>
                  <p className="text-xs text-slate-500">
                    المعلومات المضافة من الاستعلامات والمدير ثابتة وقابلة للتعديل وبقية الحقول يكملها الموظف
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCompletingTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCompletedRequest} className="space-y-4">
              {/* Blacklist Warning inside complete request modal if citizen is blocked */}
              {completingTarget.citizen.IsBlocked && (
                <div className="p-3.5 rounded-2xl bg-red-50 border-2 border-red-500 text-red-950 space-y-1 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⛔</span>
                    <h4 className="font-black text-xs text-red-900">تنبيه فوري: هذا المراجع مدرج في «القائمة السوداء» (الأشخاص المحظورين)!</h4>
                  </div>
                  <p className="text-[11px] text-red-800 font-bold">
                    سبب الحظر: {completingTarget.citizen.BlockReason || 'غير محدد'}
                    {completingTarget.citizen.BlockedAt ? ` • تاريخ الحظر: ${completingTarget.citizen.BlockedAt}` : ''}
                    {completingTarget.citizen.BlockedBy ? ` • بواسطة: ${completingTarget.citizen.BlockedBy}` : ''}
                  </p>
                  <p className="text-[10px] text-red-700 font-black">
                    🚫 يمنع النظام استكمال المعاملة أو إصدار كتاب صادر رسمي لهذا الشخص قبل إلغاء الحظر من قسم الإدارة.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* 1. اسم صاحب الطلب */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم صاحب الطلب: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formApplicantName}
                    onChange={(e) => setFormApplicantName(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 2. اسم الدائرة أو الوزارة */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم الدائرة أو الوزارة: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formEntity}
                    onChange={(e) => setFormEntity(e.target.value)}
                    placeholder="مثال: وزارة العمل والشؤون الاجتماعية..."
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 3. موضوع الطلب */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    موضوع الطلب: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    placeholder="موضوع المعاملة والتفاصيل المطلوبة من الوزارة..."
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 4. رقم الصادر أو العدد */}
                <div>
                  <label className="block font-bold text-amber-700 dark:text-amber-400 mb-1">
                    رقم الصادر أو العدد: (رسمي)
                  </label>
                  <input
                    type="text"
                    value={formOutgoingNumber}
                    onChange={(e) => setFormOutgoingNumber(e.target.value)}
                    placeholder="ص/2026/101"
                    className="w-full h-9 px-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl font-mono font-black text-amber-950 dark:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* 5. التاريخ (يومي تلقائيا وقابل للتعديل) */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تاريخ الكتاب (تلقائياً تاريخ اليوم وقابل للتعديل):
                  </label>
                  <input
                    type="date"
                    value={formOutgoingDate}
                    onChange={(e) => setFormOutgoingDate(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 6. رقم الهاتف */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم الهاتف:
                  </label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                    dir="ltr"
                  />
                </div>

                {/* 7. المعرف */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المعرف / التزكية:
                  </label>
                  <input
                    type="text"
                    value={formReferrer}
                    onChange={(e) => setFormReferrer(e.target.value)}
                    placeholder="اسم المعرف أو التزكية..."
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 8. عنوان السكن */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عنوان السكن:
                  </label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="المحافظة - القضاء - الناحية..."
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 9. حالة الطلب */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    حالة الطلب:
                  </label>
                  <select
                    value={formRequestStatus}
                    onChange={(e) => setFormRequestStatus(e.target.value as ProcessingStatus)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="منجز">منجز (مكتمل ومغلق)</option>
                    <option value="قيد الإجراء">قيد الإجراء والمتابعة</option>
                    <option value="تم الطباعة">تمت الطباعة وتثبيت الكتاب</option>
                    <option value="مرسل إلى الوزارة/الهيئة">مرسل إلى الوزارة/الهيئة</option>
                    <option value="بانتظار الموافقة">بانتظار الموافقة الوزارية</option>
                  </select>
                </div>

                {/* 10. التحصيل الدراسي */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    التحصيل الدراسي:
                  </label>
                  <input
                    type="text"
                    value={formEducation}
                    onChange={(e) => setFormEducation(e.target.value)}
                    placeholder="أمي، ابتدائية، متوسطة، إعدادية، بكالوريوس..."
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 11. نوع العمل */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نوع العمل / المهنة:
                  </label>
                  <input
                    type="text"
                    value={formJob}
                    onChange={(e) => setFormJob(e.target.value)}
                    placeholder="كاسب، موظف، متقاعد، عاطل..."
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* 12. ملاحظات أخرى */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ملاحظات أخرى:
                  </label>
                  <textarea
                    rows={2}
                    value={formOtherNotes}
                    onChange={(e) => setFormOtherNotes(e.target.value)}
                    placeholder="أي ملاحظات إضافية حول التوصيات أو مسار الكتاب..."
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCompletingTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={Boolean(completingTarget.citizen.IsBlocked)}
                  className={`px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-transform shadow-md ${
                    completingTarget.citizen.IsBlocked
                      ? 'bg-red-500 text-white cursor-not-allowed opacity-70'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white cursor-pointer active:scale-95'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>{completingTarget.citizen.IsBlocked ? '⛔ محظور بالقائمة السوداء - لا يمكن الإتمام' : 'حفظ المعاملة وإصدار كتاب الصادر الرسمي'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: نافذة الحظر (Block / Blacklist Reason)         */}
      {/* ======================================================== */}
      {blockingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-red-300 dark:border-red-800 max-w-md w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  حظر المراجع وإدراجه بالقائمة السوداء
                </h3>
                <p className="text-xs text-red-600 dark:text-red-400 font-semibold">
                  المراجع: {blockingTarget.FullName} ({blockingTarget.Citizen_ID})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              عند حظر هذا الشخص، سيقوم النظام بحفظه في القائمة السوداء، وإظهار تنبيه تحذيري لأي موظف يحاول تسجيل طلب آخر بنفس الاسم مستقبلاً مع ذكر السبب.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                سبب الحظر (مطلوب): <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                placeholder="اكتب سبب الحظر بالتفصيل (مثال: عدم صحة المستمسكات، تكرار طلبات وهمية، إساءة استخدام...)"
                className="w-full p-3 bg-red-50/50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBlockingTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>تأكيد الحظر والإدراج بالقائمة السوداء</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: نافذة رفض الطلب (Rejection Reason)              */}
      {/* ======================================================== */}
      {rejectingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-300 dark:border-amber-800 max-w-md w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400">
                <XCircle className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  رفض المعاملة وتوثيق السبب
                </h3>
                <p className="text-xs text-slate-500">
                  المراجع: {rejectingTarget.citizen.FullName} - المعاملة: {rejectingTarget.request.Request_ID}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                سبب الرفض:
              </label>
              <textarea
                rows={3}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="عدم مطابقة الشروط، خارج الصلاحيات، طلب مكرر..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRejectingTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>تثبيت الرفض</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: نافذة التعديل السريع (Inline Edit)              */}
      {/* ======================================================== */}
      {editingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                <span>تعديل بيانات المراجع والمعاملة</span>
              </h3>
              <button onClick={() => setEditingTarget(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الاسم الكامل:</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الهاتف:</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">السكن / القضاء:</label>
                  <input
                    type="text"
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              {editingTarget.request && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الجهة المعنية:</label>
                    <input
                      type="text"
                      value={editEntity}
                      onChange={(e) => setEditEntity(e.target.value)}
                      className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-blue-700 dark:text-blue-300"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">تفاصيل المعاملة:</label>
                    <textarea
                      rows={2}
                      value={editDetails}
                      onChange={(e) => setEditDetails(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: تأكيد الحذف (Delete Confirmation)              */}
      {/* ======================================================== */}
      {deletingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-800 max-w-sm w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600">
                <Trash2 className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">تأكيد الحذف</h3>
                <p className="text-xs text-slate-500">
                  هل أنت متأكد من حذف هذا السجل نهائياً؟
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setDeletingTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                تراجع
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs"
              >
                نعم، احذف نهائياً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
