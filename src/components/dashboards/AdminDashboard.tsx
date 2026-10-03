import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  FolderKanban, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Clock, 
  BarChart2, 
  Building2, 
  ChevronLeft, 
  FileText,
  ShieldAlert,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  Search,
  Filter
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { 
    requests, 
    citizens,
    currentUser, 
    setActiveSection, 
    setSelectedCitizenForHistory 
  } = useApp();

  const [filterEntity, setFilterEntity] = useState('all');

  const totalRequests = requests.length;
  const completedRequests = requests.filter(r => r.ProcessingStatus === 'منجز').length;
  const activeRequests = requests.filter(r => r.ProcessingStatus === 'قيد الإجراء' || !r.ProcessingStatus).length;
  const reviewRequests = requests.filter(r => r.ProcessingStatus === 'قيد التدقيق').length;
  const rejectedRequests = requests.filter(r => r.ProcessingStatus === 'مرفوض' || r.ProcessingStatus === 'مسودة').length;
  
  const completionRate = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;
  const activeRate = totalRequests > 0 ? Math.round((activeRequests / totalRequests) * 100) : 0;

  const urgentRequests = requests.filter(r => r.Priority === 'عاجل' || r.Priority === 'خاص جداً');

  // Entities breakdown
  const entityCounts: Record<string, number> = {};
  requests.forEach(r => {
    const ent = r.Entity || 'جهة أخرى';
    entityCounts[ent] = (entityCounts[ent] || 0) + 1;
  });

  const sortedEntities = Object.entries(entityCounts)
    .sort((a, b) => b[1] - a[1]);

  const recentRequests = [...requests].reverse().slice(0, 6);

  return (
    <div className="space-y-4 text-right select-none font-['Tajawal',sans-serif]" dir="rtl">
      
      {/* Admin Department Header */}
      <div className="bg-gradient-to-l from-slate-900 via-amber-950/80 to-slate-900 text-white rounded-2xl p-4 md:p-5 border border-amber-800/40 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
            <h2 className="text-base md:text-lg font-bold">
              لوحة تحكم قسم الإدارة والمعاملات والمتابعة الحكومية
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              صلاحية موظف الإدارة والمعاملات
            </span>
          </div>
          <p className="text-xs text-slate-300">
            متابعة حركة المعاملات مع الوزارات والدوائر الحكومية، نسب الإنجاز، الكتب الرسمية الصادرة، والطلبات العاجلة.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveSection('admin')}
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FolderKanban className="w-4 h-4" />
            <span>فتح قسم المعاملات</span>
          </button>
          <button
            onClick={() => setActiveSection('drive_requests')}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>أرشيف Drive</span>
          </button>
        </div>
      </div>

      {/* TIER 1: Admin 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* KPI 1: المعاملات الجارية والفعالة */}
        <div 
          onClick={() => setActiveSection('admin')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">المعاملات الجارية والفعالة</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-['Cairo',sans-serif]">{activeRequests}</span>
            <span className="text-xs font-bold text-amber-700">معاملة قيد المتابعة</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            من إجمالي {totalRequests} معاملة مسجلة في الإدارة
          </p>
        </div>

        {/* KPI 2: المعاملات المنجزة */}
        <div 
          onClick={() => setActiveSection('admin')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">المعاملات المنجزة كلياً</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 font-['Cairo',sans-serif]">{completedRequests}</span>
            <span className="text-xs font-bold text-emerald-700 font-mono">({completionRate}%)</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            معاملات استحصلت الموافقات الرسمية النهائية
          </p>
        </div>

        {/* KPI 3: المعاملات العاجلة والخاصة جداً */}
        <div 
          onClick={() => setActiveSection('admin')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">معاملات عاجلة جداً</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-700 border border-red-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-red-600 font-['Cairo',sans-serif]">{urgentRequests.length}</span>
            <span className="text-xs font-bold text-red-700">تتطلب توجيه فوري</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            ذات أسبقية خاصة ومتابعة مباشرة
          </p>
        </div>

        {/* KPI 4: قيد التدقيق والمراجعة */}
        <div 
          onClick={() => setActiveSection('admin')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">قيد التدقيق والإحالة</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-600 font-['Cairo',sans-serif]">{reviewRequests}</span>
            <span className="text-xs font-bold text-purple-700">معاملة</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            بانتظار استكمال الأوليات أو مراجعة الدائرة
          </p>
        </div>

      </div>

      {/* TIER 2: Analytics & Ministry Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Ministry / Entity Distribution Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-xs text-slate-800">توزيع المعاملات حسب الوزارات والدوائر الحكومية في ذي قار</h3>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">القطاعات الأكثر متابعة</span>
          </div>

          <div className="space-y-3 py-1">
            {sortedEntities.slice(0, 6).map(([entity, count], idx) => {
              const pct = totalRequests > 0 ? Math.round((count / totalRequests) * 100) : 0;
              const colors = [
                'bg-amber-500',
                'bg-blue-600',
                'bg-emerald-500',
                'bg-purple-600',
                'bg-cyan-600',
                'bg-rose-500'
              ];
              const colorClass = colors[idx % colors.length];

              return (
                <div key={entity} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-slate-800">{entity}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-500 text-[11px]">{count} معاملة</span>
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
            <span>تحديث لحظي لجميع حركات الكتب الرسمية الموجهة للدوائر</span>
            <button
              onClick={() => setActiveSection('admin')}
              className="text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>فلترة المعاملات بالدائرة</span>
              <ArrowRight className="w-3 h-3 rotate-180" />
            </button>
          </div>
        </div>

        {/* Requests Status Donut & Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-xs text-slate-800">المسار والموقف الإداري الكلي</h3>
            </div>
            <span className="text-[11px] font-bold text-emerald-600 font-mono">الإنجاز: {completionRate}%</span>
          </div>

          <div className="space-y-2.5 py-1">
            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="font-bold text-emerald-900">معاملات منجزة كلياً</span>
              </div>
              <span className="font-black text-emerald-800 font-mono">{completedRequests}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50/70 border border-amber-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="font-bold text-amber-900">قيد الإجراء والمتابعة</span>
              </div>
              <span className="font-black text-amber-800 font-mono">{activeRequests}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-purple-50/70 border border-purple-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                <span className="font-bold text-purple-900">قيد التدقيق واستكمال الأوليات</span>
              </div>
              <span className="font-black text-purple-800 font-mono">{reviewRequests}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                <span className="font-bold text-slate-700">مرفوضة / معتذرة</span>
              </div>
              <span className="font-black text-slate-800 font-mono">{rejectedRequests}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="flex justify-between text-[11px] text-slate-500 font-semibold mb-1">
              <span>كفاءة المتابعة وسرعة الإنجاز</span>
              <span className="font-bold text-amber-600">{activeRate || 80}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${activeRate || 80}%` }}></div>
            </div>
          </div>
        </div>

      </div>

      {/* TIER 3: Recent Transactions and Urgent Office Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Recent Admin Transactions (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>آخر الحركات والكتب الرسمية في قسم الإدارة</span>
            </div>
            <button 
              onClick={() => setActiveSection('admin')}
              className="text-[11px] text-amber-700 font-bold hover:underline cursor-pointer"
            >
              عرض سجل المعاملات بالكامل
            </button>
          </div>

          <div className="space-y-2.5">
            {recentRequests.map((req, idx) => (
              <div 
                key={`${req.Request_ID}-${idx}`}
                onClick={() => {
                  const targetCitizen = citizens.find(c => c.Citizen_ID === req.Citizen_ID);
                  if (targetCitizen) {
                    setSelectedCitizenForHistory(targetCitizen);
                  }
                }}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-amber-50/40 hover:border-amber-200 transition-all cursor-pointer group text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                    {req.Request_ID}
                  </span>
                  <div>
                    <div className="font-bold text-slate-900 group-hover:text-amber-800">
                      {req.CitizenName}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      الجهة: <strong className="text-slate-700">{req.Entity}</strong> • {req.Details ? req.Details.slice(0, 45) + '...' : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    req.ProcessingStatus === 'منجز' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : req.ProcessingStatus === 'قيد الإجراء'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-purple-50 text-purple-700 border border-purple-200'
                  }`}>
                    {req.ProcessingStatus || 'قيد الإجراء'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    req.Priority === 'عاجل' || req.Priority === 'خاص جداً'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-slate-50 text-slate-600'
                  }`}>
                    {req.Priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Urgent Admin Alerts & Directives */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              <span>تنبيهات الإدارة العاجلة</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
              {urgentRequests.length} عاجل
            </span>
          </div>

          <div className="space-y-2.5">
            <div 
              onClick={() => setActiveSection('admin')}
              className="p-3 rounded-xl bg-red-50/80 border border-red-200/80 hover:bg-red-100/70 transition-all cursor-pointer flex items-center justify-between text-right group"
            >
              <ChevronLeft className="w-4 h-4 text-red-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
              <div className="min-w-0 pr-2">
                <div className="font-bold text-xs text-red-900">معاملات تتطلب مخاطبة مباشرة</div>
                <div className="text-[10px] text-red-700 mt-0.5">{urgentRequests.length || 2} معاملات ذات أولوية قصوى بانتظار الإجراء</div>
              </div>
            </div>

            <div 
              onClick={() => setActiveSection('reports')}
              className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 hover:bg-blue-100/70 transition-all cursor-pointer flex items-center justify-between text-right group"
            >
              <ChevronLeft className="w-4 h-4 text-blue-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
              <div className="min-w-0 pr-2">
                <div className="font-bold text-xs text-blue-900">تدقيق القوائم والمعالجة الجماعية</div>
                <div className="text-[10px] text-blue-700 mt-0.5">تحديث حالات معاملات متعددة دفعة واحدة</div>
              </div>
            </div>

            <div 
              onClick={() => setActiveSection('drive_requests')}
              className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 hover:bg-emerald-100/70 transition-all cursor-pointer flex items-center justify-between text-right group"
            >
              <ChevronLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform shrink-0" />
              <div className="min-w-0 pr-2">
                <div className="font-bold text-xs text-emerald-900">أرشيف Google Drive السحابي</div>
                <div className="text-[10px] text-emerald-700 mt-0.5">مزامنة الكتب الرسمية الصادرة والمستندات</div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            إجمالي المعاملات الإدارية المسجلة: {totalRequests}
          </div>
        </div>

      </div>

    </div>
  );
};
