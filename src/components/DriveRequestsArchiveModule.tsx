import React, { useState, useRef, useEffect } from 'react';
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
  Upload,
  ArrowLeft,
  Trash2,
  RefreshCw,
  Loader2,
  Edit3
} from 'lucide-react';
import { SmartImageArchiveModule } from './SmartImageArchiveModule';
import { OfficeIconTilesGrid } from './OfficeIconTilesGrid';
import { LiveDriveGalleryWidget } from './LiveDriveGalleryWidget';
import { printElementIsolated } from '../utils/printReceiptHelper';

export const DriveRequestsArchiveModule: React.FC = () => {
  const { 
    requests, 
    citizens, 
    currentUser, 
    systemSettings,
    driveFolderId: contextDriveFolderId,
    setGoogleDriveFolderId,
    updateRequest, 
    addAuditLog, 
    addDocument 
  } = useApp();

  // Target Google Drive Folder ID
  const driveFolderId = contextDriveFolderId || systemSettings.googleDriveFolderId || '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc';
  const driveFolderUrl = `https://drive.google.com/drive/folders/${driveFolderId}`;

  // RBAC for opening/editing Google Drive folder
  const isDeveloper = currentUser?.Role === 'developer';
  const canOpenDriveFolder = 
    isDeveloper || 
    (Boolean(systemSettings.allowAdminOpenDriveFolder) && (currentUser?.Role === 'director' || currentUser?.Role === 'admin' || currentUser?.Role === 'admin_officer'));

  // Main Tab: default directly to Live Drive Gallery so Google Drive images & PDFs display immediately!
  const [activeMainTab, setActiveMainTab] = useState<'hub' | 'smart_images' | 'image_viewer' | 'requests_list'>('image_viewer');

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

  // Printable ref for clean isolated print
  const printableRef = useRef<HTMLDivElement>(null);
  const requestsTableRef = useRef<HTMLDivElement>(null);

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

  // Clean isolated Print function (prints ONLY the target document, never the system UI)
  const handlePrint = (req?: OfficeRequest) => {
    const targetReq = req || previewRequest;
    if (!targetReq) return;

    addAuditLog(
      'طباعة طلب ومعاملة رسمية من Google Drive',
      'أرشيف Google Drive والطباعة',
      `طباعة المعاملة ${targetReq.Request_ID} للمواطن ${targetReq.CitizenName}`
    );

    if (printableRef.current) {
      printElementIsolated(printableRef.current, { title: `معاملة رسمية - ${targetReq.CitizenName}` });
    } else {
      window.print();
    }
  };

  // Clean isolated Save / Export as PDF function
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
      if (printableRef.current) {
        printElementIsolated(printableRef.current, { title: `تصدير PDF - ${targetReq.CitizenName}` });
      } else {
        window.print();
      }
    }, 200);
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

      {/* ---------------- VIEW 1: CENTRAL ICONS HUB ---------------- */}
      {activeMainTab === 'hub' && (
        <OfficeIconTilesGrid
          title="أيقونات ومهام أرشيف الطلبات وسحب الصور السحابية"
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
              onClick: () => {
                setActiveMainTab('smart_images');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            },
            {
              id: 'drv_image_viewer',
              title: 'سحب وعرض صورة الطلب',
              subtitle: 'جلب الصور وتكبيرها وتصغيرها',
              icon: Search,
              iconColor: 'text-blue-600 dark:text-blue-400',
              iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
              onClick: () => {
                setActiveMainTab('image_viewer');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            },
            {
              id: 'drv_requests_list',
              title: 'سجل المعاملات والربط السحابي',
              subtitle: 'جدول الطلبات المقترنة بالمستندات',
              icon: FolderKanban,
              iconColor: 'text-amber-600 dark:text-amber-400',
              iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
              badge: requests.length,
              badgeColor: 'bg-amber-600 text-white',
              onClick: () => {
                setActiveMainTab('requests_list');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            },
            {
              id: 'drv_add_new',
              title: 'تسجيل طلب في الأرشيف',
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
              onClick: () => {
                setActiveMainTab('requests_list');
                setTimeout(() => {
                  if (requestsTableRef.current) {
                    printElementIsolated(requestsTableRef.current, { title: 'كشف الأرشيف السحابي للمعاملات', landscape: true });
                  }
                }, 250);
              }
            }
          ]}
        />
      )}

      {/* ---------------- VIEW 2: DEDICATED SUBVIEW HEADER WITH BACK BUTTON ---------------- */}
      {activeMainTab !== 'hub' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveMainTab('hub');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              <span>رجوع إلى شبكة أيقونات أرشيف الطلبات</span>
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

            <span className="font-black text-sm text-slate-900 dark:text-white">
              {activeMainTab === 'smart_images' && '🖼️ أرشيف صور المعاملات (1000 - 2000 صورة)'}
              {activeMainTab === 'image_viewer' && '🔍 سحب وعرض صورة الطلب (تكبير وتصغير وطباعة)'}
              {activeMainTab === 'requests_list' && '📁 سجل المعاملات والربط السحابي'}
            </span>
          </div>

          {/* Quick Sub-tab Jump Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
            <button
              onClick={() => setActiveMainTab('smart_images')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeMainTab === 'smart_images' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              أرشيف الصور
            </button>
            <button
              onClick={() => setActiveMainTab('image_viewer')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeMainTab === 'image_viewer' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              سحب وعرض صورة
            </button>
            <button
              onClick={() => setActiveMainTab('requests_list')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                activeMainTab === 'requests_list' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              سجل المعاملات ({requests.length})
            </button>
          </div>
        </div>
      )}


      {/* TAB 0: SMART IMAGE ARCHIVE & BULK EXTRACTION (1,000 - 2,000 Images) */}
      {activeMainTab === 'smart_images' && (
        <SmartImageArchiveModule />
      )}

      {/* TAB 1: LIVE GOOGLE DRIVE GALLERY + SIMULTANEOUS SYSTEM & DRIVE SEARCH */}
      {activeMainTab === 'image_viewer' && (
        <LiveDriveGalleryWidget title="أرشيف البريد والصور الحي — عرض والبحث في جميع صور وملفات PDF في Google Drive والنظام" />
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
      <div ref={requestsTableRef} className="space-y-3">
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
                        src={systemSettings.parliamentEmblemUrl || '/iraq-emblem.svg'}
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
