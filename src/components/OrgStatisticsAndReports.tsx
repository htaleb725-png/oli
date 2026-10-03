import React, { useState } from 'react';
import { OrganizationRecord, OrgTeamMember } from '../types';
import { 
  BarChart3, 
  PieChart, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Printer, 
  FileSpreadsheet, 
  Download, 
  Filter, 
  Search, 
  Star,
  Users,
  ShieldCheck,
  Award
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface OrgStatisticsAndReportsProps {
  records: OrganizationRecord[];
  teamMembers: OrgTeamMember[];
  onOpenEvaluation: (rec: OrganizationRecord) => void;
  onOpenTeamMemberCard: (member: OrgTeamMember) => void;
}

export const OrgStatisticsAndReports: React.FC<OrgStatisticsAndReportsProps> = ({
  records,
  teamMembers,
  onOpenEvaluation,
  onOpenTeamMemberCard
}) => {
  const [filterResult, setFilterResult] = useState<string>('all');
  const [filterDistrict, setFilterDistrict] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPrintMode, setIsPrintMode] = useState(false);

  // Evaluated records
  const evaluatedRecords = records.filter(r => !!r.finalEvaluation);

  // Counts & Percentages
  const totalEvaluated = evaluatedRecords.length;
  const case1Count = evaluatedRecords.filter(r => r.finalEvaluation?.finalResult === 'تم اكمال الطلب بالكامل').length;
  const case2Count = evaluatedRecords.filter(r => r.finalEvaluation?.finalResult === 'تم حل الطلب جزئيا').length;
  const case3Count = evaluatedRecords.filter(r => r.finalEvaluation?.finalResult === 'الطلب يحتاج متابعة').length;
  const case4Count = evaluatedRecords.filter(r => r.finalEvaluation?.finalResult === 'لم يتم حل الطلب').length;

  const case1Pct = totalEvaluated > 0 ? Math.round((case1Count / totalEvaluated) * 100) : 0;
  const case2Pct = totalEvaluated > 0 ? Math.round((case2Count / totalEvaluated) * 100) : 0;
  const case3Pct = totalEvaluated > 0 ? Math.round((case3Count / totalEvaluated) * 100) : 0;
  const case4Pct = totalEvaluated > 0 ? Math.round((case4Count / totalEvaluated) * 100) : 0;

  // Satisfaction count across all
  const satisfiedCount = evaluatedRecords.filter(r => {
    const ev = r.finalEvaluation;
    if (!ev) return false;
    if (ev.finalResult === 'تم اكمال الطلب بالكامل' && ev.case1_citizenSatisfied === 'نعم') return true;
    if (ev.finalResult === 'تم حل الطلب جزئيا' && ev.case2_citizenAcceptedPartial === 'نعم') return true;
    if (ev.finalResult === 'الطلب يحتاج متابعة' && ev.case3_citizenSatisfiedWithService === 'نعم') return true;
    if (ev.finalResult === 'لم يتم حل الطلب' && ev.case4_citizenStance === 'متفهم') return true;
    return false;
  }).length;
  const overallSatisfactionPct = totalEvaluated > 0 ? Math.round((satisfiedCount / totalEvaluated) * 100) : 0;

  // Breakdown of Case 4 Reasons
  const case4Reasons: Record<string, number> = {};
  evaluatedRecords.forEach(r => {
    if (r.finalEvaluation?.finalResult === 'لم يتم حل الطلب') {
      const reason = r.finalEvaluation.case4_failureReason || 'غير محدد';
      case4Reasons[reason] = (case4Reasons[reason] || 0) + 1;
    }
  });

  // Breakdown of Case 3 Followup types
  const case3Types: Record<string, number> = {};
  evaluatedRecords.forEach(r => {
    if (r.finalEvaluation?.finalResult === 'الطلب يحتاج متابعة') {
      r.finalEvaluation.case3_followupTypes?.forEach(t => {
        case3Types[t] = (case3Types[t] || 0) + 1;
      });
    }
  });

  // Filtered List
  const filteredList = evaluatedRecords.filter(r => {
    const ev = r.finalEvaluation;
    if (!ev) return false;
    const matchesResult = filterResult === 'all' || ev.finalResult === filterResult;
    const matchesDistrict = filterDistrict === 'all' || r.District === filterDistrict;
    const matchesQuery = 
      r.FullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.Citizen_ID.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.District && r.District.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (ev.requestId && ev.requestId.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesResult && matchesDistrict && matchesQuery;
  });

  const exportExcel = () => {
    const rows = evaluatedRecords.map((r, idx) => {
      const ev = r.finalEvaluation!;
      return {
        'ت': idx + 1,
        'الرقم التعريفي': r.Citizen_ID,
        'اسم المواطن': r.FullName,
        'رقم الهاتف': r.Phone1 || r.Phone || '',
        'القضاء / السكن': `${r.District || ''} - ${r.SubDistrict || ''}`,
        'رمز الطلب': ev.requestId || 'عام',
        'النتيجة النهائية للطلب': ev.finalResult,
        'تاريخ التقييم': ev.evaluatedAt,
        'الموقف / تفاصيل الحالة': 
          ev.finalResult === 'تم اكمال الطلب بالكامل'
            ? `حصل على النتيجة: ${ev.case1_citizenObtainedGoal} | راضٍ: ${ev.case1_citizenSatisfied} | تقييم: ${ev.case1_personalRating}/5 | عاد للشكر: ${ev.case1_citizenReturnedForThanks}`
            : ev.finalResult === 'تم حل الطلب جزئيا'
            ? `المنجز: ${ev.case2_completedPart || ''} | المتبقي: ${ev.case2_uncompletedPart || ''} | السبب: ${ev.case2_incompleteReason || ''} | قبل بالنتيجة: ${ev.case2_citizenAcceptedPartial}`
            : ev.finalResult === 'الطلب يحتاج متابعة'
            ? `أنواع المتابعة: ${(ev.case3_followupTypes || []).join(', ')} | راضٍ: ${ev.case3_citizenSatisfiedWithService} | انضم للفريق: ${ev.case3_wantsToJoinTeam}`
            : `سبب عدم الإنجاز: ${ev.case4_failureReason || ''} | تم الشرح: ${ev.case4_explainedReasonToCitizen} | الموقف: ${ev.case4_citizenStance}`,
        'ملاحظات مسؤول التنظيم': 
          ev.case1_officerNotes || ev.case2_officerNotes || ev.case3_officerNotes || ev.case4_officerNotes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقييمات التنظيم');
    XLSX.writeFile(wb, `تقرير_النتائج_النهائية_لقسم_التنظيم_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handlePrint = () => {
    setIsPrintMode(true);
    setTimeout(() => {
      window.print();
      setIsPrintMode(false);
    }, 300);
  };

  return (
    <div className="space-y-6 text-right">
      
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              إحصائيات وتقارير النتائج النهائية واستبيانات الرضا
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            تحليل إحصائي شامل لنتائج المعاملات الأربعة، استبيانات المواطنين، وفريق العمل التنظيمي.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير إكسل مفصل</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة التقرير التنظيمي</span>
          </button>
        </div>
      </div>

      {/* Main KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total */}
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 block">إجمالي المعاملات المقيمة</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{totalEvaluated}</div>
          <span className="text-[10px] text-slate-400">استبيانات مسجلة</span>
        </div>

        {/* Case 1 */}
        <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800">إكمال بالكامل</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1">
            {case1Count} <span className="text-xs font-bold text-emerald-600">({case1Pct}%)</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold">الحالة الأولى</span>
        </div>

        {/* Case 2 */}
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800">حل جزئي</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-700 mt-1">
            {case2Count} <span className="text-xs font-bold text-amber-600">({case2Pct}%)</span>
          </div>
          <span className="text-[10px] text-amber-600 font-bold">الحالة الثانية</span>
        </div>

        {/* Case 3 */}
        <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-800">يحتاج متابعة</span>
            <AlertCircle className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-blue-700 mt-1">
            {case3Count} <span className="text-xs font-bold text-blue-600">({case3Pct}%)</span>
          </div>
          <span className="text-[10px] text-blue-600 font-bold">الحالة الثالثة</span>
        </div>

        {/* Case 4 */}
        <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800">لم يحل الطلب</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-extrabold text-rose-700 mt-1">
            {case4Count} <span className="text-xs font-bold text-rose-600">({case4Pct}%)</span>
          </div>
          <span className="text-[10px] text-rose-600 font-bold">الحالة الرابعة</span>
        </div>

        {/* Team Members / Keys */}
        <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-800">فريق العمل والمفاتيح</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-extrabold text-purple-800 mt-1">{teamMembers.length}</div>
          <span className="text-[10px] text-purple-600 font-bold">ملفات مستقلة معتمدة</span>
        </div>
      </div>

      {/* Analytics Visual Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Case Progress Bar */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
            <span>نسب الحالات الأربعة للنتائج:</span>
            <span className="text-[11px] text-indigo-600 font-bold">رضا كلي: {overallSatisfactionPct}%</span>
          </h4>

          <div className="w-full h-3 bg-slate-100 rounded-full flex overflow-hidden">
            <div style={{ width: `${case1Pct}%` }} className="bg-emerald-500 h-full" title={`إكمال بالكامل: ${case1Pct}%`} />
            <div style={{ width: `${case2Pct}%` }} className="bg-amber-500 h-full" title={`حل جزئي: ${case2Pct}%`} />
            <div style={{ width: `${case3Pct}%` }} className="bg-blue-500 h-full" title={`يحتاج متابعة: ${case3Pct}%`} />
            <div style={{ width: `${case4Pct}%` }} className="bg-rose-500 h-full" title={`لم يحل الطلب: ${case4Pct}%`} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 font-bold">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span>1. إكمال بالكامل: {case1Pct}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              <span>2. حل جزئي: {case2Pct}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              <span>3. يحتاج متابعة: {case3Pct}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              <span>4. لم يتم الحل: {case4Pct}%</span>
            </div>
          </div>
        </div>

        {/* Case 4 Failure Reasons Breakdown */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
          <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
            <span>أسباب عدم الإنجاز (الحالة الرابعة):</span>
            <span className="text-[11px] text-rose-600 font-bold">{case4Count} طلب</span>
          </h4>

          {Object.keys(case4Reasons).length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">لا توجد طلبات غير منجزة مسجلة</div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {Object.entries(case4Reasons).map(([reason, count]) => {
                const pct = case4Count > 0 ? Math.round((count / case4Count) * 100) : 0;
                return (
                  <div key={reason} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-700 font-medium">
                      <span>{reason}</span>
                      <span className="font-bold text-rose-700">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div style={{ width: `${pct}%` }} className="bg-rose-500 h-full rounded-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Case 3 Followup Types Breakdown */}
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
          <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
            <span>أنواع المتابعة المطلوبة (الحالة الثالثة):</span>
            <span className="text-[11px] text-blue-600 font-bold">{case3Count} طلب</span>
          </h4>

          {Object.keys(case3Types).length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">لا توجد طلبات قيد المتابعة حالياً</div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {Object.entries(case3Types).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-2 rounded-lg bg-blue-50/60 border border-blue-100 text-xs">
                  <span className="font-bold text-blue-950">{type}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                    {count} إجراء
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم، رقم الهوية ONA، أو رمز الطلب..."
              className="w-full pr-9 pl-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <select
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">-- تصفية بحسب النتيجة النهائية (الكل) --</option>
              <option value="تم اكمال الطلب بالكامل">1. تم إكمال الطلب بالكامل</option>
              <option value="تم حل الطلب جزئيا">2. تم حل الطلب جزئياً</option>
              <option value="الطلب يحتاج متابعة">3. الطلب يحتاج متابعة</option>
              <option value="لم يتم حل الطلب">4. لم يتم حل الطلب</option>
            </select>
          </div>

          <div>
            <select
              value={filterDistrict}
              onChange={(e) => setFilterDistrict(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">-- تصفية حسب القضاء (الكل) --</option>
              <option value="قضاء الناصرية">قضاء الناصرية</option>
              <option value="قضاء الشطرة">قضاء الشطرة</option>
              <option value="قضاء سوق الشيوخ">قضاء سوق الشيوخ</option>
              <option value="قضاء الرفاعي">قضاء الرفاعي</option>
              <option value="قضاء الجبايش">قضاء الجبايش</option>
              <option value="قضاء الدواية">قضاء الدواية</option>
            </select>
          </div>
        </div>
      </div>

      {/* Evaluated Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">
            سجل تقييمات النتائج النهائية واستبيانات الرضا ({filteredList.length})
          </span>
          <span className="text-[11px] text-slate-500">
            اضغط على أي سجل لتعديل التقييم والأسئلة التفاعلية
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">المواطن والرقم</th>
                <th className="py-2.5 px-3">القضاء / السكن</th>
                <th className="py-2.5 px-3">الطلب المرتبط</th>
                <th className="py-2.5 px-3">النتيجة النهائية للطلب</th>
                <th className="py-2.5 px-3">موجز الأسئلة وموقف المواطن</th>
                <th className="py-2.5 px-3">فريق العمل</th>
                <th className="py-2.5 px-3">التاريخ</th>
                <th className="py-2.5 px-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    لا توجد تقييمات مطابقة لخيارات البحث
                  </td>
                </tr>
              ) : (
                filteredList.map((rec) => {
                  const ev = rec.finalEvaluation!;
                  return (
                    <tr key={rec.Citizen_ID} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{rec.FullName}</div>
                        <div className="font-mono text-[11px] text-indigo-700 font-bold">{rec.Citizen_ID}</div>
                      </td>

                      <td className="py-2.5 px-3 text-slate-700">
                        {rec.District || '-'}
                        {rec.SubDistrict && <span className="text-slate-400 text-[11px]"> ({rec.SubDistrict})</span>}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {ev.requestId || 'عام'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        {ev.finalResult === 'تم اكمال الطلب بالكامل' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>1. إكمال بالكامل</span>
                          </span>
                        )}
                        {ev.finalResult === 'تم حل الطلب جزئيا' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>2. حل جزئي</span>
                          </span>
                        )}
                        {ev.finalResult === 'الطلب يحتاج متابعة' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1 w-fit">
                            <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
                            <span>3. يحتاج متابعة</span>
                          </span>
                        )}
                        {ev.finalResult === 'لم يتم حل الطلب' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 w-fit">
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>4. لم يتم الحل</span>
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-[11px] text-slate-700 max-w-xs">
                        {ev.finalResult === 'تم اكمال الطلب بالكامل' && (
                          <div>
                            <span className="font-bold text-emerald-700">حصل على النتيجة: </span>
                            {ev.case1_citizenObtainedGoal} | راضٍ: {ev.case1_citizenSatisfied}
                            {ev.case1_personalRating && (
                              <span className="text-amber-500 font-bold mr-1">({ev.case1_personalRating}★)</span>
                            )}
                          </div>
                        )}
                        {ev.finalResult === 'تم حل الطلب جزئيا' && (
                          <div>
                            <span className="font-bold text-amber-800">سبب عدم الإكمال: </span>
                            {ev.case2_incompleteReason} | قبل بالنتيجة: {ev.case2_citizenAcceptedPartial}
                          </div>
                        )}
                        {ev.finalResult === 'الطلب يحتاج متابعة' && (
                          <div>
                            <span className="font-bold text-blue-800">المتابعة: </span>
                            {(ev.case3_followupTypes || []).join('، ')}
                          </div>
                        )}
                        {ev.finalResult === 'لم يتم حل الطلب' && (
                          <div>
                            <span className="font-bold text-rose-700">السبب: </span>
                            {ev.case4_failureReason} | الموقف: {ev.case4_citizenStance}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        {rec.isTeamMember || ev.case3_wantsToJoinTeam === 'نعم' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            عضو فريق / {rec.teamMemberRole || 'مفتاح نهائي'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">-</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {ev.evaluatedAt}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => onOpenEvaluation(rec)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors cursor-pointer border border-indigo-200"
                        >
                          تعديل التقييم
                        </button>
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
  );
};
