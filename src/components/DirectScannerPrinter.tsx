import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Scan, 
  Camera, 
  Upload, 
  Printer, 
  Save, 
  RotateCw, 
  RotateCcw, 
  Sliders, 
  CheckCircle, 
  FileText, 
  User, 
  Sparkles, 
  SendHorizontal, 
  RefreshCw, 
  AlertCircle,
  Eye,
  Layers,
  Copy,
  Scissors
} from 'lucide-react';
import { Citizen } from '../types';

interface DirectScannerPrinterProps {
  initialCitizenId?: string;
  onClose?: () => void;
}

export const DirectScannerPrinter: React.FC<DirectScannerPrinterProps> = ({
  initialCitizenId,
  onClose
}) => {
  const { 
    citizens, 
    currentUser, 
    addDocument, 
    systemSettings, 
    forwardCitizenWorkflow,
    setSelectedCitizenForHistory,
    requests,
    updateRequest
  } = useApp();

  const [selectedCitizenId, setSelectedCitizenId] = useState<string>(
    initialCitizenId || (citizens[0]?.Citizen_ID || '')
  );
  const [selectedRequestId, setSelectedRequestId] = useState<string>('');
  const [requestSavedSuccess, setRequestSavedSuccess] = useState<string | null>(null);
  const [docCategory, setDocCategory] = useState<string>('بطاقة وطنية ومستمسكات');
  const [docTitle, setDocTitle] = useState<string>('مسح ضوئي للمستمسكات الرسمية');
  const [notes, setNotes] = useState<string>('');

  // Source selection: 'camera' | 'upload' | 'samples'
  const [sourceMode, setSourceMode] = useState<'upload' | 'camera' | 'samples'>('samples');

  // Image and adjustments state
  const [scannedImage, setScannedImage] = useState<string | null>(
    'https://images.unsplash.com/photo-1568667256549-094345857637?w=800&auto=format&fit=crop&q=80'
  );
  const [filterMode, setFilterMode] = useState<'document_bw' | 'grayscale' | 'magic_color' | 'original'>('document_bw');
  const [rotation, setRotation] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(120);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Camera stream refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCitizen = citizens.find(c => c.Citizen_ID === selectedCitizenId);

  // Sample Documents for immediate testing
  const sampleDocuments = [
    {
      id: 'national_id',
      name: 'بطاقة وطنية موحدة (وجه أمامي)',
      category: 'بطاقة وطنية ومستمسكات',
      url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80',
      title: 'البطاقة الوطنية الموحدة للمراجع'
    },
    {
      id: 'residence_card',
      name: 'بطاقة سكن وتأييد مختار',
      category: 'مستمسكات ثبوتية',
      url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
      title: 'بطاقة السكن - محافظة ذي قار'
    },
    {
      id: 'written_request',
      name: 'طلب ومناشدة خطية للوزير',
      category: 'طلب مقدم',
      url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
      title: 'طلب خطي مشفوع بهامش النائب'
    },
    {
      id: 'official_letter',
      name: 'كتاب رسمي صادر من مجلس النواب',
      category: 'كتاب رسمي صادر',
      url: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=800&auto=format&fit=crop&q=80',
      title: 'كتاب مخاطبة رسمي ذي العدد 2026/ن'
    }
  ];

  // Initialize camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraActive(true);
      } else {
        setCameraError('المتصفح لا يدعم الوصول للكاميرا المباشرة.');
      }
    } catch (err: any) {
      console.warn('Camera access error', err);
      setCameraError('تعذر فتح الكاميرا (يرجى التحقق من أذونات الكاميرا أو استخدام رفع الملفات).');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureCameraSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setScannedImage(dataUrl);
      stopCamera();
      setSourceMode('samples');
    }
  };

  useEffect(() => {
    if (sourceMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [sourceMode]);

  // Handle file drop & upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        setScannedImage(event.target?.result as string);
        setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = (event) => {
              setScannedImage(event.target?.result as string);
              setDocTitle('مستند ملصوق من الحافظة');
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      alert('لم يتم العثور على صورة في الحافظة. يرجى نسخ صورة أولاً (Ctrl+C).');
    } catch (err) {
      alert('يرجى لصق الصورة أو استخدام رفع الملفات.');
    }
  };

  // Image CSS Filter Style Calculation
  const getImageFilterStyle = () => {
    let filterStr = `brightness(${brightness}%) contrast(${contrast}%)`;
    if (filterMode === 'document_bw') {
      filterStr += ' grayscale(100%) contrast(175%) brightness(110%)';
    } else if (filterMode === 'grayscale') {
      filterStr += ' grayscale(100%)';
    } else if (filterMode === 'magic_color') {
      filterStr += ' saturate(160%) contrast(115%)';
    }
    return {
      filter: filterStr,
      transform: `rotate(${rotation}deg)`,
      transition: 'filter 0.2s ease, transform 0.2s ease'
    };
  };

  // 1-Click Direct Print
  const handleDirectPrint = () => {
    window.print();
  };

  // Save to Citizen Archive
  const handleSaveToArchive = () => {
    if (!selectedCitizen || !scannedImage) return;

    addDocument({
      Citizen_ID: selectedCitizen.Citizen_ID,
      CitizenName: selectedCitizen.FullName,
      Title: docTitle || 'مستند ممسوح ضوئياً',
      Category: docCategory,
      FileUrl: scannedImage,
      FileType: 'image',
      FileSize: '1.2 MB',
      UploadedBy: currentUser?.FullName || 'موظف الإدارة'
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Save scan image to citizen's office request (الطلب) with employee name & timestamp
  const handleSaveToRequest = () => {
    if (!scannedImage) {
      alert('لا توجد صورة ممسوحة ضوئياً لحفظها.');
      return;
    }
    const citReqs = requests.filter(r => r.Citizen_ID === selectedCitizenId);
    const targetReqId = selectedRequestId || citReqs[0]?.Request_ID;
    if (!targetReqId) {
      alert('لم يتم العثور على طلب/معاملة مسجلة لهذا المراجع. يرجى إنشاء طلب للمراجع أولاً.');
      return;
    }
    const targetReq = requests.find(r => r.Request_ID === targetReqId);
    if (!targetReq) return;

    const uploaderName = currentUser?.FullName || 'موظف الإدارة';
    const nowStamp = new Date().toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' });

    updateRequest({
      ...targetReq,
      AttachedRequestImage: scannedImage,
      ScanUploadedBy: uploaderName,
      ScanUploadedAt: nowStamp,
      ScanAttachments: [
        ...(targetReq.ScanAttachments || []),
        {
          id: `SCAN-${Date.now()}`,
          url: scannedImage,
          fileName: docTitle || 'مسح ضوئي للطلب',
          uploadedBy: uploaderName,
          uploadedAt: nowStamp,
          notes: notes || undefined
        }
      ]
    });

    setRequestSavedSuccess(`تم حفظ صورة الاسكنر كما هي في المعاملة (${targetReq.Request_ID}) بنجاح. القائم بالمسح: ${uploaderName} | التاريخ: ${nowStamp}`);
    setTimeout(() => setRequestSavedSuccess(null), 6000);
  };

  // Print & Forward to Organization Director in 1 step
  const handlePrintAndForwardToOrg = () => {
    handleSaveToArchive();
    if (selectedCitizen) {
      forwardCitizenWorkflow(
        selectedCitizen.Citizen_ID,
        'مدير التنظيم',
        `تم مسح المستمسكات وتدقيق المعاملة بالإدارة وإحالتها للمتابعة الميدانية والانتخابية.`
      );
    }
    window.print();
  };

  return (
    <div className="space-y-4 text-right">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-l from-blue-900 via-blue-800 to-indigo-900 text-white p-4 rounded-xl shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
              <Scan className="w-5 h-5 text-blue-300" />
            </div>
            <h3 className="text-base font-bold">سكنر المستندات والطباعة المباشرة (Scanner to Printer)</h3>
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
              متصل بالطابعة والأرشيف
            </span>
          </div>
          <p className="text-xs text-blue-100/80">
            مسح المستمسكات والكتب الرسمية ضوئياً، تعزيز جودة الأختام والتباين، والطباعة الفورية بترويسة مجلس النواب العراقي.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDirectPrint}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة فورية مباشرة (A4)</span>
          </button>

          <button
            onClick={handlePrintAndForwardToOrg}
            className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
            title="طباعة وتوثيق وإرسال لمدير التنظيم"
          >
            <SendHorizontal className="w-4 h-4" />
            <span>طباعة وإحالة لمدير التنظيم</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-bold animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>تم حفظ المستند الممسوح ضوئياً بنجاح في الأرشيف السحابي للمراجع ({selectedCitizen?.FullName}).</span>
        </div>
      )}

      {requestSavedSuccess && (
        <div className="p-3.5 bg-blue-50 border border-blue-300 text-blue-900 rounded-xl text-xs flex items-center gap-2.5 font-bold animate-fadeIn shadow-xs">
          <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="space-y-0.5">
            <div>{requestSavedSuccess}</div>
            <div className="text-[11px] text-blue-700 font-medium">✓ تم حفظ صورة الاسكنر الأصلية كما هي تماماً وتوثيق الموظف القائم بالرفع والتاريخ بدقة.</div>
          </div>
        </div>
      )}

      {/* Main Grid: Control Panel + Live Scanner & Print Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left / Top Controls (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Citizen Linker Card */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <User className="w-4 h-4 text-blue-600" />
                <span>1. ربط المستند بالمراجع</span>
              </span>
              {selectedCitizen && (
                <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                  {selectedCitizen.Citizen_ID}
                </span>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                اختر المراجع من القائمة:
              </label>
              <select
                value={selectedCitizenId}
                onChange={(e) => setSelectedCitizenId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-right"
              >
                {citizens.map(c => (
                  <option key={c.Citizen_ID} value={c.Citizen_ID}>
                    {c.FullName} ({c.Citizen_ID}) - {c.District}
                  </option>
                ))}
              </select>
            </div>

            {selectedCitizen && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>الهاتف:</span>
                  <span className="font-mono font-bold text-slate-900" dir="ltr">{selectedCitizen.Phone1}</span>
                </div>
                <div className="flex justify-between">
                  <span>السكن:</span>
                  <span className="font-bold text-slate-900">{selectedCitizen.District} {selectedCitizen.SubDistrict ? `(${selectedCitizen.SubDistrict})` : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span>المسار الحالي:</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                    {selectedCitizen.CurrentStage || 'الاستعلامات'}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">تصنيف الوثيقة:</label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white outline-none"
                >
                  <option value="بطاقة وطنية ومستمسكات">بطاقة وطنية ومستمسكات</option>
                  <option value="مستمسكات ثبوتية">مستمسكات ثبوتية (سكن/شهادة جنسية)</option>
                  <option value="طلب مقدم">طلب ومناشدة خطية</option>
                  <option value="كتاب رسمي صادر">كتاب رسمي صادر</option>
                  <option value="تقرير طبي">تقرير طبي / لجان</option>
                  <option value="أخرى">وثيقة عامة أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">عنوان الوثيقة:</label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="مثال: البطاقة الموحدة وجهين"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Direct Request Linking Card (ربط بالطلب وحفظ صورة الاسكنر مع توثيق اسم الموظف والتاريخ) */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
              <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-700" />
                <span>إرفاق بالمعاملة / الطلب (حفظ صورة الاسكنر)</span>
              </span>
              <span className="text-[10px] bg-blue-200/70 text-blue-900 font-bold px-2 py-0.5 rounded-full">
                توثيق اسم الموظف والتاريخ
              </span>
            </div>

            {requests.filter(r => r.Citizen_ID === selectedCitizenId).length === 0 ? (
              <div className="p-3 bg-white rounded-lg border border-blue-150 text-[11px] text-slate-500 text-center">
                لا توجد طلبات مسجلة لهذا المراجع حالياً. يمكنك إنشاء طلب من قسم الإدارة أولاً أو الحفظ في الأرشيف السحابي.
              </div>
            ) : (
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    اختر الطلب المراد إرفاق صورة الاسكنر به:
                  </label>
                  <select
                    value={selectedRequestId || requests.filter(r => r.Citizen_ID === selectedCitizenId)[0]?.Request_ID}
                    onChange={(e) => setSelectedRequestId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 text-xs font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {requests.filter(r => r.Citizen_ID === selectedCitizenId).map(r => (
                      <option key={r.Request_ID} value={r.Request_ID}>
                        [{r.Request_ID}] - {r.Entity} ({r.Details.slice(0, 35)}...)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-2.5 bg-white/90 rounded-lg border border-blue-100 text-[11px] space-y-1 text-slate-600">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">الموظف القائم بالرفع:</span>
                    <strong className="text-blue-900 font-bold">{currentUser?.FullName || 'موظف الإدارة'}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">تاريخ ووقت الإرفاق:</span>
                    <span className="font-mono text-slate-700 font-bold">{new Date().toLocaleString('ar-IQ', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold pt-1 border-t border-slate-100 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    <span>تُحفظ صورة الاسكنر الأصلية كما هي تماماً مع حفظ اسم الموظف والتاريخ.</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveToRequest}
                  className="w-full py-2 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Save className="w-3.5 h-3.5 text-blue-200" />
                  <span>حفظ وإرفاق صورة الاسكنر بالطلب المختار</span>
                </button>
              </div>
            )}
          </div>

          {/* Scanner Source Selector */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Scan className="w-4 h-4 text-indigo-600" />
              <span>2. مصدر الإدخال والمسح الضوئي</span>
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setSourceMode('upload')}
                className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  sourceMode === 'upload'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>رفع / سكنر USB</span>
              </button>

              <button
                onClick={() => setSourceMode('camera')}
                className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  sourceMode === 'camera'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>كاميرا مباشرة</span>
              </button>

              <button
                onClick={() => setSourceMode('samples')}
                className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  sourceMode === 'samples'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>نماذج جاهزة</span>
              </button>
            </div>

            {/* Source UI: Upload */}
            {sourceMode === 'upload' && (
              <div className="space-y-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-slate-50 hover:bg-blue-50/50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-center"
                >
                  <Upload className="w-6 h-6 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">
                    انقر لاختيار ملف ممسوح ضوئياً أو اسحبه هنا
                  </span>
                  <span className="text-[10px] text-slate-500">
                    يدعم جميع صيغ الصور (PNG, JPG, WEBP)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="w-full py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>لصق صورة مباشرة من الحافظة (Ctrl+V)</span>
                </button>
              </div>
            )}

            {/* Source UI: Camera */}
            {sourceMode === 'camera' && (
              <div className="space-y-2 pt-1">
                {cameraError ? (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden bg-black border border-slate-300 aspect-video flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Scanner guidelines overlay */}
                    <div className="absolute inset-4 border-2 border-emerald-400/80 rounded-lg pointer-events-none flex items-center justify-center">
                      <span className="bg-black/60 text-emerald-300 text-[10px] px-2 py-0.5 rounded font-mono">
                        ضع المستند داخل الإطار
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={captureCameraSnapshot}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Camera className="w-4 h-4" />
                    <span>التقاط المسح الضوئي الآن</span>
                  </button>

                  <button
                    onClick={startCamera}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    title="إعادة تشغيل الكاميرا"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Source UI: Samples */}
            {sourceMode === 'samples' && (
              <div className="space-y-2 pt-1">
                <span className="text-[11px] text-slate-500 block">اختر مستنداً تجريبياً لمعاينته وطباعته فوراً:</span>
                <div className="grid grid-cols-2 gap-2">
                  {sampleDocuments.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setScannedImage(doc.url);
                        setDocTitle(doc.title);
                        setDocCategory(doc.category);
                      }}
                      className="p-2 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-right transition-colors cursor-pointer"
                    >
                      <span className="text-[11px] font-bold text-slate-800 block truncate">{doc.name}</span>
                      <span className="text-[10px] text-slate-500 block">{doc.category}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scanner Enhancements & Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>3. معالجة وتصفية المسح الضوئي (فلاتر السكنر)</span>
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                onClick={() => setFilterMode('document_bw')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  filterMode === 'document_bw'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                وثيقة أبيض/أسود
              </button>

              <button
                onClick={() => setFilterMode('grayscale')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  filterMode === 'grayscale'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                تدرج رمادي
              </button>

              <button
                onClick={() => setFilterMode('magic_color')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  filterMode === 'magic_color'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                تعزيز الأختام
              </button>

              <button
                onClick={() => setFilterMode('original')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  filterMode === 'original'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                الأصل
              </button>
            </div>

            {/* Rotation and Fine Sliders */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">تدوير الوثيقة:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setRotation((r) => (r - 90) % 360)}
                    className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    title="تدوير 90° يسار"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-xs px-2">{rotation}°</span>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    title="تدوير 90° يمين"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>التباين (Contrast)</span>
                    <span className="font-mono">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="250"
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>السطوع (Brightness)</span>
                    <span className="font-mono">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="180"
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Actions: Save to Archive */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={handleSaveToArchive}
                className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ في الأرشيف السحابي</span>
              </button>

              <button
                onClick={() => {
                  setRotation(0);
                  setBrightness(100);
                  setContrast(120);
                  setFilterMode('document_bw');
                }}
                className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                title="إعادة ضبط الفلاتر"
              >
                إعادة ضبط
              </button>
            </div>
          </div>
        </div>

        {/* Right / Bottom Area (lg:col-span-7): Official Print Preview Container */}
        <div className="lg:col-span-7">
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold text-slate-800">
                  معاينة طباعة الوثيقة الرسمية (A4 Official Printable Sheet)
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                جاهز للطباعة المباشرة عبر الطابعة
              </span>
            </div>

            {/* The Actual Printable Sheet (Targeted by Print CSS) */}
            <div 
              id="printable-scanner-document"
              className="p-6 border-2 border-slate-800 rounded-lg bg-white text-slate-900 space-y-4 text-right shadow-xs relative print:border-none print:shadow-none print:p-0"
            >
              {/* Parliament Official Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                <div className="text-center w-24">
                  <span className="font-bold text-[11px] block leading-tight text-slate-900">جمهورية العراق</span>
                  <span className="font-bold text-[10px] block leading-tight text-slate-800">مجلس النواب</span>
                  <span className="font-semibold text-[9px] block text-slate-700">الدورة الخامسة</span>
                </div>

                <div className="flex flex-col items-center">
                  <img
                    src={systemSettings.parliamentEmblemUrl}
                    alt="شعار جمهورية العراق"
                    className="w-12 h-12 object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <span className="font-bold text-xs mt-1 text-slate-900">
                    مكتب {systemSettings.deputyName}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    قسم الإدارة والمتابعة الحكومية
                  </span>
                </div>

                <div className="text-left w-24 text-[10px] space-y-0.5 font-mono">
                  <div><span className="font-bold">العدد:</span> SCAN-{Date.now().toString().slice(-4)}</div>
                  <div><span className="font-bold">التاريخ:</span> {new Date().toISOString().split('T')[0]}</div>
                  <div><span className="font-bold">المحافظة:</span> ذي قار</div>
                </div>
              </div>

              {/* Citizen & Document Info Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded border border-slate-300 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">المراجع:</span>
                  <span className="font-bold text-slate-900">{selectedCitizen?.FullName || 'غير محدد'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">الرقم التعريفي:</span>
                  <span className="font-mono font-bold text-blue-800">{selectedCitizen?.Citizen_ID || 'ONA-00000'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">السكن والهاتف:</span>
                  <span className="font-bold text-slate-800">{selectedCitizen?.District} - {selectedCitizen?.Phone1}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">تصنيف الوثيقة:</span>
                  <span className="font-bold text-indigo-800">{docCategory}</span>
                </div>
              </div>

              {/* Scanned Document Image Box */}
              <div className="border border-slate-400 rounded-lg p-2 bg-slate-50/50 flex items-center justify-center min-h-[380px] max-h-[480px] overflow-hidden">
                {scannedImage ? (
                  <img
                    src={scannedImage}
                    alt="وثيقة ممسوحة ضوئياً"
                    style={getImageFilterStyle()}
                    className="max-h-[460px] max-w-full object-contain rounded shadow-xs"
                  />
                ) : (
                  <div className="text-center text-slate-400 text-xs p-8">
                    <Scan className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <span>لا توجد صورة مستند ممسوحة ضوئياً حالياً.</span>
                  </div>
                )}
              </div>

              {/* Official Seal and Signatures Footer */}
              <div className="pt-3 border-t-2 border-slate-900 flex items-center justify-between text-xs">
                <div className="text-center">
                  <span className="text-[10px] text-slate-500 block">منظم المعاملة / موظف الإدارة</span>
                  <span className="font-bold text-slate-900 block mt-1">{currentUser?.FullName || 'أحمد حامد السعدون'}</span>
                  <span className="text-[9px] text-slate-400 block font-mono">قسم الإدارة والمعاملات</span>
                </div>

                <div className="text-center border border-dashed border-slate-400 px-4 py-2 rounded">
                  <span className="text-[10px] text-slate-500 block">الختم الرسمي لمكتب النائب</span>
                  <span className="text-[9px] text-slate-400 block">صادر ذي قار</span>
                </div>

                <div className="text-center">
                  <span className="text-[10px] text-slate-500 block">مدير المكتب التنفيذي</span>
                  <span className="font-bold text-slate-900 block mt-1">صادق عبد الحسن الناشي</span>
                  <span className="text-[9px] text-slate-400 block">المصادقة والاعتماد</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
