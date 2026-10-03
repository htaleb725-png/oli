import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Citizen, OfficeRequest } from '../types';
import * as XLSX from 'xlsx';
import { 
  Users, 
  MapPin, 
  Printer, 
  FileSpreadsheet, 
  X, 
  CheckCircle2, 
  Clock, 
  Search,
  ExternalLink,
  ChevronLeft,
  Phone,
  Building2,
  FileText
} from 'lucide-react';

export const ClanDistrictStats: React.FC = () => {
  const { citizens, requests, setSelectedCitizenForHistory, setActiveSection } = useApp();

  const [activeTab, setActiveTab] = useState<'clans' | 'districts'>('clans');
  const [selectedClan, setSelectedClan] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Group citizens and requests by Clan (Surname)
  const clanStats = useMemo(() => {
    const map: Record<string, {
      clanName: string;
      displayName: string;
      citizens: Citizen[];
      requests: OfficeRequest[];
      completedCount: number;
    }> = {};

    citizens.forEach(citizen => {
      let rawClan = (citizen.Surname || 'عام').trim();
      if (!rawClan || rawClan === 'عام') rawClan = 'أخرى / بدون لقب';

      // Normalize common Iraqi clans
      let displayName = rawClan;
      if (rawClan.includes('ناشي') || rawClan.includes('الناشي')) {
        displayName = 'عشيرة النواشي (آل ناشي)';
      } else if (rawClan.includes('خفاج') || rawClan.includes('الخفاجي')) {
        displayName = 'عشيرة خفاجة (الخفاجي)';
      } else if (rawClan.includes('ساعد') || rawClan.includes('الساعدي')) {
        displayName = 'عشيرة السواعد (الساعدي)';
      } else if (rawClan.includes('تميم') || rawClan.includes('التميمي')) {
        displayName = 'بني تميم (التميمي)';
      } else if (rawClan.includes('إبراهيم') || rawClan.includes('ابراهيم') || rawClan.includes('الإبراهيمي')) {
        displayName = 'عشيرة الإبراهيمية (الإبراهيمي)';
      } else if (rawClan.includes('سعدون') || rawClan.includes('السعدون')) {
        displayName = 'عشيرة آل سعدون (السعدون)';
      } else if (rawClan.includes('حسين') || rawClan.includes('الحسيني')) {
        displayName = 'السادة الحسينية (الحسيني)';
      } else if (rawClan.includes('زيد') || rawClan.includes('الزيدي')) {
        displayName = 'بني زيد (الزيدي)';
      } else if (rawClan.includes('جبور') || rawClan.includes('الجبوري')) {
        displayName = 'عشائر الجبور (الجبوري)';
      }

      if (!map[displayName]) {
        map[displayName] = {
          clanName: rawClan,
          displayName,
          citizens: [],
          requests: [],
          completedCount: 0
        };
      }
      map[displayName].citizens.push(citizen);
    });

    // Map requests to clans based on Citizen_ID
    const citizenClanMap: Record<string, string> = {};
    Object.values(map).forEach(group => {
      group.citizens.forEach(c => {
        citizenClanMap[c.Citizen_ID] = group.displayName;
      });
    });

    requests.forEach(req => {
      const clanKey = citizenClanMap[req.Citizen_ID];
      if (clanKey && map[clanKey]) {
        map[clanKey].requests.push(req);
        if (req.ProcessingStatus === 'منجز') {
          map[clanKey].completedCount += 1;
        }
      }
    });

    const totalCitizensCount = citizens.length || 1;

    return Object.values(map)
      .map(item => ({
        ...item,
        percentage: Math.round((item.citizens.length / totalCitizensCount) * 100),
        totalRequests: item.requests.length,
        completionRate: item.requests.length > 0 
          ? Math.round((item.completedCount / item.requests.length) * 100) 
          : 0
      }))
      .sort((a, b) => b.citizens.length - a.citizens.length);
  }, [citizens, requests]);

  // 2. Group citizens and requests by District (المناطق والأقضية)
  const districtStats = useMemo(() => {
    const map: Record<string, {
      districtName: string;
      citizens: Citizen[];
      requests: OfficeRequest[];
      completedCount: number;
    }> = {};

    citizens.forEach(citizen => {
      const dist = (citizen.District || 'قضاء الناصرية').trim();
      if (!map[dist]) {
        map[dist] = {
          districtName: dist,
          citizens: [],
          requests: [],
          completedCount: 0
        };
      }
      map[dist].citizens.push(citizen);
    });

    const citizenDistMap: Record<string, string> = {};
    Object.values(map).forEach(group => {
      group.citizens.forEach(c => {
        citizenDistMap[c.Citizen_ID] = group.districtName;
      });
    });

    requests.forEach(req => {
      const distKey = citizenDistMap[req.Citizen_ID];
      if (distKey && map[distKey]) {
        map[distKey].requests.push(req);
        if (req.ProcessingStatus === 'منجز') {
          map[distKey].completedCount += 1;
        }
      }
    });

    const totalCitizensCount = citizens.length || 1;

    return Object.values(map)
      .map(item => ({
        ...item,
        percentage: Math.round((item.citizens.length / totalCitizensCount) * 100),
        totalRequests: item.requests.length,
        completionRate: item.requests.length > 0 
          ? Math.round((item.completedCount / item.requests.length) * 100) 
          : 0
      }))
      .sort((a, b) => b.citizens.length - a.citizens.length);
  }, [citizens, requests]);

  // Active Clan modal data
  const activeClanData = useMemo(() => {
    if (!selectedClan) return null;
    return clanStats.find(c => c.displayName === selectedClan) || null;
  }, [selectedClan, clanStats]);

  // Active District modal data
  const activeDistrictData = useMemo(() => {
    if (!selectedDistrict) return null;
    return districtStats.find(d => d.districtName === selectedDistrict) || null;
  }, [selectedDistrict, districtStats]);

  // Export Clan Data to Excel
  const exportClanToExcel = (clanData: typeof clanStats[0]) => {
    const rows = clanData.requests.map(r => {
      const cit = clanData.citizens.find(c => c.Citizen_ID === r.Citizen_ID);
      return {
        'رقم الطلب': r.Request_ID,
        'الرقم التعريفي': r.Citizen_ID,
        'اسم المواطن': r.CitizenName,
        'العشيرة / اللقب': clanData.displayName,
        'الهاتف': cit?.Phone1 || r.CitizenPhone || '',
        'القضاء / المنطقة': cit?.District || '',
        'الناحية / الحي': cit?.SubDistrict || '',
        'الجهة المعنية': r.Entity,
        'الحالة': r.ProcessingStatus,
        'الأولوية': r.Priority,
        'تفاصيل المعاملة': r.Details,
        'توجيه النائب': r.DeputyNotes || '',
        'تاريخ الطلب': r.CreatedAt
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'طلبات العشيرة');
    XLSX.writeFile(wb, `كشف_طلبات_${clanData.displayName.replace(/\s+/g, '_')}.xlsx`);
  };

  // Export District Data to Excel
  const exportDistrictToExcel = (districtData: typeof districtStats[0]) => {
    const rows = districtData.requests.map(r => {
      const cit = districtData.citizens.find(c => c.Citizen_ID === r.Citizen_ID);
      return {
        'رقم الطلب': r.Request_ID,
        'الرقم التعريفي': r.Citizen_ID,
        'اسم المواطن': r.CitizenName,
        'العشيرة / اللقب': cit?.Surname || '',
        'الهاتف': cit?.Phone1 || r.CitizenPhone || '',
        'القضاء': districtData.districtName,
        'الناحية / الحي': cit?.SubDistrict || '',
        'الجهة المعنية': r.Entity,
        'الحالة': r.ProcessingStatus,
        'الأولوية': r.Priority,
        'تفاصيل المعاملة': r.Details,
        'توجيه النائب': r.DeputyNotes || '',
        'تاريخ الطلب': r.CreatedAt
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'طلبات القضاء');
    XLSX.writeFile(wb, `كشف_طلبات_${districtData.districtName.replace(/\s+/g, '_')}.xlsx`);
  };

  // Trigger browser print for Clan or District
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4 text-right">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span>إحصائيات العشائر والمناطق الأكثر مراجعة</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            تحليل دقيق لنسب المراجعات حسب العشيرة والمنطقة مع إمكانية سحب جميع الطلبات والتفاصيل بنقرة واحدة
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('clans')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'clans'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            العشائر الأكثر مراجعة ({clanStats.length})
          </button>
          <button
            onClick={() => setActiveTab('districts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'districts'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المناطق والأقضية ({districtStats.length})
          </button>
        </div>
      </div>

      {/* CLANS VIEW */}
      {activeTab === 'clans' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
            <span>اضغط على أي عشيرة لسحب وعرض وتصدير كافة طلباتها وتفاصيل مراجعيها</span>
            <span className="font-mono text-blue-600 font-bold">{clanStats.length} عشيرة مسجلة</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clanStats.map((item, idx) => (
              <div
                key={item.displayName}
                onClick={() => setSelectedClan(item.displayName)}
                className="group relative p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black font-mono">
                      {item.percentage}%
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                    {item.displayName}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.citizens.length} مراجع مسجل | {item.totalRequests} معاملة
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>منجز: {item.completedCount} ({item.completionRate}%)</span>
                  </span>
                  <span className="text-blue-600 font-bold flex items-center gap-0.5 group-hover:translate-x-[-2px] transition-transform">
                    <span>سحب الطلبات</span>
                    <ChevronLeft className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DISTRICTS VIEW */}
      {activeTab === 'districts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
            <span>اضغط على أي قضاء أو ناحية لسحب وعرض كشف المعاملات الخاص بها</span>
            <span className="font-mono text-blue-600 font-bold">{districtStats.length} منطقة ومحافظة</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {districtStats.map((item, idx) => (
              <div
                key={item.districtName}
                onClick={() => setSelectedDistrict(item.districtName)}
                className="group relative p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 transition-all cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black font-mono">
                      {item.percentage}%
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{item.districtName}</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.citizens.length} مواطن | {item.totalRequests} معاملة ومتابعة
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>منجز: {item.completedCount} ({item.completionRate}%)</span>
                  </span>
                  <span className="text-emerald-600 font-bold flex items-center gap-0.5 group-hover:translate-x-[-2px] transition-transform">
                    <span>سحب الطلبات</span>
                    <ChevronLeft className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CLAN DETAILS DRILL-DOWN MODAL */}
      {activeClanData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto text-right">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    كشف مراجعي وطلبات {activeClanData.displayName}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold font-mono">
                    {activeClanData.percentage}% من مراجعي المكتب
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  يتضمن كشف جميع المواطنين والمعاملات الإدارية الموجهة للوزارات والدوائر الحكومية
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => exportClanToExcel(activeClanData)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة رسمية</span>
                </button>
                <button
                  onClick={() => setSelectedClan(null)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">إجمالي المراجعين</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{activeClanData.citizens.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-xs text-blue-700 font-semibold">إجمالي الطلبات</div>
                <div className="text-2xl font-black text-blue-900 mt-1 font-mono">{activeClanData.totalRequests}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs text-emerald-700 font-semibold">المعاملات المنجزة</div>
                <div className="text-2xl font-black text-emerald-800 mt-1 font-mono">{activeClanData.completedCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                <div className="text-xs text-purple-700 font-semibold">نسبة الإنجاز الكلية</div>
                <div className="text-2xl font-black text-purple-800 mt-1 font-mono">{activeClanData.completionRate}%</div>
              </div>
            </div>

            {/* Requests Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>جدول المعاملات والطلبات المسجلة لأبناء هذه العشيرة ({activeClanData.requests.length})</span>
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
                    {activeClanData.requests.length > 0 ? (
                      activeClanData.requests.map((req, idx) => {
                        const cit = activeClanData.citizens.find(c => c.Citizen_ID === req.Citizen_ID);
                        return (
                          <tr key={`${req.Request_ID}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2.5 font-mono font-bold text-blue-700 whitespace-nowrap">{req.Request_ID}</td>
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
                                  setSelectedClan(null);
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
                          لا توجد طلبات إدارية مسجلة حالياً لهذه العشيرة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Registered Citizens List */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>قائمة المواطنين والمراجعين المنتمين للعشيرة ({activeClanData.citizens.length})</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                {activeClanData.citizens.map(c => (
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
                    <div className="text-left font-mono text-[11px] text-blue-700 font-bold" dir="ltr">
                      {c.Phone1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DISTRICT DETAILS DRILL-DOWN MODAL */}
      {activeDistrictData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-5xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[92vh] overflow-y-auto text-right">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                    <span>كشف مراجعي ومعاملات {activeDistrictData.districtName}</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
                    {activeDistrictData.percentage}% من مجمل طلبات المحافظة
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  كشف شامل بجميع معاملات أبناء هذا القضاء وتوزيعها على الوزارات والدوائر الخدمية
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => exportDistrictToExcel(activeDistrictData)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة رسمية</span>
                </button>
                <button
                  onClick={() => setSelectedDistrict(null)}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-semibold">مواطنو القضاء</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{activeDistrictData.citizens.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-xs text-blue-700 font-semibold">إجمالي الطلبات</div>
                <div className="text-2xl font-black text-blue-900 mt-1 font-mono">{activeDistrictData.totalRequests}</div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs text-emerald-700 font-semibold">المعاملات المنجزة</div>
                <div className="text-2xl font-black text-emerald-800 mt-1 font-mono">{activeDistrictData.completedCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                <div className="text-xs text-purple-700 font-semibold">نسبة الإنجاز للقضاء</div>
                <div className="text-2xl font-black text-purple-800 mt-1 font-mono">{activeDistrictData.completionRate}%</div>
              </div>
            </div>

            {/* Requests Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>المعاملات والطلبات المسجلة لأهالي {activeDistrictData.districtName} ({activeDistrictData.requests.length})</span>
              </h4>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5">رقم الطلب</th>
                      <th className="p-2.5">اسم المواطن</th>
                      <th className="p-2.5">الهاتف</th>
                      <th className="p-2.5">الجهة المعنية</th>
                      <th className="p-2.5">تفاصيل الطلب</th>
                      <th className="p-2.5">الحالة</th>
                      <th className="p-2.5">الأولوية</th>
                      <th className="p-2.5 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeDistrictData.requests.length > 0 ? (
                      activeDistrictData.requests.map((req, idx) => {
                        const cit = activeDistrictData.citizens.find(c => c.Citizen_ID === req.Citizen_ID);
                        return (
                          <tr key={`${req.Request_ID}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2.5 font-mono font-bold text-emerald-700 whitespace-nowrap">{req.Request_ID}</td>
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
                                  setSelectedDistrict(null);
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
                          لا توجد طلبات إدارية مسجلة حالياً لهذا القضاء
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
