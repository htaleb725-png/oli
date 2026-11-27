import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { OfficeRequest, Citizen } from '../types';
import { 
  UserPlus, 
  FolderKanban, 
  ShieldCheck, 
  Handshake, 
  Users2, 
  Search, 
  BarChart3, 
  MessageSquare, 
  Globe, 
  KeyRound, 
  ArrowLeft, 
  Briefcase, 
  Activity, 
  Users,
  CheckCircle2,
  XCircle,
  Sparkles,
  Phone,
  MapPin,
  Clock,
  Send,
  Eye,
  FileText,
  AlertTriangle,
  Building2,
  Check,
  X,
  Filter,
  Layers,
  ChevronLeft,
  LayoutGrid,
  Download,
  Printer,
  Trash2,
  FolderPlus,
  HeartHandshake,
  Archive,
  History,
  RotateCcw,
  Ban
} from 'lucide-react';
import { CustomSectionsManager } from './developer/CustomSectionsManager';
import { UsersAndPermissionsManager } from './developer/UsersAndPermissionsManager';
import { OfficeIconTilesGrid } from './OfficeIconTilesGrid';
import { DepartmentAnalyticsDashboard } from './DepartmentAnalyticsDashboard';
import { exportUnifiedSystemExcel } from '../services/unifiedExcelExporter';
import {
  isCitizenArchivedInSection,
  isRequestArchivedInSection,
  isRequestArchivedOrRestored
} from '../utils/archiveHelper';

// Executive Office Module


