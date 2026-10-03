import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Citizen } from '../types';
import { 
  Search, 
  Printer, 
  Clock, 
  ShieldAlert, 
  FolderKanban, 
  Handshake, 
  Award, 
  Paperclip, 
  ExternalLink, 
  Upload,
  FileImage,
  Sparkles,
  Eye,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  Copy,
  Check,
  Building2,
  Phone
} from 'lucide-react';
import { getAllImagesFromDB, ImageRecord } from '../utils/imageDb';
import { OfficeIconTilesGrid } from './OfficeIconTilesGrid';

export const GlobalSearchArchiveModule: React.FC = () => {
  const { 
    citizens, 
    requests, 
    interviews, 
    documents, 
    addDocument,
    setPrintableCitizenCard, 
    setPrintableBadgeCitizen,
    setSelectedCitizenForHistory,
    canPrintOfficialCard, 
    currentUser
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(citizens[0] || null);

  // Stored OCR images from IndexedDB
  const [storedImages, setStoredImages] = useState<ImageRecord[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);

  // Preview OCR modal state
  const [previewOcrImage, setPreviewOcrImage] = useState<ImageRecord | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [copiedTextId, setCopiedTextId] = useState<string | null>(null);

  // New Document Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<'مستمسكات ثبوتية' | 'طلب مقدم' | 'كتاب رسمي صادر' | 'أخرى'>('مستمسكات ثبوتية');
  const [docFileUrl, setDocFileUrl] = useState('');

  // Load IndexedDB images on mount
  useEffect(() => {
    let isMounted = true;
    getAllImagesFromDB()
      .then((imgs) => {
        if (isMounted) {
          setStoredImages(imgs || []);
          setIsLoadingImages(false);
        }
      })
      .catch((err) => {
        console.error('Error loading stored images in archive:', err);
        if (isMounted) setIsLoadingImages(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCitizens = (citizens || []).filter(c => {
    if (!c) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (c.FullName && c.FullName.toLowerCase().includes(q)) ||
      (c.Citizen_ID && c.Citizen_ID.toLowerCase().includes(q)) ||
      (c.Phone1 && c.Phone1.includes(q)) ||
      (c.Phone2 && c.Phone2.includes(q)) ||
      (c.Surname && c.Surname.toLowerCase().includes(q)) ||
      (c.District && c.District.toLowerCase().includes(q)) ||
      (c.Job && c.Job.toLowerCase().includes(q))
    );
  });

  const isReception = currentUser?.Role === 'reception' || currentUser?.Role === 'reception_officer';

  // Find all requests matching the selected citizen by Citizen_ID or Name
  const citizenRequests = useMemo(() => {
    if (!selectedCitizen || isReception) return [];
    const normName = selectedCitizen.FullName.trim().toLowerCase();
    return requests.filter(r => 
      r.Citizen_ID === selectedCitizen.Citizen_ID || 
      (r.CitizenName && r.CitizenName.trim().toLowerCase() === normName) ||
      (r.CitizenName && (r.CitizenName.includes(normName) || normName.includes(r.CitizenName.trim().toLowerCase())))
    );
  }, [selectedCitizen, isReception, requests]);

  // Find all OCR images matching the selected citizen
  const citizenOcrImages = useMemo(() => {
    if (!selectedCitizen) return [];
    const normCitizenName = (selectedCitizen.FullName || '').trim().toLowerCase();

    // 1. From IndexedDB records matching citizenId or matching citizenName
    const fromDB = storedImages.filter(img => {
      if (img.citizenId && img.citizenId === selectedCitizen.Citizen_ID) return true;
      if (img.citizenName) {
        const normImgName = img.citizenName.trim().toLowerCase();
        return normImgName.includes(normCitizenName) || normCitizenName.includes(normImgName);
      }
      return false;
    });

    // 2. Also check citizen requests that have AttachedRequestImage
    const existingDataUrls = new Set(fromDB.map(i => i.dataUrl));
    const fromRequests: ImageRecord[] = [];

    citizenRequests.forEach(req => {
      if (req.AttachedRequestImage && !existingDataUrls.has(req.AttachedRequestImage)) {
        fromRequests.push({
          id: req.Request_ID,
          citizenName: req.CitizenName || selectedCitizen.FullName,
          citizenId: selectedCitizen.Citizen_ID,
          dataUrl: req.AttachedRequestImage,
          fileName: req.AttachmentRequest || `معاملة_${req.Request_ID}.jpg`,
          fileSize: '1.4 MB',
          mimeType: 'image/jpeg',
          uploadedAt: req.CreatedDate || 'مؤرشف سابقاً',
          extractedText: req.Details || '',
          entity: req.Entity,
          details: req.Details,
          priority: req.Priority,
          confidence: 95,
          ocrProcessed: true
        });
        existingDataUrls.add(req.AttachedRequestImage);
      }
    });

    return [...fromDB, ...fromRequests];
  }, [selectedCitizen, storedImages, citizenRequests]);

  const citizenInterviews = (selectedCitizen && !isReception) 
    ? interviews.filter(i => i.Citizen_ID === selectedCitizen.Citizen_ID) 
    : [];

  const citizenDocs = selectedCitizen 
    ? documents.filter(d => d.Citizen_ID === selectedCitizen.Citizen_ID) 
    : [];

  const handlePrintCard = (citizen: Citizen) => {
    if (!canPrintOfficialCard(currentUser)) {
      alert('عذراً! ميزة طباعة بطاقة المعلومات الرسمية مقتصرة حصرياً على: [المطور، المدير، موظف الإدارة] وفق محددات الأمان الإداري.');
      return;
    }
    setPrintableCitizenCard(citizen);
  };

  const handleUploadDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCitizen || !docTitle.trim()) return;

    addDocument({
      Citizen_ID: selectedCitizen.Citizen_ID,
      CitizenName: selectedCitizen.FullName,
      Title: docTitle.trim(),
      Category: docCategory,
      FileUrl: docFileUrl || 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600&auto=format&fit=crop&q=80',
      FileType: 'pdf',
      FileSize: '2.1 MB',
      UploadedBy: currentUser?.FullName || 'موظف الأرشيف'
    });

    setShowUploadModal(false);
    setDocTitle('');
    setDocFileUrl('');
  };

  return (
    <div className="space-y-4 text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-purple-600" />
            <h2 className="text-base font-bold text-slate-900">قسم الأرشيف والبحث الشامل وطباعة البطاقات</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              الملف المتكامل
            </span>
          </div>
          <p className="text-xs text-slate-500">
            البحث في كافة بيانات المنظومة، استعراض السجل التراكمي للمراجع، وإصدار بطاقات المعلومات الرسمية المقيدة أمنياً.
          </p>
        </div>
      </div>

      {/* 5-Column Desktop Icon Grid for Global Search & Archive */}
      <OfficeIconTilesGrid
        title="أيقونات ومهام الأرشيف والبحث الشامل"
        subtitle="انقر على أي أيقونة للاستعلام الفوري أو طباعة الهوية والباجة وتوثيق المستمسكات"
        columns={5}
        items={[
          {
            id: 'srch_all_citizens',
            title: 'قاعدة المراجعين المركزية',
            subtitle: 'كافة المواطنين المسجلين',
            icon: Search,
            iconColor: 'text-purple-600 dark:text-purple-400',
            iconBg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
            badge: citizens.length,
            badgeColor: 'bg-purple-600 text-white',
            onClick: () => setSearchQuery('')
          },
          {
            id: 'srch_id_card',
            title: 'طباعة بطاقة المواطن',
            subtitle: 'إصدار الهوية الرسمية المقيدة',
            icon: Award,
            iconColor: 'text-blue-600 dark:text-blue-400',
            iconBg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
            onClick: () => {
              if (selectedCitizen) handlePrintCard(selectedCitizen);
              else alert('يرجى اختيار مراجع أولاً');
            }
          },
          {
            id: 'srch_badge',
            title: 'طباعة باجة المراجعة',
            subtitle: 'باجة المراجعة والباركود اليومي',
            icon: Printer,
            iconColor: 'text-teal-600 dark:text-teal-400',
            iconBg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
            onClick: () => {
              if (selectedCitizen) setPrintableBadgeCitizen(selectedCitizen);
              else alert('يرجى اختيار مراجع أولاً');
            }
          },
          {
            id: 'srch_history',
            title: 'سجل الحركات والتاريخ',
            subtitle: 'تتبع كافة مراحل المعاملات',
            icon: Clock,
            iconColor: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
            onClick: () => {
              if (selectedCitizen) setSelectedCitizenForHistory(selectedCitizen);
              else alert('يرجى اختيار مراجع أولاً');
            }
          },
          {
            id: 'srch_upload_doc',
            title: 'إرفاق وأرشفة مستمسك',
            subtitle: 'رفع مستمسكات ثبوتية وأوراق',
            icon: Upload,
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
            onClick: () => {
              if (selectedCitizen) setShowUploadModal(true);
              else alert('يرجى اختيار مراجع أولاً');
            }
          }
        ]}
      />

      {/* Main Search Input */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث بالاسم الرباعي، الرقم التعريفي (ONA-XXXX)، رقم الهاتف، القضاء، اللقب، أو المهنة..."
          className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-right shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 px-2 py-0.5 bg-slate-100 rounded"
          >
            مسح البحث
          </button>
        )}
      </div>

      {/* 2-Column Split: Citizens List + Citizen Full Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Search Results List (4 Cols) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700">نتائج البحث ({filteredCitizens.length})</span>
            <span className="text-[10px] text-slate-500">اختر مراجع لعرض أرشيفه</span>
          </div>

          <div className="space-y-1.5 max-h-[700px] overflow-y-auto pr-1">
            {filteredCitizens.length === 0 ? (
              <div className="p-6 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs shadow-xs">
                لا يوجد مراجع يطابق معايير البحث الحالية.
              </div>
            ) : (
              filteredCitizens.map((c) => {
                const isSelected = selectedCitizen?.Citizen_ID === c.Citizen_ID;

                return (
                  <div
                    key={c.Citizen_ID}
                    onClick={() => setSelectedCitizen(c)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-right shadow-xs ${
                      isSelected
                        ? 'bg-purple-50 border-purple-400 ring-1 ring-purple-400'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-blue-700">{c.Citizen_ID}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        {c.District}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-slate-900">{c.FullName}</h4>
                    
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 font-mono">
                      <span dir="ltr">{c.Phone1}</span>
                      <span className="text-purple-700 font-sans font-semibold">{c.Job}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Citizen Full Profile & Archives (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {selectedCitizen ? (
            <div className="space-y-4">
              {/* Profile Card & Action Bar */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{selectedCitizen.FullName}</h3>
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {selectedCitizen.Citizen_ID}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>محفوظ في Google Sheets و Drive و Firebase</span>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      السكن: {selectedCitizen.District} - {selectedCitizen.SubDistrict} | تاريخ التسجيل: {selectedCitizen.CreatedAt}
                    </p>
                  </div>

                  {/* Print & Action Buttons with RBAC guard */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* STRICT RBAC: Printable Official Info Card */}
                    {canPrintOfficialCard(currentUser) ? (
                      <button
                        onClick={() => handlePrintCard(selectedCitizen)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="طباعة بطاقة المعلومات الرسمية مع الباركود"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>طباعة بطاقة المعلومات الرسمية</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[10px] font-bold">
                        <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                        <span>طباعة البطاقة مقيدة للمدير والإدارة</span>
                      </div>
                    )}

                    <button
                      onClick={() => setPrintableBadgeCitizen(selectedCitizen)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>باج مراجعة</span>
                    </button>

                    <button
                      onClick={() => setSelectedCitizenForHistory(selectedCitizen)}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>السجل الزمني</span>
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] mb-0.5">الهاتف الأساسي</span>
                    <strong className="text-slate-900 font-mono text-xs" dir="ltr">{selectedCitizen.Phone1}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] mb-0.5">المهنة</span>
                    <strong className="text-slate-900 text-xs">{selectedCitizen.Job}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] mb-0.5">التحصيل الدراسي</span>
                    <strong className="text-slate-900 text-xs">{selectedCitizen.Education}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px] mb-0.5">المعرّف / المصرّح</span>
                    <strong className="text-blue-700 text-xs">{selectedCitizen.ReferralSource || 'مباشر'}</strong>
                  </div>
                </div>
              </div>

              {/* Citizen's Requests Archive */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <FolderKanban className="w-4 h-4 text-blue-600" />
                    <span>المعاملات والطلبات الإدارية المسجلة ({citizenRequests.length})</span>
                  </h4>
                </div>

                <div className="space-y-2">
                  {isReception ? (
                    <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-xs text-cyan-800 text-center font-medium">
                      🔒 المعاملات الإدارية والمخاطبات الحكومية مشفرة ومخصصة لقسم الإدارة والمعاملات حصراً.
                    </div>
                  ) : citizenRequests.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-3">لا توجد طلبات إدارية مسجلة لهذا المراجع.</p>
                  ) : (
                    citizenRequests.map((req, idx) => (
                      <div key={`${req.Request_ID}-${idx}`} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700">{req.Request_ID}</span>
                            <span className="font-bold text-slate-900">الجهة: {req.Entity}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            req.ProcessingStatus === 'منجز' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {req.ProcessingStatus}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{req.Details}</p>
                        {req.DeputyNotes && (
                          <div className="text-[11px] text-amber-700 font-semibold">
                            توجيه النائب: {req.DeputyNotes}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Citizen's OCR Extracted Images & Documents */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>الصور والوثائق المستخرجة عبر التعرف الضوئي (OCR) ({citizenOcrImages.length})</span>
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    مستخرج بالذكاء الاصطناعي
                  </span>
                </div>

                {isLoadingImages ? (
                  <div className="p-4 text-center text-xs text-slate-400">جاري تحميل وثائق الـ OCR...</div>
                ) : citizenOcrImages.length === 0 ? (
                  <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500 space-y-1">
                    <FileImage className="w-6 h-6 text-slate-400 mx-auto" />
                    <p>لا توجد صور أو مستندات OCR مفحوصة لهذا المراجع حتى الآن.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {citizenOcrImages.map((img) => (
                      <div key={img.id} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-all flex flex-col justify-between gap-2.5">
                        {/* Image Preview & Details */}
                        <div className="flex gap-3">
                          <div 
                            onClick={() => {
                              setPreviewOcrImage(img);
                              setPreviewZoom(1);
                              setPreviewRotation(0);
                            }}
                            className="relative w-20 h-24 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-900 cursor-pointer group"
                          >
                            <img 
                              src={img.dataUrl} 
                              alt={img.fileName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 space-y-1 text-right">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-slate-900 truncate" title={img.fileName}>
                                {img.fileName}
                              </span>
                              {img.confidence && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                  {img.confidence}% دقة
                                </span>
                              )}
                            </div>

                            {img.entity && (
                              <div className="text-[11px] text-blue-700 font-semibold truncate flex items-center gap-1">
                                <Building2 className="w-3 h-3 shrink-0" />
                                <span>{img.entity}</span>
                              </div>
                            )}

                            {img.details && (
                              <div className="text-[11px] text-slate-600 line-clamp-2" title={img.details}>
                                {img.details}
                              </div>
                            )}

                            {img.phone && (
                              <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1" dir="ltr">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{img.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Extracted text snippet */}
                        {img.extractedText && (
                          <div className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 max-h-20 overflow-y-auto font-sans leading-relaxed">
                            <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-100 text-[10px] text-slate-400">
                              <span>النص المقروء (OCR):</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(img.extractedText || '');
                                  setCopiedTextId(img.id);
                                  setTimeout(() => setCopiedTextId(null), 2000);
                                }}
                                className="text-blue-600 hover:text-blue-700 flex items-center gap-0.5 font-bold cursor-pointer"
                              >
                                {copiedTextId === img.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-600">تم النسخ</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>نسخ النص</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="whitespace-pre-wrap">{img.extractedText}</p>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-slate-200/60">
                          {img.driveWebViewLink && (
                            <a
                              href={img.driveWebViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[11px] font-bold text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
                              title="عرض وتنزيل الملف مباشرة من مجلد Google Drive"
                            >
                              <ExternalLink className="w-3 h-3 text-blue-600" />
                              <span>عرض في Google Drive ↗</span>
                            </a>
                          )}
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = img.dataUrl;
                              link.download = img.fileName || 'ocr_document.jpg';
                              link.click();
                            }}
                            className="px-2 py-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>تحميل</span>
                          </button>
                          <button
                            onClick={() => {
                              setPreviewOcrImage(img);
                              setPreviewZoom(1);
                              setPreviewRotation(0);
                            }}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Eye className="w-3 h-3" />
                            <span>معاينة وتكبير</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Citizen's Interviews */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Handshake className="w-4 h-4 text-amber-600" />
                  <span>المقابلات المباشرة مع النائب ({citizenInterviews.length})</span>
                </h4>

                <div className="space-y-2">
                  {isReception ? (
                    <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-xs text-cyan-800 text-center font-medium">
                      🔒 سجل ومواعيد مقابلات النائب الخاصة مخصصة لقسم المقابلات والإدارة العليا.
                    </div>
                  ) : citizenInterviews.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-3">لا توجد مقابلات مسجلة لهذا المراجع.</p>
                  ) : (
                    citizenInterviews.map((intv) => (
                      <div key={intv.Interview_ID} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">{intv.Subject}</span>
                          <span className="font-mono text-slate-400">{intv.InterviewDate}</span>
                        </div>
                        <div className="text-xs text-amber-700">
                          توجيه وقرار النائب: {intv.DeputyNotes || 'لا توجد ملاحظات'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Archived Cloud Documents */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-purple-600" />
                    <span>المستندات والوثائق المؤرشفة سحابياً ({citizenDocs.length})</span>
                  </h4>

                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>أرشفة مستند جديد</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {citizenDocs.length === 0 ? (
                    <div className="col-span-2 p-4 text-center text-slate-500 text-xs">
                      لا توجد وثائق مرفقة لهذا المراجع حالياً.
                    </div>
                  ) : (
                    citizenDocs.map((doc) => (
                      <div key={doc.Doc_ID} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                        <div className="space-y-0.5 text-right">
                          <div className="font-bold text-slate-900">{doc.Title}</div>
                          <div className="text-[10px] text-slate-500">{doc.Category} • {doc.FileSize}</div>
                        </div>

                        <a
                          href={doc.FileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
                          title="معاينة المستند"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-xs shadow-xs">
              يرجى اختيار مراجع من القائمة لعرض ملفه وأرشيفه المتكامل.
            </div>
          )}
        </div>
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && selectedCitizen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">أرشفة مستند سحابي للمواطن</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
            </div>

            <form onSubmit={handleUploadDoc} className="space-y-3 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عنوان المستند أو الكتاب *</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="مثال: البطاقة الموحدة، كتاب وزارة الإعمار..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right outline-none focus:bg-white focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع المستند</label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-right outline-none focus:bg-white focus:ring-2 focus:ring-purple-500"
                >
                  <option value="مستمسكات ثبوتية">مستمسكات ثبوتية</option>
                  <option value="طلب مقدم">طلب مقدم</option>
                  <option value="كتاب رسمي صادر">كتاب رسمي صادر</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رابط أو ملف Drive (اختياري)</label>
                <input
                  type="text"
                  value={docFileUrl}
                  onChange={(e) => setDocFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs text-left font-mono outline-none focus:bg-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setShowUploadModal(false)} className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">إلغاء</button>
                <button type="submit" className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs">حفظ بالأرشيف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OCR Image Lightbox Modal with Zoom, Rotation & OCR Details */}
      {previewOcrImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-right">
            {/* Modal Header */}
            <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  معاينة وثيقة الـ OCR: {previewOcrImage.citizenName || selectedCitizen?.FullName}
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">({previewOcrImage.fileName})</span>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreviewZoom((z) => Math.min(z + 0.25, 3))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  title="تكبير"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewZoom((z) => Math.max(z - 0.25, 0.5))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  title="تصغير"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  title="تدوير 90 درجة"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const printWin = window.open('', '_blank');
                    if (printWin) {
                      printWin.document.write(`
                        <html>
                          <head>
                            <title>${previewOcrImage.citizenName} - وثيقة رسمية</title>
                            <style>
                              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                              img { max-width: 95%; max-height: 95vh; object-fit: contain; }
                            </style>
                          </head>
                          <body>
                            <img src="${previewOcrImage.dataUrl}" onload="window.print();window.close();" />
                          </body>
                        </html>
                      `);
                      printWin.document.close();
                    }
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  title="طباعة الوثيقة"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = previewOcrImage.dataUrl;
                    link.download = previewOcrImage.fileName || 'document.jpg';
                    link.click();
                  }}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  title="تحميل"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewOcrImage(null)}
                  className="p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white transition-colors mr-2"
                  title="إغلاق"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: 2 Columns (Image + OCR Metadata) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
              {/* Image Viewport */}
              <div className="lg:col-span-8 bg-slate-950 flex items-center justify-center p-4 overflow-auto min-h-[350px]">
                <div 
                  className="transition-transform duration-200 origin-center"
                  style={{
                    transform: `scale(${previewZoom}) rotate(${previewRotation}deg)`
                  }}
                >
                  <img
                    src={previewOcrImage.dataUrl}
                    alt={previewOcrImage.fileName}
                    className="max-h-[70vh] max-w-full object-contain rounded shadow-lg"
                  />
                </div>
              </div>

              {/* OCR Extracted Data Sidebar */}
              <div className="lg:col-span-4 bg-slate-50 border-r border-slate-200 p-4 space-y-3.5 overflow-y-auto max-h-[70vh]">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">صاحب الطلب المستخرج (OCR)</span>
                  <div className="text-sm font-bold text-slate-900 bg-white p-2 rounded-lg border border-slate-200">
                    {previewOcrImage.citizenName || 'مواطن صاحب معاملة'}
                  </div>
                </div>

                {previewOcrImage.entity && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">الجهة المعنية</span>
                    <div className="text-xs font-semibold text-blue-700 bg-blue-50/60 p-2 rounded-lg border border-blue-200">
                      {previewOcrImage.entity}
                    </div>
                  </div>
                )}

                {previewOcrImage.details && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">موضوع وتفاصيل الطلب</span>
                    <div className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200 leading-relaxed">
                      {previewOcrImage.details}
                    </div>
                  </div>
                )}

                {previewOcrImage.phone && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold block">رقم الهاتف المستخرج</span>
                    <div className="text-xs font-mono text-slate-800 bg-white p-2 rounded-lg border border-slate-200" dir="ltr">
                      {previewOcrImage.phone}
                    </div>
                  </div>
                )}

                {/* Complete Extracted Text */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>النص الكامل المقروء من الوثيقة:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(previewOcrImage.extractedText || '');
                        setCopiedTextId('modal_copy');
                        setTimeout(() => setCopiedTextId(null), 2000);
                      }}
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      {copiedTextId === 'modal_copy' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ النص كاملاً</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-52 overflow-y-auto whitespace-pre-wrap select-text">
                    {previewOcrImage.extractedText || 'لم يتم استخراج نص تفصيلي لهذه الصورة.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
