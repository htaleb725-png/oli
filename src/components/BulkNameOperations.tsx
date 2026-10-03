import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ProcessingStatus, OfficeRequest, Citizen } from '../types';
import * as XLSX from 'xlsx';
import { 
  findBestArabicMatch, 
  NameMatchResult, 
  extractNameTokens 
} from '../utils/arabicNameMatcher';
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  FileSpreadsheet, 
  HelpCircle, 
  ArrowRightLeft, 
  Sparkles, 
  ClipboardCheck, 
  Filter, 
  Clock,
  CheckCheck,
  ShieldCheck,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

interface InspectionResult {
  originalName: string;
  matchedCitizenName?: string;
  citizenId?: string;
  requestId?: string;
  entity?: string;
  deliveryStatus: 'مستلم' | 'غير مستلم' | 'غير مسجل';
  processingStatus?: string;
  phone?: string;
  notes?: string;
  matchType?: string;
  matchLabel?: string;
  confidence?: number;
}

export const BulkNameOperations: React.FC = () => {
  const { citizens, requests, bulkUpdateRequestsStatus } = useApp();

  const [activeTab, setActiveTab] = useState<'check_delivery' | 'bulk_update'>('check_delivery');
  const [matchMode, setMatchMode] = useState<'quad_triple' | 'allow_two_part'>('quad_triple');

  // ==========================================
  // BOX 1: CHECK DELIVERY STATUS (UP TO 1000 NAMES)
  // ==========================================
  const [inputNamesText, setInputNamesText] = useState('');
  const [inspectionResults, setInspectionResults] = useState<InspectionResult[] | null>(null);
  const [filterResult, setFilterResult] = useState<'all' | 'delivered' | 'not_delivered' | 'not_found'>('all');
  const [filterMatchType, setFilterMatchType] = useState<string>('all');

  // Run Inspection
  const handleInspectNames = () => {
    if (!inputNamesText.trim()) return;

    // Split by newlines, commas, or semicolons
    const rawLines = inputNamesText
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 1);

    // Limit to max 1000 names as requested
    const namesToCheck = rawLines.slice(0, 1000);

    const allowTwoPart = matchMode === 'allow_two_part';

    const results: InspectionResult[] = namesToCheck.map(rawName => {
      // 1. Smart match against requests first
      const reqMatch = findBestArabicMatch<OfficeRequest>(
        rawName,
        requests,
        (r: OfficeRequest) => r.CitizenName || '',
        { allowTwoPart }
      );

      if (reqMatch.match && reqMatch.result.isMatch) {
        const matchedReq = reqMatch.match;
        const isDelivered = 
          matchedReq.RequestStatus === 'مستلم' || 
          matchedReq.ProcessingStatus === 'منجز' || 
          !!matchedReq.AttachmentResponse;

        return {
          originalName: rawName,
          matchedCitizenName: matchedReq.CitizenName,
          citizenId: matchedReq.Citizen_ID,
          requestId: matchedReq.Request_ID,
          entity: matchedReq.Entity,
          deliveryStatus: isDelivered ? 'مستلم' : 'غير مستلم',
          processingStatus: matchedReq.ProcessingStatus,
          phone: matchedReq.CitizenPhone,
          notes: matchedReq.DeputyNotes,
          matchType: reqMatch.result.matchType,
          matchLabel: reqMatch.result.matchLabel,
          confidence: reqMatch.result.confidence
        };
      }

      // 2. Smart match against registered citizens
      const citMatch = findBestArabicMatch<Citizen>(
        rawName,
        citizens,
        (c: Citizen) => c.FullName || '',
        { allowTwoPart }
      );

      if (citMatch.match && citMatch.result.isMatch) {
        const matchedCitizen = citMatch.match;
        const citReq = requests.find(r => r.Citizen_ID === matchedCitizen.Citizen_ID);

        if (citReq) {
          const isDelivered = 
            citReq.RequestStatus === 'مستلم' || 
            citReq.ProcessingStatus === 'منجز' || 
            !!citReq.AttachmentResponse;

          return {
            originalName: rawName,
            matchedCitizenName: matchedCitizen.FullName,
            citizenId: matchedCitizen.Citizen_ID,
            requestId: citReq.Request_ID,
            entity: citReq.Entity,
            deliveryStatus: isDelivered ? 'مستلم' : 'غير مستلم',
            processingStatus: citReq.ProcessingStatus,
            phone: matchedCitizen.Phone1,
            notes: citReq.DeputyNotes,
            matchType: citMatch.result.matchType,
            matchLabel: citMatch.result.matchLabel,
            confidence: citMatch.result.confidence
          };
        } else {
          return {
            originalName: rawName,
            matchedCitizenName: matchedCitizen.FullName,
            citizenId: matchedCitizen.Citizen_ID,
            deliveryStatus: 'غير مستلم',
            processingStatus: 'مسجل بدون طلب حالي',
            phone: matchedCitizen.Phone1,
            notes: 'مسجل في الاستعلامات فقط',
            matchType: citMatch.result.matchType,
            matchLabel: citMatch.result.matchLabel,
            confidence: citMatch.result.confidence
          };
        }
      }

      // 3. Not found in system
      return {
        originalName: rawName,
        deliveryStatus: 'غير مسجل',
        notes: 'الاسم غير متطابق مع أي قيد في قاعدة البيانات',
        matchType: 'none',
        matchLabel: 'غير مسجل',
        confidence: 0
      };
    });

    setInspectionResults(results);
  };

  // Paste sample names with variety (3-part, 4-part, titles, without tribe)
  const handlePasteSampleNames = () => {
    const sample = [
      'محمد جاسم خلف', // ثلاثي يطابق رباعي محمد جاسم خلف الخفاجي
      'فاطمة كريم محسن', // ثلاثي يطابق فاطمة كريم محسن الساعدي
      'كرار فالح غانم الناشي', // رباعي كامل
      'السيد علي حسين كاظم', // مع لقب تشريفي "السيد"
      'قاسم جبار الناشي', // ثنائي مع العشيرة
      'عادل رزاق كاظم', // ثلاثي
      'أحمد سعدون الإبراهيمي', // ثلاثي مع اللقب
      'ميثم حميد راضي الجابري', // رباعي
      'صباح جبار حسن', // ثلاثي
      'زينب حيدر فاضل', // ثلاثي
      'مهند عادل فليح الغزي', // رباعي
      'علاء الدين كريم عبد الزهرة (تجربة غير مسجل)'
    ].join('\n');
    setInputNamesText(sample);
  };

  // Filtered Inspection List
  const filteredInspectionResults = useMemo(() => {
    if (!inspectionResults) return [];
    return inspectionResults.filter(r => {
      // Filter by status
      if (filterResult === 'delivered' && r.deliveryStatus !== 'مستلم') return false;
      if (filterResult === 'not_delivered' && r.deliveryStatus !== 'غير مستلم') return false;
      if (filterResult === 'not_found' && r.deliveryStatus !== 'غير مسجل') return false;

      // Filter by match type
      if (filterMatchType !== 'all') {
        if (filterMatchType === 'triple' && r.matchType !== 'triple_in_quad' && r.matchType !== 'exact_triple') return false;
        if (filterMatchType === 'quad' && r.matchType !== 'exact_quad') return false;
        if (filterMatchType === 'clan' && r.matchType !== 'triple_with_clan') return false;
      }

      return true;
    });
  }, [inspectionResults, filterResult, filterMatchType]);

  // Counts for Inspection Badges
  const deliveredCount = inspectionResults?.filter(r => r.deliveryStatus === 'مستلم').length || 0;
  const notDeliveredCount = inspectionResults?.filter(r => r.deliveryStatus === 'غير مستلم').length || 0;
  const notFoundCount = inspectionResults?.filter(r => r.deliveryStatus === 'غير مسجل').length || 0;
  const matchedCount = (inspectionResults?.length || 0) - notFoundCount;

  // Export Inspection to Excel
  const exportInspectionToExcel = () => {
    if (!inspectionResults) return;

    const data = inspectionResults.map((r, idx) => ({
      'ت': idx + 1,
      'الاسم المدخل للقائمة': r.originalName,
      'الاسم المطابق في النظام': r.matchedCitizenName || 'غير مسجل',
      'نوع المطابقة': r.matchLabel || 'غير مطابق',
      'دقة المطابقة %': r.confidence ? `${r.confidence}%` : '0%',
      'حالة الاستلام': r.deliveryStatus,
      'حالة المعاملة': r.processingStatus || '-',
      'رقم الطلب': r.requestId || '-',
      'الجهة المعنية': r.entity || '-',
      'الهاتف': r.phone || '-',
      'ملاحظات': r.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'فحص_استلام_الطلبات');
    XLSX.writeFile(wb, `فحص_استلام_الطلبات_1000اسم_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ==========================================
  // BOX 2: BULK STATUS UPDATE (UP TO 1000 NAMES)
  // ==========================================
  const [updateNamesText, setUpdateNamesText] = useState('');
  const [targetStatus, setTargetStatus] = useState<ProcessingStatus>('منجز');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updatePreviewList, setUpdatePreviewList] = useState<{ 
    name: string; 
    matchedReq?: OfficeRequest;
    matchResult?: NameMatchResult;
  }[] | null>(null);
  const [updateSuccessReport, setUpdateSuccessReport] = useState<{ updatedCount: number; updatedRequests: OfficeRequest[] } | null>(null);

  // Paste sample for bulk update
  const handlePasteUpdateSample = () => {
    const sample = requests.slice(0, 10).map(r => {
      // Create variations: some 3-part, some 4-part
      const parts = (r.CitizenName || '').split(' ');
      if (parts.length >= 4 && Math.random() > 0.4) {
        return parts.slice(0, 3).join(' '); // 3-part variation
      }
      return r.CitizenName;
    }).join('\n');
    setUpdateNamesText(sample);
  };

  // Preview matches before update
  const handlePreviewUpdate = () => {
    if (!updateNamesText.trim()) return;

    const rawLines = updateNamesText
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 1)
      .slice(0, 1000);

    const allowTwoPart = matchMode === 'allow_two_part';

    const preview = rawLines.map(rawName => {
      const match = findBestArabicMatch<OfficeRequest>(
        rawName,
        requests,
        (r: OfficeRequest) => r.CitizenName || '',
        { allowTwoPart }
      );

      return {
        name: rawName,
        matchedReq: match.match || undefined,
        matchResult: match.result
      };
    });

    setUpdatePreviewList(preview);
    setUpdateSuccessReport(null);
  };

  // Execute Bulk Update
  const handleExecuteBulkUpdate = () => {
    if (!updateNamesText.trim()) return;

    const rawLines = updateNamesText
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 1)
      .slice(0, 1000);

    const result = bulkUpdateRequestsStatus(rawLines, targetStatus, updateNotes.trim() || undefined);
    setUpdateSuccessReport(result);
    setUpdatePreviewList(null);
  };

  // Export Bulk Update Report to Excel
  const exportUpdateReportToExcel = () => {
    if (!updateSuccessReport) return;

    const data = updateSuccessReport.updatedRequests.map((r, idx) => ({
      'ت': idx + 1,
      'رقم الطلب': r.Request_ID,
      'اسم المواطن': r.CitizenName,
      'الهاتف': r.CitizenPhone || '',
      'الجهة المعنية': r.Entity,
      'الحالة الجديدة': r.ProcessingStatus,
      'توجيه وملاحظات النائب': r.DeputyNotes || '',
      'تاريخ الطلب': r.CreatedAt
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير_التحديث_الجماعي');
    XLSX.writeFile(wb, `تقرير_تحديث_الحالة_1000_${targetStatus.replace(/\s+/g, '_')}.xlsx`);
  };

  // Helper for match badge render
  const renderMatchBadge = (type?: string, confidence?: number) => {
    if (!type || type === 'none') {
      return (
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold">
          غير مسجل
        </span>
      );
    }

    if (type === 'exact_quad') {
      return (
        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>رباعي تام ({confidence}%)</span>
        </span>
      );
    }

    if (type === 'triple_in_quad' || type === 'exact_triple') {
      return (
        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[10px] font-bold inline-flex items-center gap-1">
          <CheckCheck className="w-3 h-3 text-blue-600" />
          <span>ثلاثي معتمد ({confidence}%)</span>
        </span>
      );
    }

    if (type === 'triple_with_clan') {
      return (
        <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-bold inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-purple-600" />
          <span>ثلاثي + اللقب ({confidence}%)</span>
        </span>
      );
    }

    return (
      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
        مطابقة تقريبية ({confidence}%)
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-5 text-right font-['Tajawal',sans-serif]">
      {/* Header & Main Tabs */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              <span>المعالجة الجماعية الذكية لقوائم الأسماء (سعة موسعة حتى 1000 اسم)</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black font-mono">
              1000 اسم
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            خوارزمية مطابقة ذكية تعتمد الاسم الرباعي والثلاثي معاً، وتتجاوز اختلاف الألقاب والبادئات والأخطاء الإملائية
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('check_delivery')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'check_delivery'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>الخانة الأولى: فحص الاستلام (منو استلم ومنو ممستلم)</span>
          </button>

          <button
            onClick={() => setActiveTab('bulk_update')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'bulk_update'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>الخانة الثانية: تحديث الحالة الجماعي (القوائم المنشورة)</span>
          </button>
        </div>
      </div>

      {/* Smart Matching Configuration Bar */}
      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700 font-bold">
          <SlidersHorizontal className="w-4 h-4 text-blue-600" />
          <span>إعدادات خوارزمية المطابقة المعتمدة:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label 
            onClick={() => setMatchMode('quad_triple')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 font-bold ${
              matchMode === 'quad_triple' 
                ? 'bg-blue-600 text-white shadow-2xs' 
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>اعتماد الاسم الرباعي والثلاثي معاً (الموصى به - دقة 95%+)</span>
          </label>

          <label 
            onClick={() => setMatchMode('allow_two_part')}
            className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 font-bold ${
              matchMode === 'allow_two_part' 
                ? 'bg-purple-600 text-white shadow-2xs' 
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>توسيع المطابقة (السماح بالاسم الثنائي مع اللقب)</span>
          </label>
        </div>
      </div>

      {/* ==========================================
          TAB 1: CHECK DELIVERY STATUS (UP TO 1000 NAMES)
          ========================================== */}
      {activeTab === 'check_delivery' && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-blue-900">آلية الفحص والتدقيق الموسعة: </span>
              يمكنك الآن لصق قائمة تحتوي على حتى <span className="font-bold text-blue-800">1000 اسم دفعة واحدة</span>. حتى لو كانت الأسماء في قائمتك <span className="font-bold underline">ثلاثية فقط</span> أو <span className="font-bold underline">رباعية</span> أو مسبوقة بألقاب تشريفية (مثل السيد أو الشيخ أو الحاج)، يقوم النظام تلقائياً بمطابقتها وتحديد من هو:
              <span className="inline-block mx-1 font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">مستلم</span>،
              <span className="inline-block mx-1 font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">غير مستلم</span>، أو
              <span className="inline-block mx-1 font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">غير مسجل</span>.
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>الصق قائمة الأسماء هنا (سعة حتى 1000 اسم):</span>
                <span className="text-[11px] text-slate-500 font-normal">(اسم في كل سطر أو مفصولة بفواصل)</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePasteSampleNames}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>لصق نموذج أسماء متنوعة (ثلاثي/رباعي)</span>
                </button>

                {inputNamesText && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputNamesText('');
                      setInspectionResults(null);
                    }}
                    className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                  >
                    مسح القائمة
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={7}
              value={inputNamesText}
              onChange={(e) => setInputNamesText(e.target.value)}
              placeholder="الصق هنا الأسماء (مثال:&#10;محمد جاسم خلف (اسم ثلاثي يطابق الرباعي بالسيستم)&#10;فاطمة كريم محسن&#10;كرار فالح غانم الناشي&#10;السيد قاسم جبار الناشي...)"
              className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono leading-relaxed outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/40"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span>عدد الأسماء المدخلة في الصندوق:</span>
                <span className="font-black text-blue-700 font-mono text-sm px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                  {inputNamesText.trim() ? inputNamesText.split(/[\n,;]+/).filter(s => s.trim().length > 1).length : 0}
                </span>
                <span className="text-slate-400">/ 1000 اسم كحد أقصى</span>
              </div>

              <button
                type="button"
                onClick={handleInspectNames}
                disabled={!inputNamesText.trim()}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
              >
                <Search className="w-4 h-4" />
                <span>🔍 فحص وتدقيق حالة الاستلام بالمطابقة الرباعية والثلاثية</span>
              </button>
            </div>
          </div>

          {/* Results Area */}
          {inspectionResults && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              {/* Summary KPI Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div 
                  onClick={() => setFilterResult('all')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    filterResult === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-xs font-semibold">إجمالي الأسماء المفحوصة</div>
                  <div className="text-2xl font-black mt-1 font-mono">{inspectionResults.length}</div>
                  <div className="text-[10px] mt-0.5 opacity-80">
                    تمت مطابقة {matchedCount} بنجاح
                  </div>
                </div>

                <div 
                  onClick={() => setFilterResult('delivered')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    filterResult === 'delivered' ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center justify-between">
                    <span>مستلم للطلب / الإجابة</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black mt-1 font-mono">{deliveredCount}</div>
                  <div className="text-[10px] mt-0.5 opacity-80">
                    {inspectionResults.length > 0 ? Math.round((deliveredCount / inspectionResults.length) * 100) : 0}% من القائمة
                  </div>
                </div>

                <div 
                  onClick={() => setFilterResult('not_delivered')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    filterResult === 'not_delivered' ? 'bg-amber-700 text-white border-amber-700 shadow-xs' : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center justify-between">
                    <span>غير مستلم / قيد الإجراء</span>
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black mt-1 font-mono">{notDeliveredCount}</div>
                  <div className="text-[10px] mt-0.5 opacity-80">
                    {inspectionResults.length > 0 ? Math.round((notDeliveredCount / inspectionResults.length) * 100) : 0}% من القائمة
                  </div>
                </div>

                <div 
                  onClick={() => setFilterResult('not_found')}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    filterResult === 'not_found' ? 'bg-slate-700 text-white border-slate-700 shadow-xs' : 'bg-slate-100 border-slate-300 text-slate-800'
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center justify-between">
                    <span>غير مسجل بالنظام</span>
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="text-2xl font-black mt-1 font-mono">{notFoundCount}</div>
                  <div className="text-[10px] mt-0.5 opacity-80">
                    {inspectionResults.length > 0 ? Math.round((notFoundCount / inspectionResults.length) * 100) : 0}% يحتاجون لتسجيل
                  </div>
                </div>
              </div>

              {/* Action and Sub-filter Bar */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">تصفية نوع المطابقة:</span>
                  <select
                    value={filterMatchType}
                    onChange={(e) => setFilterMatchType(e.target.value)}
                    className="p-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 font-semibold outline-none"
                  >
                    <option value="all">كافة أنواع المطابقة ({filteredInspectionResults.length})</option>
                    <option value="quad">مطابقة رباعية تامة فقط</option>
                    <option value="triple">مطابقة ثلاثية معتمدة</option>
                    <option value="clan">مطابقة ثلاثي + اللقب/العشيرة</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={exportInspectionToExcel}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>تصدير النتائج كاملة Excel (1000)</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة كشف الفحص</span>
                  </button>
                </div>
              </div>

              {/* Results Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5">ت</th>
                      <th className="p-2.5">الاسم المدخل للقائمة</th>
                      <th className="p-2.5">الاسم المطابق في النظام</th>
                      <th className="p-2.5">نوع المطابقة</th>
                      <th className="p-2.5 text-center">حالة الاستلام</th>
                      <th className="p-2.5">حالة المعاملة</th>
                      <th className="p-2.5">الجهة المعنية</th>
                      <th className="p-2.5">الهاتف</th>
                      <th className="p-2.5">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInspectionResults.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900">{r.originalName}</td>
                        <td className="p-2.5 font-semibold text-slate-800">
                          {r.matchedCitizenName ? (
                            <span className="text-blue-700">{r.matchedCitizenName}</span>
                          ) : (
                            <span className="text-slate-400">غير مسجل بالنظام</span>
                          )}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          {renderMatchBadge(r.matchType, r.confidence)}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          {r.deliveryStatus === 'مستلم' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>مستلم</span>
                            </span>
                          ) : r.deliveryStatus === 'غير مستلم' ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              <span>غير مستلم</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
                              غير مسجل
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="font-semibold text-slate-700">{r.processingStatus || '-'}</span>
                        </td>
                        <td className="p-2.5 text-slate-600">{r.entity || '-'}</td>
                        <td className="p-2.5 font-mono text-slate-600" dir="ltr">{r.phone || '-'}</td>
                        <td className="p-2.5 text-slate-500 max-w-xs truncate" title={r.notes}>
                          {r.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          TAB 2: BULK STATUS UPDATE (UP TO 1000 NAMES)
          ========================================== */}
      {activeTab === 'bulk_update' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-emerald-900">تحديث الحالة الجماعي الذكي (حتى 1000 اسم): </span>
              عند نشر وجبات الأسماء المشمولة (سواء كانت الأسماء بالقائمة ثلاثية أو رباعية)، الصق القائمة هنا وحدد الحالة المستهدفة (مثلاً: <span className="font-bold text-emerald-800">منجز ⭐</span>).
              سيتعرف النظام على أصحاب الطلبات بالاسم الثلاثي المطابق لبداية الاسم الرباعي ويغير حالاتهم دفعة واحدة ويوثقها في سجل التدقيق والرقابة.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                تغيير حالة المعاملة إلى:
              </label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as ProcessingStatus)}
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="منجز">منجز (تم الإنجاز بنجاح) ⭐</option>
                <option value="قيد الإجراء">قيد الإجراء</option>
                <option value="مرسل إلى الوزارة/الهيئة">مرسل إلى الوزارة/الهيئة</option>
                <option value="تم الطباعة">تم الطباعة</option>
                <option value="قيد التدقيق">قيد التدقيق</option>
                <option value="بانتظار الموافقة">بانتظار الموافقة</option>
                <option value="مرفوض">مرفوض</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-800 mb-1">
                ملاحظات التحديث الجماعي / اسم الوجبة:
              </label>
              <input
                type="text"
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
                placeholder="مثال: تم إنجاز المعاملة وفق القوائم الوزارية الصادرة بتاريخ اليوم / وجبة الرعاية الاجتماعية"
                className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>قائمة الأسماء المنشورة المراد تعديل حالتها (حتى 1000 اسم):</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePasteUpdateSample}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>لصق نموذج أسماء طلبات حالية للتجربة</span>
                </button>
                {updateNamesText && (
                  <button
                    type="button"
                    onClick={() => {
                      setUpdateNamesText('');
                      setUpdatePreviewList(null);
                      setUpdateSuccessReport(null);
                    }}
                    className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:underline cursor-pointer"
                  >
                    مسح
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={7}
              value={updateNamesText}
              onChange={(e) => setUpdateNamesText(e.target.value)}
              placeholder="الصق هنا قائمة الأسماء المنشورة حتى 1000 اسم...&#10;قاسم جبار حسن الناشي&#10;عادل رزاق كاظم (ثلاثي)&#10;أحمد سعدون كاظم الإبراهيمي..."
              className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono leading-relaxed outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/40"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="text-xs text-slate-600">
                عدد الأسماء في القائمة: <span className="font-bold text-emerald-700 font-mono text-sm px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
                  {updateNamesText.trim() ? updateNamesText.split(/[\n,;]+/).filter(s => s.trim().length > 1).length : 0}
                </span> اسم / 1000 كحد أقصى
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePreviewUpdate}
                  disabled={!updateNamesText.trim()}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer transition-colors"
                >
                  معاينة المطابقة أولاً
                </button>

                <button
                  type="button"
                  onClick={handleExecuteBulkUpdate}
                  disabled={!updateNamesText.trim()}
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>⚡ تنفيذ تغيير الحالة الجماعي إلى ({targetStatus})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Preview List */}
          {updatePreviewList && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800">
                  معاينة الأسماء المطابقة قبل التحديث ({updatePreviewList.filter(p => !!p.matchedReq).length} اسم مطابق له طلب نشط)
                </h4>
                <button
                  onClick={handleExecuteBulkUpdate}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  تأكيد وتطبيق التحديث الآن
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2">الاسم المدخل</th>
                      <th className="p-2">الاسم المطابق بالنظام</th>
                      <th className="p-2">نوع المطابقة</th>
                      <th className="p-2">رقم الطلب</th>
                      <th className="p-2">الحالة الحالية</th>
                      <th className="p-2">الحالة بعد التحديث</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {updatePreviewList.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-slate-900">{p.name}</td>
                        <td className="p-2 text-slate-700">
                          {p.matchedReq ? (
                            <span className="text-blue-700 font-semibold">{p.matchedReq.CitizenName}</span>
                          ) : (
                            <span className="text-slate-400">غير مطابق</span>
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {renderMatchBadge(p.matchResult?.matchType, p.matchResult?.confidence)}
                        </td>
                        <td className="p-2 font-mono text-blue-700 font-bold">{p.matchedReq?.Request_ID || '-'}</td>
                        <td className="p-2 text-slate-600">{p.matchedReq?.ProcessingStatus || '-'}</td>
                        <td className="p-2 font-bold text-emerald-700">{p.matchedReq ? targetStatus : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Report */}
          {updateSuccessReport && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-950 text-sm">
                      تم بنجاح تحديث حالة {updateSuccessReport.updatedCount} طلب إلى ({targetStatus})
                    </h4>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      تمت المطابقة بالاسم الرباعي والثلاثي معاً وتوثيق العملية في سجل الرقابة والتدقيق
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={exportUpdateReportToExcel}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>تصدير التقرير Excel</span>
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>طباعة التقرير الرسمي</span>
                  </button>
                </div>
              </div>

              {/* Updated requests list */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5">رقم الطلب</th>
                      <th className="p-2.5">اسم المواطن</th>
                      <th className="p-2.5">الجهة المعنية</th>
                      <th className="p-2.5">الحالة الجديدة</th>
                      <th className="p-2.5">الهاتف</th>
                      <th className="p-2.5">ملاحظات الإنجاز</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {updateSuccessReport.updatedRequests.map((req, idx) => (
                      <tr key={`${req.Request_ID}-${idx}`} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-blue-700">{req.Request_ID}</td>
                        <td className="p-2.5 font-bold text-slate-900">{req.CitizenName}</td>
                        <td className="p-2.5 text-slate-700">{req.Entity}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {req.ProcessingStatus}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono text-slate-600" dir="ltr">{req.CitizenPhone || '-'}</td>
                        <td className="p-2.5 text-slate-600 max-w-xs truncate">{req.DeputyNotes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
