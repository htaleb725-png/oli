import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  FolderKanban, 
  Search, 
  Upload, 
  RefreshCw, 
  X, 
  ExternalLink, 
  Edit3, 
  FileText, 
  FileImage, 
  Check, 
  CheckCircle2, 
  Loader2, 
  Download, 
  Eye, 
  AlertCircle,
  Paperclip,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FolderOpen
} from 'lucide-react';
import { 
  searchDriveFiles, 
  uploadImageToDrive, 
  DriveFileItem, 
  getAccessToken 
} from '../services/googleSheetsService';
import { saveImageToDB, getAllImagesFromDB, ImageRecord } from '../utils/imageDb';
import { Citizen, OfficeRequest } from '../types';

interface GoogleDriveArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCitizen?: Citizen | null;
  targetRequest?: OfficeRequest | null;
  onAttachFileToRequest?: (fileUrl: string, fileName: string) => void;
}

export const GoogleDriveArchiveModal: React.FC<GoogleDriveArchiveModalProps> = ({
  isOpen,
  onClose,
  targetCitizen,
  targetRequest,
  onAttachFileToRequest
}) => {
  const { 
    currentUser, 
    systemSettings, 
    driveFolderId, 
    setGoogleDriveFolderId, 
    isGoogleConnected,
    loginWithGoogleDeveloper,
    addAuditLog,
    addDocument
  } = useApp();

  // Active folder ID (from context or fallback)
  const currentFolderId = driveFolderId || systemSettings.googleDriveFolderId || '1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc';
  
  // State
  const [searchQuery, setSearchQuery] = useState(targetCitizen ? targetCitizen.FullName : '');
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [localImages, setLocalImages] = useState<ImageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Folder ID Editing Modal/Input
  const [isEditingFolderId, setIsEditingFolderId] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState(currentFolderId);

  // Preview Selected File
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    url?: string;
    isDrive: boolean;
    mimeType?: string;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load files when modal opens or folder ID changes
  useEffect(() => {
    if (isOpen) {
      loadAllFiles(searchQuery);
    }
  }, [isOpen, currentFolderId]);

  // Load Drive files + Local DB images
  const loadAllFiles = async (queryText?: string) => {
    setIsLoading(true);
    try {
      // 1. Fetch Local Images from IndexedDB
      const dbImages = await getAllImagesFromDB();
      const filteredLocal = (queryText && queryText.trim()) 
        ? dbImages.filter(img => 
            (img.citizenName && img.citizenName.toLowerCase().includes(queryText.toLowerCase())) ||
            (img.fileName && img.fileName.toLowerCase().includes(queryText.toLowerCase())) ||
            (img.extractedText && img.extractedText.toLowerCase().includes(queryText.toLowerCase()))
          )
        : dbImages;
      setLocalImages(filteredLocal);

      // 2. Fetch Drive Files via Google Drive v3 API
      const token = await getAccessToken();
      if (token) {
        const files = await searchDriveFiles(token, currentFolderId, queryText);
        setDriveFiles(files);
      } else {
        setDriveFiles([]);
      }
    } catch (err) {
      console.warn('Error loading drive archive files:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Search handler
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadAllFiles(searchQuery);
  };

  // Save new Google Drive Folder ID
  const handleSaveNewFolderId = () => {
    const cleanId = newFolderInput.trim();
    if (!cleanId) return;

    // Handle full Google Drive URL pasted by mistake
    let extractedId = cleanId;
    if (cleanId.includes('/folders/')) {
      const match = cleanId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        extractedId = match[1];
      }
    }

    setGoogleDriveFolderId(extractedId);
    setIsEditingFolderId(false);
    setUploadStatus(`✓ تم تحديث مجلد Google Drive بنجاح إلى: [${extractedId}]`);
    setTimeout(() => setUploadStatus(null), 4000);
    loadAllFiles(searchQuery);
  };

  // File upload handler to Google Drive
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadStatus('جاري معالجة ورفع الملف إلى Google Drive...');

    try {
      const file = files[0];
      const citizenName = targetCitizen?.FullName || 'مراجع عام';
      const fileName = `${citizenName.replace(/\s+/g, '_')}_${Date.now()}_${file.name}`;

      // Convert to base64 for local storage
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;

        // 1. Save locally in IndexedDB
        const localRecordId = `img_${Date.now()}`;
        await saveImageToDB({
          id: localRecordId,
          fileName: fileName,
          citizenName: targetCitizen?.FullName || 'مراجع عام',
          citizenId: targetCitizen?.Citizen_ID,
          dataUrl: base64Data,
          fileSize: `${(file.size / 1024).toFixed(1)} KB`,
          mimeType: file.type || 'image/jpeg',
          uploadedAt: new Date().toISOString(),
          entity: targetRequest?.Entity || 'مرفق معاملة',
          details: `تم الرفع عبر أرشيف Google Drive - ${new Date().toLocaleDateString('ar-IQ')}`
        });

        // 2. Upload to Google Drive folder
        const token = await getAccessToken();
        let driveLink: string | undefined = undefined;

        if (token) {
          const driveRes = await uploadImageToDrive(token, file, fileName, currentFolderId);
          driveLink = driveRes.webViewLink;
        }

        // 3. Attach to Document Archive
        addDocument({
          Citizen_ID: targetCitizen?.Citizen_ID || 'ONA-DRV',
          CitizenName: citizenName,
          Title: `مرفق Drive: ${file.name}`,
          Category: 'طلب مقدم',
          FileUrl: driveLink || base64Data,
          FileType: file.type.includes('pdf') ? 'pdf' : 'image',
          FileSize: `${(file.size / 1024).toFixed(1)} KB`,
          UploadedBy: currentUser?.FullName || 'مسؤول الأرشيف'
        });

        // 4. Attach to current request callback if available
        if (onAttachFileToRequest) {
          onAttachFileToRequest(driveLink || base64Data, fileName);
        }

        // 5. Audit log
        addAuditLog(
          'رفع صورة إلى أرشيف Google Drive',
          'أرشيف المعاملات',
          `تم رفع المرفق (${fileName}) وحفظه في Google Drive بنجاح للمواطن (${citizenName})`
        );

        setUploadStatus('✓ تم حفظ الصورة ورفعها إلى مجلد Google Drive بنجاح!');
        setTimeout(() => setUploadStatus(null), 3500);
        setIsUploading(false);
        loadAllFiles(searchQuery);
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Drive upload failed:', err);
      setUploadStatus(`تعذر الرفع إلى Drive: ${err?.message || 'خطأ غير معروف'}`);
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-emerald-500/40 dark:border-emerald-400/30 max-w-4xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-inner">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  أرشيف صور ومستندات المعاملات - Google Drive
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-300/30">
                  سحابي مباشر ☁️
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                {targetCitizen 
                  ? `أرشيف المعاملات الخاص بالمواطن: ${targetCitizen.FullName}`
                  : 'ربط مباشر، استعراض، وبحث لحظي في مجلد Google Drive المخصص للمكتب'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadAllFiles(searchQuery)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="تحديث ومزامنة من Google Drive"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Google Drive Folder Banner (Editable by Developer/Admin) */}
        <div className="px-4 py-3 bg-emerald-50/80 dark:bg-emerald-950/40 border-b border-emerald-200/60 dark:border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <FolderOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">مجلد التخزين السحابي الحالي (Drive Folder ID):</span>
                <span className="text-xs font-mono font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-300 select-all truncate max-w-[200px] sm:max-w-xs">
                  {currentFolderId}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                أي صورة ترفعها تظهر في هذا المجلد، والبحث يطابق محتويات المجلد تلقائياً.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Developer Change Folder ID Button */}
            <button
              type="button"
              onClick={() => {
                setNewFolderInput(currentFolderId);
                setIsEditingFolderId(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
              title="تغيير معرف مجلد Google Drive (متاح للمطور والإدارة)"
            >
              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
              <span>تغيير المجلد ✏️</span>
            </button>

            {/* Open Folder in Google Drive */}
            <a
              href={`https://drive.google.com/drive/folders/${currentFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح في Drive 🔗</span>
            </a>
          </div>
        </div>

        {/* Change Folder ID Inline Form */}
        {isEditingFolderId && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-center gap-2 animate-in slide-in-from-top duration-150">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-200 shrink-0">
              معرف مجلد Google Drive الجديد:
            </span>
            <input
              type="text"
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
              placeholder="الصق Folder ID أو رابط مجلد Drive هنا..."
              className="flex-1 h-8 px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 w-full"
            />
            <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
              <button
                onClick={handleSaveNewFolderId}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
              >
                حفظ المجلد
              </button>
              <button
                onClick={() => setIsEditingFolderId(false)}
                className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Upload Status Alert Notification */}
        {uploadStatus && (
          <div className="px-4 py-2 bg-blue-600 text-white text-xs font-bold flex items-center justify-between shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>{uploadStatus}</span>
            </div>
            <button onClick={() => setUploadStatus(null)} className="text-white hover:text-slate-200">✕</button>
          </div>
        )}

        {/* Search & Actions Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Live Search Form */}
          <form onSubmit={handleSearch} className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                // Trigger fast filter on local
                if (!e.target.value.trim()) {
                  loadAllFiles('');
                }
              }}
              placeholder="ابحث في Google Drive والأرشيف بالاسم، رقم المعاملة، أو اسم الملف..."
              className="w-full h-9 pr-9 pl-18 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-right"
            />
            <button
              type="submit"
              className="absolute left-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
            >
              بحث
            </button>
          </form>

          {/* Upload Button */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileUpload}
            />

            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>جاري الرفع لـ Drive...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-white" />
                  <span>رفع صورة جديدة لـ Drive 📤</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Area: Files Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {isLoading ? (
            <div className="py-16 text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                جاري البحث والاتصال بـ Google Drive والأرشيف المحلي...
              </p>
            </div>
          ) : driveFiles.length === 0 && localImages.length === 0 ? (
            <div className="py-14 text-center space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <FolderKanban className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">لا توجد ملفات مطابقة في هذا المجلد</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  قم برفع صورة أو مستند للمعاملة الآن ليتم تخزينه تلقائياً في Google Drive والأرشيف، أو ابحث باسم مواطن آخر.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
              >
                <Upload className="w-4 h-4" />
                <span>رفع أول مستند إلى Drive</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Section Header with Counts */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>نتائج البحث والأرشيف: {driveFiles.length + localImages.length} ملف ومستند</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  Google Drive: {driveFiles.length} | الأرشيف المحلي: {localImages.length}
                </span>
              </div>

              {/* Grid of Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Google Drive Cloud Files */}
                {driveFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-800 border-2 border-emerald-500/30 dark:border-emerald-500/20 hover:border-emerald-500 shadow-sm flex flex-col justify-between transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                          <span>Google Drive ☁️</span>
                        </span>
                        {file.modifiedTime && (
                          <span className="text-[10px] font-mono text-slate-400" dir="ltr">
                            {new Date(file.modifiedTime).toLocaleDateString('ar-IQ')}
                          </span>
                        )}
                      </div>

                      {/* File Icon / Thumbnail */}
                      <div 
                        onClick={() => setPreviewFile({ name: file.name, url: file.webViewLink, isDrive: true, mimeType: file.mimeType })}
                        className="h-28 rounded-xl bg-emerald-50/50 dark:bg-slate-700/50 border border-emerald-100 dark:border-slate-700 flex items-center justify-center cursor-pointer overflow-hidden relative group"
                      >
                        {file.thumbnailLink ? (
                          <img src={file.thumbnailLink} alt={file.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : file.mimeType.includes('pdf') ? (
                          <FileText className="w-10 h-10 text-rose-500" />
                        ) : (
                          <FileImage className="w-10 h-10 text-emerald-600" />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          <Eye className="w-4 h-4 ml-1" />
                          <span>معاينة</span>
                        </div>
                      </div>

                      {/* File Name */}
                      <div className="mt-2 text-xs font-bold text-slate-900 dark:text-white truncate" title={file.name}>
                        {file.name}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1.5">
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>فتح</span>
                        </a>
                      )}

                      {onAttachFileToRequest && (
                        <button
                          type="button"
                          onClick={() => {
                            onAttachFileToRequest(file.webViewLink || file.id, file.name);
                            setUploadStatus(`✓ تم ربط الملف (${file.name}) بالمعاملة بنجاح!`);
                            setTimeout(() => setUploadStatus(null), 3000);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Paperclip className="w-3 h-3" />
                          <span>ربط بالمعاملة</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* 2. Local Image Records */}
                {localImages.map((img) => (
                  <div
                    key={img.id}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 shadow-sm flex flex-col justify-between transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-1">
                          <span>أرشيف محلي 💾</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400" dir="ltr">
                          {img.uploadedAt ? new Date(img.uploadedAt).toLocaleDateString('ar-IQ') : 'اليوم'}
                        </span>
                      </div>

                      {/* Image Preview Thumbnail */}
                      <div 
                        onClick={() => setPreviewFile({ name: img.fileName, url: img.dataUrl, isDrive: false, mimeType: img.mimeType })}
                        className="h-28 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center cursor-pointer overflow-hidden relative group"
                      >
                        <img src={img.dataUrl} alt={img.fileName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition-opacity">
                          <Eye className="w-4 h-4 ml-1" />
                          <span>معاينة</span>
                        </div>
                      </div>

                      {/* Citizen / File Name */}
                      <div className="mt-2 text-xs font-bold text-slate-900 dark:text-white truncate" title={img.fileName}>
                        {img.citizenName ? `المواطن: ${img.citizenName}` : img.fileName}
                      </div>
                      {img.entity && (
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          الجهة: {img.entity}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewFile({ name: img.fileName, url: img.dataUrl, isDrive: false, mimeType: img.mimeType })}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-blue-600" />
                        <span>معاينة</span>
                      </button>

                      {onAttachFileToRequest && (
                        <button
                          type="button"
                          onClick={() => {
                            onAttachFileToRequest(img.dataUrl, img.fileName);
                            setUploadStatus(`✓ تم ربط الصورة (${img.fileName}) بالمعاملة بنجاح!`);
                            setTimeout(() => setUploadStatus(null), 3000);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Paperclip className="w-3 h-3" />
                          <span>ربط بالمعاملة</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            تكامل ثنائي الاتجاه: التعديل والرفع في النظام يظهر مباشرة في Google Drive والعكس صحيح ⚡
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs cursor-pointer shadow-sm"
          >
            إغلاق
          </button>
        </div>

      </div>

      {/* Single File Preview Viewer Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-3xl max-w-3xl w-full p-4 space-y-3 relative border border-slate-700 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold truncate max-w-md">{previewFile.name}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.25))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                  title="تكبير"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                  title="تصغير"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                  title="تدوير"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewFile(null)}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center min-h-[300px] bg-black/40 rounded-2xl p-2">
              {previewFile.url ? (
                previewFile.isDrive ? (
                  <iframe
                    src={previewFile.url.replace('/view', '/preview')}
                    title={previewFile.name}
                    className="w-full h-[450px] rounded-xl border border-slate-800"
                  />
                ) : (
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    style={{
                      transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                      transition: 'transform 0.2s ease-out'
                    }}
                    className="max-h-[500px] max-w-full object-contain rounded-xl"
                  />
                )
              ) : (
                <p className="text-xs text-slate-400">لا يمكن عرض المعاينة لهذا الملف.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
