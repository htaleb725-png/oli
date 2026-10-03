import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  ShieldCheck, 
  AlertTriangle, 
  FileCheck2, 
  Clock, 
  UserCheck, 
  Lock, 
  ArrowRight,
  Filter
} from 'lucide-react';

export const AuditDashboard: React.FC = () => {
  const { auditLogs, currentUser, setActiveSection } = useApp();

  const totalLogs = auditLogs.length;
  const editLogs = auditLogs.filter(l => l.Action.includes('تعديل') || l.Action.includes('حذف'));
  const loginLogs = auditLogs.filter(l => l.Action.includes('دخول') || l.Action.includes('خروج'));
  const securityLogs = auditLogs.filter(l => l.Section.includes('أمان') || l.Action.includes('صلاحية'));

  return (
    <div className="space-y-4 text-right select-none font-['Tajawal',sans-serif]" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-rose-950/80 to-slate-900 text-white rounded-2xl p-4 md:p-5 border border-rose-800/40 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h2 className="text-base md:text-lg font-bold">
              لوحة تحكم قسم الرقابة والتشريع والتدقيق الداخلي
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
              صلاحية مسؤول الرقابة والتشريع
            </span>
          </div>
          <p className="text-xs text-slate-300">
            تدقيق سلامة الإجراءات الإدارية، مراقبة سجل العمليات، التحقق من حركة تعديل البيانات، وتتبع الشفافية والنزاهة.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveSection('audit')}
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>سجل الرقابة الكامل</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        <div 
          onClick={() => setActiveSection('audit')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">إجمالي الحركات المدققة</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-['Cairo',sans-serif]">{totalLogs}</span>
            <span className="text-xs font-bold text-rose-600">عملية موثقة</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            جميع الأنشطة المرصودة أمنياً وإدارياً
          </p>
        </div>

        <div 
          onClick={() => setActiveSection('audit')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">عمليات التعديل والحذف</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 font-['Cairo',sans-serif]">{editLogs.length}</span>
            <span className="text-xs font-bold text-amber-700">تغيير قيد</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            عمليات خاضعة للتدقيق المباشر
          </p>
        </div>

        <div 
          onClick={() => setActiveSection('audit')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">جلسات الدخول والمصادقة</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600 font-['Cairo',sans-serif]">{loginLogs.length}</span>
            <span className="text-xs font-bold text-blue-700">جلسة عمل</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            دخول الموظفين والمسؤولين للأقسام
          </p>
        </div>

        <div 
          onClick={() => setActiveSection('audit')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">مؤشر النزاهة والامتثال</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 font-['Cairo',sans-serif]">99.8%</span>
            <span className="text-xs font-bold text-emerald-700">مطابقة تشريعية</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            التزام كامل بالضوابط الرقابية
          </p>
        </div>

      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
            <Clock className="w-4 h-4 text-rose-600" />
            <span>سجل الرقابة الحي وتتبع العمليات الإدارية</span>
          </div>
          <button 
            onClick={() => setActiveSection('audit')}
            className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
          >
            تصدير تقرير التدقيق
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                <th className="py-2.5 px-3 font-bold">التوقيت والتاريخ</th>
                <th className="py-2.5 px-3 font-bold">الإجراء / الحركة</th>
                <th className="py-2.5 px-3 font-bold">القسم المستهدف</th>
                <th className="py-2.5 px-3 font-bold">الموظف القائم بالحركة</th>
                <th className="py-2.5 px-3 font-bold">تفاصيل العملية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.slice(0, 8).map((log) => (
                <tr key={log.Log_ID} className="hover:bg-rose-50/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500" dir="ltr">{log.Timestamp}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{log.Action}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                      {log.Section}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-rose-800 font-semibold">{log.PerformedBy}</td>
                  <td className="py-2.5 px-3 text-slate-600 text-[11px]">{log.Details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
