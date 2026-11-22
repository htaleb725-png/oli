import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  FolderKanban,
  Search,
  RefreshCw,
  Loader2,
  Eye,
  Printer,
  Download,
  Trash2,
  FileImage,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  Edit3,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Database,
  Clock,
  Lock,
  User,
  Building2
} from 'lucide-react';
import {
  UnifiedDriveFile,
  extractDriveFolderId,
  fetchLiveDriveFolderFiles,
  deleteLiveDriveFile,
  downloadDriveFileAsAsset,
  printDriveFileDirectly,
  matchesArabicPartial
} from '../services/driveArchiveService';
import { getAllImagesFromDB, deleteImageFromDB, ImageRecord } from '../utils/imageDb';
import { printImageIsolated, printHtmlSafely } from '../utils/printReceiptHelper';
import { Citizen, OfficeRequest } from '../types';

interface LiveDriveGalleryWidgetProps {
  /** Compact mode for embedding inside Global Search Archive */
  compact?: boolean;
  /** Optional externally driven search query (e.g. from Global Search input or selected citizen name) */
  externalSearchQuery?: string;
  /** Optional custom section heading */
  title?: string;
}

type CategoryFilter = 'all' | 'image' | 'docs' | 'system';

interface PreviewTarget {
  kind: 'drive' | 'local_image' | 'request_image' | 'system_record';
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  fallbackImageUrl?: string;
  embedPreviewUrl?: string;
  driveFile?: UnifiedDriveFile;
  localImage?: ImageRecord;
  request?: OfficeRequest;
  citizen?: Citizen;
}

