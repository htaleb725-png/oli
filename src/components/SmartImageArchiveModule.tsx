import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { OfficeRequest, Citizen } from '../types';
import { 
  FolderKanban, 
  Search, 
  Upload, 
  Plus, 
  Trash2, 
  Edit3, 
  Printer, 
  Download, 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  FileImage, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Users,
  Layers,
  Sparkles,
  RefreshCw,
  X,
  FileText,
  Building2,
  Calendar,
  Filter,
  CheckSquare,
  Square,
  Scan,
  Loader2,
  Save,
  Copy,
  Check
} from 'lucide-react';
import { extractCitizenInfoFromFilename } from '../utils/filenameNameExtractor';
import { analyzeImageWithOCR, OCRResult } from '../utils/ocrService';
import { 
  saveImageToDB, 
  saveBatchImagesToDB, 
  getImageFromDB, 
  getAllImagesFromDB, 
  deleteImageFromDB, 
  deleteBatchImagesFromDB, 
  updateImageMetadataInDB,
  ImageRecord 
} from '../utils/imageDb';

interface SmartImageArchiveModuleProps {
  onOpenCitizenHistory?: (citizenId: string) => void;
}

export const SmartImageArchiveModule: React.FC<SmartImageArchiveModuleProps> = ({ onOpenCitizenHistory }) => {
  const { 
    requests, 
    citizens, 
    currentUser, 
    systemSettings,
    addCitizen,
    updateCitizen,
    addRequest,
    updateRequest,
    deleteRequest,
    addAuditLog,
    addDocument,
    deleteDocument
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntityFilter, setSelectedEntityFilter] = useState('all');
  const [selectedFilterTab, setSelectedFilterTab] = useState<'all' | 'multiple_requests' | 'recent' | 'urgent'>('all');

  // Stored indexed images
  const [storedImages, setStoredImages] = useState<ImageRecord[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);

  // Multi-select for bulk delete
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  // Citizen Dossier State: Search by citizen name to display all requests & OCR records
  const [selectedCitizenDossier, setSelectedCitizenDossier] = useState<{ id: string; name: string; citizen?: Citizen } | null>(null);
  const [dossierViewMode, setDossierViewMode] = useState<'both' | 'requests' | 'ocr'>('both');
  const [copiedOcrTextId, setCopiedOcrTextId] = useState<string | null>(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Bulk Upload Processing State (1,000 - 2,000 images)
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({
    total: 0,
    current: 0,
    percentage: 0,
    matchedCitizens: 0,
    createdCitizens: 0,
    currentFilename: '',
    currentExtractedName: '',
    ocrSuccessCount: 0
  });
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Batch Re-OCR Existing Images State
  const [isReScanningOcr, setIsReScanningOcr] = useState(false);
  const [showReOcrModal, setShowReOcrModal] = useState(false);
  const [reOcrProgress, setReOcrProgress] = useState({
    total: 0,
    current: 0,
    percentage: 0,
    currentName: '',
    successCount: 0,
    isFinished: false
  });

  // Single Image OCR Modal State
  const [isAnalyzingSingleCardId, setIsAnalyzingSingleCardId] = useState<string | null>(null);
  const [showSingleOcrResultModal, setShowSingleOcrResultModal] = useState(false);
  const [singleOcrTargetRecord, setSingleOcrTargetRecord] = useState<ImageRecord | null>(null);
  const [singleOcrResult, setSingleOcrResult] = useState<OCRResult | null>(null);
  const [singleOcrEditedName, setSingleOcrEditedName] = useState('');
  const [singleOcrEditedEntity, setSingleOcrEditedEntity] = useState('');
  const [singleOcrEditedDetails, setSingleOcrEditedDetails] = useState('');
  const [singleOcrEditedPhone, setSingleOcrEditedPhone] = useState('');
  const [isSavingSingleOcr, setIsSavingSingleOcr] = useState(false);

  // Manual Add Request & Photo Modal
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [manualCitizenName, setManualCitizenName] = useState('');
  const [manualHonorific, setManualHonorific] = useState('السيد');
  const [manualEntity, setManualEntity] = useState('وزارة العمل والشؤون الاجتماعية (شبكة الحماية)');
  const [manualDetails, setManualDetails] = useState('');
  const [manualPriority, setManualPriority] = useState<'عاجل' | 'عام' | 'خاص جداً'>('عاجل');
  const [manualImageData, setManualImageData] = useState<string>('');
  const [manualImageName, setManualImageName] = useState('');
  const [isAnalyzingManualImage, setIsAnalyzingManualImage] = useState(false);
  const [manualOcrMessage, setManualOcrMessage] = useState<string | null>(null);

  // Edit Metadata Modal
  const [editingImage, setEditingImage] = useState<ImageRecord | null>(null);
  const [editCitizenName, setEditCitizenName] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editEntity, setEditEntity] = useState('');
  const [editPriority, setEditPriority] = useState<'عاجل' | 'عام' | 'خاص جداً'>('عاجل');

  // Preview & Zoom Viewer Modal
  const [previewImage, setPreviewImage] = useState<{
    record: ImageRecord;
    request?: OfficeRequest;
    citizen?: Citizen;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // File input ref for bulk upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualFileInputRef = useRef<HTMLInputElement>(null);

  // Load images from IndexedDB on mount
  const refreshImagesFromDB = async () => {
    setIsLoadingImages(true);
    try {
      const records = await getAllImagesFromDB();
      // Sort newest first
      records.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      setStoredImages(records);
    } catch (err) {
      console.error('Error loading images from IndexedDB', err);
    } finally {
      setIsLoadingImages(false);
    }
  };

  useEffect(() => {
    refreshImagesFromDB();
  }, []);

  // Map of citizen names for quick lookup
  const citizenMapByName = useMemo(() => {
    const map = new Map<string, Citizen>();
    for (const c of citizens) {
      if (c.FullName) {
        const norm = c.FullName.trim().toLowerCase();
        map.set(norm, c);
      }
    }
    return map;
  }, [citizens]);

  // Map of request counts per citizen
  const citizenRequestCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of requests) {
      if (r.Citizen_ID) {
        counts.set(r.Citizen_ID, (counts.get(r.Citizen_ID) || 0) + 1);
      }
      if (r.CitizenName) {
        const norm = r.CitizenName.trim().toLowerCase();
        counts.set(norm, (counts.get(norm) || 0) + 1);
      }
    }
    return counts;
  }, [requests]);

  // Process Batch Images with OCR & Intelligent Citizen Extraction
  const handleBatchFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList: File[] = Array.from(files);
    const totalFiles = fileList.length;

    setIsUploadingBatch(true);
    setShowBatchModal(true);
    setBatchProgress({
      total: totalFiles,
      current: 0,
      percentage: 0,
      matchedCitizens: 0,
      createdCitizens: 0,
      currentFilename: '',
      currentExtractedName: '',
      ocrSuccessCount: 0
    });

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    let matchedCount = 0;
    let createdCount = 0;
    let ocrSuccessTotal = 0;
    const dbRecordsToSave: ImageRecord[] = [];

    // Process files sequentially or in small pairs so OCR calls and browser remain smooth
    let processed = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = fileList[i];
      try {
        // Update progress filename immediately
        setBatchProgress(prev => ({
          ...prev,
          currentFilename: file.name,
          current: processed + 1,
          percentage: Math.round(((processed + 1) / totalFiles) * 100)
        }));

        // 1. Read image as Data URL
        const dataUrl = await readFileAsDataUrl(file);

        // 2. Perform OCR Analysis on the image
        let ocrResult: OCRResult;
        try {
          ocrResult = await analyzeImageWithOCR(dataUrl, file.name);
        } catch (ocrErr) {
          console.warn('OCR error for image, fallback to filename parsing:', ocrErr);
          const fallback = extractCitizenInfoFromFilename(file.name);
          ocrResult = {
            citizenName: fallback.cleanName,
            title: fallback.title,
            entity: fallback.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
            details: fallback.details || `طلب مقدم من ${fallback.cleanName}`,
            priority: 'عام',
            fullExtractedText: '',
            confidence: 0,
            ocrUsed: false,
            success: false
          };
        }

        if (ocrResult.success && ocrResult.ocrUsed) {
          ocrSuccessTotal++;
        }

        // Final determined citizen name
        const cleanName = ocrResult.citizenName || extractCitizenInfoFromFilename(file.name).cleanName || 'مواطن صاحب معاملة';
        const normName = cleanName.toLowerCase();

        setBatchProgress(prev => ({
          ...prev,
          currentExtractedName: cleanName,
          ocrSuccessCount: ocrSuccessTotal
        }));

        // 3. Check if Citizen already exists
        let targetCitizen = citizenMapByName.get(normName);
        if (!targetCitizen) {
          // Check partial match
          targetCitizen = citizens.find(c => 
            c.FullName && (c.FullName.includes(cleanName) || cleanName.includes(c.FullName))
          );
        }

        let citizenId = '';
        if (targetCitizen) {
          citizenId = targetCitizen.Citizen_ID;
          matchedCount++;
          // If citizen has default/empty phone and OCR detected a real phone, update it
          if (ocrResult.phone && (!targetCitizen.Phone1 || targetCitizen.Phone1 === '07800000000')) {
            updateCitizen({ ...targetCitizen, Phone1: ocrResult.phone });
          }
        } else {
          // Create new citizen with OCR extracted details
          const newCitizen = addCitizen({
            FullName: cleanName,
            Phone1: ocrResult.phone || '07800000000',
            National_ID: `NID-${Math.floor(100000000 + Math.random() * 900000000)}`,
            Gender: ocrResult.title?.includes('سيدة') || ocrResult.title?.includes('مواطنة') || ocrResult.title?.includes('حاجة') || ocrResult.title?.includes('دكتورة') ? 'أنثى' : 'ذكر',
            Rating: 'A',
            District: 'ذي قار',
            SubDistrict: 'المركز',
            AttendanceType: 'شخصياً',
            DependencyStatus: 'مستقل',
            RegisteredVia: ocrResult.ocrUsed ? 'قارئ OCR الذكي' : 'أرشفة صور'
          });
          citizenId = newCitizen.Citizen_ID;
          createdCount++;
        }

        // 4. Create new Office Request linked to this Citizen and photo
        const createdReq = addRequest({
          Citizen_ID: citizenId,
          CitizenName: cleanName,
          Entity: ocrResult.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)',
          RequestStatus: 'مستلم',
          ProcessingStatus: 'قيد التدقيق',
          Priority: ocrResult.priority || 'عاجل',
          Details: ocrResult.details || `طلب مقدم من ${ocrResult.title || 'المواطن'} ${cleanName} مع صورة مستند رسمية`,
          AttachmentRequest: file.name,
          AttachedRequestImage: dataUrl,
          CreatedBy: currentUser ? currentUser.FullName : 'قسم الأرشفة والذكاء الاصطناعي (OCR)',
          DeputyNotes: ocrResult.ocrUsed 
            ? `تم استخراج الاسم (${cleanName}) والمحتوى عبر القراءة الضوئية الذكية OCR (دقة: ${ocrResult.confidence}%)`
            : undefined,
          AttendanceType: 'شخصياً',
          DependencyStatus: 'مستقل'
        });

        // 5. Add to document archive
        addDocument({
          Citizen_ID: citizenId,
          CitizenName: cleanName,
          Title: `صورة معاملة: ${cleanName} (${file.name})`,
          Category: 'طلب مقدم',
          FileUrl: dataUrl,
          FileType: file.type.includes('pdf') ? 'pdf' : 'image',
          FileSize: `${(file.size / 1024).toFixed(1)} KB`,
          UploadedBy: currentUser?.FullName || 'قسم الإدارة والـ OCR'
        });

        // 6. Push to DB records with full OCR metadata
        dbRecordsToSave.push({
          id: createdReq.Request_ID,
          citizenName: cleanName,
          citizenId: citizenId,
          dataUrl: dataUrl,
          fileName: file.name,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
          mimeType: file.type || 'image/jpeg',
          uploadedAt: nowStr,
          extractedText: ocrResult.fullExtractedText,
          entity: ocrResult.entity,
          details: ocrResult.details,
          phone: ocrResult.phone,
          ocrProcessed: ocrResult.ocrUsed,
          confidence: ocrResult.confidence,
          priority: ocrResult.priority
        });

      } catch (fileErr) {
        console.error(`Error processing file ${file.name}`, fileErr);
      }

      processed++;

      // Update progress state
      const pct = Math.round((processed / totalFiles) * 100);
      setBatchProgress(prev => ({
        ...prev,
        current: processed,
        percentage: pct,
        matchedCitizens: matchedCount,
        createdCitizens: createdCount
      }));

      // Yield event loop
      await new Promise(res => setTimeout(res, 20));
    }

    // Save all to IndexedDB in batch
    await saveBatchImagesToDB(dbRecordsToSave);

    addAuditLog(
      'أرشفة ورفع صور معاملات دفعة واحدة مع قراءة OCR',
      'أرشيف الصور الذكية والطباعة',
      `تم رفع ومعالجة ${totalFiles} صورة، والتعرف بالـ OCR على ${ocrSuccessTotal} معاملة، ومطابقة ${matchedCount} مواطن، وقيد ${createdCount} جديد`
    );

    // Refresh list from IndexedDB
    await refreshImagesFromDB();

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setTimeout(() => {
      setIsUploadingBatch(false);
    }, 1500);
  };

  // Run Re-OCR on currently stored images (to extract names from already uploaded photos)
  const handleStartReOcrCurrentImages = async (scanAll = false) => {
    // Select images to scan: either all, or only those without OCR or with generic placeholder names
    const targetImages = scanAll
      ? storedImages
      : storedImages.filter(img => 
          !img.ocrProcessed || 
          !img.extractedText || 
          img.citizenName === 'مواطن غير معروف' || 
          img.citizenName === 'مواطن صاحب معاملة' ||
          img.citizenName.startsWith('IMG') ||
          img.citizenName.startsWith('DOC') ||
          img.citizenName.startsWith('SCAN') ||
          img.citizenName.includes('jpg') ||
          img.citizenName.includes('png')
        );

    if (targetImages.length === 0) {
      alert('جميع الصور المؤرشفة مفحوصة بالفعل عبر OCR! إذا رغبت بإعادة فحصها مجدداً، اختر خيار فحص الكل.');
      return;
    }

    setIsReScanningOcr(true);
    setShowReOcrModal(true);
    setReOcrProgress({
      total: targetImages.length,
      current: 0,
      percentage: 0,
      currentName: '',
      successCount: 0,
      isFinished: false
    });

    let success = 0;
    let idx = 0;

    for (const record of targetImages) {
      try {
        setReOcrProgress(prev => ({
          ...prev,
          current: idx + 1,
          currentName: record.citizenName || record.fileName,
          percentage: Math.round(((idx + 1) / targetImages.length) * 100)
        }));

        const ocr = await analyzeImageWithOCR(record.dataUrl, record.fileName);

        if (ocr.success && ocr.citizenName && ocr.citizenName !== 'مواطن صاحب معاملة') {
          const cleanName = ocr.citizenName;
          success++;

          // 1. Match or create Citizen
          const normName = cleanName.toLowerCase();
          let targetCitizen = citizenMapByName.get(normName) || citizens.find(c => 
            c.FullName && (c.FullName.includes(cleanName) || cleanName.includes(c.FullName))
          );

          let citizenId = record.citizenId || '';
          if (targetCitizen) {
            citizenId = targetCitizen.Citizen_ID;
            if (ocr.phone && (!targetCitizen.Phone1 || targetCitizen.Phone1 === '07800000000')) {
              updateCitizen({ ...targetCitizen, Phone1: ocr.phone });
            }
          } else {
            const newCitizen = addCitizen({
              FullName: cleanName,
              Phone1: ocr.phone || '07800000000',
              National_ID: `NID-${Math.floor(100000000 + Math.random() * 900000000)}`,
              Gender: 'ذكر',
              Rating: 'A',
              District: 'ذي قار',
              SubDistrict: 'المركز',
              AttendanceType: 'شخصياً',
              DependencyStatus: 'مستقل',
              RegisteredVia: 'مسح OCR ذكي'
            });
            citizenId = newCitizen.Citizen_ID;
          }

          // 2. Update existing Request or create if missing
          const linkedReq = requests.find(r => 
            r.Request_ID === record.id || 
            (r.Citizen_ID && r.Citizen_ID === record.citizenId) || 
            r.AttachedRequestImage === record.dataUrl
          );

          if (linkedReq) {
            updateRequest({
              ...linkedReq,
              Citizen_ID: citizenId,
              CitizenName: cleanName,
              Entity: ocr.entity || linkedReq.Entity,
              Details: ocr.details || linkedReq.Details,
              Priority: (ocr.priority as any) || linkedReq.Priority,
              DeputyNotes: `تم استخراج وتحديث الاسم (${cleanName}) عبر التعرف الضوئي الذكي (OCR)`
            });
          }

          // 3. Update IndexedDB Image Record
          await updateImageMetadataInDB(record.id, {
            citizenName: cleanName,
            citizenId: citizenId,
            extractedText: ocr.fullExtractedText,
            entity: ocr.entity,
            details: ocr.details,
            phone: ocr.phone,
            ocrProcessed: true,
            confidence: ocr.confidence,
            priority: ocr.priority
          });
        }
      } catch (err) {
        console.error('Error during batch OCR re-scan for record:', record.id, err);
      }

      idx++;
      setReOcrProgress(prev => ({
        ...prev,
        successCount: success
      }));

      await new Promise(r => setTimeout(r, 40));
    }

    setReOcrProgress(prev => ({
      ...prev,
      isFinished: true
    }));

    addAuditLog(
      'إعادة فحص الصور بالذكاء الاصطناعي وOCR',
      'أرشيف الصور الذكية',
      `تم فحص ${targetImages.length} صورة واستخراج بيانات ${success} معاملة بأسماء المواطنين الحقيقيين`
    );

    await refreshImagesFromDB();
    setIsReScanningOcr(false);
  };

  // Run OCR on a single image record
  const handleRunOcrOnSingleImage = async (record: ImageRecord) => {
    setIsAnalyzingSingleCardId(record.id);
    try {
      const ocr = await analyzeImageWithOCR(record.dataUrl, record.fileName);
      setSingleOcrTargetRecord(record);
      setSingleOcrResult(ocr);
      setSingleOcrEditedName(ocr.citizenName || record.citizenName);
      setSingleOcrEditedEntity(ocr.entity || 'وزارة العمل والشؤون الاجتماعية (شبكة الحماية)');
      setSingleOcrEditedDetails(ocr.details || '');
      setSingleOcrEditedPhone(ocr.phone || '');
      setShowSingleOcrResultModal(true);
    } catch (err: any) {
      alert(`حدث خطأ أثناء فحص الصورة عبر OCR: ${err.message || 'تعذر الاتصال بخدمة الذكاء الاصطناعي'}`);
    } finally {
      setIsAnalyzingSingleCardId(null);
    }
  };

  // Confirm Single OCR Save
  const handleConfirmSingleOcrSave = async () => {
    if (!singleOcrTargetRecord) return;
    setIsSavingSingleOcr(true);
    try {
      const cleanName = singleOcrEditedName.trim() || singleOcrTargetRecord.citizenName;
      const normName = cleanName.toLowerCase();

      // Find or create citizen
      let targetCitizen = citizenMapByName.get(normName) || citizens.find(c => 
        c.FullName && (c.FullName.includes(cleanName) || cleanName.includes(c.FullName))
      );

      let citizenId = singleOcrTargetRecord.citizenId || '';
      if (targetCitizen) {
        citizenId = targetCitizen.Citizen_ID;
        if (singleOcrEditedPhone && (!targetCitizen.Phone1 || targetCitizen.Phone1 === '07800000000')) {
          updateCitizen({ ...targetCitizen, Phone1: singleOcrEditedPhone });
        }
      } else {
        const newCitizen = addCitizen({
          FullName: cleanName,
          Phone1: singleOcrEditedPhone || '07800000000',
          National_ID: `NID-${Math.floor(100000000 + Math.random() * 900000000)}`,
          Gender: 'ذكر',
          Rating: 'A',
          District: 'ذي قار',
          SubDistrict: 'المركز',
          AttendanceType: 'شخصياً',
          DependencyStatus: 'مستقل',
          RegisteredVia: 'مسح OCR فردي'
        });
        citizenId = newCitizen.Citizen_ID;
      }

      // Update linked Request
      const linkedReq = requests.find(r => 
        r.Request_ID === singleOcrTargetRecord.id || 
        (r.Citizen_ID && r.Citizen_ID === singleOcrTargetRecord.citizenId) ||
        r.AttachedRequestImage === singleOcrTargetRecord.dataUrl
      );

      if (linkedReq) {
        updateRequest({
          ...linkedReq,
          Citizen_ID: citizenId,
          CitizenName: cleanName,
          Entity: singleOcrEditedEntity || linkedReq.Entity,
          Details: singleOcrEditedDetails || linkedReq.Details,
          Priority: (singleOcrResult?.priority as any) || linkedReq.Priority,
          DeputyNotes: `تم استخراج وتحديث الاسم (${cleanName}) عبر التعرف الضوئي الذكي (OCR)`
        });
      }

      // Update IndexedDB record
      await updateImageMetadataInDB(singleOcrTargetRecord.id, {
        citizenName: cleanName,
        citizenId: citizenId,
        extractedText: singleOcrResult?.fullExtractedText || singleOcrTargetRecord.extractedText,
        entity: singleOcrEditedEntity,
        details: singleOcrEditedDetails,
        phone: singleOcrEditedPhone,
        ocrProcessed: true,
        confidence: singleOcrResult?.confidence || 90,
        priority: singleOcrResult?.priority || 'عاجل'
      });

      await refreshImagesFromDB();
      setShowSingleOcrResultModal(false);
    } catch (err: any) {
      alert(`حدث خطأ أثناء حفظ التعديلات: ${err.message}`);
    } finally {
      setIsSavingSingleOcr(false);
    }
  };

  // Analyze image in Manual Add Modal
  const handleManualImageOcrAnalysis = async () => {
    if (!manualImageData) {
      alert('يرجى اختيار صورة أولاً لتشغيل الفحص الذكي OCR عليها.');
      return;
    }
    setIsAnalyzingManualImage(true);
    setManualOcrMessage(null);
    try {
      const result = await analyzeImageWithOCR(manualImageData, manualImageName || 'طلب_يدوي.jpg');
      if (result.success && result.citizenName) {
        setManualCitizenName(result.citizenName);
        if (result.title) setManualHonorific(result.title);
        if (result.entity) setManualEntity(result.entity);
        if (result.details) setManualDetails(result.details);
        if (result.priority) setManualPriority(result.priority);
        setManualOcrMessage(`تم بنجاح التعرف على صاحب الطلب: "${result.citizenName}" بنسبة دقة ${result.confidence}%`);
      } else {
        setManualOcrMessage('تم مسح الصورة، لم يتم العثور على اسم واضح. يمكنك كتابة الاسم يدوياً.');
      }
    } catch (err: any) {
      setManualOcrMessage(`تعذر الفحص: ${err.message || 'خطأ في الاتصال'}`);
    } finally {
      setIsAnalyzingManualImage(false);
    }
  };

  // Helper to read file as DataURL
  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  // Handle Manual Single Request & Image Upload
  const handleSaveManualRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = manualCitizenName.trim();
    if (!cleanName) return;

    const normName = cleanName.toLowerCase();
    let targetCitizen = citizenMapByName.get(normName) || citizens.find(c => 
      c.FullName && (c.FullName.includes(cleanName) || cleanName.includes(c.FullName))
    );

    let citizenId = '';
    if (targetCitizen) {
      citizenId = targetCitizen.Citizen_ID;
    } else {
      const newCitizen = addCitizen({
        FullName: cleanName,
        Phone1: '07800000000',
        National_ID: `NID-${Math.floor(100000000 + Math.random() * 900000000)}`,
        Gender: manualHonorific.includes('سيدة') || manualHonorific.includes('مواطنة') ? 'أنثى' : 'ذكر',
        Rating: 'A',
        District: 'ذي قار',
        SubDistrict: 'المركز',
        AttendanceType: 'شخصياً',
        DependencyStatus: 'مستقل',
        RegisteredVia: 'إدارة'
      });
      citizenId = newCitizen.Citizen_ID;
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const imageToSave = manualImageData || 'https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=1200&q=80';
    const filename = manualImageName || `طلب_${cleanName}.jpg`;

    const createdReq = addRequest({
      Citizen_ID: citizenId,
      CitizenName: cleanName,
      Entity: manualEntity,
      RequestStatus: 'مستلم',
      ProcessingStatus: 'قيد التدقيق',
      Priority: manualPriority,
      Details: manualDetails || `طلب مقدم من ${manualHonorific} ${cleanName}`,
      AttachmentRequest: filename,
      AttachedRequestImage: imageToSave,
      CreatedBy: currentUser ? currentUser.FullName : 'قسم الإدارة',
      DeputyNotes: `${manualHonorific} ${cleanName} - تسجيل يدوي`,
      AttendanceType: 'شخصياً',
      DependencyStatus: 'مستقل'
    });

    addDocument({
      Citizen_ID: citizenId,
      CitizenName: cleanName,
      Title: `طلب يدوي: ${cleanName} - ${manualEntity}`,
      Category: 'طلب مقدم',
      FileUrl: imageToSave,
      FileType: 'image',
      FileSize: '1.2 MB',
      UploadedBy: currentUser?.FullName || 'قسم الإدارة'
    });

    const newRecord: ImageRecord = {
      id: createdReq.Request_ID,
      citizenName: cleanName,
      citizenId: citizenId,
      dataUrl: imageToSave,
      fileName: filename,
      fileSize: '1.2 MB',
      mimeType: 'image/jpeg',
      uploadedAt: nowStr
    };

    await saveImageToDB(newRecord);

    addAuditLog(
      'إضافة طلب وصورة يدوياً',
      'أرشيف الصور الذكية والطباعة',
      `تسجيل طلب يدوي للمواطن ${cleanName} (${createdReq.Request_ID})`
    );

    await refreshImagesFromDB();

    // Reset Form
    setShowManualAddModal(false);
    setManualCitizenName('');
    setManualDetails('');
    setManualImageData('');
    setManualImageName('');
  };

  // Handle Editing Metadata of an image
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingImage) return;

    const trimmedName = editCitizenName.trim();
    if (!trimmedName) return;

    // Update in IndexedDB
    await updateImageMetadataInDB(editingImage.id, {
      citizenName: trimmedName
    });

    // Update corresponding request in AppContext if found
    const targetReq = requests.find(r => r.Request_ID === editingImage.id || r.AttachmentRequest === editingImage.fileName);
    if (targetReq) {
      updateRequest({
        ...targetReq,
        CitizenName: trimmedName,
        Entity: editEntity || targetReq.Entity,
        Details: editDetails || targetReq.Details,
        Priority: editPriority || targetReq.Priority
      });
    }

    addAuditLog(
      'تعديل معلومات صورة طلب',
      'أرشيف الصور الذكية والطباعة',
      `تعديل اسم صاحب الصورة ${editingImage.id} إلى ${trimmedName}`
    );

    await refreshImagesFromDB();
    setEditingImage(null);
  };

  // Handle Deleting an Image
  const handleDeleteImage = async (imgId: string, citizenName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف صورة ومعاملة "${citizenName}"؟`)) {
      return;
    }

    await deleteImageFromDB(imgId);

    // Also delete request if matched
    const targetReq = requests.find(r => r.Request_ID === imgId);
    if (targetReq) {
      deleteRequest(targetReq.Request_ID);
    }

    addAuditLog(
      'حذف صورة ومعاملة',
      'أرشيف الصور الذكية والطباعة',
      `حذف صورة المعاملة ${imgId} للمواطن ${citizenName}`
    );

    await refreshImagesFromDB();
    if (previewImage?.record.id === imgId) {
      setPreviewImage(null);
    }
  };

  // Handle Bulk Deleting Selected Images
  const handleBulkDeleteSelected = async () => {
    if (selectedImageIds.size === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedImageIds.size} صورة محددة نهائياً من الأرشيف؟`)) {
      return;
    }

    const idsArray: string[] = Array.from(selectedImageIds);
    await deleteBatchImagesFromDB(idsArray);

    // Delete requests as well
    for (const id of idsArray) {
      const targetReq = requests.find(r => r.Request_ID === id);
      if (targetReq) {
        deleteRequest(targetReq.Request_ID);
      }
    }

    addAuditLog(
      'حذف جماعي لصور ومعاملات',
      'أرشيف الصور الذكية والطباعة',
      `تم حذف ${idsArray.length} صورة ومعاملة من الأرشيف`
    );

    setSelectedImageIds(new Set());
    await refreshImagesFromDB();
  };

  // Toggle selection
  const toggleSelectImage = (id: string) => {
    setSelectedImageIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all or none
  const toggleSelectAll = () => {
    if (selectedImageIds.size === filteredImages.length) {
      setSelectedImageIds(new Set());
    } else {
      setSelectedImageIds(new Set(filteredImages.map(i => i.id)));
    }
  };

  // Print single image view
  const handlePrintPreview = () => {
    if (!previewImage) return;
    window.print();
  };

  // Download image
  const handleDownloadImage = (record: ImageRecord) => {
    const link = document.createElement('a');
    link.href = record.dataUrl;
    link.download = `طلب_المواطن_${record.citizenName.replace(/\s+/g, '_')}_${record.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter images based on search query, entity filter, and tabs
  const filteredImages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return storedImages.filter(img => {
      const linkedReq = requests.find(r => 
        r.Request_ID === img.id || 
        (r.Citizen_ID && r.Citizen_ID === img.citizenId) ||
        (r.CitizenName && r.CitizenName.trim().toLowerCase() === img.citizenName.trim().toLowerCase())
      );
      const linkedCitizen = citizens.find(c => 
        (img.citizenId && c.Citizen_ID === img.citizenId) || 
        (c.FullName && c.FullName.trim().toLowerCase() === img.citizenName.trim().toLowerCase())
      );

      // 1. Text Search: by citizen name, file name, request id, OCR text, details, entity, phone
      const matchesSearch = !q || (
        img.citizenName.toLowerCase().includes(q) ||
        img.fileName.toLowerCase().includes(q) ||
        img.id.toLowerCase().includes(q) ||
        (img.citizenId && img.citizenId.toLowerCase().includes(q)) ||
        (img.extractedText && img.extractedText.toLowerCase().includes(q)) ||
        (img.details && img.details.toLowerCase().includes(q)) ||
        (img.entity && img.entity.toLowerCase().includes(q)) ||
        (img.phone && img.phone.includes(q)) ||
        (linkedReq?.CitizenName && linkedReq.CitizenName.toLowerCase().includes(q)) ||
        (linkedReq?.Details && linkedReq.Details.toLowerCase().includes(q)) ||
        (linkedReq?.Entity && linkedReq.Entity.toLowerCase().includes(q)) ||
        (linkedCitizen?.FullName && linkedCitizen.FullName.toLowerCase().includes(q)) ||
        (linkedCitizen?.Phone1 && linkedCitizen.Phone1.includes(q)) ||
        (linkedCitizen?.Phone2 && linkedCitizen.Phone2.includes(q))
      );

      // 2. Entity filter
      const matchesEntity = selectedEntityFilter === 'all' || (linkedReq && linkedReq.Entity === selectedEntityFilter) || (img.entity === selectedEntityFilter);

      // 3. Tab filters
      let matchesTab = true;
      if (selectedFilterTab === 'multiple_requests') {
        const count = citizenRequestCounts.get(img.citizenId || '') || citizenRequestCounts.get(img.citizenName.trim().toLowerCase()) || 0;
        matchesTab = count > 1;
      } else if (selectedFilterTab === 'urgent') {
        matchesTab = linkedReq?.Priority === 'عاجل' || linkedReq?.Priority === 'خاص جداً' || img.priority === 'عاجل' || img.priority === 'خاص جداً';
      }

      return matchesSearch && matchesEntity && matchesTab;
    });
  }, [storedImages, searchQuery, selectedEntityFilter, selectedFilterTab, requests, citizens, citizenRequestCounts]);

  // Autocomplete / Quick match for citizen names based on search query
  const suggestedCitizens = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    const matched = citizens.filter(c => 
      c.FullName && (c.FullName.toLowerCase().includes(q) || (c.Phone1 && c.Phone1.includes(q)))
    ).slice(0, 5);

    const imageNames = new Set<string>(
      storedImages
        .filter(img => img.citizenName && img.citizenName.toLowerCase().includes(q))
        .map(img => img.citizenName.trim())
    );

    const extra: { FullName: string; Citizen_ID: string; Phone1: string; District: string }[] = [];
    imageNames.forEach((name: string) => {
      if (!matched.some(m => m.FullName.toLowerCase() === name.toLowerCase())) {
        extra.push({
          FullName: name,
          Citizen_ID: '',
          Phone1: '',
          District: 'الأرشيف'
        });
      }
    });

    return [...matched, ...extra].slice(0, 5);
  }, [searchQuery, citizens, storedImages]);

  // All requests matching the selected citizen for dossier
  const matchedCitizenRequests = useMemo(() => {
    if (!selectedCitizenDossier) return [];
    const nameLower = selectedCitizenDossier.name.toLowerCase().trim();
    const id = selectedCitizenDossier.id;
    return requests.filter(r => 
      (id && r.Citizen_ID === id) || 
      (r.CitizenName && r.CitizenName.toLowerCase().trim() === nameLower) ||
      (r.CitizenName && (r.CitizenName.toLowerCase().includes(nameLower) || nameLower.includes(r.CitizenName.toLowerCase().trim())))
    );
  }, [selectedCitizenDossier, requests]);

  // All OCR images matching the selected citizen for dossier
  const matchedCitizenImages = useMemo(() => {
    if (!selectedCitizenDossier) return [];
    const nameLower = selectedCitizenDossier.name.toLowerCase().trim();
    const id = selectedCitizenDossier.id;

    const fromDB = storedImages.filter(img => {
      if (id && img.citizenId === id) return true;
      if (img.citizenName) {
        const imgName = img.citizenName.toLowerCase().trim();
        return imgName.includes(nameLower) || nameLower.includes(imgName);
      }
      return false;
    });

    // Also include requests that have AttachedRequestImage
    const existingUrls = new Set(fromDB.map(i => i.dataUrl));
    const fromReqs: ImageRecord[] = [];
    matchedCitizenRequests.forEach(r => {
      if (r.AttachedRequestImage && !existingUrls.has(r.AttachedRequestImage)) {
        fromReqs.push({
          id: r.Request_ID,
          citizenName: r.CitizenName || selectedCitizenDossier.name,
          citizenId: id,
          dataUrl: r.AttachedRequestImage,
          fileName: r.AttachmentRequest || `طلب_${r.Request_ID}.jpg`,
          fileSize: '1.2 MB',
          mimeType: 'image/jpeg',
          uploadedAt: r.CreatedDate || 'مؤرشف سابقاً',
          extractedText: r.Details || '',
          entity: r.Entity,
          details: r.Details,
          priority: r.Priority,
          confidence: 90,
          ocrProcessed: true
        });
        existingUrls.add(r.AttachedRequestImage);
      }
    });

    return [...fromDB, ...fromReqs];
  }, [selectedCitizenDossier, storedImages, matchedCitizenRequests]);

  return (
    <div className="space-y-4 text-right">
      {/* Hidden File Input for Batch Upload (1,000 - 2,000 files) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        onChange={handleBatchFilesSelected}
        className="hidden"
      />

      {/* Header with Prominent Actions */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white border border-blue-900 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-300 flex items-center justify-center font-bold shadow-xs">
              <FileImage className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>أرشيف واستخراج صور المعاملات الذكي</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  سعة فائقة 1000 - 2000 صورة
                </span>
              </h2>
              <p className="text-xs text-blue-200/80">
                استخراج تلقائي لأسماء أصحاب الطلبات (السيد، المواطن، العميد، الشيخ...) وربطها فورياً بسجل المواطن ولوحة التحكم
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* RE-OCR EXISTING STORED IMAGES BUTTON */}
          <button
            onClick={() => handleStartReOcrCurrentImages(false)}
            disabled={isReScanningOcr || isUploadingBatch || storedImages.length === 0}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-950/40 cursor-pointer active:scale-95 disabled:opacity-50"
            title="فحص واستخراج أسماء المواطنين من جميع الصور المرفوعة مسبقاً عبر التعرف الضوئي OCR"
          >
            {isReScanningOcr ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-200" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-200" />
            )}
            <span>⚡ فحص الصور واستخراج الأسماء (OCR)</span>
          </button>

          {/* BULK UPLOAD BUTTON (1000 - 2000 images) */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingBatch || isReScanningOcr}
            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/40 cursor-pointer active:scale-95 disabled:opacity-50"
            title="إرفاق دفعة صور كبيرة (1000 إلى 2000 صورة) مع استخراج الأسماء تلقائياً عبر OCR"
          >
            <Upload className="w-4 h-4 text-emerald-200" />
            <span>إرفاق صور المعاملات (دفعة 1000 - 2000 صورة)</span>
          </button>

          {/* MANUAL ADD SINGLE REQUEST & IMAGE */}
          <button
            onClick={() => setShowManualAddModal(true)}
            className="flex-1 md:flex-none px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-950/40 cursor-pointer active:scale-95"
            title="إضافة طلب وكتابة اسم صاحب المعاملة يدوياً مع إرفاق الصورة"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة طلب بالاسم يدوياً</span>
          </button>

          {/* BULK DELETE BUTTON */}
          {selectedImageIds.size > 0 && (
            <button
              onClick={handleBulkDeleteSelected}
              className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-950/40 cursor-pointer active:scale-95"
              title="حذف الصور المحددة"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف ({selectedImageIds.size}) صورة</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Quick Filters Bar */}
      <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box with Real-time Citizen Autocomplete */}
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowSearchDropdown(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchDropdown(true);
              }}
              placeholder="ابحث باسم صاحب الطلب (مثلاً: حسن طالب، العميد حيدر)..."
              className="w-full pr-9 pl-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCitizenDossier(null);
                  setShowSearchDropdown(false);
                }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Suggestions Dropdown */}
            {showSearchDropdown && suggestedCitizens.length > 0 && (
              <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-30 p-1.5 space-y-1 max-h-60 overflow-y-auto">
                <div className="text-[10px] font-bold text-slate-400 px-2 py-1 flex items-center justify-between">
                  <span>نتائج مطابقة لاسم المراجع:</span>
                  <button 
                    onClick={() => setShowSearchDropdown(false)}
                    className="text-slate-400 hover:text-slate-600 text-[10px]"
                  >
                    إغلاق
                  </button>
                </div>
                {suggestedCitizens.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedCitizenDossier({
                        id: c.Citizen_ID,
                        name: c.FullName,
                        citizen: citizens.find(cit => cit.Citizen_ID === c.Citizen_ID)
                      });
                      setSearchQuery(c.FullName);
                      setShowSearchDropdown(false);
                    }}
                    className="w-full text-right p-2 rounded-lg hover:bg-blue-50 flex items-center justify-between text-xs transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                      <div>
                        <span className="font-bold text-slate-900">{c.FullName}</span>
                        {c.District && <span className="text-[10px] text-slate-400 font-normal mr-1.5">({c.District})</span>}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded flex items-center gap-1">
                      <span>عرض الطلبات وصور OCR</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            {selectedCitizenDossier && (
              <button
                onClick={() => setDossierViewMode('both')}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-blue-600 text-white shadow-xs animate-pulse"
              >
                <Users className="w-3.5 h-3.5" />
                <span>ملف المراجع: {selectedCitizenDossier.name}</span>
              </button>
            )}

            <button
              onClick={() => {
                setSelectedFilterTab('all');
                setSelectedCitizenDossier(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFilterTab === 'all' && !selectedCitizenDossier
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>جميع الصور المؤرشفة</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{storedImages.length}</span>
            </button>

            <button
              onClick={() => {
                setSelectedFilterTab('multiple_requests');
                setSelectedCitizenDossier(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFilterTab === 'multiple_requests'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>مواطنين لديهم أكثر من طلب</span>
            </button>

            <button
              onClick={() => {
                setSelectedFilterTab('urgent');
                setSelectedCitizenDossier(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFilterTab === 'urgent'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>طلبات عاجلة</span>
            </button>

            {filteredImages.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer flex items-center gap-1"
                title="تحديد الكل"
              >
                {selectedImageIds.size === filteredImages.length ? (
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>تحديد الكل</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Strip */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <div>
            يتم عرض <strong>{filteredImages.length}</strong> من إجمالي <strong>{storedImages.length}</strong> صورة محفوظة في المنظومة.
          </div>
          {searchQuery && (
            <div className="text-blue-700 font-bold flex items-center gap-2">
              <span>نتائج البحث عن: "{searchQuery}"</span>
              {selectedCitizenDossier && (
                <button
                  onClick={() => setSelectedCitizenDossier(null)}
                  className="text-xs text-rose-600 hover:underline font-normal cursor-pointer"
                >
                  (عرض شبكة الصور)
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CITIZEN DOSSIER PANEL (REQUESTS + OCR IMAGES) */}
      {selectedCitizenDossier && (
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-blue-200 shadow-md space-y-4 animate-in fade-in duration-300">
          {/* Dossier Header Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  ملف المراجع الشامل
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{selectedCitizenDossier.name}</span>
                  {selectedCitizenDossier.citizen?.Citizen_ID && (
                    <span className="font-mono text-xs text-blue-300 font-semibold">
                      ({selectedCitizenDossier.citizen.Citizen_ID})
                    </span>
                  )}
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs text-blue-200/80 flex-wrap">
                {selectedCitizenDossier.citizen?.Phone1 && (
                  <span className="font-mono flex items-center gap-1" dir="ltr">
                    📞 {selectedCitizenDossier.citizen.Phone1}
                  </span>
                )}
                {selectedCitizenDossier.citizen?.District && (
                  <span>📍 {selectedCitizenDossier.citizen.District} - {selectedCitizenDossier.citizen.SubDistrict || 'المركز'}</span>
                )}
                {selectedCitizenDossier.citizen?.Job && (
                  <span>💼 {selectedCitizenDossier.citizen.Job}</span>
                )}
              </div>
            </div>

            {/* Quick Metrics & Close */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-center">
                <span className="text-[10px] text-blue-200 block">إجمالي الطلبات</span>
                <span className="text-sm font-bold text-white font-mono">{matchedCitizenRequests.length}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-center">
                <span className="text-[10px] text-amber-200 block">صور ومستندات OCR</span>
                <span className="text-sm font-bold text-amber-300 font-mono">{matchedCitizenImages.length}</span>
              </div>
              <button
                onClick={() => {
                  setSelectedCitizenDossier(null);
                  setSearchQuery('');
                }}
                className="px-3 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                title="إغلاق ملف المراجع والعودة لجميع الصور"
              >
                <X className="w-4 h-4" />
                <span>إغلاق الملف</span>
              </button>
            </div>
          </div>

          {/* Dossier Filter Tabs */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setDossierViewMode('both')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dossierViewMode === 'both' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                عرض متكامل (الطلبات وصور الـ OCR معاً)
              </button>
              <button
                onClick={() => setDossierViewMode('requests')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dossierViewMode === 'requests' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                الطلبات والمقترحات فقط ({matchedCitizenRequests.length})
              </button>
              <button
                onClick={() => setDossierViewMode('ocr')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dossierViewMode === 'ocr' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                صور الـ OCR فقط ({matchedCitizenImages.length})
              </button>
            </div>

            {selectedCitizenDossier.citizen && onOpenCitizenHistory && (
              <button
                onClick={() => {
                  onOpenCitizenHistory(selectedCitizenDossier.citizen!.Citizen_ID);
                }}
                className="text-xs text-blue-700 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>فتح السجل العام للمواطن</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dossier Content Grid */}
          <div className={`grid gap-4 ${dossierViewMode === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            {/* 1. Requests Column */}
            {(dossierViewMode === 'both' || dossierViewMode === 'requests') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <FolderKanban className="w-4 h-4 text-blue-600" />
                    <span>كافة المعاملات والطلبات الرسمية ({matchedCitizenRequests.length})</span>
                  </h4>
                </div>

                {matchedCitizenRequests.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                    لا توجد طلبات إدارية مسجلة لهذا الاسم حتى الآن.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                    {matchedCitizenRequests.map((req, rIdx) => (
                      <div key={`${req.Request_ID}-${rIdx}`} className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition-all space-y-2 text-right">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700">{req.Request_ID}</span>
                            <span className="font-bold text-slate-900">{req.Entity}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              req.Priority === 'عاجل' || req.Priority === 'خاص جداً' 
                                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {req.Priority}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              req.ProcessingStatus === 'منجز' 
                                ? 'bg-teal-50 text-teal-700 border-teal-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {req.ProcessingStatus}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 leading-relaxed">{req.Details}</p>

                        {req.DeputyNotes && (
                          <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200 text-[11px] text-amber-900 font-medium">
                            <strong>توجيه النائب:</strong> {req.DeputyNotes}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-200 font-mono">
                          <span>{req.CreatedDate || 'تاريخ التسجيل'}</span>
                          <span>المسجل: {req.CreatedBy || 'الإدارة'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. OCR Images Column */}
            {(dossierViewMode === 'both' || dossierViewMode === 'ocr') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>كافة الصور والمستندات المستخرجة عبر OCR ({matchedCitizenImages.length})</span>
                  </h4>
                </div>

                {matchedCitizenImages.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                    لا توجد صور أو معاملات OCR مرتبطة بهذا المراجع.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {matchedCitizenImages.map((img) => (
                      <div key={img.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-300 transition-all space-y-2.5">
                        <div className="flex gap-3">
                          <div 
                            onClick={() => {
                              setPreviewImage({ record: img, request: requests.find(r => r.Request_ID === img.id), citizen: selectedCitizenDossier.citizen });
                              setZoomLevel(1);
                              setRotation(0);
                            }}
                            className="relative w-20 h-24 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-900 cursor-pointer group"
                          >
                            <img 
                              src={img.dataUrl} 
                              alt={img.fileName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye className="w-4 h-4" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0 space-y-1 text-right">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-xs text-slate-900 truncate">{img.fileName}</span>
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

                            {img.phone && (
                              <div className="text-[10px] text-slate-500 font-mono" dir="ltr">
                                📞 {img.phone}
                              </div>
                            )}

                            <div className="text-[10px] text-slate-400 font-mono">
                              {img.uploadedAt}
                            </div>
                          </div>
                        </div>

                        {/* Extracted OCR Text */}
                        {img.extractedText && (
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 max-h-24 overflow-y-auto leading-relaxed">
                            <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-100 text-[10px] text-slate-400">
                              <span>نص OCR المستخرج بالذكاء الاصطناعي:</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(img.extractedText || '');
                                  setCopiedOcrTextId(img.id);
                                  setTimeout(() => setCopiedOcrTextId(null), 2000);
                                }}
                                className="text-blue-600 hover:text-blue-700 flex items-center gap-0.5 font-bold cursor-pointer"
                              >
                                {copiedOcrTextId === img.id ? (
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

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-200/60">
                          <button
                            onClick={() => handleDownloadImage(img)}
                            className="px-2 py-1 rounded bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>تحميل</span>
                          </button>
                          <button
                            onClick={() => {
                              setPreviewImage({ record: img, request: requests.find(r => r.Request_ID === img.id), citizen: selectedCitizenDossier.citizen });
                              setZoomLevel(1);
                              setRotation(0);
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
            )}
          </div>
        </div>
      )}

      {/* Images Grid */}
      {isLoadingImages ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="text-xs text-slate-500">جاري تحميل وفهرسة أرشيف الصور من قاعدة البيانات...</p>
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <FileImage className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {searchQuery ? `لا توجد صور محفوظة مطابقة للبحث "${searchQuery}"` : 'لا توجد صور طلبات مؤرشفة حتى الآن'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            يمكنك الضغط على زر <strong>"إرفاق صور المعاملات (دفعة 1000 - 2000 صورة)"</strong> لرفع وأرشفة مجلدات الصور دفعة واحدة واستخراج أسماء أصحاب الطلبات فورياً، أو <strong>"إضافة طلب بالاسم يدوياً"</strong>.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Upload className="w-4 h-4" />
              <span>رفع أول دفعة صور الآن</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredImages.map((record, idx) => {
            const linkedReq = requests.find(r => r.Request_ID === record.id || (r.Citizen_ID && r.Citizen_ID === record.citizenId));
            const linkedCitizen = citizens.find(c => c.Citizen_ID === record.citizenId || (c.FullName && c.FullName.trim().toLowerCase() === record.citizenName.trim().toLowerCase()));
            
            // Total requests submitted by this citizen in the system
            const totalRequestsCount = citizenRequestCounts.get(record.citizenId || '') || citizenRequestCounts.get(record.citizenName.trim().toLowerCase()) || 1;

            const isSelected = selectedImageIds.has(record.id);

            return (
              <div 
                key={`${record.id || 'rec'}-${idx}`}
                className={`group rounded-xl bg-white border transition-all overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                {/* Image Thumbnail with Overlay Controls */}
                <div className="relative aspect-4/3 bg-slate-100 overflow-hidden cursor-pointer" onClick={() => {
                  setPreviewImage({ record, request: linkedReq, citizen: linkedCitizen });
                  setZoomLevel(1);
                  setRotation(0);
                }}>
                  <img 
                    src={record.dataUrl} 
                    alt={record.citizenName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Multi-select checkbox */}
                  <div 
                    className="absolute top-2 right-2 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectImage(record.id);
                    }}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-colors shadow-xs ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-white/90 text-slate-400 hover:text-slate-800'
                    }`}>
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Multiple requests indicator badge */}
                  {totalRequestsCount > 1 && (
                    <div className="absolute top-2 left-2 z-10">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-900/90 text-purple-200 border border-purple-500/40 backdrop-blur-xs flex items-center gap-1 shadow-xs">
                        <Layers className="w-3 h-3 text-purple-300" />
                        <span>{totalRequestsCount} طلبات مسجلة</span>
                      </span>
                    </div>
                  )}

                  {/* Quick Preview Hover Overlay */}
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-white/95 text-slate-900 text-xs font-bold shadow-md flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>معاينة وتكبير الصورة</span>
                    </span>
                  </div>
                </div>

                {/* Card Content & Citizen Info */}
                <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <h4 
                        className="font-bold text-slate-900 text-xs line-clamp-1 hover:text-blue-600 cursor-pointer"
                        title={record.citizenName}
                        onClick={() => {
                          setPreviewImage({ record, request: linkedReq, citizen: linkedCitizen });
                          setZoomLevel(1);
                          setRotation(0);
                        }}
                      >
                        {record.citizenName}
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {record.id}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {linkedReq?.Entity || 'وزارة العمل والشؤون الاجتماعية'}
                    </div>

                    {/* Badge line */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {record.ocrProcessed && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-0.5" title="تم استخراج الاسم والتفاصيل عبر OCR">
                          <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                          <span>OCR</span>
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        {linkedCitizen?.AttendanceType || 'شخصياً'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {linkedCitizen?.DependencyStatus || 'مستقل'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {record.uploadedAt.split(' ')[0]}
                      </span>
                    </div>

                    {/* View all citizen requests & OCR images button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCitizenDossier({
                          id: record.citizenId || '',
                          name: record.citizenName,
                          citizen: linkedCitizen
                        });
                        setSearchQuery(record.citizenName);
                        window.scrollTo({ top: 300, behavior: 'smooth' });
                      }}
                      className="w-full mt-2 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-blue-200/60"
                      title="عرض كافة المعاملات والطلبات والصور المستخرجة OCR لهذا المراجع"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>عرض كافة طلبات وصور المراجع ({totalRequestsCount})</span>
                    </button>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {/* Run OCR on this card */}
                      <button
                        onClick={() => handleRunOcrOnSingleImage(record)}
                        disabled={isAnalyzingSingleCardId === record.id}
                        className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer disabled:opacity-50"
                        title="فحص واستخراج اسم صاحب المعاملة بالذكاء الاصطناعي (OCR)"
                      >
                        {isAnalyzingSingleCardId === record.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setEditingImage(record);
                          setEditCitizenName(record.citizenName);
                          setEditDetails(linkedReq?.Details || '');
                          setEditEntity(linkedReq?.Entity || '');
                          setEditPriority(linkedReq?.Priority || 'عاجل');
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="تعديل اسم صاحب الصورة أو تفاصيل المعاملة"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDownloadImage(record)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="تحميل الصورة الأصلية"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setPreviewImage({ record, request: linkedReq, citizen: linkedCitizen });
                          setTimeout(() => window.print(), 100);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
                        title="طباعة المعاملة والصورة فورياً"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteImage(record.id, record.citizenName)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="حذف الصورة والمعاملة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BATCH UPLOAD PROGRESS MODAL */}
      {showBatchModal && isUploadingBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                معالجة ذكية جارية...
              </span>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <span>أرشفة واستخراج صور المعاملات (1000 - 2000 صورة)</span>
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              يقوم النظام الآن بقراءة وفهرسة الملفات، استخراج أسماء أصحاب الطلبات، ومطابقتها مع قاعدة بيانات المواطنين ولوحة التحكم.
            </p>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-700 font-mono">{batchProgress.percentage}%</span>
                <span className="text-slate-700">
                  تمت معالجة {batchProgress.current} من أصل {batchProgress.total} صورة
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-150"
                  style={{ width: `${batchProgress.percentage}%` }}
                />
              </div>
            </div>

            {/* Live Stats */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200/60">
                <div className="text-[10px] text-blue-600 font-bold">مطابقة مع مسجلين</div>
                <div className="text-base font-black text-blue-900 font-mono">{batchProgress.matchedCitizens}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/60">
                <div className="text-[10px] text-emerald-600 font-bold">مواطنين جدد</div>
                <div className="text-base font-black text-emerald-900 font-mono">{batchProgress.createdCitizens}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/60">
                <div className="text-[10px] text-amber-700 font-bold">استخراج OCR ذكي</div>
                <div className="text-base font-black text-amber-900 font-mono">{batchProgress.ocrSuccessCount}</div>
              </div>
            </div>

            {batchProgress.currentExtractedName && (
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">الاسم المستخرج حالياً:</span>
                <span className="font-bold text-blue-900">{batchProgress.currentExtractedName}</span>
              </div>
            )}

            <div className="text-[11px] text-slate-400 font-mono truncate">
              الملف الحالي: {batchProgress.currentFilename}
            </div>
          </div>
        </div>
      )}

      {/* MANUAL ADD SINGLE REQUEST & IMAGE MODAL */}
      {showManualAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 text-right my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                onClick={() => setShowManualAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>إضافة طلب وكتابة اسم صاحب المعاملة يدوياً مع إرفاق الصورة</span>
              </h3>
            </div>

            <form onSubmit={handleSaveManualRequest} className="space-y-3.5">
              {/* Image Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  إرفاق صورة المعاملة أو الطلب *
                </label>
                <input
                  ref={manualFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const d = await readFileAsDataUrl(f);
                      setManualImageData(d);
                      setManualImageName(f.name);
                      // If name empty, try auto-filling from filename
                      if (!manualCitizenName) {
                        const info = extractCitizenInfoFromFilename(f.name);
                        setManualCitizenName(info.cleanName);
                        if (info.title) setManualHonorific(info.title);
                        if (info.entity) setManualEntity(info.entity);
                      }
                    }
                  }}
                  className="hidden"
                />

                <div 
                  onClick={() => manualFileInputRef.current?.click()}
                  className="p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/30 text-center cursor-pointer transition-colors"
                >
                  {manualImageData ? (
                    <div className="space-y-2">
                      <img src={manualImageData} alt="معاينة" className="max-h-36 mx-auto rounded-lg object-contain" />
                      <span className="text-xs text-blue-700 font-bold block">{manualImageName} (انقر للتغيير)</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <FileImage className="w-8 h-8 text-slate-400 mx-auto" />
                      <span className="text-xs font-bold text-slate-700 block">انقر هنا لاختيار صورة المعاملة أو المستند</span>
                      <span className="text-[11px] text-slate-400 block">يدعم صيغ JPG, PNG, WEBP</span>
                    </div>
                  )}
                </div>

                {/* Optional Quick AI OCR Extraction for Manual Image */}
                {manualImageData && (
                  <div className="mt-2 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="text-[11px] text-amber-900 font-medium flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{manualOcrMessage || 'يمكنك استخراج اسم صاحب الطلب والتفاصيل آلياً بالذكاء الاصطناعي'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleManualImageOcrAnalysis}
                      disabled={isAnalyzingManualImage}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {isAnalyzingManualImage ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري الفحص...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>قراءة OCR</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Title / Honorific + Full Name */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">اللقب / الصفة</label>
                  <select
                    value={manualHonorific}
                    onChange={(e) => setManualHonorific(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="السيد">السيد</option>
                    <option value="السيدة">السيدة</option>
                    <option value="المواطن">المواطن</option>
                    <option value="المواطنة">المواطنة</option>
                    <option value="العميد">العميد</option>
                    <option value="العقيد">العقيد</option>
                    <option value="اللواء">اللواء</option>
                    <option value="الرائد">الرائد</option>
                    <option value="المقدم">المقدم</option>
                    <option value="الشيخ">الشيخ</option>
                    <option value="الدكتور">الدكتور</option>
                    <option value="الأستاذ">الأستاذ</option>
                    <option value="الحاج">الحاج</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">اسم صاحب الطلب (يدوياً) *</label>
                  <input
                    type="text"
                    required
                    value={manualCitizenName}
                    onChange={(e) => setManualCitizenName(e.target.value)}
                    placeholder="اكتب الاسم الكامل لصاحب المعاملة..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Entity */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الجهة المعنية *</label>
                <input
                  type="text"
                  required
                  value={manualEntity}
                  onChange={(e) => setManualEntity(e.target.value)}
                  placeholder="الوزارة، الدائرة، أو الهيئة الحكومية..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الأولوية</label>
                <select
                  value={manualPriority}
                  onChange={(e) => setManualPriority(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="عاجل">عاجل</option>
                  <option value="خاص جداً">خاص جداً</option>
                  <option value="عام">عام</option>
                </select>
              </div>

              {/* Details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">شرح وتفاصيل المعاملة</label>
                <textarea
                  rows={2}
                  value={manualDetails}
                  onChange={(e) => setManualDetails(e.target.value)}
                  placeholder="تفاصيل الطلب أو هامش النائب..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  حفظ الطلب وأرشفة الصورة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT METADATA MODAL */}
      {editingImage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                onClick={() => setEditingImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <span>تعديل معلومات واسم صاحب الصورة</span>
              </h3>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم صاحب الطلب *</label>
                <input
                  type="text"
                  required
                  value={editCitizenName}
                  onChange={(e) => setEditCitizenName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الجهة المعنية</label>
                <input
                  type="text"
                  value={editEntity}
                  onChange={(e) => setEditEntity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تفاصيل وشرح الطلب</label>
                <textarea
                  rows={2}
                  value={editDetails}
                  onChange={(e) => setEditDetails(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingImage(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL-SCREEN HD IMAGE PREVIEW / ZOOM / PRINT MODAL */}
      {previewImage && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col z-50">
          {/* Header Action Bar */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 text-white flex items-center justify-between gap-3 px-4 shrink-0">
            <div className="flex items-center gap-2">
              <FileImage className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-bold text-sm text-white">
                  معاينة صورة المعاملة: {previewImage.record.citizenName}
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  {previewImage.record.id} • {previewImage.record.fileName}
                </span>
              </div>
            </div>

            {/* Zoom / Rotate / Print Controls */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs flex items-center gap-1 cursor-pointer"
                title="تكبير"
              >
                <ZoomIn className="w-4 h-4" />
                <span className="hidden sm:inline">تكبير</span>
              </button>

              <button
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs flex items-center gap-1 cursor-pointer"
                title="تصغير"
              >
                <ZoomOut className="w-4 h-4" />
                <span className="hidden sm:inline">تصغير</span>
              </button>

              <button
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs flex items-center gap-1 cursor-pointer"
                title="تدوير"
              >
                <RotateCw className="w-4 h-4" />
                <span className="hidden sm:inline">تدوير</span>
              </button>

              <button
                onClick={() => {
                  setZoomLevel(1);
                  setRotation(0);
                }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs cursor-pointer"
                title="إعادة ضبط"
              >
                100%
              </button>

              {previewImage.record.driveWebViewLink && (
                <a
                  href={previewImage.record.driveWebViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="فتح في Google Drive"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح في Google Drive ↗</span>
                </a>
              )}

              <button
                onClick={handlePrintPreview}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="طباعة"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة المعاملة</span>
              </button>

              <button
                onClick={() => handleDownloadImage(previewImage.record)}
                className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs cursor-pointer"
                title="تحميل"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-white text-xs cursor-pointer"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Viewer Area */}
          <div className="flex-1 overflow-auto p-6 flex items-center justify-center relative">
            <div 
              className="transition-transform duration-200 origin-center select-none"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
              }}
            >
              <img 
                src={previewImage.record.dataUrl} 
                alt={previewImage.record.citizenName}
                className="max-h-[82vh] max-w-[90vw] object-contain rounded-lg shadow-2xl border border-slate-700 bg-white"
              />
            </div>
          </div>

          {/* Printable Container for standard window.print() */}
          <div className="hidden print:block fixed inset-0 bg-white p-6 z-[9999]">
            <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
              <h2 className="text-lg font-bold">مكتب النائب علا عودة الناشي</h2>
              <p className="text-xs">المعاملة الرسمية والطلب المقدم المؤرشف</p>
              <div className="text-xs font-bold mt-1">
                صاحب المعاملة: {previewImage.record.citizenName} • رقم المعاملة: {previewImage.record.id}
              </div>
            </div>
            <div className="flex justify-center">
              <img 
                src={previewImage.record.dataUrl} 
                alt={previewImage.record.citizenName}
                className="max-w-full max-h-[88vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* RE-OCR PROGRESS MODAL FOR STORED IMAGES */}
      {showReOcrModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 text-right">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold px-2 py-1 rounded-md border ${
                reOcrProgress.isFinished 
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                  : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}>
                {reOcrProgress.isFinished ? 'اكتمل الفحص!' : 'فحص OCR جارٍ...'}
              </span>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <span>فحص الصور واستخراج أسماء المواطنين</span>
              </h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              يقوم محرك الذكاء الاصطناعي بقراءة النصوص والمستندات في الصور لاستخراج أسماء أصحاب المعاملات الحقيقيين، أرقام الهواتف، والجهات المعنية وحفظها فورياً.
            </p>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-amber-700 font-mono">{reOcrProgress.percentage}%</span>
                <span className="text-slate-700">
                  فحص {reOcrProgress.current} من {reOcrProgress.total} صورة
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200">
                <div 
                  className={`h-full rounded-full transition-all duration-150 ${
                    reOcrProgress.isFinished 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600' 
                      : 'bg-gradient-to-r from-amber-500 to-orange-600'
                  }`}
                  style={{ width: `${reOcrProgress.percentage}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[11px] text-amber-800 font-bold">معاملات تم استخراج أسمائها</div>
                <div className="text-xl font-black text-amber-950 font-mono">{reOcrProgress.successCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-[11px] text-blue-800 font-bold">إجمالي الصور المستهدفة</div>
                <div className="text-xl font-black text-blue-950 font-mono">{reOcrProgress.total}</div>
              </div>
            </div>

            {reOcrProgress.currentName && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">جاري فحص:</span>
                <span className="font-bold text-slate-900 truncate max-w-[240px]">{reOcrProgress.currentName}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowReOcrModal(false)}
                disabled={isReScanningOcr}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-40"
              >
                {reOcrProgress.isFinished ? 'إغلاق وعرض النتائج' : 'إغلاق ومتابعة في الخلفية'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE OCR RESULT & VERIFICATION MODAL */}
      {showSingleOcrResultModal && singleOcrTargetRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 text-right my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <button
                onClick={() => setShowSingleOcrResultModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>نتائج الفحص الذكي بالتعرف الضوئي (OCR)</span>
              </h3>
            </div>

            {/* Thumbnail + Result summary */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <img 
                src={singleOcrTargetRecord.dataUrl} 
                alt="معاينة" 
                className="w-16 h-16 rounded-lg object-cover border border-slate-300 shrink-0" 
              />
              <div className="space-y-1 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {singleOcrTargetRecord.fileName}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">{singleOcrTargetRecord.id}</span>
                  {singleOcrResult?.confidence !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      دقة التعرف: {Math.round(singleOcrResult.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Form Fields for verification */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم صاحب المعاملة المستخرج *
                </label>
                <input
                  type="text"
                  value={singleOcrEditedName}
                  onChange={(e) => setSingleOcrEditedName(e.target.value)}
                  placeholder="اسم المواطن الرباعي أو الثلاثي"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (إن وُجد)</label>
                  <input
                    type="text"
                    value={singleOcrEditedPhone}
                    onChange={(e) => setSingleOcrEditedPhone(e.target.value)}
                    placeholder="مثال: 07801234567"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الجهة المعنية</label>
                  <input
                    type="text"
                    value={singleOcrEditedEntity}
                    onChange={(e) => setSingleOcrEditedEntity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تفاصيل ومضمون الطلب</label>
                <textarea
                  rows={2}
                  value={singleOcrEditedDetails}
                  onChange={(e) => setSingleOcrEditedDetails(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              {singleOcrResult?.fullExtractedText && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">النص الكامل المستخرج من المستند (OCR)</label>
                  <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-700 max-h-28 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                    {singleOcrResult.fullExtractedText}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSingleOcrResultModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleOcrSave}
                disabled={isSavingSingleOcr}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingSingleOcr ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>حفظ وتثبيت اسم المواطن</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