export const DirectorExecutiveModule: React.FC = () => {
  const { 
    citizens, 
    requests, 
    updateCitizen,
    updateRequest,
    deleteRequest,
    deleteCitizen,
    interviews, 
    organizationRecords, 
    cheques,
    officialLetters,
    customSections,
    customRecords,
    systemSettings,
    auditLogs, 
    users, 
    whatsappTemplates,
    currentUser,
    addAuditLog,
    addNotification,
    blockCitizen,
    archiveDailyWorkItems,
    restoreDailyWorkItem,
    restoreDailyWorkItems,
    setActiveSection,
    firestoreRequestsSyncError,
    firestoreLastSaveError,
    clearFirestoreDiagnostics,
    fetchAllFromFirestoreNow,
    isFirestoreSyncing
  } = useApp();

  const [directorViewMode, setDirectorViewMode] = useState<'daily' | 'section_archive'>('daily');
  const [confirmClearCompleted, setConfirmClearCompleted] = useState(false);
  const [archiveToast, setArchiveToast] = useState<string | null>(null);

  const handleDirectorExportUnifiedExcel = () => {
    exportUnifiedSystemExcel({
      citizens,
      requests,
      interviews,
      cheques,
      organizationRecords,
      officialLetters,
      customSections,
      customRecords,
      officeName: systemSettings.officeName || systemSettings.appName,
      exporterName: currentUser?.FullName || 'مدير المكتب التنفيذي'
    });
  };

  // Navigation mode: 'inbox' (وارد الاستعلامات) | 'icon_hub' (شبكة الأيقونات) | 'permissions' (صلاحيات الموظفين والأقسام) | 'manage_sections' (إدارة واستحداث الأقسام)
  const [directorMainTab, setDirectorMainTab] = useState<'inbox' | 'icon_hub' | 'permissions' | 'manage_sections'>('inbox');

  // Deletion modals state for permanent removal
  const [requestToDelete, setRequestToDelete] = useState<OfficeRequest | null>(null);
  const [citizenToDelete, setCitizenToDelete] = useState<Citizen | null>(null);

  // Cumulative History Modal ("السجل التراكمي") for Director
  const [cumulativeModalTarget, setCumulativeModalTarget] = useState<{
    citizenName: string;
    citizenId?: string;
    phone?: string;
    district?: string;
    requests: OfficeRequest[];
  } | null>(null);

  // Search & Filter state for Director Inbox: default to 'pending' so decided items disappear
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'special' | 'general' | 'rejected' | 'all'>('pending');
  const [decisionBanner, setDecisionBanner] = useState<{ id: string; name: string; decision: string } | null>(null);

  // Local state for Director notes input per request
  const [directorNotesMap, setDirectorNotesMap] = useState<Record<string, string>>({});
  const [savedFeedbackId, setSavedFeedbackId] = useState<string | null>(null);

  // Rejection Reason Modal & Prompt State
  const [rejectModalRequest, setRejectModalRequest] = useState<OfficeRequest | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState<string>('');

  // Director Block Citizen Modal State (القائمة السوداء والحظر من شاشة المدير)
  const [blockModalRequest, setBlockModalRequest] = useState<OfficeRequest | null>(null);
  const [blockReasonText, setBlockReasonText] = useState<string>('');

  const PRESET_BLOCK_REASONS = [
    'تجاوز وإساءة لفظية أو سلوكية تجاه كادر المكتب',
    'تقديم معلومات أو مستمسكات غير صحيحة أو مزورة',
    'تكرار المراجعة والطلبات الكيدية رغم حسم الموضوع سابقاً',
    'إخلال بضوابط وتعليمات مكتب النائب',
    'حظر إداري وأمني بقرار مباشر من مدير المكتب'
  ];

  const PRESET_REJECTION_REASONS = [
    'عدم استيفاء الشروط والضوابط القانونية النافذة',
    'خارج الاختصاص التشريعي والخدمي لمكتب النائب',
    'نقص في المستمسكات والوثائق الرسمية المطلوبة',
    'تم إنجاز الطلب والتنسيق مسبقاً مع الدائرة المعنية',
    'اعتذار لعدم توفر التخصيص أو الإمكانية في الوقت الحالي',
    'مكرر لنفس المواطن وتم اتخاذ الإجراء فيه سابقاً'
  ];

  // Pagination limit so Director view stays blazing fast even with thousands of requests
  const [visibleLimit, setVisibleLimit] = useState(40);

  // Map of citizens for fast lookup
  const citizenMap = useMemo(() => {
    const map = new Map<string, Citizen>();
    citizens.forEach(c => map.set(c.Citizen_ID, c));
    return map;
  }, [citizens]);

  // Fast O(N) index of ALL requests (active + archived/historical) for instant "السجل التراكمي" lookup
  const cumulativeRequestsIndex = useMemo(() => {
    const normalizeName = (s?: string) =>
      String(s || '')
        .toLowerCase()
        .replace(/[إأآا]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[\u064B-\u065F\u0640]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const normalizePhone = (s?: string) => {
      const digits = String(s || '')
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .replace(/[^0-9]/g, '');
      return digits.length >= 8 ? digits.slice(-10) : '';
    };

    const byCitizenId = new Map<string, OfficeRequest[]>();
    const byName = new Map<string, OfficeRequest[]>();
    const byPhone = new Map<string, OfficeRequest[]>();

    const pushTo = (map: Map<string, OfficeRequest[]>, key: string, item: OfficeRequest) => {
      if (!key) return;
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    };

    (requests || []).forEach(r => {
      if (!r) return;
      if (r.Citizen_ID) pushTo(byCitizenId, r.Citizen_ID, r);
      const cit = r.Citizen_ID ? citizenMap.get(r.Citizen_ID) : undefined;
      const normName = normalizeName(r.CitizenName || cit?.FullName);
      if (normName.length >= 4) pushTo(byName, normName, r);
      const normPh = normalizePhone(r.CitizenPhone || cit?.Phone1);
      if (normPh) pushTo(byPhone, normPh, r);
    });

    return { byCitizenId, byName, byPhone, normalizeName, normalizePhone };
  }, [requests, citizenMap]);

  const getCumulativeRequestsFor = (req: OfficeRequest, cit?: Citizen): OfficeRequest[] => {
    const seen = new Map<string, OfficeRequest>();
    const addAll = (list?: OfficeRequest[]) => {
      if (!list) return;
      for (const item of list) {
        if (item?.Request_ID) seen.set(item.Request_ID, item);
      }
    };
    if (req.Citizen_ID) addAll(cumulativeRequestsIndex.byCitizenId.get(req.Citizen_ID));
    const normName = cumulativeRequestsIndex.normalizeName(req.CitizenName || cit?.FullName);
    if (normName.length >= 4) addAll(cumulativeRequestsIndex.byName.get(normName));
    const normPh = cumulativeRequestsIndex.normalizePhone(req.CitizenPhone || cit?.Phone1);
    if (normPh) addAll(cumulativeRequestsIndex.byPhone.get(normPh));

    return Array.from(seen.values()).sort((a, b) => {
      const tsA = Date.parse(String(a.UpdatedAt || a.CreatedAt || '').replace(' ', 'T')) || 0;
      const tsB = Date.parse(String(b.UpdatedAt || b.CreatedAt || '').replace(' ', 'T')) || 0;
      return tsB - tsA;
    });
  };

  const parseReqTs = (r: OfficeRequest) => {
    const raw = String(r.UpdatedAt || r.CreatedAt || '').trim();
    if (!raw) return 0;
    let t = Date.parse(raw);
    if (isNaN(t) && /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(raw)) {
      t = Date.parse(raw.replace(' ', 'T'));
    }
    return isNaN(t) ? 0 : t;
  };

  const isDirectorRequestArchived = (r: OfficeRequest): boolean => {
    if (isRequestArchivedInSection(r, 'director')) return true;
    // Explicitly active live requests (e.g. newly registered in Reception) MUST NEVER be hidden
    // by a stale/historical archive flag on the parent citizen record.
    if (r.IsArchived === false && !r.IsHistoricalImported) return false;
    const cit = citizenMap.get(r.Citizen_ID);
    return isCitizenArchivedInSection(cit, 'director');
  };

  // Independent per-section archived requests for Director ('director')
  const archivedDirectorRequests = useMemo(() => {
    return (requests || [])
      .filter(r => {
        if (!r || r.IsDirectInstantRequest) return false;
        return isDirectorRequestArchived(r);
      })
      .slice()
      .sort((a, b) => parseReqTs(b) - parseReqTs(a));
  }, [requests, citizenMap]);

  const archivedDirectorCount = archivedDirectorRequests.length;

  // Strictly show ALL active (unarchived in 'director') requests immediately without requiring extra optional fields
  const activeDirectorRequests = useMemo(() => {
    return (requests || [])
      .filter(r => {
        if (!r || r.IsDirectInstantRequest) return false;
        return !isDirectorRequestArchived(r);
      })
      .slice()
      .sort((a, b) => parseReqTs(b) - parseReqTs(a));
  }, [requests, citizenMap]);

  const importedDirectorRequests = useMemo(() => {
    const importRegex = /استيراد|إكسل|اكسل|مسترد|تصفية|ملف|مقاطعة/i;
    return activeDirectorRequests.filter(r => {
      const cit = citizenMap.get(r.Citizen_ID);
      return (
        Boolean(r.IsHistoricalImported || cit?.IsHistoricalImported) ||
        String(r.Request_ID || '').includes('-IMP-') ||
        importRegex.test(String(r.CreatedBy || '')) ||
        importRegex.test(String(r.RegisteredVia || '')) ||
        importRegex.test(String(cit?.ReferralSource || ''))
      );
    });
  }, [activeDirectorRequests, citizenMap]);

  const showArchiveToast = (msg: string) => {
    setArchiveToast(msg);
    window.setTimeout(() => {
      setArchiveToast(prev => (prev === msg ? null : prev));
    }, 4500);
  };

  const resolveNormalizedDecision = (r: OfficeRequest): 'خاص' | 'عام' | 'رفض' | 'حظر' | '' => {
    const dec = String(r.DirectorDecision || '').trim();
    const pType = String(r.pathType || r.route || '').trim().toLowerCase();
    if (dec === 'حظر' || pType === 'blocked') return 'حظر';
    if (dec === 'خاص' || pType === 'private') return 'خاص';
    if (dec === 'عام' || pType === 'public') return 'عام';
    if (dec === 'رفض' || pType === 'rejected') return 'رفض';
    return '';
  };

  // Reception requests list (active Daily Work OR Director Section Archive depending on directorViewMode)
  const receptionRequests = useMemo(() => {
    const sourceList = directorViewMode === 'section_archive' ? archivedDirectorRequests : activeDirectorRequests;
    return sourceList
      .filter(r => {
        // Match search query
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const cit = citizenMap.get(r.Citizen_ID);
        return (
          r.CitizenName?.toLowerCase().includes(q) ||
          r.Request_ID?.toLowerCase().includes(q) ||
          r.CitizenPhone?.toLowerCase().includes(q) ||
          r.Entity?.toLowerCase().includes(q) ||
          r.Details?.toLowerCase().includes(q) ||
          (cit?.District && cit.District.toLowerCase().includes(q))
        );
      })
      .filter(r => {
        if (directorViewMode === 'section_archive') return true;
        const dec = resolveNormalizedDecision(r);
        if (statusFilter === 'pending') return !dec;
        if (statusFilter === 'special') return dec === 'خاص';
        if (statusFilter === 'general') return dec === 'عام';
        if (statusFilter === 'rejected') return dec === 'رفض' || dec === 'حظر';
        if (statusFilter === 'all') return true;
        return !dec;
      });
  }, [activeDirectorRequests, archivedDirectorRequests, directorViewMode, searchQuery, statusFilter, citizenMap]);

  // Statistics counters (daily live workflow only, never inflated by Excel historical archive imports)
  const stats = useMemo(() => {
    let pending = 0;
    let special = 0;
    let general = 0;
    let rejected = 0;

    activeDirectorRequests.forEach(r => {
      const dec = resolveNormalizedDecision(r);
      if (!dec) pending++;
      else if (dec === 'خاص') special++;
      else if (dec === 'عام') general++;
      else if (dec === 'رفض' || dec === 'حظر') rejected++;
    });

    return { total: activeDirectorRequests.length, pending, special, general, rejected };
  }, [activeDirectorRequests]);

  // Handle Director Decision action: 'خاص' | 'عام' | 'رفض'
  const handleDirectorDecision = (request: OfficeRequest, decision: 'خاص' | 'عام' | 'رفض', explicitRejectionReason?: string) => {
    let noteText = directorNotesMap[request.Request_ID] !== undefined 
      ? directorNotesMap[request.Request_ID] 
      : (request.DirectorNotes || '');

    if (decision === 'رفض' && explicitRejectionReason && explicitRejectionReason.trim()) {
      noteText = explicitRejectionReason.trim();
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const linkedCitizen = citizenMap.get(request.Citizen_ID);

    const nextStage = decision === 'رفض' ? 'مدير الإدارة' : 'مدير الإدارة';
    const pathTypeValue = decision === 'خاص' ? 'private' : decision === 'عام' ? 'public' : 'rejected';
    const targetDeptValue =
      decision === 'خاص'
        ? 'قسم المعتمد الخاص'
        : decision === 'عام'
        ? 'قسم المعتمد العام'
        : (request.TargetDepartment || 'قسم الإدارة');

    // Preserve ALL existing citizen & request fields intact (never empty or lose any field!)
    // Strictly route Director -> Admin (never auto-referring to Organization)
    const updatedRequest: OfficeRequest = {
      ...request,
      CitizenName: request.CitizenName || linkedCitizen?.FullName || 'مراجع',
      CitizenPhone: request.CitizenPhone || linkedCitizen?.Phone1 || '',
      Address: request.Address || request.CitizenAddress || linkedCitizen?.District || '',
      ResidentialArea: request.ResidentialArea || linkedCitizen?.ResidentialArea || linkedCitizen?.SubDistrict || '',
      ReferralSource: request.ReferralSource || linkedCitizen?.ReferralSource || '',
      Education: request.Education || linkedCitizen?.Education || '',
      Job: request.Job || linkedCitizen?.Job || '',
      Entity: request.Entity || 'غير محدد',
      Details: request.Details || '',
      DirectorDecision: decision,
      pathType: pathTypeValue,
      route: pathTypeValue,
      department: targetDeptValue,
      TargetDepartment: targetDeptValue,
      DirectorNotes: noteText.trim() || '',
      RejectionReason: decision === 'رفض' ? (noteText.trim() || 'عدم استيفاء الشروط والضوابط') : '',
      DirectorDecisionDate: formattedDate,
      DirectorDecisionBy: currentUser ? `${currentUser.FullName} (مدير المكتب)` : 'مدير المكتب',
      CurrentStage: nextStage,
      referredToOrganization: false,
      ProcessingStatus: decision === 'رفض' ? 'مرفوض' : (request.ProcessingStatus === 'قيد الإجراء' ? 'قيد التدقيق' : request.ProcessingStatus || 'قيد التدقيق'),
      DeputyNotes: decision === 'رفض'
        ? `[سبب الرفض من قبل مدير المكتب]: ${noteText.trim() || 'عدم استيفاء الشروط والضوابط'}`
        : noteText.trim() 
          ? `[توجيه المدير - ${decision}]: ${noteText.trim()}` 
          : `[قرار المدير]: ${decision}`,
      UpdatedAt: nowIso
    };

    updateRequest(updatedRequest);

    // Advance linked Citizen workflow stage to Admin (never Organization)
    if (linkedCitizen && linkedCitizen.CurrentStage !== nextStage) {
      updateCitizen({
        ...linkedCitizen,
        CurrentStage: nextStage,
        UpdatedAt: nowIso
      });
    }

    // Immediate live Firestore notification for Admin (appears instantaneously on Admin screen via onSnapshot)
    const decisionTitle =
      decision === 'خاص'
        ? `⭐ قرار مدير المكتب (مسار خاص): ${updatedRequest.CitizenName}`
        : decision === 'عام'
        ? `✅ قرار مدير المكتب (مسار عام): ${updatedRequest.CitizenName}`
        : `⛔ رفض معاملة من مدير المكتب: ${updatedRequest.CitizenName}`;
    addNotification({
      title: decisionTitle,
      message: `الطلب (${updatedRequest.Request_ID}) — الجهة: ${updatedRequest.Entity} | المسار: ${targetDeptValue}${noteText.trim() ? ` | توجيه المدير: ${noteText.trim()}` : ''}`,
      type: 'director_decision',
      category: 'director',
      priority: decision === 'خاص' ? 'urgent' : 'high',
      linkSection: 'admin',
      entityId: updatedRequest.Request_ID,
      targetRoles: ['admin', 'admin_officer', 'developer']
    });

    addAuditLog(
      `قرار مدير المكتب (${decision})`,
      'قسم مدير المكتب',
      `تم اعتماد قرار (${decision}) للطلب رقم ${updatedRequest.Request_ID} الخاص بالمواطن ${updatedRequest.CitizenName} (${targetDeptValue})${noteText.trim() ? ` مع بيان السبب/التوجيه: ${noteText.trim()}` : ''}`
    );

    setDecisionBanner({
      id: updatedRequest.Request_ID,
      name: updatedRequest.CitizenName,
      decision: decision
    });

    setSavedFeedbackId(updatedRequest.Request_ID);
    setTimeout(() => setSavedFeedbackId(null), 3000);
  };

  // Handle Director Block action: saves to Firestore `blacklist`, updates `visitors` + `requests` (IsBlocked: true), notifies Admin & Reception, and syncs Google Sheets in background
  const handleDirectorBlockCitizen = (request: OfficeRequest, explicitBlockReason: string) => {
    const cleanReason =
      explicitBlockReason.trim() ||
      (directorNotesMap[request.Request_ID] || '').trim() ||
      'حظر بقرار مباشر من مدير المكتب التنفيذي';
    const now = new Date();
    const nowIso = now.toISOString();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const linkedCitizen = citizenMap.get(request.Citizen_ID);
    const directorActor = currentUser ? `${currentUser.FullName} (مدير المكتب)` : 'مدير المكتب';

    // 1. Add directly to Firestore `blacklist` + update citizen & matching requests + non-blocking Google Sheets backup
    blockCitizen(
      request.Citizen_ID,
      cleanReason,
      directorActor,
      {
        FullName: request.CitizenName || linkedCitizen?.FullName || 'مراجع',
        Phone1: request.CitizenPhone || linkedCitizen?.Phone1 || '',
        Phone2: linkedCitizen?.Phone2 || '',
        District: linkedCitizen?.District || request.Address || 'الناصرية - المركز'
      }
    );

    // 2. Forward the transaction to Admin with full fields preserved & marked blocked (isolated from Organization)
    const updatedRequest: OfficeRequest = {
      ...request,
      CitizenName: request.CitizenName || linkedCitizen?.FullName || 'مراجع',
      CitizenPhone: request.CitizenPhone || linkedCitizen?.Phone1 || '',
      Address: request.Address || request.CitizenAddress || linkedCitizen?.District || '',
      ResidentialArea: request.ResidentialArea || linkedCitizen?.ResidentialArea || linkedCitizen?.SubDistrict || '',
      ReferralSource: request.ReferralSource || linkedCitizen?.ReferralSource || '',
      Education: request.Education || linkedCitizen?.Education || '',
      Job: request.Job || linkedCitizen?.Job || '',
      Entity: request.Entity || 'غير محدد',
      Details: request.Details || '',
      IsBlocked: true,
      BlockReason: cleanReason,
      DirectorDecision: 'حظر',
      pathType: 'blocked',
      route: 'blocked',
      department: 'قسم الإدارة',
      TargetDepartment: 'قسم الإدارة',
      CurrentStage: 'مدير الإدارة',
      referredToOrganization: false,
      ProcessingStatus: 'مرفوض',
      DirectorNotes: cleanReason,
      RejectionReason: cleanReason,
      DirectorDecisionDate: formattedDate,
      DirectorDecisionBy: directorActor,
      DeputyNotes: `[قرار حظر من مدير المكتب]: ${cleanReason}`,
      UpdatedAt: nowIso
    };

    updateRequest(updatedRequest);

    // 3. Live Firestore notification to Admin & Reception
    addNotification({
      title: `🚫 حظر مراجع بقرار مدير المكتب: ${updatedRequest.CitizenName}`,
      message: `تم إدراج المراجع (${updatedRequest.Citizen_ID}) في القائمة السوداء وحظر المعاملة (${updatedRequest.Request_ID}) — سبب الحظر: ${cleanReason}`,
      type: 'director_decision',
      category: 'director',
      priority: 'urgent',
      linkSection: 'admin',
      entityId: updatedRequest.Request_ID,
      targetRoles: ['admin', 'admin_officer', 'reception', 'reception_officer', 'developer']
    });

    addAuditLog(
      'حظر مراجع (قرار مدير المكتب)',
      'قسم مدير المكتب',
      `تم حظر المواطن ${updatedRequest.CitizenName} (${updatedRequest.Citizen_ID}) وإدراجه في القائمة السوداء بسبب: ${cleanReason}`
    );

    setDecisionBanner({
      id: updatedRequest.Request_ID,
      name: updatedRequest.CitizenName,
      decision: 'حظر (القائمة السوداء)'
    });
    setSavedFeedbackId(updatedRequest.Request_ID);
    setTimeout(() => setSavedFeedbackId(null), 3500);
  };

  const handleSaveNotesOnly = (request: OfficeRequest) => {
    const noteText = directorNotesMap[request.Request_ID] !== undefined 
      ? directorNotesMap[request.Request_ID] 
      : (request.DirectorNotes || '');
    const linkedCitizen = citizenMap.get(request.Citizen_ID);

    const updatedRequest: OfficeRequest = {
      ...request,
      CitizenName: request.CitizenName || linkedCitizen?.FullName || 'مراجع',
      CitizenPhone: request.CitizenPhone || linkedCitizen?.Phone1 || '',
      DirectorNotes: noteText.trim() || '',
      DeputyNotes: noteText.trim() 
        ? `[توجيه المدير]: ${noteText.trim()}` 
        : request.DeputyNotes,
      UpdatedAt: new Date().toISOString()
    };

    updateRequest(updatedRequest);

    // Live Firestore notification to Admin when Director saves or updates directive notes
    addNotification({
      title: `📝 توجيه وملاحظة من مدير المكتب: ${updatedRequest.CitizenName}`,
      message: `الطلب (${updatedRequest.Request_ID}) — ${noteText.trim() || 'تم تحديث ملاحظة المدير على المعاملة'}`,
      type: 'director_decision',
      category: 'director',
      priority: 'high',
      linkSection: 'admin',
      entityId: updatedRequest.Request_ID,
      targetRoles: ['admin', 'admin_officer', 'developer']
    });

    addAuditLog(
      'تحديث ملاحظات مدير المكتب',
      'قسم مدير المكتب',
      `تم حفظ وتحديث ملاحظات المدير للطلب رقم ${updatedRequest.Request_ID}: ${noteText.trim()}`
    );

    setSavedFeedbackId(updatedRequest.Request_ID);
    setTimeout(() => setSavedFeedbackId(null), 3000);
  };



  return (
    <div className="space-y-4 text-right animate-in fade-in duration-200 font-['Tajawal',sans-serif]" dir="rtl">
      
      {/* ---------------- TOP EXECUTIVE HEADER ---------------- */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-amber-500/20 shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                الإدارة التنفيذية العليا
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                مكتب النائب علا عودة الناشي
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
              شاشة مدير المكتب التنفيذي • اعتماد وتوجيه وارد الاستعلامات
            </h2>
          </div>
        </div>

        {/* View Switcher: وارد الاستعلامات vs شبكة الأيقونات المركزية vs إدارة الأقسام */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <button
            type="button"
            onClick={() => setDirectorMainTab('inbox')}
            className={`flex-1 md:flex-initial h-10 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              directorMainTab === 'inbox'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 ring-2 ring-amber-400/40'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <FolderKanban className="w-4 h-4" />
            <span>وارد الاستعلامات</span>
            {stats.pending > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-mono animate-pulse">
                {stats.pending}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setDirectorMainTab('icon_hub')}
            className={`flex-1 md:flex-initial h-10 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              directorMainTab === 'icon_hub'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-500/40'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>شبكة أيقونات الأقسام الرسمية</span>
          </button>

          <button
            type="button"
            onClick={() => setDirectorMainTab('permissions')}
            className={`flex-1 md:flex-initial h-10 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              directorMainTab === 'permissions'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-500/40'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>قسم الصلاحيات والموظفين ({users.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setDirectorMainTab('manage_sections')}
            className={`flex-1 md:flex-initial h-10 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              directorMainTab === 'manage_sections'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-2 ring-purple-500/40'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <FolderPlus className="w-4 h-4 text-amber-300" />
            <span>إدارة وتطوير الأقسام</span>
          </button>

          {/* Direct Exit to System Icon Hub */}
          <button
            type="button"
            onClick={() => setActiveSection('dashboard')}
            className="flex-1 md:flex-initial h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 transition-all cursor-pointer active:scale-95"
            title="الخروج وتصفح كامل المنظومة عن طريق لوحة الأيقونات المركزية"
          >
            <LayoutGrid className="w-4 h-4 text-slate-950" />
            <span>الخروج للأيقونات المركزية 🌐</span>
          </button>

          {/* Comprehensive Excel Export */}
          <button
            type="button"
            onClick={handleDirectorExportUnifiedExcel}
            className="flex-1 md:flex-initial h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-teal-600/25 transition-all cursor-pointer active:scale-95"
            title="تصدير قاعدة بيانات المنظومة بالكامل بكافة الجداول والصور والمرفقات في ملف Excel واحد"
          >
            <Download className="w-4 h-4 text-white" />
            <span>تصدير Excel الشامل</span>
          </button>
        </div>
      </div>

      {/* ---------------- VIEW 1: DIRECTOR INBOX (وارد الاستعلامات بشريط واحد) ---------------- */}
      {directorMainTab === 'inbox' && (
        <div className="space-y-4">
          {/* Explicit Firestore Sync / Save Diagnostic Alert (only shown if a real failure occurs) */}
          {(firestoreRequestsSyncError || firestoreLastSaveError) && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-black text-rose-800 dark:text-rose-200">
                    ⚠️ تنبيه تشخيصي: تعذر جلب أو حفظ المعاملات مع قاعدة البيانات
                  </div>
                  <div className="font-semibold leading-relaxed break-words">
                    {firestoreRequestsSyncError || firestoreLastSaveError}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={isFirestoreSyncing}
                  onClick={() => {
                    fetchAllFromFirestoreNow();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {isFirestoreSyncing ? 'جاري التحديث...' : 'إعادة الجلب الآن'}
                </button>
                <button
                  type="button"
                  onClick={clearFirestoreDiagnostics}
                  className="w-7 h-7 rounded-lg bg-rose-200/70 dark:bg-rose-900/70 hover:bg-rose-300 text-rose-800 dark:text-rose-200 text-xs font-black flex items-center justify-center cursor-pointer"
                  title="إغلاق التنبيه"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Quick Statistics Overview: أقسام وتصنيفات قرارات المدير */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* 1. إجمالي الوارد وبانتظار قرار المدير */}
            <div 
              onClick={() => setStatusFilter('pending')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                statusFilter === 'pending'
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 border-amber-600 shadow-lg shadow-amber-500/25 ring-2 ring-amber-400'
                  : 'bg-white dark:bg-slate-900 border-amber-300/80 dark:border-amber-800/60 hover:border-amber-500 hover:shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-black block ${statusFilter === 'pending' ? 'text-slate-950' : 'text-amber-700 dark:text-amber-400'}`}>
                  📥 إجمالي الوارد (بانتظار القرار)
                </span>
                {stats.pending > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${statusFilter === 'pending' ? 'text-slate-950' : 'text-slate-900 dark:text-white'}`}>
                  {stats.pending}
                </span>
                <span className={`text-[10px] font-bold ${statusFilter === 'pending' ? 'text-slate-950/80' : 'text-slate-400'}`}>
                  تختفي فور اتخاذ القرار
                </span>
              </div>
            </div>

            {/* 2. قسم معتمد (مسار خاص) */}
            <div 
              onClick={() => setStatusFilter('special')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === 'special'
                  ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white border-purple-700 shadow-lg shadow-purple-600/25 ring-2 ring-purple-400'
                  : 'bg-white dark:bg-slate-900 border-purple-200 dark:border-purple-800/60 hover:border-purple-400 hover:shadow-xs'
              }`}
            >
              <span className={`text-[11px] font-black block ${statusFilter === 'special' ? 'text-purple-100' : 'text-purple-700 dark:text-purple-400'}`}>
                🟣 قسم معتمد (مسار خاص)
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${statusFilter === 'special' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {stats.special}
                </span>
                <span className={`text-[10px] font-bold ${statusFilter === 'special' ? 'text-purple-200' : 'text-slate-400'}`}>
                  محفوظة بالمسار الخاص
                </span>
              </div>
            </div>

            {/* 3. قسم معتمد (مسار عام) */}
            <div 
              onClick={() => setStatusFilter('general')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                statusFilter === 'general'
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-emerald-700 shadow-lg shadow-emerald-600/25 ring-2 ring-emerald-400'
                  : 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400 hover:shadow-xs'
              }`}
            >
              <span className={`text-[11px] font-black block ${statusFilter === 'general' ? 'text-emerald-100' : 'text-emerald-700 dark:text-emerald-400'}`}>
                🟢 قسم معتمد (مسار عام)
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${statusFilter === 'general' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {stats.general}
                </span>
                <span className={`text-[10px] font-bold ${statusFilter === 'general' ? 'text-emerald-200' : 'text-slate-400'}`}>
                  محفوظة بالمسار العام
                </span>
              </div>
            </div>

            {/* 4. قسم المرفوض (رفض) */}
            <div 
              onClick={() => setStatusFilter('rejected')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                statusFilter === 'rejected'
                  ? 'bg-gradient-to-br from-red-600 to-red-700 text-white border-red-700 shadow-lg shadow-red-600/25 ring-2 ring-red-400'
                  : 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-800/60 hover:border-red-400 hover:shadow-xs'
              }`}
            >
              <span className={`text-[11px] font-black block ${statusFilter === 'rejected' ? 'text-red-100' : 'text-red-700 dark:text-red-400'}`}>
                🔴 قسم المرفوض (رفض)
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${statusFilter === 'rejected' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {stats.rejected}
                </span>
                <span className={`text-[10px] font-bold ${statusFilter === 'rejected' ? 'text-red-200' : 'text-slate-400'}`}>
                  محفوظة ومميزة بالأحمر
                </span>
              </div>
            </div>

            {/* 5. الأرشيف الشامل (كافة الحالات) */}
            <div 
              onClick={() => setStatusFilter('all')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/25 ring-2 ring-slate-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 hover:shadow-xs'
              }`}
            >
              <span className={`text-[11px] font-black block ${statusFilter === 'all' ? 'text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                📁 الأرشيف الشامل (الكل)
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className={`text-2xl font-black font-mono ${statusFilter === 'all' ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {stats.total}
                </span>
                <span className={`text-[10px] font-bold ${statusFilter === 'all' ? 'text-slate-400' : 'text-slate-400'}`}>
                  كافة الحالات المحفوظة
                </span>
              </div>
            </div>
          </div>

          {/* Decision Notification Toast Banner: يظهر فور اتخاذ القرار لتأكيد اختفائه من الوارد وحفظه في القسم المخصص */}
          {decisionBanner && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-purple-500/15 to-blue-500/15 border border-emerald-300 dark:border-emerald-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm">
              <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  ✓ تم بنجاح اعتماد قرار <span className="font-black underline">({decisionBanner.decision})</span> للطلب رقم <span className="font-mono font-black">{decisionBanner.id}</span> ({decisionBanner.name}) — اختفى من قائمة الوارد وبانتظار وتـم حفظه بنجاح في قسم <span className="font-black text-purple-700 dark:text-purple-300">({decisionBanner.decision === 'خاص' ? 'معتمد مسار خاص' : decisionBanner.decision === 'عام' ? 'معتمد مسار عام' : 'المرفوض'})</span>.
                </span>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter(
                      decisionBanner.decision === 'خاص' ? 'special' :
                      decisionBanner.decision === 'عام' ? 'general' : 'rejected'
                    );
                    setDecisionBanner(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
                >
                  <span>عرض في قسم ({decisionBanner.decision === 'خاص' ? 'مسار خاص' : decisionBanner.decision === 'عام' ? 'مسار عام' : 'المرفوض'})</span>
                  <span>⇦</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDecisionBanner(null)}
                  className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center cursor-pointer"
                  title="إغلاق الإشعار"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Active Section Description Banner */}
          <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 transition-all text-xs font-semibold shadow-xs ${
            statusFilter === 'pending'
              ? 'bg-amber-500/10 border-amber-300 dark:border-amber-700/80 text-amber-950 dark:text-amber-200'
              : statusFilter === 'special'
              ? 'bg-purple-500/10 border-purple-300 dark:border-purple-700/80 text-purple-950 dark:text-purple-200'
              : statusFilter === 'general'
              ? 'bg-emerald-500/10 border-emerald-300 dark:border-emerald-700/80 text-emerald-950 dark:text-emerald-200'
              : statusFilter === 'rejected'
              ? 'bg-red-500/10 border-red-300 dark:border-red-700/80 text-red-950 dark:text-red-200'
              : 'bg-slate-500/10 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                statusFilter === 'pending' ? 'bg-amber-500 animate-pulse' :
                statusFilter === 'special' ? 'bg-purple-600' :
                statusFilter === 'general' ? 'bg-emerald-600' :
                statusFilter === 'rejected' ? 'bg-red-600' : 'bg-slate-600'
              }`} />
              <span>
                {statusFilter === 'pending' && '📥 قسم إجمالي الوارد (بانتظار قرار المدير): بمجرد الضغط على (خاص) أو (عام) أو (رفض) يختفي الطلب فوراً من هنا ويُحفظ في القسم المخصص.'}
                {statusFilter === 'special' && '🟣 قسم معتمد (مسار خاص): المعاملات المحفوظة التي اعتمدها المدير كمسار خاص مع توجيهاته التي تنعكس للإدارة.'}
                {statusFilter === 'general' && '🟢 قسم معتمد (مسار عام): المعاملات المحفوظة التي اعتمدها المدير كمسار عام روتيني.'}
                {statusFilter === 'rejected' && '🔴 قسم المعاملات المرفوضة: المعاملات المحفوظة التي تم رفضها مع بيان السبب وتظهر لأبو الإدارة باللون الأحمر.'}
                {statusFilter === 'all' && '📁 الأرشيف الشامل: عرض ومتابعة كافة المعاملات المحفوظة لجميع المسارات والحالات.'}
              </span>
            </div>
            <div className="text-[11px] font-mono font-bold shrink-0 opacity-80">
              المعروض: {receptionRequests.length} معاملة
            </div>
          </div>

          {/* Search Bar & Non-Destructive Archive Controls */}
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم المواطن، الهاتف، رقم الطلب، أو القضاء..."
                className="w-full h-10 pr-9 pl-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Toggle Section Archive View for Director */}
              <button
                type="button"
                onClick={() => {
                  setDirectorViewMode(prev => (prev === 'daily' ? 'section_archive' : 'daily'));
                  setConfirmClearCompleted(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 border cursor-pointer transition-all active:scale-95 ${
                  directorViewMode === 'section_archive'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700'
                }`}
                title="عرض السجلات المؤرشفة في قسم مدير المكتب فقط مع إمكانية إرجاع أي سجل للعمل اليومي"
              >
                {directorViewMode === 'section_archive' ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>العودة للعمل اليومي ({activeDirectorRequests.length})</span>
                  </>
                ) : (
                  <>
                    <Archive className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>عرض المؤرشف / أرشيف مدير المكتب ({archivedDirectorCount.toLocaleString()})</span>
                  </>
                )}
              </button>

              {directorViewMode === 'daily' && importedDirectorRequests.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const res = archiveDailyWorkItems({
                      requestIds: importedDirectorRequests.map(r => r.Request_ID),
                      sectionKey: 'director',
                      reason: 'أرشفة مستقلة في قسم مدير المكتب للطلبات المستردة/المصفاة'
                    });
                    if (res.archivedRequests > 0) {
                      addNotification({
                        title: `📦 أرشفة من مكتب المدير (${res.archivedRequests} معاملة)`,
                        message: `قام مدير المكتب بأرشفة (${res.archivedRequests}) معاملة مستردة/مصفاة مع بقاء كافة بياناتها محفوظة بالكامل.`,
                        type: 'director_decision',
                        category: 'director',
                        priority: 'normal',
                        linkSection: 'admin',
                        targetRoles: ['admin', 'admin_officer', 'developer']
                      });
                    }
                    showArchiveToast(
                      `✓ تمت أرشفة (${res.archivedRequests}) طلب في أرشيف مدير المكتب فقط دون التأثير على بقية الأقسام.`
                    );
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 cursor-pointer shadow-xs transition-all active:scale-95"
                  title="أرشفة الطلبات المستردة/المصفاة في أرشيف مدير المكتب فقط دون التأثير على بقية الأقسام"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>أرشفة المسترد/المصفى ({importedDirectorRequests.length})</span>
                </button>
              )}

              {directorViewMode === 'daily' && activeDirectorRequests.length > 0 && (
                confirmClearCompleted ? (
                  <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 px-2.5 py-1.5 rounded-xl text-[11px] flex-wrap">
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">أرشفة في قسم مدير المكتب فقط؟</span>
                    {activeDirectorRequests.some(r => r.ProcessingStatus === 'منجز' || Boolean(resolveNormalizedDecision(r))) && (
                      <button
                        type="button"
                        onClick={() => {
                          const targets = activeDirectorRequests.filter(r => r.ProcessingStatus === 'منجز' || Boolean(resolveNormalizedDecision(r)));
                          const res = archiveDailyWorkItems({
                            requestIds: targets.map(r => r.Request_ID),
                            sectionKey: 'director',
                            reason: 'أرشفة مستقلة في قسم مدير المكتب للمعاملات المنجزة/المتخذ قرار بشأنها'
                          });
                          if (res.archivedRequests > 0) {
                            addNotification({
                              title: `📦 أرشفة معاملات مكتملة من مدير المكتب (${res.archivedRequests})`,
                              message: `تمت أرشفة (${res.archivedRequests}) معاملة مكتملة في أرشيف مدير المكتب مع الاحتفاظ بكامل بياناتها وقراراتها.`,
                              type: 'director_decision',
                              category: 'director',
                              priority: 'normal',
                              linkSection: 'admin',
                              targetRoles: ['admin', 'admin_officer', 'developer']
                            });
                          }
                          setConfirmClearCompleted(false);
                          showArchiveToast(`✓ تمت أرشفة (${res.archivedRequests}) معاملة في أرشيف مدير المكتب فقط دون التأثير على بقية الأقسام.`);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-black cursor-pointer"
                      >
                        المكتمل ({activeDirectorRequests.filter(r => r.ProcessingStatus === 'منجز' || Boolean(resolveNormalizedDecision(r))).length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const res = archiveDailyWorkItems({
                          requestIds: receptionRequests.map(r => r.Request_ID),
                          sectionKey: 'director',
                          reason: 'أرشفة مستقلة في قسم مدير المكتب للمعاملات المعروضة'
                        });
                        if (res.archivedRequests > 0) {
                          addNotification({
                            title: `📦 أرشفة من مكتب المدير (${res.archivedRequests} معاملة)`,
                            message: `قام مدير المكتب بأرشفة (${res.archivedRequests}) معاملة في أرشيف مدير المكتب مع حفظ كامل بياناتها.`,
                            type: 'director_decision',
                            category: 'director',
                            priority: 'normal',
                            linkSection: 'admin',
                            targetRoles: ['admin', 'admin_officer', 'developer']
                          });
                        }
                        setConfirmClearCompleted(false);
                        showArchiveToast(`✓ تمت أرشفة (${res.archivedRequests}) معاملة في أرشيف مدير المكتب فقط دون التأثير على بقية الأقسام.`);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black cursor-pointer"
                    >
                      المعروض ({receptionRequests.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearCompleted(false)}
                      className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearCompleted(true)}
                    className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 cursor-pointer"
                    title="أرشفة السجلات في قسم مدير المكتب فقط دون التأثير على بقية الأقسام ودون حذف"
                  >
                    <Archive className="w-3.5 h-3.5 text-emerald-600" />
                    <span>أرشفة (إخراج من العمل اليومي)</span>
                  </button>
                )
              )}

              {directorViewMode === 'section_archive' && receptionRequests.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const res = restoreDailyWorkItems({
                      citizenIds: Array.from(new Set(receptionRequests.map(r => r.Citizen_ID).filter(Boolean))),
                      requestIds: receptionRequests.map(r => r.Request_ID),
                      sectionKey: 'director'
                    });
                    showArchiveToast(`✓ تم إرجاع (${res.restoredRequests}) معاملة إلى العمل اليومي لقسم مدير المكتب.`);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إرجاع الكل للعمل اليومي ({receptionRequests.length})</span>
                </button>
              )}
            </div>

            {archiveToast && (
              <div className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2">
                <span>{archiveToast}</span>
                <button
                  type="button"
                  onClick={() => setArchiveToast(null)}
                  className="text-emerald-700 dark:text-emerald-300 font-black px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 self-start sm:self-auto font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>المعلومات الواردة من الاستعلامات تظهر هنا للإقرار وتنعكس فوراً لأبو الإدارة (برتقالي إذا لم تعدل، وأحمر عند الرفض).</span>
            </div>
          </div>

          {/* ---------------- SINGLE UNIFIED HORIZONTAL BARS LIST ---------------- */}
          <div className="space-y-3">
            {receptionRequests.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                  {statusFilter === 'pending'
                    ? '🎉 تم إنجاز واتخاذ القرار لكافة الطلبات الواردة! لا توجد طلبات بانتظار المدير حالياً.'
                    : statusFilter === 'special'
                    ? 'لا توجد معاملات محفوظة في قسم المسار الخاص حالياً.'
                    : statusFilter === 'general'
                    ? 'لا توجد معاملات محفوظة في قسم المسار العام حالياً.'
                    : statusFilter === 'rejected'
                    ? 'لا توجد معاملات مرفوضة محفوظة حالياً.'
                    : 'لا توجد معاملات مطابقة للبحث أو التصفية الحالية.'}
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  {statusFilter === 'pending'
                    ? 'عند إدخال أي طلب جديد في قسم الاستعلامات يظهر هنا في شريط موحد لاتخاذ القرار. يمكنك مراجعة المعاملات المحفوظة من الأقسام أعلاه (مسار خاص • مسار عام • مرفوض).'
                    : 'جميع القرارات التي يتخذها المدير يتم حفظها فوراً في أقسامها وتنعكس للإدارة.'}
                </p>
                {statusFilter !== 'pending' && (
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs cursor-pointer transition-all shadow-xs"
                  >
                    العودة إلى إجمالي الوارد وبانتظار القرار 📥
                  </button>
                )}
              </div>
            ) : (
              receptionRequests.slice(0, visibleLimit).map((req) => {
                const cit = citizenMap.get(req.Citizen_ID);
                const currentDecision = resolveNormalizedDecision(req);
                const isPending = !currentDecision;
                const currentNoteInput = directorNotesMap[req.Request_ID] !== undefined 
                  ? directorNotesMap[req.Request_ID] 
                  : (req.DirectorNotes || '');

                return (
                  <div
                    key={req.Request_ID}
                    className={`p-4 rounded-2xl border transition-all duration-200 ${
                      currentDecision === 'خاص'
                        ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800'
                        : currentDecision === 'عام'
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                        : currentDecision === 'رفض'
                        ? 'bg-red-50/70 dark:bg-red-950/30 border-red-300 dark:border-red-800'
                        : 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700/80 shadow-xs'
                    }`}
                  >
                    {/* Unified Single Horizontal Bar Layout */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                      
                      {/* 1. RIGHT SEGMENT: Citizen Identity & Origin */}
                      <div className="lg:w-1/4 shrink-0 space-y-1 pr-1 border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800 pb-3 lg:pb-0 lg:pl-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-blue-700 dark:text-blue-300">
                            {req.Request_ID}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {req.CreatedAt}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                            {req.CitizenName}
                          </h3>
                          {cit && (
                            <button
                              type="button"
                              onClick={() => setCitizenToDelete(cit)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer shrink-0"
                              title="حذف هذا المراجع نهائياً من قاعدة البيانات والمنظومة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-mono">{req.CitizenPhone || cit?.Phone1 || 'لا يوجد هاتف'}</span>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{cit?.District || 'ذي قار'}</span>
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {req.AttendanceType || 'شخصياً'}
                          </span>
                        </div>

                        {req.AttendanceType === 'بيد شخص آخر (معتمد)' && req.ProxyName && (
                          <div className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800 inline-block font-bold">
                            المعتمد: {req.ProxyName} ({req.ProxyPhone})
                          </div>
                        )}
                      </div>

                      {/* 2. MIDDLE SEGMENT: Details, Target Entity, Reception Input */}
                      <div className="flex-1 space-y-1.5 px-1 lg:px-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            الجهة: {req.Entity}
                          </span>

                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            req.Priority === 'عاجل' || req.Priority === 'خاص جداً'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            الأسبقية: {req.Priority}
                          </span>

                          {/* Decision Status Pill */}
                          {currentDecision === 'خاص' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-2xs flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-300" />
                              <span>معتمد مسار خاص</span>
                            </span>
                          )}
                          {currentDecision === 'عام' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>معتمد مسار عام</span>
                            </span>
                          )}
                          {(currentDecision === 'حظر' || cit?.IsBlocked || req.IsBlocked) && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-900 text-white shadow-2xs flex items-center gap-1">
                              <Ban className="w-3 h-3" />
                              <span>محظور (القائمة السوداء)</span>
                            </span>
                          )}
                          {currentDecision === 'رفض' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-2xs flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              <span>مرفوض من قبل المدير</span>
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 shadow-2xs animate-pulse flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>بانتظار قرار المدير</span>
                            </span>
                          )}
                        </div>

                        {/* Request Content / Details */}
                        <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                          {req.Details}
                        </p>

                        {/* Reception Notes from الاستعلامات */}
                        {(req.ReceptionNotes || cit?.ReferralSource) && (
                          <div className="text-xs text-amber-900 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-800/60 flex items-start gap-1.5">
                            <span className="font-black shrink-0 text-amber-700 dark:text-amber-400">ملاحظات الاستعلامات:</span>
                            <span className="font-medium">{req.ReceptionNotes || cit?.ReferralSource}</span>
                          </div>
                        )}

                        {/* Director Rejection Reason Banner if Rejected */}
                        {(req.DirectorDecision === 'رفض' || req.ProcessingStatus === 'مرفوض') && (
                          <div className="text-xs text-rose-950 dark:text-rose-100 bg-rose-50 dark:bg-rose-950/60 p-2.5 rounded-xl border border-rose-300 dark:border-rose-850 flex items-start gap-2 shadow-2xs">
                            <span className="font-black text-rose-700 dark:text-rose-400 shrink-0 flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>سبب الرفض:</span>
                            </span>
                            <span className="font-bold leading-relaxed">
                              {req.DirectorNotes || req.DeputyNotes || 'لم يُحدد سبب مفصل'}
                            </span>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                          <span>المستلم في الاستعلامات: {req.CreatedBy || 'موظف الاستعلامات'}</span>
                          {req.DirectorDecisionDate && (
                            <span>• قرار المدير في: {req.DirectorDecisionDate}</span>
                          )}
                        </div>
                      </div>

                      {/* 3. LEFT SEGMENT: Director's 3 Decisions (خاص / عام / رفض) & Directive Notes */}
                      <div className="lg:w-1/3 shrink-0 flex flex-col justify-between gap-2.5 bg-slate-50/90 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        {/* Notes Input */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-black text-slate-700 dark:text-slate-200 block">
                              توجيه وملاحظات المدير (تظهر لأبو الإدارة):
                            </label>
                            <button
                              type="button"
                              onClick={() => handleSaveNotesOnly(req)}
                              className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                              title="حفظ الملاحظة فقط دون تغيير نوع القرار"
                            >
                              حفظ الملاحظة 💾
                            </button>
                          </div>
                          <input
                            type="text"
                            value={currentNoteInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDirectorNotesMap(prev => ({ ...prev, [req.Request_ID]: val }));
                            }}
                            placeholder="اكتب التوجيه أو سبب القرار هنا..."
                            className="w-full h-8.5 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                          />
                        </div>

                        {/* Decision Action Buttons: خاص / عام / رفض الطلب + السجل التراكمي */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* 1. خاص */}
                          <button
                            type="button"
                            onClick={() => handleDirectorDecision(req, 'خاص')}
                            className={`flex-1 min-w-[66px] h-9 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 ${
                              currentDecision === 'خاص'
                                ? 'bg-purple-700 text-white ring-2 ring-purple-400 shadow-purple-600/30'
                                : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                            title="اعتماد الطلب كمسار خاص"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                            <span>خاص</span>
                          </button>

                          {/* 2. عام */}
                          <button
                            type="button"
                            onClick={() => handleDirectorDecision(req, 'عام')}
                            className={`flex-1 min-w-[66px] h-9 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 ${
                              currentDecision === 'عام'
                                ? 'bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-emerald-600/30'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                            title="اعتماد الطلب كمسار عام روتيني"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>عام</span>
                          </button>

                          {/* 3. رفض مع إدخال سبب الرفض */}
                          <button
                            type="button"
                            onClick={() => {
                              setRejectModalRequest(req);
                              setRejectionReasonText(req.DirectorNotes || '');
                            }}
                            className={`flex-1 min-w-[82px] h-9 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 ${
                              currentDecision === 'رفض'
                                ? 'bg-red-700 text-white ring-2 ring-red-400 shadow-red-600/30'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                            title="رفض الطلب وتحديد سبب الرفض لتبليغ الإدارة والمواطن به"
                          >
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>رفض الطلب</span>
                          </button>

                          {/* 3b. حظر وإدراج في القائمة السوداء */}
                          <button
                            type="button"
                            onClick={() => {
                              setBlockModalRequest(req);
                              setBlockReasonText(
                                directorNotesMap[req.Request_ID] ||
                                req.BlockReason ||
                                cit?.BlockReason ||
                                ''
                              );
                            }}
                            className={`flex-1 min-w-[68px] h-9 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 border border-red-950/60 ${
                              currentDecision === 'حظر' || cit?.IsBlocked || req.IsBlocked
                                ? 'bg-red-950 text-white ring-2 ring-red-400 shadow-red-900/40'
                                : 'bg-red-900 hover:bg-red-950 text-white'
                            }`}
                            title="حظر المواطن وإدراجه فوراً في القائمة السوداء وتعميم الحظر على كافة الأقسام"
                          >
                            <Ban className="w-3.5 h-3.5 shrink-0" />
                            <span>حظر</span>
                          </button>

                          {/* 4. السجل التراكمي للمراجع */}
                          {(() => {
                            const cumulativeList = getCumulativeRequestsFor(req, cit);
                            return (
                              <button
                                type="button"
                                onClick={() =>
                                  setCumulativeModalTarget({
                                    citizenName: req.CitizenName || cit?.FullName || 'مراجع',
                                    citizenId: req.Citizen_ID || cit?.Citizen_ID,
                                    phone: req.CitizenPhone || cit?.Phone1,
                                    district: cit?.District || req.Address,
                                    requests: cumulativeList
                                  })
                                }
                                className="h-9 px-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                                title="عرض السجل التراكمي الكامل لجميع الطلبات السابقة والحالية لهذا المراجع"
                              >
                                <History className="w-3.5 h-3.5 shrink-0" />
                                <span>السجل التراكمي</span>
                                <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono tabular-nums">
                                  {cumulativeList.length}
                                </span>
                              </button>
                            );
                          })()}

                          {/* 5. أرشفة مستقلة في قسم مدير المكتب أو إرجاع للعمل اليومي */}
                          {directorViewMode === 'section_archive' ? (
                            <button
                              type="button"
                              onClick={() => {
                                restoreDailyWorkItem(req.Citizen_ID, [req.Request_ID], 'director');
                                showArchiveToast(`✓ تم إرجاع طلب (${req.CitizenName}) إلى العمل اليومي لقسم مدير المكتب.`);
                              }}
                              className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                              title="إرجاع الطلب من أرشيف مدير المكتب إلى قائمة العمل اليومي"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>إرجاع للعمل اليومي</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const typedNote =
                                  directorNotesMap[req.Request_ID] !== undefined
                                    ? directorNotesMap[req.Request_ID]
                                    : (req.DirectorNotes || '');
                                const hasOtherActiveAdminReqs = (requests || []).some(
                                  r =>
                                    r &&
                                    r.Citizen_ID === req.Citizen_ID &&
                                    r.Request_ID !== req.Request_ID &&
                                    !isRequestArchivedInSection(r, 'admin')
                                );
                                archiveDailyWorkItems({
                                  citizenIds:
                                    req.Citizen_ID && !hasOtherActiveAdminReqs
                                      ? [req.Citizen_ID]
                                      : [],
                                  requestIds: [req.Request_ID],
                                  sectionKey: 'director',
                                  extraSectionKeys: ['admin'],
                                  directorNotesByRequestId: {
                                    [req.Request_ID]: typedNote
                                  },
                                  preserveNonOrgIsolation: true,
                                  reason:
                                    typedNote.trim() ||
                                    'أرشفة من شاشة مدير المكتب (مراجعة استلام طلب / أرشفة مباشرة) — محفوظ بالكامل مع ملاحظات الاستعلامات والمدير في الأرشيف العام وأرشيف العمل اليومي'
                                });
                                addNotification({
                                  title: `📦 أرشفة معاملة من مكتب المدير: ${req.CitizenName}`,
                                  message: `تمت أرشفة الطلب (${req.Request_ID}) بكامل بياناته وملاحظات الاستعلامات والمدير في الأرشيف العام وأرشيف العمل اليومي.`,
                                  type: 'director_decision',
                                  category: 'director',
                                  priority: 'normal',
                                  linkSection: 'admin',
                                  entityId: req.Request_ID,
                                  targetRoles: ['admin', 'admin_officer', 'developer']
                                });
                                showArchiveToast(
                                  `✓ تمت أرشفة معاملة (${req.CitizenName}) بكامل بياناتها وملاحظاتها في الأرشيف العام وأرشيف العمل اليومي وإخراجها من قائمة الوارد.`
                                );
                              }}
                              className="h-9 px-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                              title="أرشفة المعاملة بكامل بياناتها وملاحظاتها في الأرشيف العام وأرشيف العمل اليومي وإخراجها من قائمة انتظار المدير"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>أرشيف</span>
                            </button>
                          )}

                          {/* 6. حذف نهائي من كافة النظام */}
                          <button
                            type="button"
                            onClick={() => setRequestToDelete(req)}
                            className="h-9 px-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                            title="حذف هذا الطلب نهائياً من قاعدة البيانات والمنظومة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">حذف</span>
                          </button>
                        </div>

                        {/* Confirmation Toast */}
                        {savedFeedbackId === req.Request_ID && (
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 text-center animate-in fade-in">
                            ✓ تم حفظ القرار والتوجيه وإرساله للإدارة
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })
            )}
            {receptionRequests.length > visibleLimit && (
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleLimit(prev => prev + 40)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer shadow-xs transition-all"
                >
                  عرض المزيد ({receptionRequests.length - visibleLimit} معاملة متبقية)
                </button>
              </div>
            )}
          </div>

        </div>
      )}

      {/* ---------------- VIEW: MANAGE & DEVELOP SECTIONS (إدارة واستحداث الأقسام مباشرة في قاعدة البيانات) ---------------- */}
      {directorMainTab === 'manage_sections' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-r from-purple-900 to-indigo-950 p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-white flex items-center justify-between border border-purple-400/30 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20">
                <FolderPlus className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg">إدارة واستحداث الأقسام وتطوير المنظومة</h3>
                <p className="text-xs text-purple-200 mt-0.5 font-medium">
                  أي قسم أو خدمة جديدة تضيفها هنا يتم حفظها لحظياً ومباشرة في قاعدة البيانات السحابية وتظهر فوراً لكافة مستخدمي المنظومة
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDirectorMainTab('inbox')}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>العودة للوارد</span>
            </button>
          </div>

          <CustomSectionsManager />
        </div>
      )}

      {/* ---------------- VIEW 3: PERMISSIONS & STAFF MANAGEMENT (قسم الصلاحيات والموظفين كما في لوحة المطور) ---------------- */}
      {directorMainTab === 'permissions' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-gradient-to-r from-emerald-900 to-teal-950 p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-white flex items-center justify-between border border-emerald-400/30 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20">
                <KeyRound className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg">قسم الصلاحيات وإدارة كادر المكتب</h3>
                <p className="text-xs text-emerald-100 mt-0.5 font-medium">
                  إضافة وتعديل حسابات الموظفين، منح أو سحب صلاحية قسم الرعاية الاجتماعية المستقل، وتخصيص الأقسام المسموح بدخولها لكل موظف
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDirectorMainTab('inbox')}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>العودة للوارد</span>
            </button>
          </div>

          <UsersAndPermissionsManager mode={currentUser?.Role === 'developer' ? 'developer' : 'director'} />
        </div>
      )}

      {/* ---------------- VIEW 2: ICON HUB (تصفح جميع أقسام النظام بالأيقونات) ---------------- */}
      {directorMainTab === 'icon_hub' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-white flex items-center justify-between border border-blue-400/30 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-white border border-white/20">
                <Layers className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg">شبكة أيقونات أقسام المكتب المركزية</h3>
                <p className="text-xs text-blue-200 mt-0.5 font-medium">
                  انقر على أي أيقونة لاستعراض القسم بكامل محتوياته وصلاحياته الإشرافية
                </p>
              </div>
            </div>

            <button
              onClick={() => setDirectorMainTab('inbox')}
              className="h-9 px-4 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>الرجوع لوارد الاستعلامات</span>
              <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>

          <OfficeIconTilesGrid
            title="الأقسام الرسمية - الوصول الكامل بالأيقونات"
            subtitle="المدير يمتلك صلاحية التصفح الكامل لكل أقسام المنظومة بدون استثناء"
            columns={5}
            items={[
              {
                id: 'dept_reception',
                title: 'قسم الاستعلامات والمراجعين',
                subtitle: 'تسجيل، استعلام، وتوثيق المراجعين',
                icon: UserPlus,
                iconColor: 'text-blue-600 dark:text-blue-400',
                iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
                badge: citizens.length,
                badgeColor: 'bg-blue-600 text-white',
                onClick: () => setActiveSection('reception')
              },
              {
                id: 'dept_admin',
                title: 'قسم الإدارة والمعاملات',
                subtitle: 'المعاملات الحكومية، الكتب الرسمية، والقرارات',
                icon: FolderKanban,
                iconColor: 'text-amber-600 dark:text-amber-400',
                iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
                badge: requests.length,
                badgeColor: 'bg-amber-600 text-white',
                onClick: () => setActiveSection('admin')
              },
              {
                id: 'tile_social_care',
                title: 'قسم الرعاية الاجتماعية (مستقل)',
                subtitle: 'شبكة الحماية الاجتماعية، المعين المتفرغ، والباحث الاجتماعي',
                icon: HeartHandshake,
                iconColor: 'text-emerald-600 dark:text-emerald-400',
                iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
                badge: customRecords.filter(r => r.sectionId === 'sec_social_welfare').length,
                badgeColor: 'bg-emerald-600 text-white',
                onClick: () => setActiveSection('social_care')
              },
              {
                id: 'dept_audit',
                title: 'قسم الرقابة والتدقيق',
                subtitle: 'التدقيق المالي والإداري وسجل الحوكمة',
                icon: ShieldCheck,
                iconColor: 'text-emerald-600 dark:text-emerald-400',
                iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
                badge: auditLogs.length,
                badgeColor: 'bg-emerald-600 text-white',
                onClick: () => setActiveSection('audit')
              },
              {
                id: 'dept_interviews',
                title: 'قسم المقابلات',
                subtitle: 'جدول مواعيد النائب وتوثيق الهوامش',
                icon: Handshake,
                iconColor: 'text-teal-600 dark:text-teal-400',
                iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
                badge: interviews.length,
                badgeColor: 'bg-teal-600 text-white',
                onClick: () => setActiveSection('interviews')
              },
              {
                id: 'dept_organization',
                title: 'قسم التنظيم',
                subtitle: 'شؤون العشائر والموقف الجماهيري',
                icon: Users2,
                iconColor: 'text-purple-600 dark:text-purple-400',
                iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
                badge: organizationRecords.length,
                badgeColor: 'bg-purple-600 text-white',
                onClick: () => setActiveSection('organization')
              },
              {
                id: 'dept_search_archive',
                title: 'قسم البحث الشامل والأرشيف',
                subtitle: 'البحث الموحد في سجلات ومعاملات المكتب',
                icon: Search,
                iconColor: 'text-cyan-600 dark:text-cyan-400',
                iconBg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800',
                onClick: () => setActiveSection('search_archive')
              },
              {
                id: 'dept_reports',
                title: 'قسم التقارير والإحصاء',
                subtitle: 'مؤشرات الإنجاز، التحليلات، وسحب Excel',
                icon: BarChart3,
                iconColor: 'text-pink-600 dark:text-pink-400',
                iconBg: 'bg-pink-50 dark:bg-pink-950/50 border-pink-200 dark:border-pink-800',
                onClick: () => setActiveSection('reports')
              },
              {
                id: 'dept_whatsapp',
                title: 'مراسلات الواتساب',
                subtitle: 'إرسال التحديثات والإشعارات للمواطنين',
                icon: MessageSquare,
                iconColor: 'text-green-600 dark:text-green-400',
                iconBg: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800',
                badge: whatsappTemplates.length,
                badgeColor: 'bg-green-600 text-white',
                onClick: () => setActiveSection('whatsapp')
              },
              {
                id: 'dept_users_roles',
                title: 'إدارة وصلاحيات المستخدمين',
                subtitle: 'حسابات الموظفين، الأدوار، ومنح صلاحيات الأقسام والرعاية',
                icon: KeyRound,
                iconColor: 'text-orange-600 dark:text-orange-400',
                iconBg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
                badge: users.length,
                badgeColor: 'bg-orange-600 text-white',
                onClick: () => setDirectorMainTab('permissions')
              },
              {
                id: 'dept_employee_stats',
                title: 'إحصائيات أداء الموظفين',
                subtitle: 'تحليل بياني شامل ومؤشرات إنتاجية الكوادر (Recharts)',
                icon: Activity,
                iconColor: 'text-rose-600 dark:text-rose-400',
                iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
                badge: `${users.length} موظف`,
                badgeColor: 'bg-rose-600 text-white shadow-2xs',
                onClick: () => setActiveSection('dashboard')
              },
              {
                id: 'dept_export_excel',
                title: 'تصدير قاعدة البيانات الشاملة Excel',
                subtitle: 'سحب كشف كامل لكافة الجداول والأقسام والصور',
                icon: Download,
                iconColor: 'text-teal-600 dark:text-teal-400',
                iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
                badge: 'Excel الشامل 📥',
                badgeColor: 'bg-teal-600 text-white shadow-2xs',
                onClick: handleDirectorExportUnifiedExcel
              }
            ]}
          />
        </div>
      )}


      {/* Rejection Reason Input Modal (ظهور نص ما سبب الرفض عند ضغط المدير على رفض الطلب) */}
      {rejectModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-red-500/40 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle className="w-5 h-5 text-rose-600" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  قرار رفض الطلب وتحديد سبب الرفض
                </h3>
              </div>
              <button 
                onClick={() => setRejectModalRequest(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/50 space-y-1 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300">
                <span>المواطن: <strong className="text-rose-700 dark:text-rose-400">{rejectModalRequest.CitizenName}</strong></span>
                <span className="font-mono text-[11px] text-slate-500">{rejectModalRequest.Request_ID}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                موضوع الطلب: {rejectModalRequest.Details}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                ما سبب الرفض؟ (يرجى توضيح السبب لتبليغ المواطن والإدارة به) *
              </label>
              <textarea
                value={rejectionReasonText}
                onChange={(e) => setRejectionReasonText(e.target.value)}
                placeholder="اكتب هنا سبب رفض المعاملة بدقة..."
                rows={3}
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Quick Reason Selection Chips */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 block">أسباب شائعة للاختيار السريع:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_REJECTION_REASONS.map((reason, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRejectionReasonText(reason)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    + {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRejectModalRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                إلغاء وتراجع
              </button>
              <button
                type="button"
                disabled={!rejectionReasonText.trim()}
                onClick={() => {
                  handleDirectorDecision(rejectModalRequest, 'رفض', rejectionReasonText.trim());
                  setRejectModalRequest(null);
                }}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
              >
                <XCircle className="w-4 h-4 text-white" />
                <span>تأكيد الرفض مع حفظ السبب ⛔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Director Block Citizen Reason Modal (حظر وإدراج فوري في القائمة السوداء) */}
      {blockModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border-2 border-red-800/60 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-red-900 dark:text-red-400">
                <Ban className="w-5 h-5 text-red-800 dark:text-red-400" />
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  حظر المواطن وإدراجه في القائمة السوداء
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBlockModalRequest(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-red-950/10 dark:bg-red-950/40 rounded-2xl border border-red-800/30 space-y-1 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                <span>المواطن: <strong className="text-red-900 dark:text-red-300">{blockModalRequest.CitizenName}</strong></span>
                <span className="font-mono text-[11px] text-slate-500">{blockModalRequest.Citizen_ID}</span>
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                الهاتف: <span className="font-mono font-bold">{blockModalRequest.CitizenPhone || citizenMap.get(blockModalRequest.Citizen_ID)?.Phone1 || 'غير مسجل'}</span>
                {' • '}
                الطلب: <span className="font-mono">{blockModalRequest.Request_ID}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                سبب الحظر (سيظهر كتحذير فوري في الاستعلامات والإدارة وكافة الأقسام) *
              </label>
              <textarea
                value={blockReasonText}
                onChange={(e) => setBlockReasonText(e.target.value)}
                placeholder="اكتب سبب الحظر بدقة..."
                rows={3}
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-red-800"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 block">أسباب حظر جاهزة للاختيار السريع:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_BLOCK_REASONS.map((reason, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setBlockReasonText(reason)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-red-100 hover:text-red-900 dark:hover:bg-red-950 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    + {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBlockModalRequest(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                إلغاء وتراجع
              </button>
              <button
                type="button"
                disabled={!blockReasonText.trim()}
                onClick={() => {
                  handleDirectorBlockCitizen(blockModalRequest, blockReasonText.trim());
                  setBlockModalRequest(null);
                  setBlockReasonText('');
                }}
                className="px-5 py-2 rounded-xl bg-red-900 hover:bg-red-950 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
              >
                <Ban className="w-4 h-4 text-white" />
                <span>تأكيد الحظر وإدراجه بالقائمة السوداء</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Dialog for Director: Request */}
      {requestToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900 shadow-2xl p-6 space-y-4 text-right" dir="rtl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">حذف المعاملة نهائياً من قاعدة البيانات</h3>
                <p className="text-xs text-rose-600 font-bold">إجراء حذف نهائي وشامل من كافة النظام</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs space-y-2">
              <div>
                <span className="font-bold text-slate-500">رقم الطلب: </span>
                <span className="font-mono text-blue-600 font-bold">{requestToDelete.Request_ID}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">صاحب المعاملة: </span>
                <span className="font-bold text-slate-900 dark:text-white">{requestToDelete.CitizenName}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">الجهة المعنية: </span>
                <span>{requestToDelete.Entity}</span>
              </div>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 pt-2 border-t border-slate-200 dark:border-slate-700 font-bold">
                ⚠️ تنبيه: سيتم حذف هذه المعاملة بشكل نهائي وشامل من شاشة المدير، سجل الاستعلامات، قسم الإدارة، وقاعدة البيانات والأرشيف الاحتياطي.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRequestToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                تراجع وإلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  const deletedInfo = requestToDelete;
                  const otherRemainingRequests = (requests || []).filter(
                    r =>
                      r &&
                      r.Citizen_ID === deletedInfo.Citizen_ID &&
                      r.Request_ID !== deletedInfo.Request_ID
                  );

                  // 1. Real comprehensive deletion (`deleteDoc` + Google Sheets background `action: "delete"`)
                  deleteRequest(deletedInfo.Request_ID);

                  // 2. If this was the citizen's only transaction, cascade-delete the citizen record too
                  // so nothing remains stuck in Reception ("الاستعلامات"), Admin, or any Firestore collection
                  if (deletedInfo.Citizen_ID && otherRemainingRequests.length === 0) {
                    deleteCitizen(deletedInfo.Citizen_ID);
                  }

                  addNotification({
                    title: `🗑️ حذف معاملة نهائياً بقرار مدير المكتب: ${deletedInfo.CitizenName}`,
                    message: `قام مدير المكتب بحذف المعاملة (${deletedInfo.Request_ID}) نهائياً من شاشة المدير والاستعلامات والإدارة وكافة قواعد البيانات.`,
                    type: 'director_decision',
                    category: 'director',
                    priority: 'high',
                    linkSection: 'admin',
                    targetRoles: ['admin', 'admin_officer', 'developer']
                  });
                  showArchiveToast(
                    `تم الحذف من قاعدة البيانات بنجاح (${deletedInfo.CitizenName})`
                  );
                  setRequestToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/25 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف النهائي الشامل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Dialog for Director: Citizen */}
      {citizenToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900 shadow-2xl p-6 space-y-4 text-right" dir="rtl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">حذف المواطن نهائياً من قاعدة البيانات</h3>
                <p className="text-xs text-rose-600 font-bold">حذف شامل للسجل وكافة طلباته ومقابلاته</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs space-y-2">
              <div>
                <span className="font-bold text-slate-500">اسم المواطن: </span>
                <span className="font-bold text-slate-900 dark:text-white">{citizenToDelete.FullName}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">الرقم التعريفي: </span>
                <span className="font-mono text-blue-600 font-bold">{citizenToDelete.Citizen_ID}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500">الهاتف: </span>
                <span className="font-mono">{citizenToDelete.Phone1}</span>
              </div>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 pt-2 border-t border-slate-200 dark:border-slate-700 font-bold">
                ⚠️ تنبيه: سيتم حذف سجل المراجع وجميع معاملاته ومقابلاته نهائياً من قاعدة البيانات والأرشيف الاحتياطي وجميع شاشات النظام.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCitizenToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                تراجع وإلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCitizen(citizenToDelete.Citizen_ID);
                  setCitizenToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/25 active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف النهائي الشامل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cumulative History Modal ("السجل التراكمي للمراجع") for Director */}
      {cumulativeModalTarget && (() => {
        const list = cumulativeModalTarget.requests;
        const completedCount = list.filter(r => r.ProcessingStatus === 'منجز' || Boolean(r.OutgoingNumber)).length;
        const specialCount = list.filter(r => r.DirectorDecision === 'خاص').length;
        const generalCount = list.filter(r => r.DirectorDecision === 'عام').length;
        const rejectedCount = list.filter(r => r.DirectorDecision === 'رفض' || r.ProcessingStatus === 'مرفوض').length;
        const pendingCount = list.filter(r => !r.DirectorDecision && r.ProcessingStatus !== 'منجز' && r.ProcessingStatus !== 'مرفوض').length;

        return (
          <div
            className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
            dir="rtl"
          >
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
              {/* Header */}
              <div className="p-4 sm:p-5 bg-gradient-to-l from-slate-900 via-sky-950 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
                    <History className="w-6 h-6 text-sky-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-white truncate">
                      السجل التراكمي للمراجع: {cumulativeModalTarget.citizenName}
                    </h3>
                    <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-sky-200 mt-0.5">
                      {cumulativeModalTarget.citizenId && (
                        <span className="font-mono bg-white/10 px-2 py-0.5 rounded-md">
                          {cumulativeModalTarget.citizenId}
                        </span>
                      )}
                      {cumulativeModalTarget.phone && (
                        <span className="font-mono" dir="ltr">
                          📞 {cumulativeModalTarget.phone}
                        </span>
                      )}
                      {cumulativeModalTarget.district && (
                        <span>📍 {cumulativeModalTarget.district}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCumulativeModalTarget(null)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* KPI Summary Strip */}
              <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-3 sm:grid-cols-6 gap-2 text-center shrink-0">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold text-slate-500">إجمالي الطلبات</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{list.length}</div>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">منجز / صادر</div>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{completedCount}</div>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                  <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300">بانتظار القرار</div>
                  <div className="text-lg font-black text-amber-700 dark:text-amber-300 tabular-nums">{pendingCount}</div>
                </div>
                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                  <div className="text-[10px] font-bold text-purple-700 dark:text-purple-300">مسار خاص</div>
                  <div className="text-lg font-black text-purple-700 dark:text-purple-300 tabular-nums">{specialCount}</div>
                </div>
                <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                  <div className="text-[10px] font-bold text-sky-700 dark:text-sky-300">مسار عام</div>
                  <div className="text-lg font-black text-sky-700 dark:text-sky-300 tabular-nums">{generalCount}</div>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                  <div className="text-[10px] font-bold text-rose-700 dark:text-rose-300">مرفوض</div>
                  <div className="text-lg font-black text-rose-700 dark:text-rose-300 tabular-nums">{rejectedCount}</div>
                </div>
              </div>

              {/* Scrollable Chronological List of All Requests */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
                {list.length === 0 ? (
                  <div className="py-10 text-center text-slate-500 text-sm font-bold">
                    لا توجد طلبات مسجلة لهذا المراجع حتى الآن.
                  </div>
                ) : (
                  list.map((r, idx) => {
                    const archived = isRequestArchivedOrRestored(r);
                    return (
                      <div
                        key={r.Request_ID || idx}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-900 dark:bg-slate-700 text-white font-mono font-bold text-[11px]">
                              #{idx + 1} • {r.Request_ID}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              📅 {r.CreatedAt || r.OutgoingDate || 'غير محدد'}
                            </span>
                            {r.Entity && (
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold">
                                الجهة: {r.Entity}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {r.DirectorDecision && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  r.DirectorDecision === 'خاص'
                                    ? 'bg-purple-600 text-white'
                                    : r.DirectorDecision === 'عام'
                                    ? 'bg-emerald-600 text-white'
                                    : r.DirectorDecision === 'رفض'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-slate-600 text-white'
                                }`}
                              >
                                قرار المدير: {r.DirectorDecision}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                              الحالة: {r.ProcessingStatus || 'قيد الإجراء'}
                            </span>
                            {archived && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                مؤرشف
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
                          {r.Details || 'بدون تفاصيل مسجلة'}
                        </p>

                        <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-600 dark:text-slate-300 pt-1.5 border-t border-slate-200/80 dark:border-slate-700/80">
                          {r.OutgoingNumber && (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 font-mono font-bold">
                              الصادر: {r.OutgoingNumber} {r.OutgoingDate ? `(${r.OutgoingDate})` : ''}
                            </span>
                          )}
                          {r.DeliveryStatus && (
                            <span className="font-semibold">
                              الاستلام: {r.DeliveryStatus}
                            </span>
                          )}
                          {r.DirectorNotes && (
                            <span className="text-amber-800 dark:text-amber-300 font-semibold">
                              ملاحظات المدير: {r.DirectorNotes}
                            </span>
                          )}
                          {r.OtherNotes && !r.DirectorNotes && (
                            <span className="text-slate-600 dark:text-slate-300">
                              ملاحظات: {r.OtherNotes}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-bold text-slate-500">
                  يشمل كافة المعاملات النشطة والمؤرشفة والمستردة للمراجع
                </span>
                <button
                  type="button"
                  onClick={() => setCumulativeModalTarget(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-black cursor-pointer transition-colors"
                >
                  إغلاق السجل التراكمي
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
