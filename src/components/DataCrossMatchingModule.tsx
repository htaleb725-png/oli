import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Citizen, OfficeRequest, Interview, OrganizationRecord } from '../types';
import * as XLSX from 'xlsx';
import {
  findBestArabicMatch,
  extractNameTokens,
  normalizeArabicText,
  MatchType
} from '../utils/arabicNameMatcher';
import {
  Search,
  FileSpreadsheet,
  Printer,
  FileText,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Edit,
  Sliders,
  Trash2,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowUpDown,
  Filter,
  Eye,
  Check,
  UserX,
  UserCheck,
  ShieldCheck,
  HelpCircle,
  Copy
} from 'lucide-react';

export type MatchFilterMode = 'quad' | 'triple' | 'exact' | 'smart';

export interface CrossMatchResult {
  index: number;
  inputName: string;
  isFound: boolean;
  matchType: MatchType | string;
  matchLabel: string;
  confidence: number;
  // Matched entities
  citizen?: Citizen;
  requests: OfficeRequest[];
  interviews: Interview[];
  orgRecords: OrganizationRecord[];
  isBlocked: boolean;
  blockReason?: string;
}

interface DataCrossMatchingModuleProps {
  onOpenCitizenEdit?: (citizen: Citizen) => void;
}

export const DataCrossMatchingModule: React.FC<DataCrossMatchingModuleProps> = () => {
  const {
    citizens,
    requests,
    interviews,
    organizationRecords,
    blockCitizen,
    unblockCitizen,
    updateCitizen,
    currentUser,
    systemSettings,
    setSelectedCitizenForHistory
  } = useApp();

  // Input & Matching Options
  const [inputNamesText, setInputNamesText] = useState('');
  const [matchMode, setMatchMode] = useState<MatchFilterMode>('smart');
  const [results, setResults] = useState<CrossMatchResult[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Results Filter & Search
  const [statusFilter, setStatusFilter] = useState<'all' | 'found' | 'not_found' | 'blocked' | 'has_requests'>('all');
  const [tableSearch, setTableSearch] = useState('');

  // Blocking Modal
  const [blockingTarget, setBlockingTarget] = useState<Citizen | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState('');

  // Editing Citizen Modal
  const [editingCitizen, setEditingCitizen] = useState<Citizen | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editJob, setEditJob] = useState('');
  const [editEducation, setEditEducation] = useState('');

  // Perform Cross-matching across entire system
  const handleRunCrossMatching = () => {
    if (!inputNamesText.trim()) {
      alert('يرجى لصق أو كتابة قائمة بالأسماء أولاً.');
      return;
    }

    setIsProcessing(true);

    setTimeout(() => {
      // Split by newlines, commas, or semicolons
      const rawLines = inputNamesText
        .split(/[\r\n,;]+/)
        .map(l => l.trim())
        .filter(l => l.length >= 3);

      // Deduplicate or preserve lines
      const output: CrossMatchResult[] = [];

      rawLines.forEach((name, idx) => {
        let bestCitizen: Citizen | undefined;
        let bestMatchInfo = {
          isMatch: false,
          matchType: 'none' as MatchType,
          matchLabel: 'غير مطابق',
          confidence: 0
        };

        const normQuery = normalizeArabicText(name);

        if (matchMode === 'exact') {
          // Exact match
          bestCitizen = citizens.find(c => {
            const normCit = normalizeArabicText(c.FullName);
            return normCit === normQuery;
          });
          if (bestCitizen) {
            bestMatchInfo = {
              isMatch: true,
              matchType: 'exact_quad',
              matchLabel: 'مطابقة تامة',
              confidence: 100
            };
          }
        } else {
          // Quad, triple, or smart matching using findBestArabicMatch
          const { match, result } = findBestArabicMatch(
            name,
            citizens,
            c => c.Surname ? `${c.FullName} ${c.Surname}` : c.FullName,
            { allowTwoPart: matchMode === 'triple' }
          );
          if (match && result.isMatch) {
            bestCitizen = match;
            bestMatchInfo = result;
          }
        }

        // If matched a citizen, get their related records
        let citizenRequests: OfficeRequest[] = [];
        let citizenInterviews: Interview[] = [];
        let citizenOrgs: OrganizationRecord[] = [];
        let isBlocked = false;
        let blockReason: string | undefined;

        if (bestCitizen) {
          citizenRequests = requests.filter(r => r.Citizen_ID === bestCitizen?.Citizen_ID);
          citizenInterviews = interviews.filter(i => i.Citizen_ID === bestCitizen?.Citizen_ID);
          citizenOrgs = organizationRecords.filter(o => o.Citizen_ID === bestCitizen?.Citizen_ID);
          isBlocked = Boolean(bestCitizen.IsBlocked);
          blockReason = bestCitizen.BlockReason;
        } else {
          // Also check direct requests by CitizenName in case citizen record was removed
          citizenRequests = requests.filter(r => {
            const normReqName = normalizeArabicText(r.CitizenName);
            return normReqName.includes(normQuery) || normQuery.includes(normReqName);
          });
        }

        output.push({
          index: idx + 1,
          inputName: name,
          isFound: Boolean(bestCitizen) || citizenRequests.length > 0,
          matchType: bestMatchInfo.matchType,
          matchLabel: bestMatchInfo.matchLabel,
          confidence: bestMatchInfo.confidence,
          citizen: bestCitizen,
          requests: citizenRequests,
          interviews: citizenInterviews,
          orgRecords: citizenOrgs,
          isBlocked,
          blockReason
        });
      });

      setResults(output);
      setIsProcessing(false);
    }, 100);
  };

  // Filtered Results
  const filteredResults = useMemo(() => {
    if (!results) return [];

    return results.filter(item => {
      // Status filter
      if (statusFilter === 'found' && !item.isFound) return false;
      if (statusFilter === 'not_found' && item.isFound) return false;
      if (statusFilter === 'blocked' && !item.isBlocked) return false;
      if (statusFilter === 'has_requests' && item.requests.length === 0) return false;

      // Table search
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        const inInput = item.inputName.toLowerCase().includes(q);
        const inCit = item.citizen?.FullName.toLowerCase().includes(q) || item.citizen?.Phone1.includes(q);
        const inReq = item.requests.some(r => r.Details.toLowerCase().includes(q) || r.Entity.toLowerCase().includes(q));
        if (!inInput && !inCit && !inReq) return false;
      }

      return true;
    });
  }, [results, statusFilter, tableSearch]);

  // Statistics
  const stats = useMemo(() => {
    if (!results) return null;
    const total = results.length;
    const found = results.filter(r => r.isFound).length;
    const notFound = total - found;
    const blocked = results.filter(r => r.isBlocked).length;
    const withReqs = results.filter(r => r.requests.length > 0).length;
    return { total, found, notFound, blocked, withReqs };
  }, [results]);

  // Export to Excel
  const handleExportExcel = () => {
    if (!results || results.length === 0) return;

    const dataToExport = filteredResults.map((item, idx) => ({
      'ت': idx + 1,
      'الاسم المدخل في القائمة': item.inputName,
      'حالة العثور في المنظومة': item.isFound ? 'مسجل ✓' : 'غير مسجل ✕',
      'دقة ونوع المطابقة': item.matchLabel,
      'الاسم الكامل المسجل': item.citizen?.FullName || '-',
      'رقم ID': item.citizen?.Citizen_ID || '-',
      'رقم الهاتف': item.citizen?.Phone1 || '-',
      'السكن / القضاء': item.citizen?.District || '-',
      'المعرف / التزكية': item.citizen?.ReferralSource || '-',
      'عدد المعاملات والطلبات': item.requests.length,
      'تفاصيل المعاملات والجهات': item.requests.map(r => `[${r.Entity}] ${r.Details} (حالة: ${r.ProcessingStatus})`).join(' | ') || '-',
      'أرقام الصادر المسجلة': item.requests.map(r => r.OutgoingNumber).filter(Boolean).join(', ') || '-',
      'موقف المدير': item.requests.map(r => r.DirectorDecision).filter(Boolean).join(', ') || '-',
      'المقابلات المسجلة': item.interviews.map(i => `${i.Subject} (${i.InterviewDate})`).join(' | ') || '-',
      'سجل الرعاية والتنظيم': item.orgRecords.map(o => `${o.District || 'تنظيم'} (${o.OrgRating || 'مؤيد'})`).join(' | ') || '-',
      'حالة الحظر بالقائمة السوداء': item.isBlocked ? `محظور: ${item.blockReason || 'نعم'}` : 'سليم'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    worksheet['!dir'] = 'rtl';

    // Auto col widths
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 45 },
      { wch: 20 },
      { wch: 15 },
      { wch: 25 },
      { wch: 20 },
      { wch: 20 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'نتائج مقاطعة البيانات');
    XLSX.writeFile(workbook, `تقرير_مقاطعة_البيانات_الموحد_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Block Citizen from Cross matching
  const handleOpenBlock = (citizen: Citizen) => {
    setBlockingTarget(citizen);
    setBlockReasonInput('');
  };

  const handleConfirmBlock = () => {
    if (!blockingTarget) return;
    if (!blockReasonInput.trim()) {
      alert('يرجى إدخال سبب الحظر بالتفصيل.');
      return;
    }
    blockCitizen(blockingTarget.Citizen_ID, blockReasonInput.trim(), currentUser?.FullName || 'موظف الإدارة');

    // Update in-memory results
    if (results) {
      setResults(results.map(r => {
        if (r.citizen?.Citizen_ID === blockingTarget.Citizen_ID) {
          return { ...r, isBlocked: true, blockReason: blockReasonInput.trim() };
        }
        return r;
      }));
    }

    setBlockingTarget(null);
    setBlockReasonInput('');
  };

  // Unblock Citizen
  const handleUnblock = (citizenId: string) => {
    if (window.confirm('هل تريد إلغاء حظر هذا المراجع وإعادته للقائمة المسموح بها؟')) {
      unblockCitizen(citizenId);
      if (results) {
        setResults(results.map(r => {
          if (r.citizen?.Citizen_ID === citizenId) {
            return { ...r, isBlocked: false, blockReason: undefined };
          }
          return r;
        }));
      }
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (citizen: Citizen) => {
    setEditingCitizen(citizen);
    setEditFullName(citizen.FullName || '');
    setEditPhone(citizen.Phone1 || '');
    setEditDistrict(citizen.District || '');
    setEditJob(citizen.Job || '');
    setEditEducation(citizen.Education || '');
  };

  const handleSaveCitizenEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCitizen) return;

    const updated: Citizen = {
      ...editingCitizen,
      FullName: editFullName.trim(),
      Phone1: editPhone.trim(),
      District: editDistrict.trim(),
      Job: editJob.trim(),
      Education: editEducation.trim()
    };

    updateCitizen(updated);

    if (results) {
      setResults(results.map(r => {
        if (r.citizen?.Citizen_ID === editingCitizen.Citizen_ID) {
          return { ...r, citizen: updated };
        }
        return r;
      }));
    }

    setEditingCitizen(null);
  };

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Top Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white shadow-lg border border-indigo-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Layers className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <span>مقاطعة البيانات - البحث الموحد والاستخراج الشامل</span>
                  <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30 font-bold">
                    حتى 1000 اسم
                  </span>
                </h2>
                <p className="text-xs text-indigo-200/80">
                  بحث ومقاطعة قوائم الأسماء مع كافة سجلات المعاملات، الرعاية الاجتماعية، المقابلات، والتحقق من القائمة السوداء
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 font-bold">
              إجمالي مراجعي النظام: {citizens.length} مراجع
            </span>
            <span className="text-xs bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 font-bold">
              إجمالي المعاملات: {requests.length} معاملة
            </span>
          </div>
        </div>
      </div>

      {/* Main Input Card: Textarea & Options */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>ضع أو الصق قائمة الأسماء هنا (ثلاثية أو رباعية - كل اسم في سطر أو مفصولة بفواصل):</span>
          </label>

          {/* Mode Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">نمط المطابقة:</span>
            <select
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as MatchFilterMode)}
              className="h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="smart">بحث ذكي شامل (ثلاثي، رباعي، وألقاب)</option>
              <option value="quad">البحث بالاسم الرباعي (Quadruple Name)</option>
              <option value="triple">البحث بالاسم الثلاثي (Triple Name)</option>
              <option value="exact">مطابقة تامة حرفياً (Exact Match)</option>
            </select>
          </div>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            rows={5}
            value={inputNamesText}
            onChange={(e) => setInputNamesText(e.target.value)}
            placeholder={`الصق قائمة الأسماء هنا، مثال:
محمد علي حسن حسين
علي خضير عباس الشمري
فاطمة جاسم كاظم
سجاد حيدر عبد الحسن
...`}
            className="w-full p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
          />
          {inputNamesText.trim() && (
            <span className="absolute bottom-3 left-4 text-[10px] font-mono text-slate-400 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
              عدد الأسطر: {inputNamesText.split(/[\r\n]+/).filter(l => l.trim()).length}
            </span>
          )}
        </div>

        {/* Action Buttons Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            * يدعم النظام حتى 1000 اسم دفعة واحدة مع المقاطعة اللحظية في كافة الجداول وملفات الرعاية والمقابلات.
          </p>

          <div className="flex items-center gap-2">
            {inputNamesText.trim() && (
              <button
                type="button"
                onClick={() => {
                  setInputNamesText('');
                  setResults(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                مسح القائمة
              </button>
            )}

            <button
              type="button"
              disabled={isProcessing || !inputNamesText.trim()}
              onClick={handleRunCrossMatching}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-md transition-transform active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارٍ مقاطعة البيانات واستخراج السجلات...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>بدء مقاطعة البيانات والبحث الموحد ⏎</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {results && (
        <div className="space-y-4 animate-in fade-in zoom-in-95">
          {/* Stats & Export Toolbar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Quick Stats Badges */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">النتائج:</span>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1 rounded-xl font-bold">
                إجمالي المدخل: {stats?.total}
              </span>
              <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-xl font-bold border border-emerald-300 dark:border-emerald-800">
                تم العثور عليهم: {stats?.found}
              </span>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-xl font-bold">
                غير مسجلين: {stats?.notFound}
              </span>
              {stats && stats.blocked > 0 && (
                <span className="bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 px-3 py-1 rounded-xl font-black border border-red-300 dark:border-red-800 animate-pulse flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>محظورين بالقائمة السوداء: {stats.blocked} ⚠️</span>
                </span>
              )}
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير إكسل احترافي (Excel)</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>طباعة تقرير PDF مباشر</span>
              </button>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                الكل ({results.length})
              </button>
              <button
                onClick={() => setStatusFilter('found')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === 'found'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                المطابقين فقط ({stats?.found})
              </button>
              <button
                onClick={() => setStatusFilter('not_found')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === 'not_found'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                غير المسجلين ({stats?.notFound})
              </button>
              {stats && stats.blocked > 0 && (
                <button
                  onClick={() => setStatusFilter('blocked')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    statusFilter === 'blocked'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100'
                  }`}
                >
                  المحظورين ({stats.blocked})
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="تصفية في النتائج..."
                className="w-full h-8 pr-8 pl-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">الاسم المدخل</th>
                    <th className="p-3">حالة المطابقة</th>
                    <th className="p-3">السجل المطابق</th>
                    <th className="p-3">المعاملات والطلبات</th>
                    <th className="p-3">رعاية / مقابلات</th>
                    <th className="p-3">حالة الحظر</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                        لا توجد نتائج مطابقة لمعايير البحث والتصفية.
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((row) => {
                      const cit = row.citizen;
                      return (
                        <tr
                          key={row.index}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            row.isBlocked
                              ? 'bg-red-50/40 dark:bg-red-950/20'
                              : row.isFound
                              ? 'bg-white dark:bg-slate-900'
                              : 'bg-slate-50/30 dark:bg-slate-900/40 opacity-75'
                          }`}
                        >
                          <td className="p-3 text-center font-mono text-slate-400 text-[11px]">
                            {row.index}
                          </td>

                          {/* Input Name */}
                          <td className="p-3 font-bold text-slate-900 dark:text-white">
                            {row.inputName}
                          </td>

                          {/* Match Status */}
                          <td className="p-3">
                            {row.isFound ? (
                              <div className="space-y-0.5">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  ✓ {row.matchLabel}
                                </span>
                                {row.confidence > 0 && (
                                  <span className="block text-[9px] font-mono text-slate-400">
                                    دقة: {row.confidence}%
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                غير مسجل بالمنظومة
                              </span>
                            )}
                          </td>

                          {/* Matched Citizen */}
                          <td className="p-3">
                            {cit ? (
                              <div className="space-y-0.5">
                                <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                                  <span>{cit.FullName}</span>
                                  {cit.Surname && (
                                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                                      ({cit.Surname})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                  <span className="font-mono text-blue-600 dark:text-blue-400">{cit.Citizen_ID}</span>
                                  <span>•</span>
                                  <span className="font-mono" dir="ltr">{cit.Phone1}</span>
                                  <span>•</span>
                                  <span>{cit.District}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>

                          {/* Associated Requests */}
                          <td className="p-3">
                            {row.requests.length > 0 ? (
                              <div className="space-y-1 max-w-xs">
                                <span className="inline-block text-[10px] font-bold text-blue-700 dark:text-blue-400">
                                  {row.requests.length} معاملة مسجلة:
                                </span>
                                {row.requests.slice(0, 2).map((r, rIdx) => (
                                  <div key={rIdx} className="text-[11px] bg-slate-100/70 dark:bg-slate-800/60 p-1.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                    <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                                      [{r.Entity}] {r.Details}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[9px] text-slate-500 pt-0.5">
                                      <span className="font-mono text-blue-600">{r.Request_ID}</span>
                                      {r.DirectorDecision && (
                                        <span className={`px-1 rounded font-bold ${
                                          r.DirectorDecision === 'رفض'
                                            ? 'bg-rose-100 text-rose-800'
                                            : r.DirectorDecision === 'خاص'
                                            ? 'bg-purple-100 text-purple-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                        }`}>
                                          قرار: {r.DirectorDecision}
                                        </span>
                                      )}
                                      {r.OutgoingNumber && (
                                        <span className="font-mono text-slate-600 bg-white dark:bg-slate-900 px-1 rounded border">
                                          صادر: {r.OutgoingNumber}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {row.requests.length > 2 && (
                                  <span className="text-[10px] text-slate-400 font-semibold block">
                                    + {row.requests.length - 2} معاملات أخرى
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">لا توجد معاملات</span>
                            )}
                          </td>

                          {/* Social Welfare & Interviews */}
                          <td className="p-3 text-[11px]">
                            <div className="space-y-0.5">
                              {row.interviews.length > 0 && (
                                <span className="block text-purple-700 dark:text-purple-300 font-bold">
                                  مقابلات: {row.interviews.length} لقاء
                                </span>
                              )}
                              {row.orgRecords.length > 0 && (
                                <span className="block text-emerald-700 dark:text-emerald-300 font-bold">
                                  رعاية/تنظيم: {row.orgRecords.length} سجل
                                </span>
                              )}
                              {row.interviews.length === 0 && row.orgRecords.length === 0 && (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>

                          {/* Blacklist Status */}
                          <td className="p-3">
                            {row.isBlocked ? (
                              <div className="space-y-0.5">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white animate-pulse">
                                  🚫 محظور
                                </span>
                                <span className="block text-[10px] text-red-600 dark:text-red-400 font-medium max-w-[140px] truncate" title={row.blockReason}>
                                  السبب: {row.blockReason}
                                </span>
                              </div>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>سليم</span>
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Edit Info Button */}
                              {cit && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(cit)}
                                  className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 transition-colors cursor-pointer"
                                  title="تعديل معلومات هذا الشخص فوراً"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Block or Unblock Button */}
                              {cit && (
                                row.isBlocked ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUnblock(cit.Citizen_ID)}
                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                                    title="إلغاء الحظر وإعادته للمسموح بهم"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenBlock(cit)}
                                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
                                    title="حظر هذا الشخص وإدراجه بالقائمة السوداء مع كتابة السبب"
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5" />
                                  </button>
                                )
                              )}

                              {/* Archive button */}
                              {cit && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedCitizenForHistory(cit)}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                  title="عرض الأرشيف والسجل الكامل"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
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
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: نافذة الحظر (Block with Reason)                   */}
      {/* ======================================================== */}
      {blockingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-red-300 dark:border-red-800 max-w-md w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <span className="p-3 rounded-2xl bg-red-100 dark:bg-red-950/80 text-red-600">
                <ShieldAlert className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">
                  حظر هذا الشخص وإدراجه بالقائمة السوداء
                </h3>
                <p className="text-xs text-red-600 dark:text-red-400 font-semibold">
                  المواطن: {blockingTarget.FullName} ({blockingTarget.Citizen_ID})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              سيتم حفظ هذا الشخص في القائمة السوداء، وتنبيه أي موظف يحاول تسجيل معاملة له مستقبلاً مع إظهار السبب فوراً.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                سبب الحظر (مطلوب): <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                placeholder="اكتب سبب الحظر بالتفصيل..."
                className="w-full p-3 bg-red-50/50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBlockingTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>تأكيد الحظر والإدراج بالقائمة السوداء</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: تعديل معلومات المراجع                             */}
      {/* ======================================================== */}
      {editingCitizen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-4 text-right animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                <span>تعديل بيانات المراجع ({editingCitizen.Citizen_ID})</span>
              </h3>
              <button onClick={() => setEditingCitizen(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleSaveCitizenEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الاسم الكامل:</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف:</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">السكن / القضاء:</label>
                  <input
                    type="text"
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المهنة:</label>
                  <input
                    type="text"
                    value={editJob}
                    onChange={(e) => setEditJob(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">التحصيل الدراسي:</label>
                  <input
                    type="text"
                    value={editEducation}
                    onChange={(e) => setEditEducation(e.target.value)}
                    className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCitizen(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
