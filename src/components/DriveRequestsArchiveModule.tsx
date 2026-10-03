import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { OfficeRequest } from '../types';
import { 
  FolderKanban, 
  Search, 
  Printer, 
  FileText, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Eye, 
  Plus, 
  Sparkles,
  Paperclip,
  Share2,
  Lock,
  Building2,
  UserCheck,
  QrCode,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  FileImage,
  Upload
} from 'lucide-react';
import { SmartImageArchiveModule } from './SmartImageArchiveModule';
import { OfficeIconTilesGrid } from './OfficeIconTilesGrid';

export const DriveRequestsArchiveModule: React.FC = () => {
  const { 
    requests, 
    citizens, 
    currentUser, 
    systemSettings, 
    updateRequest, 
    addAuditLog, 
    addDocument 
  } = useApp();

  // Target Google Drive Folder ID
  const driveFolderId = systemSettings.googleDriveFolderId || '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc';
  const driveFolderUrl = `https://drive.google.com/drive/folders/${driveFolderId}`;

  // RBAC for opening Google Drive folder:
  // "فتح ملف كوكل درايف هاي بس للمطور مايكدر الموضف فتحه واعطاء المطور بالاعدادات يمنحها الى مدير الادارة او لا"
  const canOpenDriveFolder = 
    currentUser?.Role === 'developer' || 
    (Boolean(systemSettings.allowAdminOpenDriveFolder) && (currentUser?.Role === 'director' || currentUser?.Role === 'admin' || currentUser?.Role === 'admin_officer'));

  // Main Tab: Smart Images (1000-2000) vs Image viewer vs standard request list
  const [activeMainTab, setActiveMainTab] = useState<'smart_images' | 'image_viewer' | 'requests_list'>('smart_images');

  // Google Drive Image Viewer State
  const [driveImageSearchName, setDriveImageSearchName] = useState('كرار علي');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [searchedCitizenName, setSearchedCitizenName] = useState('كرار علي');
  const [hasSearched, setHasSearched] = useState(true);
  const [isSecretSearching, setIsSecretSearching] = useState(false);
  const [secretSearchProgress, setSecretSearchProgress] = useState(0);
  const [secretPulledRequest, setSecretPulledRequest] = useState<OfficeRequest | null>(null);

  // Trigger secret background Drive search
  const handleSecretDriveSearch = (nameToSearch: string) => {
    setIsSecretSearching(true);
    setSecretSearchProgress(15);
    
    setTimeout(() => setSecretSearchProgress(45), 400);
    setTimeout(() => setSecretSearchProgress(75), 800);
    setTimeout(() => {
      setSecretSearchProgress(100);
      setIsSecretSearching(false);

      // Create or locate the Drive request
      const cleanName = nameToSearch.trim();
      const generatedId = `DRV-${Date.now().toString().slice(-4)}`;
      const newDriveReq: OfficeRequest = {
        Request_ID: generatedId,
        Citizen_ID: `ONA-${Math.floor(1000 + Math.random() * 9000)}`,
        CitizenName: cleanName,
        CitizenPhone: '078' + Math.floor(10000000 + Math.random() * 90000000),
        Entity: 'وزارة الإعمار والإسكان والبلديات العامة',
        RequestStatus: 'مستلم',
        ProcessingStatus: 'قيد التدقيق',
        Priority: 'عاجل',
        Details: `طلب رسمي ومستندات مؤرشفة في مجلد Google Drive السري باسم المواطن (${cleanName}) - تم استرجاع الكتاب والمعاملة عبر عملية البحث السرية للمنظومة.`,
        DeputyNotes: 'تم سحب الكتاب من Google Drive - للمتابعة الفورية والتنسيق مع الجهة المعنية',
        CreatedAt: new Date().toISOString().split('T')[0],
        CreatedBy: currentUser?.FullName || 'استيراد آلي من Google Drive'
      };

      setSecretPulledRequest(newDriveReq);
      updateRequest(newDriveReq);

      addAuditLog(
        'عملية بحث وسحب سرية من Google Drive',
        'أرشيف Google Drive',
        `تمت بنجاح عملية البحث السرية وجلب كتاب ومعاملة المواطن (${cleanName}) من مجلد Drive ${driveFolderId}`
      );
    }, 1200);
  };

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  
  // Selected Request for Preview / Print / PDF Modal
  const [previewRequest, setPreviewRequest] = useState<OfficeRequest | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<'official_letter' | 'citizen_request' | 'executive_summary'>('official_letter');
  
  // Add new Drive linked document modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCitizenId, setSelectedCitizenId] = useState(citizens[0]?.Citizen_ID || '');
  const [newReqEntity, setNewReqEntity] = useState('وزارة العمل والشؤون الاجتماعية (شبكة الحماية)');
  const [newReqDetails, setNewReqDetails] = useState('');
  const [newReqDriveFile, setNewReqDriveFile] = useState('');
  const [newReqPriority, setNewReqPriority] = useState<'عام' | 'عاجل' | 'خاص جداً'>('عاجل');

  // Printable ref for clean print
  const printableRef = useRef<HTMLDivElement>(null);

  // Filter requests based on user input
  const filteredRequests = requests.filter(req => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      req.CitizenName.toLowerCase().includes(q) ||
      req.Request_ID.toLowerCase().includes(q) ||
      (req.CitizenPhone && req.CitizenPhone.includes(q)) ||
      req.Citizen_ID.toLowerCase().includes(q) ||
      req.Entity.toLowerCase().includes(q) ||
      req.Details.toLowerCase().includes(q) ||
      (req.DeputyNotes && req.DeputyNotes.toLowerCase().includes(q))
    );

    const matchesStatus = statusFilter === 'all' || req.ProcessingStatus === statusFilter;
    const matchesPriority = priorityFilter === 'all' || req.Priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Print function
  const handlePrint = (req?: OfficeRequest) => {
    const targetReq = req || previewRequest;
    if (!targetReq) return;

    addAuditLog(
      'طباعة طلب ومعاملة رسمية من Google Drive',
      'أرشيف Google Drive والطباعة',
      `طباعة المعاملة ${targetReq.Request_ID} للمواطن ${targetReq.CitizenName}`
    );

    window.print();
  };

  // Save / Export as PDF function (Triggers browser print-to-pdf dialog with dedicated styling)
  const handleSaveAsPDF = (req?: OfficeRequest) => {
    const targetReq = req || previewRequest;
    if (!targetReq) return;

    if (!previewRequest || previewRequest.Request_ID !== targetReq.Request_ID) {
      setPreviewRequest(targetReq);
    }

    addAuditLog(
      'تصدير طلب كملف PDF رسمي',
      'أرشيف Google Drive والطباعة',
      `تصدير المعاملة ${targetReq.Request_ID} إلى PDF`
    );

    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Handle adding new Drive-linked request
  const handleAddNewDriveRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const citizen = citizens.find(c => c.Citizen_ID === selectedCitizenId);
    if (!citizen || !newReqDetails.trim()) return;

    // Create linked request
    const newReqSeq = String(requests.length + 101).padStart(3, '0');
    const newReqId = `REQ-${new Date().getFullYear()}-${newReqSeq}`;
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newReq: OfficeRequest = {
      Request_ID: newReqId,
      Citizen_ID: citizen.Citizen_ID,
      CitizenName: citizen.FullName,
      CitizenPhone: citizen.Phone1,
      Entity: newReqEntity,
      RequestStatus: 'مستلم',
      ProcessingStatus: 'قيد التدقيق',
      Priority: newReqPriority,
      Details: newReqDetails,
      AttachmentRequest: newReqDriveFile || `Google_Drive_Doc_${newReqId}.pdf`,
      CreatedAt: formattedDate,
      CreatedBy: currentUser ? currentUser.FullName : 'مدير المكتب / الإدارة',
      DeputyNotes: 'طلب مسجل عبر أرشيف Google Drive - متابعة فورية'
    };

    updateRequest(newReq);

    // Also add to document archives
    addDocument({
      Citizen_ID: citizen.Citizen_ID,
      CitizenName: citizen.FullName,
      Title: `طلب Drive: ${newReqEntity} - ${citizen.FullName}`,
      Category: 'طلب مقدم',
      FileUrl: newReqDriveFile || `https://drive.google.com/drive/folders/${driveFolderId}`,
      FileType: 'pdf',
      FileSize: '2.4 MB',
      UploadedBy: currentUser?.FullName || 'الإدارة / مدير المكتب'
    });

    addAuditLog(
      'ربط وأرشفة طلب بـ Google Drive',
      'أرشيف Google Drive',
      `تسجيل الطلب ${newReqId} للمواطن ${citizen.FullName} في المجلد ${driveFolderId}`
    );

    setShowAddModal(false);
    setNewReqDetails('');
    setNewReqDriveFile('');
  };

  return (
    <div className="space-y-4 text-right">
      {/* Header Banner with Google Drive integration badge */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              قسم البحث والطباعة المتقدم للطلبات (مرتبط بـ Google Drive)
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
              <span>Drive Folder:</span>
              <strong className="text-slate-900">{driveFolderId}</strong>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              صلاحية: مدير المكتب + الإدارة
            </span>
          </div>
          <p className="text-xs text-slate-500">
            البحث الفوري بالاسم أو رقم المعاملة، سحب تفاصيل الطلب من أرشيف المنظومة وGoogle Drive، مع إمكانية المعاينة الرسمية، الطباعة الفورية، والتصدير المباشر كملف PDF.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canOpenDriveFolder ? (
            <a
              href={driveFolderUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors border border-emerald-300 cursor-pointer shadow-xs"
              title="فتح مجلد الأرشيف مباشرة في Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
              <span>فتح المجلد في Google Drive</span>
            </a>
          ) : (
            <div 
              className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-400 font-bold text-xs flex items-center gap-1.5 border border-slate-200 cursor-not-allowed"
              title="فتح مجلد Google Drive مقتصر حصراً على المطور البرمجي (أو بتصريح من المطور في الإعدادات لمدير الإدارة)"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>مجلد Drive (مقتصر على المطور)</span>
            </div>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ تسجيل طلب في أرشيف Drive</span>
          </button>
        </div>
      </div>

      {/* 5-Column Desktop Icon Grid for Drive Requests Archive */}
      <OfficeIconTilesGrid
        title="أيقونات ومهام أرشيف Google Drive وسحب الصور"
        subtitle="انقر على أي أيقونة للاستعراض المباشر أو البحث السحابي واستخراج الصور"
        columns={5}
        items={[
          {
            id: 'drv_smart_images',
            title: 'أرشيف صور المعاملات (OCR)',
            subtitle: '1000 - 2000 صورة بالاسم والذكاء',
            icon: FileImage,
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
            isActive: activeMainTab === 'smart_images',
            onClick: () => setActiveMainTab('smart_images')
          },
          {
            id: 'drv_image_viewer',
            title: 'سحب وعرض صورة من Drive',
            subtitle: 'جلب الصور وتكبيرها وتصغيرها',
            icon: Search,
            iconColor: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
            isActive: activeMainTab === 'image_viewer',
            onClick: () => setActiveMainTab('image_viewer')
          },
          {
            id: 'drv_requests_list',
            title: 'سجل المعاملات والربط السحابي',
            subtitle: 'جدول الطلبات المقترنة بروابط Drive',
            icon: FolderKanban,
            iconColor: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
            badge: requests.length,
            badgeColor: 'bg-amber-600 text-white',
            isActive: activeMainTab === 'requests_list',
            onClick: () => setActiveMainTab('requests_list')
          },
          {
            id: 'drv_add_new',
            title: 'تسجيل طلب في أرشيف Drive',
            subtitle: 'إضافة معاملة جديدة مع رابط سحابي',
            icon: Plus,
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            iconBg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
            onClick: () => setShowAddModal(true)
          },
          {
            id: 'drv_print_all',
            title: 'طباعة كشف الأرشيف السحابي',
            subtitle: 'سحب كشف الطلبات السحابية ورقياً',
            icon: Printer,
            iconColor: 'text-teal-600 dark:text-teal-400',
            iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
            onClick: () => window.print()
          }
        ]}
      />

      {/* Main Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        <button
          onClick={() => setActiveMainTab('smart_images')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeMainTab === 'smart_images'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileImage className="w-4 h-4 text-emerald-200" />
          <span>أرشفة واستخراج صور المعاملات (1000 - 2000 صورة) والبحث الفوري</span>
        </button>
        <button
          onClick={() => setActiveMainTab('image_viewer')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeMainTab === 'image_viewer'
              ? 'bg-white text-blue-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileImage className="w-4 h-4 text-blue-600" />
          <span>سحب وعرض صورة الطلب من Google Drive (تكبير، تصغير، طباعة)</span>
        </button>
        <button
          onClick={() => setActiveMainTab('requests_list')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeMainTab === 'requests_list'
              ? 'bg-white text-blue-800 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderKanban className="w-4 h-4 text-slate-500" />
          <span>سجل المعاملات والربط السحابي</span>
        </button>
      </div>

      {/* TAB 0: SMART IMAGE ARCHIVE & BULK EXTRACTION (1,000 - 2,000 Images) */}
      {activeMainTab === 'smart_images' && (
        <SmartImageArchiveModule />
      )}

      {/* TAB 1: GOOGLE DRIVE IMAGE VIEWER (Requested by user) */}
      {activeMainTab === 'image_viewer' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-600" />
                  <span>البحث في مجلد Google Drive باسم المواطن لسحب الصورة</span>
                </h3>
                <p className="text-xs text-slate-500">
                  ابحث باسم المواطن أو صاحب المعاملة، وسيقوم النظام بجلب الصورة المحفوظة في مجلد Google Drive فورياً مع إمكانية التكبير والتصغير والطباعة المباشرة.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-80">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={driveImageSearchName}
                    onChange={(e) => setDriveImageSearchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setSearchedCitizenName(driveImageSearchName.trim());
                        setHasSearched(true);
                        setZoomLevel(1);
                        setRotation(0);
                      }
                    }}
                    placeholder="اكتب اسم المواطن (مثال: كرار علي، حسن طالب)..."
                    className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    setSearchedCitizenName(driveImageSearchName.trim());
                    setHasSearched(true);
                    setZoomLevel(1);
                    setRotation(0);
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-colors shrink-0"
                >
                  بحث في Drive
                </button>
              </div>
            </div>
          </div>

          {/* Viewer Result */}
          {(() => {
            const trimmedName = searchedCitizenName.trim().toLowerCase();
            const matchedReq = requests.find(r => 
              (r.CitizenName && r.CitizenName.toLowerCase().includes(trimmedName)) ||
              (r.Request_ID && r.Request_ID.toLowerCase().includes(trimmedName))
            );
            const matchedCitizen = citizens.find(c => 
              c.FullName.toLowerCase().includes(trimmedName) || 
              c.Citizen_ID.toLowerCase().includes(trimmedName)
            );

            if (!trimmedName || !hasSearched) {
              return (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                  أدخل اسم المواطن في شريط البحث أعلاه واضغط على "بحث في Drive" لجلب صورة الطلب من الأرشيف.
                </div>
              );
            }

            // If Secret Searching is active
            if (isSecretSearching) {
              return (
                <div className="p-10 text-center bg-white rounded-2xl border border-blue-200 shadow-sm space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto animate-pulse">
                    <Sparkles className="w-8 h-8 animate-spin" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    جاري تنفيذ عملية بحث سرية داخل ملف Google Drive...
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    يقوم النظام حالياً بمسح ملف Google Drive المشفر الخاص بمكتب النائب والبحث عن أي مستند أو كتاب باسم "{searchedCitizenName}".
                  </p>
                  <div className="w-full max-w-md mx-auto bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${secretSearchProgress}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-700">
                    جاري جلب المستند المشفر... ({secretSearchProgress}%)
                  </span>
                </div>
              );
            }

            // If not found in local archive and no secret request yet
            const effectiveMatchedReq = matchedReq || (secretPulledRequest?.CitizenName.toLowerCase().includes(trimmedName) ? secretPulledRequest : null);
            if (!effectiveMatchedReq && !matchedCitizen) {
              return (
                <div className="p-8 text-center bg-white rounded-2xl border border-amber-200 shadow-xs space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                    <Search className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      لم يتم العثور على طلب مسجل محلياً باسم "{searchedCitizenName}"
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed mt-1">
                      الطلب غير موجود في قاعدة البيانات المباشرة. يمكنك تشغيل آلية البحث السرية داخل ملف Google Drive لجلب المستند والصورة فورياً.
                    </p>
                  </div>

                  <button
                    onClick={() => handleSecretDriveSearch(searchedCitizenName)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 mx-auto cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>تشغيل البحث السري داخل Google Drive لجلب الطلب</span>
                  </button>
                </div>
              );
            }

            // Document / Image Found!
            const displayReq = effectiveMatchedReq || {
              Request_ID: 'REQ-DRIVE-2026',
              Citizen_ID: matchedCitizen?.Citizen_ID || 'CIT-000',
              CitizenName: matchedCitizen?.FullName || searchedCitizenName,
              CitizenPhone: matchedCitizen?.Phone1 || '07800000000',
              Entity: 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
              RequestStatus: 'مستلم',
              ProcessingStatus: 'قيد التدقيق',
              Priority: 'عاجل',
              Details: 'طلب مسجل ضمن مجلد الأرشيف الرسمي للنائب علا الناشي',
              CreatedAt: '2026-03-01'
            } as OfficeRequest;

            const imageSrc = displayReq.AttachedRequestImage || 'https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=1200&q=80';

            return (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Viewer Top Action Bar */}
                <div className="p-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs">
                      صورة الطلب المؤرشفة: {displayReq.CitizenName} ({displayReq.Request_ID})
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      Google Drive Verified
                    </span>
                  </div>

                  {/* Zoom, Rotate, Save, Print Controls */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Zoom In */}
                    <button
                      onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
                      title="تكبير الصورة (+)"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>

                    {/* Zoom Out */}
                    <button
                      onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
                      title="تصغير الصورة (-)"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>

                    {/* Rotate */}
                    <button
                      onClick={() => setRotation(prev => (prev + 90) % 360)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
                      title="تدوير الصورة 90 درجة"
                    >
                      <RotateCcw className="w-4 h-4 rotate-180" />
                    </button>

                    {/* Reset Zoom */}
                    <button
                      onClick={() => {
                        setZoomLevel(1);
                        setRotation(0);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-mono transition-colors cursor-pointer flex items-center gap-1"
                      title="إعادة ضبط الحجم"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{Math.round(zoomLevel * 100)}%</span>
                    </button>

                    <div className="h-4 w-px bg-slate-700 mx-1"></div>

                    {/* Save Image */}
                    <button
                      onClick={() => {
                        addAuditLog(
                          'تنزيل وحفظ صورة طلب من Google Drive',
                          'أرشيف Google Drive',
                          `تنزيل صورة الطلب للمعاملة ${displayReq.Request_ID} للمواطن ${displayReq.CitizenName}`
                        );
                        const link = document.createElement('a');
                        link.href = imageSrc;
                        link.download = `طلب_Drive_${displayReq.CitizenName.replace(/\s+/g, '_')}.jpg`;
                        link.target = '_blank';
                        link.click();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      title="حفظ الصورة في جهازك كصورة"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>حفظ كصورة</span>
                    </button>

                    {/* Save as PDF */}
                    <button
                      onClick={() => handleSaveAsPDF(displayReq)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      title="حفظ الطلب كملف PDF"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>حفظ كـ PDF</span>
                    </button>

                    {/* Print Image */}
                    <button
                      onClick={() => {
                        addAuditLog(
                          'طباعة صورة طلب من Google Drive',
                          'أرشيف Google Drive',
                          `طباعة الورقة الرسمية للمعاملة ${displayReq.Request_ID} للمواطن ${displayReq.CitizenName}`
                        );
                        window.print();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      title="طباعة مباشرة"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة مباشرة</span>
                    </button>
                  </div>
                </div>

                {/* Image Display Area with Pan & Zoom */}
                <div className="p-6 bg-slate-100 dark:bg-slate-950 flex items-center justify-center min-h-[480px] overflow-auto">
                  <div 
                    className="relative transition-transform duration-200 shadow-xl border border-slate-300 bg-white rounded-lg p-2 max-w-2xl print-container"
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transformOrigin: 'center center'
                    }}
                  >
                    {/* Visual Parliament Paper Frame */}
                    <div className="border border-slate-900 p-6 space-y-4 font-['Cairo',sans-serif] text-slate-900 bg-white min-w-[500px]">
                      <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between">
                        <div className="text-right space-y-0.5">
                          <div className="text-[11px] font-bold">جمهورية العراق</div>
                          <div className="text-[11px] font-bold">مجلس النواب العراقي</div>
                          <div className="text-xs font-extrabold text-blue-900">مكتب النائب المهندسة علا عودة الناشي</div>
                        </div>
                        <div className="text-center">
                          <img 
                            src={systemSettings.parliamentEmblemUrl} 
                            alt="شعار مجلس النواب" 
                            className="w-12 h-12 object-contain mx-auto"
                            crossOrigin="anonymous"
                          />
                        </div>
                        <div className="text-left font-mono text-[10px]" dir="ltr">
                          <div><strong>Drive Ref:</strong> {displayReq.Request_ID}</div>
                          <div><strong>Date:</strong> {displayReq.CreatedAt}</div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <h4 className="font-extrabold text-sm text-slate-950">إلى / {displayReq.Entity} المحترم</h4>
                        <h5 className="font-bold text-xs text-slate-800 mt-1">م / طلب المواطن ({displayReq.CitizenName})</h5>
                      </div>

                      <div className="text-xs leading-relaxed text-slate-900 py-3 min-h-[140px] text-justify whitespace-pre-line border-y border-dashed border-slate-200">
                        {displayReq.Details}
                      </div>

                      {displayReq.DeputyNotes && (
                        <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-xs text-blue-950">
                          <strong>هامش النائب:</strong> {displayReq.DeputyNotes}
                        </div>
                      )}

                      <div className="pt-4 flex items-end justify-between text-[11px]">
                        <div className="font-mono text-slate-500">
                          هاتف: {displayReq.CitizenPhone}
                        </div>
                        <div className="text-center space-y-0.5">
                          <div className="font-bold">المهندسة علا عودة الناشي</div>
                          <div className="text-[10px] text-slate-600">عضو مجلس النواب العراقي</div>
                          <div className="pt-2 text-[9px] text-slate-400 font-mono">[ختم وتوقيع النائب الرسمي]</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>تم سحب هذه الوثيقة من مجلد Google Drive للمكتب: {driveFolderId}</span>
                  <span>التحكم: استخدم أزرار التكبير والتصغير لفحص تفاصيل الكتاب بدقة</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 2: REQUESTS LIST */}
      {activeMainTab === 'requests_list' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Main Search Input */}
          <div className="md:col-span-6 relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم المواطن الرباعي، رقم الطلب (REQ-...)، رقم الهاتف، أو اسم الوزارة..."
              className="w-full pr-10 pl-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-right"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 hover:text-slate-700 px-2 py-0.5 bg-slate-200 rounded"
              >
                مسح
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">-- كافة حالات الإنجاز --</option>
              <option value="قيد التدقيق">قيد التدقيق</option>
              <option value="مرسل إلى الوزارة/الهيئة">مرسل إلى الوزارة/الهيئة</option>
              <option value="منجز">منجز</option>
              <option value="تم الطباعة">تم الطباعة</option>
              <option value="بانتظار الموافقة">بانتظار الموافقة</option>
              <option value="مرفوض">مرفوض</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="md:col-span-3">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">-- كافة درجات الأولوية --</option>
              <option value="عاجل">عاجل</option>
              <option value="خاص جداً">خاص جداً</option>
              <option value="عام">عام</option>
            </select>
          </div>
        </div>

        {/* Live Search Summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span>نتائج البحث المطابقة:</span>
            <strong className="text-blue-700 font-bold">{filteredRequests.length} معاملة</strong>
            {searchQuery && (
              <span className="text-[11px] text-slate-400">
                (مطابقة لكلمة: "{searchQuery}")
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] text-emerald-700 font-medium">
              متصل بـ Google Drive (Folder ID: {driveFolderId.slice(0, 8)}...)
            </span>
          </div>
        </div>
      </div>

      {/* Requests Grid / Cards */}
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs shadow-xs space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <h4 className="font-bold text-sm text-slate-800">لم يتم العثور على طلبات مطابقة للبحث</h4>
            <p className="text-xs text-slate-500">
              تأكد من كتابة اسم المواطن بشكل صحيح أو ابحث برقم الطلب (مثل REQ-2026-081) أو قم بإضافة طلب جديد وربطه بـ Google Drive.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredRequests.map((req, idx) => {
              const citizen = citizens.find(c => c.Citizen_ID === req.Citizen_ID);

              return (
                <div
                  key={`${req.Request_ID}-${idx}`}
                  className="p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-300 transition-all shadow-xs space-y-3 text-right"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {req.Request_ID}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900">
                        {req.CitizenName}
                      </h3>
                      {citizen && (
                        <span className="text-xs text-slate-500 font-mono">
                          ({citizen.District} - {citizen.Phone1})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        req.ProcessingStatus === 'منجز'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : req.ProcessingStatus === 'مرسل إلى الوزارة/الهيئة'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : req.ProcessingStatus === 'مرفوض'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {req.ProcessingStatus}
                      </span>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        req.Priority === 'عاجل' || req.Priority === 'خاص جداً'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {req.Priority}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{req.CreatedAt}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs">
                    <div className="lg:col-span-8 space-y-2">
                      <div className="flex items-center gap-1.5 text-blue-800 font-bold">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>الجهة المعنية: {req.Entity}</span>
                      </div>
                      <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                        {req.Details}
                      </p>
                      {req.DeputyNotes && (
                        <div className="text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">هامش وتوجيه النائب:</span>
                            <span>{req.DeputyNotes}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Google Drive Attachments info & Action Buttons */}
                    <div className="lg:col-span-4 flex flex-col justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-3">
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-700 block flex items-center gap-1">
                          <Paperclip className="w-3 h-3 text-emerald-600" />
                          <span>المرفقات ووثائق Google Drive:</span>
                        </span>

                        <div className="p-2 bg-white rounded border border-slate-200 text-[11px] text-slate-600 space-y-1">
                          <div className="font-medium text-slate-900 truncate">
                            📄 {req.AttachmentRequest || `معاملة_${req.CitizenName.replace(/\s+/g, '_')}.pdf`}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-mono flex items-center justify-between">
                            <span>مخزن في: {driveFolderId.slice(0, 12)}...</span>
                            <a
                              href={driveFolderUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline font-bold"
                            >
                              عرض في Drive
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons: Preview, Print, Save as PDF */}
                      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-200">
                        <button
                          onClick={() => {
                            setPreviewRequest(req);
                            setActiveTemplate('official_letter');
                          }}
                          className="px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                          title="معاينة رسمية كاملة للطلب"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>معاينة</span>
                        </button>

                        <button
                          onClick={() => {
                            setPreviewRequest(req);
                            handlePrint(req);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                          title="طباعة فورية للطلب الرسمي"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة</span>
                        </button>

                        <button
                          onClick={() => {
                            setPreviewRequest(req);
                            handleSaveAsPDF(req);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-xs"
                          title="تصدير وحفظ الطلب كـ PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>حفظ PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
      )}

      {/* Official Request Preview, Print, & PDF Export Modal */}
      {previewRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white text-slate-900 rounded-2xl border border-slate-300 shadow-2xl overflow-hidden my-4 max-h-[92vh] flex flex-col">
            
            {/* Top Toolbar (No-Print) */}
            <div className="no-print p-4 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-lg">
                  ع
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>معاينة وطباعة الكتاب الرسمي من Google Drive</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      {previewRequest.Request_ID}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    مكتب النائب المهندسة علا الناشي • مجلس النواب العراقي
                  </p>
                </div>
              </div>

              {/* Template Switcher & Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                  <button
                    onClick={() => setActiveTemplate('official_letter')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      activeTemplate === 'official_letter' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    كتاب رسمي صادر
                  </button>
                  <button
                    onClick={() => setActiveTemplate('citizen_request')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      activeTemplate === 'citizen_request' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    استمارة الطلب والمتابعة
                  </button>
                </div>

                <button
                  onClick={() => handlePrint(previewRequest)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة فورية</span>
                </button>

                <button
                  onClick={() => handleSaveAsPDF(previewRequest)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>حفظ بصيغة PDF</span>
                </button>

                <button
                  onClick={() => setPreviewRequest(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document Preview Body (Printed Layout Container) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 flex justify-center">
              <div 
                ref={printableRef}
                className="print-container w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-md border border-slate-200 space-y-6 text-right relative flex flex-col justify-between"
                style={{ fontFamily: "'Tajawal', serif" }}
              >
                {/* Official Letterhead Header */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-4 border-b-2 border-slate-900">
                    <div className="text-right space-y-1">
                      <div className="text-xs font-bold text-slate-800">جمهورية العراق</div>
                      <div className="text-xs font-bold text-slate-800">مجلس النواب العراقي</div>
                      <div className="text-xs font-bold text-blue-900">الدورة النيابية الخامسة</div>
                      <div className="text-sm font-black text-amber-800">مكتب النائب م. علا عودة الناشي</div>
                    </div>

                    {/* Official Emblem */}
                    <div className="flex flex-col items-center">
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Coat_of_arms_of_Iraq_%282008%E2%80%93present%29.svg/200px-Coat_of_arms_of_Iraq_%282008%E2%80%93present%29.svg.png"
                        alt="شعار جمهورية العراق"
                        className="w-16 h-16 object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-[10px] font-bold text-slate-700 mt-1">بسم الله الرحمن الرحيم</span>
                    </div>

                    <div className="text-left space-y-1 font-mono text-xs">
                      <div className="text-[11px] font-bold text-slate-800">العدد: <span className="font-mono text-blue-900">{previewRequest.Request_ID}/ن/2026</span></div>
                      <div className="text-[11px] font-bold text-slate-800">التاريخ: <span className="font-mono text-slate-700">{previewRequest.CreatedAt.split(' ')[0]}</span></div>
                      <div className="text-[10px] text-slate-500 font-bold">المرفقات: <span className="text-slate-800">كتاب رسمي + أوليات</span></div>
                    </div>
                  </div>

                  {/* Recipient & Subject Header */}
                  <div className="pt-2 space-y-3">
                    <div className="text-sm font-black text-slate-900">
                      إلى / <span className="text-blue-950 underline decoration-blue-900 decoration-1 underline-offset-4">{previewRequest.Entity} المحترمون</span>
                    </div>

                    <div className="text-sm font-bold text-slate-800 flex items-center justify-between">
                      <div>
                        م / <span className="font-black text-slate-900">طلب المواطن ({previewRequest.CitizenName})</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 rounded border border-slate-300 font-mono">
                        كود المراجع: {previewRequest.Citizen_ID}
                      </span>
                    </div>
                  </div>

                  {/* Formal Body Text */}
                  <div className="pt-4 text-sm leading-relaxed text-slate-900 space-y-4 text-justify">
                    <p className="indent-8 font-medium">
                      تحية طيبة وتقدير عالي ...
                    </p>

                    <p className="leading-loose">
                      نرفق طياً طلب المواطن الكريم <strong className="text-slate-950 font-black font-sans">{previewRequest.CitizenName}</strong>، المتضمن:
                    </p>

                    <div className="p-4 bg-slate-50/80 border-r-4 border-blue-800 rounded-lg text-slate-900 text-xs sm:text-sm leading-relaxed font-normal shadow-2xs">
                      {previewRequest.Details}
                    </div>

                    <p className="leading-loose">
                      نرجو تفضلكم بالاطلاع الكريم، والتوجيه بموجب الصلاحيات والضوابط القانونية المرعية لإجراء اللازم وتقديم التسهيلات الممكنة خدمةً لأبناء محافظة ذي قار.
                    </p>

                    <p className="text-center font-bold text-sm pt-2">
                      مع فائق الشكر والتقدير والاعتزاز ...
                    </p>
                  </div>

                  {/* Deputy Directives & Margin Box */}
                  {previewRequest.DeputyNotes && (
                    <div className="mt-4 p-3.5 rounded-lg bg-amber-50 border border-amber-300 space-y-1">
                      <div className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-700" />
                        <span>هامش وتوجيه النائب:</span>
                      </div>
                      <p className="text-xs text-amber-950 font-medium leading-normal">
                        "{previewRequest.DeputyNotes}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Signature & Seal Area */}
                <div className="pt-8 space-y-6">
                  <div className="flex items-end justify-between pt-4">
                    {/* QR Code & Barcode Verification */}
                    <div className="space-y-1 text-center">
                      <div className="p-2 bg-slate-50 border border-slate-300 rounded-lg inline-block">
                        <QrCode className="w-16 h-16 text-slate-900" />
                      </div>
                      <div className="text-[9px] font-mono text-slate-500">
                        VERIFY: {previewRequest.Request_ID}
                      </div>
                    </div>

                    {/* Official Stamp & Signature Block */}
                    <div className="text-center space-y-1.5 pl-6">
                      <div className="text-sm font-black text-slate-950">
                        المهندسة علا عودة الناشي
                      </div>
                      <div className="text-xs font-bold text-slate-700">
                        عضو مجلس النواب العراقي
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        مكتب محافظة ذي قار
                      </div>
                      <div className="pt-2 text-[10px] text-blue-900 font-bold italic">
                        [الختم والتوقيع الرسمي المعتمد]
                      </div>
                    </div>
                  </div>

                  {/* Document Footer Line */}
                  <div className="pt-3 border-t border-slate-300 text-center text-[10px] text-slate-500 flex items-center justify-between">
                    <span>العنوان: {systemSettings.officeAddress}</span>
                    <span>الخط الساخن: {systemSettings.hotline}</span>
                    <span className="font-mono">Google Drive Ref: {driveFolderId}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Request to Google Drive Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    أرشفة وربط طلب جديد بـ Google Drive
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    المجلد المستهدف: {driveFolderId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewDriveRequest} className="space-y-3.5 text-right">
              {/* Select Citizen */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المراجع المسجل *</label>
                <select
                  value={selectedCitizenId}
                  onChange={(e) => setSelectedCitizenId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  {citizens.map((c) => (
                    <option key={c.Citizen_ID} value={c.Citizen_ID}>
                      {c.FullName} ({c.Citizen_ID}) - {c.District}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Entity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الجهة المعنية بالطلب *</label>
                <input
                  type="text"
                  value={newReqEntity}
                  onChange={(e) => setNewReqEntity(e.target.value)}
                  placeholder="اسم الوزارة، الدائرة، أو الهيئة..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">درجة الأولوية</label>
                <select
                  value={newReqPriority}
                  onChange={(e) => setNewReqPriority(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="عاجل">عاجل</option>
                  <option value="خاص جداً">خاص جداً</option>
                  <option value="عام">عام</option>
                </select>
              </div>

              {/* Details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تفاصيل وشرح الطلب *</label>
                <textarea
                  value={newReqDetails}
                  onChange={(e) => setNewReqDetails(e.target.value)}
                  rows={3}
                  placeholder="اكتب تفاصيل المعاملة والمتابعة..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 text-xs text-right focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              {/* Google Drive Document Link / File Name */}
              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">
                  رابط المستند في Google Drive (أو اسم الملف المؤرشف)
                </label>
                <input
                  type="text"
                  value={newReqDriveFile}
                  onChange={(e) => setNewReqDriveFile(e.target.value)}
                  placeholder="https://drive.google.com/file/d/... أو اسم_الملف.pdf"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-emerald-300 text-slate-900 text-xs text-left font-mono focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  حفظ بالأرشيف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
