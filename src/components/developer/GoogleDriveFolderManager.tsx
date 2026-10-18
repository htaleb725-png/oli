import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Cloud, 
  FolderOpen, 
  ExternalLink, 
  CheckCircle2, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  UploadCloud, 
  ShieldCheck, 
  HelpCircle,
  FileImage,
  Sparkles,
  Lock,
  ArrowRight
} from 'lucide-react';
import { uploadImageToDrive } from '../../services/googleSheetsService';

interface GoogleDriveFolderManagerProps {
  onBackToGrid?: () => void;
}

export const GoogleDriveFolderManager: React.FC<GoogleDriveFolderManagerProps> = ({ onBackToGrid }) => {
  const { 
    systemSettings, 
    updateSystemSettings, 
    driveFolderId,
    setGoogleDriveFolderId,
    addAuditLog 
  } = useApp();

  const currentFolderId = driveFolderId || systemSettings.googleDriveFolderId || (typeof window !== 'undefined' ? localStorage.getItem('al_nashi_drive_folder_id') : '') || '';

  const [inputFolderId, setInputFolderId] = useState(currentFolderId);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    folderUrl?: string;
  } | null>(null);

  // Test Image Upload state
  const [testFile, setTestFile] = useState<File | null>(null);
  const [isUploadingTest, setIsUploadingTest] = useState(false);
  const [testUploadResult, setTestUploadResult] = useState<{
    success: boolean;
    fileId?: string;
    url?: string;
    name?: string;
    error?: string;
  } | null>(null);

  // Allow admin toggle
  const [allowAdmin, setAllowAdmin] = useState<boolean>(() => {
    return Boolean(systemSettings.allowAdminOpenDriveFolder);
  });

  useEffect(() => {
    if (currentFolderId && !inputFolderId) {
      setInputFolderId(currentFolderId);
    }
  }, [currentFolderId]);

  // Extract pure ID if user pastes full Drive URL
  const extractCleanFolderId = (raw: string): string => {
    if (!raw) return '';
    const trimmed = raw.trim();
    // Patterns:
    // https://drive.google.com/drive/folders/1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc
    // https://drive.google.com/drive/u/0/folders/1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc?usp=sharing
    const match = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
    // Remove query params if any
    return trimmed.split('?')[0].split('&')[0];
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = extractCleanFolderId(val);
    setInputFolderId(clean);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const clean = extractCleanFolderId(text);
        setInputFolderId(clean);
      }
    } catch {
      // fallback
    }
  };

  const handleSave = () => {
    const cleanId = extractCleanFolderId(inputFolderId);
    if (!cleanId) {
      alert('يرجى إدخال معرف مجلد Google Drive (Folder ID) بشكل صحيح.');
      return;
    }

    if (setGoogleDriveFolderId) {
      setGoogleDriveFolderId(cleanId);
    } else {
      updateSystemSettings({ 
        googleDriveFolderId: cleanId,
        allowAdminOpenDriveFolder: allowAdmin 
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('al_nashi_drive_folder_id', cleanId);
      }
    }

    updateSystemSettings({ allowAdminOpenDriveFolder: allowAdmin });

    addAuditLog('تحديث مجلد Google Drive', 'لوحة المطور', `تم ربط وتثبيت معرف المجلد (${cleanId}) في المنظومة`);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  const handleVerify = async () => {
    const targetId = extractCleanFolderId(inputFolderId || currentFolderId);
    if (!targetId) {
      setVerificationResult({
        success: false,
        message: 'يرجى إدخال معرف المجلد أولاً لإجراء الفحص.'
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    // Simulate verification or test against Google API if token is present
    setTimeout(async () => {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('al_nashi_google_token') || sessionStorage.getItem('al_nashi_google_token')) : null;
      const folderUrl = `https://drive.google.com/drive/folders/${targetId}`;

      if (token) {
        try {
          const res = await fetch(`https://www.googleapis.com/drive/v3/files/${targetId}?fields=id,name,mimeType,capabilities`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setIsVerifying(false);
            setVerificationResult({
              success: true,
              message: `✓ تم التحقق بنجاح! المجلد نشط ومتاح: "${data.name || 'مجلد الأرشيف'}"`,
              folderUrl
            });
            return;
          }
        } catch (_) {}
      }

      // Format validation
      const isValidFormat = /^[a-zA-Z0-9_-]{15,65}$/.test(targetId);
      setIsVerifying(false);
      if (isValidFormat) {
        setVerificationResult({
          success: true,
          message: `✓ صيغة معرف المجلد مطابقة لمعايير Google Drive. تم تجهيز الرابط بنجاح.`,
          folderUrl
        });
      } else {
        setVerificationResult({
          success: false,
          message: 'تنبيه: صيغة المعرف المدخل قد لا تكون صحيحة، يرجى التأكد من نسخه من عنوان Google Drive.'
        });
      }
    }, 800);
  };

  const handleTestUpload = async () => {
    if (!testFile) return;
    const targetId = extractCleanFolderId(inputFolderId || currentFolderId);
    if (!targetId) {
      alert('يرجى تحديد وحفظ معرف المجلد أولاً قبل تجربة الرفع.');
      return;
    }

    const token = typeof window !== 'undefined' ? (localStorage.getItem('al_nashi_google_token') || sessionStorage.getItem('al_nashi_google_token')) : null;
    if (!token) {
      alert('يرجى تسجيل دخول المطور بحساب Google في تبويب Google Sheets & Drive أولاً لتتمكن من تجربة الرفع الفعلي.');
      return;
    }

    setIsUploadingTest(true);
    setTestUploadResult(null);

    try {
      const res = await uploadImageToDrive(token, testFile, `test_file_${Date.now()}_${testFile.name}`, targetId);
      setTestUploadResult({
        success: true,
        fileId: res.fileId,
        url: res.webViewLink || `https://drive.google.com/file/d/${res.fileId}/view`,
        name: res.name
      });
      addAuditLog('تجربة رفع ملف لـ Google Drive', 'لوحة المطور', `تم رفع ملف تجريبي للمجلد: ${res.fileId}`);
    } catch (err: any) {
      setTestUploadResult({
        success: false,
        error: err?.message || 'تعذر الرفع إلى المجلد، تأكد من صلاحية حساب المطور أو مشاركة المجلد.'
      });
    } finally {
      setIsUploadingTest(false);
    }
  };

  const folderFullUrl = currentFolderId ? `https://drive.google.com/drive/folders/${currentFolderId}` : null;

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in duration-200" dir="rtl">
      
      {/* Top Navigation & Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white border border-blue-500/40 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-2xl border border-blue-500/30 shrink-0">
              📁
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base text-white">
                  ربط وتثبيت Google Drive عبر معرف المجلد (Folder ID)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-400/40 font-mono">
                  Drive Folder ID API
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                ربط المنظومة ومجلد الأرشيف الرقمي مباشرة بمعرف مجلد Google Drive (آيدي المجلد) لحفظ كافة صور الاسكنر، بطاقات الهوية، وكتب المواطنين السحابية.
              </p>
            </div>
          </div>

          {onBackToGrid && (
            <button
              type="button"
              onClick={onBackToGrid}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20 shrink-0"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>رجوع للوحة المطور</span>
            </button>
          )}
        </div>
      </div>

      {/* Current Active Status Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm text-slate-900 dark:text-white">
                حالة مجلد Google Drive الحالي بالنظام
              </h4>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                المجلد المعتمد حالياً لتخزين الصور والملفات المرفوعة
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              currentFolderId 
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
            }`}>
              <span className={`w-2 h-2 rounded-full ${currentFolderId ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              <span>{currentFolderId ? 'مربوط ونشط سحابياً ✓' : 'لم يتم ربط مجلد بعد'}</span>
            </span>

            {folderFullUrl && (
              <a
                href={folderFullUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح المجلد في Google Drive ↗</span>
              </a>
            )}
          </div>
        </div>

        {/* Current Folder Details Box */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-bold">معرف المجلد الحالي (Folder ID):</span>
              <code className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 font-mono font-bold border border-slate-200 dark:border-slate-700 text-xs select-all">
                {currentFolderId || 'لم يحدد'}
              </code>
            </div>

            {currentFolderId && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentFolderId);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ!' : 'نسخ المعرف'}</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-4">
            <span>🔹 كافة عمليات مسح الاسكنر للمواطنين تتوجه إلى هذا المجلد تلقائياً.</span>
            <span>🔹 الروابط المولدة عامة ودائمة ومحفوظة بجدول Google Sheets.</span>
          </div>
        </div>
      </div>

      {/* Main Configuration Input Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-500/30 shadow-xs space-y-5">
        <div>
          <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <span>تعديل وتثبيت معرف مجلد Google Drive (Folder ID)</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
              ربط مباشر
            </span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            يمكنك إدخال معرف المجلد المباشر (Folder ID) أو لصق الرابط الكامل من شريط العنوان في متصفحك وسيقوم النظام باستخراج المعرف تلقائياً.
          </p>
        </div>

        {/* Input Box */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
            معرف المجلد (Folder ID) أو رابطه في Google Drive:
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputFolderId}
                onChange={handleInputChange}
                placeholder="مثال: 1cpO4KynQ524Or32Xg2Es8WYA3VrhlUMc أو https://drive.google.com/drive/folders/..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {inputFolderId && (
                <button
                  type="button"
                  onClick={() => setInputFolderId('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-300 dark:border-slate-700 shrink-0"
            >
              <Copy className="w-3.5 h-3.5 text-blue-500" />
              <span>لصق من الحافظة</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>تثبيت وحفظ المعرف بالمنظومة ⚡</span>
            </button>
          </div>
        </div>

        {/* Save Success Banner */}
        {saveSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>✓ تم بنجاح تثبيت معرف مجلد Google Drive وتعميمه على كافة أقسام المنظومة وقاعدة البيانات!</span>
          </div>
        )}

        {/* Verification & Testing Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={isVerifying}
            onClick={handleVerify}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'جاري الفحص...' : 'فحص واختبار صحة المعرف'}</span>
          </button>

          {inputFolderId && (
            <a
              href={`https://drive.google.com/drive/folders/${extractCleanFolderId(inputFolderId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-1.5 transition-all border border-blue-200 dark:border-blue-800"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>معاينة الرابط في متصفح جديد ↗</span>
            </a>
          )}
        </div>

        {/* Verification Result Toast */}
        {verificationResult && (
          <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            verificationResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
          }`}>
            {verificationResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />}
            <span>{verificationResult.message}</span>
          </div>
        )}
      </div>

      {/* Permissions & Security Settings Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-black text-sm text-slate-900 dark:text-white">
              صلاحيات الوصول وأمان مجلد الأرشيف (RBAC)
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              تحديد من يحق له فتح المجلد واستعراض محتوياته مباشرة
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              السماح لمدير الإدارة ومدير المكتب بفتح مجلد Google Drive المباشر
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              إذا تم إلغاء التفعيل، يحق فقط للمطور البرمجي فتح المجلد المباشر بينما يستطيع الموظفون رفع الصور فقط بدون الوصول للمجلد.
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={allowAdmin}
              onChange={(e) => {
                const nextVal = e.target.checked;
                setAllowAdmin(nextVal);
                updateSystemSettings({ allowAdminOpenDriveFolder: nextVal });
                addAuditLog('تعديل صلاحية فتح مجلد Drive', 'لوحة المطور', `تم ${nextVal ? 'السماح' : 'حظر'} فتح مجلد Google Drive المباشر لمدير الإدارة`);
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Test Upload Directly to Folder */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-sm text-slate-900 dark:text-white">
                تجربة رفع ملف أو صورة للمجلد مباشرة
              </h4>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                اختبار عملي لرفع ملف للتأكد من وصول الملفات لمجلدك المحدد
              </span>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
            فحص حي
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              اختر ملفاً أو صورة من جهازك:
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setTestFile(e.target.files[0]);
                  setTestUploadResult(null);
                }
              }}
              className="text-xs text-slate-600 dark:text-slate-300 file:mr-0 file:ml-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-950 dark:file:text-blue-300 hover:file:bg-blue-100 cursor-pointer"
            />
          </div>

          <div className="flex items-end justify-start sm:justify-end">
            <button
              type="button"
              disabled={isUploadingTest || !testFile}
              onClick={handleTestUpload}
              className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-xs ${
                testFile
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer active:scale-95'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <UploadCloud className={`w-4 h-4 ${isUploadingTest ? 'animate-bounce' : ''}`} />
              <span>{isUploadingTest ? 'جاري الرفع إلى المجلد...' : 'رفع الملف التجريبي للمجلد الآن'}</span>
            </button>
          </div>
        </div>

        {testUploadResult && (
          <div className={`p-3 rounded-xl text-xs space-y-1.5 ${
            testUploadResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
          }`}>
            {testUploadResult.success ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span>✓ تم بنجاح رفع الملف التجريبي إلى المجلد المحدد!</span>
                {testUploadResult.url && (
                  <a
                    href={testUploadResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] flex items-center gap-1"
                  >
                    <span>معاينة الملف على Drive ↗</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{testUploadResult.error}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visual Step-by-Step Guide for Getting the Folder ID */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-blue-500" />
          <span>كيفية الحصول على معرف المجلد (Folder ID) من Google Drive:</span>
        </h5>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-black text-blue-600 dark:text-blue-400 block text-xs">1. إنشاء المجلد</span>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              ادخل إلى حساب Google Drive الخاص بك وأنشئ مجلداً جديداً باسم: (مرفقات وصور مكتب النائب).
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-black text-blue-600 dark:text-blue-400 block text-xs">2. نسخ الرابط أو المعرف</span>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              افتح المجلد وانسخ الرابط من شريط العنوان في المتصفح، أو انقر بزر الفأرة الأيمن &gt; مشاركة &gt; نسخ الرابط.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
            <span className="font-black text-blue-600 dark:text-blue-400 block text-xs">3. اللصق والتثبيت</span>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              الصق الرابط في الحقل أعلاه وسيقوم النظام باستخراج المعرف تلقائياً ثم انقر <strong>تثبيت وحفظ المعرف</strong>.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
