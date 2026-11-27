import React, { useState, useEffect, useMemo } from 'react';
import {
  OrgFinalResult,
  OrgFinalEvaluation,
  OrganizationRecord,
  Citizen,
  OfficeRequest,
  OrgTeamMember
} from '../types';
import { useApp } from '../context/AppContext';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Star,
  Save,
  X,
  FileText,
  UserCheck,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  ClipboardList,
  ShieldCheck,
  User as UserIcon,
  Calendar,
  Hash,
  Globe,
  Heart,
  GraduationCap,
  Share2,
  Printer,
  Copy,
  Check,
  GitCommitHorizontal,
  FileCheck2,
  MessageSquareText,
  Bookmark,
  Stamp
} from 'lucide-react';

interface OrgFinalEvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  citizen?: Citizen | null;
  initialRecord?: OrganizationRecord | null;
  initialRequestId?: string;
  requests: OfficeRequest[];
  citizens: Citizen[];
  onSave: (record: OrganizationRecord, teamMemberToOpen?: OrgTeamMember | null) => void;
}

interface TimelineStep {
  id: string;
  stageLabel: string;
  title: string;
  timestamp: string;
  actor: string;
  details: string[];
  tone: 'navy' | 'gold' | 'emerald' | 'rose' | 'slate';
  sortOrder: number;
}

const escapeHtml = (val: string): string =>
  String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const parseTs = (raw?: string): number => {
  const s = String(raw || '').trim();
  if (!s) return 0;
  let t = Date.parse(s);
  if (Number.isNaN(t) && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s)) {
    t = Date.parse(s.replace(' ', 'T'));
  }
  return Number.isNaN(t) ? 0 : t;
};

const extractCustomField = (
  obj: Record<string, any> | undefined,
  keys: string[]
): string => {
  if (!obj) return '';
  for (const key of keys) {
    const val = obj[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim();
    }
  }
  // Case-insensitive / substring fallback
  const entries = Object.entries(obj);
  for (const [k, v] of entries) {
    if (v === undefined || v === null || String(v).trim() === '') continue;
    const lowerK = k.toLowerCase();
    if (keys.some(target => lowerK.includes(target.toLowerCase()))) {
      return String(v).trim();
    }
  }
  return '';
};

const renderFieldValue = (val?: string | null, mono?: boolean) => {
  const cleaned = String(val || '').trim();
  if (!cleaned) {
    return <span className="text-slate-400 italic font-normal text-xs">غير محدد</span>;
  }
  return (
    <span className={`font-bold text-slate-900 break-words ${mono ? 'font-mono tabular-nums' : ''}`}>
      {cleaned}
    </span>
  );
};

