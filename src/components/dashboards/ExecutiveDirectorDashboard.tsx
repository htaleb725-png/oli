import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ClanDistrictStats } from '../ClanDistrictStats';
import { ReferrersStats } from '../ReferrersStats';
import { EmployeeDepartmentStats } from '../EmployeeDepartmentStats';
import { ReceptionDashboard } from './ReceptionDashboard';
import { AdminDashboard } from './AdminDashboard';
import { InterviewsDashboard } from './InterviewsDashboard';
import { OrganizationDashboard } from './OrganizationDashboard';
import { MachineDashboard } from './MachineDashboard';
import { AuditDashboard } from './AuditDashboard';
import { 
  Users, 
  FolderKanban, 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  BarChart2, 
  Handshake, 
  Building2, 
  ChevronLeft, 
  FileText,
  ShieldAlert,
  Calendar,
  Printer,
  Sparkles,
  MapPin,
  UserCheck,
  Eye,
  SlidersHorizontal,
  Briefcase
} from 'lucide-react';

export const ExecutiveDirectorDashboard: React.FC = () => {
  const { 
    citizens, 
    requests, 
    interviews, 
    currentUser,
    setActiveSection, 
    setSelectedCitizenForHistory,
  } = useApp();

  // State to switch view: executive master view, or preview any specific department's dashboard!
  const [activeView, setActiveView] = useState<
    'master_overview' | 'reception_preview' | 'admin_preview' | 'interviews_preview' | 'org_preview' | 'machine_preview' | 'audit_preview' | 'clans' | 'referrers' | 'employee_dept'
  >('master_overview');

  const totalCitizens = citizens.length;
  const totalRequests = requests.length;
  const completedRequests = requests.filter(r => r.ProcessingStatus === 'منجز').length;
  const activeRequests = requests.filter(r => r.ProcessingStatus === 'قيد الإجراء' || !r.ProcessingStatus).length;
  const reviewRequests = requests.filter(r => r.ProcessingStatus === 'قيد التدقيق').length;
  const draftRequests = requests.filter(r => r.ProcessingStatus === 'مسودة' || r.ProcessingStatus === 'مرفوض').length;
  
  const completionRate = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;
  const activeRate = totalRequests > 0 ? Math.round((activeRequests / totalRequests) * 100) : 0;

  const urgentRequests = requests.filter(r => r.Priority === 'عاجل' || r.Priority === 'خاص جداً');
  const pendingInterviews = interviews.filter(i => i.Status === 'مجدولة');

  const recentRequests = [...requests].reverse().slice(0, 5);

  return (
    <div className="space-y-4 text-right select-none font-['Tajawal',sans-serif]" dir="rtl">
      
      {/* Executive Command Header */}
      <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 md:p-5 border border-indigo-800/50 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <h2 className="text-base md:text-lg font-bold">
              لوحة القيادة المركزية والإشراف العام | مكتب النائب علا الناشي
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-500/40">
              {currentUser?.RoleArabic || 'مدير المكتب التنفيذي'}
            </span>
          </div>
          <p className="text-xs text-slate-300">
            رؤية إشرافية شاملة لكافة الأقسام مع إمكانية فحص ومعاينة لوحة تحكم كل قسم على حدة للتأكد من انسيابية العمل.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSection('director')}
            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>شاشة مدير المكتب</span>
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الموقف</span>
          </button>
        </div>
      </div>

      {/* Navigation Switcher: Preview Each Department's Dedicated Dashboard */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2.5 shadow-2xs space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
            <span>التبديل بين لوحة التحكم الشاملة ومعاينة لوحة كل قسم حسب عمله:</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">صلاحية إشرافية للمدير والنائب</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveView('master_overview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'master_overview'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>الرؤية الشاملة المجمعة</span>
          </button>

          <button
            onClick={() => setActiveView('reception_preview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'reception_preview'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-cyan-700 hover:bg-cyan-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>لوحة قسم الاستعلامات</span>
          </button>

          <button
            onClick={() => setActiveView('admin_preview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'admin_preview'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>لوحة قسم الإدارة والمعاملات</span>
          </button>

          <button
            onClick={() => setActiveView('interviews_preview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'interviews_preview'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-teal-700 hover:bg-teal-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>لوحة قسم المقابلات</span>
          </button>

          <button
            onClick={() => setActiveView('org_preview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'org_preview'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>لوحة قسم التنظيم والجمهور</span>
          </button>

          <button
            onClick={() => setActiveView('machine_preview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'machine_preview'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>لوحة قسم المكنة والطباعة</span>
          </button>

          <button
            onClick={() => setActiveView('audit_preview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'audit_preview'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>لوحة قسم الرقابة والتشريع</span>
          </button>

          <button
            onClick={() => setActiveView('employee_dept')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'employee_dept'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>موقف الأقسام والموظفين</span>
          </button>
        </div>
      </div>

      {/* Render Selected View */}
      {activeView === 'reception_preview' && (
        <div className="space-y-2">
          <div className="bg-cyan-50 border border-cyan-200 text-cyan-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between">
            <span>معاينة إشرافية: هذه هي لوحة التحكم المخصصة لموظفي قسم الاستعلامات حصراً</span>
            <button onClick={() => setActiveView('master_overview')} className="text-cyan-700 underline text-[11px] cursor-pointer">العودة للوحة الشاملة</button>
          </div>
          <ReceptionDashboard />
        </div>
      )}

      {activeView === 'admin_preview' && (
        <div className="space-y-2">
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between">
            <span>معاينة إشرافية: هذه هي لوحة التحكم المخصصة لقسم الإدارة والمعاملات حصراً</span>
            <button onClick={() => setActiveView('master_overview')} className="text-amber-700 underline text-[11px] cursor-pointer">العودة للوحة الشاملة</button>
          </div>
          <AdminDashboard />
        </div>
      )}

      {activeView === 'interviews_preview' && (
        <div className="space-y-2">
          <div className="bg-teal-50 border border-teal-200 text-teal-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between">
            <span>معاينة إشرافية: هذه هي لوحة التحكم المخصصة لقسم المقابلات</span>
            <button onClick={() => setActiveView('master_overview')} className="text-teal-700 underline text-[11px] cursor-pointer">العودة للوحة الشاملة</button>
          </div>
          <InterviewsDashboard />
        </div>
      )}

      {activeView === 'org_preview' && (
        <div className="space-y-2">
          <div className="bg-purple-50 border border-purple-200 text-purple-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between">
            <span>معاينة إشرافية: هذه هي لوحة التحكم المخصصة لقسم التنظيم والجمهور</span>
            <button onClick={() => setActiveView('master_overview')} className="text-purple-700 underline text-[11px] cursor-pointer">العودة للوحة الشاملة</button>
          </div>
          <OrganizationDashboard />
        </div>
      )}

      {activeView === 'machine_preview' && (
        <div className="space-y-2">
          <div className="bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between">
            <span>معاينة إشرافية: هذه هي لوحة التحكم المخصصة لقسم مكنة المكتب والطباعة</span>
            <button onClick={() => setActiveView('master_overview')} className="text-blue-700 underline text-[11px] cursor-pointer">العودة للوحة الشاملة</button>
          </div>
          <MachineDashboard />
        </div>
      )}

      {activeView === 'audit_preview' && (
        <div className="space-y-2">
          <div className="bg-rose-50 border border-rose-200 text-rose-900 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between">
            <span>معاينة إشرافية: هذه هي لوحة التحكم المخصصة لقسم الرقابة والتشريع</span>
            <button onClick={() => setActiveView('master_overview')} className="text-rose-700 underline text-[11px] cursor-pointer">العودة للوحة الشاملة</button>
          </div>
          <AuditDashboard />
        </div>
      )}

      {activeView === 'employee_dept' && (
        <EmployeeDepartmentStats />
      )}

      {activeView === 'clans' && (
        <ClanDistrictStats />
      )}

      {activeView === 'referrers' && (
        <ReferrersStats />
      )}

      {/* MASTER EXECUTIVE OVERVIEW */}
      {activeView === 'master_overview' && (
        <>
          {/* TIER 1: Master 4 KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            
            {/* KPI 1 */}
            <div 
              onClick={() => setActiveSection('admin')}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-500">المعاملات الجارية في الإدارة</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FolderKanban className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 font-['Cairo',sans-serif]">{activeRequests}</span>
                <span className="text-xs font-bold text-amber-600 font-mono font-semibold">من أصل {totalRequests}</span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
                معاملات رسمية قيد المتابعة مع الدوائر
              </p>
            </div>

            {/* KPI 2 */}
            <div 
              onClick={() => setActiveSection('reception')}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-500">سجل المواطنين بالاستعلامات</span>
                <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900 font-['Cairo',sans-serif]">{totalCitizens}</span>
                <span className="text-xs font-bold text-cyan-600 font-semibold">مواطن مسجل</span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
                إجمالي المراجعين في قاعدة بيانات المكتب
              </p>
            </div>

            {/* KPI 3 */}
            <div 
              onClick={() => setActiveSection('admin')}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-500">نسبة الإنجاز الكلي</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600 font-['Cairo',sans-serif]">{completionRate}%</span>
                <span className="text-xs font-bold text-emerald-700 font-mono font-semibold">({completedRequests} منجز)</span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
                معدل إنجاز المعاملات في الوزارات والدوائر
              </p>
            </div>

            {/* KPI 4 */}
            <div 
              onClick={() => setActiveSection('interviews')}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-500">مقابلات النائب والعواجل</span>
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Handshake className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-teal-600 font-['Cairo',sans-serif]">{pendingInterviews.length}</span>
                <span className="text-xs font-bold text-red-600 font-mono font-semibold">({urgentRequests.length} عاجل)</span>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
                مواطنين بانتظار المقابلة الشخصية
              </p>
            </div>

          </div>

          {/* Master Mid Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Ministry Distribution Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-xs text-slate-800">توزيع المعاملات حسب الدوائر والوزارات الخدمية في ذي قار</h3>
                </div>
              </div>

              {/* Bar visualization */}
              <div className="relative w-full h-44 flex items-end justify-around pt-4 pb-2">
                <div className="w-full flex items-end justify-around z-10 h-36">
                  <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="w-8 sm:w-10 bg-blue-600 rounded-t-md h-[85%] shadow-sm transition-all group-hover:brightness-110"></div>
                    <span className="text-[11px] font-bold text-slate-700">البلديات</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="w-8 sm:w-10 bg-emerald-600 rounded-t-md h-[60%] shadow-sm transition-all group-hover:brightness-110"></div>
                    <span className="text-[11px] font-bold text-slate-700">الرعاية</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="w-8 sm:w-10 bg-amber-500 rounded-t-md h-[45%] shadow-sm transition-all group-hover:brightness-110"></div>
                    <span className="text-[11px] font-bold text-slate-700">التربية</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="w-8 sm:w-10 bg-rose-500 rounded-t-md h-[30%] shadow-sm transition-all group-hover:brightness-110"></div>
                    <span className="text-[11px] font-bold text-slate-700">الصحة</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="w-8 sm:w-10 bg-purple-600 rounded-t-md h-[55%] shadow-sm transition-all group-hover:brightness-110"></div>
                    <span className="text-[11px] font-bold text-slate-700">الكهرباء</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>إجمالي الطلبات الحكومية الموثقة: {totalRequests}</span>
                <button
                  onClick={() => setActiveView('admin_preview')}
                  className="text-indigo-700 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>تفاصيل قسم الإدارة</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-xs text-slate-800">الموقف التنفيذي العام</h3>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 font-mono">الإنجاز: {completionRate}%</span>
              </div>

              <div className="space-y-2.5 py-1">
                <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs">
                  <span className="font-bold text-emerald-900">معاملات منجزة</span>
                  <span className="font-black text-emerald-800 font-mono">{completedRequests}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50/70 border border-amber-100 text-xs">
                  <span className="font-bold text-amber-900">قيد المتابعة والإجراء</span>
                  <span className="font-black text-amber-800 font-mono">{activeRequests}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-purple-50/70 border border-purple-100 text-xs">
                  <span className="font-bold text-purple-900">قيد التدقيق</span>
                  <span className="font-black text-purple-800 font-mono">{reviewRequests}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50/70 border border-blue-100 text-xs">
                  <span className="font-bold text-blue-900">مقابلات النائب المجدولة</span>
                  <span className="font-black text-blue-800 font-mono">{pendingInterviews.length}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between text-[11px] text-slate-500 font-semibold mb-1">
                  <span>كفاءة التنسيق والسرعة</span>
                  <span className="font-bold text-indigo-600">{activeRate || 75}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${activeRate || 75}%` }}></div>
                </div>
              </div>
            </div>

          </div>

          {/* Department Quick Nav Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              onClick={() => setActiveView('reception_preview')}
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/30 transition-all text-right shadow-2xs group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-xs text-slate-900">الاستعلامات</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{totalCitizens} مراجع</div>
            </button>

            <button
              onClick={() => setActiveView('admin_preview')}
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 transition-all text-right shadow-2xs group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <FolderKanban className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-xs text-slate-900">الإدارة</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{totalRequests} معاملة</div>
            </button>

            <button
              onClick={() => setActiveView('interviews_preview')}
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 transition-all text-right shadow-2xs group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Handshake className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-xs text-slate-900">المقابلات</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{pendingInterviews.length} موعد</div>
            </button>

            <button
              onClick={() => setActiveView('org_preview')}
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-purple-400 hover:bg-purple-50/30 transition-all text-right shadow-2xs group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-xs text-slate-900">التنظيم</div>
              <div className="text-[10px] text-slate-500 mt-0.5">الكوادر والجمهور</div>
            </button>

            <button
              onClick={() => setActiveView('machine_preview')}
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all text-right shadow-2xs group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <Printer className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-xs text-slate-900">المكنة والطباعة</div>
              <div className="text-[10px] text-slate-500 mt-0.5">سحب الكتب والباجات</div>
            </button>

            <button
              onClick={() => setActiveView('audit_preview')}
              className="p-3 rounded-xl bg-white border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 transition-all text-right shadow-2xs group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-xs text-slate-900">الرقابة والتشريع</div>
              <div className="text-[10px] text-slate-500 mt-0.5">سجل التدقيق</div>
            </button>
          </div>

          {/* Embedded Detailed Analytics Sections */}
          <div className="pt-2">
            <EmployeeDepartmentStats />
          </div>

          <div className="pt-2">
            <ClanDistrictStats />
          </div>

          <div className="pt-2">
            <ReferrersStats />
          </div>
        </>
      )}

    </div>
  );
};
