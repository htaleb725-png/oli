import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { OfficeRequest, ProcessingStatus, RequestStatus, Priority, WorkflowStage, Citizen } from '../types';
import { 
  FolderKanban, 
  Search, 
  Plus, 
  Paperclip, 
  Clock, 
  Printer, 
  UserPlus, 
  Phone, 
  MapPin, 
  SendHorizontal, 
  Eye, 
  CheckCircle, 
  CheckCircle2,
  XCircle,
  Scan, 
  Users2, 
  ArrowLeft, 
  Sliders, 
  FileText, 
  AlertCircle,
  Trash2,
  AlertTriangle,
  Sparkles,
  FileImage,
  Users,
  Upload,
  LogIn,
  ShieldCheck,
  Maximize2,
  Download,
  BarChart2,
  Lock,
  ShieldAlert,
  Flame,
  Layers
} from 'lucide-react';
import { CustomSectionsManager } from './developer/CustomSectionsManager';
import { DirectScannerPrinter } from './DirectScannerPrinter';
import { AiRequestDrafterModal } from './AiRequestDrafterModal';
import { SmartImageArchiveModule } from './SmartImageArchiveModule';
import { ReferrersStats } from './ReferrersStats';
import { OfficeIconTilesGrid, OfficeTileItem } from './OfficeIconTilesGrid';
import { SYSTEM_PERMISSIONS } from '../types';
import { exportUnifiedSystemExcel } from '../services/unifiedExcelExporter';