export const OrgFinalEvaluationModal: React.FC<OrgFinalEvaluationModalProps> = ({
  isOpen,
  onClose,
  citizen,
  initialRecord,
  initialRequestId,
  requests,
  citizens,
  onSave
}) => {
  const { systemSettings } = useApp();

  const [selectedCitizenId, setSelectedCitizenId] = useState(
    citizen?.Citizen_ID || initialRecord?.Citizen_ID || ''
  );
  const [selectedRequestId, setSelectedRequestId] = useState(initialRequestId || '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // The 4 main results:
  const [finalResult, setFinalResult] = useState<OrgFinalResult>('تم اكمال الطلب بالكامل');

  // Case 1 states:
  const [case1_goal, setCase1Goal] = useState<'نعم بالكامل' | 'نعم مع اجراء بسيط'>('نعم بالكامل');
  const [case1_satisfied, setCase1Satisfied] = useState<'نعم' | 'لا'>('نعم');
  const [case1_rating, setCase1Rating] = useState<number>(5);
  const [case1_returnedThanks, setCase1ReturnedThanks] = useState<'نعم' | 'لا'>('نعم');
  const [case1_notes, setCase1Notes] = useState('');

  // Case 2 states:
  const [case2_completed, setCase2Completed] = useState('');
  const [case2_uncompleted, setCase2Uncompleted] = useState('');
  const [case2_reason, setCase2Reason] = useState<string>('عدم اختصاص الجهة المعنية');
  const [case2_customReason, setCase2CustomReason] = useState('');
  const [case2_accepted, setCase2Accepted] = useState<'نعم' | 'لا'>('نعم');
  const [case2_officeNeedsExtra, setCase2OfficeNeedsExtra] = useState<'نعم' | 'لا'>('لا');
  const [case2_notes, setCase2Notes] = useState('');

  // Case 3 states:
  const [case3_followup, setCase3Followup] = useState<string[]>(['متابعة مع الجهة نفسها']);
  const [case3_officerNotes, setCase3OfficerNotes] = useState('');
  const [case3_serviceSatisfied, setCase3ServiceSatisfied] = useState<'نعم' | 'لا'>('نعم');
  const [case3_needsFollowup, setCase3NeedsFollowup] = useState<'نعم' | 'لا'>('نعم');
  const [case3_futureComm, setCase3FutureComm] = useState<'نعم' | 'لا'>('نعم');
  const [case3_seminarParticipation, setCase3SeminarParticipation] = useState<'نعم' | 'لا'>('نعم');
  const [case3_visitCount, setCase3VisitCount] = useState('2 - 3 مرات');
  const [case3_joinTeam, setCase3JoinTeam] = useState<'نعم' | 'لا'>('لا');
  const [case3_teamRole, setCase3TeamRole] = useState('مفتاح نهائي');

  // Case 4 states:
  const [case4_reason, setCase4Reason] = useState<string>('خارج اختصاص المكتب');
  const [case4_customReason, setCase4CustomReason] = useState('');
  const [case4_explained, setCase4Explained] = useState<'نعم' | 'لا'>('نعم');
  const [case4_stance, setCase4Stance] = useState<'متفهم' | 'غير متفهم' | 'غير راضي'>('متفهم');
  const [case4_notes, setCase4Notes] = useState('');

  // Sync & cleanly reset form state whenever modal opens or target citizen/record changes
  useEffect(() => {
    if (!isOpen) return;
    setValidationError(null);
    setCopiedSummary(false);

    const targetCid = citizen?.Citizen_ID || initialRecord?.Citizen_ID || '';
    setSelectedCitizenId(targetCid);

    const linkedReqs = requests.filter(r => r.Citizen_ID === targetCid);
    const ev = initialRecord?.finalEvaluation;

    setSelectedRequestId(initialRequestId || ev?.requestId || linkedReqs[0]?.Request_ID || '');

    if (ev) {
      setFinalResult(ev.finalResult || 'تم اكمال الطلب بالكامل');

      // Case 1
      setCase1Goal(ev.case1_citizenObtainedGoal || 'نعم بالكامل');
      setCase1Satisfied(ev.case1_citizenSatisfied || 'نعم');
      setCase1Rating(ev.case1_personalRating || 5);
      setCase1ReturnedThanks(ev.case1_citizenReturnedForThanks || 'نعم');
      setCase1Notes(ev.case1_officerNotes || '');

      // Case 2
      setCase2Completed(ev.case2_completedPart || '');
      setCase2Uncompleted(ev.case2_uncompletedPart || '');
      setCase2Reason(ev.case2_incompleteReason || 'عدم اختصاص الجهة المعنية');
      setCase2CustomReason(ev.case2_customReason || '');
      setCase2Accepted(ev.case2_citizenAcceptedPartial || 'نعم');
      setCase2OfficeNeedsExtra(ev.case2_officeNeedsExtraAction || 'لا');
      setCase2Notes(ev.case2_officerNotes || '');

      // Case 3
      setCase3Followup(
        ev.case3_followupTypes && ev.case3_followupTypes.length > 0
          ? ev.case3_followupTypes
          : ['متابعة مع الجهة نفسها']
      );
      setCase3OfficerNotes(ev.case3_officerNotes || '');
      setCase3ServiceSatisfied(ev.case3_citizenSatisfiedWithService || 'نعم');
      setCase3NeedsFollowup(ev.case3_needsFollowup || 'نعم');
      setCase3FutureComm(ev.case3_agreedFutureCommunication || 'نعم');
      setCase3SeminarParticipation(ev.case3_participateInSeminarOrInitiative || 'نعم');
      setCase3VisitCount(ev.case3_officeVisitFrequency || '2 - 3 مرات');
      setCase3JoinTeam(ev.case3_wantsToJoinTeam || 'لا');
      setCase3TeamRole(ev.case3_teamRole || 'مفتاح نهائي');

      // Case 4
      setCase4Reason(ev.case4_failureReason || 'خارج اختصاص المكتب');
      setCase4CustomReason(ev.case4_customFailureReason || '');
      setCase4Explained(ev.case4_explainedReasonToCitizen || 'نعم');
      setCase4Stance((ev.case4_citizenStance as any) || 'متفهم');
      setCase4Notes(ev.case4_officerNotes || '');
    } else {
      setFinalResult('تم اكمال الطلب بالكامل');
      setCase1Goal('نعم بالكامل');
      setCase1Satisfied('نعم');
      setCase1Rating(5);
      setCase1ReturnedThanks('نعم');
      setCase1Notes('');
      setCase2Completed('');
      setCase2Uncompleted('');
      setCase2Reason('عدم اختصاص الجهة المعنية');
      setCase2CustomReason('');
      setCase2Accepted('نعم');
      setCase2OfficeNeedsExtra('لا');
      setCase2Notes('');
      setCase3Followup(['متابعة مع الجهة نفسها']);
      setCase3OfficerNotes('');
      setCase3ServiceSatisfied('نعم');
      setCase3NeedsFollowup('نعم');
      setCase3FutureComm('نعم');
      setCase3SeminarParticipation('نعم');
      setCase3VisitCount('2 - 3 مرات');
      setCase3JoinTeam('لا');
      setCase3TeamRole('مفتاح نهائي');
      setCase4Reason('خارج اختصاص المكتب');
      setCase4CustomReason('');
      setCase4Explained('نعم');
      setCase4Stance('متفهم');
      setCase4Notes('');
    }
  }, [isOpen, initialRecord, citizen, initialRequestId, requests]);

  const currentCitizen = useMemo(
    () => citizens.find(c => c.Citizen_ID === selectedCitizenId) || citizen || null,
    [citizens, selectedCitizenId, citizen]
  );

  const orderedCitizenRequests = useMemo(() => {
    const list = requests.filter(r => r.Citizen_ID === selectedCitizenId);
    return [...list].sort((a, b) => {
      if (selectedRequestId) {
        if (a.Request_ID === selectedRequestId) return -1;
        if (b.Request_ID === selectedRequestId) return 1;
      }
      return parseTs(b.UpdatedAt || b.CreatedAt) - parseTs(a.UpdatedAt || a.CreatedAt);
    });
  }, [requests, selectedCitizenId, selectedRequestId]);

  const focusedRequest: OfficeRequest | null = useMemo(() => {
    if (selectedRequestId) {
      const exact = orderedCitizenRequests.find(r => r.Request_ID === selectedRequestId);
      if (exact) return exact;
    }
    return orderedCitizenRequests[0] || null;
  }, [orderedCitizenRequests, selectedRequestId]);

  // Derived structured Reception values (with calm "غير محدد" handling)
  const citizenDossier = useMemo(() => {
    if (!currentCitizen) return null;
    const cf = currentCitizen.CustomFields;
    const reqCf = focusedRequest?.CustomFields;

    const provinceValue =
      extractCustomField(cf, ['المحافظة', 'province', 'governorate']) ||
      extractCustomField(reqCf, ['المحافظة', 'province', 'governorate']) ||
      (currentCitizen as any).Province ||
      (currentCitizen as any).Governorate ||
      systemSettings?.province ||
      '';

    const maritalValue =
      extractCustomField(cf, ['الحالة الاجتماعية', 'marital', 'social_status', 'الحالة الزوجية']) ||
      extractCustomField(reqCf, ['الحالة الاجتماعية', 'marital', 'social_status']) ||
      currentCitizen.DependencyStatus ||
      '';

    const addressParts = [
      currentCitizen.District,
      currentCitizen.SubDistrict,
      currentCitizen.ResidentialArea || focusedRequest?.ResidentialArea,
      currentCitizen.NearestLandmark || focusedRequest?.NearestLandmark
    ]
      .map(s => String(s || '').trim())
      .filter(Boolean);

    const addressFull =
      addressParts.length > 0
        ? addressParts.join(' — ')
        : String(focusedRequest?.Address || focusedRequest?.CitizenAddress || '').trim();

    const phoneDisplay = [currentCitizen.Phone1 || focusedRequest?.CitizenPhone, currentCitizen.Phone2]
      .map(s => String(s || '').trim())
      .filter(Boolean)
      .join(' / ');

    const jobEduDisplay = [
      currentCitizen.Job || focusedRequest?.Job,
      currentCitizen.Education || focusedRequest?.Education
    ]
      .map(s => String(s || '').trim())
      .filter(Boolean)
      .join(' · ');

    const referralDisplay = [
      currentCitizen.ReferralSource || focusedRequest?.ReferralSource,
      currentCitizen.AttendanceType || focusedRequest?.AttendanceType
        ? `الحضور: ${currentCitizen.AttendanceType || focusedRequest?.AttendanceType}`
        : ''
    ]
      .filter(Boolean)
      .join(' · ');

    const proxyName = currentCitizen.ProxyName || focusedRequest?.ProxyName || '';
    const proxyPhone = currentCitizen.ProxyPhone || focusedRequest?.ProxyPhone || '';
    const proxyRelation = currentCitizen.ProxyRelation || focusedRequest?.ProxyRelation || '';

    const registrationSource =
      currentCitizen.RegisteredVia || focusedRequest?.RegisteredVia || 'قسم الاستعلامات';
    const registrationDate = currentCitizen.CreatedAt || focusedRequest?.CreatedAt || '';
    const registrationBy = currentCitizen.CreatedBy || focusedRequest?.CreatedBy || '';

    const extraCustomEntries = cf
      ? Object.entries(cf).filter(([k, v]) => {
          if (v === undefined || v === null || String(v).trim() === '') return false;
          const lk = k.toLowerCase();
          if (
            lk.includes('المحافظة') ||
            lk.includes('province') ||
            lk.includes('governorate') ||
            lk.includes('الحالة الاجتماعية') ||
            lk.includes('marital')
          ) {
            return false;
          }
          return true;
        })
      : [];

    return {
      fullName: currentCitizen.FullName || '',
      citizenId: currentCitizen.Citizen_ID || '',
      requestId: focusedRequest?.Request_ID || '',
      phoneDisplay,
      addressFull,
      provinceValue,
      gender: currentCitizen.Gender || '',
      maritalValue,
      job: currentCitizen.Job || focusedRequest?.Job || '',
      education: currentCitizen.Education || focusedRequest?.Education || '',
      jobEduDisplay,
      referralDisplay,
      proxyName,
      proxyPhone,
      proxyRelation,
      registrationSource,
      registrationDate,
      registrationBy,
      updatedAt: currentCitizen.UpdatedAt || focusedRequest?.UpdatedAt || '',
      rating: currentCitizen.Rating || '',
      surname: currentCitizen.Surname || '',
      extraCustomEntries
    };
  }, [currentCitizen, focusedRequest, systemSettings?.province]);

  // Build chronological timeline of all actions/directives for the focused request (or citizen)
  const timelineSteps = useMemo<TimelineStep[]>(() => {
    if (!currentCitizen) return [];
    const steps: TimelineStep[] = [];
    const req = focusedRequest;

    // 1. Initial Reception Registration
    const intakeDetails: string[] = [];
    if (req?.Entity) intakeDetails.push(`الجهة المعنية: ${req.Entity}`);
    if (req?.Details) intakeDetails.push(`موضوع الطلب: ${req.Details}`);
    if (req?.ReceptionNotes) intakeDetails.push(`ملاحظات الاستعلامات: ${req.ReceptionNotes}`);
    if (currentCitizen.ReferralSource) intakeDetails.push(`المعرّف / التزكية: ${currentCitizen.ReferralSource}`);

    steps.push({
      id: 'step-intake',
      stageLabel: 'المرحلة 1 · الاستعلامات',
      title: `تسجيل المعاملة في ${currentCitizen.RegisteredVia || req?.RegisteredVia || 'قسم الاستعلامات'}`,
      timestamp: req?.CreatedAt || currentCitizen.CreatedAt || 'غير محدد',
      actor: req?.CreatedBy || currentCitizen.CreatedBy || 'موظف الاستعلامات',
      details: intakeDetails.length > 0 ? intakeDetails : ['تم إدخال بيانات المراجع وفتح القيد الأولي في المنظومة.'],
      tone: 'navy',
      sortOrder: 10
    });

    // 2. Director Decision & Directives
    if (req && (req.DirectorDecision || req.DirectorNotes || req.RejectionReason)) {
      const dirDetails: string[] = [];
      if (req.DirectorDecision) dirDetails.push(`قرار وتصنيف المدير: ${req.DirectorDecision}`);
      if (req.DirectorNotes) dirDetails.push(`توجيه وملاحظات المدير: ${req.DirectorNotes}`);
      if (req.RejectionReason) dirDetails.push(`سبب الرفض: ${req.RejectionReason}`);
      steps.push({
        id: `step-director-${req.Request_ID}`,
        stageLabel: 'المرحلة 2 · مدير المكتب',
        title:
          req.DirectorDecision === 'رفض'
            ? 'قرار مدير المكتب: رفض المعاملة'
            : req.DirectorDecision
            ? `اعتماد مدير المكتب — تصنيف (${req.DirectorDecision})`
            : 'توجيه وملاحظة مدير المكتب',
        timestamp: req.DirectorDecisionDate || req.UpdatedAt || 'غير محدد',
        actor: req.DirectorDecisionBy || 'مدير المكتب التنفيذي',
        details: dirDetails,
        tone: req.DirectorDecision === 'رفض' ? 'rose' : 'gold',
        sortOrder: 20
      });
    }

    // 3. Explicit WorkflowHistory entries (from Request & Citizen)
    const rawWorkflow = [
      ...(req?.WorkflowHistory || []),
      ...(currentCitizen.WorkflowHistory || [])
    ];
    const seenWf = new Set<string>();
    rawWorkflow.forEach((wf, idx) => {
      const ts = wf.actionDate || wf.Timestamp || '';
      const actor = wf.fromUser || wf.ActionBy || 'موظف النظام';
      const fromS = wf.fromStage || wf.FromStage || '';
      const toS = wf.toStage || wf.ToStage || '';
      const note = wf.directiveNote || wf.DirectiveNotes || '';
      const statusT = wf.statusText || '';
      const dedupeKey = `${fromS}|${toS}|${ts}|${note}`;
      if (seenWf.has(dedupeKey)) return;
      seenWf.add(dedupeKey);

      const wfDetails: string[] = [];
      if (statusT) wfDetails.push(`الحالة: ${statusT}`);
      if (wf.targetEntity) wfDetails.push(`الجهة المستهدفة: ${wf.targetEntity}`);
      if (note) wfDetails.push(`الملاحظة / التوجيه: ${note}`);

      steps.push({
        id: wf.id || `step-wf-${idx}`,
        stageLabel: fromS && toS ? `مسار العمل · ${fromS} ← ${toS}` : 'مسار المعالجة الإدارية',
        title: toS ? `إحالة ومعالجة نحو (${toS})` : 'إجراء وتأشير في المسار الإداري',
        timestamp: ts || 'غير محدد',
        actor,
        details: wfDetails.length > 0 ? wfDetails : ['تم توثيق حركة إحالة إدارية على المعاملة.'],
        tone: 'slate',
        sortOrder: 25 + idx
      });
    });

    // 4. Administration Processing, Outgoing Letter, Margin & Deputy Notes
    if (
      req &&
      (req.OutgoingNumber ||
        req.OutgoingDate ||
        req.Margin ||
        req.DeputyNotes ||
        req.ExecutiveAction ||
        req.OtherNotes ||
        req.ProcessingStatus)
    ) {
      const adminDetails: string[] = [];
      if (req.ProcessingStatus) adminDetails.push(`حالة الإنجاز الإداري: ${req.ProcessingStatus}`);
      if (req.OutgoingNumber) {
        adminDetails.push(
          `العدد الصادر: ${req.OutgoingNumber}${req.OutgoingDate ? ` (بتاريخ ${req.OutgoingDate})` : ''}`
        );
      }
      if (req.ExecutiveAction) adminDetails.push(`الإجراء التنفيذي: ${req.ExecutiveAction}`);
      if (req.Margin) adminDetails.push(`الهامش الرسمي: ${req.Margin}`);
      if (req.DeputyNotes) adminDetails.push(`توجيه النائب / الإدارة: ${req.DeputyNotes}`);
      if (req.OtherNotes) adminDetails.push(`ملاحظات إدارية إضافية: ${req.OtherNotes}`);

      steps.push({
        id: `step-admin-${req.Request_ID}`,
        stageLabel: 'المرحلة 3 · قسم الإدارة',
        title: req.OutgoingNumber
          ? `إصدار مخاطبة رسمية (صادر رقم ${req.OutgoingNumber})`
          : `معالجة قسم الإدارة — ${req.ProcessingStatus || 'قيد الإجراء'}`,
        timestamp: req.OutgoingDate || req.UpdatedAt || req.CreatedAt || 'غير محدد',
        actor: 'موظف قسم الإدارة',
        details: adminDetails,
        tone: req.ProcessingStatus === 'منجز' ? 'emerald' : 'navy',
        sortOrder: 40
      });
    }

    // 5. Delivery / Receipt Status
    if (req && (req.DeliveryStatus || req.DeliveredAt || req.DeliveredBy)) {
      const delDetails: string[] = [];
      delDetails.push(`حالة الاستلام: ${req.DeliveryStatus || 'غير محدد'}`);
      if (req.DeliveredAt) delDetails.push(`تاريخ وتوقيت الاستلام: ${req.DeliveredAt}`);
      if (req.DeliveredBy) delDetails.push(`الموظف الموثّق للتسليم: ${req.DeliveredBy}`);

      steps.push({
        id: `step-delivery-${req.Request_ID}`,
        stageLabel: 'المرحلة 4 · الاستلام والمتابعة',
        title:
          req.DeliveryStatus === 'مستلم'
            ? 'تم تسليم الكتاب / المعاملة للمراجع'
            : `موقف الاستلام: ${req.DeliveryStatus}`,
        timestamp: req.DeliveredAt || req.UpdatedAt || 'غير محدد',
        actor: req.DeliveredBy || 'موظف التسليم والمتابعة',
        details: delDetails,
        tone: req.DeliveryStatus === 'مستلم' ? 'emerald' : 'gold',
        sortOrder: 50
      });
    }

    // 6. Existing Organization Evaluation (if already evaluated previously)
    if (initialRecord?.finalEvaluation?.finalResult) {
      const ev = initialRecord.finalEvaluation;
      const evDetails: string[] = [`النتيجة المسجلة: ${ev.finalResult}`];
      const officerNote =
        ev.case1_officerNotes ||
        ev.case2_officerNotes ||
        ev.case3_officerNotes ||
        ev.case4_officerNotes;
      if (officerNote) evDetails.push(`ملاحظة مسؤول التنظيم: ${officerNote}`);

      steps.push({
        id: `step-org-${ev.id}`,
        stageLabel: 'المرحلة 5 · قسم التنظيم',
        title: `تقييم النتيجة النهائية: ${ev.finalResult}`,
        timestamp: ev.evaluatedAt || 'غير محدد',
        actor: ev.evaluatedBy || 'مسؤول قسم التنظيم',
        details: evDetails,
        tone: ev.finalResult === 'لم يتم حل الطلب' ? 'rose' : 'emerald',
        sortOrder: 60
      });
    }

    return steps.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [currentCitizen, focusedRequest, initialRecord]);

  if (!isOpen) return null;

  const toggleFollowupType = (type: string) => {
    setCase3Followup(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Copy cleanly formatted Arabic executive summary
  const handleCopySummary = async () => {
    if (!citizenDossier) return;
    const officeTitle = systemSettings?.officeName || systemSettings?.appName || 'مكتب النائب علا الناشي';
    const lines: string[] = [
      `═══ بطاقة ملخص معاملة مراجع — ${officeTitle} ═══`,
      ``,
      `【 أولاً: معلومات المراجع (بيانات الاستعلامات) 】`,
      `• الاسم الكامل: ${citizenDossier.fullName || 'غير محدد'}`,
      `• رقم المعاملة: ${citizenDossier.requestId || 'غير محدد'} | الرقم التعريفي: ${citizenDossier.citizenId || 'غير محدد'}`,
      `• رقم الهاتف: ${citizenDossier.phoneDisplay || 'غير محدد'}`,
      `• المحافظة: ${citizenDossier.provinceValue || 'غير محدد'}`,
      `• العنوان / القضاء والناحية: ${citizenDossier.addressFull || 'غير محدد'}`,
      `• الجنس: ${citizenDossier.gender || 'غير محدد'} | الحالة الاجتماعية: ${citizenDossier.maritalValue || 'غير محدد'}`,
      `• المهنة / التحصيل الدراسي: ${citizenDossier.jobEduDisplay || 'غير محدد'}`,
      `• الجهة / المعرّف المحال منه: ${citizenDossier.referralDisplay || 'غير محدد'}`,
      `• مصدر وتاريخ التسجيل: ${citizenDossier.registrationSource} (${citizenDossier.registrationDate || 'غير محدد'})`,
      ``,
      `【 ثانياً: سجل المعالجات والتوجيهات (الإدارة ومدير المكتب) 】`
    ];

    if (focusedRequest) {
      lines.push(`• الجهة / الوزارة المعنية: ${focusedRequest.Entity || 'غير محدد'}`);
      lines.push(`• نوع وموضوع الطلب: ${focusedRequest.Details || 'غير محدد'}`);
      lines.push(`• التصنيف / قرار المدير: ${focusedRequest.DirectorDecision || 'بانتظار القرار'} (الأسبقية: ${focusedRequest.Priority || 'غير محدد'})`);
      lines.push(`• العدد الصادر وتاريخه: ${focusedRequest.OutgoingNumber || 'لم يصدر بعد'}${focusedRequest.OutgoingDate ? ` — ${focusedRequest.OutgoingDate}` : ''}`);
      lines.push(`• حالة الإنجاز: ${focusedRequest.ProcessingStatus || 'غير محدد'} | حالة الاستلام: ${focusedRequest.DeliveryStatus || 'غير محدد'}`);
    }

    lines.push(``);
    lines.push(`【 التسلسل الزمني للمعالجات 】`);
    timelineSteps.forEach((step, idx) => {
      lines.push(`${idx + 1}. ${step.title} [${step.timestamp}] — (${step.actor})`);
      step.details.forEach(d => lines.push(`   - ${d}`));
    });

    lines.push(``);
    lines.push(`【 النتيجة النهائية (قسم التنظيم) 】`);
    lines.push(`• النتيجة المختارة: ${finalResult}`);

    const text = lines.join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2600);
    } catch {
      // Fallback silent
    }
  };

  // Dedicated A4 Print Sheet via hidden iframe (safe inside AI Studio iframe — zero window.open!)
  const handlePrintRequestCard = () => {
    if (!citizenDossier) return;
    const officeTitle = systemSettings?.officeName || systemSettings?.appName || 'مكتب النائب المهندسة علا عودة الناشي';
    const printDate = new Date().toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const timelineHtml = timelineSteps
      .map(
        (step, i) => `
        <div class="tl-item">
          <div class="tl-index">${i + 1}</div>
          <div class="tl-body">
            <div class="tl-top">
              <span class="tl-title">${escapeHtml(step.title)}</span>
              <span class="tl-meta">${escapeHtml(step.stageLabel)} • ${escapeHtml(step.timestamp)}</span>
            </div>
            <div class="tl-actor">المسؤول: ${escapeHtml(step.actor)}</div>
            <ul class="tl-details">
              ${step.details.map(d => `<li>${escapeHtml(d)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>بطاقة الطلب — ${escapeHtml(citizenDossier.fullName)}</title>
  <style>
    @page { size: A4 portrait; margin: 13mm 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      direction: rtl;
      font-size: 12px;
      line-height: 1.55;
    }
    .header {
      background: #0f172a;
      color: #ffffff;
      padding: 14px 18px;
      border-radius: 10px;
      border-bottom: 3px solid #d97706;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .header h1 { margin: 0 0 3px; font-size: 16px; font-weight: 800; }
    .header p { margin: 0; font-size: 11px; color: #cbd5e1; }
    .header-meta { text-align: left; font-size: 11px; color: #e2e8f0; }
    .section {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      margin-bottom: 13px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .section-head {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 8px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 800;
      font-size: 12.5px;
      color: #0f172a;
    }
    .section-sub { font-size: 10.5px; color: #475569; font-weight: 600; }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      padding: 11px 14px;
    }
    .field {
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 6px 9px;
      background: #ffffff;
    }
    .field-label { font-size: 10px; color: #64748b; font-weight: 700; display: block; margin-bottom: 2px; }
    .field-val { font-size: 11.5px; color: #0f172a; font-weight: 700; }
    .muted { color: #94a3b8; font-style: italic; font-weight: 400; }
    .mono { font-family: 'Courier New', monospace; direction: ltr; display: inline-block; }
    .req-box {
      margin: 0 14px 10px;
      padding: 9px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
    }
    .tl-wrap { padding: 10px 14px; }
    .tl-item {
      display: flex;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px dashed #e2e8f0;
    }
    .tl-item:last-child { border-bottom: none; }
    .tl-index {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #0f172a;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .tl-body { flex: 1; }
    .tl-top { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .tl-title { font-weight: 800; color: #0f172a; font-size: 12px; }
    .tl-meta { font-size: 10.5px; color: #475569; }
    .tl-actor { font-size: 10.5px; color: #059669; font-weight: 700; margin-top: 2px; }
    .tl-details { margin: 4px 0 0; padding-right: 16px; color: #334155; font-size: 11px; }
    .tl-details li { margin-bottom: 2px; }
    .result-bar {
      padding: 10px 14px;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
      font-weight: 800;
      color: #065f46;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-top: 22px;
      text-align: center;
      font-size: 11px;
      color: #334155;
      font-weight: 700;
    }
    .sig-line { margin-top: 28px; border-top: 1px solid #94a3b8; padding-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(officeTitle)}</h1>
      <p>بطاقة الطلب الشاملة — قسم التنظيم والمتابعة الميدانية</p>
    </div>
    <div class="header-meta">
      <div>رقم المعاملة: <span class="mono">${escapeHtml(citizenDossier.requestId || 'غير محدد')}</span></div>
      <div>تاريخ الطباعة: ${escapeHtml(printDate)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-head">
      <span>أولاً: بطاقة معلومات المراجع (بيانات موظف الاستعلامات)</span>
      <span class="section-sub">المصدر: ${escapeHtml(citizenDossier.registrationSource)} · ${escapeHtml(citizenDossier.registrationDate || 'غير محدد')}</span>
    </div>
    <div class="grid">
      <div class="field"><span class="field-label">الاسم الكامل</span><span class="field-val">${escapeHtml(citizenDossier.fullName || 'غير محدد')}</span></div>
      <div class="field"><span class="field-label">رقم المعاملة / المعرف</span><span class="field-val mono">${escapeHtml(citizenDossier.requestId ? `${citizenDossier.requestId} / ${citizenDossier.citizenId}` : citizenDossier.citizenId || 'غير محدد')}</span></div>
      <div class="field"><span class="field-label">رقم الهاتف</span><span class="field-val mono">${escapeHtml(citizenDossier.phoneDisplay || 'غير محدد')}</span></div>
      <div class="field"><span class="field-label">المحافظة</span><span class="field-val">${escapeHtml(citizenDossier.provinceValue || 'غير محدد')}</span></div>
      <div class="field"><span class="field-label">العنوان / القضاء والناحية</span><span class="field-val">${escapeHtml(citizenDossier.addressFull || 'غير محدد')}</span></div>
      <div class="field"><span class="field-label">الجنس</span><span class="field-val">${escapeHtml(citizenDossier.gender || 'غير محدد')}</span></div>
      <div class="field"><span class="field-label">الحالة الاجتماعية</span><span class="field-val">${escapeHtml(citizenDossier.maritalValue || 'غير محدد')}</span></div>
      <div class="field"><span class="field-label">المهنة / التحصيل الدراسي</span><span class="field-val">${escapeHtml(citizenDossier.jobEduDisplay || 'غير محدد')}</span></div>
      <div class="field"><span class="field-label">الجهة / المعرّف المحال منه</span><span class="field-val">${escapeHtml(citizenDossier.referralDisplay || 'غير محدد')}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-head">
      <span>ثانياً: سجل المعالجات والتوجيهات (بيانات موظف الإدارة ومدير المكتب)</span>
      <span class="section-sub">${escapeHtml(focusedRequest?.Entity || 'غير محدد')}</span>
    </div>
    ${
      focusedRequest
        ? `<div class="grid">
            <div class="field"><span class="field-label">الجهة / الوزارة المعنية</span><span class="field-val">${escapeHtml(focusedRequest.Entity || 'غير محدد')}</span></div>
            <div class="field"><span class="field-label">التصنيف / قرار المدير</span><span class="field-val">${escapeHtml(focusedRequest.DirectorDecision || 'بانتظار القرار')} (${escapeHtml(focusedRequest.Priority || 'عام')})</span></div>
            <div class="field"><span class="field-label">العدد الصادر وتاريخه</span><span class="field-val mono">${escapeHtml(focusedRequest.OutgoingNumber || 'لم يصدر بعد')} ${focusedRequest.OutgoingDate ? `(${escapeHtml(focusedRequest.OutgoingDate)})` : ''}</span></div>
            <div class="field"><span class="field-label">حالة الإنجاز</span><span class="field-val">${escapeHtml(focusedRequest.ProcessingStatus || 'غير محدد')}</span></div>
            <div class="field"><span class="field-label">حالة الاستلام والمتابعة</span><span class="field-val">${escapeHtml(focusedRequest.DeliveryStatus || 'غير محدد')}</span></div>
            <div class="field"><span class="field-label">تاريخ الإدخال</span><span class="field-val mono">${escapeHtml(focusedRequest.CreatedAt || 'غير محدد')}</span></div>
          </div>
          <div class="req-box"><strong>موضوع وتفاصيل الطلب:</strong> ${escapeHtml(focusedRequest.Details || 'غير محدد')}</div>`
        : ''
    }
    <div class="tl-wrap">${timelineHtml}</div>
  </div>

  <div class="result-bar">
    <span>النتيجة النهائية المعتمدة في قسم التنظيم: ${escapeHtml(finalResult)}</span>
    <span>تاريخ التقييم: ${escapeHtml(initialRecord?.finalEvaluation?.evaluatedAt || new Date().toISOString().split('T')[0])}</span>
  </div>

  <div class="signatures">
    <div><div class="sig-line">موظف الاستعلامات</div></div>
    <div><div class="sig-line">مسؤول قسم التنظيم</div></div>
    <div><div class="sig-line">مدير المكتب التنفيذي</div></div>
  </div>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      window.setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          window.setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          }, 1500);
        }
      }, 220);
    } else if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  const handleSaveEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCitizen) {
      setValidationError('يرجى اختيار مراجع أولاً لتسجيل النتيجة النهائية.');
      return;
    }
    setValidationError(null);

    const evaluation: OrgFinalEvaluation = {
      id: initialRecord?.finalEvaluation?.id || `EVAL-${Date.now().toString().slice(-5)}`,
      evaluatedAt: new Date().toISOString().split('T')[0],
      evaluatedBy: 'مسؤول قسم التنظيم',
      finalResult,
      requestId: selectedRequestId || orderedCitizenRequests[0]?.Request_ID,
      requestSubject: orderedCitizenRequests
        .find(r => r.Request_ID === selectedRequestId)
        ?.Details?.slice(0, 60),

      // Case 1
      ...(finalResult === 'تم اكمال الطلب بالكامل' && {
        case1_citizenObtainedGoal: case1_goal,
        case1_citizenSatisfied: case1_satisfied,
        case1_personalRating: case1_rating,
        case1_citizenReturnedForThanks: case1_returnedThanks,
        case1_officerNotes: case1_notes
      }),

      // Case 2
      ...(finalResult === 'تم حل الطلب جزئيا' && {
        case2_completedPart: case2_completed,
        case2_uncompletedPart: case2_uncompleted,
        case2_incompleteReason:
          case2_reason === 'سبب اخر' && case2_customReason ? case2_customReason : case2_reason,
        case2_customReason: case2_customReason,
        case2_citizenAcceptedPartial: case2_accepted,
        case2_officeNeedsExtraAction: case2_officeNeedsExtra,
        case2_officerNotes: case2_notes
      }),

      // Case 3
      ...(finalResult === 'الطلب يحتاج متابعة' && {
        case3_followupTypes: case3_followup,
        case3_officerNotes: case3_officerNotes,
        case3_citizenSatisfiedWithService: case3_serviceSatisfied,
        case3_needsFollowup: case3_needsFollowup,
        case3_agreedFutureCommunication: case3_futureComm,
        case3_participateInSeminarOrInitiative: case3_seminarParticipation,
        case3_officeVisitFrequency: case3_visitCount,
        case3_wantsToJoinTeam: case3_joinTeam,
        case3_teamMemberFileOpened: case3_joinTeam === 'نعم',
        case3_teamRole: case3_joinTeam === 'نعم' ? case3_teamRole : undefined
      }),

      // Case 4
      ...(finalResult === 'لم يتم حل الطلب' && {
        case4_failureReason:
          case4_reason === 'سبب اخر' && case4_customReason ? case4_customReason : case4_reason,
        case4_customFailureReason: case4_customReason,
        case4_explainedReasonToCitizen: case4_explained,
        case4_citizenStance: case4_stance,
        case4_specialNote: `نتيجة الطلب غير منجز سبب عدم الانجاز: ${
          case4_reason === 'سبب اخر' && case4_customReason ? case4_customReason : case4_reason
        }`,
        case4_officerNotes: case4_notes
      })
    };

    let teamMemberToOpen: OrgTeamMember | null = null;
    if (finalResult === 'الطلب يحتاج متابعة' && case3_joinTeam === 'نعم') {
      teamMemberToOpen = {
        id: `TM-${Date.now().toString().slice(-5)}`,
        Citizen_ID: currentCitizen.Citizen_ID,
        FullName: currentCitizen.FullName,
        Phone: currentCitizen.Phone1,
        District: currentCitizen.District,
        SubDistrict: currentCitizen.SubDistrict,
        Role: case3_teamRole || 'مفتاح نهائي',
        JoinedDate: new Date().toISOString().split('T')[0],
        OfficeVisitCount: case3_visitCount,
        Notes: `انضم كعضو فريق بعد استبيان المتابعة للطلب. ملاحظة التنظيم: ${case3_officerNotes}`,
        Status: 'نشط'
      };
    }

    const isJoiningTeamNow = finalResult === 'الطلب يحتاج متابعة' && case3_joinTeam === 'نعم';
    const updatedRecord: OrganizationRecord = {
      ...(initialRecord || {
        Citizen_ID: currentCitizen.Citizen_ID,
        FullName: currentCitizen.FullName,
        District: currentCitizen.District,
        SubDistrict: currentCitizen.SubDistrict,
        Phone1: currentCitizen.Phone1,
        OrgRating: finalResult === 'تم اكمال الطلب بالكامل' ? 'مؤيد' : 'محايد',
        InfluenceType: 'مواطن مسجل'
      }),
      FullName: currentCitizen.FullName,
      District: currentCitizen.District || initialRecord?.District || '',
      SubDistrict: currentCitizen.SubDistrict || initialRecord?.SubDistrict || '',
      Phone1: currentCitizen.Phone1 || initialRecord?.Phone1 || '',
      finalEvaluation: evaluation,
      isTeamMember: isJoiningTeamNow || initialRecord?.isTeamMember || false,
      teamMemberRole: isJoiningTeamNow ? case3_teamRole : initialRecord?.teamMemberRole
    };

    onSave(updatedRecord, teamMemberToOpen);
    onClose();
  };

  const getStepNodeStyles = (tone: TimelineStep['tone']) => {
    switch (tone) {
      case 'emerald':
        return {
          ring: 'bg-emerald-600 text-white border-emerald-200',
          label: 'text-emerald-700'
        };
      case 'gold':
        return {
          ring: 'bg-amber-600 text-white border-amber-200',
          label: 'text-amber-700'
        };
      case 'rose':
        return {
          ring: 'bg-rose-600 text-white border-rose-200',
          label: 'text-rose-700'
        };
      case 'slate':
        return {
          ring: 'bg-slate-600 text-white border-slate-200',
          label: 'text-slate-600'
        };
      case 'navy':
      default:
        return {
          ring: 'bg-[#0F1E3A] text-white border-slate-300',
          label: 'text-[#0F1E3A]'
        };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto font-['Tajawal',sans-serif]"
      dir="rtl"
    >
      <div className="relative w-full max-w-5xl bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-2xl overflow-hidden text-right my-4 max-h-[94vh] flex flex-col">
        {/* ================================================================ */}
        {/* EXECUTIVE FORMAL HEADER (Deep Navy + Subtle Gold & Emerald Edge) */}
        {/* ================================================================ */}
        <div className="bg-gradient-to-l from-[#0B1528] via-[#10213E] to-[#0B1528] text-white px-5 sm:px-7 py-4 border-b-2 border-amber-500/70 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-amber-400/30 text-amber-300 flex items-center justify-center shrink-0">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
                  إكمال الطلب وتسجيل النتيجة النهائية
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 truncate">
                  ملف المراجع التفصيلي وسجل المعالجات الإدارية — قسم التنظيم والمتابعة
                </p>
              </div>
            </div>

            {/* Utility Controls: Copy Summary + Print A4 Card + Close */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {citizenDossier && (
                <>
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap border ${
                      copiedSummary
                        ? 'bg-emerald-600 text-white border-emerald-400'
                        : 'bg-white/10 hover:bg-white/15 text-slate-100 border-white/15'
                    }`}
                    title="نسخ ملخص بيانات المراجع والطلب للحافظة"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-300" />
                        <span>نسخ ملخص الطلب</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintRequestCard}
                    className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                    title="طباعة بطاقة الطلب منسقة على ورقة A4"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة بطاقة الطلب</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
                aria-label="إغلاق النافذة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* SCROLLABLE BODY                                                  */}
        {/* ================================================================ */}
        <div className="p-5 sm:p-7 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
          {validationError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* 1. بطاقة معلومات المراجع (بيانات موظف الاستعلامات)              */}
          {/* ============================================================== */}
          {citizenDossier && (
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {/* Top Origin & Status Header Band */}
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0F1E3A] text-amber-300 flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      1. بطاقة معلومات المراجع (بيانات موظف الاستعلامات)
                    </h4>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span>
                        مصدر التسجيل:{' '}
                        <strong className="text-emerald-700 font-bold">{citizenDossier.registrationSource}</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        تاريخ التسجيل:{' '}
                        <strong className="font-mono tabular-nums text-slate-700">
                          {citizenDossier.registrationDate || 'غير محدد'}
                        </strong>
                      </span>
                      {citizenDossier.registrationBy && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            المسجِّل: <strong className="text-slate-700">{citizenDossier.registrationBy}</strong>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Clear Top Status Indicator */}
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F1E3A] bg-emerald-50/80 border border-emerald-200 px-3 py-1.5 rounded-lg self-start sm:self-auto shrink-0">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {currentCitizen?.CurrentStage
                      ? `المرحلة الحالية: ${currentCitizen.CurrentStage}`
                      : `مسجل عبر ${citizenDossier.registrationSource}`}
                  </span>
                </div>
              </div>

              {/* Clean Miniature Cards Grid — Every Field With Clear Icon & Calm Empty Fallback */}
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                {/* 1. Full Name */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                  <UserIcon className="w-4 h-4 text-[#0F1E3A] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">الاسم الكامل</span>
                    <div className="text-sm font-extrabold text-slate-900">
                      {renderFieldValue(citizenDossier.fullName)}
                    </div>
                    {citizenDossier.surname && (
                      <div className="text-[11px] text-slate-500 mt-0.5">اللقب: {citizenDossier.surname}</div>
                    )}
                  </div>
                </div>

                {/* 2. Request ID / Citizen ID */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                  <Hash className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">
                      رقم المعاملة / الرقم التعريفي
                    </span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {renderFieldValue(citizenDossier.requestId || citizenDossier.citizenId, true)}
                      {citizenDossier.requestId && citizenDossier.citizenId && (
                        <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                          ({citizenDossier.citizenId})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Phone */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">رقم الهاتف</span>
                    <div className="text-emerald-800">{renderFieldValue(citizenDossier.phoneDisplay, true)}</div>
                  </div>
                </div>

                {/* 4. Address / District / SubDistrict */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#0F1E3A] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">
                      العنوان / القضاء والناحية
                    </span>
                    <div>{renderFieldValue(citizenDossier.addressFull)}</div>
                  </div>
                </div>

                {/* 5. Province */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                  <Globe className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">المحافظة</span>
                    <div>{renderFieldValue(citizenDossier.provinceValue)}</div>
                  </div>
                </div>

                {/* 6. Gender */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                  <UserCheck className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">الجنس</span>
                    <div>{renderFieldValue(citizenDossier.gender)}</div>
                  </div>
                </div>

                {/* 7. Marital / Social Status */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                  <Heart className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">الحالة الاجتماعية</span>
                    <div>{renderFieldValue(citizenDossier.maritalValue)}</div>
                  </div>
                </div>

                {/* 8. Job / Education */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                  <GraduationCap className="w-4 h-4 text-[#0F1E3A] mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">
                      المهنة / التحصيل الدراسي
                    </span>
                    <div>{renderFieldValue(citizenDossier.jobEduDisplay)}</div>
                  </div>
                </div>

                {/* 9. Referral Source / Attendance */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                  <Share2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">
                      الجهة / المعرّف المحال منه
                    </span>
                    <div>{renderFieldValue(citizenDossier.referralDisplay)}</div>
                    {citizenDossier.proxyName && (
                      <div className="text-[11px] text-slate-600 mt-1">
                        المعتمد: <strong>{citizenDossier.proxyName}</strong>
                        {citizenDossier.proxyRelation ? ` (${citizenDossier.proxyRelation})` : ''}
                        {citizenDossier.proxyPhone ? ` · ${citizenDossier.proxyPhone}` : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* 10. Registration Date & Time */}
                <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5 sm:col-span-2 lg:col-span-3">
                  <Calendar className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">
                        تاريخ وموعد التسجيل في المنظومة
                      </span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {renderFieldValue(citizenDossier.registrationDate, true)}
                        {citizenDossier.updatedAt && citizenDossier.updatedAt !== citizenDossier.registrationDate && (
                          <span className="text-[11px] text-slate-500">
                            آخر تحديث:{' '}
                            <span className="font-mono tabular-nums text-slate-700">{citizenDossier.updatedAt}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {citizenDossier.rating && (
                      <div className="text-[11px] text-slate-600">
                        انطباع الاستعلامات: <strong className="text-slate-900">{citizenDossier.rating}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Extra Dynamic Custom Fields (if any) */}
                {citizenDossier.extraCustomEntries.map(([k, v]) => (
                  <div
                    key={k}
                    className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5"
                  >
                    <Bookmark className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">{k}</span>
                      <div>{renderFieldValue(String(v))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ============================================================== */}
          {/* 2. سجل المعالجات والتوجيهات (بيانات موظف الإدارة ومدير المكتب) */}
          {/* ============================================================== */}
          {currentCitizen && (
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      2. سجل المعالجات والتوجيهات (بيانات موظف الإدارة ومدير المكتب)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      عرض تفصيلي لمسار الطلب والتأشيرات والقرارات الإدارية بالتسلسل الزمني
                    </p>
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-600 font-mono tabular-nums self-start sm:self-auto">
                  إجمالي المعاملات المسجلة: <span className="text-[#0F1E3A]">{orderedCitizenRequests.length}</span>
                </div>
              </div>

              {/* Request Switcher Tabs when citizen has multiple requests */}
              {orderedCitizenRequests.length > 1 && (
                <div className="px-5 pt-3.5 flex items-center gap-1.5 overflow-x-auto border-b border-slate-100 pb-3">
                  <span className="text-[11px] font-bold text-slate-500 shrink-0 ml-1">اختر المعاملة للعرض:</span>
                  {orderedCitizenRequests.map(req => {
                    const active = focusedRequest?.Request_ID === req.Request_ID;
                    return (
                      <button
                        key={req.Request_ID}
                        type="button"
                        onClick={() => setSelectedRequestId(req.Request_ID)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 border ${
                          active
                            ? 'bg-[#0F1E3A] text-white border-[#0F1E3A]'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="font-mono tabular-nums">{req.Request_ID}</span>
                        {req.Entity ? ` · ${req.Entity}` : ''}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="p-5 space-y-5">
                {/* Structured Admin & Director Key Fields Grid */}
                {focusedRequest ? (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      {/* Target Entity / Ministry */}
                      <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                        <Building2 className="w-4 h-4 text-[#0F1E3A] mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">
                            الجهة / الوزارة المعنية
                          </span>
                          <div>{renderFieldValue(focusedRequest.Entity)}</div>
                        </div>
                      </div>

                      {/* Request Type / Status */}
                      <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                        <FileText className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">
                            نوع الطلب / القسم المستهدف
                          </span>
                          <div>
                            {renderFieldValue(
                              [focusedRequest.RequestStatus, focusedRequest.TargetDepartment]
                                .filter(Boolean)
                                .join(' · ')
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Classification / Director Decision */}
                      <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                        <Stamp className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">
                            الصلاحية / التصنيف وقرار المدير
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2">
                            <span
                              className={`font-extrabold ${
                                focusedRequest.DirectorDecision === 'رفض'
                                  ? 'text-rose-700'
                                  : focusedRequest.DirectorDecision === 'خاص'
                                  ? 'text-amber-700'
                                  : focusedRequest.DirectorDecision === 'عام'
                                  ? 'text-emerald-700'
                                  : 'text-slate-700'
                              }`}
                            >
                              {focusedRequest.DirectorDecision || 'بانتظار قرار المدير'}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600 font-semibold">
                              الأسبقية: {focusedRequest.Priority || 'غير محدد'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Processing Status & Outgoing Number */}
                      <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                        <Briefcase className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">
                            حالة الإنجاز والعدد الصادر
                          </span>
                          <div>
                            {renderFieldValue(focusedRequest.ProcessingStatus)}
                            <span className="text-slate-400 mx-1.5">·</span>
                            {focusedRequest.OutgoingNumber ? (
                              <span className="font-mono tabular-nums font-bold text-[#0F1E3A]">
                                صادر {focusedRequest.OutgoingNumber}
                                {focusedRequest.OutgoingDate ? ` (${focusedRequest.OutgoingDate})` : ''}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic font-normal">لم يصدر كتاب بعد</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Delivery & Follow-up */}
                      <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">
                            حالة الاستلام والمتابعة
                          </span>
                          <div>
                            {renderFieldValue(focusedRequest.DeliveryStatus)}
                            {focusedRequest.DeliveredAt && (
                              <span className="text-[11px] text-slate-500 font-mono tabular-nums mr-1.5">
                                ({focusedRequest.DeliveredAt})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Director / Admin Notes Summary */}
                      <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-start gap-2.5">
                        <MessageSquareText className="w-4 h-4 text-[#0F1E3A] mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-[11px] text-slate-500 font-semibold mb-0.5">
                            تاريخ القرار وآخر تأشير
                          </span>
                          <div>
                            {renderFieldValue(
                              focusedRequest.DirectorDecisionDate ||
                                focusedRequest.UpdatedAt ||
                                focusedRequest.CreatedAt,
                              true
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Full Request Details Box */}
                    <div className="p-3.5 rounded-xl bg-[#0F1E3A]/[0.03] border border-slate-200 text-xs leading-relaxed">
                      <span className="block text-[11px] font-bold text-slate-500 mb-1">
                        موضوع وتفاصيل الطلب المسجل:
                      </span>
                      <p className="text-slate-900 font-semibold">
                        {focusedRequest.Details?.trim() ? (
                          focusedRequest.Details
                        ) : (
                          <span className="text-slate-400 italic font-normal">غير محدد</span>
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    لا توجد معاملات إدارية مسجلة لهذا الاسم حتى الآن — يمكنك متابعة تسجيل النتيجة أدناه.
                  </div>
                )}

                {/* Chronological Timeline (التسلسل الزمني للمعالجات والتوجيهات) */}
                {timelineSteps.length > 0 && (
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <GitCommitHorizontal className="w-4 h-4 text-amber-600" />
                        <span>التسلسل الزمني لمسار المعاملة والتوجيهات</span>
                      </h5>
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {timelineSteps.length} خطوة موثّقة
                      </span>
                    </div>

                    <div className="relative pr-6 space-y-3 before:content-[''] before:absolute before:right-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
                      {timelineSteps.map((step, index) => {
                        const styles = getStepNodeStyles(step.tone);
                        return (
                          <div key={step.id} className="relative">
                            {/* Timeline Step Number Circle */}
                            <div
                              className={`absolute -right-6 top-2.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-extrabold font-mono tabular-nums z-10 ${styles.ring}`}
                            >
                              {index + 1}
                            </div>

                            {/* Connected Timeline Card */}
                            <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/90 space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span className={`text-[11px] font-extrabold ${styles.label}`}>
                                    {step.stageLabel}
                                  </span>
                                  <span className="text-slate-300" aria-hidden="true">
                                    ·
                                  </span>
                                  <span className="text-xs font-extrabold text-slate-900">{step.title}</span>
                                </div>
                                <span className="text-[11px] font-mono tabular-nums text-slate-500">
                                  {step.timestamp}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-500 font-semibold">
                                القائم بالإجراء: <span className="text-slate-800 font-bold">{step.actor}</span>
                              </div>

                              <ul className="space-y-1 pt-1 text-xs text-slate-700 leading-relaxed">
                                {step.details.map((line, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <span className="text-amber-600 font-bold mt-0.5">•</span>
                                    <span>{line}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ============================================================== */}
          {/* 3. نموذج إكمال الطلب وتسجيل النتيجة النهائية (قسم التنظيم)      */}
          {/* ============================================================== */}
          <form
            onSubmit={handleSaveEvaluation}
            className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-5"
          >
            <div className="pb-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-300/60 text-amber-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    3. تثبيت النتيجة النهائية للطلب واستبيان قسم التنظيم
                  </h4>
                  <p className="text-xs text-slate-500">
                    يتم الحفظ والمزامنة الفورية في قاعدة البيانات والأرشيف الاحتياطي مباشرة عند الاعتماد
                  </p>
                </div>
              </div>
            </div>

            {/* Citizen & Request Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">المواطن صاحب المعاملة *</label>
                {citizen ? (
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">{citizen.FullName}</span>
                    <span className="font-mono tabular-nums text-[#0F1E3A] font-bold">
                      {citizen.Citizen_ID}
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedCitizenId}
                    onChange={e => setSelectedCitizenId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 font-bold text-xs focus:ring-2 focus:ring-[#0F1E3A] outline-none"
                    required
                  >
                    <option value="">-- اختر مراجع من القائمة --</option>
                    {citizens.map(c => (
                      <option key={c.Citizen_ID} value={c.Citizen_ID}>
                        {c.FullName} ({c.Citizen_ID}) - {c.District}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">الطلب المرتبط بالتقييم</label>
                <select
                  value={selectedRequestId}
                  onChange={e => setSelectedRequestId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-[#0F1E3A] outline-none"
                >
                  <option value="">-- عام على مجمل المراجعات أو اختر طلباً --</option>
                  {orderedCitizenRequests.map(r => (
                    <option key={r.Request_ID} value={r.Request_ID}>
                      {r.Request_ID} - {r.Entity} ({r.ProcessingStatus})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4 Main Results Selector with Instant Dynamic Switch */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-2">
                النتيجة النهائية للطلب *{' '}
                <span className="text-slate-400 font-normal">
                  (تظهر الأسئلة المخصصة لكل حالة تلقائياً أدناه)
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* Option 1 */}
                <button
                  type="button"
                  onClick={() => setFinalResult('تم اكمال الطلب بالكامل')}
                  className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    finalResult === 'تم اكمال الطلب بالكامل'
                      ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-extrabold">1. تم إكمال الطلب بالكامل</span>
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        finalResult === 'تم اكمال الطلب بالكامل' ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">تم تحقيق النتيجة المرجوة بالكامل بنجاح</span>
                </button>

                {/* Option 2 */}
                <button
                  type="button"
                  onClick={() => setFinalResult('تم حل الطلب جزئيا')}
                  className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    finalResult === 'تم حل الطلب جزئيا'
                      ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-extrabold">2. تم حل الطلب جزئياً</span>
                    <Clock
                      className={`w-4 h-4 ${
                        finalResult === 'تم حل الطلب جزئيا' ? 'text-amber-600' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">تم إنجاز أجزاء من الطلب وبقيت أخرى</span>
                </button>

                {/* Option 3 */}
                <button
                  type="button"
                  onClick={() => setFinalResult('الطلب يحتاج متابعة')}
                  className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    finalResult === 'الطلب يحتاج متابعة'
                      ? 'bg-sky-50 border-[#0F1E3A] ring-2 ring-sky-500/20 text-slate-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-extrabold">3. الطلب يحتاج متابعة</span>
                    <AlertCircle
                      className={`w-4 h-4 ${
                        finalResult === 'الطلب يحتاج متابعة' ? 'text-[#0F1E3A]' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">يتطلب اتصالات ومخاطبات واستبيان للتنظيم</span>
                </button>

                {/* Option 4 */}
                <button
                  type="button"
                  onClick={() => setFinalResult('لم يتم حل الطلب')}
                  className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    finalResult === 'لم يتم حل الطلب'
                      ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 text-rose-950'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-extrabold">4. لم يتم حل الطلب</span>
                    <XCircle
                      className={`w-4 h-4 ${
                        finalResult === 'لم يتم حل الطلب' ? 'text-rose-600' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500">تعذر الإنجاز لأسباب قانونية أو خارج الاختصاص</span>
                </button>
              </div>
            </div>

            {/* ============================================================ */}
            {/* الحالة الأولى: تم حل الطلب بالكامل                           */}
            {/* ============================================================ */}
            {finalResult === 'تم اكمال الطلب بالكامل' && (
              <div className="p-4 sm:p-5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-4">
                <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-xs pb-2 border-b border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>أسئلة الحالة الأولى: تم إكمال وحل الطلب بالكامل</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    1. هل المواطن حصل على النتيجة التي طلبها؟
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-w-md">
                    <label
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                        case1_goal === 'نعم بالكامل'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="case1_goal"
                        checked={case1_goal === 'نعم بالكامل'}
                        onChange={() => setCase1Goal('نعم بالكامل')}
                        className="hidden"
                      />
                      <span>نعم بالكامل</span>
                    </label>
                    <label
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                        case1_goal === 'نعم مع اجراء بسيط'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="case1_goal"
                        checked={case1_goal === 'نعم مع اجراء بسيط'}
                        onChange={() => setCase1Goal('نعم مع اجراء بسيط')}
                        className="hidden"
                      />
                      <span>نعم مع إجراء بسيط</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      2. هل المواطن راضي عن النتيجة؟
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCase1Satisfied('نعم')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          case1_satisfied === 'نعم'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => setCase1Satisfied('لا')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          case1_satisfied === 'لا'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        لا
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      تقييم شخصي بعد سؤال المواطن:
                    </label>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-300">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setCase1Rating(star)}
                          className="cursor-pointer transition-transform hover:scale-110 p-0.5"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= case1_rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-bold text-emerald-800 mr-2 font-mono tabular-nums">
                        {case1_rating === 5
                          ? 'ممتاز (5/5)'
                          : case1_rating === 4
                          ? 'جيد جداً (4/5)'
                          : case1_rating === 3
                          ? 'جيد (3/5)'
                          : case1_rating === 2
                          ? 'مقبول (2/5)'
                          : 'ضعيف (1/5)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold text-slate-800">
                    3. هل عاد المواطن للمكتب لتقديم الشكر وإبداء الامتنان؟
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCase1ReturnedThanks('نعم')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        case1_returnedThanks === 'نعم'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      نعم
                    </button>
                    <button
                      type="button"
                      onClick={() => setCase1ReturnedThanks('لا')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        case1_returnedThanks === 'لا'
                          ? 'bg-slate-700 text-white'
                          : 'bg-white text-slate-700 border border-slate-300'
                      }`}
                    >
                      لا
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold text-slate-800">
                    ملاحظة مسؤول التنظيم (نص مفتوح):
                  </label>
                  <textarea
                    value={case1_notes}
                    onChange={e => setCase1Notes(e.target.value)}
                    placeholder="سجل انطباع المواطن، استعداده للمساندة، أية توصيات تنظيمية أو جماهيرية..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* الحالة الثانية: حل الطلب جزئياً                              */}
            {/* ============================================================ */}
            {finalResult === 'تم حل الطلب جزئيا' && (
              <div className="p-4 sm:p-5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-4">
                <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs pb-2 border-b border-amber-200">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>أسئلة الحالة الثانية: تم حل الطلب جزئياً</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    1. ما الجزء الذي تم إنجازه؟ (نص مفتوح) *
                  </label>
                  <input
                    type="text"
                    value={case2_completed}
                    onChange={e => setCase2Completed(e.target.value)}
                    placeholder="مثال: تمت الموافقة المبدئية، تم صرف الدفعة الأولى، تم التنسيق الميداني..."
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    2. ما الجزء الذي لم يُنجز؟ (نص مفتوح) *
                  </label>
                  <input
                    type="text"
                    value={case2_uncompleted}
                    onChange={e => setCase2Uncompleted(e.target.value)}
                    placeholder="مثال: بانتظار التخصيص المالي، بانتظار توقيع الوزير، المعاملة متوقفة في الدائرة..."
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                    required
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold text-slate-800">
                    3. سبب عدم إكمال الطلب يتفرع إلى:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {['عدم اختصاص الجهة المعنية', 'نقص مستندات', 'يحتاج عرضا اضافيا', 'سبب اخر'].map(
                      reason => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setCase2Reason(reason)}
                          className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                            case2_reason === reason
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {reason}
                        </button>
                      )
                    )}
                  </div>

                  {case2_reason === 'سبب اخر' && (
                    <div className="pt-2">
                      <input
                        type="text"
                        value={case2_customReason}
                        onChange={e => setCase2CustomReason(e.target.value)}
                        placeholder="اذكر السبب الآخر بالتحديد..."
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      4. هل المواطن قبل بالنتيجة الجزئية؟
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCase2Accepted('نعم')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          case2_accepted === 'نعم'
                            ? 'bg-amber-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => setCase2Accepted('لا')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          case2_accepted === 'لا'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        لا
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      5. هل يحتاج المكتب إلى إجراء إضافي؟
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCase2OfficeNeedsExtra('نعم')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          case2_officeNeedsExtra === 'نعم'
                            ? 'bg-[#0F1E3A] text-white'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => setCase2OfficeNeedsExtra('لا')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          case2_officeNeedsExtra === 'لا'
                            ? 'bg-slate-700 text-white'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        لا
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold text-slate-800">
                    ملاحظات مسؤول التنظيم (نص مفتوح):
                  </label>
                  <textarea
                    value={case2_notes}
                    onChange={e => setCase2Notes(e.target.value)}
                    placeholder="سجل الخطوات اللاحقة وتوصية مسؤول التنظيم لاستكمال الجزء المتبقي..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* الحالة الثالثة: الطلب يحتاج إلى متابعة                       */}
            {/* ============================================================ */}
            {finalResult === 'الطلب يحتاج متابعة' && (
              <div className="p-4 sm:p-5 rounded-xl bg-sky-50/50 border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-[#0F1E3A] font-extrabold text-xs pb-2 border-b border-slate-200">
                  <AlertCircle className="w-4 h-4 text-[#0F1E3A]" />
                  <span>أسئلة الحالة الثالثة: الطلب يحتاج إلى متابعة</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    أنواع المتابعة (اختر نوع المتابعة أو أكثر):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      'متابعة مع الجهة نفسها',
                      'مخاطبة جهة اخرى',
                      'طلب مستند اضافي',
                      'اعادة مخاطبة'
                    ].map(type => {
                      const isChecked = case3_followup.includes(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleFollowupType(type)}
                          className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                            isChecked
                              ? 'bg-[#0F1E3A] text-white border-[#0F1E3A]'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    ملاحظات مسؤول التنظيم (نص مفتوح):
                  </label>
                  <textarea
                    value={case3_officerNotes}
                    onChange={e => setCase3OfficerNotes(e.target.value)}
                    placeholder="تفاصيل المتابعة الميدانية أو التنسيق مع المديريات..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-[#0F1E3A] outline-none"
                  />
                </div>

                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3.5">
                  <div className="flex items-center gap-2 text-[#0F1E3A] font-extrabold text-xs pb-1.5 border-b border-slate-200">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>دور واستبيان مسؤول التنظيم (التقييم الجماهيري للمواطن):</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="font-bold text-slate-800">هل المواطن راضي عن الخدمة؟</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCase3ServiceSatisfied('نعم')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                            case3_serviceSatisfied === 'نعم'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          نعم
                        </button>
                        <button
                          type="button"
                          onClick={() => setCase3ServiceSatisfied('لا')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                            case3_serviceSatisfied === 'لا'
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          لا
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="font-bold text-slate-800">هل يحتاج إلى متابعة؟</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCase3NeedsFollowup('نعم')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                            case3_needsFollowup === 'نعم'
                              ? 'bg-[#0F1E3A] text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          نعم
                        </button>
                        <button
                          type="button"
                          onClick={() => setCase3NeedsFollowup('لا')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                            case3_needsFollowup === 'لا'
                              ? 'bg-slate-700 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          لا
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="font-bold text-slate-800">هل وافق على التواصل المستقبلي؟</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCase3FutureComm('نعم')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                            case3_futureComm === 'نعم'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          نعم
                        </button>
                        <button
                          type="button"
                          onClick={() => setCase3FutureComm('لا')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                            case3_futureComm === 'لا'
                              ? 'bg-slate-700 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          لا
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="font-bold text-slate-800">هل يشارك في ندوة أو مبادرة عامة؟</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCase3SeminarParticipation('نعم')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                            case3_seminarParticipation === 'نعم'
                              ? 'bg-[#0F1E3A] text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          نعم
                        </button>
                        <button
                          type="button"
                          onClick={() => setCase3SeminarParticipation('لا')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                            case3_seminarParticipation === 'لا'
                              ? 'bg-slate-700 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          لا
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      عدد المرات التي يتردد بها على المكتب:
                    </label>
                    <select
                      value={case3_visitCount}
                      onChange={e => setCase3VisitCount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold outline-none focus:ring-2 focus:ring-[#0F1E3A]"
                    >
                      <option value="مرة واحدة (أول زيارة)">مرة واحدة (أول زيارة)</option>
                      <option value="2 - 3 مرات">2 - 3 مرات</option>
                      <option value="4 - 6 مرات">4 - 6 مرات</option>
                      <option value="أكثر من 6 مرات (متردد دائم)">أكثر من 6 مرات (متردد دائم)</option>
                    </select>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-extrabold text-slate-900 block">
                          هل ترغب بالانضمام إلى فريقنا (كمفتاح نهائي)؟
                        </span>
                        <span className="text-[11px] text-emerald-800">
                          عند اختيار (نعم) يُفتح له ملف تلقائياً في سجل فريق العمل
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCase3JoinTeam('نعم')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            case3_joinTeam === 'نعم'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white text-slate-700 border border-slate-300'
                          }`}
                        >
                          نعم
                        </button>
                        <button
                          type="button"
                          onClick={() => setCase3JoinTeam('لا')}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            case3_joinTeam === 'لا'
                              ? 'bg-slate-700 text-white'
                              : 'bg-white text-slate-700 border border-slate-300'
                          }`}
                        >
                          لا
                        </button>
                      </div>
                    </div>

                    {case3_joinTeam === 'نعم' && (
                      <div className="pt-2 border-t border-emerald-200/70 flex flex-col sm:flex-row items-center gap-2 text-xs">
                        <span className="font-bold text-slate-800 shrink-0">الدور التنظيمي المقترح:</span>
                        <select
                          value={case3_teamRole}
                          onChange={e => setCase3TeamRole(e.target.value)}
                          className="w-full sm:w-auto flex-1 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-slate-900 font-bold text-xs outline-none"
                        >
                          <option value="مفتاح نهائي">مفتاح نهائي</option>
                          <option value="منسق منطقة / حي">منسق منطقة / حي</option>
                          <option value="عضو فريق مبادرات شبابية">عضو فريق مبادرات شبابية</option>
                          <option value="كادر تنظيمي عام">كادر تنظيمي عام</option>
                        </select>
                        <span className="text-[11px] font-bold text-emerald-700 whitespace-nowrap">
                          سيتم فتح ملف مستقل له
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* الحالة الرابعة: لم يتم حل الطلب                              */}
            {/* ============================================================ */}
            {finalResult === 'لم يتم حل الطلب' && (
              <div className="p-4 sm:p-5 rounded-xl bg-rose-50/50 border border-rose-200 space-y-4">
                <div className="flex items-center gap-2 text-rose-900 font-extrabold text-xs pb-2 border-b border-rose-200">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>أسئلة الحالة الرابعة: لم يتم حل الطلب</span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    سبب عدم الإنجاز (اختر السبب المحدد):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {[
                      'رفض الجهة المختصة',
                      'خارج اختصاص المكتب',
                      'نقص مستندات',
                      'عدم مكانية قانونية',
                      'عدم استجابة الطلب',
                      'تعذر تنفيذ الطلب',
                      'سبب اخر'
                    ].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setCase4Reason(r)}
                        className={`p-2.5 rounded-lg border text-xs font-bold transition-all text-center cursor-pointer ${
                          case4_reason === r
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>

                  {case4_reason === 'سبب اخر' && (
                    <div className="pt-2">
                      <input
                        type="text"
                        value={case4_customReason}
                        onChange={e => setCase4CustomReason(e.target.value)}
                        placeholder="اكتب سبب عدم الإنجاز بالتفصيل..."
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-slate-800 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      هل تم شرح سبب عدم الإنجاز للمواطن؟
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCase4Explained('نعم')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          case4_explained === 'نعم'
                            ? 'bg-rose-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => setCase4Explained('لا')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          case4_explained === 'لا'
                            ? 'bg-slate-700 text-white'
                            : 'bg-white text-slate-700 border border-slate-300'
                        }`}
                      >
                        لا
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      موقف المواطن من النتيجة:
                    </label>
                    <div className="flex items-center gap-1.5">
                      {['متفهم', 'غير متفهم', 'غير راضي'].map(st => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setCase4Stance(st as any)}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            case4_stance === st
                              ? st === 'متفهم'
                                ? 'bg-emerald-600 text-white'
                                : st === 'غير متفهم'
                                ? 'bg-amber-600 text-white'
                                : 'bg-rose-700 text-white'
                              : 'bg-white text-slate-700 border border-slate-300'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-amber-950 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>تنبيه النظام:</strong> تظهر نتيجة الطلب:{' '}
                    <span className="font-extrabold text-rose-700 mx-1">غير منجز</span>
                    — سبب عدم الإنجاز:{' '}
                    <span className="font-extrabold text-slate-900 mx-1">
                      {case4_reason === 'سبب اخر' && case4_customReason ? case4_customReason : case4_reason}
                    </span>
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    ملاحظات مسؤول التنظيم (نص مفتوح):
                  </label>
                  <textarea
                    value={case4_notes}
                    onChange={e => setCase4Notes(e.target.value)}
                    placeholder="سجل توجيهات النائب أو المسار البديل أو الإجراء الذي تم لتهدئة وشرح الموقف للمواطن..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                {citizenDossier && (
                  <button
                    type="button"
                    onClick={handlePrintRequestCard}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة بطاقة الطلب (A4)</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  إلغاء وتراجع
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#0F1E3A] hover:bg-[#162B52] text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-all whitespace-nowrap"
                >
                  <Save className="w-4 h-4 text-amber-300" />
                  <span>حفظ النتيجة النهائية والترحيل</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
