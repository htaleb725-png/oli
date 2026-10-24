import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Citizen, OfficeRequest, ProcessingStatus, Priority } from '../types';
import {
  Briefcase,
  Search,
  CheckCircle2,
  Edit,
  Trash2,
  ShieldAlert,
  ShieldCheck,
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
  Plus,
  Upload,
  Image as ImageIcon,
  Eye,
  FileSpreadsheet,
  Users,
  ClipboardPaste,
  Hash,
  ListPlus
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import { DHI_QAR_DISTRICTS, IRAQI_MINISTRIES, DEFAULT_CLANS } from './ReceptionModule';
import { printSingleOutgoingReceipt, printCollectiveOutgoingReceipt } from '../utils/printReceiptHelper';

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
    addCitizen,
    updateCitizen,
    deleteCitizen,
    addRequest,
    updateRequest,
    deleteRequest,
    blockCitizen,
    unblockCitizen,
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

  // Official Card state after save (Full Executive Popup Modal)
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
    attachedImage?: string;
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
  const [formAttachedImage, setFormAttachedImage] = useState<string>('');

  // Generate auto sequential outgoing number starting from 1 if no outgoings exist, or max + 1
  const generateOutgoingNumber = () => {
    const year = new Date().getFullYear();
    const existingOutgoings = requests
      .map(r => r.OutgoingNumber)
      .filter((n): n is string => Boolean(n && n.trim()));

    if (existingOutgoings.length === 0) {
      return `ص/${year}/1`;
    }

    let maxNum = 0;
    for (const outg of existingOutgoings) {
      const matches = String(outg).match(/\d+/g);
      if (matches) {
        for (const m of matches) {
          const val = parseInt(m, 10);
          if (val >= 2020 && val <= 2040 && matches.length > 1) {
            continue;
          }
          if (val > maxNum) {
            maxNum = val;
          }
        }
      }
    }

    const nextSeq = maxNum === 0 ? 1 : maxNum + 1;
    return `ص/${year}/${nextSeq}`;
  };

  // Real-time detection of last registered citizen
  const lastRegisteredCitizen = useMemo(() => {
    if (!citizens || citizens.length === 0) return null;
    for (let i = citizens.length - 1; i >= 0; i--) {
      const c = citizens[i];
      if (c && c.FullName && c.FullName.trim()) {
        return c;
      }
    }
    return citizens[citizens.length - 1];
  }, [citizens]);

  // Real-time detection of last outgoing number and date recorded in requests
  const lastOutgoingRecord = useMemo(() => {
    const outgoings = requests
      .filter(r => r.OutgoingNumber && r.OutgoingNumber.trim())
      .map(r => {
        const matches = (r.OutgoingNumber || '').match(/\d+/g) || [];
        let seq = 0;
        if (matches.length > 0) {
          for (const m of matches) {
            const val = parseInt(m, 10);
            if (!(val >= 2020 && val <= 2040 && matches.length > 1)) {
              if (val > seq) seq = val;
            }
          }
          if (seq === 0) seq = parseInt(matches[matches.length - 1], 10);
        }
        return {
          request: r,
          seq,
          outgoingNumber: r.OutgoingNumber || '',
          outgoingDate: r.OutgoingDate || r.CreatedAt?.split('T')[0] || '',
          citizenName: r.CitizenName || citizens.find(c => c.Citizen_ID === r.Citizen_ID)?.FullName || 'غير محدد'
        };
      });

    if (outgoings.length === 0) return null;
    outgoings.sort((a, b) => b.seq - a.seq);
    return outgoings[0];
  }, [requests, citizens]);

  const nextAutoOutgoingNumber = useMemo(() => {
    return generateOutgoingNumber();
  }, [requests]);

  // Collective Outgoing (صادر موحد لمجموعة مراجعين)
  const [isBulkOutgoingModalOpen, setIsBulkOutgoingModalOpen] = useState(false);
  const [bulkOutgoingNumber, setBulkOutgoingNumber] = useState('');
  const [bulkOutgoingDate, setBulkOutgoingDate] = useState('');
  const [bulkEntity, setBulkEntity] = useState('');
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkRawPasteText, setBulkRawPasteText] = useState('');
  const [bulkRows, setBulkRows] = useState<Array<{
    id: string;
    name: string;
    phone: string;
    district: string;
    notes: string;
  }>>([
    { id: '1', name: '', phone: '', district: '', notes: '' },
    { id: '2', name: '', phone: '', district: '', notes: '' },
    { id: '3', name: '', phone: '', district: '', notes: '' }
  ]);

  const handleOpenBulkOutgoingModal = () => {
    const today = new Date().toISOString().split('T')[0];
    setBulkOutgoingNumber(generateOutgoingNumber());
    setBulkOutgoingDate(today);
    setBulkEntity('مجلس الوزراء / الدوائر ذات العلاقة');
    setBulkSubject('');
    setBulkRawPasteText('');
    setBulkRows([
      { id: '1', name: '', phone: '', district: '', notes: '' },
      { id: '2', name: '', phone: '', district: '', notes: '' },
      { id: '3', name: '', phone: '', district: '', notes: '' }
    ]);
    setIsBulkOutgoingModalOpen(true);
  };

  const handleParseBulkPaste = () => {
    if (!bulkRawPasteText.trim()) {
      alert('يرجى لصق قائمة الأسماء أو البيانات أولاً.');
      return;
    }
    const lines = bulkRawPasteText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsed = lines.map((line, idx) => {
      const parts = line.split(/[\t,|—–-]+/).map(p => p.trim());
      const name = parts[0] || '';
      let phone = '';
      let district = '';
      let notes = '';

      for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        if (!phone && /(\d{10,11})/.test(p.replace(/\s+/g, ''))) {
          phone = p.replace(/\s+/g, '');
        } else if (!district && DHI_QAR_DISTRICTS.includes(p)) {
          district = p;
        } else if (!district && /الناصرية|الشطرة|الرفاعي|سوق الشيوخ|الجبايش|الغراف|قلعة سكر|الطار|النصر|الفهود|الإصلاح|الدواية|سيد دخيل|البطحاء|أكد|المنار|العكيكة|كرمة بني سعيد|بغداد|البصرة|المثنى|ميسان|واسط|النجف|كربلاء|بابل/.test(p)) {
          district = p;
        } else if (!notes) {
          notes = p;
        } else {
          notes += ' ' + p;
        }
      }

      return {
        id: `bulk-${Date.now()}-${idx}`,
        name,
        phone,
        district: district || 'الناصرية',
        notes: notes || ''
      };
    });

    if (parsed.length > 0) {
      setBulkRows(parsed);
      alert(`✓ تم بنجاح استخراج (${parsed.length}) مراجعين وتوزيعهم في الجدول تلقائياً!`);
    }
  };

  const handleSaveBulkOutgoing = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = bulkRows.filter(r => r.name.trim().length > 0);
    if (validRows.length === 0) {
      alert('يرجى إدخال اسم واحد على الأقل في قائمة المراجعين.');
      return;
    }
    const finalOutgoingNumber = bulkOutgoingNumber.trim() || generateOutgoingNumber();
    const finalOutgoingDate = bulkOutgoingDate.trim() || new Date().toISOString().split('T')[0];
    const finalEntity = bulkEntity.trim() || 'مجلس الوزراء / الدوائر ذات العلاقة';
    const finalSubject = bulkSubject.trim() || 'كتاب صادر موحد لمجموعة مراجعين';

    const today = new Date().toISOString().split('T')[0];
    const createdCitizensList: Array<{ name: string; phone: string; district?: string; notes?: string }> = [];

    for (const row of validRows) {
      const cleanName = row.name.trim();
      const cleanPhone = row.phone.trim();
      const cleanDistrict = row.district.trim() || 'الناصرية';
      const cleanNotes = row.notes.trim();

      const existing = citizens.find(c => 
        (cleanPhone && c.Phone1 === cleanPhone) || 
        (c.FullName && c.FullName.trim().toLowerCase() === cleanName.toLowerCase())
      );

      let citizenId = existing?.Citizen_ID;

      if (!existing) {
        const created = addCitizen({
          FullName: cleanName,
          Phone1: cleanPhone || 'غير مسجل',
          District: cleanDistrict,
          SubDistrict: '',
          Gender: 'ذكر',
          Rating: 'لائق',
          ReferralSource: 'صادر موحد للإدارة',
          UpdatedAt: today,
          CreatedBy: currentUser?.FullName || 'موظف الإدارة'
        });
        citizenId = created.Citizen_ID;
      }

      addRequest({
        Citizen_ID: citizenId!,
        CitizenName: cleanName,
        CitizenPhone: cleanPhone,
        Entity: finalEntity,
        Details: `${finalSubject}${cleanNotes ? ` - [${cleanNotes}]` : ''}`,
        OutgoingNumber: finalOutgoingNumber,
        OutgoingDate: finalOutgoingDate,
        RequestStatus: 'مستلم',
        ProcessingStatus: 'منجز',
        Priority: 'عام',
        RegisteredVia: 'إدارة',
        Address: cleanDistrict,
        OtherNotes: `ضمن كتاب صادر موحد (${finalOutgoingNumber}) لمجموعة مراجعين عدد (${validRows.length})`,
        CreatedBy: currentUser?.FullName || 'قسم الإدارة'
      });

      createdCitizensList.push({
        name: cleanName,
        phone: cleanPhone,
        district: cleanDistrict,
        notes: cleanNotes
      });
    }

    printCollectiveOutgoingReceipt({
      outgoingNumber: finalOutgoingNumber,
      outgoingDate: finalOutgoingDate,
      entity: finalEntity,
      subject: finalSubject,
      citizens: createdCitizensList,
      officeName: systemSettings.officeName || systemSettings.appName,
      deputyName: systemSettings.deputyName
    });

    setIsBulkOutgoingModalOpen(false);
    alert(`✓ تم بنجاح إصدار الكتاب الصادر الموحد برقم (${finalOutgoingNumber}) وتوثيق كافة المراجعين وفتح وصل الطباعة الرسمي.`);
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
    setFormAttachedImage(req?.AttachedRequestImage || '');
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
        AttachedRequestImage: formAttachedImage || request.AttachedRequestImage,
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
        AttachedRequestImage: formAttachedImage || undefined,
        CreatedBy: currentUser?.FullName || 'قسم الإدارة'
      });
      savedReqId = newReq.Request_ID;
    }

    // 3. Show Official Outgoing Certificate / Confirmation Card as popup modal
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
      notes: formOtherNotes.trim(),
      attachedImage: formAttachedImage || undefined
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
    alert(`⛔ تم بنجاح حظر المواطن (${blockingTarget.FullName}) وإدراجه في القائمة السوداء.`);
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

  // Comprehensive Edit citizen & request state
  const [editFullName, setEditFullName] = useState('');
  const [editPhone1, setEditPhone1] = useState('');
  const [editPhone2, setEditPhone2] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editSubDistrict, setEditSubDistrict] = useState('');
  const [editSurname, setEditSurname] = useState('');
  const [editJob, setEditJob] = useState('');
  const [editEducation, setEditEducation] = useState('');
  const [editAttendanceType, setEditAttendanceType] = useState('شخصياً');
  const [editProxyName, setEditProxyName] = useState('');
  const [editProxyPhone, setEditProxyPhone] = useState('');
  const [editReferralSource, setEditReferralSource] = useState('');
  const [editEntity, setEditEntity] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editOutgoingNumber, setEditOutgoingNumber] = useState('');
  const [editOutgoingDate, setEditOutgoingDate] = useState('');
  const [editProcessingStatus, setEditProcessingStatus] = useState<ProcessingStatus>('منجز');
  const [editPriority, setEditPriority] = useState<Priority>('عام');
  const [editOtherNotes, setEditOtherNotes] = useState('');

  const handleOpenEdit = (citizen: Citizen, req?: OfficeRequest) => {
    setEditingTarget({ citizen, request: req });
    setEditFullName(citizen.FullName || '');
    setEditPhone1(citizen.Phone1 || '');
    setEditPhone2(citizen.Phone2 || '');
    setEditDistrict(citizen.District || '');
    setEditSubDistrict(citizen.SubDistrict || 'المركز');
    setEditSurname(citizen.Surname || '');
    setEditJob(citizen.Job || '');
    setEditEducation(citizen.Education || '');
    setEditAttendanceType((citizen.AttendanceType as any) || 'شخصياً');
    setEditProxyName(citizen.ProxyName || '');
    setEditProxyPhone(citizen.ProxyPhone || '');
    setEditReferralSource(citizen.ReferralSource || '');
    setEditEntity(req?.Entity || '');
    setEditDetails(req?.Details || '');
    setEditOutgoingNumber(req?.OutgoingNumber || '');
    setEditOutgoingDate(req?.OutgoingDate || '');
    setEditProcessingStatus((req?.ProcessingStatus as ProcessingStatus) || 'منجز');
    setEditPriority((req?.Priority as Priority) || 'عام');
    setEditOtherNotes(req?.OtherNotes || req?.DeputyNotes || '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTarget) return;
    const { citizen, request } = editingTarget;

    updateCitizen({
      ...citizen,
      FullName: editFullName.trim(),
      Phone1: editPhone1.trim(),
      Phone2: editPhone2.trim() || undefined,
      District: editDistrict.trim(),
      SubDistrict: editSubDistrict.trim(),
      Surname: editSurname.trim() || undefined,
      Job: editJob.trim(),
      Education: editEducation.trim(),
      AttendanceType: editAttendanceType,
      ProxyName: editAttendanceType === 'بيد شخص آخر (معتمد)' ? editProxyName.trim() : undefined,
      ProxyPhone: editAttendanceType === 'بيد شخص آخر (معتمد)' ? editProxyPhone.trim() : undefined,
      ReferralSource: editReferralSource.trim() || undefined
    });

    if (request) {
      updateRequest({
        ...request,
        CitizenName: editFullName.trim(),
        CitizenPhone: editPhone1.trim(),
        Entity: editEntity.trim(),
        Details: editDetails.trim(),
        OutgoingNumber: editOutgoingNumber.trim() || undefined,
        OutgoingDate: editOutgoingDate.trim() || undefined,
        ProcessingStatus: editProcessingStatus,
        Priority: editPriority,
        OtherNotes: editOtherNotes.trim() || undefined
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

      {/* REAL-TIME LIVE STATUS BAR: آخر اسم مسجل + آخر عدد صادر مسجل + العدد القادم المقترح */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border-2 border-amber-400/50 dark:border-amber-500/40 shadow-sm">
        {/* Card 1: آخر اسم مسجل */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">آخر اسم مسجل بالنظام:</span>
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                مباشر
              </span>
            </div>
            <div className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate mt-0.5" title={lastRegisteredCitizen?.FullName || 'لا يوجد'}>
              {lastRegisteredCitizen?.FullName || 'لا يوجد مسجلين بعد'}
            </div>
            {lastRegisteredCitizen && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 font-mono mt-0.5" dir="ltr">
                <span>{lastRegisteredCitizen.Phone1 || '-'}</span>
                <span>•</span>
                <span>{lastRegisteredCitizen.District || 'المركز'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: آخر عدد صادر مسجل */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-900 dark:text-amber-200 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 block">آخر عدد صادر مسجل:</span>
            <div className="font-black text-sm font-mono text-amber-950 dark:text-amber-100 truncate mt-0.5">
              {lastOutgoingRecord ? lastOutgoingRecord.outgoingNumber : 'لا يوجد صادر مسجل بعد'}
            </div>
            {lastOutgoingRecord && (
              <div className="text-[10px] text-amber-800 dark:text-amber-400 truncate mt-0.5">
                بتاريخ: {lastOutgoingRecord.outgoingDate} ({lastOutgoingRecord.citizenName})
              </div>
            )}
          </div>
        </div>

        {/* Card 3: العدد القادم المقترح تلقائياً */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 flex items-center justify-center shrink-0">
            <Hash className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 block">العدد القادم المقترح تلقائياً:</span>
            <div className="font-black text-sm font-mono text-emerald-950 dark:text-emerald-100 mt-0.5">
              {nextAutoOutgoingNumber}
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
              يبدأ من 1 تلقائياً وقابل للتعديل
            </div>
          </div>
        </div>

        {/* Card 4: زر صادر موحد لمجموعة مراجعين */}
        <div className="flex items-center p-1">
          <button
            type="button"
            onClick={handleOpenBulkOutgoingModal}
            className="w-full h-full min-h-[58px] px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-700 hover:to-amber-900 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-600/20 transition-all active:scale-95 border border-amber-400/80"
          >
            <Users className="w-5 h-5 text-amber-200 shrink-0" />
            <div className="text-right">
              <span className="block text-xs font-black">صادر موحد لمجموعة مراجعين 📑</span>
              <span className="text-[10px] text-amber-200 font-normal">إصدار عدد وتاريخ واحد لعدة أسماء</span>
            </div>
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

      {/* Official Success Notification Popup Modal (يظهر على شكل رسالة منبثقة برقم الصادر والتاريخ وزر إكمال طلب آخر) */}
      {savedOfficialCard && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-amber-400 dark:border-amber-500 max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-4 text-right relative animate-in zoom-in-95 my-8">
            {/* Close button */}
            <button
              onClick={() => setSavedOfficialCard(null)}
              className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              ✕
            </button>

            {/* Header with Crest */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-amber-300 dark:border-amber-500/40 pb-4 text-center sm:text-right gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
                  🦅
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    جمهورية العراق - مجلس النواب
                  </h3>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-400">
                    {systemSettings.officeName || systemSettings.appName || 'مكتب مجلس النواب العراقي'} - قسم الإدارة والمتابعة
                  </p>
                </div>
              </div>

              <div className="bg-amber-100 dark:bg-amber-950/80 px-5 py-2.5 rounded-2xl border-2 border-amber-500 text-center shadow-xs">
                <span className="block text-[11px] font-black text-amber-900 dark:text-amber-300">العدد الصادر الرسمي</span>
                <span className="text-lg font-black font-mono text-amber-950 dark:text-amber-100 tracking-wider">
                  {savedOfficialCard.outgoingNumber}
                </span>
                <span className="block text-xs font-mono font-bold text-amber-800 dark:text-amber-400 mt-0.5">
                  التاريخ: {savedOfficialCard.outgoingDate}
                </span>
              </div>
            </div>

            {/* Highlighted Employee Paper Document Alert Badge */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border-2 border-amber-400/80 dark:border-amber-500/70 text-slate-900 dark:text-amber-100 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 rounded-xl bg-amber-400/30 text-amber-900 dark:text-amber-200 shrink-0">✍️</span>
                <div className="text-right">
                  <strong className="block text-xs sm:text-sm font-black text-amber-950 dark:text-amber-200">
                    تنبيه للموظف: يرجى تثبيت رقم الصادر والتاريخ على أصل المعاملة الورقية الآن
                  </strong>
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                    قم بكتابة العدد الصادر وتاريخ اليوم بخط واضح في الترويسة المخصصة على الطلب الورقي قبل تسليمه للمراجع أو إرساله للجهة المعنية.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="px-3 py-1.5 bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-xs font-mono border border-amber-500">
                  العدد: {savedOfficialCard.outgoingNumber}
                </div>
                <div className="px-3 py-1.5 bg-slate-900 text-white font-black rounded-xl text-xs shadow-xs font-mono border border-slate-700">
                  التاريخ: {savedOfficialCard.outgoingDate}
                </div>
              </div>
            </div>

            {/* Details Body */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
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
            </div>

            {/* Attached Image if available */}
            {savedOfficialCard.attachedImage && (
              <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={savedOfficialCard.attachedImage}
                    alt="صورة الطلب"
                    className="w-12 h-12 object-cover rounded-xl border border-blue-300 shadow-2xs"
                  />
                  <div>
                    <span className="text-xs font-bold text-blue-950 dark:text-blue-200 block">صورة الطلب الورقي المرفق</span>
                    <span className="text-[10px] text-emerald-600 font-bold">تمت الأرشفة والحفظ بنجاح</span>
                  </div>
                </div>
              </div>
            )}

            {/* Official Stamp & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(savedOfficialCard.outgoingNumber);
                    alert(`تم نسخ رقم الصادر (${savedOfficialCard.outgoingNumber})`);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>نسخ الرقم</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    printSingleOutgoingReceipt({
                      outgoingNumber: savedOfficialCard.outgoingNumber,
                      outgoingDate: savedOfficialCard.outgoingDate,
                      citizenName: savedOfficialCard.citizenName,
                      phone: savedOfficialCard.phone,
                      entity: savedOfficialCard.entity,
                      subject: savedOfficialCard.subject,
                      address: savedOfficialCard.address,
                      education: savedOfficialCard.education,
                      job: savedOfficialCard.job,
                      referrer: savedOfficialCard.referrer,
                      officeName: systemSettings.officeName || systemSettings.appName,
                      deputyName: systemSettings.deputyName
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-transform"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>طباعة وصل الصادر الرسمي</span>
                </button>
              </div>

              {/* THE REQUESTED BUTTON: إكمال طلب آخر */}
              <button
                type="button"
                onClick={() => {
                  setSavedOfficialCard(null);
                  const el = document.getElementById('daily-records-list');
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/30 transition-transform active:scale-95"
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
                    onClick={() => {
                      if (cit.IsBlocked) {
                        alert(`⛔ تنبيه أمني: هذا المراجع مدرج في القائمة السوداء (محظور)!\nالسبب: ${cit.BlockReason || 'غير محدد'}\nلا يمكن إكمال المعاملة أو إصدار كتاب صادر حتى يتم إلغاء الحظر أولاً.`);
                        return;
                      }
                      handleOpenCompleteRequest(cit, primaryReq);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-95 ${
                      cit.IsBlocked
                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed opacity-80'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                    }`}
                    title={cit.IsBlocked ? 'محظور بالقائمة السوداء - لا يمكن إكمال الطلب' : 'استكمال بيانات المعاملة وتوثيق رقم الصادر الرسمي'}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>إكمال الطلب</span>
                  </button>

                  {/* Edit Button (Button 2) */}
                  <button
                    onClick={() => handleOpenEdit(cit, primaryReq)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    title="تعديل كافة بيانات المراجع والمعاملة"
                  >
                    <Edit className="w-3.5 h-3.5 text-blue-600" />
                    <span>تعديل</span>
                  </button>

                  {/* Delete Button (Button 3) */}
                  <button
                    onClick={() => setDeletingTarget({ citizen: cit, request: primaryReq })}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-rose-200 dark:border-rose-800"
                    title="حذف هذا السجل نهائياً من كافة قواعد البيانات"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>حذف</span>
                  </button>

                  {/* Block / Unblock Button (Button 4) */}
                  {cit.IsBlocked ? (
                    <button
                      onClick={() => {
                        if (window.confirm(`هل أنت متأكد من إلغاء الحظر عن المواطن (${cit.FullName})؟`)) {
                          unblockCitizen(cit.Citizen_ID);
                          alert(`✓ تم بنجاح إلغاء الحظر عن (${cit.FullName}) وإعادته للوضع الطبيعي.`);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-transform"
                      title="إلغاء الحظر وإعادة المراجع إلى الوضع الطبيعي"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                      <span>إلغاء الحظر</span>
                    </button>
                  ) : (
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
                  )}

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

                  {/* Print Outgoing Receipt button if outgoing exists */}
                  {primaryReq?.OutgoingNumber && (
                    <button
                      type="button"
                      onClick={() => {
                        printSingleOutgoingReceipt({
                          outgoingNumber: primaryReq.OutgoingNumber || '',
                          outgoingDate: primaryReq.OutgoingDate || '',
                          citizenName: cit.FullName,
                          phone: cit.Phone1 || '',
                          entity: primaryReq.Entity || '',
                          subject: primaryReq.Details || '',
                          address: cit.District || '',
                          education: cit.Education || '',
                          job: cit.Job || '',
                          referrer: cit.ReferralSource || '',
                          officeName: systemSettings.officeName || systemSettings.appName,
                          deputyName: systemSettings.deputyName,
                          notes: primaryReq.OtherNotes,
                          attachedImage: primaryReq.AttachedRequestImage
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-transform"
                      title="طباعة وصل الصادر الرسمي لهذا المراجع"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-950" />
                      <span>وصل الصادر</span>
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
                  <SearchableSelect
                    options={IRAQI_MINISTRIES}
                    value={formEntity}
                    onChange={setFormEntity}
                    placeholder="اختر أو اكتب للبحث عن الوزارة أو الدائرة..."
                    required
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

                {/* 13. زر رفع صورة الطلب / المعاملة الورقية */}
                <div className="sm:col-span-2 p-3 bg-blue-50/70 dark:bg-blue-950/30 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block font-black text-blue-950 dark:text-blue-200 text-xs">
                      📸 صورة الطلب / المعاملة الورقية الأصلية:
                    </label>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                      (لحفظها وأرشفتها مع الصادر والطباعة)
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-black cursor-pointer inline-flex items-center gap-2 shadow-xs transition-all">
                      <ImageIcon className="w-4 h-4 text-blue-200" />
                      <span>رفع صورة الطلب 📁</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setFormAttachedImage(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>

                    {formAttachedImage ? (
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-blue-200 dark:border-blue-800 shadow-xs">
                        <img
                          src={formAttachedImage}
                          alt="صورة الطلب المرفقة"
                          className="w-14 h-14 object-cover rounded-lg border border-blue-300"
                        />
                        <div className="text-right">
                          <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                            ✓ تم إرفاق الصورة بنجاح
                          </p>
                          <button
                            type="button"
                            onClick={() => setFormAttachedImage('')}
                            className="mt-1 px-2 py-0.5 text-[10px] bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-md font-bold cursor-pointer"
                          >
                            حذف الصورة
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">
                        لم يتم اختيار صورة بعد (اختياري)
                      </span>
                    )}
                  </div>
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
      {/* MODAL 4: نافذة التعديل الشاملة (Comprehensive Edit)      */}
      {/* ======================================================== */}
      {editingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                  <Edit className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    تعديل كافة بيانات المراجع والمعاملة
                  </h3>
                  <p className="text-xs text-slate-500">
                    يمكنك تعديل أي معلومة شخصية أو إدارية أو صادر رسمي وحفظها مباشرة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* قسم بيانات المراجع الشخصية */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 space-y-3">
                <h4 className="font-black text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <User className="w-4 h-4" />
                  <span>البيانات الشخصية للمراجع:</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* الاسم الكامل */}
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      الاسم الكامل: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* هاتف 1 */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      رقم الهاتف الأساسي: <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editPhone1}
                      onChange={(e) => setEditPhone1(e.target.value)}
                      className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                      dir="ltr"
                    />
                  </div>

                  {/* هاتف 2 */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      رقم هاتف إضافي (اختياري):
                    </label>
                    <input
                      type="text"
                      value={editPhone2}
                      onChange={(e) => setEditPhone2(e.target.value)}
                      className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                      dir="ltr"
                    />
                  </div>

                  {/* القضاء */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      القضاء / السكن:
                    </label>
                    <SearchableSelect
                      options={DHI_QAR_DISTRICTS}
                      value={editDistrict}
                      onChange={setEditDistrict}
                      placeholder="اختر أو اكتب القضاء..."
                    />
                  </div>

                  {/* الناحية / الحي */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      الناحية / الحي / المنطقة:
                    </label>
                    <input
                      type="text"
                      value={editSubDistrict}
                      onChange={(e) => setEditSubDistrict(e.target.value)}
                      placeholder="مثال: المركز، حي المعلمين..."
                      className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* العشيرة / اللقب */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      العشيرة / اللقب:
                    </label>
                    <SearchableSelect
                      options={DEFAULT_CLANS}
                      value={editSurname}
                      onChange={setEditSurname}
                      placeholder="اختر أو اكتب العشيرة..."
                    />
                  </div>

                  {/* التحصيل الدراسي */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      التحصيل الدراسي:
                    </label>
                    <input
                      type="text"
                      value={editEducation}
                      onChange={(e) => setEditEducation(e.target.value)}
                      placeholder="أمي، ابتدائية، إعدادية، بكالوريوس..."
                      className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* نوع العمل */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نوع العمل / الوظيفة:
                    </label>
                    <input
                      type="text"
                      value={editJob}
                      onChange={(e) => setEditJob(e.target.value)}
                      placeholder="كاسب، موظف، عاطل..."
                      className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* المعرف أو التزكية */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      المعرف / التزكية:
                    </label>
                    <input
                      type="text"
                      value={editReferralSource}
                      onChange={(e) => setEditReferralSource(e.target.value)}
                      placeholder="اسم المعرف أو مصدر التزكية..."
                      className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* نوع الحضور */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نوع الحضور:
                    </label>
                    <select
                      value={editAttendanceType}
                      onChange={(e) => setEditAttendanceType(e.target.value)}
                      className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="شخصياً">شخصياً</option>
                      <option value="بيد شخص آخر (معتمد)">بيد شخص آخر (معتمد)</option>
                    </select>
                  </div>

                  {/* حقول المعتمد إذا اختار بيد شخص آخر */}
                  {editAttendanceType === 'بيد شخص آخر (معتمد)' && (
                    <>
                      <div>
                        <label className="block font-bold text-amber-700 dark:text-amber-400 mb-1">
                          اسم المعتمد / الوكيل:
                        </label>
                        <input
                          type="text"
                          value={editProxyName}
                          onChange={(e) => setEditProxyName(e.target.value)}
                          placeholder="اسم حامل الطلب..."
                          className="w-full h-9 px-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-amber-700 dark:text-amber-400 mb-1">
                          هاتف المعتمد:
                        </label>
                        <input
                          type="text"
                          value={editProxyPhone}
                          onChange={(e) => setEditProxyPhone(e.target.value)}
                          placeholder="07XXXXXXXXX"
                          className="w-full h-9 px-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-xl font-mono"
                          dir="ltr"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* قسم بيانات المعاملة والصادر الرسمي */}
              {editingTarget.request && (
                <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-3">
                  <h4 className="font-black text-xs text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>بيانات المعاملة والصادر الرسمي:</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* الجهة المعنية */}
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        الجهة أو الوزارة المعنية: <span className="text-rose-500">*</span>
                      </label>
                      <SearchableSelect
                        options={IRAQI_MINISTRIES}
                        value={editEntity}
                        onChange={setEditEntity}
                        placeholder="اختر أو اكتب الجهة المعنية..."
                        required
                      />
                    </div>

                    {/* موضوع وتفاصيل المعاملة */}
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        تفاصيل وموضوع المعاملة: <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={editDetails}
                        onChange={(e) => setEditDetails(e.target.value)}
                        placeholder="موضوع المعاملة المطلوب من الوزارة..."
                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* رقم الصادر */}
                    <div>
                      <label className="block font-bold text-amber-700 dark:text-amber-400 mb-1">
                        رقم الصادر أو العدد: (رسمي)
                      </label>
                      <input
                        type="text"
                        value={editOutgoingNumber}
                        onChange={(e) => setEditOutgoingNumber(e.target.value)}
                        placeholder="ص/2026/..."
                        className="w-full h-9 px-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl font-mono font-black text-amber-950 dark:text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    {/* تاريخ الصادر */}
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        تاريخ كتاب الصادر:
                      </label>
                      <input
                        type="date"
                        value={editOutgoingDate}
                        onChange={(e) => setEditOutgoingDate(e.target.value)}
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* حالة المعاملة */}
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        حالة المعاملة:
                      </label>
                      <select
                        value={editProcessingStatus}
                        onChange={(e) => setEditProcessingStatus(e.target.value as ProcessingStatus)}
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="منجز">منجز (مكتمل ومغلق)</option>
                        <option value="قيد الإجراء">قيد الإجراء والمتابعة</option>
                        <option value="تم الطباعة">تمت الطباعة وتثبيت الكتاب</option>
                        <option value="مرسل إلى الوزارة/الهيئة">مرسل إلى الوزارة/الهيئة</option>
                        <option value="بانتظار الموافقة">بانتظار الموافقة الوزارية</option>
                        <option value="مرفوض">مرفوض</option>
                      </select>
                    </div>

                    {/* الأسبقية */}
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        درجة الأولوية:
                      </label>
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as any)}
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="عام">عام</option>
                        <option value="خاص">خاص</option>
                        <option value="عاجل">عاجل وفوري</option>
                        <option value="إنساني">إنساني</option>
                      </select>
                    </div>

                    {/* الملاحظات والتوجيهات */}
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        ملاحظات وتوجيهات أخرى:
                      </label>
                      <textarea
                        rows={2}
                        value={editOtherNotes}
                        onChange={(e) => setEditOtherNotes(e.target.value)}
                        placeholder="أي تفاصيل أو توجيهات إدارية إضافية..."
                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* أزرار الحفظ والإلغاء */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 py-2">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-md active:scale-95 transition-transform"
                >
                  <Check className="w-4 h-4" />
                  <span>حفظ كافة التعديلات في قواعد البيانات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ======================================================== */}
      {/* MODAL: صادر موحد لمجموعة مراجعين (Bulk Collective Outgoing) */}
      {/* ======================================================== */}
      {isBulkOutgoingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-amber-300 dark:border-amber-600/50 max-w-4xl w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <span>إصدار كتاب صادر موحد لمجموعة مراجعين (معاملة جماعية)</span>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full font-bold">
                      عدد وتاريخ واحد لعدة أسماء
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    يمكنك لصق الأسماء والأرقام دفعة واحدة من إكسل، أو كتابتها في الجدول، ويتم تسجيلهم جميعاً بنفس رقم الصادر وطباعة وصل جماعي
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkOutgoingModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBulkOutgoing} className="space-y-4">
              {/* Top Row: Outgoing Number & Date & Entity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-900/50 text-xs">
                <div>
                  <label className="block font-black text-amber-950 dark:text-amber-200 mb-1">
                    العدد الصادر الموحد: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={bulkOutgoingNumber}
                    onChange={(e) => setBulkOutgoingNumber(e.target.value)}
                    placeholder="ص/2026/1"
                    className="w-full h-9 px-3 bg-white dark:bg-slate-800 border-2 border-amber-400 dark:border-amber-600 rounded-xl font-mono font-black text-amber-950 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-amber-800 dark:text-amber-400 mt-0.5 block">
                    يمكنك تعديل الرقم بحرية
                  </span>
                </div>

                <div>
                  <label className="block font-black text-slate-800 dark:text-slate-200 mb-1">
                    تاريخ الصادر: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={bulkOutgoingDate}
                    onChange={(e) => setBulkOutgoingDate(e.target.value)}
                    className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    تاريخ اليوم معتمد وقابل للتغيير
                  </span>
                </div>

                <div>
                  <label className="block font-black text-slate-800 dark:text-slate-200 mb-1">
                    الجهة أو الوزارة المعنية: <span className="text-rose-500">*</span>
                  </label>
                  <SearchableSelect
                    options={IRAQI_MINISTRIES}
                    value={bulkEntity}
                    onChange={setBulkEntity}
                    placeholder="اختر أو اكتب الوزارة / الدائرة..."
                    required
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1">
                  موضوع المعاملة الموحدة: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={bulkSubject}
                  onChange={(e) => setBulkSubject(e.target.value)}
                  placeholder="مثال: طلب شمول بالرعاية الاجتماعية / تثبيت عقود / طلبات تعيين ومفاضلة..."
                  className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quick Paste Area */}
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-blue-950 dark:text-blue-200">
                    <ClipboardPaste className="w-4 h-4 text-blue-600" />
                    <span>اللصق السريع المباشر (نسخ من إكسل أو واتساب):</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleParseBulkPaste}
                    className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                  >
                    <span>⚡ تحليل وتفريغ الأسماء في الجدول</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={bulkRawPasteText}
                  onChange={(e) => setBulkRawPasteText(e.target.value)}
                  placeholder="الصق هنا أسطر متعددة من إكسل، مثال:&#10;أحمد علي حسن - 07801234567 - الناصرية&#10;محمد كاظم جاسم - 07709876543 - الشطرة"
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Editable Citizens Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    جدول قائمة المواطنين المشمولين بهذا الصادر ({bulkRows.filter(r => r.name.trim()).length} مواطن):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkRows(prev => [
                        ...prev,
                        { id: `row-${Date.now()}-${prev.length + 1}`, name: '', phone: '', district: 'الناصرية', notes: '' }
                      ]);
                    }}
                    className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة مواطن آخر</span>
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-2 w-10 text-center">ت</th>
                        <th className="p-2">اسم المواطن الرباعي *</th>
                        <th className="p-2 w-36">رقم الهاتف</th>
                        <th className="p-2 w-36">السكن / القضاء</th>
                        <th className="p-2">ملاحظة / اختصاص</th>
                        <th className="p-2 w-10 text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {bulkRows.map((row, index) => (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 text-center font-bold text-slate-400 font-mono">{index + 1}</td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBulkRows(prev => prev.map((r, i) => i === index ? { ...r, name: val } : r));
                              }}
                              placeholder="الاسم الرباعي..."
                              className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.phone}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBulkRows(prev => prev.map((r, i) => i === index ? { ...r, phone: val } : r));
                              }}
                              placeholder="0780..."
                              dir="ltr"
                              className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white text-right"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.district}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBulkRows(prev => prev.map((r, i) => i === index ? { ...r, district: val } : r));
                              }}
                              placeholder="الناصرية / الشطرة..."
                              className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              value={row.notes}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBulkRows(prev => prev.map((r, i) => i === index ? { ...r, notes: val } : r));
                              }}
                              placeholder="تخصص أو صفة..."
                              className="w-full h-8 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            {bulkRows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setBulkRows(prev => prev.filter((_, i) => i !== index))}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
                                title="حذف السطر"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBulkOutgoingModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-600/30 active:scale-95 transition-transform"
                >
                  <Printer className="w-4 h-4 text-amber-200" />
                  <span>حفظ وإصدار الصادر الموحد + طباعة الوصل الجماعي 🖨️</span>
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
