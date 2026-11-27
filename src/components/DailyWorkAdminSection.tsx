import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
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
  ListPlus,
  FolderKanban,
  Archive,
  RotateCcw,
  Download
} from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import { DHI_QAR_DISTRICTS, IRAQI_MINISTRIES, DEFAULT_CLANS } from './ReceptionModule';
import { printSingleOutgoingReceipt, printCollectiveOutgoingReceipt } from '../utils/printReceiptHelper';
import { GoogleDriveArchiveModal } from './GoogleDriveArchiveModal';
import { computeNextOutgoingNumber, extractOutgoingSequence, MAX_VALID_OUTGOING_SEQ } from '../utils/outgoingNumberHelper';
import {
  getLocalTodayIsoDate,
  isCitizenArchivedInSection,
  isHistoricalOrImportedRecord,
  isRecordRegisteredToday,
  isRequestArchivedInSection
} from '../utils/archiveHelper';

interface DailyWorkAdminSectionProps {
  onOpenSmartArchive?: () => void;
}

export const DailyWorkAdminSection: React.FC<DailyWorkAdminSectionProps> = ({
  onOpenSmartArchive
}) => {
  const {
    citizens,
    requests,
    officialLetters,
    customRecords,
    addCitizen,
    updateCitizen,
    deleteCitizen,
    addRequest,
    updateRequest,
    deleteRequest,
    blockCitizen,
    unblockCitizen,
    checkIfCitizenBlocked,
    archiveDailyWorkItems,
    restoreDailyWorkItem,
    restoreDailyWorkItems,
    addAuditLog,
    currentUser,
    systemSettings,
    updateSystemSettings,
    setSelectedCitizenForHistory,
    setPrintableBadgeCitizen
  } = useApp();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'special' | 'general' | 'rejected' | 'completed'>('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'daily' | 'section_archive'>('daily');
  const [archiveConfirmMode, setArchiveConfirmMode] = useState<'none' | 'imported' | 'completed' | 'all_visible'>('none');
  const [isEditingManualCounter, setIsEditingManualCounter] = useState(false);
  const [manualCounterInput, setManualCounterInput] = useState('');
  const [manualDateInput, setManualDateInput] = useState('');
  const [isSavingManualCounter, setIsSavingManualCounter] = useState(false);

  // High-performance pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Google Drive Transaction Archive Modal State
  const [isDriveArchiveOpen, setIsDriveArchiveOpen] = useState(false);
  const [driveModalCitizen, setDriveModalCitizen] = useState<Citizen | null>(null);
  const [driveModalRequest, setDriveModalRequest] = useState<OfficeRequest | null>(null);

  // Auto-reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, districtFilter, viewMode]);

  // Modals state
  const [completingTarget, setCompletingTarget] = useState<{ citizen: Citizen; request?: OfficeRequest } | null>(null);
  const [allowBlockedOverride, setAllowBlockedOverride] = useState<boolean>(false);
  const [blockedCompleteWarningTarget, setBlockedCompleteWarningTarget] = useState<{
    citizen: Citizen;
    request?: OfficeRequest;
    matchedBlockedCitizen: Citizen;
    reason: string;
  } | null>(null);
  const [editingTarget, setEditingTarget] = useState<{ citizen: Citizen; request?: OfficeRequest } | null>(null);
  const [blockingTarget, setBlockingTarget] = useState<Citizen | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [blockModalError, setBlockModalError] = useState<string | null>(null);
  const [pendingUnblockCitizenId, setPendingUnblockCitizenId] = useState<string | null>(null);
  const [blockStatusBanner, setBlockStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<{ citizen: Citizen; request?: OfficeRequest } | null>(null);
  const [rejectingTarget, setRejectingTarget] = useState<{ citizen: Citizen; request: OfficeRequest } | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  const canProceedCautiouslyWithBlocked = ['developer', 'director', 'deputy', 'admin', 'admin_officer'].includes(
    currentUser?.Role || ''
  );

  const showBlockBanner = (type: 'success' | 'error', text: string) => {
    setBlockStatusBanner({ type, text });
    setTimeout(() => setBlockStatusBanner(null), 5000);
  };

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
    deliveryStatus?: 'مستلم' | 'غير مستلم';
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
  const [formDeliveryStatus, setFormDeliveryStatus] = useState<'مستلم' | 'غير مستلم'>('غير مستلم');
  const [formEducation, setFormEducation] = useState('');
  const [formJob, setFormJob] = useState('');
  const [formOtherNotes, setFormOtherNotes] = useState('');
  const [formAttachedImage, setFormAttachedImage] = useState<string>('');

  // Unified sequential outgoing number helper:
  // Nasiriyah: ن / 12 / <next>, Suq Al-Shuyoukh: س / 14 / <next>
  // Automatically reflects all archived/imported Excel files and manual outgoings
  const generateOutgoingNumber = () => {
    return computeNextOutgoingNumber(requests, systemSettings, officialLetters, customRecords).nextNumber;
  };

  const advanceOutgoingBaseline = (outgoingNumberStr: string, citizenNameStr?: string) => {
    const seq = extractOutgoingSequence(outgoingNumberStr).seq;
    if (seq <= 0 || seq > MAX_VALID_OUTGOING_SEQ) return;
    const isSuq = systemSettings?.officeBranch === 'suq_al_shuyoukh';
    const cleanName = (citizenNameStr || '').trim();
    const cleanRaw = (outgoingNumberStr || '').trim();
    const preserveMode = systemSettings?.outgoingBaselineMode || 'auto';
    if (isSuq) {
      const cur = Number(systemSettings?.lastOutgoingNumberSuq) || 0;
      if (cur > MAX_VALID_OUTGOING_SEQ || seq >= cur) {
        updateSystemSettings({
          lastOutgoingNumberSuq: seq,
          outgoingBaselineMode: preserveMode,
          ...(cleanName ? { lastRegisteredName: cleanName } : {}),
          ...(cleanRaw ? { lastOutgoingRaw: cleanRaw } : {})
        });
      }
    } else {
      const cur = Number(systemSettings?.lastOutgoingNumberNasiriyah) || 0;
      if (cur > MAX_VALID_OUTGOING_SEQ || seq >= cur) {
        updateSystemSettings({
          lastOutgoingNumberNasiriyah: seq,
          outgoingBaselineMode: preserveMode,
          ...(cleanName ? { lastRegisteredName: cleanName } : {}),
          ...(cleanRaw ? { lastOutgoingRaw: cleanRaw } : {})
        });
      }
    }
  };

  // Real-time detection of last outgoing number and date recorded across ALL requests, official letters & custom sections
  const outgoingComputed = useMemo(() => {
    return computeNextOutgoingNumber(requests, systemSettings, officialLetters, customRecords);
  }, [
    requests,
    officialLetters,
    customRecords,
    systemSettings?.officeBranch,
    systemSettings?.lastOutgoingNumberNasiriyah,
    systemSettings?.lastOutgoingNumberSuq,
    systemSettings?.outgoingBaselineMode,
    systemSettings?.outgoingBaselineSetAt,
    systemSettings?.outgoingBaselineLabel,
    systemSettings?.defaultOutgoingDate,
    systemSettings?.lastRegisteredName,
    systemSettings?.lastOutgoingRaw
  ]);

  const lastOutgoingRecord = outgoingComputed.lastOutgoingRecord || null;
  const nextAutoOutgoingNumber = outgoingComputed.nextNumber;

  // Real-time detection of last completed request citizen in administration:
  // Always synchronized with the authoritative last outgoing number record (or latest completed request by date)
  const lastCompletedAdminCitizen = useMemo(() => {
    if (lastOutgoingRecord && lastOutgoingRecord.citizenName && lastOutgoingRecord.citizenName.trim()) {
      const linkedReq = lastOutgoingRecord.request;
      const linkedCit = linkedReq
        ? citizens.find(c => c.Citizen_ID === linkedReq.Citizen_ID)
        : citizens.find(c => (c.FullName || '').trim() === lastOutgoingRecord.citizenName.trim());

      return {
        citizen:
          linkedCit ||
          ({
            Citizen_ID: linkedReq?.Citizen_ID || '',
            FullName: lastOutgoingRecord.citizenName,
            Phone1: linkedReq?.CitizenPhone || '',
            District: linkedReq?.Address || 'الناصرية'
          } as Citizen),
        request:
          linkedReq ||
          ({
            Request_ID: '',
            Citizen_ID: linkedCit?.Citizen_ID || '',
            CitizenName: lastOutgoingRecord.citizenName,
            OutgoingNumber: lastOutgoingRecord.outgoingNumber,
            OutgoingDate: lastOutgoingRecord.outgoingDate,
            Entity: '',
            ProcessingStatus: 'منجز',
            RequestStatus: 'غير مستلم',
            Priority: 'عام',
            Details: '',
            CreatedAt: lastOutgoingRecord.outgoingDate || '',
            CreatedBy: ''
          } as OfficeRequest),
        outgoingNumber: lastOutgoingRecord.outgoingNumber
      };
    }

    if (!requests || requests.length === 0) return null;
    const completedReqs = requests
      .filter(r => (r.OutgoingNumber && r.OutgoingNumber.trim()) || r.ProcessingStatus === 'منجز')
      .slice()
      .sort((a, b) => {
        const seqDiff = extractOutgoingSequence(b.OutgoingNumber).seq - extractOutgoingSequence(a.OutgoingNumber).seq;
        if (seqDiff !== 0) return seqDiff;
        const dateA = a.OutgoingDate || a.UpdatedAt || a.CreatedAt || '';
        const dateB = b.OutgoingDate || b.UpdatedAt || b.CreatedAt || '';
        return dateB.localeCompare(dateA);
      });

    for (const req of completedReqs) {
      const cit = citizens.find(c => c.Citizen_ID === req.Citizen_ID);
      if (cit && cit.FullName && cit.FullName.trim()) {
        return {
          citizen: cit,
          request: req,
          outgoingNumber: req.OutgoingNumber || 'منجز'
        };
      }
      if (req.CitizenName && req.CitizenName.trim()) {
        return {
          citizen: {
            Citizen_ID: req.Citizen_ID,
            FullName: req.CitizenName,
            Phone1: req.CitizenPhone || '',
            District: req.Address || 'الناصرية'
          } as Citizen,
          request: req,
          outgoingNumber: req.OutgoingNumber || 'منجز'
        };
      }
    }
    return null;
  }, [lastOutgoingRecord, requests, citizens]);

  const getDefaultAdminOutgoingDate = () => {
    const customDate = (systemSettings?.defaultOutgoingDate || '').trim();
    return customDate || getLocalTodayIsoDate();
  };

  const handleSaveManualCounter = async () => {
    const parsed = extractOutgoingSequence(manualCounterInput);
    if (parsed.seq <= 0 || parsed.seq > MAX_VALID_OUTGOING_SEQ) {
      showBlockBanner('error', 'يرجى إدخال رقم صادر صحيح (مثلاً 3344 أو ن / 12 / 3344) لضبط العداد.');
      return;
    }
    const isSuq = systemSettings?.officeBranch === 'suq_al_shuyoukh';
    const branchPrefix = isSuq ? 'س' : 'ن';
    const branchCode = isSuq ? '14' : '12';
    const cleanRawInput = manualCounterInput.trim();
    const formattedOutgoingRaw = cleanRawInput.includes('/')
      ? cleanRawInput
      : `${branchPrefix} / ${branchCode} / ${parsed.seq}`;
    const cleanDate = manualDateInput.trim();

    setIsSavingManualCounter(true);
    try {
      const ok = await updateSystemSettings({
        ...(isSuq ? { lastOutgoingNumberSuq: parsed.seq } : { lastOutgoingNumberNasiriyah: parsed.seq }),
        outgoingBaselineMode: 'manual',
        outgoingBaselineSetAt: new Date().toISOString(),
        outgoingBaselineLabel: `تعديل يدوي (${cleanRawInput})`,
        lastOutgoingRaw: formattedOutgoingRaw,
        defaultOutgoingDate: cleanDate
      });
      if (ok) {
        setIsEditingManualCounter(false);
        setManualCounterInput('');
        showBlockBanner(
          'success',
          `✓ تم حفظ رقم الصادر (${parsed.seq}) في Firebase Firestore بنجاح — التسلسل التلقائي سيبدأ الآن من (${parsed.seq + 1})، ${
            cleanDate ? `والتاريخ المضبوط (${cleanDate})` : `والتاريخ تلقائي (${getLocalTodayIsoDate()})`
          }.`
        );
      } else {
        showBlockBanner('error', 'تعذر تأكيد حفظ رقم الصادر في Firebase Firestore. يرجى إعادة المحاولة.');
      }
    } finally {
      setIsSavingManualCounter(false);
    }
  };

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
    const defaultDate = getDefaultAdminOutgoingDate();
    setBulkOutgoingNumber(generateOutgoingNumber());
    setBulkOutgoingDate(defaultDate);
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
    const finalOutgoingDate = bulkOutgoingDate.trim() || getLocalTodayIsoDate();
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
        RequestStatus: 'غير مستلم',
        DeliveryStatus: 'غير مستلم',
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

    const lastBulkName = createdCitizensList[createdCitizensList.length - 1]?.name || '';
    advanceOutgoingBaseline(finalOutgoingNumber, lastBulkName);

    printCollectiveOutgoingReceipt({
      outgoingNumber: finalOutgoingNumber,
      outgoingDate: finalOutgoingDate,
      entity: finalEntity,
      subject: finalSubject,
      citizens: createdCitizensList,
      officeName: systemSettings.officeName || systemSettings.appName,
      deputyName: systemSettings.deputyName,
      emblemUrl: systemSettings.parliamentEmblemUrl || systemSettings.logoUrl
    });

    setIsBulkOutgoingModalOpen(false);
  };

  // Open "إكمال الطلب"
  const handleOpenCompleteRequest = (citizen: Citizen, req?: OfficeRequest, overrideBlocked: boolean = false) => {
    const defaultDate = getDefaultAdminOutgoingDate();
    const initialOutgoing = req?.OutgoingNumber || generateOutgoingNumber();

    setAllowBlockedOverride(overrideBlocked);
    setCompletingTarget({ citizen, request: req });
    setFormApplicantName(citizen.FullName || req?.CitizenName || '');
    setFormEntity(req?.Entity || 'مجلس الوزراء / الدوائر ذات العلاقة');
    setFormSubject(req?.Details || '');
    setFormOutgoingNumber(initialOutgoing);
    setFormOutgoingDate((req?.OutgoingDate && req.OutgoingDate.trim()) || defaultDate);
    setFormPhone(citizen.Phone1 || req?.CitizenPhone || '');
    setFormReferrer(citizen.ReferralSource || req?.ReferralSource || 'مباشر - قسم الاستعلامات');
    setFormAddress(citizen.District ? `${citizen.District} ${citizen.SubDistrict || ''}`.trim() : (req?.Address || 'ذي قار'));
    setFormRequestStatus((req?.ProcessingStatus as ProcessingStatus) || 'منجز');
    setFormDeliveryStatus(req?.DeliveryStatus || (req?.RequestStatus === 'مستلم' ? 'مستلم' : 'غير مستلم'));
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
    const liveBlockCheck = checkIfCitizenBlocked(citizen.FullName, citizen.Phone1);
    const isCurrentlyBlocked = Boolean(citizen.IsBlocked || liveBlockCheck.isBlocked);
    if (isCurrentlyBlocked && !allowBlockedOverride) {
      const bCit = liveBlockCheck.citizen || citizen;
      showBlockBanner(
        'error',
        `⛔ لا يمكن إتمام العملية: المواطن (${bCit.FullName}) مدرج في القائمة السوداء — السبب: ${bCit.BlockReason || 'غير محدد'}`
      );
      setCompletingTarget(null);
      return;
    }
    if (isCurrentlyBlocked && allowBlockedOverride) {
      const bCit = liveBlockCheck.citizen || citizen;
      addAuditLog(
        'استمرار بحذر في إكمال طلب لمحظور',
        'قسم الإدارة',
        `تم إكمال الطلب بحذر للمراجع المحظور (${bCit.FullName}) بصلاحية (${currentUser?.FullName || 'موظف الإدارة'}) — سبب الحظر المسجل: ${bCit.BlockReason || 'غير محدد'}`
      );
    }
    const finalOutgoingNumber = formOutgoingNumber.trim() || generateOutgoingNumber();
    const finalOutgoingDate = formOutgoingDate.trim() || getLocalTodayIsoDate();

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
        DeliveryStatus: formDeliveryStatus,
        RequestStatus: formDeliveryStatus,
        DeliveredAt: formDeliveryStatus === 'مستلم' ? finalOutgoingDate : undefined,
        DeliveredBy: formDeliveryStatus === 'مستلم' ? (currentUser?.FullName || 'موظف الإدارة') : undefined,
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
        RequestStatus: formDeliveryStatus,
        DeliveryStatus: formDeliveryStatus,
        DeliveredAt: formDeliveryStatus === 'مستلم' ? finalOutgoingDate : undefined,
        DeliveredBy: formDeliveryStatus === 'مستلم' ? (currentUser?.FullName || 'موظف الإدارة') : undefined,
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

    advanceOutgoingBaseline(finalOutgoingNumber, formApplicantName.trim());

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
      deliveryStatus: formDeliveryStatus,
      requestId: savedReqId,
      notes: formOtherNotes.trim(),
      attachedImage: formAttachedImage || undefined
    });

    setCompletingTarget(null);
  };

  // Handle Blacklist / Block (inline validation & banner — no window.alert)
  const handleConfirmBlock = () => {
    if (!blockingTarget) return;
    if (!blockReasonInput.trim()) {
      setBlockModalError('يرجى كتابة سبب الحظر الإداري أو الأمني.');
      return;
    }
    setBlockModalError(null);
    blockCitizen(
      blockingTarget.Citizen_ID,
      blockReasonInput.trim(),
      currentUser?.FullName || 'موظف الإدارة',
      {
        FullName: blockingTarget.FullName,
        Phone1: blockingTarget.Phone1,
        District: blockingTarget.District
      }
    );
    showBlockBanner('success', `⛔ تم بنجاح حظر المواطن (${blockingTarget.FullName}) وإدراجه في القائمة السوداء وتعميم الحظر على كامل المنظومة.`);
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
    setEditOutgoingDate((req?.OutgoingDate && req.OutgoingDate.trim()) || getDefaultAdminOutgoingDate());
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
      const cleanEditOutgoing = editOutgoingNumber.trim();
      const resolvedEditDate = editOutgoingDate.trim() || getLocalTodayIsoDate();
      updateRequest({
        ...request,
        CitizenName: editFullName.trim(),
        CitizenPhone: editPhone1.trim(),
        Entity: editEntity.trim(),
        Details: editDetails.trim(),
        OutgoingNumber: cleanEditOutgoing || undefined,
        OutgoingDate: cleanEditOutgoing || editOutgoingDate.trim() ? resolvedEditDate : request.OutgoingDate || getLocalTodayIsoDate(),
        ProcessingStatus: editProcessingStatus,
        Priority: editPriority,
        OtherNotes: editOtherNotes.trim() || undefined
      });
      if (cleanEditOutgoing) {
        advanceOutgoingBaseline(cleanEditOutgoing, editFullName.trim());
      }
    }

    setEditingTarget(null);
  };

  // Map requests by Citizen_ID
  const citizenMap = useMemo(() => {
    const map = new Map<string, Citizen>();
    citizens.forEach(c => map.set(c.Citizen_ID, c));
    return map;
  }, [citizens]);

  // Group requests by Citizen_ID once for fast O(1) lookup
  const requestsByCitizenMap = useMemo(() => {
    const map = new Map<string, OfficeRequest[]>();
    (requests || []).forEach(r => {
      if (!r?.Citizen_ID) return;
      const list = map.get(r.Citizen_ID);
      if (list) list.push(r);
      else map.set(r.Citizen_ID, [r]);
    });
    return map;
  }, [requests]);

  const todayLocalYmd = getLocalTodayIsoDate();

  // Build mapped records helper for Admin section (independent per-section archiving: 'admin')
  const mapCitizenToAdminItem = (cit: Citizen, archivedFlag: boolean, overrideReqs?: OfficeRequest[]) => {
    const citRequests = overrideReqs ?? (requestsByCitizenMap.get(cit.Citizen_ID) || []);
    const hasRejection = citRequests.some(r => r.DirectorDecision === 'رفض' || r.ProcessingStatus === 'مرفوض');
    const hasSpecial = citRequests.some(r => r.DirectorDecision === 'خاص');
    const hasGeneral = citRequests.some(r => r.DirectorDecision === 'عام');
    const hasPending = citRequests.some(
      r => !r.DirectorDecision && r.ProcessingStatus !== 'منجز' && r.DirectorDecision !== 'مؤرشف'
    );
    const hasCompleted = citRequests.some(r => r.ProcessingStatus === 'منجز' || Boolean(r.OutgoingNumber));
    const isImportedOrFiltered = isImportedOrNonNewItem(cit, citRequests);

    return {
      citizen: cit,
      requests: citRequests,
      isArchived: archivedFlag,
      isImportedOrFiltered,
      hasRejection,
      hasSpecial,
      hasGeneral,
      hasPending,
      hasCompleted
    };
  };

  // Helper: identify imported / database-filtered / non-new records inside Daily Work
  const isImportedOrNonNewItem = (cit: Citizen, citReqs: OfficeRequest[]): boolean => {
    if (isHistoricalOrImportedRecord(cit)) return true;
    return citReqs.some(r => isHistoricalOrImportedRecord(r));
  };

  // Active Daily Work records for Admin section ONLY:
  // Strictly restricted to TODAY'S newly registered records (local date), excluding all historical/old/imported records.
  const dailyRecords = useMemo(() => {
    const parseTs = (val?: string) => {
      if (!val) return 0;
      const t = Date.parse(String(val).replace(' ', 'T'));
      return isNaN(t) ? 0 : t;
    };

    const list: ReturnType<typeof mapCitizenToAdminItem>[] = [];
    for (const cit of citizens || []) {
      if (!cit || isHistoricalOrImportedRecord(cit)) continue;
      const citRequests = requestsByCitizenMap.get(cit.Citizen_ID) || [];
      if (isCitizenArchivedInSection(cit, 'admin', citRequests)) continue;

      // Filter strictly to today's newly registered, non-historical, unarchived requests
      const todayRequests = citRequests
        .filter(
          r =>
            r &&
            !isHistoricalOrImportedRecord(r) &&
            !isRequestArchivedInSection(r, 'admin') &&
            isRecordRegisteredToday(r, todayLocalYmd)
        )
        .sort((a, b) => parseTs(b.CreatedAt || b.UpdatedAt) - parseTs(a.CreatedAt || a.UpdatedAt));

      const citizenRegisteredToday = isRecordRegisteredToday(cit, todayLocalYmd);

      // Include ONLY if newly registered today (either a brand-new today request, or a brand-new today citizen with no requests yet)
      if (todayRequests.length > 0) {
        list.push(mapCitizenToAdminItem(cit, false, todayRequests));
      } else if (citizenRegisteredToday && citRequests.length === 0) {
        list.push(mapCitizenToAdminItem(cit, false, []));
      }
    }

    return list.sort((a, b) => {
      const tsA = parseTs(a.requests[0]?.CreatedAt || a.citizen.CreatedAt);
      const tsB = parseTs(b.requests[0]?.CreatedAt || b.citizen.CreatedAt);
      return tsB - tsA;
    });
  }, [citizens, requestsByCitizenMap, todayLocalYmd]);

  // Archived records belonging to Admin Section Archive / أرشيف العمل اليومي (archived in 'admin', including Director-archived items)
  const archivedAdminRecords = useMemo(() => {
    const parseTs = (val?: string) => {
      if (!val) return 0;
      const t = Date.parse(String(val).replace(' ', 'T'));
      return isNaN(t) ? 0 : t;
    };
    return (citizens || [])
      .filter(cit => {
        if (!cit) return false;
        const citRequests = requestsByCitizenMap.get(cit.Citizen_ID) || [];
        return (
          isCitizenArchivedInSection(cit, 'admin', citRequests) ||
          citRequests.some(r => isRequestArchivedInSection(r, 'admin'))
        );
      })
      .map(cit => {
        const citRequests = requestsByCitizenMap.get(cit.Citizen_ID) || [];
        const archivedReqs = citRequests.filter(r => isRequestArchivedInSection(r, 'admin'));
        return mapCitizenToAdminItem(cit, true, archivedReqs.length > 0 ? archivedReqs : citRequests);
      })
      .sort((a, b) => {
        const tsA = parseTs(a.requests[0]?.ArchivedAt || a.citizen.ArchivedAt || a.citizen.UpdatedAt || a.citizen.CreatedAt);
        const tsB = parseTs(b.requests[0]?.ArchivedAt || b.citizen.ArchivedAt || b.citizen.UpdatedAt || b.citizen.CreatedAt);
        return tsB - tsA;
      });
  }, [citizens, requestsByCitizenMap]);

  const archivedDailyCount = archivedAdminRecords.length;

  const importedActiveDailyItems = useMemo(
    () => dailyRecords.filter(r => r.isImportedOrFiltered),
    [dailyRecords]
  );

  const completedActiveDailyItems = useMemo(
    () => dailyRecords.filter(r => r.hasCompleted || r.hasRejection),
    [dailyRecords]
  );

  const handleConfirmArchiveClear = (mode: 'imported' | 'completed' | 'all_visible') => {
    const targets =
      mode === 'imported'
        ? importedActiveDailyItems
        : mode === 'completed'
        ? completedActiveDailyItems
        : dailyRecords;
    const citizenIds = targets.map(t => t.citizen.Citizen_ID).filter(Boolean);
    const requestIds = targets.flatMap(t => t.requests.map(r => r.Request_ID)).filter(Boolean);
    if (citizenIds.length === 0 && requestIds.length === 0) {
      setArchiveConfirmMode('none');
      return;
    }
    const res = archiveDailyWorkItems({
      citizenIds,
      requestIds,
      sectionKey: 'admin',
      reason:
        mode === 'imported'
          ? 'أرشفة مستقلة في قسم الإدارة للسجلات المستردة/المصفاة دون التأثير على بقية الأقسام'
          : mode === 'completed'
          ? 'أرشفة مستقلة في قسم الإدارة للمعاملات المكتملة دون التأثير على بقية الأقسام'
          : 'أرشفة مستقلة في قسم الإدارة للسجلات المعروضة مع بقائها محفوظة بالكامل في Firestore'
    });
    setArchiveConfirmMode('none');
    setCurrentPage(1);
    showBlockBanner(
      'success',
      `✓ تمت أرشفة (${res.archivedCitizens}) سجل في أرشيف قسم الإدارة فقط دون التأثير على بقية الأقسام ودون أي حذف.`
    );
  };

  // Filter active OR section-archived records depending on current viewMode
  const sourceRecordsForView = viewMode === 'section_archive' ? archivedAdminRecords : dailyRecords;

  const filteredDailyRecords = useMemo(() => {
    return sourceRecordsForView.filter(item => {
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
  }, [sourceRecordsForView, searchTerm, statusFilter, districtFilter]);

  // Districts list for filter dropdown
  const allDistricts = useMemo(() => {
    const set = new Set<string>();
    citizens.forEach(c => { if (c.District) set.add(c.District); });
    return Array.from(set);
  }, [citizens]);

  // High-performance slice to render max 25/50/100 cards at once without DOM lag
  const totalPages = Math.ceil(filteredDailyRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDailyRecords.slice(start, start + pageSize);
  }, [filteredDailyRecords, currentPage, pageSize]);

  // Export ONLY the currently filtered Daily Work records (strictly today's newly registered records in 'daily' mode)
  // Never pulls full database or historical archive; preserves delivery status column & clean RTL print formatting without charts.
  const handleExportDailyWorkExcel = () => {
    const exportItems =
      viewMode === 'daily'
        ? filteredDailyRecords.filter(item => {
            if (isHistoricalOrImportedRecord(item.citizen)) return false;
            const hasTodayReq = item.requests.some(r => isRecordRegisteredToday(r, todayLocalYmd));
            return hasTodayReq || isRecordRegisteredToday(item.citizen, todayLocalYmd);
          })
        : filteredDailyRecords;

    if (exportItems.length === 0) {
      showBlockBanner(
        'error',
        viewMode === 'daily'
          ? `لا توجد معاملات مسجلة حديثاً لهذا اليوم (${todayLocalYmd}) لتصديرها في ملف Excel.`
          : 'لا توجد سجلات معروضة في أرشيف العمل اليومي لتصديرها.'
      );
      return;
    }

    const rows: Record<string, string | number>[] = [];
    let serial = 1;

    for (const item of exportItems) {
      const cit = item.citizen;
      const reqsToExport =
        viewMode === 'daily'
          ? item.requests.filter(r => isRecordRegisteredToday(r, todayLocalYmd))
          : item.requests;

      if (reqsToExport.length > 0) {
        for (const req of reqsToExport) {
          const deliveryStatus =
            req.DeliveryStatus === 'مستلم' || req.RequestStatus === 'مستلم' ? 'مستلم' : 'غير مستلم';
          rows.push({
            'ت': serial++,
            'رقم المراجع': cit.Citizen_ID || '',
            'رقم المعاملة': req.Request_ID || '',
            'اسم صاحب الطلب': cit.FullName || req.CitizenName || '',
            'رقم الهاتف': cit.Phone1 || req.CitizenPhone || '',
            'القضاء / السكن': [cit.District, cit.SubDistrict].filter(Boolean).join(' - ') || req.Address || '',
            'الجهة / الوزارة': req.Entity || '',
            'موضوع الطلب': req.Details || '',
            'قرار مدير المكتب': req.DirectorDecision || 'بانتظار المدير',
            'حالة المعاملة': req.ProcessingStatus || 'قيد الإجراء',
            'حالة الاستلام (مستلم أم غير مستلم)': deliveryStatus,
            'رقم الصادر': req.OutgoingNumber || '',
            'تاريخ الصادر': req.OutgoingDate || '',
            'المعرف / التزكية': cit.ReferralSource || req.ReferralSource || '',
            'ملاحظات الاستعلامات': req.ReceptionNotes || '',
            'توجيه وملاحظات المدير': req.DirectorNotes || '',
            'تاريخ التسجيل': req.CreatedAt || cit.CreatedAt || todayLocalYmd
          });
        }
      } else {
        rows.push({
          'ت': serial++,
          'رقم المراجع': cit.Citizen_ID || '',
          'رقم المعاملة': '',
          'اسم صاحب الطلب': cit.FullName || '',
          'رقم الهاتف': cit.Phone1 || '',
          'القضاء / السكن': [cit.District, cit.SubDistrict].filter(Boolean).join(' - '),
          'الجهة / الوزارة': '',
          'موضوع الطلب': '',
          'قرار مدير المكتب': 'بانتظار المدير',
          'حالة المعاملة': 'قيد الإجراء',
          'حالة الاستلام (مستلم أم غير مستلم)': 'غير مستلم',
          'رقم الصادر': '',
          'تاريخ الصادر': '',
          'المعرف / التزكية': cit.ReferralSource || '',
          'ملاحظات الاستعلامات': '',
          'توجيه وملاحظات المدير': '',
          'تاريخ التسجيل': cit.CreatedAt || todayLocalYmd
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 18 },
      { wch: 28 },
      { wch: 15 },
      { wch: 22 },
      { wch: 26 },
      { wch: 36 },
      { wch: 16 },
      { wch: 16 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 28 },
      { wch: 28 },
      { wch: 18 }
    ];
    (ws as any)['!views'] = [{ rightToLeft: true }];

    const wb = XLSX.utils.book_new();
    const sheetName = viewMode === 'daily' ? `الأعمال_اليومية_${todayLocalYmd}` : `أرشيف_العمل_اليومي`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

    const fileName =
      viewMode === 'daily'
        ? `الأعمال_اليومية_${todayLocalYmd}.xlsx`
        : `أرشيف_العمل_اليومي_${todayLocalYmd}.xlsx`;
    XLSX.writeFile(wb, fileName);

    addAuditLog(
      'تنزيل Excel للأعمال اليومية',
      'قسم الإدارة — الأعمال اليومية',
      `تم تصدير (${rows.length}) سجل مطابق تماماً لجدول ${viewMode === 'daily' ? `الأعمال اليومية المسجلة بتاريخ اليوم (${todayLocalYmd}) حصراً` : 'أرشيف العمل اليومي'} في الملف ${fileName}`
    );
    showBlockBanner(
      'success',
      `✓ تم تنزيل ملف Excel (${fileName}) بعدد (${rows.length}) سجل مطابق تماماً للجدول المصفّى ${viewMode === 'daily' ? 'لمعاملات اليوم حصراً' : ''}.`
    );
  };

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
            <span className="text-xs bg-emerald-500/20 text-emerald-200 px-3 py-1.5 rounded-xl border border-emerald-400/30 font-black font-mono">
              معاملات اليوم حصراً: {todayLocalYmd}
            </span>
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

          <div className="mr-auto flex items-center gap-2 flex-wrap">
            {/* Export Daily Work Filtered Excel Button (strictly today's newly registered records only) */}
            <button
              type="button"
              onClick={handleExportDailyWorkExcel}
              className="px-3 py-1 rounded-lg font-black transition-all cursor-pointer flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 border border-teal-300 shadow-xs active:scale-95"
              title={
                viewMode === 'daily'
                  ? `تنزيل ملف Excel لمعاملات اليوم (${todayLocalYmd}) المسجلة حديثاً والمطابقة للجدول المصفى حصراً`
                  : 'تنزيل ملف Excel لسجلات أرشيف العمل اليومي المعروضة حالياً'
              }
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {viewMode === 'daily'
                  ? `تنزيل Excel لليوم فقط (${filteredDailyRecords.length})`
                  : `تنزيل Excel المؤرشف (${filteredDailyRecords.length})`}
              </span>
            </button>

            {/* Independent Section Archive Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setViewMode(prev => (prev === 'daily' ? 'section_archive' : 'daily'));
                setArchiveConfirmMode('none');
              }}
              className={`px-3 py-1 rounded-lg font-black transition-all cursor-pointer flex items-center gap-1.5 border shadow-xs active:scale-95 ${
                viewMode === 'section_archive'
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-white/15 hover:bg-white/25 text-white border-white/25'
              }`}
              title="استعراض السجلات المؤرشفة داخل قسم الإدارة (أرشيف العمل اليومي) مع إمكانية إرجاع أي سجل للعمل اليومي"
            >
              {viewMode === 'section_archive' ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>العودة للعمل اليومي ({dailyRecords.length})</span>
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5 text-amber-300" />
                  <span>أرشيف العمل اليومي / الإدارة ({archivedDailyCount.toLocaleString()})</span>
                </>
              )}
            </button>

            {viewMode === 'daily' && importedActiveDailyItems.length > 0 && (
              <button
                type="button"
                onClick={() => handleConfirmArchiveClear('imported')}
                className="px-3 py-1 rounded-lg font-black transition-all cursor-pointer flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 shadow-sm active:scale-95"
                title="أرشفة السجلات المستردة/المصفاة في أرشيف قسم الإدارة فقط دون التأثير على بقية الأقسام"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>أرشفة المسترد/المصفى ({importedActiveDailyItems.length})</span>
              </button>
            )}

            {viewMode === 'daily' && dailyRecords.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setArchiveConfirmMode(prev =>
                    prev === 'none'
                      ? importedActiveDailyItems.length > 0
                        ? 'imported'
                        : completedActiveDailyItems.length > 0
                        ? 'completed'
                        : 'all_visible'
                      : 'none'
                  )
                }
                className="px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 border border-emerald-400/40"
                title="أرشفة السجلات في قسم الإدارة فقط وإخراجها من العمل اليومي مع بقائها محفوظة بالكامل"
              >
                <Archive className="w-3.5 h-3.5 text-emerald-300" />
                <span>
                  {completedActiveDailyItems.length > 0
                    ? `أرشفة المكتمل (${completedActiveDailyItems.length})`
                    : `أرشفة العمل اليومي (${dailyRecords.length})`}
                </span>
              </button>
            )}

            {viewMode === 'section_archive' && filteredDailyRecords.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const res = restoreDailyWorkItems({
                    citizenIds: filteredDailyRecords.map(r => r.citizen.Citizen_ID),
                    requestIds: filteredDailyRecords.flatMap(r => r.requests.map(req => req.Request_ID)),
                    sectionKey: 'admin'
                  });
                  showBlockBanner(
                    'success',
                    `✓ تم إرجاع (${res.restoredCitizens}) سجل إلى العمل اليومي لقسم الإدارة بنجاح.`
                  );
                }}
                className="px-3 py-1 rounded-lg font-black transition-all cursor-pointer flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-300 shadow-sm active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إرجاع الكل المعروض للعمل اليومي ({filteredDailyRecords.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Safe Non-Destructive In-Place Archive Bar (Never leaves Daily Work & Never deletes) */}
        {archiveConfirmMode !== 'none' && (
          <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-emerald-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="space-y-0.5">
              <div className="font-black text-emerald-300 flex items-center gap-1.5">
                <Archive className="w-4 h-4 shrink-0" />
                <span>أرشفة وإخراج من العمل اليومي (يبقى كل شيء محفوظاً في القاعدة والأرشيف)</span>
              </div>
              <p className="text-[11px] text-slate-200/90">
                سيتم تعيين حالة السجلات إلى «مؤرشف» في Firebase Firestore و Google Sheet وإخراجها فوراً من عرض العمل اليومي مع بقائك في شاشتك الحالية دون أي حذف.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {importedActiveDailyItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleConfirmArchiveClear('imported')}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] cursor-pointer transition-colors"
                >
                  أرشفة المسترد/المصفى ({importedActiveDailyItems.length})
                </button>
              )}
              {completedActiveDailyItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleConfirmArchiveClear('completed')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] cursor-pointer transition-colors"
                >
                  أرشفة المكتمل ({completedActiveDailyItems.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => handleConfirmArchiveClear('all_visible')}
                className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-black text-[11px] cursor-pointer transition-colors"
              >
                أرشفة الكل المعروض ({dailyRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setArchiveConfirmMode('none')}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>

      {/* REAL-TIME LIVE STATUS BAR: آخر اسم مسجل + آخر عدد صادر مسجل + العدد القادم المقترح + صادر موحد + أرشيف صور Drive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border-2 border-amber-400/50 dark:border-amber-500/40 shadow-sm">
        {/* Card 1: آخر اسم مكتمل طلبه بالإدارة */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">آخر اسم مكتمل طلبه بالإدارة:</span>
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                مباشر
              </span>
            </div>
            <div className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate mt-0.5" title={lastCompletedAdminCitizen?.citizen.FullName || 'لا يوجد'}>
              {lastCompletedAdminCitizen?.citizen.FullName || 'لا يوجد طلب منجز بعد'}
            </div>
            {lastCompletedAdminCitizen && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 font-mono mt-0.5" dir="ltr">
                <span>الصادر: {lastCompletedAdminCitizen.outgoingNumber}</span>
                <span>•</span>
                <span>{lastCompletedAdminCitizen.citizen.District || 'المركز'}</span>
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

        {/* Card 3: العدد القادم المقترح تلقائياً مع تبديل المكتب (الناصرية ن / سوق الشيوخ س) */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 flex items-center justify-center shrink-0">
            <Hash className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 block">العدد القادم المقترح:</span>
              <div className="inline-flex items-center rounded-lg bg-emerald-100/90 dark:bg-emerald-900/70 p-0.5 border border-emerald-300/70 dark:border-emerald-700">
                <button
                  type="button"
                  onClick={() => updateSystemSettings({ officeBranch: 'nasiriyah' })}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all cursor-pointer ${
                    systemSettings?.officeBranch !== 'suq_al_shuyoukh'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/70'
                  }`}
                  title="مكتب الناصرية (بادئة ن)"
                >
                  الناصرية (ن)
                </button>
                <button
                  type="button"
                  onClick={() => updateSystemSettings({ officeBranch: 'suq_al_shuyoukh' })}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black transition-all cursor-pointer ${
                    systemSettings?.officeBranch === 'suq_al_shuyoukh'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/70'
                  }`}
                  title="مكتب سوق الشيوخ (بادئة س)"
                >
                  سوق الشيوخ (س)
                </button>
              </div>
            </div>
            {isEditingManualCounter ? (
              <div className="mt-1 space-y-1.5">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={manualCounterInput}
                    onChange={e => setManualCounterInput(e.target.value)}
                    placeholder="مثلاً: 3344"
                    className="w-24 h-7 px-2 rounded-md border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    disabled={isSavingManualCounter}
                    onClick={handleSaveManualCounter}
                    className="px-2.5 h-7 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black cursor-pointer"
                  >
                    {isSavingManualCounter ? '...' : 'حفظ'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingManualCounter(false);
                      setManualCounterInput('');
                      setManualDateInput('');
                    }}
                    className="px-1.5 h-7 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={manualDateInput}
                    onChange={e => setManualDateInput(e.target.value)}
                    title="تاريخ الصادر المخصص (اتركه فارغاً ليعتمد تاريخ اليوم تلقائياً)"
                    className="flex-1 h-7 px-1.5 rounded-md border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-[10px] font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                  />
                  {manualDateInput && (
                    <button
                      type="button"
                      onClick={() => setManualDateInput('')}
                      className="px-1.5 h-7 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[9px] font-bold cursor-pointer whitespace-nowrap"
                      title="إرجاع التاريخ تلقائياً لتاريخ اليوم"
                    >
                      اليوم
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="font-black text-sm font-mono text-emerald-950 dark:text-emerald-100 mt-0.5 flex items-center justify-between gap-1">
                  <span dir="ltr">{nextAutoOutgoingNumber}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setManualCounterInput(String(outgoingComputed.maxFound || ''));
                      setManualDateInput((systemSettings?.defaultOutgoingDate || '').trim());
                      setIsEditingManualCounter(true);
                    }}
                    className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-800 dark:text-emerald-200 text-[9px] font-bold cursor-pointer"
                    title="تعديل رقم الصادر والتاريخ يدوياً"
                  >
                    تعديل الصادر والتاريخ
                  </button>
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                  التالي بعد ({outgoingComputed.maxFound || 0}) • التاريخ:{' '}
                  {(systemSettings?.defaultOutgoingDate && systemSettings.defaultOutgoingDate.trim())
                    ? `${systemSettings.defaultOutgoingDate.trim()} (مخصص)`
                    : `${getLocalTodayIsoDate()} (اليوم)`}
                </div>
              </>
            )}
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

        {/* Card 5: أرشيف صور المعاملات (Google Drive) */}
        <div className="flex items-center p-1">
          <button
            type="button"
            onClick={() => {
              setDriveModalCitizen(null);
              setDriveModalRequest(null);
              setIsDriveArchiveOpen(true);
            }}
            className="w-full h-full min-h-[58px] px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-900 hover:from-emerald-800 hover:to-teal-900 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-700/20 transition-all active:scale-95 border border-emerald-400/80"
          >
            <FolderKanban className="w-5 h-5 text-emerald-200 shrink-0" />
            <div className="text-right">
              <span className="block text-xs font-black">أرشيف صور المعاملات 📁</span>
              <span className="text-[10px] text-emerald-200 font-normal">Google Drive • بحث ورفع وتحديث</span>
            </div>
          </button>
        </div>
      </div>

      {/* Inline Block / Blacklist Status Banner */}
      {blockStatusBanner && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 border shadow-xs animate-in fade-in ${
            blockStatusBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-200'
              : 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/60 dark:border-rose-700 dark:text-rose-200'
          }`}
        >
          <span>{blockStatusBanner.text}</span>
          <button
            type="button"
            onClick={() => setBlockStatusBanner(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold px-1.5"
          >
            ✕
          </button>
        </div>
      )}

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
                      processingStatus: savedOfficialCard.status,
                      deliveryStatus: savedOfficialCard.deliveryStatus,
                      notes: savedOfficialCard.notes,
                      attachedImage: savedOfficialCard.attachedImage,
                      officeName: systemSettings.officeName || systemSettings.appName,
                      deputyName: systemSettings.deputyName,
                      emblemUrl: systemSettings.parliamentEmblemUrl || systemSettings.logoUrl
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

      {/* Section Archive Context Banner when viewing archived records of Admin */}
      {viewMode === 'section_archive' && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-950 dark:text-amber-100 font-black">
            <Archive className="w-4 h-4 text-amber-600 shrink-0" />
            <span>أنت تستعرض الآن: الأرشيف الخاص بقسم الإدارة ({archivedDailyCount.toLocaleString()} سجل) — أرشفة مستقلة لا تؤثر على بقية الأقسام</span>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>العودة للعمل اليومي</span>
          </button>
        </div>
      )}

      {/* Main Citizens Cards Grid with High-Performance Pagination */}
      <div id="daily-records-list" className="space-y-3">
        {/* Top Pagination Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700 dark:text-slate-200">
              عرض {filteredDailyRecords.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, filteredDailyRecords.length)} من أصل ({filteredDailyRecords.length.toLocaleString()}) مراجع
            </span>
            {totalPages > 1 && (
              <span className="text-[11px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono font-bold px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                صفحة {currentPage} من {totalPages}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-medium">لكل صفحة:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value={25}>25 مراجع</option>
                <option value={50}>50 مراجع</option>
                <option value={100}>100 مراجع</option>
                <option value={250}>250 مراجع</option>
              </select>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 font-mono">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-xs font-bold cursor-pointer"
                  title="الصفحة الأولى"
                >
                  ««
                </button>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-xs font-bold cursor-pointer"
                  title="السابق"
                >
                  السابق
                </button>

                <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs">
                  {currentPage}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-xs font-bold cursor-pointer"
                  title="التالي"
                >
                  التالي
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-xs font-bold cursor-pointer"
                  title="الصفحة الأخيرة"
                >
                  »»
                </button>
              </div>
            )}
          </div>
        </div>

        {filteredDailyRecords.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2 shadow-xs">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">لا توجد سجلات مطابقة للبحث أو التصفية</h4>
            <p className="text-xs text-slate-400">يرجى تغيير معايير البحث أو استعراض كافة السجلات.</p>
          </div>
        ) : (
          paginatedRecords.map((item) => {
            const cit = item.citizen;
            const citReqs = item.requests;
            const primaryReq = citReqs[0];

            // Color status styles based on director decision + live blacklist check
            const liveBlockInfo = cit.IsBlocked ? { isBlocked: true, citizen: cit } : checkIfCitizenBlocked(cit.FullName, cit.Phone1);
            const isBlocked = Boolean(cit.IsBlocked || liveBlockInfo.isBlocked);
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

                {/* Reception Notes if available */}
                {primaryReq?.ReceptionNotes && (
                  <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 text-sky-950 dark:text-sky-100 text-xs font-bold flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-1.5">
                      <span>📌 ملاحظات موظف الاستعلامات:</span>
                      <span className="font-normal">{primaryReq.ReceptionNotes}</span>
                    </span>
                  </div>
                )}

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
                      if (isBlocked) {
                        const matchedCit = liveBlockInfo.citizen || cit;
                        setBlockedCompleteWarningTarget({
                          citizen: cit,
                          request: primaryReq,
                          matchedBlockedCitizen: matchedCit,
                          reason: matchedCit.BlockReason || cit.BlockReason || liveBlockInfo.reason || 'مدرج في القائمة السوداء'
                        });
                        return;
                      }
                      handleOpenCompleteRequest(cit, primaryReq, false);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-95 ${
                      isBlocked
                        ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-300 dark:ring-rose-800'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                    }`}
                    title={isBlocked ? 'تنبيه: هذا الاسم محظور — اضغط لعرض خيارات إلغاء الحظر أو الاستمرار بحذر' : 'استكمال بيانات المعاملة وتوثيق رقم الصادر الرسمي'}
                  >
                    {isBlocked ? (
                      <AlertTriangle className="w-4 h-4 text-amber-200" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    )}
                    <span>{isBlocked ? 'إكمال الطلب (محظور ⚠️)' : 'إكمال الطلب'}</span>
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

                  {/* Google Drive & Photos Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setDriveModalCitizen(cit);
                      setDriveModalRequest(primaryReq);
                      setIsDriveArchiveOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-emerald-200 dark:border-emerald-800 shadow-2xs"
                    title="فتح صور ومستندات المعاملة على Google Drive والرفع المباشر"
                  >
                    <FolderKanban className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>صور و Drive 🖼️</span>
                  </button>

                  {/* Per-Section Archive OR Restore to Daily Work Button */}
                  {item.isArchived ? (
                    <button
                      type="button"
                      onClick={() => {
                        restoreDailyWorkItem(
                          cit.Citizen_ID,
                          citReqs.map(r => r.Request_ID),
                          'admin'
                        );
                        showBlockBanner(
                          'success',
                          `✓ تم إرجاع (${cit.FullName}) إلى قائمة العمل اليومي لقسم الإدارة بنجاح.`
                        );
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-95"
                      title="إرجاع هذا السجل من أرشيف قسم الإدارة إلى قائمة العمل اليومي فوراً"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إرجاع للعمل اليومي</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        archiveDailyWorkItems({
                          citizenIds: [cit.Citizen_ID],
                          requestIds: citReqs.map(r => r.Request_ID),
                          sectionKey: 'admin',
                          reason: 'أرشفة مستقلة في قسم الإدارة (محفوظ بالكامل في القاعدة ولا يؤثر على بقية الأقسام)'
                        });
                        showBlockBanner(
                          'success',
                          `✓ تمت أرشفة (${cit.FullName}) في أرشيف قسم الإدارة فقط وإخراجه من العمل اليومي للإدارة دون التأثير على بقية الأقسام.`
                        );
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 text-xs font-black flex items-center gap-1.5 cursor-pointer border border-amber-300 dark:border-amber-700 transition-transform active:scale-95"
                      title="أرشفة مستقلة في قسم الإدارة فقط (يختفي من العمل اليومي للإدارة ويبقى محفوظاً ومشاهداً في بقية الأقسام)"
                    >
                      <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>أرشفة</span>
                    </button>
                  )}

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
                  {isBlocked ? (
                    pendingUnblockCitizenId === cit.Citizen_ID ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const matchedBlockedId = liveBlockInfo.citizen?.Citizen_ID;
                            if (matchedBlockedId && matchedBlockedId !== cit.Citizen_ID) {
                              unblockCitizen(matchedBlockedId);
                            }
                            unblockCitizen(cit.Citizen_ID);
                            setPendingUnblockCitizenId(null);
                            showBlockBanner('success', `✓ تم بنجاح إلغاء الحظر عن (${cit.FullName}) وإعادته للوضع الطبيعي.`);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-transform"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                          <span>تأكيد إلغاء الحظر</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingUnblockCitizenId(null)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                        >
                          تراجع
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingUnblockCitizenId(cit.Citizen_ID)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 transition-transform"
                        title="إلغاء الحظر وإعادة المراجع إلى الوضع الطبيعي"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-200" />
                        <span>إلغاء الحظر</span>
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setBlockingTarget(cit);
                        setBlockReasonInput('');
                        setBlockModalError(null);
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

                  {/* Delivery Status Toggle (مستلم / غير مستلم) */}
                  {primaryReq && (
                    <button
                      type="button"
                      onClick={() => {
                        const isDelivered = primaryReq.DeliveryStatus === 'مستلم' || primaryReq.RequestStatus === 'مستلم';
                        const nextDelivery: 'مستلم' | 'غير مستلم' = isDelivered ? 'غير مستلم' : 'مستلم';
                        updateRequest({
                          ...primaryReq,
                          DeliveryStatus: nextDelivery,
                          RequestStatus: nextDelivery,
                          DeliveredAt: nextDelivery === 'مستلم' ? new Date().toISOString().split('T')[0] : undefined,
                          DeliveredBy: nextDelivery === 'مستلم' ? (currentUser?.FullName || 'موظف الإدارة') : undefined
                        });
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer border transition-colors ${
                        (primaryReq.DeliveryStatus === 'مستلم' || primaryReq.RequestStatus === 'مستلم')
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                      }`}
                      title="تبديل حالة استلام المواطن للكتاب بعد الإنجاز (مستلم / غير مستلم)"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>{(primaryReq.DeliveryStatus === 'مستلم' || primaryReq.RequestStatus === 'مستلم') ? 'مستلم ✓' : 'غير مستلم'}</span>
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
                          processingStatus: primaryReq.ProcessingStatus,
                          deliveryStatus: primaryReq.DeliveryStatus || (primaryReq.RequestStatus === 'مستلم' ? 'مستلم' : 'غير مستلم'),
                          officeName: systemSettings.officeName || systemSettings.appName,
                          deputyName: systemSettings.deputyName,
                          emblemUrl: systemSettings.parliamentEmblemUrl || systemSettings.logoUrl,
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

        {/* Bottom Pagination Toolbar */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs shadow-2xs mt-3">
            <span className="font-bold text-slate-600 dark:text-slate-300">
              الصفحة {currentPage} من {totalPages} (إجمالي {filteredDailyRecords.length.toLocaleString()} مراجع)
            </span>

            <div className="flex items-center gap-1 font-mono">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => {
                  setCurrentPage(1);
                  document.getElementById('daily-records-list')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-xs font-bold cursor-pointer"
                title="الصفحة الأولى"
              >
                ««
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1));
                  document.getElementById('daily-records-list')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-xs font-bold cursor-pointer"
                title="السابق"
              >
                السابق
              </button>

              <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs">
                {currentPage}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1));
                  document.getElementById('daily-records-list')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-xs font-bold cursor-pointer"
                title="التالي"
              >
                التالي
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => {
                  setCurrentPage(totalPages);
                  document.getElementById('daily-records-list')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 text-xs font-bold cursor-pointer"
                title="الصفحة الأخيرة"
              >
                »»
              </button>
            </div>
          </div>
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
              {(completingTarget.citizen.IsBlocked || allowBlockedOverride) && (
                <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/50 border-2 border-red-500 text-red-950 dark:text-red-100 space-y-1 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⛔</span>
                    <h4 className="font-black text-xs text-red-900 dark:text-red-200">
                      تنبيه: هذا الاسم محظور — {allowBlockedOverride ? 'وضع الاستمرار بحذر مُفعّل' : 'مدرج في القائمة السوداء'}
                    </h4>
                  </div>
                  <p className="text-[11px] text-red-800 dark:text-red-200 font-bold">
                    سبب الحظر: {completingTarget.citizen.BlockReason || 'غير محدد'}
                    {completingTarget.citizen.BlockedAt ? ` • تاريخ الحظر: ${completingTarget.citizen.BlockedAt}` : ''}
                    {completingTarget.citizen.BlockedBy ? ` • بواسطة: ${completingTarget.citizen.BlockedBy}` : ''}
                  </p>
                  <p className="text-[10px] text-red-700 dark:text-red-300 font-black">
                    {allowBlockedOverride
                      ? '⚠️ تم تفعيل الاستمرار بحذر وفق صلاحيتك — سيتم توثيق هذا الإجراء تلقائياً في سجل التدقيق الإداري.'
                      : '🚫 يمنع النظام استكمال المعاملة أو إصدار كتاب صادر رسمي لهذا الشخص قبل إلغاء الحظر أو تفعيل خيار الاستمرار بحذر.'}
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
                    category="Entity"
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
                    حالة الإنجاز:
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

                {/* 9b. حالة استلام المواطن بعد الإنجاز */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    حالة الاستلام (بعد الإنجاز):
                  </label>
                  <select
                    value={formDeliveryStatus}
                    onChange={(e) => setFormDeliveryStatus(e.target.value as 'مستلم' | 'غير مستلم')}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="غير مستلم">غير مستلم (بانتظار مراجعة المواطن للاستلام)</option>
                    <option value="مستلم">مستلم ✓ (تم التسليم للمواطن)</option>
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

      {/* Modal 6 below handles Block / Blacklist Reason cleanly without duplicate overlay */}

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
                      category="District"
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
                      category="Surname"
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
                        category="Entity"
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
                    category="Entity"
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
      {/* ======================================================== */}
      {/* MODAL 6: تأكيد الحظر الإداري والقائمة السوداء               */}
      {/* ======================================================== */}
      {blockingTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-red-500 max-w-md w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center gap-3 border-b border-red-100 dark:border-red-950/60 pb-3">
              <span className="p-3 rounded-2xl bg-red-100 dark:bg-red-950 text-red-600 border border-red-200 dark:border-red-800 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  حظر المراجع وإدراجه في القائمة السوداء
                </h3>
                <p className="text-xs text-red-600 dark:text-red-400 font-bold">
                  سيتم إدراج الشخص بالقائمة السوداء ومنع ترويج معاملاته فوراً
                </p>
              </div>
            </div>

            <div className="p-3 bg-red-50/70 dark:bg-red-950/30 rounded-2xl border border-red-200 dark:border-red-900/40 text-xs space-y-1">
              <div>
                <span className="text-slate-500 block text-[10px]">اسم المواطن:</span>
                <span className="font-black text-slate-900 dark:text-white text-sm">{blockingTarget.FullName}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span>رقم الهاتف: {blockingTarget.Phone1 || 'غير مسجل'}</span>
                <span>القضاء: {blockingTarget.District || 'ذي قار'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                سبب الحظر الإداري أو الأمني: <span className="text-rose-500">*</span>
              </label>
              
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['مخالفة سلوكية وتجاوز', 'بيانات غير صحيحة أو تزوير', 'توجيه إداري من مدير المكتب', 'عدم استحقاق / مراجع مكرر'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBlockReasonInput(preset)}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                required
                value={blockReasonInput}
                onChange={(e) => {
                  setBlockReasonInput(e.target.value);
                  if (blockModalError) setBlockModalError(null);
                }}
                placeholder="اكتب سبب الحظر الإداري أو الأمني بالتفصيل ليظهر لجميع موظفي المكتب..."
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              {blockModalError && (
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-1">{blockModalError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setBlockingTarget(null);
                  setBlockReasonInput('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-red-600/30 active:scale-95 transition-transform"
              >
                <ShieldAlert className="w-4 h-4 text-red-200" />
                <span>تأكيد الحظر والإدراج ⛔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 7: تأكيد رفض الطلب (Direct Rejection Confirmation)    */}
      {/* ======================================================== */}
      {rejectingTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-rose-400 max-w-md w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center gap-3 border-b border-rose-100 dark:border-rose-950/60 pb-3">
              <span className="p-3 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 border border-rose-200 dark:border-rose-800 shrink-0">
                <XCircle className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  رفض طلب المعاملة
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                  تثبيت قرار الرفض الإداري مع توثيق السبب
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div>
                <span className="text-slate-500 block text-[10px]">صاحب المعاملة:</span>
                <span className="font-black text-slate-900 dark:text-white">{rejectingTarget.citizen.FullName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">موضوع المعاملة:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{rejectingTarget.request.Details}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                سبب الرفض الإداري: <span className="text-rose-500">*</span>
              </label>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {['عدم استيفاء الشروط القانونية', 'خارج صلاحيات واختصاص المكتب', 'سبق وأن تم شموله بمشروع مماثل', 'نقص في الأوليات والمستمسكات'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectionReasonInput(preset)}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                required
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="اكتب سبب الرفض الإداري بوضوح..."
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setRejectingTarget(null);
                  setRejectionReasonInput('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmRejection}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/30 active:scale-95 transition-transform"
              >
                <XCircle className="w-4 h-4 text-rose-200" />
                <span>تثبيت قرار الرفض</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Citizen Warning Modal on "إكمال الطلب" */}
      {blockedCompleteWarningTarget && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          dir="rtl"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-rose-500 max-w-lg w-full p-6 shadow-2xl space-y-4 text-right animate-in zoom-in-95">
            <div className="flex items-start gap-3 pb-3 border-b border-rose-100 dark:border-rose-900/60">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black mb-1">
                  تنبيه القائمة السوداء الفوري
                </span>
                <h3 className="text-base font-black text-rose-700 dark:text-rose-300">
                  تنبيه: هذا الاسم محظور!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-semibold">
                  المراجع <strong className="text-slate-900 dark:text-white">{blockedCompleteWarningTarget.citizen.FullName}</strong> مدرج ضمن قائمة المحظورين في النظام.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/70 text-xs space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="font-black text-rose-700 dark:text-rose-300 shrink-0">سبب الحظر:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {blockedCompleteWarningTarget.reason}
                </span>
              </div>
              {blockedCompleteWarningTarget.matchedBlockedCitizen.BlockedAt && (
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  تاريخ الحظر: <span className="font-mono font-bold">{blockedCompleteWarningTarget.matchedBlockedCitizen.BlockedAt}</span>
                  {blockedCompleteWarningTarget.matchedBlockedCitizen.BlockedBy
                    ? ` • بواسطة: ${blockedCompleteWarningTarget.matchedBlockedCitizen.BlockedBy}`
                    : ''}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const { citizen, request, matchedBlockedCitizen } = blockedCompleteWarningTarget;
                  unblockCitizen(matchedBlockedCitizen.Citizen_ID);
                  if (citizen.Citizen_ID !== matchedBlockedCitizen.Citizen_ID) {
                    unblockCitizen(citizen.Citizen_ID);
                  }
                  const unblockedCitizen: Citizen = {
                    ...citizen,
                    IsBlocked: false,
                    BlockReason: undefined,
                    BlockedAt: undefined,
                    BlockedBy: undefined
                  };
                  setBlockedCompleteWarningTarget(null);
                  showBlockBanner('success', `✓ تم إلغاء الحظر عن (${citizen.FullName}) بنجاح — يمكنك إكمال الطلب الآن.`);
                  handleOpenCompleteRequest(unblockedCitizen, request, false);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 transition-all active:scale-[0.99]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>إلغاء الحظر وإكمال الطلب</span>
              </button>

              {canProceedCautiouslyWithBlocked && (
                <button
                  type="button"
                  onClick={() => {
                    const { citizen, request } = blockedCompleteWarningTarget;
                    setBlockedCompleteWarningTarget(null);
                    handleOpenCompleteRequest(citizen, request, true);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all active:scale-[0.99]"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>الاستمرار بحذر في إكمال الطلب (مع إبقاء الحظر)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setBlockedCompleteWarningTarget(null)}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer transition-colors"
              >
                تراجع وإلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Transaction Archive Modal */}
      <GoogleDriveArchiveModal
        isOpen={isDriveArchiveOpen}
        onClose={() => {
          setIsDriveArchiveOpen(false);
          setDriveModalCitizen(null);
          setDriveModalRequest(null);
        }}
        targetCitizen={driveModalCitizen}
        targetRequest={driveModalRequest}
        onAttachFileToRequest={(fileUrl) => {
          if (driveModalRequest) {
            updateRequest({
              ...driveModalRequest,
              AttachmentRequest: fileUrl
            });
          }
        }}
      />
    </div>
  );
};
