import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  UserCheck, 
  Printer, 
  Building2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  Users, 
  Handshake, 
  Layers, 
  Calendar,
  Sparkles,
  ShieldCheck,
  Briefcase
} from 'lucide-react';

export const EmployeeDepartmentStats: React.FC = () => {
  const { currentUser, citizens, requests, interviews, organizationRecords } = useApp();

  // Selected department to view (defaults to currentUser's department)
  const [selectedDept, setSelectedDept] = useState<string>(() => {
    if (currentUser.Role === 'reception' || currentUser.Role === 'reception_officer') return 'reception';
    if (currentUser.Role === 'admin' || currentUser.Role === 'admin_officer') return 'admin';
    if (currentUser.Role === 'interviews_officer') return 'interviews';
    if (currentUser.Role === 'organization' || currentUser.Role === 'organization_officer') return 'organization';
    return 'all';
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Reception stats
  const receptionStats = useMemo(() => {
    const totalCitizens = citizens.length;
    const maleCount = citizens.filter(c => c.Gender === 'ذكر').length;
    const femaleCount = citizens.filter(c => c.Gender === 'أنثى').length;
    const todayCitizens = citizens.filter(c => c.CreatedAt && c.CreatedAt.startsWith(todayStr)).length;
    
    // Ratings
    const idealRating = citizens.filter(c => c.Rating && (c.Rating.includes('مؤيد') || c.Rating.includes('مثالي'))).length;
    const normalRating = citizens.filter(c => c.Rating && c.Rating.includes('لائق')).length;
    const worriedRating = citizens.filter(c => c.Rating && c.Rating.includes('قلق')).length;

    return {
      totalCitizens,
      maleCount,
      femaleCount,
      todayCitizens,
      idealRating,
      normalRating,
      worriedRating
    };
  }, [citizens, todayStr]);

  // 2. Admin (Requests) stats
  const adminStats = useMemo(() => {
    const total = requests.length;
    const completed = requests.filter(r => r.ProcessingStatus === 'منجز').length;
    const inProgress = requests.filter(r => r.ProcessingStatus === 'قيد الإجراء' || r.ProcessingStatus === 'قيد التدقيق').length;
    const sentToMinistry = requests.filter(r => r.ProcessingStatus === 'مرسل إلى الوزارة/الهيئة').length;
    const urgent = requests.filter(r => r.Priority === 'عاجل' || r.Priority === 'خاص جداً').length;
    const printed = requests.filter(r => r.ProcessingStatus === 'تم الطباعة').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      completed,
      inProgress,
      sentToMinistry,
      urgent,
      printed,
      completionRate
    };
  }, [requests]);

  // 3. Interviews stats
  const interviewStats = useMemo(() => {
    const total = interviews.length;
    const scheduled = interviews.filter(i => i.Status === 'مجدولة').length;
    const done = interviews.filter(i => i.Status === 'تمت المقابلة').length;
    const postponed = interviews.filter(i => i.Status === 'مؤجلة').length;
    const urgent = interviews.filter(i => i.Priority === 'عاجل' || i.Priority === 'خاص جداً').length;

    return {
      total,
      scheduled,
      done,
      postponed,
      urgent
    };
  }, [interviews]);

  // 4. Organization stats
  const orgStats = useMemo(() => {
    const total = organizationRecords.length;
    const leaders = organizationRecords.filter(o => o.OrgRating === 'كادر قيادي' || o.InfluenceType === 'شخصية مؤثرة').length;
    const supporters = organizationRecords.filter(o => o.OrgRating === 'مؤيد').length;

    return {
      total,
      leaders,
      supporters
    };
  }, [organizationRecords]);

  // Print Official Department Position Sheet
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4 text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>الموقف الإحصائي للموظف والقسم (جاهز للطباعة)</span>
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              {currentUser.FullName} ({currentUser.RoleArabic})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            إحصائيات تفصيلية فورية لكل قسم من أقسام المكتب مع إمكانية طباعة تقرير رسمي معتمد وموقع
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Department selector */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">كافة أقسام المكتب مجتمعة</option>
            <option value="reception">قسم الاستعلامات وشؤون المواطنين</option>
            <option value="admin">قسم الإدارة والمعاملات والكتب</option>
            <option value="interviews">قسم المقابلات ومكتب النائب</option>
            <option value="organization">قسم المكنة والتنظيم الجماهيري</option>
          </select>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الموقف الإحصائي</span>
          </button>
        </div>
      </div>

      {/* Printable Area with Official Header */}
      <div className="space-y-4">
        {/* Official Letterhead (Noticeable in Print) */}
        <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
          <div>
            <div className="text-xs font-black text-slate-900">جمهورية العراق | مجلس النواب العراقي</div>
            <div className="text-sm font-bold text-emerald-800 mt-0.5">مكتب النائب علا الناشي - محافظة ذي قار</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              تقرير الموقف التشغيلي والإحصائي الرسمي | تاريخ الإصدار: {new Date().toLocaleDateString('ar-IQ')}
            </div>
          </div>

          <div className="text-left sm:border-r sm:pr-4 border-slate-200 text-xs">
            <div className="text-slate-500">الموظف القائم بالإعداد:</div>
            <div className="font-bold text-slate-900">{currentUser.FullName}</div>
            <div className="text-[11px] text-emerald-700 font-semibold">{currentUser.Department}</div>
          </div>
        </div>

        {/* 1. RECEPTION STATS (If selected or 'all') */}
        {(selectedDept === 'reception' || selectedDept === 'all') && (
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                <span>إحصائيات قسم الاستعلامات وشؤون المراجعين</span>
              </h4>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[11px] font-bold">
                {receptionStats.totalCitizens} مراجع مسجل
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <div className="text-[11px] text-slate-500">إجمالي المراجعين</div>
                <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{receptionStats.totalCitizens}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <div className="text-[11px] text-slate-500">الذكور / الإناث</div>
                <div className="text-sm font-bold text-blue-700 mt-1 font-mono">
                  {receptionStats.maleCount} ذكر / {receptionStats.femaleCount} أنثى
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <div className="text-[11px] text-slate-500">المراجعين المثاليين والمؤيدين</div>
                <div className="text-xl font-black text-emerald-700 mt-0.5 font-mono">{receptionStats.idealRating}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <div className="text-[11px] text-slate-500">مراجعي اليوم الجدد</div>
                <div className="text-xl font-black text-indigo-700 mt-0.5 font-mono">{receptionStats.todayCitizens}</div>
              </div>
            </div>
          </div>
        )}

        {/* 2. ADMIN STATS (If selected or 'all') */}
        {(selectedDept === 'admin' || selectedDept === 'all') && (
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>إحصائيات قسم الإدارة والمعاملات ومتابعة الوزارات</span>
              </h4>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold font-mono">
                نسبة الإنجاز: {adminStats.completionRate}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <div className="text-[11px] text-slate-500">إجمالي الطلبات والمعاملات</div>
                <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{adminStats.total}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-emerald-200 bg-emerald-50/30">
                <div className="text-[11px] text-emerald-700 font-semibold">المعاملات المنجزة</div>
                <div className="text-xl font-black text-emerald-800 mt-0.5 font-mono">{adminStats.completed}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-blue-200">
                <div className="text-[11px] text-blue-700 font-semibold">قيد التدقيق والإجراء</div>
                <div className="text-xl font-black text-blue-800 mt-0.5 font-mono">{adminStats.inProgress}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-red-200">
                <div className="text-[11px] text-red-700 font-semibold">المعاملات العاجلة</div>
                <div className="text-xl font-black text-red-800 mt-0.5 font-mono">{adminStats.urgent}</div>
              </div>
            </div>
          </div>
        )}

        {/* 3. INTERVIEWS STATS (If selected or 'all') */}
        {(selectedDept === 'interviews' || selectedDept === 'all') && (
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Handshake className="w-4 h-4 text-indigo-600" />
                <span>إحصائيات قسم المقابلات ومواعيد النائب</span>
              </h4>
              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                {interviewStats.total} مقابلة مسجلة
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <div className="text-[11px] text-slate-500">إجمالي المقابلات</div>
                <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{interviewStats.total}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-indigo-200">
                <div className="text-[11px] text-indigo-700 font-semibold">المقابلات المجدولة القادمة</div>
                <div className="text-xl font-black text-indigo-900 mt-0.5 font-mono">{interviewStats.scheduled}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-emerald-200">
                <div className="text-[11px] text-emerald-700 font-semibold">مقابلات تمت بنجاح</div>
                <div className="text-xl font-black text-emerald-800 mt-0.5 font-mono">{interviewStats.done}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-amber-200">
                <div className="text-[11px] text-amber-700 font-semibold">مقابلات مؤجلة / معلقة</div>
                <div className="text-xl font-black text-amber-800 mt-0.5 font-mono">{interviewStats.postponed}</div>
              </div>
            </div>
          </div>
        )}

        {/* 4. ORGANIZATION STATS (If selected or 'all') */}
        {(selectedDept === 'organization' || selectedDept === 'all') && (
          <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600" />
                <span>إحصائيات قسم المكنة والتنظيم المكتبي والانتخابي</span>
              </h4>
              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[11px] font-bold">
                {orgStats.total} سجل تنظيمي
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-white border border-slate-200">
                <div className="text-[11px] text-slate-500">إجمالي السجلات التنظيمية</div>
                <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">{orgStats.total}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-purple-200">
                <div className="text-[11px] text-purple-700 font-semibold">الكوادر القيادية والمؤثرة</div>
                <div className="text-xl font-black text-purple-900 mt-0.5 font-mono">{orgStats.leaders}</div>
              </div>
              <div className="p-3 rounded-lg bg-white border border-emerald-200">
                <div className="text-[11px] text-emerald-700 font-semibold">المؤيدون المعتمدون</div>
                <div className="text-xl font-black text-emerald-800 mt-0.5 font-mono">{orgStats.supporters}</div>
              </div>
            </div>
          </div>
        )}

        {/* Print Sign-off Box */}
        <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="text-center">
            <div className="font-bold text-slate-800">إعداد موظف القسم المختص</div>
            <div className="mt-1 text-slate-500 font-semibold">{currentUser.FullName}</div>
            <div className="mt-6 border-b border-dashed border-slate-400 w-32 mx-auto"></div>
            <div className="text-[10px] text-slate-400 mt-1">التوقيع والتاريخ</div>
          </div>

          <div className="text-center">
            <div className="font-bold text-slate-800">مصادقة مدير مكتب النائب</div>
            <div className="mt-1 text-slate-500 font-semibold">الأستاذ حيدر الموسوي</div>
            <div className="mt-6 border-b border-dashed border-slate-400 w-32 mx-auto"></div>
            <div className="text-[10px] text-slate-400 mt-1">الختم والمصادقة الرسمية</div>
          </div>
        </div>
      </div>
    </div>
  );
};