export const LiveDriveGalleryWidget: React.FC<LiveDriveGalleryWidgetProps> = ({
  compact = false,
  externalSearchQuery,
  title
}) => {
  const {
    systemSettings,
    driveFolderId: contextDriveFolderId,
    setGoogleDriveFolderId,
    currentUser,
    citizens,
    requests,
    documents,
    addAuditLog
  } = useApp();

  const resolvedFolderId = extractDriveFolderId(
    contextDriveFolderId || systemSettings.googleDriveFolderId
  );
  const appsScriptUrl =
    systemSettings.appsScriptUrl || systemSettings.googleAppsScriptUrl || '';
  const driveFolderUrl = `https://drive.google.com/drive/folders/${resolvedFolderId}`;

  const isDeveloper = currentUser?.Role === 'developer';
  const canOpenDriveFolder =
    isDeveloper ||
    (Boolean(systemSettings.allowAdminOpenDriveFolder) &&
      ['director', 'admin', 'admin_officer'].includes(currentUser?.Role || ''));

  const [internalQuery, setInternalQuery] = useState('');
  const activeQuery = (
    externalSearchQuery !== undefined && externalSearchQuery.trim()
      ? externalSearchQuery
      : internalQuery
  ).trim();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [driveFiles, setDriveFiles] = useState<UnifiedDriveFile[]>([]);
  const [totalInFolder, setTotalInFolder] = useState<number>(0);
  const [driveSource, setDriveSource] = useState<string>('none');
  const [driveError, setDriveError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(compact ? 12 : 24);
  const [remoteDriveHits, setRemoteDriveHits] = useState<UnifiedDriveFile[]>([]);
  const [isSearchingDriveLive, setIsSearchingDriveLive] = useState<boolean>(false);
  const hasLoadedOnceRef = useRef<boolean>(false);

  // Local IndexedDB images
  const [localImages, setLocalImages] = useState<ImageRecord[]>([]);

  // Inline Developer folder editor
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [folderInput, setFolderInput] = useState(resolvedFolderId);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'info' | 'warning';
    text: string;
  } | null>(null);

  // Inline 2-step delete confirmation
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);

  // Preview Lightbox Modal
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  const requestSeqRef = useRef(0);
  const lastLoadedFolderRef = useRef<string>('');

  const showBanner = (
    text: string,
    type: 'success' | 'info' | 'warning' = 'success'
  ) => {
    setStatusBanner({ type, text });
    setTimeout(() => setStatusBanner(null), 4500);
  };

  const loadArchiveData = useCallback(
    async (opts?: { silent?: boolean; forceRefresh?: boolean; folderOverride?: string }) => {
      const targetFolder = extractDriveFolderId(opts?.folderOverride || resolvedFolderId);
      const seq = ++requestSeqRef.current;
      const folderChanged = lastLoadedFolderRef.current !== targetFolder;

      if (folderChanged) {
        setDriveFiles([]);
        setTotalInFolder(0);
        setDriveError(null);
        setRemoteDriveHits([]);
      }

      if (!opts?.silent) {
        if (!hasLoadedOnceRef.current || folderChanged) setIsLoading(true);
        else setIsRefreshing(true);
      }

      try {
        const [driveResult, dbImgs] = await Promise.all([
          fetchLiveDriveFolderFiles({
            folderId: targetFolder,
            appsScriptUrl,
            forceRefresh: opts?.forceRefresh ?? folderChanged,
            limit: 5000
          }),
          getAllImagesFromDB().catch(() => [] as ImageRecord[])
        ]);

        // Discard stale responses from an earlier folder or older poll
        if (seq !== requestSeqRef.current) return;

        hasLoadedOnceRef.current = true;
        lastLoadedFolderRef.current = targetFolder;
        setDriveFiles(driveResult.files);
        setTotalInFolder(driveResult.totalInFolder);
        setDriveSource(driveResult.source);
        setDriveError(driveResult.error || null);
        setLocalImages(
          (dbImgs || []).sort(
            (a, b) =>
              new Date(b.uploadedAt || 0).getTime() -
              new Date(a.uploadedAt || 0).getTime()
          )
        );
        setLastUpdatedAt(
          new Date().toLocaleTimeString('ar-IQ', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        );
      } catch (err: any) {
        if (seq !== requestSeqRef.current) return;
        setDriveError(
          err?.message || 'تعذر الاتصال بمجلد Google Drive حالياً.'
        );
      } finally {
        if (seq === requestSeqRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [resolvedFolderId, appsScriptUrl]
  );

  // Initial load & immediate forced reload whenever Developer changes Drive Folder ID or Apps Script URL
  useEffect(() => {
    setFolderInput(resolvedFolderId);
    loadArchiveData({ forceRefresh: true, folderOverride: resolvedFolderId });
  }, [resolvedFolderId, appsScriptUrl, loadArchiveData]);

  // Gentle 45-second auto-poll so newly added photos/PDFs in Drive appear automatically without lag
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      loadArchiveData({ silent: true, forceRefresh: true });
    }, 45000);
    return () => clearInterval(interval);
  }, [autoRefreshEnabled, loadArchiveData]);

  // Live debounced remote Google Drive search while typing (catches any newly added or remote-only files in Drive)
  useEffect(() => {
    if (!activeQuery || activeQuery.length < 2) {
      setRemoteDriveHits([]);
      setIsSearchingDriveLive(false);
      return;
    }
    setVisibleCount(compact ? 16 : 48);

    // If all Drive files are already loaded locally via server proxy, local filtering is already 100% exhaustive in 0ms;
    // still run a lightweight 280ms remote search when using Apps Script / OAuth or when folder has more files than loaded.
    const needsRemoteQuery =
      driveSource === 'apps_script' ||
      driveSource === 'oauth_api' ||
      driveSource === 'none' ||
      (totalInFolder > 0 && driveFiles.length < totalInFolder);

    if (!needsRemoteQuery) {
      setRemoteDriveHits([]);
      setIsSearchingDriveLive(false);
      return;
    }

    let cancelled = false;
    setIsSearchingDriveLive(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchLiveDriveFolderFiles({
          folderId: resolvedFolderId,
          appsScriptUrl,
          query: activeQuery,
          limit: 500
        });
        if (!cancelled) {
          setRemoteDriveHits(res.files || []);
        }
      } catch {
        if (!cancelled) setRemoteDriveHits([]);
      } finally {
        if (!cancelled) setIsSearchingDriveLive(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeQuery, compact, driveSource, driveFiles.length, totalInFolder, resolvedFolderId, appsScriptUrl]);

  // Filtered Google Drive files (0ms instant Arabic-normalized partial & progressive full-name match across ALL Drive files + remote hits)
  const matchedDriveFiles = useMemo(() => {
    const combinedMap = new Map<string, UnifiedDriveFile>();
    for (const f of driveFiles) combinedMap.set(f.id, f);
    if (activeQuery && remoteDriveHits.length > 0) {
      for (const f of remoteDriveHits) {
        if (!combinedMap.has(f.id)) combinedMap.set(f.id, f);
      }
    }

    const pool = Array.from(combinedMap.values());
    return pool.filter((file) => {
      if (activeQuery) {
        const match =
          matchesArabicPartial(file.name, activeQuery) ||
          file.id.toLowerCase().includes(activeQuery.toLowerCase());
        if (!match) return false;
      }
      if (categoryFilter === 'image') return file.category === 'image';
      if (categoryFilter === 'docs') return file.category !== 'image';
      if (categoryFilter === 'system') return false;
      return true;
    });
  }, [driveFiles, remoteDriveHits, activeQuery, categoryFilter]);

  // Matched System Records (Citizens + Requests + Documents + IndexedDB images)
  const matchedSystemResults = useMemo(() => {
    if (categoryFilter === 'image' || categoryFilter === 'docs') {
      // Only show local images when filtering for images
      if (categoryFilter === 'image') {
        const imgs = localImages.filter((img) =>
          !activeQuery
            ? true
            : matchesArabicPartial(
                `${img.citizenName || ''} ${img.fileName || ''} ${img.extractedText || ''} ${img.entity || ''} ${img.details || ''}`,
                activeQuery
              )
        );
        return {
          localImages: imgs,
          requests: [] as OfficeRequest[],
          citizens: [] as Citizen[],
          documents: [] as typeof documents
        };
      }
      return {
        localImages: [] as ImageRecord[],
        requests: [] as OfficeRequest[],
        citizens: [] as Citizen[],
        documents: [] as typeof documents
      };
    }

    const filteredLocal = localImages.filter((img) =>
      !activeQuery
        ? true
        : matchesArabicPartial(
            `${img.citizenName || ''} ${img.fileName || ''} ${img.extractedText || ''} ${img.entity || ''} ${img.details || ''}`,
            activeQuery
          )
    );

    // When searching by a person's name (or viewing "نتائج النظام"), surface System citizens, requests & docs
    const shouldIncludeTextRecords =
      Boolean(activeQuery) || categoryFilter === 'system';

    const matchedReqs = shouldIncludeTextRecords
      ? requests
          .filter((r) => {
            if (!r) return false;
            if (!activeQuery) {
              return Boolean(
                r.AttachedRequestImage ||
                  (r.ScanAttachments && r.ScanAttachments.length > 0)
              );
            }
            return matchesArabicPartial(
              `${r.CitizenName || ''} ${r.Request_ID || ''} ${r.OutgoingNumber || ''} ${r.Entity || ''} ${r.Details || ''} ${r.CitizenPhone || ''}`,
              activeQuery
            );
          })
          .slice(0, 40)
      : requests
          .filter(
            (r) =>
              r &&
              Boolean(
                r.AttachedRequestImage ||
                  (r.ScanAttachments && r.ScanAttachments.length > 0)
              )
          )
          .slice(0, 16);

    const matchedCits =
      activeQuery || categoryFilter === 'system'
        ? citizens
            .filter((c) => {
              if (!c) return false;
              if (!activeQuery) return true;
              return matchesArabicPartial(
                `${c.FullName || ''} ${c.Citizen_ID || ''} ${c.Phone1 || ''} ${c.Phone2 || ''} ${c.District || ''} ${c.Surname || ''}`,
                activeQuery
              );
            })
            .slice(0, 24)
        : [];

    const matchedDocs =
      activeQuery || categoryFilter === 'system'
        ? documents
            .filter((d) => {
              if (!d) return false;
              if (!activeQuery) return true;
              return matchesArabicPartial(
                `${d.CitizenName || ''} ${d.Title || ''} ${d.Category || ''}`,
                activeQuery
              );
            })
            .slice(0, 24)
        : [];

    return {
      localImages: filteredLocal,
      requests: matchedReqs,
      citizens: matchedCits,
      documents: matchedDocs
    };
  }, [
    localImages,
    requests,
    citizens,
    documents,
    activeQuery,
    categoryFilter
  ]);

  const driveImageCount = useMemo(
    () => driveFiles.filter((f) => f.category === 'image').length,
    [driveFiles]
  );
  const driveDocsCount = useMemo(
    () => driveFiles.filter((f) => f.category !== 'image').length,
    [driveFiles]
  );
  const systemMatchTotal =
    matchedSystemResults.localImages.length +
    matchedSystemResults.requests.length +
    matchedSystemResults.citizens.length +
    matchedSystemResults.documents.length;

  const handleSaveDriveFolder = () => {
    const cleanId = extractDriveFolderId(folderInput);
    if (!cleanId) return;
    setGoogleDriveFolderId(cleanId);
    setFolderInput(cleanId);
    setIsEditingFolder(false);
    showBanner(
      `تم تحديث مجلد Google Drive إلى (${cleanId}) ومزامنته سحابياً — جاري جلب الصور والملفات...`,
      'success'
    );
    loadArchiveData({ forceRefresh: true, folderOverride: cleanId });
  };

  const handleDeleteDrive = async (file: UnifiedDriveFile) => {
    const key = `drive:${file.id}`;
    if (pendingDeleteKey !== key) {
      setPendingDeleteKey(key);
      return;
    }
    setPendingDeleteKey(null);
    const res = await deleteLiveDriveFile(file.id, appsScriptUrl);
    if (res.success) {
      setDriveFiles((prev) => prev.filter((f) => f.id !== file.id));
      setTotalInFolder((prev) => Math.max(0, prev - 1));
      if (previewTarget?.id === file.id) setPreviewTarget(null);
      addAuditLog(
        'حذف ملف من أرشيف Google Drive',
        'أرشيف البريد والصور',
        `تم حذف الملف (${file.name})`
      );
      showBanner(`تم حذف الملف (${file.name}) من Google Drive بنجاح.`, 'success');
    } else {
      showBanner(
        res.error || 'تعذر الحذف المباشر من Google Drive حالياً.',
        'warning'
      );
    }
  };

  const handleDeleteLocal = async (img: ImageRecord) => {
    const key = `local:${img.id}`;
    if (pendingDeleteKey !== key) {
      setPendingDeleteKey(key);
      return;
    }
    setPendingDeleteKey(null);
    try {
      await deleteImageFromDB(img.id);
      setLocalImages((prev) => prev.filter((i) => i.id !== img.id));
      if (previewTarget?.id === img.id) setPreviewTarget(null);
      addAuditLog(
        'حذف صورة من الأرشيف المحلي',
        'أرشيف البريد والصور',
        `تم حذف الصورة (${img.fileName})`
      );
      showBanner(`تم حذف الصورة (${img.fileName}) بنجاح.`, 'success');
    } catch {
      showBanner('تعذر حذف الصورة من الأرشيف.', 'warning');
    }
  };

  const handleDownloadLocalImage = (dataUrl: string, name: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = name.endsWith('.jpg') || name.endsWith('.png') ? name : `${name}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintSystemRecord = (req?: OfficeRequest, cit?: Citizen) => {
    const titleText = req
      ? `معاملة المواطن: ${req.CitizenName}`
      : `بطاقة سجل المواطن: ${cit?.FullName || ''}`;
    const html = req
      ? `<div style="font-family:'Cairo',sans-serif;direction:rtl;padding:24px;border:2px solid #0f172a;border-radius:12px;">
          <h2 style="margin:0 0 8px;font-size:18px;font-weight:900;color:#0f172a;">مكتب النائب المهندسة علا عودة الناشي — وثيقة بحث الأرشيف</h2>
          <p style="margin:0 0 16px;font-size:12px;color:#475569;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-IQ')}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;background:#f8fafc;width:28%;">اسم المراجع</td><td style="padding:8px;border:1px solid #cbd5e1;font-weight:900;">${req.CitizenName}</td></tr>
            <tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;background:#f8fafc;">رقم الطلب / الصادر</td><td style="padding:8px;border:1px solid #cbd5e1;">${req.Request_ID} ${req.OutgoingNumber ? `| الصادر: ${req.OutgoingNumber}` : ''}</td></tr>
            <tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;background:#f8fafc;">الجهة / الوزارة</td><td style="padding:8px;border:1px solid #cbd5e1;">${req.Entity || '—'}</td></tr>
            <tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;background:#f8fafc;">حالة الإنجاز والاستلام</td><td style="padding:8px;border:1px solid #cbd5e1;">${req.ProcessingStatus} | ${req.DeliveryStatus || 'غير مستلم'}</td></tr>
            <tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;background:#f8fafc;">التفاصيل والموضوع</td><td style="padding:8px;border:1px solid #cbd5e1;line-height:1.8;">${req.Details || '—'}</td></tr>
          </table>
          ${req.AttachedRequestImage ? `<div style="margin-top:16px;text-align:center;"><img src="${req.AttachedRequestImage}" style="max-width:100%;max-height:560px;object-fit:contain;border:1px solid #cbd5e1;border-radius:8px;" /></div>` : ''}
        </div>`
      : `<div style="font-family:'Cairo',sans-serif;direction:rtl;padding:24px;border:2px solid #0f172a;border-radius:12px;">
          <h2 style="margin:0 0 8px;font-size:18px;font-weight:900;color:#0f172a;">مكتب النائب المهندسة علا عودة الناشي — سجل مراجع</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;">
            <tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;background:#f8fafc;width:28%;">الاسم الكامل</td><td style="padding:8px;border:1px solid #cbd5e1;font-weight:900;">${cit?.FullName || ''}</td></tr>
            <tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;background:#f8fafc;">الرقم التعريفي</td><td style="padding:8px;border:1px solid #cbd5e1;">${cit?.Citizen_ID || ''}</td></tr>
            <tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;background:#f8fafc;">الهاتف</td><td style="padding:8px;border:1px solid #cbd5e1;">${cit?.Phone1 || '—'}</td></tr>
            <tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;background:#f8fafc;">العنوان / القضاء</td><td style="padding:8px;border:1px solid #cbd5e1;">${cit?.District || ''} ${cit?.SubDistrict ? `- ${cit.SubDistrict}` : ''}</td></tr>
            <tr><td style="padding:8px;border:1px solid #cbd5e1;font-weight:700;background:#f8fafc;">المهنة</td><td style="padding:8px;border:1px solid #cbd5e1;">${cit?.Job || '—'}</td></tr>
          </table>
        </div>`;
    printHtmlSafely(
      `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${titleText}</title></head><body style="margin:0;padding:16px;background:#fff;">${html}</body></html>`
    );
  };

  const renderCategoryBadge = (file: UnifiedDriveFile) => {
    switch (file.category) {
      case 'pdf':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <FileText className="w-3 h-3" />
            PDF
          </span>
        );
      case 'image':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <FileImage className="w-3 h-3" />
            صورة
          </span>
        );
      case 'sheet':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
            <FileSpreadsheet className="w-3 h-3" />
            Excel
          </span>
        );
      case 'doc':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <FileText className="w-3 h-3" />
            وثيقة
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <FileIcon className="w-3 h-3" />
            ملف
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl bg-white dark:bg-[#0D1426] border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden text-right">
      {/* Top Executive Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#111A30] space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                  {title || 'أرشيف Google Drive المباشر والبحث الموحد (صور، PDF، ووثائق)'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  يعرض جميع الملفات والصور المضافة في مجلد Google Drive المثبت فورياً، ويبحث بالاسم الكامل أو الجزئي داخل النظام وGoogle Drive معاً.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto-refresh toggle */}
            <button
              type="button"
              onClick={() => setAutoRefreshEnabled((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                autoRefreshEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title="عند التفعيل، تظهر أي صورة أو ملف PDF يضاف إلى مجلد Google Drive تلقائياً كل 25 ثانية"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{autoRefreshEnabled ? 'تحديث تلقائي مفعّل' : 'تحديث تلقائي متوقف'}</span>
            </button>

            {/* Manual Force Refresh */}
            <button
              type="button"
              onClick={() => loadArchiveData({ forceRefresh: true })}
              disabled={isLoading || isRefreshing}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 shadow-2xs"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoading || isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>تحديث المجلد الآن</span>
            </button>

            {/* Open Drive Folder (RBAC guarded) */}
            {canOpenDriveFolder ? (
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح المجلد في Drive</span>
              </a>
            ) : (
              <span
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1"
                title="مجلد المصدر محمي ومثبت من قبل المطور"
              >
                <Lock className="w-3 h-3" />
                <span>مجلد معتمد</span>
              </span>
            )}
          </div>
        </div>

        {/* Search Input + Filter Tabs */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {externalSearchQuery === undefined && (
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={internalQuery}
                onChange={(e) => {
                  setInternalQuery(e.target.value);
                  setVisibleCount(compact ? 12 : 48);
                }}
                placeholder="اكتب أي اسم أو جزء من الاسم (مثل: علي) للبحث الفوري المباشر في Google Drive والنظام معاً..."
                className="w-full pr-10 pl-24 py-2.5 rounded-xl bg-white dark:bg-[#090F1E] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              {isSearchingDriveLive && (
                <Loader2 className="w-3.5 h-3.5 text-emerald-500 animate-spin absolute left-14 top-1/2 -translate-y-1/2" />
              )}
              {internalQuery && (
                <button
                  type="button"
                  onClick={() => setInternalQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  مسح
                </button>
              )}
            </div>
          )}

          {/* Category Filter Tabs */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                categoryFilter === 'all'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              الكل ({driveFiles.length + systemMatchTotal})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('image')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                categoryFilter === 'image'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              الصور ({driveImageCount})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('docs')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                categoryFilter === 'docs'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              PDF والوثائق ({driveDocsCount})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('system')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                categoryFilter === 'system'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              نتائج النظام ({systemMatchTotal})
            </button>
          </div>
        </div>

        {/* Folder Metadata & Developer Link Editor */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[11px]">
          <div className="flex items-center gap-2 flex-wrap text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
              <FolderKanban className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              مجلد Drive:
            </span>
            <code
              dir="ltr"
              className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400"
            >
              {resolvedFolderId}
            </code>
            <span className="tabular-nums">
              • ملفات Drive: <strong className="text-slate-900 dark:text-white">{totalInFolder || driveFiles.length}</strong>
            </span>
            {lastUpdatedAt && (
              <span className="tabular-nums text-slate-500 dark:text-slate-400">
                • آخر مزامنة: {lastUpdatedAt}
              </span>
            )}
            {driveSource !== 'none' && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                {driveSource === 'apps_script'
                  ? 'متصل عبر Apps Script'
                  : driveSource === 'oauth_api'
                  ? 'متصل عبر Google API'
                  : 'متصل مباشر بالمجلد'}
              </span>
            )}
          </div>

          {isDeveloper && (
            <div>
              {isEditingFolder ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="text"
                    value={folderInput}
                    onChange={(e) => setFolderInput(e.target.value)}
                    placeholder="الصق رابط مجلد Google Drive أو المعرف..."
                    dir="ltr"
                    className="w-64 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-400 text-[11px] font-mono text-slate-900 dark:text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveDriveFolder}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                  >
                    حفظ
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingFolder(false)}
                    className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setFolderInput(resolvedFolderId);
                    setIsEditingFolder(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/70 dark:hover:bg-amber-900/70 text-amber-900 dark:text-amber-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer border border-amber-300/60 dark:border-amber-700/50"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>تعديل رابط المجلد (للمطور)</span>
                </button>
              )}
            </div>
          )}
        </div>

        {statusBanner && (
          <div
            className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
              statusBanner.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : statusBanner.type === 'warning'
                ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                : 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
            }`}
          >
            {statusBanner.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-5">
        {isLoading ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin mx-auto" />
            <p className="text-xs font-black text-slate-700 dark:text-slate-200">
              جاري جلب كافة الصور وملفات PDF والوثائق من مجلد Google Drive والنظام...
            </p>
          </div>
        ) : (
          <>
            {/* SECTION A: Google Drive Live Files */}
            {categoryFilter !== 'system' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      ملفات مجلد Google Drive ({matchedDriveFiles.length}
                      {activeQuery ? ` مطابقة للبحث "${activeQuery}"` : ''})
                    </span>
                  </h4>
                  {matchedDriveFiles.length > visibleCount && (
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                      عرض {visibleCount} من أصل {matchedDriveFiles.length}
                    </span>
                  )}
                </div>

                {matchedDriveFiles.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 dark:bg-[#0A1020] border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                    <FileImage className="w-9 h-9 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {activeQuery
                        ? `لا توجد ملفات مطابقة للاسم "${activeQuery}" داخل مجلد Google Drive حالياً.`
                        : 'لم يتم العثور على ملفات معروضة في مجلد Google Drive حالياً.'}
                    </p>
                    {driveError && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 max-w-xl mx-auto">
                        {driveError}
                      </p>
                    )}
                    {!activeQuery && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
                        تأكد من أن مجلد Google Drive مضبوط على «أي شخص لديه الرابط يمكنه العرض» أو أن رابط Google Apps Script المحدّث محفوظ في إعدادات المطور.
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div
                      className={`grid gap-3 ${
                        compact
                          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                      }`}
                    >
                      {matchedDriveFiles.slice(0, visibleCount).map((file) => {
                        const deleteKey = `drive:${file.id}`;
                        const isPdfOrDoc = file.category !== 'image';

                        return (
                          <div
                            key={file.id}
                            className="rounded-2xl bg-white dark:bg-[#111A30] border border-slate-200 dark:border-slate-800 hover:border-emerald-500/70 dark:hover:border-emerald-500/60 shadow-2xs p-3 flex flex-col justify-between transition-all group"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1.5 mb-2">
                                {renderCategoryBadge(file)}
                                {file.modifiedTime && (
                                  <span
                                    dir="ltr"
                                    className="text-[10px] font-mono text-slate-500 dark:text-slate-400 tabular-nums"
                                  >
                                    {new Date(file.modifiedTime).toLocaleDateString('ar-IQ')}
                                  </span>
                                )}
                              </div>

                              {/* Preview Surface */}
                              <div
                                onClick={() => {
                                  setZoomLevel(1);
                                  setRotation(0);
                                  const fullImg =
                                    driveSource === 'server_proxy'
                                      ? `/api/drive/image/${encodeURIComponent(file.id)}?sz=w1600`
                                      : file.previewImageUrl;
                                  setPreviewTarget({
                                    kind: 'drive',
                                    id: file.id,
                                    title: file.name,
                                    subtitle:
                                      file.category === 'pdf'
                                        ? 'ملف PDF من Google Drive'
                                        : file.category === 'image'
                                        ? 'صورة محفوظة في Google Drive'
                                        : 'وثيقة محفوظة في Google Drive',
                                    imageUrl: fullImg,
                                    fallbackImageUrl: file.fallbackImageUrl,
                                    embedPreviewUrl: file.embedPreviewUrl,
                                    driveFile: file
                                  });
                                }}
                                className="h-40 rounded-xl bg-slate-100 dark:bg-[#090F1E] overflow-hidden cursor-pointer relative flex items-center justify-center border border-slate-200/70 dark:border-slate-800"
                              >
                                <img
                                  src={
                                    driveSource === 'server_proxy'
                                      ? file.proxyImageUrl
                                      : file.previewImageUrl
                                  }
                                  alt={file.name}
                                  loading="lazy"
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    const el = e.currentTarget;
                                    const step = Number(el.dataset.errStep || '0');
                                    const chain =
                                      driveSource === 'server_proxy'
                                        ? [file.previewImageUrl, file.fallbackImageUrl]
                                        : [file.fallbackImageUrl, file.proxyImageUrl];
                                    if (step < chain.length) {
                                      el.dataset.errStep = String(step + 1);
                                      el.src = chain[step];
                                    } else {
                                      el.style.display = 'none';
                                    }
                                  }}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                                {isPdfOrDoc && (
                                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/85 text-white text-[10px] font-black">
                                    {file.category === 'pdf' ? 'عرض PDF' : 'معاينة وثيقة'}
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-black">
                                  <Eye className="w-4 h-4" />
                                  <span>معاينة</span>
                                </div>
                              </div>

                              <div
                                className="mt-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 truncate"
                                title={file.name}
                              >
                                {file.name}
                              </div>
                            </div>

                            {/* Action Buttons: Preview, Print, Download, Delete */}
                            <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-4 gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setZoomLevel(1);
                                  setRotation(0);
                                  const fullImg =
                                    driveSource === 'server_proxy'
                                      ? `/api/drive/image/${encodeURIComponent(file.id)}?sz=w1600`
                                      : file.previewImageUrl;
                                  setPreviewTarget({
                                    kind: 'drive',
                                    id: file.id,
                                    title: file.name,
                                    imageUrl: fullImg,
                                    fallbackImageUrl: file.fallbackImageUrl,
                                    embedPreviewUrl: file.embedPreviewUrl,
                                    driveFile: file
                                  });
                                }}
                                className="py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/70 text-blue-700 dark:text-blue-300 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                                title="معاينة الملف"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>معاينة</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => printDriveFileDirectly(file)}
                                className="py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/70 text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                                title="طباعة مباشرة"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>طباعة</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadDriveFileAsAsset(file)}
                                className="py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                                title="تنزيل كصورة أو ملف"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>تنزيل</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDrive(file)}
                                className={`py-1.5 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer ${
                                  pendingDeleteKey === deleteKey
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                                }`}
                                title="حذف من Google Drive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{pendingDeleteKey === deleteKey ? 'تأكيد؟' : 'حذف'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {matchedDriveFiles.length > visibleCount && (
                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={() => setVisibleCount((prev) => prev + 48)}
                          className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 text-white text-xs font-black cursor-pointer shadow-xs"
                        >
                          عرض المزيد ({matchedDriveFiles.length - visibleCount} ملف متبقي)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* SECTION B: Matched System Records & Local Archive Images (when searching or in System tab) */}
            {(activeQuery || categoryFilter === 'system' || matchedSystemResults.localImages.length > 0) &&
              systemMatchTotal > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>
                      نتائج مطابقة من قاعدة بيانات النظام ({systemMatchTotal}
                      {activeQuery ? ` للبحث "${activeQuery}"` : ''})
                    </span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* System Requests Matching Query */}
                    {matchedSystemResults.requests.map((req) => (
                      <div
                        key={`sys-req-${req.Request_ID}`}
                        className="rounded-xl bg-slate-50 dark:bg-[#111A30] border border-blue-200/80 dark:border-blue-900/60 p-3 flex flex-col justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-black">
                              معاملة بالنظام
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                              {req.OutgoingNumber ? `صادر: ${req.OutgoingNumber}` : req.Request_ID}
                            </span>
                          </div>
                          <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span className="truncate">{req.CitizenName}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 truncate">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{req.Entity || 'غير محدد'}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {req.Details}
                          </p>
                          {req.AttachedRequestImage && (
                            <div
                              onClick={() => {
                                setZoomLevel(1);
                                setRotation(0);
                                setPreviewTarget({
                                  kind: 'request_image',
                                  id: req.Request_ID,
                                  title: `${req.CitizenName} — ${req.Entity}`,
                                  imageUrl: req.AttachedRequestImage,
                                  request: req
                                });
                              }}
                              className="mt-1.5 h-28 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer"
                            >
                              <img
                                src={req.AttachedRequestImage}
                                alt={req.CitizenName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => handlePrintSystemRecord(req)}
                            className="flex-1 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>طباعة مباشرة</span>
                          </button>
                          {req.AttachedRequestImage && (
                            <button
                              type="button"
                              onClick={() =>
                                handleDownloadLocalImage(
                                  req.AttachedRequestImage!,
                                  `معاملة_${req.CitizenName}_${req.Request_ID}.jpg`
                                )
                              }
                              className="flex-1 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>تنزيل كصورة</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* System Citizens Matching Query */}
                    {matchedSystemResults.citizens.map((cit) => (
                      <div
                        key={`sys-cit-${cit.Citizen_ID}`}
                        className="rounded-xl bg-slate-50 dark:bg-[#111A30] border border-indigo-200/80 dark:border-indigo-900/60 p-3 flex flex-col justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 text-[10px] font-black">
                              مراجع بالنظام
                            </span>
                            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                              {cit.Citizen_ID}
                            </span>
                          </div>
                          <div className="text-xs font-black text-slate-900 dark:text-white">
                            {cit.FullName}
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400">
                            {cit.District || '—'} {cit.Phone1 ? `• ${cit.Phone1}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePrintSystemRecord(undefined, cit)}
                          className="w-full py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>طباعة بطاقة السجل</span>
                        </button>
                      </div>
                    ))}

                    {/* Local IndexedDB Images */}
                    {matchedSystemResults.localImages.slice(0, 12).map((img) => {
                      const delKey = `local:${img.id}`;
                      return (
                        <div
                          key={`local-${img.id}`}
                          className="rounded-xl bg-white dark:bg-[#111A30] border border-slate-200 dark:border-slate-800 p-3 flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                                صورة مؤرشفة
                              </span>
                              <span className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                {img.citizenName}
                              </span>
                            </div>
                            <div
                              onClick={() => {
                                setZoomLevel(1);
                                setRotation(0);
                                setPreviewTarget({
                                  kind: 'local_image',
                                  id: img.id,
                                  title: img.citizenName || img.fileName,
                                  subtitle: img.entity || img.fileName,
                                  imageUrl: img.dataUrl,
                                  localImage: img
                                });
                              }}
                              className="h-32 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 cursor-pointer"
                            >
                              <img
                                src={img.dataUrl}
                                alt={img.fileName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="mt-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {img.citizenName || img.fileName}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() =>
                                printImageIsolated(img.dataUrl, img.fileName, img.citizenName)
                              }
                              className="py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              <span>طباعة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDownloadLocalImage(img.dataUrl, img.fileName)
                              }
                              className="py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>تنزيل</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLocal(img)}
                              className={`py-1.5 rounded-lg font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer ${
                                pendingDeleteKey === delKey
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{pendingDeleteKey === delKey ? 'تأكيد؟' : 'حذف'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
          </>
        )}
      </div>

      {/* FULLSCREEN PREVIEW LIGHTBOX MODAL (Images with Zoom/Rotate + PDF/Office Embedded Viewer) */}
      {previewTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setPreviewTarget(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-white dark:bg-[#0D1426] border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111A30] flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {previewTarget.title}
                </h4>
                {previewTarget.subtitle && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {previewTarget.subtitle}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(!previewTarget.driveFile ||
                  previewTarget.driveFile.category === 'image') && (
                  <>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                      className="p-2 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
                      title="تكبير"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                      className="p-2 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
                      title="تصغير"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="p-2 rounded-lg bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
                      title="تدوير 90 درجة"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (previewTarget.driveFile) {
                      printDriveFileDirectly(previewTarget.driveFile);
                    } else if (previewTarget.imageUrl) {
                      printImageIsolated(previewTarget.imageUrl, previewTarget.title);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة مباشرة</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (previewTarget.driveFile) {
                      downloadDriveFileAsAsset(previewTarget.driveFile);
                    } else if (previewTarget.imageUrl) {
                      handleDownloadLocalImage(previewTarget.imageUrl, previewTarget.title);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTarget(null)}
                  className="p-2 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 cursor-pointer"
                  title="إغلاق المعاينة"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto bg-slate-100 dark:bg-[#070C18] flex items-center justify-center p-4 min-h-[60vh]">
              {previewTarget.driveFile && previewTarget.driveFile.category !== 'image' ? (
                <iframe
                  src={previewTarget.embedPreviewUrl}
                  title={previewTarget.title}
                  className="w-full h-[72vh] rounded-xl border border-slate-300 dark:border-slate-700 bg-white"
                  allow="autoplay"
                />
              ) : (
                <img
                  src={previewTarget.imageUrl}
                  alt={previewTarget.title}
                  referrerPolicy="no-referrer"
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: 'transform 180ms ease'
                  }}
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (previewTarget.fallbackImageUrl && el.src !== previewTarget.fallbackImageUrl) {
                      el.src = previewTarget.fallbackImageUrl;
                    }
                  }}
                  className="max-w-full max-h-[72vh] object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
