import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Handshake, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  FileText, 
  ArrowRight,
  Plus,
  Search,
  Building2,
  Sparkles
} from 'lucide-react';

export const InterviewsDashboard: React.FC = () => {
  const { interviews, currentUser, setActiveSection, setSelectedCitizenForHistory } = useApp();
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const totalInterviews = interviews.length;
  const scheduledInterviews = interviews.filter(i => i.Status === 'مجدولة');
  const completedInterviews = interviews.filter(i => i.Status === 'تمت المقابلة');
  const referredInterviews = interviews.filter(i => i.Status === 'تمت الإحالة' || i.Directive);
  const urgentInterviews = interviews.filter(i => i.Priority === 'عاجل' || i.Priority === 'خاص جداً');

  // Subjects breakdown
  const subjectCounts: Record<string, number> = {};
  interviews.forEach(i => {
    const subj = i.Subject || 'موضوع عام';
    subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
  });

  const sortedSubjects = Object.entries(subjectCounts).slice(0, 5);

  const filteredList = interviews.filter(i => {
    if (filterStatus === 'all') return true;
    return i.Status === filterStatus;
  });

  return (
    <div className="space-y-4 text-right select-none font-['Tajawal',sans-serif]" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-teal-950/80 to-slate-900 text-white rounded-2xl p-4 md:p-5 border border-teal-800/40 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
              <Handshake className="w-4 h-4" />
            </div>
            <h2 className="text-base md:text-lg font-bold">
              لوحة تحكم قسم مقابلات النائب المهندسة علا الناشي
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
              صلاحية مسؤول المقابلات
            </span>
          </div>
          <p className="text-xs text-slate-300">
            جدولة مواعيد المقابلات الأسبوعية، تنظيم حضور المراجعين، توثيق هوامش وتوجيهات النائب المباشرة.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveSection('interviews')}
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-4 h-4" />
            <span>جدولة مقابلة جديدة</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* KPI 1: المقابلات المجدولة */}
        <div 
          onClick={() => { setFilterStatus('مجدولة'); setActiveSection('interviews'); }}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">مقابلات مجدولة قادمة</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-['Cairo',sans-serif]">{scheduledInterviews.length}</span>
            <span className="text-xs font-bold text-teal-600">بانتظار الموعد</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            المراجعين المسجلين في جدول المقابلات المعتمد
          </p>
        </div>

        {/* KPI 2: المقابلات المكتملة */}
        <div 
          onClick={() => { setFilterStatus('تمت المقابلة'); setActiveSection('interviews'); }}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">مقابلات تمت بنجاح</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 font-['Cairo',sans-serif]">{completedInterviews.length}</span>
            <span className="text-xs font-bold text-emerald-700">مقابلة منجزة</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            تمت مقابلتهم شخصياً مع النائب
          </p>
        </div>

        {/* KPI 3: المحالة بتوجيه مباشر */}
        <div 
          onClick={() => setActiveSection('interviews')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">أحيلت بتوجيه خاص</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-600 font-['Cairo',sans-serif]">{referredInterviews.length}</span>
            <span className="text-xs font-bold text-purple-700">توجيه صادر</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            صدر بشأنها هامش أو كتاب إحالة مباشر
          </p>
        </div>

        {/* KPI 4: إجمالي المقابلات الكلية */}
        <div 
          onClick={() => setActiveSection('interviews')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">إجمالي سجل المقابلات</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Handshake className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600 font-['Cairo',sans-serif]">{totalInterviews}</span>
            <span className="text-xs font-bold text-blue-700">طلب مقابلة</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            جميع المقابلات المسجلة في هذا الفصل
          </p>
        </div>

      </div>

      {/* Schedule Table & Directives */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-xs text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>جدول المقابلات ومواعيد حضور المواطنين</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ترتيب المراجعين حسب أوقات المواعيد وتوجيهات النائب
            </p>
          </div>

          <button
            onClick={() => setActiveSection('interviews')}
            className="px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-colors cursor-pointer"
          >
            إدارة كافة المواعيد
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                <th className="py-2.5 px-3 font-bold">الموعد والتاريخ</th>
                <th className="py-2.5 px-3 font-bold">اسم المواطن</th>
                <th className="py-2.5 px-3 font-bold">موضوع المقابلة</th>
                <th className="py-2.5 px-3 font-bold">الأسبقية</th>
                <th className="py-2.5 px-3 font-bold">حالة المقابلة</th>
                <th className="py-2.5 px-3 font-bold">توجيه / هامش النائب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.slice(0, 8).map((interview) => (
                <tr key={interview.Interview_ID} className="hover:bg-teal-50/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                    {interview.InterviewDate} {interview.InterviewTime || ''}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {interview.CitizenName}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {interview.Subject}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      interview.Priority === 'عاجل' || interview.Priority === 'خاص جداً'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {interview.Priority}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      interview.Status === 'تمت المقابلة'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : interview.Status === 'مجدولة'
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      {interview.Status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 text-[11px] font-medium">
                    {interview.DeputyNotes || interview.Directive || 'قيد المقابلة'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredList.length === 0 && (
          <div className="text-center py-6 text-slate-400 text-xs">
            لا توجد مقابلات مجدولة حالياً
          </div>
        )}
      </div>

    </div>
  );
};
