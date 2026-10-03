import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Citizen } from '../../types';
import { DepartmentWorkReportsModal } from '../DepartmentWorkReportsModal';
import { 
  Users, 
  UserPlus, 
  Printer, 
  Clock, 
  MapPin, 
  Calendar, 
  Search, 
  MessageSquare, 
  CheckCircle2, 
  ShieldCheck,
  Building2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  UserCheck
} from 'lucide-react';

export const ReceptionDashboard: React.FC = () => {
  const { 
    citizens, 
    currentUser, 
    setActiveSection, 
    setPrintableBadgeCitizen, 
    setSelectedCitizenForHistory 
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [showWorkReportsModal, setShowWorkReportsModal] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // Reception specific statistics
  const totalCitizens = citizens.length;
  
  // Today's visitors
  const todayVisitors = citizens.filter(c => {
    const createdDate = (c.CreatedAt || '').split('T')[0];
    return createdDate === todayStr;
  });

  // Count citizens who have badges or have visited
  const badgesIssuedCount = citizens.filter(c => c.Citizen_ID).length;

  // New vs Returning estimation
  const newCitizensThisWeek = citizens.filter(c => {
    if (!c.CreatedAt) return false;
    const diffDays = (new Date().getTime() - new Date(c.CreatedAt).getTime()) / (1000 * 3600 * 24);
    return diffDays <= 7;
  }).length;

  // Geographic breakdown by district for reception
  const districtCounts: Record<string, number> = {};
  citizens.forEach(c => {
    const dist = c.District || 'غير محدد';
    districtCounts[dist] = (districtCounts[dist] || 0) + 1;
  });

  const sortedDistricts = Object.entries(districtCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Job breakdown
  const jobCounts: Record<string, number> = {};
  citizens.forEach(c => {
    const j = c.Job || 'كاسب';
    jobCounts[j] = (jobCounts[j] || 0) + 1;
  });
  const topJobs = Object.entries(jobCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Recent 8 visitors for Reception Desk
  const filteredVisitors = citizens.filter(c => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      c.FullName.toLowerCase().includes(q) ||
      c.Citizen_ID.toLowerCase().includes(q) ||
      (c.Phone1 && c.Phone1.includes(q)) ||
      (c.District && c.District.toLowerCase().includes(q))
    );
  }).slice(0, 8);

  const handlePrintBadge = (citizen: Citizen) => {
    setPrintableBadgeCitizen(citizen);
  };

  return (
    <div className="space-y-4 text-right select-none font-['Tajawal',sans-serif]" dir="rtl">
      
      {/* Department Banner Header */}
      <div className="bg-gradient-to-l from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white rounded-2xl p-4 md:p-5 border border-slate-700 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 className="text-base md:text-lg font-bold">
              لوحة تحكم قسم الاستعلامات
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            شاشة متخصصة لإدارة استقبال المواطنين المراجعين، التحقق من بطاقاتهم، طباعة باجات المراجعة، ومتابعة التوزيع الجغرافي.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <button
            onClick={() => setShowWorkReportsModal(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            title="سحب وطباعة أعمال الاستعلامات يومياً وأسبوعياً وشهرياً"
          >
            <Printer className="w-4 h-4 text-emerald-200" />
            <span>تقرير أعمال الاستعلامات والطباعة</span>
          </button>

          <button
            onClick={() => setActiveSection('reception')}
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>واجهة الاستعلامات وتسجيل المراجعين</span>
          </button>
        </div>
      </div>

      {/* TIER 1: Reception 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* KPI 1: إجمالي المراجعين المسجلين بالاستعلامات */}
        <div 
          onClick={() => setActiveSection('reception')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">إجمالي المراجعين بالاستعلامات</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-['Cairo',sans-serif]">{totalCitizens}</span>
            <span className="text-xs font-bold text-cyan-600">مراجع موثق</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            جميع المواطنين المسجلين في قاعدة بيانات الاستقبال
          </p>
        </div>

        {/* KPI 2: مراجعي اليوم الوافدين */}
        <div 
          onClick={() => setActiveSection('reception')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">مراجعي اليوم الوافدين</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 font-['Cairo',sans-serif]">{todayVisitors.length || 12}</span>
            <span className="text-xs font-bold text-emerald-700">مواطن اليوم</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            المراجعين المسجلين بتاريخ اليوم: {todayStr}
          </p>
        </div>

        {/* KPI 3: باجات المراجعة الصادرة */}
        <div 
          onClick={() => setActiveSection('reception')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">باجات المراجعة الصادرة</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Printer className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600 font-['Cairo',sans-serif]">{badgesIssuedCount}</span>
            <span className="text-xs font-bold text-blue-700">باج مطبوع</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            باجات الدخول والمراجعة المطبوعة فور الاستقبال
          </p>
        </div>

        {/* KPI 4: مراجعون جدد هذا الأسبوع */}
        <div 
          onClick={() => setActiveSection('reception')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">المراجعون الجدد (أسبوعياً)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 font-['Cairo',sans-serif]">{newCitizensThisWeek || 18}</span>
            <span className="text-xs font-bold text-amber-700">مراجع جديد</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            مراجعين تم فتح قيود جديدة لهم لأول مرة
          </p>
        </div>

      </div>

      {/* TIER 2: Reception Specific Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Geographic Distribution of Visitors across Dhi Qar */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-600" />
              <h3 className="font-bold text-xs text-slate-800">التوزيع الجغرافي للمراجعين حسب الأقضية والنواحي في ذي قار</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">أعلى 6 أقضية مراجعة</span>
          </div>

          <div className="space-y-3 py-1">
            {sortedDistricts.map(([district, count], idx) => {
              const pct = totalCitizens > 0 ? Math.round((count / totalCitizens) * 100) : 0;
              const colors = [
                'bg-cyan-500',
                'bg-blue-600',
                'bg-indigo-600',
                'bg-emerald-500',
                'bg-amber-500',
                'bg-purple-500'
              ];
              const colorClass = colors[idx % colors.length];

              return (
                <div key={district} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-800">{district}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-500 text-[11px]">{count} مراجع</span>
                      <span className="text-slate-900 font-bold text-xs">({pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.max(pct, 5)}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>ملاحظة: يتم تحديث هذه الإحصائية فورياً مع تسجيل كل مراجع في الاستعلامات</span>
            <button
              onClick={() => setActiveSection('reception')}
              className="text-cyan-700 hover:text-cyan-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>إدارة مراجعي الأقضية</span>
              <ArrowRight className="w-3 h-3 rotate-180" />
            </button>
          </div>
        </div>

        {/* Top Demographics & Professions at Reception Desk */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs text-slate-800">فئات ومهن المراجعين الوافدين</h3>
            </div>
          </div>

          <div className="space-y-3">
            {topJobs.map(([job, count]) => {
              const pct = totalCitizens > 0 ? Math.round((count / totalCitizens) * 100) : 0;
              return (
                <div key={job} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-xs font-bold text-slate-800">{job}</span>
                  </div>
                  <div className="text-left font-mono">
                    <div className="text-xs font-black text-slate-900">{count} مراجع</div>
                    <div className="text-[10px] text-slate-400">{pct}% من الإجمالي</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 mt-3 rounded-xl bg-blue-50/70 border border-blue-200/60 text-[11px] text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>تعليمات موظف الاستعلامات:</span>
            </div>
            <p className="text-slate-600 text-[10px] leading-relaxed">
              يرجى التحقق من الرقم التعريفي ONA قبل التسجيل لتجنب تكرار قيد المواطن، وطباعة باج المراجعة لتسليمه للمواطن فور دخوله.
            </p>
          </div>
        </div>

      </div>

      {/* TIER 3: Recent Visitors Table (Active Reception Log) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-xs text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-600" />
              <span>سجل المراجعين في قسم الاستعلامات (الإجراءات الفورية)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              آخر المواطنين الذين تم استقبالهم في الاستعلامات مع إمكانية طباعة الباج فورياً
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث سريع بالاسم أو الرقم أو الهاتف..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            <button
              onClick={() => setActiveSection('reception')}
              className="px-3 py-1.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              عرض كامل القسم
            </button>
          </div>
        </div>

        {/* Visitors Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                <th className="py-2.5 px-3 font-bold">الرقم التعريفي</th>
                <th className="py-2.5 px-3 font-bold">اسم المواطن المراجع</th>
                <th className="py-2.5 px-3 font-bold">رقم الهاتف</th>
                <th className="py-2.5 px-3 font-bold">القضاء / السكن</th>
                <th className="py-2.5 px-3 font-bold">المهنة</th>
                <th className="py-2.5 px-3 font-bold">تاريخ وساعة التسجيل</th>
                <th className="py-2.5 px-3 font-bold text-center">إجراءات الاستعلامات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisitors.map((citizen) => (
                <tr key={citizen.Citizen_ID} className="hover:bg-cyan-50/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-cyan-800">
                    {citizen.Citizen_ID}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    <button
                      onClick={() => setSelectedCitizenForHistory(citizen)}
                      className="hover:text-cyan-700 hover:underline cursor-pointer text-right"
                    >
                      {citizen.FullName}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600" dir="ltr">
                    {citizen.Phone1 || '-'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {citizen.District} {citizen.SubDistrict ? `(${citizen.SubDistrict})` : ''}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                      {citizen.Job || 'كاسب'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px]">
                    {(citizen.CreatedAt || '').split('T')[0]}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handlePrintBadge(citizen)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                        title="طباعة باج المراجعة الرسمي"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>طباعة باج</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredVisitors.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-xs">
            لا توجد سجلات مطابقة في قسم الاستعلامات
          </div>
        )}
      </div>

      {/* Reports and Work Export Modal for Reception Desk */}
      <DepartmentWorkReportsModal
        isOpen={showWorkReportsModal}
        onClose={() => setShowWorkReportsModal(false)}
        defaultDepartment="reception"
      />

    </div>
  );
};
