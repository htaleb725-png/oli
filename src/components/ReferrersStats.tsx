import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Citizen, OfficeRequest } from '../types';
import * as XLSX from 'xlsx';
import { 
  Handshake, 
  Users, 
  FileText, 
  Printer, 
  FileSpreadsheet, 
  Search, 
  Filter, 
  CheckCircle2, 
  X, 
  ChevronLeft,
  UserCheck,
  Building2,
  Calendar,
  Phone
} from 'lucide-react';

export const ReferrersStats: React.FC = () => {
  const { citizens, requests, setSelectedCitizenForHistory, setActiveSection } = useApp();

  const [filterType, setFilterType] = useState<'all' | 'women' | 'men' | 'custom'>('all');
  const [selectedReferrerName, setSelectedReferrerName] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalReferrer, setModalReferrer] = useState<string | null>(null);

  // Helper to categorize referrer as woman, man, or organization
  const getReferrerGenderCategory = (name: string): 'women' | 'men' | 'org' => {
    const n = name.trim();
    if (
      n.startsWith('أم ') || 
      n.startsWith('ام ') || 
      n.includes('فاطمة') || 
      n.includes('زينب') || 
      n.includes('مروة') || 
      n.includes('سارة') || 
      n.includes('نساء') || 
      n.includes('الأستاذة مروة')
    ) {
      return 'women';
    }
    if (
      n.includes('مكتب') || 
      n.includes('رابطة') || 
      n.includes('حركة') || 
      n.includes('تجمع') || 
      n.includes('مباشر')
    ) {
      return 'org';
    }
    return 'men';
  };

  // Build referrers data map
  const referrersData = useMemo(() => {
    const map: Record<string, {
      name: string;
      category: 'women' | 'men' | 'org';
      citizens: Citizen[];
      requests: OfficeRequest[];
      completedCount: number;
    }> = {};

    citizens.forEach(citizen => {
      const refName = (citizen.ReferralSource || 'مباشر بدون معرف').trim();
      if (!map[refName]) {
        map[refName] = {
          name: refName,
          category: getReferrerGenderCategory(refName),
          citizens: [],
          requests: [],
          completedCount: 0
        };
      }
      map[refName].citizens.push(citizen);
    });

    // Map requests to referrers
    const citizenRefMap: Record<string, string> = {};
    Object.values(map).forEach(group => {
      group.citizens.forEach(c => {
        citizenRefMap[c.Citizen_ID] = group.name;
      });
    });

    requests.forEach(req => {
      const refKey = citizenRefMap[req.Citizen_ID];
      if (refKey && map[refKey]) {
        map[refKey].requests.push(req);
        if (req.ProcessingStatus === 'منجز') {
          map[refKey].completedCount += 1;
        }
      }
    });

    return Object.values(map)
      .map(item => ({
        ...item,
        completionRate: item.requests.length > 0 
          ? Math.round((item.completedCount / item.requests.length) * 100) 
          : 0
      }))
      .sort((a, b) => b.requests.length - a.requests.length || b.citizens.length - a.citizens.length);
  }, [citizens, requests]);

  // Filtered referrers based on tab / selections
  const filteredReferrers = useMemo(() => {
    return referrersData.filter(item => {
      // 1. Tab filter
      if (filterType === 'women' && item.category !== 'women') return false;
      if (filterType === 'men' && item.category !== 'men') return false;
      if (filterType === 'custom' && selectedReferrerName !== 'all' && item.name !== selectedReferrerName) return false;

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return item.name.toLowerCase().includes(q);
      }

      return true;
    });
  }, [referrersData, filterType, selectedReferrerName, searchQuery]);

  // Active modal referrer data
  const activeModalData = useMemo(() => {
    if (!modalReferrer) return null;
    return referrersData.find(r => r.name === modalReferrer) || null;
  }, [modalReferrer, referrersData]);

  // Overall counts for badges
  const womenCount = referrersData.filter(r => r.category === 'women').length;
  const menCount = referrersData.filter(r => r.category === 'men').length;

  // Export filtered referrers list to Excel
  const exportListToExcel = () => {
    const dataToExport = filteredReferrers.map(r => ({
      'اسم المعرف / المنسق': r.name,
      'التصنيف': r.category === 'women' ? 'نساء' : r.category === 'men' ? 'رجال' : 'جهة / أخرى',
      'عدد المواطنين المسجلين': r.citizens.length,
      'إجمالي المعاملات والطلبات': r.requests.length,
      'المعاملات المنجزة': r.completedCount,
      'نسبة الإنجاز': `${r.completionRate}%`
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'إحصائيات المعرفين');
    
    let fileSuffix = 'الكل';
    if (filterType === 'women') fileSuffix = 'النساء_فقط';
    if (filterType === 'men') fileSuffix = 'الرجال_فقط';
    if (filterType === 'custom') fileSuffix = selectedReferrerName.replace(/\s+/g, '_');

    XLSX.writeFile(wb, `تقرير_المعرفين_${fileSuffix}.xlsx`);
  };

  // Export specific referrer's requests to Excel
  const exportReferrerRequestsToExcel = (refData: typeof referrersData[0]) => {
    const rows = refData.requests.map(r => {
      const cit = refData.citizens.find(c => c.Citizen_ID === r.Citizen_ID);
      return {
        'رقم الطلب': r.Request_ID,
        'الرقم التعريفي': r.Citizen_ID,
        'اسم المواطن': r.CitizenName,
        'المعرف': refData.name,
        'الهاتف': cit?.Phone1 || r.CitizenPhone || '',
        'السكن / القضاء': cit?.District || '',
        'الجهة المعنية': r.Entity,
        'الحالة': r.ProcessingStatus,
        'الأولوية': r.Priority,
        'تفاصيل المعاملة': r.Details,
        'توجيه النائب': r.DeputyNotes || '',
        'تاريخ التسجيل': r.CreatedAt
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'طلبات المعرف');
    XLSX.writeFile(wb, `طلبات_المعرف_${refData.name.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4 text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Handshake className="w-4 h-4 text-indigo-600" />
            <span>إحصائيات المعرفين والمنسقين ومتابعة طلباتهم</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            سحب وتحليل دقيق لطلبات المعرفين (نساء فقط، رجال فقط، معرف شخصي، أو جميع المعرفين)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportListToExcel}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            title="تصدير القائمة الحالية إلى Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>تصدير Excel</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            title="طباعة التقرير المصفى"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Selectors */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            جميع المعرفين ({referrersData.length})
          </button>

          <button
            onClick={() => setFilterType('women')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'women'
                ? 'bg-pink-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-pink-700 hover:bg-pink-50'
            }`}
          >
            <span>👩 المعرفين النساء فقط</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${filterType === 'women' ? 'bg-pink-700 text-white' : 'bg-pink-100 text-pink-700'}`}>
              {womenCount}
            </span>
          </button>

          <button
            onClick={() => setFilterType('men')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterType === 'men'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-blue-800 hover:bg-blue-50'
            }`}
          >
            <span>👨 المعرفين الرجال فقط</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${filterType === 'men' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-700'}`}>
              {menCount}
            </span>
          </button>

          <button
            onClick={() => setFilterType('custom')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterType === 'custom'
                ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            معرف محدد بالاسم
          </button>
        </div>

        {/* Dropdown for specific referrer if 'custom' is active */}
        {filterType === 'custom' && (
          <div className="min-w-[200px]">
            <select
              value={selectedReferrerName}
              onChange={(e) => setSelectedReferrerName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">-- اختر المعرف المطلوب --</option>
              {referrersData.map(r => (
                <option key={r.name} value={r.name}>
                  {r.name} ({r.requests.length} طلب)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search Box */}
        <div className="relative min-w-[180px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المعرف..."
            className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Referrers Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs text-right border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <th className="p-3">#</th>
              <th className="p-3">اسم المعرف / المنسق</th>
              <th className="p-3">التصنيف</th>
              <th className="p-3 text-center">عدد المواطنين</th>
              <th className="p-3 text-center">إجمالي الطلبات</th>
              <th className="p-3 text-center">المنجز منها</th>
              <th className="p-3 text-center">نسبة الإنجاز</th>
              <th className="p-3 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredReferrers.length > 0 ? (
              filteredReferrers.map((ref, idx) => (
                <tr key={ref.name} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                  <td className="p-3 font-bold text-slate-900">
                    <div className="flex items-center gap-1.5">
                      {ref.category === 'women' ? (
                        <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0"></span>
                      ) : ref.category === 'men' ? (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0"></span>
                      )}
                      <span>{ref.name}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      ref.category === 'women'
                        ? 'bg-pink-50 text-pink-700 border border-pink-200'
                        : ref.category === 'men'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {ref.category === 'women' ? 'نساء' : ref.category === 'men' ? 'رجال' : 'جهة / تنظيم'}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-slate-700">{ref.citizens.length}</td>
                  <td className="p-3 text-center font-mono font-black text-indigo-700 text-sm">{ref.requests.length}</td>
                  <td className="p-3 text-center font-mono font-bold text-emerald-700">{ref.completedCount}</td>
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-mono font-bold text-slate-700">{ref.completionRate}%</span>
                      <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full" 
                          style={{ width: `${ref.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => setModalReferrer(ref.name)}
                      className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center justify-center gap-1 mx-auto cursor-pointer transition-colors"
                      title="سحب كافة طلبات وتفاصيل هذا المعرف"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>سحب جميع طلباته ({ref.requests.length})</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="text-center py-8 text-slate-400">
                  لا توجد نتائج مطابقة لشروط التصفية المحددة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* REFERRER DETAIL DRILL-DOWN MODAL */}
      {activeModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto text-right">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Handshake className="w-5 h-5 text-indigo-600" />
                    <span>كشف طلبات ومراجعي: {activeModalData.name}</span>
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    activeModalData.category === 'women'
                      ? 'bg-pink-100 text-pink-800'
                      : activeModalData.category === 'men'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {activeModalData.category === 'women' ? 'معرف نسائي' : activeModalData.category === 'men' ? 'معرف رجالي' : 'تنسيق عام'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  كافة المعاملات والطلبات المقدمة بتزكية وتنسيق هذا المعرف
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => exportReferrerRequestsToExcel(activeModalData)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة رسمية</span>
                </button>
                <button
                  onClick={() => setModalReferrer(null)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">المواطنون المسجلون</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{activeModalData.citizens.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                <div className="text-xs text-indigo-700 font-semibold">إجمالي الطلبات</div>
                <div className="text-2xl font-black text-indigo-900 mt-1 font-mono">{activeModalData.requests.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs text-emerald-700 font-semibold">المعاملات المنجزة</div>
                <div className="text-2xl font-black text-emerald-800 mt-1 font-mono">{activeModalData.completedCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                <div className="text-xs text-purple-700 font-semibold">نسبة إنجاز المعرف</div>
                <div className="text-2xl font-black text-purple-800 mt-1 font-mono">{activeModalData.completionRate}%</div>
              </div>
            </div>

            {/* Requests List */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>قائمة المعاملات والطلبات المسجلة باسم {activeModalData.name} ({activeModalData.requests.length})</span>
              </h4>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5">رقم الطلب</th>
                      <th className="p-2.5">صاحب الطلب</th>
                      <th className="p-2.5">الهاتف</th>
                      <th className="p-2.5">الجهة المعنية</th>
                      <th className="p-2.5">تفاصيل الطلب</th>
                      <th className="p-2.5">الحالة</th>
                      <th className="p-2.5">الأولوية</th>
                      <th className="p-2.5 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeModalData.requests.length > 0 ? (
                      activeModalData.requests.map((req, idx) => {
                        const cit = activeModalData.citizens.find(c => c.Citizen_ID === req.Citizen_ID);
                        return (
                          <tr key={`${req.Request_ID}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2.5 font-mono font-bold text-indigo-700 whitespace-nowrap">{req.Request_ID}</td>
                            <td className="p-2.5 font-bold text-slate-900 whitespace-nowrap">{req.CitizenName}</td>
                            <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap" dir="ltr">
                              {cit?.Phone1 || req.CitizenPhone || '-'}
                            </td>
                            <td className="p-2.5 text-slate-700">{req.Entity}</td>
                            <td className="p-2.5 text-slate-600 max-w-xs truncate" title={req.Details}>
                              {req.Details}
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                req.ProcessingStatus === 'منجز'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}>
                                {req.ProcessingStatus}
                              </span>
                            </td>
                            <td className="p-2.5 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                req.Priority === 'عاجل' || req.Priority === 'خاص جداً'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}>
                                {req.Priority}
                              </span>
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              <button
                                onClick={() => {
                                  if (cit) setSelectedCitizenForHistory(cit);
                                  setModalReferrer(null);
                                  setActiveSection('search_archive');
                                }}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
                              >
                                عرض السجل
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-400">
                          لا توجد طلبات إدارية منشأة حالياً لهذا المعرف
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Citizens associated */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>المواطنون المسجلون عن طريق {activeModalData.name} ({activeModalData.citizens.length})</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                {activeModalData.citizens.map(c => (
                  <div 
                    key={c.Citizen_ID} 
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{c.FullName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {c.District} - {c.SubDistrict} | {c.Job}
                      </div>
                    </div>
                    <div className="text-left font-mono text-[11px] text-indigo-700 font-bold" dir="ltr">
                      {c.Phone1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