export const AdminModule: React.FC = () => {
  const { 
    requests, 
    addRequest, 
    updateRequest, 
    deleteRequest,
    citizens, 
    updateCitizen,
    deleteCitizen,
    interviews,
    cheques,
    organizationRecords,
    officialLetters,
    customSections,
    customRecords,
    systemSettings,
    getDropdownOptions, 
    addDocument,
    currentUser,
    users,
    switchUser,
    setSelectedCitizenForHistory,
    setPrintableBadgeCitizen,
    setActiveSection,
    forwardCitizenWorkflow,
    forwardRequestWorkflow,
    exportToExcel,
    canDownloadDatabase
  } = useApp();

  const handleExportComprehensiveExcel = () => {
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
      exporterName: currentUser?.FullName || 'مدير الإدارة'
    });
  };

  const [activeTab, setActiveTab] = useState<'requests_list' | 'reception_citizens' | 'direct_scanner' | 'smart_images' | 'referrers' | 'department_staff' | 'manage_departments'>('requests_list');

  const [searchQuery, setSearchQuery] = useState('');
  const [receptionSearch, setReceptionSearch] = useState('');
  const [selectedEntityFilter, setSelectedEntityFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'personal' | 'men' | 'women' | 'independent' | 'dependent'>('all');
  const [directorDecisionFilter, setDirectorDecisionFilter] = useState<'all' | 'pending' | 'special' | 'general' | 'rejected'>('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAiDrafterModal, setShowAiDrafterModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<OfficeRequest | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<OfficeRequest | null>(null);
  const [citizenToDelete, setCitizenToDelete] = useState<Citizen | null>(null);
  const [scannerCitizenId, setScannerCitizenId] = useState<string>('');

  // Scanner image in Request state (حفظ صورة الاسكنر كما هي مع توثيق اسم الموظف والتاريخ)
  const [attachedScanImage, setAttachedScanImage] = useState<string | null>(null);
  const [scanUploadedBy, setScanUploadedBy] = useState<string>('');
  const [scanUploadedAt, setScanUploadedAt] = useState<string>('');
  const [fullPreviewScan, setFullPreviewScan] = useState<{
    url: string;
    uploadedBy: string;
    uploadedAt: string;
    requestTitle: string;
    citizenName: string;
  } | null>(null);

  // Attendance and Dependency form state
  const [attendanceType, setAttendanceType] = useState<string>('شخصياً');
  const [dependencyStatus, setDependencyStatus] = useState<'مستقل' | 'غير مستقل'>('مستقل');

  // Referral Modal state
  const [referralTargetCitizen, setReferralTargetCitizen] = useState<Citizen | null>(null);
  const [referralTargetRequest, setReferralTargetRequest] = useState<OfficeRequest | null>(null);
  const [referralStage, setReferralStage] = useState<WorkflowStage>('مدير التنظيم');
  const [referralDirective, setReferralDirective] = useState('');
  const [showReferralModal, setShowReferralModal] = useState(false);

  // Form states
  const [selectedCitizenId, setSelectedCitizenId] = useState('');
  const [entity, setEntity] = useState('وزارة العمل والشؤون الاجتماعية (شبكة الحماية)');
  const [customEntity, setCustomEntity] = useState('');
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('مستلم');
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('قيد التدقيق');
  const [priority, setPriority] = useState<Priority>('عام');
  const [details, setDetails] = useState('');
  const [attachmentReq, setAttachmentReq] = useState('');
  const [attachmentResp, setAttachmentResp] = useState('');
  const [deputyNotes, setDeputyNotes] = useState('');
  const [editableCitizenName, setEditableCitizenName] = useState('');
  const [editableCitizenPhone, setEditableCitizenPhone] = useState('');

  const entitiesList = getDropdownOptions('Entity');

  const citizenMap = React.useMemo(() => {
    const map = new Map<string, Citizen>();
    (citizens || []).forEach(c => {
      if (c?.Citizen_ID) map.set(c.Citizen_ID, c);
    });
    return map;
  }, [citizens]);

  const filterCounts = React.useMemo(() => {
    let personal = 0;
    let men = 0;
    let women = 0;
    let independent = 0;
    let dependent = 0;
    let directorPending = 0;
    let directorRejected = 0;
    let directorSpecial = 0;
    let directorGeneral = 0;

    (requests || []).forEach(req => {
      const cit = citizenMap.get(req.Citizen_ID);
      const gender = cit?.Gender || 'ذكر';
      const att = req.AttendanceType || cit?.AttendanceType || 'شخصياً';
      const dep = req.DependencyStatus || cit?.DependencyStatus || 'مستقل';

      if (att === 'شخصياً') personal++;
      if (gender === 'ذكر') men++;
      if (gender === 'أنثى') women++;
      if (dep === 'مستقل') independent++;
      if (dep === 'غير مستقل') dependent++;

      // Director decisions counts
      if (!req.DirectorDecision) directorPending++;
      else if (req.DirectorDecision === 'رفض') directorRejected++;
      else if (req.DirectorDecision === 'خاص') directorSpecial++;
      else if (req.DirectorDecision === 'عام') directorGeneral++;
    });

    return {
      all: requests.length,
      personal,
      men,
      women,
      independent,
      dependent,
      directorPending,
      directorRejected,
      directorSpecial,
      directorGeneral
    };
  }, [requests, citizenMap]);

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.Request_ID.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.CitizenName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.Details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.Entity.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesEntity = selectedEntityFilter === 'all' || req.Entity === selectedEntityFilter;
    const matchesStatus = selectedStatusFilter === 'all' || req.ProcessingStatus === selectedStatusFilter;
    const matchesPriority = selectedPriorityFilter === 'all' || req.Priority === selectedPriorityFilter;

    // Filter Category Check (شخصياً / رجال فقط / امرأة فقط / مستقلين / غير مستقلين / الكل)
    const cit = citizenMap.get(req.Citizen_ID);
    const gender = cit?.Gender || 'ذكر';
    const att = req.AttendanceType || cit?.AttendanceType || 'شخصياً';
    const dep = req.DependencyStatus || cit?.DependencyStatus || 'مستقل';

    let matchesCategory = true;
    if (filterCategory === 'personal') matchesCategory = att === 'شخصياً';
    else if (filterCategory === 'men') matchesCategory = gender === 'ذكر';
    else if (filterCategory === 'women') matchesCategory = gender === 'أنثى';
    else if (filterCategory === 'independent') matchesCategory = dep === 'مستقل';
    else if (filterCategory === 'dependent') matchesCategory = dep === 'غير مستقل';

    let matchesDirector = true;
    if (directorDecisionFilter === 'pending') matchesDirector = !req.DirectorDecision;
    else if (directorDecisionFilter === 'special') matchesDirector = req.DirectorDecision === 'خاص';
    else if (directorDecisionFilter === 'general') matchesDirector = req.DirectorDecision === 'عام';
    else if (directorDecisionFilter === 'rejected') matchesDirector = req.DirectorDecision === 'رفض';

    return matchesSearch && matchesEntity && matchesStatus && matchesPriority && matchesCategory && matchesDirector;
  });

  const filteredReceptionCitizens = citizens.filter(c => {
    if (!receptionSearch.trim()) return true;
    const q = receptionSearch.toLowerCase().trim();
    return (
      (c.FullName && c.FullName.toLowerCase().includes(q)) ||
      (c.Citizen_ID && c.Citizen_ID.toLowerCase().includes(q)) ||
      (c.Phone1 && c.Phone1.includes(q)) ||
      (c.District && c.District.toLowerCase().includes(q)) ||
      (c.Surname && c.Surname.toLowerCase().includes(q))
    );
  });

  const openScannerForCitizen = (citId: string) => {
    setScannerCitizenId(citId);
    setActiveTab('direct_scanner');
  };

  const openReferralForCitizen = (cit: Citizen) => {
    setReferralTargetCitizen(cit);
    setReferralTargetRequest(null);
    setReferralStage('مدير التنظيم');
    setReferralDirective(`تم استلام وتدقيق ملف المراجع (${cit.FullName}) في الإدارة وإحالته لقسم التنظيم للمتابعة الميدانية والانتخابية.`);
    setShowReferralModal(true);
  };

  const handleConfirmReferral = () => {
    if (referralTargetCitizen) {
      forwardCitizenWorkflow(
        referralTargetCitizen.Citizen_ID,
        referralStage,
        referralDirective.trim()
      );
    } else if (referralTargetRequest) {
      forwardRequestWorkflow(
        referralTargetRequest.Request_ID,
        referralStage,
        referralDirective.trim()
      );
    }
    setShowReferralModal(false);
    setReferralTargetCitizen(null);
    setReferralTargetRequest(null);
    setReferralDirective('');
  };

  const handleSaveRequest = (e: React.FormEvent) => {
    e.preventDefault();

    const finalEntity = entity === 'أخرى' && customEntity ? customEntity.trim() : entity;

    if (editingRequest) {
      const finalName = editableCitizenName.trim() || editingRequest.CitizenName;
      const finalPhone = editableCitizenPhone.trim() || editingRequest.CitizenPhone;

      updateRequest({
        ...editingRequest,
        CitizenName: finalName,
        CitizenPhone: finalPhone,
        Entity: finalEntity,
        RequestStatus: requestStatus,
        ProcessingStatus: processingStatus,
        Priority: priority,
        Details: details,
        AttachmentRequest: attachmentReq || editingRequest.AttachmentRequest,
        AttachmentResponse: attachmentResp || editingRequest.AttachmentResponse,
        DeputyNotes: deputyNotes,
        AttendanceType: attendanceType,
        DependencyStatus: dependencyStatus,
        AttachedRequestImage: attachedScanImage || undefined,
        ScanUploadedBy: attachedScanImage ? (scanUploadedBy || currentUser?.FullName || 'موظف الإدارة') : undefined,
        ScanUploadedAt: attachedScanImage ? (scanUploadedAt || new Date().toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })) : undefined,
        ScanAttachments: attachedScanImage && attachedScanImage !== editingRequest.AttachedRequestImage ? [
          ...(editingRequest.ScanAttachments || []),
          {
            id: `SCAN-${Date.now()}`,
            url: attachedScanImage,
            fileName: `مسح ضوئي: ${details.slice(0, 30)}`,
            uploadedBy: currentUser?.FullName || 'موظف الإدارة',
            uploadedAt: new Date().toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })
          }
        ] : editingRequest.ScanAttachments
      });

      // Also sync citizen master record if name or phone changed
      const targetCit = citizens.find(c => c.Citizen_ID === editingRequest.Citizen_ID);
      if (targetCit) {
        updateCitizen({
          ...targetCit,
          FullName: finalName,
          Phone1: finalPhone
        });
      }

      setEditingRequest(null);
    } else {
      const citizen = citizens.find(c => c.Citizen_ID === selectedCitizenId);
      if (!citizen) {
        alert('يرجى اختيار مراجع مسجل بالنظام أولاً.');
        return;
      }

      const nowStamp = new Date().toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' });
      const currentUploader = currentUser?.FullName || 'موظف الإدارة';

      addRequest({
        Citizen_ID: citizen.Citizen_ID,
        CitizenName: citizen.FullName,
        CitizenPhone: citizen.Phone1,
        Entity: finalEntity,
        RequestStatus: requestStatus,
        ProcessingStatus: processingStatus,
        Priority: priority,
        Details: details,
        AttachmentRequest: attachmentReq || undefined,
        AttachmentResponse: attachmentResp || undefined,
        DeputyNotes: deputyNotes || undefined,
        AttendanceType: attendanceType,
        DependencyStatus: dependencyStatus,
        CreatedBy: currentUser ? currentUser.FullName : 'قسم الإدارة',
        AttachedRequestImage: attachedScanImage || undefined,
        ScanUploadedBy: attachedScanImage ? currentUploader : undefined,
        ScanUploadedAt: attachedScanImage ? nowStamp : undefined,
        ScanAttachments: attachedScanImage ? [
          {
            id: `SCAN-${Date.now()}`,
            url: attachedScanImage,
            fileName: `مسح ضوئي: ${details.slice(0, 30)}`,
            uploadedBy: currentUploader,
            uploadedAt: nowStamp
          }
        ] : []
      });

      // If document attached, archive automatically
      if (attachmentReq) {
        addDocument({
          Citizen_ID: citizen.Citizen_ID,
          CitizenName: citizen.FullName,
          Title: `مرفق طلب: ${details.slice(0, 30)}`,
          Category: 'طلب مقدم',
          FileUrl: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600&auto=format&fit=crop&q=80',
          FileType: 'pdf',
          FileSize: '1.5 MB',
          UploadedBy: currentUser?.FullName || 'موظف الإدارة'
        });
      }

      setShowAddModal(false);
    }

    // Reset
    setDetails('');
    setCustomEntity('');
    setAttachmentReq('');
    setAttachmentResp('');
    setDeputyNotes('');
    setAttendanceType('شخصياً');
    setDependencyStatus('مستقل');
    setAttachedScanImage(null);
    setScanUploadedBy('');
    setScanUploadedAt('');
  };

  const handleUploadScanFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        setAttachedScanImage(result);
        const uploaderName = currentUser?.FullName || 'موظف الإدارة';
        const nowStamp = new Date().toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' });
        setScanUploadedBy(uploaderName);
        setScanUploadedAt(nowStamp);
      };
      reader.readAsDataURL(file);
    }
  };

  const openEditModal = (req: OfficeRequest) => {
    setEditingRequest(req);
    setSelectedCitizenId(req.Citizen_ID);
    setEditableCitizenName(req.CitizenName || '');
    setEditableCitizenPhone(req.CitizenPhone || '');
    setEntity(req.Entity);
    setRequestStatus(req.RequestStatus);
    setProcessingStatus(req.ProcessingStatus);
    setPriority(req.Priority);
    setDetails(req.Details);
    setAttachmentReq(req.AttachmentRequest || '');
    setAttachmentResp(req.AttachmentResponse || '');
    setDeputyNotes(req.DeputyNotes || '');
    const cit = citizenMap.get(req.Citizen_ID);
    setAttendanceType(req.AttendanceType || cit?.AttendanceType || 'شخصياً');
    setDependencyStatus(req.DependencyStatus || cit?.DependencyStatus || 'مستقل');
    setAttachedScanImage(req.AttachedRequestImage || null);
    setScanUploadedBy(req.ScanUploadedBy || '');
    setScanUploadedAt(req.ScanUploadedAt || '');
  };

  const openCreateForCitizen = (citId: string) => {
    setEditingRequest(null);
    setSelectedCitizenId(citId);
    setDetails('');
    const cit = citizenMap.get(citId);
    setAttendanceType(cit?.AttendanceType || 'شخصياً');
    setDependencyStatus(cit?.DependencyStatus || 'مستقل');
    setAttachedScanImage(null);
    setScanUploadedBy('');
    setScanUploadedAt('');
    setShowAddModal(true);
  };

  return (
    <div className="space-y-4 text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">قسم الإدارة ومتابعة المعاملات الحكومية</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {requests.length} معاملة مسجلة
            </span>
          </div>
          <p className="text-xs text-slate-500">
            سلسلة الإحالات المتكاملة: الاستعلامات ← مدير المكتب ← مدير الإدارة ← مدير التنظيم مع ماسح ضوئي وطباعة مباشرة.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setScannerCitizenId(citizens[0]?.Citizen_ID || '');
              setActiveTab('direct_scanner');
            }}
            className="px-3.5 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Scan className="w-4 h-4 text-blue-300" />
            <span>سكنر مباشر إلى الطابعة</span>
          </button>

          <button
            onClick={() => setActiveTab('smart_images')}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="أرشفة واستخراج صور المعاملات (1000 - 2000 صورة) بالاسم التلقائي واليدوي"
          >
            <FileImage className="w-4 h-4 text-emerald-200" />
            <span>إرفاق صور المعاملات (1000 - 2000 صورة)</span>
          </button>

          <button
            onClick={() => setActiveSection('dashboard')}
            className="px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="الانتقال إلى لوحة تحكم وإحصائيات قسم الإدارة والمعاملات"
          >
            <BarChart2 className="w-4 h-4 text-amber-600" />
            <span>لوحة إحصائيات الإدارة</span>
          </button>

          <button
            onClick={() => setActiveSection('drive_requests')}
            className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="البحث والطباعة المباشرة من أرشيف Google Drive"
          >
            <Printer className="w-4 h-4" />
            <span>البحث والطباعة (Drive)</span>
          </button>

          <button
            onClick={() => setShowAiDrafterModal(true)}
            className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
            title="توليد وصياغة طلب رسمي بالذكاء الاصطناعي"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>توليد طلب بالذكاء الاصطناعي</span>
          </button>

          <button
            onClick={handleExportComprehensiveExcel}
            className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
            title="تصدير قاعدة بيانات المنظومة بالكامل بكافة الجداول والصور في ملف Excel واحد"
          >
            <Download className="w-4 h-4" />
            <span>تصدير Excel الشامل</span>
          </button>

          <button
            onClick={() => {
              setEditingRequest(null);
              setDetails('');
              setSelectedCitizenId(citizens[0]?.Citizen_ID || '');
              setShowAddModal(true);
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ إنشاء طلب إداري جديد</span>
          </button>
        </div>
      </div>

      {/* 5-Column Desktop Icon Grid for Administration */}
      <OfficeIconTilesGrid
        title="أيقونات ومهام قسم الإدارة والمعاملات"
        subtitle="انقر على أي أيقونة للانتقال السريع إلى فئة المعاملات أو تشغيل الأداة المطلوبة"
        columns={5}
        items={[
          {
            id: 'adm_all_reqs',
            title: 'كافة المعاملات والطلبات',
            subtitle: 'السجل العام للطلبات',
            icon: FolderKanban,
            iconColor: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
            badge: requests.length,
            badgeColor: 'bg-blue-600 text-white',
            isActive: activeTab === 'requests_list' && selectedPriorityFilter === 'all' && selectedStatusFilter === 'all',
            onClick: () => {
              setActiveTab('requests_list');
              setSelectedStatusFilter('all');
              setSelectedPriorityFilter('all');
            }
          },
          {
            id: 'adm_urgent',
            title: 'الطلبات العاجلة والحرجة',
            subtitle: 'أولويات تتطلب تدخلاً فورياً',
            icon: Flame,
            iconColor: 'text-rose-600 dark:text-rose-400',
            iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
            badge: requests.filter(r => r.Priority === 'عاجل' || r.Priority === 'خاص جداً').length || null,
            badgeColor: 'bg-rose-600 text-white animate-pulse',
            isActive: activeTab === 'requests_list' && selectedPriorityFilter === 'عاجل',
            onClick: () => {
              setActiveTab('requests_list');
              setSelectedPriorityFilter('عاجل');
            }
          },
          {
            id: 'adm_inprogress',
            title: 'المعاملات قيد الإجراء',
            subtitle: 'المتابعة الميدانية والوزارية',
            icon: Clock,
            iconColor: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
            badge: requests.filter(r => r.ProcessingStatus === 'قيد الإجراء' || r.ProcessingStatus === 'قيد التدقيق').length || null,
            badgeColor: 'bg-amber-500 text-white',
            isActive: activeTab === 'requests_list' && selectedStatusFilter === 'قيد الإجراء',
            onClick: () => {
              setActiveTab('requests_list');
              setSelectedStatusFilter('قيد الإجراء');
            }
          },
          {
            id: 'adm_completed',
            title: 'المعاملات المنجزة والمغلقة',
            subtitle: 'المعاملات التي تمت تلبيتها',
            icon: CheckCircle,
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
            badge: requests.filter(r => r.ProcessingStatus === 'منجز').length || null,
            badgeColor: 'bg-emerald-600 text-white',
            isActive: activeTab === 'requests_list' && selectedStatusFilter === 'منجز',
            onClick: () => {
              setActiveTab('requests_list');
              setSelectedStatusFilter('منجز');
            }
          },
          {
            id: 'adm_reception_feed',
            title: 'وارد مراجعي الاستعلامات',
            subtitle: 'المواطنون المحالون للإدارة',
            icon: Users,
            iconColor: 'text-cyan-600 dark:text-cyan-400',
            iconBg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800',
            badge: citizens.length,
            badgeColor: 'bg-cyan-600 text-white',
            isActive: activeTab === 'reception_citizens',
            onClick: () => setActiveTab('reception_citizens')
          },
          {
            id: 'adm_scanner',
            title: 'ماسح Scanner إلى الطابعة',
            subtitle: 'سحب المستمسكات والكتب فورياً',
            icon: Scan,
            iconColor: 'text-purple-600 dark:text-purple-400',
            iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
            isActive: activeTab === 'direct_scanner',
            onClick: () => {
              setScannerCitizenId(citizens[0]?.Citizen_ID || '');
              setActiveTab('direct_scanner');
            }
          },
          {
            id: 'adm_smart_images',
            title: 'أرشيف صور المعاملات',
            subtitle: '1000 - 2000 صورة بالاسم',
            icon: FileImage,
            iconColor: 'text-teal-600 dark:text-teal-400',
            iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
            isActive: activeTab === 'smart_images',
            onClick: () => setActiveTab('smart_images')
          },
          {
            id: 'adm_referrers',
            title: 'إحصائيات التزكيات والمعرفين',
            subtitle: 'المصادر والجهات المحيلة',
            icon: Users2,
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
            isActive: activeTab === 'referrers',
            onClick: () => setActiveTab('referrers')
          },
          ...(canDownloadDatabase(currentUser?.Role) ? [{
            id: 'adm_export',
            title: 'تصدير قاعدة البيانات الشاملة Excel',
            subtitle: 'سحب كشف كامل لكافة الجداول والصور والمرفقات',
            icon: Download,
            iconColor: 'text-teal-600 dark:text-teal-400',
            iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
            badge: 'شامل Excel 📥',
            badgeColor: 'bg-teal-600 text-white',
            onClick: handleExportComprehensiveExcel
          }] : []),
          {
            id: 'adm_ai_drafter',
            title: 'صياغة بالذكاء الاصطناعي',
            subtitle: 'صياغة الكتب الرسمية والمخاطبات',
            icon: Sparkles,
            iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
            iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/50 border-fuchsia-200 dark:border-fuchsia-800',
            onClick: () => setShowAiDrafterModal(true)
          }
        ]}
      />

      {/* Workflow Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab('requests_list')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'requests_list'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          <span>جدول المعاملات والطلبات الحكومية ({filteredRequests.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reception_citizens')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'reception_citizens'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>وارد مراجعي الاستعلامات والإحالات ({citizens.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('direct_scanner')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'direct_scanner'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-blue-50 border border-slate-200'
          }`}
        >
          <Scan className="w-4 h-4 text-amber-500" />
          <span>خانة سكنر مباشر إلى الطابعة (Scanner to Printer) 🖨️</span>
        </button>

        <button
          onClick={() => setActiveTab('smart_images')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'smart_images'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
              : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-300'
          }`}
        >
          <FileImage className="w-4 h-4 text-emerald-500" />
          <span>أرشيف واستخراج الصور الذكية (1000 - 2000 صورة)</span>
        </button>

        <button
          onClick={() => setActiveTab('referrers')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'referrers'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'bg-white text-purple-900 hover:bg-purple-50 border border-purple-200'
          }`}
        >
          <Users2 className="w-4 h-4 text-purple-600" />
          <span>قسم المعرفين وتزكيات المراجعين</span>
        </button>

        <button
          onClick={() => setActiveTab('department_staff')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'department_staff'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-amber-900 hover:bg-amber-50 border border-amber-200'
          }`}
        >
          <Users className="w-4 h-4 text-amber-600" />
          <span>كادر قسم الإدارة والصلاحيات ({users.filter(u => u.Role === 'admin' || u.Department?.includes('الإدارة')).length} موظفين)</span>
        </button>

        <button
          onClick={() => setActiveTab('manage_departments')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'manage_departments'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-purple-900 hover:bg-purple-50 border border-purple-200'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-600" />
          <span>إدارة وتطوير أقسام المكتب ({customSections.length}) ⚡</span>
        </button>
      </div>

      {/* Tab 1: Requests List */}
      {activeTab === 'requests_list' && (
        <>
          {/* Filter Bar */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث برقم الطلب، اسم المواطن..."
                  className="w-full pr-8 pl-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <select
                  value={selectedEntityFilter}
                  onChange={(e) => setSelectedEntityFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">-- تصفية حسب الجهة المعنية (الكل) --</option>
                  {entitiesList.map((ent, idx) => (
                    <option key={idx} value={ent}>{ent}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">-- تصفية حسب المسار الإداري (الكل) --</option>
                  <option value="قيد التدقيق">قيد التدقيق</option>
                  <option value="مرسل إلى الوزارة/الهيئة">مرسل إلى الوزارة/الهيئة</option>
                  <option value="منجز">منجز</option>
                  <option value="تم الطباعة">تم الطباعة</option>
                  <option value="بانتظار الموافقة">بانتظار الموافقة</option>
                  <option value="مرفوض">مرفوض</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedPriorityFilter}
                  onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="all">-- تصفية حسب الأولوية (الكل) --</option>
                  <option value="عاجل">عاجل</option>
                  <option value="خاص جداً">خاص جداً</option>
                  <option value="عام">عام</option>
                </select>
              </div>
            </div>

            {/* Quick Category Filter Tabs */}
            <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500">تصنيف المراجعين:</span>
              
              <button
                onClick={() => setFilterCategory('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>الكل</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{filterCounts.all}</span>
              </button>

              <button
                onClick={() => setFilterCategory('personal')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterCategory === 'personal'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60'
                }`}
              >
                <span>حضور شخصي</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-200/50">{filterCounts.personal}</span>
              </button>

              <button
                onClick={() => setFilterCategory('men')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterCategory === 'men'
                    ? 'bg-cyan-700 text-white shadow-xs'
                    : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-200/60'
                }`}
              >
                <span>رجال فقط</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-200/50">{filterCounts.men}</span>
              </button>

              <button
                onClick={() => setFilterCategory('women')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterCategory === 'women'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
                }`}
              >
                <span>نساء فقط</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-200/50">{filterCounts.women}</span>
              </button>

              <button
                onClick={() => setFilterCategory('independent')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterCategory === 'independent'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
                }`}
              >
                <span>مستقلين</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-200/50">{filterCounts.independent}</span>
              </button>

              <button
                onClick={() => setFilterCategory('dependent')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterCategory === 'dependent'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
                }`}
              >
                <span>غير مستقلين</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200/50">{filterCounts.dependent}</span>
              </button>
            </div>

            {/* Quick Director Decision Filter Tabs: Orange, Red, Special, General */}
            <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex-wrap">
              <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span>تصفية موقف المدير:</span>
              </span>

              <button
                type="button"
                onClick={() => setDirectorDecisionFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  directorDecisionFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>الكل ({filterCounts.all})</span>
              </button>

              <button
                type="button"
                onClick={() => setDirectorDecisionFilter('pending')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  directorDecisionFilter === 'pending'
                    ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 hover:bg-amber-100 border border-amber-300 dark:border-amber-700'
                }`}
                title="الطلبات التي لم يُعدل عليها المدير بعد (تظهر بلون برتقالي)"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>قيد مراجعة المدير (برتقالي)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200/80 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-mono">{filterCounts.directorPending}</span>
              </button>

              <button
                type="button"
                onClick={() => setDirectorDecisionFilter('rejected')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  directorDecisionFilter === 'rejected'
                    ? 'bg-red-600 text-white shadow-md ring-2 ring-red-400'
                    : 'bg-red-50 dark:bg-red-950/50 text-red-900 dark:text-red-200 hover:bg-red-100 border border-red-300 dark:border-red-700'
                }`}
                title="الطلبات المرفوضة من قبل مدير المكتب (تظهر بلون أحمر)"
              >
                <span className="w-2 h-2 rounded-full bg-red-600"></span>
                <span>مرفوض من المدير (أحمر)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-200/80 dark:bg-red-900 text-red-950 dark:text-red-100 font-mono">{filterCounts.directorRejected}</span>
              </button>

              <button
                type="button"
                onClick={() => setDirectorDecisionFilter('special')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  directorDecisionFilter === 'special'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-purple-50 dark:bg-purple-950/50 text-purple-900 dark:text-purple-200 hover:bg-purple-100 border border-purple-300 dark:border-purple-700'
                }`}
              >
                <span>معتمد (مسار خاص)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-200/80 dark:bg-purple-900 text-purple-950 dark:text-purple-100 font-mono">{filterCounts.directorSpecial}</span>
              </button>

              <button
                type="button"
                onClick={() => setDirectorDecisionFilter('general')}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  directorDecisionFilter === 'general'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-700'
                }`}
              >
                <span>معتمد (مسار عام)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-200/80 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-100 font-mono">{filterCounts.directorGeneral}</span>
              </button>
            </div>
          </div>

          {/* Requests Table */}
          <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-850">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                  جدول المعاملات الإدارية ({filteredRequests.length})
                </span>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-300 dark:border-amber-800">
                  البرتقالي: بانتظار المدير • الأحمر: مرفوض من المدير
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                تنعكس ملاحظات وتوجيهات المدير التنفيذي فوراً في هذا الجدول لكل معاملة
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase">
                  <tr>
                    <th className="p-3">رقم الطلب</th>
                    <th className="p-3">اسم المواطن والمعلومات</th>
                    <th className="p-3">الجهة المعنية</th>
                    <th className="p-3">موقف وتوجيه مدير المكتب</th>
                    <th className="p-3">تفاصيل وملاحظات الاستعلامات</th>
                    <th className="p-3">المسار الإداري</th>
                    <th className="p-3">المرحلة</th>
                    <th className="p-3">الأسبقية</th>
                    <th className="p-3">المرفقات والاسكنر</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-500">
                        لا توجد طلبات إدارية مطابقة لخيارات البحث والتصفية.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req, idx) => {
                      const isPendingDirector = !req.DirectorDecision;
                      const isRejectedByDirector = req.DirectorDecision === 'رفض';
                      const isSpecialDirector = req.DirectorDecision === 'خاص';
                      const isGeneralDirector = req.DirectorDecision === 'عام';

                      return (
                      <tr 
                        key={`${req.Request_ID}-${idx}`} 
                        className={`transition-colors border-b ${
                          isPendingDirector
                            ? 'bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100/80 border-r-4 border-r-amber-500 border-amber-200 dark:border-amber-800/60'
                            : isRejectedByDirector
                            ? 'bg-red-50/90 dark:bg-red-950/40 hover:bg-red-100/80 border-r-4 border-r-red-600 border-red-200 dark:border-red-800/60'
                            : isSpecialDirector
                            ? 'bg-purple-50/60 dark:bg-purple-950/30 hover:bg-purple-100/60 border-r-4 border-r-purple-600 border-purple-200 dark:border-purple-800/60'
                            : isGeneralDirector
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100/60 border-r-4 border-r-emerald-600 border-emerald-200 dark:border-emerald-800/60'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800'
                        }`}
                      >
                        <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400 text-[11px] whitespace-nowrap">
                          {req.Request_ID}
                          <div className="text-[10px] text-slate-400 font-normal">{req.CreatedAt}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">{req.CitizenName}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span>{req.Citizen_ID}</span>
                            {(() => {
                              const cit = citizenMap.get(req.Citizen_ID);
                              const gender = cit?.Gender || 'ذكر';
                              const att = req.AttendanceType || cit?.AttendanceType || 'شخصياً';
                              const dep = req.DependencyStatus || cit?.DependencyStatus || 'مستقل';
                              return (
                                <>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${gender === 'ذكر' ? 'bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800' : 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'}`}>
                                    {gender}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${att === 'شخصياً' ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'}`}>
                                    {att}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${dep === 'مستقل' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'}`}>
                                    {dep}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                          {req.AttendanceType === 'بيد شخص آخر (معتمد)' && req.ProxyName && (
                            <div className="text-[10px] text-purple-700 dark:text-purple-300 font-bold mt-1">
                              المعتمد: {req.ProxyName} ({req.ProxyPhone})
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{req.Entity}</td>
                        
                        {/* Director's Decision Status & Notes Column */}
                        <td className="p-3 min-w-[200px] max-w-xs">
                          {isPendingDirector && (
                            <div className="space-y-1">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 shadow-2xs animate-pulse inline-flex items-center gap-1">
                                <span>⚠️ قيد مراجعة المدير (لم يتم التعديل بعد)</span>
                              </span>
                              <div className="text-[10px] text-amber-800 dark:text-amber-300 font-medium">
                                معروض على شاشة مدير المكتب للاعتماد والتوجيه
                              </div>
                            </div>
                          )}

                          {isRejectedByDirector && (
                            <div className="space-y-1">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-2xs inline-flex items-center gap-1">
                                <span>⛔ مرفوض من قبل مدير المكتب</span>
                              </span>
                              {(req.DirectorNotes || req.DeputyNotes) && (
                                <div className="text-[10px] font-bold text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/60 p-1.5 rounded-lg border border-red-200 dark:border-red-900 mt-1 leading-relaxed">
                                  سبب الرفض: {req.DirectorNotes || req.DeputyNotes}
                                </div>
                              )}
                              {req.DirectorDecisionDate && (
                                <div className="text-[10px] text-red-700 dark:text-red-400 font-mono">
                                  بتاريخ: {req.DirectorDecisionDate}
                                </div>
                              )}
                            </div>
                          )}

                          {isSpecialDirector && (
                            <div className="space-y-1">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white shadow-2xs inline-flex items-center gap-1">
                                <span>⭐ معتمد - مسار خاص (المدير)</span>
                              </span>
                            </div>
                          )}

                          {isGeneralDirector && (
                            <div className="space-y-1">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs inline-flex items-center gap-1">
                                <span>✓ معتمد - مسار عام (المدير)</span>
                              </span>
                            </div>
                          )}

                          {/* Director's Written Notes prominently shown */}
                          {req.DirectorNotes && (
                            <div className="mt-1.5 p-2 rounded-xl bg-amber-100/95 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 text-xs font-bold shadow-2xs space-y-0.5">
                              <div className="flex items-center justify-between text-[10px] text-amber-800 dark:text-amber-300 font-black">
                                <span>📝 ملاحظات وتوجيه المدير:</span>
                              </div>
                              <p className="text-xs font-bold leading-relaxed">{req.DirectorNotes}</p>
                            </div>
                          )}
                        </td>

                        {/* Request Details & Reception Inputs */}
                        <td className="p-3 max-w-xs">
                          <p className="line-clamp-2 text-slate-700 dark:text-slate-200 font-medium">{req.Details}</p>
                          {(req.ReceptionNotes || citizenMap.get(req.Citizen_ID)?.ReferralSource) && (
                            <div className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 mt-1 inline-block">
                              ملاحظات الاستعلامات: {req.ReceptionNotes || citizenMap.get(req.Citizen_ID)?.ReferralSource}
                            </div>
                          )}
                          {req.DeputyNotes && !req.DirectorNotes && (
                            <div className="text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded mt-1 border border-amber-200 inline-block">
                              توجيه: {req.DeputyNotes}
                            </div>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            req.ProcessingStatus === 'منجز'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : req.ProcessingStatus === 'مرسل إلى الوزارة/الهيئة'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : req.ProcessingStatus === 'مرفوض' || isRejectedByDirector
                              ? 'bg-red-600 text-white font-black'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {isRejectedByDirector ? 'مرفوض' : req.ProcessingStatus}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            {req.CurrentStage || 'مدير الإدارة'}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            req.Priority === 'عاجل' || req.Priority === 'خاص جداً'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {req.Priority}
                          </span>
                        </td>
                        <td className="p-3">
                          {req.AttachedRequestImage ? (
                            <div 
                              onClick={() => setFullPreviewScan({
                                url: req.AttachedRequestImage!,
                                uploadedBy: req.ScanUploadedBy || 'موظف الإدارة',
                                uploadedAt: req.ScanUploadedAt || req.CreatedAt,
                                requestTitle: req.Details,
                                citizenName: req.CitizenName
                              })}
                              className="p-1 rounded bg-blue-50/80 border border-blue-200 hover:bg-blue-100/90 transition-all flex items-center gap-1.5 cursor-pointer max-w-[170px]"
                              title="انقر لمعاينة صورة الاسكنر المحفوظة كما هي مع اسم الموظف والتاريخ"
                            >
                              <img 
                                src={req.AttachedRequestImage} 
                                alt="اسكنر" 
                                className="w-7 h-9 object-cover rounded shadow-2xs border border-slate-200 shrink-0" 
                              />
                              <div className="text-[10px] text-right leading-tight min-w-0">
                                <span className="font-bold text-blue-900 block truncate" title={req.ScanUploadedBy}>
                                  {req.ScanUploadedBy || 'موظف الإدارة'}
                                </span>
                                <span className="text-[9px] font-mono text-slate-500 block truncate">
                                  {req.ScanUploadedAt || req.CreatedAt}
                                </span>
                              </div>
                            </div>
                          ) : (req.AttachmentRequest || req.AttachmentResponse) ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                              <Paperclip className="w-3 h-3" />
                              <span>مرفق</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">لا يوجد</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openScannerForCitizen(req.Citizen_ID)}
                              className="px-2 py-1 rounded bg-blue-900 hover:bg-blue-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                              title="سكنر مباشر للمستندات وطباعة فورية"
                            >
                              <Scan className="w-3 h-3 text-blue-300" />
                              <span>سكنر</span>
                            </button>

                            <button
                              onClick={() => {
                                const cit = citizens.find(c => c.Citizen_ID === req.Citizen_ID);
                                if (cit) openReferralForCitizen(cit);
                              }}
                              className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              title="إحالة إلى مدير التنظيم"
                            >
                              <SendHorizontal className="w-3 h-3" />
                              <span>إحالة</span>
                            </button>

                            <button
                              onClick={() => openEditModal(req)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[11px] font-bold cursor-pointer"
                            >
                              تعديل
                            </button>

                            <button
                              onClick={() => setRequestToDelete(req)}
                              className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[11px] font-bold cursor-pointer"
                              title="حذف هذا الطلب رسمياً"
                            >
                              <Trash2 className="w-3 h-3" />
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
        </>
      )}

      {/* Tab 2: Reception Citizens Feed & Workflow Pipeline */}
      {activeTab === 'reception_citizens' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={receptionSearch}
                onChange={(e) => setReceptionSearch(e.target.value)}
                placeholder="بحث في مراجعي الاستعلامات (الاسم، رقم ID، الهاتف، القضاء)..."
                className="w-full h-9 pr-9 pl-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-right"
              />
            </div>
            <span className="text-xs text-slate-500 font-semibold px-2">
              إجمالي مراجعي الاستعلامات: {filteredReceptionCitizens.length} مراجع
            </span>
          </div>

          <div className="space-y-3">
            {filteredReceptionCitizens.length === 0 ? (
              <div className="p-8 rounded-xl bg-white border border-slate-200 text-center text-slate-500 text-xs shadow-xs">
                لا توجد سجلات مطابقة للبحث في وارد الاستعلامات.
              </div>
            ) : (
              filteredReceptionCitizens.map((cit) => {
                const citRequests = requests.filter(r => r.Citizen_ID === cit.Citizen_ID);

                return (
                  <div
                    key={cit.Citizen_ID}
                    className="p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-300 shadow-xs space-y-3 transition-all text-right"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {cit.Citizen_ID}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900">{cit.FullName}</h4>
                        {cit.Surname && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            عشيرة: {cit.Surname}
                          </span>
                        )}
                        
                        {/* Current Workflow Stage Badge */}
                        <div className="flex items-center gap-1 bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded border border-indigo-200 text-[10px] font-bold">
                          <span>المرحلة الحالية:</span>
                          <span className="text-indigo-950 font-black">{cit.CurrentStage || 'الاستعلامات'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cit.CreatedAt}</span>
                        </span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-600">
                          مسجل بواسطة: {cit.CreatedBy || 'الاستعلامات'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCitizenToDelete(cit)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="حذف هذا المراجع نهائياً من قاعدة البيانات والمنظومة"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        </button>
                      </div>
                    </div>

                    {/* Workflow Pipeline Breadcrumbs */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-[11px] flex-wrap gap-2">
                      <span className="text-slate-500 font-bold text-[10px]">مسار المعاملة:</span>
                      <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          (cit.CurrentStage === 'الاستعلامات' || !cit.CurrentStage)
                            ? 'bg-blue-600 text-white'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          1. الاستعلامات ✓
                        </span>
                        <span className="text-slate-400">←</span>
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          cit.CurrentStage === 'مدير المكتب'
                            ? 'bg-blue-600 text-white'
                            : (cit.CurrentStage === 'مدير الإدارة' || cit.CurrentStage === 'مدير التنظيم')
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          2. مدير المكتب
                        </span>
                        <span className="text-slate-400">←</span>
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          cit.CurrentStage === 'مدير الإدارة'
                            ? 'bg-blue-600 text-white'
                            : cit.CurrentStage === 'مدير التنظيم'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          3. مدير الإدارة
                        </span>
                        <span className="text-slate-400">←</span>
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          cit.CurrentStage === 'مدير التنظيم'
                            ? 'bg-indigo-700 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          4. مدير التنظيم 👥
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-slate-700 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[10px] mb-0.5">رقم الهاتف</span>
                        <span className="font-mono font-bold text-slate-900 flex items-center gap-1" dir="ltr">
                          <Phone className="w-3 h-3 text-emerald-600 inline" />
                          {cit.Phone1}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] mb-0.5">السكن والموقع</span>
                        <span className="font-semibold text-slate-900 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-blue-600 inline" />
                          {cit.District} {cit.SubDistrict ? `(${cit.SubDistrict})` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] mb-0.5">المهنة والتحصيل</span>
                        <span className="font-semibold text-slate-900">{cit.Job || 'كاسب'} - {cit.Education || 'إعدادية'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] mb-0.5">المعرّف / التزكية</span>
                        <span className="font-semibold text-slate-900">{cit.ReferralSource || 'مباشر بدون معرف'}</span>
                      </div>
                    </div>

                    {/* Associated Requests */}
                    {citRequests.length > 0 && (
                      <div className="space-y-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between text-[11px] font-black text-slate-800 dark:text-slate-200">
                          <span>المعاملات المربوطة ({citRequests.length}):</span>
                          <span className="text-[10px] text-slate-500 font-normal">موقف وتوجيه المدير منعكس هنا تلقائياً</span>
                        </div>
                        {citRequests.map((r, idx) => {
                          const isPend = !r.DirectorDecision;
                          const isRej = r.DirectorDecision === 'رفض';
                          const isSpec = r.DirectorDecision === 'خاص';
                          const isGen = r.DirectorDecision === 'عام';

                          return (
                            <div 
                              key={`${r.Request_ID}-${idx}`} 
                              className={`p-2.5 rounded-lg border text-xs space-y-1 transition-all ${
                                isPend
                                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                                  : isRej
                                  ? 'bg-red-50/90 dark:bg-red-950/40 border-red-300 dark:border-red-700'
                                  : isSpec
                                  ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700'
                                  : isGen
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono font-bold text-blue-700 dark:text-blue-400">{r.Request_ID}</span>
                                  <span className="font-black text-slate-900 dark:text-white">[{r.Entity}]</span>
                                  <span className="text-slate-700 dark:text-slate-200 font-medium">- {r.Details}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isPend && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-slate-950 shadow-2xs animate-pulse">
                                      🟠 بانتظار المدير
                                    </span>
                                  )}
                                  {isRej && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white shadow-2xs">
                                      🔴 مرفوض من المدير
                                    </span>
                                  )}
                                  {isSpec && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-600 text-white">
                                      🟣 مسار خاص
                                    </span>
                                  )}
                                  {isGen && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white">
                                      🟢 مسار عام
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    {isRej ? 'مرفوض' : r.ProcessingStatus}
                                  </span>
                                </div>
                              </div>

                              {/* Director Notes in Citizen Tab */}
                              {r.DirectorNotes && (
                                <div className="p-2 rounded bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100 text-xs font-bold mt-1">
                                  <span>📝 توجيه وملاحظات مدير المكتب: {r.DirectorNotes}</span>
                                  {r.DirectorDecisionDate && (
                                    <span className="text-[10px] text-amber-700 mr-2 font-mono">({r.DirectorDecisionDate})</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Admin Actions for Citizen */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 flex-wrap">
                      <button
                        onClick={() => openScannerForCitizen(cit.Citizen_ID)}
                        className="px-3 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Scan className="w-3.5 h-3.5 text-blue-300" />
                        <span>سكنر وطباعة مباشرة</span>
                      </button>

                      <button
                        onClick={() => openReferralForCitizen(cit)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <SendHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                        <span>إحالة لمدير التنظيم 👥</span>
                      </button>

                      <button
                        onClick={() => setPrintableBadgeCitizen(cit)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="طباعة باج"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>طباعة الباج</span>
                      </button>

                      <button
                        onClick={() => setSelectedCitizenForHistory(cit)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-blue-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>الأرشيف والسجل</span>
                      </button>

                      <button
                        onClick={() => openCreateForCitizen(cit.Citizen_ID)}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ كتاب رسمي / معاملة</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Direct Scanner & Printer (سكنر مباشر الى الطابعة) */}
      {activeTab === 'direct_scanner' && (
        <DirectScannerPrinter initialCitizenId={scannerCitizenId} />
      )}

      {/* Tab 4: Smart Images Archive (أرشفة واستخراج صور المعاملات 1000 - 2000 صورة) */}
      {activeTab === 'smart_images' && (
        <SmartImageArchiveModule onOpenCitizenHistory={(cid) => {
          const cit = citizens.find(c => c.Citizen_ID === cid);
          if (cit) setSelectedCitizenForHistory(cit);
        }} />
      )}

      {/* Tab 5: Referrers Section in Admin (قسم المعرفين وتزكيات المراجعين) */}
      {activeTab === 'referrers' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-l from-purple-900 via-slate-900 to-purple-950 text-white rounded-2xl p-4 border border-purple-800/40 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Users2 className="w-4 h-4 text-purple-400" />
                <span>قسم المعرفين والتزكيات - قسم الإدارة</span>
              </h3>
              <p className="text-xs text-purple-200">
                إدارة ومتابعة المعرفين والمزكين للمراجعين، وتحليل إحصائيات المعرفين الأكثر نشاطاً في مكتب النائب.
              </p>
            </div>
          </div>
          <ReferrersStats />
        </div>
      )}

      {/* Tab 6: Department Staff & Permissions Management (كادر موظفي قسم الإدارة والصلاحيات) */}
      {activeTab === 'department_staff' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-l from-blue-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-5 border border-blue-800/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2 text-white">
                    <span>كادر موظفي قسم الإدارة والمعاملات ({users.filter(u => u.Role === 'admin' || u.Department?.includes('الإدارة')).length} موظفين)</span>
                  </h3>
                  <p className="text-xs text-blue-200">
                    استعراض كادر موظفي القسم والصلاحيات الممنوحة. كل موظف موثق بحسابه الشخصي ورمزه السري، وتُسجل كافة حركات المسح الضوئي وإجراءات المعاملات باسمه حصراً.
                  </p>
                </div>
              </div>
            </div>

            {currentUser?.Role === 'developer' && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveSection('master_admin')}
                  className="px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>إدارة وتعديل الصلاحيات بالكامل (Master Admin)</span>
                </button>
              </div>
            )}
          </div>

          {/* Active Workstation Banner */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-xs">
                <span className="text-emerald-900 font-bold">الموظف المسجل حالياً في هذا الجهاز: </span>
                <span className="text-emerald-950 font-extrabold text-sm">{currentUser?.FullName}</span>
                <span className="text-emerald-700 mx-2">({currentUser?.RoleArabic} - {currentUser?.Department})</span>
              </div>
            </div>
            <span className="text-[11px] text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 font-bold">
              أي عملية رفع اسكنر ستوثّق باسم: {currentUser?.FullName}
            </span>
          </div>

          {/* Security & Access Protection Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-900 text-xs">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-700 font-bold">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 leading-relaxed">
              <p className="font-bold">
                🔒 نظام حماية الحسابات وتوثيق العمليات:
              </p>
              <p className="text-[11px] text-amber-800">
                أنت مسجل حالياً باسم الموظف <strong>{currentUser?.FullName}</strong>. تم تأمين النظام بحيث لا يمكن لأي موظف التبديل إلى حساب زميل له في القسم بدون تسجيل الخروج وإدخال الرمز السري الشخصي، وذلك لضمان موثوقية السكنر وسلامة سجل المعاملات.
              </p>
            </div>
          </div>

          {/* Department Staff Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {users
              .filter(u => u.Role === 'admin' || u.Department?.includes('الإدارة'))
              .map((staffMember, idx) => {
                const isCurrent = currentUser?.User_ID === staffMember.User_ID;
                const staffPerms = staffMember.Permissions || [];
                return (
                  <div
                    key={staffMember.User_ID || idx}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      isCurrent
                        ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-400/40 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{staffMember.FullName}</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            {staffMember.RoleArabic}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                              ✓ الحساب النشط الآن
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
                          <span>اسم الدخول: <strong className="text-slate-700">{staffMember.Username}</strong></span>
                          <span>•</span>
                          <span>القسم: {staffMember.Department}</span>
                          <span>•</span>
                          <span className={staffMember.Status === 'frozen' ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                            {staffMember.Status === 'frozen' ? 'مجمّد' : 'نشط'}
                          </span>
                        </div>
                      </div>

                      {!isCurrent && (
                        currentUser?.Role === 'developer' ? (
                          <button
                            type="button"
                            onClick={() => switchUser(staffMember)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                            title="تفعيل هذا الموظف (صلاحية المطور)"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>تفعيل الموظف</span>
                          </button>
                        ) : (
                          <div 
                            className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold flex items-center gap-1.5 border border-slate-200 shrink-0 select-none shadow-2xs"
                            title="الحساب محمي بالرمز السري الشخصي. لا يمكن التبديل بدون تسجيل الخروج."
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            <span>مؤمن برمز المرور</span>
                          </div>
                        )
                      )}
                    </div>

                    {/* Permissions list */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>الصلاحيات المخصصة لهذا الموظف ({staffPerms.length})</span>
                        <span className="text-[10px] text-blue-700 font-mono">ID: {staffMember.User_ID}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {staffPerms.map(pid => {
                          const pDef = SYSTEM_PERMISSIONS.find(p => p.id === pid);
                          return (
                            <span
                              key={pid}
                              className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 transition-colors font-medium flex items-center gap-1"
                            >
                              <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                              <span>{pDef?.name || pid}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tab 7: Manage & Develop Dynamic Sections */}
      {activeTab === 'manage_departments' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl border border-purple-800/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 text-right">
              <h3 className="font-black text-base flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-300" />
                <span>إدارة واستحداث أقسام المكتب وتطوير المنظومة</span>
              </h3>
              <p className="text-xs text-purple-200">
                إضافة أقسام جديدة أو حقول مخصصة ترتبط مباشرة بقاعدة البيانات وتظهر فوراً لكافة الموظفين
              </p>
            </div>
          </div>
          <CustomSectionsManager />
        </div>
      )}

      {/* Referral Modal */}
      {showReferralModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <SendHorizontal className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">إحالة مسار المعاملة والمراجع</h3>
              </div>
              <button
                onClick={() => setShowReferralModal(false)}
                className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-right">
              {referralTargetCitizen && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">المراجع:</span>
                    <strong className="text-slate-900 font-bold">{referralTargetCitizen.FullName}</strong>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-500">الرقم التعريفي والسكن:</span>
                    <span className="font-mono text-blue-700 font-bold">{referralTargetCitizen.Citizen_ID} - {referralTargetCitizen.District}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المرحلة / القسم المحال إليه:</label>
                <select
                  value={referralStage}
                  onChange={(e) => setReferralStage(e.target.value as WorkflowStage)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-indigo-900 focus:bg-white outline-none"
                >
                  <option value="مدير التنظيم">مدير التنظيم (قسم العلاقات والتنظيم والموقف الجماهيري)</option>
                  <option value="مدير المكتب">مدير المكتب التنفيذي</option>
                  <option value="مدير الإدارة">مدير الإدارة والمعاملات</option>
                  <option value="الاستعلامات">الاستعلامات والاستقبال</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الهامش / توجيه الإحالة:</label>
                <textarea
                  value={referralDirective}
                  onChange={(e) => setReferralDirective(e.target.value)}
                  rows={3}
                  placeholder="اكتب التوجيه أو الهامش المرفق مع الإحالة..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowReferralModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmReferral}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <SendHorizontal className="w-4 h-4" />
                <span>تأكيد الإحالة الفورية</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Request Modal */}
      {(showAddModal || editingRequest) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <FolderKanban className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRequest ? `تعديل ومتابعة الطلب (${editingRequest.Request_ID})` : 'إنشاء وتوثيق طلب إداري جديد'}
                  </h3>
                  <p className="text-xs text-slate-500">تحديث الجهة المعنية، المسار، الأولوية، والمرفقات</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingRequest(null);
                }}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRequest} className="space-y-3.5 text-right">
              {/* Select Citizen (if creating new) */}
              {!editingRequest ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اختر المراجع *</label>
                  <select
                    value={selectedCitizenId}
                    onChange={(e) => setSelectedCitizenId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="">-- اختر مراجع من المسجلين بالاستعلامات --</option>
                    {citizens.map((c) => (
                      <option key={c.Citizen_ID} value={c.Citizen_ID}>
                        {c.FullName} ({c.Citizen_ID}) - {c.District}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">تعديل بيانات صاحب الطلب:</span>
                    <span className="font-mono text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {editingRequest.Citizen_ID}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">الاسم الرباعي واللقب</label>
                      <input
                        type="text"
                        value={editableCitizenName}
                        onChange={(e) => setEditableCitizenName(e.target.value)}
                        placeholder="اسم المواطن..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">رقم الهاتف</label>
                      <input
                        type="tel"
                        value={editableCitizenPhone}
                        onChange={(e) => setEditableCitizenPhone(e.target.value)}
                        placeholder="07800000000"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Entity (Auto add) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الجهة المعنية *</label>
                <select
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  {entitiesList.map((ent, idx) => (
                    <option key={idx} value={ent}>{ent}</option>
                  ))}
                  <option value="أخرى">+ أخرى (إضافة وزارة أو جهة جديدة)</option>
                </select>
                {entity === 'أخرى' && (
                  <input
                    type="text"
                    value={customEntity}
                    onChange={(e) => setCustomEntity(e.target.value)}
                    placeholder="اكتب اسم الجهة أو المديرية..."
                    className="w-full mt-1.5 px-3 py-1.5 rounded-lg bg-white border border-blue-400 text-slate-900 text-xs text-right"
                    required
                  />
                )}
              </div>

              {/* Statuses & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حالة الاستلام</label>
                  <select
                    value={requestStatus}
                    onChange={(e) => setRequestStatus(e.target.value as RequestStatus)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="مستلم">مستلم</option>
                    <option value="غير مستلم">غير مستلم</option>
                    <option value="معاد">معاد</option>
                    <option value="غير مستوفي للشروط">غير مستوفي للشروط</option>
                    <option value="خاص">خاص</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المسار الإداري</label>
                  <select
                    value={processingStatus}
                    onChange={(e) => setProcessingStatus(e.target.value as ProcessingStatus)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700"
                  >
                    <option value="قيد التدقيق">قيد التدقيق</option>
                    <option value="مرسل إلى الوزارة/الهيئة">مرسل إلى الوزارة/الهيئة</option>
                    <option value="منجز">منجز</option>
                    <option value="تم الطباعة">تم الطباعة</option>
                    <option value="بانتظار الموافقة">بانتظار الموافقة</option>
                    <option value="مرفوض">مرفوض</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">درجة الأولوية</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-bold text-red-700"
                  >
                    <option value="عام">عام</option>
                    <option value="عاجل">عاجل (إشعار فوري)</option>
                    <option value="خاص جداً">خاص جداً (إشعار فوري)</option>
                  </select>
                </div>
              </div>

              {/* Attendance & Dependency classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الحضور والتسجيل</label>
                  <select
                    value={attendanceType}
                    onChange={(e) => setAttendanceType(e.target.value as 'شخصياً' | 'عبر معتمد' | 'وكيل')}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs text-right focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="شخصياً">شخصياً (المواطن حضر بنفسه)</option>
                    <option value="عبر معتمد">عبر معتمد (عن طريق معتمد/منسق)</option>
                    <option value="وكيل">وكيل (وكيل رسمي أو تفويض)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حالة التبعية والشمول</label>
                  <select
                    value={dependencyStatus}
                    onChange={(e) => setDependencyStatus(e.target.value as 'مستقل' | 'غير مستقل')}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 text-xs text-right focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="مستقل">مستقل (رب أسرة / معيل مستقل)</option>
                    <option value="غير مستقل">غير مستقل (تابع لأسرته / معال)</option>
                  </select>
                </div>
              </div>

              {/* Details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">شرح وتفاصيل المعاملة *</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  placeholder="موضوع الطلب والإجراء والمتابعة مع الوزارة..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              {/* Attachments / Files */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم/رابط الطلب المقدم</label>
                  <input
                    type="text"
                    value={attachmentReq}
                    onChange={(e) => setAttachmentReq(e.target.value)}
                    placeholder="طلب_مقدم_2026.pdf"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم/رابط كتاب الإجابة أو الأمر</label>
                  <input
                    type="text"
                    value={attachmentResp}
                    onChange={(e) => setAttachmentResp(e.target.value)}
                    placeholder="كتاب_الإجابة_الرسمي.pdf"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Direct Scanner Document Section (حفظ صورة الاسكنر كما هي + اسم الموظف والتاريخ) */}
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Scan className="w-4 h-4 text-blue-700" />
                    <span>إرفاق صورة الاسكنر للطلب (حفظ الصورة كما هي مع توثيق اسم الموظف والتاريخ)</span>
                  </label>
                  <span className="text-[10px] text-blue-800 bg-white px-2 py-0.5 rounded font-mono border border-blue-200 font-bold">
                    الموظف الموثق: {currentUser?.FullName || 'موظف الإدارة'}
                  </span>
                </div>

                {attachedScanImage ? (
                  <div className="p-2.5 bg-white rounded-lg border border-blue-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img 
                        src={attachedScanImage} 
                        alt="Scan Preview" 
                        className="w-14 h-16 object-cover rounded border border-slate-200 shadow-xs" 
                      />
                      <div className="text-xs space-y-0.5">
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>تم ربط صورة الاسكنر بنجاح</span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          بواسطة الموظف: <strong className="text-blue-900">{scanUploadedBy || currentUser?.FullName}</strong>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          التاريخ: {scanUploadedAt || new Date().toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFullPreviewScan({
                          url: attachedScanImage,
                          uploadedBy: scanUploadedBy || currentUser?.FullName || 'موظف الإدارة',
                          uploadedAt: scanUploadedAt || new Date().toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' }),
                          requestTitle: details || 'معاينة المسح الضوئي',
                          citizenName: editableCitizenName || 'المواطن'
                        })}
                        className="p-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold"
                        title="معاينة بالحجم الكامل"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedScanImage(null);
                          setScanUploadedBy('');
                          setScanUploadedAt('');
                        }}
                        className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold"
                        title="إلغاء المرفق"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="flex-1 border-2 border-dashed border-blue-300 hover:border-blue-500 bg-white rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors group">
                      <Upload className="w-5 h-5 text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-bold text-blue-900">انقر لاختيار صورة المسح الضوئي (Scanner Image)</span>
                      <span className="text-[10px] text-slate-500">تُحفظ الصورة بدون تغيير ويُسجل اسم الموظف والتاريخ تلقائياً</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleUploadScanFile} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Deputy Notes */}
              <div>
                <label className="block text-xs font-bold text-amber-800 mb-1">توجيه وقرار النائب (إن وجد)</label>
                <input
                  type="text"
                  value={deputyNotes}
                  onChange={(e) => setDeputyNotes(e.target.value)}
                  placeholder="مثال: مفاتحة معالي الوزير مباشرة، إحالة للمتابعة الشخصية..."
                  className="w-full px-3 py-1.5 rounded-lg bg-amber-50/50 border border-amber-300 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Submit buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                {editingRequest ? (
                  <button
                    type="button"
                    onClick={() => {
                      const toDel = editingRequest;
                      setShowAddModal(false);
                      setEditingRequest(null);
                      setRequestToDelete(toDel);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف هذا الطلب</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingRequest(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    {editingRequest ? 'حفظ التعديلات' : 'حفظ وإرسال التنبيه'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog for Admin Requests */}
      {requestToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4 text-right">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">تأكيد حذف المعاملة / الطلب</h3>
                <p className="text-xs text-rose-600 font-semibold">إجراء إداري رسمي موثق</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="text-slate-800">
                <span className="font-bold text-slate-500">رقم الطلب: </span>
                <span className="font-mono text-blue-700 font-bold">{requestToDelete.Request_ID}</span>
              </div>
              <div className="text-slate-800">
                <span className="font-bold text-slate-500">صاحب الطلب: </span>
                <span className="font-bold text-slate-900">{requestToDelete.CitizenName}</span>
              </div>
              <div className="text-slate-800">
                <span className="font-bold text-slate-500">الجهة المعنية: </span>
                <span>{requestToDelete.Entity}</span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                ⚠️ تنبيه: سيتم حذف هذا الطلب نهائياً وتوثيق هوية الموظف في سجل الرقابة والتدقيق الداخلي.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRequestToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                تراجع وإلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteRequest(requestToDelete.Request_ID);
                  setRequestToDelete(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تأكيد حذف الطلب</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Citizen Permanent Delete Confirmation Modal for Admin Manager */}
      {citizenToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-100 p-5 space-y-4 text-right animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900">تأكيد الحذف النهائي الشامل للمراجع</h3>
                <p className="text-[11px] text-slate-500 font-medium">سيتم مسحه نهائياً من قاعدة البيانات والسحابة وجميع الأقسام</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 text-xs text-rose-900 space-y-2">
              <p className="font-bold">هل أنت متأكد من الحذف النهائي لسجل المراجع التالي؟</p>
              <div className="font-semibold text-slate-800 bg-white p-2 rounded-lg border border-rose-100 space-y-0.5">
                <div>الاسم الكامل: <span className="text-blue-800 font-bold">{citizenToDelete.FullName}</span></div>
                <div>الرقم التعريفي: <span className="font-mono text-slate-600 font-bold">{citizenToDelete.Citizen_ID}</span></div>
                {citizenToDelete.Phone1 && <div>الهاتف: <span className="font-mono text-slate-600">{citizenToDelete.Phone1}</span></div>}
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed font-bold">
                ⚠️ تحذير: الحذف نهائي وشامل (من فايربيس وكوكل شيت والمنظومة وكافة المعاملات والطلبات والمقابلات التابعة له) ولا يمكن التراجع عنه.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCitizenToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                تراجع وإلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCitizen(citizenToDelete.Citizen_ID);
                  setCitizenToDelete(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/25 active:scale-95 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف النهائي الشامل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Scan Modal */}
      {fullPreviewScan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl text-right">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Scan className="w-4 h-4 text-amber-400" />
                  <span>معاينة صورة الاسكنر الأصلية للطلب</span>
                </h3>
                <p className="text-[11px] text-slate-300">
                  {fullPreviewScan.citizenName} • {fullPreviewScan.requestTitle}
                </p>
              </div>
              <button
                onClick={() => setFullPreviewScan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-100 flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
              <img 
                src={fullPreviewScan.url} 
                alt="Original Scan" 
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-md border border-slate-300" 
              />
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="space-y-0.5">
                <div className="text-slate-800 font-bold">
                  الموظف الموثق: <span className="text-blue-900 font-extrabold">{fullPreviewScan.uploadedBy}</span>
                </div>
                <div className="text-slate-500 font-mono text-[11px]">
                  تاريخ وتوقيت المسح: {fullPreviewScan.uploadedAt}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={fullPreviewScan.url}
                  download={`scan-${Date.now()}.png`}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold flex items-center gap-1.5 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل الصورة</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>طباعة صورة المسح الضوئي</title>
                            <style>body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; } img { max-width: 100%; height: auto; }</style>
                          </head>
                          <body onload="window.print()">
                            <img src="${fullPreviewScan.url}" />
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة فورية</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Request Drafter Modal */}
      <AiRequestDrafterModal
        isOpen={showAiDrafterModal}
        onClose={() => setShowAiDrafterModal(false)}
      />
    </div>
  );
};
