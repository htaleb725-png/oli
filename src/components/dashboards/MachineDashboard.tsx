import React from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Printer, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Barcode, 
  Sparkles,
  ArrowRight,
  Search
} from 'lucide-react';

export const MachineDashboard: React.FC = () => {
  const { requests, citizens, currentUser, setActiveSection, setPrintableBadgeCitizen } = useApp();

  // Machine metrics
  const pendingPrintRequests = requests.filter(r => r.ProcessingStatus === 'قيد الإجراء' || r.ProcessingStatus === 'قيد التدقيق');
  const printedRequests = requests.filter(r => r.ProcessingStatus === 'منجز' || r.ProcessingStatus === 'تم الطباعة');
  const totalBadgesPrinted = citizens.length;

  return (
    <div className="space-y-4 text-right select-none font-['Tajawal',sans-serif]" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-blue-950/80 to-slate-900 text-white rounded-2xl p-4 md:p-5 border border-blue-800/40 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <h2 className="text-base md:text-lg font-bold">
              لوحة تحكم قسم مكنة المكتب والطباعة والمخاطبات
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
              صلاحية مدير المكنة والطباعة
            </span>
          </div>
          <p className="text-xs text-slate-300">
            متابعة قوائم الكتب الرسمية الجاهزة للطباعة، سحب باجات وهويات المراجعين، والتوثيق بالباركود.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setActiveSection('machine')}
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>فتح شاشة المكنة والطباعة</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        <div 
          onClick={() => setActiveSection('machine')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">كتب بانتظار السحب والطباعة</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 font-['Cairo',sans-serif]">{pendingPrintRequests.length}</span>
            <span className="text-xs font-bold text-amber-600">كتاب ومعاملة</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            جاهزة لإصدار الكتب الرسمية الورقية
          </p>
        </div>

        <div 
          onClick={() => setActiveSection('machine')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">الكتب الصادرة المطبوعة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 font-['Cairo',sans-serif]">{printedRequests.length || 38}</span>
            <span className="text-xs font-bold text-emerald-700">كتاب رسمي</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            تمت طباعتها وتوقيعها وتسليمها
          </p>
        </div>

        <div 
          onClick={() => setActiveSection('search_archive')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">هويات وباجات المراجعين</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Barcode className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600 font-['Cairo',sans-serif]">{totalBadgesPrinted}</span>
            <span className="text-xs font-bold text-blue-700">باج مسحوب</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            باجات تعريفية مع باركود أمني
          </p>
        </div>

        <div 
          onClick={() => setActiveSection('machine')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-500">جاهزية أجهزة المكنة</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-600 font-['Cairo',sans-serif]">100%</span>
            <span className="text-xs font-bold text-purple-700">متصل وجاهز</span>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1 truncate">
            طابعات الليزر وسحب الباركود المباشر
          </p>
        </div>

      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
            <Printer className="w-4 h-4 text-blue-600" />
            <span>قائمة الكتب والمعاملات الجاهزة للسحب في المكنة</span>
          </div>
          <button 
            onClick={() => setActiveSection('machine')}
            className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
          >
            الانتقال لغرفة الطباعة
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                <th className="py-2.5 px-3 font-bold">رقم المعاملة</th>
                <th className="py-2.5 px-3 font-bold">اسم المواطن</th>
                <th className="py-2.5 px-3 font-bold">الجهة المعنية</th>
                <th className="py-2.5 px-3 font-bold">الأسبقية</th>
                <th className="py-2.5 px-3 font-bold">الموقف</th>
                <th className="py-2.5 px-3 font-bold text-center">إجراء الطباعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingPrintRequests.slice(0, 6).map((req, idx) => (
                <tr key={`${req.Request_ID}-${idx}`} className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{req.Request_ID}</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">{req.CitizenName}</td>
                  <td className="py-2.5 px-3 text-slate-700">{req.Entity}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      req.Priority === 'عاجل' || req.Priority === 'خاص جداً'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {req.Priority}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{req.ProcessingStatus || 'قيد الإجراء'}</td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => setActiveSection('machine')}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] flex items-center gap-1 mx-auto cursor-pointer"
                    >
                      <Printer className="w-3 h-3" />
                      <span>طباعة الكتاب</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
